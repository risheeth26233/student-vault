// One-time release operation for an explicitly identified EMPTY demo branch.
// Connection details must be configured by the owner in a local ignored env file.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');
const url = process.env.DEMO_DATABASE_URL;
const expectedHost = process.argv.find(arg => arg.startsWith('--expected-host='))?.slice('--expected-host='.length);
const apply = process.argv.includes('--apply');
if (!url) throw new Error('Owner must configure DEMO_DATABASE_URL in an ignored environment file. Never paste it into commands or chat.');
let target;
try { target = new URL(url); } catch { throw new Error('Invalid demo database URL; value suppressed.'); }
if (!expectedHost || target.hostname !== expectedHost || !target.hostname.endsWith('.neon.tech')) throw new Error('Demo endpoint identity mismatch');
const env = { ...process.env, DATABASE_URL: url };
const cli = require.resolve('prisma/build/index.js');
function prisma(args) {
  try { return execFileSync(process.execPath, [cli, ...args], { env, encoding: 'utf8', timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch { throw new Error(`Prisma operation failed: ${args[0]} ${args[1]}. No credentials logged.`); }
}
const db = new PrismaClient({ datasources: { db: { url } }, log: [] });
const temporary = mkdtempSync(join(tmpdir(), 'sv-baseline-'));
try {
  const tables = await db.$queryRawUnsafe("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
  const names = tables.map(t => t.table_name);
  if (names.includes('_prisma_migrations')) throw new Error('Migration history exists; use the normal reviewed release process instead.');
  const counts = await db.$queryRawUnsafe('SELECT (SELECT count(*) FROM users)::int AS users, (SELECT count(*) FROM topics)::int AS topics, (SELECT count(*) FROM resources)::int AS resources');
  if (Object.values(counts[0]).some(count => count !== 0)) throw new Error('Demo database is not empty. Stop for data-owner review.');
  const baseline = join(temporary, 'baseline.prisma');
  const source = execFileSync('git', ['show', '3ebb34d:backend/prisma/schema.prisma'], { encoding: 'utf8' });
  writeFileSync(baseline, source); // supplied from preserved Phase 2 commit, never guessed
  prisma(['migrate', 'diff', '--from-schema-datasource', 'prisma/schema.prisma', '--to-schema-datamodel', baseline, '--exit-code']);
  console.log('Confirmed empty demo endpoint and exact Phase 2 baseline schema.');
  if (apply) {
    prisma(['migrate', 'resolve', '--applied', '20261028120000_initial_schema']);
    prisma(['migrate', 'deploy']);
    prisma(['migrate', 'diff', '--from-schema-datasource', 'prisma/schema.prisma', '--to-schema-datamodel', 'prisma/schema.prisma', '--exit-code']);
    console.log('Recorded verified baseline, applied pending migration, and confirmed no live schema difference.');
  }
} catch { throw new Error('Demo preparation stopped. Schema, history or connectivity requires review; credentials suppressed.'); }
finally { await db.$disconnect(); rmSync(temporary, { recursive: true, force: true }); }
process.exit(0);
