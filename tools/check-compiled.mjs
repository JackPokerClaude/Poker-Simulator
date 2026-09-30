#!/usr/bin/env node
// Strict check of the compiled layer against the brain: every quote must still be in the file
// it cites. Run after editing tools/build-compiled.mjs ("recompile brain"). Exit 1 if stale.
import { readFileSync } from 'node:fs';
import { resolveCompiled } from '../js/brain/compiled.js';

const root = new URL('../', import.meta.url);
const compiled = JSON.parse(readFileSync(new URL('brain-compiled/behavior.json', root), 'utf8'));
const manifest = JSON.parse(readFileSync(new URL('config/brain-files.json', root), 'utf8'));
const texts = Object.fromEntries(manifest.files.map((f) => [f.name, readFileSync(new URL(`brain/${f.name}`, root), 'utf8')]));
const r = resolveCompiled(compiled, texts);
console.log(`Compiled values: ${r.counts.total} (${r.counts.sourced} [HHP], ${r.counts.interpreted} of them interpreted, ${r.counts.outside} [OUTSIDE SOURCE], ${r.counts.stale} stale).`);
for (const s of r.stale) console.log(`STALE ${s.key}: "${s.quote}" not found in ${s.file}`);
process.exit(r.stale.length ? 1 : 0);
