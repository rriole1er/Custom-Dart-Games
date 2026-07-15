package com.example.customdartgames.repository;

import com.example.customdartgames.model.UserGameStats;
import org.springframework.data.repository.CrudRepository;

// This will be AUTO IMPLEMENTED by Spring into a Bean called userRepository
// CRUD refers Create, Read, Update, Delete

public interface UserGameStatsRepository extends CrudRepository<UserGameStats, Integer> {

}
