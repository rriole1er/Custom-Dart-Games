// Shared engine for every Cricket variant (game-cricket.js, game-cricket-honour.js).
// A variant supplies only two things via `config`:
//   - checkWinner(players, activeIndex, ctx): called after every mark/score change,
//     returns the winning player object (or null if the game continues).
//   - populateWinOverlay(overlay, player): fills in the win screen's text and the
//     hidden form fields the leaderboard POST relies on.
// Everything else (marks, scoring, turn order, undo) is identical across variants.
function startCricketBoard(config) {
    document.addEventListener('DOMContentLoaded', function () {
        var panels = Array.prototype.slice.call(document.querySelectorAll('.cricket-panel'));
        if (!panels.length) {
            return;
        }

        var TARGETS = ['20', '19', '18', '17', '16', '15', 'B'];
        var TARGET_VALUE = {'20': 20, '19': 19, '18': 18, '17': 17, '16': 16, '15': 15, 'B': 25};
        var MAX_CLICKS_PER_TURN = 9;

        var gameOverOverlay = document.querySelector('[data-role="game-over"]');
        var backLink = document.querySelector('[data-role="back-link"]');
        var undoBtn = document.querySelector('[data-action="undo"]');
        var doneBtn = document.querySelector('[data-action="done"]');

        // Indexed by mark count (0-3): open/no mark, one slash, crossed-out, then
        // closed (green). A number keeps showing the closed icon forever once
        // marks reach 3, even though further hits after that just add score.
        var MARK_ICON = [
            '',
            '<svg viewBox="0 0 24 24"><line x1="6" y1="18" x2="18" y2="6" stroke="var(--red)" stroke-width="3" stroke-linecap="round"/></svg>',
            '<svg viewBox="0 0 24 24"><line x1="6" y1="6" x2="18" y2="18" stroke="var(--red)" stroke-width="3" stroke-linecap="round"/><line x1="6" y1="18" x2="18" y2="6" stroke="var(--red)" stroke-width="3" stroke-linecap="round"/></svg>',
            '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="var(--green)" stroke-width="3"/><line x1="6" y1="6" x2="18" y2="18" stroke="var(--green)" stroke-width="3" stroke-linecap="round"/><line x1="6" y1="18" x2="18" y2="6" stroke="var(--green)" stroke-width="3" stroke-linecap="round"/></svg>'
        ];

        var players = panels.map(function (panel) {
            var marks = {};
            TARGETS.forEach(function (t) {
                marks[t] = 0;
            });

            var boxes = {};
            var dots = {};
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

        var activeIndex = 0;
        var focusedIndex = 0;
        var clicksThisTurn = 0;
        var gameOver = false;

        // Undo model (mirrors game-countdown.js): `history` is a stack of one
        // snapshot per completed turn, so Annuler can walk back arbitrarily far
        // through the whole game, not just the current turn. Unlike countdown
        // (which buffers a turn's input separately and only applies it on
        // commit), Cricket mutates a player's marks/score live on every click,
        // so `pendingSnapshot` records that player's state as it was at the
        // start of the turn — letting undo also discard mid-turn clicks that
        // were never committed via "Terminer le tour".
        var history = [];
        var pendingSnapshot = null;

        function isClosed(target) {
            return players.every(function (p) {
                return p.marks[target] >= 3;
            });
        }

        function allClosed(player) {
            return TARGETS.every(function (t) {
                return player.marks[t] >= 3;
            });
        }

        function snapshotMarks(marks) {
            var copy = {};
            TARGETS.forEach(function (t) {
                copy[t] = marks[t];
            });
            return copy;
        }

        function beginTurn() {
            var player = players[activeIndex];
            pendingSnapshot = {
                playerIndex: activeIndex,
                marks: snapshotMarks(player.marks),
                score: player.score,
                turns: player.turns
            };
        }

        function setFocused(index) {
            focusedIndex = index;
            render();
        }

        function render() {
            players.forEach(function (player, index) {
                player.panel.classList.toggle('active', index === activeIndex && !gameOver);
                player.panel.classList.toggle('focused', index === focusedIndex);
                player.turnsEl.textContent = 'Tours : ' + player.turns;
                player.scoreEl.textContent = player.score;

                TARGETS.forEach(function (target) {
                    var closed = isClosed(target);
                    var disabled = closed || index !== activeIndex || gameOver;

                    player.boxes[target].innerHTML = MARK_ICON[player.marks[target]];
                    player.boxes[target].disabled = disabled;
                    player.boxes[target].classList.toggle('closed', closed);
                    player.dots[target].innerHTML = MARK_ICON[player.marks[target]];
                });
            });

            undoBtn.disabled = history.length === 0;
        }

        // Toggles the chrome between "game in progress" and "winner declared":
        // used by declareWinner() and, in reverse, by undo when it walks back
        // past the winning turn.
        function setGameOverUi(isOver) {
            gameOver = isOver;
            backLink.hidden = isOver;
            doneBtn.hidden = isOver;
            undoBtn.hidden = isOver;
            gameOverOverlay.hidden = !isOver;
        }

        function declareWinner(player) {
            history.push(pendingSnapshot);
            player.turns += 1;
            setGameOverUi(true);
            setFocused(players.indexOf(player));
            gameOverOverlay.querySelector('[data-role="winner-name"]').textContent = player.name;
            config.populateWinOverlay(gameOverOverlay, player);
            render();
        }

        function handleBoxClick(target, playerIndex) {
            if (gameOver || playerIndex !== activeIndex || isClosed(target) || clicksThisTurn >= MAX_CLICKS_PER_TURN) {
                return;
            }

            var player = players[playerIndex];
            var prevMarks = player.marks[target];

            // Core Cricket rule: the first 3 hits on an open number just mark it;
            // once a player has all 3 marks, further hits on it score points
            // instead (unless the whole board already closed it, per isClosed()).
            if (prevMarks < 3) {
                player.marks[target] = prevMarks + 1;
            } else {
                player.score += TARGET_VALUE[target];
            }

            clicksThisTurn += 1;

            render();

            var winner = config.checkWinner(players, activeIndex, {targets: TARGETS, allClosed: allClosed});
            if (winner) {
                declareWinner(winner);
            }
        }

        players.forEach(function (player, index) {
            player.panel.addEventListener('click', function () {
                if (!gameOver) {
                    setFocused(index);
                }
            });

            TARGETS.forEach(function (target) {
                player.boxes[target].addEventListener('click', function (e) {
                    e.stopPropagation();
                    handleBoxClick(target, index);
                });
            });
        });

        undoBtn.addEventListener('click', function () {
            var snapshot = history.pop();
            if (!snapshot) {
                return;
            }

            // Discard whatever the current player has clicked this turn but not yet committed.
            var currentPlayer = players[activeIndex];
            currentPlayer.marks = snapshotMarks(pendingSnapshot.marks);
            currentPlayer.score = pendingSnapshot.score;

            var player = players[snapshot.playerIndex];
            player.marks = snapshot.marks;
            player.score = snapshot.score;
            player.turns = snapshot.turns;

            activeIndex = snapshot.playerIndex;
            clicksThisTurn = 0;
            beginTurn();

            if (gameOver) {
                setGameOverUi(false);
            }

            setFocused(activeIndex);
        });

        doneBtn.addEventListener('click', function () {
            if (gameOver) {
                return;
            }
            history.push(pendingSnapshot);
            players[activeIndex].turns += 1;
            activeIndex = (activeIndex + 1) % players.length;
            clicksThisTurn = 0;
            beginTurn();
            setFocused(activeIndex);
        });

        beginTurn();
        render();
    });
}
