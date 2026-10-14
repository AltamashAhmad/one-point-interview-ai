// SDE-2 (Microsoft / FAANG) prep plan: Phase 1 in daily detail, Phases 2–5 as week-by-week overview.
// Budget: Mon–Fri 90 min, Sat 180 min, Sun rest / catch-up.

const t = (text, ...lc) => ({ text, lc });
const LB = 'Abdul Bari';
const AM = 'AlgoMaster';

const day = (name, minutes, tasks) => ({ day: name, minutes, tasks });
const SUNDAY = day('Sun', 0, [t('Rest. Catch up only on unfinished tasks from this week, then write the weekly log summary.')]);

const PHASE_1_WEEKS = [
  {
    number: 1,
    title: 'Setup, data types, operators, strings, conditionals',
    goal: 'Compile and run Java from terminal + IntelliJ; write small programs using primitives, Strings and if/switch.',
    days: [
      day('Mon', 90, [
        t('Install JDK 21 (LTS) + IntelliJ IDEA Community. Verify `java -version` and `javac -version` in terminal.'),
        t(`${LB}: watch Introduction, Installing JDK/IDE and First Java Program sections.`),
        t('Write Hello.java; compile with `javac Hello.java` and run with `java Hello` from terminal, then run it in IntelliJ.'),
        t('Create GitHub repo `java-dsa-journey` with folder phase1/week1; commit Hello.java.'),
      ]),
      day('Tue', 90, [
        t(`${LB}: Data Types — variables, the 8 primitives (byte, short, int, long, float, double, char, boolean), literals.`),
        t('Write DataTypes.java printing MIN_VALUE/MAX_VALUE of every numeric wrapper (Integer.MAX_VALUE, Long.MAX_VALUE …).'),
        t('In your notes, write 3 differences between Java and TypeScript types (int vs number, char, static types at compile time).'),
      ]),
      day('Wed', 90, [
        t(`${LB}: type casting (widening vs narrowing) and arithmetic, increment/decrement, relational, logical operators.`),
        t('Write Casting.java proving: Integer.MAX_VALUE + 1 overflows, (int) 3.99 == 3, \'a\' + 1 == 98, 7 / 2 == 3 and 7 / 2.0 == 3.5.'),
      ]),
      day('Thu', 90, [
        t(`${LB}: bitwise (&, |, ^, ~) and shift (<<, >>, >>>) operators, ternary operator, operator precedence.`),
        t('Write Bits.java: even/odd using n & 1, multiply by 2 using <<, swap two ints using XOR, print Integer.toBinaryString(n).'),
      ]),
      day('Fri', 90, [
        t(`${LB}: String class and printing — length, charAt, substring, indexOf, equals vs ==, compareTo, toUpperCase, split, trim; printf / String.format; escape sequences.`),
        t('Write Strings.java: show "a" == new String("a") is false but .equals() is true; reverse a String with a for loop; count vowels.'),
      ]),
      day('Sat', 180, [
        t(`${LB}: Conditional Statements — if / else-if / nested if, switch (int, String, and arrow-style \`case X ->\`).`),
        t('Scanner input: read an int then a line; reproduce and fix the nextInt()/nextLine() leftover-newline bug.'),
        t('Write Grade.java (marks → grade using else-if) and DayName.java (1–7 → day name using switch).'),
        t('LeetCode in Java (loops are same as TS for now): 412, 1108, 709.', 'fizz-buzz', 'defanging-an-ip-address', 'to-lower-case'),
        t('Push week1 code; fill the daily log for every day this week.'),
      ]),
      SUNDAY,
    ],
  },
  {
    number: 2,
    title: 'Loops, arrays, methods',
    goal: 'Write loops, 1D/2D array manipulation and static helper methods without looking up syntax.',
    days: [
      day('Mon', 90, [
        t(`${LB}: Loops — while, do-while, for, break, continue.`),
        t('Write Loops.java: sum 1..n, count digits of n, check prime with a for loop up to sqrt(n).'),
        t('LeetCode 1342 in Java (≤ 20 min).', 'number-of-steps-to-reduce-a-number-to-zero'),
      ]),
      day('Tue', 90, [
        t(`${LB}: nested loops and labeled break/continue.`),
        t('Print 3 star patterns with nested loops: n×n square, right triangle, centered pyramid.'),
        t('LeetCode 1281 in Java.', 'subtract-the-product-and-sum-of-digits-of-an-integer'),
      ]),
      day('Wed', 90, [
        t(`${LB}: Arrays (1D) — declaration, new int[n], default values, .length, for-each, Arrays.toString, Arrays.sort, Arrays.fill.`),
        t('Write max, min, sum and in-place reverse of an int[] (two pointers).'),
        t('LeetCode 1480 in Java.', 'running-sum-of-1d-array'),
      ]),
      day('Thu', 90, [
        t(`${LB}: 2D arrays and jagged arrays.`),
        t('Write matrix transpose, row sums and column sums for an int[][].'),
        t('LeetCode 1672 in Java.', 'richest-customer-wealth'),
      ]),
      day('Fri', 90, [
        t(`${LB}: Methods — static methods, parameters, return types, method overloading.`),
        t('Prove pass-by-value: a method that reassigns an int param (no effect) vs one that modifies an int[] element (visible to caller).'),
        t('LeetCode 1929 in Java.', 'concatenation-of-array'),
      ]),
      day('Sat', 180, [
        t(`${LB}: varargs, command-line arguments, recursion basics (factorial, fibonacci, power).`),
        t('Write ArrayUtils.java with 5 static methods (max, min, reverse, contains, indexOf) and a main that tests each.'),
        t('LeetCode in Java: 1470, 1431, 66.', 'shuffle-the-array', 'kids-with-the-greatest-number-of-candies', 'plus-one'),
        t('Push week2 code; update the log.'),
      ]),
      SUNDAY,
    ],
  },
  {
    number: 3,
    title: 'OOP I — classes, constructors, encapsulation, inheritance, polymorphism',
    goal: 'Model small domains with classes; understand this/super, overriding and the Object class contract.',
    days: [
      day('Mon', 90, [
        t(`${LB}: OOP — classes & objects, fields, methods, \`new\`, reference vs object.`),
        t('Write BankAccount (owner, balance; deposit, withdraw, getBalance) and create 2 objects sharing one reference to see aliasing.'),
        t('LeetCode 771 in Java.', 'jewels-and-stones'),
      ]),
      day('Tue', 90, [
        t(`${LB}: Constructors — default, parameterized, overloading, this(...) chaining, the \`this\` keyword.`),
        t('Add 2 constructors to BankAccount; chain one to the other with this(...).'),
        t('LeetCode 58 in Java.', 'length-of-last-word'),
      ]),
      day('Wed', 90, [
        t(`${LB}: Encapsulation — private fields, getters/setters with validation; access modifiers (private, default, protected, public).`),
        t('Write the 4×4 access-modifier table (class / package / subclass / world) in notes from memory.'),
        t('LeetCode 1603 (class design) in Java.', 'design-parking-system'),
      ]),
      day('Thu', 90, [
        t(`${LB}: Inheritance — extends, super(...), super.method(), method overriding, @Override.`),
        t('Write SavingsAccount extends BankAccount with addInterest(); override toString().'),
        t('LeetCode 344 in Java.', 'reverse-string'),
      ]),
      day('Fri', 90, [
        t(`${LB}: Polymorphism — dynamic method dispatch, upcasting/downcasting, instanceof.`),
        t('Write a table in notes: overloading vs overriding (compile-time vs run-time, signature rules, return type rules).'),
        t('LeetCode 728 in Java.', 'self-dividing-numbers'),
      ]),
      day('Sat', 180, [
        t(`${LB}: Static and Final — static fields/methods/blocks, final variables/methods/classes. Object class: toString, equals, hashCode.`),
        t('Implement equals() and hashCode() for Point(x, y); prove HashSet dedupes two equal Points only when both are overridden.'),
        t('Mini project: Library catalog — Book, Member, Library classes with encapsulation + one inheritance (EBook extends Book).'),
        t('LeetCode 1656 in Java.', 'design-an-ordered-stream'),
        t('Push week3 code; update the log.'),
      ]),
      SUNDAY,
    ],
  },
  {
    number: 4,
    title: 'OOP II — abstract classes, interfaces, inner classes, packages, exceptions',
    goal: 'Choose abstract class vs interface correctly and handle / create exceptions idiomatically.',
    days: [
      day('Mon', 90, [
        t(`${LB}: Abstract classes and abstract methods.`),
        t('Write abstract Shape with area()/perimeter(); Circle and Rectangle subclasses; loop over Shape[] polymorphically.'),
        t('LeetCode 258 in Java.', 'add-digits'),
      ]),
      day('Tue', 90, [
        t(`${LB}: Interfaces — default and static methods, implementing multiple interfaces.`),
        t('Write interface Payable { double pay(); } implemented by Employee and Invoice; add an abstract-class-vs-interface table to notes.'),
        t('LeetCode 326 in Java.', 'power-of-three'),
      ]),
      day('Wed', 90, [
        t(`${LB}: Inner classes (member, static nested, local, anonymous) and Packages (package, import, access across packages).`),
        t('Move this week\'s code into packages `bank` and `shapes`; access a protected member from a subclass in another package.'),
        t('LeetCode 520 in Java.', 'detect-capital'),
      ]),
      day('Thu', 90, [
        t(`${LB}: Exception Handling — try/catch/finally, multiple catch, hierarchy (Throwable → Error / Exception → RuntimeException), checked vs unchecked.`),
        t('Trigger and catch ArithmeticException, ArrayIndexOutOfBoundsException, NullPointerException and NumberFormatException in one program.'),
        t('LeetCode 171 in Java.', 'excel-sheet-column-number'),
      ]),
      day('Fri', 90, [
        t(`${LB}: throw vs throws, custom exceptions, try-with-resources.`),
        t('Create InsufficientFundsException extends Exception; make BankAccount.withdraw throw it; handle it in main.'),
        t('LeetCode 1512 in Java.', 'number-of-good-pairs'),
      ]),
      day('Sat', 180, [
        t(`${LB}: java.lang essentials — wrapper classes, autoboxing/unboxing, Integer.parseInt, Character.isDigit/isLetter, String immutability, StringBuilder.`),
        t('Prove the Integer cache pitfall: Integer a = 128, b = 128; a == b is false, a.equals(b) is true.'),
        t('Rewrite string reversal with StringBuilder (append, insert, reverse, deleteCharAt, setCharAt); note why it beats += in loops.'),
        t('Mini project: console Student Grade Manager using an interface, an abstract class and a custom exception.'),
        t('Push week4 code; update the log.'),
      ]),
      SUNDAY,
    ],
  },
  {
    number: 5,
    title: 'Collections Framework + generics',
    goal: 'Pick the right collection for a job and know the Big-O of its core operations. Abdul Bari core sections finished.',
    days: [
      day('Mon', 90, [
        t(`${LB}: Generics basics — generic class Box<T>, generic methods, bounded types <T extends Comparable<T>>.`),
        t('Draw the hierarchy in notes: Iterable → Collection → List / Set / Queue(Deque); Map as a separate tree.'),
        t('LeetCode 217 in Java (HashSet).', 'contains-duplicate'),
      ]),
      day('Tue', 90, [
        t(`${LB}: List — ArrayList vs LinkedList, Iterator, ConcurrentModificationException and iterator.remove(), Collections.sort, List.of immutability.`),
        t('Reproduce a ConcurrentModificationException, then fix it with iterator.remove() and with removeIf().'),
        t('LeetCode 387 in Java (HashMap and then int[26]).', 'first-unique-character-in-a-string'),
      ]),
      day('Wed', 90, [
        t(`${LB}: Queue / Deque — ArrayDeque as stack (push/pop/peek) and queue (offer/poll/peek); why not java.util.Stack.`),
        t('LeetCode 682 (stack) and 933 (queue) in Java.', 'baseball-game', 'number-of-recent-calls'),
      ]),
      day('Thu', 90, [
        t(`${LB}: Set and Map — HashSet, LinkedHashSet, TreeSet; HashMap (getOrDefault, merge, putIfAbsent, entrySet loop), LinkedHashMap, TreeMap (floorKey, ceilingKey, firstKey, headMap).`),
        t('Write a word-frequency counter with HashMap.merge, then print it sorted by key with TreeMap.'),
        t('LeetCode 1365 in Java.', 'how-many-numbers-are-smaller-than-the-current-number'),
      ]),
      day('Fri', 90, [
        t(`${LB}: PriorityQueue (min-heap default, max-heap via Collections.reverseOrder()), Comparable vs Comparator.`),
        t('Write comparators 3 ways: anonymous class, lambda using Integer.compare (no a - b overflow), Comparator.comparing(...).thenComparing(...).'),
        t('LeetCode 1046 in Java.', 'last-stone-weight'),
      ]),
      day('Sat', 180, [
        t('Utilities: Arrays.sort(int[][] , comparator), Arrays.asList pitfalls, Collections.reverse / max / min / frequency.'),
        t('Write a Big-O cheat sheet in notes: add/get/remove/contains for ArrayList, LinkedList, ArrayDeque, HashMap, TreeMap, PriorityQueue.'),
        t('LeetCode in Java: 1636, 1122, 706.', 'sort-array-by-increasing-frequency', 'relative-sort-array', 'design-hashmap'),
        t('Checkpoint: mark Abdul Bari core sections (syntax, OOP, collections, exceptions) complete. Skip multithreading, IO, JDBC, GUI.'),
      ]),
      SUNDAY,
    ],
  },
  {
    number: 6,
    title: 'AlgoMaster — Java for DSA crash course + DSA Warmup start',
    goal: 'Translate Java knowledge into DSA idioms; build a one-page Java DSA cheat sheet.',
    days: [
      day('Mon', 90, [
        t(`${AM} Java for DSA: first chapters (setup, input/output, arrays & strings). List every API you had not used before.`),
      ]),
      day('Tue', 90, [
        t(`${AM} Java for DSA: StringBuilder, char arithmetic (c - 'a'), int[26] frequency arrays, Math helpers, Integer.MAX_VALUE sentinels, long overflow.`),
      ]),
      day('Wed', 90, [
        t(`${AM} Java for DSA: collections for DSA (ArrayList, HashMap, HashSet, ArrayDeque, PriorityQueue, TreeMap).`),
        t('Build the one-page "Java DSA cheat sheet" in your notes (declaration + 3 most-used methods per collection).'),
      ]),
      day('Thu', 90, [
        t(`${AM} Java for DSA: remaining chapters (sorting with comparators, custom objects in collections, recursion).`),
        t('Crash course finished — tick it off.'),
      ]),
      day('Fri', 90, [
        t(`${AM} DSA Warmup set: first 3 problems in listed order. Rule: 20-min cap → read solution → close it → re-code from scratch.`),
      ]),
      day('Sat', 180, [
        t(`${AM} DSA Warmup set: next 6 problems, same rule.`),
        t('Update the cheat sheet with any new idioms.'),
      ]),
      SUNDAY,
    ],
  },
  {
    number: 7,
    title: 'DSA Warmup finish + Phase 1 exit test',
    goal: 'Prove Java fluency under time pressure before starting Striver A2Z.',
    days: [
      day('Mon', 90, [t(`${AM} DSA Warmup set: next 4 problems.`)]),
      day('Tue', 90, [t(`${AM} DSA Warmup set: finish all remaining problems (spill over to Sunday if needed).`)]),
      day('Wed', 90, [t('Exit test block A — 20-min timer each, no hints, no syntax lookup: 383, 389, 202, 349.', 'ransom-note', 'find-the-difference', 'happy-number', 'intersection-of-two-arrays')]),
      day('Thu', 90, [t('Exit test block B: 977, 1051, 905, 290.', 'squares-of-a-sorted-array', 'height-checker', 'sort-array-by-parity', 'word-pattern')]),
      day('Fri', 90, [t('Exit test block C: 500, 345, 844, 1189.', 'keyboard-row', 'reverse-vowels-of-a-string', 'backspace-string-compare', 'maximum-number-of-balloons')]),
      day('Sat', 180, [
        t('Exit test block D: 1207, 1436, 2418, 1337.', 'unique-number-of-occurrences', 'destination-city', 'sort-the-people', 'the-k-weakest-rows-in-a-matrix'),
        t('Exit test block E: 21, 1920, 1002, 884.', 'merge-two-sorted-lists', 'build-array-from-permutation', 'find-common-characters', 'uncommon-words-from-two-sentences'),
        t('Written check (20 min): complete the Phase 1 exit checklist below and record your score in the log.'),
      ]),
      SUNDAY,
    ],
  },
];

