package com.example.customdartgames.repository;

import com.example.customdartgames.model.UserGameStats;
import com.example.customdartgames.model.UserGameStatsId;
import org.springframework.data.repository.ListCrudRepository;

// This will be AUTO IMPLEMENTED by Spring into a Bean called UserGameStatsRepository
// CRUD refers Create, Read, Update, Delete
public interface UserGameStatsRepository extends ListCrudRepository<UserGameStats, UserGameStatsId> {
}
