import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { WALL_MARKS_SCRIPT, wallMarks } from "@/components/library/wall-marks";

// Runs the head script against a stand-in document and returns the marks it set on <html>.
function runScript(cookie: string, pathname: string, search: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const documentElement = { setAttribute: (name: string, value: string) => (attributes[name] = value) };
  runInNewContext(WALL_MARKS_SCRIPT, { document: { cookie, documentElement }, location: { pathname, search }, URLSearchParams });
  return attributes;
}

const CASES: [string, string, string][] = [
  ["", "/", ""],
  ["kb_layout=list", "/", "?tab=watching"],
  ["tz=Asia%2FKolkata; kb_layout=3", "/", "?tab=watched&kind=movie"],
  ["kb_layout=4; other=1", "/", "?kind=series"],
  ["kb_layout=%3Cimg%3E", "/", "?tab=%3Cscript%3E&kind=__proto__"],
  ["kb_layout=constructor", "/", "?tab=watching&tab=dropped"],
  ["xkb_layout=list", "/", "?tab=toString"],
  ["kb_layout=2", "/entry/abc", "?tab=watching"],
];

describe("wall marks", () => {
  it.each(CASES)("the head script and wallMarks agree for %j %j %j", (cookie, pathname, search) => {
    expect(runScript(cookie, pathname, search)).toEqual(wallMarks(cookie, pathname, search));
  });

  it("reads the saved layout, the tab and the kind on the Library", () => {
    expect(wallMarks("kb_layout=list", "/", "?tab=watching&kind=series")).toEqual({
      "data-wall-layout": "list",
      "data-wall-tab": "watching",
      "data-wall-kind": "series",
    });
  });

  it("falls back to the defaults for anything outside the allow-lists", () => {
    expect(wallMarks("kb_layout=%3Cimg%3E", "/", "?tab=%3Cscript%3E&kind=__proto__")).toEqual({
      "data-wall-layout": "auto",
      "data-wall-tab": "to_watch",
      "data-wall-kind": "all",
    });
    expect(wallMarks("", "/", "?tab=watching&tab=dropped")["data-wall-tab"]).toBe("to_watch");
  });

  it("marks only the layout away from the Library", () => {
    expect(wallMarks("kb_layout=3", "/entry/abc", "?tab=watching")).toEqual({ "data-wall-layout": "3" });
  });
});
