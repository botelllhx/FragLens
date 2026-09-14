// O Commander não oferece tradução: os textos fixos da ajuda e dos erros de uso são convertidos aqui.

type Replacement = readonly [pattern: RegExp, replacement: string];

const HELP_REPLACEMENTS: readonly Replacement[] = [
  [/^Usage:/gm, 'Uso:'],
  [/^Arguments:/gm, 'Argumentos:'],
  [/^Options:/gm, 'Opções:'],
  [/^Global Options:/gm, 'Opções globais:'],
  [/^Commands:/gm, 'Comandos:'],
  [/\[options\]/g, '[opções]'],
  [/\[command\]/g, '[comando]'],
  [/\(default: /g, '(padrão: '],
  [/\(choices: /g, '(valores: '],
];

// Os padrões específicos vêm antes do genérico `error:`.
const ERROR_REPLACEMENTS: readonly Replacement[] = [
  [/^error: unknown command '(.+?)'/m, "erro: comando desconhecido '$1'"],
  [/^error: unknown option '(.+?)'/m, "erro: opção desconhecida '$1'"],
  [/^error: missing required argument '(.+?)'/m, "erro: argumento obrigatório ausente '$1'"],
  [/^error: option '(.+?)' argument missing/m, "erro: a opção '$1' precisa de um valor"],
  [
    /^error: option '(.+?)' argument '(.*?)' is invalid\./m,
    "erro: valor inválido '$2' para a opção '$1'.",
  ],
  [
    /^error: too many arguments(?: for '.+?')?\. Expected (\d+) arguments? but got (\d+)\./m,
    'erro: argumentos demais. Esperado: $1, recebido: $2.',
  ],
  [/\(Did you mean (.+?)\?\)/g, '(Você quis dizer $1?)'],
  [/^error: /m, 'erro: '],
];

function applyReplacements(text: string, replacements: readonly Replacement[]): string {
  return replacements.reduce(
    (result, [pattern, replacement]) => result.replace(pattern, replacement),
    text,
  );
}

export function translateHelp(text: string): string {
  return applyReplacements(text, HELP_REPLACEMENTS);
}

export function translateCommanderMessage(text: string): string {
  return applyReplacements(text, ERROR_REPLACEMENTS);
}
