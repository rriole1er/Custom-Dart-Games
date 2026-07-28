// Players-setup checkbox grid: tracks click order (numbered chip badges +
// a hidden `orderedPlayerIds` field for the controller), enforces an optional
// max-players cap, and enforces an optional min-players requirement on the
// Start button. The three concerns are decoupled on purpose — each data
// attribute may be absent on its own (order tracking always works; the cap
// and the minimum don't depend on each other), and none of them touch
// `selectedOrder` except the order-tracking code itself.
document.addEventListener('DOMContentLoaded', function () {
    const picker = document.querySelector('.player-picker');
    if (!picker) {
        return;
    }

    const checkboxes = Array.prototype.slice.call(picker.querySelectorAll('input[type="checkbox"]'));
    const counter = document.getElementById('player-count');
    const orderedInput = document.getElementById('ordered-player-ids');
    const startBtn = picker.closest('form').querySelector('button[type="submit"]');

    const max = parseInt(picker.dataset.maxPlayers, 10);
    const hasMax = !!max && max > 0;

    const min = parseInt(picker.dataset.minPlayers, 10);
    const hasMin = !!min && min > 0;

    // Scram variants pass how many of the first picks are the stopper side
    // (1 for 2v1's lone stopper, 2 for 2v2's stopper pair) so those chips and
    // the rest (the attacker side, whatever's left) can be colored apart,
    // otherwise it's not obvious who's paired against whom before the game
    // screen even shows roles. Absent for every other game.
    const stopperCount = parseInt(picker.dataset.stopperCount, 10);
    const hasTeams = !!stopperCount && stopperCount > 0;

    let selectedOrder = [];

    // Counts currently checked checkboxes.
    function checkedCount() {
        return checkboxes.filter(function (checkbox) {
            return checkbox.checked;
        }).length;
    }

    // Rebuilds selection order, order badges, and the hidden ordered-ids input.
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
            const badge = checkbox.parentElement.querySelector('[data-role="chip-order"]');
            if (!badge) {
                return;
            }
            const position = selectedOrder.indexOf(checkbox);
            badge.textContent = position === -1 ? '' : String(position + 1);
        });

        if (orderedInput) {
            orderedInput.value = selectedOrder.map(function (checkbox) {
                return checkbox.value;
            }).join(',');
        }
    }

    // Colors chips and labels stopper/attacker roles based on pick order.
    function refreshTeams() {
        if (!hasTeams) {
            return;
        }
        checkboxes.forEach(function (checkbox) {
            const chip = checkbox.parentElement;
            const roleBadge = chip.querySelector('[data-role="chip-role"]');
            const position = selectedOrder.indexOf(checkbox);

            chip.classList.remove('player-chip-team-a', 'player-chip-team-b');
            if (roleBadge) {
                roleBadge.textContent = '';
                roleBadge.classList.remove('chip-role-stopper', 'chip-role-attacker');
            }

            if (position === -1) {
                return;
            }
            if (position < stopperCount) {
                chip.classList.add('player-chip-team-a');
                if (roleBadge) {
                    roleBadge.textContent = 'S';
                    roleBadge.classList.add('chip-role-stopper');
                }
            } else {
                chip.classList.add('player-chip-team-b');
                if (roleBadge) {
                    roleBadge.textContent = 'A';
                    roleBadge.classList.add('chip-role-attacker');
                }
            }
        });
    }

    // Disables unchecked checkboxes and updates the counter once max is hit.
    function refreshCap() {
        if (!hasMax) {
            return;
        }
        const count = checkedCount();
        const atLimit = count >= max;

        checkboxes.forEach(function (checkbox) {
            checkbox.disabled = atLimit && !checkbox.checked;
        });

        if (counter) {
            counter.textContent = count + ' / ' + max + ' selected';
        }
    }

    // Disables the start button until the minimum player count is met.
    function refreshMin() {
        if (!hasMin || !startBtn) {
            return;
        }
        startBtn.disabled = checkedCount() < min;
    }

    checkboxes.forEach(function (checkbox) {
        checkbox.addEventListener('change', function () {
            updateOrder();
            refreshTeams();
            refreshCap();
            refreshMin();
        });
    });

    updateOrder();
    refreshTeams();
    refreshCap();
    refreshMin();
});
