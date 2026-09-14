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

export const MIN_NODE_VERSION = '22.18.0';

export function runDoctor(input: { env: EnvSource; nodeVersion: string }): DoctorReport {
  const checks: CheckResult[] = [checkNodeVersion(input.nodeVersion)];

  const config = tryLoadConfig(input.env, checks);
  if (config) checks.push(...checkConfiguredServices(config));

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

// Por enquanto verifica só se as variáveis existem; os testes de conexão entram nas fases
// em que cada integração for implementada (Steam: Fase 2, banco: Fase 4, IA: Fase 8).
function checkConfiguredServices(config: Config): CheckResult[] {
  return [
    config.steam.apiKey
      ? { id: 'steam-key', label: 'Chave da Steam API configurada', status: 'ok' }
      : {
          id: 'steam-key',
          label: 'Chave da Steam API',
          status: 'warn',
          detail: 'não configurada (STEAM_API_KEY), necessária para consultar perfis',
        },
    config.databaseUrl
      ? { id: 'database-url', label: 'Banco de dados configurado', status: 'ok' }
      : {
          id: 'database-url',
          label: 'Banco de dados',
          status: 'warn',
          detail: 'não configurado (DATABASE_URL)',
        },
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
