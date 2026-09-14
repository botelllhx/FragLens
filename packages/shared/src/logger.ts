import { destination as createDestination, pino, type DestinationStream, type Logger } from 'pino';
import type { LogLevel } from './config.js';

export type { Logger };

export interface LoggerOptions {
  level: LogLevel;
  destination?: DestinationStream;
}

// Campos que podem conter segredos. Nunca devem aparecer nos logs, nem com --verbose.
const REDACTED_PATHS = [
  'apiKey',
  '*.apiKey',
  'key',
  '*.key',
  'authorization',
  '*.authorization',
  'req.headers.authorization',
  'databaseUrl',
  '*.databaseUrl',
];

/**
 * Logs estruturados em JSON. O destino padrão é o stderr: o stdout fica reservado
 * para a saída dos comandos (ex.: `--json`).
 */
export function createLogger({ level, destination }: LoggerOptions): Logger {
  return pino(
    { level, redact: { paths: REDACTED_PATHS, censor: '[OCULTO]' } },
    destination ?? createDestination({ dest: 2, sync: true }),
  );
}
