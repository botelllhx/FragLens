import {
  AnalysisService,
  MatchService,
  ProfileService,
  SteamIdentifierResolver,
  StoreGuard,
} from '@fraglens/core';
import { AppError, createLogger, loadConfig } from '@fraglens/shared';
import type { CommandContext } from './program.js';
import { spinnerEnabled, withSpinner } from './ui/spinner.js';

export interface LocalServices {
  profile: ProfileService;
  matches: MatchService;
  analysis: AnalysisService;
  /** Fecha as conexões abertas; sem isso o processo não termina. */
  close(): Promise<void>;
}

export interface LocalServicesOptions {
  verbose: boolean;
  json?: boolean;
  /** Texto do indicador de carregamento exibido enquanto os serviços trabalham. */
  loading?: string;
}

/**
 * Monta os serviços para execução local (no próprio processo da CLI).
 * Na Fase 10 a CLI passará a chamar a API remota por padrão.
 */
export function createLocalServices(
  ctx: CommandContext,
  options: { verbose: boolean },
): LocalServices {
  const config = loadConfig(ctx.env);
  if (!config.steam.apiKey) {
    throw new AppError('CONFIG_MISSING', 'A chave da Steam API não está configurada.', {
      hints: [
        'Defina STEAM_API_KEY no arquivo .env.',
        'Crie uma chave em https://steamcommunity.com/dev/apikey',
      ],
    });
  }

  // Com --verbose, os logs de processamento vão para o stderr.
  const logger = createLogger({ level: options.verbose ? 'debug' : 'silent' });
  const steam = ctx.createSteamGateway(config.steam.apiKey, logger);
  const resolver = new SteamIdentifierResolver(steam);
  // A conexão só é aberta na primeira consulta ao banco.
  const database = config.databaseUrl ? ctx.connectDatabase(config.databaseUrl) : undefined;
  // Um único acesso ao banco para todos os serviços: se ele cair, o timeout acontece uma vez só.
  const store = new StoreGuard(database?.players, logger);

  const profile = new ProfileService({
    steam,
    resolver,
    store,
    cacheTtlSeconds: config.steam.profileCacheTtlSeconds,
    logger,
  });
  const matches = new MatchService({
    resolver,
    performance: ctx.createPerformanceSource(config.leetify.apiKey, logger),
  });

  return {
    profile,
    matches,
    analysis: new AnalysisService({ resolver, profiles: profile, matches, store }),
    close: async () => {
      await database?.close().catch(() => undefined);
    },
  };
}

/**
 * Executa `fn` com os serviços locais e sempre fecha as conexões ao final.
 * Com `loading`, exibe o indicador de carregamento quando o terminal permite.
 */
export async function withLocalServices<T>(
  ctx: CommandContext,
  options: LocalServicesOptions,
  fn: (services: LocalServices) => Promise<T>,
): Promise<T> {
  const task = async () => {
    const services = createLocalServices(ctx, options);
    try {
      return await fn(services);
    } finally {
      await services.close();
    }
  };

  if (options.loading === undefined) return task();
  return withSpinner(
    options.loading,
    { io: ctx.io, theme: ctx.theme, enabled: spinnerEnabled(ctx.interactive, options) },
    task,
  );
}
