import { setTimeout as delay } from 'node:timers/promises';
import { AppError } from './errors.js';
import type { Logger } from './logger.js';

export type FetchFn = (url: string, init: RequestInit) => Promise<Response>;
export type QueryParams = Readonly<Record<string, string | number | boolean | undefined>>;

export interface HttpClientOptions {
  /** Nome da fonte exibido em logs e mensagens de erro (ex.: "Steam"). */
  source: string;
  baseUrl: string;
  logger: Logger;
  headers?: Readonly<Record<string, string>>;
  timeoutMs?: number;
  maxAttempts?: number;
  /** Intervalo mínimo entre requisições consecutivas à mesma fonte. */
  minIntervalMs?: number;
  circuitBreaker?: { failureThreshold: number; cooldownMs: number };
  fetch?: FetchFn;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  random?: () => number;
}

/** Resposta HTTP de erro que não deve ser repetida (ex.: 400, 403, 404). */
export class HttpStatusError extends AppError {
  readonly status: number;

  constructor(source: string, status: number) {
    super('UPSTREAM_ERROR', `${source}: erro HTTP ${status}.`);
    this.name = 'HttpStatusError';
    this.status = status;
  }
}

type Failure =
  | { kind: 'status'; status: number; retryAfterMs: number | null }
  | { kind: 'timeout' }
  | { kind: 'network'; cause: unknown };

type AttemptResult = { ok: true; body: unknown } | { ok: false; failure: Failure };

const BASE_RETRY_DELAY_MS = 500;
const MAX_RETRY_DELAY_MS = 10_000;

export class HttpClient {
  private readonly source: string;
  private readonly baseUrl: string;
  private readonly logger: Logger;
  private readonly headers: Readonly<Record<string, string>>;
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;
  private readonly fetchFn: FetchFn;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;
  private readonly random: () => number;
  private readonly limiter: IntervalLimiter;
  private readonly breaker: CircuitBreaker;

  constructor(options: HttpClientOptions) {
    this.source = options.source;
    this.baseUrl = options.baseUrl;
    this.logger = options.logger;
    this.headers = options.headers ?? {};
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.maxAttempts = Math.max(1, options.maxAttempts ?? 3);
    this.fetchFn = options.fetch ?? ((url, init) => fetch(url, init));
    this.sleep = options.sleep ?? ((ms) => delay(ms));
    this.now = options.now ?? (() => Date.now());
    this.random = options.random ?? (() => Math.random());
    this.limiter = new IntervalLimiter(options.minIntervalMs ?? 0, this.now, this.sleep);
    const breaker = options.circuitBreaker ?? { failureThreshold: 5, cooldownMs: 30_000 };
    this.breaker = new CircuitBreaker(breaker.failureThreshold, breaker.cooldownMs, this.now);
  }

  /**
   * GET com timeout, ritmo limitado, retry com backoff exponencial e circuit breaker.
   * Retorna o JSON sem validação: quem chama deve validar o formato.
   */
  async getJson(path: string, query: QueryParams = {}): Promise<unknown> {
    if (this.breaker.isOpen()) {
      this.logger.warn({ source: this.source, path }, 'http.circuit_open');
      throw new AppError(
        'UPSTREAM_UNAVAILABLE',
        `${this.source}: serviço temporariamente indisponível.`,
        {
          hints: ['Houve muitas falhas seguidas. Aguarde alguns segundos e tente novamente.'],
        },
      );
    }

    const url = this.buildUrl(path, query);
    let failure: Failure | undefined;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      await this.limiter.wait();
      const result = await this.attempt(url, path, attempt);
      if (result.ok) {
        this.breaker.recordSuccess();
        return result.body;
      }

      failure = result.failure;
      if (!isRetryable(failure) || attempt === this.maxAttempts) break;

      const delayMs = this.retryDelay(attempt, failure);
      this.logger.warn(
        { source: this.source, path, attempt, delayMs, reason: describeFailure(failure) },
        'http.retry',
      );
      await this.sleep(delayMs);
    }

