import type { Command } from 'commander';
import type { CommandContext, GlobalOptions } from '../program.js';
import { withLocalServices } from '../services.js';
import { renderAnalysis } from '../ui/analyze.js';
import { limitOption, MAX_MATCH_LIMIT } from './options.js';

interface AnalyzeOptions {
  refresh?: boolean;
  ai: boolean;
  limit: number;
}

export function registerAnalyzeCommand(program: Command, ctx: CommandContext): void {
  program
    .command('analyze')
    .description('Análise completa: perfil, desempenho, mapas e tendências')
    .argument('<jogador>', 'SteamID64, URL do perfil Steam ou nome de usuário')
    .addOption(limitOption(MAX_MATCH_LIMIT, 'Partidas mais recentes consideradas'))
    .option('--refresh', 'Ignora o cache do perfil Steam')
    .option('--no-ai', 'Gera a análise sem IA')
    .addHelpText(
      'after',
      [
        '',
        'Exemplos:',
        '  fraglens analyze https://steamcommunity.com/id/usuario',
        '  fraglens analyze 76561198012345678 --limit 30 --no-ai',
        '  fraglens analyze usuario --json > analise.json',
      ].join('\n'),
    )
    .action(async (player: string, options: AnalyzeOptions, command: Command) => {
      const { json, verbose } = command.optsWithGlobals<GlobalOptions>();

      const analysis = await withLocalServices(ctx, { verbose: verbose === true }, (services) =>
        services.analysis.analyze(player, {
          refresh: options.refresh === true,
          limit: options.limit,
          ai: options.ai,
        }),
      );

      ctx.io.stdout(
        json
          ? `${JSON.stringify(analysis, null, 2)}\n`
          : renderAnalysis(analysis, ctx.theme, { timeZone: ctx.timeZone }),
      );
    });
}
