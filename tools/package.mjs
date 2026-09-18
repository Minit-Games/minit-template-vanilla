// Assemble, verify, and produce the ZIP to upload at https://console.minit.games
//
//   npm run package
//
// Node rather than bash: this is the only packaging entry point, and it has to
// work on Windows, where bash, zip, unzip and du do not exist. The staged file
// list below is the single spelling of it -- a second copy in a .cmd sibling is
// what once shipped a build with the root CSS missing.
//
// There is no build step -- the files the browser loads are the files in this
// folder. dist/ is a STAGING copy, not a build output: it holds exactly what
// the ZIP should contain, so the checks run against the real shipped shape.
//
// The Creator Console rejects an upload that still looks like a source tree, so
// package.json, tools/ and node_modules are deliberately left out, and the game
// code lives in js/ rather than src/ for the same reason.
import { spawnSync } from 'node:child_process';
import { cp, mkdir, readFile, rename, rm, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { zipDir } from './zip.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);

// The archive is named from package.json, so a fork that renames the project
// gets a correctly named upload without having to remember to edit this file.
const { name: NAME } = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));
const OUT = join('dist', `${NAME}.zip`);

// Everything the ZIP contains, and nothing else. One list, one file.
const FILES = ['index.html', 'meta.json', 'THIRD-PARTY-NOTICES.txt'];
const DIRS = ['js', 'vendor'];

function run(script, args = []) {
	// process.execPath, not "node": no shell, no PATH lookup, and the same Node
	// that is running this file.
	const r = spawnSync(process.execPath, [script, ...args], { stdio: 'inherit' });
	if (r.status !== 0) { process.exit(r.status ?? 1); }
}

console.log('==> staging');
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
for (const f of FILES) { await cp(f, join('dist', f)); }
for (const d of DIRS) { await cp(d, join('dist', d), { recursive: true }); }
// The vendoring note is for this repo, not for players.
await rm(join('dist', 'vendor', 'minit-sdk', 'README.md'), { force: true });

console.log('==> pre-flight');
run(join('tools', 'check-meta.mjs'));

console.log('==> audio');
// A build that is silent inside the app looks healthy from every other angle,
// so this measures the audio graph rather than trusting a flag. It is in the
// packaging path deliberately: a silent build cannot be shipped.
run(join('tools', 'verify-audio.mjs'));

console.log('==> packaging');
await rm(OUT, { force: true });
// Build the archive outside dist/ and move it in, so it can never contain a
// copy of itself however the file walk is ordered.
const staging = join(ROOT, `.${NAME}.zip.tmp`);
const { bytes, names } = await zipDir(join(ROOT, 'dist'), staging);
await rename(staging, join(ROOT, OUT));

const kb = (n) => (n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`);
console.log(`\nwrote ${OUT} (${kb(bytes)})`);
for (const n of names) {
	console.log(`  ${String((await stat(join(ROOT, 'dist', n))).size).padStart(9)}  ${n}`);
}
console.log(`\nUpload ${OUT} at https://console.minit.games`);
