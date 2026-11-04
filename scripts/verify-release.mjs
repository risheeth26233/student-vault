// Read-only smoke checks. Does not authenticate, write records, or run migrations.
const origin = new URL(process.argv[2] || '');
if (origin.protocol !== 'https:' && !(process.argv.includes('--local') && ['127.0.0.1', 'localhost'].includes(origin.hostname))) {
  throw new Error('Public verification requires HTTPS; use --local only for a loopback preview.');
}
if (origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('Supply an origin without credentials, path or query.');
const checks = [];
async function request(path) {
  return fetch(new URL(path, origin), { signal: AbortSignal.timeout(15000), redirect: 'manual' });
}
function check(name, passed) { checks.push({ name, passed }); }
const root = await request('/');
check('root redirects to modern application', [301, 302, 307, 308].includes(root.status) && root.headers.get('location') === '/app/');
const page = await request('/app/');
const html = await page.text();
check('modern frontend loads', page.status === 200 && html.includes('id="root"'));
const assetPath = html.match(/src="(\/app\/assets\/[^" ]+\.js)"/)?.[1];
check('compiled application asset loads', Boolean(assetPath) && (await request(assetPath)).status === 200);
check('deep linking loads', (await request('/app/teacher')).status === 200);
check('process health', (await request('/api/health')).status === 200);
check('database readiness', (await request('/api/ready')).status === 200);
for (const path of ['/api/topics', '/api/teacher/classes', '/api/student/interventions']) {
  check(`anonymous denied ${path}`, (await request(path)).status === 401);
}
check('secrets not served', (await request('/app/.env')).status === 404);
check('missing assets return 404', (await request('/app/assets/not-present.js')).status === 404);
console.log(JSON.stringify({ origin: origin.origin, checks, limitation: 'HTTP checks do not establish signed-in workflows, browser rendering, or persistence.' }, null, 2));
process.exitCode = checks.every(check => check.passed) ? 0 : 1;
