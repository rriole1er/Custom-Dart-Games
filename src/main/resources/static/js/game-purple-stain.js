// Purple Stain: the very first turn of the game is spent tapping a zone on
// the dartboard, which becomes THE target for the rest of the game — shared
// by every player, not per-player. From then on, every turn is just "did you
// hit it": a single button, no board needed anymore. First player to press it
// truthfully wins the whole game outright (game-turn-engine.js's
// declareWinner), same one-shot pattern as Game Clock's bull. Turn order,
// both undo levels, and the win/undo chrome are the shared engine — this file
// only owns the target-defining board and the zone label text.
document.addEventListener('DOMContentLoaded', function () {
    var panels = Array.prototype.slice.call(document.querySelectorAll('.purple-panel'));
    if (!panels.length) {
        return;
    }

    var boardWrap = document.querySelector('[data-role="board-wrap"]');
    var targetBanner = document.querySelector('[data-role="target-banner"]');
    var targetLabelEl = document.querySelector('[data-role="target-label"]');
    var zoneEls = Array.prototype.slice.call(document.querySelectorAll('[data-zone]'));
    var turnActions = document.querySelector('.keypad-actions');

    // Shared across every player — set once by whoever plays the defining
    // turn, read by everyone afterwards. Folded into captureState/applyState
    // below so "Annuler le tour" correctly reverts it too.
    var targetZone = null;

    var ZONE_TYPE_LABELS = {petit: 'Petit', grand: 'Grand', double: 'Double', triple: 'Triple'};

    function zoneLabel(zone) {
        if (zone === 'bulle') {
            return 'Bulle';
        }
        if (zone === 'demi-bulle') {
            return 'Demi-bulle';
        }
        var dash = zone.indexOf('-');
        var type = zone.slice(0, dash);
        var number = zone.slice(dash + 1);
        return ZONE_TYPE_LABELS[type] + ' ' + number;
    }

    var players = panels.map(function (panel) {
        return {
            id: panel.dataset.playerId,
            name: panel.dataset.playerName,
            panel: panel,
            turnsEl: panel.querySelector('[data-role="turns"]'),
            hintEl: panel.querySelector('[data-role="hint"]'),
            achieveBtn: panel.querySelector('[data-role="achieve-btn"]'),
            turns: 0
        };
    });

    function render(ctx) {
        boardWrap.hidden = targetZone !== null;
        targetBanner.hidden = targetZone === null;
        // Nothing to undo or pass on yet — picking the zone commits its own
        // turn automatically, so these buttons are just noise until then.
        turnActions.hidden = targetZone === null;
        if (targetZone !== null) {
            targetLabelEl.textContent = zoneLabel(targetZone);
        }

        players.forEach(function (player, index) {
            var isMyTurn = index === ctx.activeIndex && !ctx.gameOver;
            // Before the target is set, only the definer's panel is worth
            // showing — nobody else has anything to do yet. Once it's set,
            // every player is back, same as Cricket/Clock.
            player.panel.hidden = targetZone === null && index !== ctx.activeIndex;
            player.turnsEl.textContent = 'Tours : ' + player.turns;
            player.hintEl.hidden = !(isMyTurn && targetZone === null);
            player.achieveBtn.hidden = targetZone === null;
            player.achieveBtn.disabled = !(isMyTurn && targetZone !== null);
        });
    }

    var engine = createTurnEngine({
        players: players,
        captureState: function () {
            return {targetZone: targetZone};
        },
        applyState: function (player, state) {
            targetZone = state.targetZone;
        },
        render: render,
        focusable: false
    });

    function populateWinOverlay(overlay, player) {
        overlay.querySelector('[data-role="winner-detail"]').textContent =
            zoneLabel(targetZone) + ' touchée en ' + player.turns + (player.turns > 1 ? ' tours' : ' tour');
        overlay.querySelector('[data-role="winner-input"]').value = player.id;
        overlay.querySelector('[data-role="result-input"]').value = player.turns;
    }

    zoneEls.forEach(function (el) {
        el.addEventListener('click', function () {
            if (targetZone !== null) {
                return;
            }
            targetZone = el.dataset.zone;
            el.classList.add('tapped');

            // Defining the target isn't a real attempt at hitting it — every
            // player, including whoever just set it, starts their own count
            // of real turns at 0.
            var definer = players[engine.getActiveIndex()];
            setTimeout(function () {
                engine.commitTurn();
                definer.turns -= 1;
                engine.render();
            }, 300);
        });
    });

    players.forEach(function (player, index) {
        player.achieveBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            if (!engine.canAct(index) || targetZone === null) {
                return;
            }
            engine.declareWinner(player, populateWinOverlay);
        });
    });
});
