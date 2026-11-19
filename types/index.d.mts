/** A boundary resource read from a content tree: its address and its content. */
export interface ContentResource {
  readonly path: string;
  readonly content: string;
}

export interface ContentEntry {
  readonly name: string;
  readonly kind: "directory" | "file" | "other";
}

export interface ReadContentTreeOptions {
  readonly limit?: number;
  readonly maxScan?: number;
}

export interface NoteNameGrammar {
  readonly pattern: RegExp;
}

/** The content/documents/articles path grammar: a default parameter set, overridable wholesale. */
export interface ContentPathGrammar {
  readonly articleRoot: string;
  readonly noteRoot: string;
  readonly noteName: NoteNameGrammar;
}

export interface ParsedNoteName {
  readonly date: string;
  readonly year: string;
  readonly month: string;
  readonly day: string;
  readonly token: string;
}

export interface ParsedNotePath extends ParsedNoteName {
  readonly path: string;
}

export declare const DEFAULT_CONTENT_GRAMMAR: ContentPathGrammar;

export declare function confine(root: string, relativePath: string): string;
export declare function readContentResource(root: string, relativePath: string): ContentResource;
export declare function listContentEntries(root: string, relativePath: string): readonly ContentEntry[];
export declare function readContentTree(
  root: string,
  region?: string,
  options?: ReadContentTreeOptions,
): readonly ContentResource[];

export declare function readArticleTree(
  root: string,
  region?: string,
  options?: ReadContentTreeOptions,
  grammar?: ContentPathGrammar,
): readonly ContentResource[];
export declare function listArticleEntries(
  root: string,
  region?: string,
  grammar?: ContentPathGrammar,
): readonly ContentEntry[];
export declare function readNoteResource(
  root: string,
  relativeNotePath: string,
  grammar?: ContentPathGrammar,
): ContentResource;
export declare function parseNoteName(
  name: string,
  grammar?: ContentPathGrammar,
): ParsedNoteName | null;
export declare function parseNotePath(
  relativePath: string,
  grammar?: ContentPathGrammar,
): ParsedNotePath | null;
