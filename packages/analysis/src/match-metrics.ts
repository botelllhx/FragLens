export function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** Kills por morte. Sem mortes, o K/D é igual ao número de kills. */
export function killDeathRatio(kills: number, deaths: number): number {
  return round(kills / Math.max(deaths, 1), 2);
}

/** Dano médio por round (ADR). `null` quando nenhum round foi jogado. */
export function averageDamagePerRound(damage: number, rounds: number): number | null {
  return rounds > 0 ? round(damage / rounds, 1) : null;
}

/** Porcentagem de kills com headshot. `null` quando não houve kills. */
export function headshotPercentage(headshotKills: number, kills: number): number | null {
  return kills > 0 ? round((headshotKills / kills) * 100, 1) : null;
}
