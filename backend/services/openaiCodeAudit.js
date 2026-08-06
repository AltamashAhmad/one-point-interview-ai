const OpenAI = require('openai');

const DEFAULT_MODEL = process.env.OPENAI_CODE_AUDIT_MODEL || 'gpt-5.1';
const REQUEST_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 90_000);

let client;

const codeAuditSchema = {
  name: 'one_point_code_audit',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'summary',
      'verdict',
      'timeComplexity',
      'spaceComplexity',
      'bugs',
      'logicalVulnerabilities',
      'missedEdgeCases',
      'efficiencyNotes',
      'nextStepHints',
      'followUpQuestion',
    ],
    properties: {
      summary: { type: 'string' },
      verdict: {
        type: 'string',
        enum: ['needs_clarification', 'incorrect', 'partially_correct', 'correct_but_suboptimal', 'strong'],
      },
      timeComplexity: {
        type: 'object',
        additionalProperties: false,
        required: ['bigO', 'explanation'],
        properties: {
          bigO: { type: 'string' },
          explanation: { type: 'string' },
        },
      },
      spaceComplexity: {
        type: 'object',
        additionalProperties: false,
        required: ['bigO', 'explanation'],
        properties: {
          bigO: { type: 'string' },
          explanation: { type: 'string' },
        },
      },
      bugs: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['severity', 'location', 'issue', 'whyItMatters'],
          properties: {
            severity: { type: 'string', enum: ['low', 'medium', 'high'] },
            location: { type: 'string' },
            issue: { type: 'string' },
            whyItMatters: { type: 'string' },
          },
        },
      },
      logicalVulnerabilities: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['issue', 'impact'],
          properties: {
            issue: { type: 'string' },
            impact: { type: 'string' },
          },
        },
      },
      missedEdgeCases: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['case', 'expectedBehavior', 'whyItCanFail'],
          properties: {
            case: { type: 'string' },
            expectedBehavior: { type: 'string' },
            whyItCanFail: { type: 'string' },
          },
        },
      },
      efficiencyNotes: {
        type: 'array',
        items: { type: 'string' },
      },
      nextStepHints: {
        type: 'array',
        minItems: 1,
        maxItems: 4,
        items: { type: 'string' },
      },
      followUpQuestion: { type: 'string' },
    },
  },
  strict: true,
};

function assertConfigured() {
  if (!process.env.OPENAI_API_KEY) {
    const err = new Error('OPENAI_API_KEY is not configured on the server.');
    err.status = 503;
    err.code = 'OPENAI_NOT_CONFIGURED';
    throw err;
  }
}

function getClient() {
  assertConfigured();
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: REQUEST_TIMEOUT_MS,
    });
  }
  return client;
}

function buildAuditInput({ code, language, problemTitle, promptContext }) {
  return [
    `Problem title: ${problemTitle || 'Unknown / current interview problem'}`,
    `Language: ${language || 'unknown'}`,
    promptContext ? `Candidate/problem context: ${promptContext}` : '',
    'Candidate code:',
    '```',
    code,
    '```',
  ].filter(Boolean).join('\n');
}

function normalizeAudit(rawAudit) {
  return {
    summary: rawAudit.summary || 'Code review completed.',
    verdict: rawAudit.verdict || 'needs_clarification',
    timeComplexity: rawAudit.timeComplexity || { bigO: 'Unknown', explanation: 'Not enough information.' },
    spaceComplexity: rawAudit.spaceComplexity || { bigO: 'Unknown', explanation: 'Not enough information.' },
    bugs: Array.isArray(rawAudit.bugs) ? rawAudit.bugs : [],
    logicalVulnerabilities: Array.isArray(rawAudit.logicalVulnerabilities) ? rawAudit.logicalVulnerabilities : [],
    missedEdgeCases: Array.isArray(rawAudit.missedEdgeCases) ? rawAudit.missedEdgeCases : [],
    efficiencyNotes: Array.isArray(rawAudit.efficiencyNotes) ? rawAudit.efficiencyNotes : [],
    nextStepHints: Array.isArray(rawAudit.nextStepHints) ? rawAudit.nextStepHints : ['Explain your intended invariant, then dry-run a boundary case.'],
    followUpQuestion: rawAudit.followUpQuestion || 'Which edge case would you like to dry-run first?',
  };
}

async function auditCode({ code, language, problemTitle, promptContext }) {
  const openai = getClient();

  const response = await openai.responses.create({
    model: DEFAULT_MODEL,
    instructions: [
      'You are One Point Interview AI acting as a strict technical interviewer and code auditor.',
      'Evaluate the submitted code like a live FAANG-style DSA interview.',
      'Do not provide a full corrected solution. Give progressive hints and next steps.',
      'Be precise about Big O time and space complexity. Identify syntax risks, logical bugs, vulnerabilities, and missed edge cases.',
      'If the code is incomplete, say exactly what information is missing and ask one focused follow-up question.',
    ].join('\n'),
    input: buildAuditInput({ code, language, problemTitle, promptContext }),
    text: {
      format: {
        type: 'json_schema',
        ...codeAuditSchema,
      },
    },
  });

  const outputText = response.output_text;
  if (!outputText) {
    const err = new Error('OpenAI returned an empty code audit response.');
    err.status = 502;
    throw err;
  }

  return normalizeAudit(JSON.parse(outputText));
}

module.exports = { auditCode, codeAuditSchema };
