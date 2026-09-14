import { z } from 'zod';

// Formatos conferidos com respostas reais da Steam Web API em 14/09/2026.
// Campos não usados são descartados pelo Zod.

export const resolveVanitySchema = z.object({
  response: z.object({
    success: z.number(),
    steamid: z.string().optional(),
    message: z.string().optional(),
  }),
});

export const playerSummariesSchema = z.object({
  response: z.object({
    players: z.array(
      z.object({
        steamid: z.string(),
        communityvisibilitystate: z.number(),
        personaname: z.string(),
        profileurl: z.string(),
        avatarfull: z.string(),
        // Presentes apenas em perfis públicos.
        timecreated: z.number().optional(),
        loccountrycode: z.string().optional(),
      }),
    ),
  }),
});

export const playerBansSchema = z.object({
  players: z.array(
    z.object({
      SteamId: z.string(),
      CommunityBanned: z.boolean(),
      VACBanned: z.boolean(),
      NumberOfVACBans: z.number(),
      DaysSinceLastBan: z.number(),
      NumberOfGameBans: z.number(),
      EconomyBan: z.string(),
    }),
  ),
});

export const ownedGamesSchema = z.object({
  // `{}` quando os detalhes de jogos do perfil não são públicos.
  response: z.object({
    game_count: z.number().optional(),
    games: z
      .array(
        z.object({
          appid: z.number(),
          playtime_forever: z.number(),
          // Ausente quando o jogo não foi jogado nas últimas 2 semanas.
          playtime_2weeks: z.number().optional(),
        }),
      )
      .optional(),
  }),
});
