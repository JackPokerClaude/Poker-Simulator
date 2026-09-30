import { createHand, heroAct, villainAct, DRILLS } from './engine/dealer.js';
import { legalActions, validateRaise, dealNextStreet, potTotal } from './engine/game.js';
import { RANKS, SUITS, SUIT_SYMBOLS, rankOf, suitOf, cardsPretty } from './engine/cards.js';
import { describeAction, buildRecord, winnerLine, isInvolved, statusOf } from './engine/coach.js';
import { quickSizes, clampTo, sliderToAmount, amountToSlider, potPercent, SLIDER_MAX } from './ui/sizing.js';
import { layoutFor, chipCenter } from './ui/layout.js';
import { buildModel, setModel, villainLabel, getModel } from './villains/model.js';
import { loadHistory, addHand, updateHand, clearHistory, computeStats, exportCSV, importCSV } from './storage/history.js';
import { loadBrain, browserFetchText, browserLastGood, missingCharts } from './brain/loader.js';
import { CHARTS_USED } from './engine/scenario.js';
import { buildFeedback } from './feedback/engine.js';
import { feedbackHTML } from './feedback/render.js';
import { rebuildHand } from './feedback/replay.js';
import { preflopMark } from './feedback/marks.js';
import { coachReport } from './feedback/coach-report.js';
import { clearGrids, gridDetail, gridClassInfo } from './ui/grid.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- settings (per-device conveniences) ----------
const SETTINGS_KEY = 'hhp-sim-settings-v1';
const settings = (() => {
  const d = { speed: 'normal', fourColor: true, drill: 'random' };
  try { return { ...d, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; } catch { return d; }
})();
const saveSettings = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* private mode */ } };
const SPEEDS = { normal: { act: 650, deal: 700 }, fast: { act: 260, deal: 380 }, instant: { act: 0, deal: 60 } };

// ---------- state ----------
let ranges = null;
let brain = null;
let model = null;
let hand = null;
let handToken = 0;
let pendingTo = null;
let lastRecord = null;
let liveSheet = null; // 'reads' | 'log' while that drawer tab is open, so it updates as villains act
let drawerTab = 'reads';
let geo = layoutFor(380, 330); // current table layout + scale, updated on resize

// ---------- cards ----------
function cardHTML(c, cls = '') {
  const s = SUITS[suitOf(c)];
  return `<div class="card ${s} ${cls}"><span class="r">${RANKS[rankOf(c)] === 'T' ? '10' : RANKS[rankOf(c)]}</span><span class="s">${SUIT_SYMBOLS[s]}</span></div>`;
}
const backHTML = () => '<div class="card-back"></div>';

// ---------- table rendering ----------
// After the hand, stacks show as they were before the payout, so no win/loss appears in the numbers.
const shownStack = (p) => (hand.done ? p.stack - hand.result.won[p.i] : p.stack);

function seatTag(p) {
  if (hand.done && hand.result.showdown && hand.result.showdown.hands[p.i]) return hand.result.showdown.hands[p.i].name;
  if (p.folded) return 'Fold';
  if (p.allIn) return 'All-in';
  const last = [...hand.log].reverse().find((e) => e.i === p.i && e.street === hand.street && e.type !== 'uncalled');
  if (!last) return '';
  if (last.type === 'post') return last.added === hand.stakes.sb && p.pos === 'SB' ? 'SB' : 'BB';
  if (last.type === 'call' && hand.street === 'preflop' && last.level === 1) return 'Limp';
  return { check: 'Check', call: 'Call', bet: 'Bet', raise: 'Raise', fold: 'Fold' }[last.type] || '';
}

// The pot is always visible above the table and follows every bet, call and raise.
function renderPot() {
  const h = hand;
  const pot = h ? (h.done ? h.result.finalPot : potTotal(h)) : 0;
  const el = $('pot');
  const changed = el.dataset.v !== undefined && el.dataset.v !== String(pot);
  el.dataset.v = String(pot);
  el.innerHTML = `<span class="lbl">Pot</span><b>$${pot}</b>`;
  if (changed) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
}

// Put each chip just in front of its seat, measured from the seat's real box on screen.
function placeChips() {
  const tw = $('tableWrap').getBoundingClientRect();
  const gap = 4 * geo.k;
  for (const chip of document.querySelectorAll('#seats .chip')) {
    const seat = document.querySelector(`#seats .seat[data-seat="${chip.dataset.chip}"]`);
    const rule = geo.chips[Number(chip.dataset.slot)];
    if (!seat || !rule) continue;
    const r = seat.getBoundingClientRect();
    const s = { left: r.left - tw.left, right: r.right - tw.left, top: r.top - tw.top, bottom: r.bottom - tw.top };
    const cw = chip.offsetWidth;
    const [x, cy] = chipCenter(rule, s, cw, chip.offsetHeight, tw.width, gap);
    const cx = Math.max(cw / 2 + 2, Math.min(tw.width - cw / 2 - 2, x)); // keep it on the table
    chip.style.left = `${cx}px`;
    chip.style.top = `${cy}px`;
  }
}

