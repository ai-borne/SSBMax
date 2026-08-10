'use strict';

/**
 * Minimal YAML subset parser for contracts/*.yaml.
 *
 * Supports exactly what those files use: '#' comments, 2-space indent,
 * nested maps, '- ' sequence items (scalar or map), inline flow sequences
 * '[a, b, c]', quoted and unquoted scalar strings, integers, booleans. It
 * does NOT support anchors, multi-doc streams, folded/literal block scalars,
 * or flow maps — those are intentionally kept out of contracts/*.yaml so
 * this parser can stay small and auditable in one sitting (dependency-free
 * by design — see contracts/README.md).
 */

function parseScalar(raw) {
  const s = raw.trim();
  if (s === '') return '';
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === 'null' || s === '~') return null;
  if (/^-?\d+$/.test(s)) return parseInt(s, 10);
  if (/^-?\d+\.\d+$/.test(s)) return parseFloat(s);
  if (s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1).replace(/\\"/g, '"');
  if (s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1).replace(/''/g, "'");
  if (s.startsWith('[') && s.endsWith(']')) {
    const inner = s.slice(1, -1).trim();
    if (inner === '') return [];
    return inner.split(',').map((item) => parseScalar(item.trim()));
  }
  return s;
}

function indentOf(line) {
  const m = line.match(/^(\s*)/);
  return m[0].length;
}

function stripComment(line) {
  // '#' only starts a comment when not inside quotes.
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (c === '"' && !inSingle) inDouble = !inDouble;
    else if (c === '#' && !inSingle && !inDouble) {
      // Only a comment if preceded by whitespace or start of line.
      if (i === 0 || /\s/.test(line[i - 1])) return line.slice(0, i);
    }
  }
  return line;
}

function findTopLevelColon(s) {
  let inSingle = false;
  let inDouble = false;
  let depth = 0;
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (c === '"' && !inSingle) inDouble = !inDouble;
    else if (!inSingle && !inDouble) {
      if (c === '[') depth += 1;
      else if (c === ']') depth -= 1;
      else if (c === ':' && depth === 0 && (i + 1 === s.length || s[i + 1] === ' ')) return i;
    }
  }
  return -1;
}

function parseYaml(text, sourcePath) {
  const rawLines = text.split('\n');
  const lines = [];
  rawLines.forEach((raw, idx) => {
    const noComment = stripComment(raw).replace(/\s+$/, '');
    if (noComment.trim() === '') return;
    if (noComment.trim() === '---') return;
    lines.push({ indent: indentOf(noComment), text: noComment.trim(), lineNo: idx + 1 });
  });

  let pos = 0;

  function fail(msg, lineNo) {
    throw new Error(`${sourcePath}:${lineNo != null ? lineNo : '?'}: ${msg}`);
  }

  function parseBlock(minIndent) {
    if (pos >= lines.length || lines[pos].indent < minIndent) return null;
    const blockIndent = lines[pos].indent;
    if (lines[pos].text.startsWith('- ') || lines[pos].text === '-') {
      return parseSequence(blockIndent);
    }
    return parseMapping(blockIndent);
  }

  function parseSequence(indent) {
    const arr = [];
    while (pos < lines.length && lines[pos].indent === indent && (lines[pos].text.startsWith('- ') || lines[pos].text === '-')) {
      const line = lines[pos];
      const rest = line.text === '-' ? '' : line.text.slice(2);
      if (rest === '') {
        pos += 1;
        const child = parseBlock(indent + 1);
        arr.push(child === null ? null : child);
        continue;
      }
      const colonIdx = findTopLevelColon(rest);
      if (colonIdx === -1) {
        // Scalar list item.
        pos += 1;
        arr.push(parseScalar(rest));
      } else {
        // Map item: first key on the '- ' line, rest of the map follows
        // indented at (indent + 2), same as the key's own column.
        const key = rest.slice(0, colonIdx).trim();
        const valueRaw = rest.slice(colonIdx + 1).trim();
        pos += 1;
        const obj = {};
        if (valueRaw !== '') {
          obj[key] = parseScalar(valueRaw);
        } else {
          const child = parseBlock(indent + 2);
          obj[key] = child;
        }
        // Sibling keys of this map item are indented 2 past '- '.
        const itemIndent = indent + 2;
        while (pos < lines.length && lines[pos].indent === itemIndent) {
          const kLine = lines[pos];
          const kColon = findTopLevelColon(kLine.text);
          if (kColon === -1) fail(`expected 'key: value' in list-item map, got '${kLine.text}'`, kLine.lineNo);
          const k = kLine.text.slice(0, kColon).trim();
          const vRaw = kLine.text.slice(kColon + 1).trim();
          if (obj[k] !== undefined) fail(`duplicate key '${k}' in mapping`, kLine.lineNo);
          if (vRaw !== '') {
            obj[k] = parseScalar(vRaw);
            pos += 1;
          } else {
            pos += 1;
            obj[k] = parseBlock(itemIndent + 1);
          }
        }
        arr.push(obj);
      }
    }
    return arr;
  }

  function parseMapping(indent) {
    const obj = {};
    while (pos < lines.length && lines[pos].indent === indent) {
      const line = lines[pos];
      if (line.text.startsWith('- ')) break;
      const colonIdx = findTopLevelColon(line.text);
      if (colonIdx === -1) fail(`expected 'key: value', got '${line.text}'`, line.lineNo);
      const key = line.text.slice(0, colonIdx).trim();
      const valueRaw = line.text.slice(colonIdx + 1).trim();
      if (Object.prototype.hasOwnProperty.call(obj, key)) fail(`duplicate key '${key}' in mapping`, line.lineNo);
      pos += 1;
      if (valueRaw !== '') {
        obj[key] = parseScalar(valueRaw);
      } else {
        obj[key] = parseBlock(indent + 1);
      }
    }
    return obj;
  }

  const result = parseBlock(0);
  if (pos < lines.length) fail(`unexpected indentation at '${lines[pos].text}'`, lines[pos].lineNo);
  return result || {};
}

module.exports = { parseYaml };
