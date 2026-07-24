// Purple Stain: the very first turn of the game is spent tapping a zone on
// the dartboard, which becomes THE target for the rest of the game — shared
// by every player, not per-player, and it never changes once set. From then
// on, play happens in rounds on that same zone: the player right after the
// definer goes first, then everyone still in takes their own turn in order.
//
// A miss before anyone has hit yet this round doesn't eliminate you on the
// spot — it puts you "at risk". The moment ANYONE hits (now or several turns
// later), every player currently at risk is eliminated at once: they had
// their chance, someone after them took it, so it's gone. From that hit
// onward, the round is sudden death — the SAME hit also flips the whole
// round into "one miss and you're out" for everyone still to play, no
// waiting for a second hit. A hit itself is always safe. If the round ends
// (everyone still standing has had their turn) with players still at risk
// and nobody ever hit, they're forgiven — a pre-hit miss only costs you if a
// hit eventually cashes it in.
//
// Example 1: Remy defines, so Romain plays first. Romain misses (at risk).
// Tristan hits (Romain eliminated, Tristan safe, round now sudden death).
// Remy hits too (still safe). Round 2: only Tristan and Remy left. Tristan
// misses (at risk, nobody's hit yet this round), Remy hits — Tristan
// eliminated, only Remy left, Remy wins.
// Example 2: first player to go hits right away (round is sudden death from
// here on) — everyone who plays after them and misses is eliminated
// immediately, even without a second hit.
//
// Turn order (including skipping eliminated players) and both undo levels
// are the shared game-turn-engine.js — this file owns the target-defining
// board, the per-round elimination bookkeeping, and the zone label text.
document.addEventListener('DOMContentLoaded', function () {
    var panels = Array.prototype.slice.call(document.querySelectorAll('.purple-panel'));
    if (!panels.length) {
        return;
    }

    // The engine always starts on players[0] — i.e. whoever's first in
    // players-setup order is the definer. Reordering the on-screen stack so
    // the definer's panel shows LAST is purely visual: it doesn't touch the
    // `players` array below, so turn order (definer goes last in the
    // rotation too, naturally, once everyone else has had a turn) is
    // unaffected — only where its panel sits in the stack changes.
    panels[0].parentElement.appendChild(panels[0]);

    var boardWrap = document.querySelector('[data-role="board-wrap"]');
    var targetBanner = document.querySelector('[data-role="target-banner"]');
    var targetLabelEl = document.querySelector('[data-role="target-label"]');
    var roundWarningEl = document.querySelector('[data-role="round-warning"]');
    var zoneEls = Array.prototype.slice.call(document.querySelectorAll('[data-zone]'));
    var turnActions = document.querySelector('.keypad-actions');

    // Shared across every player — set once by whoever plays the defining
    // turn, read by everyone afterwards. Folded into captureState/applyState
    // below so "Annuler le tour" correctly reverts it too.
    var targetZone = null;

    // Round bookkeeping — also shared, also folded into every snapshot.
    // pendingMisses: players who missed BEFORE anyone has hit yet this round
    // — cleared (nobody eliminated) if the round ends with no hit at all,
    // cleared (everyone in it eliminated) the moment somebody finally does
    // hit. hitOccurredThisRound: has anyone hit yet this round — once true,
    // any further miss is eliminated on the spot, no pending, no waiting for
    // a second hit. turnsThisRoundCount / roundTargetTurns: how many of the
    // currently-alive players have gone this round vs how many need to
    // before the round ends and a fresh one starts. Only meaningful once
    // targetZone is set.
    var pendingMisses = [];
    var hitOccurredThisRound = false;
    var turnsThisRoundCount = 0;
    var roundTargetTurns = 0;

    // Set on an achieve-button click, consumed by beforeCommit on the very
    // next (synchronous) commit — never observed anywhere else, so it isn't
    // part of the undo snapshot.
    var didHitThisTurn = false;

    // Set synchronously the instant a zone is tapped, consumed by
    // beforeCommit on the delayed commitTurn() below — targetZone itself is
    // already non-null by then (set at the same synchronous moment), so it
    // can't be used to tell "this is the defining commit" apart from a real
    // attempt; this flag can.
    var isDefiningCommit = false;

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
            statusEl: panel.querySelector('[data-role="status"]'),
            achieveBtn: panel.querySelector('[data-role="achieve-btn"]'),
            alive: true,
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
        roundWarningEl.hidden = targetZone === null || ctx.gameOver
            || (!hitOccurredThisRound && pendingMisses.length === 0);

        players.forEach(function (player, index) {
            var isMyTurn = index === ctx.activeIndex && !ctx.gameOver;
            // Before the target is set, only the definer's panel is worth
            // showing — nobody else has anything to do yet. Once it's set,
            // every player is back, same as Cricket/Clock.
            player.panel.hidden = targetZone === null && index !== ctx.activeIndex;
            player.panel.classList.toggle('purple-eliminated', !player.alive);
            player.turnsEl.textContent = 'Tours : ' + player.turns;
            player.hintEl.hidden = !(isMyTurn && targetZone === null);
            player.statusEl.hidden = player.alive;
            player.achieveBtn.hidden = targetZone === null || !player.alive;
            player.achieveBtn.disabled = !(isMyTurn && targetZone !== null);
        });
    }

    var engine = createTurnEngine({
        players: players,
        focusable: false,
        captureState: function () {
            return {
                targetZone: targetZone,
                alive: players.map(function (p) {
                    return p.alive;
                }),
                pendingMisses: pendingMisses.map(function (p) {
                    return players.indexOf(p);
                }),
                hitOccurredThisRound: hitOccurredThisRound,
                turnsThisRoundCount: turnsThisRoundCount,
                roundTargetTurns: roundTargetTurns
            };
        },
        applyState: function (player, state) {
            targetZone = state.targetZone;
            players.forEach(function (p, index) {
                p.alive = state.alive[index];
            });
            pendingMisses = state.pendingMisses.map(function (index) {
                return players[index];
            });
            hitOccurredThisRound = state.hitOccurredThisRound;
            turnsThisRoundCount = state.turnsThisRoundCount;
            roundTargetTurns = state.roundTargetTurns;
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
        },
        beforeCommit: function (player) {
            if (isDefiningCommit) {
                isDefiningCommit = false;
                return; // this commit is the zone-defining click itself, not a real attempt
            }

            if (didHitThisTurn) {
                // This hit cashes in every miss still pending from earlier
                // this round — their chance came and went — and flips the
                // round into sudden death for everyone still to play.
                pendingMisses.forEach(function (p) {
                    p.alive = false;
                });
                pendingMisses = [];
                hitOccurredThisRound = true;
            } else if (hitOccurredThisRound) {
                // Sudden death already in effect this round — no waiting
                // for a second hit, this miss is fatal right now.
                player.alive = false;
            } else {
                pendingMisses.push(player);
            }
            didHitThisTurn = false;

            turnsThisRoundCount += 1;
            if (turnsThisRoundCount >= roundTargetTurns) {
                // Full lap done — anyone still pending is forgiven (nobody
                // ever hit this round). Fresh round, same zone.
                pendingMisses = [];
                hitOccurredThisRound = false;
                turnsThisRoundCount = 0;
                roundTargetTurns = players.filter(function (p) {
                    return p.alive;
                }).length;
            }
        },
        checkGameEnd: function (allPlayers) {
            return targetZone !== null && allPlayers.filter(function (p) {
                return p.alive;
            }).length === 1;
        },
        populateGameEnd: populateGameEnd
    });

    function populateGameEnd(overlay, allPlayers) {
        var winner = allPlayers.filter(function (p) {
            return p.alive;
        })[0];
        overlay.querySelector('[data-role="winner-name"]').textContent = winner.name;
        overlay.querySelector('[data-role="winner-detail"]').textContent =
            zoneLabel(targetZone) + ' touchée en ' + winner.turns + (winner.turns > 1 ? ' tours' : ' tour');
        overlay.querySelector('[data-role="winner-input"]').value = winner.id;
        overlay.querySelector('[data-role="result-input"]').value = winner.turns;
    }

    zoneEls.forEach(function (el) {
        el.addEventListener('click', function () {
            if (targetZone !== null) {
                return;
            }
            targetZone = el.dataset.zone;
            roundTargetTurns = players.length;
            isDefiningCommit = true;

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
            didHitThisTurn = true;
            engine.commitTurn();
        });
    });
});