function renderTable() {
  renderTable.chipKey ||= {};
  const h = hand;
  $('stakes').textContent = h ? `$${h.stakes.sb}/$${h.stakes.bb}` : '—';
  $('drillName').textContent = DRILLS[settings.drill].name;
  renderPot();
  if (!h) return;
  const heroIdx = h.heroIdx;
  const winners = h.done ? new Set(Object.entries(h.result.won).filter(([, v]) => v > 0).map(([i]) => Number(i))) : new Set();

  // Board
  const slots = [];
  for (let k = 0; k < 5; k++) {
    const c = h.board[k];
    slots.push(c === undefined ? '<div class="card slot"></div>' : cardHTML(c, renderTable.shown > k ? '' : 'deal-in'));
  }
  renderTable.shown = h.board.length;
  $('board').innerHTML = slots.join('');

  // Seats. At the end of the hand only involved players' cards are turned face up.
  const out = [];
  for (let k = 1; k < 8; k++) {
    const i = (heroIdx + k) % 8;
    const p = h.players[i];
    const [x, y] = geo.seats[k];
    const showCards = h.done && isInvolved(h, i);
    const cards = showCards
      ? p.cards.map((c) => cardHTML(c, 'sm' + (p.folded ? ' dim' : ''))).join('')
      : (!h.done && !p.folded ? backHTML() + backHTML() : '');
    const cls = ['seat', p.folded && !showCards ? 'folded' : '', h.toAct === i ? 'acting' : '', winners.has(i) ? 'winner' : ''].join(' ');
    out.push(`<button class="${cls}" style="left:${x}%;top:${y}%" data-seat="${i}">
      ${p.pos === 'BTN' ? '<span class="dealer">D</span>' : ''}
      <div class="pos">${p.pos}</div>
      <div class="stack">$${shownStack(p)}</div>
      <div class="mini-cards">${cards}</div>
      <div class="tag">${esc(seatTag(p))}</div>
    </button>`);
    // Chips in front of the player for what they have put in this street (bet, raise or call).
    if (p.committed > 0 && !p.folded && !h.done) {
      const bb = h.stakes.bb;
      const tier = p.committed >= 20 * bb ? 'c3' : p.committed >= 5 * bb ? 'c2' : 'c1';
      const key = `${h.street}:${p.committed}`;
      const pop = renderTable.chipKey[i] !== key ? ' pop' : '';
      renderTable.chipKey[i] = key;
      out.push(`<div class="chip ${tier}${pop}" data-chip="${i}" data-slot="${k}"><i></i><b>$${p.committed}</b></div>`);
    } else {
      delete renderTable.chipKey[i];
    }
  }
  const hero = h.players[heroIdx];
  $('seats').innerHTML = out.join('');
  placeChips();

  const bbs = Math.round(shownStack(hero) / h.stakes.bb);
  $('heroHand').className = `hero-hand${h.toAct === heroIdx ? ' acting' : ''}`;
  $('heroHand').innerHTML = `<div class="cards">${hero.cards.map((c) => cardHTML(c, 'big')).join('')}</div>
    <div class="meta"><span class="pos">${hero.pos === 'BTN' ? 'BTN (D)' : hero.pos}</span>$${shownStack(hero)} · ${bbs}bb${hero.folded ? ' · folded' : ''}${hero.committed > 0 && !h.done ? `<span class="mybet">bet $${hero.committed}</span>` : ''}</div>`;
}

// Action log (shown in the Log sheet).
function logHTML() {
  const h = hand;
  if (!h) return '';
  const lines = [`<div class="log-street">Preflop <span class="b">blinds $${h.stakes.sb}/$${h.stakes.bb}</span></div>`];
  for (const e of h.log) {
    if (e.type === 'post') continue;
    if (e.type === 'deal') {
      const name = e.street[0].toUpperCase() + e.street.slice(1);
      const cards = e.street === 'flop' ? cardsPretty(e.board) : cardsPretty([e.board[e.board.length - 1]]);
      lines.push(`<div class="log-street">${name} <span class="b">${cards} · pot $${e.pot}</span></div>`);
      continue;
    }
    const txt = describeAction(h, e);
    if (!txt) continue;
    const cls = e.i === h.heroIdx ? 'hero' : e.type === 'fold' ? 'fold' : '';
    lines.push(`<div class="log-line ${cls}">${esc(txt)}</div>`);
  }
  if (h.done) lines.push(`<div class="log-street">Result</div><div class="log-line hero">${esc(winnerLine(h, true))}</div>`);
  return lines.join('');
}

// "[HHP] playbook-villains.md · 2026-02-17" for a read, short enough for the card.
function readTag(key) {
  const rec = key && getModel().rec(key);
  if (!rec) return '';
  return rec.tag === 'HHP' ? `[HHP] ${rec.src.file}${rec.src.date ? ` · ${rec.src.date}` : ''}` : '[OUTSIDE SOURCE]';
}

// One full-width card per villain (Reads sheet): players still in the hand first.
function readsHTML(flashSeat) {
  const h = hand;
  if (!h) return '';
  const seats = [1, 2, 3, 4, 5, 6, 7].map((k) => h.players[(h.heroIdx + k) % 8]);
  const ordered = [...seats.filter((p) => !p.folded), ...seats.filter((p) => p.folded)];
  return ordered.map((p) => {
    const status = p.folded ? 'Folded' : p.allIn ? 'All-in' : 'In hand';
    const type = h.done ? `<div class="rc-type">${esc(villainLabel(p))}</div>` : '';
    return `<div class="read-card${p.folded ? ' out' : ''}${flashSeat === p.i ? ' flash' : ''}" id="read-${p.i}">
      <div class="rc-top"><span class="rc-pos">${p.pos}</span><span class="rc-stack">$${shownStack(p)} · ${Math.round(shownStack(p) / h.stakes.bb)}bb</span><span class="rc-status">${status}</span></div>
      ${type}
      <div class="rc-read">${p.reads.map((r, k) => `${esc(r)}<span class="rc-src">${esc(readTag(p.readKeys?.[k]))}</span>`).join('<br>') || 'No reads yet.'}</div>
    </div>`;
  }).join('');
}

// ---------- action bar ----------
const raiseWord = (la, to) => (to === la.maxTo ? 'All-in' : la.isBet ? 'Bet' : 'Raise to');

