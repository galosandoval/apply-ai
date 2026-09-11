import { type SectionCatalogTranslate } from "./section-catalog"

/**
 * `useTranslations("sectionCatalog")`, over the real message tree.
 *
 * Shared by the catalog and heading tests: both read the shipped message files
 * rather than stubbing them, because both match on the *copy* a user sees — a
 * test with its own invented labels would pass while the entry a user can see
 * failed to come back.
 *
 * The `messages` parameter asks for no more than it walks — the catalog
 * subtree, unknown below that — so a second language needs no cast to stand in
 * for the first.
 *
 * @param onMissing what a key with no string behind it returns. The two callers
 * want different answers and both are deliberate: the catalog tests assert a
 * label exists by checking the key comes back unchanged, while the heading
 * tests want the empty string a missing alias contributes to a match.
 */
export function sectionCatalogTranslator(
  messages: { sectionCatalog: unknown },
  onMissing: (key: string) => string
): SectionCatalogTranslate {
  function lookup(key: string) {
    return key
      .split(".")
      .reduce<unknown>(
        (node, part) =>
          typeof node === "object" && node !== null
            ? (node as Record<string, unknown>)[part]
            : undefined,
        messages.sectionCatalog
      )
  }

  function translate(key: string) {
    const value = lookup(key)

    return typeof value === "string" ? value : onMissing(key)
  }

  translate.has = (key: string) => typeof lookup(key) === "string"

  return translate
}
