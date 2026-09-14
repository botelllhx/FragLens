import { AppError, type Logger } from '@fraglens/shared';
import type { SteamIdentifierResolver } from './identifier-resolver.js';
import type { SteamGateway, SyncJobSummary } from './ports.js';
import type { PlayerProfile } from './profile.js';
import { StoreGuard } from './store-guard.js';

/** Versão do formato do perfil guardado. Aumente ao mudar a estrutura para invalidar o cache antigo. */
export const PROFILE_DATA_VERSION = 1;
export const DEFAULT_PROFILE_CACHE_TTL_SECONDS = 86_400;

export interface ProfileServiceDeps {
  steam: SteamGateway;
  resolver: SteamIdentifierResolver;
  /** Acesso ao banco, compartilhado entre os serviços. Sem banco, o cache fica desativado. */
  store?: StoreGuard;
  cacheTtlSeconds?: number;
  logger?: Logger;
  now?: () => Date;
}

export interface ProfileQuery {
  /** Ignora o cache e busca novamente na Steam. */
  refresh?: boolean;
}

export interface RefreshResult {
  profile: PlayerProfile;
  /** `false` quando a gravação no banco falhou. */
  saved: boolean;
}

export interface ProfileCacheStatus {
  steamId64: string;
  stored: boolean;
  snapshotCount: number;
  firstSeenAt: string | null;
  lastFetchedAt: string | null;
  dataVersion: number | null;
  currentDataVersion: number;
  ttlSeconds: number;
  expiresAt: string | null;
  fresh: boolean;
  lastSyncJob: SyncJobSummary | null;
  lastAnalyzedAt: string | null;
}

export class ProfileService {
  private readonly steam: SteamGateway;
  private readonly resolver: SteamIdentifierResolver;
  private readonly store: StoreGuard;
  private readonly cacheTtlMs: number;
  private readonly logger: Logger | undefined;
  private readonly now: () => Date;

  constructor(deps: ProfileServiceDeps) {
    this.steam = deps.steam;
    this.resolver = deps.resolver;
    this.store = deps.store ?? new StoreGuard(undefined);
    this.cacheTtlMs = (deps.cacheTtlSeconds ?? DEFAULT_PROFILE_CACHE_TTL_SECONDS) * 1000;
    this.logger = deps.logger;
    this.now = deps.now ?? (() => new Date());
  }

  /** Perfil do cache quando ainda válido; caso contrário, busca na Steam e guarda. */
  async getProfile(input: string, query: ProfileQuery = {}): Promise<PlayerProfile> {
    const steamId64 = await this.resolver.resolve(input);

    if (!query.refresh) {
      const cached = await this.readFreshCache(steamId64);
      if (cached) return cached;
    }

    const { profile } = await this.fetchAndStore(steamId64);
    return profile;
  }

  /** Busca na Steam e guarda, ignorando o cache. Exige banco configurado. */
  async refresh(input: string): Promise<RefreshResult> {
    this.store.requireConfigured();
    const steamId64 = await this.resolver.resolve(input);
    return this.fetchAndStore(steamId64);
  }

  async getCacheStatus(input: string): Promise<ProfileCacheStatus> {
    this.store.requireConfigured();
    const steamId64 = await this.resolver.resolve(input);
    const info = await this.store.require((store) => store.getCacheInfo(steamId64));

    const lastFetchedAt = info?.latestFetchedAt ?? null;
    const dataVersion = info?.latestDataVersion ?? null;

    return {
      steamId64,
      stored: lastFetchedAt !== null,
      snapshotCount: info?.snapshotCount ?? 0,
      firstSeenAt: info?.firstSeenAt ?? null,
      lastFetchedAt,
      dataVersion,
      currentDataVersion: PROFILE_DATA_VERSION,
      ttlSeconds: this.cacheTtlMs / 1000,
      expiresAt:
        lastFetchedAt === null
          ? null
          : new Date(Date.parse(lastFetchedAt) + this.cacheTtlMs).toISOString(),
      fresh:
        lastFetchedAt !== null && dataVersion !== null && this.isFresh(lastFetchedAt, dataVersion),
      lastSyncJob: info?.lastSyncJob ?? null,
      lastAnalyzedAt: info?.lastAnalyzedAt ?? null,
    };
  }

  private async readFreshCache(steamId64: string): Promise<PlayerProfile | null> {
    const stored = await this.store.attempt('profile.cache.read', (store) =>
      store.findLatestProfile(steamId64),
    );
    if (!stored || !this.isFresh(stored.profile.fetchedAt, stored.dataVersion)) return null;

    this.logger?.debug({ steamId64 }, 'profile.cache.hit');
    return { ...stored.profile, cached: true };
  }

  private fetchAndStore(steamId64: string): Promise<RefreshResult> {
    return this.store.trackJob(steamId64, 'steam-profile', async () => {
      const profile = await this.fetchFromSteam(steamId64);
      const saved = await this.store.attempt('profile.cache.write', async (store) => {
        await store.saveProfile(profile);
        return true;
      });
      return { profile, saved: saved === true };
    });
  }

  private async fetchFromSteam(steamId64: string): Promise<PlayerProfile> {
    const [summary, bans, cs2] = await Promise.all([
      this.steam.getPlayerSummary(steamId64),
      this.steam.getBanStatus(steamId64),
      this.steam.getCs2Playtime(steamId64),
    ]);

    if (!summary) {
      throw new AppError('NOT_FOUND', 'Perfil Steam não encontrado.', {
        hints: [`Nenhuma conta Steam corresponde à SteamID64 ${steamId64}.`],
      });
    }

    return {
      steamId64,
      summary,
      bans,
      cs2,
      dataVersion: PROFILE_DATA_VERSION,
      cached: false,
      fetchedAt: this.now().toISOString(),
    };
  }

  private isFresh(fetchedAt: string, dataVersion: number): boolean {
    return (
      dataVersion === PROFILE_DATA_VERSION &&
      this.now().getTime() - Date.parse(fetchedAt) < this.cacheTtlMs
    );
  }
}
