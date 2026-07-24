// Ozone: the target is split into named zones (four number ranges plus
// bull/demi-bulle). The app doesn't simulate darts or verify how many it
// took — players know the rules and manage that themselves at the board.
// One tap on a zone just takes it outright, whether it was neutral or
// somebody else's. A turn allows at most 3 taps (one per dart, so at most 3
// zones a turn, however lucky the throw). First player to own every zone
// wins outright.
//
// The classic 1v1 variant is just that. The 3+ players variant
// (config.threeMonts / config.killianSauveur) adds two rules on top:
//   - A 6th zone, "3 Monts" — same as any other zone here, just part of the
//     set a player needs to own everything of. The rule that a triple must
//     go there first is on the players to self-enforce, same as the
//     neutral/adversary dart counts are.
//   - Once every zone has an owner (no neutral left), a player reduced to 0
//     zones is normally eliminated — except the whole match allows exactly
//     ONE save, ever ("Killian sauveur"), and only while 3+ players are
//     still in the game (never in the final 2). Whoever first qualifies
//     gets one inserted bonus turn to reclaim at least one zone; succeed or
//     fail, that's the match's one save, spent either way.
// Turn order (including the elimination skip and the inserted bonus turn)
// and both undo levels are the shared game-turn-engine.js — this file owns
// the zone list, ownership, and the elimination/sauveur state machine.
function startOzoneBoard(config) {
    document.addEventListener('DOMContentLoaded', function () {
        var panels = Array.prototype.slice.call(document.querySelectorAll('.ozone-panel'));
        if (!panels.length) {
            return;
        }

        var ZONES = [
            {name: 'La Fontaine Saint-Martin', range: '1 - 5'},
            {name: 'Mansigné', range: '6 - 10'},
            {name: 'Cérans-Foulletourte', range: '11 - 15'},
            {name: 'Le Mans', range: '16 - 20'},
            {name: 'Oizé', range: 'Bulle & demi-bulle'}
        ];
        if (config.threeMonts) {
            ZONES.push({name: '3 Monts', range: 'Toutes les cases triples'});
        }

        var zoneBoxes = ZONES.map(function (zone, i) {
            var box = document.querySelector('.ozone-zone[data-index="' + i + '"]');
            box.querySelector('[data-role="range"]').textContent = zone.range;
            return box;
        });
        // The template always has a 6th "3 Monts" button so both variants
        // share one file — hide it outright for the classic 1v1 game.
        if (!config.threeMonts) {
            var extraBox = document.querySelector('.ozone-zone[data-index="5"]');
            if (extraBox) {
                extraBox.hidden = true;
            }
        }

        var sauveurBanner = document.querySelector('[data-role="sauveur-banner"]');

        var players = panels.map(function (panel) {
            return {
                id: panel.dataset.playerId,
                name: panel.dataset.playerName,
                panel: panel,
                turnsEl: panel.querySelector('[data-role="turns"]'),
                statusEl: panel.querySelector('[data-role="status"]'),
                turns: 0
            };
        });

        // Shared, not per-player, and permanent (persists turn to turn).
        // Folded into captureState/applyState below so both undo levels
        // revert it correctly.
        var owners = ZONES.map(function () {
            return null;
        });
        var eliminated = players.map(function () {
            return false;
        });
        var killianSauveurUsed = false;
        // Set the instant a player hits 0 zones and qualifies for the save —
        // consumed by nextActiveIndex, which redirects the very next turn to
        // them and moves the marker into sauveurResolving.
        var pendingSauveur = null;
        // Set while that inserted bonus turn is in progress; checked (and
        // cleared) by beforeCommit the moment it ends, to decide saved vs
        // eliminated.
        var sauveurResolving = null;

        function ownedZoneCount(playerIndex) {
            return owners.filter(function (owner) {
                return owner === playerIndex;
            }).length;
        }

        function allZonesClaimed() {
            return owners.every(function (owner) {
                return owner !== null;
            });
        }

        function ownsEverything(playerIndex) {
            return owners.every(function (owner) {
                return owner === playerIndex;
            });
        }

        function render(ctx) {
            players.forEach(function (player, index) {
                player.turnsEl.textContent = 'Tours : ' + player.turns;
                player.panel.classList.toggle('ozone-eliminated', eliminated[index]);
                player.statusEl.hidden = !eliminated[index];
            });

            if (sauveurBanner) {
                var resolvingPlayer = sauveurResolving !== null ? players[sauveurResolving] : null;
                sauveurBanner.hidden = !resolvingPlayer || ctx.gameOver;
                if (resolvingPlayer) {
                    sauveurBanner.textContent = resolvingPlayer.name + ' tente le Killian Sauveur !';
                }
            }

            ZONES.forEach(function (zone, zoneIndex) {
                var box = zoneBoxes[zoneIndex];
                var owner = owners[zoneIndex];
                var isMine = owner === ctx.activeIndex;
                var isTheirs = owner !== null && !isMine;

                box.classList.toggle('ozone-mine', isMine);
                box.classList.toggle('ozone-theirs', isTheirs);
                box.classList.toggle('ozone-neutral', owner === null);
                box.disabled = ctx.gameOver || isMine;
            });
        }

        var engine = createTurnEngine({
            players: players,
            focusable: false,
            maxClicksPerTurn: 3,
            captureState: function () {
                return {
                    owners: owners.slice(),
                    eliminated: eliminated.slice(),
                    killianSauveurUsed: killianSauveurUsed,
                    pendingSauveur: pendingSauveur,
                    sauveurResolving: sauveurResolving
                };
            },
            applyState: function (player, state) {
                owners = state.owners;
                eliminated = state.eliminated;
                killianSauveurUsed = state.killianSauveurUsed;
                pendingSauveur = state.pendingSauveur;
                sauveurResolving = state.sauveurResolving;
            },
            render: render,
            nextActiveIndex: function (activeIndex) {
                if (pendingSauveur !== null) {
                    var chosen = pendingSauveur;
                    pendingSauveur = null;
                    sauveurResolving = chosen;
                    return chosen;
                }
                var next = activeIndex;
                do {
                    next = (next + 1) % players.length;
                } while (eliminated[next]);
                return next;
            },
            beforeCommit: function (player) {
                if (!config.killianSauveur) {
                    return;
                }

                var activeIdx = players.indexOf(player);

                if (sauveurResolving === activeIdx) {
                    killianSauveurUsed = true;
                    if (ownedZoneCount(activeIdx) === 0) {
                        eliminated[activeIdx] = true;
                    }
                    sauveurResolving = null;
                }

                if (!allZonesClaimed()) {
                    return;
                }

                players.forEach(function (p, idx) {
                    if (eliminated[idx] || idx === sauveurResolving || ownedZoneCount(idx) > 0) {
                        return;
                    }
                    var stillInGame = players.filter(function (_, i) {
                        return !eliminated[i];
                    }).length;
                    if (stillInGame >= 3 && !killianSauveurUsed && pendingSauveur === null) {
                        pendingSauveur = idx;
                    } else {
                        eliminated[idx] = true;
                    }
                });
            }
        });

        function populateWinOverlay(overlay, player) {
            overlay.querySelector('[data-role="winner-detail"]').textContent =
                player.turns + (player.turns > 1 ? ' tours pour gagner' : ' tour pour gagner');
            overlay.querySelector('[data-role="winner-input"]').value = player.id;
            overlay.querySelector('[data-role="result-input"]').value = player.turns;
        }

        ZONES.forEach(function (zone, zoneIndex) {
            zoneBoxes[zoneIndex].addEventListener('click', function (e) {
                e.stopPropagation();
                var activeIndex = engine.getActiveIndex();
                if (!engine.canAct(activeIndex) || owners[zoneIndex] === activeIndex) {
                    return;
                }

                var player = players[activeIndex];
                engine.recordClick(player);
                owners[zoneIndex] = activeIndex;

                if (ownsEverything(activeIndex)) {
                    engine.declareWinner(player, populateWinOverlay);
                    return;
                }

                engine.render();
            });
        });
    });
}

var OZONE_VARIANTS = {
    ozone: {threeMonts: false, killianSauveur: false},
    'ozone-3p': {threeMonts: true, killianSauveur: true}
};

var variantEl = document.querySelector('[data-variant]');
if (variantEl) {
    startOzoneBoard(OZONE_VARIANTS[variantEl.dataset.variant]);
}
