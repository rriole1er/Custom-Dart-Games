// Shared by every game screen: back arrow and exit screen.
// Wipes every "dartGameState:"
// entry rather than computing this game's exact key, since only one game
// is ever in progress on a given device at a time anyway.
function clearSavedGameState() {
    try {
        // localStorage.length/.key(i) is the documented Storage iteration.
        const staleKeys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.indexOf('dartGameState:') === 0) {
                staleKeys.push(key);
            }
        }
        staleKeys.forEach(function (key) {
            localStorage.removeItem(key);
        });
    } catch (e) {
        // Storage unavailable — nothing to clean up either way.
    }
}

// Wipes one saved-game entry. Swallows any storage error (private browsing,
// disabled) — nothing to clean up either way in that case.
function removeSavedKey(key) {
    try {
        localStorage.removeItem(key);
    } catch (e) {
        // Storage unavailable.
    }
}

// Every in-progress-game save is scoped to the exact page + lineup it
// belongs to: the page title tells different games apart, the player ids
// (in order) tell different lineups of the SAME game apart — so a reload of
// the exact same match finds its save, but nothing else ever does.
function dartGameStorageKey(playerIds) {
    return 'dartGameState:' + document.title + ':' + playerIds.join(',');
}

// Writes `data` to localStorage under `key`, stamped with the current time
// so loadTimestamped() can later tell a fresh save from an abandoned one.
// Swallows any storage error — the caller keeps working either way, it
// just won't survive a refresh.
function saveTimestamped(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(Object.assign({savedAt: Date.now()}, data)));
    } catch (e) {
        // Storage full or unavailable.
    }
}

// Reads back a saveTimestamped() blob, or returns null if there's nothing
// there, it's corrupt, or it's older than maxAgeMs — removing it in that
// last case, on the theory that a save that old is more likely an abandoned
// game (tab closed without confirming exit) than one worth resuming.
function loadTimestamped(key, maxAgeMs) {
    let raw;
    try {
        raw = localStorage.getItem(key);
    } catch (e) {
        return null;
    }
    if (!raw) {
        return null;
    }
    let saved;
    try {
        saved = JSON.parse(raw);
    } catch (e) {
        return null;
    }
    if (!saved.savedAt || Date.now() - saved.savedAt > maxAgeMs) {
        removeSavedKey(key);
        return null;
    }
    return saved;
}

// Fills the 3 win-overlay fields every game sets once it knows who won —
// only the detail text actually varies game to game, and only Geo Jura's
// result value isn't just `player.turns`. Lives here (not game-turn-
// engine.js) since Countdown doesn't load that file but does load this one,
// and this helper has no actual dependency on the turn engine itself.
function populateWinnerFields(overlay, player, detailText, resultValue) {
    overlay.querySelector('[data-role="winner-detail"]').textContent = detailText;
    overlay.querySelector('[data-role="winner-input"]').value = player.id;
    overlay.querySelector('[data-role="result-input"]').value = resultValue === undefined ? player.turns : resultValue;
}

// "tour"/"tours" agreement for a turn count, e.g. n + ' ' + toursWord(n).
function toursWord(n) {
    return n > 1 ? 'tours' : 'tour';
}

// Shared shape behind every game's own persist()/restore(): save-or-clear on
// gameOver, and on restore, bail out (returning false, e.g. on a player-count
// mismatch) without disturbing the fresh start the caller already set up.
// capture() returns this game's own snapshot; apply(saved) restores it and
// returns whether it actually applied.
function createPersistence(storageKey, maxAgeMs, capture, apply) {
    return {
        persist: function (gameOver) {
            if (gameOver) {
                removeSavedKey(storageKey);
                return;
            }
            saveTimestamped(storageKey, capture());
        },
        restore: function () {
            const saved = loadTimestamped(storageKey, maxAgeMs);
            return saved ? apply(saved) : false;
        }
    };
}

// Builds ranked rows (.baseball-rank-row/-name/-score) into a game-over
// overlay's [data-role="final-ranking"] list. entries: [{name, value, isWinner}].
function populateRankedList(overlay, entries) {
    const list = overlay.querySelector('[data-role="final-ranking"]');
    list.innerHTML = '';
    entries.forEach(function (entry) {
        const row = document.createElement('div');
        row.className = 'baseball-rank-row' + (entry.isWinner ? ' winner' : '');

        const name = document.createElement('span');
        name.className = 'baseball-rank-name';
        name.textContent = entry.name + (entry.isWinner ? ' 🏆' : '');

        const value = document.createElement('span');
        value.className = 'baseball-rank-score';
        value.textContent = entry.value;

        row.appendChild(name);
        row.appendChild(value);
        list.appendChild(row);
    });
}

// Wires [data-action="save-all-results"]: one POST per player to
// /dart/play/finish, then redirects. resultOf(player) supplies the score to
// save; extraParams(player), if given, appends more querystring (e.g.
// Scram's resultInflicted).
function wireSaveAllResults(players, gameOverOverlay, resultOf, extraParams) {
    document.querySelector('[data-action="save-all-results"]').addEventListener('click', function (e) {
        const btn = e.currentTarget;
        btn.disabled = true;
        const gameId = gameOverOverlay.dataset.gameId;
        Promise.all(players.map(function (player) {
            return fetch('/dart/play/finish', {
                method: 'POST',
                headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                body: 'gameId=' + encodeURIComponent(gameId) + '&userId=' + encodeURIComponent(player.id)
                    + '&result=' + encodeURIComponent(resultOf(player))
                    + (extraParams ? extraParams(player) : '')
            });
        })).then(function () {
            window.location.href = '/dart/play';
        });
    });
}

document.addEventListener('DOMContentLoaded', function () {
    // Arrow back
    const backLink = document.querySelector('[data-role="back-link"]');
    // Exit overlay
    const exitConfirmOverlay = document.querySelector('[data-role="exit-confirm"]');
    // Game over overlay
    const gameOverOverlay = document.querySelector('[data-role="game-over"]');
    if (!backLink || !exitConfirmOverlay) {
        return;
    }


    backLink.addEventListener('click', function (e) {
        if (gameOverOverlay && !gameOverOverlay.hidden) {
            return;
        }
        e.preventDefault();
        exitConfirmOverlay.hidden = false;
    });

    exitConfirmOverlay.querySelector('[data-action="exit-cancel"]').addEventListener('click', function () {
        exitConfirmOverlay.hidden = true;
    });

    exitConfirmOverlay.querySelector('[data-action="exit-confirm"]').addEventListener('click', function () {
        clearSavedGameState();
        window.location.href = backLink.href;
    });
});