const PHASE_2_TEMPLATE = [
  'Per pattern: watch one pattern video (Striver A2Z or NeetCode) → solve the ⚓ anchor problems with it and write the Java template + "how to recognise it" in the pattern\'s 📒 note → solve the rest alone.',
  'Mon–Fri (90 min): 10 min cold re-solve of one ⭐ problem (spaced: +1, +7, +30 days) → 60 min new problems (20 min alone, then a hint, solution only after 40 min, then re-code from scratch) → 20 min problem note.',
  'Sat (180 min): finish leftovers → re-solve 2 older problems from earlier patterns (mixed, no labels) → refresh the pattern notes.',
  'Sun: rest or catch-up only.',
  'Optional, outside the budget: once a week re-solve one anchor in TypeScript to keep TS as a backup interview language.',
];

const MAINTENANCE_TEMPLATE = [
  'Every weekday starts with 1 maintenance problem (25 min cap): re-solve a ⭐ Important or oldest-solved DSA Master Sheet problem cold, then log it.',
];

const PHASE_2_WEEKS = [
  [8, '1.1 Hashing — all 10', ['m1']],
  [9, '1.2 Array techniques (in-place, Kadane, matrix) — all 12', ['m1']],
  [10, '1.3 Prefix sum (4) + 1.4 Two pointers (7)', ['m1']],
  [11, '1.5 Sliding window — all 10', ['m1']],
  [12, '1.6 Strings (7) + Saturday: Part 1 revision of ⭐ problems', ['m1']],
  [13, '2.1 Sorting (3) + 2.2 Binary search on arrays problems 1–7', ['m2']],
  [14, '2.2 problems 8–11 + 2.3 Binary search on the answer (6)', ['m2']],
  [15, '3.1 Stack (6) + 3.2 Monotonic stack problems 1–4', ['m3']],
  [16, '3.2 Monotonic stack problems 5–9 + 4.1 Linked list problems 1–5', ['m3', 'm4']],
  [17, '4.1 Linked list problems 6–15', ['m4']],
  [18, 'Checkpoint 1: mixed timed practice across Parts 1–4 (re-solve 10 ⭐ + 5 unseen LeetCode Mediums, 30 min each)', ['m1']],
  [19, '5.1 Recursion & backtracking problems 1–7', ['m5']],
  [20, '5.1 problems 8–13 + 5.2 Bit manipulation problems 1–4', ['m5']],
  [21, '5.2 problems 5–7 + 6.1 Heap problems 1–5', ['m5', 'm6']],
  [22, '6.1 Heap problems 6–9 + 6.2 Intervals (6)', ['m6']],
  [23, '6.3 Greedy — all 8', ['m6']],
  [24, 'Checkpoint 2: mixed timed practice across Parts 1–6', ['m5']],
  [25, '7.1 Binary tree DFS problems 1–8', ['m7']],
  [26, '7.1 problems 9–14 + 7.2 Binary tree BFS problems 1–3', ['m7']],
  [27, '7.2 problems 4–7 + 7.3 BST (7)', ['m7']],
  [28, '7.4 Tries (4) + 8.1 Graph BFS/DFS problems 1–5', ['m7', 'm8']],
  [29, '8.1 problems 6–11 + 8.2 Topological sort (4)', ['m8']],
  [30, '8.3 Union-Find (6) + 8.4 Shortest paths problems 1–3', ['m8']],
  [31, '8.4 problems 4–6 + 8.5 MST & advanced (3)', ['m8']],
  [32, 'Checkpoint 3: mixed timed practice across Parts 1–8 (trees + graphs heavy)', ['m7']],
  [33, '9.1 1D DP (6) + 9.2 Grid DP problems 1–4', ['m9']],
  [34, '9.2 problems 5–7 + 9.3 Knapsack / subset DP (6)', ['m9']],
  [35, '9.4 DP on strings — all 9', ['m9']],
  [36, '9.5 Stocks (4) + 9.6 LIS (3) + 9.7 Partition DP (4)', ['m9']],
  [37, 'Part 10: Math (6) + KMP (2) + Saturday: Phase 2 exit test', ['m10']],
];

