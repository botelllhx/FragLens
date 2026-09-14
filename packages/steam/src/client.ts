import type {
  Cs2Playtime,
  ProfileVisibility,
  SteamBanStatus,
  SteamGateway,
  SteamPlayerSummary,
} from '@fraglens/core';
import {
  AppError,
  HttpClient,
  HttpStatusError,
  type FetchFn,
  type HttpClientOptions,
  type Logger,
  type QueryParams,
} from '@fraglens/shared';
import type { ZodType } from 'zod';
import {
  ownedGamesSchema,
  playerBansSchema,
  playerSummariesSchema,
  resolveVanitySchema,
} from './schemas.js';

export const STEAM_API_BASE_URL = 'https://api.steampowered.com/';
export const CS2_APP_ID = 730;

// Valores de `communityvisibilitystate` observados: 1 privado, 2 somente amigos, 3 público.
const VISIBILITY: Readonly<Record<number, ProfileVisibility>> = {
  1: 'private',
  2: 'friends-only',
  3: 'public',
};

const RESOLVE_VANITY_SUCCESS = 1;
const RESOLVE_VANITY_NO_MATCH = 42;

export interface SteamWebApiClientOptions {
  apiKey: string;
  logger: Logger;
  fetch?: FetchFn;
  http?: Partial<
    Pick<HttpClientOptions, 'timeoutMs' | 'maxAttempts' | 'minIntervalMs' | 'sleep' | 'now'>
  >;
}

export class SteamWebApiClient implements SteamGateway {
  private readonly apiKey: string;
  private readonly http: HttpClient;

  constructor(options: SteamWebApiClientOptions) {
    this.apiKey = options.apiKey;
    this.http = new HttpClient({
      source: 'Steam',
      baseUrl: STEAM_API_BASE_URL,
      logger: options.logger,
      fetch: options.fetch,
      minIntervalMs: 100,
      ...options.http,
    });
  }

  async resolveVanity(vanity: string): Promise<string | null> {
    const { response } = await this.call(
      'ISteamUser/ResolveVanityURL/v1/',
      { vanityurl: vanity },
      resolveVanitySchema,
    );

    if (response.success === RESOLVE_VANITY_SUCCESS && response.steamid) return response.steamid;
    if (response.success === RESOLVE_VANITY_NO_MATCH) return null;
    throw new AppError(
      'UPSTREAM_ERROR',
      `Steam: não foi possível resolver a URL personalizada (código ${response.success}).`,
    );
  }

  async getPlayerSummary(steamId64: string): Promise<SteamPlayerSummary | null> {
    const { response } = await this.call(
      'ISteamUser/GetPlayerSummaries/v2/',
      { steamids: steamId64 },
      playerSummariesSchema,
    );

    const player = response.players.find((candidate) => candidate.steamid === steamId64);
    if (!player) return null;

    return {
      steamId64: player.steamid,
      personaName: player.personaname,
      profileUrl: player.profileurl,
      avatarUrl: player.avatarfull,
      visibility: VISIBILITY[player.communityvisibilitystate] ?? 'private',
      countryCode: player.loccountrycode ?? null,
      accountCreatedAt: player.timecreated
        ? new Date(player.timecreated * 1000).toISOString()
        : null,
    };
  }

  async getBanStatus(steamId64: string): Promise<SteamBanStatus | null> {
    const { players } = await this.call(
      'ISteamUser/GetPlayerBans/v1/',
      { steamids: steamId64 },
      playerBansSchema,
    );

    const bans = players.find((candidate) => candidate.SteamId === steamId64);
    if (!bans) return null;

    const hasBans = bans.NumberOfVACBans > 0 || bans.NumberOfGameBans > 0;
    return {
      vacBanned: bans.VACBanned,
      vacBanCount: bans.NumberOfVACBans,
      gameBanCount: bans.NumberOfGameBans,
      communityBanned: bans.CommunityBanned,
      economyBan: bans.EconomyBan,
      // A Steam retorna 0 também para quem nunca foi banido.
      daysSinceLastBan: hasBans ? bans.DaysSinceLastBan : null,
    };
  }

  async getCs2Playtime(steamId64: string): Promise<Cs2Playtime> {
    const { response } = await this.call(
      'IPlayerService/GetOwnedGames/v1/',
      { steamid: steamId64, include_played_free_games: 1, 'appids_filter[0]': CS2_APP_ID },
      ownedGamesSchema,
    );

    // Resposta vazia: os detalhes de jogos do perfil não são públicos.
    if (response.game_count === undefined) {
      return { visible: false, totalHours: null, lastTwoWeeksHours: null };
    }

    const cs2 = response.games?.find((game) => game.appid === CS2_APP_ID);
    return {
      visible: true,
      totalHours: minutesToHours(cs2?.playtime_forever ?? 0),
      lastTwoWeeksHours: minutesToHours(cs2?.playtime_2weeks ?? 0),
    };
  }

  private async call<T>(path: string, query: QueryParams, schema: ZodType<T>): Promise<T> {
    let body: unknown;
    try {
      body = await this.http.getJson(path, { ...query, key: this.apiKey });
    } catch (error) {
      if (error instanceof HttpStatusError && (error.status === 401 || error.status === 403)) {
        throw new AppError('UNAUTHORIZED', 'Steam: a chave de API foi recusada.', {
          hints: [
            'Confira o valor de STEAM_API_KEY no arquivo .env.',
            'Gere uma nova chave em https://steamcommunity.com/dev/apikey',
          ],
          cause: error,
        });
      }
      throw error;
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new AppError('UPSTREAM_ERROR', 'Steam: resposta em formato inesperado.', {
        cause: parsed.error,
      });
    }
    return parsed.data;
  }
}

function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 10) / 10;
}
