export type ProfileVisibility = 'public' | 'friends-only' | 'private';

export interface SteamPlayerSummary {
  steamId64: string;
  personaName: string;
  profileUrl: string;
  avatarUrl: string;
  visibility: ProfileVisibility;
  /** Só é informado pela Steam em perfis públicos. */
  countryCode: string | null;
  /** ISO 8601. Só é informado pela Steam em perfis públicos. */
  accountCreatedAt: string | null;
}

export interface SteamBanStatus {
  vacBanned: boolean;
  vacBanCount: number;
  gameBanCount: number;
  communityBanned: boolean;
  /** Valor informado pela Steam: "none", "probation" ou "banned". */
  economyBan: string;
  /** `null` quando não há banimentos VAC ou de jogo. */
  daysSinceLastBan: number | null;
}

export interface Cs2Playtime {
  /** `false` quando os detalhes de jogos do perfil não são públicos. */
  visible: boolean;
  totalHours: number | null;
  lastTwoWeeksHours: number | null;
}

export interface PlayerProfile {
  steamId64: string;
  summary: SteamPlayerSummary;
  bans: SteamBanStatus | null;
  cs2: Cs2Playtime;
  /** Versão do formato do perfil (ver PROFILE_DATA_VERSION). */
  dataVersion: number;
  /** `true` quando o perfil veio do banco em vez de uma consulta à Steam. */
  cached: boolean;
  /** Quando os dados foram obtidos da Steam. ISO 8601. */
  fetchedAt: string;
}
