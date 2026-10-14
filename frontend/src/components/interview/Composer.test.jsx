import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Composer from './Composer';

function renderComposer(overrides = {}) {
  const props = {
    inputRef: { current: null },
    value: '',
    onChange: vi.fn(),
    onKeyDown: vi.fn(),
    onSend: vi.fn(),
    placeholder: 'Type your answer…',
    maxLength: 8000,
    disabled: false,
    sendDisabled: true,
    sending: false,
    voice: { supported: false, listening: false, error: null, onToggle: vi.fn() },
    hint: 'Tip: Think out loud',
    ...overrides,
  };
  render(<Composer {...props} />);
  return props;
}

describe('Composer', () => {
  it('passes typing and key presses up to the page', () => {
    const props = renderComposer({ sendDisabled: false, value: 'h' });
    const box = screen.getByLabelText('Your answer');
    fireEvent.change(box, { target: { value: 'hello' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(props.onChange).toHaveBeenCalledWith('hello');
    expect(props.onKeyDown).toHaveBeenCalledTimes(1);
  });

  it('sends when the send button is pressed', () => {
    const props = renderComposer({ sendDisabled: false, value: 'answer' });
    fireEvent.click(screen.getByLabelText('Send message'));
    expect(props.onSend).toHaveBeenCalledTimes(1);
  });

  it('disables send while a reply is streaming', () => {
    renderComposer({ sendDisabled: false, sending: true });
    expect(screen.getByLabelText('Send message')).toBeDisabled();
  });

  it('offers voice input only when the browser supports it', () => {
    const voice = { supported: true, listening: false, error: null, onToggle: vi.fn() };
    renderComposer({ voice });
    fireEvent.click(screen.getByLabelText('Start voice input'));
    expect(voice.onToggle).toHaveBeenCalledTimes(1);
  });

  it('shows the listening state and voice errors', () => {
    renderComposer({ voice: { supported: true, listening: true, error: 'Microphone blocked', onToggle: vi.fn() } });
    expect(screen.getByLabelText('Stop recording')).toBeInTheDocument();
    expect(screen.getByText('Microphone blocked')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Listening');
  });

  it('shows the phrase being heard while listening', () => {
    renderComposer({ voice: { supported: true, listening: true, interim: 'hash map', error: null, onToggle: vi.fn() } });
    expect(screen.getByText('hash map')).toBeInTheDocument();
  });

  it('stops dictation when the answer box is locked', () => {
    const voice = { supported: true, listening: true, error: null, onToggle: vi.fn(), onStop: vi.fn() };
    renderComposer({ disabled: true, voice });
    expect(voice.onStop).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Stop recording')).toBeEnabled();
  });
});
