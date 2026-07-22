package com.example.customdartgames.util;

import com.example.customdartgames.model.UserGameStats;

public final class Util {

	private Util() {
	}

	public static void saveScoresToStats(UserGameStats userGameStats, Integer result, boolean isBasedOnTurn) {
		Integer bestScore = userGameStats.getBestScore();
		Integer worstScore = userGameStats.getWorstScore();

		if (isBetter(result, bestScore, isBasedOnTurn)) {
			// If the new result is better than the best score
			// Turn based game : (bestScore) 12 > 5 (result) / Score based game : (bestScore) 15 < 115 (result)

			if ((worstScore == null) // if old best score is now the worst score or if the worstScore isn't defined
					|| isBetter(worstScore, bestScore, isBasedOnTurn)) {

				// Update the worst score with bestScore
				userGameStats.setWorstScore(bestScore);
			}
			// Update the best score with result
			userGameStats.setBestScore(result);
		}

		else { // Else, the new result isn't better than the best score
			if ((worstScore == null) || isBetter(worstScore, result, isBasedOnTurn)) { // if result is iller than old
																						// worst score
				// Update the worst score with result
				userGameStats.setWorstScore(result);
			}
		}
	}

	// True if candidate is a better result than reference for this game type.
	private static boolean isBetter(Integer candidate, Integer reference, boolean isBasedOnTurn) {
		if (isBasedOnTurn) {
			return candidate < reference;
		}
		return candidate > reference;
	}
}