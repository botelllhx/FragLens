import type { PerformanceData, PerformanceSource, PlayerMatch } from '@fraglens/core';
import {
  AppError,
  HttpClient,
  HttpStatusError,
  type FetchFn,
  type HttpClientOptions,
  type Logger,
} from '@fraglens/shared';
import { z } from 'zod';
import { toPerformanceData, toPlayerMatch } from './mapping.js';
import { leetifyMatchSchema, leetifyProfileSchema } from './schemas.js';

export const LEETIFY_API_BASE_URL = 'https://api-public.cs-prod.leetify.com';

export interface LeetifyClientOptions {
  /** Opcional: sem chave a API funciona, com limites de requisição menores. */
  apiKey?: string | undefined;
  logger: Logger;
  fetch?: FetchFn;
  http?: Partial<
    Pick<HttpClientOptions, 'timeoutMs' | 'maxAttempts' | 'minIntervalMs' | 'sleep' | 'now'>
  >;
}

type Lookup = { found: true; body: unknown } | { found: false };

/**
 * Cliente da Leetify Public API. Os dados são buscados a cada consulta e nunca
 * armazenados (ver docs/decisions/0001-leetify-fonte-ao-vivo.md).
 */
export class LeetifyClient implements PerformanceSource {
  private readonly http: HttpClient;
  private readonly logger: Logger;
  private readonly hasApiKey: boolean;

  constructor(options: LeetifyClientOptions) {
    this.logger = options.logger;
    this.hasApiKey = Boolean(options.apiKey);
    this.http = new HttpClient({
      source: 'Leetify',
      baseUrl: LEETIFY_API_BASE_URL,
      logger: options.logger,
      fetch: options.fetch,
      headers: options.apiKey ? { authorization: `Bearer ${options.apiKey}` } : {},
      // A Leetify não publica limites nem envia headers de limite: ritmo conservador.
      minIntervalMs: 500,
      timeoutMs: 15_000,
      ...options.http,
    });
  }

  async getPlayerPerformance(steamId64: string): Promise<PerformanceData | null> {
    const [profile, matches] = await Promise.all([
      this.lookup('/v3/profile', steamId64),
      this.lookup('/v3/profile/matches', steamId64),
    ]);

    if (!profile.found) return null;

    const parsedProfile = leetifyProfileSchema.safeParse(profile.body);
    if (!parsedProfile.success) {
      throw new AppError('UPSTREAM_ERROR', 'Leetify: perfil em formato inesperado.', {
        cause: parsedProfile.error,
      });
    }

    const playerMatches = matches.found ? this.parseMatches(matches.body, steamId64) : [];
    return toPerformanceData(steamId64, parsedProfile.data, playerMatches);
  }

  private async lookup(path: string, steamId64: string): Promise<Lookup> {
    try {
      return { found: true, body: await this.http.getJson(path, { steam64_id: steamId64 }) };
    } catch (error) {
      // 404: a Leetify não acompanha o jogador (ou o perfil é privado).
      if (error instanceof HttpStatusError && error.status === 404) return { found: false };
      throw this.explain(error);
    }
  }

  private explain(error: unknown): unknown {
    if (error instanceof HttpStatusError && (error.status === 401 || error.status === 403)) {
      return new AppError('UNAUTHORIZED', 'Leetify: a chave de API foi recusada.', {
        hints: [
          'Confira o valor de LEETIFY_API_KEY no arquivo .env, ou remova-o para usar a API sem chave.',
        ],
        cause: error,
      });
    }
    if (error instanceof AppError && error.code === 'RATE_LIMITED' && !this.hasApiKey) {
      return new AppError('RATE_LIMITED', error.message, {
        hints: [
          ...error.hints,
          'Configure LEETIFY_API_KEY para ter limites maiores (chave gratuita em https://leetify.com/app/developer).',
        ],
        cause: error,
      });
    }
    return error;
  }

  /** Valida partida por partida: uma partida em formato inesperado é ignorada, não derruba a lista. */
  private parseMatches(body: unknown, steamId64: string): PlayerMatch[] {
    const list = z.array(z.unknown()).safeParse(body);
    if (!list.success) {
      throw new AppError('UPSTREAM_ERROR', 'Leetify: lista de partidas em formato inesperado.', {
        cause: list.error,
      });
    }

    const matches: PlayerMatch[] = [];
    let skipped = 0;

    for (const item of list.data) {
      const parsed = leetifyMatchSchema.safeParse(item);
      const playerStats = parsed.success
        ? parsed.data.stats.find((stats) => stats.steam64_id === steamId64)
        : undefined;

      if (!parsed.success || !playerStats) {
        skipped++;
        continue;
      }
      matches.push(toPlayerMatch(parsed.data, playerStats));
    }

    if (skipped > 0) {
      this.logger.warn(
        { source: 'Leetify', skipped, total: list.data.length },
        'leetify.matches.skipped',
      );
    }
    return matches;
  }
}
