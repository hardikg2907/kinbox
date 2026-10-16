import { afterEach, describe, expect, it, vi } from "vitest";
import { createRealTmdbClient, TmdbUnavailableError, type FetchLike } from "./real";

const TOKEN = "test-read-token-0123456789.abcdef";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function clientWith(handler: FetchLike) {
  const fetchMock = vi.fn<FetchLike>(handler);
  return { client: createRealTmdbClient({ token: TOKEN, fetch: fetchMock }), fetchMock };
}

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
