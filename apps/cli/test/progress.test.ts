import type { PlayerMatch, ProgressReport } from '@fraglens/core';
import { describe, expect, it } from 'vitest';
import { fakePerformance, performanceData, playerMatch, runCli, STEAM_ID } from './helpers.js';

function day(index: number): string {
  return new Date(Date.UTC(2026, 8, 30) - index * 86_400_000).toISOString();
}

function withMatches(matches: PlayerMatch[]) {
  return { createPerformanceSource: () => fakePerformance(performanceData(matches)) };
}

const BASE = playerMatch('base', day(0));

/**
 * 25 partidas (índice 0 = mais recente):
 * - 0 a 9: vitórias com 25 kills e 13 headshots;
 * - 10 a 24: vitória nos índices pares e derrota nos ímpares, com 10 kills e 5 headshots.
 * Todas com 13 mortes, 1454 de dano e 20 rounds.
 */
const MATCHES: PlayerMatch[] = Array.from({ length: 25 }, (_, index) =>
  playerMatch(`m${index}`, day(index), {
    outcome: index < 10 || index % 2 === 0 ? 'win' : 'loss',
    stats: {
      ...BASE.stats,
      kills: index < 10 ? 25 : 10,
      headshotKills: index < 10 ? 13 : 5,
    },
  }),
);

describe('fraglens progress', () => {
  it('exibe resumo, comparação, sequências e evolução', async () => {
    const { exitCode, stdout, stderr } = await runCli(['progress', STEAM_ID], withMatches(MATCHES));

    expect(exitCode).toBe(0);
    expect(stderr).toBe('');
    expect(stdout).toContain('── DESEMPENHO · 25 partidas ·');
    expect(stdout).toMatch(/VITÓRIAS\s+K\/D\s+ADR\s+HS%\s+KDA/);
    // 18 vitórias (10 recentes + 8 pares entre 10 e 24) e 7 derrotas.
    // (10 × 25 + 15 × 10) kills ÷ (25 × 13) mortes = 400 ÷ 325 = 1,23.
    expect(stdout).toMatch(/72,0%\s+1,23\s+72,7/);
    expect(stdout).toMatch(/Resultado\s+18V 7D 0E/);
    expect(stdout).toContain('── TENDÊNCIA · últimas 10 × 15 anteriores ──');
    // Anteriores: 8 de 15 vitórias; recentes: 10 de 10.
    expect(stdout).toMatch(/Vitórias\s+53,3%\s+→\s+100,0%\s+▲ \+46,7 p\.p\./);
    // 150 ÷ 195 = 0,77 contra 250 ÷ 130 = 1,92.
    expect(stdout).toMatch(/K\/D\s+0,77\s+→\s+1,92\s+▲ \+1,15/);
    expect(stdout).toMatch(/ADR\s+72,7\s+→\s+72,7\s+= estável \(0,0\)/);
    // A partida de índice 10 também é vitória: sequência atual de 11.
    expect(stdout).toContain('Sequência atual: 11 vitórias · maiores sequências: 11V / 1D');
    expect(stdout).toMatch(/Período\s+Jogos\s+Vitórias/);
    expect(stdout).toContain('* bloco com menos de 10 partidas');
    expect(stdout).toContain('métricas calculadas pelo FragLens');
  });

  it('informa dados insuficientes para a comparação', async () => {
    const { stdout } = await runCli(['progress', STEAM_ID, '--limit', '12'], withMatches(MATCHES));

    expect(stdout).toContain(
      'Dados insuficientes para comparar (10 recentes × 2 anteriores; mínimo de 5 em cada período).',
    );
    expect(stdout).toContain('── TENDÊNCIA ──');
  });

  it('usa símbolos ASCII sem suporte a unicode', async () => {
    const { stdout } = await runCli(['progress', STEAM_ID], {
      ...withMatches(MATCHES),
      unicode: false,
    });

    expect(stdout).toMatch(/Vitórias\s+53,3%\s+->\s+100,0%\s+\+ \+46,7 p\.p\./);
    expect(stdout).toContain('-- DESEMPENHO');
    expect(stdout).not.toContain('▲');
    expect(stdout).not.toContain('█');
    expect(stdout).not.toContain('─');
    expect(stdout).not.toContain('→');
  });

  it('com --json retorna o relatório estruturado', async () => {
    const { stdout, stderr } = await runCli(['progress', STEAM_ID, '--json'], withMatches(MATCHES));

    const report = JSON.parse(stdout) as ProgressReport;
    expect(stderr).toBe('');
    expect(report.sampleSize).toBe(25);
    expect(report.summary).toMatchObject({ wins: 18, losses: 7, killDeathRatio: 1.23 });
    expect(report.comparison).toMatchObject({
      recentMatches: 10,
      previousMatches: 15,
      sufficient: true,
    });
    expect(report.comparison.metrics.killDeathRatio.direction).toBe('up');
    expect(report.streaks).toEqual({
      current: { outcome: 'win', length: 11 },
      longestWinStreak: 11,
      longestLossStreak: 1,
    });
    expect(report.blocks.map((block) => block.matches)).toEqual([5, 10, 10]);
  });

  it('informa quando não há partidas', async () => {
    const { exitCode, stdout } = await runCli(['progress', STEAM_ID], withMatches([]));

    expect(exitCode).toBe(0);
    expect(stdout).toContain('Nenhuma partida disponível na Leetify.');
  });
});
