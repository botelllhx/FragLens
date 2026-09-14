import { AppError } from '@fraglens/shared';
import type { SteamIdentifierResolver } from './identifier-resolver.js';
import type { PerformanceAnalysis } from './match.js';
import type { MatchService } from './match-service.js';
import type { PlayerProfile } from './profile.js';
import type { ProfileService } from './profile-service.js';
import { StoreGuard } from './store-guard.js';

/** Algo que impediu parte da análise, sem impedir o relatório. */
export interface AnalysisNotice {
  code: string;
  message: string;
  hints: readonly string[];
}

/** Situação da interpretação por IA. Provedores reais entram na Fase 8. */
export type AiAnalysisResult =
  { status: 'disabled'; message: string } | { status: 'not-configured'; message: string };

export interface PlayerAnalysis {
  steamId64: string;
  profile: PlayerProfile;
  /** `null` quando não foi possível obter as partidas (ver `notices`). */
  performance: PerformanceAnalysis | null;
  notices: AnalysisNotice[];
  aiAnalysis: AiAnalysisResult;
  /** ISO 8601. */
  analyzedAt: string;
}

export interface AnalyzeQuery {
  /** Ignora o cache do perfil Steam. */
  refresh?: boolean;
  /** Partidas mais recentes consideradas (1 a 100). */
  limit?: number;
  /** `false` desativa a interpretação por IA. */
  ai?: boolean;
}

export interface AnalysisServiceDeps {
  resolver: SteamIdentifierResolver;
  profiles: ProfileService;
  matches: MatchService;
  store?: StoreGuard;
  now?: () => Date;
}

/** Análise completa de um jogador: perfil Steam + métricas calculadas a partir das partidas. */
export class AnalysisService {
  private readonly resolver: SteamIdentifierResolver;
  private readonly profiles: ProfileService;
  private readonly matches: MatchService;
  private readonly store: StoreGuard;
  private readonly now: () => Date;

  constructor(deps: AnalysisServiceDeps) {
    this.resolver = deps.resolver;
    this.profiles = deps.profiles;
    this.matches = deps.matches;
    this.store = deps.store ?? new StoreGuard(undefined);
    this.now = deps.now ?? (() => new Date());
  }

  async analyze(input: string, query: AnalyzeQuery = {}): Promise<PlayerAnalysis> {
    // Resolve uma única vez; os serviços recebem a SteamID64 e não consultam a Steam de novo.
    const steamId64 = await this.resolver.resolve(input);

    return this.store.trackJob(steamId64, 'analysis', async () => {
      const [profile, performance] = await Promise.all([
        this.profiles.getProfile(steamId64, { refresh: query.refresh === true }),
        this.loadPerformance(steamId64, query.limit),
      ]);

      return {
        steamId64,
        profile,
        performance: performance.data,
        notices: performance.notices,
        aiAnalysis: aiStatus(query),
        analyzedAt: this.now().toISOString(),
      };
    });
  }

  private async loadPerformance(
    steamId64: string,
    limit: number | undefined,
  ): Promise<{ data: PerformanceAnalysis | null; notices: AnalysisNotice[] }> {
    try {
      return { data: await this.matches.getPerformanceAnalysis(steamId64, { limit }), notices: [] };
    } catch (error) {
      // Sem partidas o relatório ainda é útil (perfil Steam). Limite inválido continua sendo erro.
      if (!(error instanceof AppError) || error.code === 'INVALID_INPUT') throw error;
      return {
        data: null,
        notices: [{ code: error.code, message: error.message, hints: error.hints }],
      };
    }
  }
}

function aiStatus(query: AnalyzeQuery): AiAnalysisResult {
  return query.ai === false
    ? { status: 'disabled', message: 'Análise com IA desativada nesta consulta.' }
    : { status: 'not-configured', message: 'Nenhum provedor de IA configurado.' };
}
