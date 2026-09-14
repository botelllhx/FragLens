import type { Command } from 'commander';
import type { CommandContext, GlobalOptions } from '../program.js';
import { withLocalServices } from '../services.js';
import { renderProgressReport } from '../ui/progress.js';
import { limitOption, MAX_MATCH_LIMIT } from './options.js';

export function registerProgressCommand(program: Command, ctx: CommandContext): void {
  program
    .command('progress')
    .description('Resumo, tendências e evolução do desempenho (dados da Leetify)')
    .argument('<jogador>', 'SteamID64, URL do perfil Steam ou nome de usuário')
    .addOption(limitOption(MAX_MATCH_LIMIT, 'Partidas mais recentes consideradas'))
    .addHelpText(
      'after',
      [
        '',
        'Exemplos:',
        '  fraglens progress 76561198012345678',
        '  fraglens progress usuario --limit 50',
        '  fraglens progress usuario --json',
      ].join('\n'),
    )
    .action(async (player: string, options: { limit: number }, command: Command) => {
      const { json, verbose } = command.optsWithGlobals<GlobalOptions>();

      const report = await withLocalServices(ctx, { verbose: verbose === true }, (services) =>
        services.matches.getProgressReport(player, { limit: options.limit }),
      );

      ctx.io.stdout(
        json
          ? `${JSON.stringify(report, null, 2)}\n`
          : renderProgressReport(report, ctx.theme, { timeZone: ctx.timeZone }),
      );
    });
}
