package com.example.customdartgames.repository;

import java.util.List;

import com.example.customdartgames.model.UserGameSecondaryStats;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.ListCrudRepository;

import com.example.customdartgames.model.UserGameStats;
import com.example.customdartgames.model.UserGameStatsId;

// This will be AUTO IMPLEMENTED by Spring into a Bean called UserGameStatsRepository
// CRUD refers Create, Read, Update, Delete
public interface UserGameSecondaryStatsRepository extends ListCrudRepository<UserGameSecondaryStats, UserGameStatsId> {
	@Query("SELECT s FROM UserGameSecondaryStats s JOIN FETCH s.user JOIN FETCH s.game")
	List<UserGameSecondaryStats> findAllWithUserAndGame();
}
