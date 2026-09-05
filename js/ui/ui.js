(function () {
    'use strict';

    function emptyState(message = 'لا توجد بيانات') {
        return `<div class="empty-state"><div class="empty-icon">📭</div><p>${message}</p></div>`;
    }

    function showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s';
            setTimeout(() => toast.remove(), 300);
        }, 2500);
    }

    function updateBottomNav(currentPage) {
        document.querySelectorAll('.bottom-nav .nav-item[data-page]').forEach(item => {
            item.classList.toggle('active', item.dataset.page === currentPage);
        });
    }

    function showPage(pageId) {
        document.querySelectorAll('.page-section').forEach(sec => sec.classList.remove('active'));
        const target = document.getElementById('page-' + pageId);
        if (target) target.classList.add('active');
        if (window.TadbeerApp) window.TadbeerApp.currentPage = pageId;
        updateBottomNav(pageId);
        if (window.TadbeerApp && typeof window.TadbeerApp.renderAll === 'function') {
            window.TadbeerApp.renderAll();
        }
    }

    function openModalHtml(html, overlayClass = '') {
        const container = document.getElementById('modalContainer');
        if (!container) return;
        container.innerHTML = `<div class="modal-overlay ${overlayClass}" onclick="if(event.target===this)closeModal()"><div class="modal">${html}</div></div>`;
        document.body.style.overflow = 'hidden';
    }

    function closeModal(immediate = false) {
        const container = document.getElementById('modalContainer');
        const radialMenu = container?.querySelector('.radial-menu');
        if (radialMenu && !immediate && !radialMenu.classList.contains('is-closing')) {
            radialMenu.classList.add('is-closing');
            setTimeout(() => closeModal(true), 180);
            return;
        }
        if (container) container.innerHTML = '';
        document.body.style.overflow = '';
        const addButton = document.querySelector('.nav-item.add-btn');
        if (addButton) {
            addButton.classList.remove('is-open');
            addButton.setAttribute('aria-expanded', 'false');
        }
    }

    function renderTxnItem(transaction) {
        const date = window.TadbeerUtils.toDateValue(transaction.date);
        const dateText = date ? date.toLocaleDateString('en-GB') : '-';
        const iconMap = { income: '💰', expense: '💸', transfer: '🔄', debt: '📋' };
        const icon = iconMap[transaction.type] || '📄';
        const iconClass = transaction.type === 'income' ? 'income' : transaction.type === 'expense' ? 'expense' : transaction.type === 'transfer' ? 'transfer' : 'debt';
        const amountClass = transaction.type === 'income' ? 'positive' : transaction.type === 'expense' ? 'negative' : 'neutral';
        const sign = transaction.type === 'income' ? '+' : transaction.type === 'expense' ? '-' : '';
        const statusText = transaction.status === 'cancelled' ? ' (ملغاة)' : '';
        const purchase = transaction.referenceType === 'purchase' && window.TadbeerApp ? (window.TadbeerApp.appData.purchases || []).find(p => p.id === transaction.referenceId) : null;
        const modifiedMark = purchase && purchase.editCount ? ' ✎' : '';
        const creatorName = transaction.createdByName || '';
        const displayMode = window.TadbeerCurrencies ? window.TadbeerCurrencies.mode('transactions') : 'native';
        const amountText = window.TadbeerCurrencies ? window.TadbeerCurrencies.format(transaction.amount || 0, transaction.currency || window.TadbeerCurrencies.state.first.code, displayMode) : window.TadbeerUtils.formatMoney(transaction.amount || 0, transaction.currency || '');
        return `
            <div class="txn-item" onclick="window.TadbeerApp.viewTransaction('${transaction.id}')">
                <div class="txn-icon ${transaction.status === 'cancelled' ? 'cancelled' : iconClass}">${icon}</div>
                <div class="txn-info">
                    <div class="txn-desc">${transaction.description || 'عملية'}${modifiedMark}${statusText}</div>
                    <div class="txn-meta"><span>${dateText}</span><span>${transaction.currency || ''}</span>${creatorName ? `<span>${creatorName}</span>` : ''}</div>
                </div>
                <div class="txn-amount ${transaction.status === 'cancelled' ? 'neutral' : amountClass}">${sign}${amountText}</div>
            </div>
        `;
    }

    window.TadbeerUI = {
        emptyState,
        showToast,
        updateBottomNav,
        showPage,
        openModalHtml,
        closeModal,
        renderTxnItem
    };
})();
