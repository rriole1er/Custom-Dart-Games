package com.example.customdartgames.repository;

import com.example.customdartgames.model.UserGameStats;
import com.example.customdartgames.model.UserGameStatsId;
import java.util.List;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.ListCrudRepository;

// This will be AUTO IMPLEMENTED by Spring into a Bean called UserGameStatsRepository
// CRUD refers Create, Read, Update, Delete
public interface UserGameStatsRepository extends ListCrudRepository<UserGameStats, UserGameStatsId> {
	@Query("SELECT s FROM UserGameStats s JOIN FETCH s.user JOIN FETCH s.game")
	List<UserGameStats> findAllWithUserAndGame();
}