// Most recent bet or raise on the current street (null if there has been none).
function lastAggression(h) {
  for (let k = h.log.length - 1; k >= 0; k--) {
    const e = h.log[k];
    if (e.type === 'deal') return null;
    if (e.street === h.street && (e.type === 'bet' || e.type === 'raise')) return e;
  }
  return null;
}

// One row above the hero's actions: Pot before -> villain bet -> Pot now, then what it costs to call.
function potLineHTML(h, la) {
  const pot = potTotal(h);
  const agg = la.toCall > 0 ? lastAggression(h) : null;
  const seg = (label, val, cls = '') => `<div class="pl ${cls}"><i>${label}</i><b>$${val}</b></div>`;
  const call = la.toCall > 0
    ? `<div class="tocall"><i>To call:</i><b>$${la.toCall}</b></div>`
    : '<div class="tocall none"><i>No bet</i><b>Check or bet</b></div>';
  if (agg && agg.i !== h.heroIdx) {
    const verb = agg.type === 'bet' ? 'bets' : agg.street === 'preflop' && agg.level === 1 ? 'opens' : 'raises';
    return `<div class="potline">${seg('Pot before:', agg.potBefore)}<span class="arr">→</span>${seg(`${esc(agg.pos)} ${verb}`, agg.to, 'hot')}<span class="arr">→</span>${seg('Pot now:', pot)}${call}</div>`;
  }
  return `<div class="potline">${seg('Pot now:', pot)}${call}</div>`;
}

function renderActionBar() {
  const bar = $('actionbar');
  const h = hand;
  bar.classList.toggle('done', !!h?.done);
  if (!h) { bar.innerHTML = '<div class="status"><b>Dealing…</b></div>'; return; }
  if (h.done) {
    bar.innerHTML = `
      <div class="resultline">${esc(winnerLine(h, true))}</div>
      <div class="main-btns">
        <button class="btn secondary" id="fbBtn">See feedback</button>
        <button class="btn primary" id="nextBtn">Next hand ▶</button>
        <button class="btn secondary wide" id="copyBtn">Copy for coach</button>
      </div>`;
    $('fbBtn').onclick = () => showFeedback();
    $('nextBtn').onclick = () => newHand();
    $('copyBtn').onclick = () => copyText(lastRecord?.coachText);
    return;
  }
  if (h.toAct !== h.heroIdx) {
    const acting = h.toAct >= 0 ? `${h.players[h.toAct].pos} is thinking…` : 'Dealing…';
    const last = [...h.log].reverse().find((e) => !['post', 'deal', 'uncalled'].includes(e.type));
    bar.innerHTML = `<div class="status"><b>${esc(acting)}</b>${last ? `<span>${esc(describeAction(h, last))}</span>` : ''}</div>`;
    return;
  }
  const la = legalActions(h);
  if (la.canRaise) pendingTo = pendingTo == null ? la.minTo : clampTo(la, pendingTo);
  const quick = quickSizes(h, la);
  const sliderOn = la.canRaise && la.maxTo > la.minTo;
  const callLabel = la.canCheck ? 'Check' : la.callIsAllIn ? `Call all-in $${la.toCall}` : `Call $${la.toCall}`;
  bar.innerHTML = `
    ${potLineHTML(h, la)}
    ${quick.length ? `<div class="quick">${quick.map((q) => `<button class="qbtn" data-to="${q.to}">
      <span class="qt">${q.top}</span><span class="qv">${q.allIn && q.top !== 'All-in' ? 'All-in' : `$${q.to}`}</span></button>`).join('')}</div>` : ''}
    ${la.canRaise ? `<div class="sizer">
      <div class="amount"><b id="amtVal"></b><span id="amtPct"></span></div>
      <div class="slider-row">
        <button class="nudge" data-step="-1" aria-label="Minus one dollar">−</button>
        <input id="slider" class="slider" type="range" min="0" max="${SLIDER_MAX}" step="1" aria-label="Bet size" ${sliderOn ? '' : 'disabled'}>
        <button class="nudge" data-step="1" aria-label="Plus one dollar">+</button>
      </div></div>` : ''}
    <div class="main-btns">
      <button class="btn fold" id="foldBtn" ${la.canFold ? '' : 'disabled'}>Fold</button>
      <button class="btn call" id="callBtn">${callLabel}</button>
      ${la.canRaise ? '<button class="btn raise wide" id="raiseBtn"></button>' : ''}
    </div>`;

  bar.querySelectorAll('.qbtn').forEach((b) => (b.onclick = () => { pendingTo = Number(b.dataset.to); syncSizer(la); }));
  const slider = $('slider');
  if (slider) slider.oninput = () => { pendingTo = sliderToAmount(la, Number(slider.value)); syncSizer(la, true); };
  bar.querySelectorAll('.nudge').forEach((b) => bindNudge(b, la));
  $('foldBtn').onclick = () => act({ type: 'fold' });
  $('callBtn').onclick = () => act(la.canCheck ? { type: 'check' } : { type: 'call' });
  if ($('raiseBtn')) $('raiseBtn').onclick = doRaise;
  if (la.canRaise) syncSizer(la);
}

// The − and + buttons move the amount by exactly $1; hold to repeat.
function bindNudge(btn, la) {
  const step = Number(btn.dataset.step);
  let delay = null, timer = null;
  const stop = () => { clearTimeout(delay); clearInterval(timer); delay = timer = null; };
  const apply = () => {
    const next = clampTo(la, (pendingTo ?? la.minTo) + step);
    if (!document.body.contains(btn) || next === pendingTo) { stop(); return; }
    pendingTo = next;
    syncSizer(la);
  };
  btn.onpointerdown = (e) => {
    if (btn.disabled) return;
    e.preventDefault();
    apply();
    delay = setTimeout(() => { timer = setInterval(apply, 70); }, 400);
  };
  btn.onpointerup = btn.onpointercancel = btn.onpointerleave = stop;
  btn.onclick = (e) => { if (e.detail === 0) apply(); }; // keyboard activation only; pointer input is handled above
  btn.oncontextmenu = (e) => e.preventDefault();
}

