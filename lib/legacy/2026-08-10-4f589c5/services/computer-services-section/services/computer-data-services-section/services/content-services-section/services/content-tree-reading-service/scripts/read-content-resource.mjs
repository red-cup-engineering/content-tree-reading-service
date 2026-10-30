import { readContentResource } from "../src/content-tree.mjs";
import { runJsonCommand } from "./run-json-command.mjs";

/** Read exactly one caller-addressed resource beneath an explicit filesystem root. */
export function readContentResourceAction({ root, path }) { return readContentResource(root, path); }
if (import.meta.main) await runJsonCommand(readContentResourceAction);
