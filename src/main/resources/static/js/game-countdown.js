// Countdown (501/301/101) game screen: dual keypad (raw total vs. per-dart
// segment entry), checkout suggestions, and a per-turn undo stack.
document.addEventListener('DOMContentLoaded', function () {
    var panels = Array.prototype.slice.call(document.querySelectorAll('.player-panel'));
    if (!panels.length) {
        return;
    }

    var keypadPanel = document.getElementById('keypad-panel');
    var backLink = document.querySelector('[data-role="back-link"]');
    var gameOverOverlay = document.querySelector('[data-role="game-over"]');
    var inputDisplay = document.querySelector('[data-role="input-display"]');
    var breakdownDisplay = document.querySelector('[data-role="segment-breakdown"]');
    var keypadTotal = document.querySelector('[data-role="keypad-total"]');
    var keypadZeroRow = document.querySelector('[data-role="keypad-zero-row"]');
    var keypadSegments = document.querySelector('[data-role="keypad-segments"]');
    var keypadSegmentErase = document.querySelector('[data-role="keypad-segment-erase"]');

    var players = panels.map(function (panel) {
        var startingScore = parseInt(panel.querySelector('[data-role="score"]').textContent, 10);
        return {
            panel: panel,
            id: panel.dataset.playerId,
            name: panel.dataset.playerName,
            startingScore: startingScore,
            remaining: startingScore,
            turns: 0,
            totalScored: 0,
            checkoutVariant: 0
        };
    });

    var activeIndex = 0;
    var buffer = '';
    var mode = 'total';
    var segmentTaps = [];
    var gameOver = false;

    // Undo model (mirrors game-cricket-common.js): `history` is a stack of one
    // snapshot per committed turn, so Annuler can walk back arbitrarily far
    // through the game. Unlike Cricket, a turn's input lives in a separate
    // buffer (`buffer`/`segmentTaps`) until "Terminer" applies it, so undo
    // never needs to snapshot mid-turn state — resetInput() simply discards
    // whatever hasn't been committed yet.
    var history = [];

    // Refresh survival (see game-turn-engine.js for the same idea applied to
    // every other game): every committed turn is saved to localStorage,
    // keyed by the page title + the exact set of player ids so a reload of
    // THIS in-progress game finds it again without bleeding into an
    // unrelated one. Mid-turn buffer/segmentTaps aren't saved, matching
    // this file's own choice above not to undo-track them either — only
    // committed state is worth surviving a refresh for.
    var storageKey = 'dartGameState:' + document.title + ':' + players.map(function (p) {
        return p.id;
    }).join(',');

    // A save older than this is more likely an abandoned game (tab closed
    // without confirming exit, browser killed in the background) than one
    // worth resuming — past this age, restore() ignores and clears it
    // rather than risk resurrecting last week's match onto today's replay
    // of the same lineup.
    var MAX_SAVE_AGE_MS = 24 * 60 * 60 * 1000;

    function persist() {
        if (gameOver) {
            try {
                localStorage.removeItem(storageKey);
            } catch (e) {
                // Storage unavailable — nothing to clean up either way.
            }
            return;
        }
        try {
            localStorage.setItem(storageKey, JSON.stringify({
                savedAt: Date.now(),
                activeIndex: activeIndex,
                history: history,
                playersNow: players.map(function (p) {
                    return {
                        remaining: p.remaining,
                        turns: p.turns,
                        totalScored: p.totalScored,
                        checkoutVariant: p.checkoutVariant
                    };
                })
            }));
        } catch (e) {
            // Storage full or unavailable — the game keeps working, it just won't survive a refresh.
        }
    }

    function restore() {
        var raw;
        try {
            raw = localStorage.getItem(storageKey);
        } catch (e) {
            return false;
        }
        if (!raw) {
            return false;
        }
        var saved;
        try {
            saved = JSON.parse(raw);
        } catch (e) {
            return false;
        }
        if (!saved.playersNow || saved.playersNow.length !== players.length) {
            return false;
        }
        if (!saved.savedAt || Date.now() - saved.savedAt > MAX_SAVE_AGE_MS) {
            try {
                localStorage.removeItem(storageKey);
            } catch (e) {
                // Storage unavailable — nothing to clean up either way.
            }
            return false;
        }
        activeIndex = saved.activeIndex;
        history = saved.history;
        saved.playersNow.forEach(function (entry, index) {
            players[index].remaining = entry.remaining;
            players[index].turns = entry.turns;
            players[index].totalScored = entry.totalScored;
            players[index].checkoutVariant = entry.checkoutVariant;
        });
        return true;
    }

    // Segments usable before the final dart of a checkout: triples then singles,
    // sorted highest-value first so findFinish() tries the biggest scores first
    // (a greedy search, not an exhaustive one — see its comment below).
    var LEAD_SEGMENTS = [];
    for (var triple = 20; triple >= 1; triple--) {
        LEAD_SEGMENTS.push({label: 'T' + triple, value: triple * 3});
    }
    for (var single = 20; single >= 1; single--) {
        LEAD_SEGMENTS.push({label: single.toString(), value: single});
    }
    LEAD_SEGMENTS.push({label: '25', value: 25});
    LEAD_SEGMENTS.push({label: 'BULL', value: 50});
    LEAD_SEGMENTS.sort(function (a, b) {
        return b.value - a.value;
    });

    // Recursively searches for a legal N-dart finish: every dart before the
    // last must leave enough remaining for a real double-out (checked by the
    // dartsLeft === 1 base case, which only accepts an exact double or BULL).
    // Greedy, not exhaustive — it takes the first working combination in
    // LEAD_SEGMENTS order, which is highest score first. `skipFirstLabel` lets
    // computeCheckout() ask for a different route past the same first dart,
    // powering the refresh button's "other combination" option.
    function findFinish(remaining, dartsLeft, skipFirstLabel) {
        if (dartsLeft === 1) {
            if (remaining === 50) {
                return ['BULL'];
            }
            if (remaining >= 2 && remaining <= 40 && remaining % 2 === 0) {
                return ['D' + (remaining / 2)];
            }
            return null;
        }

        for (var i = 0; i < LEAD_SEGMENTS.length; i++) {
            var opt = LEAD_SEGMENTS[i];
            if (skipFirstLabel && opt.label === skipFirstLabel) {
                continue;
            }
            if (opt.value >= remaining) {
                continue;
            }
            var rest = findFinish(remaining - opt.value, dartsLeft - 1, null);
            if (rest) {
                return [opt.label].concat(rest);
            }
        }
        return null;
    }

    // Suggests a checkout using as few darts as possible (1, then 2, then 3).
    // An odd `variant` asks findFinish() to skip whatever it used as its first
    // dart last time, so clicking the refresh button alternates between two
    // different routes to the same score instead of repeating one forever.
    function computeCheckout(remaining, variant) {
        if (remaining < 2 || remaining > 170) {
            return null;
        }
        for (var darts = 1; darts <= 3; darts++) {
            var primary = findFinish(remaining, darts, null);
            if (primary) {
                if (variant % 2 === 1 && darts > 1) {
                    var alt = findFinish(remaining, darts, primary[0]);
                    if (alt) {
                        return alt;
                    }
                }
                return primary;
            }
        }
        return null;
    }

    function render(player) {
        var panel = player.panel;
        panel.querySelector('[data-role="score"]').textContent = player.remaining;
        panel.querySelector('[data-role="turns"]').textContent = 'Tours : ' + player.turns;
        var avg = player.turns > 0 ? (player.totalScored / player.turns) : 0;
        panel.querySelector('[data-role="avg"]').textContent = 'Moy : ' + avg.toFixed(1);

        var progress = player.startingScore > 0
            ? Math.min(100, Math.max(0, ((player.startingScore - player.remaining) / player.startingScore) * 100))
            : 0;
        panel.querySelector('[data-role="progress"]').style.width = progress + '%';

        var checkoutEl = panel.querySelector('[data-role="checkout"]');
        var isActive = players.indexOf(player) === activeIndex;
        var combo = isActive && !gameOver ? computeCheckout(player.remaining, player.checkoutVariant) : null;
        if (combo) {
            checkoutEl.hidden = false;
            checkoutEl.querySelector('[data-role="checkout-combo"]').textContent = combo.join('  ');
        } else {
            checkoutEl.hidden = true;
        }
    }

    function renderAll() {
        players.forEach(function (player, index) {
            player.panel.classList.toggle('active', index === activeIndex && !gameOver);
            render(player);
        });
        persist();
    }

    function updateDisplay() {
        if (mode === 'segment') {
            var sum = segmentTaps.reduce(function (a, b) {
                return a + b;
            }, 0);
            inputDisplay.textContent = String(sum);
            breakdownDisplay.textContent = segmentTaps.length ? segmentTaps.join(' + ') : '';
        } else {
            inputDisplay.textContent = buffer === '' ? '0' : buffer;
            breakdownDisplay.textContent = '';
        }
    }

    function resetInput() {
        buffer = '';
        segmentTaps = [];
        updateDisplay();
    }

    // Swaps which keypad is visible (shared by the mode toggle button and by
    // "Terminer" auto-returning to the total pad after a segment-mode turn).
    function setMode(newMode) {
        mode = newMode;
        keypadTotal.hidden = mode !== 'total';
        keypadZeroRow.hidden = mode !== 'total';
        keypadSegments.hidden = mode !== 'segment';
        keypadSegmentErase.hidden = mode !== 'segment';
    }

    function flashBust(player) {
        player.panel.classList.add('bust-flash');
        setTimeout(function () {
            player.panel.classList.remove('bust-flash');
        }, 600);
    }

    function showGameOver(player) {
        gameOver = true;
        // commitTurn() already called renderAll() for this turn just before
        // gameOver flipped true, so persist() ran while it still read false
        // and saved instead of clearing — clear it explicitly here instead
        // of relying on another renderAll() that never comes.
        persist();
        backLink.hidden = true;
        keypadPanel.hidden = true;
        player.panel.classList.add('winner');
        gameOverOverlay.hidden = false;
        gameOverOverlay.querySelector('[data-role="winner-name"]').textContent = player.name;
        gameOverOverlay.querySelector('[data-role="winner-detail"]').textContent =
            player.turns + (player.turns > 1 ? ' tours pour gagner' : ' tour pour gagner');
        gameOverOverlay.querySelector('[data-role="winner-input"]').value = player.id;
        gameOverOverlay.querySelector('[data-role="result-input"]').value = player.turns;
    }

    function commitTurn(scored) {
        if (gameOver) {
            return;
        }
        var player = players[activeIndex];
        var previous = {
            index: activeIndex,
            remaining: player.remaining,
            turns: player.turns,
            totalScored: player.totalScored
        };

        // Busts if the turn would go negative, or land on 1 (no double left to
        // finish on) — either way the turn counts but the score doesn't.
        var newRemaining = player.remaining - scored;
        var busted = scored > 0 && (newRemaining < 0 || newRemaining === 1);

        player.turns += 1;
        if (!busted) {
            player.remaining = newRemaining;
            player.totalScored += scored;
        } else {
            flashBust(player);
        }

        history.push(previous);
        resetInput();

        if (player.remaining === 0) {
            renderAll();
            showGameOver(player);
            return;
        }

        activeIndex = (activeIndex + 1) % players.length;
        renderAll();
    }

    document.querySelectorAll('[data-digit]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            if (gameOver || mode !== 'total' || buffer.length >= 3) {
                return;
            }
            buffer += btn.dataset.digit;
            updateDisplay();
        });
    });

    document.querySelectorAll('[data-segment]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            if (gameOver || mode !== 'segment' || segmentTaps.length >= 9) {
                return;
            }
            segmentTaps.push(parseInt(btn.dataset.segment, 10));
            updateDisplay();
        });
    });

    document.querySelector('[data-action="toggle-mode"]').addEventListener('click', function () {
        if (gameOver) {
            return;
        }
        setMode(mode === 'total' ? 'segment' : 'total');
        resetInput();
    });

    document.querySelectorAll('[data-action="clear"]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            if (mode === 'segment') {
                segmentTaps.pop();
            } else {
                buffer = buffer.slice(0, -1);
            }
            updateDisplay();
        });
    });

    document.querySelector('[data-action="done"]').addEventListener('click', function () {
        var scored;
        if (mode === 'segment') {
            scored = segmentTaps.reduce(function (a, b) {
                return a + b;
            }, 0);
            setMode('total');
        } else {
            scored = buffer === '' ? 0 : parseInt(buffer, 10);
            if (scored > 180) {
                return;
            }
        }
        commitTurn(scored);
    });

    document.querySelector('[data-action="undo"]').addEventListener('click', function () {
        var previous = history.pop();
        if (!previous) {
            return;
        }
        var player = players[previous.index];
        player.remaining = previous.remaining;
        player.turns = previous.turns;
        player.totalScored = previous.totalScored;
        player.panel.classList.remove('winner');

        activeIndex = previous.index;
        resetInput();

        if (gameOver) {
            gameOver = false;
            keypadPanel.hidden = false;
            gameOverOverlay.hidden = true;
            backLink.hidden = false;
        }
        renderAll();
    });

    panels.forEach(function (panel, index) {
        var refreshBtn = panel.querySelector('[data-role="checkout-refresh"]');
        refreshBtn.addEventListener('click', function () {
            players[index].checkoutVariant += 1;
            render(players[index]);
        });
    });

    restore();
    renderAll();
});
