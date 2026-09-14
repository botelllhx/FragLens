import { describe, expect, it } from 'vitest';
import { recentForm } from '../src/form.js';
import { averageDamagePerRound, headshotPercentage, killDeathRatio } from '../src/match-metrics.js';

describe('killDeathRatio', () => {
  it.each([
    [16, 13, 1.23],
    [10, 20, 0.5],
    [7, 3, 2.33],
    [0, 5, 0],
  ])('%i kills / %i mortes → %f', (kills, deaths, expected) => {
    expect(killDeathRatio(kills, deaths)).toBe(expected);
  });

  it('sem mortes, o K/D é igual ao número de kills', () => {
    expect(killDeathRatio(12, 0)).toBe(12);
    expect(killDeathRatio(0, 0)).toBe(0);
  });
});

describe('averageDamagePerRound', () => {
  it('divide o dano pelos rounds com uma casa decimal', () => {
    expect(averageDamagePerRound(1454, 20)).toBe(72.7);
    expect(averageDamagePerRound(2000, 24)).toBe(83.3);
  });

  it('retorna null quando nenhum round foi jogado', () => {
    expect(averageDamagePerRound(0, 0)).toBeNull();
  });
});

describe('headshotPercentage', () => {
  it('calcula a porcentagem de kills com headshot', () => {
    expect(headshotPercentage(13, 16)).toBe(81.3);
    expect(headshotPercentage(0, 10)).toBe(0);
    expect(headshotPercentage(10, 10)).toBe(100);
  });

  it('retorna null quando não houve kills', () => {
    expect(headshotPercentage(0, 0)).toBeNull();
  });
});

describe('recentForm', () => {
  it('considera apenas as partidas mais recentes e conta cada resultado', () => {
    const form = recentForm(['win', 'loss', 'tie', 'win', 'win', 'loss'], 5);

    expect(form).toEqual({
      outcomes: ['win', 'loss', 'tie', 'win', 'win'],
      wins: 3,
      losses: 1,
      ties: 1,
    });
  });

  it('funciona com menos partidas que o tamanho pedido', () => {
    expect(recentForm(['loss'], 10)).toEqual({ outcomes: ['loss'], wins: 0, losses: 1, ties: 0 });
    expect(recentForm([], 10)).toEqual({ outcomes: [], wins: 0, losses: 0, ties: 0 });
  });
});
