package com.example.customdartgames.util;

import com.example.customdartgames.model.Game;
import com.example.customdartgames.model.ScoreTrackable;
import com.example.customdartgames.model.UserGameStats;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

public final class Util {

	private Util() {
		// Utility Constructor should not be instantiated
	}

	/**
	 * Compute and update the old / previous best/worst scores to persist them. Based on isBasedOnTurn, compute differs.
	 * For a turn, lowest is better. For a score, highest is better
	 * 
	 * @param stat
	 *            A user's stat, could be UserGameStats or UserGameSecondaryStats
	 * @param result
	 *            The score to register
	 * @param isBasedOnTurn
	 *            Boolean information about a game, based on turn or not
	 */
	public static void saveScoresToStats(ScoreTrackable stat, Integer result, boolean isBasedOnTurn) {
		Integer bestScore = stat.getBestScore();
		Integer worstScore = stat.getWorstScore();

		if (isBetter(result, bestScore, isBasedOnTurn)) {
			// If the new result is better than the best score
			// Turn based game : (bestScore) 12 > 5 (result) / Score based game : (bestScore) 15 < 115 (result)

			if ((worstScore == null) // if old best score is now the worst score or if the worstScore isn't defined
					|| isBetter(worstScore, bestScore, isBasedOnTurn)) {

				// Update the worst score with bestScore
				stat.setWorstScore(bestScore);
			}
			// Update the best score with result
			stat.setBestScore(result);
		}

		else { // Else, the new result isn't better than the best score
			if ((worstScore == null) || isBetter(worstScore, result, isBasedOnTurn)) {
				// if result is iller than old worst score

				// Update the worst score with result
				stat.setWorstScore(result);
			}
		}
	}

	/**
	 * Small compute to defining what is the best candidates, based on isBasedOnTurn.
	 *
	 * @param candidate
	 *            The value to be compared
	 * @param reference
	 *            The reference value
	 * @param isBasedOnTurn
	 *            Boolean information about a game, based on turn or not
	 * @return A boolean result condition
	 */
	// True if candidate is a better result than reference for this game type.
	private static boolean isBetter(Integer candidate, Integer reference, boolean isBasedOnTurn) {
		if (isBasedOnTurn) {
			return candidate < reference;
		}
		return candidate > reference;
	}

	/**
	 * Compute the best score around each player in a game (based on score or turn). Create map User / Game / BestScore
	 * / WorstScore.
	 * 
	 * @param stats
	 *            All userGameStats existing
	 * @param statsByUserAndGame
	 *            An empty map to store UserId, (GameId,UserGameStats score)
	 * @param bestPerGame
	 *            An empty map to store the best score by games
	 */
	public static void computeBestScore(List<? extends ScoreTrackable> stats,
			Map<Integer, Map<Integer, ScoreTrackable>> statsByUserAndGame, Map<Integer, Integer> bestPerGame,
			boolean forceHigherIsBetter) {

		for (ScoreTrackable stat : stats) { // For each stats line in the DB

			Game game = stat.getGame();
			// create a map with UserId, (GameId,UserGameStats score)
			// populate statsByUserAndGame, if user doesn't exist yet, create a new hashmap with (GameId,UserGameStats
			// score). Else, it uses the already created hashmap
			statsByUserAndGame.computeIfAbsent(stat.getUser().getId(), id -> new HashMap<>()).put(game.getId(), stat);

			Integer bestScore = stat.getBestScore(); // In every game, look for the best score registered
			if (bestScore != null) {
				Integer gameId = game.getId();
				Integer currentBest = bestPerGame.get(gameId);
				boolean isBasedOnTurnGame = !forceHigherIsBetter && game.isScoreBasedOnTurn();

				// If it's not a turn based game, store the highest score
				if (currentBest == null || ((bestScore > currentBest) && !isBasedOnTurnGame)) {
					bestPerGame.put(gameId, bestScore);
				}

				// If it's a turn based game, store the lowest result number
				else if ((bestScore < currentBest) && isBasedOnTurnGame) {
					bestPerGame.put(gameId, bestScore);
				}
			}
		}
	}
}