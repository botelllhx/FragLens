import type { Command } from 'commander';
import { runDoctor, type CheckStatus, type DoctorReport } from '../doctor/checks.js';
import type { CommandContext, GlobalOptions } from '../program.js';
import type { Theme } from '../ui/theme.js';

export function registerDoctorCommand(program: Command, ctx: CommandContext): void {
  program
    .command('doctor')
    .description('Verifica se o ambiente está pronto para usar o FragLens')
    .action((_options: unknown, command: Command) => {
      const { json } = command.optsWithGlobals<GlobalOptions>();
      const report = runDoctor({ env: ctx.env, nodeVersion: ctx.nodeVersion });

      ctx.io.stdout(
        json ? `${JSON.stringify(report, null, 2)}\n` : renderDoctorReport(report, ctx.theme),
      );
      if (!report.ready) ctx.reportExitCode(1);
    });
}

export function renderDoctorReport(report: DoctorReport, theme: Theme): string {
  const { colors, symbols } = theme;
  const lines = ['', colors.bold('FRAGLENS · DIAGNÓSTICO'), ''];

  for (const check of report.checks) {
    const detail = check.detail ? colors.dim(` ${symbols.dash} ${check.detail}`) : '';
    lines.push(`${statusSymbol(check.status, theme)} ${check.label}${detail}`);
  }

  lines.push('', summary(report, theme), '');
  return lines.join('\n');
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
