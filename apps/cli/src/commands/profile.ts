import type { Command } from 'commander';
import type { CommandContext, GlobalOptions } from '../program.js';
import { createLocalServices } from '../services.js';
import { renderProfile } from '../ui/profile.js';

export function registerProfileCommand(program: Command, ctx: CommandContext): void {
  program
    .command('profile')
    .description('Exibe o perfil Steam de um jogador')
    .argument('<jogador>', 'SteamID64, URL do perfil Steam ou nome de usuário')
    .addHelpText(
      'after',
      [
        '',
        'Exemplos:',
        '  fraglens profile 76561198012345678',
        '  fraglens profile https://steamcommunity.com/id/usuario',
        '  fraglens profile usuario --json',
      ].join('\n'),
    )
    .action(async (player: string, _options: unknown, command: Command) => {
      const { json, verbose } = command.optsWithGlobals<GlobalOptions>();
      const services = createLocalServices(ctx, { verbose: verbose === true });

      const profile = await services.profile.getProfile(player);

      ctx.io.stdout(
        json
          ? `${JSON.stringify(profile, null, 2)}\n`
          : renderProfile(profile, ctx.theme, { timeZone: ctx.timeZone }),
      );
    });
}