    throw this.errorFor(failure);
  }

  private buildUrl(path: string, query: QueryParams): URL {
    const url = new URL(path, this.baseUrl);
    for (const [name, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(name, String(value));
    }
    return url;
  }

  // A query string nunca é registrada nos logs: é nela que ficam as chaves de API.
  private async attempt(url: URL, path: string, attempt: number): Promise<AttemptResult> {
    const startedAt = this.now();
    let status: number;
    let retryAfter: string | null;
    let text: string;

    try {
      const response = await this.fetchFn(url.toString(), {
        headers: { accept: 'application/json', ...this.headers },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      status = response.status;
      retryAfter = response.headers.get('retry-after');
      text = await response.text();
    } catch (error) {
      const failure: Failure = isTimeoutError(error)
        ? { kind: 'timeout' }
        : { kind: 'network', cause: error };
      this.logger.warn(
        { source: this.source, path, attempt, reason: failure.kind },
        'http.request.failed',
      );
      return { ok: false, failure };
    }

    this.logger.debug(
      { source: this.source, path, attempt, status, durationMs: this.now() - startedAt },
      'http.request',
    );

    if (status < 200 || status >= 300) {
      return {
        ok: false,
        failure: { kind: 'status', status, retryAfterMs: this.parseRetryAfter(retryAfter) },
      };
    }

    try {
      return { ok: true, body: JSON.parse(text) as unknown };
    } catch (error) {
      throw new AppError('UPSTREAM_ERROR', `${this.source}: resposta inválida.`, { cause: error });
    }
  }

  private retryDelay(attempt: number, failure: Failure): number {
    if (failure.kind === 'status' && failure.retryAfterMs !== null) {
      return Math.min(failure.retryAfterMs, MAX_RETRY_DELAY_MS);
    }
    const exponential = BASE_RETRY_DELAY_MS * 2 ** (attempt - 1);
    return Math.min(exponential + Math.round(this.random() * 250), MAX_RETRY_DELAY_MS);
  }

  private parseRetryAfter(value: string | null): number | null {
    if (value === null || value.trim() === '') return null;
    const seconds = Number(value);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const date = Date.parse(value);
    return Number.isNaN(date) ? null : Math.max(0, date - this.now());
  }

  /** Converte a última falha em erro amigável e atualiza o circuit breaker. */
  private errorFor(failure: Failure | undefined): AppError {
    if (failure?.kind === 'status' && failure.status === 429) {
      return new AppError('RATE_LIMITED', `${this.source}: limite de requisições atingido.`, {
        hints: ['Aguarde alguns minutos e tente novamente.'],
      });
    }
    if (failure?.kind === 'status' && failure.status < 500) {
      // O serviço respondeu: um erro 4xx não indica indisponibilidade.
      this.breaker.recordSuccess();
      return new HttpStatusError(this.source, failure.status);
    }

    this.breaker.recordFailure();
    if (failure?.kind === 'timeout') {
      return new AppError('TIMEOUT', `${this.source}: o serviço demorou demais para responder.`, {
        hints: ['Tente novamente em alguns instantes.'],
      });
    }
    if (failure?.kind === 'network') {
      return new AppError('UPSTREAM_UNAVAILABLE', `${this.source}: não foi possível conectar.`, {
        hints: ['Verifique sua conexão com a internet.'],
        cause: failure.cause,
      });
    }
    return new AppError(
      'UPSTREAM_UNAVAILABLE',
      `${this.source}: serviço indisponível no momento.`,
      {
        hints: ['Tente novamente em alguns minutos.'],
      },
    );
  }
}

function isRetryable(failure: Failure): boolean {
  return failure.kind !== 'status' || failure.status === 429 || failure.status >= 500;
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
}

function describeFailure(failure: Failure): string {
  return failure.kind === 'status' ? `HTTP ${failure.status}` : failure.kind;
}

/** Garante um intervalo mínimo entre requisições, mesmo quando disparadas em paralelo. */
class IntervalLimiter {
  private nextSlot = 0;

  constructor(
    private readonly intervalMs: number,
    private readonly now: () => number,
    private readonly sleep: (ms: number) => Promise<void>,
  ) {}

  async wait(): Promise<void> {
    const now = this.now();
    // A vaga é reservada antes do await, então chamadas simultâneas recebem vagas diferentes.
    const slot = Math.max(now, this.nextSlot);
    this.nextSlot = slot + this.intervalMs;
    if (slot > now) await this.sleep(slot - now);
  }
}

/** Após N falhas seguidas, rejeita chamadas até o fim do cooldown; depois libera uma tentativa. */
class CircuitBreaker {
  private consecutiveFailures = 0;
  private openedAt: number | null = null;

  constructor(
    private readonly failureThreshold: number,
    private readonly cooldownMs: number,
    private readonly now: () => number,
  ) {}

  isOpen(): boolean {
    return this.openedAt !== null && this.now() - this.openedAt < this.cooldownMs;
  }

  recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.openedAt = null;
  }

  recordFailure(): void {
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= this.failureThreshold) this.openedAt = this.now();
  }
}
