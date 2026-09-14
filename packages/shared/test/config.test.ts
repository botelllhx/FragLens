import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { AppError } from '../src/errors.js';

function captureError(fn: () => unknown): AppError {
  try {
    fn();
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
  throw new Error('Era esperado um AppError');
}

describe('loadConfig', () => {
  it('aplica valores padrão quando nada está configurado', () => {
    const config = loadConfig({});

    expect(config.nodeEnv).toBe('development');
    expect(config.server).toEqual({ host: '0.0.0.0', port: 3000 });
    expect(config.steam.profileCacheTtlSeconds).toBe(86_400);
    expect(config.ai.provider).toBe('none');
    expect(config.steam.apiKey).toBeUndefined();
    expect(config.databaseUrl).toBeUndefined();
  });

  it('trata variáveis vazias do .env como não configuradas', () => {
    const config = loadConfig({ STEAM_API_KEY: '', PORT: '', LEETIFY_API_KEY: '   ' });

    expect(config.steam.apiKey).toBeUndefined();
    expect(config.leetify.apiKey).toBeUndefined();
    expect(config.server.port).toBe(3000);
  });

  it('converte e normaliza os valores informados', () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      PORT: '8080',
      STEAM_API_KEY: '  ABC123  ',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      STEAM_PROFILE_CACHE_TTL: '60',
    });

    expect(config.nodeEnv).toBe('production');
    expect(config.server.port).toBe(8080);
    expect(config.steam.apiKey).toBe('ABC123');
    expect(config.databaseUrl).toBe('postgresql://user:pass@localhost:5432/db');
    expect(config.steam.profileCacheTtlSeconds).toBe(60);
  });

  it('lista todas as variáveis inválidas em um único erro', () => {
    const error = captureError(() =>
      loadConfig({ PORT: 'abc', DATABASE_URL: 'mysql://localhost/db', AI_PROVIDER: 'openai' }),
    );

    expect(error.code).toBe('CONFIG_INVALID');
    expect(error.hints).toHaveLength(3);
    expect(error.hints.some((hint) => hint.startsWith('PORT:'))).toBe(true);
    expect(error.hints).toContain('DATABASE_URL: Deve começar com postgres:// ou postgresql://');
    expect(error.hints.some((hint) => hint.startsWith('AI_PROVIDER:'))).toBe(true);
  });

  it('rejeita porta fora do intervalo válido', () => {
    const error = captureError(() => loadConfig({ PORT: '70000' }));

    expect(error.hints.some((hint) => hint.startsWith('PORT:'))).toBe(true);
  });
});
