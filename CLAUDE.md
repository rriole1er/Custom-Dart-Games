# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Start the database (required before running the app):
```bash
docker compose up
```

Run the app (listens on `http://localhost:8080`):
```bash
./gradlew bootRun
```

Build:
```bash
./gradlew build
```

There is no `src/test` directory yet — no test task to run.

Database credentials/URL are in `src/main/resources/application.properties` and must match `compose.yaml`; they're fine for local dev only. `spring.jpa.hibernate.ddl-auto=update` means schema changes to `@Entity` classes are applied automatically on next boot, no manual migrations.

## Architecture

Standard Spring MVC + Thymeleaf server-rendered app (no REST API, no JS framework) — every route in `MainController` returns a template name, and templates are styled by the single `static/css/style.css` (mobile-first: unprefixed rules are the small-screen baseline, `@media (min-width: 600px)` layers on tablet/desktop enhancements).

**Domain model**: `User` and `Game` are simple entities. `UserGameStats` links them with a composite key (`UserGameStatsId`, holding `userId` + `gameTypeId`) via `@EmbeddedId`/`@MapsId`, and stores only `bestScore`/`worstScore` per (user, game) pair — in-progress game sessions are not persisted, only the resulting best/worst after a session ends. There is currently no code path that writes to `UserGameStatsRepository`; the leaderboard renders against whatever rows exist.

Repositories extend `ListCrudRepository` (not `CrudRepository`) so `findAll()` returns `List` directly. `UserGameStatsRepository`'s ID type must stay `UserGameStatsId`, matching the entity's `@EmbeddedId` — not `Integer`.

**Game catalog**: `CustomDartGamesApplication` seeds 16 `Game` rows and 5 `User` rows via `CommandLineRunner` beans, only when the respective table is empty. `MainController` declares one `public static final int ..._CODE` constant per seeded game, in the same insertion order as the seeder — these are used to switch on game-specific behavior (e.g. player-count rules in `playStart()`). If you add a game to the seeder, add its matching constant in `MainController` and vice versa; they aren't otherwise linked, so they can silently drift out of sync with the DB's actual game IDs.

**Play flow** (`MainController`, in progress): `GET /dart/play` → pick a game → `POST /dart/play/start` computes a required `playerNumber` per game type (via the `..._CODE` constants) and **redirects** to `GET /dart/play/players-setup?gameId=..&playerNumber=..`. Model attributes do not survive a `redirect:` in Spring MVC — `playerNumber` and `gameId` must be passed as query params on the redirect URL and re-declared as `@RequestParam` on the receiving `GET` handler, not just added to `Model` before the redirect. The setup page posts to `/dart/play/start-game`, which is a stub (`startGame()` has an empty `switch(gameId)` and returns `""`) — the actual per-game scoring/play screen doesn't exist yet.

**Frontend/backend split for this project**: the user is learning Spring and writes all Java/controller code themselves. When asked for a new feature, build only the Thymeleaf template, CSS, and any vanilla JS — no jQuery/frameworks — and state explicitly which model attributes, param names, and routes the template expects, so the controller side can be wired up separately. Don't add error handling for scenarios the controller doesn't yet guard against (e.g. a missing `game` model attribute); flag it in prose instead of coding around it.

Checkbox/selection-limit UI pattern (see `player-setup.js` + `.player-chip:has(...)` in `style.css`): cap enforcement lives entirely in vanilla JS reading a `data-max-*` attribute rendered by Thymeleaf; the script no-ops safely if that attribute is absent, so a template can be built ahead of the controller support that populates it.
