import { z } from 'zod';

// Formatos conferidos com respostas reais da Leetify Public API em 14/09/2026.
// Campos não usados pelo FragLens são descartados pelo Zod.

const optionalNumber = z.number().nullish();

export const leetifyProfileSchema = z.object({
  name: z.string(),
  privacy_mode: z.string().nullish(),
  total_matches: optionalNumber,
  ranks: z
    .object({
      leetify: optionalNumber,
      premier: optionalNumber,
      faceit: optionalNumber,
      faceit_elo: optionalNumber,
      wingman: optionalNumber,
    })
    .nullish(),
  rating: z
    .object({
      aim: optionalNumber,
      positioning: optionalNumber,
      utility: optionalNumber,
      clutch: optionalNumber,
      opening: optionalNumber,
      ct_leetify: optionalNumber,
      t_leetify: optionalNumber,
    })
    .nullish(),
});

export const leetifyPlayerStatsSchema = z.object({
  steam64_id: z.string(),
  total_kills: z.number(),
  total_deaths: z.number(),
  total_assists: z.number(),
  total_hs_kills: z.number(),
  total_damage: z.number(),
  rounds_count: z.number(),
  rounds_won: z.number(),
  rounds_lost: z.number(),
  rounds_survived: z.number(),
  mvps: z.number(),
  multi2k: z.number(),
  multi3k: z.number(),
  multi4k: z.number(),
  multi5k: z.number(),
  flash_assist: z.number(),
  flashbang_thrown: z.number(),
  flashbang_hit_foe: z.number(),
  he_thrown: z.number(),
  molotov_thrown: z.number(),
  smoke_thrown: z.number(),
  trade_kill_opportunities: z.number(),
  trade_kill_attempts: z.number(),
  trade_kills_succeed: z.number(),
  traded_death_opportunities: z.number(),
  traded_death_attempts: z.number(),
  traded_deaths_succeed: z.number(),
  leetify_rating: optionalNumber,
  ct_leetify_rating: optionalNumber,
  t_leetify_rating: optionalNumber,
});

export const leetifyMatchSchema = z.object({
  id: z.string(),
  finished_at: z.iso.datetime(),
  data_source: z.string(),
  data_source_match_id: z.string().nullish(),
  map_name: z.string(),
  has_banned_player: z.boolean().nullish(),
  stats: z.array(leetifyPlayerStatsSchema),
});

export type LeetifyProfile = z.output<typeof leetifyProfileSchema>;
export type LeetifyPlayerStats = z.output<typeof leetifyPlayerStatsSchema>;
export type LeetifyMatch = z.output<typeof leetifyMatchSchema>;
