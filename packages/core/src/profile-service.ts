import { AppError } from '@fraglens/shared';
import type { SteamIdentifierResolver } from './identifier-resolver.js';
import type { SteamGateway } from './ports.js';
import type { PlayerProfile } from './profile.js';

export interface ProfileServiceDeps {
  steam: SteamGateway;
  resolver: SteamIdentifierResolver;
  now?: () => Date;
}

export class ProfileService {
  private readonly steam: SteamGateway;
  private readonly resolver: SteamIdentifierResolver;
  private readonly now: () => Date;

  constructor(deps: ProfileServiceDeps) {
    this.steam = deps.steam;
    this.resolver = deps.resolver;
    this.now = deps.now ?? (() => new Date());
  }

  async getProfile(input: string): Promise<PlayerProfile> {
    const steamId64 = await this.resolver.resolve(input);

    const [summary, bans, cs2] = await Promise.all([
      this.steam.getPlayerSummary(steamId64),
      this.steam.getBanStatus(steamId64),
      this.steam.getCs2Playtime(steamId64),
    ]);

    if (!summary) {
      throw new AppError('NOT_FOUND', 'Perfil Steam não encontrado.', {
        hints: [`Nenhuma conta Steam corresponde à SteamID64 ${steamId64}.`],
      });
    }

    return { steamId64, summary, bans, cs2, fetchedAt: this.now().toISOString() };
  }
}
