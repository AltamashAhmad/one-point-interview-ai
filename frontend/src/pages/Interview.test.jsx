import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import * as api from '../services/api';
import Interview from './Interview';

window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {};

vi.mock('../services/api');
vi.mock('../contexts/useAuth', () => ({
  useAuth: () => ({ refreshUserProfile: () => {}, setWallDismissed: () => {} }),
}));
vi.mock('../components/interview/InterviewSetup', () => ({
  default: ({ onBegin }) => (
    <button onClick={() => onBegin({ model: 'qwen/qwen3.8-27b', scorecardModel: 'openai/gpt-oss-120b', difficulty: 'MEDIUM', language: 'Java', company: '' })}>
      Begin Interview
    </button>
  ),
}));
vi.mock('../components/MessageBubble', () => ({
  default: ({ message }) => <div data-testid={`msg-${message.role}`}>{message.content}</div>,
}));
vi.mock('../components/TypingIndicator', () => ({ default: () => <div>typing…</div> }));
vi.mock('../components/ModelSelector', () => ({ default: () => null }));
vi.mock('../components/ThemeToggle', () => ({ default: () => null }));
vi.mock('../components/CodeEditor', () => ({
  default: ({ onSubmitCode }) => <button onClick={() => onSubmitCode('int x = 1;', 'java')}>Submit code</button>,
}));
vi.mock('../services/modelCatalog', () => ({ findModel: () => null }));
vi.mock('../hooks/useVoiceToText', () => ({ useVoiceToText: () => ({ isSupported: false }) }));
vi.mock('react-resizable-panels', () => ({
  PanelGroup: ({ children }) => <div>{children}</div>,
  Panel: ({ children }) => <div>{children}</div>,
  PanelResizeHandle: () => null,
}));

let currentLocation;
function LocationSpy() {
  currentLocation = useLocation();
  return null;
}

function renderAt(entry) {
  return render(
    <React.StrictMode><MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/interview/:type" element={<Interview />} />
        <Route path="/scorecard/:id" element={<div>Scorecard page</div>} />
        <Route path="/history/:id" element={<div>History detail page</div>} />
      </Routes>
      <LocationSpy />
    </MemoryRouter></React.StrictMode>
  );
}

const baseSession = (overrides = {}) => ({
  id: 's1',
  interviewType: 'dsa',
  mode: 'interview',
  status: 'active',
  config: { model: 'qwen/qwen3.8-27b', scorecardModel: 'openai/gpt-oss-120b', difficulty: 'MEDIUM', language: 'Java' },
  question: { title: 'Two Sum', link: 'https://leetcode.com/problems/two-sum' },
  source: null,
  messages: [],
  timerEndsAt: new Date(Date.now() + 45 * 60_000).toISOString(),
  ...overrides,
});

function replyWith(text) {
  return (id, body, { onToken } = {}) => {
    onToken?.(text);
    return Promise.resolve({ message: { role: 'assistant', content: text }, model: 'qwen/qwen3.8-27b', fellBack: false, messageCount: 1 });
  };
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  api.listSessions.mockResolvedValue([]);
  api.updateSession.mockResolvedValue({});
});
afterEach(() => vi.restoreAllMocks());

it('starts a new interview from setup and streams the opening message', async () => {
  api.createSession.mockResolvedValue(baseSession());
  api.sendSessionTurn.mockImplementation(replyWith('Welcome! Here is Two Sum.'));

  renderAt('/interview/dsa');
  fireEvent.click(await screen.findByText('Begin Interview'));

  expect(await screen.findByText('Welcome! Here is Two Sum.')).toBeInTheDocument();
  expect(api.createSession).toHaveBeenCalledWith(expect.objectContaining({ interviewType: 'dsa', config: expect.objectContaining({ language: 'Java' }) }));
  expect(api.sendSessionTurn).toHaveBeenCalledWith('s1', expect.objectContaining({ content: null }), expect.any(Object));
  await waitFor(() => expect(currentLocation.search).toBe('?session=s1'));
  expect(screen.getByText('Two Sum')).toBeInTheDocument();
  expect(api.createSession).toHaveBeenCalledTimes(1);
});

