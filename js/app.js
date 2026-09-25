import { createHand, heroAct, villainAct, DRILLS } from './engine/dealer.js';
import { legalActions, validateRaise, dealNextStreet, potTotal } from './engine/game.js';
import { RANKS, SUITS, SUIT_SYMBOLS, rankOf, suitOf, cardsPretty } from './engine/cards.js';
import { describeAction, buildRecord, resultText } from './engine/coach.js';
import { VILLAIN_CONFIG } from '../config/villains.js';
import { loadHistory, addHand, clearHistory, computeStats, exportCSV, importCSV } from './storage/history.js';

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
let hand = null;
let handToken = 0;
let pendingTo = null;
let customOpen = false;
let lastRecord = null;
let tab = 'log';

// ---------- cards ----------
function cardHTML(c, cls = '') {
  const s = SUITS[suitOf(c)];
  return `<div class="card ${s} ${cls}"><span class="r">${RANKS[rankOf(c)] === 'T' ? '10' : RANKS[rankOf(c)]}</span><span class="s">${SUIT_SYMBOLS[s]}</span></div>`;
}
const backHTML = () => '<div class="card-back"></div>';

// ---------- table rendering ----------
const SEAT_XY = [[50, 93], [13, 77], [10, 48], [20, 17], [50, 10], [80, 17], [90, 48], [87, 77]];
const CENTER = [50, 48];

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

function renderTable() {
  const h = hand;
  $('stakes').textContent = h ? `$${h.stakes.sb}/$${h.stakes.bb}` : '—';
  $('drillName').textContent = DRILLS[settings.drill].name;
  if (!h) return;
  const heroIdx = h.heroIdx;
  const winners = h.done ? new Set(Object.entries(h.result.won).filter(([, v]) => v > 0).map(([i]) => Number(i))) : new Set();

  // Board + pot
  const slots = [];
  for (let k = 0; k < 5; k++) {
    const c = h.board[k];
    slots.push(c === undefined ? '<div class="card slot"></div>' : cardHTML(c, renderTable.shown > k ? '' : 'deal-in'));
  }
  renderTable.shown = h.board.length;
  $('board').innerHTML = slots.join('');
  const pot = h.done ? h.result.finalPot : potTotal(h);
  $('pot').innerHTML = `Pot $${pot}${!h.done && h.toAct === heroIdx ? '' : ''}`;

  // Seats
  const out = [];
  for (let k = 1; k < 8; k++) {
    const i = (heroIdx + k) % 8;
    const p = h.players[i];
    const [x, y] = SEAT_XY[k];
    const reveal = h.done;
    const cards = reveal ? p.cards.map((c) => cardHTML(c, 'sm' + (p.folded ? ' dim' : ''))).join('') : (p.folded ? '' : backHTML() + backHTML());
    const cls = ['seat', p.folded && !reveal ? 'folded' : '', h.toAct === i ? 'acting' : '', winners.has(i) ? 'winner' : ''].join(' ');
    out.push(`<button class="${cls}" style="left:${x}%;top:${y}%" data-seat="${i}">
      ${p.pos === 'BTN' ? '<span class="dealer">D</span>' : ''}
      <div class="pos">${p.pos}</div>
      <div class="stack">$${p.stack}</div>
      <div class="mini-cards">${cards}</div>
      <div class="tag">${esc(seatTag(p))}</div>
    </button>`);
    if (p.committed > 0 && !h.done) {
      const bx = x + (CENTER[0] - x) * 0.45, by = y + (CENTER[1] - y) * 0.45;
      out.push(`<div class="bet-chip" style="left:${bx}%;top:${by}%">$${p.committed}</div>`);
    }
  }
  const hero = h.players[heroIdx];
  if (hero.committed > 0 && !h.done) out.push(`<div class="bet-chip" style="left:50%;top:64%">$${hero.committed}</div>`);
  $('seats').innerHTML = out.join('');

  const bbs = Math.round(hero.stack / h.stakes.bb);
  $('heroHand').className = `hero-hand${h.toAct === heroIdx ? ' acting' : ''}`;
  $('heroHand').innerHTML = `<div class="cards">${hero.cards.map((c) => cardHTML(c, 'big')).join('')}</div>
    <div class="meta"><span class="pos">${hero.pos === 'BTN' ? 'BTN (D)' : hero.pos}</span>$${hero.stack} · ${bbs}bb${hero.folded ? ' · folded' : ''}</div>`;
}

