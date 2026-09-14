import type { Cs2Playtime, PlayerProfile, ProfileVisibility, SteamBanStatus } from '@fraglens/core';
import {
  countryName,
  formatDate,
  formatDateTime,
  formatHours,
  plural,
  safeText,
  type FormatOptions,
} from './format.js';
import { banner, keyValues, rule, section } from './layout.js';
import type { Theme } from './theme.js';

const VISIBILITY_LABELS: Readonly<Record<ProfileVisibility, string>> = {
  public: 'Público',
  'friends-only': 'Somente amigos',
  private: 'Privado',
};

export function renderProfile(profile: PlayerProfile, theme: Theme, format: FormatOptions): string {
  const { summary } = profile;
  const notInformed =
    summary.visibility === 'public' ? 'Não informado' : 'Indisponível (perfil não público)';

  const player = [
    theme.colors.bold(safeText(summary.personaName)),
    '',
    ...keyValues(
      [
        ['SteamID64', summary.steamId64],
        ['Perfil', safeText(summary.profileUrl)],
        ['Visibilidade', VISIBILITY_LABELS[summary.visibility]],
        ['País', summary.countryCode ? countryName(summary.countryCode) : notInformed],
        [
          'Conta criada',
          summary.accountCreatedAt ? formatDate(summary.accountCreatedAt, format) : notInformed,
        ],
      ],
      theme,
    ),
  ];

  return [
    '',
    ...banner(theme),
    '',
    ...section('JOGADOR', player, theme),
    ...section('CS2', renderPlaytime(profile.cs2, theme), theme),
    ...section('BANIMENTOS', [renderBans(profile.bans, theme)], theme),
    rule(theme),
    theme.colors.dim(`Dados da Steam obtidos em ${formatDateTime(profile.fetchedAt, format)}`),
    '',
  ].join('\n');
}

function renderPlaytime(cs2: Cs2Playtime, theme: Theme): string[] {
  if (!cs2.visible || cs2.totalHours === null || cs2.lastTwoWeeksHours === null) {
    return [
      ...keyValues(
        [
          ['Horas totais', 'Indisponível'],
          ['Últimas 2 semanas', 'Indisponível'],
        ],
        theme,
      ),
      '',
      theme.colors.dim('Os detalhes de jogos deste perfil não são públicos.'),
    ];
  }

  return keyValues(
    [
      ['Horas totais', formatHours(cs2.totalHours)],
      ['Últimas 2 semanas', formatHours(cs2.lastTwoWeeksHours)],
    ],
    theme,
  );
}

function renderBans(bans: SteamBanStatus | null, { colors, symbols }: Theme): string {
  if (!bans) return colors.dim('Informações de banimento indisponíveis.');

  const parts: string[] = [];
  if (bans.vacBanCount > 0) parts.push(plural(bans.vacBanCount, 'banimento VAC', 'banimentos VAC'));
  if (bans.gameBanCount > 0) {
    parts.push(plural(bans.gameBanCount, 'banimento de jogo', 'banimentos de jogo'));
  }
  if (bans.communityBanned) parts.push('banido da comunidade');
  if (bans.economyBan !== 'none') parts.push(`restrição de trocas (${safeText(bans.economyBan)})`);

  if (parts.length === 0) return `${colors.green(symbols.ok)} Nenhum banimento registrado`;

  const lastBan =
    bans.daysSinceLastBan === null
      ? ''
      : ` · último há ${plural(bans.daysSinceLastBan, 'dia', 'dias')}`;
  return `${colors.red(symbols.fail)} ${parts.join(' · ')}${lastBan}`;
}
