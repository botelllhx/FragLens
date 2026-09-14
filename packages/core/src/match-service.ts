import {
  averageDamagePerRound,
  headshotPercentage,
  killDeathRatio,
  recentForm,
} from '@fraglens/analysis';
import { AppError } from '@fraglens/shared';
import type { SteamIdentifierResolver } from './identifier-resolver.js';
import type { AnalyzedMatch, MatchHistory, PlayerMatch } from './match.js';
import type { PerformanceSource } from './ports.js';

export const MAX_MATCHES = 100;
export const RECENT_FORM_SIZE = 10;
export const LEETIFY_ATTRIBUTION = 'Dados fornecidos pela Leetify (Data Provided by Leetify)';

export interface MatchServiceDeps {
  resolver: SteamIdentifierResolver;
  performance: PerformanceSource;
  now?: () => Date;
}

export interface MatchQuery {
  /** Quantidade de partidas retornadas (1 a 100). Padrão: todas as disponíveis. */
  limit?: number;
}

export class MatchService {
  private readonly resolver: SteamIdentifierResolver;
  private readonly performance: PerformanceSource;
  private readonly now: () => Date;

  constructor(deps: MatchServiceDeps) {
    this.resolver = deps.resolver;
    this.performance = deps.performance;
    this.now = deps.now ?? (() => new Date());
  }

  async getMatchHistory(input: string, query: MatchQuery = {}): Promise<MatchHistory> {
    const limit = validateLimit(query.limit);
    const steamId64 = await this.resolver.resolve(input);

    const data = await this.performance.getPlayerPerformance(steamId64);
    if (!data) {
      throw new AppError('NOT_FOUND', 'A Leetify não tem dados de partidas deste jogador.', {
        hints: [
          'A Leetify só possui dados de jogadores que ela acompanha, normalmente quem criou conta em leetify.com.',
          'Para ter seus dados: entre em leetify.com com a Steam e informe o código de autenticação de partidas.',
          'O perfil na Leetify também pode estar configurado como privado.',
        ],
      });
    }

    const newestFirst = [...data.matches].sort(byNewestFirst);

    return {
      steamId64,
      playerName: data.playerName,
      ranks: data.ranks,
      leetify: {
        privacyMode: data.privacyMode,
        totalMatches: data.totalMatches,
        ratings: data.ratings,
      },
      availableMatches: newestFirst.length,
      matches: newestFirst.slice(0, limit).map(analyzeMatch),
      recentForm: recentForm(
        newestFirst.map((match) => match.outcome),
        RECENT_FORM_SIZE,
      ),
      attribution: LEETIFY_ATTRIBUTION,
      fetchedAt: this.now().toISOString(),
    };
  }
}

function validateLimit(limit: number | undefined): number {
  if (limit === undefined) return MAX_MATCHES;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_MATCHES) {
    throw new AppError(
      'INVALID_INPUT',
      `O limite de partidas deve ser um número inteiro entre 1 e ${MAX_MATCHES}.`,
    );
  }
  return limit;
}

function byNewestFirst(a: PlayerMatch, b: PlayerMatch): number {
  return Date.parse(b.finishedAt) - Date.parse(a.finishedAt);
}

function analyzeMatch(match: PlayerMatch): AnalyzedMatch {
  const { stats } = match;
  return {
    ...match,
    metrics: {
      killDeathRatio: killDeathRatio(stats.kills, stats.deaths),
      averageDamagePerRound: averageDamagePerRound(stats.damage, stats.roundsPlayed),
      headshotPercentage: headshotPercentage(stats.headshotKills, stats.kills),
    },
  };
}