const PHASE_3_WEEKS = [
  [38, 'OOP recap in Java (encapsulation, abstraction, inheritance, polymorphism, composition over inheritance) + UML class diagram basics'],
  [39, 'SOLID (SRP, OCP, LSP, ISP, DIP) + DRY/KISS/YAGNI — code a violating and a fixed Java example for each'],
  [40, 'Creational patterns: Singleton (thread-safe), Factory Method, Abstract Factory, Builder, Prototype'],
  [41, 'Structural patterns: Adapter, Decorator, Facade, Proxy, Composite, Bridge, Flyweight'],
  [42, 'Behavioral patterns I: Strategy, Observer, Command, State, Template Method'],
  [43, 'Behavioral patterns II: Iterator, Chain of Responsibility, Mediator, Memento, Visitor + Java concurrency basics for LLD (synchronized, ReentrantLock, ConcurrentHashMap, ExecutorService)'],
  [44, 'LLD problems: Parking Lot, Tic-Tac-Toe'],
  [45, 'LLD problems: LRU Cache, Rate Limiter (token bucket + sliding window, thread-safe)'],
  [46, 'LLD problems: Elevator System, Vending Machine'],
  [47, 'LLD problems: Snake & Ladder / Library Management, Splitwise'],
  [48, 'LLD problems: Movie Ticket Booking, Logging framework / Pub-Sub + Phase 3 exit test'],
];