function renderLog() {
  const h = hand;
  if (!h) { $('logPanel').innerHTML = ''; return; }
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
  if (h.done) lines.push(`<div class="log-street">Result</div><div class="log-line">${esc(resultText(h))}</div>`);
  const el = $('logPanel');
  el.innerHTML = lines.join('');
  el.scrollTop = el.scrollHeight;
}

function renderReads(flashSeat) {
  const h = hand;
  if (!h) return;
  const rows = [];
  for (let k = 1; k < 8; k++) {
    const i = (h.heroIdx + k) % 8;
    const p = h.players[i];
    const typeReveal = h.done ? ` · <span style="color:var(--gold)">${esc(VILLAIN_CONFIG.types[p.type].label)}</span>` : '';
    rows.push(`<div class="read${p.folded ? ' out' : ''}${flashSeat === i ? ' flash' : ''}" id="read-${i}">
      <div class="who">${p.pos}<span class="st">$${p.stack} · ${Math.round(p.stack / h.stakes.bb)}bb${typeReveal}</span></div>
      <div class="txt">${p.reads.map(esc).join(' · ')}</div></div>`);
  }
  $('readsPanel').innerHTML = rows.join('');
  if (flashSeat != null) $(`read-${flashSeat}`)?.scrollIntoView({ block: 'nearest' });
}

// ---------- action bar ----------
function presetTo(la, f) {
  const pot = potTotal(hand);
  const to = la.isBet ? f * pot : hand.currentBet + f * (pot + la.toCall);
  return clampTo(la, Math.round(to));
}
const clampTo = (la, to) => Math.max(la.minTo, Math.min(la.maxTo, to));

function renderActionBar() {
  const bar = $('actionbar');
  const h = hand;
  if (!h) { bar.innerHTML = '<div class="status">Dealing…</div>'; return; }
  if (h.done) {
    bar.innerHTML = `<div class="two-btns">
      <button class="btn ghost" id="copyBtn">Copy for coach</button>
      <button class="btn primary" id="nextBtn">Next hand ▶</button></div>`;
    $('copyBtn').onclick = () => copyText(lastRecord?.coachText);
    $('nextBtn').onclick = () => newHand();
    return;
  }
  if (h.toAct !== h.heroIdx) {
    const who = h.toAct >= 0 ? `${h.players[h.toAct].pos} is thinking…` : 'Dealing…';
    bar.innerHTML = `<div class="status">${who}</div>`;
    return;
  }
  const la = legalActions(h);
  const bb = h.stakes.bb;
  let multiples = [];
  let sizes = [];
  if (la.canRaise) {
    if (h.street === 'preflop') {
      multiples = h.raiseLevel === 1
        ? [3, 4, 5, 6, 7, 8].map((m) => [`${m}bb`, clampTo(la, m * bb)])
        : [2.5, 3, 3.5, 4, 5].map((m) => [`${m}x`, clampTo(la, Math.round(h.currentBet * m))]);
    }
    sizes = [['33%', presetTo(la, 0.33)], ['50%', presetTo(la, 0.5)], ['75%', presetTo(la, 0.75)], ['Pot', presetTo(la, 1)], ['All-in', la.maxTo]];
  }
  const chip = ([l, v]) => `<button class="size${pendingTo === v ? ' on' : ''}" data-to="${v}">${l}</button>`;
  const allIn = pendingTo === la.maxTo;
  const raiseWord = la.isBet ? 'Bet' : 'Raise to';
  const raiseLabel = pendingTo ? (allIn ? `All-in<small>$${la.maxTo}</small>` : `${raiseWord}<small>$${pendingTo}</small>`) : (la.isBet ? 'Bet' : 'Raise');
  const callLabel = la.canCheck ? 'Check' : la.callIsAllIn ? `All-in<small>call $${la.toCall}</small>` : `Call<small>$${la.toCall}</small>`;
  bar.innerHTML = `
    ${multiples.length ? `<div class="sizes">${multiples.map(chip).join('')}</div>` : ''}
    ${la.canRaise ? `<div class="sizes">${sizes.map(chip).join('')}
      <button class="size${customOpen ? ' on' : ''}" id="customBtn">$</button></div>` : ''}
    ${la.canRaise && customOpen ? `<div class="custom">
      <button class="step" data-step="-1">−</button>
      <input id="customInput" type="number" inputmode="numeric" pattern="[0-9]*" placeholder="min $${la.minTo}" value="${pendingTo ?? ''}">
      <button class="step" data-step="1">+</button></div>` : ''}
    <div class="main-btns">
      <button class="btn fold" id="foldBtn" ${la.canFold ? '' : 'disabled'}>Fold</button>
      <button class="btn call" id="callBtn">${callLabel}</button>
      <button class="btn raise" id="raiseBtn" ${la.canRaise ? '' : 'disabled'}>${raiseLabel}</button>
    </div>`;

  bar.querySelectorAll('.size[data-to]').forEach((b) => (b.onclick = () => { pendingTo = Number(b.dataset.to); renderActionBar(); }));
  $('customBtn') && ($('customBtn').onclick = () => { customOpen = !customOpen; renderActionBar(); if (customOpen) $('customInput')?.focus(); });
  const inp = $('customInput');
  if (inp) {
    inp.oninput = () => { const v = parseInt(inp.value, 10); pendingTo = Number.isFinite(v) ? v : null; updateRaiseLabel(la); };
    inp.onkeydown = (e) => { if (e.key === 'Enter') doRaise(); };
  }
  bar.querySelectorAll('.step').forEach((b) => (b.onclick = () => {
    const base = pendingTo ?? la.minTo - bb * Number(b.dataset.step);
    pendingTo = clampTo(la, base + bb * Number(b.dataset.step));
    renderActionBar();
  }));
  $('foldBtn').onclick = () => act({ type: 'fold' });
  $('callBtn').onclick = () => act(la.canCheck ? { type: 'check' } : { type: 'call' });
  $('raiseBtn').onclick = doRaise;
}

