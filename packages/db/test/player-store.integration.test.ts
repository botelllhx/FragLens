import type { PlayerProfile } from '@fraglens/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connectDatabase, type Database } from '../src/database.js';

// Teste de integração com PostgreSQL real. Só roda com TEST_DATABASE_URL definido
// (banco dedicado a testes, com migrations aplicadas). Ver docs/database.md.
const databaseUrl = process.env.TEST_DATABASE_URL;

function uniqueSteamId(): string {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-9).padStart(9, '0');
  return `76561198${suffix}`;
}

function profile(steamId64: string, overrides: Partial<PlayerProfile> = {}): PlayerProfile {
  return {
    steamId64,
    summary: {
      steamId64,
      personaName: 'Jogador',
      profileUrl: `https://steamcommunity.com/profiles/${steamId64}/`,
      avatarUrl: 'https://avatars.steamstatic.com/avatar_full.jpg',
      visibility: 'public',
      countryCode: 'BR',
      accountCreatedAt: '2021-10-13T22:58:54.000Z',
    },
    bans: {
      vacBanned: false,
      vacBanCount: 0,
      gameBanCount: 0,
      communityBanned: false,
      economyBan: 'none',
      daysSinceLastBan: null,
    },
    cs2: { visible: true, totalHours: 509.2, lastTwoWeeksHours: 10.9 },
    dataVersion: 1,
    cached: false,
    fetchedAt: '2026-09-14T17:00:00.000Z',
    ...overrides,
  };
}

describe.skipIf(!databaseUrl)('PrismaPlayerStore (PostgreSQL)', () => {
  let db: Database;

  beforeAll(() => {
    db = connectDatabase(databaseUrl ?? '');
  });

  afterAll(async () => {
    await db.close();
  });

  it('o banco de testes está com todas as migrations aplicadas', async () => {
    const health = await db.checkHealth();

    expect(health.pendingMigrations).toEqual([]);
    expect(health.appliedMigrations).toBeGreaterThan(0);
  });

  it('jogador nunca consultado não tem perfil nem informações de cache', async () => {
    const steamId = uniqueSteamId();

    await expect(db.players.findLatestProfile(steamId)).resolves.toBeNull();
    await expect(db.players.getCacheInfo(steamId)).resolves.toBeNull();
  });

  it('grava e lê o perfil sem perder informação', async () => {
    const steamId = uniqueSteamId();
    const saved = profile(steamId);

    await db.players.saveProfile(saved);

    await expect(db.players.findLatestProfile(steamId)).resolves.toEqual({
      profile: saved,
      dataVersion: 1,
    });
  });

  it('preserva perfil não público, horas privadas e banimentos indisponíveis', async () => {
    const steamId = uniqueSteamId();
    const saved = profile(steamId, {
      summary: {
        steamId64: steamId,
        personaName: 'Reservado',
        profileUrl: `https://steamcommunity.com/profiles/${steamId}/`,
        avatarUrl: 'https://avatars.steamstatic.com/x_full.jpg',
        visibility: 'friends-only',
        countryCode: null,
        accountCreatedAt: null,
      },
      bans: null,
      cs2: { visible: false, totalHours: null, lastTwoWeeksHours: null },
    });

    await db.players.saveProfile(saved);

    const stored = await db.players.findLatestProfile(steamId);
    expect(stored?.profile).toEqual(saved);
  });

  it('mantém histórico e usa o snapshot mais recente como cache', async () => {
    const steamId = uniqueSteamId();
    await db.players.saveProfile(profile(steamId, { fetchedAt: '2026-09-10T10:00:00.000Z' }));
    await db.players.saveProfile(
      profile(steamId, {
        fetchedAt: '2026-09-14T10:00:00.000Z',
        cs2: { visible: true, totalHours: 520, lastTwoWeeksHours: 12 },
      }),
    );

    const stored = await db.players.findLatestProfile(steamId);
    const info = await db.players.getCacheInfo(steamId);

    expect(stored?.profile.cs2.totalHours).toBe(520);
    expect(info).toMatchObject({
      steamId64: steamId,
      snapshotCount: 2,
      latestFetchedAt: '2026-09-14T10:00:00.000Z',
      latestDataVersion: 1,
    });
  });

  it('registra jobs de sincronização com sucesso e falha', async () => {
    const steamId = uniqueSteamId();

    const succeeded = await db.players.startSyncJob(steamId, 'steam-profile');
    await db.players.finishSyncJob(succeeded, { status: 'succeeded' });
    const running = await db.players.getCacheInfo(steamId);
    expect(running?.lastSyncJob).toMatchObject({ type: 'steam-profile', status: 'succeeded' });

    const failed = await db.players.startSyncJob(steamId, 'steam-profile');
    await db.players.finishSyncJob(failed, {
      status: 'failed',
      errorCode: 'UPSTREAM_UNAVAILABLE',
      errorMessage: 'Steam: serviço indisponível no momento.',
    });

    const info = await db.players.getCacheInfo(steamId);
    expect(info?.snapshotCount).toBe(0);
    expect(info?.lastSyncJob).toMatchObject({
      status: 'failed',
      errorCode: 'UPSTREAM_UNAVAILABLE',
    });
    expect(info?.lastSyncJob?.finishedAt).not.toBeNull();
  });

  it('informa a última análise concluída sem misturar com os jobs do perfil', async () => {
    const steamId = uniqueSteamId();

    const analysis = await db.players.startSyncJob(steamId, 'analysis');
    await db.players.finishSyncJob(analysis, { status: 'succeeded' });
    const failedAnalysis = await db.players.startSyncJob(steamId, 'analysis');
    await db.players.finishSyncJob(failedAnalysis, {
      status: 'failed',
      errorCode: 'INTERNAL',
      errorMessage: 'falha',
    });

    const info = await db.players.getCacheInfo(steamId);
    expect(info?.lastAnalyzedAt).not.toBeNull();
    expect(info?.lastSyncJob).toBeNull();
  });
});
