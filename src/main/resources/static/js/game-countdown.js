document.addEventListener('DOMContentLoaded', function () {
    var panels = Array.prototype.slice.call(document.querySelectorAll('.player-panel'));
    if (!panels.length) {
        return;
    }

    var keypadPanel = document.getElementById('keypad-panel');
    var gameOverOverlay = document.querySelector('[data-role="game-over"]');
    var inputDisplay = document.querySelector('[data-role="input-display"]');
    var breakdownDisplay = document.querySelector('[data-role="segment-breakdown"]');
    var keypadTotal = document.querySelector('[data-role="keypad-total"]');
    var keypadZeroRow = document.querySelector('[data-role="keypad-zero-row"]');
    var keypadSegments = document.querySelector('[data-role="keypad-segments"]');
    var keypadSegmentErase = document.querySelector('[data-role="keypad-segment-erase"]');

    var players = panels.map(function (panel) {
        return {
            panel: panel,
            id: panel.dataset.playerId,
            name: panel.dataset.playerName,
            startingScore: parseInt(panel.querySelector('[data-role="score"]').textContent, 10),
            remaining: parseInt(panel.querySelector('[data-role="score"]').textContent, 10),
            turns: 0,
            totalScored: 0,
            checkoutVariant: 0
        };
    });

    var activeIndex = 0;
    var buffer = '';
    var mode = 'total';
    var segmentTaps = [];
    var history = [];
    var gameOver = false;

    // Segments usable before the final dart of a checkout (triples, singles, single/double bull).
    var LEAD_SEGMENTS = [];
    for (var t = 20; t >= 1; t--) {
        LEAD_SEGMENTS.push({label: 'T' + t, value: t * 3});
    }
    for (var s = 20; s >= 1; s--) {
        LEAD_SEGMENTS.push({label: s.toString(), value: s});
    }
    LEAD_SEGMENTS.push({label: '25', value: 25});
    LEAD_SEGMENTS.push({label: 'BULL', value: 50});
    LEAD_SEGMENTS.sort(function (a, b) {
        return b.value - a.value;
    });

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

    function flashBust(player) {
        player.panel.classList.add('bust-flash');
        setTimeout(function () {
            player.panel.classList.remove('bust-flash');
        }, 600);
    }

    function showGameOver(player) {
        gameOver = true;
        backLink.hidden = true;
        keypadPanel.hidden = true;
        player.panel.classList.add('winner');
        gameOverOverlay.hidden = false;
        gameOverOverlay.querySelector('[data-role="winner-name"]').textContent = player.name;
        gameOverOverlay.querySelector('[data-role="winner-turns"]').textContent =
            player.turns + (player.turns > 1 ? ' tours pour gagner' : ' tour pour gagner');
        gameOverOverlay.querySelector('[data-role="winner-input"]').value = player.id;
        gameOverOverlay.querySelector('[data-role="turns-input"]').value = player.turns;
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
        mode = mode === 'total' ? 'segment' : 'total';
        keypadTotal.hidden = mode !== 'total';
        keypadZeroRow.hidden = mode !== 'total';
        keypadSegments.hidden = mode !== 'segment';
        keypadSegmentErase.hidden = mode !== 'segment';
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
            mode = 'total';
            keypadTotal.hidden = mode !== 'total';
            keypadZeroRow.hidden = mode !== 'total';
            keypadSegments.hidden = mode !== 'segment';
            keypadSegmentErase.hidden = mode !== 'segment';
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

    var backLink = document.querySelector('[data-role="back-link"]');
    var exitConfirmOverlay = document.querySelector('[data-role="exit-confirm"]');
    if (backLink && exitConfirmOverlay) {
        backLink.addEventListener('click', function (e) {
            if (gameOver) {
                return;
            }
            e.preventDefault();
            exitConfirmOverlay.hidden = false;
        });

        exitConfirmOverlay.querySelector('[data-action="exit-cancel"]').addEventListener('click', function () {
            exitConfirmOverlay.hidden = true;
        });

        exitConfirmOverlay.querySelector('[data-action="exit-confirm"]').addEventListener('click', function () {
            window.location.href = backLink.href;
        });
    }

    panels.forEach(function (panel, index) {
        var refreshBtn = panel.querySelector('[data-role="checkout-refresh"]');
        refreshBtn.addEventListener('click', function () {
            players[index].checkoutVariant += 1;
            render(players[index]);
        });
    });

    renderAll();
});
