/**
 * build-question-bank.js
 *
 * One-time script to parse all cloned repos and generate:
 *   backend/data/dsa.json       — company-wise DSA questions (from liquidslr CSV)
 *   backend/data/lld.json       — all LLD problems with full context (from awesome-lld)
 *   backend/data/system-design.json — SD problems with full solutions (from system-design-primer)
 *
 * Run: node backend/scripts/build-question-bank.js
 */

const fs   = require('fs');
const path = require('path');

const ROOT    = path.join(__dirname, '..', '..');
const OUT_DIR = path.join(__dirname, '..', 'data');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// ─────────────────────────────────────────────────────────────────────────────
// 1. DSA: Parse liquidslr CSV repo
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n📊 Building DSA question bank from liquidslr repo...');

const DSA_REPO = path.join(ROOT, 'interview-company-wise-problems');

/**
 * Parse a single CSV file into an array of question objects.
 * CSV format: Difficulty,Title,Frequency,Acceptance Rate,Link,Topics
 */
function parseCsv(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines   = content.trim().split('\n');
  if (lines.length < 2) return [];

  const results = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle quoted fields (Topics column is often quoted CSV with commas)
    const cols = parseCsvLine(line);
    if (cols.length < 5) continue;

    const [difficulty, title, frequencyRaw, acceptanceRaw, link, ...topicParts] = cols;
    const topicsStr = topicParts.join(',').replace(/^"|"$/g, '').trim();

    const frequency  = parseFloat(frequencyRaw) || 0;
    const acceptance = parseFloat(acceptanceRaw) || 0;

    if (!title || !link) continue;

    results.push({
      title:      title.trim(),
      difficulty: difficulty.trim().toUpperCase(),   // EASY | MEDIUM | HARD
      frequency:  Math.round(frequency * 10) / 10,
      acceptance: Math.round(acceptance * 1000) / 10, // convert to percentage
      link:       link.trim(),
      topics:     topicsStr ? topicsStr.split(',').map(t => t.trim()).filter(Boolean) : [],
    });
  }
  return results;
}

/** Minimal CSV line parser that handles quoted fields */
function parseCsvLine(line) {
  const cols = [];
  let cur = '', inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      cols.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cols.push(cur);
  return cols;
}

const dsaBank = {};
let dsaCompanyCount = 0;
let dsaTotalQuestions = 0;

const companyDirs = fs.readdirSync(DSA_REPO).filter(name => {
  const fullPath = path.join(DSA_REPO, name);
  return fs.statSync(fullPath).isDirectory() && !name.startsWith('.');
});

for (const companyName of companyDirs) {
  const companyDir = path.join(DSA_REPO, companyName);
  const csvFiles   = fs.readdirSync(companyDir).filter(f => f.endsWith('.csv'));

  if (csvFiles.length === 0) continue;

  // Priority: "1. Thirty Days" > "2. Three Months" > "3. Six Months" > "4. More Than Six Months"
  // We merge all, keeping the highest frequency for duplicate titles
  const questionMap = new Map(); // title -> question

  const priorityOrder = [
    '4. More Than Six Months',
    '3. Six Months',
    '2. Three Months',
    '1. Thirty Days',
  ];

  for (const csvName of csvFiles) {
    if (csvName.includes('All')) continue; // skip the empty "All" file
    const questions = parseCsv(path.join(companyDir, csvName));
    // Determine recency weight
    const recency = csvName.includes('Thirty Days') ? 'recent'
      : csvName.includes('Three Months') ? 'three_months'
      : csvName.includes('Six Months') ? 'six_months'
      : 'older';

    for (const q of questions) {
      const existing = questionMap.get(q.title);
      if (!existing || q.frequency > existing.frequency) {
        questionMap.set(q.title, { ...q, recency });
      }
    }
  }

  if (questionMap.size === 0) continue;

  // Sort by frequency descending
  const sorted = Array.from(questionMap.values()).sort((a, b) => b.frequency - a.frequency);

  // Normalise company name to a slug key
  const key = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  dsaBank[key] = {
    displayName: companyName,
    questions:   sorted,
  };

  dsaCompanyCount++;
  dsaTotalQuestions += sorted.length;
}

const dsaOutputPath = path.join(OUT_DIR, 'dsa.json');
fs.writeFileSync(dsaOutputPath, JSON.stringify(dsaBank, null, 2));
console.log(`✅ DSA: ${dsaCompanyCount} companies, ${dsaTotalQuestions} questions → ${dsaOutputPath}`);

// ─────────────────────────────────────────────────────────────────────────────
// 2. LLD: Parse awesome-low-level-design problems/
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n🏗️  Building LLD question bank from awesome-low-level-design...');

const LLD_REPO     = path.join(ROOT, 'awesome-low-level-design');
const LLD_PROBLEMS = path.join(LLD_REPO, 'problems');

const lldBank = [];

