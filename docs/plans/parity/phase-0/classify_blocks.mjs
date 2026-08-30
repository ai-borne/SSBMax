#!/usr/bin/env node
// Throwaway Phase-0 classifier for the readable-study-content plan.
// Scores every block in every content/**/*.md file against the draft
// taxonomy (D1 in the plan) and reports the % that falls back to `paragraph`.
// Not wired into any build; run once, findings captured, then discarded.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "content");

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (entry.name.endsWith(".md")) out.push(p);
  }
  return out;
}

function stripFrontmatter(text) {
  if (!text.startsWith("---")) return text;
  const end = text.indexOf("\n---", 3);
  if (end === -1) return text;
  return text.slice(end + 4);
}

const SPEC_LINE = /^\*\*[^*]+\*\*:\s*.+/;
const CALLOUT_LEAD = /^\*\*(Remember|Key Insight|Tip|Warning|Note)\b/i;
const WRONG_RIGHT = /^\*\*(Wrong|Right)\b/i;
const MYTH_REALITY = /^\*\*(Myth\s*\d*|Reality)\b/i;
const PROBLEM_SOLUTION = /^\*\*(Problem|Solution)\b/i;
const INDICATOR = /^\*\*(Positive|Negative)\s+Indicators?\b/i;
const TIMELINE_STEP = /^\*\*[^*]+\*\*:\s*.+/; // same shape as spec line; disambiguated by content below
const TIME_OR_RELATIVE = /^\*\*(\d{1,2}(:\d{2})?\s*(AM|PM)?|[\w\s]*\b(Before|After|Day|Week|Days|Weeks)\b[\w\s]*)\*\*:/i;
const LIST_ITEM = /^([-*]|\d+\.)\s+/;
const PIPE_TABLE_ROW = /^\|.+\|$/;

function classifyLine(line) {
  const t = line.trim();
  if (!t) return "blank";
  if (/^#{1,6}\s/.test(t)) return "heading";
  if (PIPE_TABLE_ROW.test(t)) return "table";
  if (CALLOUT_LEAD.test(t)) return "callout";
  if (WRONG_RIGHT.test(t) || MYTH_REALITY.test(t) || PROBLEM_SOLUTION.test(t) || INDICATOR.test(t)) return "comparison";
  if (TIME_OR_RELATIVE.test(t)) return "timeline";
  if (SPEC_LINE.test(t)) return "specTable";
  if (LIST_ITEM.test(t)) return "list";
  return "paragraph";
}

const files = walk(ROOT);
const totals = {};
let totalLines = 0;
const perFile = [];

for (const file of files) {
  const raw = fs.readFileSync(file, "utf8");
  const body = stripFrontmatter(raw);
  const lines = body.split("\n").filter((l) => l.trim().length > 0);
  const fileTotals = {};
  for (const line of lines) {
    const cls = classifyLine(line);
    totals[cls] = (totals[cls] || 0) + 1;
    fileTotals[cls] = (fileTotals[cls] || 0) + 1;
    totalLines++;
  }
  perFile.push({ file: path.relative(ROOT, file), fileTotals, lineCount: lines.length });
}

console.log("=== Aggregate line classification across", files.length, "files ===");
for (const [cls, count] of Object.entries(totals).sort((a, b) => b[1] - a[1])) {
  const pct = ((count / totalLines) * 100).toFixed(1);
  console.log(`${cls.padEnd(12)} ${String(count).padStart(6)}  ${pct}%`);
}
const nonHeadingTotal = totalLines - (totals.heading || 0);
const paragraphPct = ((totals.paragraph || 0) / nonHeadingTotal) * 100;
console.log(`\nTotal lines: ${totalLines} (${totals.heading || 0} headings excluded from denominator)`);
console.log(`Paragraph fallback (of non-heading lines): ${paragraphPct.toFixed(1)}%`);

const paragraphPctExclFaq = (() => {
  const faq = perFile.find((f) => f.file === "faq.md");
  const faqParagraph = faq ? (faq.fileTotals.paragraph || 0) : 0;
  const faqHeading = faq ? (faq.fileTotals.heading || 0) : 0;
  const denom = nonHeadingTotal - (faq ? faq.lineCount - faqHeading : 0);
  return (((totals.paragraph || 0) - faqParagraph) / denom) * 100;
})();
console.log(`Paragraph fallback excluding faq.md (its own FAQPage path, not this taxonomy): ${paragraphPctExclFaq.toFixed(1)}%`);

// Files with highest paragraph fallback ratio (excluding genuinely prose-only files)
const worst = perFile
  .map((f) => ({
    ...f,
    paragraphRatio: (f.fileTotals.paragraph || 0) / f.lineCount,
  }))
  .sort((a, b) => b.paragraphRatio - a.paragraphRatio)
  .slice(0, 10);

console.log("\n=== Top 10 files by paragraph-fallback ratio ===");
for (const f of worst) {
  console.log(`${(f.paragraphRatio * 100).toFixed(0)}%  ${f.file}  (${f.lineCount} lines)`);
}

fs.writeFileSync(
  path.join(process.cwd(), "classify_blocks_output.json"),
  JSON.stringify({ totals, totalLines, perFile }, null, 2)
);
