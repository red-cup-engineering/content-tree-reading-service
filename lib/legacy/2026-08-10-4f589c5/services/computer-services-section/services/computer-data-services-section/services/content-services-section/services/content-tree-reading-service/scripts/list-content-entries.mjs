import { listContentEntries } from "../src/content-tree.mjs";
import { runJsonCommand } from "./run-json-command.mjs";

/** List one caller-addressed directory beneath an explicit filesystem root. */
export function listContentEntriesAction({ root, path = "" }) { return listContentEntries(root, path); }
if (import.meta.main) await runJsonCommand(listContentEntriesAction);
