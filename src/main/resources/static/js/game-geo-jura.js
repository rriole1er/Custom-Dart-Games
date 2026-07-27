// Geo Jura: each turn the active player throws 3 darts — entered here the
// same way Countdown's segment keypad works (tap the plain value once per
// ring: a triple-20 is three taps of "20"), up to 9 taps for 3 darts,
// budget-gated by the shared game-turn-engine.js exactly like every other
// game. The RUNNING SUM of those taps is a department number: this is the
// only game where the actual dart value matters rather than just hit/miss.
//
// The turn is three strictly sequential phases, not independent actions —
// once you confirm one you can't go back and retry it:
//   1. "darts" — only the keypad is visible. Tap out the 3 darts, then
//      press "Valider les fléchettes" to lock the sum in; there's no right
//      or wrong here, it's just a confirm that moves you on.
//   2. "name" — only the target banner + free-text name guess are visible.
//      One submit of the name (right or wrong, accent/case/punctuation-
//      insensitive match against the department's real name) is all you
//      get; right scores the point INSTANTLY (not folded in at the end of
//      the turn), wrong doesn't, either way it's locked in and the screen
//      swaps to the map.
//   3. "map" — only the map (+ its zoom controls) is visible. One tap on
//      any department resolves the turn instantly — right scores the
//      placement point and ends the turn, wrong scores nothing and still
//      ends the turn, no retrying a miss. "Terminer le tour" is shown here
//      too, as an explicit "I'm not even trying" skip that resolves exactly
//      like a miss — it's hidden during the other two phases, which each
//      have their own dedicated confirm action instead.
// Either point can push a player to 10 and end the game right there, mid-
// turn — win is checked the instant a point is scored, not just at commit.
// Turn order and both undo levels are the shared engine; this file owns the
// dart tally, the phase, the department lookup (read straight off the
// map's own data-dept/data-name attributes, so there's only one place the
// department list lives), and the name/placement checks.
document.addEventListener('DOMContentLoaded', function () {
    var panels = Array.prototype.slice.call(document.querySelectorAll('.geo-panel'));
    if (!panels.length) {
        return;
    }

    var keypadPanel = document.getElementById('keypad-panel');
    var inputDisplay = document.querySelector('[data-role="input-display"]');
    var breakdownDisplay = document.querySelector('[data-role="segment-breakdown"]');
    var targetBanner = document.querySelector('[data-role="target-banner"]');
    var nameForm = document.querySelector('[data-role="name-form"]');
    var nameInput = document.querySelector('[data-role="name-input"]');
    var nameSubmit = document.querySelector('[data-role="name-submit"]');
    var confirmDartsBtn = document.querySelector('[data-action="confirm-darts"]');
    var mapToolbar = document.querySelector('[data-role="map-toolbar"]');
    var mapWrap = document.querySelector('.geo-map-wrap');
    var mapEl = document.querySelector('.geo-map');
    var zoomOutBtn = document.querySelector('[data-action="zoom-out"]');
    var zoomInBtn = document.querySelector('[data-action="zoom-in"]');
    var doneBtn = document.querySelector('[data-action="done"]');
    var deptEls = Array.prototype.slice.call(document.querySelectorAll('.geo-dept'));

    // Built once from the map itself — every department's official name and
    // number lives only in the SVG's data-dept/data-name attributes, so
    // there's no separate list to keep in sync. Non-numeric codes (2A/2B for
    // Corse) never appear here: no dart sum can ever land on them.
    var DEPARTMENTS = {};
    deptEls.forEach(function (el) {
        if (/^\d+$/.test(el.dataset.dept)) {
            DEPARTMENTS[parseInt(el.dataset.dept, 10)] = {code: el.dataset.dept, name: el.dataset.name};
        }
    });

    var WIN_SCORE = 10;
    var RESOLVE_DELAY_MS = 400;

    var players = panels.map(function (panel) {
        return {
            id: panel.dataset.playerId,
            name: panel.dataset.playerName,
            panel: panel,
            turnsEl: panel.querySelector('[data-role="turns"]'),
            scoreEl: panel.querySelector('[data-role="score"]'),
            nameTag: panel.querySelector('[data-role="name-tag"]'),
            mapTag: panel.querySelector('[data-role="map-tag"]'),
            score: 0,
            turns: 0
        };
    });

    // Shared, not per-player — this turn's darts and how far the current
    // player has gotten. Folded into captureState/applyState below so both
    // undo levels revert it correctly; reset in beforeCommit once the turn
    // ends (score itself is applied instantly when earned, not here).
    var dartTaps = [];
    var namedCorrectly = false;
    var placedCorrectly = false;
    var phase = 'darts';
    var gameOverFlag = false;
    // True for the brief window between a name-submit or map-tap and the
    // phase/turn change it triggers — blocks a second tap from sneaking in
    // during that delay, not part of the undo snapshot (nothing to undo,
    // it's mid-air).
    var resolving = false;

    // Map zoom is a pure view preference (which departments are fiddly to
    // tap depends on the player's screen, not the game state), so it's
    // deliberately outside captureState/applyState and survives undo/turn
    // changes untouched.
    var ZOOM_CLASSES = ['', 'geo-map-zoom-2', 'geo-map-zoom-3'];
    var zoomIndex = 0;

    function applyZoom() {
        ZOOM_CLASSES.forEach(function (cls) {
            if (cls) {
                mapEl.classList.remove(cls);
            }
        });
        if (ZOOM_CLASSES[zoomIndex]) {
            mapEl.classList.add(ZOOM_CLASSES[zoomIndex]);
        }
        zoomOutBtn.disabled = zoomIndex === 0;
        zoomInBtn.disabled = zoomIndex === ZOOM_CLASSES.length - 1;
    }

    zoomInBtn.addEventListener('click', function () {
        if (zoomIndex < ZOOM_CLASSES.length - 1) {
            zoomIndex += 1;
            applyZoom();
        }
    });
    zoomOutBtn.addEventListener('click', function () {
        if (zoomIndex > 0) {
            zoomIndex -= 1;
            applyZoom();
        }
    });
    applyZoom();

    function currentSum() {
        return dartTaps.reduce(function (a, b) {
            return a + b;
        }, 0);
    }

    function normalize(text) {
        return text
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
    }

    function flashWrong(el, className) {
        el.classList.add(className);
        setTimeout(function () {
            el.classList.remove(className);
        }, 500);
    }

    function render(ctx) {
        gameOverFlag = ctx.gameOver;
        var sum = currentSum();
        var target = DEPARTMENTS[sum];

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

        nameInput.disabled = ctx.gameOver || phase !== 'name' || resolving;
        nameSubmit.disabled = ctx.gameOver || phase !== 'name' || resolving;

        players.forEach(function (player, index) {
            var isActive = index === ctx.activeIndex && !ctx.gameOver;
            player.turnsEl.textContent = 'Tours : ' + player.turns;
            player.scoreEl.textContent = String(player.score);
            player.nameTag.hidden = !(isActive && namedCorrectly);
            player.mapTag.hidden = !(isActive && placedCorrectly);
        });

        deptEls.forEach(function (el) {
            var isTarget = !!target && el.dataset.dept === target.code;
            el.classList.toggle('geo-dept-correct', isTarget && placedCorrectly);
        });
    }

    function populateWinOverlay(overlay, player) {
        overlay.querySelector('[data-role="winner-detail"]').textContent =
            player.score + ' points en ' + player.turns + (player.turns > 1 ? ' tours' : ' tour');
        overlay.querySelector('[data-role="winner-input"]').value = player.id;
        overlay.querySelector('[data-role="result-input"]').value = player.score;
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

    var engine = createTurnEngine({
        players: players,
        focusable: false,
        captureState: function (player) {
            return {
                score: player.score,
                dartTaps: dartTaps.slice(),
                namedCorrectly: namedCorrectly,
                placedCorrectly: placedCorrectly,
                phase: phase
            };
        },
        applyState: function (player, state) {
            player.score = state.score;
            dartTaps = state.dartTaps.slice();
            namedCorrectly = state.namedCorrectly;
            placedCorrectly = state.placedCorrectly;
            phase = state.phase;
            resolving = false;
            nameInput.value = '';
        },
        render: render,
        beforeCommit: function () {
            dartTaps = [];
            namedCorrectly = false;
            placedCorrectly = false;
            phase = 'darts';
            nameInput.value = '';
        }
    });

    document.querySelectorAll('[data-segment]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var activeIndex = engine.getActiveIndex();
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
        if (gameOverFlag || phase !== 'name' || resolving) {
            return;
        }
        var player = players[engine.getActiveIndex()];
        var target = DEPARTMENTS[currentSum()];
        var correct = !!target && normalize(nameInput.value) === normalize(target.name);
        resolving = true;
        if (correct) {
            namedCorrectly = true;
            if (awardPoint(player)) {
                return;
            }
        } else {
            flashWrong(nameInput, 'geo-name-input-wrong');
            engine.render();
        }
        setTimeout(function () {
            resolving = false;
            phase = 'map';
            nameInput.value = '';
            engine.render();
        }, RESOLVE_DELAY_MS);
    });

    deptEls.forEach(function (el) {
        el.addEventListener('click', function () {
            if (gameOverFlag || phase !== 'map' || resolving) {
                return;
            }
            var player = players[engine.getActiveIndex()];
            var target = DEPARTMENTS[currentSum()];
            var correct = !!target && el.dataset.dept === target.code;
            resolving = true;
            if (correct) {
                placedCorrectly = true;
                if (awardPoint(player)) {
                    return;
                }
            } else {
                flashWrong(el, 'geo-dept-wrong');
                engine.render();
            }
            setTimeout(function () {
                resolving = false;
                engine.commitTurn();
                engine.render();
            }, RESOLVE_DELAY_MS);
        });
    });
});
