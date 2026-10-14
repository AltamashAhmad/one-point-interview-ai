// The study list, in learning order. A topic is "ready" when content/notes/topics/<id>.md exists;
// every other topic shows as "coming soon", so notes can be written one topic at a time.

export const NOTES_TRACKS = [
  {
    id: 'data-structures',
    icon: 'box',
    accent: '#3b82f6',
    title: 'Data Structures',
    tagline: 'How each structure is stored in memory, every operation and its cost, and when to reach for it.',
    groups: [
      {
        id: 'phase-0',
        title: 'Phase 0 · Foundations',
        topics: [
          { id: 'big-o', title: 'Big-O: time & space complexity', summary: 'Best/average/worst case, amortized analysis' },
          { id: 'recursion', title: 'Recursion & the call stack', summary: 'How calls are stacked, base cases, recursion vs iteration' },
        ],
      },
      {
        id: 'phase-1',
        title: 'Phase 1 · Linear data structures',
        topics: [
          { id: 'array', title: 'Array', summary: 'Static vs dynamic array, insert, delete, search, access, resize, 2D arrays' },
          { id: 'string', title: 'String', summary: 'Immutability, concatenation cost, common operations, char arrays' },
          { id: 'linked-list', title: 'Linked list', summary: 'Singly, doubly, circular; insert/delete at head, tail, middle; reverse; find middle; detect cycle' },
          { id: 'stack', title: 'Stack', summary: 'Push, pop, peek; array and linked-list implementations' },
          { id: 'queue', title: 'Queue', summary: 'Enqueue, dequeue, circular queue' },
          { id: 'deque', title: 'Deque', summary: 'Operations at both ends' },
          { id: 'monotonic-stack-queue', title: 'Monotonic stack / monotonic queue', summary: 'Next greater element, sliding window maximum' },
        ],
      },
      {
        id: 'phase-2',
        title: 'Phase 2 · Hashing',
        topics: [
          { id: 'hash-map-set', title: 'Hash map / Hash set', summary: 'Hash functions, collisions (chaining, open addressing), load factor, resizing, insert/get/delete' },
        ],
      },
      {
        id: 'phase-3',
        title: 'Phase 3 · Trees',
        topics: [
          { id: 'binary-tree', title: 'Binary tree', summary: 'Terminology, traversals (inorder, preorder, postorder, level order), height, diameter' },
          { id: 'bst', title: 'Binary Search Tree', summary: 'Insert, search, delete, successor/predecessor, validate' },
          { id: 'heap-priority-queue', title: 'Heap / Priority queue', summary: 'Min-heap, max-heap, insert, extract, heapify, build heap' },
          { id: 'trie', title: 'Trie', summary: 'Insert, search, prefix search, delete' },
          { id: 'self-balancing-trees', title: 'Self-balancing trees (concept)', summary: 'AVL and Red-Black trees' },
          { id: 'segment-tree', title: 'Segment tree', summary: 'Build, range query, point/range update' },
          { id: 'fenwick-tree', title: 'Fenwick tree (BIT)', summary: 'Update, prefix query' },
        ],
      },
      {
        id: 'phase-4',
        title: 'Phase 4 · Graphs',
        topics: [
          { id: 'graph-representations', title: 'Graph representations', summary: 'Adjacency list, adjacency matrix, edge list; directed, undirected, weighted' },
          { id: 'union-find', title: 'Union-Find (DSU)', summary: 'Find, union, path compression, union by rank' },
        ],
      },
      {
        id: 'phase-5',
        title: 'Phase 5 · Combined structures',
        topics: [
          { id: 'lru-cache', title: 'LRU cache', summary: 'Hash map + doubly linked list' },
          { id: 'bitmask-bitset', title: 'Bitmask / bitset', summary: 'Sets as integers, subset enumeration' },
        ],
      },
    ],
  },
  {
    id: 'algorithms',
    icon: 'repeat',
    accent: '#8b5cf6',
    title: 'Algorithms',
    tagline: 'The techniques behind every interview problem: how each works, why it is correct, and what it costs.',
    groups: [
      {
        id: 'basic',
        title: 'Basic',
        topics: [
          { id: 'searching', title: 'Searching', summary: 'Linear search, binary search (including on the answer)' },
          { id: 'sorting', title: 'Sorting', summary: 'Bubble, selection, insertion, merge, quick, heap, counting, radix' },
          { id: 'quickselect', title: 'Quickselect', summary: 'K-th smallest element' },
        ],
      },
      {
        id: 'core-patterns',
        title: 'Core patterns',
        topics: [
          { id: 'two-pointers', title: 'Two pointers', summary: 'Opposite ends, fast/slow, partitioning' },
          { id: 'sliding-window', title: 'Sliding window', summary: 'Fixed and variable windows' },
          { id: 'prefix-sum-difference-array', title: 'Prefix sum & difference array', summary: 'Range sums, range updates' },
          { id: 'intervals', title: 'Interval problems', summary: 'Merge, insert, overlap' },
          { id: 'backtracking', title: 'Backtracking', summary: 'Subsets, permutations, combinations, N-Queens' },
          { id: 'divide-and-conquer', title: 'Divide and conquer', summary: 'Split, solve, combine' },
        ],
      },
      {
        id: 'graph-algorithms',
        title: 'Graph algorithms',
        topics: [
          { id: 'bfs', title: 'BFS', summary: 'Level-order exploration, shortest path in unweighted graphs' },
          { id: 'dfs', title: 'DFS', summary: 'Recursive and iterative traversal' },
          { id: 'multi-source-bfs', title: 'Multi-source BFS', summary: 'Rotting oranges, distance to nearest source' },
          { id: 'cycle-detection', title: 'Cycle detection', summary: 'Directed and undirected graphs' },
          { id: 'topological-sort', title: 'Topological sort', summary: "Kahn's algorithm, DFS-based" },
          { id: 'dijkstra', title: 'Dijkstra', summary: 'Single-source shortest path, non-negative weights' },
          { id: 'bellman-ford', title: 'Bellman-Ford', summary: 'Negative weights, negative cycles' },
          { id: 'mst', title: 'Minimum spanning tree', summary: 'Kruskal, Prim' },
          { id: 'floyd-warshall', title: 'Floyd-Warshall', summary: 'All-pairs shortest paths' },
          { id: 'bridges-articulation', title: 'Bridges & articulation points', summary: 'Tarjan' },
        ],
      },
      {
        id: 'dynamic-programming',
        title: 'Dynamic programming',
        topics: [
          { id: 'dp-basics', title: 'DP basics', summary: 'Memoization vs tabulation' },
          { id: 'dp-1d', title: '1D DP', summary: 'Climbing stairs, house robber, coin change, LIS, word break' },
          { id: 'dp-2d-grid', title: '2D / grid DP', summary: 'Paths, minimum path sum' },
          { id: 'dp-strings', title: 'String DP', summary: 'LCS, edit distance, palindromes' },
          { id: 'knapsack', title: 'Knapsack family', summary: '0/1, unbounded, subset sum' },
          { id: 'kadane', title: "Kadane's algorithm", summary: 'Maximum subarray' },
          { id: 'stock-problems', title: 'Stock buy/sell problems', summary: 'One transaction, k transactions, cooldown' },
          { id: 'interval-bitmask-dp', title: 'Interval DP & bitmask DP', summary: 'Later topics' },
        ],
      },
      {
        id: 'greedy',
        title: 'Greedy',
        topics: [
          { id: 'greedy', title: 'Greedy', summary: 'Interval scheduling, jump game, task scheduler, gas station' },
        ],
      },
      {
        id: 'string-algorithms',
        title: 'String algorithms',
        topics: [
          { id: 'kmp', title: 'KMP', summary: 'Prefix function, linear-time pattern matching' },
          { id: 'rabin-karp', title: 'Rabin-Karp', summary: 'Rolling hash' },
          { id: 'z-algorithm', title: 'Z-algorithm (optional)', summary: 'Z-array and pattern matching' },
        ],
      },
      {
        id: 'bits-and-misc',
        title: 'Bits and misc techniques',
        topics: [
          { id: 'bit-manipulation', title: 'Bit manipulation tricks', summary: 'XOR, set bits, power of two' },
          { id: 'floyd-cycle-detection', title: "Floyd's cycle detection", summary: 'Tortoise and hare' },
          { id: 'boyer-moore-voting', title: 'Boyer-Moore voting', summary: 'Majority element' },
          { id: 'dutch-national-flag', title: 'Dutch national flag', summary: 'Three-way partition' },
          { id: 'fisher-yates-shuffle', title: 'Fisher-Yates shuffle', summary: 'Unbiased random permutation' },
          { id: 'reservoir-sampling', title: 'Reservoir sampling', summary: 'Random sample from a stream' },
        ],
      },
    ],
  },
];

export function getTrack(trackId) {
  return NOTES_TRACKS.find((t) => t.id === trackId) || null;
}

export function trackTopics(track) {
  return track.groups.flatMap((g) => g.topics);
}

/** A topic with its neighbours in learning order, or null when the id is not in the track. */
export function findTopic(track, topicId) {
  const topics = trackTopics(track);
  const index = topics.findIndex((t) => t.id === topicId);
  if (index === -1) return null;
  const group = track.groups.find((g) => g.topics.some((t) => t.id === topicId));
  return {
    topic: topics[index],
    group,
    number: index + 1,
    total: topics.length,
    previous: topics[index - 1] || null,
    next: topics[index + 1] || null,
  };
}
