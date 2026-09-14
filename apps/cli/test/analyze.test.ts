import type { PlayerAnalysis, PlayerMatch } from '@fraglens/core';
import { describe, expect, it } from 'vitest';
import {
  fakeDatabase,
  fakePerformance,
  memoryPlayerStore,
  performanceData,
  playerMatch,
  runCli,
  STEAM_ID,
} from './helpers.js';

function day(index: number): string {
  return new Date(Date.UTC(2026, 8, 30) - index * 86_400_000).toISOString();
}

/**
 * 12 partidas (índice 0 = mais recente):
 * - 0 a 5: Mirage, vitórias nos índices 0 a 3 e derrotas em 4 e 5;
 * - 6 a 10: Inferno, vitória no índice 6 e derrotas no resto;
 * - 11: Ancient, derrota.
 */
const MATCHES: PlayerMatch[] = [
  ...Array.from({ length: 6 }, (_, index) =>
    playerMatch(`mirage-${index}`, day(index), { outcome: index < 4 ? 'win' : 'loss' }),
  ),
  ...Array.from({ length: 5 }, (_, offset) =>
    playerMatch(`inferno-${offset}`, day(6 + offset), {
      map: 'de_inferno',
      outcome: offset === 0 ? 'win' : 'loss',
    }),
  ),
  playerMatch('ancient', day(11), { map: 'de_ancient', outcome: 'loss' }),
];

const withMatches = (matches: PlayerMatch[] | null) => ({
  createPerformanceSource: () => fakePerformance(matches && performanceData(matches)),
});

describe('fraglens analyze', () => {
  it('reúne perfil, desempenho, forma, mapas, tendência e sequências', async () => {
    const { exitCode, stdout, stderr } = await runCli(['analyze', STEAM_ID], withMatches(MATCHES));

    expect(exitCode).toBe(0);
    expect(stderr).toBe('');

    expect(stdout).toContain('Jogador Teste');
    expect(stdout).toMatch(/Horas de CS2\s+15\.387,4 h \(24,3 h nas últimas 2 semanas\)/);
    expect(stdout).toMatch(/Banimentos\s+✓ Nenhum banimento registrado/);
    expect(stdout).toMatch(/Premier\s+15\.234/);

    expect(stdout).toMatch(/Base: 12 partidas · de 19\/09\/2026 a 30\/09\/2026/);
    // 5 vitórias (4 em Mirage, 1 em Inferno) e 7 derrotas.
    expect(stdout).toMatch(/Resultado\s+5 V · 7 D · 0 E \(41,7% de vitórias\)/);
    expect(stdout).toContain('Últimas 10: 5 V · 5 D · 0 E');

    expect(stdout).toMatch(/Mirage\s+6\s+4-2-0\s+66,7%/);
    expect(stdout).toMatch(/Melhor mapa: Mirage \(66,7% de vitórias · K\/D 1,23 · 6 partidas\)/);
    expect(stdout).toMatch(/Pior mapa: Inferno \(20,0% de vitórias · K\/D 1,23 · 5 partidas\)/);

    // 10 recentes × apenas 2 anteriores: comparação indisponível.
    expect(stdout).toContain('Dados insuficientes para comparar');
    expect(stdout).toMatch(/Sequência atual\s+4 vitórias/);

    expect(stdout).toContain('ANÁLISE COM IA');
    expect(stdout).toContain('Nenhum provedor de IA configurado (AI_PROVIDER).');
    expect(stdout).toContain('Dados fornecidos pela Leetify');
    expect(stdout).toContain('Análise gerada em');
  });

  it('com --no-ai informa que a IA foi desativada', async () => {
    const { stdout } = await runCli(['analyze', STEAM_ID, '--no-ai'], withMatches(MATCHES));

    expect(stdout).toContain('Desativada nesta consulta (--no-ai).');
  });

  it('sem dados na Leetify, exibe o perfil e explica o motivo', async () => {
    const { exitCode, stdout } = await runCli(['analyze', STEAM_ID], withMatches(null));

    expect(exitCode).toBe(0);
    expect(stdout).toContain('Jogador Teste');
    expect(stdout).toContain('⚠ A Leetify não tem dados de partidas deste jogador.');
    expect(stdout).toContain('leetify.com');
    expect(stdout).not.toContain('MAPAS');
    expect(stdout).not.toContain('Dados fornecidos pela Leetify');
  });

  it('com --json retorna a análise estruturada', async () => {
    const { stdout, stderr } = await runCli(
      ['analyze', STEAM_ID, '--json', '--no-ai'],
      withMatches(MATCHES),
    );

    const analysis = JSON.parse(stdout) as PlayerAnalysis;
    expect(stderr).toBe('');
    expect(analysis.steamId64).toBe(STEAM_ID);
    expect(analysis.profile.summary.personaName).toBe('Jogador Teste');
    expect(analysis.performance?.sampleSize).toBe(12);
    expect(analysis.performance?.mapHighlights.best?.map).toBe('de_mirage');
    expect(analysis.performance?.recentMatches).toHaveLength(10);
    expect(analysis.aiAnalysis).toEqual({
      status: 'disabled',
      message: 'Análise com IA desativada nesta consulta.',
    });
    expect(analysis.notices).toEqual([]);
  });

  it('registra a análise no banco quando configurado', async () => {
    const memory = memoryPlayerStore();

    await runCli(['analyze', STEAM_ID], {
      ...withMatches(MATCHES),
      env: { STEAM_API_KEY: 'chave', DATABASE_URL: 'postgresql://localhost/fraglens' },
      connectDatabase: () => fakeDatabase({ players: memory.store }),
    });

    expect(memory.jobs.map((job) => [job.type, job.result?.status])).toEqual([
      ['analysis', 'succeeded'],
      ['steam-profile', 'succeeded'],
    ]);
  });

  it('rejeita --limit inválido', async () => {
    const { exitCode, stderr } = await runCli(['analyze', STEAM_ID, '--limit', '101']);

    expect(exitCode).toBe(2);
    expect(stderr).toContain("erro: valor inválido '101' para a opção '--limit <n>'.");
  });
});
