package com.example.customdartgames.model;

import jakarta.persistence.Table;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;

@Entity // This tells Hibernate to make a table out of this class
@Table(name = "games")
public class Game {
	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Integer id;

	private String name;

	@Column(length = 2000)
	private String description;

	private boolean isScoreBasedOnTurn;

	public Integer getId() {
		return id;
	}

	public void setId(Integer id) {
		this.id = id;
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

	public String getDescription() {
		return description;
	}

	public void setDescription(String description) {
		this.description = description;
	}

	public boolean isScoreBasedOnTurn() {
		return isScoreBasedOnTurn;
	}

	public void setScoreBasedOnTurn(boolean scoreBasedOnTurn) {
		isScoreBasedOnTurn = scoreBasedOnTurn;
	}
}
