// How much of the postflop playbook the "Also from the brain" matcher covers.
//
// A topic is one bold-headed paragraph of a numbered `## ` section plus the bullets under it
// (or a section's bullets before its first bold paragraph). A topic is covered when at least one
// [HHP] matcher entry (rules.* or conflicts.* in the compiled layer) quotes a line inside it.
// Topics nothing covers are listed in Settings › Brain with the reason from
// config/matcher-uncovered.js (or "no reason yet").
import { normalizeText } from './compiled.js';

export const COVERAGE_FILES = ['playbook-postflop.md', 'playbook-postflop-weakness-and-position.md', 'playbook-postflop-bluffs-and-rivers.md'];

const cleanTitle = (s) => s.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
export const topicKey = (file, title) => `${file}|${normalizeText(title).slice(0, 48)}`;

export function topicsOf(text, file) {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let section = null, cur = null;
  const close = (end) => { if (cur) { cur.to = end; if (cur.body) out.push(cur); cur = null; } };
  lines.forEach((raw, i) => {
    const n = i + 1;
    const h = /^(#{1,6})\s+(.*)$/.exec(raw);
    if (h) {
      close(n - 1);
      section = h[1].length === 2 && /^\d+\./.test(h[2].trim()) ? h[2].trim() : h[1].length <= 2 ? null : section;
      if (section) cur = { file, section, title: section, from: n + 1, body: 0 };
      return;
    }
    if (!section) return;
    if (/^---+\s*$/.test(raw)) { close(n - 1); section = null; return; }
    const bold = /^\*\*(.+?)\*\*/.exec(raw);
    if (bold) {
      close(n - 1);
      cur = { file, section, title: cleanTitle(bold[1]).replace(/[.:]$/, ''), from: n, body: 0 };
    }
    if (cur && raw.trim()) cur.body++;
  });
  close(lines.length);
  for (const t of out) { t.key = topicKey(file, t.title); delete t.body; }
  return out;
}

// Line number of a quote in a file (1-based), or null.
function quoteLine(normLines, quote) {
  const q = normalizeText(quote);
  for (let i = 0; i < normLines.length; i++) if (normLines[i].includes(q)) return i + 1;
  for (let i = 0; i < normLines.length - 1; i++) if (`${normLines[i]} ${normLines[i + 1]}`.includes(q)) return i + 1;
  return null;
}

// texts: { file: raw text }. resolved: the resolved compiled layer. reasons: { topicKey: why }.
export function matcherCoverage(texts, resolved, reasons = {}) {
  const entries = Object.entries(resolved?.values || {})
    .filter(([k, r]) => (k.startsWith('rules.') || k.startsWith('conflicts.')) && r.tag === 'HHP' && COVERAGE_FILES.includes(r.src.file));
  const files = COVERAGE_FILES.filter((f) => texts[f] != null);
  const topics = [];
  for (const f of files) {
    const normLines = texts[f].replace(/\r\n?/g, '\n').split('\n').map(normalizeText);
    const ts = topicsOf(texts[f], f);
    for (const [key, r] of entries) {
      if (r.src.file !== f) continue;
      const ln = quoteLine(normLines, r.src.quote);
      const t = ln != null && ts.find((x) => ln >= x.from && ln <= x.to);
      if (t) (t.by ||= []).push(key);
    }
    topics.push(...ts);
  }
  const covered = topics.filter((t) => t.by?.length);
  const uncovered = topics.filter((t) => !t.by?.length).map((t) => ({ ...t, reason: reasons[t.key] || null }));
  return { total: topics.length, covered: covered.length, topics, uncovered };
}
