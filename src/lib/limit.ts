/** Runs at most `max` tasks at once; later tasks wait their turn in call order. */
export function createLimit(max: number): <T>(task: () => Promise<T>) => Promise<T> {
  if (!Number.isSafeInteger(max) || max < 1) {
    throw new RangeError("max must be a positive integer");
  }

  let active = 0;
  const waiting: Array<() => void> = [];

  // A finished task passes its slot straight to the next waiter instead of freeing it. If the
  // slot were freed first, a task called in the gap before the waiter resumes would jump the queue.
  function release(): void {
    const next = waiting.shift();
    if (next) next();
    else active -= 1;
  }

  return async function limit<T>(task: () => Promise<T>): Promise<T> {
    if (active < max) {
      active += 1;
    } else {
      await new Promise<void>((resolve) => waiting.push(resolve));
    }
    try {
      return await task();
    } finally {
      release();
    }
  };
}
