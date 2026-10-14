> **In one sentence:** An array is a block of **equal-sized slots stored side by side in memory**, so the computer can jump straight to any slot by arithmetic. That single fact explains everything about arrays: instant access, expensive insertion in the middle, and why they are the foundation of almost every other data structure.

## 1. What is an array?

An **array** is a collection of elements of the **same type** stored in **one continuous block of memory**, where each element is reached by its **index** (its position, counting from 0).

Think of a row of numbered lockers in a corridor:

- Every locker is the **same size**.
- They stand **directly next to each other** with no gaps.
- Each has a number: 0, 1, 2, ...
- If someone says "open locker 37", you do not check lockers 0 to 36 first. You know exactly where it is.

```java
int[] scores = {72, 85, 90, 64, 78};

System.out.println(scores[2]);   // 90   (third element, index 2)
scores[3] = 70;                  // overwrite the element at index 3
System.out.println(scores.length); // 5
```

**Vocabulary:**

| Term | Meaning |
|---|---|
| **Element** | One value stored in the array. |
| **Index** | The position of an element. In Java, C, C++, Python, JavaScript it starts at **0**. |
| **Length / size** | How many elements the array holds. |
| **Capacity** | How many slots have been reserved (matters for dynamic arrays, section 6). |
| **Contiguous** | Occupying one unbroken stretch of memory. |
| **Random access** | Reading any element directly by index, in constant time. |

## 2. How an array is stored in memory

### 2.1 Contiguous storage and the address formula

Computer memory is a huge numbered list of bytes. Each byte has an **address**. When you create an array, the system reserves one unbroken run of bytes big enough for all elements and remembers the address of the first one (the **base address**).

Suppose an `int` takes 4 bytes and the base address is 1000:

```text
         +------+------+------+------+------+
value:   |   7  |  12  |   5  |   9  |   3  |
         +------+------+------+------+------+
index:      0      1      2      3      4
address:   1000   1004   1008   1012   1016
```

To find the address of any element, the computer uses one formula:

```
address of a[i]  =  base address  +  i × (size of one element)
```

So `a[3]` is at `1000 + 3 × 4 = 1012`. That is **one multiplication and one addition**, no matter whether the array has 5 elements or 5 million. This is why array access is **O(1)**.

### 2.2 Why indexes start at 0

The index is really an **offset**: how many elements you skip from the start. The first element is 0 slots away from the base, so its index is 0. The formula `base + i × size` then works without any "minus 1" correction. This is a historical choice from C that nearly every language kept.

### 2.3 Why arrays are so fast in practice: cache locality

Reading from main memory is slow compared to the CPU. To hide this, the CPU loads memory in chunks called **cache lines** (typically 64 bytes, which is 16 `int`s). When you read `a[0]`, the neighbours `a[1]` to `a[15]` come along for free.

Because array elements are neighbours, **walking through an array in order is very fast**: most reads are served from the cache. Structures that scatter their pieces around memory, like linked lists, lose this advantage. In real programs this often makes an array several times faster than a linked list even when both are O(n).

### 2.4 The price of contiguity

The same property has two costs:

1. **The size is fixed.** The block was reserved for exactly `n` elements, and the memory right after it may already belong to something else. To grow, you must allocate a **new bigger block** and copy everything over.
2. **Inserting or deleting in the middle means shifting.** To keep the elements packed with no gaps, everything after the changed position has to move.

Keep those two costs in mind: the rest of this topic is about living with them.

## 3. Arrays in Java

```java
int[] a = new int[5];              // five ints, all set to 0
int[] b = {3, 1, 4, 1, 5};         // created with values
String[] names = new String[3];    // three references, all null
int[][] grid = new int[3][4];      // 3 rows, 4 columns (section 9)
```

**Key facts:**

- **Fixed length.** The length is set when the array is created and can never change. Read it with `a.length` (a field, not a method; `String` uses `length()` and lists use `size()`).
- **Default values.** A new array is filled automatically: `0` for numbers, `false` for `boolean`, `'\u0000'` for `char`, `null` for objects.
- **Bounds checking.** Java checks every access. Using an index outside `0` to `length - 1` throws `ArrayIndexOutOfBoundsException`. (C and C++ do not check, which causes silent memory corruption.)
- **Arrays are objects.** They live on the **heap**, and the variable holds a **reference** to them. Assigning `int[] c = b;` copies the reference, **not** the data, so `c` and `b` are the same array.

