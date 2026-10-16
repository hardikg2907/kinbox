# Market voice: do real people share Kinbox's pain?

Researched 2026-10-08. Source for the ticket [Market voice research](../issues/14-market-voice-research.md).

Terms follow `CONTEXT.md`: Title, Movie, Series.

## Bottom line

| Pain | Verdict | Independent items | Note |
|---|---|---|---|
| 1. Movies and Series split across apps | **Strong** | about 15 direct | Newest evidence (2026). Letterboxd still has no Series logging. |
| 2. To-watch lists scattered | **Some** | about 10 | Notes-app use and "many sites" are real. No post about screenshots found. |
| 3. Trouble choosing tonight | **Some** | about 6 | General "what to watch" pain is clear. Few posts about choosing from one's own saved list. |
| 4. Losing your place in a Series | **Some** | about 8 | The need is real, and users one-star apps that fail at it. Almost nobody in 2023-2026 wrote "I lost my place". |

Two warnings for the owner:

- The gap in pain 1 may shrink. Letterboxd said on 2026-07-02 that Series tracking is "still in development". Sofa Time, Trakt, Simkl, Queuebrick and others already do both Movies and Series, and their users are often happy (see "Evidence against").
- Pains 2, 3 and 4 lean on posts from 2020-2022 and on indirect 2026 evidence. Each citation below carries its year.

## (a) Sources reached

| Source | Reached? | How much |
|---|---|---|
| Reddit | **No** | Zero posts. WebFetch and WebSearch both block reddit.com. Mirrors failed (arctic-shift timed out, pullpush returned HTTP 520, rl.klein.ruhr did not resolve, redlib returned HTTP 429). All the r/Letterboxd, r/TVTime, r/trakt and r/movies threads named in the brief are **not** in this evidence. |
| X / Twitter | **Partly** | Search surfaces posts as snippets. I read 8 user posts in full through `api.fxtwitter.com` (text, date, likes). Direct x.com fetch fails (HTTP 402). Replies, quote posts and threads were not reachable. Other X snippets I saw only in search summaries are left out. |
| Hacker News | Yes | Algolia API: 6 Show HN threads, 4 Ask HN or story threads, about 20 comments. Show HN threads for watchlist apps drew almost no comments. |
| App Store reviews | Yes, recent | iTunes review feed (newest 50) for Letterboxd, Serializd, Trakt, JustWatch, IMDb, Sofa Time, and 37 for Simkl. TV Time's feed is empty after the 2026-07-15 shutdown. The review pages on justuseapp.com give older, undated reviews for Letterboxd, TV Time, Trakt and JustWatch. |
| Forums | Yes | Quarter To Three (2020), MacPowerUsers (2024), Vivaldi forum (undated), Omni Group forum (2022), MacRumors comments (2026), AnandTech (2009, excluded from counts). |

**Quote rule.** The fetch tool shortened or paraphrased most long text. Text in quotation marks below came back word for word: tweets, short forum and HN lines, and App Store review titles. Anything else is my paraphrase and says so.

## (b) Per pain

### Pain 1: Movies and Series split across apps. Verdict: strong

**People who ask for one app, or say Letterboxd lacks Series**

