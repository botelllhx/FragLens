import type { PerformanceData } from './match.js';
import type { Cs2Playtime, SteamBanStatus, SteamPlayerSummary } from './profile.js';

/** Acesso aos dados da Steam. Implementado em `@fraglens/steam`. */
export interface SteamGateway {
  /** Retorna a SteamID64 da URL personalizada, ou `null` se não existir. */
  resolveVanity(vanity: string): Promise<string | null>;
  getPlayerSummary(steamId64: string): Promise<SteamPlayerSummary | null>;
  getBanStatus(steamId64: string): Promise<SteamBanStatus | null>;
  getCs2Playtime(steamId64: string): Promise<Cs2Playtime>;
}

/** Fonte de dados de desempenho no CS2. Implementada em `@fraglens/sources` (Leetify). */
export interface PerformanceSource {
  /** Retorna `null` quando a fonte não tem dados do jogador. */
  getPlayerPerformance(steamId64: string): Promise<PerformanceData | null>;
}
