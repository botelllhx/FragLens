import { AppError, createLogger, type FetchFn } from '@fraglens/shared';
import { describe, expect, it } from 'vitest';
import { LeetifyClient } from '../src/leetify/client.js';

const STEAM_ID = '76561198034202275';

// Formato real da Leetify Public API (valores fictícios).
function profileBody(overrides: Record<string, unknown> = {}) {
  return {
    privacy_mode: 'public',
    winrate: 0.55,
    total_matches: 480,
    first_match_date: '2022-01-03T16:10:20.000Z',
    name: 'Jogador',
    bans: [],
    steam64_id: STEAM_ID,
    id: '162dcc61-f015-4f92-a446-3537f723c8cc',
    ranks: {
      leetify: 1.37,
      premier: 15234,
      faceit: 8,
      faceit_elo: 1850,
      wingman: null,
      renown: null,
      competitive: [{ map_name: 'de_mirage', rank: 12 }],
    },
    rating: {
      aim: 71.2,
      positioning: 60.1,
      utility: 52.3,
      clutch: 0.11,
      opening: 0.04,
      ct_leetify: 0.02,
      t_leetify: 0.03,
    },
    stats: { accuracy_head: 25.1 },
    recent_matches: [],
    recent_teammates: [],
    ...overrides,
  };
}

function statsRow(overrides: Record<string, unknown> = {}) {
  return {
    steam64_id: STEAM_ID,
    name: 'Jogador',
    mvps: 4,
    total_kills: 16,
    total_deaths: 13,
    kd_ratio: 1.23,
    total_assists: 4,
    total_hs_kills: 13,
    total_damage: 1454,
    dpr: 72.7,
    rounds_count: 20,
    rounds_won: 13,
    rounds_lost: 7,
    rounds_survived: 7,
    multi1k: 6,
    multi2k: 3,
    multi3k: 0,
    multi4k: 1,
    multi5k: 0,
    flash_assist: 2,
    flashbang_thrown: 18,
    flashbang_hit_foe: 12,
    he_thrown: 9,
    molotov_thrown: 8,
    smoke_thrown: 17,
    trade_kill_opportunities: 13,
    trade_kill_attempts: 8,
    trade_kills_succeed: 5,
    traded_death_opportunities: 7,
    traded_death_attempts: 7,
    traded_deaths_succeed: 4,
    leetify_rating: 0.0341,
    ct_leetify_rating: -0.0553,
    t_leetify_rating: 0.0938,
    initial_team_number: 2,
    ...overrides,
  };
}

function matchBody(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    finished_at: '2026-09-08T22:18:06.000Z',
    data_source: 'matchmaking',
    data_source_match_id: 'CSGO-abcde-fghij',
    map_name: 'de_ancient',
    has_banned_player: false,
    team_scores: [
      { team_number: 2, score: 13 },
      { team_number: 3, score: 7 },
    ],
    stats: [statsRow()],
    ...overrides,
  };
}

