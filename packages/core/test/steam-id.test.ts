import { AppError } from '@fraglens/shared';
import { describe, expect, it } from 'vitest';
import { parseSteamIdentifier } from '../src/steam-id.js';

const STEAM_ID = '76561198034202275';
const ESC = String.fromCharCode(27);

function captureError(input: string): AppError {
  try {
    parseSteamIdentifier(input);
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
  throw new Error(`Era esperado erro para "${input}"`);
}

describe('parseSteamIdentifier', () => {
  it.each([
    STEAM_ID,
    `  ${STEAM_ID}  `,
    `https://steamcommunity.com/profiles/${STEAM_ID}`,
    `https://steamcommunity.com/profiles/${STEAM_ID}/`,
    `http://www.steamcommunity.com/profiles/${STEAM_ID}/?l=brazilian`,
    `steamcommunity.com/profiles/${STEAM_ID}`,
    'STEAM_0:1:36968273',
    'STEAM_1:1:36968273',
    '[U:1:73936547]',
    'U:1:73936547',
  ])('%s → SteamID64', (input) => {
    expect(parseSteamIdentifier(input)).toEqual({ kind: 'steamId64', steamId64: STEAM_ID });
  });

  it.each([
    ['https://steamcommunity.com/id/officials1mple/', 'officials1mple'],
    ['steamcommunity.com/id/Gabe_Logan-Newell', 'Gabe_Logan-Newell'],
    ['https://steamcommunity.com/id/jogador/home', 'jogador'],
    ['officials1mple', 'officials1mple'],
  ])('%s → URL personalizada "%s"', (input, vanity) => {
    expect(parseSteamIdentifier(input)).toEqual({ kind: 'vanity', vanity });
  });

  it.each([
    ['', 'Informe um jogador'],
    ['   ', 'Informe um jogador'],
    [`https://evil.example.com/profiles/${STEAM_ID}`, 'steamcommunity.com'],
    [`https://steamcommunity.com.evil.com/profiles/${STEAM_ID}`, 'steamcommunity.com'],
    ['https://steamcommunity.com/groups/valve', 'não aponta para um perfil'],
    ['https://steamcommunity.com/profiles/123', 'não aponta para um perfil'],
    ['76561197960265728', 'conta individual'],
    ['99999999999999999', 'conta individual'],
    ['nome com espaço', 'não é um identificador Steam válido'],
    ['a'.repeat(33), 'não é um identificador Steam válido'],
  ])('rejeita "%s"', (input, expectedMessage) => {
    const error = captureError(input);

    expect(error.code).toBe('INVALID_INPUT');
    expect(error.message).toContain(expectedMessage);
    expect(error.hints.length).toBeGreaterThan(0);
  });

  it('remove caracteres de controle da entrada exibida no erro', () => {
    const error = captureError(`abc${ESC}[31mdef ghi`);

    expect(error.message).not.toContain(ESC);
    expect(error.message).toContain('abc[31mdef ghi');
  });
});