// Update amount readout, slider fill, confirm label and the active quick button.
function syncSizer(la, fromSlider = false) {
  const to = pendingTo;
  const slider = $('slider');
  if (slider) {
    if (!fromSlider) slider.value = amountToSlider(la, to);
    slider.style.setProperty('--fill', `${(Number(slider.value) / SLIDER_MAX) * 100}%`);
  }
  $('amtVal').textContent = `$${to}`;
  $('amtPct').textContent = to === la.maxTo ? 'All-in' : `${potPercent(hand, to)}% of pot`;
  $('raiseBtn').textContent = `${raiseWord(la, to)} $${to}`;
  document.querySelectorAll('.qbtn').forEach((b) => b.classList.toggle('on', Number(b.dataset.to) === to));
  document.querySelectorAll('.nudge').forEach((b) => {
    b.disabled = Number(b.dataset.step) < 0 ? to <= la.minTo : to >= la.maxTo;
  });
}

function doRaise() {
  const la = legalActions(hand);
  if (!la || pendingTo == null) return;
  const err = validateRaise(hand, pendingTo);
  if (err) { toast(err, true); return; }
  act({ type: la.isBet ? 'bet' : 'raise', to: pendingTo });
}

function act(action) {
  try {
    heroAct(hand, action, ranges);
  } catch (e) {
    toast(e.message, true);
    return;
  }
  pendingTo = null;
  renderAll();
  runLoop();
}

// ---------- game loop ----------
function renderAll() {
  renderTable();
  renderActionBar();
  refreshLive();
}

async function runLoop() {
  const token = handToken;
  const sp = SPEEDS[settings.speed];
  while (hand && !hand.done && token === handToken) {
    if (hand.awaitingDeal) {
      await sleep(sp.deal);
      if (token !== handToken) return;
      dealNextStreet(hand);
      renderAll();
      continue;
    }
    if (hand.toAct === hand.heroIdx) { renderAll(); return; }
    renderActionBar();
    await sleep(sp.act);
    if (token !== handToken) return;
    villainAct(hand);
    renderAll();
  }
  if (hand && hand.done && token === handToken) finishHand();
}

function finishHand() {
  lastRecord = buildRecord(hand);
  const saved = addHand(lastRecord);
  if (!saved) toast('Storage is full or blocked: this hand is only kept until you close the app.', true);
  // Leak tags come from the feedback engine; work it out right after the hand so repeats
  // count even when you skip the feedback screen.
  const h = hand, token = handToken, rec = lastRecord;
  setTimeout(() => {
    if (token !== handToken) return;
    try {
      const fb = feedbackFor(h, token);
      rec.leaks = fb.leaks;
      // The full review replaces the short hand history for Copy for coach; the short one is
      // kept so hands past the replay limit can drop the long text (storage).
      rec.coachShort = rec.coachText;
      rec.coachText = coachReport(h, fb);
      updateHand(rec.id, { leaks: fb.leaks, coachText: rec.coachText, coachShort: rec.coachShort });
    } catch (e) { console.warn('feedback', e); }
  }, 30);
  renderAll(); // the feedback screen opens only when "See feedback" is tapped
  if (drawerOpen() && (drawerTab === 'history' || drawerTab === 'stats')) renderDrawer();
}

function newHand() {
  closeSheet();
  handToken++;
  pendingTo = null;
  lastRecord = null;
  try {
    hand = createHand({ drill: settings.drill, ranges });
  } catch (e) {
    toast(e.message, true);
    settings.drill = 'random';
    hand = createHand({ drill: 'random', ranges });
  }
  renderTable.shown = 0;
  renderTable.chipKey = {};
  renderAll();
  runLoop();
}

// ---------- sheets (hand feedback) ----------
function openSheet(html, { full = false } = {}) {
  closeDrawer();
  const sh = $('sheet');
  sh.className = `sheet${full ? ' full' : ''}`;
  $('sheetBody').innerHTML = html;
  $('sheetBody').scrollTop = 0;
  $('scrim').classList.toggle('hidden', full);
  document.body.classList.add('sheet-open');
}
function closeSheet() {
  document.body.classList.remove('sheet-open');
  $('sheet').className = 'sheet hidden';
  $('sheetBody').innerHTML = '';
  $('scrim').classList.add('hidden');
}
$('scrim').onclick = closeSheet;
$('sheetHandle').onclick = closeSheet;

// ---------- menu drawer ----------
// Every non-action control lives here: Reads, Log, Drill, History, Stats, Settings.
const drawerOpen = () => $('drawer').classList.contains('open');
function openDrawer(tab = drawerTab, arg) {
  drawerTab = tab;
  $('drawer').classList.add('open');
  $('drawerScrim').classList.add('open');
  $('drawer').setAttribute('aria-hidden', 'false');
  $('menuToggle').setAttribute('aria-expanded', 'true');
  $('menuToggle').classList.add('open');
  renderDrawer(arg);
}
function closeDrawer() {
  liveSheet = null;
  $('drawer').classList.remove('open');
  $('drawerScrim').classList.remove('open');
  $('drawer').setAttribute('aria-hidden', 'true');
  $('menuToggle').setAttribute('aria-expanded', 'false');
  $('menuToggle').classList.remove('open');
}
// Render the current tab into the drawer body.
function panel(html, { live = null } = {}) {
  $('drawerBody').innerHTML = html;
  $('drawerBody').scrollTop = 0;
  liveSheet = live;
  document.querySelectorAll('#drawerTabs [data-tab]').forEach((t) => {
    const on = t.dataset.tab === drawerTab;
    t.classList.toggle('on', on);
    t.setAttribute('aria-selected', String(on));
  });
}
const TABS = { reads: (a) => showReads(a), log: () => showLog(), drill: () => showDrills(), history: () => showHistory(), stats: () => showStats(), settings: () => showMenu() };
function renderDrawer(arg) { (TABS[drawerTab] || TABS.reads)(arg); }