it('sends a message and shows the reply', async () => {
  api.getSession.mockResolvedValue(baseSession({ messages: [{ role: 'assistant', content: 'Question?' }] }));
  api.sendSessionTurn.mockImplementation(replyWith('Nice, what about duplicates?'));

  renderAt('/interview/dsa?session=s1');
  expect(await screen.findByText('Question?')).toBeInTheDocument();

  fireEvent.change(screen.getByPlaceholderText(/Type your answer/), { target: { value: 'Use a hash map' } });
  fireEvent.click(screen.getByLabelText('Send message'));

  expect(await screen.findByText('Nice, what about duplicates?')).toBeInTheDocument();
  expect(screen.getByText('Use a hash map')).toBeInTheDocument();
  expect(api.sendSessionTurn).toHaveBeenCalledWith('s1', expect.objectContaining({ content: 'Use a hash map' }), expect.any(Object));
});

it('restores the message after a failed turn and retries it', async () => {
  api.getSession.mockResolvedValue(baseSession({ messages: [{ role: 'assistant', content: 'Question?' }] }));
  api.sendSessionTurn
    .mockRejectedValueOnce({ response: { data: { error: 'All AI models are busy', code: 'AI_UNAVAILABLE' } } })
    .mockImplementationOnce(replyWith('Got it.'));

  renderAt('/interview/dsa?session=s1');
  await screen.findByText('Question?');
  fireEvent.change(screen.getByPlaceholderText(/Type your answer/), { target: { value: 'my answer' } });
  fireEvent.click(screen.getByLabelText('Send message'));

  expect(await screen.findByText(/All AI models are busy/)).toBeInTheDocument();
  expect(screen.getByPlaceholderText(/Type your answer/)).toHaveValue('my answer');
  expect(screen.queryByTestId('msg-user')).not.toBeInTheDocument();

  fireEvent.click(screen.getByText('Retry'));
  expect(await screen.findByText('Got it.')).toBeInTheDocument();
  expect(api.sendSessionTurn).toHaveBeenLastCalledWith('s1', expect.objectContaining({ content: 'my answer' }), expect.any(Object));
  expect(screen.getByPlaceholderText(/Type your answer/)).toHaveValue('');
});

it('generates the opening message when resuming a session that has none', async () => {
  api.getSession.mockResolvedValue(baseSession());
  api.sendSessionTurn.mockImplementation(replyWith('Opening'));

  renderAt('/interview/dsa?session=s1');
  expect(await screen.findByText('Opening')).toBeInTheDocument();
  expect(api.sendSessionTurn).toHaveBeenCalledTimes(1);
});

it('goes back to setup with an error when the session cannot be created', async () => {
  api.createSession.mockRejectedValue({ response: { data: { error: 'Daily limit of 20 sessions reached.', code: 'DAILY_QUOTA_EXCEEDED' } } });

  renderAt('/interview/dsa');
  fireEvent.click(await screen.findByText('Begin Interview'));

  expect(await screen.findByText(/Daily limit of 20 sessions reached/)).toBeInTheDocument();
  expect(screen.getByText('Begin Interview')).toBeInTheDocument();
});

it('redirects finished sessions to their scorecard', async () => {
  api.getSession.mockResolvedValue(baseSession({ status: 'completed', scorecard: { score: 80 } }));
  renderAt('/interview/dsa?session=s1');
  expect(await screen.findByText('Scorecard page')).toBeInTheDocument();
});