```java
int[] a = {1, 2, 3};
int[] b = a;          // same array, two names
b[0] = 99;
System.out.println(a[0]);      // 99
System.out.println(a == b);    // true: same object
```

### 3.1 Primitive arrays versus object arrays

| | `int[]` (primitives) | `String[]` / `Integer[]` (objects) |
|---|---|---|
| What the slots hold | the **values** themselves | **references** (pointers) to objects |
| Memory layout | values are contiguous | the references are contiguous, the objects are **scattered** on the heap |
| Cache behaviour | excellent | worse (each element is an extra jump) |
| Can hold `null` | no | yes |

This is why `int[]` is much faster and smaller than `Integer[]` or `ArrayList<Integer>`, and why competitive and performance-sensitive code prefers primitive arrays. An array object also carries a small header (roughly 16 bytes) that stores its type and length.

**Element sizes:** `byte` 1, `short` 2, `char` 2, `int` 4, `float` 4, `long` 8, `double` 8 bytes. A reference is usually 4 bytes (compressed pointers) or 8. Memory for an `int[n]` is about `4n` bytes plus the header.

## 4. Static versus dynamic arrays

| | **Static array** | **Dynamic array** |
|---|---|---|
| Size | fixed at creation | grows (and sometimes shrinks) automatically |
| Java | `int[]`, `String[]` | `ArrayList<T>` |
| C++ | `int a[10]`, `std::array` | `std::vector` |
| Python | (arrays module, NumPy) | `list` |
| JavaScript | typed arrays | regular `Array` |
| Add at the end | not possible once full | amortized **O(1)** |
| Memory | exactly what you asked for | extra spare capacity |

A **dynamic array** is not a new kind of memory. It is a **static array plus bookkeeping** (a `size` counter) that automatically allocates a bigger array and copies when it runs out of room. Section 6 builds one.

## 5. Core operations and their cost

Let `n` be the number of elements.

| Operation | Time | Why |
|---|---|---|
| **Access** `a[i]` | **O(1)** | address formula |
| **Update** `a[i] = x` | **O(1)** | same formula, then write |
| **Search** (unsorted) | **O(n)** | must look at elements one by one |
| **Search** (sorted, binary search) | **O(log n)** | halve the range each step |
| **Insert at the end** (dynamic array) | **O(1) amortized** | usually a plain write; occasionally a resize |
| **Insert at index i** | **O(n)** | shift everything after `i` to the right |
| **Insert at the front** | **O(n)** | shift **all** elements |
| **Delete at the end** | **O(1)** | just reduce `size` |
| **Delete at index i** | **O(n)** | shift everything after `i` to the left |
| **Delete at the front** | **O(n)** | shift **all** elements |
| **Traverse** | **O(n)** | visit each element once |

Space: the array itself is O(n). Access, update, and end operations use O(1) extra space.

### 5.1 Access and update: O(1)

```java
int x = a[i];     // read
a[i] = 42;        // write
```

### 5.2 Insert in the middle: shift right, starting from the back

Suppose the array has spare room and `size` valid elements. To insert `value` at `index`:

```java
void insert(int[] arr, int size, int index, int value) {
    // precondition: size < arr.length and 0 <= index <= size
    for (int i = size; i > index; i--) {
        arr[i] = arr[i - 1];        // shift right, going from the BACK
    }
    arr[index] = value;
}
```

Inserting `99` at index 1 into `[10, 20, 30, 40]` (capacity 5):

```text
start:        [10, 20, 30, 40, _ ]
shift 40:     [10, 20, 30, 40, 40]
shift 30:     [10, 20, 30, 30, 40]
shift 20:     [10, 20, 20, 30, 40]
write 99:     [10, 99, 20, 30, 40]
```

> ⚠️ **Shift in the right direction.** When moving elements right you must start from the **last** element. If you go left to right, each write destroys the value you still need to copy: the `20` keeps being copied forward and you end up with `[10, 99, 20, 20, 20]`, having lost `30` and `40`.

