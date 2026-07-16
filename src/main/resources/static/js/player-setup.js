document.addEventListener('DOMContentLoaded', function () {
    var picker = document.querySelector('.player-picker');
    if (!picker) {
        return;
    }

    var max = parseInt(picker.dataset.maxPlayers, 10);
    if (!max || max <= 0) {
        return;
    }

    var checkboxes = Array.prototype.slice.call(picker.querySelectorAll('input[type="checkbox"]'));
    var counter = document.getElementById('player-count');

    function checkedCount() {
        return checkboxes.filter(function (checkbox) {
            return checkbox.checked;
        }).length;
    }

    function refresh() {
        var count = checkedCount();
        var atLimit = count >= max;

        checkboxes.forEach(function (checkbox) {
            checkbox.disabled = atLimit && !checkbox.checked;
        });

        if (counter) {
            counter.textContent = count + ' / ' + max + ' selected';
        }
    }

    checkboxes.forEach(function (checkbox) {
        checkbox.addEventListener('change', refresh);
    });

    refresh();
});
