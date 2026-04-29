# The ClioSoF Week 13 World Cup

A simple World Cup–style knockout bracket for **16 teams** (Round of 16 → QF → SF → Final).

## Run it

- Open `index.html` in your browser, or
- Serve the folder (recommended):

```bash
cd world-cup-tracker
npx serve .
```

## How to use

- Type (or paste) 16 team names.
- Click **Generate bracket** to create the Round of 16 matchups in seeding order (1 vs 2, 3 vs 4, ...).
- Click a team in a match to advance them.
- Use **Reset winners** to clear picks without clearing teams.

## Notes

- Saves progress in your browser (localStorage) as a fallback.
- When deployed on Vercel with KV configured, the bracket uses a **single shared state** so everyone sees the same board.
- **Copy link** generates a share URL containing the current state in the URL hash (still supported).
- Artwork is bundled locally in `assets/`.

## Owner edit mode

This site includes an **Owner mode** PIN gate that hides editing controls (teams + reset/shuffle/generate + picking winners) unless unlocked.

- The PIN is verified server-side (Vercel env var `OWNER_PIN`) for shared-state writes.
- Unlock status is saved in your browser (localStorage), so you usually only unlock once per device/browser.

## Shared state (Vercel KV)

To make `https://<your-site>.vercel.app/` show the same bracket to everyone, configure Vercel KV / Upstash Redis and set these environment variables in Vercel:

- `OWNER_PIN`: Admin PIN required to save shared state.
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- `KV_REST_API_READ_ONLY_TOKEN` (recommended)

The shared state API is exposed at:

- `GET /api/state` (read shared state)
- `POST /api/state` (write shared state; requires the PIN)