The worst case (insert at the front) moves all `n` elements, so it is **O(n)**. On average you move about half, which is still O(n).

### 5.3 Delete in the middle: shift left, starting from the front

```java
void delete(int[] arr, int size, int index) {
    // precondition: 0 <= index < size
    for (int i = index; i < size - 1; i++) {
        arr[i] = arr[i + 1];        // shift left, going from the FRONT
    }
    // the caller now treats size - 1 as the new size
}
```

Deleting index 1 from `[10, 99, 20, 30, 40]` gives `[10, 20, 30, 40, _]`. Deleting from the end needs no shifting at all, so it is O(1).

> **Direction rule:** shifting right → loop from the back. Shifting left → loop from the front. Or just use `System.arraycopy`, which handles overlapping ranges correctly and is implemented natively (very fast).

### 5.4 Searching

**Linear search** checks every element. It works on any array:

```java
int indexOf(int[] a, int target) {
    for (int i = 0; i < a.length; i++) {
        if (a[i] == target) return i;
    }
    return -1;                       // not found
}
```

Best case O(1) (first element), worst case O(n) (last or missing).

**Binary search** needs a **sorted** array and halves the search range each step:

```java
int binarySearch(int[] a, int target) {
    int lo = 0, hi = a.length - 1;
    while (lo <= hi) {
        int mid = lo + (hi - lo) / 2;      // NOT (lo + hi) / 2, which can overflow
        if (a[mid] == target) return mid;
        if (a[mid] < target) lo = mid + 1;
        else hi = mid - 1;
    }
    return -1;
}
```

O(log n) time, O(1) space. `(lo + hi) / 2` can overflow `int` when both indexes are near 2³⁰ or more, so always write `lo + (hi - lo) / 2`. Binary search has its own topic later; the point here is that **random access is what makes it possible**. It does not work on a linked list.

## 6. How a dynamic array works inside

### 6.1 Size versus capacity

A dynamic array keeps two numbers:

- **capacity**: the length of the underlying static array (how many slots are reserved),
- **size**: how many of those slots hold real elements.

```text
capacity = 8, size = 5
+----+----+----+----+----+---+---+---+
| 12 |  7 | 30 |  4 | 19 | _ | _ | _ |
+----+----+----+----+----+---+---+---+
   0    1    2    3    4    (spare room)
```

Adding at the end writes into the next free slot and increments `size`, which is O(1). When `size == capacity`, the array is **full**.

### 6.2 What happens when it is full

1. Allocate a new array with a **larger capacity** (usually a multiple of the old one).
2. **Copy** all `size` elements into it (O(n)).
3. Point the internal reference at the new array. The old one becomes garbage.
4. Write the new element.

Growth factors used in practice:

| Implementation | Growth |
|---|---|
| Java `ArrayList` | about **1.5×** (initial capacity 10, allocated on the first add) |
| C++ `std::vector` | 2× (GCC), 1.5× (MSVC) |
| Python `list` | about 1.125× (plus a small constant) |

**Why multiplying and not adding a fixed amount?** If the array grew by a constant (say +10), resizes would happen every 10 adds and each copy is O(n), giving O(n²) for `n` adds. Growing by a **factor** makes resizes rarer and rarer (the copies form a geometric series that sums to less than a constant times `n`), so `add` is **amortized O(1)**. The full proof is in the Big-O topic.

### 6.3 Building one from scratch

Writing this once makes the whole idea concrete, and interviewers do ask for it.

```java
import java.util.Arrays;

class IntList {
    private int[] data = new int[4];    // capacity
    private int size = 0;

    int size() { return size; }

    int get(int i) {
        checkIndex(i);
        return data[i];
    }

    void set(int i, int value) {
        checkIndex(i);
        data[i] = value;
    }

    void add(int value) {                       // amortized O(1)
        if (size == data.length) grow();
        data[size++] = value;
    }

    void add(int index, int value) {            // O(n)
        if (index < 0 || index > size) throw new IndexOutOfBoundsException("index " + index);
        if (size == data.length) grow();
        System.arraycopy(data, index, data, index + 1, size - index);   // shift right
        data[index] = value;
        size++;
    }

    int removeAt(int index) {                   // O(n)
        checkIndex(index);
        int removed = data[index];
        System.arraycopy(data, index + 1, data, index, size - index - 1);  // shift left
        size--;
        return removed;
    }

    private void grow() {
        data = Arrays.copyOf(data, data.length * 2);    // allocate bigger, copy: O(n)
    }

    private void checkIndex(int i) {
        if (i < 0 || i >= size) throw new IndexOutOfBoundsException("index " + i + ", size " + size);
    }
}
```

