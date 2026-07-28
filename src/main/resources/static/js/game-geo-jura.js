// Geo Jura: each turn the active player throws 3 darts —  up to 9 taps for 3 darts,
// The RUNNING SUM of those taps is a department number.
//
// The turn is three sequential phases:
//   1. "darts" — only the keypad is visible. Tap out the 3 darts, then
//      press "Valider les fléchettes" to lock the sum in.
//   2. "name" — only the target banner + free-text name guess are visible.
//      One submit of the name (accent/case/punctuation-
//      insensitive match against the department's real name)
//      right scores the point, wrong doesn't, either way it's locked in and the screen
//      swaps to the map.
//   3. "map" — only the map (+ its zoom controls) is visible. One tap on
//      any department resolves the turn instantly — right scores the
//      placement point and ends the turn, wrong scores nothing and still
//      ends the turn.

// Either point can push a player to 10 and end the game right there, mid-
// turn — win is checked the instant a point is scored, not just at commit.
document.addEventListener('DOMContentLoaded', function () {
    const panels = Array.prototype.slice.call(document.querySelectorAll('.geo-panel'));
    if (!panels.length) {
        return;
    }

    const keypadPanel = document.getElementById('keypad-panel');
    const inputDisplay = document.querySelector('[data-role="input-display"]');
    const breakdownDisplay = document.querySelector('[data-role="segment-breakdown"]');
    const targetBanner = document.querySelector('[data-role="target-banner"]');
    const nameForm = document.querySelector('[data-role="name-form"]');
    const nameInput = document.querySelector('[data-role="name-input"]');
    const nameSubmit = document.querySelector('[data-role="name-submit"]');
    const confirmDartsBtn = document.querySelector('[data-action="confirm-darts"]');
    const mapToolbar = document.querySelector('[data-role="map-toolbar"]');
    const mapWrap = document.querySelector('.geo-map-wrap');
    const mapEl = document.querySelector('.geo-map');
    const zoomOutBtn = document.querySelector('[data-action="zoom-out"]');
    const zoomInBtn = document.querySelector('[data-action="zoom-in"]');
    const parisZoomBtn = document.querySelector('[data-action="zoom-paris"]');
    const doneBtn = document.querySelector('[data-action="done"]');
    const deptEls = Array.prototype.slice.call(document.querySelectorAll('.geo-dept'));

    // Built once from the map itself — every department's official name and
    // number lives only in the SVG's data-dept/data-name attributes, so
    // there's no separate list to keep in sync. Non-numeric codes (2A/2B for
    // Corse) never appear here: no dart sum can ever land on them.
    const DEPARTMENTS = {};
    deptEls.forEach(function (el) {
        if (/^\d+$/.test(el.dataset.dept)) {
            DEPARTMENTS[parseInt(el.dataset.dept, 10)] = {code: el.dataset.dept, name: el.dataset.name};
        }
    });

    const WIN_SCORE = 10;

    // Display players
    const players = panels.map(function (panel) {
        return {
            id: panel.dataset.playerId,
            name: panel.dataset.playerName,
            panel: panel,
            turnsEl: panel.querySelector('[data-role="turns"]'),
            scoreEl: panel.querySelector('[data-role="score"]'),
            score: 0,
            turns: 0
        };
    });

    // Shared, not per-player — this turn's darts and how far the current
    // player has gotten. placedCorrectly only ever drives the map's own
    // green highlight now — the score itself is the feedback for everything
    // else, nothing else needs its own indicator.
    let dartTaps = [];
    let placedCorrectly = false;
    let phase = 'darts';
    let gameOverFlag = false;

    // Map zoom
    const ZOOM_CLASSES = ['', 'geo-map-zoom-2', 'geo-map-zoom-3'];
    let zoomIndex = 0;
    // Paris is tiny even at max normal zoom, so the dedicated Paris button
    // switches to its own, much bigger, separately-cycling ladder — +/- then
    // step through THAT ladder instead of the normal one, one level further
    // in than plain zoom-in ever reaches, until zoom-out walks back down and
    // off the bottom of it into the normal ladder's max level.
    const PARIS_ZOOM_CLASSES = ['geo-map-zoom-paris', 'geo-map-zoom-paris-2'];
    let parisZoomActive = false;
    let parisZoomIndex = 0;
    const parisDeptEl = deptEls.filter(function (el) {
        return el.dataset.dept === '75';
    })[0];

    // Applies the current zoom level to the map and toggles zoom button disabled state.
    function applyZoom() {
        ZOOM_CLASSES.forEach(function (cls) {
            if (cls) {
                mapEl.classList.remove(cls);
            }
        });
        PARIS_ZOOM_CLASSES.forEach(function (cls) {
            mapEl.classList.remove(cls);
        });
        if (parisZoomActive) {
            mapEl.classList.add(PARIS_ZOOM_CLASSES[parisZoomIndex]);
        } else if (ZOOM_CLASSES[zoomIndex]) {
            mapEl.classList.add(ZOOM_CLASSES[zoomIndex]);
        }
        zoomOutBtn.disabled = !parisZoomActive && zoomIndex === 0;
        zoomInBtn.disabled = parisZoomActive
            ? parisZoomIndex === PARIS_ZOOM_CLASSES.length - 1
            : zoomIndex === ZOOM_CLASSES.length - 1;
    }

    // Re-centers the scroll on Paris — needed every time the map's width
    // changes while Paris is (or was) the point of interest, since the
    // scroll position is in absolute pixels and stays put otherwise, ending
    // up pointed at a totally different, often blank, part of the map.
    function centerOnParis() {
        if (parisDeptEl) {
            parisDeptEl.scrollIntoView({block: 'center', inline: 'center'});
        }
    }

    zoomInBtn.addEventListener('click', function () {
        if (parisZoomActive) {
            if (parisZoomIndex < PARIS_ZOOM_CLASSES.length - 1) {
                parisZoomIndex += 1;
            }
            applyZoom();
            centerOnParis();
            return;
        }
        if (zoomIndex < ZOOM_CLASSES.length - 1) {
            zoomIndex += 1;
        }
        applyZoom();
    });
    zoomOutBtn.addEventListener('click', function () {
        if (parisZoomActive) {
            if (parisZoomIndex > 0) {
                parisZoomIndex -= 1;
                applyZoom();
                centerOnParis();
            } else {
                // Walked off the bottom of the Paris ladder — land on the
                // biggest normal level, the natural next step down.
                parisZoomActive = false;
                zoomIndex = ZOOM_CLASSES.length - 1;
                applyZoom();
                centerOnParis();
            }
            return;
        }
        if (zoomIndex > 0) {
            zoomIndex -= 1;
        }
        applyZoom();
    });
    parisZoomBtn.addEventListener('click', function () {
        parisZoomActive = true;
        parisZoomIndex = 0;
        applyZoom();
        centerOnParis();
    });
    applyZoom();

    // Sums the recorded dart taps for the current turn.
    function currentSum() {
        return dartTaps.reduce(function (a, b) {
            return a + b;
        }, 0);
    }

    // Normalizes text for accent/case/punctuation-insensitive comparison.
    function normalize(text) {
        return text
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
    }

    // Briefly flashes a class on an element, then removes it.
    function flashWrong(el, className) {
        el.classList.add(className);
        setTimeout(function () {
            el.classList.remove(className);
        }, 500);
    }

    // Renders the current phase, target department, and player state to the DOM.
    function render(ctx) {
        gameOverFlag = ctx.gameOver;
        const sum = currentSum();
        const target = DEPARTMENTS[sum];

        inputDisplay.textContent = String(sum);
        breakdownDisplay.textContent = dartTaps.length ? dartTaps.join(' + ') : '';

        keypadPanel.hidden = ctx.gameOver || phase !== 'darts';
        nameForm.hidden = ctx.gameOver || phase !== 'name';
        mapToolbar.hidden = ctx.gameOver || phase !== 'map';
        mapWrap.hidden = ctx.gameOver || phase !== 'map';
        doneBtn.hidden = ctx.gameOver || phase !== 'map';

        if (ctx.gameOver) {
            targetBanner.textContent = '';
        } else if (phase === 'darts') {
            targetBanner.textContent = 'Lance tes 3 fléchettes';
        } else if (!target) {
            targetBanner.textContent = 'Département n° ' + sum + ' — aucun département';
        } else if (phase === 'name') {
            targetBanner.textContent = 'Département n° ' + sum + ' — trouve son nom';
        } else {
            targetBanner.textContent = 'Département n° ' + sum + ' — place-le sur la carte';
        }

        nameInput.disabled = ctx.gameOver || phase !== 'name';
        nameSubmit.disabled = ctx.gameOver || phase !== 'name';

        players.forEach(function (player) {
            player.turnsEl.textContent = 'Tours : ' + player.turns;
            player.scoreEl.textContent = String(player.score);
        });

        deptEls.forEach(function (el) {
            const isTarget = !!target && el.dataset.dept === target.code;
            el.classList.toggle('geo-dept-correct', isTarget && placedCorrectly);
        });
    }

    // Fills the win overlay with this player's final score and turn count.
    function populateWinOverlay(overlay, player) {
        populateWinnerFields(overlay, player,
            player.score + ' points en ' + player.turns + ' ' + toursWord(player.turns), player.score);
    }

    // Applies straight to the player's persistent score the instant it's
    // earned (not folded in at beforeCommit) — a point can reach 10 mid-
    // turn, so it's checked here too, rather than only once a turn commits.
    function awardPoint(player) {
        player.score += 1;
        if (player.score >= WIN_SCORE) {
            engine.declareWinner(player, populateWinOverlay);
            return true;
        }
        engine.render();
        return false;
    }

    const engine = createTurnEngine({
        players: players,
        focusable: false,
        captureState: function (player) {
            return {
                score: player.score,
                dartTaps: dartTaps.slice(),
                placedCorrectly: placedCorrectly,
                phase: phase
            };
        },
        applyState: function (player, state) {
            player.score = state.score;
            dartTaps = state.dartTaps.slice();
            placedCorrectly = state.placedCorrectly;
            phase = state.phase;
            nameInput.value = '';
        },
        render: render,
        beforeCommit: function () {
            dartTaps = [];
            placedCorrectly = false;
            phase = 'darts';
            nameInput.value = '';
        }
    });

    document.querySelectorAll('[data-segment]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            const activeIndex = engine.getActiveIndex();
            if (phase !== 'darts' || !engine.canAct(activeIndex)) {
                return;
            }
            engine.recordClick(players[activeIndex]);
            dartTaps.push(parseInt(btn.dataset.segment, 10));
            engine.render();
        });
    });

    confirmDartsBtn.addEventListener('click', function () {
        if (gameOverFlag || phase !== 'darts') {
            return;
        }
        phase = 'name';
        engine.render();
    });

    nameForm.addEventListener('submit', function (e) {
        e.preventDefault();
        if (gameOverFlag || phase !== 'name') {
            return;
        }
        const player = players[engine.getActiveIndex()];
        const target = DEPARTMENTS[currentSum()];
        const correct = !!target && normalize(nameInput.value) === normalize(target.name);
        if (correct && awardPoint(player)) {
            return;
        }
        if (!correct) {
            flashWrong(nameInput, 'geo-name-input-wrong');
        }
        phase = 'map';
        nameInput.value = '';
        engine.render();
    });

    deptEls.forEach(function (el) {
        el.addEventListener('click', function () {
            if (gameOverFlag || phase !== 'map') {
                return;
            }
            const player = players[engine.getActiveIndex()];
            const target = DEPARTMENTS[currentSum()];
            const correct = !!target && el.dataset.dept === target.code;
            if (correct) {
                placedCorrectly = true;
                if (awardPoint(player)) {
                    return;
                }
            } else {
                flashWrong(el, 'geo-dept-wrong');
            }
            engine.commitTurn();
            engine.render();
        });
    });
});
