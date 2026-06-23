import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';

export default function CodeEditor({ sessionId, language = 'javascript', onSubmitCode }) {
  const [code, setCode] = useState('// Write your code here...');
  const [langKey, setLangKey] = useState(language.toLowerCase());

  // Normalize language for monaco
  useEffect(() => {
    let normalized = language.toLowerCase();
    if (normalized.includes('c++')) normalized = 'cpp';
    else if (normalized.includes('python')) normalized = 'python';
    else if (normalized.includes('java') && !normalized.includes('javascript')) normalized = 'java';
    else if (normalized.includes('javascript') || normalized.includes('js')) normalized = 'javascript';
    setLangKey(normalized);
  }, [language]);

  // Load from local storage
  useEffect(() => {
    if (!sessionId) return;
    const storedCode = localStorage.getItem(`code_${sessionId}`);
    if (storedCode) setCode(storedCode);
  }, [sessionId]);

  const handleEditorChange = (value) => {
    setCode(value || '');
    if (sessionId) {
      localStorage.setItem(`code_${sessionId}`, value || '');
    }
  };

  const handleSubmit = () => {
    if (onSubmitCode && code.trim()) {
      onSubmitCode(code, langKey);
    }
  };

  return (
    <div className="code-editor-container" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="code-editor-header" style={{ padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
        <div className="editor-lang-badge" style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--purple-light)' }}>
          {langKey}
        </div>
        
        <button 
          className="editor-btn editor-btn-primary" 
          onClick={handleSubmit}
        >
          Submit for Review
        </button>
      </div>
      
      <div className="code-editor-body" style={{ flex: 1 }}>
        <Editor
          height="100%"
          language={langKey}
          theme="vs-dark"
          value={code}
          onChange={handleEditorChange}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            wordWrap: 'on',
            scrollBeyondLastLine: false,
            padding: { top: 16 }
          }}
        />
      </div>
    </div>
  );
}