Notes worth saying out loud in an interview:

- `checkIndex` compares against **`size`**, not `data.length`. Slots beyond `size` are spare room, not real elements.
- `add(index, value)` allows `index == size` (that is just an append), but `get` does not.
- Shrinking is optional. Java's `ArrayList` never shrinks by itself (you can call `trimToSize()`), because shrinking and growing at the same boundary would cause **thrashing** (repeated resizing).

## 7. The toolbox: what Java gives you

### 7.1 `Arrays` utility class (for `int[]` and other arrays)

| Method | What it does | Time |
|---|---|---|
| `Arrays.toString(a)` | prints `[1, 2, 3]` | O(n) |
| `Arrays.deepToString(grid)` | prints a 2D array | O(total elements) |
| `Arrays.sort(a)` | sorts ascending | O(n log n) |
| `Arrays.sort(a, from, to)` | sorts a range | O(k log k) |
| `Arrays.fill(a, v)` | sets every slot to `v` | O(n) |
| `Arrays.copyOf(a, newLen)` | copy, padded with defaults or truncated | O(newLen) |
| `Arrays.copyOfRange(a, from, to)` | copy of a slice | O(to - from) |
| `Arrays.equals(a, b)` | same length and same elements | O(n) |
| `Arrays.binarySearch(a, key)` | binary search on a **sorted** array | O(log n) |
| `Arrays.asList(T[]...)` | fixed-size list view of an object array | O(1) |
| `Arrays.stream(a)` | stream for sum, max, and so on | O(n) |
| `a.clone()` | shallow copy | O(n) |
| `System.arraycopy(src, sp, dst, dp, len)` | fast block copy, safe for overlap | O(len) |

Sorting note: for primitive arrays Java uses a dual-pivot quicksort; for object arrays it uses TimSort, which is **stable** (equal elements keep their order).

### 7.2 `ArrayList<T>` (Java's dynamic array)

| Method | Time | Note |
|---|---|---|
| `get(i)` / `set(i, x)` | O(1) | |
| `add(x)` | O(1) amortized | append |
| `add(i, x)` | O(n) | shifts right |
| `remove(i)` | O(n) | shifts left; O(1) if `i` is the last index |
| `remove(Object o)` | O(n) | search, then shift |
| `contains(x)` / `indexOf(x)` | O(n) | linear search |
| `size()` / `isEmpty()` | O(1) | |
| `clear()` | O(n) | nulls out the slots |
| `Collections.sort(list)` | O(n log n) | |
| `subList(a, b)` | O(1) | a **view**, not a copy |
| `new ArrayList<>(other)` | O(n) | copy |

`ArrayList<Integer>` boxes each `int` into an `Integer` object, so it uses several times more memory than `int[]` and is slower. When the size is known and the elements are primitives, prefer `int[]`.

## 8. In-place techniques you will use constantly

**In-place** means using O(1) extra space: you rearrange the array itself instead of building a new one. These four moves appear in dozens of interview problems.

### 8.1 Swap and reverse with two pointers

```java
void reverse(int[] a, int l, int r) {
    while (l < r) {
        int tmp = a[l];
        a[l] = a[r];
        a[r] = tmp;
        l++;
        r--;
    }
}
```

O(n) time, O(1) space. Two pointers start at opposite ends and move toward each other.

### 8.2 The read/write pointer (compacting)

Use one pointer to **read** every element and another to **write** the ones you keep. Remove duplicates from a sorted array:

```java
int removeDuplicates(int[] a) {
    if (a.length == 0) return 0;
    int write = 1;                                 // a[0] is always kept
    for (int read = 1; read < a.length; read++) {
        if (a[read] != a[write - 1]) {             // differs from the last kept value
            a[write++] = a[read];
        }
    }
    return write;                                  // the new length
}
```

