import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  Badge, Button, Dialog, EmptyState, Field, Icon, IconButton, Input, ProgressBar, SegmentedControl, Tabs,
} from './index';
import { ICON_NAMES } from './icons';

describe('Button', () => {
  it('renders the shared .btn classes and defaults to type="button"', () => {
    render(<Button variant="secondary" size="sm">Save</Button>);
    const btn = screen.getByRole('button', { name: 'Save' });
    expect(btn).toHaveClass('btn', 'btn-secondary', 'btn-sm');
    expect(btn).toHaveAttribute('type', 'button');
  });

  it('is disabled and busy while loading, and does not fire clicks', () => {
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>Send</Button>);
    const btn = screen.getByRole('button', { name: 'Send' });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('can render as a link without a button type', () => {
    render(<Button as="a" href="/x" variant="ghost">Go</Button>);
    const link = screen.getByRole('link', { name: 'Go' });
    expect(link).toHaveAttribute('href', '/x');
    expect(link).not.toHaveAttribute('type');
  });
});

describe('IconButton', () => {
  it('is named by its label', () => {
    render(<IconButton icon="plus" label="Add item" />);
    expect(screen.getByRole('button', { name: 'Add item' })).toBeInTheDocument();
  });
});

describe('Icon', () => {
  it('is hidden from assistive tech unless labelled', () => {
    const { container, rerender } = render(<Icon name="home" />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    rerender(<Icon name="home" label="Home" />);
    expect(screen.getByRole('img', { name: 'Home' })).toBeInTheDocument();
  });

  it('renders nothing for an unknown name, and every named icon draws something', () => {
    const { container } = render(<Icon name="nope" />);
    expect(container).toBeEmptyDOMElement();
    for (const name of ICON_NAMES) {
      const { container: c } = render(<Icon name={name} />);
      expect(c.querySelector('svg').children.length).toBeGreaterThan(0);
    }
  });
});

describe('Badge', () => {
  it('applies the tone class', () => {
    render(<Badge tone="success">Done</Badge>);
    expect(screen.getByText('Done')).toHaveClass('ui-badge--success');
  });
});

describe('SegmentedControl', () => {
  const options = [{ value: 'a', label: 'Mock' }, { value: 'b', label: 'Tutor' }, { value: 'c', label: 'Loop' }];

  function Harness() {
    const [value, setValue] = useState('a');
    return <SegmentedControl options={options} value={value} onChange={setValue} ariaLabel="Mode" />;
  }

  it('exposes a radio group with only the selected option in the tab order', () => {
    render(<Harness />);
    expect(screen.getByRole('radiogroup', { name: 'Mode' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Mock' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Mock' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: 'Tutor' })).toHaveAttribute('tabindex', '-1');
  });

  it('moves and wraps with the arrow keys', () => {
    render(<Harness />);
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Mock' }), { key: 'ArrowRight' });
    expect(screen.getByRole('radio', { name: 'Tutor' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Tutor' }), { key: 'ArrowLeft' });
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Mock' }), { key: 'ArrowLeft' });
    expect(screen.getByRole('radio', { name: 'Loop' })).toHaveAttribute('aria-checked', 'true');
  });
});

describe('Tabs', () => {
  const items = [{ value: 'one', label: 'Transcript' }, { value: 'two', label: 'Notes', count: 3 }];

  function Harness() {
    const [value, setValue] = useState('one');
    return <Tabs items={items} value={value} onChange={setValue} ariaLabel="Views" />;
  }

  it('marks the selected tab and supports Home/End/arrow keys', () => {
    render(<Harness />);
    expect(screen.getByRole('tab', { name: 'Transcript' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Transcript' }), { key: 'End' });
    expect(screen.getByRole('tab', { name: /Notes/ })).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(screen.getByRole('tab', { name: /Notes/ }), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Transcript' })).toHaveAttribute('aria-selected', 'true');
  });

  it('shows a count', () => {
    render(<Harness />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});

describe('ProgressBar', () => {
  it('exposes value, clamps it, and shows the percentage', () => {
    render(<ProgressBar value={150} max={200} label="Solved" showValue />);
    const bar = screen.getByRole('progressbar', { name: 'Solved' });
    expect(bar).toHaveAttribute('aria-valuenow', '150');
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('never goes below zero or above the max', () => {
    render(<ProgressBar value={-5} label="Low" />);
    expect(screen.getByRole('progressbar', { name: 'Low' })).toHaveAttribute('aria-valuenow', '0');
  });
});

describe('Field', () => {
  it('links label, hint and error to the control', () => {
    const { rerender } = render(
      <Field label="Email" hint="We never share it">{(p) => <Input {...p} />}</Field>,
    );
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAccessibleDescription('We never share it');

    rerender(<Field label="Email" error="Required">{(p) => <Input {...p} />}</Field>);
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
  });
});

describe('EmptyState', () => {
  it('renders title, description and action', () => {
    render(<EmptyState title="Nothing yet" description="Start one." action={<button>Start</button>} />);
    expect(screen.getByText('Nothing yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
  });
});

describe('Dialog', () => {
  function Harness({ onClose = () => {} }) {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Open</button>
        <Dialog open={open} onClose={() => { onClose(); setOpen(false); }} title="Delete loop?" description="This cannot be undone." footer={<button>Confirm</button>}>
          <input aria-label="Reason" />
        </Dialog>
      </>
    );
  }

  it('renders nothing while closed', () => {
    render(<Harness />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('is a labelled modal dialog that focuses its first control and locks scroll', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete loop?' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('This cannot be undone.');
    expect(screen.getByLabelText('Reason')).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('closes on Escape, unlocks scroll and returns focus to the opener', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const opener = screen.getByRole('button', { name: 'Open' });
    opener.focus();
    fireEvent.click(opener);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.style.overflow).not.toBe('hidden');
    expect(opener).toHaveFocus();
  });

  it('traps Tab inside the dialog', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    const confirm = screen.getByRole('button', { name: 'Confirm' });
    confirm.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.getByLabelText('Reason')).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(confirm).toHaveFocus();
  });

  it('closes when the backdrop is clicked but not when the card is', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.mouseDown(screen.getByRole('dialog').parentElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps focus on the control the user moved to when the parent re-renders', () => {
    const view = (label) => (
      <Dialog open title="Leave?" onClose={() => label} footer={<><button>Cancel</button><button>Confirm</button></>} />
    );
    const { rerender } = render(view('first'));
    const confirm = screen.getByRole('button', { name: 'Confirm' });
    confirm.focus();
    rerender(view('second'));
    expect(confirm).toHaveFocus();
  });
});
