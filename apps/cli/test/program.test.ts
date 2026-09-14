import { AppError } from '@fraglens/shared';
import { describe, expect, it } from 'vitest';
import type { DoctorReport } from '../src/doctor/checks.js';
import { fakeDatabase, fakeGateway, runCli } from './helpers.js';

describe('fraglens (argumentos)', () => {
  it('exibe a ajuda em português', async () => {
    const { exitCode, stdout } = await runCli(['--help']);

    expect(exitCode).toBe(0);
    expect(stdout).toContain('Uso: fraglens [opções] [comando]');
    expect(stdout).toContain('Opções:');
    expect(stdout).toContain('Comandos:');
    expect(stdout).toContain('profile [opções] <jogador>');
    expect(stdout).toContain('doctor');
  });

  it('exibe a versão', async () => {
    const { exitCode, stdout } = await runCli(['--version']);

    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe('1.2.3');
  });

  it('informa comando desconhecido com código de erro de uso', async () => {
    const { exitCode, stderr, stdout } = await runCli(['analise']);

    expect(exitCode).toBe(2);
    expect(stderr).toContain("erro: comando desconhecido 'analise'");
    expect(stdout).toBe('');
  });

  it('informa opção desconhecida', async () => {
    const { exitCode, stderr } = await runCli(['doctor', '--nao-existe']);

    expect(exitCode).toBe(2);
    expect(stderr).toContain("erro: opção desconhecida '--nao-existe'");
  });

  it('informa argumento obrigatório ausente', async () => {
    const { exitCode, stderr } = await runCli(['profile']);

    expect(exitCode).toBe(2);
    expect(stderr).toContain("erro: argumento obrigatório ausente 'jogador'");
  });
});

describe('fraglens doctor', () => {
  it('confirma o acesso à Steam API e lista os avisos', async () => {
    const { exitCode, stdout } = await runCli(['doctor']);

    expect(exitCode).toBe(0);
    expect(stdout).toContain('✓ Node.js 22.18.0');
    expect(stdout).toContain('✓ Steam API acessível');
    expect(stdout).toContain('⚠ Banco de dados');
    expect(stdout).toContain('Sistema pronto, com avisos.');
  });

  it('avisa quando a chave da Steam não está configurada', async () => {
    const { exitCode, stdout } = await runCli(['doctor'], { env: {} });

    expect(exitCode).toBe(0);
    expect(stdout).toContain('⚠ Steam API — chave não configurada (STEAM_API_KEY)');
  });

  it('falha quando a Steam recusa a chave', async () => {
    const { exitCode, stdout } = await runCli(['doctor'], {
      createSteamGateway: () =>
        fakeGateway({
          getPlayerSummary: () =>
            Promise.reject(new AppError('UNAUTHORIZED', 'Steam: a chave de API foi recusada.')),
        }),
    });

    expect(exitCode).toBe(1);
    expect(stdout).toContain('✗ Steam API — a chave foi recusada, confira STEAM_API_KEY');
  });

  it('confirma o banco conectado com migrations em dia', async () => {
    const { exitCode, stdout } = await runCli(['doctor'], {
      env: { STEAM_API_KEY: 'chave', DATABASE_URL: 'postgresql://localhost/fraglens' },
    });

    expect(exitCode).toBe(0);
    expect(stdout).toContain('✓ Banco de dados conectado (migrations em dia)');
  });

  it('falha quando há migrations pendentes', async () => {
    const { exitCode, stdout } = await runCli(['doctor'], {
      env: { STEAM_API_KEY: 'chave', DATABASE_URL: 'postgresql://localhost/fraglens' },
      connectDatabase: () =>
        fakeDatabase({
          checkHealth: () =>
            Promise.resolve({ appliedMigrations: 0, pendingMigrations: ['20260914000000_init'] }),
        }),
    });

    expect(exitCode).toBe(1);
    expect(stdout).toContain('✗ Banco de dados — 1 migration(s) pendente(s), rode pnpm db:migrate');
  });

  it('falha quando não consegue conectar ao banco', async () => {
    let closed = false;
    const { exitCode, stdout } = await runCli(['doctor'], {
      env: { STEAM_API_KEY: 'chave', DATABASE_URL: 'postgresql://localhost/fraglens' },
      connectDatabase: () =>
        fakeDatabase({
          checkHealth: () => Promise.reject(new Error('connect ECONNREFUSED 127.0.0.1:5432')),
          close: () => {
            closed = true;
            return Promise.resolve();
          },
        }),
    });

    expect(exitCode).toBe(1);
    expect(stdout).toContain('✗ Banco de dados — não foi possível conectar');
    expect(closed).toBe(true);
  });

  it('usa símbolos ASCII em terminais sem suporte a unicode', async () => {
    const { stdout } = await runCli(['doctor'], { unicode: false });

    expect(stdout).toContain('[ok] Node.js 22.18.0');
    expect(stdout).not.toContain('✓');
  });

  it('com --json escreve apenas JSON válido no stdout', async () => {
    const { exitCode, stdout, stderr } = await runCli(['doctor', '--json']);

    const report = JSON.parse(stdout) as DoctorReport;
    expect(exitCode).toBe(0);
    expect(stderr).toBe('');
    expect(report.ready).toBe(true);
    expect(report.checks.find((check) => check.id === 'steam-api')?.status).toBe('ok');
  });

  it('falha quando a versão do Node é antiga', async () => {
    const { exitCode, stdout } = await runCli(['--json', 'doctor'], { nodeVersion: '20.11.0' });

    const report = JSON.parse(stdout) as DoctorReport;
    expect(exitCode).toBe(1);
    expect(report.ready).toBe(false);
    expect(report.checks[0]).toMatchObject({ id: 'node', status: 'fail' });
  });

  it('falha quando a configuração é inválida', async () => {
    const { exitCode, stdout } = await runCli(['doctor'], { env: { PORT: 'abc' } });

    expect(exitCode).toBe(1);
    expect(stdout).toContain('✗ Configuração');
    expect(stdout).toContain('PORT:');
    expect(stdout).toContain('Foram encontrados problemas que impedem o uso.');
  });
});