`[1, 1, 2, 2, 3]` becomes `[1, 2, 3, ...]` and returns 3. O(n) time, O(1) space. The same pattern solves "move zeroes" and "remove element".

### 8.3 Rotate with three reversals

Rotate `[1, 2, 3, 4, 5, 6, 7]` right by `k = 3` to get `[5, 6, 7, 1, 2, 3, 4]`:

```java
void rotate(int[] a, int k) {
    int n = a.length;
    if (n == 0) return;
    k %= n;                       // k can be larger than n
    reverse(a, 0, n - 1);         // 7 6 5 4 3 2 1
    reverse(a, 0, k - 1);         // 5 6 7 4 3 2 1
    reverse(a, k, n - 1);         // 5 6 7 1 2 3 4
}
```

O(n) time and **O(1) space**. The simpler approach (copy into a new array at `(i + k) % n`) is also O(n) time but needs O(n) extra space.

### 8.4 Prefix sums: answer range queries instantly

If you will be asked for the sum of many ranges, precompute running totals once:

```java
int[] prefix = new int[a.length + 1];          // prefix[i] = sum of the first i elements
for (int i = 0; i < a.length; i++) {
    prefix[i + 1] = prefix[i] + a[i];
}
// sum of a[l..r] (inclusive) = prefix[r + 1] - prefix[l]     -> O(1) per query
```

Build cost O(n), each query O(1) instead of O(n). This idea gets its own topic later.

## 9. Two-dimensional arrays

A 2D array is a grid of rows and columns: a matrix, a game board, an image, a map.

```java
int[][] grid = new int[3][4];            // 3 rows, 4 columns, all zeros
int[][] m = {
    {1, 2, 3},
    {4, 5, 6},
};
int rows = m.length;                     // 2
int cols = m[0].length;                  // 3
m[1][2] = 60;                            // row 1, column 2
```

### 9.1 How it is really stored

In Java, a 2D array is an **array of arrays**: the outer array holds **references** to separate row arrays.

```text
grid --> [ ref0 | ref1 | ref2 ]
            |      |      |
            v      v      v
         [0,0,0,0] [0,0,0,0] [0,0,0,0]     <- each row is its own array
```

Consequences:

- Each **row** is contiguous, but different rows may sit in different places in memory.
- Rows can have **different lengths** (a "jagged" array): `int[][] tri = new int[3][]; tri[0] = new int[1]; tri[1] = new int[2];`
- Iterate **row by row** (outer loop over rows, inner loop over columns). That walks each row's memory in order and is cache friendly. Column-by-column is noticeably slower on large grids.

```java
for (int r = 0; r < rows; r++) {
    for (int c = 0; c < cols; c++) {
        process(grid[r][c]);          // row-major order: fast
    }
}
```

(C and C++ store a true 2D array as **one** contiguous block in **row-major** order, so cell `(r, c)` is at offset `r × cols + c`.)

**Cost:** an `rows × cols` grid uses O(rows × cols) space, and a full traversal is O(rows × cols) time. For a square `n × n` matrix that is O(n²).

### 9.2 Flattening: 2D coordinates and a single index

Sometimes you want one number per cell (for a hash key, a union-find, a queue):

```java
int id  = r * cols + c;        // (row, col) -> single index
int row = id / cols;           // single index -> row
int col = id % cols;           // single index -> column
```

### 9.3 Neighbours with a direction array

Almost every grid problem (flood fill, islands, shortest path) visits the 4 (or 8) neighbours of a cell. A direction array avoids four copies of the same code:

```java
int[][] dirs = {{-1, 0}, {1, 0}, {0, -1}, {0, 1}};    // up, down, left, right

for (int[] d : dirs) {
    int nr = r + d[0], nc = c + d[1];
    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {   // stay inside the grid
        visit(nr, nc);
    }
}
```

Always check the bounds **before** reading `grid[nr][nc]`.

### 9.4 Useful patterns in a matrix

- **Diagonals.** Cells on the same top-left-to-bottom-right diagonal share `r - c`. Cells on the same top-right-to-bottom-left anti-diagonal share `r + c`. An `R × C` grid has `R + C - 1` diagonals.
- **Transpose** (swap rows and columns) of a square matrix, in place:

