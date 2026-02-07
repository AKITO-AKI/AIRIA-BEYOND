function isWhitespace(ch) {
  return ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t';
}

/**
 * Extract the first complete JSON object substring from a text blob.
 * Useful when an LLM returns prose + JSON.
 */
export function extractFirstJsonObjectText(text) {
  const s = String(text || '');
  const n = s.length;

  let start = -1;
  for (let i = 0; i < n; i += 1) {
    const ch = s[i];
    if (ch === '{') {
      start = i;
      break;
    }
    // If the model starts with whitespace, keep scanning.
    if (!isWhitespace(ch)) {
      // still keep scanning in case it begins with BOM/other chars
    }
  }
  if (start < 0) return '';

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < n; i += 1) {
    const ch = s[i];

    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return s.slice(start, i + 1);
      }
    }
  }

  return '';
}

export function parseJsonLoose(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    const extracted = extractFirstJsonObjectText(raw);
    if (!extracted) return null;
    try {
      return JSON.parse(extracted);
    } catch {
      return null;
    }
  }
}
