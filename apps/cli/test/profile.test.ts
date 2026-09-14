import type { PlayerProfile } from '@fraglens/core';
import { describe, expect, it } from 'vitest';
import { fakeGateway, runCli, STEAM_ID, SUMMARY } from './helpers.js';

const ESC = String.fromCharCode(27);

describe('fraglens profile', () => {
  it('exibe o perfil a partir da URL personalizada', async () => {
    const { exitCode, stdout, stderr } = await runCli([
      'profile',
      'https://steamcommunity.com/id/jogador',
    ]);

    expect(exitCode).toBe(0);
    expect(stderr).toBe('');
    expect(stdout).toContain('FRAGLENS  Jogador Teste · 76561198034202275');
    expect(stdout).toContain('https://steamcommunity.com/id/jogador');
    expect(stdout).toContain('── CONTA ──');
    expect(stdout).toMatch(/Visibilidade\s+Público/);
    expect(stdout).toMatch(/País\s+Brasil/);
    expect(stdout).toMatch(/Conta criada\s+27\/11\/2010/);
    expect(stdout).toMatch(/Horas totais\s+15\.387,4 h/);
    expect(stdout).toMatch(/Últimas 2 semanas\s+24,3 h/);
    expect(stdout).toContain('✓ Nenhum banimento registrado');
  });

  it('com --json retorna somente o perfil estruturado', async () => {
    const { exitCode, stdout, stderr } = await runCli(['profile', STEAM_ID, '--json']);

    const profile = JSON.parse(stdout) as PlayerProfile;
    expect(exitCode).toBe(0);
    expect(stderr).toBe('');
    expect(profile.steamId64).toBe(STEAM_ID);
    expect(profile.summary.personaName).toBe('Jogador Teste');
    expect(profile.cs2).toEqual({ visible: true, totalHours: 15387.4, lastTwoWeeksHours: 24.3 });
  });

  it('informa quando os detalhes de jogos são privados', async () => {
    const { stdout } = await runCli(['profile', STEAM_ID], {
      createSteamGateway: () =>
        fakeGateway({
          getCs2Playtime: () =>
            Promise.resolve({ visible: false, totalHours: null, lastTwoWeeksHours: null }),
        }),
    });

    expect(stdout).toMatch(/Horas totais\s+Indisponível/);
    expect(stdout).toContain('Os detalhes de jogos deste perfil não são públicos.');
  });

  it('indica campos indisponíveis em perfil não público', async () => {
    const { stdout } = await runCli(['profile', STEAM_ID], {
      createSteamGateway: () =>
        fakeGateway({
          getPlayerSummary: () =>
            Promise.resolve({
              ...SUMMARY,
              visibility: 'friends-only',
              countryCode: null,
              accountCreatedAt: null,
            }),
        }),
    });

    expect(stdout).toMatch(/Visibilidade\s+Somente amigos/);
    expect(stdout).toMatch(/País\s+Indisponível \(perfil não público\)/);
  });

  it('exibe banimentos', async () => {
    const { stdout } = await runCli(['profile', STEAM_ID], {
      createSteamGateway: () =>
        fakeGateway({
          getBanStatus: () =>
            Promise.resolve({
              vacBanned: true,
              vacBanCount: 1,
              gameBanCount: 2,
              communityBanned: false,
              economyBan: 'none',
              daysSinceLastBan: 120,
            }),
        }),
    });

    expect(stdout).toContain('✗ 1 banimento VAC · 2 banimentos de jogo · último há 120 dias');
  });

  it('remove sequências de controle do nome do perfil', async () => {
    const { stdout } = await runCli(['profile', STEAM_ID], {
      createSteamGateway: () =>
        fakeGateway({
          getPlayerSummary: () =>
            Promise.resolve({ ...SUMMARY, personaName: `Nome${ESC}[2J${ESC}[31mFalso` }),
        }),
    });

    expect(stdout).not.toContain(ESC);
    expect(stdout).toContain('Nome[2J[31mFalso');
  });

  it('informa quando o jogador não é encontrado', async () => {
    const { exitCode, stdout, stderr } = await runCli(['profile', 'inexistente']);

    expect(exitCode).toBe(1);
    expect(stdout).toBe('');
    expect(stderr).toContain('✗ Nenhum perfil Steam encontrado para "inexistente".');
    expect(stderr).toContain('• Confira se o nome é o mesmo da URL do perfil');
  });

  it('rejeita URLs de outros sites', async () => {
    const { exitCode, stderr } = await runCli(['profile', 'https://example.com/id/jogador']);

    expect(exitCode).toBe(1);
    expect(stderr).toContain('Apenas URLs de perfil do steamcommunity.com são aceitas.');
  });

  it('explica como configurar a chave da Steam quando ela falta', async () => {
    const { exitCode, stderr } = await runCli(['profile', STEAM_ID], { env: {} });

    expect(exitCode).toBe(1);
    expect(stderr).toContain('A chave da Steam API não está configurada.');
    expect(stderr).toContain('STEAM_API_KEY');
  });

  it('com --json, erros também saem como JSON no stdout', async () => {
    const { exitCode, stdout, stderr } = await runCli(['profile', 'inexistente', '--json']);

    const body = JSON.parse(stdout) as { error: { code: string; message: string } };
    expect(exitCode).toBe(1);
    expect(stderr).toBe('');
    expect(body.error.code).toBe('NOT_FOUND');
  });
});
