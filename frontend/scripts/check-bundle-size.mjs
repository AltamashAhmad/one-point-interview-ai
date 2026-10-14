// Fails when the JavaScript a first visit must download, or the chat chunk, grows past its budget.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const buildDir = process.argv[2] || 'build';
const budgetsKb = {
  startup: Number(process.env.BUDGET_STARTUP_KB) || 150, // gzip; was 129 when set
  chat: Number(process.env.BUDGET_CHAT_KB) || 90, // gzip; was 61 when set
};

const gzipKb = (file) => gzipSync(readFileSync(file)).length / 1024;

const html = readFileSync(join(buildDir, 'index.html'), 'utf8');
const startupFiles = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.js)"/g)].map((m) => join(buildDir, m[1]));
if (startupFiles.length === 0) {
  console.error('No startup scripts found in index.html; the check needs updating.');
  process.exit(1);
}

const chatChunks = readdirSync(join(buildDir, 'assets')).filter((name) => /^MessageBubble-.*\.js$/.test(name));
if (chatChunks.length === 0) {
  console.error('No MessageBubble chunk found; the check needs updating.');
  process.exit(1);
}

const startupKb = startupFiles.reduce((sum, file) => sum + gzipKb(file), 0);
const chatKb = Math.max(...chatChunks.map((name) => gzipKb(join(buildDir, 'assets', name))));

const rows = [
  ['startup JavaScript', startupKb, budgetsKb.startup],
  ['chat chunk', chatKb, budgetsKb.chat],
];

let failed = false;
for (const [label, actual, budget] of rows) {
  const over = actual > budget;
  failed ||= over;
  console.log(`${over ? 'FAIL' : 'ok  '} ${label}: ${actual.toFixed(1)} KB gzip (budget ${budget} KB)`);
}

process.exit(failed ? 1 : 0);
