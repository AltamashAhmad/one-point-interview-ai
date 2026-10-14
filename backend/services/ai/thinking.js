const OPEN = '<think>';
const CLOSE = '</think>';

/** Removes `<think>…</think>` reasoning blocks some models include in their answer. */
function stripThinking(text) {
  return (text || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

/**
 * Streaming counterpart of stripThinking: feed chunks in, get only visible text out.
 * Holds back a partial tag at a chunk boundary until the next chunk arrives.
 */
function createThinkingFilter() {
  let buffer = '';
  let inside = false;

  function push(chunk) {
    buffer += chunk;
    let out = '';
    for (;;) {
      if (inside) {
        const end = buffer.indexOf(CLOSE);
        if (end === -1) {
          buffer = buffer.slice(Math.max(0, buffer.length - CLOSE.length));
          return out;
        }
        buffer = buffer.slice(end + CLOSE.length);
        inside = false;
      } else {
        const start = buffer.indexOf(OPEN);
        if (start === -1) {
          const keep = partialPrefixLength(buffer, OPEN);
          out += buffer.slice(0, buffer.length - keep);
          buffer = buffer.slice(buffer.length - keep);
          return out;
        }
        out += buffer.slice(0, start);
        buffer = buffer.slice(start + OPEN.length);
        inside = true;
      }
    }
  }

  function flush() {
    const rest = inside ? '' : buffer;
    buffer = '';
    return rest;
  }

  return { push, flush };
}

function partialPrefixLength(text, tag) {
  for (let n = Math.min(tag.length - 1, text.length); n > 0; n--) {
    if (tag.startsWith(text.slice(-n))) return n;
  }
  return 0;
}

module.exports = { stripThinking, createThinkingFilter };