// Reads and Log stay open while villains act, so keep them current.
function refreshLive() {
  const box = $('live');
  if (!liveSheet || !box || !drawerOpen()) return;
  const sb = $('drawerBody');
  const atBottom = sb.scrollHeight - sb.scrollTop - sb.clientHeight < 60;
  box.innerHTML = liveSheet === 'reads' ? readsHTML() : logHTML();
  if (liveSheet === 'log' && atBottom) sb.scrollTop = sb.scrollHeight;
}

function showReads(flashSeat) {
  drawerTab = 'reads';
  panel(`<div id="live">${readsHTML(flashSeat)}</div>`, { live: 'reads' });
  if (flashSeat != null) $(`read-${flashSeat}`)?.scrollIntoView({ block: 'center' });
}

function showLog() {
  drawerTab = 'log';
  panel(`<div id="live">${logHTML()}</div>`, { live: 'log' });
  $('drawerBody').scrollTop = $('drawerBody').scrollHeight;
}

const VERDICT_LABEL = { correct: '✓ Chart play', mixed: '≈ Mixed', wrong: '✗ Off chart', situational: '⚑ Situational', nochart: '— No chart' };
const OUTSIDE_LABEL = { correct: '✓ Good', mixed: '≈ Borderline', wrong: '✗ Mistake', situational: '⚑ Situational', nochart: '— No chart' };

// ✅/⚠️/❌ and a one-line reason for a preflop grade ("Chart 3-bets J9s 100% here").
function gradeHTML(d) {
  const sizing = (d.sizing || []).map((z) => `<div class="sizing ${z.ok ? 'ok' : 'bad'}"><span class="ic">${z.ok ? '✓' : '✗'}</span><span><b>${esc(z.rule)}:</b> ${esc(z.message)}</span></div>`).join('');
  const chartLine = d.sourceTag
    ? `<span class="src ${d.source === 'OUTSIDE' ? 'outside' : 'hhp'}">${esc(d.sourceTag)}</span>`
    : d.chart ? esc(d.chart) : 'No HHP chart';
  const msg = d.verdict === 'situational' ? `<b>Mark's rule:</b> ${esc(d.message.replace(/^SITUATIONAL \(Mark\):\s*/i, ''))}` : esc(d.message);
  return `<div class="grade">
    <div class="row1"><div class="spot">${esc(d.label)}</div><span class="badge ${d.verdict}">${(d.source === 'OUTSIDE' ? OUTSIDE_LABEL : VERDICT_LABEL)[d.verdict]}</span></div>
    <div class="pmark">${preflopMark(d).mark} ${esc(preflopMark(d).reason)}</div>
    <div class="chart">${chartLine}</div>
    <div class="you">You: <b>${esc(d.heroAction || d.action)}${d.to ? ` $${d.to}` : ''}</b> with <b>${esc(d.code)}</b></div>
    <div class="msg">${msg}</div>
    ${d.freq && d.verdict !== 'wrong' ? `<div class="freq">Chart: ${esc(d.freq)}</div>` : ''}
    ${sizing}
  </div>`;
}

// Feedback screen: opens only when "See feedback" is tapped. No won/lost amounts, and only
// involved players' cards.
// Tap a grid cell for its combos, or a legend class for its definition.
$('sheetBody').addEventListener('click', (e) => {
  const wrap = e.target.closest('.gwrap');
  if (!wrap) return;
  const box = wrap.querySelector('.gdetail');
  if (e.target.closest('.gd-x')) { box.hidden = true; wrap.querySelectorAll('.gc.sel').forEach((c) => c.classList.remove('sel')); return; }
  const cell = e.target.closest('.hgrid .gc');
  const leg = e.target.closest('.glegend .gl[data-cls]');
  let html = '';
  if (cell) {
    wrap.querySelectorAll('.gc.sel').forEach((c) => c.classList.remove('sel'));
    cell.classList.add('sel');
    html = gridDetail(wrap.dataset.grid, cell.dataset.code);
  } else if (leg && !leg.disabled) html = gridClassInfo(wrap.dataset.grid, leg.dataset.cls);
  if (!html) return;
  box.innerHTML = `<button type="button" class="gd-x" aria-label="Close">✕</button>${html}`;
  box.hidden = false;
});

// Cards + who won, for the top of the feedback screen (involved players only, no amounts).
function handsGridHTML(h) {
  const r = h.result;
  const order = [...Array(8).keys()].map((k) => (h.heroIdx + k) % 8).filter((i) => isInvolved(h, i));
  return order.map((i) => {
    const p = h.players[i];
    const win = r.won[i] > 0;
    const type = p.isHero ? 'You' : villainLabel(p);
    return `<div class="hand-row${win ? ' win' : ''}${p.folded ? ' fold' : ''}">
      <div class="cs">${p.cards.map((c) => cardHTML(c, 'sm')).join('')}</div>
      <div class="who">${p.pos}${win ? ' · Won' : ''}<span class="ty">${esc(type)}</span><span class="hd">${esc(statusOf(h, i).replace(/^won, /, ''))}</span></div>
    </div>`;
  }).join('');
}

