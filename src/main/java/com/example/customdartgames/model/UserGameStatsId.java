package com.example.customdartgames.model;

import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;

@Embeddable //composite key
public class UserGameStatsId implements Serializable {

    private Integer userId;

    private Integer gameTypeId;

    public UserGameStatsId(Integer userId, Integer gameTypeId) {
        this.userId = userId;
        this.gameTypeId = gameTypeId;
    }

    protected UserGameStatsId() {}

    @Override
    public boolean equals(Object o) {
        if (o == null || getClass() != o.getClass()) return false;
        UserGameStatsId that = (UserGameStatsId) o;
        return Objects.equals(userId, that.userId) && Objects.equals(gameTypeId, that.gameTypeId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(userId, gameTypeId);
    }

    public Integer getUserId() {
        return userId;
    }

    public void setUserId(Integer userId) {
        this.userId = userId;
    }

    public Integer getGameTypeId() {
        return gameTypeId;
    }

    public void setGameTypeId(Integer gameTypeId) {
        this.gameTypeId = gameTypeId;
    }
}
