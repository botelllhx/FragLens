import type { PlayerStore } from '@fraglens/core';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { checkDatabaseHealth, type DatabaseHealth } from './health.js';
import { PrismaPlayerStore } from './player-store.js';

export interface Database {
  players: PlayerStore;
  checkHealth(): Promise<DatabaseHealth>;
  /** Encerra as conexões; sem isso o processo da CLI não termina. */
  close(): Promise<void>;
}

// Evita que um banco inacessível trave a CLI por muito tempo.
const CONNECTION_TIMEOUT_MS = 5_000;

export function connectDatabase(databaseUrl: string): Database {
  const adapter = new PrismaPg({
    connectionString: databaseUrl,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
  });
  const prisma = new PrismaClient({ adapter });

  return {
    players: new PrismaPlayerStore(prisma),
    checkHealth: () => checkDatabaseHealth(prisma),
    close: () => prisma.$disconnect(),
  };
}
