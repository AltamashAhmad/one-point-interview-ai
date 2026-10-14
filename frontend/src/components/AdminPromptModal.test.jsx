import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminPromptModal from './AdminPromptModal';

beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn() }, configurable: true });
});

describe('AdminPromptModal', () => {
  it('shows the generated prompt with its seed question and a copy action', () => {
    render(
      <AdminPromptModal
        promptData={{ prompt: 'You are a strict interviewer.', questionData: { title: 'Two Sum' } }}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole('dialog', { name: 'Generated system prompt' })).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('You are a strict interviewer.');
    expect(screen.getByText(/Two Sum/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Copy prompt' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('You are a strict interviewer.');
    expect(screen.getByRole('button', { name: 'Copied to clipboard' })).toBeInTheDocument();
  });

  it('explains a failed generation and offers no copy action', () => {
    render(<AdminPromptModal promptData={{ error: 'Model unavailable' }} onClose={() => {}} />);
    expect(screen.getByRole('dialog', { name: 'Error generating prompt' })).toBeInTheDocument();
    expect(screen.getByText('Model unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy prompt' })).not.toBeInTheDocument();
  });
});
