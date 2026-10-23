# Repository instructions

This is Swayam Sonawane's solo project (`swayam-8/VoxMind`).

When making commits on the owner's behalf, use this repository-local Git identity:

```sh
git config --local user.name "Swayam Sonawane"
git config --local user.email "215353959+swayam-8@users.noreply.github.com"
```

Check the author and committer before pushing. Do not inherit another person's
global Git identity or add co-author attribution unless the owner requests it.

Run the complete local application with `npm start` from the repository root.
It requires Node.js 22.12+ and a running Docker Desktop/Engine. `npm stop` stops
the services without deleting their data. Root `.env` and `backend/.env` contain
private configuration and must never be committed.
