# Minimal playback plan — exploration draft

**Status:** Exploration draft with agreed prototype decisions, not a complete implementation specification. The bounded OAuth/candidate proof exists; the radio, replenishment, and temporary application session described below are not implemented.

## Proposed experience

1. Connect a Discogs account using **OAuth 1.0a** before making authenticated Discogs requests. The owner completed the current [read-only proof](discogs-oauth.md) in a browser and supplied a successful bounded candidate report for all three categories. This validates the experiment, not an implemented radio.
2. Choose one of three fixed options: **Reggae**, **Techno**, or **Punk**.
3. Search Discogs for releases in that category. Request details for candidate releases and consider their associated videos.
4. Build a queue of **up to 20 distinct videos** that appear to contain individual songs listed in the associated release's tracklist. One release may contribute several songs. If fewer qualify, show the available results rather than treating the search as a failure.
5. Let the user select a queue item, play and pause it, and move to the previous or next item. Play **both video and audio** in a visible YouTube player; do not hide the player or extract audio.
6. Display the associated release's cover art and available information about the release and the playing song/video.

## Data and interpretation

- Discogs is the proposed source for release search, release details, cover art, tracklists, and associated video links. Example API calls: `GET /database/search?genre=Reggae&type=release` and `GET /releases/{release_id}`. The search documentation requires user authentication; use OAuth rather than relying on previously observed anonymous responses. Keep credentials server-side, outside the frontend and repository.
- Discogs records Techno and Punk as styles in the observed results. Search them with `style=Techno` and `style=Punk`, respectively, with `type=release`; Reggae uses `genre=Reggae`. The three UI choices need not map to the same API parameter.
- An associated video must appear to be one song from the release tracklist, not a full album, mix, or unrelated song. Trust the Discogs association for release identity; do not attempt to prove that the audio is the exact recording or pressing. Avoid duplicate video links. This is an intended selection rule, not a validated classifier.
- A vinyl release with multiple tracks can appear in search and can supply several queue items. The search is **not restricted to vinyl**.

## Validation evidence

The owner supplied a live report with 33 data requests, 10 inspected releases per category, no partial stop, and cover metadata present for all 30 releases. Manual per-release ID counts were reconciled with the report's aggregate counts:

| Observation                                     | Reggae | Techno | Punk |
| ----------------------------------------------- | -----: | -----: | ---: |
| Releases with video links                       |      9 |      8 |    7 |
| Distinct YouTube IDs, including non-candidates  |    111 |     44 |   30 |
| Distinct IDs with an apparent track-title match |     84 |     30 |   17 |

These are first-page, non-random results, not distinct songs or verified playable videos. The proof's `apparentTrackMatches` counts occurrences, including duplicate IDs; it is not the distinct-ID count above. Title matching has false positives and negatives, including punctuation differences, repeated track titles, and videos containing multiple songs. The Punk result `Busted! (FULL 7´´ 1988)` is suspect despite its apparent match; excluding it leaves 16 apparent IDs. Candidate counts do not establish that a 20-item queue can be played.

For three selected videos, the owner reported that `0RIegs2v0h4` was available on YouTube but unavailable in the iframe, while `TT5Iqn6q69Q` and `SONK_AT_L7g` were available in the iframe. No exact error code was supplied for the failure, and sustained audio/video playback was not explicitly confirmed. This is initial embed-availability evidence, not a general playback guarantee.

## Agreed replenishment behavior

- Search the selected category with pages of up to **100 releases**, then inspect release details in **blocks of 10**. Page size is not the number of playable songs.
- Automatically replenish an exhausted candidate queue, advancing through uninspected releases and then subsequent pages instead of repeating the same page.
- Inspect at most **30 releases per automatic replenishment**, stopping earlier when the queue reaches **20 candidates**. This is a release-inspection budget, not 30 playable results; search-page requests also consume quota.
- Avoid adding video IDs already encountered or discarded during the browser session. Different video IDs may still represent the same song.
- When the budget is exhausted, keep any available results and offer **Search more** for another bounded batch. Do not loop indefinitely or promise 20 results.
- Respect Discogs response quota headers and provider errors. The experimental proof still uses `per_page=10` and at most 33 data requests across three categories; it does not implement this replenishment behavior.

Discogs documents a maximum `per_page` of 100 and an authenticated rate limit of 60 requests per minute, subject to change; see [pagination](https://www.discogs.com/developers/#page:home,header:home-pagination) and [rate limiting](https://www.discogs.com/developers/#page:home,header:home-rate-limiting). A page of 100 search results requires one search request, but inspecting all of them can require another 100 release-detail requests.

## Agreed temporary OAuth session

For the first prototype, retain OAuth credentials **only in backend memory**, associated with a browser session, so later replenishment requests can use them. Never send them to the frontend or persist them to disk. Require reconnection after session expiry or a backend restart.

The agreed application-session policy is:

- Expire after **30 minutes of inactivity**, measured from valid browser requests to the application. Candidate and replenishment requests count as activity; internal backend work does not renew the session by itself.
- Expire after an **absolute maximum of 8 hours** from OAuth connection, even with activity. Do not send periodic keepalive requests solely to extend the session or renew it silently.
- On expiry, remove the session and its credentials from backend memory and offer **Reconnect with Discogs** when another Discogs request is needed. A backend restart also requires reconnection.
- Do not interrupt an already playing video or automatically erase the visible queue when the Discogs session expires. YouTube playback alone does not necessarily produce requests to our backend, so expiry can occur while listening.
- An explicit disconnect immediately removes the local session and its credentials. This is not equivalent to revoking the application's authorization at Discogs.
- Identify the session with an opaque **HttpOnly** cookie containing no OAuth credentials. Production requires **Secure** cookies over HTTPS. These application timeouts do not describe the lifetime of Discogs access tokens.

This session is not implemented. The existing proof discards access credentials after its callback finishes. Cookie binding and other protections, capacity, and cleanup mechanics still need to be specified and verified before implementation; this decision does not authorize permanent credential storage.

## Remaining decisions before implementation

1. **Complete the temporary-session design:** Specify browser binding and remaining cookie protections, capacity, and cleanup mechanics for the agreed 30-minute idle / 8-hour absolute policy, preserving credential isolation and the existing OAuth protections.
2. **Define player failure handling:** Distinguish an unavailable candidate from blocked autoplay, decide bounded skip behavior, and verify actual video/audio playback with the official visible player. Availability on YouTube or in Discogs metadata is insufficient.
3. **Review provider constraints:** Confirm current Discogs and YouTube terms, attribution, metadata/image usage, and quota handling before product integration. The sampled presence of cover metadata does not establish image delivery or usage rights.
4. **Specify the first implementation slice:** Use the agreed decisions and observed limits without promising 20 playable items or a response time. Radio UI, queue state, and session/replenishment implementation remain future work.

OAuth connection is required for Discogs reads; no wantlist operations, persistent cache, additional playback provider, deployment topology, or further product features have been decided here.
