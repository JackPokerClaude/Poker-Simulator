// Showdown via pokersolver (vendored at js/vendor/pokersolver.js, loaded as a global script).
import { cardStr } from './cards.js';

const lib = () => {
  const H = globalThis.Hand;
  if (!H || typeof H.solve !== 'function') throw new Error('pokersolver not loaded');
  return H;
};

// entries: [{ id, cards: [int, int] }], board: [int x5]
// Returns { byId: { id: { name, descr } }, winners: [ids] }
export function resolveShowdown(entries, board) {
  const H = lib();
  const solved = entries.map((e) => {
    const h = H.solve([...e.cards, ...board].map(cardStr));
    h.__id = e.id;
    return h;
  });
  const win = H.winners(solved).map((h) => h.__id);
  const byId = {};
  for (const h of solved) byId[h.__id] = { name: h.name, descr: h.descr };
  return { byId, winners: win };
}