- kevindern, MacPowerUsers, 2024-06-15. He tried Notion, Excel, Trakt, Letterboxd and Simkl. Letterboxd is "movies only", Simkl lacks Movies. "I'd like to have movies and tv shows in the same app." [thread](https://talk.macpowerusers.com/t/movie-and-tv-show-tracking/37539)
- vikrantsingh_au, same thread, 2024-06-15: "Letterboxd and Trakt are the two services I use for Movie and TV Show tracking." Two apps, by choice or habit.
- dustying, same thread, 2024-06-15: "I don't think there's one service that's the dominant one here." Uses Letterboxd plus JustWatch.
- Letterboxd App Store review "No tv show option", cock6969, 2026-09-15, 1 star. Paraphrase: frustrated that Series still are not supported after years. [feed](https://itunes.apple.com/us/rss/customerreviews/page=1/id=1054271011/sortby=mostrecent/json)
- Letterboxd review "Need to Add", mendezae, 2026-08-14, 4 stars. Paraphrase: would give 5 stars if Series could be saved. Uses IMDb only for tracking Series. Same feed.
- Letterboxd reviews on [justuseapp](https://justuseapp.com/en/app/1054271011/letterboxd/reviews) (undated): Some Freak5, "please add television."; @WatchingSquares, "why don’t they have tv shows for people to either review specific episodes"; RebelPup asks for Series and games.
- X, @letterboxd replies:
  - @NightWolfNym, 2024-11-08: "@letterboxd Any update on when tv shows are coming officially?" [post](https://x.com/NightWolfNym/status/1854880607265808823)
  - @americanreqiuem, 2024-11-19, 38 likes: "@letterboxd please tell me you're adding tv shows on letterboxd before the year ends" [post](https://twitter.com/bIuestfIame/status/1858680624519016706)
  - @FaisalDilaijan, 2024-08-31: "Letterboxd but for tv shows" [post](https://x.com/FaisalDilaijan/status/1829955059121029604)
  - @ughfinewhatever, 2026-02-21: "an app like letterboxd but specifically for tv shows called boxd set" [post](https://x.com/ughfinewhatever/status/2025114030352794016)
  - @FilmsdeLover, 2022-12-29 (French, my translation): asks for the best Letterboxd-style site to track the Series watched in a year, with a journal, a mobile app and stats. [post](https://x.com/FilmsdeLover/status/1608392554005016576)
  - @smuiux, 2023-09-29. Paraphrase: a Letterboxd user since 2023 hopes for "adding series to the mix". [post](https://x.com/smuiux/status/1707808235225493777)
- HN, Jcowell, 2024-07-22. Paraphrase: Apple's TV app lacks watch history, and he wants a Letterboxd-like one. [comment](https://news.ycombinator.com/item?id=41037781)
- HN, MikeDevLab, Show HN, 2026-03-28. He tried CineTrak, TV Time, Letterboxd and IMDb and "couldn't find the perfect app for my needs". [thread](https://news.ycombinator.com/item?id=47555624)

**Demand signal (not a user wish)**

- @aaronp613, 2026-07-02, 810 likes and 83 replies: "TV Time, one of my most used apps of all time, is shutting down in 2 weeks. I am not emotionally prepared for this! What is everyone switching to??" [post](https://x.com/aaronp613/status/2072637860608430135)
- The Letterboxd quote "We are still working on it" comes from a news account, @TheCinesthetic, 2026-07-02, 826 likes. That post says the quote answers the TV Time shutdown. [post](https://x.com/TheCinesthetic/status/2072716734411456949) Letterboxd was also up for sale in September 2026 (HN thread, 2026-09-25: [49849411](https://news.ycombinator.com/item?id=49849411), a user predicts "the enshittification of Letterboxd").

**Count:** about 15 direct posts from 12 or more different people. The pain is real and recent. The word "strong" applies to the pain, not to the size of the market.

### Pain 2: To-watch lists scattered. Verdict: some

- Charlatan, Quarter To Three, 2020-01-03, on Netflix "My List" and browser tabs: "I promptly either forget or get distracted by something else." He had about 20 open tabs. [thread](https://forum.quartertothree.com/t/tracking-movies-you-want-to-watch/145218)
- Same thread, 2020-01-03: Calelari, "I use OneNote for all my list- and note- making needs."; Graboonie, "I use Google Keep."; Canuck keeps Google Keep lists of books and movies. cornchip: "I have a really long list in Notes" but rarely opens it.
- i67vw3, HN Ask HN, 2022-07-27: "I watch shows from 10 different sites, so I note it down which show/movie I watched and till which episode." A notes app. [thread](https://news.ycombinator.com/item?id=32246650)
- wilsonng, Omni Group forum, 2022-06-03. Paraphrase: tracking Series by hand in OmniFocus was "a lot of manual work", so he moved to a Series app. [thread](https://discourse.omnigroup.com/t/watch-lists-for-tv-following-gtd/67344)
- josephj11, Vivaldi forum (undated). Paraphrase: keeps a text file for his schedule plus several apps, each covering only part of the need. [thread](https://forum.vivaldi.net/topic/71313/any-tv-and-movie-tracking-website-software-suggestions)
- fckgw, HN, 2026-07-22: "A shared watchlist across services would help." [comment](https://news.ycombinator.com/item?id=49009357) BryantD, same thread (2026-07-22), calls JustWatch useful for where a Title streams and Letterboxd's watchlist a "clunky unified watchlist". [root comment](https://news.ycombinator.com/item?id=49009100)
- bradydjohnson, HN, 2026-06-17. Paraphrase: wants a watchlist for recommended films that also shows the streaming service. [comment](https://news.ycombinator.com/item?id=48577510)
- JustWatch review "Hours saved!!", Andybobjoe, 2026-09-30. Paraphrase: a watchlist saves time compared with streaming home screens. [feed](https://itunes.apple.com/us/rss/customerreviews/page=1/id=979227482/sortby=mostrecent/json)
- Sofa Time review "Helps to keep track of multiple streaming apps", Harding mom, 2026-10-04. [feed](https://itunes.apple.com/us/rss/customerreviews/page=1/id=1491037404/sortby=mostrecent/json)
- LFO8, MacRumors comments, 2026-07: "I hate that on Apple TV a show disappears from your list when you have finished watching the last available episode." [article](https://macrumors.com/2026/07/02/show-tracking-app-tv-time-shutting-down)

**Screenshots:** I found no user post about saving Titles as screenshots. The Pain is not confirmed. (The map already lists screenshot reading as never planned.)

**Why "some":** the notes-app habit and "many sites" are clear but old or thin. Several people are happy with Keep or OneNote.

### Pain 3: Trouble choosing what to watch tonight. Verdict: some

User posts (not surveys):

- jones1618, HN, 2023-09-06: "Do you hate (I do) being in charge of "what to watch tonight" on streaming?" He wants a weekly schedule and movie nights built from a watchlist. [comment](https://news.ycombinator.com/item?id=37407147)
- rubb3rDucc, Show HN, 2026-01-12. He kept making watchlists but was "rarely watching anything". His own result: "So far, it's worked better than a watchlist." [thread](https://news.ycombinator.com/item?id=46587369)
- cornchip, Quarter To Three, 2020-01-03: the long Notes list goes unused because he wants something that is available now. See link in pain 2.
- WornStone, JustWatch review "I use it first", 2026-06-13. Paraphrase: checks it first when choosing what to watch. [feed](https://itunes.apple.com/us/rss/customerreviews/page=1/id=979227482/sortby=mostrecent/json)
- FrinkleFrankle, HN, 2025-02-16. Paraphrase: large libraries are hard to remember, so choosing with a group gets harder. [comment](https://news.ycombinator.com/item?id=43065112)
- zeroq (2025-06-29, [comment](https://news.ycombinator.com/item?id=44417509)) and properbrew (2025-10-20, [comment](https://news.ycombinator.com/item?id=45645941)) each built a small tool for "what to watch tonight" or "can't decide". They show effort, not a quote of pain.

Context only, not user voice: Letterboxd's own "Watchlist Shuffle" posts, for example [2024](https://x.com/letterboxd/status/1779540477622264170). Vendor-run surveys also say choosing takes long. I leave both out of the count.

**Gap:** most posts are about choosing across all streaming, not about choosing from one's own saved list. Kinbox's tonight filter is plausible, but the exact pain has few direct quotes.

### Pain 4: Losing your place in a Series. Verdict: some, with a date caveat

- Direct but old: Leros, AnandTech, 2009-07-26, "I forget which season I left off on." [thread](https://forums.anandtech.com/threads/looking-for-an-app-too-keep-track-of-the-tv-shows-i-watch.311209) Excluded from the count (2009).
- wilsonng, Omni Group forum, 2022-06-04. Paraphrase: uses an app "to remember what episode I left it at". [thread](https://discourse.omnigroup.com/t/watch-lists-for-tv-following-gtd/67344)
- i67vw3, HN, 2022-07-27: notes which Title and "till which episode". See pain 2.
- jmpval, Omni Group forum, 2022-06-08. Paraphrase: tracks progress in a Series app until the show ends.
- nomadic, Vivaldi forum (undated). Paraphrase: wants a Title to move from watchlist to "My Shows" automatically when watched.

2026 evidence is indirect. People depend on progress so much that they one-star apps that break it (App Store review titles, 2026):

- Serializd: "Has been unmarking episodes as watched" (nimoore13, 2026-10-02); "Issue with logging shows" (g-forceeeeeeeeeee, 2026-07-29); "lacking a necessary feature" (K review ss, 2026-05-10, wants marking one episode to mark all earlier ones); "Not a replacement for TV Time" (AlphaTechDeity, 2026-07-13, home page does not show Series being watched). [feed](https://itunes.apple.com/us/rss/customerreviews/page=1/id=1581244120/sortby=mostrecent/json)
- Trakt: "Bloated and Busy" (Dumpstermunk, 2026-07-25, hard to find the current episode and mark progress); "Updates not great" (the100thej, 2026-04-28, watched and unwatched episodes show the same checkmark). [feed](https://itunes.apple.com/us/rss/customerreviews/page=1/id=1514873602/sortby=mostrecent/json)
- Sofa Time: "Issue with saving progress" (cturner17, 2026-08-21, paid user, logged episodes vanish). Simkl: "Web app vs IOS app" (MikesBR42, 2026-07-02, wants to hide past episodes from the Next Watch list). [Sofa Time feed](https://itunes.apple.com/us/rss/customerreviews/page=1/id=1491037404/sortby=mostrecent/json), [Simkl feed](https://itunes.apple.com/us/rss/customerreviews/page=1/id=1229691035/sortby=mostrecent/json)

**Why "some":** the need is proven, and progress is where trackers fail most. But no 2023-2026 post says "I lose my place" in those words.

### Evidence against, or limits on, the pain

- Many people are content with one app that already covers both. Sofa Time: 38 of its 50 newest reviews are 5 stars, and several say they track Movies and Series there ("Best TV episode and movie tracker", DBStation, 2026-09-30). Trakt users also say it works for free (AbSoluTc, MacRumors comments, 2026-07).
- Some people use two apps on purpose: vikrantsingh_au (pain 1).
- Some use no tool and rely on memory. troymc, HN, 2022-07-27, and soueuls, HN, 2022-07-27: "I don't really keep track of it." [thread](https://news.ycombinator.com/item?id=32246650)
- Quarter To Three users were happy with Letterboxd, Keep or OneNote in 2020.
- A one-app tracker costs little to build: Queuebrick (Show HN, 2026-08-03), StarFlicks (2026-03-28), ReelsGraph (2026-06-30), Continuity (2026-07-06), Bingeboxd and Suite TV (X, 2026) all launched. Competition is real. These Show HN threads drew almost no user comments, so they say nothing on demand.

## (c) Other recurring pains

Counts come from the newest 50 reviews per app unless noted (my reading of each feed).

1. **Ads and pop-ups.** Letterboxd: about 10 of 50 (2026-08 to 2026-09), for example "Ad central", "Ads make the app unusable", "Unstoppable ads". IMDb: about 15 of 50. Serializd: 3. JustWatch: about 6. Titles are exact.
2. **Forced accounts.** IMDb: about 8 reviews about login for reviews (for example "I Don't Want to Make an Account", 2026-10-04). JustWatch: "Now requires email to use" (2026-08-01), "Account?" (2026-08-13).
3. **Paywalls and price.** Trakt: "newest update paywalls more features" (hanharr, 2026-09-04), "Money grubbing" (2026-05-07). Context from news sites, not users: Trakt cut free lists to 100 items and doubled VIP prices in 2025 ([Alternativeto](https://alternativeto.net/news/2025/2/trakt-tv-has-set-stricter-limits-for-free-users-and-raised-vip-subscription-prices-by-100-/)).
4. **Lost data and logouts.** Letterboxd: about 7 login or logout reviews, plus "Erased all movie reviews" (2026-08-31). Simkl: "Lost all my data" (2026-07-24). JustWatch: "Doesn't remember tracking" (2026-09-21). Trakt: "Removal of SIMKL's API makes the app unusable" (2026-09-21, lost watchlist). Serializd: more than 100 watchlist items missing (justuseapp, undated).
5. **Too many taps and clutter.** Letterboxd "Horrible streamline" (2026-10-03). mdmglr, HN, 2022-11-04: "The watchlist is hidden in the user profile icon on the bottom left." [thread](https://news.ycombinator.com/item?id=33459979) Trakt "Complicated and messy" (2026-07-04), "Deleted so fast" (2026-07-11: wanted simple watch tracking).
6. **Apps that die or change.** TV Time shut down on 2026-07-15. MacRumors commenters: Pamtos wants apps with "easy watchlist export features!"; HouseLannister left because "they started asking me to review every episode of a show when marking it as watched." [article](https://macrumors.com/2026/07/02/show-tracking-app-tv-time-shutting-down) Serializd review "I used to be a TvTime user" (2026-07-06) could not find an export.
7. **Web-wrapper apps.** Simkl's iOS app reviews (2022-2026): most features open the mobile browser, for example "Not much point to it" (2024-06-04). Relevant to a mobile-first web app: users accept web only when it feels native and fast.

## (d) Wished-for features, ranked

Counts are separate posts or reviews that ask for the item. "v1-relevant" means it touches decisions already on the map. Items on the out-of-scope list are marked "future" and not argued into v1.

| # | Feature | Posts | Tag | Evidence |
|---|---|---|---|---|
| 1 | Free, no ads, no forced account for basic use | about 40 | v1-relevant (product stance) | Letterboxd, IMDb, JustWatch, Trakt, Serializd reviews, 2026 |
| 2 | Movies and Series in one place | about 15 | v1-relevant (the product) | pain 1 |
| 3 | Fast logging with few taps, including save or mark watched straight from search | about 10 | v1-relevant | "Horrible streamline" (Dondre5000, 2026-10-03); Trakt review by Rodrigoescobar (undated); NiCoCo1986 (2026-06-28, save needs several taps); Enthusiasm8 (Letterboxd, undated): "add a movie to my watch- or seen- list from the search results page"; Michelle Findley (IMDb, 2026-10-04) wants the watched icon in search |
| 4 | Reliable Series progress: clear watched state, resume or continue-watching, mark earlier episodes in one tap | about 10 | v1-relevant | pain 4 reviews; Golddave (Trakt, undated) wants remaining episodes shown in "Up Next" |
| 5 | Sorting and filtering the to-watch list; custom or several lists; rank the watchlist | about 9 | v1-relevant for sort and filter (the "tonight" filter). Several lists is open: the map does not mention it. | Some Freak5 (Letterboxd, undated): "Ability to rank the watchlist, decide the order of the lists page."; Toadsith and EvilDrJerkberg (JustWatch, undated) want several lists; a1vxx_ (Serializd, 2026-08-09) "Film sorting"; Sha79 (Simkl, 2026-09-06) |
| 6 | Statuses beyond to-watch and watched: dropped or did not finish, paused, "watching now" | about 8 | v1-relevant | nashoh0 (Letterboxd, 2026-08-29, wants "did not finish"); Sherasheba (Trakt, 2026-07-10, swipe to dropped); SGT Mazz1 (Trakt, undated, wants "watching now"); Sha79 (remove completed or abandoned shows) |
| 7 | Data safety: no lost watchlist, easy export | about 10 | Reliability: v1-relevant. Export: belongs to account basics (not yet specified). Import: **future** (already planned as the first follow-up). | section (c) items 4 and 6; Golygl13 and Yuletide (API access) |
| 8 | Log without a review, backfill a date, log over a date range | about 4 | v1-relevant (fits "added straight as watched" with a watch date) | Idkagoodnicknamethatisnottaken and PurpleJellyBean99 (Serializd, 2026); Gwilliamfancyson (Serializd, undated); HouseLannister (MacRumors, 2026) |
| 9 | Rate seasons, finer ratings | about 6 | v1-relevant as input to the ratings decision | Jbruv308, 12747483 (Trakt, 2026-08-08), Hikistnyaicu (Trakt, 2026-07-13), mistad123 (Trakt, 2026-04-11); Justinmayer55 (Letterboxd, undated) wants finer steps |
| 10 | Streaming availability, release calendar, new-episode alerts | 10 or more | **future** (planned out of v1) | kej (HN, 2026-07-22), Alli Wheel and DannyJGomez (Sofa Time, 2026), nomadic (Vivaldi) |
| 11 | Stats | about 8 | **future** (planned out of v1) | Serializd and Trakt reviews, 2026 |
| 12 | Recommendations and discovery | about 7 | **future** (planned out of v1) | Nottykjd, JEBextor (Letterboxd, undated); nashoh0 (2026-08-29); DanielR112 (Serializd, undated); mdmglr (HN, 2022-11-04) |
| 13 | Social feed and following | about 6 | **future** (planned out of v1) | McDoublenarpickle (IMDb, 2026-09-19); Jacob_Jaz (Letterboxd, undated); Tangoat7 (Simkl, 2024-06-30) |
| 14 | Tag who you watched with, or who recommended | 2 | v1-relevant for "Recommended by" (thin evidence) | karmicdee! (Letterboxd, 2026-08-31) wants a "watched with" tag; bradydjohnson (HN, 2026-06-17) wants a watchlist for recommended films |

Notes for the owner:

- "Recommended by" has only 2 supporting posts. That matches the map's view that it is a small touch, not a pain fix.
- Item 14 and the voice idea below are the weakest evidence in the list.
- Import has high demand after TV Time closed (many Sofa Time, Trakt and JustWatch reviews praise import help), but it stays out of v1 as planned.

### Voice input and voice search

I found **no user post** that asks for voice input or voice search in a tracking app. The one hit was a product feature, not a wish: Google Assistant's "pick one episode of [Show]". No evidence for or against the future "voice mode" idea.

## Method notes

- Hard cap of zero subagents. All reading done directly.
- The brief asked for 25-40 cited items. I cite about 60 individual posts and reviews because the App Store feeds are cheap to count. New themes stopped appearing after the Trakt, JustWatch and Simkl feeds. Two HN searches ("where I left off", "trakt OR simkl") returned no hits.
- Review dates come from the iTunes feed. justuseapp pages show no dates, so those items say "undated".
- Counts are approximate. Feed summaries came from a small model reading the feed, so treat each count as plus or minus 2.
