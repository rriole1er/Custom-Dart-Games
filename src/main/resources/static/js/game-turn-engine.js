// Shared multi-player turn/undo engine for the "tap a panel to focus it,
// click boxes to act, Terminer to pass the turn" boards — Cricket (via
// game-cricket-common.js) and the Game Clock (game-clock.js). Both need the
// exact same two-level undo: a per-turn stack that can walk back through
// completed turns, plus a per-click stack scoped to the turn in progress (fix
// a misclick without losing the whole turn) — and the same active/focused
// panel bookkeeping, win/undo chrome, and DOM contract (data-action="undo" /
// "undo-click" / "done", data-role="back-link" / "game-over"). A game only
// supplies how to capture/restore ITS OWN per-player fields and how to paint
// its own board; this engine owns whose turn it is, both undo stacks, and
// declaring a winner.
//
// config:
//   players              - array of player objects; each needs .panel and .turns
//   captureState(player) - returns a plain snapshot of that game's own fields
//   applyState(player, state) - restores a snapshot captured above
//   render(ctx)          - repaints the game's own board; ctx = {activeIndex, focusedIndex, gameOver}
//   maxClicksPerTurn     - optional, defaults to 9 (3 darts x up to 3 taps for a triple)
//
// Returns { canAct, recordClick, declareWinner, render, getActiveIndex }.
function createTurnEngine(config) {
    var players = config.players;
    var captureState = config.captureState;
    var applyState = config.applyState;
    var gameRender = config.render;
    var maxClicksPerTurn = config.maxClicksPerTurn || 9;

    var backLink = document.querySelector('[data-role="back-link"]');
    var doneBtn = document.querySelector('[data-action="done"]');
    var undoBtn = document.querySelector('[data-action="undo"]');
    var undoClickBtn = document.querySelector('[data-action="undo-click"]');
    var gameOverOverlay = document.querySelector('[data-role="game-over"]');

    var activeIndex = 0;
    var focusedIndex = 0;
    var clicksThisTurn = 0;
    var gameOver = false;

    // `history`: one snapshot per completed turn — "Annuler le tour" pops it.
    // `clickHistory`: one snapshot per click since the turn began — "Annuler"
    // pops just the last click. `pendingSnapshot` is the active player's state
    // as it was at the start of the turn, so "Annuler le tour" can discard
    // mid-turn progress even once `clickHistory` itself has been emptied.
    var history = [];
    var clickHistory = [];
    var pendingSnapshot = null;

    function beginTurn() {
        var player = players[activeIndex];
        pendingSnapshot = {
            playerIndex: activeIndex,
            state: captureState(player),
            turns: player.turns
        };
        clickHistory = [];
    }

    function renderAll() {
        players.forEach(function (player, index) {
            player.panel.classList.toggle('active', index === activeIndex && !gameOver);
            player.panel.classList.toggle('focused', index === focusedIndex);
        });
        undoBtn.disabled = history.length === 0;
        undoClickBtn.disabled = clickHistory.length === 0;
        gameRender({activeIndex: activeIndex, focusedIndex: focusedIndex, gameOver: gameOver});
    }

    function setFocused(index) {
        focusedIndex = index;
        renderAll();
    }

    function setGameOverUi(isOver) {
        gameOver = isOver;
        backLink.hidden = isOver;
        doneBtn.hidden = isOver;
        undoBtn.hidden = isOver;
        undoClickBtn.hidden = isOver;
        gameOverOverlay.hidden = !isOver;
    }

    function declareWinner(player, populateOverlay) {
        history.push(pendingSnapshot);
        player.turns += 1;
        setGameOverUi(true);
        setFocused(players.indexOf(player));
        gameOverOverlay.querySelector('[data-role="winner-name"]').textContent = player.name;
        populateOverlay(gameOverOverlay, player);
        renderAll();
    }

    function canAct(playerIndex) {
        return !gameOver && playerIndex === activeIndex && clicksThisTurn < maxClicksPerTurn;
    }

    function recordClick(player) {
        clickHistory.push({state: captureState(player)});
        clicksThisTurn += 1;
    }

    players.forEach(function (player, index) {
        player.panel.addEventListener('click', function () {
            if (!gameOver) {
                setFocused(index);
            }
        });
    });

    undoClickBtn.addEventListener('click', function () {
        if (gameOver) {
            return;
        }
        var snapshot = clickHistory.pop();
        if (!snapshot) {
            return;
        }
        applyState(players[activeIndex], snapshot.state);
        clicksThisTurn = Math.max(0, clicksThisTurn - 1);
        renderAll();
    });

    undoBtn.addEventListener('click', function () {
        var snapshot = history.pop();
        if (!snapshot) {
            return;
        }

        // Discard whatever the current player has clicked this turn but not yet committed.
        applyState(players[activeIndex], pendingSnapshot.state);

        var player = players[snapshot.playerIndex];
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
    renderAll();

    return {
        canAct: canAct,
        recordClick: recordClick,
        declareWinner: declareWinner,
        render: renderAll,
        getActiveIndex: function () {
            return activeIndex;
        }
    };
}
