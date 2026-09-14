import pc from 'picocolors';

export type Colors = ReturnType<typeof pc.createColors>;

export interface Symbols {
  ok: string;
  warn: string;
  fail: string;
  bullet: string;
  dash: string;
}

export interface Theme {
  colors: Colors;
  symbols: Symbols;
}

const UNICODE_SYMBOLS: Symbols = { ok: '✓', warn: '⚠', fail: '✗', bullet: '•', dash: '—' };
const ASCII_SYMBOLS: Symbols = { ok: '[ok]', warn: '[!]', fail: '[x]', bullet: '*', dash: '-' };

export function createTheme(options: { colorsEnabled: boolean; unicode: boolean }): Theme {
  return {
    colors: pc.createColors(options.colorsEnabled),
    symbols: options.unicode ? UNICODE_SYMBOLS : ASCII_SYMBOLS,
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
