import { InvalidArgumentError, Option } from 'commander';

export const MAX_MATCH_LIMIT = 100;

export function parseLimit(value: string): number {
  const limit = Number(value);
  if (!/^\d+$/.test(value) || limit < 1 || limit > MAX_MATCH_LIMIT) {
    throw new InvalidArgumentError(`Informe um número inteiro entre 1 e ${MAX_MATCH_LIMIT}.`);
  }
  return limit;
}

/** Opção `--limit <n>` compartilhada pelos comandos que usam partidas. */
export function limitOption(defaultValue: number, description: string): Option {
  return new Option('--limit <n>', `${description} (1 a ${MAX_MATCH_LIMIT})`)
    .argParser(parseLimit)
    .default(defaultValue);
}
