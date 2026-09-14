import { AppError, createLogger, type FetchFn } from '@fraglens/shared';
import { describe, expect, it } from 'vitest';
import { SteamWebApiClient } from '../src/client.js';

const STEAM_ID = '76561198034202275';

// Respostas no formato real da Steam Web API (valores fictícios).
const fixtures = {
  vanityFound: { response: { steamid: STEAM_ID, success: 1 } },
  vanityNoMatch: { response: { success: 42, message: 'No match' } },
  publicSummary: {
    response: {
      players: [
        {
          steamid: STEAM_ID,
          communityvisibilitystate: 3,
          profilestate: 1,
          personaname: 'Jogador',
          profileurl: 'https://steamcommunity.com/id/jogador/',
          avatar: 'https://avatars.steamstatic.com/abc.jpg',
          avatarfull: 'https://avatars.steamstatic.com/abc_full.jpg',
          personastate: 0,
          timecreated: 1290864008,
          loccountrycode: 'BR',
        },
      ],
    },
  },
  friendsOnlySummary: {
    response: {
      players: [
        {
          steamid: STEAM_ID,
          communityvisibilitystate: 2,
          profilestate: 1,
          personaname: 'Reservado',
          profileurl: 'https://steamcommunity.com/profiles/76561198034202275/',
          avatarfull: 'https://avatars.steamstatic.com/def_full.jpg',
          personastate: 0,
        },
      ],
    },
  },
  noPlayers: { response: { players: [] } },
  bans: {
    players: [
      {
        SteamId: STEAM_ID,
        CommunityBanned: false,
        VACBanned: true,
        NumberOfVACBans: 1,
        DaysSinceLastBan: 120,
        NumberOfGameBans: 2,
        EconomyBan: 'none',
      },
    ],
  },
  noBans: {
    players: [
      {
        SteamId: STEAM_ID,
        CommunityBanned: false,
        VACBanned: false,
        NumberOfVACBans: 0,
        DaysSinceLastBan: 0,
        NumberOfGameBans: 0,
        EconomyBan: 'none',
      },
    ],
  },
  ownedGames: {
    response: {
      game_count: 1,
      games: [{ appid: 730, playtime_2weeks: 1459, playtime_forever: 923243 }],
    },
  },
  ownedGamesNotRecent: {
    response: { game_count: 1, games: [{ appid: 730, playtime_forever: 378 }] },
  },
  ownedGamesPrivate: { response: {} },
};

function fakeSteam(routes: Record<string, () => Response>) {
  const requests: URL[] = [];
  const fetch: FetchFn = (url) => {
    const parsed = new URL(url);
    requests.push(parsed);
    const route = routes[parsed.pathname];
    return Promise.resolve(route ? route() : new Response('Not Found', { status: 404 }));
  };

  const client = new SteamWebApiClient({
    apiKey: 'CHAVE-DE-TESTE',
    logger: createLogger({ level: 'silent' }),
    fetch,
    http: { sleep: () => Promise.resolve(), minIntervalMs: 0 },
  });
  return { client, requests };
}

const json =
  (body: unknown, status = 200) =>
  () =>
    new Response(JSON.stringify(body), { status });

async function captureError(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
  throw new Error('Era esperado um AppError');
}

