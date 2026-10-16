# Sharing in v1

Type: grilling
Status: resolved
Blocked by: none
Map: [Kinbox v1](../map.md)

## Question

Can anyone besides the owner see or edit a Kinbox in v1, and if so, what exactly?

- Options to weigh: nobody (private only); a read-only public link to the box or one list; a public profile showing the log and reviews (Letterboxd-style, but no feeds); a partner who edits a shared box (each person keeps their own status).
- If anything is visible to others: what is shown, what stays private, and who controls it.
- Social feeds are out of scope; this ticket stops short of them.

## Answer

Kinbox is private by default. Other people can look at what an Owner chooses to show, and no one else can edit anything.

- **Ownership.** A Library has exactly one Owner. The Owner holds the Library and its Lists. There are no shared or partner Libraries.
- **Profile.** An optional public page at a username address, off by default. Switches: **Watched log** (with sub-switches for **ratings** and **reviews**), **Watching** (with series progress), **To watch**, **Dropped**. The first time the Owner turns the Profile on, watched log, ratings and reviews are on; watching, to watch and dropped are off. Public Lists show on the Profile while it is on. Pinned Entries show at the top of To watch.
- **Username.** Chosen the first time the Owner turns the Profile on, not at sign-up. The Owner can change it; the old address then stops working.
- **Lists.** Each List is private or public. A public List shows on the Profile. Any List can have a Share link.
- **Share link.** One per List: secret, read-only, live. Anyone with it can open it without an account. The Owner can turn it off or reset it to a new address. It shows the List name, the Owner's display name, and for each Title its poster, name, year, Movie or Series, and status. Ratings and reviews have one switch per link, on by default.
- **Never shown to others.** The private note and "recommended by".
- **Search engines.** Profiles and shared Lists are hidden from search engines. Chat-app preview cards work.
- **Accounts.** A Profile and Share links need an account. A Guest has a local-only account: they can set a display name, but they have no Profile and no Share links. An Owner with an account gives a display name the first time they share or turn the Profile on.
- **Abuse.** Profiles and shared Lists have a "Report" link, and the admin can hide a Profile or a Share link. The rest belongs to admin tools.
- Ideas ruled out of v1 here are in [future scope](../../../docs/future-scope.md).
