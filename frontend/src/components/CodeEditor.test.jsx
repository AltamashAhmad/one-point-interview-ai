import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import CodeEditor from './CodeEditor';
import { monacoLanguage } from '../utils/constants';

vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange }) => <textarea aria-label="editor" value={value} onChange={(e) => onChange(e.target.value)} />,
}));

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

const type = (text) => fireEvent.change(screen.getByLabelText('editor'), { target: { value: text } });

it('starts from the server copy and saves edits after a pause', async () => {
  const onSave = vi.fn().mockResolvedValue();
  render(<CodeEditor sessionId="s1" initialCode="class A {}" onSave={onSave} />);
  expect(screen.getByLabelText('editor')).toHaveValue('class A {}');

  type('class B {}');
  expect(screen.getByText('Not saved yet')).toBeInTheDocument();
  expect(localStorage.getItem('code_s1')).toBe('class B {}');

  await act(async () => { vi.advanceTimersByTime(1500); });
  expect(onSave).toHaveBeenCalledWith('class B {}');
  expect(screen.getByText('Saved')).toBeInTheDocument();
  expect(localStorage.getItem('code_s1')).toBeNull();
});

it('pushes edits a closed tab never saved, and keeps them locally if saving fails', async () => {
  localStorage.setItem('code_s1', 'unsaved work');
  const onSave = vi.fn().mockRejectedValue(new Error('offline'));
  render(<CodeEditor sessionId="s1" initialCode="old" onSave={onSave} />);

  expect(screen.getByLabelText('editor')).toHaveValue('unsaved work');
  await act(async () => {});
  expect(onSave).toHaveBeenCalledWith('unsaved work');
  expect(screen.getByText('Not saved yet')).toBeInTheDocument();
  expect(localStorage.getItem('code_s1')).toBe('unsaved work');
});

it('flushes a pending save when the editor closes', async () => {
  const onSave = vi.fn().mockResolvedValue();
  const { unmount } = render(<CodeEditor sessionId="s1" onSave={onSave} />);
  type('x = 1');
  unmount();
  expect(onSave).toHaveBeenCalledWith('x = 1');
});

describe('monacoLanguage', () => {
  it('correctly maps all interview languages to Monaco identifiers', () => {
    expect(monacoLanguage('C#')).toBe('csharp');
    expect(monacoLanguage('csharp')).toBe('csharp');
    expect(monacoLanguage('C++')).toBe('cpp');
    expect(monacoLanguage('cpp')).toBe('cpp');
    expect(monacoLanguage('Python')).toBe('python');
    expect(monacoLanguage('Java')).toBe('java');
    expect(monacoLanguage('JavaScript')).toBe('javascript');
    expect(monacoLanguage('TypeScript')).toBe('typescript');
    expect(monacoLanguage('Go')).toBe('go');
    expect(monacoLanguage('Rust')).toBe('rust');
    expect(monacoLanguage('Kotlin')).toBe('kotlin');
    expect(monacoLanguage('Swift')).toBe('swift');
  });
});
