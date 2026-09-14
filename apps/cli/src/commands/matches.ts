import { InvalidArgumentError, type Command } from 'commander';
import type { CommandContext, GlobalOptions } from '../program.js';
import { withLocalServices } from '../services.js';
import { renderMatchHistory } from '../ui/matches.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export function registerMatchesCommand(program: Command, ctx: CommandContext): void {
  program
    .command('matches')
    .description('Lista as partidas recentes de um jogador (dados da Leetify)')
    .argument('<jogador>', 'SteamID64, URL do perfil Steam ou nome de usuário')
    .option('--limit <n>', `Quantidade de partidas (1 a ${MAX_LIMIT})`, parseLimit, DEFAULT_LIMIT)
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
      const history = await withLocalServices(ctx, { verbose: verbose === true }, (services) =>
        services.matches.getMatchHistory(player, { limit: options.limit }),
      );

      ctx.io.stdout(
        json
          ? `${JSON.stringify(history, null, 2)}\n`
          : renderMatchHistory(history, ctx.theme, { timeZone: ctx.timeZone }),
      );
    });
}

function parseLimit(value: string): number {
  const limit = Number(value);
  if (!/^\d+$/.test(value) || limit < 1 || limit > MAX_LIMIT) {
    throw new InvalidArgumentError(`Informe um número inteiro entre 1 e ${MAX_LIMIT}.`);
  }
  return limit;
}
