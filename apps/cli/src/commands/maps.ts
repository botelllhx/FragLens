import type { Command } from 'commander';
import type { CommandContext, GlobalOptions } from '../program.js';
import { withLocalServices } from '../services.js';
import { renderMapReport } from '../ui/maps.js';
import { limitOption, MAX_MATCH_LIMIT } from './options.js';

export function registerMapsCommand(program: Command, ctx: CommandContext): void {
  program
    .command('maps')
    .description('Desempenho por mapa (dados da Leetify)')
    .argument('<jogador>', 'SteamID64, URL do perfil Steam ou nome de usuário')
    .addOption(limitOption(MAX_MATCH_LIMIT, 'Partidas mais recentes consideradas'))
    .addHelpText(
      'after',
      [
        '',
        'Exemplos:',
        '  fraglens maps 76561198012345678',
        '  fraglens maps usuario --limit 30',
        '  fraglens maps usuario --json',
      ].join('\n'),
    )
    .action(async (player: string, options: { limit: number }, command: Command) => {
      const { json, verbose } = command.optsWithGlobals<GlobalOptions>();

      const loading = {
        verbose: verbose === true,
        json: json === true,
        loading: 'Calculando desempenho por mapa',
      };
      const report = await withLocalServices(ctx, loading, (services) =>
        services.matches.getMapReport(player, { limit: options.limit }),
      );

      ctx.io.stdout(
        json
          ? `${JSON.stringify(report, null, 2)}\n`
          : renderMapReport(report, ctx.theme, { timeZone: ctx.timeZone }),
      );
    });
}
