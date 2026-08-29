import { Fragment, ReactNode } from 'react';

/**
 * Splits `**bold**` runs out of otherwise-plain text into `<strong>` spans, without going
 * through `dangerouslySetInnerHTML` -- block-level parsing (parseDocument.js) only strips
 * section/list/table syntax, so a block's `text`/`items` may still carry inline `**bold**`
 * markers (content/SCHEMA.md). Kotlin's twin is `parseInlineBold` in `MarkdownText.kt`, reused
 * by the Compose block views rather than duplicated.
 */
export function renderInlineBold(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}
