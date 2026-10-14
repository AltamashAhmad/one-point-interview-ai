import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PageHeader from './PageHeader';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

beforeEach(() => {
  mockNavigate.mockClear();
});

describe('PageHeader', () => {
  it('shows no back link on top-level pages (the shell already provides Home)', () => {
    render(<PageHeader title="Interview History" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Interview History' })).toBeInTheDocument();
  });

  it('shows a labelled back link for nested pages and navigates to it', () => {
    render(<PageHeader title="Session Details" backTo="/history" backLabel="History" />);
    const back = screen.getByRole('button', { name: /history/i });
    fireEvent.click(back);
    expect(mockNavigate).toHaveBeenCalledWith('/history');
  });

  it('never renders a Home button or theme toggle of its own', () => {
    render(<PageHeader title="Scorecard" backTo="/history" backLabel="History" />);
    expect(screen.queryByRole('button', { name: /home/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /mode/i })).not.toBeInTheDocument();
  });

  it('renders title, subtitle, icon, and actions', () => {
    render(
      <PageHeader title="Scorecard" subtitle="DSA • Hard" icon="📊" actions={<button>Custom Action</button>} />,
    );
    expect(screen.getByText('Scorecard')).toBeInTheDocument();
    expect(screen.getByText('DSA • Hard')).toBeInTheDocument();
    expect(screen.getByText('📊')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Custom Action' })).toBeInTheDocument();
  });
});
