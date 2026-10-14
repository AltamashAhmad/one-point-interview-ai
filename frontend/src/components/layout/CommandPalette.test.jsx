import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import AppShell from './AppShell';

let mockIsAdmin = false;
vi.mock('../../contexts/useAuth', () => ({
  useAuth: () => ({ user: { displayName: 'Ada Lovelace', email: 'ada@example.com' }, isAdmin: mockIsAdmin }),
}));
vi.mock('./AccountMenuItems', () => ({ default: () => null }));

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

const renderShell = () => render(
  <MemoryRouter initialEntries={['/']}>
    <Routes>
      <Route element={<AppShell />}>
        <Route path="*" element={<><h1>Page</h1><Where /></>} />
      </Route>
    </Routes>
  </MemoryRouter>,
);

const press = (key, init = {}) => fireEvent.keyDown(document, { key, ...init });
const openWithShortcut = () => press('k', { ctrlKey: true });

beforeEach(() => {
  mockIsAdmin = false;
  window.scrollTo = vi.fn();
});

describe('command palette', () => {
  it('opens with Ctrl+K and with the Command key, and toggles closed on a second press', () => {
    renderShell();
    expect(screen.queryByRole('dialog', { name: 'Quick navigation' })).not.toBeInTheDocument();

    openWithShortcut();
    expect(screen.getByRole('dialog', { name: 'Quick navigation' })).toBeInTheDocument();

    press('k', { metaKey: true });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    press('k', { metaKey: true });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('ignores K with other modifiers and plain typing', () => {
    renderShell();

    // Check after every press: two ignored presses must not be able to cancel each other out.
    [{}, { ctrlKey: true, shiftKey: true }, { ctrlKey: true, altKey: true }, { metaKey: true, shiftKey: true }].forEach((init) => {
      press('k', init);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('opens from the visible Search button', () => {
    renderShell();

    fireEvent.click(screen.getByRole('button', { name: 'Search pages' }));

    expect(screen.getByRole('dialog', { name: 'Quick navigation' })).toBeInTheDocument();
  });

  it('filters as you type and keeps the first match selected', () => {
    renderShell();
    openWithShortcut();

    const input = screen.getByRole('combobox', { name: 'Search pages' });
    fireEvent.change(input, { target: { value: 'learn' } });

    const options = screen.getAllByRole('option');
    expect(options.map((o) => within(o).getByText(/Notes|DSA Sheet|Prep Plan/).textContent)).toEqual(['Notes', 'DSA Sheet', 'Prep Plan']);
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', options[0].id);
  });

  it('moves with the arrow keys, wrapping around, and goes to the highlighted page on Enter', () => {
    renderShell();
    openWithShortcut();
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'learn' } });

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(screen.getAllByRole('option')[2]).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByTestId('where')).toHaveTextContent('/prep-plan');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('goes to a page when it is clicked', () => {
    renderShell();
    openWithShortcut();

    fireEvent.click(screen.getByRole('option', { name: /History/ }));

    expect(screen.getByTestId('where')).toHaveTextContent('/history');
  });

  it('closes with Escape without navigating', () => {
    renderShell();
    openWithShortcut();

    press('Escape');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent('/');
  });

  it('says so when nothing matches and does nothing on Enter', () => {
    renderShell();
    openWithShortcut();
    const input = screen.getByRole('combobox');

    fireEvent.change(input, { target: { value: 'zzzz' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByRole('status')).toHaveTextContent('No pages match "zzzz".');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(input).not.toHaveAttribute('aria-activedescendant');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows admin pages only to admins', () => {
    const { unmount } = renderShell();
    openWithShortcut();
    expect(screen.queryByRole('option', { name: /Admin panel/ })).not.toBeInTheDocument();
    unmount();

    mockIsAdmin = true;
    renderShell();
    openWithShortcut();
    expect(screen.getByRole('option', { name: /Admin panel/ })).toBeInTheDocument();
  });

  it('starts empty each time it is opened', () => {
    renderShell();
    openWithShortcut();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'notes' } });
    press('Escape');

    openWithShortcut();

    expect(screen.getByRole('combobox')).toHaveValue('');
  });
});
