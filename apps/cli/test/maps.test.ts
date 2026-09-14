import type { MapReport, PlayerMatch } from '@fraglens/core';
import { describe, expect, it } from 'vitest';
import { fakePerformance, performanceData, playerMatch, runCli, STEAM_ID } from './helpers.js';

function day(index: number): string {
  return new Date(Date.UTC(2026, 8, 30) - index * 86_400_000).toISOString();
}

function withMatches(matches: PlayerMatch[]) {
  return { createPerformanceSource: () => fakePerformance(performanceData(matches)) };
}

// 6 partidas em Mirage (4 V, 2 D), 2 em Inferno (1 V, 1 E) e 1 em Ancient (D).
const MATCHES: PlayerMatch[] = [
  ...Array.from({ length: 6 }, (_, index) =>
    playerMatch(`mirage-${index}`, day(index), { outcome: index < 4 ? 'win' : 'loss' }),
  ),
  playerMatch('inferno-1', day(6), { map: 'de_inferno' }),
  playerMatch('inferno-2', day(7), { map: 'de_inferno', outcome: 'tie' }),
  playerMatch('ancient-1', day(8), { map: 'de_ancient', outcome: 'loss' }),
];

describe('fraglens maps', () => {
  it('exibe o desempenho por mapa, do mais jogado ao menos jogado', async () => {
    const { exitCode, stdout, stderr } = await runCli(['maps', STEAM_ID], withMatches(MATCHES));

    expect(exitCode).toBe(0);
    expect(stderr).toBe('');
    expect(stdout).toMatch(/Base\s+9 partidas · de 22\/09\/2026 a 30\/09\/2026/);
    expect(stdout).toMatch(/Mirage\s+6\s+4-2-0\s+66,7%\s+1,23\s+72,7\s+81,3%\s+16,0\s+13,0/);
    expect(stdout).toMatch(/Inferno\*\s+2\s+1-0-1\s+50,0%/);
    expect(stdout).toMatch(/Ancient\*\s+1\s+0-1-0\s+0,0%/);
    expect(stdout.indexOf('Mirage')).toBeLessThan(stdout.indexOf('Inferno'));
    expect(stdout).toContain('* Menos de 5 partidas no mapa: amostra pequena');
    expect(stdout).toContain('Dados fornecidos pela Leetify');
  });

  it('respeita --limit considerando as partidas mais recentes', async () => {
    const { stdout } = await runCli(['maps', STEAM_ID, '--limit', '6'], withMatches(MATCHES));

    expect(stdout).toContain('6 partidas');
    expect(stdout).not.toContain('Inferno');
  });

  it('com --json retorna o relatório estruturado', async () => {
    const { stdout, stderr } = await runCli(['maps', STEAM_ID, '--json'], withMatches(MATCHES));

    const report = JSON.parse(stdout) as MapReport;
    expect(stderr).toBe('');
    expect(report.sampleSize).toBe(9);
    expect(report.period).toEqual({ from: day(8), to: day(0) });
    expect(report.maps.map((map) => [map.map, map.matches, map.lowSample])).toEqual([
      ['de_mirage', 6, false],
      ['de_inferno', 2, true],
      ['de_ancient', 1, true],
    ]);
  });

  it('informa quando não há partidas', async () => {
    const { exitCode, stdout } = await runCli(['maps', STEAM_ID], withMatches([]));

    expect(exitCode).toBe(0);
    expect(stdout).toContain('nenhuma partida disponível');
    expect(stdout).toContain('Nenhuma partida disponível na Leetify.');
  });

  it('rejeita --limit inválido', async () => {
    const { exitCode, stderr } = await runCli(['maps', STEAM_ID, '--limit', '0']);

    expect(exitCode).toBe(2);
    expect(stderr).toContain("erro: valor inválido '0' para a opção '--limit <n>'.");
  });
});
