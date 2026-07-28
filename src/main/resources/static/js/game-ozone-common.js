// Ozone: the target is split into named zones (four number ranges plus
// bull/demi-bulle).
// One tap on a zone just takes it outright, whether it was neutral or
// somebody else's. A turn allows at most 3 taps.
// First player to own every zonewins outright.
//
// The classic 1v1 variant is just that. The 3+ players variant adds two rules on top:
//   - A 6th zone, "3 Monts" : same as any other zone here, just part of the
//     set a player needs to own everything of. The rule that a triple must
//     go there first is on.
//   - Once every zone has an owner (no neutral left), a player reduced to 0
//     zones is normally eliminated — except the whole match allows exactly
//     ONE save  and only while 3+ players are still in the game.


function startOzoneBoard(config) {
    document.addEventListener('DOMContentLoaded', function () {
        const panels = Array.prototype.slice.call(document.querySelectorAll('.ozone-panel'));
        if (!panels.length) {
            return;
        }

        const ZONES = [
            {name: 'La Fontaine Saint-Martin', range: '1 - 5'},
            {name: 'Mansigné', range: '6 - 10'},
            {name: 'Cérans-Foulletourte', range: '11 - 15'},
            {name: 'Le Mans', range: '16 - 20'},
            {name: 'Oizé', range: 'Bulle & demi-bulle'}
        ];
        if (config.threeMonts) {
            ZONES.push({name: '3 Monts', range: 'Toutes les cases triples'});
        }

        const zoneBoxes = ZONES.map(function (zone, i) {
            const box = document.querySelector('.ozone-zone[data-index="' + i + '"]');
            box.querySelector('[data-role="range"]').textContent = zone.range;
            return box;
        });
        // The template always has a 6th "3 Monts" button so both variants
        // share one file — hide it outright for the classic 1v1 game.
        if (!config.threeMonts) {
            const extraBox = document.querySelector('.ozone-zone[data-index="5"]');
            if (extraBox) {
                extraBox.hidden = true;
            }
        }

        const sauveurBanner = document.querySelector('[data-role="sauveur-banner"]');

        const players = panels.map(function (panel) {
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
        let owners = ZONES.map(function () {
            return null;
        });
        let eliminated = players.map(function () {
            return false;
        });
        let killianSauveurUsed = false;
        // Set the instant a player hits 0 zones and qualifies for the save —
        // consumed by nextActiveIndex, which redirects the very next turn to
        // them and moves the marker into sauveurResolving.
        let pendingSauveur = null;
        // Set while that inserted bonus turn is in progress; checked (and
        // cleared) by beforeCommit the moment it ends, to decide saved vs
        // eliminated.
        let sauveurResolving = null;

        // Counts how many zones a given player currently owns.
        function ownedZoneCount(playerIndex) {
            return owners.filter(function (owner) {
                return owner === playerIndex;
            }).length;
        }

        // Whether every zone has a non-null owner.
        function allZonesClaimed() {
            return owners.every(function (owner) {
                return owner !== null;
            });
        }

        // Whether the given player owns every zone (win condition).
        function ownsEverything(playerIndex) {
            return owners.every(function (owner) {
                return owner === playerIndex;
            });
        }

        // Redraws player panels, sauveur banner, and zone box states.
        function render(ctx) {
            players.forEach(function (player, index) {
                player.turnsEl.textContent = 'Tours : ' + player.turns;
                player.panel.classList.toggle('ozone-eliminated', eliminated[index]);
                player.statusEl.hidden = !eliminated[index];
            });

            if (sauveurBanner) {
                const resolvingPlayer = sauveurResolving !== null ? players[sauveurResolving] : null;
                sauveurBanner.hidden = !resolvingPlayer || ctx.gameOver;
                if (resolvingPlayer) {
                    sauveurBanner.textContent = resolvingPlayer.name + ' tente le Killian Sauveur !';
                }
            }

            ZONES.forEach(function (zone, zoneIndex) {
                const box = zoneBoxes[zoneIndex];
                const owner = owners[zoneIndex];
                const isMine = owner === ctx.activeIndex;
                const isTheirs = owner !== null && !isMine;

                box.classList.toggle('ozone-mine', isMine);
                box.classList.toggle('ozone-theirs', isTheirs);
                box.classList.toggle('ozone-neutral', owner === null);
                box.disabled = ctx.gameOver || isMine;
            });
        }

        // Turn engine
        const engine = createTurnEngine({
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
            // Cache state
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
                    const chosen = pendingSauveur;
                    pendingSauveur = null;
                    sauveurResolving = chosen;
                    return chosen;
                }
                let next = activeIndex;
                do {
                    next = (next + 1) % players.length;
                } while (eliminated[next]);
                return next;
            },
            beforeCommit: function (player) {
                if (!config.killianSauveur) {
                    return;
                }

                const activeIdx = players.indexOf(player);

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
                    const stillInGame = players.filter(function (_, i) {
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

        // Fills the win overlay with this player's turn count.
        function populateWinOverlay(overlay, player) {
            populateWinnerFields(overlay, player, player.turns + ' ' + toursWord(player.turns) + ' pour gagner');
        }

        ZONES.forEach(function (zone, zoneIndex) {
            zoneBoxes[zoneIndex].addEventListener('click', function (e) {
                e.stopPropagation();
                const activeIndex = engine.getActiveIndex();
                if (!engine.canAct(activeIndex) || owners[zoneIndex] === activeIndex) {
                    return;
                }

                const player = players[activeIndex];
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

// Variant handling
const OZONE_VARIANTS = {
    ozone: {threeMonts: false, killianSauveur: false},
    'ozone-3p': {threeMonts: true, killianSauveur: true}
};

const variantEl = document.querySelector('[data-variant]');
if (variantEl) {
    startOzoneBoard(OZONE_VARIANTS[variantEl.dataset.variant]);
}
