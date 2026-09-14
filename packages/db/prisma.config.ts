import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// O Prisma 7 não carrega arquivos .env sozinho: usamos o .env da raiz do monorepo, se existir.
// Variáveis já definidas no ambiente (ex.: CI, Render) têm prioridade.
const rootEnvFile = new URL('../../.env', import.meta.url);
if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // `prisma generate` não precisa de banco; só migrate/studio usam a URL.
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
