/** "silent hill, deus ex" -> ["silent hill", "deus ex"] */
export function parseTerms(list: string): string[] {
  return list
    .split(",")
    .map((term) => term.trim().toLowerCase())
    .filter(Boolean);
}

/** Substring match. `title` is expected to already be lowercased. */
export function matchesAny(title: string, terms: string[]): boolean {
  return terms.some((term) => title.includes(term));
}
