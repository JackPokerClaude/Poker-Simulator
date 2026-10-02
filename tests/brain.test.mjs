// Brain loader tests. The first test runs on the real brain/ files on every deploy, so a
// broken upload (missing file, unreadable CSV) stops the deploy and the live site keeps the
// last good brain. It only checks things that must hold; it never pins counts, so normal
// playbook updates always pass.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseCharts, parsePlaybook, parseInstructions, dateTags } from '../js/brain/parse.js';
import { loadBrain, memoryLastGood, missingCharts } from '../js/brain/loader.js';
import { CHARTS_USED } from '../js/engine/scenario.js';
import { gradeDecision } from '../js/grading/grade.js';
import { HAND_ORDER } from '../js/engine/cards.js';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('config/brain-files.json', root), 'utf8'));
const readBrain = async (path) => {
  const u = new URL(path, root);
  if (!existsSync(u)) throw new Error('HTTP 404');
  return readFileSync(u, 'utf8');
};

test('the real brain loads: every listed file present and readable', async () => {
  const brain = await loadBrain({ manifest, fetchText: readBrain, lastGood: memoryLastGood() });
  for (const f of brain.files) assert.equal(f.status, 'ok', `${f.name}: ${f.error}`);
  for (const c of Object.values(brain.charts.charts)) {
    assert.notEqual(c.status, 'SUPERSEDED', `${c.name} is superseded but active`);
    assert.equal(Object.keys(c.hands).length, 169);
  }
  // Soft checks: reported, never fatal, so an edit on your side can't block a deploy.
  const missing = missingCharts(brain, CHARTS_USED);
  if (missing.length) console.log(`# WARNING: charts the app asks for but the CSV lacks: ${missing.join(', ')}`);
  if (!brain.leakTags.length) console.log('# WARNING: no leak tags found in project-instructions.md');
  for (const w of brain.warnings) console.log(`# WARNING: ${w}`);
});

test('date tags: short tags are 2026, full-year tags as written, undated kept', () => {
  assert.deepEqual(dateTags('a [05-12] b [08-25, 09-15] c [2025-07-15 HHP] d [undated HHP] e [5:38] f [BTN VS CO PRO OPEN]'),
    ['2026-05-12', '2026-08-25', '2026-09-15', '2025-07-15', 'undated']);
});

const CSV_HEAD = 'chart,hero_position,scenario,vs,villain_type,hand,aggressive_action,aggressive_pct,call_action,call_pct,other_action,other_pct,fold_pct,source_video,video_date,timestamp,notes,situational';
const csvChart = (name, note = '', open = new Set(['AA'])) => HAND_ORDER.map((h) =>
  `${name},EP,open,,,${h},raise,${open.has(h) ? 100 : 0},,0,,0,${open.has(h) ? 0 : 100},Vid,2026-01-06,0:00,${note},no`).join('\n');

test('charts: SUPERSEDED dropped (kept on record), ACTIVE kept, bad files rejected', () => {
  const text = [CSV_HEAD, csvChart('NEW'), csvChart('OLD', "SUPERSEDED by 2026 'NEW'"), csvChart('KEEP', 'ACTIVE: no 2026 equivalent')].join('\n');
  const r = parseCharts(text);
  assert.deepEqual(Object.keys(r.charts).sort(), ['KEEP', 'NEW']);
  assert.deepEqual(Object.keys(r.superseded), ['OLD']);
  assert.equal(r.charts.KEEP.status, 'ACTIVE');
  assert.equal(r.charts.NEW.hands.AA[0], 100);
  assert.throws(() => parseCharts('chart,hand\nX,AA'), /missing columns/);
  assert.throws(() => parseCharts([CSV_HEAD, csvChart('NEW').split('\n').slice(0, 100).join('\n')].join('\n')), /100 hands, not 169/);
});

