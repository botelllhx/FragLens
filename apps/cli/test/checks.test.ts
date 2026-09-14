import { describe, expect, it } from 'vitest';
import { checkNodeVersion } from '../src/doctor/checks.js';

describe('checkNodeVersion', () => {
  it.each([
    ['22.18.0', 'ok'],
    ['v22.18.1', 'ok'],
    ['24.0.0', 'ok'],
    ['22.17.9', 'fail'],
    ['20.19.0', 'fail'],
  ])('Node %s → %s', (version, status) => {
    expect(checkNodeVersion(version).status).toBe(status);
  });
});
