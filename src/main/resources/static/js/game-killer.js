// Killer:
// Phase 1: every player, in turn, taps one still-unclaimed camp to claim it.
// Already-claimed camps are dimmed and untappable, but never say who owns
// them, nobody's camp number is ever revealed to anyone else.
//
// Phase 2 : On your turn, until you've become a killer, the board is
// showing YOUR OWN camp plus a single "J'ai touché !" button.

// Phase 3 : Every camp is tappable, none of them labeled: tap the right
// one (a still-alive opponent's) and they're eliminated outright; tap the
// wrong one and your turn ends immediately

document.addEventListener('DOMContentLoaded', function () {
    const panels = Array.prototype.slice.call(document.querySelectorAll('.killer-panel'));
    if (!panels.length) {
        return;
    }

    const CAMP_COUNT = 20;

    const boardWrap = document.querySelector('[data-role="board-wrap"]');
    const boardCaption = document.querySelector('[data-role="board-caption"]');
    const targetBanner = document.querySelector('[data-role="target-banner"]');
    const targetLabelEl = document.querySelector('[data-role="target-label"]');
    const turnActions = document.querySelector('.keypad-actions');

    // Every ring belonging to camp N shares data-zone="N" — group them so a
    // single render pass can toggle the whole camp's dimmed/tappable state
    // at once.
    const campZoneGroups = [];
    for (let n = 1; n <= CAMP_COUNT; n++) {
        campZoneGroups.push(Array.prototype.slice.call(
            document.querySelectorAll('.killer-zone[data-zone="' + n + '"]')));
    }

    // Shared, not per-player — which player (if any) owns each camp.
    // Permanent once assigned. Folded into captureState/applyState below so
    // both undo levels revert it correctly.
    const camps = campZoneGroups.map(function () {
        return {owner: null};
    });

    // Display players
    const players = panels.map(function (panel) {
        return {
            id: panel.dataset.playerId,
            name: panel.dataset.playerName,
            panel: panel,
            turnsEl: panel.querySelector('[data-role="turns"]'),
            killerTag: panel.querySelector('[data-role="killer-tag"]'),
            hintEl: panel.querySelector('[data-role="hint"]'),
            statusEl: panel.querySelector('[data-role="status"]'),
            achieveBtn: panel.querySelector('[data-role="achieve-btn"]'),
            isKiller: false,
            alive: true,
            turns: 0
        };
    });

    // Whether every player has claimed a camp.
    function allCampsAssigned() {
        return players.every(function (player, index) {
            return camps.some(function (camp) {
                return camp.owner === index;
            });
        });
    }

    // Returns the camp number owned by a player, or null if unassigned.
    function campNumberOf(playerIndex) {
        for (let i = 0; i < camps.length; i++) {
            if (camps[i].owner === playerIndex) {
                return String(i + 1);
            }
        }
        return null;
    }

    // Counts players still alive.
    function aliveCount() {
        return players.filter(function (p) {
            return p.alive;
        }).length;
    }

    // Determines the active player's current phase: assign, hunt, or aim-own.
    function currentPhase(activeIndex) {
        if (!allCampsAssigned()) {
            return 'assign';
        }
        return players[activeIndex].isKiller ? 'hunt' : 'aim-own';
    }

    // Renders the board, banner, and player panels for the current turn.
    function render(ctx) {
        const phase = currentPhase(ctx.activeIndex);

        boardWrap.hidden = ctx.gameOver || phase === 'aim-own';
        targetBanner.hidden = ctx.gameOver || phase !== 'aim-own';
        if (phase === 'aim-own') {
            targetLabelEl.textContent = campNumberOf(ctx.activeIndex);
        }
        boardCaption.textContent = phase === 'hunt'
            ? 'Vise le camp d’un adversaire — une erreur termine ton tour'
            : 'Choisis ton camp sur la cible';
        // Camp selection auto-commits per tap
        turnActions.hidden = phase === 'assign';

        players.forEach(function (player, index) {
            const isMyTurn = index === ctx.activeIndex && !ctx.gameOver;

            player.turnsEl.textContent = 'Tours : ' + player.turns;
            player.panel.classList.toggle('killer-eliminated', !player.alive);
            player.statusEl.hidden = player.alive;
            player.killerTag.hidden = !player.isKiller;

            let hint = '';
            if (isMyTurn && phase === 'assign') {
                hint = 'Choisis ton camp sur la cible';
            } else if (isMyTurn && phase === 'hunt') {
                hint = 'Choisis le camp d’un adversaire — une erreur termine ton tour';
            }
            player.hintEl.textContent = hint;
            player.hintEl.hidden = !hint;

            player.achieveBtn.hidden = ctx.gameOver || !player.alive || phase !== 'aim-own';
            player.achieveBtn.disabled = !isMyTurn;
        });

        const assigned = phase !== 'assign';
        camps.forEach(function (camp, i) {
            const dimmed = !assigned && camp.owner !== null;
            campZoneGroups[i].forEach(function (el) {
                el.classList.toggle('killer-zone-disabled', ctx.gameOver || dimmed);
            });
        });
    }

    // Turn engine
    const engine = createTurnEngine({
        players: players,
        focusable: false,
        maxClicksPerTurn: 3,
        captureState: function () {
            return {
                campOwners: camps.map(function (c) {
                    return c.owner;
                }),
                isKiller: players.map(function (p) {
                    return p.isKiller;
                }),
                alive: players.map(function (p) {
                    return p.alive;
                })
            };
        },
        // cache state
        applyState: function (player, state) {
            camps.forEach(function (c, i) {
                c.owner = state.campOwners[i];
            });
            players.forEach(function (p, i) {
                p.isKiller = state.isKiller[i];
                p.alive = state.alive[i];
            });
        },
        render: render,
        nextActiveIndex: function (activeIndex) {
            return nextAliveIndex(activeIndex, players);
        }
    });

    // Fills the win overlay with the winner's turn count.
    function populateWinOverlay(overlay, player) {
        populateWinnerFields(overlay, player, 'Dernier survivant en ' + player.turns + ' ' + toursWord(player.turns));
    }

    campZoneGroups.forEach(function (group, campIndex) {
        group.forEach(function (el) {
            el.addEventListener('click', function (e) {
                e.stopPropagation();
                const activeIndex = engine.getActiveIndex();
                if (!engine.canAct(activeIndex)) {
                    return;
                }

                const player = players[activeIndex];

                if (!allCampsAssigned()) {
                    if (camps[campIndex].owner !== null) {
                        return;
                    }
                    camps[campIndex].owner = activeIndex;
                    engine.commitTurn();
                    engine.render();
                    return;
                }

                if (!player.isKiller) {
                    // The board isn't shown before you're a killer — the
                    // banner + button phase covers that case instead.
                    return;
                }

                engine.recordClick(player);

                const ownerIndex = camps[campIndex].owner;
                if (ownerIndex !== null && ownerIndex !== activeIndex && players[ownerIndex].alive) {
                    players[ownerIndex].alive = false;

                    if (aliveCount() === 1) {
                        engine.declareWinner(player, populateWinOverlay);
                        return;
                    }
                    engine.render();
                } else {
                    // Wrong target (nobody's camp, your own, or an already-
                    // eliminated one) — the turn ends right there, no more
                    // attempts.
                    engine.commitTurn();
                    engine.render();
                }
            });
        });
    });

    players.forEach(function (player, index) {
        player.achieveBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            if (!engine.canAct(index) || player.isKiller) {
                return;
            }
            player.isKiller = true;
            engine.commitTurn();
            engine.render();
        });
    });
});
