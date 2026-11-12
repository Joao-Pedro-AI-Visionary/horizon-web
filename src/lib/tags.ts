/**
 * rankTags returns the `n` most frequent tags of the given items (ties in
 * alphabetical order). The feed's category chips are built from it.
 */
export function rankTags(items: { tags: string[] | null }[], n = 6): string[] {
  const count = new Map<string, number>()
  for (const it of items) for (const t of it.tags ?? []) count.set(t, (count.get(t) ?? 0) + 1)
  return [...count.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([t]) => t)
}
