import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NoteEditor from './NoteEditor';
import * as api from '../services/api';

vi.mock('../services/api');
vi.mock('react-markdown', () => ({ default: ({ children }) => <div data-testid="markdown-preview">{children}</div> }));
vi.mock('./markdownComponents', () => ({ markdownComponents: {} }));

const baseProps = {
  title: 'Notes — Two Sum',
  placeholder: 'placeholder',
  sheetId: 'dsa-master',
  itemKey: 'q:m1-l1-two-sum',
  itemType: 'question',
  contextTitle: 'Two Sum',
  difficulty: 'Easy',
  sectionTitle: '1.1 Hashing',
  language: 'Java',
};

beforeEach(() => vi.clearAllMocks());

it('opens in read mode when there is already a note, and Edit reveals the textarea', () => {
  render(<NoteEditor {...baseProps} initialValue="some notes" onSave={vi.fn()} onClose={vi.fn()} />);
  expect(screen.getByTestId('markdown-preview')).toHaveTextContent('some notes');
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

  fireEvent.click(screen.getByTitle('Switch to edit mode'));
  expect(screen.getByRole('textbox')).toHaveValue('some notes');
  expect(screen.queryByTestId('markdown-preview')).not.toBeInTheDocument();
});

it('minimizing hides the body but keeps the header, and restore brings it back', () => {
  render(<NoteEditor {...baseProps} initialValue="some notes" onSave={vi.fn()} onClose={vi.fn()} />);
  expect(screen.getByText('Close')).toBeInTheDocument();

  fireEvent.click(screen.getByTitle('Minimize'));
  expect(screen.queryByText('Close')).not.toBeInTheDocument();
  expect(screen.getByText('Notes — Two Sum')).toBeInTheDocument();

  fireEvent.click(screen.getByTitle('Restore'));
  expect(screen.getByText('Close')).toBeInTheDocument();
});

it('generates notes immediately when empty, saves them as AI-sourced, and switches to read mode', async () => {
  api.generateTrackerNote.mockResolvedValue('GENERATED NOTES CONTENT');
  const onSave = vi.fn().mockResolvedValue();

  render(<NoteEditor {...baseProps} initialValue="" onSave={onSave} onClose={vi.fn()} />);
  expect(screen.getByRole('textbox')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Generate with AI' }));

  await waitFor(() => expect(onSave).toHaveBeenCalledWith('GENERATED NOTES CONTENT', 'ai'));
  expect(api.generateTrackerNote).toHaveBeenCalledWith('dsa-master', 'q:m1-l1-two-sum', {
    itemType: 'question', title: 'Two Sum', difficulty: 'Easy', sectionTitle: '1.1 Hashing', language: 'Java',
  });
  expect(await screen.findByTestId('markdown-preview')).toHaveTextContent('GENERATED NOTES CONTENT');
});

it('warns before overwriting existing notes, and cancel keeps the original text', async () => {
  api.generateTrackerNote.mockResolvedValue('new ai notes');
  const onSave = vi.fn().mockResolvedValue();

  render(<NoteEditor {...baseProps} initialValue="my manual notes" onSave={onSave} onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Generate with AI' }));

  expect(screen.getByText(/This will replace your current notes/)).toBeInTheDocument();
  expect(api.generateTrackerNote).not.toHaveBeenCalled();

  fireEvent.click(screen.getByText('Cancel'));
  expect(screen.queryByText(/This will replace your current notes/)).not.toBeInTheDocument();
  expect(screen.getByTestId('markdown-preview')).toHaveTextContent('my manual notes');

  fireEvent.click(screen.getByRole('button', { name: 'Generate with AI' }));
  fireEvent.click(screen.getByText('Replace with AI notes'));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith('new ai notes', 'ai'));
});

it('manual edits save with source "manual"', async () => {
  const onSave = vi.fn().mockResolvedValue();
  render(<NoteEditor {...baseProps} initialValue="" onSave={onSave} onClose={vi.fn()} />);

  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'typed by hand' } });
  fireEvent.click(screen.getByText('Save'));

  await waitFor(() => expect(onSave).toHaveBeenCalledWith('typed by hand', 'manual'));
});