function fakeLeetify(routes: Record<string, () => Response>, apiKey?: string) {
  const requests: { url: URL; headers: Headers }[] = [];
  const fetch: FetchFn = (url, init) => {
    const parsed = new URL(url);
    requests.push({ url: parsed, headers: new Headers(init.headers) });
    const route = routes[parsed.pathname];
    return Promise.resolve(route ? route() : new Response('Not Found', { status: 404 }));
  };
  const client = new LeetifyClient({
    apiKey,
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

describe('LeetifyClient', () => {
  it('combina perfil e partidas no formato do domínio', async () => {
    const { client } = fakeLeetify({
      '/v3/profile': json(profileBody()),
      '/v3/profile/matches': json([matchBody('m1')]),
    });

    const data = await client.getPlayerPerformance(STEAM_ID);

    expect(data).toMatchObject({
      steamId64: STEAM_ID,
      playerName: 'Jogador',
      privacyMode: 'public',
      totalMatches: 480,
      ranks: { premier: 15234, faceitLevel: 8, faceitElo: 1850, wingman: null },
      ratings: { leetifyRating: 1.37, aim: 71.2, ctRating: 0.02 },
    });
    expect(data?.matches).toHaveLength(1);
    expect(data?.matches[0]).toMatchObject({
      id: 'm1',
      origin: 'matchmaking',
      originMatchId: 'CSGO-abcde-fghij',
      map: 'de_ancient',
      outcome: 'win',
      score: { team: 13, opponent: 7 },
      stats: {
        kills: 16,
        deaths: 13,
        headshotKills: 13,
        damage: 1454,
        roundsPlayed: 20,
        multiKills: { twoKills: 3, fourKills: 1 },
        trades: { tradeKills: 5, tradedDeaths: 4 },
      },
      leetify: { rating: 0.0341, ctRating: -0.0553, tRating: 0.0938 },
    });
  });

  it.each([
    [7, 13, 'loss'],
    [12, 12, 'tie'],
  ])('deriva o resultado dos rounds (%i x %i → %s)', async (won, lost, outcome) => {
    const { client } = fakeLeetify({
      '/v3/profile': json(profileBody()),
      '/v3/profile/matches': json([
        matchBody('m1', { stats: [statsRow({ rounds_won: won, rounds_lost: lost })] }),
      ]),
    });

    const data = await client.getPlayerPerformance(STEAM_ID);

    expect(data?.matches[0]?.outcome).toBe(outcome);
  });

  it('retorna null quando a Leetify não conhece o jogador (404)', async () => {
    const { client } = fakeLeetify({});

    await expect(client.getPlayerPerformance(STEAM_ID)).resolves.toBeNull();
  });

  it('ignora partidas em formato inesperado sem descartar as demais', async () => {
    const { client } = fakeLeetify({
      '/v3/profile': json(profileBody()),
      '/v3/profile/matches': json([
        matchBody('valida'),
        matchBody('sem-kills', { stats: [statsRow({ total_kills: undefined })] }),
        matchBody('outro-jogador', { stats: [statsRow({ steam64_id: '76561198000000001' })] }),
        { lixo: true },
      ]),
    });

    const data = await client.getPlayerPerformance(STEAM_ID);

    expect(data?.matches.map((match) => match.id)).toEqual(['valida']);
  });

  it('aceita ranks e notas ausentes', async () => {
    const { client } = fakeLeetify({
      '/v3/profile': json(profileBody({ ranks: null, rating: null, privacy_mode: undefined })),
      '/v3/profile/matches': json([]),
    });

    const data = await client.getPlayerPerformance(STEAM_ID);

    expect(data?.ranks).toEqual({
      premier: null,
      faceitLevel: null,
      faceitElo: null,
      wingman: null,
    });
    expect(data?.ratings.aim).toBeNull();
    expect(data?.privacyMode).toBeNull();
  });

  it('envia a chave no header Authorization quando configurada', async () => {
    const { client, requests } = fakeLeetify(
      { '/v3/profile': json(profileBody()), '/v3/profile/matches': json([]) },
      'chave-leetify',
    );

    await client.getPlayerPerformance(STEAM_ID);

    expect(requests).toHaveLength(2);
    expect(
      requests.every((request) => request.headers.get('authorization') === 'Bearer chave-leetify'),
    ).toBe(true);
    expect(requests[0]?.url.searchParams.get('steam64_id')).toBe(STEAM_ID);
  });

  it('não envia Authorization sem chave', async () => {
    const { client, requests } = fakeLeetify({
      '/v3/profile': json(profileBody()),
      '/v3/profile/matches': json([]),
    });

    await client.getPlayerPerformance(STEAM_ID);

    expect(requests[0]?.headers.has('authorization')).toBe(false);
  });

  it('chave recusada vira UNAUTHORIZED', async () => {
    const { client } = fakeLeetify(
      { '/v3/profile': json({}, 401), '/v3/profile/matches': json({}, 401) },
      'chave-invalida',
    );

    const error = await captureError(client.getPlayerPerformance(STEAM_ID));

    expect(error.code).toBe('UNAUTHORIZED');
    expect(error.hints.join(' ')).toContain('LEETIFY_API_KEY');
  });

  it('sem chave, o erro de limite sugere configurar LEETIFY_API_KEY', async () => {
    const { client } = fakeLeetify({
      '/v3/profile': json({}, 429),
      '/v3/profile/matches': json({}, 429),
    });

    const error = await captureError(client.getPlayerPerformance(STEAM_ID));

    expect(error.code).toBe('RATE_LIMITED');
    expect(error.hints.join(' ')).toContain('LEETIFY_API_KEY');
  });
});
