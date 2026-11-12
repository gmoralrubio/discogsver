# Discogs OAuth read-only proof

The backend exposes a temporary OAuth 1.0a connection flow to confirm that Discogs credentials can authorize one private, read-only search. It does not save access tokens or add radio, player, or wantlist behavior.

## Local setup

1. Register a Discogs application and place `DISCOGS_CLIENT_KEY` and `DISCOGS_SECRET_KEY` in the ignored `apps/backend/.env` file. Values must remain private.
2. Start the frontend and backend using the workspace development command.
3. Open `http://127.0.0.1:3100/api/discogs/connect` directly, then approve access at Discogs. The fixed callback is `http://127.0.0.1:5173/api/discogs/callback`; the frontend proxy forwards `/api` to the backend.
4. The default URL returns a minimal sample from one authenticated `GET /database/search?type=release&genre=Reggae&per_page=1` request. To opt into the bounded candidate proof, open `http://127.0.0.1:3100/api/discogs/connect?validation=candidates` instead. The callback reports only projected, public metadata; it never includes access credentials or raw provider response bodies.

Candidate mode performs one search for each of Reggae (genre), Techno (style), and Punk (style), requesting `type=release&per_page=10`, and inspects up to 10 valid distinct release IDs per category. It issues at most 33 authenticated data GETs (three searches plus 30 release details), sequentially, pacing requests by at least 1.1 seconds. It does not paginate, retry, or continue after a provider error, HTTP 429, malformed payload, fetch failure, or exhausted-quota response header. A partial report includes inspected evidence and a safe stop reason; a category with fewer than 10 inspected releases is marked insufficient.

Reports include release IDs and public Discogs links, bounded track titles, video titles and canonical YouTube links/IDs, duplicate-video indications, cover availability, and category counts. A title-based apparent track match is only a heuristic; ambiguous, unmatched, and full-album/mix titles are distinct. This does not establish the exact recording or playback availability. Metadata presence—including Discogs video metadata—does not prove an embed plays.

For manual playback evidence, select links from the report and open the official visible YouTube player yourself. Record whether playback was visibly observed; do not infer success from metadata. Distinguish player errors: `100` indicates unavailable video; `101`/`150` indicates embedding disabled; `153` indicates missing/refused client identification; autoplay may be blocked by browser policy. The player viewport must be at least 200×200 pixels; 480×270 is recommended. See [YouTube player error codes](https://developers.google.com/youtube/iframe_api_reference#onError) and [player parameters](https://developers.google.com/youtube/player_parameters). Live OAuth sampling and playback remain owner-operated and are not part of automated tests.

The backend also accepts optional `DISCOGS_REQUEST_TOKEN_URL`, `DISCOGS_AUTH_URL`, and `DISCOGS_ACCESS_TOKEN_URL` settings, but validates them against the official Discogs HTTPS endpoints. Request tokens are browser-bound, short-lived, capacity-limited, and single-use. This proof intentionally does not persist access tokens; start a new connection for another run.

Do not paste credentials, OAuth tokens, verifier values, or provider response details into logs or documentation. Tests use simulated provider responses and never contact Discogs.
