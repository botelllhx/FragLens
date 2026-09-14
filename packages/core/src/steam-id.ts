import { AppError } from '@fraglens/shared';

export type SteamIdentifier =
  { kind: 'steamId64'; steamId64: string } | { kind: 'vanity'; vanity: string };

// SteamID64 de conta individual = base + account ID de 32 bits.
const INDIVIDUAL_ACCOUNT_BASE = 76561197960265728n;
const MAX_ACCOUNT_ID = 0xffff_ffffn;

const STEAM_COMMUNITY_HOSTS = new Set(['steamcommunity.com', 'www.steamcommunity.com']);
const STEAM_ID64_PATTERN = /^\d{17}$/;
const STEAM2_PATTERN = /^STEAM_[0-5]:([01]):(\d{1,10})$/i;
const STEAM3_PATTERN = /^\[?U:1:(\d{1,10})\]?$/i;
const VANITY_PATTERN = /^[A-Za-z0-9_-]{2,32}$/;

const ACCEPTED_FORMATS = [
  'SteamID64, ex.: 76561198012345678',
  'URL do perfil, ex.: https://steamcommunity.com/profiles/76561198012345678',
  'URL personalizada, ex.: https://steamcommunity.com/id/usuario',
  'Nome da URL personalizada, ex.: usuario',
];

/**
 * Interpreta o identificador informado pelo usuário sem acessar a rede.
 * URLs personalizadas precisam ser resolvidas depois pela Steam.
 */
export function parseSteamIdentifier(rawInput: string): SteamIdentifier {
  const input = rawInput.trim();
  if (input === '') {
    throw invalidInput('Informe um jogador: SteamID64, URL do perfil Steam ou nome de usuário.');
  }

  if (STEAM_ID64_PATTERN.test(input)) {
    return { kind: 'steamId64', steamId64: validateSteamId64(input) };
  }

  const steam2 = STEAM2_PATTERN.exec(input);
  if (steam2?.[1] && steam2[2]) {
    return fromAccountId(BigInt(steam2[2]) * 2n + BigInt(steam2[1]));
  }

  const steam3 = STEAM3_PATTERN.exec(input);
  if (steam3?.[1]) return fromAccountId(BigInt(steam3[1]));

  // Nomes de usuário não podem conter "/" nem ".", então isso só pode ser uma URL.
  if (input.includes('/') || input.includes('.')) return parseProfileUrl(input);

  if (VANITY_PATTERN.test(input)) return { kind: 'vanity', vanity: input };

  throw invalidInput(`"${displayable(input)}" não é um identificador Steam válido.`);
}

function parseProfileUrl(input: string): SteamIdentifier {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    throw invalidInput('A URL informada é inválida.');
  }

  if (!STEAM_COMMUNITY_HOSTS.has(url.hostname)) {
    throw invalidInput('Apenas URLs de perfil do steamcommunity.com são aceitas.');
  }

  const [type, value] = url.pathname.split('/').filter(Boolean);
  if (type === 'profiles' && value && STEAM_ID64_PATTERN.test(value)) {
    return { kind: 'steamId64', steamId64: validateSteamId64(value) };
  }
  if (type === 'id' && value && VANITY_PATTERN.test(value)) {
    return { kind: 'vanity', vanity: value };
  }

  throw invalidInput('A URL não aponta para um perfil Steam.');
}

function validateSteamId64(value: string): string {
  const accountId = BigInt(value) - INDIVIDUAL_ACCOUNT_BASE;
  if (accountId < 1n || accountId > MAX_ACCOUNT_ID) {
    throw invalidInput(`"${value}" não é uma SteamID64 de conta individual válida.`);
  }
  return value;
}

function fromAccountId(accountId: bigint): SteamIdentifier {
  if (accountId < 1n || accountId > MAX_ACCOUNT_ID) {
    throw invalidInput('A Steam ID informada está fora do intervalo válido.');
  }
  return { kind: 'steamId64', steamId64: (INDIVIDUAL_ACCOUNT_BASE + accountId).toString() };
}

function invalidInput(message: string): AppError {
  return new AppError('INVALID_INPUT', message, { hints: ACCEPTED_FORMATS });
}

// A entrada volta na mensagem de erro: remove caracteres de controle e limita o tamanho.
function displayable(input: string): string {
  const clean = input.replace(/\p{Cc}/gu, '');
  return clean.length > 64 ? `${clean.slice(0, 64)}…` : clean;
}
