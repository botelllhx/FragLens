#!/usr/bin/env node
import { createRequire } from 'node:module';
import pc from 'picocolors';
import { loadEnvFile } from '@fraglens/shared';
import { processIo } from './io.js';
import { run } from './program.js';
import { supportsUnicode } from './ui/theme.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };

loadEnvFile();

process.exitCode = await run(process.argv, {
  io: processIo,
  env: process.env,
  version,
  nodeVersion: process.versions.node,
  colorsEnabled: pc.isColorSupported,
  unicode: supportsUnicode(),
});