if (fs.existsSync(LLD_PROBLEMS)) {
  const mdFiles = fs.readdirSync(LLD_PROBLEMS).filter(f => f.endsWith('.md'));

  for (const mdFile of mdFiles) {
    const filePath = path.join(LLD_PROBLEMS, mdFile);
    const content  = fs.readFileSync(filePath, 'utf8');

    // Extract title from first H1 or H2
    const titleMatch = content.match(/^#+ (.+)$/m);
    const title      = titleMatch ? titleMatch[1].trim() : mdFile.replace('.md', '').replace(/-/g, ' ');

    // Extract requirements section
    const reqMatch = content.match(/## Requirements\n([\s\S]*?)(?=\n##|\n---|\Z)/);
    const requirements = reqMatch ? reqMatch[1].trim() : '';

    // Extract classes/key components section
    const classMatch = content.match(/## Classes.*?\n([\s\S]*?)(?=\n##|\Z)/);
    const classInfo  = classMatch ? classMatch[1].trim() : '';

    // Detect difficulty from common heuristics
    const hard = ['chess', 'lru', 'pub-sub', 'stack-overflow', 'splitwise', 'linkedin', 'cricinfo'];
    const easy = ['atm', 'coffee', 'snake', 'tic-tac', 'traffic', 'vending'];
    const slug = mdFile.replace('.md', '');
    const difficulty = hard.some(h => slug.includes(h)) ? 'HARD'
      : easy.some(e => slug.includes(e)) ? 'EASY'
      : 'MEDIUM';

    // Extract topics/patterns from content
    const patterns = [];
    if (content.includes('Factory')) patterns.push('Factory Pattern');
    if (content.includes('Strategy')) patterns.push('Strategy Pattern');
    if (content.includes('Observer')) patterns.push('Observer Pattern');
    if (content.includes('Singleton')) patterns.push('Singleton Pattern');
    if (content.includes('State')) patterns.push('State Pattern');
    if (content.includes('Command')) patterns.push('Command Pattern');
    if (content.includes('Decorator')) patterns.push('Decorator Pattern');
    if (content.match(/interface|abstract/i)) patterns.push('Interface Design');
    if (content.match(/concurrent|thread|synchronized/i)) patterns.push('Concurrency');
    if (content.match(/SOLID|single responsibility|open\/closed/i)) patterns.push('SOLID Principles');

    lldBank.push({
      slug,
      title,
      difficulty,
      patterns,
      requirements,
      classInfo,
      sourceFile: `problems/${mdFile}`,
      hasSolution: fs.existsSync(path.join(LLD_REPO, 'solutions', 'java', 'src', slug))
        || fs.existsSync(path.join(LLD_REPO, 'solutions', 'python', slug)),
    });
  }
}

lldBank.sort((a, b) => a.title.localeCompare(b.title));

const lldOutputPath = path.join(OUT_DIR, 'lld.json');
fs.writeFileSync(lldOutputPath, JSON.stringify(lldBank, null, 2));
console.log(`✅ LLD: ${lldBank.length} problems → ${lldOutputPath}`);

// ─────────────────────────────────────────────────────────────────────────────
// 3. System Design: Parse system-design-primer solutions/
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n📐 Building System Design question bank from system-design-primer...');

const SD_REPO      = path.join(ROOT, 'system-design-primer');
const SD_SOLUTIONS = path.join(SD_REPO, 'solutions', 'system_design');
const SD_README    = path.join(SD_REPO, 'README.md');

const sdBank = [];

// Parse the README to extract all "Design X" problems listed there
if (fs.existsSync(SD_README)) {
  const readmeContent = fs.readFileSync(SD_README, 'utf8');

  // Find all "### Design X" headings and their blurbs
  const designRegex = /### (Design .+?)\n([\s\S]*?)(?=\n### |\n## |\Z)/g;
  let match;
  while ((match = designRegex.exec(readmeContent)) !== null) {
    const title   = match[1].trim();
    const body    = match[2].trim();

    // Extract bullet points as requirements
    const bullets = body.match(/^\* .+$/mg) || [];
    const requirements = bullets.map(b => b.replace(/^\* /, '').trim());

    // Check if a full solution folder exists
    const slugGuess = title.toLowerCase()
      .replace(/design\s+/i, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');

    const solutionDir  = path.join(SD_SOLUTIONS, slugGuess);
    const hasSolution  = fs.existsSync(solutionDir);
    let   solutionText = '';

    if (hasSolution) {
      // Try to read README.md inside the solution folder
      const solutionReadme = path.join(solutionDir, 'README.md');
      if (fs.existsSync(solutionReadme)) {
        solutionText = fs.readFileSync(solutionReadme, 'utf8');
      }
    }

    // Difficulty heuristic
    const titleLower = title.toLowerCase();
    const hardTerms  = ['scale', 'million', 'distributed', 'aws', 'search engine'];
    const easyTerms  = ['pastebin', 'url shortener', 'key-value'];
    const difficulty = hardTerms.some(t => titleLower.includes(t)) ? 'HARD'
      : easyTerms.some(t => titleLower.includes(t)) ? 'EASY'
      : 'MEDIUM';

    // Tag topics
    const topics = [];
    const combined = (title + body + solutionText).toLowerCase();
    if (combined.includes('cache')) topics.push('Caching');
    if (combined.includes('cdn')) topics.push('CDN');
    if (combined.includes('load balanc')) topics.push('Load Balancing');
    if (combined.includes('shard')) topics.push('Sharding');
    if (combined.includes('replication')) topics.push('Replication');
    if (combined.includes('message queue') || combined.includes('kafka')) topics.push('Message Queue');
    if (combined.includes('nosql') || combined.includes('sql')) topics.push('Database Design');
    if (combined.includes('api')) topics.push('API Design');
    if (combined.includes('availability') || combined.includes('fault toleran')) topics.push('High Availability');

    sdBank.push({
      title,
      difficulty,
      topics,
      requirements,
      hasSolution,
      solutionSummary: solutionText ? solutionText.substring(0, 1500) : '',
    });
  }
}

// Also add notable ones not in the "Design X" format
const additionalSD = [
  { title: 'Design a Rate Limiter', difficulty: 'MEDIUM', topics: ['API Design', 'Redis', 'Load Balancing'], requirements: ['Limit requests per user per second', 'Distributed environment support', 'Different rate limit rules per endpoint'], hasSolution: false, solutionSummary: '' },
  { title: 'Design a Notification System', difficulty: 'MEDIUM', topics: ['Message Queue', 'Database Design', 'High Availability'], requirements: ['Support push, email, and SMS notifications', 'Handle millions of notifications per day', 'Retry failed notifications'], hasSolution: false, solutionSummary: '' },
  { title: 'Design an API Gateway', difficulty: 'HARD', topics: ['Load Balancing', 'Caching', 'API Design', 'High Availability'], requirements: ['Route requests to microservices', 'Rate limiting and authentication', 'High throughput and low latency'], hasSolution: false, solutionSummary: '' },
  { title: 'Design a Chat Application (like WhatsApp)', difficulty: 'MEDIUM', topics: ['Message Queue', 'Database Design', 'High Availability'], requirements: ['Real-time messaging', 'Online/offline status', 'Message history'], hasSolution: false, solutionSummary: '' },
  { title: 'Design a Video Streaming Service (like Netflix)', difficulty: 'HARD', topics: ['CDN', 'Database Design', 'High Availability', 'Sharding'], requirements: ['Stream video to millions of users', 'Support adaptive bitrate', 'Handle content storage and delivery'], hasSolution: false, solutionSummary: '' },
  { title: 'Design Uber / Lyft Ride Sharing', difficulty: 'HARD', topics: ['Database Design', 'API Design', 'High Availability'], requirements: ['Match riders to nearby drivers', 'Real-time location tracking', 'Surge pricing'], hasSolution: false, solutionSummary: '' },
  { title: 'Design a Distributed Cache (like Redis)', difficulty: 'HARD', topics: ['Caching', 'Replication', 'High Availability', 'Sharding'], requirements: ['In-memory key-value store', 'Eviction policies (LRU)', 'Distributed partitioning'], hasSolution: false, solutionSummary: '' },
  { title: 'Design an E-commerce Platform (like Amazon)', difficulty: 'HARD', topics: ['Database Design', 'Caching', 'Message Queue', 'High Availability'], requirements: ['Product catalog search', 'Order processing and payments', 'Inventory management'], hasSolution: false, solutionSummary: '' },
];

sdBank.push(...additionalSD);

const sdOutputPath = path.join(OUT_DIR, 'system-design.json');
fs.writeFileSync(sdOutputPath, JSON.stringify(sdBank, null, 2));
console.log(`✅ System Design: ${sdBank.length} problems → ${sdOutputPath}`);

// ─────────────────────────────────────────────────────────────────────────────
// 4. Build company name index for autocomplete
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n🔍 Building company autocomplete index...');

const companyIndex = Object.entries(dsaBank).map(([slug, data]) => ({
  slug,
  name: data.displayName,
  questionCount: data.questions.length,
})).sort((a, b) => a.name.localeCompare(b.name));

const indexOutputPath = path.join(OUT_DIR, 'companies.json');
fs.writeFileSync(indexOutputPath, JSON.stringify(companyIndex, null, 2));
console.log(`✅ Company index: ${companyIndex.length} companies → ${indexOutputPath}`);

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n🎉 Question bank build complete!');
console.log(`   DSA:           ${dsaCompanyCount} companies, ${dsaTotalQuestions} total questions`);
console.log(`   LLD:           ${lldBank.length} problems`);
console.log(`   System Design: ${sdBank.length} problems`);
console.log(`   Companies:     ${companyIndex.length} in autocomplete index`);
console.log('\nOutput files:');
console.log(`   ${dsaOutputPath}`);
console.log(`   ${lldOutputPath}`);
console.log(`   ${sdOutputPath}`);
console.log(`   ${indexOutputPath}`);
