import { afterEach, describe, expect, it, vi } from "vitest";
import { createRealTmdbClient, TmdbUnavailableError, type FetchLike } from "./real";

const TOKEN = "test-read-token-0123456789.abcdef";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// A fixed random value makes the jitter of a retry wait predictable: 0.75 of the plain backoff.
const FIXED_RANDOM = 0.5;

// Waiting is recorded instead of done, so no test pays for a retry delay.
function clientWith(handler: FetchLike, options: { random?: () => number } = {}) {
  const fetchMock = vi.fn<FetchLike>(handler);
  const sleep = vi.fn<(ms: number) => Promise<void>>(async () => undefined);
  const client = createRealTmdbClient({
    token: TOKEN,
    fetch: fetchMock,
    sleep,
    random: options.random ?? (() => FIXED_RANDOM),
  });
  return { client, fetchMock, sleep };
}

function tooManyRequests(retryAfter?: string): Response {
  return new Response("{}", {
    status: 429,
    headers: retryAfter === undefined ? {} : { "retry-after": retryAfter },
  });
}

// Answers the given responses in order, then repeats the last one.
function inOrder(...responses: Array<() => Response>): FetchLike {
  let call = 0;
  return async () => {
    const respond = responses[Math.min(call, responses.length - 1)];
    call += 1;
    if (!respond) throw new Error("no response given");
    return respond();
  };
}

const movieOk = () => jsonResponse({ id: 1, title: "A", release_date: "2000-01-01" });

function calledUrl(fetchMock: ReturnType<typeof vi.fn<FetchLike>>, call = 0): URL {
  const first = fetchMock.mock.calls[call];
  if (!first) throw new Error("fetch was not called");
  return new URL(first[0]);
}

function seasonsResponse(url: URL): Response {
  const body: Record<string, unknown> = { id: 1 };
  for (const key of (url.searchParams.get("append_to_response") ?? "").split(",")) {
    const number = Number(key.replace("season/", ""));
    // Season 99 stands for a Season TMDB does not have: its key is simply absent.
    if (number === 99) continue;
    body[key] = {
      season_number: number,
      name: `Season ${number}`,
      episodes: [
        { id: number * 100 + 2, season_number: number, episode_number: 2, name: "B", air_date: "2020-01-02" },
        { id: number * 100 + 1, season_number: number, episode_number: 1, name: "A", air_date: null },
      ],
    };
  }
  return jsonResponse(body);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createRealTmdbClient", () => {
  it.each([
    ["an empty token", ""],
    ["a token with a line break", `${TOKEN}\r\nX-Evil: 1`],
    ["a token with spaces", `Bearer ${TOKEN}`],
    ["a very short token", "abc"],
  ])("refuses %s with a fixed message that does not echo it", (_label, token) => {
    expect(() => createRealTmdbClient({ token })).toThrow(
      new Error("TMDB read token is missing or malformed"),
    );
  });
});

