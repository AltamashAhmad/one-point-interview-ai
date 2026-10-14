/**
 * Minimal structured logger: one JSON line per event in production (easy to ship to CloudWatch),
 * readable single lines in development, silent in tests unless LOG_LEVEL is set.
 */
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const isProd = process.env.NODE_ENV === 'production';
const defaultLevel = process.env.NODE_ENV === 'test' ? 'silent' : isProd ? 'info' : 'debug';
const threshold = LEVELS[process.env.LOG_LEVEL || defaultLevel] ?? Infinity;

function write(level, msg, rawFields = {}) {
  if (LEVELS[level] < threshold) return;
  const fields = Object.fromEntries(Object.entries(rawFields).filter(([, v]) => v !== undefined));
  const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (isProd) {
    sink(JSON.stringify({ time: new Date().toISOString(), level, msg, ...fields }));
    return;
  }
  const extra = Object.entries(fields).map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`).join(' ');
  sink(`[${level.toUpperCase()}] ${msg}${extra ? ` ${extra}` : ''}`);
}

module.exports = {
  debug: (msg, fields) => write('debug', msg, fields),
  info: (msg, fields) => write('info', msg, fields),
  warn: (msg, fields) => write('warn', msg, fields),
  error: (msg, fields) => write('error', msg, fields),
};