```java
for (int i = 0; i < n; i++) {
    for (int j = i + 1; j < n; j++) {         // only the upper triangle, or you swap back
        int tmp = m[i][j];
        m[i][j] = m[j][i];
        m[j][i] = tmp;
    }
}
```

- **Rotate 90 degrees clockwise** = transpose, then reverse each row. (Counter-clockwise = transpose, then reverse each column, or reverse each row first and then transpose.)
- **Spiral order**: keep four boundaries (`top`, `bottom`, `left`, `right`), walk one side, shrink that boundary, repeat.

## 10. Java pitfalls that trip people up

| Pitfall | What happens | Fix |
|---|---|---|
| Index out of range | `ArrayIndexOutOfBoundsException` (loop `i <= a.length`, or `a[-1]`) | Valid indexes are `0` to `length - 1`. Loop with `i < a.length`. |
| `a == b` for arrays | compares **references**, not contents | `Arrays.equals(a, b)`; `Arrays.deepEquals` for 2D. |
| `int[] b = a;` | not a copy: both names refer to the same array | `a.clone()` or `Arrays.copyOf(a, a.length)`. |
| `clone()` on a 2D array | copies only the outer array; the **rows are shared** | Copy each row: `copy[i] = a[i].clone()`. |
| `Arrays.fill(grid, new int[m])` | every row is the **same** array object | Create a new row per iteration in a loop. |
| `Arrays.asList(int[])` | returns a list with **one element** (the whole array), because `int` is not an object | Use `Integer[]`, or a stream, or a loop. |
| `list.remove(i)` on `List<Integer>` | `remove(int index)` and `remove(Object)` are different overloads | `list.remove(Integer.valueOf(x))` to remove by value. |
| Removing while iterating | `ConcurrentModificationException` | Use `Iterator.remove()`, or `removeIf`, or iterate backwards by index. |
| Sum of large numbers | `int` overflow silently wraps around | Use `long` for sums and products. |
| `(lo + hi) / 2` | can overflow | `lo + (hi - lo) / 2`. |
| `Object[] o = new String[1]; o[0] = 1;` | `ArrayStoreException` (arrays are covariant and checked at run time) | Prefer generics and lists for mixed types. |
| Generic arrays | `new T[n]` does not compile | `(T[]) new Object[n]` with a cast, or use `ArrayList<T>`. |

Two examples of the sneakiest ones:

```java
int[][] grid = new int[3][3];
Arrays.fill(grid, new int[3]);       // BUG: one row object used three times
grid[0][0] = 5;
System.out.println(grid[2][0]);      // 5, not 0!
```

```java
int[] nums = {1, 2, 3};
List<int[]> wrong = Arrays.asList(nums);
System.out.println(wrong.size());    // 1, not 3
```

## 11. When to use an array

| Need | Best choice | Why |
|---|---|---|
| Read or write by position, very often | **Array** | O(1) access |
| Many appends, size unknown | **Dynamic array** (`ArrayList`) | amortized O(1) append |
| Frequent insert/delete at the front or the middle | linked list, deque, or a different structure | arrays shift O(n) elements |
| Fast lookup by **value** | hash set or hash map | O(1) average, arrays need O(n) |
| Keep elements **sorted** with frequent inserts | balanced tree or heap | arrays need O(n) per insert |
| Fixed, known size and numeric data | **primitive array** (`int[]`) | smallest and fastest |

Compared with a linked list: arrays win on access, memory per element, and cache speed; linked lists win only on inserting or deleting at a **known position** without shifting.

## 12. Arrays in interviews

**Questions to ask before coding:**

- Is the array **sorted**? (Unlocks binary search and two pointers.)
- Can there be **duplicates**? **Negative numbers**? **Zeros**?
- How large can `n` be? (Tells you whether O(n²) is acceptable.)
- Must I do it **in place** (O(1) extra space)? Can I modify the input?
- What should I return for an **empty** array?

**Edge cases to test every time:** empty array, one element, two elements, all elements equal, already sorted, reverse sorted, negative values, very large values (overflow), `k` larger than `n`.

