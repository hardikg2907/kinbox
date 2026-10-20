import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Listener = (event: PopStateEvent) => void;

// A window that keeps its popstate listeners in the order they were added.
function fakeWindow() {
  const listeners: Listener[] = [];
  return {
    listeners,
    addEventListener(type: string, listener: Listener) {
      if (type === "popstate") listeners.push(listener);
    },
  };
}

describe("history gate", () => {
  let win: ReturnType<typeof fakeWindow>;

  beforeEach(() => {
    win = fakeWindow();
    vi.stubGlobal("window", win);
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("adds one popstate listener however often its module runs, and that listener sees the latest hold", async () => {
    await import("./history-gate");
    vi.resetModules();
    const again = await import("./history-gate");
    expect(win.listeners).toHaveLength(1);

    const hold = vi.fn(() => true);
    again.holdHistoryMoves(hold);
    const event = { stopImmediatePropagation: vi.fn() } as unknown as PopStateEvent;
    win.listeners[0](event);
    expect(hold).toHaveBeenCalledWith(event);
    expect(event.stopImmediatePropagation).toHaveBeenCalledOnce();
  });

  it("lets a move through once the hold is cleared", async () => {
    const gate = await import("./history-gate");
    gate.holdHistoryMoves(() => true);
    gate.holdHistoryMoves(null);
    const event = { stopImmediatePropagation: vi.fn() } as unknown as PopStateEvent;
    win.listeners[0](event);
    expect(event.stopImmediatePropagation).not.toHaveBeenCalled();
  });
});
