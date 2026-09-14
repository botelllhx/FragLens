import { fastify } from 'fastify';
import type { Logger } from '@fraglens/shared';

export interface AppDeps {
  logger: Logger;
  version: string;
}

export function buildApp({ logger, version }: AppDeps) {
  const app = fastify({
    loggerInstance: logger,
    bodyLimit: 64 * 1024,
    requestTimeout: 30_000,
  });

  app.get('/health', () => ({
    status: 'ok',
    version,
    uptimeSeconds: Math.round(process.uptime()),
  }));

  app.setNotFoundHandler((_request, reply) =>
    reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Rota não encontrada.' } }),
  );

  return app;
}

export type App = ReturnType<typeof buildApp>;
