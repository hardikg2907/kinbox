import { describe, expect, it } from "vitest";
import { NOTE_MAX_LENGTH, isNoteTooLong, normalizeNote } from "./note";

describe("normalizeNote", () => {
  it("keeps plain text as it is", () => {
    expect(normalizeNote("Great ending")).toBe("Great ending");
  });

  it("turns CRLF and CR into LF", () => {
    expect(normalizeNote("one\r\ntwo\rthree")).toBe("one\ntwo\nthree");
  });

  it("keeps inner line breaks and blank lines", () => {
    expect(normalizeNote("one\n\ntwo\n   \nthree")).toBe("one\n\ntwo\n   \nthree");
  });

  it("trims trailing whitespace and trailing blank lines", () => {
    expect(normalizeNote("one \t\n\n  \r\n\n")).toBe("one");
  });

  it("drops leading blank lines but keeps the first line's own indentation", () => {
    expect(normalizeNote("\n  \r\n\n   indented\nnext")).toBe("   indented\nnext");
  });

  it.each(["", "   ", "\n\n", "\r\n \t \r\n"])("turns %j into null", (text) => {
    expect(normalizeNote(text)).toBeNull();
  });

  it("copes with a very long run of whitespace", () => {
    expect(normalizeNote(`x${" ".repeat(200_000)}`)).toBe("x");
  });
});

describe("isNoteTooLong", () => {
  it("allows exactly the maximum", () => {
    expect(NOTE_MAX_LENGTH).toBe(1000);
    expect(isNoteTooLong("a".repeat(1000))).toBe(false);
  });

  it("rejects one over the maximum", () => {
    expect(isNoteTooLong("a".repeat(1001))).toBe(true);
  });

  it("counts an emoji as one character, like Postgres char_length", () => {
    expect(isNoteTooLong("😀".repeat(1000))).toBe(false);
    expect(isNoteTooLong("😀".repeat(1001))).toBe(true);
  });

  it("counts a combined emoji by its code points", () => {
    const family = "👨‍👩‍👧"; // three emoji joined by two zero-width joiners: 5 code points
    expect([...family]).toHaveLength(5);
    expect(isNoteTooLong(family.repeat(200))).toBe(false);
    expect(isNoteTooLong(family.repeat(201))).toBe(true);
  });

  it("rejects a huge text", () => {
    expect(isNoteTooLong("a".repeat(5_000_000))).toBe(true);
  });

  it("allows the empty text", () => {
    expect(isNoteTooLong("")).toBe(false);
  });
});
