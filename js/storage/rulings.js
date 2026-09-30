// Your rulings on the brain's ⚖ conflicts and ♣ open questions, on this device. A ruling is a
// record for your brain session, not a change to the app: every conflict stays ungraded here
// until the brain itself is updated ("Copy rulings" gives the text to paste there).
const KEY = 'hhp-sim-rulings-v1';
let memory = {};

export const UNDECIDED = 'undecided';

export function loadRulings() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return { ...memory }; }
}

// value: 'undecided' | 'view:0' | 'view:1' | ... | 'all'
export function setRuling(id, value, meta = {}) {
  const all = loadRulings();
  if (!value || value === UNDECIDED) delete all[id];
  else all[id] = { value, at: new Date().toISOString(), ...meta };
  memory = all;
  try { localStorage.setItem(KEY, JSON.stringify(all)); return true; } catch { return false; }
}

export const rulingOf = (id) => loadRulings()[id]?.value || UNDECIDED;
