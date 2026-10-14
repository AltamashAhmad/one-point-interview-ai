import React from 'react';
import axe from 'axe-core';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../contexts/ThemeContext';
import Welcome from './Welcome';
import NotFound from './NotFound';
import GettingStarted from '../components/GettingStarted';
import { Card, EmptyState } from '../components/ui';

vi.mock('../contexts/useAuth', () => ({ useAuth: () => ({ userProfile: null }) }));

// jsdom has no layout, so contrast is covered by the browser scan; these rules cover names, labels and headings.
const audit = async (ui) => {
  const { container } = render(<ThemeProvider><MemoryRouter>{ui}</MemoryRouter></ThemeProvider>);
  const result = await axe.run(container, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] },
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  });
  return result.violations.map((v) => `${v.id}: ${v.nodes[0].target.join(' ')}`);
};

describe('accessibility', () => {
  it('has no violations on the welcome page', async () => {
    expect(await audit(<Welcome />)).toEqual([]);
  });

  it('has no violations on the 404 page', async () => {
    expect(await audit(<main><NotFound /></main>)).toEqual([]);
  });

  it('has no violations on the getting-started card', async () => {
    expect(await audit(<main><h1>Home</h1><GettingStarted userId="u1" onGo={() => {}} /></main>)).toEqual([]);
  });

  it('lets callers pick the heading level so pages do not skip levels', async () => {
    const violations = await audit(
      <main>
        <h1>Page</h1>
        <Card titleAs="h2" title="Section">Body</Card>
        <EmptyState headingAs="h2" title="Nothing here" />
      </main>,
    );

    expect(violations).toEqual([]);
  });
});
