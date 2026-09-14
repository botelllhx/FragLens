import { createRequire } from 'node:module';
import { AppError, createLogger, loadConfig, loadEnvFile } from '@fraglens/shared';
import { buildApp } from './app.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };

async function main(): Promise<void> {
  loadEnvFile();
  const config = loadConfig();
  const logger = createLogger({ level: config.logLevel });
  const app = buildApp({ logger, version });

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      app.log.info({ signal }, 'server.shutdown');
      void app.close().then(() => process.exit(0));
    });
  }

  await app.listen({ host: config.server.host, port: config.server.port });
  app.log.info({ version, port: config.server.port }, 'server.start');
}

main().catch((error: unknown) => {
  if (error instanceof AppError) {
    process.stderr.write(
      `${error.message}\n${error.hints.map((hint) => `- ${hint}`).join('\n')}\n`,
    );
  } else {
    process.stderr.write(`Falha ao iniciar a API: ${String(error)}\n`);
  }
  process.exit(1);
});