describe("searchMulti", () => {
  it("calls the search endpoint with the fixed base URL, parameters and headers", async () => {
    const { client, fetchMock } = clientWith(async () => jsonResponse({ results: [] }));
    await client.searchMulti("matrix");

    const url = calledUrl(fetchMock);
    expect(url.origin + url.pathname).toBe("https://api.themoviedb.org/3/search/multi");
    expect(url.searchParams.get("query")).toBe("matrix");
    expect(url.searchParams.get("include_adult")).toBe("false");
    expect(url.searchParams.get("language")).toBe("en-US");
    expect(url.searchParams.get("page")).toBe("1");

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe("GET");
    expect(init?.headers).toEqual({ Authorization: `Bearer ${TOKEN}`, Accept: "application/json" });
    expect(init?.redirect).toBe("error");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(url.toString()).not.toContain(TOKEN);
  });

  it("encodes user text so it can only be a query value", async () => {
    const { client, fetchMock } = clientWith(async () => jsonResponse({ results: [] }));
    const query = "Tom & Jerry #1 ?x=1 /../admin 😀";
    await client.searchMulti(query);

    const raw = fetchMock.mock.calls[0]?.[0] ?? "";
    const url = new URL(raw);
    expect(url.searchParams.get("query")).toBe(query);
    expect(url.pathname).toBe("/3/search/multi");
    expect(url.hash).toBe("");
    expect([...url.searchParams.keys()].sort()).toEqual(["include_adult", "language", "page", "query"]);
    expect(raw).toContain("%26");
    expect(raw).toContain("%23");
    expect(raw).not.toContain("#");
    expect(raw).not.toContain("😀");
  });

  it("trims the query and returns nothing, without a request, for an empty one", async () => {
    const { client, fetchMock } = clientWith(async () => jsonResponse({ results: [] }));
    expect(await client.searchMulti("")).toEqual([]);
    expect(await client.searchMulti("   \t\n")).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();

    await client.searchMulti("  dune  ");
    expect(calledUrl(fetchMock).searchParams.get("query")).toBe("dune");
  });

  it("caps the query at 100 characters without splitting an emoji", async () => {
    const { client, fetchMock } = clientWith(async () => jsonResponse({ results: [] }));
    await client.searchMulti("a".repeat(150));
    expect(calledUrl(fetchMock, 0).searchParams.get("query")).toBe("a".repeat(100));

    await client.searchMulti("😀".repeat(150));
    const sent = calledUrl(fetchMock, 1).searchParams.get("query") ?? "";
    expect(Array.from(sent)).toHaveLength(100);
    expect(sent).not.toContain("�");
  });

  it("keeps Movies and Series, maps tv to series and drops people", async () => {
    const { client } = clientWith(async () =>
      jsonResponse({
        page: 1,
        results: [
          { media_type: "person", id: 6384, name: "Keanu Reeves" },
          { media_type: "movie", id: 603, title: "The Matrix", release_date: "1999-03-31" },
          { media_type: "tv", id: 1396, name: "Breaking Bad", first_air_date: "2008-01-20" },
          { media_type: "tv", id: 2, name: "" },
        ],
      }),
    );
    const results = await client.searchMulti("x");
    expect(results.map((result) => [result.kind, result.tmdbId, result.year])).toEqual([
      ["movie", 603, 1999],
      ["series", 1396, 2008],
    ]);
  });

  it("treats a 404 from the search endpoint as unavailable, not as no results", async () => {
    const { client } = clientWith(async () => jsonResponse({}, 404));
    await expect(client.searchMulti("x")).rejects.toBeInstanceOf(TmdbUnavailableError);
  });
});

describe("getMovie and getSeries", () => {
  it("requests the movie path and maps the response", async () => {
    const { client, fetchMock } = clientWith(async () =>
      jsonResponse({ id: 27205, title: "Inception", release_date: "2010-07-15", runtime: 148 }),
    );
    const movie = await client.getMovie(27205);
    expect(movie).toMatchObject({ kind: "movie", tmdbId: 27205, name: "Inception", year: 2010 });
    const url = calledUrl(fetchMock);
    expect(url.pathname).toBe("/3/movie/27205");
    expect(url.searchParams.get("language")).toBe("en-US");
  });

  it("requests the tv path and maps the response", async () => {
    const { client, fetchMock } = clientWith(async () =>
      jsonResponse({
        id: 1396,
        name: "Breaking Bad",
        status: "Ended",
        seasons: [{ season_number: 0, name: "Specials", episode_count: 9 }],
        last_episode_to_air: { season_number: 5, episode_number: 16, air_date: "2013-09-29" },
      }),
    );
    const series = await client.getSeries(1396);
    expect(series).toMatchObject({ kind: "series", status: "Ended", nextEpisodeToAir: null });
    expect(series?.seasons[0]?.seasonNumber).toBe(0);
    expect(calledUrl(fetchMock).pathname).toBe("/3/tv/1396");
  });

  it("returns null on 404", async () => {
    const { client } = clientWith(async () => jsonResponse({ success: false, status_code: 34 }, 404));
    expect(await client.getMovie(1)).toBeNull();
    expect(await client.getSeries(1)).toBeNull();
  });
});

