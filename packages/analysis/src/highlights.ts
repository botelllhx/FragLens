import { MIN_MAP_SAMPLE, type MapPerformance } from './maps.js';

export interface MapHighlights {
  /** Mapas com amostra suficiente considerados na comparação. */
  eligibleMaps: number;
  best: MapPerformance | null;
  worst: MapPerformance | null;
}

/**
 * Melhor e pior mapa por win rate (desempate: K/D, depois número de partidas), considerando
 * apenas mapas com pelo menos `minSample` partidas. Com menos de 2 mapas elegíveis não há comparação.
 */
export function mapHighlights(
  maps: readonly MapPerformance[],
  minSample = MIN_MAP_SAMPLE,
): MapHighlights {
  const eligible = maps.filter((map) => map.matches >= minSample && map.winRate !== null);
  if (eligible.length < 2) return { eligibleMaps: eligible.length, best: null, worst: null };

  const strongestFirst = [...eligible].sort(
    (a, b) =>
      (b.winRate ?? 0) - (a.winRate ?? 0) ||
      (b.killDeathRatio ?? 0) - (a.killDeathRatio ?? 0) ||
      b.matches - a.matches,
  );

  return {
    eligibleMaps: eligible.length,
    best: strongestFirst[0] ?? null,
    worst: strongestFirst.at(-1) ?? null,
  };
}
