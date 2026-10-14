import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TrackerNotice from './TrackerNotice';

describe('TrackerNotice', () => {
  it('renders nothing without an error', () => {
    const { container } = render(<TrackerNotice tracker={{ error: null }} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('offers Try again only when the load failed', () => {
    const reload = vi.fn();
    const { rerender } = render(<TrackerNotice tracker={{ error: 'Could not save.', loadFailed: false, reload }} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Could not save.');
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();

    rerender(<TrackerNotice tracker={{ error: 'Failed to load.', loadFailed: true, reload }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(reload).toHaveBeenCalledTimes(1);
  });
});
