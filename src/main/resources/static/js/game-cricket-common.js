// Every Cricket variant in one file. `startCricketBoard(config)` is the
// shared engine.
// Which variant is active comes from the template via a `data-variant` attribute (set from
// the `variant` model attribute), read once at the bottom of this file.
function startCricketBoard(config) {
    document.addEventListener('DOMContentLoaded', function () {
        const panels = Array.prototype.slice.call(document.querySelectorAll('.cricket-panel'));
        if (!panels.length) {
            return;
        }

        // Numbers
        const TARGETS = ['20', '19', '18', '17', '16', '15', 'B'];
        const TARGET_VALUE = {'20': 20, '19': 19, '18': 18, '17': 17, '16': 16, '15': 15, 'B': 25};

        // Indexed by mark count (0-3): open/no mark, one slash, crossed-out, then
        // closed (green). A number keeps showing the closed icon forever once
        // marks reach 3, even though further hits after that just add score.
        const MARK_ICON = [
            '',
            '<svg viewBox="0 0 24 24"><line x1="6" y1="18" x2="18" y2="6" stroke="var(--red)" stroke-width="3" stroke-linecap="round"/></svg>',
            '<svg viewBox="0 0 24 24"><line x1="6" y1="6" x2="18" y2="18" stroke="var(--red)" stroke-width="3" stroke-linecap="round"/><line x1="6" y1="18" x2="18" y2="6" stroke="var(--red)" stroke-width="3" stroke-linecap="round"/></svg>',
            '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="var(--green)" stroke-width="3"/><line x1="6" y1="6" x2="18" y2="18" stroke="var(--green)" stroke-width="3" stroke-linecap="round"/><line x1="6" y1="18" x2="18" y2="6" stroke="var(--green)" stroke-width="3" stroke-linecap="round"/></svg>'
        ];

        // Player display
        const players = panels.map(function (panel) {
            const marks = {};
            TARGETS.forEach(function (t) {
                marks[t] = 0;
            });

            const boxes = {};
            const dots = {};
            TARGETS.forEach(function (t) {
                boxes[t] = panel.querySelector('.cricket-box[data-target="' + t + '"]');
                dots[t] = panel.querySelector('.closed-dot[data-target="' + t + '"]');
            });

            return {
                id: panel.dataset.playerId,
                name: panel.dataset.playerName,
                panel: panel,
                turnsEl: panel.querySelector('[data-role="turns"]'),
                scoreEl: panel.querySelector('[data-role="score"]'),
                boxes: boxes,
                dots: dots,
                marks: marks,
                score: 0,
                turns: 0
            };
        });

        // Check if a number is closed for a player
        function isClosed(target) {
            return players.every(function (p) {
                return p.marks[target] >= 3;
            });
        }

        // Check if a number is closed by all players
        function allClosed(player) {
            return TARGETS.every(function (t) {
                return player.marks[t] >= 3;
            });
        }

        // Copy numbers states to cache
        function snapshotMarks(marks) {
            const copy = {};
            TARGETS.forEach(function (t) {
                copy[t] = marks[t];
            });
            return copy;
        }

        // Rendering player state in the game
        function render(ctx) {
            players.forEach(function (player, index) {
                player.turnsEl.textContent = 'Tours : ' + player.turns;
                player.scoreEl.textContent = player.score;

                TARGETS.forEach(function (target) {
                    const closed = isClosed(target);
                    const disabled = closed || index !== ctx.activeIndex || ctx.gameOver;

                    player.boxes[target].innerHTML = MARK_ICON[player.marks[target]];
                    player.boxes[target].disabled = disabled;
                    player.boxes[target].classList.toggle('closed', closed);
                    player.dots[target].innerHTML = MARK_ICON[player.marks[target]];
                });
            });
        }

        // Game engine and save to cache
        const engine = createTurnEngine({
            players: players,
            // Snapshot a player's marks and score
            captureState: function (player) {
                return {marks: snapshotMarks(player.marks), score: player.score};
            },
            // Restore a player's marks and score from a saved state
            applyState: function (player, state) {
                player.marks = state.marks;
                player.score = state.score;
            },
            render: render
        });


        // Update numbers data based on player click
        function handleBoxClick(target, playerIndex) {
            if (!engine.canAct(playerIndex) || isClosed(target)) {
                return;
            }

            const player = players[playerIndex];
            engine.recordClick(player);

            const prevMarks = player.marks[target];

            // Core Cricket rule: the first 3 hits on an open number just mark it;
            // once a player has all 3 marks, further hits on it score points
            // instead (unless the whole board already closed it, per isClosed()).
            if (prevMarks < 3) {
                player.marks[target] = prevMarks + 1;
            } else {
                player.score += TARGET_VALUE[target];
            }

            engine.render();

            // Winner display, needs to closed all numbers
            const winner = config.checkWinner(players, engine.getActiveIndex(), {
                targets: TARGETS,
                allClosed: allClosed
            });
            if (winner) {
                engine.declareWinner(winner, config.populateWinOverlay);
            }
        }

        // Listener for player clicks
        players.forEach(function (player, index) {
            TARGETS.forEach(function (target) {
                player.boxes[target].addEventListener('click', function (e) {
                    e.stopPropagation();
                    handleBoxClick(target, index);
                });
            });
        });
    });
}


const CRICKET_VARIANTS = {
    // Standard Cricket: closing all 7 numbers isn't enough on its own — you also
    // need the highest (or equal-highest) score, so a player who closes early
    // but is behind on points must keep scoring off open numbers until they
    // catch up.
    cricket: {
        // Winner needs all numbers closed and the highest (or tied) score
        checkWinner: function (players, activeIndex, ctx) {
            const maxScore = players.reduce(function (max, p) {
                return Math.max(max, p.score);
            }, 0);

            for (let i = 0; i < players.length; i++) {
                if (ctx.allClosed(players[i]) && players[i].score >= maxScore) {
                    return players[i];
                }
            }
            return null;
        },
        // Fill win overlay with the number of turns taken to win
        populateWinOverlay: function (overlay, player) {
            populateWinnerFields(overlay, player, player.turns + ' ' + toursWord(player.turns) + ' pour gagner');
        }
    },
    // Cricket Honour: no scoring goal — first to close all 7 numbers wins
    // outright. Score still accumulates (any hit on an already-closed number),
    // but only as a penalty recorded for the leaderboard: 0 is a perfect game.
    'cricket-honour': {
        // Winner is the active player as soon as they close all numbers
        checkWinner: function (players, activeIndex, ctx) {
            const player = players[activeIndex];
            return ctx.allClosed(player) ? player : null;
        },
        // Fill win overlay with the final penalty score
        populateWinOverlay: function (overlay, player) {
            populateWinnerFields(overlay, player, 'Score final : ' + player.score, player.score);
        }
    }
};

// Load variant
const variantEl = document.querySelector('[data-variant]');
if (variantEl) {
    startCricketBoard(CRICKET_VARIANTS[variantEl.dataset.variant]);
}
