import type {
  PlayerProfile,
  ProfileCacheStatus,
  RefreshResult,
  SteamGateway,
} from '@fraglens/core';
import { describe, expect, it } from 'vitest';
import { fakeDatabase, fakeGateway, memoryPlayerStore, runCli, STEAM_ID } from './helpers.js';

const DB_ENV = { STEAM_API_KEY: 'chave', DATABASE_URL: 'postgresql://localhost/fraglens' };

/** Gateway que conta quantas vezes o perfil foi buscado na Steam. */
function countingGateway() {
  let summaryCalls = 0;
  const base = fakeGateway();
  const gateway: SteamGateway = {
    ...base,
    getPlayerSummary: (id) => {
      summaryCalls++;
      return base.getPlayerSummary(id);
    },
  };
  return { gateway, summaryCalls: () => summaryCalls };
}

function setup() {
  const memory = memoryPlayerStore();
  const steam = countingGateway();
  const deps = {
    env: DB_ENV,
    createSteamGateway: () => steam.gateway,
    connectDatabase: () => fakeDatabase({ players: memory.store }),
  };
  return { memory, steam, deps };
}

describe('cache do perfil na CLI', () => {
  it('a segunda consulta usa o cache e a terceira, com --refresh, busca de novo', async () => {
    const { memory, steam, deps } = setup();

    const first = await runCli(['profile', STEAM_ID], deps);
    const second = await runCli(['profile', STEAM_ID], deps);
    const third = await runCli(['profile', STEAM_ID, '--refresh', '--json'], deps);

    expect(first.stdout).not.toContain('(cache)');
    expect(second.stdout).toContain('(cache)');
    expect(second.stdout).toContain('use --refresh para buscar novamente');
    expect((JSON.parse(third.stdout) as PlayerProfile).cached).toBe(false);
    expect(steam.summaryCalls()).toBe(2);
    expect(memory.profiles).toHaveLength(2);
  });

  it('sem DATABASE_URL, sempre busca na Steam', async () => {
    const steam = countingGateway();
    const deps = { env: { STEAM_API_KEY: 'chave' }, createSteamGateway: () => steam.gateway };

    await runCli(['profile', STEAM_ID], deps);
    const second = await runCli(['profile', STEAM_ID], deps);

    expect(second.stdout).not.toContain('(cache)');
    expect(steam.summaryCalls()).toBe(2);
  });
});

describe('fraglens refresh', () => {
  it('atualiza e salva o perfil', async () => {
    const { memory, deps } = setup();

    const { exitCode, stdout } = await runCli(['refresh', STEAM_ID], deps);

    expect(exitCode).toBe(0);
    expect(stdout).toContain('✓ Perfil Steam de Jogador Teste atualizado em');
    expect(memory.profiles).toHaveLength(1);
    expect(memory.jobs[0]?.result).toEqual({ status: 'succeeded' });
  });

  it('com --json informa se foi salvo', async () => {
    const { deps } = setup();

    const { stdout } = await runCli(['refresh', STEAM_ID, '--json'], deps);

    const result = JSON.parse(stdout) as RefreshResult;
    expect(result.saved).toBe(true);
    expect(result.profile.steamId64).toBe(STEAM_ID);
  });

  it('avisa e retorna erro quando não consegue salvar', async () => {
    const failing = memoryPlayerStore();
    failing.store.saveProfile = () => Promise.reject(new Error('connect ECONNREFUSED'));
    failing.store.startSyncJob = () => Promise.reject(new Error('connect ECONNREFUSED'));

    const { exitCode, stderr } = await runCli(['refresh', STEAM_ID], {
      env: DB_ENV,
      connectDatabase: () => fakeDatabase({ players: failing.store }),
    });

    expect(exitCode).toBe(1);
    expect(stderr).toContain('não foi possível salvar no banco');
  });

  it('exige banco de dados configurado', async () => {
    const { exitCode, stderr } = await runCli(['refresh', STEAM_ID], {
      env: { STEAM_API_KEY: 'chave' },
    });

    expect(exitCode).toBe(1);
    expect(stderr).toContain('O banco de dados não está configurado.');
    expect(stderr).toContain('DATABASE_URL');
  });
});

describe('fraglens cache', () => {
  it('mostra que nada foi guardado para jogador nunca consultado', async () => {
    const { deps } = setup();

    const { exitCode, stdout } = await runCli(['cache', STEAM_ID], deps);

    expect(exitCode).toBe(0);
    expect(stdout).toContain('Nenhum perfil guardado para este jogador.');
  });

  it('mostra situação, validade e última sincronização depois de uma consulta', async () => {
    const { deps } = setup();
    await runCli(['profile', STEAM_ID], deps);

    const { stdout } = await runCli(['cache', STEAM_ID], deps);

    expect(stdout).toMatch(/Situação\s+✓ Atualizado/);
    expect(stdout).toMatch(/Validade do cache\s+24 h/);
    expect(stdout).toMatch(/Snapshots guardados\s+1/);
    expect(stdout).toContain('✓ Perfil Steam: concluída');
    expect(stdout).toContain('Dados da Leetify não são guardados');
  });

  it('com --json retorna o estado estruturado', async () => {
    const { deps } = setup();
    await runCli(['profile', STEAM_ID], deps);

    const { stdout, stderr } = await runCli(['cache', STEAM_ID, '--json'], deps);

    const status = JSON.parse(stdout) as ProfileCacheStatus;
    expect(stderr).toBe('');
    expect(status).toMatchObject({
      steamId64: STEAM_ID,
      stored: true,
      fresh: true,
      snapshotCount: 1,
      ttlSeconds: 86_400,
    });
  });

  it('explica quando o banco está fora do ar', async () => {
    const broken = memoryPlayerStore();
    broken.store.getCacheInfo = () => Promise.reject(new Error('connect ECONNREFUSED'));

    const { exitCode, stderr } = await runCli(['cache', STEAM_ID], {
      env: DB_ENV,
      connectDatabase: () => fakeDatabase({ players: broken.store }),
    });

    expect(exitCode).toBe(1);
    expect(stderr).toContain('Não foi possível acessar o banco de dados.');
    expect(stderr).toContain('pnpm db:up');
  });
});
