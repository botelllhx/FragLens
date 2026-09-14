import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withSpinner } from '../src/ui/spinner.js';
import { createTheme } from '../src/ui/theme.js';
import { fakePerformance, performanceData, playerMatch, runCli, STEAM_ID } from './helpers.js';

const ESC = String.fromCharCode(27);

function recorder() {
  let stderr = '';
  return {
    io: {
      stdout: () => undefined,
      stderr: (text: string) => {
        stderr += text;
      },
    },
    stderr: () => stderr,
  };
}

describe('withSpinner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('anima no stderr enquanto a tarefa executa e apaga a linha no fim', async () => {
    const { io, stderr } = recorder();
    const theme = createTheme({ colorsEnabled: false, unicode: true });
    let finish: (value: string) => void = () => undefined;

    const promise = withSpinner('Analisando jogador', { io, theme, enabled: true }, () => {
      return new Promise<string>((resolve) => {
        finish = resolve;
      });
    });

    await vi.advanceTimersByTimeAsync(170);
    expect(stderr()).toContain('⠋ Analisando jogador…');
    expect(stderr()).toContain('⠹ Analisando jogador…');

    finish('pronto');
    await expect(promise).resolves.toBe('pronto');
    expect(stderr().endsWith(`\r${ESC}[2K`)).toBe(true);
  });

  it('apaga a linha também quando a tarefa falha', async () => {
    const { io, stderr } = recorder();
    const theme = createTheme({ colorsEnabled: false, unicode: false });

    const promise = withSpinner('Buscando', { io, theme, enabled: true }, () =>
      Promise.reject(new Error('falhou')),
    );

    await expect(promise).rejects.toThrow('falhou');
    expect(stderr()).toContain('- Buscando...');
    expect(stderr().endsWith(`\r${ESC}[2K`)).toBe(true);
  });

  it('desativado, não escreve nada', async () => {
    const { io, stderr } = recorder();
    const theme = createTheme({ colorsEnabled: true, unicode: true });

    await expect(
      withSpinner('Buscando', { io, theme, enabled: false }, () => Promise.resolve(42)),
    ).resolves.toBe(42);
    expect(stderr()).toBe('');
  });
});

describe('indicador de carregamento nos comandos', () => {
  const matches = [playerMatch('m1', '2026-09-10T20:00:00.000Z')];
  const source = { createPerformanceSource: () => fakePerformance(performanceData(matches)) };

  it('aparece no stderr em terminal interativo, sem afetar o stdout', async () => {
    const { stdout, stderr } = await runCli(['matches', STEAM_ID], {
      ...source,
      interactive: true,
    });

    expect(stderr).toContain('Buscando partidas na Leetify…');
    expect(stdout).not.toContain('Buscando partidas');
  });

  it('não aparece com --json, mesmo em terminal interativo', async () => {
    const { stdout, stderr } = await runCli(['matches', STEAM_ID, '--json'], {
      ...source,
      interactive: true,
    });

    expect(stderr).toBe('');
    expect(() => JSON.parse(stdout) as unknown).not.toThrow();
  });
});