**Typical toolbox for array problems:** sort first; hash map or set for lookups; two pointers; sliding window; prefix sums; in-place read/write pointers; binary search on sorted data.

**State costs clearly:** "Access is O(1). This solution makes one pass, so time is O(n), and it uses O(1) extra space because it works in place."

## 13. Practice: analyze and predict

Work these out before reading the answers.

**A.** What happens?

```java
int[] a = new int[5];
System.out.println(a[5]);
```

**B.** What is the total time to insert `n` elements one after another **at the front** of an `ArrayList`?

**C.** With base address 2000 and 4-byte `int`s, what is the address of `a[6]`?

**D.** What does this print?

```java
int[] a = {1, 2, 3};
int[] b = a;
b[0] = 99;
System.out.println(a[0] + " " + (a == b) + " " + Arrays.equals(a, new int[]{99, 2, 3}));
```

**E.** What is `grid[2][0]`, and why?

```java
int[][] grid = new int[3][3];
Arrays.fill(grid, new int[3]);
grid[0][0] = 5;
```

**F.** Compare two ways to rotate an array by `k`: (1) copy into a new array, (2) three reversals. Give time and extra space for each.

**G.** An `ArrayList` starts with capacity 10 and grows by 1.5×. Roughly how many resizes happen while adding 1,000,000 elements?

**H.** What does `Arrays.asList(new int[]{1, 2, 3}).size()` return?

### Answer key

- **A:** `ArrayIndexOutOfBoundsException`. The array has indexes 0 to 4.
- **B: O(n²).** The `k`-th insert shifts `k` elements, and `1 + 2 + ... + n = n(n+1)/2`. (Inserting at the end instead would be O(n) total.)
- **C: 2024.** `2000 + 6 × 4`.
- **D:** `99 true true`. `b` is the same array as `a`, so the write is visible through both, `==` compares the references, and `Arrays.equals` compares contents.
- **E: 5.** `Arrays.fill` puts the **same** row object in all three positions, so writing `grid[0][0]` changes every row. Fix it by creating each row separately in a loop.
- **F:** (1) O(n) time, O(n) extra space. (2) O(n) time, **O(1)** extra space.
- **G: about 30.** Capacity goes 10 → 15 → 22 → 33 ..., growing 1.5× each time, so about `log₁.₅(100,000) ≈ 28` to 30 resizes, not a million. That is why `add` is amortized O(1).
- **H: 1.** `int[]` is not an `Object[]`, so the whole array becomes a single element of a `List<int[]>`.

## 14. Practice problems (LeetCode)

For each one, say the brute-force idea first, then the better one, with time and space.

1. **Remove Duplicates from Sorted Array** (LeetCode 26, Easy). The read/write pointer from section 8.2.
2. **Merge Sorted Array** (LeetCode 88, Easy). Merge in place by filling from the **back**, so you never overwrite unread values.
3. **Rotate Array** (LeetCode 189, Medium). Do it three ways: extra array, repeated one-step rotation (too slow, explain why), and three reversals for O(1) space.
4. **Product of Array Except Self** (LeetCode 238, Medium). Without division, using a left-to-right pass and a right-to-left pass (prefix and suffix products).
5. **Rotate Image** (LeetCode 48, Medium). A 2D in-place problem: transpose then reverse each row.

## 15. Key takeaways

- An array is **contiguous memory with equal-size slots**. The formula `base + i × size` gives **O(1) access**, and sequential walks are very fast thanks to the CPU cache.
- The costs are **fixed size** and **shifting**: inserting or deleting anywhere except the end is **O(n)**.
- A **dynamic array** (`ArrayList`) is a static array plus a `size` counter that grows by a **factor** when full, which makes appending **amortized O(1)**.
- Java details that matter: fixed `length`, bounds checking, default values, arrays are **references** (so `=` does not copy), and primitive arrays are far more compact than object collections.
- 2D arrays in Java are **arrays of arrays**: iterate row by row, use a direction array for neighbours, and beware of `Arrays.fill` and `clone` sharing rows.
- The techniques to master: **two pointers**, the **read/write pointer**, **three-reversal rotation**, **prefix sums**, and **binary search on sorted data**.
- In an interview, ask whether the input is sorted, whether you may modify it, and how large `n` is, then state time **and** space.
