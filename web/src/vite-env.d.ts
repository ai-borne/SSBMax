/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** Injected by vite.config.ts's `define` from package.json at build time. */
declare const __APP_VERSION__: string;

/** scripts/content/markdownTransforms.mjs lives outside this project's tsconfig `include`
 * (repo root's shared content/ pipeline, not a web-only module), so it has no type info of
 * its own from here -- see renderMarkdown.ts's import and that file's own doc comment for why
 * it's imported directly (not duplicated) from the browser bundle. */
declare module '*markdownTransforms.mjs' {
  export function shiftHeadingsHtml(html: string, offset: number): string;
  export function listifyLabelRuns(markdown: string): string;
  export const LABEL_LINE_RE: RegExp;
}
