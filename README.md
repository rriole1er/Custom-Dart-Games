# Custom Dart Games

A Spring Boot app for tracking scores across custom, self-invented dart games.

Keeps a catalog of game types and, per user, the best and worst score recorded for
each game type — a small persistent leaderboard. In-progress game session scores are
not persisted; only the resulting best/worst per (user, game) is saved.

## Stack

- Java 17, Spring Boot 4
- Spring Data JPA / Hibernate
- MySQL 8.4
- Thymeleaf

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

- `GET /dart/` — home page: Play / Players.
- `GET /dart/play` — placeholder for starting a game (not implemented yet).
- `GET /dart/players` — scoreboard: one row per player, one best/worst column pair per game type.
- `GET /dart/players/new` — form to add a player.
- `POST /dart/add` — creates a player (`username` form param), then redirects to `/dart/players`.

Game types (`Cricket`, `501`) are seeded automatically on first startup if the `games`
table is empty. Tables are created/updated automatically (`spring.jpa.hibernate.ddl-auto=update`).

## Project structure

- `MainController` — web endpoints (`/dart/...`)
- `model` — JPA entities: `User`, `Game`, `UserGameStats` (composite key on `user_id` + `game_type_id`), `UserGameStatsId`
- `repository` — Spring Data repositories: `UserRepository`, `GameRepository`, `UserGameStatsRepository`
- `resources/templates` — Thymeleaf views (`home`, `play`, `players`, `player-form`)
- `resources/static/css` — stylesheet
