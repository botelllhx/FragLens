import type { RecentForm } from '@fraglens/core';
import { describe, expect, it } from 'vitest';
import { formLine } from '../src/ui/components.js';
import { footer, section, statCards } from '../src/ui/layout.js';
import { createTheme, terminalWidth } from '../src/ui/theme.js';
import { fakePerformance, performanceData, playerMatch, runCli, STEAM_ID } from './helpers.js';

const plain = createTheme({ colorsEnabled: false, unicode: true });

describe('terminalWidth', () => {
  it.each([
    [undefined, 80],
    [0, 80],
    [72, 72],
    [40, 60],
    [180.5, 100],
  ])('%s colunas usam largura %s', (columns, expected) => {
    expect(terminalWidth(columns)).toBe(expected);
  });
});

describe('section', () => {
  it('coloca o título na linha divisória, ocupando a largura do tema', () => {
    const theme = createTheme({ colorsEnabled: false, unicode: true, width: 60 });

    const [blank, rule, body, empty] = section('MAPAS', ['conteúdo', ''], theme, '9 partidas');

    expect(blank).toBe('');
    expect(rule).toMatch(/^── MAPAS · 9 partidas ─+$/);
    expect(rule).toHaveLength(60);
    expect(body).toBe('  conteúdo');
    expect(empty).toBe('');
  });
});

describe('statCards', () => {
  it('alinha rótulos e valores em colunas', () => {
    const lines = statCards(
      [
        { label: 'VITÓRIAS', value: '47,0%' },
        { label: 'K/D', value: '0,79' },
      ],
      plain,
    );

    expect(lines).toEqual(['VITÓRIAS   K/D', '47,0%      0,79']);
  });
});

describe('footer', () => {
  it('une as partes e quebra a linha na largura do tema', () => {
    const theme = createTheme({ colorsEnabled: false, unicode: true, width: 60 });
    const [a, b, c] = ['a'.repeat(30), 'b'.repeat(20), 'c'.repeat(20)];

    expect(footer([a, b, c], theme)).toEqual(['', ` ${a} · ${b}`, ` ${c}`, '']);
  });
});

describe('formLine', () => {
  const form: RecentForm = { outcomes: ['win', 'loss', 'tie'], wins: 1, losses: 1, ties: 1 };

  it('usa quadrados coloridos quando o terminal tem cores', () => {
    const theme = createTheme({ colorsEnabled: true, unicode: true });

    expect(formLine(form, theme)).toContain('■');
  });

  it('sem cores, usa letras para não depender só da cor', () => {
    expect(formLine(form, plain)).toMatch(/^V D E\s+1V 1D 1E/);
  });
});

describe('largura do terminal na CLI', () => {
  it('as linhas divisórias acompanham as colunas do terminal', async () => {
    const matches = [playerMatch('m1', '2026-09-10T20:00:00.000Z')];
    const { stdout } = await runCli(['maps', STEAM_ID], {
      createPerformanceSource: () => fakePerformance(performanceData(matches)),
      columns: 70,
    });

    const rule = stdout.split('\n').find((line) => line.startsWith('── MAPAS'));
    expect(rule).toHaveLength(70);
  });
});
