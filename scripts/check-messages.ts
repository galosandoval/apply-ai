/**
 * Reports keys that `en.json` has and another locale does not, and keys the
 * other locale has that English no longer does.
 *
 * Deliberately not wired into CI or a pre-commit hook — with one translator and
 * one locale, a gap is a thing to look at before shipping, not a thing to
 * block a commit. A missing key is survivable at runtime: production falls back
 * to the English string (see `src/i18n/request.ts`).
 *
 *   npm run check:messages
 */
import { readFileSync } from "node:fs"
import { routing } from "../src/i18n/routing"

type Messages = Record<string, unknown>

/** Every leaf path in a message tree, dotted. */
function paths(messages: Messages, prefix = ""): string[] {
  return Object.entries(messages).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key

    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? paths(value as Messages, path)
      : [path]
  })
}

function read(locale: string) {
  return JSON.parse(
    readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), "utf8")
  ) as Messages
}

const english = new Set(paths(read(routing.defaultLocale)))
let failed = false

for (const locale of routing.locales) {
  if (locale === routing.defaultLocale) continue

  const theirs = new Set(paths(read(locale)))
  const missing = [...english].filter((path) => !theirs.has(path))
  const extra = [...theirs].filter((path) => !english.has(path))

  if (!missing.length && !extra.length) {
    console.log(
      `${locale}: matches ${routing.defaultLocale} (${theirs.size} keys)`
    )
    continue
  }

  failed = true

  if (missing.length) {
    console.log(`\n${locale}: ${missing.length} missing`)
    for (const path of missing) console.log(`  - ${path}`)
  }

  if (extra.length) {
    console.log(`\n${locale}: ${extra.length} not in ${routing.defaultLocale}`)
    for (const path of extra) console.log(`  + ${path}`)
  }
}

process.exit(failed ? 1 : 0)
