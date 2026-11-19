/**
 * Confined filesystem readings for content territory.
 *
 * Transcribed from `@red-cup-engineering/relating`'s `src/ledger/store.mts`
 * (the ledger's content-tier reader), which now re-exports from here as a
 * shim. `confine`/`readContentResource`/`listContentEntries`/`readContentTree`
 * are the sole effectful membrane onto a content tree; corpus packages do not
 * reimplement path confinement or traversal.
 *
 * The `content/documents/articles/...` path grammar (DOM-like: articles under
 * `content/documents/articles/`, dated notes under
 * `content/documents/articles/notes/YYYY/MM/DD/`) is a STANDARD WITH DEFAULTS,
 * never a hard limit: `DEFAULT_CONTENT_GRAMMAR` below is the default
 * parameter set every grammar-aware helper here accepts, and callers may
 * override it wholesale by passing their own grammar object.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const IGNORED_CONTENT = new Set([".git", "node_modules"]);

const statOrNull = (target) => {
  try {
    return statSync(target);
  } catch {
    return null;
  }
};

const relativeUnder = (root, full) =>
  relative(resolve(root), full).split(sep).join("/");

/** Resolve a relative address under root, refusing traversal outside root. */
export function confine(root, relativePath) {
  const rootAbsolute = resolve(root);
  const full = resolve(rootAbsolute, relativePath);
  if (full !== rootAbsolute && !full.startsWith(rootAbsolute + sep)) {
    throw new Error("confine: path escapes the root");
  }
  return full;
}

/** Read one raw content resource at a confined address. */
export function readContentResource(root, relativePath) {
  const full = confine(root, relativePath.trim());
  return Object.freeze({ path: relativeUnder(root, full), content: readFileSync(full, "utf8") });
}

/** List one confined directory, excluding VCS and dependency stores. */
export function listContentEntries(root, relativePath) {
  const full = confine(root, relativePath.trim());
  const entries = [];
  for (const entry of readdirSync(full, { withFileTypes: true })) {
    if (IGNORED_CONTENT.has(entry.name)) continue;
    entries.push(Object.freeze({
      name: entry.name,
      kind: entry.isDirectory() ? "directory" : entry.isFile() ? "file" : "other",
    }));
  }
  entries.sort((left, right) => left.name.localeCompare(right.name));
  return Object.freeze(entries);
}

/**
 * Walk a confined region for Markdown resources under explicit retention and
 * scan bounds. The traversal is stable and never follows a path outside root.
 */
export function readContentTree(root, region = "", options = {}) {
  const limit = options.limit ?? 200;
  const maxScan = options.maxScan ?? 20_000;
  const output = [];
  const frontier = [confine(root, region.trim())];
  let scanned = 0;
  while (frontier.length > 0 && output.length < limit && scanned < maxScan) {
    const current = frontier.shift();
    if (current === undefined) break;
    const state = statOrNull(current);
    if (state === null) continue;
    if (state.isDirectory()) {
      let children = [];
      try {
        children = readdirSync(current)
          .filter((name) => !IGNORED_CONTENT.has(name))
          .sort((left, right) => left.localeCompare(right));
      } catch {
        children = [];
      }
      for (const child of children) frontier.push(join(current, child));
      continue;
    }
    if (!state.isFile() || !current.endsWith(".md")) continue;
    scanned += 1;
    try {
      output.push(Object.freeze({
        path: relativeUnder(root, current),
        content: readFileSync(current, "utf8"),
      }));
    } catch {
      // An unreadable resource is absent from this bounded reading.
    }
  }
  return Object.freeze(output);
}

// --- content/documents/articles path grammar: defaults, never limits -----

/** Default note-name law: `YYYY-MM-DD-note-on-<token>.md`. */
const DEFAULT_NOTE_NAME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})-note-on-([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/u;

/**
 * Default content path grammar. Every grammar-aware helper below accepts a
 * `grammar` argument defaulting to this object; passing a different object
 * overrides the whole grammar, not just one field — there is no per-field
 * merge, on purpose, so an override can never silently inherit a stray
 * default.
 */
export const DEFAULT_CONTENT_GRAMMAR = Object.freeze({
  /** Root under which article documents live, DOM-like: `content/documents/articles/`. */
  articleRoot: "content/documents/articles/",
  /** Root under which dated note carriers live: `content/documents/articles/notes/`. */
  noteRoot: "content/documents/articles/notes/",
  /** The note-name law: how a conforming note filename encodes date + token. */
  noteName: Object.freeze({ pattern: DEFAULT_NOTE_NAME_PATTERN }),
});

const trimSlashes = (value) => value.replace(/^\/+/u, "").replace(/\/+$/u, "");

/** Join a grammar root (e.g. `articleRoot`) with a caller-supplied region. */
function joinUnderRoot(root, region) {
  const trimmedRoot = trimSlashes(root);
  const trimmedRegion = trimSlashes(region ?? "");
  if (!trimmedRegion) return trimmedRoot;
  return trimmedRoot ? `${trimmedRoot}/${trimmedRegion}` : trimmedRegion;
}

/** `readContentTree`, scoped by default to the grammar's article root. */
export function readArticleTree(root, region = "", options = {}, grammar = DEFAULT_CONTENT_GRAMMAR) {
  return readContentTree(root, joinUnderRoot(grammar.articleRoot, region), options);
}

/** `listContentEntries`, scoped by default to the grammar's article root. */
export function listArticleEntries(root, region = "", grammar = DEFAULT_CONTENT_GRAMMAR) {
  return listContentEntries(root, joinUnderRoot(grammar.articleRoot, region));
}

/** `readContentResource`, scoped by default to the grammar's note root. */
export function readNoteResource(root, relativeNotePath, grammar = DEFAULT_CONTENT_GRAMMAR) {
  return readContentResource(root, joinUnderRoot(grammar.noteRoot, relativeNotePath));
}

/**
 * Parse one note filename (not a full path) against the note-name law,
 * extracting the date and token. Returns `null` for a non-conforming name
 * rather than throwing: callers deciding whether a directory entry is a note
 * should be able to test-and-skip.
 */
export function parseNoteName(name, grammar = DEFAULT_CONTENT_GRAMMAR) {
  const match = grammar.noteName.pattern.exec(name);
  if (!match) return null;
  const [, year, month, day, token] = match;
  return Object.freeze({ date: `${year}-${month}-${day}`, year, month, day, token });
}

/**
 * Parse a note path relative to the grammar's note root (e.g.
 * `2026/07/29/2026-07-29-note-on-something.md`), requiring the `YYYY/MM/DD`
 * directory segments to agree with the date encoded in the filename. Returns
 * `null` when the name does not conform or the directory date disagrees with
 * the filename date.
 */
export function parseNotePath(relativePath, grammar = DEFAULT_CONTENT_GRAMMAR) {
  const segments = trimSlashes(relativePath).split("/");
  const name = segments.at(-1);
  if (name === undefined) return null;
  const parsed = parseNoteName(name, grammar);
  if (!parsed) return null;
  const [year, month, day] = segments.slice(-4, -1);
  if (year !== parsed.year || month !== parsed.month || day !== parsed.day) return null;
  return Object.freeze({ ...parsed, path: trimSlashes(relativePath) });
}
