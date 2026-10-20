import { describe, expect, it } from "vitest";
import { createLimit } from "./limit";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// Lets every promise callback that is already queued run.
async function flush(): Promise<void> {
  for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();
}

describe("createLimit", () => {
  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53, "2" as unknown as number])(
    "rejects a max of %j with a RangeError",
    (max) => {
      expect(() => createLimit(max)).toThrow(RangeError);
    },
  );

  it("never runs more than max tasks at once", async () => {
    const limit = createLimit(3);
    let running = 0;
    let peak = 0;
    const gates = Array.from({ length: 8 }, () => deferred<void>());

    const results = gates.map((gate, index) =>
      limit(async () => {
        running += 1;
        peak = Math.max(peak, running);
        await gate.promise;
        running -= 1;
        return index;
      }),
    );

    await flush();
    expect(running).toBe(3);

    for (const gate of gates) {
      gate.resolve();
      await flush();
      expect(running).toBeLessThanOrEqual(3);
    }

    expect(peak).toBe(3);
    expect(await Promise.all(results)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("returns each result to the caller that asked for it", async () => {
    const limit = createLimit(2);
    const gates = [deferred<string>(), deferred<string>(), deferred<string>()];
    const results = gates.map((gate) => limit(() => gate.promise));

    // The tasks finish in a different order than they were called.
    gates[2]?.resolve("third");
    gates[1]?.resolve("second");
    gates[0]?.resolve("first");

    expect(await Promise.all(results)).toEqual(["first", "second", "third"]);
  });

  it("starts waiting tasks in call order", async () => {
    const limit = createLimit(1);
    const started: string[] = [];
    const gates = { a: deferred<void>(), b: deferred<void>(), c: deferred<void>(), d: deferred<void>() };
    const run = (name: keyof typeof gates) =>
      limit(() => {
        started.push(name);
        return gates[name].promise;
      });

    const all = [run("a"), run("b"), run("c")];
    await flush();
    expect(started).toEqual(["a"]);

    // The queued call runs right after the limiter learns that a finished and before b resumes.
    // A task called in that gap must still wait behind b and c.
    gates.a.resolve();
    queueMicrotask(() => all.push(run("d")));
    await flush();
    expect(started).toEqual(["a", "b"]);

    gates.b.resolve();
    await flush();
    gates.c.resolve();
    await flush();
    gates.d.resolve();
    await Promise.all(all);
    expect(started).toEqual(["a", "b", "c", "d"]);
  });

  it("starts a task at once when a slot is free", () => {
    const limit = createLimit(2);
    let started = false;
    void limit(async () => {
      started = true;
    });
    expect(started).toBe(true);
  });

  it("lets a rejected task free its slot and reject only its own promise", async () => {
    const limit = createLimit(1);
    const failure = new Error("boom");
    const first = limit(async () => {
      throw failure;
    });
    const second = limit(async () => "still runs");
    const third = limit(async () => "and so does this");

    await expect(first).rejects.toBe(failure);
    await expect(second).resolves.toBe("still runs");
    await expect(third).resolves.toBe("and so does this");
  });

  it("frees the slot when a task throws before it returns a promise", async () => {
    const limit = createLimit(1);
    const failure = new Error("sync");
    const first = limit(() => {
      throw failure;
    });
    const second = limit(async () => 2);

    await expect(first).rejects.toBe(failure);
    await expect(second).resolves.toBe(2);
  });

  it("with a max of 1 runs the tasks one after the other", async () => {
    const limit = createLimit(1);
    let running = 0;
    let peak = 0;
    const task = async () => {
      running += 1;
      peak = Math.max(peak, running);
      await Promise.resolve();
      running -= 1;
    };
    await Promise.all([limit(task), limit(task), limit(task), limit(task)]);
    expect(peak).toBe(1);
  });

  it("with a max above the task count runs everything at once", async () => {
    const limit = createLimit(10);
    const gate = deferred<void>();
    let running = 0;
    const results = Array.from({ length: 3 }, () =>
      limit(async () => {
        running += 1;
        await gate.promise;
      }),
    );
    await flush();
    expect(running).toBe(3);
    gate.resolve();
    await Promise.all(results);
  });
});
