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

- Saves progress in your browser (localStorage).
- **Copy link** generates a share URL containing the current state in the URL hash.
- Artwork is bundled locally in `assets/`.

