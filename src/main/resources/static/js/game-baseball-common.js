// Shared engine for every Baseball variant (Baseball counts innings 1->9,
// Ballbase counts them 9->1). A variant supplies just one thing via `config`:
//   - getTarget(turns): the dartboard number to aim at for a player who has
//     completed `turns` full turns so far (0-indexed going in). Kept separate
//     from the turn/manche counter below (always 1->9 regardless of variant),
//     since Ballbase's first turn is manche 1 but aims at 9, not the other
//     way around.
// Everything else — 9 fixed turns, 1 tap = 1 point flat, hidden scores until
// the end, full ranked reveal, saving every player's result — is identical
// across variants. Turn order and both undo levels are the shared
// game-turn-engine.js. Which variant is active comes from the template via a
// `data-variant` attribute (set from the `variant` model attribute), read
// once at the bottom of this file — same convention as game-cricket-common.js.
function startBaseballBoard(config) {
    document.addEventListener('DOMContentLoaded', function () {
        var panels = Array.prototype.slice.call(document.querySelectorAll('.baseball-panel'));
        if (!panels.length) {
            return;
        }

        var TOTAL_TURNS = 9;

        // One bat icon per point banked this inning — matches the dot/mark-icon
        // convention used elsewhere (Cricket marks, Clock points) for showing a
        // count visually instead of as a raw number.
        var BAT_ICON = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">'
            + '<rect x="10" y="2" width="4" height="9" rx="2" fill="var(--wood)" transform="rotate(-40 12 12)"/>'
            + '<rect x="9" y="10" width="6" height="12" rx="3" fill="var(--wood-dark)" transform="rotate(-40 12 12)"/>'
            + '</svg>';

        var gameOverOverlay = document.querySelector('[data-role="game-over"]');

        var players = panels.map(function (panel) {
            return {
                id: panel.dataset.playerId,
                name: panel.dataset.playerName,
                panel: panel,
                turnsEl: panel.querySelector('[data-role="turns"]'),
                targetEl: panel.querySelector('[data-role="target"]'),
                pointsLeftEl: panel.querySelector('[data-role="points-left"]'),
                pointsRightEl: panel.querySelector('[data-role="points-right"]'),
                targetBox: panel.querySelector('[data-role="target-box"]'),
                score: 0,
                points: 0,
                turns: 0
            };
        });

        function render(ctx) {
            players.forEach(function (player, index) {
                var turnNumber = Math.min(player.turns + 1, TOTAL_TURNS);
                player.turnsEl.textContent = 'Manche ' + turnNumber + ' / ' + TOTAL_TURNS;
                player.targetEl.textContent = 'Viser le ' + config.getTarget(player.turns);
                player.targetBox.disabled = !(index === ctx.activeIndex && !ctx.gameOver);

                // Flanks the ball left/right rather than stacking underneath —
                // alternate sides as points come in so both stay roughly even.
                player.pointsLeftEl.innerHTML = '';
                player.pointsRightEl.innerHTML = '';
                for (var i = 0; i < player.points; i++) {
                    var side = i % 2 === 0 ? player.pointsRightEl : player.pointsLeftEl;
                    side.insertAdjacentHTML('afterbegin', BAT_ICON);
                }
            });
        }

        function populateGameEnd(overlay, allPlayers) {
            var maxScore = allPlayers.reduce(function (max, p) {
                return Math.max(max, p.score);
            }, -Infinity);
            var ranked = allPlayers.slice().sort(function (a, b) {
                return b.score - a.score;
            });

            var list = overlay.querySelector('[data-role="final-ranking"]');
            list.innerHTML = '';
            ranked.forEach(function (player) {
                var isWinner = player.score === maxScore;
                var row = document.createElement('div');
                row.className = 'baseball-rank-row' + (isWinner ? ' winner' : '');

                var name = document.createElement('span');
                name.className = 'baseball-rank-name';
                name.textContent = player.name + (isWinner ? ' 🏆' : '');

                var score = document.createElement('span');
                score.className = 'baseball-rank-score';
                score.textContent = player.score;

                row.appendChild(name);
                row.appendChild(score);
                list.appendChild(row);
            });
        }

        var engine = createTurnEngine({
            players: players,
            captureState: function (player) {
                return {score: player.score, points: player.points};
            },
            applyState: function (player, state) {
                player.score = state.score;
                player.points = state.points;
            },
            render: render,
            focusable: false,
            beforeCommit: function (player) {
                player.score += player.points;
                player.points = 0;
            },
            checkGameEnd: function (allPlayers) {
                return allPlayers.every(function (p) {
                    return p.turns >= TOTAL_TURNS;
                });
            },
            populateGameEnd: populateGameEnd
        });

        players.forEach(function (player, index) {
            player.targetBox.addEventListener('click', function (e) {
                e.stopPropagation();
                if (!engine.canAct(index)) {
                    return;
                }
                engine.recordClick(player);
                player.points += 1;
                engine.render();
            });
        });

        // Every player's final score gets saved, not just the winner(s) — best
        // and worst per user are tracked independently on the leaderboard, so a
        // losing score still matters. finishGame() only accepts one (gameId,
        // userId, result) triple per call, so this fires one request per player.
        document.querySelector('[data-action="save-all-results"]').addEventListener('click', function (e) {
            var btn = e.currentTarget;
            btn.disabled = true;
            var gameId = gameOverOverlay.dataset.gameId;
            Promise.all(players.map(function (player) {
                return fetch('/dart/play/finish', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                    body: 'gameId=' + encodeURIComponent(gameId) + '&userId=' + encodeURIComponent(player.id)
                        + '&result=' + encodeURIComponent(player.score)
                });
            })).then(function () {
                window.location.href = '/dart/play';
            });
        });
    });
}

var BASEBALL_VARIANTS = {
    // Baseball: targets rise 1 -> 9, same order every player plays.
    baseball: {
        getTarget: function (turns) {
            return Math.min(turns + 1, 9);
        }
    },
    // Ballbase: same game, targets fall 9 -> 1 instead — manche 1 aims at 9.
    ballbase: {
        getTarget: function (turns) {
            return Math.max(9 - turns, 1);
        }
    }
};

var variantEl = document.querySelector('[data-variant]');
if (variantEl) {
    startBaseballBoard(BASEBALL_VARIANTS[variantEl.dataset.variant]);
}
