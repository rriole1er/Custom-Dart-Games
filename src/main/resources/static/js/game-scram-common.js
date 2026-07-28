// Scram: stopping side can close any of the 21 targets (1-20 + bull) in any
// order. Meanwhile, the attacking side taps the same board's still-open
// targets to rack up penalties. Once the board is fully closed, it's handed
// to the next side for a fresh round on a freshly reopened board; the match
// ends when the last round's stopping side clears it too.
//
// Penalties inflicted stay a personal tally per attacking player. Penalties
// received are pooled. A round's stopper is a single player in
// rotating-solo, so that pooled number IS their personal number; in
// fixed-teams it's shared by both teammates. Scram's score belongs to whoever failed to close fast
function startScramBoard(config) {
    document.addEventListener('DOMContentLoaded', function () {
        const panels = Array.prototype.slice.call(document.querySelectorAll('.scram-panel'));
        if (!panels.length) {
            return;
        }

        const TARGETS = [];
        for (let n = 1; n <= 20; n++) {
            TARGETS.push(String(n));
        }
        TARGETS.push('B');

        const boxes = {};
        TARGETS.forEach(function (target, i) {
            boxes[i] = document.querySelector('.scram-box[data-index="' + i + '"]');
        });

        const stopperNameEl = document.querySelector('[data-role="stopper-name"]');
        const attackerNameEl = document.querySelector('[data-role="attacker-name"]');
        const gameOverOverlay = document.querySelector('[data-role="game-over"]');

        // Shared board, not per-player — reset and handed to the next
        // round's stopping side when a round ends.
        let roundIndex = 0;
        let closedFlags = TARGETS.map(function () {
            return false;
        });

        // Roster in template/DOM order.
        const roster = panels.map(function (panel) {
            return {
                id: panel.dataset.playerId,
                name: panel.dataset.playerName,
                panel: panel,
                turnsEl: panel.querySelector('[data-role="turns"]'),
                roleEl: panel.querySelector('[data-role="role-tag"]'),
                receivedEl: panel.querySelector('[data-role="received-count"]'),
                inflictedEl: panel.querySelector('[data-role="inflicted-count"]'),
                penaltiesInflicted: 0,
                turns: 0
            };
        });

        let rounds;
        let turnOrder;

        if (config.mode === 'rotating-solo') {
            rounds = roster.map(function (player) {
                return {
                    stopper: [player],
                    attacker: roster.filter(function (p) {
                        return p !== player;
                    })
                };
            });
            turnOrder = roster.slice();
        } else {
            const teamSize = config.teamSize;
            const teamA = roster.slice(0, teamSize);
            const teamB = roster.slice(teamSize, teamSize * 2);
            rounds = [
                {stopper: teamA, attacker: teamB},
                {stopper: teamB, attacker: teamA}
            ];
            turnOrder = [];
            for (let t = 0; t < teamSize; t++) {
                turnOrder.push(teamA[t]);
                turnOrder.push(teamB[t]);
            }
        }

        // One received-penalty pool per round, not per player — see the
        // top-of-file note on why this still ends up personal in
        // rotating-solo (a round's stopper group there is just one player).
        let receivedByRound = rounds.map(function () {
            return 0;
        });

        // Since bull is a double, across 3 darts the most an attacker can tap it is 3 x 2 = 6
        let bullTapsThisTurn = 0;

        let nextIsStopperTurn = false;
        let lastAttacker = null;

        // Picks the next active player, alternating the stopper with the two attackers.
        function nextActiveIndex() {
            let chosen;
            if (nextIsStopperTurn) {
                chosen = currentRound().stopper[0];
                nextIsStopperTurn = false;
            } else {
                const attackers = currentRound().attacker;
                chosen = lastAttacker === attackers[0] ? attackers[1] : attackers[0];
                lastAttacker = chosen;
                nextIsStopperTurn = true;
            }
            return roster.indexOf(chosen);
        }

        // Returns the round currently in progress.
        function currentRound() {
            return rounds[roundIndex];
        }

        // True if the given player is on the stopping side this round.
        function isStopper(player) {
            return currentRound().stopper.indexOf(player) !== -1;
        }

        // The round where this player is the one stopping — every player is
        // the stopper in exactly one round, by construction above.
        function ownRoundIndex(player) {
            for (let r = 0; r < rounds.length; r++) {
                if (rounds[r].stopper.indexOf(player) !== -1) {
                    return r;
                }
            }
            return -1;
        }

        // True once every target on the board is closed.
        function allClosed() {
            return closedFlags.every(function (closed) {
                return closed;
            });
        }

        // Re-renders names, roles, penalty counts, and box states from current state.
        function render(ctx) {
            stopperNameEl.textContent = currentRound().stopper.map(function (p) {
                return p.name;
            }).join(' & ');
            attackerNameEl.textContent = currentRound().attacker.map(function (p) {
                return p.name;
            }).join(' & ');

            roster.forEach(function (player) {
                const stopping = isStopper(player);
                player.turnsEl.textContent = 'Tours : ' + player.turns;
                player.roleEl.textContent = stopping ? 'Stoppeur' : 'Attaquant';
                player.roleEl.classList.toggle('scram-role-stopper', stopping);
                player.roleEl.classList.toggle('scram-role-attacker', !stopping);
                player.receivedEl.textContent = 'Pénalités reçues : ' + receivedByRound[ownRoundIndex(player)];
                player.inflictedEl.textContent = 'Pénalités infligées : ' + player.penaltiesInflicted;
            });

            const activeIsStopper = isStopper(turnOrder[ctx.activeIndex]);
            TARGETS.forEach(function (target, i) {
                const box = boxes[i];
                const closed = closedFlags[i];
                box.classList.toggle('validated', closed);
                box.classList.toggle('scram-mode-stopper', !closed && activeIsStopper);
                box.classList.toggle('scram-mode-attacker', !closed && !activeIsStopper);
                box.disabled = !(!closed && !ctx.gameOver);
            });
        }

        const engine = createTurnEngine({
            players: turnOrder,
            focusable: false,
            // Stopper closes at most one number per dart (3 darts, 3 taps
            // max). Attacker scores classic dart values, so a triple needs 3
            // taps on the same open box — up to 9 across the turn.
            maxClicksPerTurn: function (activeIndex) {
                return isStopper(turnOrder[activeIndex]) ? 3 : 9;
            },
            // A tap adds value to two things at once (attacker's own
            // inflicted tally, the current round's pooled received tally) —
            // captured/restored on every snapshot regardless of which player
            // triggered it, same trick as the shared board below, so either
            // undo level reverts both sides of the hit.
            captureState: function () {
                return {
                    inflicted: roster.map(function (p) {
                        return p.penaltiesInflicted;
                    }),
                    receivedByRound: receivedByRound.slice(),
                    closedFlags: closedFlags.slice(),
                    roundIndex: roundIndex,
                    bullTapsThisTurn: bullTapsThisTurn
                };
            },
            applyState: function (player, state) {
                roster.forEach(function (p, index) {
                    p.penaltiesInflicted = state.inflicted[index];
                });
                receivedByRound = state.receivedByRound;
                closedFlags = state.closedFlags;
                roundIndex = state.roundIndex;
                bullTapsThisTurn = state.bullTapsThisTurn;
            },
            render: render,
            beforeCommit: function () {
                bullTapsThisTurn = 0;
                if (roundIndex < rounds.length - 1 && allClosed()) {
                    roundIndex += 1;
                    closedFlags = TARGETS.map(function () {
                        return false;
                    });
                    if (config.mode === 'rotating-solo') {
                        nextIsStopperTurn = true;
                        lastAttacker = null;
                    }
                }
            },
            checkGameEnd: function () {
                return roundIndex === rounds.length - 1 && allClosed();
            },
            populateGameEnd: populateGameEnd,
            nextActiveIndex: config.mode === 'rotating-solo' ? nextActiveIndex : undefined
        });

        // Fills the game-over overlay with the final round-by-round ranking.
        function populateGameEnd(overlay) {
            const minReceived = Math.min.apply(null, receivedByRound);
            const ranked = rounds.map(function (round, index) {
                return {stopper: round.stopper, received: receivedByRound[index]};
            }).sort(function (a, b) {
                return a.received - b.received;
            });
            populateRankedList(overlay, ranked.map(function (entry) {
                return {
                    name: entry.stopper.map(function (p) {
                        return p.name;
                    }).join(' & '),
                    value: entry.received,
                    isWinner: entry.received === minReceived
                };
            }));
        }

        TARGETS.forEach(function (target, i) {
            boxes[i].addEventListener('click', function (e) {
                e.stopPropagation();
                const activeIndex = engine.getActiveIndex();
                if (!engine.canAct(activeIndex) || closedFlags[i]) {
                    return;
                }

                const player = turnOrder[activeIndex];

                if (target === 'B' && !isStopper(player) && bullTapsThisTurn >= 6) {
                    return;
                }

                engine.recordClick(player);

                if (isStopper(player)) {
                    closedFlags[i] = true;
                } else {
                    const value = target === 'B' ? 25 : parseInt(target, 10);
                    player.penaltiesInflicted += value;
                    receivedByRound[roundIndex] += value;
                    if (target === 'B') {
                        bullTapsThisTurn += 1;
                    }
                }
                engine.render();
            });
        });

        wireSaveAllResults(roster, gameOverOverlay, function (player) {
            return receivedByRound[ownRoundIndex(player)];
        }, function (player) {
            return '&resultInflicted=' + encodeURIComponent(player.penaltiesInflicted);
        });
    });
}

// Variant handle
const SCRAM_VARIANTS = {
    scram: {mode: 'fixed-teams', teamSize: 1},
    'scram-2v2': {mode: 'fixed-teams', teamSize: 2},
    'scram-2v1': {mode: 'rotating-solo'}
};

const variantEl = document.querySelector('[data-variant]');
if (variantEl) {
    startScramBoard(SCRAM_VARIANTS[variantEl.dataset.variant]);
}
