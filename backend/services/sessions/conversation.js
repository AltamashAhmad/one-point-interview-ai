const { getSystemPrompt } = require('../prompts');
const { INTERVIEW_TYPES } = require('../../config/interviewTypes');

const TIMER_MINUTES = { dsa: 45, lld: 60, systemDesign: 60, managerial: 45 };

function isTutorType(interviewType) {
  return Boolean(INTERVIEW_TYPES[interviewType]?.isTutor);
}

function timerMinutesFor(interviewType) {
  return isTutorType(interviewType) ? null : TIMER_MINUTES[interviewType] || 45;
}

/** Hidden first user turn that starts the conversation; never shown in the transcript. */
function openingMessage({ interviewType, config = {} }) {
  const parts = isTutorType(interviewType)
    ? [
        'Hello! I want to learn and practice.',
        config.difficulty && config.difficulty !== 'ANY' ? `Difficulty: ${config.difficulty}.` : '',
        config.language ? `Preferred language: ${config.language}.` : '',
        'Please present a problem and teach me step-by-step how to approach and solve it.',
      ]
    : [
        'Hello, I am ready to start the interview.',
        config.company ? `Target company: ${config.company}.` : '',
        config.difficulty && config.difficulty !== 'ANY' ? `Difficulty: ${config.difficulty}.` : '',
        config.language ? `Preferred language: ${config.language}.` : '',
        'Please present the problem and begin.',
      ];
  return { role: 'user', content: parts.filter(Boolean).join(' ') };
}

function questionDataFor(data) {
  if (data.questionData) return data.questionData;
  return data.question?.title ? { title: data.question.title, isSeed: true } : null;
}

function systemPromptFor(data, userName, now = Date.now()) {
  const config = data.config || {};
  const base = getSystemPrompt(data.interviewType, userName, {
    company: config.company || null,
    difficulty: config.difficulty || 'ANY',
    language: config.language || 'any language',
    questionData: questionDataFor(data),
  });
  const pacing = pacingNote(data, now);
  return pacing ? `${base}\n\n${pacing}` : base;
}

/** Tells the interviewer how much time is left so it paces the interview like a real one. */
function pacingNote(data, now) {
  if (isTutorType(data.interviewType)) return '';
  const endsAt = data.timerEndsAt?.toDate ? data.timerEndsAt.toDate() : data.timerEndsAt ? new Date(data.timerEndsAt) : null;
  if (!endsAt || Number.isNaN(endsAt.getTime())) return '';
  const minutesLeft = Math.max(0, Math.round((endsAt.getTime() - now) / 60_000));
  const guidance = minutesLeft <= 1
    ? 'Time is essentially up: thank the candidate, give no new questions, and tell them the interview is ending.'
    : minutesLeft <= 5
      ? 'Start wrapping up: ask for final code or complexity if missing, and do not introduce new problems.'
      : minutesLeft <= 15
        ? 'Keep the discussion focused; move toward a working solution and complexity analysis.'
        : 'Pace normally.';
  return `---\nINTERVIEW CLOCK: about ${minutesLeft} minute(s) remain. ${guidance}\n---`;
}

/** Messages sent to the model: the hidden opener, the stored transcript, and the optional new user turn. */
function modelMessages(data, newUserMessage) {
  const transcript = (data.messages || []).map(({ role, content }) => ({ role, content }));
  return [openingMessage(data), ...transcript, ...(newUserMessage ? [newUserMessage] : [])];
}

function firstName(user) {
  return (user?.name || user?.email || '').split(/[\s@]/)[0] || 'there';
}

module.exports = {
  isTutorType,
  timerMinutesFor,
  systemPromptFor,
  modelMessages,
  firstName,
};
