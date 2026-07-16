package com.example.customdartgames.repository;

import com.example.customdartgames.model.Game;
import org.springframework.data.repository.ListCrudRepository;

// This will be AUTO IMPLEMENTED by Spring into a Bean called GameRepository
// CRUD refers Create, Read, Update, Delete
public interface GameRepository extends ListCrudRepository<Game, Integer> {

}
