import {
  averageDamagePerRound,
  compareRecentToPrevious,
  headshotPercentage,
  killDeathRatio,
  mapHighlights,
  MIN_MAP_SAMPLE,
  performanceBlocks,
  performanceByMap,
  recentForm,
  streaks,
  summarize,
} from '@fraglens/analysis';
import { AppError } from '@fraglens/shared';
import type { SteamIdentifierResolver } from './identifier-resolver.js';
import type {
  AnalyzedMatch,
  MapReport,
  MatchHistory,
  PerformanceAnalysis,
  PerformanceData,
  PerformanceReportBase,
  PlayerMatch,
  ProgressReport,
} from './match.js';
import type { PerformanceSource } from './ports.js';

export const MAX_MATCHES = 100;
export const RECENT_FORM_SIZE = 10;
export const RECENT_MATCHES_IN_ANALYSIS = 10;
export const LEETIFY_ATTRIBUTION = 'Dados fornecidos pela Leetify (Data Provided by Leetify)';

export interface MatchServiceDeps {
  resolver: SteamIdentifierResolver;
  performance: PerformanceSource;
  now?: () => Date;
}

export interface MatchQuery {
  /** Quantidade de partidas mais recentes consideradas (1 a 100). Padrão: todas as disponíveis. */
  limit?: number;
}

interface LoadedMatches {
  steamId64: string;
  data: PerformanceData;
  /** Todas as partidas disponíveis, da mais recente para a mais antiga. */
  newestFirst: PlayerMatch[];
  /** As partidas dentro do limite. */
  selected: PlayerMatch[];
}

/** Partidas e relatórios calculados a partir delas. Os dados vêm ao vivo da fonte (Leetify). */
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
    const { steamId64, data, newestFirst, selected } = await this.load(input, query);

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
      matches: selected.map(analyzeMatch),
      recentForm: recentForm(
        newestFirst.map((match) => match.outcome),
        RECENT_FORM_SIZE,
      ),
      attribution: LEETIFY_ATTRIBUTION,
      fetchedAt: this.now().toISOString(),
    };
  }

  async getMapReport(input: string, query: MatchQuery = {}): Promise<MapReport> {
    const loaded = await this.load(input, query);
    return {
      ...this.reportBase(loaded),
      minMapSample: MIN_MAP_SAMPLE,
      maps: performanceByMap(loaded.selected),
    };
  }

  async getProgressReport(input: string, query: MatchQuery = {}): Promise<ProgressReport> {
    const loaded = await this.load(input, query);
    const { selected } = loaded;
    return {
      ...this.reportBase(loaded),
      summary: summarize(selected),
      comparison: compareRecentToPrevious(selected),
      streaks: streaks(selected.map((match) => match.outcome)),
      blocks: performanceBlocks(selected),
    };
  }

  /** Resumo, mapas, forma, tendência e partidas recentes a partir de um único carregamento. */
  async getPerformanceAnalysis(
    input: string,
    query: MatchQuery = {},
  ): Promise<PerformanceAnalysis> {
    const loaded = await this.load(input, query);
    const { data, selected } = loaded;
    const maps = performanceByMap(selected);
    const outcomes = selected.map((match) => match.outcome);

    return {
      ...this.reportBase(loaded),
      leetify: {
        privacyMode: data.privacyMode,
        totalMatches: data.totalMatches,
        ratings: data.ratings,
      },
      summary: summarize(selected),
      minMapSample: MIN_MAP_SAMPLE,
      maps,
      mapHighlights: mapHighlights(maps),
      recentForm: recentForm(outcomes, RECENT_FORM_SIZE),
      comparison: compareRecentToPrevious(selected),
      streaks: streaks(outcomes),
      blocks: performanceBlocks(selected),
      recentMatches: selected.slice(0, RECENT_MATCHES_IN_ANALYSIS).map(analyzeMatch),
    };
  }

  private async load(input: string, query: MatchQuery): Promise<LoadedMatches> {
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
    return { steamId64, data, newestFirst, selected: newestFirst.slice(0, limit) };
  }

  private reportBase({ steamId64, data, selected }: LoadedMatches): PerformanceReportBase {
    const newest = selected[0];
    const oldest = selected.at(-1);
    return {
      steamId64,
      playerName: data.playerName,
      ranks: data.ranks,
      sampleSize: selected.length,
      period: newest && oldest ? { from: oldest.finishedAt, to: newest.finishedAt } : null,
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
