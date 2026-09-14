import { z } from 'zod';
import { AppError } from './errors.js';

// Linhas como `STEAM_API_KEY=` no .env chegam como string vazia e significam "não configurado".
function emptyToUndefined(value: unknown): unknown {
  return typeof value === 'string' && value.trim() === '' ? undefined : value;
}

function fromEnv<T extends z.ZodType>(schema: T) {
  return z.preprocess(emptyToUndefined, schema);
}

const secret = fromEnv(z.string().trim().min(1).optional());
const ttlSeconds = (fallback: number) => fromEnv(z.coerce.number().int().min(0).default(fallback));

const envSchema = z.object({
  NODE_ENV: fromEnv(z.enum(['development', 'test', 'production']).default('development')),
  LOG_LEVEL: fromEnv(
    z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  ),
  HOST: fromEnv(z.string().default('0.0.0.0')),
  PORT: fromEnv(z.coerce.number().int().min(1).max(65_535).default(3000)),
  DATABASE_URL: fromEnv(
    z
      .string()
      .regex(/^postgres(ql)?:\/\//, 'Deve começar com postgres:// ou postgresql://')
      .optional(),
  ),
  STEAM_API_KEY: secret,
  LEETIFY_API_KEY: secret,
  STEAM_PROFILE_CACHE_TTL: ttlSeconds(86_400),
  // Provedores reais de IA entram na Fase 8.
  AI_PROVIDER: fromEnv(z.enum(['none']).default('none')),
  AI_API_KEY: secret,
  AI_MODEL: secret,
});

type Env = z.output<typeof envSchema>;

export type LogLevel = Env['LOG_LEVEL'];

export interface Config {
  nodeEnv: Env['NODE_ENV'];
  logLevel: LogLevel;
  server: { host: string; port: number };
  databaseUrl: string | undefined;
  steam: { apiKey: string | undefined; profileCacheTtlSeconds: number };
  leetify: { apiKey: string | undefined };
  ai: { provider: Env['AI_PROVIDER']; apiKey: string | undefined; model: string | undefined };
}

export type EnvSource = Readonly<Record<string, string | undefined>>;

/** Valida as variáveis de ambiente e as converte na configuração tipada da aplicação. */
export function loadConfig(source: EnvSource = process.env): Config {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new AppError('CONFIG_INVALID', 'Configuração inválida.', {
      hints: result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    });
  }

  const env = result.data;
  return {
    nodeEnv: env.NODE_ENV,
    logLevel: env.LOG_LEVEL,
    server: { host: env.HOST, port: env.PORT },
    databaseUrl: env.DATABASE_URL,
    steam: { apiKey: env.STEAM_API_KEY, profileCacheTtlSeconds: env.STEAM_PROFILE_CACHE_TTL },
    leetify: { apiKey: env.LEETIFY_API_KEY },
    ai: { provider: env.AI_PROVIDER, apiKey: env.AI_API_KEY, model: env.AI_MODEL },
  };
}

/** Carrega um arquivo .env, se existir. Retorna `false` quando o arquivo não existe. */
export function loadEnvFile(path = '.env'): boolean {
  try {
    process.loadEnvFile(path);
    return true;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false;
    throw error;
  }
}