it('offers to resume an unfinished session, and Start fresh archives it', async () => {
  api.listSessions.mockResolvedValue([baseSession({ id: 'old', question: { title: 'Old Q' } })]);

  renderAt('/interview/dsa');
  expect(await screen.findByText('Resume session?')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Start fresh'));

  expect(await screen.findByText('Begin Interview')).toBeInTheDocument();
  expect(api.updateSession).toHaveBeenCalledWith('old', { status: 'archived' });
});

it('resumes the unfinished session in place', async () => {
  api.listSessions.mockResolvedValue([baseSession({ id: 'old' })]);
  api.getSession.mockResolvedValue(baseSession({ id: 'old', messages: [{ role: 'assistant', content: 'Where were we?' }] }));

  renderAt('/interview/dsa');
  fireEvent.click(await screen.findByText('Resume'));

  expect(await screen.findByText('Where were we?')).toBeInTheDocument();
  expect(api.getSession).toHaveBeenCalledWith('old');
  expect(currentLocation.search).toBe('?session=old');
});

it('auto-starts sheet practice for the chosen problem', async () => {
  api.createSession.mockResolvedValue(baseSession({ interviewType: 'tutorDsa', mode: 'sheet', timerEndsAt: null }));
  api.sendSessionTurn.mockImplementation(replyWith('Let us learn Koko'));

  renderAt({
    pathname: '/interview/tutorDsa',
    state: { practice: { questionTitle: 'Koko Eating Bananas', sheetId: 'dsa-master', problemId: 'p1', model: 'qwen/qwen3.8-27b', language: 'Java' } },
  });

  expect(await screen.findByText('Let us learn Koko')).toBeInTheDocument();
  expect(api.createSession).toHaveBeenCalledTimes(1);
  expect(api.createSession).toHaveBeenCalledWith(expect.objectContaining({
    interviewType: 'tutorDsa',
    questionTitle: 'Koko Eating Bananas',
    source: { kind: 'sheet', sheetId: 'dsa-master', problemId: 'p1' },
  }));
  expect(api.listSessions).toHaveBeenCalledWith(expect.objectContaining({ question: 'Koko Eating Bananas' }));
});

it('starts a loop round with the loop as its source', async () => {
  api.createSession.mockResolvedValue(baseSession({ mode: 'loop', source: { kind: 'loop', loopId: 'L1', roundIndex: 0 } }));
  api.sendSessionTurn.mockImplementation(replyWith('Round one'));

  renderAt('/interview/dsa?loopId=L1&roundIndex=0');
  fireEvent.click(await screen.findByText('Begin Interview'));

  expect(await screen.findByText('Round one')).toBeInTheDocument();
  expect(api.createSession).toHaveBeenCalledWith(expect.objectContaining({ source: { kind: 'loop', loopId: 'L1', roundIndex: 0 } }));
  expect(new URLSearchParams(currentLocation.search).get('loopId')).toBe('L1');
});

it('ends the interview after confirmation and opens the scorecard', async () => {
  api.getSession.mockResolvedValue(baseSession({ messages: [{ role: 'assistant', content: 'Q' }, { role: 'user', content: 'A' }] }));
  api.endSession.mockResolvedValue(baseSession({ status: 'completed', scorecard: { score: 70 } }));

  renderAt('/interview/dsa?session=s1');
  await screen.findByText('Q');
  fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
  fireEvent.click(screen.getByText('End Interview'));
  fireEvent.click(await screen.findByText('Generate Scorecard'));

  expect(await screen.findByText('Scorecard page')).toBeInTheDocument();
  expect(api.endSession).toHaveBeenCalledWith('s1', 'openai/gpt-oss-120b');
});

it('ends a tutor lesson straight to its transcript', async () => {
  api.getSession.mockResolvedValue(baseSession({ interviewType: 'tutorDsa', mode: 'tutor', timerEndsAt: null, messages: [{ role: 'assistant', content: 'Lesson' }] }));
  api.endSession.mockResolvedValue(baseSession({ status: 'completed' }));

  renderAt('/interview/tutorDsa?session=s1');
  await screen.findByText('Lesson');
  fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
  fireEvent.click(screen.getByText('End Lesson'));

  expect(await screen.findByText('History detail page')).toBeInTheDocument();
});

it('appends the code review to the conversation', async () => {
  api.getSession.mockResolvedValue(baseSession({ messages: [{ role: 'assistant', content: 'Q' }] }));
  api.reviewSessionCode.mockResolvedValue([
    { role: 'user', content: 'Here is my implementation' },
    { role: 'assistant', content: 'Looks right, O(n).' },
  ]);

  renderAt('/interview/dsa?session=s1');
  await screen.findByText('Q');
  fireEvent.click(screen.getByTitle('Open Code Editor'));
  await act(async () => { fireEvent.click(screen.getByText('Submit code')); });

  expect(await screen.findByText('Looks right, O(n).')).toBeInTheDocument();
  expect(api.reviewSessionCode).toHaveBeenCalledWith('s1', 'int x = 1;', 'java');
});

it('starting a new session archives the current one and returns to setup', async () => {
  api.getSession.mockResolvedValue(baseSession({ messages: [{ role: 'assistant', content: 'Q' }] }));

  renderAt('/interview/dsa?session=s1');
  await screen.findByText('Q');
  fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
  fireEvent.click(screen.getByText('New Session'));

  expect(await screen.findByText('Begin Interview')).toBeInTheDocument();
  await waitFor(() => expect(currentLocation.search).toBe(''));
  expect(api.updateSession).toHaveBeenCalledWith('s1', { status: 'archived' });
});

describe('leaving and switching interviews', () => {
  const answered = () => baseSession({ messages: [{ role: 'assistant', content: 'Q' }, { role: 'user', content: 'A' }] });

  it('asks before leaving an answered interview; Keep going changes nothing', async () => {
    api.getSession.mockResolvedValue(answered());
    renderAt('/interview/dsa?session=s1');
    await screen.findByText('Q');
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByText('New Session'));

    expect(await screen.findByText('Leave this interview?')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Keep going'));
    expect(screen.queryByText('Leave this interview?')).not.toBeInTheDocument();
    expect(api.updateSession).not.toHaveBeenCalled();
    expect(api.endSession).not.toHaveBeenCalled();
  });

  it('can discard an answered interview and start new', async () => {
    api.getSession.mockResolvedValue(answered());
    renderAt('/interview/dsa?session=s1');
    await screen.findByText('Q');
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByText('New Session'));
    fireEvent.click(await screen.findByText('Discard & start new'));

    expect(await screen.findByText('Begin Interview')).toBeInTheDocument();
    expect(api.updateSession).toHaveBeenCalledWith('s1', { status: 'archived' });
  });

  it('can score an answered interview instead of losing it', async () => {
    api.getSession.mockResolvedValue(answered());
    api.endSession.mockResolvedValue(baseSession({ status: 'completed', scorecard: { score: 60 } }));
    renderAt('/interview/dsa?session=s1');
    await screen.findByText('Q');
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByText('New Session'));
    fireEvent.click(await screen.findByText('End & get scorecard'));

    expect(await screen.findByText('Scorecard page')).toBeInTheDocument();
    expect(api.updateSession).not.toHaveBeenCalledWith('s1', { status: 'archived' });
  });

  it('keeps a tutor lesson as finished instead of discarding it', async () => {
    api.getSession.mockResolvedValue(baseSession({ interviewType: 'tutorDsa', mode: 'tutor', timerEndsAt: null, messages: [{ role: 'assistant', content: 'Lesson' }, { role: 'user', content: 'Why?' }] }));
    api.endSession.mockResolvedValue(baseSession({ status: 'completed' }));
    renderAt('/interview/tutorDsa?session=s1');
    await screen.findByText('Lesson');
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByText('New Session'));

    expect(await screen.findByText('Begin Interview')).toBeInTheDocument();
    expect(api.endSession).toHaveBeenCalledWith('s1');
    expect(api.updateSession).not.toHaveBeenCalled();
  });

  const running = baseSession({ id: 'other', interviewType: 'systemDesign', question: { title: 'Design Twitter' }, serverNow: new Date().toISOString() });
  const blocked = { response: { data: { error: 'busy', code: 'ACTIVE_INTERVIEW', details: { session: running } } } };

  it('offers to resume the interview that is already running', async () => {
    api.createSession.mockRejectedValueOnce(blocked);
    api.getSession.mockResolvedValue({ ...running, messages: [{ role: 'assistant', content: 'Design Twitter please' }] });
    renderAt('/interview/dsa');
    fireEvent.click(await screen.findByText('Begin Interview'));

    expect(await screen.findByText('You already have an interview running')).toBeInTheDocument();
    expect(screen.getByText(/Design Twitter/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Resume it'));
    await waitFor(() => expect(currentLocation.pathname).toBe('/interview/systemDesign'));
    expect(currentLocation.search).toBe('?session=other');
  });

  it('can discard the running interview and start the new one', async () => {
    api.createSession.mockRejectedValueOnce(blocked).mockResolvedValueOnce(baseSession());
    api.sendSessionTurn.mockImplementation(replyWith('Fresh problem'));
    renderAt('/interview/dsa');
    fireEvent.click(await screen.findByText('Begin Interview'));
    fireEvent.click(await screen.findByText('Discard it & start this one'));

    expect(await screen.findByText('Fresh problem')).toBeInTheDocument();
    expect(api.updateSession).toHaveBeenCalledWith('other', { status: 'archived' });
    expect(api.createSession).toHaveBeenCalledTimes(2);
  });
});

