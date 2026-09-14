import { describe, expect, it } from 'vitest';
import type { Outcome } from '../src/form.js';
import { performanceByMap } from '../src/maps.js';
import { summarize } from '../src/summary.js';
import { compareRecentToPrevious, performanceBlocks, streaks } from '../src/trends.js';
import type { MatchSample, MatchStats } from '../src/types.js';

const BASE_STATS: MatchStats = {
  kills: 20,
  deaths: 10,
  assists: 5,
  headshotKills: 10,
  damage: 2000,
  roundsPlayed: 20,
  roundsWon: 13,
  roundsLost: 7,
  roundsSurvived: 10,
  mvps: 3,
  multiKills: { twoKills: 3, threeKills: 1, fourKills: 0, fiveKills: 0 },
  flashAssists: 2,
  utility: {
    flashbangsThrown: 10,
    flashbangsHitEnemies: 5,
    heGrenadesThrown: 4,
    molotovsThrown: 3,
    smokesThrown: 3,
  },
  trades: {
    tradeKillOpportunities: 10,
    tradeKillAttempts: 5,
    tradeKills: 4,
    tradedDeathOpportunities: 8,
    tradedDeathAttempts: 4,
    tradedDeaths: 2,
  },
};

function sample(
  overrides: {
    finishedAt?: string;
    map?: string;
    outcome?: Outcome;
    stats?: Partial<MatchStats>;
  } = {},
): MatchSample {
  return {
    finishedAt: overrides.finishedAt ?? '2026-09-01T12:00:00.000Z',
    map: overrides.map ?? 'de_mirage',
    outcome: overrides.outcome ?? 'win',
    stats: { ...BASE_STATS, ...overrides.stats },
  };
}

/** `count` partidas da mais recente para a mais antiga, uma por dia. */
function sequence(
  count: number,
  build: (index: number) => Parameters<typeof sample>[0] = () => ({}),
) {
  return Array.from({ length: count }, (_, index) =>
    sample({
      finishedAt: new Date(Date.UTC(2026, 8, 30) - index * 86_400_000).toISOString(),
      ...build(index),
    }),
  );
}

describe('summarize', () => {
  it('soma os contadores antes de calcular as proporções', () => {
    const summary = summarize([
      sample(),
      sample({
        outcome: 'loss',
        stats: {
          kills: 10,
          deaths: 20,
          headshotKills: 2,
          damage: 1000,
          roundsWon: 7,
          roundsLost: 13,
          roundsSurvived: 5,
        },
      }),
    ]);

    expect(summary).toMatchObject({
      matches: 2,
      wins: 1,
      losses: 1,
      ties: 0,
      winRate: 50,
      rounds: { played: 40, won: 20, lost: 20, winRate: 50, survivalRate: 37.5 },
      totals: { kills: 30, deaths: 30, assists: 10, headshotKills: 12, damage: 3000 },
      killDeathRatio: 1,
      kda: 1.33,
      headshotPercentage: 40,
      averageDamagePerRound: 75,
      killsPerRound: 0.75,
      deathsPerRound: 0.75,
      assistsPerRound: 0.25,
      averageKills: 15,
      averageDeaths: 15,
      multiKills: { twoKills: 6, threeKills: 2, roundsWithMultiKillPercentage: 20 },
      utility: { flashAssistsPerMatch: 2, utilityPerRound: 1, enemiesFlashedPerFlashbang: 0.5 },
      trades: { tradeKillAttemptRate: 50, tradeKillSuccessRate: 80, tradedDeathSuccessRate: 50 },
    });
  });

  it('não é a média dos K/D de cada partida', () => {
    // K/D de cada partida: 10/2 = 5,00 e 5/10 = 0,50 (média 2,75).
    // Agregado correto: 15 kills ÷ 12 mortes = 1,25.
    const summary = summarize([
      sample({ stats: { kills: 10, deaths: 2 } }),
      sample({ stats: { kills: 5, deaths: 10 } }),
    ]);

    expect(summary.killDeathRatio).toBe(1.25);
  });

  it('conta empates no total de partidas do win rate', () => {
    const summary = summarize([sample(), sample({ outcome: 'tie' }), sample({ outcome: 'loss' })]);

    expect(summary).toMatchObject({ wins: 1, ties: 1, losses: 1, winRate: 33.3 });
  });

  it('sem mortes, K/D e KDA não dividem por zero', () => {
    const summary = summarize([sample({ stats: { deaths: 0 } })]);

    expect(summary.killDeathRatio).toBe(20);
    expect(summary.kda).toBe(25);
  });

  it('sem partidas, as proporções ficam indisponíveis (null)', () => {
    const summary = summarize([]);

    expect(summary).toMatchObject({
      matches: 0,
      winRate: null,
      killDeathRatio: null,
      kda: null,
      headshotPercentage: null,
      averageDamagePerRound: null,
      averageKills: null,
      trades: { tradeKillSuccessRate: null },
    });
  });
});