let lastFeedback = null; // { handToken, fb }
function feedbackFor(h, token = handToken) {
  if (lastFeedback && lastFeedback.token === token && lastFeedback.hand === h) return lastFeedback.fb;
  const history = loadHistory().filter((x) => x.id !== lastRecord?.id).slice(0, 50);
  const fb = buildFeedback(h, { model, brain, history });
  lastFeedback = { token, hand: h, fb };
  return fb;
}

// Feedback screen: opens only when "See feedback" is tapped. No won/lost amounts, and only
// involved players' cards.
function showFeedback(h = hand, { fromHistory = null } = {}) {
  if (!h || !h.done) return;
  let body, fb = null;
  clearGrids();
  try {
    fb = fromHistory ? buildFeedback(h, { model, brain, history: loadHistory().filter((x) => x.id !== fromHistory.id).slice(0, 50) }) : feedbackFor(h);
    body = feedbackHTML(h, fb, { resultLine: winnerLine(h, true), handsHTML: handsGridHTML(h), gradeHTML });
  } catch (e) {
    console.error(e);
    body = `<div class="resultbox">${esc(winnerLine(h, true))}</div><div class="bnote">The feedback engine hit an error on this hand: ${esc(e.message)}. The preflop grades are below.</div>${(h.heroDecisions || []).map(gradeHTML).join('')}`;
  }
  let coach = fromHistory ? fromHistory.coachText : lastRecord?.coachText;
  try { if (fb) coach = coachReport(h, fb); } catch (e) { console.warn('coach text', e); }
  openSheet(`
    <div class="sheet-top"><h2>Hand feedback</h2><button class="close" id="closeBtn" aria-label="Close">✕</button></div>
    ${body}
    <div class="sheet-actions">
      <button class="btn secondary" id="copyBtn2">Copy for coach</button>
      ${fromHistory ? '' : '<button class="btn primary" id="nextBtn2">Next hand ▶</button>'}
    </div>`, { full: true });
  $('closeBtn').onclick = closeSheet;
  $('copyBtn2').onclick = () => copyText(coach);
  if ($('nextBtn2')) $('nextBtn2').onclick = () => newHand();
}

function showDrills() {
  drawerTab = 'drill';
  panel(`<h2>Drill mode</h2>${Object.entries(DRILLS).map(([k, d]) => `
    <button class="drill${settings.drill === k ? ' on' : ''}" data-drill="${k}"><b>${d.name}</b><span>${d.desc}</span></button>`).join('')}
    <div class="about">The new mode starts with the next hand.</div>`);
  document.querySelectorAll('.drill').forEach((b) => (b.onclick = () => {
    settings.drill = b.dataset.drill;
    saveSettings();
    renderTable();
    if (!hand || hand.done) { closeDrawer(); newHand(); }
    else { showDrills(); toast(`${DRILLS[settings.drill].name}: starts next hand`); }
  }));
}

function histRowHTML(h, idx) {
  const cards = h.heroCards.match(/../g).map((s) => cardHTML(RANKS.indexOf(s[0]) * 4 + SUITS.indexOf(s[1]), 'sm')).join('');
  const first = h.decisions?.[0];
  const worst = (h.decisions || []).some((d) => d.verdict === 'wrong') ? 'wrong' : first?.verdict || 'nochart';
  const date = new Date(h.ts);
  const when = `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
  const net = h.net > 0 ? `<span class="money">+$${h.net}</span>` : h.net < 0 ? `<span class="loss">−$${-h.net}</span>` : '$0';
  return `<button class="hist" data-idx="${idx}">
    <div class="cs">${cards}</div>
    <div class="mid"><div class="t1">${esc(h.heroPos)} · $${esc(h.stakes)} · ${esc(first?.label || h.spot?.kind || '')}</div>
    <div class="t2">${when} · ${esc(DRILLS[h.drill]?.name || h.drill)} · ${net}</div></div>
    <span class="dot ${worst}"></span></button>`;
}

function showHistory() {
  const list = loadHistory();
  drawerTab = 'history';
  panel(`
    <h2>History <span class="count">${list.length} hands</span></h2>
    <div class="toolbar">
      <button id="expBtn">Export CSV</button><button id="impBtn">Import CSV</button><button class="danger" id="clrBtn">Clear</button>
    </div>
    <div id="histList">${list.length ? list.slice(0, 300).map(histRowHTML).join('') : '<div class="empty">No hands yet. Play one!</div>'}</div>
    ${list.length > 300 ? `<div class="about">Showing the latest 300. Export CSV to see them all.</div>` : ''}`);
  $('expBtn').onclick = () => doExport();
  $('impBtn').onclick = () => $('importFile').click();
  $('clrBtn').onclick = () => {
    if (!list.length) return;
    if (confirm(`Delete all ${list.length} saved hands from this device? Export first if you want a backup.`)) { clearHistory(); showHistory(); }
  };
  document.querySelectorAll('.hist').forEach((b) => (b.onclick = () => showHandDetail(list[Number(b.dataset.idx)])));
}

function showHandDetail(h) {
  panel(`
    <div class="sheet-top"><button class="close" id="backBtn" aria-label="Back to history">‹</button><h2>${esc(h.heroPos)} · ${esc(h.heroCode)} · $${esc(h.stakes)}</h2></div>
    <button class="btn primary" style="width:100%;margin-bottom:12px" id="copyHist">Copy for coach</button>
    <details class="coach-d"><summary>Show the coach text</summary><pre class="coach">${esc(h.coachText)}</pre></details>
    ${h.replay ? '<button class="btn secondary" style="width:100%;margin-bottom:12px" id="fullFb">See full feedback</button>' : ''}
    ${h.leaks?.length ? `<div class="fb-line"><b>Leak tags:</b> ${h.leaks.map((t) => `<span class="leak">${esc(t)}</span>`).join('')}</div>` : ''}
    <h3>Preflop feedback</h3>
    ${(h.decisions || []).map(gradeHTML).join('') || '<div class="empty">No preflop decision.</div>'}`);
  if ($('fullFb')) $('fullFb').onclick = () => { try { showFeedback(rebuildHand(h.replay), { fromHistory: h }); } catch (e) { toast(`Can't rebuild this hand: ${e.message}`, true); } };
  $('backBtn').onclick = showHistory;
  $('copyHist').onclick = () => copyText(h.coachText);
}

