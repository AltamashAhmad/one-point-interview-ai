import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Sidebar from './Sidebar';
import AppShell from './AppShell';

vi.mock('../../contexts/useAuth', () => ({
  useAuth: () => ({ user: { displayName: 'Ada Lovelace', email: 'ada@example.com' } }),
}));

vi.mock('./AccountMenuItems', async () => {
  const { createElement } = await import('react');
  return { default: () => createElement('p', null, 'Account menu') };
});

beforeEach(() => {
  window.scrollTo = vi.fn();
});

describe('Sidebar', () => {
  it('links every destination in the primary navigation', () => {
    render(<MemoryRouter initialEntries={['/']}><Sidebar /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Notes' })).toHaveAttribute('href', '/notes');
    expect(screen.getByRole('link', { name: 'DSA Sheet' })).toHaveAttribute('href', '/dsa-sheet');
    expect(screen.getByRole('link', { name: 'History' })).toHaveAttribute('href', '/history');
  });

  it('marks the current page as active', () => {
    render(<MemoryRouter initialEntries={['/history']}><Sidebar /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'History' })).toHaveClass('is-active');
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveClass('is-active');
  });

  it('opens the account menu and closes it with Escape', () => {
    render(<MemoryRouter initialEntries={['/']}><Sidebar /></MemoryRouter>);
    const account = screen.getByRole('button', { name: /Ada Lovelace/ });
    expect(account).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(account);
    expect(account).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Account menu')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(account).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('AppShell', () => {
  it('frames the page in the main landmark with a skip link', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<h1>Home page</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main-content');
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'main-content');
    expect(main).toContainElement(screen.getByRole('heading', { name: 'Home page' }));
  });
});
