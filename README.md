# Custom Dart Games

A Spring Boot app for tracking scores across custom, self-invented dart games.

Keeps a catalog of game types and, per user, the best and worst score recorded for
each game type — a small persistent leaderboard. In-progress game session scores are
not persisted; only the resulting best/worst per (user, game) is saved once a game
finishes.

## Stack

- Java 17, Spring Boot 4
- Spring Data JPA / Hibernate
- MySQL 8.4
- Thymeleaf + vanilla JS (no frontend framework)

## Prerequisites

- JDK 17+
- Docker (for the MySQL database via Compose)

## Running locally

Start the database:

```bash
docker compose up
```

Then run the app:

```bash
./gradlew bootRun
```

The app listens on `http://localhost:8080`. Database connection settings are in
`src/main/resources/application.properties` and match the credentials defined in
`compose.yaml` — fine for local development, not meant for production use.

## Pages

- `GET /dart/` — home page.
- `GET /dart/rules` — accordion listing every game's rules.
- `GET /dart/players` — leaderboard: one row per player, one best/worst column pair per game type.
- `GET /dart/players/new` — form to add a player.
- `POST /dart/add` — creates a player (`username` form param), then redirects to `/dart/players`.
- `GET /dart/play` — pick a game to start.
- `POST /dart/play/start` — computes the required player count for the chosen game, redirects to player selection.
- `GET /dart/play/players-setup` — select which players are in, in play order.
- `POST /dart/play/start-game` — routes to the game's scoring screen. Implemented so far: Cricket, Cricket Honneur, and Countdown (501/301/101); other seeded games fall through to a blank page.
- `POST /dart/play/finish` — records the finished game's result in `UserGameStats`, then redirects to `/dart/play`.

16 game types are seeded automatically on first startup if the `games` table is empty:
Cricket, Cricket Honneur, 501, 301, 101, Scram, Scram 2vs2, Scram 2vs1, Ozone, Ozone +3
joueurs, Baseball, Ballbase, Horloge, Horloge Rapide, Geo Jura, Purple Stain, Killer.
Tables are created/updated automatically (`spring.jpa.hibernate.ddl-auto=update`).

## Project structure

- `MainController` — web endpoints (`/dart/...`); one `..._CODE` constant per seeded game, used to switch on game-specific behavior (player count, scoring screen).
- `model` — JPA entities: `User`, `Game`, `UserGameStats` (composite key on `user_id` + `game_type_id` via `@EmbeddedId`/`@MapsId`), `UserGameStatsId`.
- `repository` — Spring Data repositories: `UserRepository`, `GameRepository`, `UserGameStatsRepository`.
- `resources/templates` — Thymeleaf views: `home`, `rules`, `players`, `player-form`, `play`, `players-setup`, `game-countdown`, `game-cricket`, `game-cricket-honour`.
- `resources/static/js` — per-screen game logic: `game-common.js` (shared exit-confirm modal), `player-setup.js` (player-selection ordering/cap), `game-countdown.js` (501/301/101), `game-cricket-common.js` (shared Cricket engine, driven by `game-cricket.js` / `game-cricket-honour.js`).
- `resources/static/css` — single stylesheet, mobile-first (unprefixed rules are the small-screen baseline, `@media (min-width: 600px)` layers on larger screens).

There is no `src/test` directory yet — no test task to run.
