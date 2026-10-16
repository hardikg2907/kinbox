import { describe, expect, it } from "vitest";
import { isPosterPath, posterUrl, type PosterSize } from "./images";

describe("posterUrl", () => {
  it("builds a sized TMDB image URL for a plain image path", () => {
    expect(posterUrl("/xlaY2zyzMfkhk0HSC5VUwzoZPU1.jpg", "w342")).toBe(
      "https://image.tmdb.org/t/p/w342/xlaY2zyzMfkhk0HSC5VUwzoZPU1.jpg",
    );
  });

  it.each<PosterSize>(["w92", "w185", "w342", "w500"])("accepts size %s", (size) => {
    expect(posterUrl("/a_b-C1.png", size)).toBe(`https://image.tmdb.org/t/p/${size}/a_b-C1.png`);
  });

  it.each(["jpg", "jpeg", "png", "webp"])("accepts the %s extension", (extension) => {
    expect(posterUrl(`/abc.${extension}`, "w92")).toBe(`https://image.tmdb.org/t/p/w92/abc.${extension}`);
  });

  it("returns null when there is no poster", () => {
    expect(posterUrl(null, "w185")).toBeNull();
  });

  it.each([
    ["path traversal", "/../../etc/passwd.jpg"],
    ["traversal inside the path", "/a/../b.jpg"],
    ["encoded traversal", "/%2e%2e/x.jpg"],
    ["absolute URL", "https://evil.example/x.jpg"],
    ["protocol-relative URL", "//evil.example/x.jpg"],
    ["query string", "/abc.jpg?width=9999"],
    ["fragment", "/abc.jpg#top"],
    ["no leading slash", "abc.jpg"],
    ["nested directory", "/dir/abc.jpg"],
    ["unknown extension", "/abc.gif"],
    ["no extension", "/abc"],
    ["empty name", "/.jpg"],
    ["whitespace", "/a b.jpg"],
    ["newline", "/abc.jpg\n"],
    ["empty string", ""],
    ["very long name", `/${"a".repeat(300)}.jpg`],
  ])("returns null for %s", (_label, path) => {
    expect(posterUrl(path, "w342")).toBeNull();
  });

  it("returns null for a size that is not on the allow-list", () => {
    expect(posterUrl("/abc.jpg", "original" as PosterSize)).toBeNull();
    expect(posterUrl("/abc.jpg", "../w92" as PosterSize)).toBeNull();
  });
});

describe("isPosterPath", () => {
  it("matches the same paths posterUrl accepts", () => {
    expect(isPosterPath("/abc.jpg")).toBe(true);
    expect(isPosterPath("/abc.jpg?x=1")).toBe(false);
  });
});
