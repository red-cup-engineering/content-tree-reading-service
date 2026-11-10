// Adapted from test/content-tree.test.mjs to import the installed package.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readContentResource } from "@red-cup-engineering/content-tree-reading-service";

async function fixtureRoot() {
  return mkdtemp(join(tmpdir(), "content-tree-"));
}

async function write(root, relativePath, content) {
  const full = join(root, relativePath);
  await mkdir(join(full, ".."), { recursive: true });
  await writeFile(full, content, "utf8");
}

test("CONTENT-TREE-QUICKSTART", async () => {
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
