# Discogs OAuth read-only proof

The backend exposes a temporary OAuth 1.0a connection flow to confirm that Discogs credentials can authorize one private, read-only search. It does not save access tokens or add radio, player, or wantlist behavior.

## Local setup

1. Register a Discogs application and place `DISCOGS_CLIENT_KEY` and `DISCOGS_SECRET_KEY` in the ignored `apps/backend/.env` file. Values must remain private.
2. Start the frontend and backend using the workspace development command.
3. Open `http://127.0.0.1:3100/api/discogs/connect` directly, then approve access at Discogs. The fixed callback is `http://127.0.0.1:5173/api/discogs/callback`; the frontend proxy forwards `/api` to the backend.
4. A successful callback returns a minimal sample from one authenticated `GET /database/search?type=release&genre=Reggae&per_page=1` request.

The backend also accepts optional `DISCOGS_REQUEST_TOKEN_URL`, `DISCOGS_AUTH_URL`, and `DISCOGS_ACCESS_TOKEN_URL` settings, but validates them against the official Discogs HTTPS endpoints. Request tokens are browser-bound, short-lived, capacity-limited, and single-use. This proof intentionally does not persist access tokens; start a new connection for another run.

Do not paste credentials, OAuth tokens, verifier values, or provider response details into logs or documentation. Tests use simulated provider responses and never contact Discogs.
