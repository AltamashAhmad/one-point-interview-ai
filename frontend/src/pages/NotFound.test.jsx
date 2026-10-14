import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import NotFound from './NotFound';

describe('NotFound', () => {
  it('explains the problem and returns home', async () => {
    render(
      <MemoryRouter initialEntries={['/nope']}>
        <Routes>
          <Route path="/" element={<p>Home page</p>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("We couldn't find that page")).toBeInTheDocument();
    userEvent.click(screen.getByRole('button', { name: /go to home/i }));

    expect(await screen.findByText('Home page')).toBeInTheDocument();
  });
});