describe('performanceByMap', () => {
  it('agrupa por mapa, ordena pelo mais jogado e marca amostras pequenas', () => {
    const maps = performanceByMap([
      ...sequence(5, (index) => ({ map: 'de_mirage', outcome: index < 3 ? 'win' : 'loss' })),
      sample({ map: 'de_ancient', outcome: 'loss' }),
      sample({ map: 'de_inferno', outcome: 'win' }),
    ]);

    expect(maps.map((map) => map.map)).toEqual(['de_mirage', 'de_inferno', 'de_ancient']);
    expect(maps[0]).toMatchObject({
      matches: 5,
      wins: 3,
      losses: 2,
      winRate: 60,
      killDeathRatio: 2,
      averageDamagePerRound: 100,
      headshotPercentage: 50,
      averageKills: 20,
      lowSample: false,
    });
    expect(maps[1]).toMatchObject({ winRate: 100, lowSample: true });
  });
});

describe('streaks', () => {
  it('calcula a sequência atual e as maiores sequências', () => {
    const result = streaks([
      'win',
      'win',
      'loss',
      'loss',
      'loss',
      'tie',
      'win',
      'win',
      'win',
      'win',
    ]);

    expect(result).toEqual({
      current: { outcome: 'win', length: 2 },
      longestWinStreak: 4,
      longestLossStreak: 3,
    });
  });

  it('empate interrompe as sequências', () => {
    expect(streaks(['win', 'tie', 'win']).longestWinStreak).toBe(1);
    expect(streaks(['tie', 'tie']).current).toEqual({ outcome: 'tie', length: 2 });
  });

  it('sem partidas não há sequência', () => {
    expect(streaks([])).toEqual({ current: null, longestWinStreak: 0, longestLossStreak: 0 });
  });
});

describe('compareRecentToPrevious', () => {
  it('compara as últimas 10 com as 20 anteriores e indica a direção', () => {
    const matches = sequence(30, (index) =>
      index < 10
        ? { outcome: 'win', stats: { kills: 25, headshotKills: 10 } }
        : { outcome: index % 2 === 0 ? 'win' : 'loss', stats: { kills: 10, headshotKills: 10 } },
    );

    const comparison = compareRecentToPrevious(matches);

    expect(comparison).toMatchObject({ recentMatches: 10, previousMatches: 20, sufficient: true });
    expect(comparison.metrics.winRate).toEqual({
      recent: 100,
      previous: 50,
      delta: 50,
      direction: 'up',
    });
    expect(comparison.metrics.killDeathRatio).toMatchObject({ delta: 1.5, direction: 'up' });
    expect(comparison.metrics.headshotPercentage).toMatchObject({ delta: -60, direction: 'down' });
    expect(comparison.metrics.averageDamagePerRound).toMatchObject({
      delta: 0,
      direction: 'stable',
    });
  });

  it('variações abaixo do limite são estáveis; a partir do limite, não', () => {
    const build = (recentDamage: number) =>
      compareRecentToPrevious(
        sequence(30, (index) => ({ stats: { damage: index < 10 ? recentDamage : 2000 } })),
      ).metrics.averageDamagePerRound;

    expect(build(2050)).toMatchObject({ delta: 2.5, direction: 'stable' });
    expect(build(2060)).toMatchObject({ delta: 3, direction: 'up' });
  });

  it('não calcula variação quando um dos períodos tem poucas partidas', () => {
    const comparison = compareRecentToPrevious(sequence(12));

    expect(comparison).toMatchObject({ recentMatches: 10, previousMatches: 2, sufficient: false });
    expect(comparison.metrics.killDeathRatio).toEqual({
      recent: 2,
      previous: 2,
      delta: null,
      direction: null,
    });
  });
});

describe('performanceBlocks', () => {
  it('forma blocos a partir da partida mais recente e ordena do mais antigo ao mais recente', () => {
    const matches = sequence(25, (index) => ({ outcome: index < 10 ? 'win' : 'loss' }));

    const blocks = performanceBlocks(matches);

    expect(blocks.map((block) => [block.matches, block.complete])).toEqual([
      [5, false],
      [10, true],
      [10, true],
    ]);
    expect(blocks[2]).toMatchObject({
      from: '2026-09-21T00:00:00.000Z',
      to: '2026-09-30T00:00:00.000Z',
      winRate: 100,
    });
    expect(blocks[0]?.winRate).toBe(0);
  });

  it('sem partidas não há blocos', () => {
    expect(performanceBlocks([])).toEqual([]);
  });
});
