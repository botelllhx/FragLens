import type { Theme } from './theme.js';

/** Recuo do cabeçalho e do rodapé. */
const OUTER_INDENT = ' ';
/** Recuo do conteúdo das seções. */
const SECTION_INDENT = '  ';
const CARD_GAP = '   ';
const FOOTER_SEPARATOR = ' · ';

/** Marca do FragLens seguida do título e das linhas de contexto. */
export function header(title: string, lines: readonly string[], theme: Theme): string[] {
  const brand = theme.colors.bold(theme.colors.cyan('FRAGLENS'));
  return [
    '',
    `${OUTER_INDENT}${brand}  ${title}`,
    ...lines.map((line) => `${OUTER_INDENT}${line}`),
  ];
}

/** Seção com o título na própria linha divisória: "── TÍTULO · detalhe ─────". */
export function section(
  title: string,
  body: readonly string[],
  theme: Theme,
  detail?: string,
): string[] {
  return [
    '',
    titledRule(title, detail, theme),
    ...body.map((line) => (line === '' ? '' : `${SECTION_INDENT}${line}`)),
  ];
}

function titledRule(title: string, detail: string | undefined, theme: Theme): string {
  const { colors, symbols, width } = theme;
  const label = detail ? `${title} · ${detail}` : title;
  // "── " + rótulo + " " + preenchimento ocupam a largura do tema.
  const fill = Math.max(3, width - label.length - 4);
  const detailText = detail ? colors.dim(` · ${detail}`) : '';
  return `${colors.dim(symbols.rule.repeat(2))} ${colors.bold(title)}${detailText} ${colors.dim(symbols.rule.repeat(fill))}`;
}

export interface StatCard {
  label: string;
  value: string;
}

/** Números principais em destaque: rótulos em cima, valores em negrito embaixo. */
export function statCards(cards: readonly StatCard[], { colors }: Theme): string[] {
  const widths = cards.map((card) => Math.max(card.label.length, card.value.length));
  const row = (text: (card: StatCard) => string, style: (text: string) => string) =>
    cards
      .map((card, index) => {
        const isLast = index === cards.length - 1;
        return style(isLast ? text(card) : text(card).padEnd(widths[index] ?? 0));
      })
      .join(CARD_GAP);

  return [row((card) => card.label, colors.dim), row((card) => card.value, colors.bold)];
}

/** Linhas "rótulo  valor" com os rótulos alinhados. */
export function keyValues(
  rows: readonly (readonly [label: string, value: string])[],
  { colors }: Theme,
): string[] {
  const width = Math.max(0, ...rows.map(([label]) => label.length)) + 2;
  return rows.map(([label, value]) => `${colors.dim(label.padEnd(width))}${value}`);
}

/** Rodapé discreto: as partes são unidas por "·" e quebradas na largura do tema. */
export function footer(parts: readonly string[], theme: Theme): string[] {
  const maxLength = theme.width - OUTER_INDENT.length;
  const lines: string[] = [];
  let current = '';

  for (const part of parts) {
    const candidate = current ? `${current}${FOOTER_SEPARATOR}${part}` : part;
    if (current && candidate.length > maxLength) {
      lines.push(current);
      current = part;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);

  return ['', ...lines.map((line) => `${OUTER_INDENT}${theme.colors.dim(line)}`), ''];
}
