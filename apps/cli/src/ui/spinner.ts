import type { CliIo } from '../io.js';
import type { Theme } from './theme.js';

const ESC = String.fromCharCode(27);
/** Volta ao início da linha e a apaga. */
const CLEAR_LINE = `\r${ESC}[2K`;
const UNICODE_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const ASCII_FRAMES = ['-', '\\', '|', '/'];
const FRAME_INTERVAL_MS = 80;

export interface SpinnerOptions {
  io: CliIo;
  theme: Theme;
  /** Só deve ser `true` em terminal interativo e sem --json. */
  enabled: boolean;
}

/**
 * O indicador só aparece em terminal interativo. Com --json o stderr deve ficar limpo, e com
 * --verbose os logs iriam se misturar à animação.
 */
export function spinnerEnabled(
  interactive: boolean | undefined,
  flags: { json?: boolean | undefined; verbose?: boolean | undefined },
): boolean {
  return interactive === true && flags.json !== true && flags.verbose !== true;
}

/**
 * Mostra um indicador de carregamento no stderr enquanto `task` executa e apaga a linha
 * ao terminar (com sucesso ou erro). Desativado, apenas executa a tarefa.
 */
export async function withSpinner<T>(
  text: string,
  options: SpinnerOptions,
  task: () => Promise<T>,
): Promise<T> {
  if (!options.enabled) return task();

  const { io, theme } = options;
  const frames = theme.unicode ? UNICODE_FRAMES : ASCII_FRAMES;
  const label = `${text}${theme.symbols.ellipsis}`;
  let frame = 0;

  const render = () => {
    const symbol = frames[frame % frames.length] ?? '';
    io.stderr(`${CLEAR_LINE}${theme.colors.cyan(symbol)} ${theme.colors.dim(label)}`);
    frame++;
  };

  render();
  const timer = setInterval(render, FRAME_INTERVAL_MS);
  // Não impede o processo de terminar se algo esquecer de parar o indicador.
  timer.unref();

  try {
    return await task();
  } finally {
    clearInterval(timer);
    io.stderr(CLEAR_LINE);
  }
}
