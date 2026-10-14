import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ReactMarkdown from 'react-markdown';
import { markdownComponents } from './markdownComponents';

vi.mock('./MermaidDiagram', () => ({
  default: ({ chart }) => <div data-testid="diagram">{chart}</div>,
}));

const renderMarkdown = (source) =>
  render(<ReactMarkdown components={markdownComponents}>{source}</ReactMarkdown>);

describe('markdownComponents', () => {
  it('highlights fenced code once its language loads', async () => {
    const { container } = renderMarkdown('```java\nint total = 1;\n```');

    expect(screen.getByText('java')).toBeInTheDocument();
    await waitFor(() => expect(container.querySelectorAll('.token').length).toBeGreaterThan(0));
  });

  it('loads Mermaid lazily and passes the chart through', async () => {
    renderMarkdown('```mermaid\ngraph TD; A-->B\n```');

    expect(await screen.findByTestId('diagram')).toHaveTextContent('graph TD; A-->B');
  });

  it('renders inline code without a block wrapper', () => {
    const { container } = renderMarkdown('Use `arr[i]` here');

    expect(container.querySelector('.inline-code')).toHaveTextContent('arr[i]');
    expect(container.querySelector('.code-block-wrapper')).toBeNull();
  });
});
