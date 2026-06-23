import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
  fontFamily: 'Inter, sans-serif',
  logLevel: 5,
});

const VALID_DIRECTIONS = new Set(['TD', 'LR', 'RL', 'BT', 'TB']);

// ─── Helpers ───────────────────────────────────────────────────────────────────
const escQ  = s => s.replace(/"/g, '\\"');
const escBr = s => s.replace(/\[/g, '&#91;').replace(/\]/g, '&#93;');

/**
 * BULLETPROOF sanitizer — 10 rules covering every known AI Mermaid mistake.
 *
 * R1  – Invalid graph type:    graph 3D           → graph TD
 * R2  – Subgraph title parens: subgraph "X (Y)"   → subgraph sgX["X Y"]
 * R3  – Nested quoted labels:  ["x ["y"] z"]      → ["x [y] z"]
 * R4  – Diamond + specials:    {text (parens)}     → {"text (parens)"}
 * R5  – Rect + inner []:       [val = []]          → ["val = []"]
 * R6  – Rect + arrow:          [a -> b]            → ["a -> b"]
 * R7  – Rect + coord pair:     [(0,0) cell]        → ["(0,0) cell"]
 * R8  – Round + inner []:      (Final: [])         → ("Final: []")
 * R9  – Round + arrow:         (a -> b)            → ("a -> b")
 * R10 – Escape [] in quoted:   ["x [y] z"]  → ["x &#91;y&#93; z"]
 *        (Mermaid 11 mis-tokenises ] inside quoted labels)
 */
function sanitizeMermaid(raw) {
  if (!raw) return raw;
  let code = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

  // R1: fix invalid graph type
  code = code.replace(
    /^([ \t]*(?:graph|flowchart))\s+(\S+)/im,
    (_, kw, dir) =>
      VALID_DIRECTIONS.has(dir.toUpperCase()) ? `${kw} ${dir.toUpperCase()}` : `${kw} TD`
  );

  // R2: fix subgraph titles that contain () or other special chars
  let sgIdx = 0;
  code = code.replace(
    /^([ \t]*subgraph)\s+"([^"]+)"/gm,
    (_, indent, title) => {
      const safeTitle = title.replace(/[()[\]{}]/g, '').trim();
      return `${indent} sg${sgIdx++}["${safeTitle}"]`;
    }
  );
  code = code.replace(
    /^([ \t]*subgraph)\s+([^\s\n[{(]+)\s*\(([^)]*)\)/gm,
    (_, indent, id, extra) => `${indent} ${id}["${id} ${extra}"]`
  );

  // R3: fix nested ["..."] inside ["..."]
  // e.g. PQ1["Start: ["(0,0,0)"]"]  →  PQ1["Start: [(0,0,0)]"]
  let prev;
  do {
    prev = code;
    code = code.replace(
      /\["([^"\[\]]*)\["([^"]*?)"\]([^"\[\]]*)"\]/g,
      (_, pre, inner, post) => `["${pre}[${inner}]${post}"]`
    );
  } while (code !== prev);

  // --- PLACEHOLDER PROTECTION ---
  // Protect all perfectly formatted quoted strings before running R4-R9
  // This prevents R7 from accidentally matching `[(0,0)]` inside `["Start: [(0,0)]"]`
  // and reverting it to `["Start: ["(0,0)"]"]`
  const saved = [];
  const ph = m => { saved.push(m); return `\x00${saved.length - 1}\x00`; };
  
  // Protect all valid quoted strings
  let safe = code.replace(/"([^"]*)"/g, ph);

  // R4: diamond {label} with special chars
  safe = safe.replace(
    /\{([^"{\x00}]*[()[\]<>|:][^"{\x00}]*)\}/g,
    (_, l) => `{"${escQ(l)}"}`
  );

  // R5: rectangular [label] with inner []
  safe = safe.replace(
    /\[([^\[\]"\x00]*\[[^\[\]\x00]*\][^\[\]"\x00]*)\]/g,
    (_, l) => `["${escQ(l)}"]`
  );

  // R6: rectangular [label] with -> arrow
  safe = safe.replace(
    /\[([^\[\]"\x00]*->+[^\[\]"\x00]*)\]/g,
    (_, l) => `["${escQ(l)}"]`
  );

  // R7: rectangular [label] with coordinate pair (x,y)
  safe = safe.replace(
    /\[([^\[\]"\x00]*\([^)]*,[^)]*\)[^\[\]"\x00]*)\]/g,
    (_, l) => `["${escQ(l)}"]`
  );

  // R8: round (label) with inner []
  safe = safe.replace(
    /\(([^"()\x00]*\[[^\[\]\x00]*\][^"()\x00]*)\)/g,
    (_, l) => `("${escQ(l)}")`
  );

  // R9: round (label) with -> arrow
  safe = safe.replace(
    /\(([^"()\x00]*->+[^"()\x00]*)\)/g,
    (_, l) => `("${escQ(l)}")`
  );

  // Restore placeholders
  code = safe.replace(/\x00(\d+)\x00/g, (_, i) => saved[parseInt(i, 10)]);

  // R10: in ALL quoted labels ["..."], escape remaining [ and ] to HTML entities
  code = code.replace(/\["([^"]*)"\]/g, (_, c) => `["${escBr(c)}"]`);

  return code;
}

