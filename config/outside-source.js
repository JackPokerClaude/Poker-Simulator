// [OUTSIDE SOURCE] defaults for spots no HHP chart covers. Not from the brain: edit freely.
//
// HHP has open charts for EP, HJ, BTN and BTN vs two fish only (project-instructions.md:
// "There's no CO, MP, or SB open chart"). For those seats an open is graded against a
// bracket of two HHP charts:
//   floor   = a tighter seat's chart: hands it opens are clear opens here too
//   ceiling = a looser seat's chart: hands only it opens are borderline here
//   hands neither opens are folds.
export const OUTSIDE_SOURCE = {
  openBrackets: {
    MP: { floor: 'RFI - EP - 200BB', ceiling: 'RFI - HJ - 200BB' },
    CO: { floor: 'RFI - HJ - 200BB', ceiling: 'RFI - BTN - 200BB' },
    SB: { floor: 'RFI - HJ - 200BB', ceiling: 'RFI - BTN - 200BB' },
  },
};
