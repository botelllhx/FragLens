import { describe, expect, it } from 'vitest';
import { mapHighlights } from '../src/highlights.js';
import type { MapPerformance } from '../src/maps.js';

function map(name: string, overrides: Partial<MapPerformance>): MapPerformance {
  return {
    map: name,
    matches: 10,
    wins: 5,
    losses: 5,
    ties: 0,
    winRate: 50,
    roundWinRate: 50,
    killDeathRatio: 1,
    kda: 1.3,
    averageDamagePerRound: 75,
    headshotPercentage: 40,
    averageKills: 15,
    averageDeaths: 15,
    lowSample: false,
    ...overrides,
  };
}

describe('mapHighlights', () => {
  it('escolhe melhor e pior mapa por win rate entre mapas com amostra suficiente', () => {
    const result = mapHighlights([
      map('de_dust2', { winRate: 48 }),
      map('de_mirage', { winRate: 62 }),
      map('de_inferno', { winRate: 35 }),
      // Maior win rate, mas com amostra pequena: fica de fora.
      map('de_nuke', { matches: 2, winRate: 100, lowSample: true }),
    ]);

    expect(result.eligibleMaps).toBe(3);
    expect(result.best?.map).toBe('de_mirage');
    expect(result.worst?.map).toBe('de_inferno');
  });

  it('desempata pelo K/D', () => {
    const result = mapHighlights([
      map('de_dust2', { winRate: 50, killDeathRatio: 0.9 }),
      map('de_mirage', { winRate: 50, killDeathRatio: 1.2 }),
    ]);

    expect(result.best?.map).toBe('de_mirage');
    expect(result.worst?.map).toBe('de_dust2');
  });

  it('não compara com menos de 2 mapas elegíveis', () => {
    const result = mapHighlights([
      map('de_dust2', { winRate: 50 }),
      map('de_nuke', { matches: 3, lowSample: true }),
    ]);

    expect(result).toEqual({ eligibleMaps: 1, best: null, worst: null });
  });

  it('respeita o mínimo de partidas informado', () => {
    const result = mapHighlights(
      [map('de_dust2', { matches: 3, winRate: 70 }), map('de_nuke', { matches: 3, winRate: 30 })],
      3,
    );

    expect(result.best?.map).toBe('de_dust2');
  });
});
