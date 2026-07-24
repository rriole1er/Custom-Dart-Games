// Scram: reuses Fast Clock's "single tap closes a number" principle, but on
// ONE shared board instead of two independent ones, and with no forced order
// — the stopping side can close any of the 21 targets (1-20 + bull) in any
// order. Meanwhile the attacking side taps the same board's still-open
// targets to rack up penalties. Once the board is fully closed, it's handed
// to the next side for a fresh round on a freshly reopened board; the match
// ends when the last round's stopping side clears it too. A penalty is worth
// the box's own classic dart value (an open 20 costs 20, the bull costs 25).
//
// The whole match is a sequence of "rounds" — each names which players are
// stopping and which are attacking. A variant just builds that sequence:
//   - fixed-teams (1v1, 2v2): the first teamSize players are one team, the
//     next teamSize the other. Exactly 2 rounds — team A stops, then team B.
//     Turn order interleaves the teams position by position (Player1,
//     Player3, Player2, Player4 for 2v2) so teammates never play back to
//     back; teamSize 1 collapses to the plain [P0, P1] order.
//   - rotating-solo (2v1): every player gets exactly one round as the SOLE
//     stopper against everyone else. As many rounds as players. Turn order
//     is just the plain roster order — the lone stopper's turns already fall
//     between the others' without needing any interleaving.
// Penalties inflicted stay a personal tally per attacking player. Penalties
// received are pooled onto whichever round is currently running (one number
// per round, not per player) — a round's stopper is a single player in
// rotating-solo, so that pooled number IS their personal number; in
// fixed-teams it's shared by both teammates. Either way, each player's own
// saved result is the received total from THEIR OWN round as stopper — since
// Scram's score belongs to whoever failed to close fast, not to whichever
// teammate happened to be holding the dart. Turn order and both undo levels
// are the shared game-turn-engine.js. Which variant is active comes from the
// template via a `data-variant` attribute, read once at the bottom of this
// file — same convention as game-cricket-common.js.
function startScramBoard(config) {
    document.addEventListener('DOMContentLoaded', function () {
        var panels = Array.prototype.slice.call(document.querySelectorAll('.scram-panel'));
        if (!panels.length) {
            return;
        }

        var TARGETS = [];
        for (var n = 1; n <= 20; n++) {
            TARGETS.push(String(n));
        }
        TARGETS.push('B');

        var boxes = {};
        TARGETS.forEach(function (target, i) {
            boxes[i] = document.querySelector('.scram-box[data-index="' + i + '"]');
        });

        var stopperNameEl = document.querySelector('[data-role="stopper-name"]');
        var attackerNameEl = document.querySelector('[data-role="attacker-name"]');
        var gameOverOverlay = document.querySelector('[data-role="game-over"]');

        // Shared board, not per-player — reset and handed to the next
        // round's stopping side when a round ends. Folded into
        // captureState/applyState below so undo correctly reverts a round
        // change too.
        var roundIndex = 0;
        var closedFlags = TARGETS.map(function () {
            return false;
        });

        // Roster in template/DOM order.
        var roster = panels.map(function (panel) {
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

        var rounds;
        var turnOrder;

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
            var teamSize = config.teamSize;
            var teamA = roster.slice(0, teamSize);
            var teamB = roster.slice(teamSize, teamSize * 2);
            rounds = [
                {stopper: teamA, attacker: teamB},
                {stopper: teamB, attacker: teamA}
            ];
            turnOrder = [];
            for (var t = 0; t < teamSize; t++) {
                turnOrder.push(teamA[t]);
                turnOrder.push(teamB[t]);
            }
        }

        // One received-penalty pool per round, not per player — see the
        // top-of-file note on why this still ends up personal in
        // rotating-solo (a round's stopper group there is just one player).
        var receivedByRound = rounds.map(function () {
            return 0;
        });

        // rotating-solo only: the lone stopper gets every other turn: the
        // slot in between alternates across the two attackers rather than
        // cycling the plain roster order (which would let the two attackers
        // play back to back). `nextIsStopperTurn` toggles every commit;
        // `lastAttacker` remembers who filled the attacker slot last so it
        // alternates. Both reset whenever a round changes, since a fresh
        // round always hands the very first turn to its own new stopper.
        var nextIsStopperTurn = false;
        var lastAttacker = null;

        function nextActiveIndex() {
            var chosen;
            if (nextIsStopperTurn) {
                chosen = currentRound().stopper[0];
                nextIsStopperTurn = false;
            } else {
                var attackers = currentRound().attacker;
                chosen = lastAttacker === attackers[0] ? attackers[1] : attackers[0];
                lastAttacker = chosen;
                nextIsStopperTurn = true;
            }
            return roster.indexOf(chosen);
        }

        function currentRound() {
            return rounds[roundIndex];
        }

        function isStopper(player) {
            return currentRound().stopper.indexOf(player) !== -1;
        }

        // The round where this player is the one stopping — every player is
        // the stopper in exactly one round, by construction above.
        function ownRoundIndex(player) {
            for (var r = 0; r < rounds.length; r++) {
                if (rounds[r].stopper.indexOf(player) !== -1) {
                    return r;
                }
            }
            return -1;
        }

        function allClosed() {
            return closedFlags.every(function (closed) {
                return closed;
            });
        }

        function render(ctx) {
            stopperNameEl.textContent = currentRound().stopper.map(function (p) {
                return p.name;
            }).join(' & ');
            attackerNameEl.textContent = currentRound().attacker.map(function (p) {
                return p.name;
            }).join(' & ');

            roster.forEach(function (player) {
                var stopping = isStopper(player);
                player.turnsEl.textContent = 'Tours : ' + player.turns;
                player.roleEl.textContent = stopping ? 'Stoppeur' : 'Attaquant';
                player.roleEl.classList.toggle('scram-role-stopper', stopping);
                player.roleEl.classList.toggle('scram-role-attacker', !stopping);
                player.receivedEl.textContent = 'Pénalités reçues : ' + receivedByRound[ownRoundIndex(player)];
                player.inflictedEl.textContent = 'Pénalités infligées : ' + player.penaltiesInflicted;
            });

            var activeIsStopper = isStopper(turnOrder[ctx.activeIndex]);
            TARGETS.forEach(function (target, i) {
                var box = boxes[i];
                var closed = closedFlags[i];
                box.classList.toggle('validated', closed);
                box.classList.toggle('scram-mode-stopper', !closed && activeIsStopper);
                box.classList.toggle('scram-mode-attacker', !closed && !activeIsStopper);
                box.disabled = !(!closed && !ctx.gameOver);
            });
        }

        var engine = createTurnEngine({
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
                    roundIndex: roundIndex
                };
            },
            applyState: function (player, state) {
                roster.forEach(function (p, index) {
                    p.penaltiesInflicted = state.inflicted[index];
                });
                receivedByRound = state.receivedByRound;
                closedFlags = state.closedFlags;
                roundIndex = state.roundIndex;
            },
            render: render,
            beforeCommit: function () {
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

        function populateGameEnd(overlay) {
            var minReceived = Math.min.apply(null, receivedByRound);
            var ranked = rounds.map(function (round, index) {
                return {stopper: round.stopper, received: receivedByRound[index]};
            }).sort(function (a, b) {
                return a.received - b.received;
            });

            var list = overlay.querySelector('[data-role="final-ranking"]');
            list.innerHTML = '';
            ranked.forEach(function (entry) {
                var isWinner = entry.received === minReceived;
                var row = document.createElement('div');
                row.className = 'baseball-rank-row' + (isWinner ? ' winner' : '');

                var name = document.createElement('span');
                name.className = 'baseball-rank-name';
                name.textContent = entry.stopper.map(function (p) {
                    return p.name;
                }).join(' & ') + (isWinner ? ' 🏆' : '');

                var score = document.createElement('span');
                score.className = 'baseball-rank-score';
                score.textContent = entry.received;

                row.appendChild(name);
                row.appendChild(score);
                list.appendChild(row);
            });
        }

        TARGETS.forEach(function (target, i) {
            boxes[i].addEventListener('click', function (e) {
                e.stopPropagation();
                var activeIndex = engine.getActiveIndex();
                if (!engine.canAct(activeIndex) || closedFlags[i]) {
                    return;
                }

                var player = turnOrder[activeIndex];
                engine.recordClick(player);

                if (isStopper(player)) {
                    closedFlags[i] = true;
                } else {
                    var value = target === 'B' ? 25 : parseInt(target, 10);
                    player.penaltiesInflicted += value;
                    receivedByRound[roundIndex] += value;
                }
                engine.render();
            });
        });

        document.querySelector('[data-action="save-all-results"]').addEventListener('click', function (e) {
            var btn = e.currentTarget;
            btn.disabled = true;
            var gameId = gameOverOverlay.dataset.gameId;
            Promise.all(roster.map(function (player) {
                return fetch('/dart/play/finish', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                    body: 'gameId=' + encodeURIComponent(gameId) + '&userId=' + encodeURIComponent(player.id)
                        + '&result=' + encodeURIComponent(receivedByRound[ownRoundIndex(player)])
                        + '&resultInflicted=' + encodeURIComponent(player.penaltiesInflicted)
                });
            })).then(function () {
                window.location.href = '/dart/play';
            });
        });
    });
}

var SCRAM_VARIANTS = {
    scram: {mode: 'fixed-teams', teamSize: 1},
    'scram-2v2': {mode: 'fixed-teams', teamSize: 2},
    'scram-2v1': {mode: 'rotating-solo'}
};

var variantEl = document.querySelector('[data-variant]');
if (variantEl) {
    startScramBoard(SCRAM_VARIANTS[variantEl.dataset.variant]);
}
