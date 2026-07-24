// Killer: reuses Purple Stain's exact dartboard (same 20 numbers, same
// double/grand/triple/petit rings and colors) — the only difference is that
// all 4 rings of a given number share one data-zone, so any dart landing
// anywhere in "20" counts as hitting camp 20 (the app doesn't care which
// ring, only which number, same simplification as everywhere else).
//
// Phase 1: every player, in turn, taps one still-unclaimed camp to claim it
// (one tap, auto-commits — same pattern as Purple Stain's zone pick).
// Already-claimed camps are dimmed and untappable, but never say who owns
// them — nobody's camp number is ever revealed to anyone else (mirrors
// Baseball's hidden-scores convention: the app is trusted to remember it,
// players are trusted to remember whose is whose from having watched camp
// selection happen).
//
// Once every camp is claimed, phase 2 starts. On your turn, until you've
// become a killer, the board is replaced by a "Numéro à viser" banner
// showing YOUR OWN camp plus a single "J'ai touché !" button — becoming a
// killer doesn't involve picking anything, there's only one number that
// matters to you yet. Clicking it ends your turn right there, same as a
// classic swap to the next player — hunting starts on your next turn.
//
// Once you're a killer (from a past turn), your turn always shows the
// board. Every camp is tappable, none of them labelled: tap the right
// one (a still-alive opponent's) and they're eliminated outright; tap the
// wrong one (your own, or an opponent already eliminated) and your turn
// ends immediately, no more darts this turn. You can also just press
// "Terminer le tour" having tapped nothing at all — nobody's forced to
// throw if they don't want to. Last player standing wins outright. Turn
// order (skipping eliminated players) and both undo levels are the shared
// game-turn-engine.js — this file owns the board, the camp state, and the
// killer/alive state machine.
document.addEventListener('DOMContentLoaded', function () {
    var panels = Array.prototype.slice.call(document.querySelectorAll('.killer-panel'));
    if (!panels.length) {
        return;
    }

    var CAMP_COUNT = 20;

    var boardWrap = document.querySelector('[data-role="board-wrap"]');
    var boardCaption = document.querySelector('[data-role="board-caption"]');
    var targetBanner = document.querySelector('[data-role="target-banner"]');
    var targetLabelEl = document.querySelector('[data-role="target-label"]');
    var turnActions = document.querySelector('.keypad-actions');

    // Every ring belonging to camp N shares data-zone="N" — group them so a
    // single render pass can toggle the whole camp's dimmed/tappable state
    // at once.
    var campZoneGroups = [];
    for (var n = 1; n <= CAMP_COUNT; n++) {
        campZoneGroups.push(Array.prototype.slice.call(
            document.querySelectorAll('.killer-zone[data-zone="' + n + '"]')));
    }

    // Shared, not per-player — which player (if any) owns each camp.
    // Permanent once assigned. Folded into captureState/applyState below so
    // both undo levels revert it correctly.
    var camps = campZoneGroups.map(function () {
        return {owner: null};
    });

    var players = panels.map(function (panel) {
        return {
            id: panel.dataset.playerId,
            name: panel.dataset.playerName,
            panel: panel,
            turnsEl: panel.querySelector('[data-role="turns"]'),
            killerTag: panel.querySelector('[data-role="killer-tag"]'),
            hintEl: panel.querySelector('[data-role="hint"]'),
            statusEl: panel.querySelector('[data-role="status"]'),
            achieveBtn: panel.querySelector('[data-role="achieve-btn"]'),
            isKiller: false,
            alive: true,
            turns: 0
        };
    });

    function allCampsAssigned() {
        return players.every(function (player, index) {
            return camps.some(function (camp) {
                return camp.owner === index;
            });
        });
    }

    function campNumberOf(playerIndex) {
        for (var i = 0; i < camps.length; i++) {
            if (camps[i].owner === playerIndex) {
                return String(i + 1);
            }
        }
        return null;
    }

    function aliveCount() {
        return players.filter(function (p) {
            return p.alive;
        }).length;
    }

    function currentPhase(activeIndex) {
        if (!allCampsAssigned()) {
            return 'assign';
        }
        return players[activeIndex].isKiller ? 'hunt' : 'aim-own';
    }

    function render(ctx) {
        var phase = currentPhase(ctx.activeIndex);

        boardWrap.hidden = ctx.gameOver || phase === 'aim-own';
        targetBanner.hidden = ctx.gameOver || phase !== 'aim-own';
        if (phase === 'aim-own') {
            targetLabelEl.textContent = campNumberOf(ctx.activeIndex);
        }
        boardCaption.textContent = phase === 'hunt'
            ? 'Vise le camp d’un adversaire — une erreur termine ton tour'
            : 'Choisis ton camp sur la cible';
        // Camp selection auto-commits per tap, so there's nothing to
        // manually pass or undo mid-turn until phase 2 starts — same
        // reasoning as Purple Stain hiding it during its own zone pick.
        turnActions.hidden = phase === 'assign';

        players.forEach(function (player, index) {
            var isMyTurn = index === ctx.activeIndex && !ctx.gameOver;

            player.turnsEl.textContent = 'Tours : ' + player.turns;
            player.panel.classList.toggle('killer-eliminated', !player.alive);
            player.statusEl.hidden = player.alive;
            player.killerTag.hidden = !player.isKiller;

            var hint = '';
            if (isMyTurn && phase === 'assign') {
                hint = 'Choisis ton camp sur la cible';
            } else if (isMyTurn && phase === 'hunt') {
                hint = 'Choisis le camp d’un adversaire — une erreur termine ton tour';
            }
            player.hintEl.textContent = hint;
            player.hintEl.hidden = !hint;

            player.achieveBtn.hidden = ctx.gameOver || !player.alive || phase !== 'aim-own';
            player.achieveBtn.disabled = !isMyTurn;
        });

        var assigned = phase !== 'assign';
        camps.forEach(function (camp, i) {
            var dimmed = !assigned && camp.owner !== null;
            campZoneGroups[i].forEach(function (el) {
                el.classList.toggle('killer-zone-disabled', ctx.gameOver || dimmed);
            });
        });
    }

    var engine = createTurnEngine({
        players: players,
        focusable: false,
        maxClicksPerTurn: 3,
        captureState: function () {
            return {
                campOwners: camps.map(function (c) {
                    return c.owner;
                }),
                isKiller: players.map(function (p) {
                    return p.isKiller;
                }),
                alive: players.map(function (p) {
                    return p.alive;
                })
            };
        },
        applyState: function (player, state) {
            camps.forEach(function (c, i) {
                c.owner = state.campOwners[i];
            });
            players.forEach(function (p, i) {
                p.isKiller = state.isKiller[i];
                p.alive = state.alive[i];
            });
        },
        render: render,
        // Skip eliminated players — they're still in the fixed `players`
        // array (undo needs them there), just never handed another turn.
        nextActiveIndex: function (activeIndex) {
            var next = activeIndex;
            do {
                next = (next + 1) % players.length;
            } while (!players[next].alive);
            return next;
        }
    });

    function populateWinOverlay(overlay, player) {
        overlay.querySelector('[data-role="winner-detail"]').textContent =
            'Dernier survivant en ' + player.turns + (player.turns > 1 ? ' tours' : ' tour');
        overlay.querySelector('[data-role="winner-input"]').value = player.id;
        overlay.querySelector('[data-role="result-input"]').value = player.turns;
    }

    campZoneGroups.forEach(function (group, campIndex) {
        group.forEach(function (el) {
            el.addEventListener('click', function (e) {
                e.stopPropagation();
                var activeIndex = engine.getActiveIndex();
                if (!engine.canAct(activeIndex)) {
                    return;
                }

                var player = players[activeIndex];

                if (!allCampsAssigned()) {
                    if (camps[campIndex].owner !== null) {
                        return;
                    }
                    camps[campIndex].owner = activeIndex;
                    engine.commitTurn();
                    engine.render();
                    return;
                }

                if (!player.isKiller) {
                    // The board isn't shown before you're a killer — the
                    // banner + button phase covers that case instead.
                    return;
                }

                engine.recordClick(player);

                var ownerIndex = camps[campIndex].owner;
                if (ownerIndex !== null && ownerIndex !== activeIndex && players[ownerIndex].alive) {
                    players[ownerIndex].alive = false;

                    if (aliveCount() === 1) {
                        engine.declareWinner(player, populateWinOverlay);
                        return;
                    }
                    engine.render();
                } else {
                    // Wrong target (nobody's camp, your own, or an already-
                    // eliminated one) — the turn ends right there, no more
                    // attempts.
                    engine.commitTurn();
                    engine.render();
                }
            });
        });
    });

    players.forEach(function (player, index) {
        player.achieveBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            if (!engine.canAct(index) || player.isKiller) {
                return;
            }
            player.isKiller = true;
            engine.commitTurn();
            engine.render();
        });
    });
});
