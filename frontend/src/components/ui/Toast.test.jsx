import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Toast } from './index';

describe('Toast', () => {
  it('announces a success politely', () => {
    render(<Toast msg="Saved" />);
    const toast = screen.getByRole('status');
    expect(toast).toHaveTextContent('Saved');
    expect(toast).toHaveAttribute('aria-live', 'polite');
    expect(toast).toHaveClass('ui-toast--ok');
  });

  it('interrupts for a failure with the error tone', () => {
    render(<Toast msg="Could not save" ok={false} />);
    const toast = screen.getByRole('alert');
    expect(toast).toHaveTextContent('Could not save');
    expect(toast).toHaveClass('ui-toast--err');
  });
});
