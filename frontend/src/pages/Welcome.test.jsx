import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../contexts/ThemeContext';
import Welcome from './Welcome';

vi.mock('../contexts/useAuth', () => ({ useAuth: () => ({ userProfile: null }) }));

const renderPage = () => render(
  <ThemeProvider>
    <MemoryRouter><Welcome /></MemoryRouter>
  </ThemeProvider>,
);

describe('Welcome', () => {
  it('has one heading level 1 and a main landmark', () => {
    renderPage();

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Crack your next FAANG interview.');
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });

  it('sends every call to action to sign in', () => {
    renderPage();

    const links = screen.getAllByRole('link', { name: /sign in|get started|start practicing/i });

    expect(links.length).toBeGreaterThanOrEqual(5);
    links.forEach((link) => expect(link).toHaveAttribute('href', '/login'));
  });

  it('lists the four interview rounds and the preparation tools', () => {
    renderPage();

    const rounds = screen.getByRole('region', { name: 'Four rounds, like the real loop' });
    ['DSA', 'System Design', 'Low-Level Design', 'Behavioral'].forEach((name) => {
      expect(within(rounds).getByRole('heading', { name })).toBeInTheDocument();
    });

    const learn = screen.getByRole('region', { name: 'Prepare between rounds' });
    expect(within(learn).getAllByRole('listitem')).toHaveLength(4);
  });

  it('numbers the steps in an ordered list', () => {
    renderPage();

    const steps = screen.getByRole('region', { name: 'How it works' });

    expect(within(steps).getByRole('list').tagName).toBe('OL');
    expect(within(steps).getAllByRole('listitem')).toHaveLength(3);
  });
});
