import { describe, expect, it } from 'vitest';
import { AppError } from '../src/errors.js';
import { HttpClient, HttpStatusError, type FetchFn, type HttpClientOptions } from '../src/http.js';
import { createLogger } from '../src/logger.js';

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers });
}

function setup(responses: (Response | Error)[], overrides: Partial<HttpClientOptions> = {}) {
  const urls: string[] = [];
  const sleeps: number[] = [];
  const queue = [...responses];

  const fetch: FetchFn = (url) => {
    urls.push(url);
    const next = queue.shift();
    if (!next) return Promise.reject(new Error('Nenhuma resposta configurada no teste'));
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  };

  const client = new HttpClient({
    source: 'Teste',
    baseUrl: 'https://api.exemplo.com/',
    logger: createLogger({ level: 'silent' }),
    fetch,
    sleep: (ms) => {
      sleeps.push(ms);
      return Promise.resolve();
    },
    now: () => 1_000,
    random: () => 0,
    ...overrides,
  });

  return { client, urls, sleeps };
}

async function captureError(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
  throw new Error('Era esperado um AppError');
}

const timeoutError = () =>
  new DOMException('The operation was aborted due to timeout', 'TimeoutError');

describe('HttpClient', () => {
  it('monta a URL com a query e retorna o JSON', async () => {
    const { client, urls } = setup([jsonResponse({ ok: true })]);

    const body = await client.getJson('v1/recurso', { nome: 'a b', limite: 10, vazio: undefined });

    expect(body).toEqual({ ok: true });
    expect(urls).toEqual(['https://api.exemplo.com/v1/recurso?nome=a+b&limite=10']);
  });

  it('repete erros 5xx com backoff exponencial', async () => {
    const { client, urls, sleeps } = setup([
      jsonResponse({}, 503),
      jsonResponse({}, 502),
      jsonResponse({ ok: true }),
    ]);

    await expect(client.getJson('v1/x')).resolves.toEqual({ ok: true });
    expect(urls).toHaveLength(3);
    expect(sleeps).toEqual([500, 1000]);
  });

  it('não repete erros 4xx', async () => {
    const { client, urls } = setup([jsonResponse({}, 403)]);

    const error = await captureError(client.getJson('v1/x'));

    expect(error).toBeInstanceOf(HttpStatusError);
    expect((error as HttpStatusError).status).toBe(403);
    expect(urls).toHaveLength(1);
  });

  it('respeita Retry-After (com limite) e informa RATE_LIMITED ao esgotar as tentativas', async () => {
    const { client, sleeps } = setup([
      jsonResponse({}, 429, { 'retry-after': '2' }),
      jsonResponse({}, 429, { 'retry-after': '60' }),
      jsonResponse({}, 429),
    ]);

    const error = await captureError(client.getJson('v1/x'));

    expect(error.code).toBe('RATE_LIMITED');
    expect(sleeps).toEqual([2000, 10_000]);
  });

  it('informa TIMEOUT quando todas as tentativas expiram', async () => {
    const { client, urls } = setup([timeoutError(), timeoutError(), timeoutError()]);

    const error = await captureError(client.getJson('v1/x'));

    expect(error.code).toBe('TIMEOUT');
    expect(urls).toHaveLength(3);
  });

  it('informa UPSTREAM_UNAVAILABLE em falha de rede, preservando a causa', async () => {
    const networkError = new TypeError('fetch failed');
    const { client } = setup([networkError, networkError, networkError]);

    const error = await captureError(client.getJson('v1/x'));

    expect(error.code).toBe('UPSTREAM_UNAVAILABLE');
    expect(error.cause).toBe(networkError);
  });

  it('rejeita resposta que não é JSON', async () => {
    const { client } = setup([new Response('<html>erro</html>', { status: 200 })]);

    const error = await captureError(client.getJson('v1/x'));

    expect(error.code).toBe('UPSTREAM_ERROR');
  });

  it('abre o circuit breaker após falhas seguidas e libera nova tentativa após o cooldown', async () => {
    let now = 0;
    const { client, urls } = setup(
      [jsonResponse({}, 503), jsonResponse({}, 503), jsonResponse({ ok: true })],
      {
        maxAttempts: 1,
        circuitBreaker: { failureThreshold: 2, cooldownMs: 1_000 },
        now: () => now,
      },
    );

    await captureError(client.getJson('v1/x'));
    await captureError(client.getJson('v1/x'));
    const blocked = await captureError(client.getJson('v1/x'));

    expect(blocked.code).toBe('UPSTREAM_UNAVAILABLE');
    expect(urls).toHaveLength(2);

    now = 1_000;
    await expect(client.getJson('v1/x')).resolves.toEqual({ ok: true });
  });

  it('espaça requisições consecutivas conforme o intervalo mínimo', async () => {
    const { client, sleeps } = setup([jsonResponse({}), jsonResponse({})], { minIntervalMs: 250 });

    await Promise.all([client.getJson('v1/a'), client.getJson('v1/b')]);

    expect(sleeps).toEqual([250]);
  });

  it('não registra a query string (onde ficam as chaves) nos logs', async () => {
    const lines: string[] = [];
    const logger = createLogger({
      level: 'debug',
      destination: { write: (line) => lines.push(line) },
    });
    const { client } = setup([jsonResponse({}, 503), jsonResponse({})], { logger });

    await client.getJson('v1/x', { key: 'segredo-da-chave' });

    const output = lines.join('\n');
    expect(output).toContain('http.retry');
    expect(output).toContain('v1/x');
    expect(output).not.toContain('segredo-da-chave');
  });
});
