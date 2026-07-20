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
				cricket.setDescription(
						"Les cibles valables sont uniquement les nombres 15, 16, 17, 18, 19, 20 et la bulle. Dès qu'un joueur place trois marques dans un même nombre, celui-ci est ouvert pour lui. Un joueur marque des points en touchant un nombre qu'il a ouvert. Il peut aussi fermer les nombres de ses adversaires en y plaçant à son tour trois marques, les rendant alors invalides pour marquer. La partie se termine lorsque tous les nombres sont fermés ou que la limite de tours est atteinte ; le joueur ayant le plus de points remporte la partie.");
				cricket.setScoreBasedOnTurn(true);
				gameRepository.save(cricket);

				Game cricketHonor = new Game();
				cricketHonor.setName("Cricket Honneur");
				cricketHonor.setDescription(
						"Ce jeu reprend les règles du Cricket, mais l'objectif est ici d'avoir le moins de points possible. L'accent est mis sur la rapidité à fermer les nombres plutôt que sur l'accumulation de points : le joueur qui termine la partie avec le score le plus bas gagne.");
				cricketHonor.setScoreBasedOnTurn(false);
				gameRepository.save(cricketHonor);

				Game fiveOhOne = new Game();
				fiveOhOne.setName("501");
				fiveOhOne.setDescription(
						"Chaque joueur commence la partie avec un capital de 501 points. Après chaque volée, le total des points marqués est soustrait de ce score. L'objectif est d'atteindre exactement zéro.\n"
								+ "\n"
								+ "La particularité du 501 réside dans la règle du double de sortie : le dernier lancer doit obligatoirement toucher un double. Par exemple, s'il reste 20 points à un joueur, il devra viser un double 10 pour gagner. S'il ne réalise qu'un simple 10, il lui restera 10 points et devra alors viser un double 5.\n"
								+ "\n"
								+ "Si un joueur dépasse le score restant, ou atteint zéro sans terminer par un double, on parle de « bust » : la volée est annulée et le joueur revient à son score d'avant le tour.");
				fiveOhOne.setScoreBasedOnTurn(true);
				gameRepository.save(fiveOhOne);

				Game threeOhOne = new Game();
				threeOhOne.setName("301");
				threeOhOne.setDescription("Se joue selon les mêmes règles que le 501, avec un score de départ de 301.");
				threeOhOne.setScoreBasedOnTurn(true);
				gameRepository.save(threeOhOne);

				Game oneOhOne = new Game();
				oneOhOne.setName("101");
				oneOhOne.setDescription("Se joue selon les mêmes règles que le 501, avec un score de départ de 101.");
				oneOhOne.setScoreBasedOnTurn(true);
				gameRepository.save(oneOhOne);

				Game scram = new Game();
				scram.setName("Scram");
				scram.setDescription(
						"Ce jeu se joue avec un attaquant et un stoppeur. Il reprend le principe de l'Horloge Rapide : le stoppeur doit fermer tous les nombres une seule fois pour arrêter la manche. Tant qu'il n'a pas fermé tous les nombres, la partie continue et l'attaquant marque le plus de points possible sur les zones encore ouvertes. Une fois tout fermé, les rôles s'inversent. Le joueur ayant le plus de points à la fin de la partie gagne.");
				scram.setScoreBasedOnTurn(false);
				gameRepository.save(scram);

				Game scram2 = new Game();
				scram2.setName("Scram 2vs2");
				scram2.setDescription(
						"Une variante du Scram à 4 joueurs, avec deux stoppeurs et deux attaquants. Le principe reste le même, mais en équipe : le rôle d'attaquant et celui de stoppeur sont chacun partagés entre deux joueurs.");
				scram2.setScoreBasedOnTurn(false);
				gameRepository.save(scram2);

				Game scram3 = new Game();
				scram3.setName("Scram 2vs1");
				scram3.setDescription(
						"Une variante du Scram à 3 joueurs, avec un stoppeur et deux attaquants. Le principe reste le même, mais les deux attaquants jouent en équipe.");
				scram3.setScoreBasedOnTurn(false);
				gameRepository.save(scram3);

				Game ozone = new Game();
				ozone.setName("Ozone");
				ozone.setDescription(
						"Ce jeu est inspiré du « Hot Zone » : le premier joueur à posséder toutes les zones de la cible gagne. Le découpage des zones est le suivant :\n"
								+ "\n" + "- 1 à 5 : « La Fontaine Saint-Martin »\n" + "- 6 à 10 : « Mansigné »\n"
								+ "- 11 à 15 : « Cérans-Foulletourte »\n" + "- 16 à 20 : « Le Mans »\n"
								+ "- Bulle et demi-bulle : « Oizé »\n" + "\n"
								+ "Ces noms sont des références directes aux créateurs du jeu. Il faut 2 fléchettes pour prendre une zone neutre, et 3 pour prendre une zone adverse. Un double compte comme 2 fléchettes dans la zone visée, et un triple permet de voler directement n'importe quelle zone, neutre ou adverse. Le premier joueur à posséder toutes les zones remporte la manche et marque 1 point.\n"
								+ "\n"
								+ "Le nombre de points nécessaires pour gagner la partie est fixé par les joueurs avant de commencer (une seule manche par défaut).");
				ozone.setScoreBasedOnTurn(true);
				gameRepository.save(ozone);

				Game ozone3 = new Game();
				ozone3.setName("Ozone +3 joueurs");
				ozone3.setDescription(
						"Une variante de l'Ozone à 3 joueurs ou plus. On y ajoute une zone « 3 Monts », qui regroupe l'ensemble des cases triples. Un joueur marquant un triple doit obligatoirement prendre la zone « 3 Monts » s'il ne la possède pas encore ; une fois qu'il la possède, un triple lui permet de voler normalement n'importe quelle autre zone. Lorsqu'il ne reste plus de zone neutre, une règle spéciale s'applique : le Killian sauveur. Un joueur qui n'occupe plus aucune zone est normalement éliminé, mais il peut bénéficier une fois par partie du Killian sauveur : il obtient alors un tour supplémentaire pour tenter de reprendre une ou plusieurs zones à ses adversaires et rester en lice. S'il échoue, ou se retrouve à nouveau sans zone occupée, il quitte la partie jusqu'à ce qu'un joueur remporte la manche. Le Killian sauveur ne s'applique que lorsque 3 joueurs ou plus sont encore en jeu (pas en 1 contre 1, ni pour les 2 derniers joueurs d'une partie qui en comptait 3 ou plus).");
				ozone3.setScoreBasedOnTurn(true);
				gameRepository.save(ozone3);

				Game baseBall = new Game();
				baseBall.setName("Baseball");
				baseBall.setDescription(
						"Cette partie se joue en visant les nombres de 1 à 9 sur la cible. Le but est de marquer le plus de points possible : à chaque tour, le nombre à viser change en montant progressivement jusqu'au 9. Un triple vaut 3 points, un double 2 points et un simple 1 point. Les scores ne sont volontairement pas affichés pendant la partie, afin qu'aucun joueur ne connaisse le score de ses adversaires ; les vainqueurs ne sont révélés qu'à la fin. La partie se termine après le tour du 9.");
				baseBall.setScoreBasedOnTurn(false);
				gameRepository.save(baseBall);

				Game ballBase = new Game();
				ballBase.setName("Ballbase");
				ballBase.setDescription(
						"Une variante du Baseball à l'envers : les joueurs commencent au 9 et redescendent jusqu'au 1.");
				ballBase.setScoreBasedOnTurn(false);
				gameRepository.save(ballBase);

				Game clock = new Game();
				clock.setName("Horloge");
				clock.setDescription(
						"Les joueurs doivent toucher les numéros dans l'ordre, en commençant par le 1, puis le 2, et ainsi de suite jusqu'au 20. Pour valider un secteur, il faut y inscrire 3 points : un triple compte pour 3, un double pour 2 et un simple pour 1. Une fois tous les secteurs validés, il faut toucher la bulle pour remporter la partie.");
				clock.setScoreBasedOnTurn(true);
				gameRepository.save(clock);

				Game fastClock = new Game();
				fastClock.setName("Horloge Rapide");
				fastClock.setDescription(
						"Reprend le même principe que l'Horloge, mais une seule fléchette touchant le nombre suffit pour le valider.");
				fastClock.setScoreBasedOnTurn(true);
				gameRepository.save(fastClock);

				Game geoJura = new Game();
				geoJura.setName("Geo Jura");
				geoJura.setDescription(
						"Ce jeu consiste à tester les connaissances géographiques des départements français. Chaque joueur lance à tour de rôle ses 3 fléchettes : la somme des 3 valeurs obtenues correspond au numéro d'un département, qu'il faut nommer. Si un adversaire trouve le bon département, il marque 1 point. Le premier joueur à atteindre 10 points gagne.");
				geoJura.setScoreBasedOnTurn(true);
				gameRepository.save(geoJura);

				Game purpleStain = new Game();
				purpleStain.setName("Purple Stain");
				purpleStain.setDescription(
						"Un joueur lance une fléchette pour définir une zone cible. Le premier joueur à toucher cette même zone remporte le point. Chaque nombre est divisé en deux zones : le cercle intérieur (petit) et le cercle extérieur (grand). Les doubles, triples, la demi-bulle et la bulle sont également des zones jouables.");
				purpleStain.setScoreBasedOnTurn(true);
				gameRepository.save(purpleStain);

				Game killer = new Game();
				killer.setName("Killer");
				killer.setDescription(
						"Chaque joueur commence par lancer une fléchette avec sa main non dominante afin de déterminer son secteur, appelé « camp ». Une fois tous les camps attribués, chaque joueur doit marquer un double dans son propre camp pour devenir « killer ». Il peut alors viser les camps des autres joueurs pour les « tuer », en y touchant à son tour un double.");
				killer.setScoreBasedOnTurn(true);
				gameRepository.save(killer);
			}
		};
	}

	@Bean
	CommandLineRunner seedPlater(UserRepository userRepository) {
		return args -> {
			if (userRepository.count() == 0) {
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
