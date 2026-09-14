import type { MatchHistory, PerformanceData, PlayerMatch } from '@fraglens/core';
import { describe, expect, it } from 'vitest';
import { fakePerformance, performanceData, playerMatch, runCli, STEAM_ID } from './helpers.js';

function withMatches(matches: PlayerMatch[], overrides: Partial<PerformanceData> = {}) {
  return {
    createPerformanceSource: () => fakePerformance({ ...performanceData(matches), ...overrides }),
  };
}

const MATCHES = [
  playerMatch('m1', '2026-09-10T20:00:00.000Z'),
  playerMatch('m2', '2026-09-09T20:00:00.000Z', {
    map: 'de_inferno',
    origin: 'faceit',
    outcome: 'loss',
    score: { team: 9, opponent: 13 },
  }),
  playerMatch('m3', '2026-09-08T20:00:00.000Z', {
    map: 'cs_office',
    origin: 'matchmaking_competitive',
    outcome: 'tie',
    score: { team: 12, opponent: 12 },
  }),
];

describe('fraglens matches', () => {
  it('exibe ranks, forma recente e a tabela de partidas com métricas calculadas', async () => {
    const { exitCode, stdout, stderr } = await runCli(['matches', STEAM_ID], withMatches(MATCHES));

    expect(exitCode).toBe(0);
    expect(stderr).toBe('');
    expect(stdout).toMatch(/Premier\s+15\.234/);
    expect(stdout).toMatch(/FACEIT\s+Nível 8 · 1\.850 Elo/);
    expect(stdout).toContain('V D E');
    expect(stdout).toContain('Últimas 3: 1 V · 1 D · 1 E');
    expect(stdout).toContain('PARTIDAS (3 de 3)');
    expect(stdout).toMatch(
      /10\/09\/2026\s+Mirage\s+Matchmaking\s+13-7\s+V\s+16-13-4\s+1,23\s+72,7\s+81,3%/,
    );
    expect(stdout).toMatch(/Inferno\s+FACEIT\s+9-13\s+D/);
    expect(stdout).toMatch(/Office\s+Competitivo\s+12-12\s+E/);
    expect(stdout).toContain('Dados fornecidos pela Leetify');
  });

  it('respeita --limit', async () => {
    const { stdout } = await runCli(['matches', STEAM_ID, '--limit', '2'], withMatches(MATCHES));

    expect(stdout).toContain('PARTIDAS (2 de 3)');
    expect(stdout).not.toContain('Office');
  });

  it.each(['0', '101', 'abc', '2.5'])('rejeita --limit %s como erro de uso', async (limit) => {
    const { exitCode, stderr } = await runCli(['matches', STEAM_ID, '--limit', limit]);

    expect(exitCode).toBe(2);
    expect(stderr).toContain(`erro: valor inválido '${limit}' para a opção '--limit <n>'.`);
  });

  it('indica Premier indisponível', async () => {
    const { stdout } = await runCli(
      ['matches', STEAM_ID],
      withMatches(MATCHES, {
        ranks: { premier: null, faceitLevel: null, faceitElo: null, wingman: null },
      }),
    );

    expect(stdout).toMatch(/Premier\s+Indisponível/);
    expect(stdout).toMatch(/FACEIT\s+Indisponível/);
  });

  it('informa quando não há partidas', async () => {
    const { exitCode, stdout } = await runCli(['matches', STEAM_ID], withMatches([]));

    expect(exitCode).toBe(0);
    expect(stdout).toContain('Nenhuma partida disponível na Leetify.');
  });

  it('com --json retorna o histórico estruturado', async () => {
    const { exitCode, stdout, stderr } = await runCli(
      ['matches', STEAM_ID, '--json', '--limit', '1'],
      withMatches(MATCHES),
    );

    const history = JSON.parse(stdout) as MatchHistory;
    expect(exitCode).toBe(0);
    expect(stderr).toBe('');
    expect(history.matches).toHaveLength(1);
    expect(history.availableMatches).toBe(3);
    expect(history.matches[0]?.metrics.killDeathRatio).toBe(1.23);
    expect(history.matches[0]?.leetify.rating).toBe(0.0341);
    expect(history.attribution).toContain('Leetify');
  });

  it('explica quando a Leetify não tem dados do jogador', async () => {
    const { exitCode, stderr } = await runCli(['matches', STEAM_ID], {
      createPerformanceSource: () => fakePerformance(null),
    });

    expect(exitCode).toBe(1);
    expect(stderr).toContain('✗ A Leetify não tem dados de partidas deste jogador.');
    expect(stderr).toContain('leetify.com');
  });
});
