import { AppError } from '@fraglens/shared';
import type { SteamGateway } from './ports.js';
import { parseSteamIdentifier } from './steam-id.js';

/**
 * Único ponto do sistema que converte o identificador informado pelo usuário
 * (SteamID64, Steam2/Steam3, URL ou nome de usuário) em SteamID64.
 */
export class SteamIdentifierResolver {
  private readonly steam: Pick<SteamGateway, 'resolveVanity'>;

  constructor(steam: Pick<SteamGateway, 'resolveVanity'>) {
    this.steam = steam;
  }

  async resolve(input: string): Promise<string> {
    const identifier = parseSteamIdentifier(input);
    if (identifier.kind === 'steamId64') return identifier.steamId64;

    const steamId64 = await this.steam.resolveVanity(identifier.vanity);
    if (steamId64 === null) {
      throw new AppError(
        'NOT_FOUND',
        `Nenhum perfil Steam encontrado para "${identifier.vanity}".`,
        {
          hints: [
            'Confira se o nome é o mesmo da URL do perfil (steamcommunity.com/id/<nome>).',
            'Se o perfil não tem URL personalizada, use a SteamID64 ou a URL /profiles/.',
          ],
        },
      );
    }
    return steamId64;
  }
}
