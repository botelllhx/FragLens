import type { Command } from 'commander';
import type { CommandContext, GlobalOptions } from '../program.js';
import { withLocalServices } from '../services.js';
import { formatDateTime, safeText } from '../ui/format.js';

export function registerRefreshCommand(program: Command, ctx: CommandContext): void {
  program
    .command('refresh')
    .description('Atualiza os dados guardados de um jogador (perfil Steam)')
    .argument('<jogador>', 'SteamID64, URL do perfil Steam ou nome de usuário')
    .action(async (player: string, _options: unknown, command: Command) => {
      const { json, verbose } = command.optsWithGlobals<GlobalOptions>();

      const loading = {
        verbose: verbose === true,
        json: json === true,
        loading: 'Atualizando perfil na Steam',
      };
      const result = await withLocalServices(ctx, loading, (services) =>
        services.profile.refresh(player),
      );

      if (!result.saved) ctx.reportExitCode(1);

      if (json) {
        ctx.io.stdout(`${JSON.stringify(result, null, 2)}\n`);
        return;
      }

      const { colors, symbols } = ctx.theme;
      const name = safeText(result.profile.summary.personaName);
      const when = formatDateTime(result.profile.fetchedAt, { timeZone: ctx.timeZone });

      if (result.saved) {
        ctx.io.stdout(
          [
            `${colors.green(symbols.ok)} Perfil Steam de ${colors.bold(name)} atualizado em ${when}.`,
            colors.dim('Dados da Leetify não são guardados: são buscados a cada consulta.'),
            '',
          ].join('\n'),
        );
      } else {
        ctx.io.stderr(
          [
            `${colors.yellow(symbols.warn)} Perfil de ${colors.bold(name)} obtido da Steam, mas não foi possível salvar no banco.`,
            colors.dim('Rode fraglens doctor para verificar o banco de dados.'),
            '',
          ].join('\n'),
        );
      }
    });
}