const PHASE_4_WEEKS = [
  [49, 'Vol 1 Ch 1 Scale From Zero to Millions of Users; Ch 2 Back-of-the-Envelope Estimation'],
  [50, 'Vol 1 Ch 3 A Framework for System Design Interviews; Ch 4 Design a Rate Limiter'],
  [51, 'Vol 1 Ch 5 Design Consistent Hashing; Ch 6 Design a Key-Value Store'],
  [52, 'Vol 1 Ch 7 Unique ID Generator in Distributed Systems; Ch 8 URL Shortener'],
  [53, 'Vol 1 Ch 9 Web Crawler; Ch 10 Notification System'],
  [54, 'Vol 1 Ch 11 News Feed System; Ch 12 Chat System'],
  [55, 'Vol 1 Ch 13 Search Autocomplete; Ch 14 YouTube'],
  [56, 'Vol 1 Ch 15 Google Drive; Ch 16 The Learning Continues + Saturday: redraw 3 random Vol 1 designs from blank'],
  [57, 'Vol 2 Ch 1 Proximity Service; Ch 2 Nearby Friends'],
  [58, 'Vol 2 Ch 3 Google Maps; Ch 4 Distributed Message Queue'],
  [59, 'Vol 2 Ch 5 Metrics Monitoring and Alerting; Ch 6 Ad Click Event Aggregation'],
  [60, 'Vol 2 Ch 7 Hotel Reservation System; Ch 8 Distributed Email Service'],
  [61, 'Vol 2 Ch 9 S3-like Object Storage; Ch 10 Real-time Gaming Leaderboard'],
  [62, 'Vol 2 Ch 11 Payment System; Ch 12 Digital Wallet'],
  [63, 'Vol 2 Ch 13 Stock Exchange + Phase 4 exit test'],
];

