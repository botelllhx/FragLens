import type { Cs2Playtime, PlayerProfile, ProfileVisibility } from '@fraglens/core';
import { bansText, playerTitle } from './components.js';
import {
  countryName,
  formatDate,
  formatDateTime,
  formatHours,
  safeText,
  type FormatOptions,
} from './format.js';
import { footer, header, keyValues, section } from './layout.js';
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

  const account = keyValues(
    [
      ['Visibilidade', VISIBILITY_LABELS[summary.visibility]],
      ['País', summary.countryCode ? countryName(summary.countryCode) : notInformed],
      [
        'Conta criada',
        summary.accountCreatedAt ? formatDate(summary.accountCreatedAt, format) : notInformed,
      ],
    ],
    theme,
  );

  const fetchedAt = `dados da Steam obtidos em ${formatDateTime(profile.fetchedAt, format)}`;

  return [
    ...header(
      playerTitle(summary.personaName, summary.steamId64, theme),
      [theme.colors.dim(safeText(summary.profileUrl))],
      theme,
    ),
    ...section('CONTA', account, theme),
    ...section('CS2', playtimeLines(profile.cs2, theme), theme),
    ...section('BANIMENTOS', [bansText(profile.bans, theme, 'long')], theme),
    ...footer(
      profile.cached
        ? [`${fetchedAt} (cache)`, 'use --refresh para buscar novamente']
        : [fetchedAt],
      theme,
    ),
  ].join('\n');
}

function playtimeLines(cs2: Cs2Playtime, theme: Theme): string[] {
  if (!cs2.visible || cs2.totalHours === null || cs2.lastTwoWeeksHours === null) {
    return [
      ...keyValues(
        [
          ['Horas totais', 'Indisponível'],
          ['Últimas 2 semanas', 'Indisponível'],
        ],
        theme,
      ),
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
