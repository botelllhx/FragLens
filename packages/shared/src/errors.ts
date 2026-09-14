export type ErrorCode =
  | 'CONFIG_INVALID'
  | 'CONFIG_MISSING'
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'UPSTREAM_UNAVAILABLE'
  | 'UPSTREAM_ERROR'
  | 'DATABASE_UNAVAILABLE'
  | 'INTERNAL';

export interface AppErrorOptions {
  /** Possíveis causas ou próximos passos, exibidos ao usuário. */
  hints?: readonly string[];
  cause?: unknown;
}

/**
 * Erro esperado da aplicação. `message` e `hints` são exibidos ao usuário (pt-BR);
 * `cause` guarda o detalhe técnico, mostrado apenas com --verbose.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly hints: readonly string[];

  constructor(code: ErrorCode, message: string, options: AppErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = 'AppError';
    this.code = code;
    this.hints = options.hints ?? [];
  }
}