const PHASE_4_TEMPLATE = [
  'Mon: read chapter A (first half) · Tue: finish chapter A + 1-page notes · Wed: redraw chapter A from a blank page, then diff against the book.',
  'Thu: read chapter B (first half) · Fri: finish chapter B + notes · Sat: redraw chapter B from blank + list 3 things you missed.',
];

const PHASE_5_WEEKS = [
  [64, 'Microsoft 90-day list #1–10 (30-min timer) · STAR story 1: ERP platform · Sat: self-mock (coding)'],
  [65, 'Microsoft 90-day list #11–20 · STAR story 2: LLM orchestration system · Sat: Exponent/Pramp peer mock (coding)'],
  [66, 'Microsoft 90-day list #21–30 · STAR story 3: Redis rate limiter · Sat: self-mock (system design)'],
  [67, 'Microsoft 90-day list #31–40 · STAR story 4: conflict / disagreement (from ERP or LLM project) · Sat: peer mock (system design)'],
  [68, 'Microsoft 90-day list #41–50 · STAR story 5: failure / mistake and what you changed · Sat: self-mock (LLD)'],
  [69, 'Microsoft 90-day list #51–60 · rehearse all 5 stories aloud (≤ 2.5 min each) · Sat: peer mock (behavioral)'],
  [70, 'Microsoft 90-day list #61–70 · Sat: full self-mock loop (2 coding + 1 SD + 1 behavioral)'],
  [71, 'Microsoft 90-day list #71–80 (continue at 10/week if the list is longer) · Sat: peer mock + Phase 5 exit test'],
];