describe('SteamWebApiClient', () => {
  describe('resolveVanity', () => {
    it('retorna a SteamID64 e envia chave e vanity na query', async () => {
      const { client, requests } = fakeSteam({
        '/ISteamUser/ResolveVanityURL/v1/': json(fixtures.vanityFound),
      });

      await expect(client.resolveVanity('jogador')).resolves.toBe(STEAM_ID);
      expect(requests[0]?.searchParams.get('vanityurl')).toBe('jogador');
      expect(requests[0]?.searchParams.get('key')).toBe('CHAVE-DE-TESTE');
    });

    it('retorna null quando a URL personalizada não existe (success 42)', async () => {
      const { client } = fakeSteam({
        '/ISteamUser/ResolveVanityURL/v1/': json(fixtures.vanityNoMatch),
      });

      await expect(client.resolveVanity('inexistente')).resolves.toBeNull();
    });
  });

  describe('getPlayerSummary', () => {
    it('converte o perfil público', async () => {
      const { client } = fakeSteam({
        '/ISteamUser/GetPlayerSummaries/v2/': json(fixtures.publicSummary),
      });

      await expect(client.getPlayerSummary(STEAM_ID)).resolves.toEqual({
        steamId64: STEAM_ID,
        personaName: 'Jogador',
        profileUrl: 'https://steamcommunity.com/id/jogador/',
        avatarUrl: 'https://avatars.steamstatic.com/abc_full.jpg',
        visibility: 'public',
        countryCode: 'BR',
        accountCreatedAt: '2010-11-27T13:20:08.000Z',
      });
    });

    it('perfil somente para amigos não traz país nem data de criação', async () => {
      const { client } = fakeSteam({
        '/ISteamUser/GetPlayerSummaries/v2/': json(fixtures.friendsOnlySummary),
      });

      const summary = await client.getPlayerSummary(STEAM_ID);

      expect(summary).toMatchObject({
        visibility: 'friends-only',
        countryCode: null,
        accountCreatedAt: null,
      });
    });

    it('retorna null quando a conta não existe', async () => {
      const { client } = fakeSteam({
        '/ISteamUser/GetPlayerSummaries/v2/': json(fixtures.noPlayers),
      });

      await expect(client.getPlayerSummary(STEAM_ID)).resolves.toBeNull();
    });
  });

  describe('getBanStatus', () => {
    it('converte os banimentos', async () => {
      const { client } = fakeSteam({ '/ISteamUser/GetPlayerBans/v1/': json(fixtures.bans) });

      await expect(client.getBanStatus(STEAM_ID)).resolves.toEqual({
        vacBanned: true,
        vacBanCount: 1,
        gameBanCount: 2,
        communityBanned: false,
        economyBan: 'none',
        daysSinceLastBan: 120,
      });
    });

    it('ignora DaysSinceLastBan quando não há banimentos', async () => {
      const { client } = fakeSteam({ '/ISteamUser/GetPlayerBans/v1/': json(fixtures.noBans) });

      const bans = await client.getBanStatus(STEAM_ID);

      expect(bans?.daysSinceLastBan).toBeNull();
    });
  });

  describe('getCs2Playtime', () => {
    it('converte minutos em horas e filtra pelo CS2', async () => {
      const { client, requests } = fakeSteam({
        '/IPlayerService/GetOwnedGames/v1/': json(fixtures.ownedGames),
      });

      await expect(client.getCs2Playtime(STEAM_ID)).resolves.toEqual({
        visible: true,
        totalHours: 15387.4,
        lastTwoWeeksHours: 24.3,
      });
      expect(requests[0]?.searchParams.get('appids_filter[0]')).toBe('730');
    });

    it('considera 0 hora nas últimas 2 semanas quando o campo não vem', async () => {
      const { client } = fakeSteam({
        '/IPlayerService/GetOwnedGames/v1/': json(fixtures.ownedGamesNotRecent),
      });

      await expect(client.getCs2Playtime(STEAM_ID)).resolves.toEqual({
        visible: true,
        totalHours: 6.3,
        lastTwoWeeksHours: 0,
      });
    });

    it('marca como não visível quando os detalhes de jogos são privados', async () => {
      const { client } = fakeSteam({
        '/IPlayerService/GetOwnedGames/v1/': json(fixtures.ownedGamesPrivate),
      });

      await expect(client.getCs2Playtime(STEAM_ID)).resolves.toEqual({
        visible: false,
        totalHours: null,
        lastTwoWeeksHours: null,
      });
    });
  });

  describe('erros', () => {
    it('chave recusada (403) vira UNAUTHORIZED, sem repetir a requisição', async () => {
      const { client, requests } = fakeSteam({
        '/ISteamUser/GetPlayerSummaries/v2/': () =>
          new Response('<html><body>Access is denied.</body></html>', { status: 403 }),
      });

      const error = await captureError(client.getPlayerSummary(STEAM_ID));

      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.hints.join(' ')).toContain('STEAM_API_KEY');
      expect(requests).toHaveLength(1);
    });

    it('resposta fora do formato esperado vira UPSTREAM_ERROR', async () => {
      const { client } = fakeSteam({
        '/ISteamUser/GetPlayerSummaries/v2/': json({ response: { jogadores: [] } }),
      });

      const error = await captureError(client.getPlayerSummary(STEAM_ID));

      expect(error.code).toBe('UPSTREAM_ERROR');
    });
  });
});
