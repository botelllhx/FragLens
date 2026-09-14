import pc from 'picocolors';

export type Colors = ReturnType<typeof pc.createColors>;

export interface Symbols {
  ok: string;
  warn: string;
  fail: string;
  bullet: string;
  dash: string;
  rule: string;
  up: string;
  down: string;
  stable: string;
  arrow: string;
  ellipsis: string;
  bar: string;
  barEmpty: string;
}

export interface Theme {
  colors: Colors;
  symbols: Symbols;
  colorsEnabled: boolean;
  unicode: boolean;
  /** Largura usada nas linhas divisórias e no rodapé. */
  width: number;
}

const UNICODE_SYMBOLS: Symbols = {
  ok: '✓',
  warn: '⚠',
  fail: '✗',
  bullet: '•',
  dash: '—',
  rule: '─',
  up: '▲',
  down: '▼',
  stable: '=',
  arrow: '→',
  ellipsis: '…',
  bar: '█',
  barEmpty: '░',
};
const ASCII_SYMBOLS: Symbols = {
  ok: '[ok]',
  warn: '[!]',
  fail: '[x]',
  bullet: '*',
  dash: '-',
  rule: '-',
  up: '+',
  down: '-',
  stable: '=',
  arrow: '->',
  ellipsis: '...',
  bar: '#',
  barEmpty: '.',
};

export const DEFAULT_WIDTH = 80;
const MIN_WIDTH = 60;
const MAX_WIDTH = 100;

/** Largura do terminal limitada a uma faixa legível; sem terminal (saída redirecionada), usa 80. */
export function terminalWidth(columns: number | undefined): number {
  if (columns === undefined || !Number.isFinite(columns) || columns <= 0) return DEFAULT_WIDTH;
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.floor(columns)));
}

export function createTheme(options: {
  colorsEnabled: boolean;
  unicode: boolean;
  width?: number;
}): Theme {
  return {
    colors: pc.createColors(options.colorsEnabled),
    symbols: options.unicode ? UNICODE_SYMBOLS : ASCII_SYMBOLS,
    colorsEnabled: options.colorsEnabled,
    unicode: options.unicode,
    width: options.width ?? DEFAULT_WIDTH,
  };
}

/**
 * O console legado do Windows (cmd/conhost) não exibe ✓ ⚠ ✗ corretamente.
 * Mesma heurística usada pelo pacote `is-unicode-supported`.
 */
export function supportsUnicode(
  env: Readonly<Record<string, string | undefined>> = process.env,
  platform: NodeJS.Platform = process.platform,
): boolean {
  if (platform !== 'win32') return env.TERM !== 'linux';

  return (
    Boolean(env.WT_SESSION) ||
    Boolean(env.TERMINUS_SUBLIME) ||
    env.ConEmuTask === '{cmd::Cmder}' ||
    env.TERM_PROGRAM === 'vscode' ||
    env.TERM === 'xterm-256color' ||
    env.TERM === 'alacritty' ||
    env.TERMINAL_EMULATOR === 'JetBrains-JediTerm'
  );
}
