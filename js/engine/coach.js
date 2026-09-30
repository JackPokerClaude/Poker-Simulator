// Builds the "Copy for coach" hand text and the saved history record.
import { VILLAIN_CONFIG } from '../../config/villains.js';
import { cardsPretty, cardStr } from './cards.js';

const who = (s, i) => (i === s.heroIdx ? `Hero (${s.players[i].pos})` : s.players[i].pos);
const RAISE_WORD = ['open', '3-bet', '4-bet', '5-bet', '6-bet'];

export function describeAction(s, e) {
  const name = who(s, e.i);
  const allIn = e.allIn ? ' (all-in)' : '';
  if (e.type === 'uncalled') return `$${-e.added} uncalled returned to ${name}`;
  if (e.street === 'preflop') {
    if (e.type === 'fold') return `${name} folds`;
    if (e.type === 'check') return `${name} checks`;
    if (e.type === 'call') {
      if (e.level === 1) return e.pos === 'SB' ? `${name} completes $${e.to}` : `${name} limps $${e.to}${allIn}`;
      return `${name} calls $${e.to}${allIn}`;
    }
    if (e.type === 'raise') {
      const limped = e.level === 1 && s.log.some((x) => x.street === 'preflop' && x.type === 'call' && x.level === 1 && s.log.indexOf(x) < s.log.indexOf(e));
      const word = e.level === 1 ? (limped ? 'isos' : 'opens') : `${RAISE_WORD[e.level - 1] || 'raises'}s`;
      return `${name} ${word} to $${e.to}${allIn}`;
    }
  }
  if (e.type === 'fold') return `${name} folds`;
  if (e.type === 'check') return `${name} checks`;
  if (e.type === 'call') return `${name} calls $${e.to}${allIn}`;
  if (e.type === 'bet') return `${name} bets $${e.to}${allIn}`;
  if (e.type === 'raise') return `${name} raises to $${e.to}${allIn}`;
  return '';
}

// Collapse runs of folds: "UTG, UTG+1, LJ fold".
function streetLine(s, street) {
  const es = s.log.filter((e) => e.street === street && !['post', 'deal'].includes(e.type));
  const parts = [];
  let folds = [];
  const flush = () => {
    if (folds.length === 1) parts.push(`${folds[0]} folds`);
    else if (folds.length > 1) parts.push(`${folds.join(', ')} fold`);
    folds = [];
  };
  for (const e of es) {
    if (e.type === 'fold') { folds.push(who(s, e.i)); continue; }
    flush();
    parts.push(describeAction(s, e));
  }
  flush();
  return parts.join(', ');
}

export function involvedVillains(s) {
  const vol = new Set(s.log.filter((e) => e.i !== s.heroIdx && (e.type === 'call' || e.type === 'raise' || e.type === 'bet')).map((e) => e.i));
  const sawFlop = s.log.some((e) => e.type === 'deal') ? s.players.filter((p) => !p.isHero && !foldedPreflop(s, p.i)).map((p) => p.i) : [];
  for (const i of sawFlop) vol.add(i);
  return [...vol].sort((a, b) => a - b).map((i) => s.players[i]);
}
const foldedPreflop = (s, i) => s.log.some((e) => e.street === 'preflop' && e.i === i && e.type === 'fold');

export function effectiveStack(s) {
  const hero = s.players[s.heroIdx];
  const vs = involvedVillains(s);
  const biggest = vs.length ? Math.max(...vs.map((p) => p.startStack)) : hero.startStack;
  return Math.min(hero.startStack, biggest);
}

// Who may have their hole cards shown at the end of the hand: the hero, anyone who saw the
// flop or later (even if they folded postflop), and anyone who made a preflop raise
// (open, iso, 3-bet, 4-bet, 5-bet) even if they folded preflop to a re-raise.
export function isInvolved(s, i) {
  if (i === s.heroIdx) return true;
  const sawFlop = s.log.some((e) => e.type === 'deal' && e.street === 'flop') && !foldedPreflop(s, i);
  const raisedPreflop = s.log.some((e) => e.street === 'preflop' && e.i === i && e.type === 'raise');
  return sawFlop || raisedPreflop;
}

// Short status for an involved player at the end of the hand (no dollar amounts).
export function statusOf(s, i) {
  const sd = s.result?.showdown?.hands[i];
  if (sd) return sd.name;
  const fold = s.log.find((e) => e.i === i && e.type === 'fold');
  if (fold) {
    const raised = s.log.some((e) => e.street === 'preflop' && e.i === i && e.type === 'raise');
    if (fold.street === 'preflop') return raised ? 'folded to a re-raise' : 'folded';
    return `folded on the ${fold.street}`;
  }
  return s.result?.won[i] > 0 ? 'won, no showdown' : '';
}

const nameOf = (s, i, you) => (i === s.heroIdx ? (you ? 'You' : `Hero (${s.players[i].pos})`) : s.players[i].pos);

