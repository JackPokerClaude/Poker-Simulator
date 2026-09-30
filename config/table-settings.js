// [OUTSIDE SOURCE] table settings: not from the brain, edit freely.
// Which player types sit at the table, live open sizes, and how much looser players get late.
// The type definitions themselves (how each type plays) come from the brain via
// brain-compiled/behavior.json.
export const TABLE_SETTINGS = {
  // How often each type sits at the table, per stake (weights, any scale). The reg/pro only sits
  // at 1/3 and 2/5.
  tableMix: {
    '1/2': { rec: 30, passive: 20, tight: 10, whale: 10, aggressive: 18, thinking: 12 },
    '1/3': { rec: 27, passive: 20, tight: 12, whale: 9, aggressive: 18, thinking: 14, pro: 6 },
    '2/5': { rec: 20, passive: 20, tight: 14, whale: 8, aggressive: 20, thinking: 18, pro: 12 },
  },
  // Normal live open sizes in dollars (one is picked at random). Big opens (the premium tell)
  // are these times the brain's big-open multiplier. HHP gives 20-25 as a normal 2/5 rec open.
  openSizes: {
    '1/2': [10, 10, 12, 12, 15],
    '1/3': [12, 15, 15, 15, 20],
    '2/5': [20, 20, 25, 25, 25],
  },
  // Seat multipliers on open/limp ranges (live players loosen up late).
  positionFactor: { 'UTG': 0.85, 'UTG+1': 0.9, 'LJ': 1.0, 'HJ': 1.1, 'CO': 1.35, 'BTN': 1.6, 'SB': 1.05, 'BB': 1.2 },
};
