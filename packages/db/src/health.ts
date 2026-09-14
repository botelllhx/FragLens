import { readdir } from 'node:fs/promises';
import type { PrismaClient } from './generated/prisma/client.js';

export interface DatabaseHealth {
  appliedMigrations: number;
  pendingMigrations: string[];
}

// Mesmo caminho a partir de src/ (desenvolvimento) e de dist/ (build).
const MIGRATIONS_DIR = new URL('../prisma/migrations/', import.meta.url);

export async function listProjectMigrations(): Promise<string[]> {
  const entries = await readdir(MIGRATIONS_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/**
 * Conecta ao banco e compara as migrations do projeto com as aplicadas.
 * Lança o erro original quando não é possível conectar.
 */
export async function checkDatabaseHealth(prisma: PrismaClient): Promise<DatabaseHealth> {
  const [expected, applied] = await Promise.all([
    listProjectMigrations(),
    appliedMigrationNames(prisma),
  ]);
  return {
    appliedMigrations: applied.size,
    pendingMigrations: expected.filter((name) => !applied.has(name)),
  };
}

async function appliedMigrationNames(prisma: PrismaClient): Promise<Set<string>> {
  const table = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS "exists"`;
  if (!table[0]?.exists) return new Set();

  const rows = await prisma.$queryRaw<{ migration_name: string }[]>`
    SELECT migration_name FROM _prisma_migrations
    WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
  return new Set(rows.map((row) => row.migration_name));
}
