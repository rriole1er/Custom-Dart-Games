// Game clock (Horloge): players must validate 1 through 20 in strict order,
// then hit the bull to win. Validating a number takes 3 points — a triple
// scores all 3 at once, a double scores 2, a single scores 1 — which is the
// same interaction as Cricket's marks (tap the same box up to 3 times), just
// gated so only the player's current target is ever clickable; every other
// number is locked until the previous one is done. The bull needs a single
// tap once it becomes the current target, no points involved. Turn order,
// both undo levels, and the win/undo chrome are handled by the shared
// game-turn-engine.js (loaded before this file) — this file only owns what's
// specific to the clock itself: sector order, points, and the expand toggle.

const variantEl = document.querySelector('[data-variant]');
const variant = variantEl ? variantEl.dataset.variant : null;

document.addEventListener('DOMContentLoaded', function () {
    const panels = Array.prototype.slice.call(document.querySelectorAll('.clock-panel'));
    if (!panels.length) {
        return;
    }

    // Populate the array of numbers + bull
    const TARGETS = [];
    for (let n = 1; n <= 20; n++) {
        TARGETS.push(String(n));
    }
    TARGETS.push('B');

    let POINTS_TO_VALIDATE;

    // Define the number of points to validate a number
    if (variant === "fast-clock") {
        POINTS_TO_VALIDATE = 1;
    } else {
        POINTS_TO_VALIDATE = 3;
    }
    const WINDOW_SIZE = 6;

    // One dart always validates the current number in Fast Clock, so there's
    // no partial progress toward 3 points worth showing — the dots only make
    // sense when a number can take more than one hit to validate.
    const showPoints = POINTS_TO_VALIDATE > 1;

    // Player display information
    const players = panels.map(function (panel) {
        const boxes = {};
        TARGETS.forEach(function (target, i) {
            boxes[i] = panel.querySelector('.clock-box[data-index="' + i + '"]');
        });
        return {
            id: panel.dataset.playerId,
            name: panel.dataset.playerName,
            panel: panel,
            turnsEl: panel.querySelector('[data-role="turns"]'),
            targetEl: panel.querySelector('[data-role="target"]'),
            pointsEl: panel.querySelector('.clock-points'),
            pointDots: Array.prototype.slice.call(panel.querySelectorAll('.clock-point-dot')),
            expandBtn: panel.querySelector('[data-action="toggle-expand"]'),
            boxes: boxes,
            targetIndex: 0,
            points: 0,
            turns: 0,
            expanded: false
        };
    });

    // Redraw all players' panels from current state
    function render(ctx) {
        players.forEach(function (player, index) {
            const isFocused = index === ctx.focusedIndex;
            player.turnsEl.textContent = 'Tours : ' + player.turns;
            player.targetEl.textContent = TARGETS[player.targetIndex] === 'B' ? 'BULLE' : TARGETS[player.targetIndex];
            player.expandBtn.textContent = player.expanded ? 'Réduire' : 'Voir tout';

            player.pointsEl.hidden = !showPoints;

            // Progress point for a number
            if (showPoints) {
                for (let d = 0; d < POINTS_TO_VALIDATE; d++) {
                    player.pointDots[d].classList.toggle('filled', d < player.points);
                }
            }

            // Numbers displaying
            TARGETS.forEach(function (target, i) {
                const box = player.boxes[i];
                const isPast = i < player.targetIndex;
                const isCurrent = i === player.targetIndex;

                box.classList.toggle('validated', isPast);
                box.classList.toggle('current', isCurrent);
                box.disabled = !(isCurrent && index === ctx.activeIndex && !ctx.gameOver);

                if (!isFocused) {
                    box.hidden = true;
                } else if (player.expanded) {
                    box.hidden = false;
                } else {
                    box.hidden = isPast || i >= player.targetIndex + WINDOW_SIZE;
                }
            });
        });
    }

    // Turn engine and cache saving
    const engine = createTurnEngine({
        players: players,
        // Snapshot a player's progress for undo
        captureState: function (player) {
            return {targetIndex: player.targetIndex, points: player.points};
        },
        // Restore a player's progress from a snapshot
        applyState: function (player, state) {
            player.targetIndex = state.targetIndex;
            player.points = state.points;
        },
        render: render
    });

    // Win overlay details
    function populateWinOverlay(overlay, player) {
        populateWinnerFields(overlay, player, player.turns + ' ' + toursWord(player.turns) + ' pour gagner');
    }

    // Points handling on numbers, winner resolution
    function handleBoxClick(index, playerIndex) {
        if (!engine.canAct(playerIndex)) {
            return;
        }

        const player = players[playerIndex];
        if (index !== player.targetIndex) {
            return;
        }

        engine.recordClick(player);

        if (TARGETS[index] === 'B') {
            engine.declareWinner(player, populateWinOverlay);
            return;
        }

        player.points += 1;
        if (player.points >= POINTS_TO_VALIDATE) {
            player.points = 0;
            player.targetIndex += 1;
        }

        engine.render();
    }

    players.forEach(function (player, index) {
        player.expandBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            player.expanded = !player.expanded;
            engine.render();
        });

        TARGETS.forEach(function (target, i) {
            player.boxes[i].addEventListener('click', function (e) {
                e.stopPropagation();
                handleBoxClick(i, index);
            });
        });
    });
});
