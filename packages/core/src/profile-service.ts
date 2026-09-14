import { AppError, type Logger } from '@fraglens/shared';
import type { SteamIdentifierResolver } from './identifier-resolver.js';
import type { PlayerStore, SteamGateway, SyncJobResult, SyncJobSummary } from './ports.js';
import type { PlayerProfile } from './profile.js';

/** Versão do formato do perfil guardado. Aumente ao mudar a estrutura para invalidar o cache antigo. */
export const PROFILE_DATA_VERSION = 1;
export const DEFAULT_PROFILE_CACHE_TTL_SECONDS = 86_400;

export interface ProfileServiceDeps {
  steam: SteamGateway;
  resolver: SteamIdentifierResolver;
  /** Sem store (banco não configurado), o cache fica desativado. */
  store?: PlayerStore | undefined;
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
}

export class ProfileService {
  private readonly steam: SteamGateway;
  private readonly resolver: SteamIdentifierResolver;
  private readonly store: PlayerStore | undefined;
  private readonly cacheTtlMs: number;
  private readonly logger: Logger | undefined;
  private readonly now: () => Date;
  // Após a primeira falha do banco, não tenta de novo nesta execução:
  // cada tentativa pode esperar o timeout de conexão.
  private storeAvailable = true;

  constructor(deps: ProfileServiceDeps) {
    this.steam = deps.steam;
    this.resolver = deps.resolver;
    this.store = deps.store;
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
    this.requireStore();
    const steamId64 = await this.resolver.resolve(input);
    return this.fetchAndStore(steamId64);
  }

  async getCacheStatus(input: string): Promise<ProfileCacheStatus> {
    const store = this.requireStore();
    const steamId64 = await this.resolver.resolve(input);

    let info;
    try {
      info = await store.getCacheInfo(steamId64);
    } catch (error) {
      throw databaseUnavailable(error);
    }

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
    };
  }

  private async readFreshCache(steamId64: string): Promise<PlayerProfile | null> {
    const stored = await this.useStore('profile.cache.read', (store) =>
      store.findLatestProfile(steamId64),
    );
    if (!stored || !this.isFresh(stored.profile.fetchedAt, stored.dataVersion)) return null;

    this.logger?.debug({ steamId64 }, 'profile.cache.hit');
    return { ...stored.profile, cached: true };
  }

  private async fetchAndStore(steamId64: string): Promise<RefreshResult> {
    const jobId = await this.useStore('sync_job.start', (store) =>
      store.startSyncJob(steamId64, 'steam-profile'),
    );

    let profile: PlayerProfile;
    try {
      profile = await this.fetchFromSteam(steamId64);
    } catch (error) {
      await this.finishJob(jobId, failureOf(error));
      throw error;
    }

    const saved = await this.useStore('profile.cache.write', async (store) => {
      await store.saveProfile(profile);
      return true;
    });
    await this.finishJob(jobId, { status: 'succeeded' });

    return { profile, saved: saved === true };
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

  private async finishJob(jobId: string | undefined, result: SyncJobResult): Promise<void> {
    if (jobId === undefined) return;
    await this.useStore('sync_job.finish', (store) => store.finishSyncJob(jobId, result));
  }

  private isFresh(fetchedAt: string, dataVersion: number): boolean {
    return (
      dataVersion === PROFILE_DATA_VERSION &&
      this.now().getTime() - Date.parse(fetchedAt) < this.cacheTtlMs
    );
  }

  /** O cache nunca derruba a consulta: com o banco fora do ar, o perfil vem direto da Steam. */
  private async useStore<T>(
    operation: string,
    fn: (store: PlayerStore) => Promise<T>,
  ): Promise<T | undefined> {
    if (!this.store || !this.storeAvailable) return undefined;
    try {
      return await fn(this.store);
    } catch (error) {
      this.storeAvailable = false;
      this.logger?.warn({ operation, err: error }, 'database.unavailable');
      return undefined;
    }
  }

  private requireStore(): PlayerStore {
    if (!this.store) {
      throw new AppError('CONFIG_MISSING', 'O banco de dados não está configurado.', {
        hints: [
          'Defina DATABASE_URL no arquivo .env.',
          'Ambiente local: pnpm db:up e depois pnpm db:migrate.',
        ],
      });
    }
    return this.store;
  }
}

function failureOf(error: unknown): SyncJobResult {
  return {
    status: 'failed',
    errorCode: error instanceof AppError ? error.code : 'INTERNAL',
    errorMessage: error instanceof Error ? error.message : String(error),
  };
}

function databaseUnavailable(cause: unknown): AppError {
  return new AppError('DATABASE_UNAVAILABLE', 'Não foi possível acessar o banco de dados.', {
    hints: [
      'Verifique se o PostgreSQL está rodando (pnpm db:up) e se DATABASE_URL está correto.',
      'Rode fraglens doctor para um diagnóstico.',
    ],
    cause,
  });
}