function updateRaiseLabel(la) {
  const b = $('raiseBtn');
  if (!b) return;
  const word = la.isBet ? 'Bet' : 'Raise to';
  b.innerHTML = pendingTo ? (pendingTo === la.maxTo ? `All-in<small>$${la.maxTo}</small>` : `${word}<small>$${pendingTo}</small>`) : (la.isBet ? 'Bet' : 'Raise');
  document.querySelectorAll('.size[data-to]').forEach((s) => s.classList.toggle('on', Number(s.dataset.to) === pendingTo));
}

function doRaise() {
  const la = legalActions(hand);
  if (!la) return;
  if (pendingTo == null) {
    customOpen = true;
    renderActionBar();
    $('customInput')?.focus();
    toast('Pick a size or enter a custom amount.');
    return;
  }
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
  customOpen = false;
  renderAll();
  runLoop();
}

// ---------- game loop ----------
function renderAll() {
  renderTable();
  renderLog();
  renderReads();
  renderActionBar();
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
  renderAll();
  showResult();
}

function newHand() {
  closeSheet();
  handToken++;
  pendingTo = null;
  customOpen = false;
  lastRecord = null;
  try {
    hand = createHand({ drill: settings.drill, ranges });
  } catch (e) {
    toast(e.message, true);
    settings.drill = 'random';
    hand = createHand({ drill: 'random', ranges });
  }
  renderTable.shown = 0;
  renderAll();
  runLoop();
}

// ---------- sheets ----------
function openSheet(html, { full = false } = {}) {
  const sh = $('sheet');
  sh.className = `sheet${full ? ' full' : ''}`;
  $('sheetBody').innerHTML = html;
  $('sheetBody').scrollTop = 0;
  $('scrim').classList.toggle('hidden', full);
}
function closeSheet() {
  $('sheet').className = 'sheet hidden';
  $('sheetBody').innerHTML = '';
  $('scrim').classList.add('hidden');
}
$('scrim').onclick = () => {
  if (hand?.done && !$('sheet').classList.contains('hidden')) peekResult();
  else closeSheet();
};
$('sheetHandle').onclick = () => {
  const sh = $('sheet');
  if (sh.classList.contains('peek')) { sh.classList.remove('peek'); $('scrim').classList.remove('hidden'); }
  else if (hand?.done && $('sheetBody').querySelector('.peek-keep')) peekResult();
  else closeSheet();
};
function peekResult() {
  $('sheet').classList.add('peek');
  $('scrim').classList.add('hidden');
}

