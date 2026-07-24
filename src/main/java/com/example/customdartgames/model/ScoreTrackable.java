package com.example.customdartgames.model;

public interface ScoreTrackable {
	Integer getBestScore();

	void setBestScore(Integer bestScore);

	Integer getWorstScore();

	void setWorstScore(Integer worstScore);

	Game getGame();

	User getUser();
}
