// Standard Cricket: closing all 7 numbers isn't enough on its own — you also
// need the highest (or equal-highest) score, so a player who closes early but
// is behind on points must keep scoring off open numbers until they catch up.
startCricketBoard({
    checkWinner: function (players, activeIndex, ctx) {
        var maxScore = players.reduce(function (max, p) {
            return Math.max(max, p.score);
        }, 0);

        for (var i = 0; i < players.length; i++) {
            if (ctx.allClosed(players[i]) && players[i].score >= maxScore) {
                return players[i];
            }
        }
        return null;
    },
    populateWinOverlay: function (overlay, player) {
        overlay.querySelector('[data-role="winner-detail"]').textContent =
            player.turns + (player.turns > 1 ? ' tours pour gagner' : ' tour pour gagner');
        overlay.querySelector('[data-role="winner-input"]').value = player.id;
        overlay.querySelector('[data-role="turns-input"]').value = player.turns;
    }
});
