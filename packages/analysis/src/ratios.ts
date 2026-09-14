import { round } from './match-metrics.js';

/** `numerador / denominador` arredondado; `null` quando o denominador é zero. */
export function ratio(numerator: number, denominator: number, digits = 2): number | null {
  return denominator > 0 ? round(numerator / denominator, digits) : null;
}

/** Porcentagem com uma casa decimal; `null` quando o total é zero. */
export function percentage(part: number, total: number): number | null {
  return total > 0 ? round((part / total) * 100, 1) : null;
}
