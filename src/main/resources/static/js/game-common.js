// Shared by every game screen: turns the back arrow into a confirmation modal
// instead of navigating away immediately, so an in-progress game isn't lost
// to a stray tap. No-ops once the win overlay is showing, since there's
// nothing left to lose at that point.
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
        window.location.href = backLink.href;
    });
});
