import { AppError, type Logger } from '@fraglens/shared';
import type { PlayerStore, SyncJobResult, SyncJobType } from './ports.js';

/**
 * Acesso ao banco compartilhado pelos serviços, em dois modos:
 *
 * - `attempt`: operação opcional (cache, registro de jobs). Falhas vão para o log e não derrubam
 *   a consulta. Depois da primeira falha, as seguintes são ignoradas nesta execução, porque cada
 *   tentativa esperaria o timeout de conexão.
 * - `require`: operação essencial (comandos `cache` e `refresh`). Exige banco configurado e
 *   converte falhas em DATABASE_UNAVAILABLE.
 */
export class StoreGuard {
  private available = true;

  constructor(
    private readonly store: PlayerStore | undefined,
    private readonly logger?: Logger,
  ) {}

  get configured(): boolean {
    return this.store !== undefined;
  }

  async attempt<T>(
    operation: string,
    fn: (store: PlayerStore) => Promise<T>,
  ): Promise<T | undefined> {
    if (!this.store || !this.available) return undefined;
    try {
      return await fn(this.store);
    } catch (error) {
      this.available = false;
      this.logger?.warn({ operation, err: error }, 'database.unavailable');
      return undefined;
    }
  }

  async require<T>(fn: (store: PlayerStore) => Promise<T>): Promise<T> {
    const store = this.requireConfigured();
    try {
      return await fn(store);
    } catch (error) {
      throw new AppError('DATABASE_UNAVAILABLE', 'Não foi possível acessar o banco de dados.', {
        hints: [
          'Verifique se o PostgreSQL está rodando (pnpm db:up) e se DATABASE_URL está correto.',
          'Rode fraglens doctor para um diagnóstico.',
        ],
        cause: error,
      });
    }
  }

  requireConfigured(): PlayerStore {
    if (!this.store) {
      throw new AppError('CONFIG_MISSING', 'O banco de dados não está configurado.', {
        hints: [
          'Defina DATABASE_URL no arquivo .env.',
          'Ambiente local: pnpm db:up e depois pnpm db:migrate.',
        ],
      });
    }
    return this.store;
  }

  /** Executa `task` registrando um job de sincronização; sem banco, apenas executa. */
  async trackJob<T>(steamId64: string, type: SyncJobType, task: () => Promise<T>): Promise<T> {
    const jobId = await this.attempt('sync_job.start', (store) =>
      store.startSyncJob(steamId64, type),
    );

    try {
      const result = await task();
      await this.finishJob(jobId, { status: 'succeeded' });
      return result;
    } catch (error) {
      await this.finishJob(jobId, {
        status: 'failed',
        errorCode: error instanceof AppError ? error.code : 'INTERNAL',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async finishJob(jobId: string | undefined, result: SyncJobResult): Promise<void> {
    if (jobId === undefined) return;
    await this.attempt('sync_job.finish', (store) => store.finishSyncJob(jobId, result));
  }
}