// ─── Attempt 2: aggressive quote-all (without corrupting already-quoted labels) ─
function aggressiveQuote(sanitized) {
  // Protect already-quoted node labels and subgraph declarations with placeholders
  const saved = [];
  const ph = m => { saved.push(m); return `\x00${saved.length - 1}\x00`; };

  let safe = sanitized
    .replace(/\["[^"]*"\]/g, ph)           // protect ["..."]
    .replace(/\{"[^"]*"\}/g, ph)           // protect {"..."}
    .replace(/\("[^"]*"\)/g, ph)           // protect ("...")
    .replace(/subgraph\s+\S+\[.*?\]/g, ph) // protect subgraph id["title"]
    .replace(/subgraph\s+"[^"]*"/g, ph);   // protect subgraph "title"

  // Aggressively quote remaining UNQUOTED rectangular and diamond labels only
  safe = safe
    .replace(/\[([^\[\]"]+)\]/g, (_, l) =>
      `["${l.replace(/"/g, '').replace(/\[/g, '&#91;').replace(/\]/g, '&#93;')}"]`)
    .replace(/\{([^{}"]+)\}/g, (_, l) =>
      `{"${l.replace(/"/g, '').replace(/\[/g, '&#91;').replace(/\]/g, '&#93;')}"}`);

  // Restore placeholders
  return safe.replace(/\x00(\d+)\x00/g, (_, i) => saved[parseInt(i, 10)]);
}

// ─── Attempt 3: strip subgraphs from the sanitized code ────────────────────────
function stripSubgraphs(sanitized) {
  return sanitized
    .replace(/^[ \t]*subgraph[^\n]*/gm, '')  // remove subgraph declarations
    .replace(/^[ \t]*end[ \t]*$/gm, '')       // remove end keywords
    .replace(/\n{3,}/g, '\n\n');              // clean up blank lines
}

// ─── 3-attempt render pipeline ─────────────────────────────────────────────────
async function tryRender(chart) {
  const origErr = console.error;
  console.error = () => {};  // suppress Mermaid's own "Syntax error" console spam

  try {
    const sanitized = sanitizeMermaid(chart);

    // Attempt 1: sanitized code (all 10 rules applied)
    try {
      const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
      const { svg } = await mermaid.render(id, sanitized);
      return { svg, partial: false };
    } catch (_) {}

    // Attempt 2: aggressive — quote every remaining unquoted node label
    try {
      const aggressive = aggressiveQuote(sanitized);
      const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
      const { svg } = await mermaid.render(id, aggressive);
      return { svg, partial: false };
    } catch (_) {}

    // Attempt 3: strip subgraph blocks entirely (they're optional decoration)
    try {
      const noSubgraph = stripSubgraphs(sanitized);
      const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
      const { svg } = await mermaid.render(id, noSubgraph);
      return { svg, partial: true };
    } catch (_) {}

  } finally {
    console.error = origErr;
  }

  return null;
}

// ─── React Component ───────────────────────────────────────────────────────────
export default function MermaidDiagram({ chart }) {
  const containerRef = useRef(null);
  const [svgContent, setSvgContent] = useState('');
  const [status,     setStatus]     = useState('loading');
  const [rawCode,    setRawCode]    = useState('');

  useEffect(() => {
    let mounted = true;

    (async () => {
      setStatus('loading');
      const result = await tryRender(chart);
      if (!mounted) return;

      if (result) {
        setSvgContent(result.svg);
        setStatus(result.partial ? 'partial' : 'ok');
      } else {
        setStatus('error');
        setRawCode(sanitizeMermaid(chart));
      }
    })();

    return () => { mounted = false; };
  }, [chart]);

  // ── Render states ─────────────────────────────────────────────────────────────
  if (status === 'loading') return (
    <div style={{ padding: '16px', background: 'var(--bg-input)', borderRadius: '8px', marginTop: '12px', color: 'var(--text-muted)', fontSize: '13px' }}>
      Rendering diagram…
    </div>
  );

  if (status === 'error') return (
    <div style={{ marginTop: '10px', marginBottom: '10px' }}>
      <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: '8px 8px 0 0', fontSize: '12px', fontWeight: 600 }}>
        ⚠️ Could not render diagram — showing raw description:
      </div>
      <pre style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', padding: '12px 16px', borderRadius: '0 0 8px 8px', fontSize: '12px', overflowX: 'auto', margin: 0, lineHeight: 1.6, border: '1px solid var(--border)', borderTop: 'none' }}>
        {rawCode}
      </pre>
    </div>
  );

  return (
    <div style={{ marginTop: '12px', marginBottom: '12px' }}>
      {status === 'partial' && (
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', textAlign: 'center' }}>
          ⚠️ Diagram simplified (subgraphs removed) due to complex syntax
        </div>
      )}
      <div
        className="mermaid-wrapper"
        ref={containerRef}
        style={{ background: 'var(--bg-input)', padding: '16px', borderRadius: '8px', overflowX: 'auto', display: 'flex', justifyContent: 'center' }}
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    </div>
  );
}
