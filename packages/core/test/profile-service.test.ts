import { AppError } from '@fraglens/shared';
import { describe, expect, it } from 'vitest';
import { SteamIdentifierResolver } from '../src/identifier-resolver.js';
import type { PlayerStore, SteamGateway, SyncJobResult } from '../src/ports.js';
import type { PlayerProfile, SteamPlayerSummary } from '../src/profile.js';
import { PROFILE_DATA_VERSION, ProfileService } from '../src/profile-service.js';

const STEAM_ID = '76561198034202275';
const NOW = new Date('2026-09-14T12:00:00.000Z');
const HOUR_MS = 3_600_000;

const SUMMARY: SteamPlayerSummary = {
  steamId64: STEAM_ID,
  personaName: 'Jogador',
  profileUrl: 'https://steamcommunity.com/id/jogador/',
  avatarUrl: 'https://avatars.steamstatic.com/avatar_full.jpg',
  visibility: 'public',
  countryCode: 'BR',
  accountCreatedAt: '2010-11-27T02:40:08.000Z',
};

function fakeSteam(overrides: Partial<SteamGateway> = {}) {
  const calls: string[] = [];
  const gateway: SteamGateway = {
    resolveVanity: (vanity) => {
      calls.push(`resolveVanity:${vanity}`);
      return Promise.resolve(vanity === 'jogador' ? STEAM_ID : null);
    },
    getPlayerSummary: (id) => {
      calls.push(`getPlayerSummary:${id}`);
      return Promise.resolve(id === STEAM_ID ? SUMMARY : null);
    },
    getBanStatus: (id) => {
      calls.push(`getBanStatus:${id}`);
      return Promise.resolve(null);
    },
    getCs2Playtime: (id) => {
      calls.push(`getCs2Playtime:${id}`);
      return Promise.resolve({ visible: false, totalHours: null, lastTwoWeeksHours: null });
    },
    ...overrides,
  };
  return { gateway, calls };
}

function storedProfile(fetchedAt: string, overrides: Partial<PlayerProfile> = {}): PlayerProfile {
  return {
    steamId64: STEAM_ID,
    summary: { ...SUMMARY, personaName: 'Nome no cache' },
    bans: null,
    cs2: { visible: true, totalHours: 100, lastTwoWeeksHours: 5 },
    dataVersion: PROFILE_DATA_VERSION,
    cached: false,
    fetchedAt,
    ...overrides,
  };
}

function memoryStore(initial: PlayerProfile[] = [], options: { failing?: boolean } = {}) {
  const profiles = [...initial];
  const jobs: { id: string; result: SyncJobResult | null }[] = [];
  let operations = 0;

  const guard = <T>(value: T): Promise<T> => {
    operations++;
    return options.failing
      ? Promise.reject(new Error('connect ECONNREFUSED'))
      : Promise.resolve(value);
  };

  const store: PlayerStore = {
    findLatestProfile: () => {
      const latest = profiles.at(-1);
      return guard(latest ? { profile: latest, dataVersion: latest.dataVersion } : null);
    },
    saveProfile: (profile) => {
      if (!options.failing) profiles.push(profile);
      return guard(undefined);
    },
    getCacheInfo: (steamId64) =>
      guard(
        profiles.length === 0
          ? null
          : {
              steamId64,
              firstSeenAt: profiles[0]?.fetchedAt ?? '',
              snapshotCount: profiles.length,
              latestFetchedAt: profiles.at(-1)?.fetchedAt ?? null,
              latestDataVersion: profiles.at(-1)?.dataVersion ?? null,
              lastSyncJob: null,
            },
      ),
    startSyncJob: () => {
      const id = `job-${jobs.length + 1}`;
      if (!options.failing) jobs.push({ id, result: null });
      return guard(id);
    },
    finishSyncJob: (id, result) => {
      const job = jobs.find((candidate) => candidate.id === id);
      if (job) job.result = result;
      return guard(undefined);
    },
  };

  return { store, profiles, jobs, operations: () => operations };
}