const PHASE_5_TEMPLATE = [
  'Mon–Fri: 1 maintenance problem (25 min) + 2 Microsoft 90-day problems (30-min hard timer each) and a 10-min post-mortem note.',
  'Sat: 1 mock (Exponent/Pramp free tier ~every other week, self-mock the other weeks) + 45 min STAR story writing/rehearsal.',
];

const overview = (rows, phaseId) =>
  rows.map(([week, focus, striverSteps]) => ({ id: `${phaseId}-w${week}`, number: week, focus, striverSteps: striverSteps || [] }));

export const PREP_PLAN = [
  {
    id: 'p1',
    title: 'Phase 1 — Java fundamentals',
    range: 'Weeks 1–7',
    resources: [
      { label: "Abdul Bari — Learn JAVA Programming (Udemy)", note: 'Core only: syntax, OOP, collections, exceptions. Section names may differ slightly; follow the course order.' },
      { label: 'AlgoMaster.io — Java for DSA crash course + DSA Warmup set', url: 'https://algomaster.io/' },
    ],
    weeks: PHASE_1_WEEKS.map((w) => ({ ...w, id: `p1-w${w.number}` })),
    exitTest: [
      '≥ 16 of the 20 exit-test problems (Week 7) Accepted in Java within 20 min each — no solutions, no syntax lookup.',
      'From a blank file in ≤ 15 min: abstract class + interface + 2 subclasses with overriding + a custom checked exception, compiling first time.',
      'Explain aloud without notes: equals/hashCode contract, == vs equals (String and Integer), checked vs unchecked exceptions.',
      'State Big-O for ArrayList vs LinkedList get/add/remove and HashMap vs TreeMap get/put without notes.',
      'Write from memory: HashMap.getOrDefault/merge, ArrayDeque push/pop/offer/poll, PriorityQueue with a comparator, Arrays.sort(int[][]) by first column, StringBuilder.reverse().',
      'If you fail any item: redo that week\'s Saturday block, retest the failed items next week. Do not start Phase 2 until all pass.',
    ],
  },
  {
    id: 'p2',
    title: 'Phase 2 — DSA: DSA Master Sheet (NeetCode 150 + Striver, pattern-wise)',
    range: 'Weeks 8–37',
    resources: [
      { label: 'DSA Master Sheet (in this platform)', route: '/dsa-sheet' },
      { label: "Striver's A2Z playlist (pattern videos)", url: 'https://takeuforward.org/strivers-a2z-dsa-course/strivers-a2z-dsa-course-sheet-2' },
      { label: 'NeetCode video solutions', url: 'https://neetcode.io/' },
    ],
    template: PHASE_2_TEMPLATE,
    overview: overview(PHASE_2_WEEKS, 'p2'),
    exitTest: [
      'Solve 3 unseen Medium problems (e.g. LeetCode Microsoft tag) in ≤ 30 min each with optimal complexity — at least 2 of 3.',
      'Solve 1 unseen Hard in 45 min with at least a correct brute force and an accurate complexity analysis.',
      'Re-solve 15 random ⚓ anchor / ⭐ Important problems cold — at least 12 correct in ≤ 25 min each.',
      'For each pattern section in the sheet, write its Java template from memory and explain when to use it in ≤ 2 min.',
    ],
  },
  {
    id: 'p3',
    title: 'Phase 3 — LLD (AlgoMaster.io, all in Java)',
    range: 'Weeks 38–48',
    resources: [{ label: 'AlgoMaster.io LLD section', url: 'https://algomaster.io/' }],
    template: MAINTENANCE_TEMPLATE.concat([
      'Pattern weeks: 1 pattern per weekday session (read → code a Java example from scratch → note when NOT to use it); Sat: the remaining patterns + a mini design using 2 of them.',
      'Problem weeks: problem A Mon–Wed (requirements → class diagram → Java code → tests), problem B Thu–Sat.',
    ]),
    overview: overview(PHASE_3_WEEKS, 'p3'),
    exitTest: [
      'Design + code an unseen LLD problem (e.g. Hotel Booking) in Java in 60 min: class diagram, 2+ justified patterns, SOLID-compliant, thread-safe where needed.',
      'Code from memory: thread-safe Singleton, Factory, Builder, Strategy, Observer, Decorator, State.',
      'Explain each SOLID principle with a violating and a fixed example.',
    ],
  },
  {
    id: 'p4',
    title: 'Phase 4 — System design (Alex Xu Vol 1, then Vol 2)',
    range: 'Weeks 49–63',
    resources: [{ label: 'System Design Interview — An Insider\'s Guide, Vol 1 & Vol 2 (Alex Xu)' }],
    template: MAINTENANCE_TEMPLATE.concat(PHASE_4_TEMPLATE),
    overview: overview(PHASE_4_WEEKS, 'p4'),
    exitTest: [
      'Unseen prompt (e.g. "Design Ticketmaster") in 45 min: requirements, estimates, API, data model, high-level diagram, 2 deep dives, bottlenecks.',
      'Redraw any 5 book designs from a blank page in ≤ 20 min each.',
      'Back-of-the-envelope QPS + storage estimate for a new system in ≤ 5 min.',
    ],
  },
  {
    id: 'p5',
    title: 'Phase 5 — Company practice, mocks, behavioral',
    range: 'Weeks 64–71',
    resources: [
      { label: 'liquidslr/leetcode-company-wise-problems — Microsoft, 90-day list', url: 'https://github.com/liquidslr/leetcode-company-wise-problems' },
      { label: 'Exponent / Pramp free-tier peer mocks (~1 per week)' },
      { label: 'Mock interviews in this platform (DSA, System Design, LLD, Loop)', route: '/' },
    ],
    template: MAINTENANCE_TEMPLATE.concat(PHASE_5_TEMPLATE),
    overview: overview(PHASE_5_WEEKS, 'p5'),
    exitTest: [
      'Last 20 Microsoft 90-day problems: ≥ 75% solved inside 30 min.',
      '3 consecutive mocks with hire / strong-hire feedback.',
      'All 5 STAR stories delivered in ≤ 2.5 min each, each with a measurable result.',
    ],
  },
];