const VERDICT_LABEL = { correct: '✓ Chart play', mixed: '≈ Mixed', wrong: '✗ Off chart', situational: '⚑ Situational', nochart: '— No chart' };

function gradeHTML(d) {
  const sizing = (d.sizing || []).map((z) => `<div class="sizing ${z.ok ? 'ok' : 'bad'}"><span class="ic">${z.ok ? '✓' : '✗'}</span><span><b>${esc(z.rule)}:</b> ${esc(z.message)}</span></div>`).join('');
  const chartLine = d.chart
    ? `${esc(d.chart)}${d.exact ? '' : '<span class="noexact">no exact HHP chart</span>'}`
    : 'No HHP chart';
  const msg = d.verdict === 'situational' ? `<b>Mark's rule:</b> ${esc(d.message.replace(/^SITUATIONAL \(Mark\):\s*/i, ''))}` : esc(d.message);
  return `<div class="grade">
    <div class="row1"><div class="spot">${esc(d.label)}</div><span class="badge ${d.verdict}">${VERDICT_LABEL[d.verdict]}</span></div>
    <div class="chart">${chartLine}</div>
    <div class="you">You: <b>${esc(d.heroAction || d.action)}${d.to ? ` $${d.to}` : ''}</b> with <b>${esc(d.code)}</b></div>
    <div class="msg">${msg}</div>
    ${d.freq && d.verdict !== 'wrong' ? `<div class="freq">Chart: ${esc(d.freq)}</div>` : ''}
    ${sizing}
  </div>`;
}

function showResult() {
  const h = hand;
  const r = h.result;
  const net = r.net[h.heroIdx];
  const bb = h.stakes.bb;
  const netCls = net > 0 ? 'pos' : net < 0 ? 'neg' : 'zero';
  const netStr = `${net > 0 ? '+' : net < 0 ? '−' : ''}$${Math.abs(net)}`;
  const order = [...Array(8).keys()].map((k) => (h.heroIdx + k) % 8);
  const handsHTML = order.map((i) => {
    const p = h.players[i];
    const sd = r.showdown?.hands[i];
    const win = r.won[i] > 0;
    const type = p.isHero ? 'You' : VILLAIN_CONFIG.types[p.type].label;
    return `<div class="hand-row${win ? ' win' : ''}${p.folded ? ' fold' : ''}">
      <div class="cs">${p.cards.map((c) => cardHTML(c, 'sm')).join('')}</div>
      <div class="who">${p.pos}${win ? ` +$${r.won[i]}` : ''}<span class="ty">${esc(type)}</span><span class="hd">${sd ? esc(sd.name) : p.folded ? 'folded' : ''}</span></div>
    </div>`;
  }).join('');
  const grades = h.heroDecisions.length ? h.heroDecisions.map(gradeHTML).join('') : '<div class="empty">No preflop decision this hand.</div>';
  openSheet(`
    <div class="peek-keep peek-bar">
      <div class="grow"><span class="net ${netCls}">${netStr}</span> <span style="color:var(--muted);font-weight:700">${(net / bb).toFixed(1)}bb</span></div>
      <button class="link" id="expandBtn">Feedback ▴</button>
      <button class="btn primary" style="height:46px;padding:0 18px" id="peekNext">Next ▶</button>
    </div>
    <div class="result-head"><h2>${net > 0 ? 'You won' : net < 0 ? 'You lost' : 'Break even'}</h2><button class="link" id="seeTable">See table ▾</button></div>
    <div class="result-text">${esc(resultText(h))}</div>
    <h3>All hands</h3>
    <div class="hands-grid">${handsHTML}</div>
    <h3>Preflop feedback</h3>
    ${grades}
    <div class="about" style="margin-top:6px">Postflop isn't graded here. Send it to your coach.</div>
    <div class="sheet-actions">
      <button class="btn ghost" id="copyBtn2">Copy for coach</button>
      <button class="btn primary" id="nextBtn2">Next hand ▶</button>
    </div>`);
  $('copyBtn2').onclick = () => copyText(lastRecord.coachText);
  $('nextBtn2').onclick = () => newHand();
  $('peekNext').onclick = () => newHand();
  $('seeTable').onclick = peekResult;
  $('expandBtn').onclick = () => { $('sheet').classList.remove('peek'); $('scrim').classList.remove('hidden'); };
}

