import type { SteamGateway } from '@fraglens/core';
import type { Database } from '@fraglens/db';
import { AppError, loadConfig, type Config, type EnvSource } from '@fraglens/shared';

export type CheckStatus = 'ok' | 'warn' | 'fail';

export interface CheckResult {
  id: string;
  label: string;
  status: CheckStatus;
  detail?: string;
}

export interface DoctorReport {
  ready: boolean;
  checks: CheckResult[];
}

export interface DoctorInput {
  env: EnvSource;
  nodeVersion: string;
  createSteamGateway: (apiKey: string) => Pick<SteamGateway, 'getPlayerSummary'>;
  connectDatabase: (databaseUrl: string) => Pick<Database, 'checkHealth' | 'close'>;
}

export const MIN_NODE_VERSION = '22.18.0';

// Qualquer conta existente serve: a consulta só confirma que a chave é aceita e a API responde.
export const STEAM_PROBE_ID = '76561197960287930';

export async function runDoctor(input: DoctorInput): Promise<DoctorReport> {
  const checks: CheckResult[] = [checkNodeVersion(input.nodeVersion)];

  const config = tryLoadConfig(input.env, checks);
  if (config) {
    const [steam, database] = await Promise.all([
      checkSteamApi(config, input.createSteamGateway),
      checkDatabase(config, input.connectDatabase),
    ]);
    checks.push(steam, database, ...checkOptionalServices(config));
  }

  return { ready: checks.every((check) => check.status !== 'fail'), checks };
}

export function checkNodeVersion(version: string): CheckResult {
  const label = `Node.js ${version.replace(/^v/, '')}`;
  return compareVersions(version, MIN_NODE_VERSION) >= 0
    ? { id: 'node', label, status: 'ok' }
    : { id: 'node', label, status: 'fail', detail: `versão mínima: ${MIN_NODE_VERSION}` };
}

function tryLoadConfig(env: EnvSource, checks: CheckResult[]): Config | undefined {
  try {
    const config = loadConfig(env);
    checks.push({ id: 'config', label: 'Configuração', status: 'ok' });
    return config;
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    checks.push({
      id: 'config',
      label: 'Configuração',
      status: 'fail',
      detail: [error.message, ...error.hints].join(' '),
    });
    return undefined;
  }
}

async function checkSteamApi(
  config: Config,
  createSteamGateway: DoctorInput['createSteamGateway'],
): Promise<CheckResult> {
  if (!config.steam.apiKey) {
    return {
      id: 'steam-api',
      label: 'Steam API',
      status: 'warn',
      detail: 'chave não configurada (STEAM_API_KEY), necessária para consultar perfis',
    };
  }

  try {
    await createSteamGateway(config.steam.apiKey).getPlayerSummary(STEAM_PROBE_ID);
    return { id: 'steam-api', label: 'Steam API acessível', status: 'ok' };
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    return {
      id: 'steam-api',
      label: 'Steam API',
      status: 'fail',
      detail:
        error.code === 'UNAUTHORIZED'
          ? 'a chave foi recusada, confira STEAM_API_KEY'
          : error.message,
    };
  }
}

async function checkDatabase(
  config: Config,
  connectDatabase: DoctorInput['connectDatabase'],
): Promise<CheckResult> {
  if (!config.databaseUrl) {
    return {
      id: 'database',
      label: 'Banco de dados',
      status: 'warn',
      detail: 'não configurado (DATABASE_URL), o cache do perfil fica desativado',
    };
  }

  const database = connectDatabase(config.databaseUrl);
  try {
    const { pendingMigrations } = await database.checkHealth();
    if (pendingMigrations.length > 0) {
      return {
        id: 'database',
        label: 'Banco de dados',
        status: 'fail',
        detail: `${pendingMigrations.length} migration(s) pendente(s), rode pnpm db:migrate`,
      };
    }
    return { id: 'database', label: 'Banco de dados conectado (migrations em dia)', status: 'ok' };
  } catch {
    return {
      id: 'database',
      label: 'Banco de dados',
      status: 'fail',
      detail: 'não foi possível conectar, confira DATABASE_URL e se o PostgreSQL está rodando',
    };
  } finally {
    await database.close().catch(() => undefined);
  }
}

// IA (Fase 8) ainda não tem teste de conexão; a Leetify funciona sem chave.
function checkOptionalServices(config: Config): CheckResult[] {
  return [
    config.leetify.apiKey
      ? { id: 'leetify-key', label: 'Chave da Leetify configurada', status: 'ok' }
      : {
          id: 'leetify-key',
          label: 'Chave da Leetify',
          status: 'warn',
          detail: 'não configurada (LEETIFY_API_KEY), funciona sem chave, com limites menores',
        },
    {
      id: 'ai',
      label: 'Provedor de IA',
      status: 'warn',
      detail: 'não configurado, as análises serão geradas sem IA',
    },
  ];
}

function compareVersions(a: string, b: string): number {
  const parse = (version: string) =>
    version
      .replace(/^v/, '')
      .split('.')
      .map((part) => Number.parseInt(part, 10) || 0);
  const [left, right] = [parse(a), parse(b)];

  for (let index = 0; index < 3; index++) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}
