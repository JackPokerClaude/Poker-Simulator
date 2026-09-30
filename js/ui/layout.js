// Table geometry. Seat positions are percent of the table area; seat index 0 is the hero,
// then clockwise. Two layouts: "wide" for laptop/monitor-shaped tables, "tall" for phones.
//
// Chips are placed from each seat's real on-screen box so they never slide under the seat as
// the table scales: side "below" / "above" / "inward" says which side of the seat the chips go,
// and "shift" moves them toward the table centre by that fraction of the seat width.
// The layout stress test checks chips against the pot, board, hero cards and each other.
export const LAYOUTS = {
  wide: {
    seats: [[50, 93], [18, 82], [8, 50], [21, 15], [50, 10], [79, 15], [92, 50], [82, 82]],
    chips: [null,
      { side: 'above', shift: 0.55 }, { side: 'inward' }, { side: 'below', shift: 0.55 }, { side: 'below', shift: 0 },
      { side: 'below', shift: 0.55 }, { side: 'inward' }, { side: 'above', shift: 0.55 }],
    boardY: 51,
  },
  tall: {
    seats: [[50, 93], [12, 80], [9, 48], [18, 17], [50, 10], [82, 17], [91, 48], [88, 80]],
    chips: [null,
      { side: 'above', shift: 0.45 }, { side: 'above', shift: 0 }, { side: 'below', shift: 0.8 }, { side: 'below', shift: 0 },
      { side: 'below', shift: 0.8 }, { side: 'above', shift: 0 }, { side: 'above', shift: 0.45 }],
    boardY: 53,
  },
};

// Pick the layout for a table of this size (px), plus the scale factor for seats, cards and chips.
// Scale 1 is the phone size the UI was designed at (about 380 x 330).
export function layoutFor(w, h) {
  const kind = w / h >= 1.35 ? 'wide' : 'tall';
  // Below 1 only when the table is squeezed (e.g. the prediction panel is open on a phone).
  const k = Math.max(0.72, Math.min(w / (kind === 'wide' ? 560 : 380), h / 330, 3.2));
  return { kind, k: Math.round(k * 100) / 100, ...LAYOUTS[kind] };
}

// Centre point (px, relative to the table) for a chip of size cw x ch next to seat box s.
export function chipCenter(rule, s, cw, ch, tableW, gap) {
  const scx = (s.left + s.right) / 2, scy = (s.top + s.bottom) / 2;
  const dir = scx < tableW / 2 - 1 ? 1 : scx > tableW / 2 + 1 ? -1 : 0; // toward the centre
  const sw = s.right - s.left;
  if (rule.side === 'inward') {
    return [dir >= 0 ? s.right + gap + cw / 2 : s.left - gap - cw / 2, scy];
  }
  const cx = scx + dir * (rule.shift || 0) * sw;
  const cy = rule.side === 'above' ? s.top - gap - ch / 2 : s.bottom + gap + ch / 2;
  return [cx, cy];
}