function showDrills() {
  openSheet(`<h2>Drill mode</h2>${Object.entries(DRILLS).map(([k, d]) => `
    <button class="drill${settings.drill === k ? ' on' : ''}" data-drill="${k}"><b>${d.name}</b><span>${d.desc}</span></button>`).join('')}
    <div class="about">The new mode starts with the next hand.</div>`);
  document.querySelectorAll('.drill').forEach((b) => (b.onclick = () => {
    settings.drill = b.dataset.drill;
    saveSettings();
    renderTable();
    if (!hand || hand.done) newHand();
    else { closeSheet(); toast(`${DRILLS[settings.drill].name}: starts next hand`); }
  }));
}

function histRowHTML(h, idx) {
  const cards = h.heroCards.match(/../g).map((s) => cardHTML(RANKS.indexOf(s[0]) * 4 + SUITS.indexOf(s[1]), 'sm')).join('');
  const first = h.decisions?.[0];
  const worst = (h.decisions || []).some((d) => d.verdict === 'wrong') ? 'wrong' : first?.verdict || 'nochart';
  const date = new Date(h.ts);
  const when = `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
  const net = h.net > 0 ? `+$${h.net}` : h.net < 0 ? `−$${-h.net}` : '$0';
  return `<button class="hist" data-idx="${idx}">
    <div class="cs">${cards}</div>
    <div class="mid"><div class="t1">${esc(h.heroPos)} · $${esc(h.stakes)} · ${esc(first?.label || h.spot?.kind || '')}</div>
    <div class="t2">${when} · ${esc(DRILLS[h.drill]?.name || h.drill)} · ${net}</div></div>
    <span class="dot ${worst}"></span></button>`;
}

function showHistory() {
  const list = loadHistory();
  openSheet(`
    <div class="sheet-top"><h2>History <span style="color:var(--muted);font-size:15px">${list.length} hands</span></h2><button class="close" id="closeBtn">✕</button></div>
    <div class="toolbar">
      <button id="expBtn">Export CSV</button><button id="impBtn">Import CSV</button><button class="danger" id="clrBtn">Clear</button>
    </div>
    <div id="histList">${list.length ? list.slice(0, 300).map(histRowHTML).join('') : '<div class="empty">No hands yet. Play one!</div>'}</div>
    ${list.length > 300 ? `<div class="about">Showing the latest 300. Export CSV to see them all.</div>` : ''}`, { full: true });
  $('closeBtn').onclick = closeSheet;
  $('expBtn').onclick = () => doExport();
  $('impBtn').onclick = () => $('importFile').click();
  $('clrBtn').onclick = () => {
    if (!list.length) return;
    if (confirm(`Delete all ${list.length} saved hands from this device? Export first if you want a backup.`)) { clearHistory(); showHistory(); }
  };
  document.querySelectorAll('.hist').forEach((b) => (b.onclick = () => showHandDetail(list[Number(b.dataset.idx)])));
}

function showHandDetail(h) {
  openSheet(`
    <div class="sheet-top"><h2>${esc(h.heroPos)} · ${esc(h.heroCode)} · $${esc(h.stakes)}</h2><button class="close" id="backBtn">‹</button></div>
    <button class="btn primary" style="width:100%;margin-bottom:12px" id="copyHist">Copy for coach</button>
    <pre class="coach">${esc(h.coachText)}</pre>
    <h3>Preflop feedback</h3>
    ${(h.decisions || []).map(gradeHTML).join('') || '<div class="empty">No preflop decision.</div>'}`, { full: true });
  $('backBtn').onclick = showHistory;
  $('copyHist').onclick = () => copyText(h.coachText);
}

function showStats() {
  const st = computeStats(loadHistory());
  const kinds = st.kinds.map((k) => `<div class="bar-row">
      <div class="lab">${esc(k.label)} <span>· ${k.total} decisions${k.situational ? `, ${k.situational} situational` : ''}</span></div>
      <div class="pc">${k.pct == null ? '—' : `${k.pct}%`}</div>
      <div class="bar"><i style="width:${k.pct ?? 0}%;background:${k.pct >= 80 ? 'var(--ok)' : k.pct >= 60 ? 'var(--warn)' : 'var(--bad)'}"></i></div></div>`).join('');
  const missed = st.topMissed.map((m) => `<div class="miss"><div class="n">${m.count}×</div><div class="d">
      <b>${m.code === 'sizing' ? esc(m.chart) : `${esc(m.code)}: ${esc(m.action)}`}</b>
      <span>${esc(m.spot)}${m.code === 'sizing' ? '' : ` · ${esc(m.chart)}`}</span><br><span>${esc(m.example)}</span></div></div>`).join('');
  openSheet(`
    <div class="sheet-top"><h2>Stats</h2><button class="close" id="closeBtn">✕</button></div>
    <div class="kpis">
      <div class="kpi"><div class="v">${st.hands}</div><div class="l">Hands</div></div>
      <div class="kpi"><div class="v">${st.pct == null ? '—' : `${st.pct}%`}</div><div class="l">Preflop accuracy</div></div>
      <div class="kpi"><div class="v">${st.sizingChecks ? `${Math.round((st.sizingOk / st.sizingChecks) * 100)}%` : '—'}</div><div class="l">Sizing on target</div></div>
    </div>
    <h3>Preflop accuracy by scenario</h3>
    ${kinds || '<div class="empty">Play some hands first.</div>'}
    <h3>Most-missed spots</h3>
    ${missed || '<div class="empty">Nothing missed yet. Nice.</div>'}
    <div class="about" style="margin-top:12px">Mixed-frequency plays count as correct. Situational hands (Mark's rule) are not counted either way.</div>`, { full: true });
  $('closeBtn').onclick = closeSheet;
}

function showMenu() {
  const seg = (key, opts) => `<div class="seg">${opts.map(([v, l]) => `<button data-k="${key}" data-v="${v}" class="${String(settings[key]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  openSheet(`
    <h2>Settings</h2>
    <div class="setting"><b>Villain speed</b>${seg('speed', [['normal', 'Normal'], ['fast', 'Fast'], ['instant', 'Instant']])}</div>
    <div class="setting"><b>Deck</b>${seg('fourColor', [['true', '4-color'], ['false', '2-color']])}</div>
    <h3>How it works</h3>
    <div class="about">
      <p>Every hand is a real 52-card shuffle. You only get dealt hands the HHP chart plays in your spot. Villain types are hidden until the hand ends. The reads are your clues.</p>
      <p>Preflop gets graded against the charts and HHP sizing rules. Postflop is for your coach: tap <b>Copy for coach</b>.</p>
      <p>Everything runs on your phone. Hands are saved on this device only, so export a CSV to back them up.</p>
      <p>Villain tendencies: <code>config/villains.js</code>. Charts: <code>data/ranges.json</code> (built from preflop-ranges.csv).</p>
    </div>`);
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
$('drillBtn').onclick = showDrills;
$('historyBtn').onclick = showHistory;
$('statsBtn').onclick = showStats;
$('menuBtn').onclick = showMenu;
document.querySelectorAll('.tab').forEach((b) => (b.onclick = () => {
  tab = b.dataset.tab;
  document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === b));
  $('logPanel').classList.toggle('hidden', tab !== 'log');
  $('readsPanel').classList.toggle('hidden', tab !== 'reads');
}));
$('seats').addEventListener('click', (e) => {
  const seat = e.target.closest('.seat');
  if (!seat) return;
  document.querySelector('.tab[data-tab="reads"]').click();
  renderReads(Number(seat.dataset.seat));
});

async function boot() {
  applySettings();
  try {
    const res = await fetch('data/ranges.json');
    ranges = await res.json();
  } catch {
    $('actionbar').innerHTML = '<div class="status">Could not load charts. Reconnect once to cache the app.</div>';
    return;
  }
  newHand();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}
boot();
