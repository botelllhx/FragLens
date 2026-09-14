import type { Theme } from './theme.js';

const RULE_WIDTH = 48;

export function banner({ colors }: Theme): string[] {
  return [colors.bold('FRAGLENS'), colors.dim('Inteligência de jogadores de Counter-Strike 2')];
}

export function rule({ colors, symbols }: Theme): string {
  return colors.dim(symbols.rule.repeat(RULE_WIDTH));
}

/** Seção separada por linha horizontal, com título e conteúdo. */
export function section(title: string, body: readonly string[], theme: Theme): string[] {
  return [rule(theme), '', theme.colors.bold(title), '', ...body, ''];
}

/** Linhas "rótulo  valor" com os rótulos alinhados. */
export function keyValues(
  rows: readonly (readonly [label: string, value: string])[],
  { colors }: Theme,
): string[] {
  const width = Math.max(0, ...rows.map(([label]) => label.length)) + 2;
  return rows.map(([label, value]) => `${colors.dim(label.padEnd(width))}${value}`);
}