export const TOTAL_WEEKS = 71;

export const DURATION_VERDICT = [
  'Realistic total: ~71 weeks (~16–17 months) at 10.5 h/week: Java 7 wk · DSA 30 wk · LLD 11 wk · System design 15 wk · Company practice 8 wk.',
  'DSA uses the DSA Master Sheet: 252 must-solve LeetCode problems (all of NeetCode 150 + 102 Striver must-dos), pattern by pattern with 3 checkpoint weeks. That is 14 weeks shorter than the full Striver A2Z.',
  'Verdict: 10–12 h/week is enough to finish every phase properly. If you want to be interview-ready in ~12 months, raise to ~15 h/week (e.g. 2 h weekdays + 5 h Saturday) — the phase order stays the same, only the weeks shrink.',
  'Language: Java for all DSA and LLD. Your day job keeps TS sharp; optional extra (outside the budget) is 1 anchor re-solve per week in TS plus TS/Node depth topics (event loop, advanced types, streams).',
  'Biggest risk is slippage: if the tracker shows you are > 5 tasks behind for 2 weeks in a row, ask for a replan instead of silently skipping.',
];

export const DAILY_LOG_TEMPLATE = `DATE: YYYY-MM-DD (Day) | Week __ / Day __
PHASE: __ – ____________
PLANNED:
  [ ] task 1
  [ ] task 2
DONE:
  [x] ...
TIME SPENT: ___ min (budget: 90 weekday / 180 Sat)
STATUS: done | partial | not-done
PROBLEMS (Title – Accepted? – minutes – needed hint?):
  - 
BLOCKERS / WHAT CONFUSED ME:
FIRST TASK TOMORROW:`;

export const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function taskKey(weekId, dayName, index) {
  return `task:${weekId}-${dayName.toLowerCase()}-${index}`;
}
