import React, { Suspense } from 'react';

// Mermaid is large; load it only when a message actually contains a diagram.
const MermaidDiagram = React.lazy(() => import('./MermaidDiagram'));

export default function LazyMermaid({ chart }) {
  return (
    <Suspense fallback={<div className="mermaid-loading" role="status">Loading diagram…</div>}>
      <MermaidDiagram chart={chart} />
    </Suspense>
  );
}
