package com.example.customdartgames.model;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;

import jakarta.persistence.Entity;


@Entity // This tells Hibernate to make a table out of this class
@Table(name = "user_game_stats")
public class UserGameStats {
	@EmbeddedId
    private UserGameStatsId id;

    @ManyToOne
    @MapsId("userId")          // must match the field name in UserGameStatsId
    @JoinColumn(name = "user_id")
    private User user;

    @ManyToOne
    @MapsId("gameTypeId")      // must match the field name in UserGameStatsId
    @JoinColumn(name = "game_type_id")
    private Game game;

    private Integer bestScore;

    private Integer worstScore;

    public UserGameStatsId getId() {
        return id;
    }

    public void setId(UserGameStatsId id) {
        this.id = id;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public Game getGame() {
        return game;
    }

    public void setGame(Game game) {
        this.game = game;
    }

    public Integer getBestScore() {
        return bestScore;
    }

    public void setBestScore(Integer bestScore) {
        this.bestScore = bestScore;
    }

    public Integer getWorstScore() {
        return worstScore;
    }

    public void setWorstScore(Integer worstScore) {
        this.worstScore = worstScore;
    }
}
