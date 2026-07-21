// Build: 7E4D1F7C
// Players-setup checkbox grid: tracks click order (numbered chip badges +
// a hidden `orderedPlayerIds` field for the controller), enforces an optional
// max-players cap, and enforces an optional min-players requirement on the
// Start button. The three concerns are decoupled on purpose — each data
// attribute may be absent on its own (order tracking always works; the cap
// and the minimum don't depend on each other), and none of them touch
// `selectedOrder` except the order-tracking code itself.
document.addEventListener('DOMContentLoaded', function () {
    var picker = document.querySelector('.player-picker');
    if (!picker) {
        return;
    }

    var checkboxes = Array.prototype.slice.call(picker.querySelectorAll('input[type="checkbox"]'));
    var counter = document.getElementById('player-count');
    var orderedInput = document.getElementById('ordered-player-ids');
    var startBtn = picker.closest('form').querySelector('button[type="submit"]');

    var max = parseInt(picker.dataset.maxPlayers, 10);
    var hasMax = !!max && max > 0;

    var min = parseInt(picker.dataset.minPlayers, 10);
    var hasMin = !!min && min > 0;

    var selectedOrder = [];

    function checkedCount() {
        return checkboxes.filter(function (checkbox) {
            return checkbox.checked;
        }).length;
    }

    function updateOrder() {
        selectedOrder = selectedOrder.filter(function (checkbox) {
            return checkbox.checked;
        });

        checkboxes.forEach(function (checkbox) {
            if (checkbox.checked && selectedOrder.indexOf(checkbox) === -1) {
                selectedOrder.push(checkbox);
            }
        });

        checkboxes.forEach(function (checkbox) {
            var badge = checkbox.parentElement.querySelector('[data-role="chip-order"]');
            if (!badge) {
                return;
            }
            var position = selectedOrder.indexOf(checkbox);
            badge.textContent = position === -1 ? '' : String(position + 1);
        });

        if (orderedInput) {
            orderedInput.value = selectedOrder.map(function (checkbox) {
                return checkbox.value;
            }).join(',');
        }
    }

    function refreshCap() {
        if (!hasMax) {
            return;
        }
        var count = checkedCount();
        var atLimit = count >= max;

        checkboxes.forEach(function (checkbox) {
            checkbox.disabled = atLimit && !checkbox.checked;
        });

        if (counter) {
            counter.textContent = count + ' / ' + max + ' selected';
        }
    }

    function refreshMin() {
        if (!hasMin || !startBtn) {
            return;
        }
        startBtn.disabled = checkedCount() < min;
    }

    checkboxes.forEach(function (checkbox) {
        checkbox.addEventListener('change', function () {
            updateOrder();
            refreshCap();
            refreshMin();
        });
    });

    updateOrder();
    refreshCap();
    refreshMin();
});
