'use strict';

const { header, ALL_SOURCE_FILES } = require('./header');

// camelCase -> kebab-case, matching web/src/index.css's existing --color-* naming.
function cssVarName(name) {
  return `--color-${name.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
}

function emitCss(data) {
  const { tokens } = data;
  const out = [];
  out.push(header('css', ALL_SOURCE_FILES));
  out.push(':root {');
  for (const t of tokens.tokens) {
    out.push(`  ${cssVarName(t.name)}: ${t.light};`);
  }
  out.push('}');
  out.push('');
  out.push('.dark {');
  for (const t of tokens.tokens) {
    out.push(`  ${cssVarName(t.name)}: ${t.dark};`);
  }
  out.push('}');
  out.push('');

  return out.join('\n');
}

module.exports = { emitCss, cssVarName };
