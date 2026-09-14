import { afterAll, describe, expect, it } from 'vitest';
import { createLogger } from '@fraglens/shared';
import { buildApp } from '../src/app.js';

const app = buildApp({ logger: createLogger({ level: 'silent' }), version: '9.9.9' });

afterAll(async () => {
  await app.close();
});

describe('API', () => {
  it('GET /health retorna status e versão', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'ok', version: '9.9.9' });
  });

  it('rota inexistente retorna 404 com mensagem em português', async () => {
    const response = await app.inject({ method: 'GET', url: '/v1/nao-existe' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: { code: 'NOT_FOUND', message: 'Rota não encontrada.' },
    });
  });
});
