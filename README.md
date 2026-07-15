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

## Usage

- `GET /dart/` — home page (Thymeleaf view).
- `POST /dart/add` — create a user. Example:

  ```bash
  curl -X POST "http://localhost:8080/dart/add?username=alice"
  ```

Tables are created/updated automatically on startup (`spring.jpa.hibernate.ddl-auto=update`).

## Project structure

- `MainController` — web endpoints (`/dart/...`)
- `model` — JPA entities: `User`, `Game`, `UserGameStats` (composite key on `user_id` + `game_type_id`), `UserGameStatsId`
- `repository` — Spring Data repositories: `UserRepository`, `GameRepository`, `UserGameStatsRepository`
- `resources/templates` — Thymeleaf views
