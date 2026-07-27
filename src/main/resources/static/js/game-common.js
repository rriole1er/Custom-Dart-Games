// Shared by every game screen: turns the back arrow into a confirmation modal
// instead of navigating away immediately, so an in-progress game isn't lost
// to a stray tap. No-ops once the win overlay is showing, since there's
// nothing left to lose at that point.
//
// Confirming the exit also clears any game-turn-engine.js refresh-survival
// save (see that file) — the player is intentionally abandoning this game,
// so it shouldn't be sitting around to accidentally resume if the same
// lineup plays the same game again later. Wipes every "dartGameState:"
// entry rather than computing this game's exact key, since only one game
// is ever in progress on a given device at a time anyway.
function clearSavedGameState() {
    try {
        // localStorage.length/.key(i) is the documented Storage iteration
        // API — Object.keys(localStorage) happens to work in every current
        // browser too, but only because of how they implement Storage as a
        // legacy platform object, not because the spec guarantees it.
        var staleKeys = [];
        for (var i = 0; i < localStorage.length; i++) {
            var key = localStorage.key(i);
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

document.addEventListener('DOMContentLoaded', function () {
    var backLink = document.querySelector('[data-role="back-link"]');
    var exitConfirmOverlay = document.querySelector('[data-role="exit-confirm"]');
    var gameOverOverlay = document.querySelector('[data-role="game-over"]');
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
