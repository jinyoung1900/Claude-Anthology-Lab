// Builds the web version for GitHub Pages into out/, served from
// https://jinyoung1900.github.io/Claude-Anthology-Lab/dog-go/out/
// Run the normal build (npm run build + npx cap sync android) BEFORE this when making an APK,
// because Capacitor needs the build without the base path.
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const base = process.env.PAGES_BASE || '/Claude-Anthology-Lab/dog-go/out';
const r = spawnSync('npx', ['next', 'build'], { stdio: 'inherit', shell: true, env: { ...process.env, PAGES_BASE: base } });
if (r.status !== 0) process.exit(r.status ?? 1);

// GitHub Pages runs Jekyll, which drops folders that start with "_" (like _next). A .nojekyll file
// would fix that but also stop the anthology's README from rendering as its home page, so rename
// _next to next and rewrite the references instead.
const TEXT = /\.(html|js|css|txt|json|map)$/;
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (TEXT.test(name)) {
      const s = readFileSync(p, 'utf8');
      if (s.includes('/_next/')) writeFileSync(p, s.split('/_next/').join('/next/'));
    }
  }
};
walk('out');
renameSync('out/_next', 'out/next');
console.log(`\nPages build ready in out/ (base path ${base}, _next renamed to next)`);
