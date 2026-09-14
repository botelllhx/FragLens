#!/usr/bin/env node
import { createRequire } from 'node:module';
import pc from 'picocolors';
import { connectDatabase } from '@fraglens/db';
import { loadEnvFile } from '@fraglens/shared';
import { LeetifyClient } from '@fraglens/sources';
import { SteamWebApiClient } from '@fraglens/steam';
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
  createSteamGateway: (apiKey, logger) => new SteamWebApiClient({ apiKey, logger }),
  createPerformanceSource: (apiKey, logger) => new LeetifyClient({ apiKey, logger }),
  connectDatabase,
});
