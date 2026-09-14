import type { Command } from 'commander';
import type { CommandContext, GlobalOptions } from '../program.js';
import { withLocalServices } from '../services.js';
import { renderMatchHistory } from '../ui/matches.js';
import { limitOption } from './options.js';

const DEFAULT_LIMIT = 20;

export function registerMatchesCommand(program: Command, ctx: CommandContext): void {
  program
    .command('matches')
    .description('Lista as partidas recentes de um jogador (dados da Leetify)')
    .argument('<jogador>', 'SteamID64, URL do perfil Steam ou nome de usuário')
    .addOption(limitOption(DEFAULT_LIMIT, 'Quantidade de partidas'))
    .addHelpText(
      'after',
      [
        '',
        'Exemplos:',
        '  fraglens matches 76561198012345678',
        '  fraglens matches https://steamcommunity.com/id/usuario --limit 50',
        '  fraglens matches usuario --json',
      ].join('\n'),
    )
    .action(async (player: string, options: { limit: number }, command: Command) => {
      const { json, verbose } = command.optsWithGlobals<GlobalOptions>();
      const loading = {
        verbose: verbose === true,
        json: json === true,
        loading: 'Buscando partidas na Leetify',
      };
      const history = await withLocalServices(ctx, loading, (services) =>
        services.matches.getMatchHistory(player, { limit: options.limit }),
      );

      ctx.io.stdout(
        json
          ? `${JSON.stringify(history, null, 2)}\n`
          : renderMatchHistory(history, ctx.theme, { timeZone: ctx.timeZone }),
      );
    });
}
