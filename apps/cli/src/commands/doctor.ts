import type { Command } from 'commander';
import { createLogger } from '@fraglens/shared';
import { runDoctor, type CheckStatus, type DoctorReport } from '../doctor/checks.js';
import type { CommandContext, GlobalOptions } from '../program.js';
import { header, section } from '../ui/layout.js';
import { spinnerEnabled, withSpinner } from '../ui/spinner.js';
import type { Theme } from '../ui/theme.js';

export function registerDoctorCommand(program: Command, ctx: CommandContext): void {
  program
    .command('doctor')
    .description('Verifica se o ambiente está pronto para usar o FragLens')
    .action(async (_options: unknown, command: Command) => {
      const flags = command.optsWithGlobals<GlobalOptions>();
      const logger = createLogger({ level: 'silent' });

      const report = await withSpinner(
        'Verificando o ambiente',
        { io: ctx.io, theme: ctx.theme, enabled: spinnerEnabled(ctx.interactive, flags) },
        () =>
          runDoctor({
            env: ctx.env,
            nodeVersion: ctx.nodeVersion,
            createSteamGateway: (apiKey) => ctx.createSteamGateway(apiKey, logger),
            connectDatabase: (databaseUrl) => ctx.connectDatabase(databaseUrl),
          }),
      );

      ctx.io.stdout(
        flags.json ? `${JSON.stringify(report, null, 2)}\n` : renderDoctorReport(report, ctx.theme),
      );
      if (!report.ready) ctx.reportExitCode(1);
    });
}

export function renderDoctorReport(report: DoctorReport, theme: Theme): string {
  const { colors, symbols } = theme;

  const checks = report.checks.map((check) => {
    const detail = check.detail ? colors.dim(` ${symbols.dash} ${check.detail}`) : '';
    return `${statusSymbol(check.status, theme)} ${check.label}${detail}`;
  });

  return [
    ...header(colors.bold('diagnóstico do ambiente'), [], theme),
    ...section('VERIFICAÇÕES', [...checks, '', summary(report, theme)], theme),
    '',
  ].join('\n');
}

function statusSymbol(status: CheckStatus, { colors, symbols }: Theme): string {
  switch (status) {
    case 'ok':
      return colors.green(symbols.ok);
    case 'warn':
      return colors.yellow(symbols.warn);
    case 'fail':
      return colors.red(symbols.fail);
  }
}

function summary(report: DoctorReport, { colors }: Theme): string {
  if (!report.ready) return colors.red('Foram encontrados problemas que impedem o uso.');
  if (report.checks.some((check) => check.status === 'warn')) {
    return colors.yellow('Sistema pronto, com avisos.');
  }
  return colors.green('Sistema pronto.');
}
