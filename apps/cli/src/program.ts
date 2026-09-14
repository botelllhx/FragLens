import { Command, CommanderError, Help } from 'commander';
import type { PerformanceSource, SteamGateway } from '@fraglens/core';
import type { Database } from '@fraglens/db';
import type { EnvSource, Logger } from '@fraglens/shared';
import { registerCacheCommand } from './commands/cache.js';
import { registerDoctorCommand } from './commands/doctor.js';
import { registerMatchesCommand } from './commands/matches.js';
import { registerProfileCommand } from './commands/profile.js';
import { registerRefreshCommand } from './commands/refresh.js';
import { translateCommanderMessage, translateHelp } from './i18n.js';
import type { CliIo } from './io.js';
import { errorToJson, renderError } from './ui/errors.js';
import { createTheme, type Theme } from './ui/theme.js';

export type SteamGatewayFactory = (apiKey: string, logger: Logger) => SteamGateway;
export type PerformanceSourceFactory = (
  apiKey: string | undefined,
  logger: Logger,
) => PerformanceSource;
export type DatabaseFactory = (databaseUrl: string) => Database;

export interface CliDeps {
  io: CliIo;
  env: EnvSource;
  version: string;
  nodeVersion: string;
  colorsEnabled: boolean;
  unicode: boolean;
  createSteamGateway: SteamGatewayFactory;
  createPerformanceSource: PerformanceSourceFactory;
  connectDatabase: DatabaseFactory;
  /** Fuso horário para exibir datas; padrão: o do sistema. */
  timeZone?: string;
}

export interface GlobalOptions {
  json?: boolean;
  verbose?: boolean;
}

export interface CommandContext extends CliDeps {
  theme: Theme;
  /** Mantém o maior código de saída informado pelos comandos. */
  reportExitCode: (code: number) => void;
}

export const EXIT_USAGE_ERROR = 2;

const baseHelp = new Help();

export function createProgram(ctx: CommandContext): Command {
  const program = new Command('fraglens')
    .description('Inteligência de jogadores de Counter-Strike 2 direto no terminal.')
    .version(ctx.version, '-V, --version', 'Exibe a versão')
    .helpOption('-h, --help', 'Exibe esta ajuda')
    .helpCommand('help [comando]', 'Exibe a ajuda de um comando')
    .option('--json', 'Retorna somente JSON no stdout')
    .option('--verbose', 'Exibe detalhes técnicos do processamento')
    .configureHelp({
      formatHelp: (command, helper) =>
        translateHelp(baseHelp.formatHelp.call(helper, command, helper)),
    })
    .configureOutput({
      writeOut: (text) => ctx.io.stdout(text),
      writeErr: (text) => ctx.io.stderr(text),
      outputError: (text, write) => write(translateCommanderMessage(text)),
    })
    .showHelpAfterError('Use "fraglens --help" para ver os comandos disponíveis.')
    .exitOverride();

  registerProfileCommand(program, ctx);
  registerMatchesCommand(program, ctx);
  registerRefreshCommand(program, ctx);
  registerCacheCommand(program, ctx);
  registerDoctorCommand(program, ctx);
  return program;
}

export async function run(argv: readonly string[], deps: CliDeps): Promise<number> {
  let exitCode = 0;
  const ctx: CommandContext = {
    ...deps,
    theme: createTheme(deps),
    reportExitCode: (code) => {
      exitCode = Math.max(exitCode, code);
    },
  };

  try {
    await createProgram(ctx).parseAsync([...argv]);
    return exitCode;
  } catch (error) {
    return handleError(error, argv, ctx);
  }
}

function handleError(error: unknown, argv: readonly string[], ctx: CommandContext): number {
  // Com exitOverride, ajuda, versão e erros de uso chegam como CommanderError já exibidos.
  if (error instanceof CommanderError) {
    if (error.exitCode === 0 || error.code === 'commander.help') return error.exitCode;
    return EXIT_USAGE_ERROR;
  }

  if (argv.includes('--json')) {
    ctx.io.stdout(`${JSON.stringify({ error: errorToJson(error) }, null, 2)}\n`);
  } else {
    ctx.io.stderr(renderError(error, { theme: ctx.theme, verbose: argv.includes('--verbose') }));
  }
  return 1;
}
