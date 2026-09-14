import type { Command } from 'commander';
import type { CommandContext, GlobalOptions } from '../program.js';
import { withLocalServices } from '../services.js';
import { renderProfile } from '../ui/profile.js';

export function registerProfileCommand(program: Command, ctx: CommandContext): void {
  program
    .command('profile')
    .description('Exibe o perfil Steam de um jogador')
    .argument('<jogador>', 'SteamID64, URL do perfil Steam ou nome de usuário')
    .option('--refresh', 'Ignora o cache e busca os dados novamente na Steam')
    .addHelpText(
      'after',
      [
        '',
        'Exemplos:',
        '  fraglens profile 76561198012345678',
        '  fraglens profile https://steamcommunity.com/id/usuario',
        '  fraglens profile usuario --refresh --json',
      ].join('\n'),
    )
    .action(async (player: string, options: { refresh?: boolean }, command: Command) => {
      const { json, verbose } = command.optsWithGlobals<GlobalOptions>();

      const profile = await withLocalServices(ctx, { verbose: verbose === true }, (services) =>
        services.profile.getProfile(player, { refresh: options.refresh === true }),
      );

      ctx.io.stdout(
        json
          ? `${JSON.stringify(profile, null, 2)}\n`
          : renderProfile(profile, ctx.theme, { timeZone: ctx.timeZone }),
      );
    });
}
