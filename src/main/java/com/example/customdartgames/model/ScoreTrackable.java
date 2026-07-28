package com.example.customdartgames.model;

/**
 * Interface for scoring best/worst scores and other game/user related information Used by UserGameStats and
 * UserGameSecondaryStats
 */
public interface ScoreTrackable {
	/**
	 * Getter bestScore
	 * 
	 * @return bestScore
	 */
	Integer getBestScore();

	/**
	 * Setter bestScore
	 * 
	 * @param bestScore
	 */
	void setBestScore(Integer bestScore);

	/**
	 * Getter worstScore
	 * 
	 * @return worstScore
	 */
	Integer getWorstScore();

	/**
	 * Setter worstScore
	 * 
	 * @param worstScore
	 */
	void setWorstScore(Integer worstScore);

	/**
	 * Getter game
	 * 
	 * @return game
	 */
	Game getGame();

	/**
	 * Getter user
	 * 
	 * @return user
	 */
	User getUser();
}
