import { describe, expect, it } from 'vitest';
import type { DoctorReport } from '../src/doctor/checks.js';
import { run, type CliDeps } from '../src/program.js';

async function runCli(args: string[], overrides: Partial<CliDeps> = {}) {
  let stdout = '';
  let stderr = '';
  const exitCode = await run(['node', 'fraglens', ...args], {
    io: {
      stdout: (text) => {
        stdout += text;
      },
      stderr: (text) => {
        stderr += text;
      },
    },
    env: {},
    version: '1.2.3',
    nodeVersion: '22.18.0',
    colorsEnabled: false,
    unicode: true,
    ...overrides,
  });
  return { exitCode, stdout, stderr };
}

describe('fraglens (argumentos)', () => {
  it('exibe a ajuda em português', async () => {
    const { exitCode, stdout } = await runCli(['--help']);

    expect(exitCode).toBe(0);
    expect(stdout).toContain('Uso: fraglens [opções] [comando]');
    expect(stdout).toContain('Opções:');
    expect(stdout).toContain('Comandos:');
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
});

describe('fraglens doctor', () => {
  it('lista as verificações com símbolos e avisos', async () => {
    const { exitCode, stdout } = await runCli(['doctor']);

    expect(exitCode).toBe(0);
    expect(stdout).toContain('✓ Node.js 22.18.0');
    expect(stdout).toContain('⚠ Chave da Steam API');
    expect(stdout).toContain('Sistema pronto, com avisos.');
  });

  it('usa símbolos ASCII em terminais sem suporte a unicode', async () => {
    const { stdout } = await runCli(['doctor'], { unicode: false });

    expect(stdout).toContain('[ok] Node.js 22.18.0');
    expect(stdout).not.toContain('✓');
  });

  it('com --json escreve apenas JSON válido no stdout', async () => {
    const { exitCode, stdout, stderr } = await runCli(['doctor', '--json'], {
      env: { STEAM_API_KEY: 'chave' },
    });

    const report = JSON.parse(stdout) as DoctorReport;
    expect(exitCode).toBe(0);
    expect(stderr).toBe('');
    expect(report.ready).toBe(true);
    expect(report.checks.find((check) => check.id === 'steam-key')?.status).toBe('ok');
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