function showStats() {
  const st = computeStats(loadHistory());
  const kinds = st.kinds.map((k) => `<div class="bar-row">
      <div class="lab">${esc(k.label)} <span>· ${k.total} decisions${k.situational ? `, ${k.situational} situational` : ''}</span></div>
      <div class="pc">${k.pct == null ? '—' : `${k.pct}%`}</div>
      <div class="bar"><i style="width:${k.pct ?? 0}%;background:${k.pct >= 80 ? 'var(--blue)' : k.pct >= 60 ? 'var(--amber)' : 'var(--red)'}"></i></div></div>`).join('');
  const missed = st.topMissed.map((m) => `<div class="miss"><div class="n">${m.count}×</div><div class="d">
      <b>${m.code === 'sizing' ? esc(m.chart) : `${esc(m.code)}: ${esc(m.action)}`}</b>
      <span>${esc(m.spot)}${m.code === 'sizing' ? '' : ` · ${esc(m.chart)}`}</span><br><span>${esc(m.example)}</span></div></div>`).join('');
  drawerTab = 'stats';
  panel(`
    <h2>Stats</h2>
    <div class="kpis">
      <div class="kpi"><div class="v">${st.hands}</div><div class="l">Hands</div></div>
      <div class="kpi"><div class="v">${st.pct == null ? '—' : `${st.pct}%`}</div><div class="l">Preflop accuracy</div></div>
      <div class="kpi"><div class="v">${st.sizingChecks ? `${Math.round((st.sizingOk / st.sizingChecks) * 100)}%` : '—'}</div><div class="l">Sizing on target</div></div>
    </div>
    <h3>Preflop accuracy by scenario</h3>
    ${kinds || '<div class="empty">Play some hands first.</div>'}
    <h3>Most-missed spots</h3>
    ${missed || '<div class="empty">Nothing missed yet. Nice.</div>'}
    <div class="about" style="margin-top:12px">Mixed-frequency plays count as correct. Situational hands (Mark's rule) are not counted either way.${st.outside ? ` ${st.outside} decision${st.outside > 1 ? 's' : ''} in spots no HHP chart covers ${st.outside > 1 ? 'were' : 'was'} graded [OUTSIDE SOURCE] and ${st.outside > 1 ? 'are' : 'is'} not counted.` : ''}</div>`);
}

// Brain status: what loaded, from where, and anything that needs you.
function brainStatusHTML() {
  if (!brain) return '<h3>Brain</h3><div class="empty">Brain not loaded.</div>';
  const NOUN = { charts: 'chart', superseded: 'superseded (skipped)', entries: 'entry|entries', villains: 'villain read', conflicts: 'conflict',
    open: 'open question', leakTags: 'leak tag', knownLeaks: 'known-leak note' };
  const noun = (k, v) => { const [one, many] = (NOUN[k] || k).split('|'); return v === 1 || one.includes('(') ? one : many || `${one}s`; };
  const fmt = (c) => Object.entries(c || {}).filter(([, v]) => v).map(([k, v]) => `${v} ${noun(k, v)}`).join(' · ');
  const rows = brain.files.map((f) => `<div class="bfile ${f.status}">
      <div class="bn"><b>${esc(f.name)}</b><span class="bs">${{ ok: '✓ loaded', fallback: '⚠ last good copy', missing: '✗ missing' }[f.status]}</span></div>
      <div class="bc">${esc(fmt(f.counts))}${f.newest ? ` · newest tag ${esc(f.newest)}` : ''}</div>
      ${f.error ? `<div class="be">${esc(f.error)}</div>` : ''}</div>`).join('');
  const full = brain.conflicts.filter((c) => !c.summary).length;
  const notes = [...brain.notices, ...brain.warnings, ...(brain.missing.length ? [`The app asks for chart${brain.missing.length > 1 ? 's' : ''} the CSV doesn't have: ${brain.missing.join(', ')}. Those spots show "No HHP chart".`] : [])];
  return `<h3>Brain</h3>
    <div class="about">Loaded ${esc(new Date(brain.loadedAt).toLocaleString())}. ${full} conflicts and ${brain.openQuestions.length} open questions, all Undecided: never applied, never graded.</div>
    ${notes.map((n) => `<div class="bnote">${esc(n)}</div>`).join('')}
    <div class="bfiles">${rows}</div>
    ${compiledStatusHTML()}`;
}

function compiledStatusHTML() {
  if (!model) return '';
  const c = model.resolved.counts;
  const stale = model.resolved.stale;
  return `<h3>Compiled layer</h3>
    <div class="about">The numbers villains play by (compiled ${esc(model.resolved.compiledAt)}): ${c.total} values. ${c.sourced} quote the brain [HHP] (${c.interpreted} of those turn words into a number), ${c.outside} are [OUTSIDE SOURCE] defaults.</div>
    ${stale.length ? `<div class="bnote">${stale.length} compiled value${stale.length > 1 ? 's are' : ' is'} stale: the playbook text ${stale.length > 1 ? 'they quote' : 'it quotes'} changed, so ${stale.length > 1 ? 'they use' : 'it uses'} [OUTSIDE SOURCE] defaults. Open a session and say "recompile brain".</div>
      <div class="bfiles">${stale.slice(0, 12).map((x) => `<div class="bfile fallback"><div class="bn"><b>${esc(x.key)}</b></div><div class="bc">${esc(x.file)}: "${esc(x.quote)}"</div></div>`).join('')}</div>` : '<div class="about">Nothing stale.</div>'}`;
}

