// Shared multi-player turn/undo engine. Same active/focused
// panel bookkeeping, win/undo chrome, and DOM contract (data-action="undo" /
// "undo-click" / "done", data-role="back-link" / "game-over"). A game only
// supplies how to capture/restore ITS OWN per-player fields and how to paint
// its own board; this engine owns whose turn it is, both undo stacks, and
// declaring a winner.
//
// It also owns surviving a page refresh: every repaint saves whose turn it
// is, both undo stacks, and every player's own current state to localStorage,
// A finished game clears its own save immediately
//
// config:
//   players              - array of player objects; each needs .panel and .turns
//   captureState(player) - returns a plain snapshot of that game's own fields
//   applyState(player, state) - restores a snapshot captured above
//   render(ctx)          - repaints the game's own board; ctx = {activeIndex, focusedIndex, gameOver}
//   maxClicksPerTurn     - optional, defaults to 9 (3 darts x up to 3 taps for a
//                          triple). Either a number, or a function(activeIndex)
//                          returning one, for games where the cap depends on
//                          which role is currently acting (e.g. Scram: 3 for
//                          the stopper who closes at most one number a dart,
//                          9 for the attacker scoring classic dart values)
//   focusable            - optional, defaults to true; set false to skip the
//                          tap-a-panel-to-bring-it-forward wiring for games
//                          where the other players have nothing to reveal
//                          (e.g. Baseball, where scores stay hidden anyway)
//   beforeCommit(player) - optional, called with the active player right before
//                          a turn commits (Terminer le tour) — for folding a
//                          turn-scoped accumulator into persistent state, e.g.
//                          Baseball adding this inning's points onto the score
//   checkGameEnd(players)- optional, called after every commit; return a
//                          truthy value once the game should end this way
//                          (fixed number of turns) rather than via a click
//                          hitting a winning box (see declareWinner instead)
//   populateGameEnd(overlay, players) - required if checkGameEnd is set;
//                          fills in the game-over overlay however this ending
//                          needs (e.g. a full ranked reveal of every player)
//   nextActiveIndex(activeIndex) - optional, called right after beforeCommit
//                          to decide whose turn is next; return an index into
//                          `players`. Defaults to plain round-robin
//                          ((activeIndex + 1) % players.length). For a turn
//                          order that isn't a fixed rotation — e.g. Scram
//                          2v1, where the lone stopper gets every other turn
//                          and the two attackers alternate for the turn in
//                          between, rather than a simple 3-way cycle.
//
// Returns { canAct, recordClick, declareWinner, commitTurn, render, getActiveIndex }.
// commitTurn runs the exact same commit path as pressing "Terminer le tour" —
// for a game whose whole turn is a single atomic action (e.g. Purple Stain's
// one dart to define the target zone) instead of accumulating several clicks
// before the player presses done themselves.

// Round-robin skip for games where eliminated players stay in the fixed
// `players` array (undo needs them there) but never get another turn — pass
// as `nextActiveIndex: function (i) { return nextAliveIndex(i, players); }`.
function nextAliveIndex(activeIndex, players) {
    let next = activeIndex;
    do {
        next = (next + 1) % players.length;
    } while (!players[next].alive);
    return next;
}

