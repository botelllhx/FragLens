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
): string[] {
  const widths = columns.map((column, index) =>
    Math.max(column.header.length, ...rows.map((row) => cellText(row[index]).length)),
  );

  const pad = (text: string, index: number) => {
    const width = widths[index] ?? 0;
    return columns[index]?.align === 'right' ? text.padStart(width) : text.padEnd(width);
  };

  const header = columns.map((column, index) => colors.dim(pad(column.header, index)));
  const lines = rows.map((row) =>
    columns.map((_, index) => {
      const cell = row[index];
      const padded = pad(cellText(cell), index);
      return typeof cell === 'object' ? cell.style(padded) : padded;
    }),
  );

  return [header, ...lines].map((cells) => cells.join(COLUMN_GAP).trimEnd());
}

function cellText(cell: Cell | undefined): string {
  if (cell === undefined) return '';
  return typeof cell === 'string' ? cell : cell.text;
}
