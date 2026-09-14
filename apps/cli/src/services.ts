import { ProfileService, SteamIdentifierResolver } from '@fraglens/core';
import { AppError, createLogger, loadConfig } from '@fraglens/shared';
import type { CommandContext } from './program.js';

export interface LocalServices {
  profile: ProfileService;
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

  return {
    profile: new ProfileService({ steam, resolver: new SteamIdentifierResolver(steam) }),
  };
}
