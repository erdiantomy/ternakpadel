// Toms Padel venue config: one home venue with four named courts.
// Courts are stored as 1-based numbers (matches.court, events.courts); these
// map a court number to its name. Falls back to "Court N" for any extra court.

export const VENUE_DEFAULT = "TOMS PADEL";

export const COURT_NAMES = ["CANGU", "UBUD", "SANUR", "KUTA"];

export function courtName(n) {
  return COURT_NAMES[(n || 1) - 1] || `Court ${n}`;
}
