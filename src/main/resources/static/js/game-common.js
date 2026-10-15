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

// Helps a game screen with multiple players collapse the player stack when the active player changes. 
// The stack is expanded/collapsed by clicking on the active player's panel, and is collapsed automatically when the active player changes.
function createPlayersStackController(options) {
    const opts = options || {};
    const stack = document.querySelector(opts.stackSelector || '[data-role="players-stack"]');

    if (!stack) {
        return {
            collapse: function () {
            },
            collapseOnActiveChange: function () {
            }
        };
    }

    const panelSelector = opts.panelSelector || '.player-panel';
    const activeSelector = panelSelector + '.active';
    let lastActiveIndex = null;

    function collapse() {
        stack.classList.add('is-collapsed');
        stack.classList.remove('is-expanded');
    }

    stack.addEventListener('click', function (event) {
        const activePanel = stack.querySelector(activeSelector);
        if (!activePanel || !activePanel.contains(event.target)) {
            return;
        }

        const expanded = stack.classList.toggle('is-expanded');
        stack.classList.toggle('is-collapsed', !expanded);
    });

    return {
        collapse: collapse,
        collapseOnActiveChange: function (activeIndex) {
            if (activeIndex !== lastActiveIndex) {
                collapse();
                lastActiveIndex = activeIndex;
            }
        }
    };
}

// Helps a game screen with multiple players show a carousel of player panels, with optional controls and swipe gestures. 
// The carousel shows a fixed number of players at a time, and can be navigated with next/prev buttons or by swiping left/right on touch devices. The carousel can also automatically follow the active player if desired.
function createPlayersCarouselController(options) {
    const opts = options || {};
    const stack = document.querySelector(opts.stackSelector || '[data-role="players-stack"]');

    if (!stack) {
        return {
            goToPage: function () {},
            syncActive: function () {},
            refresh: function () {}
        };
    }

    const panelSelector = opts.panelSelector || '.player-panel';
    const visiblePlayers = Math.max(1, parseInt(opts.visiblePlayers || stack.dataset.visiblePlayers || '2', 10) || 2);
    const autoFollowActive = opts.autoFollowActive !== false;
    const swipeThresholdPx = opts.swipeThreshold || 48;

    const panels = Array.prototype.slice.call(stack.querySelectorAll(panelSelector));
    const pages = [];
    let page = 0;

    let viewport = null;
    let track = null;

    let startX = 0;
    let startY = 0;
    let deltaX = 0;
    let dragging = false;
    let horizontalLock = null;

    function totalPages() {
        return Math.max(1, Math.ceil(panels.length / visiblePlayers));
    }

    function clampPage(value) {
        return Math.max(0, Math.min(value, totalPages() - 1));
    }

    function buildDom() {
        stack.classList.add('players-carousel');
        stack.innerHTML = '';

        viewport = document.createElement('div');
        viewport.className = 'players-carousel-viewport';

        track = document.createElement('div');
        track.className = 'players-carousel-track';

        for (let i = 0; i < panels.length; i += visiblePlayers) {
            const pageEl = document.createElement('div');
            pageEl.className = 'players-carousel-page';

            panels.slice(i, i + visiblePlayers).forEach(function (panel) {
                pageEl.appendChild(panel);
            });

            pages.push(pageEl);
            track.appendChild(pageEl);
        }

        viewport.appendChild(track);
        stack.appendChild(viewport);
    }

    function viewportWidth() {
        return viewport ? viewport.clientWidth : 0;
    }

    function setTranslate(px, withTransition) {
        if (!track) return;
        track.style.transition = withTransition ? 'transform 260ms ease' : 'none';
        track.style.transform = 'translate3d(' + px + 'px, 0, 0)';
    }

    function pageToTranslate(pageIndex) {
        return -(clampPage(pageIndex) * viewportWidth());
    }

    function render(withTransition) {
        setTranslate(pageToTranslate(page), withTransition !== false);
    }

    function goToPage(nextPage, withTransition) {
        page = clampPage(nextPage);
        render(withTransition !== false);
    }

    function onTouchStart(e) {
        if (!e.touches || e.touches.length !== 1) return;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        deltaX = 0;
        dragging = true;
        horizontalLock = null;
        track.style.transition = 'none';
    }

    function onTouchMove(e) {
        if (!dragging || !e.touches || e.touches.length !== 1) return;

        const x = e.touches[0].clientX;
        const y = e.touches[0].clientY;
        const dx = x - startX;
        const dy = y - startY;

        if (horizontalLock === null) {
            if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
            horizontalLock = Math.abs(dx) > Math.abs(dy);
        }

        if (!horizontalLock) return;

        e.preventDefault();
        deltaX = dx;

        const base = pageToTranslate(page);
        setTranslate(base + deltaX, false);
    }

    function onTouchEnd() {
        if (!dragging) return;
        dragging = false;

        if (!horizontalLock) {
            render(true);
            return;
        }

        const w = viewportWidth();
        const ratio = w ? Math.abs(deltaX) / w : 0;
        const shouldSwitch = Math.abs(deltaX) > swipeThresholdPx || ratio > 0.2;

        if (shouldSwitch) {
            if (deltaX < 0) {
                goToPage(page + 1, true); // swipe left => next
            } else {
                goToPage(page - 1, true); // swipe right => prev
            }
        } else {
            render(true);
        }
    }

    buildDom();

    viewport.addEventListener('touchstart', onTouchStart, { passive: true });
    viewport.addEventListener('touchmove', onTouchMove, { passive: false });
    viewport.addEventListener('touchend', onTouchEnd, { passive: true });
    viewport.addEventListener('touchcancel', onTouchEnd, { passive: true });

    window.addEventListener('resize', function () {
        render(false);
    });

    render(false);

    return {
        goToPage: function (nextPage) {
            goToPage(nextPage, true);
        },
        syncActive: function (activeIndex) {
            if (!autoFollowActive || typeof activeIndex !== 'number') return;
            goToPage(Math.floor(activeIndex / visiblePlayers), true);
        },
        refresh: function () {
            render(false);
        }
    };
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
