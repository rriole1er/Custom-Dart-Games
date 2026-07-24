package com.example.customdartgames.util;

import com.example.customdartgames.model.Game;
import com.example.customdartgames.model.ScoreTrackable;
import com.example.customdartgames.model.UserGameStats;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

public final class Util {

	private Util() {
	}

	/**
	 * @param stat
	 * @param result
	 * @param isBasedOnTurn
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
			if ((worstScore == null) || isBetter(worstScore, result, isBasedOnTurn)) { // if result is iller than old
																						// worst score
				// Update the worst score with result
				stat.setWorstScore(result);
			}
		}
	}

	/**
	 * @param candidate
	 * @param reference
	 * @param isBasedOnTurn
	 * @return
	 */
	// True if candidate is a better result than reference for this game type.
	private static boolean isBetter(Integer candidate, Integer reference, boolean isBasedOnTurn) {
		if (isBasedOnTurn) {
			return candidate < reference;
		}
		return candidate > reference;
	}

	/**
	 * @param stats
	 * @param statsByUserAndGame
	 * @param bestPerGame
	 */
	public static void computeScore(List<? extends ScoreTrackable> stats,
			Map<Integer, Map<Integer, ScoreTrackable>> statsByUserAndGame, Map<Integer, Integer> bestPerGame,
			boolean forceHigherIsBetter) {
		for (ScoreTrackable stat : stats) {

			Game game = stat.getGame();
			// create a map with UserId, (GameId,UserGameStats score)
			statsByUserAndGame.computeIfAbsent(stat.getUser().getId(), id -> new HashMap<>()).put(game.getId(), stat); // populate

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