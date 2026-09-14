import { AppError } from '@fraglens/shared';
import type { Theme } from './theme.js';

export interface ErrorJson {
  code: string;
  message: string;
  hints: readonly string[];
}

export function errorToJson(error: unknown): ErrorJson {
  if (error instanceof AppError) {
    return { code: error.code, message: error.message, hints: error.hints };
  }
  return { code: 'INTERNAL', message: 'Erro inesperado.', hints: [] };
}

export function renderError(error: unknown, options: { theme: Theme; verbose: boolean }): string {
  const { colors, symbols } = options.theme;
  const { message, hints } = errorToJson(error);
  const lines = [`${colors.red(symbols.fail)} ${colors.bold(message)}`];

  if (hints.length > 0) {
    lines.push('', ...hints.map((hint) => `  ${symbols.bullet} ${hint}`));
  }

  if (options.verbose) {
    lines.push('', colors.dim(technicalDetails(error)));
  } else if (!(error instanceof AppError)) {
    lines.push('', colors.dim('Execute novamente com --verbose para ver os detalhes técnicos.'));
  }

  return `${lines.join('\n')}\n`;
}

function technicalDetails(error: unknown): string {
  if (!(error instanceof Error)) return String(error);

  const details = [error.stack ?? error.message];
  if (error.cause !== undefined) details.push(`Causa: ${technicalDetails(error.cause)}`);
  return details.join('\n');
}