// Who won and with what hand. No dollar amounts.
export function winnerLine(s, you = false) {
  const r = s.result;
  const winners = Object.keys(r.won).map(Number).filter((i) => r.won[i] > 0);
  const verb = (i) => (i === s.heroIdx && you ? 'win' : 'wins');
  if (!r.showdown) {
    const names = winners.map((i) => nameOf(s, i, you));
    const plural = winners.length > 1 || (winners[0] === s.heroIdx && you);
    return `${names.join(' and ')} ${plural ? 'win' : 'wins'} (no showdown).`;
  }
  return `${winners.map((i) => `${nameOf(s, i, you)} ${verb(i)} with ${r.showdown.hands[i].descr}`).join('; ')}.`;
}

// Coach "Result": showdown hands, who won, and the cards of other involved players. No dollar amounts.
export function resultText(s) {
  const r = s.result;
  const parts = [];
  if (r.showdown) {
    const shown = Object.entries(r.showdown.hands).map(([i, h]) => `${nameOf(s, Number(i), false)} ${cardsPretty(s.players[i].cards)} (${h.descr})`);
    parts.push(`Showdown: ${shown.join(' vs ')}.`);
  }
  parts.push(winnerLine(s, false));
  if (!r.showdown) {
    const heroFold = s.log.find((e) => e.i === s.heroIdx && e.type === 'fold');
    if (heroFold) parts.push(`Hero folded ${heroFold.street === 'preflop' ? 'preflop' : `on the ${heroFold.street}`}.`);
  }
  const others = s.players
    .filter((p) => !p.isHero && isInvolved(s, p.i) && !r.showdown?.hands[p.i])
    .map((p) => `${p.pos} ${cardsPretty(p.cards)} (${statusOf(s, p.i)})`);
  if (others.length) parts.push(`Also shown: ${others.join(', ')}.`);
  return parts.join(' ');
}

export function coachText(s) {
  const hero = s.players[s.heroIdx];
  const bb = s.stakes.bb;
  const eff = effectiveStack(s);
  const villains = involvedVillains(s).map((p) => {
    const t = VILLAIN_CONFIG.types[p.type];
    return `${p.pos}, $${p.startStack} (${Math.round(p.startStack / bb)}bb), ${t.label}, reads: ${p.reads.join('; ')}`;
  });
  const street = (name, n) => {
    const deal = s.log.find((e) => e.type === 'deal' && e.street === name);
    const label = name[0].toUpperCase() + name.slice(1);
    if (!deal) return `${label}: not reached`;
    const cards = name === 'flop' ? cardsPretty(deal.board.slice(0, 3)) : cardsPretty([deal.board[n]]);
    const line = streetLine(s, name);
    return `${label} [${cards}] (pot $${deal.pot}): ${line || 'no betting (all-in)'}`;
  };
  return [
    `Stakes / venue: $${s.stakes.sb}/$${s.stakes.bb} NLHE, Simulator`,
    `Effective stack ($): $${eff} (${Math.round(eff / bb)}bb)`,
    `Hero seat + cards: ${hero.pos}, ${cardsPretty(hero.cards)} ($${hero.startStack})`,
    `Villain(s): ${villains.length ? villains.join(' | ') : 'none (everyone folded)'}`,
    `Preflop: ${streetLine(s, 'preflop')}`,
    street('flop', 0),
    street('turn', 3),
    street('river', 4),
    `Result: ${resultText(s)}`,
    'My question: Review every decision street by street.',
  ].join('\n');
}

export function buildRecord(s) {
  const hero = s.players[s.heroIdx];
  const flopDeal = s.log.find((e) => e.type === 'deal' && e.street === 'flop');
  const sawFlop = flopDeal ? s.players.filter((p) => !foldedPreflop(s, p.i)).length : 0;
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    ts: new Date().toISOString(),
    drill: s.drill.mode,
    stakes: s.stakes.label,
    heroPos: hero.pos,
    heroCards: hero.cards.map(cardStr).join(''),
    heroCode: s.heroCode,
    spot: { kind: s.spot.kind, chart: s.spot.chart, exact: s.spot.exact },
    decisions: s.heroDecisions.map((d) => ({
      kind: d.kind, label: d.label, chart: d.chart, exact: d.exact, code: d.code, heroAction: d.heroAction || d.action,
      to: d.to, verdict: d.verdict, message: d.message, freq: d.freq || '', source: d.source || '', sourceTag: d.sourceTag || '',
      sizing: (d.sizing || []).map((z) => ({ rule: z.rule, ok: z.ok, message: z.message })),
    })),
    net: s.result.net[s.heroIdx],
    netBB: +(s.result.net[s.heroIdx] / s.stakes.bb).toFixed(1),
    pot: s.result.finalPot,
    sawFlop,
    reachedRiver: s.log.some((e) => e.type === 'deal' && e.street === 'river'),
    threeBetPot: s.log.some((e) => e.street === 'preflop' && e.type === 'raise' && e.level >= 2),
    coachText: coachText(s),
  };
}
