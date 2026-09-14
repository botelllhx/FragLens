import { summarize } from './summary.js';
import type { MatchSample } from './types.js';

/** Abaixo disso, o desempenho no mapa é marcado como amostra pequena. */
export const MIN_MAP_SAMPLE = 5;

export interface MapPerformance {
  /** Nome interno do mapa, ex.: "de_mirage". */
  map: string;
  matches: number;
  wins: number;
  losses: number;
  ties: number;
  winRate: number | null;
  roundWinRate: number | null;
  killDeathRatio: number | null;
  kda: number | null;
  averageDamagePerRound: number | null;
  headshotPercentage: number | null;
  averageKills: number | null;
  averageDeaths: number | null;
  lowSample: boolean;
}

/** Desempenho por mapa, do mais jogado para o menos jogado. */
export function performanceByMap(matches: readonly MatchSample[]): MapPerformance[] {
  const groups = new Map<string, MatchSample[]>();
  for (const match of matches) {
    const group = groups.get(match.map);
    if (group) group.push(match);
    else groups.set(match.map, [match]);
  }

  return [...groups.entries()]
    .map(([map, group]) => {
      const summary = summarize(group);
      return {
        map,
        matches: summary.matches,
        wins: summary.wins,
        losses: summary.losses,
        ties: summary.ties,
        winRate: summary.winRate,
        roundWinRate: summary.rounds.winRate,
        killDeathRatio: summary.killDeathRatio,
        kda: summary.kda,
        averageDamagePerRound: summary.averageDamagePerRound,
        headshotPercentage: summary.headshotPercentage,
        averageKills: summary.averageKills,
        averageDeaths: summary.averageDeaths,
        lowSample: summary.matches < MIN_MAP_SAMPLE,
      };
    })
    .sort(
      (a, b) =>
        b.matches - a.matches ||
        (b.winRate ?? -1) - (a.winRate ?? -1) ||
        a.map.localeCompare(b.map),
    );
}
