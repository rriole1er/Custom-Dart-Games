package com.example.customdartgames.model;

import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;

import java.util.Set;

@Entity // This tells Hibernate to make a table out of this class
@Table(name = "users")
public class User {
	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Integer id;

	private String username;

	@OneToMany(mappedBy = "user")
	private Set<UserGameStats> userGameStats;

	@OneToMany(mappedBy = "user")
	private Set<UserGameSecondaryStats> userGameSecondaryStats;

	public Integer getId() {
		return id;
	}

	public void setId(Integer id) {
		this.id = id;
	}

	public String getUsername() {
		return username;
	}

	public void setUsername(String username) {
		this.username = username;
	}

	public Set<UserGameStats> getUserGameStats() {
		return userGameStats;
	}

	public void setUserGameStats(Set<UserGameStats> userGameStats) {
		this.userGameStats = userGameStats;
	}
}
