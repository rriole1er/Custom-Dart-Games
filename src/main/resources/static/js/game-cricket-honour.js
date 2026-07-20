// Cricket Honour: no scoring goal — first to close all 7 numbers wins outright.
// Score still accumulates (any hit on an already-closed number), but only as
// a penalty recorded for the leaderboard: 0 is a perfect game.
startCricketBoard({
    checkWinner: function (players, activeIndex, ctx) {
        var player = players[activeIndex];
        return ctx.allClosed(player) ? player : null;
    },
    populateWinOverlay: function (overlay, player) {
        overlay.querySelector('[data-role="winner-detail"]').textContent = 'Score final : ' + player.score;
        overlay.querySelector('[data-role="winner-input"]').value = player.id;
        overlay.querySelector('[data-role="turns-input"]').value = player.score;
    }
});
