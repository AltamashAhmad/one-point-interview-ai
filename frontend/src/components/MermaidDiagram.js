import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
  fontFamily: 'Inter, sans-serif'
});

export default function MermaidDiagram({ chart }) {
  const containerRef = useRef(null);
  const [svgContent, setSvgContent] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    async function renderDiagram() {
      try {
        setError(false);
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        const { svg } = await mermaid.render(id, chart);
        if (isMounted) {
          setSvgContent(svg);
        }
      } catch (err) {
        console.error("Mermaid syntax error:", err);
        if (isMounted) setError(true);
      }
    }

    if (chart) {
      renderDiagram();
    }

    return () => { isMounted = false; };
  }, [chart]);

  if (error) {
    return (
      <div className="mermaid-error" style={{ padding: '10px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '8px', fontSize: '12px', marginTop: '10px' }}>
        ⚠️ Failed to render diagram. The AI generated invalid Mermaid syntax.
      </div>
    );
  }

  return (
    <div 
      className="mermaid-wrapper" 
      ref={containerRef}
      style={{
        background: 'var(--bg-input)',
        padding: '16px',
        borderRadius: '8px',
        marginTop: '12px',
        marginBottom: '12px',
        overflowX: 'auto',
        display: 'flex',
        justifyContent: 'center'
      }}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
}
