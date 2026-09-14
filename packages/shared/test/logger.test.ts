import { describe, expect, it } from 'vitest';
import { createLogger } from '../src/logger.js';

function captureLogs() {
  const lines: Record<string, unknown>[] = [];
  const destination = {
    write: (message: string) => {
      lines.push(JSON.parse(message) as Record<string, unknown>);
    },
  };
  return { lines, destination };
}

describe('createLogger', () => {
  it('emite logs estruturados com o nome do evento na mensagem', () => {
    const { lines, destination } = captureLogs();
    const logger = createLogger({ level: 'info', destination });

    logger.info({ steamId: '76561198000000000' }, 'steam.profile.fetch');

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ msg: 'steam.profile.fetch', steamId: '76561198000000000' });
  });

  it('oculta chaves de API e credenciais', () => {
    const { lines, destination } = captureLogs();
    const logger = createLogger({ level: 'info', destination });

    logger.info(
      {
        steam: { apiKey: 'segredo-steam' },
        key: 'segredo',
        databaseUrl: 'postgresql://user:senha@host/db',
      },
      'config.loaded',
    );

    const output = JSON.stringify(lines);
    expect(output).not.toContain('segredo');
    expect(output).not.toContain('senha');
    expect(output).toContain('[OCULTO]');
  });

  it('respeita o nível configurado', () => {
    const { lines, destination } = captureLogs();
    const logger = createLogger({ level: 'warn', destination });

    logger.info('ignorado');
    logger.warn('steam.rate_limit');

    expect(lines.map((line) => line.msg)).toEqual(['steam.rate_limit']);
  });
});