test('playbooks: entries, villain catalog, conflicts and open questions', () => {
  const md = [
    '# Test Playbook',
    '*Batch 9 was merged under the rule: every difference is logged as `⚖ CONFLICT: Joan to decide`.*',
    '## 1. Sizing',
    '- **Bet small on dry boards [05-12].** Because reasons.',
    '  - **⚖ CONFLICT: Joan to decide. Turn size vs a capped rec: [09-15] vs [2024-12-17 HHP].**',
    '    | | A | B |',
    '    |---|---|---|',
    '- **Next bullet [06-09].**',
    '',
    '**♣ OPEN #7: Range-bet the flop? (Joan hasn\'t ruled)**',
    '- Options:',
    '  - **(a)** yes',
    '',
    '## 2. Villains',
    '**Whale** [08-25]',
    '- *Range:* Qx, weak pairs.',
    '- *Size:* overbet the turn.',
    '',
    '#### ⚖ Conflicts',
    '**⚖1. Tight nits: bluff them a lot, or less?**',
    '- *[2025-10-28]:* bluff a lot.',
    '- *[2025-01-21 HHP]:* less.',
  ].join('\n');
  const p = parsePlaybook(md, 'test.md');
  assert.equal(p.title, 'Test Playbook');
  assert.equal(p.conflicts.length, 2, 'the backtick mention in the intro is not a conflict');
  const [c1, c2] = p.conflicts;
  assert.equal(c1.title, 'Turn size vs a capped rec: [09-15] vs [2024-12-17 HHP].');
  assert.deepEqual(c1.dates, ['2026-09-15', '2024-12-17']);
  assert.equal(c1.section, '1. Sizing');
  assert.match(c1.text, /\|---\|/);
  assert.equal(c2.title, 'Tight nits: bluff them a lot, or less?');
  assert.match(c2.text, /less\./);
  assert.equal(p.openQuestions.length, 1);
  assert.equal(p.openQuestions[0].id, 'open-7');
  assert.match(p.openQuestions[0].text, /\(a\)/);
  assert.equal(p.villains.length, 1);
  assert.equal(p.villains[0].name, 'Whale');
  assert.deepEqual(p.villains[0].fields.map((f) => f.name), ['Range', 'Size']);
  const small = p.entries.find((e) => /Bet small/.test(e.title));
  assert.deepEqual(small.dates, ['2026-05-12', '2026-09-15', '2024-12-17']);
  assert.ok(small.flags.conflict === false && small.flags.sideBySide === true);
  // Ids are stable across unrelated edits.
  const again = parsePlaybook(md.replace('Because reasons.', 'Because other reasons.'), 'test.md');
  assert.equal(again.conflicts[0].id, c1.id);
});

test('project instructions: leak tags from the list line, not the first mention', () => {
  const txt = ['Leak tags (list below). Say if this repeats.', '', 'Leak tags (Joan can edit this list)', '',
    'limp-pre, bad-sizing, thin-value-too-thin', '', 'Known leaks from her history', 'Tilts. After a loss.', 'How to think through every decision'].join('\n');
  const r = parseInstructions(txt);
  assert.deepEqual(r.leakTags, ['limp-pre', 'bad-sizing', 'thin-value-too-thin']);
  assert.deepEqual(r.knownLeaks, [{ title: 'Tilts', text: 'After a loss.' }]);
  assert.deepEqual(r.warnings, []);
});