function createTurnEngine(config) {
    const players = config.players;
    const captureState = config.captureState;
    const applyState = config.applyState;
    const gameRender = config.render;
    const maxClicksPerTurn = config.maxClicksPerTurn || 9;

    // Click cap for the current turn; a fixed number or a per-role function.
    function resolveMaxClicksPerTurn() {
        if (typeof maxClicksPerTurn === 'function') {
            return maxClicksPerTurn(activeIndex);
        }
        return maxClicksPerTurn;
    }

    const backLink = document.querySelector('[data-role="back-link"]');
    const doneBtn = document.querySelector('[data-action="done"]');
    const undoBtn = document.querySelector('[data-action="undo"]');
    const undoClickBtn = document.querySelector('[data-action="undo-click"]');
    const gameOverOverlay = document.querySelector('[data-role="game-over"]');

    let activeIndex = 0;
    let focusedIndex = 0;
    let clicksThisTurn = 0;
    let gameOver = false;

    // `history`: one snapshot per completed turn — "Annuler le tour" pops it.
    let history = [];
    let clickHistory = [];
    let pendingSnapshot = null;

    // Shared prefix so game-common.js's exit confirmation can wipe any save
    // without knowing this game's exact key; the rest identifies THIS game
    // instance specifically, so a stale save never bleeds into an unrelated
    // game or a different lineup of the same game.
    const storageKey = dartGameStorageKey(players.map(function (p) {
        return p.id;
    }));

    // A save older than this is more likely an abandoned game (24h)
    const persistence = createPersistence(storageKey, 24 * 60 * 60 * 1000,
        function () {
            return {
                activeIndex: activeIndex,
                focusedIndex: focusedIndex,
                clicksThisTurn: clicksThisTurn,
                history: history,
                clickHistory: clickHistory,
                pendingSnapshot: pendingSnapshot,
                playersNow: players.map(function (p) {
                    return {turns: p.turns, state: captureState(p)};
                })
            };
        },
        function (saved) {
            if (!saved.playersNow || saved.playersNow.length !== players.length) {
                return false;
            }
            activeIndex = saved.activeIndex;
            focusedIndex = saved.focusedIndex;
            clicksThisTurn = saved.clicksThisTurn;
            history = saved.history;
            clickHistory = saved.clickHistory;
            pendingSnapshot = saved.pendingSnapshot;
            saved.playersNow.forEach(function (entry, index) {
                players[index].turns = entry.turns;
                applyState(players[index], entry.state);
            });
            return true;
        });

    // Saves engine + player state, or clears it once the game is over.
    function persist() {
        persistence.persist(gameOver);
    }

    // Returns true once a matching save was found and applied — the caller
    // skips its own fresh beginTurn() in that case, since restoring already
    // put activeIndex/history/pendingSnapshot exactly where they were.
    function restore() {
        return persistence.restore();
    }

    // Starts a fresh turn: snapshots the active player and clears the click history.
    function beginTurn() {
        const player = players[activeIndex];
        pendingSnapshot = {
            playerIndex: activeIndex,
            state: captureState(player),
            turns: player.turns
        };
        clickHistory = [];
    }

    // Repaints panels, undo buttons, and the game's own board, then persists.
    function renderAll() {
        players.forEach(function (player, index) {
            player.panel.classList.toggle('active', index === activeIndex && !gameOver);
            player.panel.classList.toggle('focused', index === focusedIndex);
        });
        undoBtn.disabled = history.length === 0;
        undoClickBtn.disabled = clickHistory.length === 0;
        gameRender({activeIndex: activeIndex, focusedIndex: focusedIndex, gameOver: gameOver});
        persist();
    }

    // Changes which panel is focused and re-renders.
    function setFocused(index) {
        focusedIndex = index;
        renderAll();
    }

    // Shows/hides the game-over chrome (back link, done/undo buttons, overlay).
    function setGameOverUi(isOver) {
        gameOver = isOver;
        backLink.hidden = isOver;
        doneBtn.hidden = isOver;
        undoBtn.hidden = isOver;
        undoClickBtn.hidden = isOver;
        gameOverOverlay.hidden = !isOver;
    }

    // Ends the game on a winning click: closes out the turn, shows the winner, and fills the overlay.
    function declareWinner(player, populateOverlay) {
        history.push(pendingSnapshot);
        player.turns += 1;
        setGameOverUi(true);
        setFocused(players.indexOf(player));
        gameOverOverlay.querySelector('[data-role="winner-name"]').textContent = player.name;
        populateOverlay(gameOverOverlay, player);
        renderAll();
    }

    // Whether this player may click a box right now: their turn, game on, under the click cap.
    function canAct(playerIndex) {
        return !gameOver && playerIndex === activeIndex && clicksThisTurn < resolveMaxClicksPerTurn();
    }

    // Snapshots state for undo and counts the click toward this turn's cap.
    function recordClick(player) {
        clickHistory.push({state: captureState(player)});
        clicksThisTurn += 1;
    }

    if (config.focusable !== false) {
        players.forEach(function (player, index) {
            player.panel.addEventListener('click', function () {
                if (!gameOver) {
                    setFocused(index);
                }
            });
        });
    }

    undoClickBtn.addEventListener('click', function () {
        if (gameOver) {
            return;
        }
        const snapshot = clickHistory.pop();
        if (!snapshot) {
            return;
        }
        applyState(players[activeIndex], snapshot.state);
        clicksThisTurn = Math.max(0, clicksThisTurn - 1);
        renderAll();
    });

    undoBtn.addEventListener('click', function () {
        const snapshot = history.pop();
        if (!snapshot) {
            return;
        }

        // Discard whatever the current player has clicked this turn but not yet committed.
        applyState(players[activeIndex], pendingSnapshot.state);

        const player = players[snapshot.playerIndex];
        applyState(player, snapshot.state);
        player.turns = snapshot.turns;

        activeIndex = snapshot.playerIndex;
        clicksThisTurn = 0;
        beginTurn();

        if (gameOver) {
            setGameOverUi(false);
        }

        setFocused(activeIndex);
    });

    // Ends the active player's turn: commits state, advances to the next player, checks for game end.
    function commitTurn() {
        if (gameOver) {
            return;
        }
        if (config.beforeCommit) {
            config.beforeCommit(players[activeIndex]);
        }
        history.push(pendingSnapshot);
        players[activeIndex].turns += 1;
        activeIndex = config.nextActiveIndex
            ? config.nextActiveIndex(activeIndex)
            : (activeIndex + 1) % players.length;
        clicksThisTurn = 0;
        beginTurn();

        if (config.checkGameEnd && config.checkGameEnd(players)) {
            setGameOverUi(true);
            config.populateGameEnd(gameOverOverlay, players);
            renderAll();
            return;
        }

        setFocused(activeIndex);
    }

    doneBtn.addEventListener('click', commitTurn);

    if (!restore()) {
        beginTurn();
    }
    renderAll();

    return {
        canAct: canAct,
        recordClick: recordClick,
        declareWinner: declareWinner,
        commitTurn: commitTurn,
        render: renderAll,
        getActiveIndex: function () {
            return activeIndex;
        }
    };
}