describe('timer and ending edge cases', () => {
  const past = () => new Date(Date.now() - 60_000).toISOString();
  const answered = [{ role: 'assistant', content: 'Q' }, { role: 'user', content: 'A' }];

  it('scores the interview automatically when time runs out after an answer', async () => {
    api.getSession.mockResolvedValue(baseSession({ messages: answered, userMessageCount: 1, timerEndsAt: past() }));
    api.endSession.mockResolvedValue(baseSession({ status: 'completed', scorecard: { score: 50 } }));

    renderAt('/interview/dsa?session=s1');

    expect(await screen.findByText('Scorecard page')).toBeInTheDocument();
    expect(api.endSession).toHaveBeenCalledTimes(1);
  });

  it('closes the interview as a timeout when time runs out with no answers', async () => {
    api.getSession.mockResolvedValue(baseSession({ messages: [{ role: 'assistant', content: 'Q' }], timerEndsAt: past() }));
    api.endSession.mockResolvedValue(baseSession({ status: 'archived', endReason: 'timeout', messages: [{ role: 'assistant', content: 'Q' }] }));

    renderAt('/interview/dsa?session=s1');

    expect(await screen.findByText(/Time ran out before you answered/)).toBeInTheDocument();
    expect(screen.getByLabelText('Your answer')).toBeDisabled();
    expect(api.endSession).toHaveBeenCalledTimes(1);
  });

  it('shows the full interview length before the clock starts', async () => {
    api.createSession.mockResolvedValue(baseSession({ timerEndsAt: null, timerMinutes: 45 }));
    api.sendSessionTurn.mockImplementation(() => new Promise(() => {}));

    renderAt('/interview/dsa');
    fireEvent.click(await screen.findByText('Begin Interview'));

    expect(await screen.findByText(/45:00/)).toBeInTheDocument();
  });

  it('calls out when 5 minutes remain', async () => {
    api.getSession.mockResolvedValue(baseSession({ messages: answered, timerEndsAt: new Date(Date.now() + 4 * 60_000).toISOString() }));

    renderAt('/interview/dsa?session=s1');

    expect(await screen.findByText(/5 minutes left/)).toBeInTheDocument();
  });

  it('retries a failed answer with the same turnId so the server never saves it twice', async () => {
    api.getSession.mockResolvedValue(baseSession({ messages: [{ role: 'assistant', content: 'Q' }] }));
    api.sendSessionTurn
      .mockRejectedValueOnce(new TypeError('network error'))
      .mockImplementationOnce(replyWith('Got it.'));

    renderAt('/interview/dsa?session=s1');
    await screen.findByText('Q');
    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: 'my answer' } });
    fireEvent.click(screen.getByLabelText('Send message'));
    fireEvent.click(await screen.findByText('Retry'));

    expect(await screen.findByText('Got it.')).toBeInTheDocument();
    const [first, second] = api.sendSessionTurn.mock.calls.map((call) => call[1].turnId);
    expect(first).toBeTruthy();
    expect(second).toBe(first);
  });

  it('reloads the latest transcript when another tab changed the session', async () => {
    api.getSession
      .mockResolvedValueOnce(baseSession({ messages: [{ role: 'assistant', content: 'Q' }] }))
      .mockResolvedValue(baseSession({ messages: [{ role: 'assistant', content: 'Q' }, { role: 'user', content: 'from tab 2' }, { role: 'assistant', content: 'R' }] }));
    api.sendSessionTurn.mockRejectedValue({ response: { status: 409, data: { code: 'SESSION_CONFLICT', error: 'changed' } } });

    renderAt('/interview/dsa?session=s1');
    await screen.findByText('Q');
    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: 'mine' } });
    fireEvent.click(screen.getByLabelText('Send message'));

    expect(await screen.findByText('from tab 2')).toBeInTheDocument();
    expect(screen.getByText(/updated from another tab/)).toBeInTheDocument();
    expect(screen.getByLabelText('Your answer')).toHaveValue('mine');
  });

  it('quietly closes a timed-out unanswered session instead of offering to resume it', async () => {
    api.listSessions.mockResolvedValue([baseSession({ id: 'old', timerEndsAt: past(), userMessageCount: 0 })]);
    api.endSession.mockResolvedValue(baseSession({ id: 'old', status: 'archived' }));

    renderAt('/interview/dsa');

    expect(await screen.findByText('Begin Interview')).toBeInTheDocument();
    expect(screen.queryByText('Resume session?')).not.toBeInTheDocument();
    expect(api.endSession).toHaveBeenCalledWith('old');
  });

  it('keeps an unsent draft across reloads', async () => {
    localStorage.setItem('interview_draft_s1', 'half-written answer');
    api.getSession.mockResolvedValue(baseSession({ messages: [{ role: 'assistant', content: 'Q' }] }));

    renderAt('/interview/dsa?session=s1');

    await screen.findByText('Q');
    expect(screen.getByLabelText('Your answer')).toHaveValue('half-written answer');
    localStorage.clear();
  });
});