test('loader: a bad upload falls back to the last good copy with a notice', async () => {
  const mini = { dir: 'b/', files: [{ name: 'c.csv', kind: 'charts' }, { name: 'p.md', kind: 'playbook' }] };
  const good = { 'b/c.csv': [CSV_HEAD, csvChart('NEW')].join('\n'), 'b/p.md': '# P\n- **x [05-12]**' };
  const store = memoryLastGood();
  const first = await loadBrain({ manifest: mini, fetchText: async (p) => good[p], lastGood: store });
  assert.deepEqual(first.notices, []);
  const broken = await loadBrain({ manifest: mini, fetchText: async (p) => (p.endsWith('.csv') ? 'garbage' : good[p]), lastGood: store });
  assert.equal(broken.files[0].status, 'fallback');
  assert.match(broken.notices[0], /couldn't be read: c\.csv\. Using the last good version/);
  assert.ok(broken.charts.charts.NEW);
  await assert.rejects(loadBrain({ manifest: mini, fetchText: async () => { throw new Error('HTTP 404'); }, lastGood: memoryLastGood() }), /no saved copy/);
});

test('opens with no HHP chart (CO) are graded [OUTSIDE SOURCE] between HJ and BTN', async () => {
  const brain = await loadBrain({ manifest, fetchText: readBrain, lastGood: memoryLastGood() });
  const ranges = brain.charts;
  const bracket = { floor: 'RFI - HJ - 200BB', ceiling: 'RFI - BTN - 200BB' };
  const spot = { kind: 'RFI', chart: bracket.ceiling, exact: false, label: 'x', bracket, seat: 'CO' };
  const opens = (chart, h) => ranges.charts[chart].hands[h][0] > 0;
  const both = HAND_ORDER.find((h) => opens(bracket.floor, h));
  const btnOnly = HAND_ORDER.find((h) => !opens(bracket.floor, h) && opens(bracket.ceiling, h));
  const neither = HAND_ORDER.find((h) => !opens(bracket.ceiling, h));
  const g = (code, action) => gradeDecision({ ranges, spot, code, action });
  assert.equal(g(both, 'raise').verdict, 'correct');
  assert.equal(g(both, 'raise').source, 'OUTSIDE');
  assert.match(g(both, 'raise').message, /^No HHP chart covers this open \(CO\)\./);
  assert.match(g(both, 'raise').sourceTag, /^\[OUTSIDE SOURCE\]/);
  assert.equal(g(both, 'fold').verdict, 'wrong');
  assert.equal(g(btnOnly, 'raise').verdict, 'mixed');
  assert.equal(g(btnOnly, 'fold').verdict, 'mixed');
  assert.equal(g(neither, 'raise').verdict, 'wrong');
  assert.equal(g(neither, 'fold').verdict, 'correct');
  assert.equal(g(both, 'call').verdict, 'wrong');
  // A chart-covered open is tagged [HHP] with its video.
  const hj = gradeDecision({ ranges, spot: { kind: 'RFI', chart: 'RFI - HJ - 200BB', exact: true, label: 'x' }, code: both, action: 'raise' });
  assert.equal(hj.source, 'HHP');
  assert.match(hj.sourceTag, /^\[HHP\] RFI - HJ - 200BB · Live Poker Preflop Guide \(2026\) 2026-01-06$/);
});

test('the offline cache lists every app file', async () => {
  const { readdirSync, statSync } = await import('node:fs');
  const sw = readFileSync(new URL('sw.js', root), 'utf8');
  const walk = (dir) => readdirSync(new URL(dir, root)).flatMap((f) => (statSync(new URL(`${dir}/${f}`, root)).isDirectory() ? walk(`${dir}/${f}`) : [`${dir}/${f}`]));
  const files = [...walk('js'), ...walk('config'), 'brain-compiled/behavior.json'].filter((f) => /\.(js|json)$/.test(f));
  for (const f of files) assert.ok(sw.includes(`'${f}'`), `${f} missing from sw.js ASSETS`);
});

test('every browser file parses (catches errors tests never import, like app.js)', async () => {
  const { execFileSync } = await import('node:child_process');
  const { readdirSync, statSync } = await import('node:fs');
  const walk = (dir) => readdirSync(new URL(dir, root)).flatMap((f) => (statSync(new URL(`${dir}/${f}`, root)).isDirectory() ? walk(`${dir}/${f}`) : [`${dir}/${f}`]));
  for (const f of [...walk('js'), ...walk('config'), 'sw.js'].filter((x) => x.endsWith('.js') && !x.includes('vendor'))) {
    execFileSync(process.execPath, ['--check', fileURLToPath(new URL(f, root))], { stdio: 'pipe' });
  }
});

test('matcher coverage: every postflop topic is covered or has a reason', async () => {
  const { matcherCoverage } = await import('../js/brain/coverage.js');
  const { resolveCompiled } = await import('../js/brain/compiled.js');
  const { UNCOVERED_REASONS } = await import('../config/matcher-uncovered.js');
  const texts = {};
  for (const f of manifest.files) texts[f.name] = readFileSync(new URL(`brain/${f.name}`, root), 'utf8');
  const resolved = resolveCompiled(JSON.parse(readFileSync(new URL('brain-compiled/behavior.json', root), 'utf8')), texts);
  const c = matcherCoverage(texts, resolved, UNCOVERED_REASONS);
  assert.ok(c.total > 50, `only ${c.total} topics found`);
  for (const t of c.uncovered) assert.ok(t.reason, `no rule and no reason: ${t.file} › ${t.title}`);
  console.log(`# matcher coverage ${c.covered}/${c.total}`);
});

test('rulings: every conflict and open question has views to rule on; default Undecided; never read by grading', async () => {
  const { viewsOf, optionsOf } = await import('../js/brain/views.js');
  const { loadRulings, setRuling, rulingOf, UNDECIDED } = await import('../js/storage/rulings.js');
  const brain = await loadBrain({ manifest, fetchText: readBrain, lastGood: memoryLastGood() });
  const cs = brain.conflicts.filter((c) => !c.summary);
  assert.ok(cs.length >= 40 && brain.openQuestions.length >= 3);
  for (const c of cs) assert.ok(viewsOf(c).length >= 2, c.title);
  for (const q of brain.openQuestions) assert.ok(optionsOf(q).length >= 2, q.title);
  assert.equal(new Set(cs.map((c) => c.id)).size, cs.length, 'conflict ids are unique');
  // Default Undecided, set and clear.
  const id = cs[0].id;
  assert.equal(rulingOf(id), UNDECIDED);
  setRuling(id, 'view:1', { title: cs[0].title });
  assert.equal(rulingOf(id), 'view:1');
  setRuling(id, UNDECIDED);
  assert.equal(rulingOf(id), UNDECIDED);
  assert.deepEqual(loadRulings(), {});
  // The grading side never reads rulings: they are records for the brain session only.
  for (const f of ['js/feedback/engine.js', 'js/feedback/match.js', 'js/grading/grade.js', 'js/engine/scenario.js']) {
    assert.ok(!/rulings/.test(readFileSync(new URL(f, root), 'utf8')), `${f} must not read rulings`);
  }
});
