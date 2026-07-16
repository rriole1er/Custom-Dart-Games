package com.example.customdartgames;

import com.example.customdartgames.model.Game;
import com.example.customdartgames.model.User;
import com.example.customdartgames.repository.GameRepository;
import com.example.customdartgames.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

@SpringBootApplication
public class CustomDartGamesApplication { // main entry

	public static void main(String[] args) {
		SpringApplication.run(CustomDartGamesApplication.class, args);
	}

	@Bean
	CommandLineRunner seedGames(GameRepository gameRepository) {
		return args -> {
			if (gameRepository.count() == 0) {
				Game cricket = new Game();
				cricket.setName("Cricket");
				gameRepository.save(cricket);

                Game cricketHonnor = new Game();
				cricketHonnor.setName("Cricket Honneur");
				gameRepository.save(cricketHonnor);

				Game fiveOhOne = new Game();
				fiveOhOne.setName("501");
				gameRepository.save(fiveOhOne);

                Game threeOhOne = new Game();
                threeOhOne.setName("301");
				gameRepository.save(threeOhOne);

                Game oneOhOne = new Game();
                oneOhOne.setName("101");
				gameRepository.save(oneOhOne);

                Game scram = new Game();
                scram.setName("Scram");
				gameRepository.save(scram);

                Game scram2 = new Game();
                scram2.setName("Scram 2vs2");
				gameRepository.save(scram2);

                Game scram3 = new Game();
                scram3.setName("Scram 2vs1");
                gameRepository.save(scram3);

                Game ozone = new Game();
                ozone.setName("Ozone");
				gameRepository.save(ozone);

                Game baseBall = new Game();
                baseBall.setName("Baseball");
				gameRepository.save(baseBall);

                Game ballBase = new Game();
                ballBase.setName("Ballbase");
                gameRepository.save(ballBase);

                Game clock = new Game();
                clock.setName("Horloge");
                gameRepository.save(clock);

                Game fastClock = new Game();
                fastClock.setName("Horloge Rapide");
                gameRepository.save(fastClock);

                Game geoJura = new Game();
                geoJura.setName("Geo Jura");
                gameRepository.save(geoJura);

                Game purpleStain = new Game();
                purpleStain.setName("Purple Stain");
                gameRepository.save(purpleStain);

                Game killer = new Game();
                killer.setName("Killer");
                gameRepository.save(killer);
            }
		};
	}

    @Bean
    CommandLineRunner seedPlater(UserRepository userRepository) {
        return args -> {
            if(userRepository.count() == 0) {
                User user = new User();
                user.setUsername("Remy");
                userRepository.save(user);

                User user2 = new User();
                user2.setUsername("Armand");
                userRepository.save(user2);

                User user3 = new User();
                user3.setUsername("Romain");
                userRepository.save(user3);

                User user4 = new User();
                user4.setUsername("Tristan");
                userRepository.save(user4);

                User user5 = new User();
                user5.setUsername("Gaïan");
                userRepository.save(user5);
            }
        };
    }

}
