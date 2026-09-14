export type Outcome = 'win' | 'loss' | 'tie';

export interface RecentForm {
  /** Resultados da partida mais recente para a mais antiga. */
  outcomes: Outcome[];
  wins: number;
  losses: number;
  ties: number;
}

/** Resultados das `size` partidas mais recentes. Espera a lista já ordenada da mais nova para a mais antiga. */
export function recentForm(outcomesNewestFirst: readonly Outcome[], size: number): RecentForm {
  const outcomes = outcomesNewestFirst.slice(0, Math.max(0, size));
  return {
    outcomes,
    wins: outcomes.filter((outcome) => outcome === 'win').length,
    losses: outcomes.filter((outcome) => outcome === 'loss').length,
    ties: outcomes.filter((outcome) => outcome === 'tie').length,
  };
}
