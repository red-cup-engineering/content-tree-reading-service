import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  confine,
  readContentResource,
  listContentEntries,
  readContentTree,
  readArticleTree,
  listArticleEntries,
  readNoteResource,
  parseNoteName,
  parseNotePath,
  DEFAULT_CONTENT_GRAMMAR,
} from "../src/content-tree.mjs";

async function fixtureRoot() {
  return mkdtemp(join(tmpdir(), "content-tree-"));
}

async function write(root, relativePath, content) {
  const full = join(root, relativePath);
  await mkdir(join(full, ".."), { recursive: true });
  await writeFile(full, content, "utf8");
}

test("confine resolves a relative path under root and refuses traversal outside it", async () => {
  const root = await fixtureRoot();
  try {
    assert.equal(confine(root, "a/b.md"), join(root, "a/b.md"));
    assert.equal(confine(root, ""), root);
    assert.throws(() => confine(root, "../escape.md"), /confine: path escapes the root/u);
    assert.throws(() => confine(root, "a/../../escape.md"), /confine: path escapes the root/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("readContentResource reads one confined resource by relative path", async () => {
  const root = await fixtureRoot();
  try {
    await write(root, "content/documents/articles/one.md", "# One\n");
    const resource = readContentResource(root, "content/documents/articles/one.md");
    assert.equal(resource.path, "content/documents/articles/one.md");
    assert.equal(resource.content, "# One\n");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("listContentEntries lists one directory sorted, excluding VCS and dependency stores", async () => {
  const root = await fixtureRoot();
  try {
    await write(root, "content/b.md", "b");
    await write(root, "content/a.md", "a");
    await mkdir(join(root, "content/.git"), { recursive: true });
    await mkdir(join(root, "content/node_modules"), { recursive: true });
    await mkdir(join(root, "content/sub"), { recursive: true });
    const entries = listContentEntries(root, "content");
    assert.deepEqual(entries.map((entry) => entry.name), ["a.md", "b.md", "sub"]);
    assert.deepEqual(entries.map((entry) => entry.kind), ["file", "file", "directory"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("readContentTree walks a confined region for Markdown resources only, bounded by limit/maxScan", async () => {
  const root = await fixtureRoot();
  try {
    await write(root, "content/one.md", "one");
    await write(root, "content/nested/two.md", "two");
    await write(root, "content/ignored.txt", "not markdown");
    await mkdir(join(root, "content/node_modules"), { recursive: true });
    await write(root, "content/node_modules/should-not-appear.md", "excluded");

    const all = readContentTree(root, "content");
    assert.deepEqual(
      all.map((resource) => resource.path).sort(),
      ["content/nested/two.md", "content/one.md"],
    );

    const limited = readContentTree(root, "content", { limit: 1 });
    assert.equal(limited.length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("DEFAULT_CONTENT_GRAMMAR: readArticleTree/listArticleEntries/readNoteResource scope to content/documents/articles by default", async () => {
  const root = await fixtureRoot();
  try {
    await write(root, "content/documents/articles/essay.md", "an essay");
    await write(
      root,
      "content/documents/articles/notes/2026/07/29/2026-07-29-note-on-content-tree.md",
      "a note",
    );

    const articles = readArticleTree(root);
    assert.deepEqual(articles.map((resource) => resource.path).sort(), [
      "content/documents/articles/essay.md",
      "content/documents/articles/notes/2026/07/29/2026-07-29-note-on-content-tree.md",
    ]);

    const topLevel = listArticleEntries(root);
    assert.deepEqual(topLevel.map((entry) => entry.name), ["essay.md", "notes"]);

    const note = readNoteResource(root, "2026/07/29/2026-07-29-note-on-content-tree.md");
    assert.equal(note.content, "a note");
    assert.equal(
      note.path,
      "content/documents/articles/notes/2026/07/29/2026-07-29-note-on-content-tree.md",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("grammar override is wholesale: a caller-supplied grammar replaces defaults rather than merging with them", async () => {
  const root = await fixtureRoot();
  try {
    const customGrammar = Object.freeze({
      articleRoot: "vault/posts/",
      noteRoot: "vault/posts/scraps/",
      noteName: Object.freeze({ pattern: /^(\d{4})-(\d{2})-(\d{2})_([a-z0-9-]+)\.md$/u }),
    });
    await write(root, "vault/posts/hello.md", "hello");
    await write(root, "content/documents/articles/default-shaped.md", "should not be seen");

    const articles = readArticleTree(root, "", {}, customGrammar);
    assert.deepEqual(articles.map((resource) => resource.path), ["vault/posts/hello.md"]);

    const parsed = parseNoteName("2026-07-29_content-tree.md", customGrammar);
    assert.deepEqual(parsed, { date: "2026-07-29", year: "2026", month: "07", day: "29", token: "content-tree" });
    assert.equal(parseNoteName("2026-07-29-note-on-content-tree.md", customGrammar), null);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("parseNoteName extracts date and token from a conforming name, null otherwise", () => {
  assert.deepEqual(parseNoteName("2026-07-29-note-on-content-tree.md"), {
    date: "2026-07-29",
    year: "2026",
    month: "07",
    day: "29",
    token: "content-tree",
  });
  assert.equal(parseNoteName("not-a-note.md"), null);
  assert.equal(parseNoteName("2026-07-29-note-on-.md"), null);
  assert.deepEqual(parseNoteName("2026-13-40-note-on-bad-calendar.md"), {
    date: "2026-13-40",
    year: "2026",
    month: "13",
    day: "40",
    token: "bad-calendar",
  }, "the note-name law is a filename shape, not a calendar validator");
});

test("parseNotePath requires the YYYY/MM/DD directory to agree with the filename date", () => {
  const conforming = parseNotePath("2026/07/29/2026-07-29-note-on-content-tree.md");
  assert.deepEqual(conforming, {
    date: "2026-07-29",
    year: "2026",
    month: "07",
    day: "29",
    token: "content-tree",
    path: "2026/07/29/2026-07-29-note-on-content-tree.md",
  });
  assert.equal(parseNotePath("2026/07/30/2026-07-29-note-on-content-tree.md"), null);
  assert.equal(parseNotePath("2026-07-29-note-on-content-tree.md"), null);
});

test("DEFAULT_CONTENT_GRAMMAR documents the standard content/documents/articles/notes path grammar", () => {
  assert.equal(DEFAULT_CONTENT_GRAMMAR.articleRoot, "content/documents/articles/");
  assert.equal(DEFAULT_CONTENT_GRAMMAR.noteRoot, "content/documents/articles/notes/");
  assert.ok(DEFAULT_CONTENT_GRAMMAR.noteName.pattern instanceof RegExp);
});