function createService(gateway: SteamGateway, store?: PlayerStore) {
  return new ProfileService({
    steam: gateway,
    resolver: new SteamIdentifierResolver(gateway),
    store,
    cacheTtlSeconds: 24 * 3600,
    now: () => NOW,
  });
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

const steamCalls = (calls: string[]) => calls.filter((call) => !call.startsWith('resolveVanity'));

describe('SteamIdentifierResolver', () => {
  it('não consulta a Steam quando a entrada já é uma SteamID64', async () => {
    const { gateway, calls } = fakeSteam();

    await expect(new SteamIdentifierResolver(gateway).resolve(STEAM_ID)).resolves.toBe(STEAM_ID);
    expect(calls).toEqual([]);
  });

  it('resolve URL personalizada pela Steam', async () => {
    const { gateway, calls } = fakeSteam();

    const steamId = await new SteamIdentifierResolver(gateway).resolve(
      'https://steamcommunity.com/id/jogador',
    );

    expect(steamId).toBe(STEAM_ID);
    expect(calls).toEqual(['resolveVanity:jogador']);
  });

  it('informa NOT_FOUND quando a URL personalizada não existe', async () => {
    const { gateway } = fakeSteam();

    const error = await captureError(new SteamIdentifierResolver(gateway).resolve('inexistente'));

    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toContain('"inexistente"');
  });
});

describe('ProfileService', () => {
  it('sem banco, monta o perfil direto da Steam', async () => {
    const { gateway, calls } = fakeSteam();

    const profile = await createService(gateway).getProfile('jogador');

    expect(profile).toEqual({
      steamId64: STEAM_ID,
      summary: SUMMARY,
      bans: null,
      cs2: { visible: false, totalHours: null, lastTwoWeeksHours: null },
      dataVersion: PROFILE_DATA_VERSION,
      cached: false,
      fetchedAt: NOW.toISOString(),
    });
    expect(calls).toEqual([
      'resolveVanity:jogador',
      `getPlayerSummary:${STEAM_ID}`,
      `getBanStatus:${STEAM_ID}`,
      `getCs2Playtime:${STEAM_ID}`,
    ]);
  });

  it('informa NOT_FOUND quando a SteamID64 não corresponde a uma conta', async () => {
    const { gateway } = fakeSteam({ getPlayerSummary: () => Promise.resolve(null) });

    const error = await captureError(createService(gateway).getProfile(STEAM_ID));

    expect(error.code).toBe('NOT_FOUND');
  });

  it('rejeita entrada inválida sem consultar a Steam', async () => {
    const { gateway, calls } = fakeSteam();

    const error = await captureError(createService(gateway).getProfile('https://example.com/id/x'));

    expect(error.code).toBe('INVALID_INPUT');
    expect(calls).toEqual([]);
  });

  describe('cache', () => {
    it('usa o perfil guardado enquanto está dentro da validade, sem chamar a Steam', async () => {
      const fetchedAt = new Date(NOW.getTime() - 2 * HOUR_MS).toISOString();
      const { gateway, calls } = fakeSteam();
      const { store } = memoryStore([storedProfile(fetchedAt)]);

      const profile = await createService(gateway, store).getProfile(STEAM_ID);

      expect(profile.cached).toBe(true);
      expect(profile.summary.personaName).toBe('Nome no cache');
      expect(profile.fetchedAt).toBe(fetchedAt);
      expect(steamCalls(calls)).toEqual([]);
    });

    it('busca novamente e guarda quando o cache expirou', async () => {
      const expired = new Date(NOW.getTime() - 25 * HOUR_MS).toISOString();
      const { gateway, calls } = fakeSteam();
      const { store, profiles, jobs } = memoryStore([storedProfile(expired)]);

      const profile = await createService(gateway, store).getProfile(STEAM_ID);

      expect(profile.cached).toBe(false);
      expect(profile.summary.personaName).toBe('Jogador');
      expect(steamCalls(calls)).toHaveLength(3);
      expect(profiles).toHaveLength(2);
      expect(jobs).toEqual([{ id: 'job-1', result: { status: 'succeeded' } }]);
    });

    it('ignora o cache com refresh', async () => {
      const recent = new Date(NOW.getTime() - HOUR_MS).toISOString();
      const { gateway, calls } = fakeSteam();
      const { store } = memoryStore([storedProfile(recent)]);

      const profile = await createService(gateway, store).getProfile(STEAM_ID, { refresh: true });

      expect(profile.cached).toBe(false);
      expect(steamCalls(calls)).toHaveLength(3);
    });

    it('não usa perfil guardado em formato antigo', async () => {
      const recent = new Date(NOW.getTime() - HOUR_MS).toISOString();
      const { gateway } = fakeSteam();
      const { store } = memoryStore([
        storedProfile(recent, { dataVersion: PROFILE_DATA_VERSION - 1 }),
      ]);

      const profile = await createService(gateway, store).getProfile(STEAM_ID);

      expect(profile.cached).toBe(false);
    });

    it('registra o job como falho quando a Steam falha, e repassa o erro', async () => {
      const failure = new AppError(
        'UPSTREAM_UNAVAILABLE',
        'Steam: serviço indisponível no momento.',
      );
      const { gateway } = fakeSteam({ getPlayerSummary: () => Promise.reject(failure) });
      const { store, profiles, jobs } = memoryStore();

      const error = await captureError(createService(gateway, store).getProfile(STEAM_ID));

      expect(error).toBe(failure);
      expect(profiles).toHaveLength(0);
      expect(jobs[0]?.result).toEqual({
        status: 'failed',
        errorCode: 'UPSTREAM_UNAVAILABLE',
        errorMessage: 'Steam: serviço indisponível no momento.',
      });
    });

    it('com o banco fora do ar, retorna o perfil da Steam e não insiste no banco', async () => {
      const { gateway } = fakeSteam();
      const { store, operations } = memoryStore([], { failing: true });

      const profile = await createService(gateway, store).getProfile(STEAM_ID);

      expect(profile.summary.personaName).toBe('Jogador');
      expect(operations()).toBe(1);
    });
  });

  describe('refresh', () => {
    it('busca na Steam e informa que o perfil foi salvo', async () => {
      const { gateway } = fakeSteam();
      const { store, profiles } = memoryStore();

      const result = await createService(gateway, store).refresh(STEAM_ID);

      expect(result.saved).toBe(true);
      expect(profiles).toHaveLength(1);
    });

    it('informa quando não foi possível salvar', async () => {
      const { gateway } = fakeSteam();
      const { store } = memoryStore([], { failing: true });

      const result = await createService(gateway, store).refresh(STEAM_ID);

      expect(result.saved).toBe(false);
      expect(result.profile.summary.personaName).toBe('Jogador');
    });

    it('exige banco configurado', async () => {
      const { gateway, calls } = fakeSteam();

      const error = await captureError(createService(gateway).refresh(STEAM_ID));

      expect(error.code).toBe('CONFIG_MISSING');
      expect(calls).toEqual([]);
    });
  });

  describe('getCacheStatus', () => {
    it('calcula validade e expiração do perfil guardado', async () => {
      const fetchedAt = new Date(NOW.getTime() - 3 * HOUR_MS).toISOString();
      const { gateway } = fakeSteam();
      const { store } = memoryStore([storedProfile(fetchedAt)]);

      const status = await createService(gateway, store).getCacheStatus(STEAM_ID);

      expect(status).toMatchObject({
        steamId64: STEAM_ID,
        stored: true,
        snapshotCount: 1,
        lastFetchedAt: fetchedAt,
        dataVersion: PROFILE_DATA_VERSION,
        ttlSeconds: 86_400,
        expiresAt: new Date(NOW.getTime() + 21 * HOUR_MS).toISOString(),
        fresh: true,
      });
    });

    it('indica quando não há nada guardado', async () => {
      const { gateway } = fakeSteam();
      const { store } = memoryStore();

      const status = await createService(gateway, store).getCacheStatus(STEAM_ID);

      expect(status).toMatchObject({
        stored: false,
        fresh: false,
        expiresAt: null,
        snapshotCount: 0,
      });
    });

    it('converte falha do banco em DATABASE_UNAVAILABLE', async () => {
      const { gateway } = fakeSteam();
      const { store } = memoryStore([], { failing: true });

      const error = await captureError(createService(gateway, store).getCacheStatus(STEAM_ID));

      expect(error.code).toBe('DATABASE_UNAVAILABLE');
    });
  });
});