function showMenu() {
  const seg = (key, opts) => `<div class="seg">${opts.map(([v, l]) => `<button data-k="${key}" data-v="${v}" class="${String(settings[key]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  drawerTab = 'settings';
  panel(`
    <h2>Settings</h2>
    <div class="setting"><b>Villain speed</b>${seg('speed', [['normal', 'Normal'], ['fast', 'Fast'], ['instant', 'Instant']])}</div>
    <div class="setting"><b>Deck</b>${seg('fourColor', [['true', '4-color'], ['false', '2-color']])}</div>
    <h3>How it works</h3>
    <div class="about">
      <p>Every hand is a real 52-card shuffle. You only get dealt hands the HHP chart plays in your spot. Villain types are hidden until the hand ends. The reads are your clues.</p>
      <p>Preflop gets graded against the charts and HHP sizing rules. Postflop is for your coach: tap <b>Copy for coach</b>.</p>
      <p>Everything runs on your phone. Hands are saved on this device only, so export a CSV to back them up.</p>
      <p>Villains play from the brain through <code>brain-compiled/behavior.json</code>; table mix and open sizes are in <code>config/table-settings.js</code> [OUTSIDE SOURCE]. Charts: <code>brain/preflop-ranges.csv</code>, read fresh every time the app opens.</p>
    </div>
    ${brainStatusHTML()}`);
  document.querySelectorAll('.seg button').forEach((b) => (b.onclick = () => {
    const k = b.dataset.k;
    settings[k] = k === 'fourColor' ? b.dataset.v === 'true' : b.dataset.v;
    saveSettings();
    applySettings();
    showMenu();
  }));
}

function applySettings() {
  document.body.classList.toggle('two-color', !settings.fourColor);
}

// ---------- utilities ----------
let toastTimer = null;
function toast(msg, err = false) {
  const t = $('toast');
  t.textContent = msg;
  t.className = `toast${err ? ' err' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2600);
}

async function copyText(text) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied. Paste it to your coach.');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    ta.remove();
    toast(ok ? 'Copied. Paste it to your coach.' : 'Copy failed. Long-press the text to copy.', !ok);
  }
}

async function doExport() {
  const list = loadHistory();
  if (!list.length) { toast('No hands to export.'); return; }
  const csv = exportCSV(list);
  const name = `hhp-sim-history-${new Date().toISOString().slice(0, 10)}.csv`;
  const file = new File([csv], name, { type: 'text/csv' });
  if (navigator.canShare && navigator.canShare({ files: [file] }) && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
    try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast(`Exported ${list.length} hands.`);
}

$('importFile').onchange = async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    const n = importCSV(await f.text());
    toast(`Imported ${n} new hand${n === 1 ? '' : 's'}.`);
    showHistory();
  } catch (err) {
    toast(err.message, true);
  }
};

// ---------- wiring ----------
$('menuToggle').onclick = () => (drawerOpen() ? closeDrawer() : openDrawer());
$('drawerClose').onclick = closeDrawer;
$('drawerScrim').onclick = closeDrawer;
$('drawerTabs').addEventListener('click', (e) => {
  const t = e.target.closest('[data-tab]');
  if (t) { drawerTab = t.dataset.tab; renderDrawer(); }
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (drawerOpen()) closeDrawer();
  else if (!$('sheet').classList.contains('hidden')) closeSheet();
});
$('seats').addEventListener('click', (e) => {
  const seat = e.target.closest('.seat');
  if (seat) openDrawer('reads', Number(seat.dataset.seat));
});

// Scale seats, cards and chips with the table, and switch between the wide and tall layouts.
function fitTable() {
  const el = $('tableWrap');
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const next = layoutFor(r.width, r.height);
  const changed = next.kind !== geo.kind || next.k !== geo.k;
  geo = next;
  el.style.setProperty('--k', String(geo.k));
  el.style.setProperty('--by', String(geo.boardY));
  el.dataset.layout = geo.kind;
  if (changed && hand) renderTable();
  else placeChips();
}
new ResizeObserver(fitTable).observe($('tableWrap'));

if (new URLSearchParams(location.search).has('debug')) window.__sim = { hand: () => hand, render: () => renderAll(), geo: () => geo, brain: () => brain };

async function boot() {
  applySettings();
  fitTable();
  try {
    const manifest = await (await fetch('config/brain-files.json', { cache: 'no-cache' })).json();
    const [b, compiled] = await Promise.all([
      loadBrain({ manifest, fetchText: browserFetchText, lastGood: browserLastGood() }),
      fetch('brain-compiled/behavior.json', { cache: 'no-cache' }).then((r) => r.json()),
    ]);
    brain = b;
    model = buildModel(compiled, brain.texts);
    setModel(model);
    // Compiled charts (the LJ open) join the CSV charts.
    Object.assign(brain.charts.charts, model.charts);
    brain.missing = missingCharts(brain, CHARTS_USED);
    ranges = brain.charts;
  } catch (e) {
    $('actionbar').innerHTML = `<div class="status">Could not load the brain. ${esc(String(e.message || e).replace(/\.*$/, ''))}.</div>`;
    return;
  }
  if (brain.notices.length) toast(`${brain.notices[0]}${brain.notices.length > 1 ? ` (+${brain.notices.length - 1} more)` : ''} Details: Menu → Settings.`, true);
  newHand();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}
boot();
