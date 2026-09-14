import type { ProfileCacheStatus, SyncJobSummary } from '@fraglens/core';
import { formatDateTime, type FormatOptions } from './format.js';
import { footer, header, keyValues, section } from './layout.js';
import type { Theme } from './theme.js';

export function renderCacheStatus(
  status: ProfileCacheStatus,
  theme: Theme,
  format: FormatOptions,
  now: Date,
): string {
  const { colors } = theme;
  const title = `${colors.bold('cache do perfil')} ${colors.dim(`· ${status.steamId64}`)}`;

  return [
    ...header(title, [], theme),
    ...section('PERFIL STEAM', profileLines(status, theme, format, now), theme),
    ...lastJobSection(status.lastSyncJob, theme, format),
    ...footer(['Dados da Leetify não são guardados: são buscados a cada consulta.'], theme),
  ].join('\n');
}

function profileLines(
  status: ProfileCacheStatus,
  theme: Theme,
  format: FormatOptions,
  now: Date,
): string[] {
  if (!status.stored || status.lastFetchedAt === null) {
    return [
      'Nenhum perfil guardado para este jogador.',
      theme.colors.dim('Ele será salvo na próxima consulta com fraglens profile.'),
    ];
  }

  const ageMs = now.getTime() - Date.parse(status.lastFetchedAt);
  const rows: [string, string][] = [
    ['Situação', situation(status, theme)],
    [
      'Última atualização',
      `${formatDateTime(status.lastFetchedAt, format)} (há ${formatDuration(ageMs)})`,
    ],
    ['Validade do cache', formatDuration(status.ttlSeconds * 1000)],
  ];
  if (status.expiresAt) rows.push(['Expira em', formatDateTime(status.expiresAt, format)]);
  rows.push(['Snapshots guardados', String(status.snapshotCount)]);
  rows.push([
    'Última análise',
    status.lastAnalyzedAt ? formatDateTime(status.lastAnalyzedAt, format) : 'Nenhuma',
  ]);
  if (status.firstSeenAt) {
    rows.push(['Primeira consulta', formatDateTime(status.firstSeenAt, format)]);
  }

  return keyValues(rows, theme);
}

function situation(status: ProfileCacheStatus, { colors, symbols }: Theme): string {
  if (status.dataVersion !== status.currentDataVersion) {
    return `${colors.yellow(symbols.warn)} Formato antigo (versão ${status.dataVersion ?? '?'}, atual ${status.currentDataVersion}), será atualizado na próxima consulta`;
  }
  if (status.fresh) return `${colors.green(symbols.ok)} Atualizado`;
  return `${colors.yellow(symbols.warn)} Expirado, será atualizado na próxima consulta`;
}

const JOB_STATUS_LABELS: Readonly<Record<SyncJobSummary['status'], string>> = {
  running: 'em andamento',
  succeeded: 'concluída',
  failed: 'falhou',
};

function lastJobSection(job: SyncJobSummary | null, theme: Theme, format: FormatOptions): string[] {
  if (!job) return [];
  const { colors, symbols } = theme;
  const symbol =
    job.status === 'succeeded'
      ? colors.green(symbols.ok)
      : job.status === 'failed'
        ? colors.red(symbols.fail)
        : colors.yellow(symbols.warn);
  const error = job.errorCode ? ` (${job.errorCode})` : '';

  return section(
    'ÚLTIMA SINCRONIZAÇÃO',
    [
      `${symbol} Perfil Steam: ${JOB_STATUS_LABELS[job.status]}${error} em ${formatDateTime(job.startedAt, format)}`,
    ],
    theme,
  );
}

export function formatDuration(ms: number): string {
  const minutes = Math.floor(Math.max(0, ms) / 60_000);
  if (minutes < 1) return 'menos de 1 min';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h`;
  return `${Math.floor(hours / 24)} dias`;
}
