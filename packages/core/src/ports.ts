import type { PerformanceData } from './match.js';
import type { Cs2Playtime, PlayerProfile, SteamBanStatus, SteamPlayerSummary } from './profile.js';

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

export type SyncJobType = 'steam-profile' | 'analysis';
export type SyncJobStatus = 'running' | 'succeeded' | 'failed';
export type SyncJobResult =
  { status: 'succeeded' } | { status: 'failed'; errorCode: string; errorMessage: string };

export interface SyncJobSummary {
  type: SyncJobType;
  status: SyncJobStatus;
  startedAt: string;
  finishedAt: string | null;
  errorCode: string | null;
}

export interface StoredProfile {
  profile: PlayerProfile;
  dataVersion: number;
}

export interface ProfileCacheInfo {
  steamId64: string;
  firstSeenAt: string;
  snapshotCount: number;
  latestFetchedAt: string | null;
  latestDataVersion: number | null;
  /** Última sincronização do perfil Steam. */
  lastSyncJob: SyncJobSummary | null;
  /** Fim da última análise concluída (ISO 8601). */
  lastAnalyzedAt: string | null;
}

/**
 * Persistência de dados próprios: perfis Steam e jobs de sincronização.
 * Implementada em `@fraglens/db`. Dados da Leetify nunca passam por aqui.
 */
export interface PlayerStore {
  findLatestProfile(steamId64: string): Promise<StoredProfile | null>;
  saveProfile(profile: PlayerProfile): Promise<void>;
  /** `null` quando o jogador nunca foi consultado. */
  getCacheInfo(steamId64: string): Promise<ProfileCacheInfo | null>;
  /** Cria o jogador, se necessário, e retorna o id do job. */
  startSyncJob(steamId64: string, type: SyncJobType): Promise<string>;
  finishSyncJob(jobId: string, result: SyncJobResult): Promise<void>;
}
