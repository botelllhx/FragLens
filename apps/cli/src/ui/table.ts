import type { Theme } from './theme.js';

export interface Column {
  header: string;
  align?: 'left' | 'right';
}

/** Célula simples ou com estilo (cor) aplicado depois do alinhamento. */
export type Cell = string | { text: string; style: (text: string) => string };

const COLUMN_GAP = '  ';

/**
 * Tabela alinhada por colunas. As larguras são calculadas sobre o texto puro,
 * então as cores não desalinham as colunas.
 */
export function renderTable(
  columns: readonly Column[],
  rows: readonly (readonly Cell[])[],
  { colors }: Theme,
  options: { header?: boolean } = {},
): string[] {
  const widths = columns.map((column, index) =>
    Math.max(column.header.length, ...rows.map((row) => cellText(row[index]).length)),
  );

  const pad = (text: string, index: number) => {
    const width = widths[index] ?? 0;
    if (columns[index]?.align === 'right') return text.padStart(width);
    // A última coluna não precisa de espaços à direita (que ficariam coloridos no fim da linha).
    return index === columns.length - 1 ? text : text.padEnd(width);
  };

  const header = columns.map((column, index) => colors.dim(pad(column.header, index)));
  const lines = rows.map((row) =>
    columns.map((_, index) => {
      const cell = row[index];
      const padded = pad(cellText(cell), index);
      return typeof cell === 'object' ? cell.style(padded) : padded;
    }),
  );

  const all = options.header === false ? lines : [header, ...lines];
  return all.map((cells) => cells.join(COLUMN_GAP).trimEnd());
}

function cellText(cell: Cell | undefined): string {
  if (cell === undefined) return '';
  return typeof cell === 'string' ? cell : cell.text;
}
