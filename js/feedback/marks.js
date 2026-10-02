// Preflop grade mark (✅ / ⚠️ / ❌) and its one-line reason. Shared by the feedback screen and
// Copy for coach.
const VERB = { raise: 'raises', '3-bet': '3-bets', '4-bet': '4-bets', '5-bet': '5-bets', 'iso-raise': 'iso-raises', squeeze: 'squeezes', call: 'calls', fold: 'folds', overlimp: 'overlimps', limp: 'limps' };
export function preflopMark(d) {
  const parts = String(d.freq || '').split(' · ').map((x) => /^(.*) (\d+)%$/.exec(x)).filter(Boolean).map((m) => ({ act: m[1], p: Number(m[2]) }));
  const top = parts.sort((a, b) => b.p - a.p)[0];
  const chartSays = top ? `Chart ${VERB[top.act.toLowerCase()] || top.act.toLowerCase()} ${d.code} ${top.p}% here` : '';
  if (d.rule) return { mark: d.verdict === 'wrong' ? '❌' : '✅', reason: d.message };
  switch (d.verdict) {
    case 'correct': return { mark: '✅', reason: d.source === 'OUTSIDE' ? d.message.replace(/^No HHP chart covers this open \([^)]*\)\.\s*/, '') : `${chartSays}${chartSays ? ': you did too.' : 'Matches the chart.'}` };
    case 'mixed': return d.source === 'OUTSIDE' ? { mark: '⚠️', reason: 'Borderline: one bracket chart plays it, the other folds it.' } : { mark: '✅', reason: `Mixed cell: the chart plays ${d.freq}. Your play is part of the mix.` };
    case 'situational': return { mark: '⚠️', reason: 'Situational hand: HHP\'s rule decides (below).' };
    case 'wrong': return { mark: '❌', reason: chartSays || d.message };
    default: return { mark: '—', reason: d.message || 'No chart for this spot.' };
  }
}