describe("getSeasons", () => {
  it("reads each season/N key from one appended request", async () => {
    const { client, fetchMock } = clientWith(async (input) => seasonsResponse(new URL(input)));
    const seasons = await client.getSeasons(1396, [2, 0, 1]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = calledUrl(fetchMock);
    expect(url.pathname).toBe("/3/tv/1396");
    expect(url.searchParams.get("append_to_response")).toBe("season/0,season/1,season/2");
    expect(seasons.map((season) => season.seasonNumber)).toEqual([0, 1, 2]);
    // Episodes come back in episode order even though TMDB sent them reversed.
    expect(seasons[1]?.episodes.map((episode) => episode.episodeNumber)).toEqual([1, 2]);
    expect(seasons[1]?.episodes[0]?.airDate).toBeNull();
  });

  it("asks once for a season requested twice", async () => {
    const { client, fetchMock } = clientWith(async (input) => seasonsResponse(new URL(input)));
    const seasons = await client.getSeasons(5, [1, 1, 2, 1]);
    expect(seasons.map((season) => season.seasonNumber)).toEqual([1, 2]);
    expect(calledUrl(fetchMock).searchParams.get("append_to_response")).toBe("season/1,season/2");
  });

  it("splits 25 seasons into requests of 20 and 5, sent in parallel", async () => {
    let inFlight = 0;
    let peak = 0;
    const { client, fetchMock } = clientWith(async (input) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return seasonsResponse(new URL(input));
    });
    const wanted = Array.from({ length: 25 }, (_, index) => index + 1);
    const seasons = await client.getSeasons(7, wanted);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const sizes = [0, 1].map(
      (call) => calledUrl(fetchMock, call).searchParams.get("append_to_response")?.split(",").length,
    );
    expect(sizes).toEqual([20, 5]);
    expect(peak).toBe(2);
    expect(seasons.map((season) => season.seasonNumber)).toEqual(wanted);
  });

  it("uses a single request for exactly 20 seasons", async () => {
    const { client, fetchMock } = clientWith(async (input) => seasonsResponse(new URL(input)));
    await client.getSeasons(7, Array.from({ length: 20 }, (_, index) => index));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("leaves out Seasons TMDB does not return", async () => {
    const { client } = clientWith(async (input) => seasonsResponse(new URL(input)));
    const seasons = await client.getSeasons(5, [1, 99]);
    expect(seasons.map((season) => season.seasonNumber)).toEqual([1]);
  });

  it("returns an empty list on 404 without failing", async () => {
    const { client } = clientWith(async () => jsonResponse({}, 404));
    expect(await client.getSeasons(5, [1, 2])).toEqual([]);
  });

  it("returns an empty list, without a request, when no season is asked for", async () => {
    const { client, fetchMock } = clientWith(async () => jsonResponse({}));
    expect(await client.getSeasons(5, [])).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails when TMDB returns a Season in the wrong shape", async () => {
    const { client } = clientWith(async () =>
      jsonResponse({ "season/1": { season_number: "one", episodes: "none" } }),
    );
    await expect(client.getSeasons(5, [1])).rejects.toBeInstanceOf(TmdbUnavailableError);
  });

  it("fails when one of several requests fails", async () => {
    let calls = 0;
    const { client } = clientWith(async (input) => {
      calls += 1;
      return calls === 2 ? jsonResponse({}, 500) : seasonsResponse(new URL(input));
    });
    const wanted = Array.from({ length: 25 }, (_, index) => index + 1);
    await expect(client.getSeasons(5, wanted)).rejects.toBeInstanceOf(TmdbUnavailableError);
  });
});

describe("429 retry", () => {
  it("retries a 429 and returns the answer of the next try", async () => {
    const { client, fetchMock, sleep } = clientWith(inOrder(() => tooManyRequests(), movieOk));
    expect(await client.getMovie(1)).toMatchObject({ kind: "movie", tmdbId: 1, releaseDate: "2000-01-01" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(calledUrl(fetchMock, 1).toString()).toBe(calledUrl(fetchMock, 0).toString());
  });

  it("succeeds on the third try after two 429s", async () => {
    const { client, fetchMock, sleep } = clientWith(
      inOrder(() => tooManyRequests(), () => tooManyRequests(), movieOk),
    );
    expect((await client.getMovie(1))?.name).toBe("A");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("gives up after the third 429 with the status and path, without a fourth try", async () => {
    const { client, fetchMock, sleep } = clientWith(async () => tooManyRequests());
    const error = await client.getMovie(1).then(
      () => null,
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(TmdbUnavailableError);
    expect((error as TmdbUnavailableError).status).toBe(429);
    expect((error as TmdbUnavailableError).path).toBe("/movie/1");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    // No wait after the last try: there is nothing left to wait for.
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["30 seconds, capped at 2 seconds", "30", 2000],
    ["2 seconds, exactly at the cap", "2", 2000],
    ["1 second", "1", 1000],
    ["0 seconds", "0", 0],
    ["a fraction of a second", "0.5", 500],
  ])("waits for Retry-After of %s", async (_label, header, expected) => {
    const { client, sleep } = clientWith(inOrder(() => tooManyRequests(header), movieOk));
    await client.getMovie(1);
    expect(sleep.mock.calls).toEqual([[expected]]);
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["text", "soon"],
    ["negative", "-5"],
    ["not finite", "Infinity"],
    ["a date", "Wed, 21 Oct 2026 07:28:00 GMT"],
    ["hexadecimal", "0x10"],
    ["a number with an exponent", "1e1"],
  ])("backs off with jitter when Retry-After is %s", async (_label, header) => {
    const { client, sleep } = clientWith(
      inOrder(() => tooManyRequests(header), () => tooManyRequests(header), movieOk),
      { random: () => 0.5 },
    );
    await client.getMovie(1);
    // 300 ms then 600 ms, each scaled by 0.5 + 0.5 * 0.5.
    expect(sleep.mock.calls).toEqual([[225], [450]]);
  });

  it("keeps the backoff within half to all of its plain value", async () => {
    for (const [random, expected] of [
      [0, [150, 300]],
      [0.999, [299.85, 599.7]],
    ] as const) {
      const { client, sleep } = clientWith(
        inOrder(() => tooManyRequests(), () => tooManyRequests(), movieOk),
        { random: () => random },
      );
      await client.getMovie(1);
      const waits = sleep.mock.calls.map(([ms]) => ms);
      expect(waits[0]).toBeCloseTo(expected[0], 5);
      expect(waits[1]).toBeCloseTo(expected[1], 5);
    }
  });

  it("uses Retry-After for one try and the backoff step of that try for the next", async () => {
    const { client, sleep } = clientWith(
      inOrder(() => tooManyRequests("1"), () => tooManyRequests(), movieOk),
    );
    await client.getMovie(1);
    expect(sleep.mock.calls).toEqual([[1000], [450]]);
  });

  it("retries a 429 on every endpoint", async () => {
    const search = clientWith(
      inOrder(() => tooManyRequests(), () => jsonResponse({ results: [] })),
    );
    expect(await search.client.searchMulti("x")).toEqual([]);
    expect(search.fetchMock).toHaveBeenCalledTimes(2);

    const series = clientWith(inOrder(() => tooManyRequests(), () => jsonResponse({ id: 1, name: "S" })));
    expect((await series.client.getSeries(1))?.name).toBe("S");
    expect(series.fetchMock).toHaveBeenCalledTimes(2);

    let seasonCalls = 0;
    const seasons = clientWith(async (input) => {
      seasonCalls += 1;
      return seasonCalls === 1 ? tooManyRequests() : seasonsResponse(new URL(input));
    });
    expect((await seasons.client.getSeasons(1, [1])).map((season) => season.seasonNumber)).toEqual([1]);
    expect(seasons.fetchMock).toHaveBeenCalledTimes(2);
  });

  it("cancels the body of a 429 before it waits", async () => {
    let cancelled = false;
    const body = () =>
      new Response(
        new ReadableStream({
          cancel() {
            cancelled = true;
          },
        }),
        { status: 429 },
      );
    const { client, sleep } = clientWith(inOrder(body, movieOk));
    let cancelledWhenWaiting: boolean | null = null;
    sleep.mockImplementation(async () => {
      cancelledWhenWaiting = cancelled;
    });
    await client.getMovie(1);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(cancelledWhenWaiting).toBe(true);
  });

  it("gives every try its own 8 second timeout", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const { client, fetchMock } = clientWith(
      inOrder(() => tooManyRequests(), () => tooManyRequests(), movieOk),
    );
    await client.getMovie(1);

    expect(timeout.mock.calls).toEqual([[8000], [8000], [8000]]);
    const signals = fetchMock.mock.calls.map((call) => call[1].signal);
    expect(new Set(signals).size).toBe(3);
  });

  it("does not retry a 500, other error statuses or a 404", async () => {
    for (const status of [500, 502, 503, 400, 401, 403]) {
      const { client, fetchMock, sleep } = clientWith(async () => jsonResponse({}, status));
      await expect(client.getMovie(1)).rejects.toMatchObject({ status });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(sleep).not.toHaveBeenCalled();
    }

    const missing = clientWith(async () => jsonResponse({}, 404));
    expect(await missing.client.getMovie(1)).toBeNull();
    expect(missing.fetchMock).toHaveBeenCalledTimes(1);
    expect(missing.sleep).not.toHaveBeenCalled();
  });

  it("does not retry a network failure or a body that is not JSON", async () => {
    const down = clientWith(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(down.client.getMovie(1)).rejects.toBeInstanceOf(TmdbUnavailableError);
    expect(down.fetchMock).toHaveBeenCalledTimes(1);
    expect(down.sleep).not.toHaveBeenCalled();

    const html = clientWith(async () => new Response("<html>blocked</html>", { status: 200 }));
    await expect(html.client.getMovie(1)).rejects.toBeInstanceOf(TmdbUnavailableError);
    expect(html.fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stops at a failure on a later try and reports that failure", async () => {
    const { client, fetchMock, sleep } = clientWith(
      inOrder(() => tooManyRequests(), () => jsonResponse({}, 503)),
    );
    await expect(client.getMovie(1)).rejects.toMatchObject({ status: 503, path: "/movie/1" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);

    let networkCalls = 0;
    const network = clientWith(async () => {
      networkCalls += 1;
      if (networkCalls === 1) return tooManyRequests();
      throw new TypeError("fetch failed");
    });
    await expect(network.client.getMovie(1)).rejects.toMatchObject({ status: null });
    expect(network.fetchMock).toHaveBeenCalledTimes(2);
  });

  describe("with the default sleep and random", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("waits on a real timer, scaled by Math.random", async () => {
      vi.useFakeTimers();
      vi.spyOn(Math, "random").mockReturnValue(0);
      const fetchMock = vi.fn<FetchLike>(inOrder(() => tooManyRequests(), movieOk));
      const client = createRealTmdbClient({ token: TOKEN, fetch: fetchMock });

      const pending = client.getMovie(1);
      await vi.advanceTimersByTimeAsync(149);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect((await pending)?.name).toBe("A");
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });
});

describe("errors", () => {
  it.each([429, 500, 502, 503, 400, 401, 403])("throws TmdbUnavailableError for status %i", async (status) => {
    const { client } = clientWith(async () => jsonResponse({ status_message: "nope" }, status));
    const error = await client.getMovie(1).then(
      () => null,
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(TmdbUnavailableError);
    expect((error as TmdbUnavailableError).status).toBe(status);
    expect((error as TmdbUnavailableError).path).toBe("/movie/1");
  });

  it("uses a generic message that carries no token, header or URL", async () => {
    const { client } = clientWith(async () => jsonResponse({}, 500));
    const error = (await client.getMovie(1).catch((caught: unknown) => caught)) as TmdbUnavailableError;
    expect(error.message).toBe("TMDB could not be reached");
    expect(JSON.stringify({ message: error.message, status: error.status, path: error.path })).not.toContain(
      TOKEN,
    );
  });

  it("wraps a network failure and keeps the cause for logs", async () => {
    const cause = new TypeError("fetch failed");
    const { client } = clientWith(async () => {
      throw cause;
    });
    const error = (await client.searchMulti("x").catch((caught: unknown) => caught)) as TmdbUnavailableError;
    expect(error).toBeInstanceOf(TmdbUnavailableError);
    expect(error.status).toBeNull();
    expect(error.cause).toBe(cause);
  });

  it("wraps a redirect refusal", async () => {
    const { client } = clientWith(async () => {
      throw new TypeError("fetch failed", { cause: new Error("unexpected redirect") });
    });
    await expect(client.getSeries(1)).rejects.toBeInstanceOf(TmdbUnavailableError);
  });

  it("gives each request an 8 second timeout and fails when it fires", async () => {
    const timeout = vi
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(AbortSignal.abort(new DOMException("The operation timed out", "TimeoutError")));
    const { client } = clientWith(async (_input, init) => {
      if (init.signal?.aborted) throw init.signal.reason;
      return jsonResponse({ results: [] });
    });

    await expect(client.searchMulti("x")).rejects.toBeInstanceOf(TmdbUnavailableError);
    expect(timeout).toHaveBeenCalledWith(8000);
  });

  it("fails when the body is not JSON", async () => {
    const { client } = clientWith(async () => new Response("<html>blocked</html>", { status: 200 }));
    await expect(client.getMovie(1)).rejects.toBeInstanceOf(TmdbUnavailableError);
  });

  it("fails when the body does not match the expected shape", async () => {
    const { client } = clientWith(async () => jsonResponse({ results: "nope" }));
    await expect(client.searchMulti("x")).rejects.toBeInstanceOf(TmdbUnavailableError);

    const movieClient = clientWith(async () => jsonResponse({ id: "1", title: 5 })).client;
    await expect(movieClient.getMovie(1)).rejects.toBeInstanceOf(TmdbUnavailableError);
  });
});

describe("id validation", () => {
  const bad = [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53, "1/../2" as unknown as number];

  it.each(bad)("getMovie and getSeries reject %j with a RangeError and no request", async (id) => {
    const { client, fetchMock } = clientWith(async () => jsonResponse({}));
    await expect(client.getMovie(id)).rejects.toBeInstanceOf(RangeError);
    await expect(client.getSeries(id)).rejects.toBeInstanceOf(RangeError);
    await expect(client.getSeasons(id, [1])).rejects.toBeInstanceOf(RangeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([-1, 1.5, Number.NaN, 2 ** 53])("getSeasons rejects season number %j", async (season) => {
    const { client, fetchMock } = clientWith(async () => jsonResponse({}));
    await expect(client.getSeasons(1, [1, season])).rejects.toBeInstanceOf(RangeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("getSeasons rejects an absurd number of Seasons", async () => {
    const { client, fetchMock } = clientWith(async () => jsonResponse({}));
    const many = Array.from({ length: 201 }, (_, index) => index);
    await expect(client.getSeasons(1, many)).rejects.toBeInstanceOf(RangeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
