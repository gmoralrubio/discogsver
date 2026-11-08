# Minimal playback plan — exploration draft

**Status:** Product exploration, not an implementation commitment. This draft records the current direction and the evidence needed before deciding what to build. The existing workspace is a scaffold, not proof that this flow works.

## Proposed experience

1. Connect a Discogs account using **OAuth 1.0a** before making authenticated Discogs requests. A temporary [read-only proof](discogs-oauth.md) already implements the OAuth callback and one authenticated search; the owner reports one real authenticated search before the structural refactor. The owner completed that OAuth flow in a browser; it has not been repeated live after the refactor. The radio interface and embedded playback remain unvalidated.
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

## Next steps before implementation

1. **Validate candidate yield:** With small, bounded searches for each option, record how many releases must be inspected, how many have associated videos, how many seem to match individual tracklist songs, and how many distinct candidates remain. A preliminary sample found releases with no videos and duplicate video links; it does not establish the yield of a 20-item queue.
2. **Validate playback:** Check that selected YouTube links actually allow playback in a visible official embed, and identify what the UI can do when a video is unavailable or playback is blocked. Discogs video metadata alone does not prove playback availability.
3. **Check metadata and provider constraints:** Check which cover and metadata fields are reliably present; review current Discogs and YouTube terms, attribution, and request limits before selecting an integration approach. The OAuth callback and one authenticated read are already implemented in the temporary proof described above; further integration choices remain undecided.
4. **Agree on limits and behavior from evidence:** Decide a bounded search budget and what the user sees when it runs out. Then revise this draft into a minimal implementable plan; do not promise 20 results or a response time before measuring.

OAuth connection is required for Discogs reads; no wantlist operations, persistent cache, additional playback provider, deployment topology, or further product features have been decided here.
