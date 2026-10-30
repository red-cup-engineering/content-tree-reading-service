import { readContentTree } from "../src/content-tree.mjs";
import { runJsonCommand } from "./run-json-command.mjs";

/** Read a bounded Markdown tree beneath an explicit filesystem root and region. */
export function readContentTreeAction({ root, region = "", options = {} }) { return readContentTree(root, region, options); }
if (import.meta.main) await runJsonCommand(readContentTreeAction);
