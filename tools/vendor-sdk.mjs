// Copy the @minit-games/sdk modules this template imports into vendor/, verbatim.
//
//   node tools/vendor-sdk.mjs
//
// This template has NO build step, so it cannot resolve the bare specifier
// `@minit-games/sdk` the way a bundler would -- the browser needs real paths.
// The files are copied unmodified and imported by relative path.
//
// It deliberately does NOT vendor the package's barrel (dist/index.js). The
// barrel statically re-exports ./modules/random.js, which imports `seedrandom`
// -- a CommonJS package with no ESM build. A browser would fail on that bare
// specifier even though nothing here uses seeded random. Importing the modules
// directly sidesteps it with no import map and no shim, and keeps every
// vendored byte identical to what npm ships.
//
// A project WITH a bundler should skip all of this: npm install
// @minit-games/sdk and import from the package name as the docs show.
import { mkdir, copyFile, readFile, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'vendor/minit-sdk');

// Exactly what js/ imports. Keep in step with the imports there.
const FILES = [
	'utils.js',
	'modules/config.js',
	'modules/result.js',
	'modules/loadingDone.js',
	'modules/userData.js',
	'modules/audioVisibility.js',
];

// Pull the package into a scratch dir rather than requiring a node_modules
// here -- this template has no runtime dependencies to install.
const TMP = join(ROOT, '.cache/sdk');
await rm(TMP, { recursive: true, force: true });
await mkdir(TMP, { recursive: true });
await writeFile(join(TMP, 'package.json'), '{"name":"x","private":true}\n');
console.log('  fetching @minit-games/sdk');
execFileSync('npm', ['install', '--silent', '--no-audit', '--no-fund', '@minit-games/sdk'], { cwd: TMP });

const DIST = join(TMP, 'node_modules/@minit-games/sdk/dist');
const version = JSON.parse(await readFile(join(TMP, 'node_modules/@minit-games/sdk/package.json'), 'utf8')).version;

await rm(OUT, { recursive: true, force: true });
let total = 0;
for (const f of FILES) {
	const src = join(DIST, f);
	if (!existsSync(src)) { throw new Error(`missing from the package: ${f}`); }
	const dst = join(OUT, f);
	await mkdir(dirname(dst), { recursive: true });
	await copyFile(src, dst);
	total += (await readFile(src)).length;
}

// A note beside the copies, so nobody edits them by hand.
await writeFile(join(OUT, 'README.md'),
	`# Vendored from @minit-games/sdk@${version}\n\n` +
	'These files are copied VERBATIM by `tools/vendor-sdk.mjs`. Do not edit them\n' +
	'here -- re-run that script to update, and change the file list there if the\n' +
	'game starts importing more of the SDK.\n\n' +
	'The package\'s barrel (`dist/index.js`) is deliberately not vendored: it\n' +
	'statically re-exports `modules/random.js`, which imports `seedrandom`, a\n' +
	'CommonJS package with no ESM build that a browser cannot resolve without a\n' +
	'bundler or an import map. Nothing here uses seeded random, so the modules are\n' +
	'imported directly instead.\n');

console.log(`  vendored ${FILES.length} files (${(total / 1024).toFixed(1)} KB) from @minit-games/sdk@${version}`);
await rm(TMP, { recursive: true, force: true });
