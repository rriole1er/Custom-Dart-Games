package com.example.customdartgames.repository;

import com.example.customdartgames.model.User;
import org.springframework.data.repository.ListCrudRepository;

// This will be AUTO IMPLEMENTED by Spring into a Bean called userRepository
// CRUD refers Create, Read, Update, Delete
public interface UserRepository extends ListCrudRepository<User, Integer> {
    User findByUsername(String username);
}
