export const NOTE_MAX_LENGTH = 1000;

// Plain string scans, no regex: the text comes from the browser and may be huge.
export function normalizeNote(text: string): string | null {
  const lines = text.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");
  const firstContentLine = lines.findIndex((line) => line.trim() !== "");
  if (firstContentLine < 0) return null;
  return lines.slice(firstContentLine).join("\n").trimEnd();
}

export function isNoteTooLong(text: string): boolean {
  // A code point takes one or two UTF-16 units, so the unit count bounds the
  // code point count and the common cases skip allocating a copy of a huge text.
  if (text.length <= NOTE_MAX_LENGTH) return false;
  if (text.length > NOTE_MAX_LENGTH * 2) return true;
  return [...text].length > NOTE_MAX_LENGTH;
}
