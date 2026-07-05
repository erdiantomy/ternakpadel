// Shared display formatters.

export const rupiah = (n) => "Rp " + (n || 0).toLocaleString("id-ID");

// Drop unpaired surrogates and truncate by whole characters (code points).
// A lone surrogate — e.g. half an emoji left by a code-unit .slice() — makes
// JSON.stringify emit a \udXXX escape that PostgREST rejects, so any insert
// carrying it fails with PGRST102 "Empty or invalid json". Array.from splits
// by code point: a valid emoji is a 2-unit string, only a LONE surrogate is a
// single unit in the surrogate range.
export const cleanCut = (s, n = Infinity) =>
  Array.from(String(s ?? "")).filter((c) => !/^[\uD800-\uDFFF]$/.test(c)).slice(0, n).join("");
