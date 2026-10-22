// Pipeline Review labels, shared by the Friday pipeline report and the closer scorecard.
// Labeling convention (from Oct 2026): column B = category, column F = outcome; an outcome written in
// column B is still read during the switch.

// Column B: the lead's category. "Verbal" counts as High Confidence (flagged so the label gets fixed).
export function category(b) {
  const s = b.toLowerCase().trim();
  if (s.startsWith('high conf')) return 'hc';
  if (s === 'verbal') return 'hc';
  if (s.startsWith('soft verbal') || s.includes('reengag')) return 'sv';
  if (s.startsWith('working') || s.includes('good call')) return 'working';
  return null;
}
// Outcome from column F (new convention) or column B (old). Only Closed and Signed count as closed.
export function outcome(b, f) {
  const fs_ = f.toLowerCase().trim(), bs = b.toLowerCase().trim();
  if (['closed', 'signed'].includes(fs_) || fs_ === 'true') return 'closed';
  if (fs_ === 'delayed') return 'delayed';
  if (['closed', 'signed'].includes(bs)) return 'closed';
  if (bs === 'delayed') return 'delayed';
  if (bs === 'lost' || fs_ === 'lost') return 'lost';
  return null;
}
// Column D cash amount, or null when blank or not a number
export const money = (v) => {
  const n = Number(String(v).replace(/[$,\s]/g, ''));
  return String(v).trim() === '' || Number.isNaN(n) ? null : n;
};
