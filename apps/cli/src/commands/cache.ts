import type { Command } from 'commander';
import type { CommandContext, GlobalOptions } from '../program.js';
import { withLocalServices } from '../services.js';
import { renderCacheStatus } from '../ui/cache.js';

export function registerCacheCommand(program: Command, ctx: CommandContext): void {
  program
    .command('cache')
    .description('Mostra o que está guardado no banco para um jogador')
    .argument('<jogador>', 'SteamID64, URL do perfil Steam ou nome de usuário')
    .action(async (player: string, _options: unknown, command: Command) => {
      const { json, verbose } = command.optsWithGlobals<GlobalOptions>();

      const status = await withLocalServices(ctx, { verbose: verbose === true }, (services) =>
        services.profile.getCacheStatus(player),
      );

      ctx.io.stdout(
        json
          ? `${JSON.stringify(status, null, 2)}\n`
          : renderCacheStatus(status, ctx.theme, { timeZone: ctx.timeZone }, new Date()),
      );
    });
}
