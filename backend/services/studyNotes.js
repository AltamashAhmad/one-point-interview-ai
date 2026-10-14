/**
 * Prompts for AI-generated study notes on the DSA Master Sheet (per-problem and per-pattern).
 * Output is always pseudocode, never real syntax, so it scaffolds thinking without handing over working code.
 */

function pseudocodeRule(language) {
  return `Write every algorithm step as plain-English pseudocode (e.g. "for each num in nums:", "push i onto stack"). Never write real ${language || 'Java'} syntax, semicolons, braces, or imports — the candidate must still type the real code themselves.`;
}

function buildProblemNotesPrompt(title, difficulty, sectionTitle, language) {
  return `You are a Principal Engineer creating gold-standard revision notes for a candidate preparing for FAANG interviews.

Problem: "${title}"${difficulty ? ` (Difficulty: ${difficulty})` : ''}
Pattern/section this problem belongs to: "${sectionTitle || 'Unknown'}"
${pseudocodeRule(language)}

Write a complete, structured breakdown in Markdown with EXACTLY these sections:

### 🔑 Pattern Recognition
Which exact words, phrases or constraints in this problem's statement should make you think of "${sectionTitle || 'this pattern'}"? Be concrete (e.g. "sorted array + find a pair" → two pointers, "count subarrays" → prefix sum). Write 2-4 bullet points.

### 💡 Intuition & Approach
Plain-English reasoning: how does an experienced engineer think through this problem from scratch to spot the technique?

### 🐢 Brute Force
The naive approach, in pseudocode, plus its Time and Space complexity.

### ⚙️ Better Approach
A smarter but not-yet-optimal approach if one commonly exists between brute force and optimal (pseudocode + complexity). If no meaningful middle step exists, write "N/A — jump straight from brute force to optimal" instead of forcing one.

### 🚀 Optimal Approach
The best known approach, in pseudocode, plus its Time and Space complexity. Explain WHY it's optimal.

### ⚠️ Edge Cases & Common Mistakes
The specific edge cases and bugs candidates typically get wrong on this exact problem.

Be specific to this exact problem, not generic. Do not include a title, preamble, or closing remarks — output only the sections above.`;
}

function buildPatternNotesPrompt(sectionTitle, language) {
  return `You are a Principal Engineer creating a gold-standard "pattern playbook" for a candidate preparing for FAANG interviews.

Pattern: "${sectionTitle}"
${pseudocodeRule(language)}

Write a complete, structured breakdown in Markdown with EXACTLY these sections:

### 🔑 How to Recognize This Pattern
Which exact words, phrases or constraints in a problem statement signal that this pattern applies? List 3-5 concrete trigger phrases.

### 🧩 Generic Template
A reusable pseudocode skeleton for this pattern that can be adapted to any problem in this section — the shape every solution in this pattern shares.

### 💡 Why It Works
The core intuition for why this technique is correct and efficient.

### 🐢 → 🚀 Brute Force vs. This Pattern
In one paragraph, contrast the naive brute-force complexity against this pattern's complexity, and explain what insight closes that gap.

### ⚠️ Common Pitfalls
The specific mistakes candidates make when applying this pattern (off-by-one errors, wrong loop invariant, missed edge case, etc).

Do not include a title, preamble, or closing remarks — output only the sections above.`;
}

module.exports = { buildProblemNotesPrompt, buildPatternNotesPrompt };
