(function () {
    'use strict';

    const app = window.TadbeerApp;

    function isCurrencyTransferLeg(transaction) {
        return transaction.type === 'transfer' && transaction.transferId &&
            (transaction.referenceType === 'currency_transfer_from' || transaction.referenceType === 'currency_transfer_to');
    }

    function renderCurrencyTransfer(transactionList, transferId) {
        const from = transactionList.find(transaction => transaction.transferId === transferId && transaction.referenceType === 'currency_transfer_from');
        const to = transactionList.find(transaction => transaction.transferId === transferId && transaction.referenceType === 'currency_transfer_to');
        if (!from || !to || from.status !== 'active' || to.status !== 'active') return null;
        const accounts = window.TadbeerApp.appData.accounts || [];
        const fromAccount = accounts.find(account => account.id === from.accountId);
        const toAccount = accounts.find(account => account.id === to.accountId);
        const date = window.TadbeerUtils.toDateValue(from.date || to.date);
        return `<div class="txn-item" onclick="window.TadbeerApp.viewTransaction('${from.id}')"><div class="txn-icon transfer">🔄</div><div class="txn-info"><div class="txn-desc">تحويل عملة</div><div class="txn-meta"><span>${date ? date.toLocaleDateString('en-GB') : '-'}</span><span>${fromAccount?.name || 'حساب المصدر'} → ${toAccount?.name || 'حساب الهدف'}</span></div></div><div class="txn-amount neutral">${window.TadbeerCurrencies.format(from.amount, from.currency, 'native')} → ${window.TadbeerCurrencies.format(to.amount, to.currency, 'native')}</div></div>`;
    }

    function renderAccountTransfer(pair) {
        const accounts = window.TadbeerApp.appData.accounts || [];
        const fromAccount = accounts.find(account => account.id === pair.from.accountId);
        const toAccount = accounts.find(account => account.id === pair.to.accountId);
        const date = window.TadbeerUtils.toDateValue(pair.from.date || pair.to.date);
        return `<div class="txn-item" onclick="window.TadbeerApp.viewTransaction('${pair.from.id}')"><div class="txn-icon transfer">🔄</div><div class="txn-info"><div class="txn-desc">تحويل من حساب</div><div class="txn-meta"><span>${date ? date.toLocaleDateString('en-GB') : '-'}</span><span>${fromAccount?.name || 'حساب المصدر'} → ${toAccount?.name || 'حساب الهدف'}</span></div></div><div class="txn-amount neutral">${window.TadbeerCurrencies.format(pair.from.amount, pair.from.currency, 'native')}</div></div>`;
    }

    function renderTransactionEntries(list) {
        const renderedTransferIds = new Set();
        const renderedAccountLegs = new Set();
        return list.map(transaction => {
            if (window.TadbeerCalculations.isAccountTransferLeg(transaction)) {
                if (renderedAccountLegs.has(transaction)) return '';
                const pair = window.TadbeerCalculations.findAccountTransferPair(list, transaction);
                if (pair) {
                    renderedAccountLegs.add(pair.from);
                    renderedAccountLegs.add(pair.to);
                    return renderAccountTransfer(pair);
                }
            }
            if (!isCurrencyTransferLeg(transaction)) return window.TadbeerUI.renderTxnItem(transaction);
            if (renderedTransferIds.has(transaction.transferId)) return '';
            renderedTransferIds.add(transaction.transferId);
            return renderCurrencyTransfer(list, transaction.transferId) || window.TadbeerUI.renderTxnItem(transaction);
        }).filter(Boolean);
    }

    app.setTransactionFilter = function (filter) {
        this.transactionFilter = filter;
        this.transactionDisplayLimit = 25;
        document.querySelectorAll('[data-transaction-filter]').forEach(button => {
            button.classList.toggle('active', button.dataset.transactionFilter === filter);
        });
        this.renderTransactions();
    };

    app.renderTransactions = function () {
        const search = (document.getElementById('txnSearch')?.value || '').toLowerCase();
        const filter = this.transactionFilter || 'expense';
        document.querySelectorAll('[data-transaction-filter]').forEach(button => {
            button.classList.toggle('active', button.dataset.transactionFilter === filter);
        });
        let list = (this.appData.transactions || []).filter(t => {
            if (t.type === 'transfer' && (isCurrencyTransferLeg(t) || window.TadbeerCalculations.isAccountTransferLeg(t)) && t.status !== 'active') return false;
            const desc = (t.description || '').toLowerCase();
            const matchesSearch = !search || desc.includes(search);
            const matchesType = filter === 'all'
                ? true
                : filter === 'cancelled' ? t.status === 'cancelled' || t.status === 'canceled'
                    : t.type === filter && t.status === 'active';
            return matchesSearch && matchesType;
        });
        const entries = renderTransactionEntries(list);
        const limit = this.transactionDisplayLimit || 25;
        const visibleEntries = entries.slice(0, limit);
        const hasMore = entries.length > limit;
        const listContainer = document.getElementById('transactionsList');
        listContainer.innerHTML = visibleEntries.length
            ? `${visibleEntries.join('')}${hasMore ? '<button type="button" class="btn btn-outline btn-block txn-load-more" onclick="window.TadbeerApp.transactionDisplayLimit += 25; window.TadbeerApp.renderTransactions()">عرض المزيد</button>' : ''}`
            : window.TadbeerUI.emptyState('لا توجد عمليات');
    };

    app.viewTransaction = function (txnId) {
        const txn = (this.appData.transactions || []).find(t => t.id === txnId);
        if (!txn) return;
        if (txn.referenceType === 'purchase' && txn.referenceId) return this.viewPurchase(txn.referenceId);
        const dateStr = window.TadbeerUtils.normalizeDateString(txn.date);
        const creatorName = txn.createdByName || '';
        const html = `
            <div class="modal-header"><h3 class="modal-title">تفاصيل العملية</h3><button class="modal-close" onclick="window.TadbeerUI.closeModal()">✕</button></div>
            <div style="display:grid;gap:8px;font-size:0.9rem;">
                <div class="flex-between"><span>النوع:</span><strong>${txn.type === 'income' ? 'دخل' : txn.type === 'expense' ? 'مصروف' : txn.type === 'transfer' ? 'تحويل' : 'دين'}</strong></div>
                <div class="flex-between"><span>المبلغ الأصلي:</span><strong>${window.TadbeerCurrencies.format(txn.amount || 0, txn.currency || window.TadbeerCurrencies.state.first.code)}</strong></div>
                <div class="flex-between"><span>سعر الصرف وقت التسجيل:</span><strong>${window.TadbeerUtils.formatNumber(txn.exchangeRate || 1)}</strong></div>
                <div class="flex-between"><span>التاريخ:</span><strong>${dateStr}</strong></div>
                <div class="flex-between"><span>الوصف:</span><strong>${txn.description || '-'}</strong></div>
                ${creatorName ? `<div class="flex-between"><span>أنشأها:</span><strong>${creatorName}</strong></div>` : ''}
                <div class="flex-between"><span>الحالة:</span><strong class="${txn.status === 'cancelled' ? 'text-red' : 'text-green'}">${txn.status === 'cancelled' ? 'ملغاة' : 'نشطة'}</strong></div>
            </div>
            ${txn.status === 'active' ? `<button class="btn btn-danger btn-block mt-4" onclick="window.TadbeerApp.cancelTransaction('${txn.id}')">إلغاء العملية</button>` : ''}
        `;
        window.TadbeerUI.openModalHtml(html);
    };

    app.cancelTransaction = async function (txnId) {
        if (!confirm('هل أنت متأكد من إلغاء هذه العملية؟')) return;
        const txn = (this.appData.transactions || []).find(t => t.id === txnId);
        const isCurrencyTransfer = txn && txn.type === 'transfer' &&
            (txn.referenceType === 'currency_transfer_from' || txn.referenceType === 'currency_transfer_to');
        if (isCurrencyTransfer) {
            if (!txn.transferId) return window.TadbeerUI.showToast('تعذر إلغاء تحويل العملة: المعرف المشترك مفقود', 'error');
            const snapshot = await window.db.collection('transactions')
                .where('transferId', '==', txn.transferId)
                .get();
            const legs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), ref: doc.ref }));
            const fromLeg = legs.find(leg => leg.referenceType === 'currency_transfer_from');
            const toLeg = legs.find(leg => leg.referenceType === 'currency_transfer_to');
            if (!fromLeg || !toLeg) {
                return window.TadbeerUI.showToast('تعذر إلغاء تحويل العملة: ساق التحويل المقابلة مفقودة', 'error');
            }
            const batch = window.db.batch();
            const update = { status: 'cancelled', updatedAt: new Date() };
            batch.update(fromLeg.ref, update);
            batch.update(toLeg.ref, update);
            await batch.commit();
            window.TadbeerUI.closeModal();
            await this.refreshData();
            return window.TadbeerUI.showToast('تم إلغاء تحويل العملة بالكامل', 'success');
        }
        const isAccountTransfer = txn && txn.type === 'transfer' &&
            (txn.referenceType === 'transfer_from' || txn.referenceType === 'transfer_to');
        if (isAccountTransfer) {
            const oppositeType = txn.referenceType === 'transfer_from' ? 'transfer_to' : 'transfer_from';
            const candidates = (this.appData.transactions || []).filter(candidate =>
                candidate.id !== txn.id &&
                candidate.type === 'transfer' &&
                candidate.referenceType === oppositeType &&
                candidate.accountId === txn.referenceId &&
                candidate.referenceId === txn.accountId &&
                candidate.status === 'active'
            );
            const timestampKey = value => {
                if (!value) return null;
                if (typeof value.toMillis === 'function') return String(value.toMillis());
                if (typeof value.toDate === 'function') return String(value.toDate().getTime());
                if (value.seconds !== undefined) return `${value.seconds}.${value.nanoseconds || 0}`;
                const time = new Date(value).getTime();
                return Number.isNaN(time) ? null : String(time);
            };
            const matchingCreatedAt = candidates.filter(candidate =>
                timestampKey(candidate.createdAt) && timestampKey(candidate.createdAt) === timestampKey(txn.createdAt)
            );
            const counterpart = matchingCreatedAt.length === 1
                ? matchingCreatedAt[0]
                : candidates.length === 1 ? candidates[0] : null;
            if (!counterpart) {
                return window.TadbeerUI.showToast('تعذر إلغاء تحويل الحسابات: الساق المقابلة غير محددة بأمان', 'error');
            }
            const batch = window.db.batch();
            const update = { status: 'cancelled', updatedAt: new Date() };
            batch.update(window.db.collection('transactions').doc(txn.id), update);
            batch.update(window.db.collection('transactions').doc(counterpart.id), update);
            await batch.commit();
            window.TadbeerUI.closeModal();
            await this.refreshData();
            return window.TadbeerUI.showToast('تم إلغاء تحويل الحسابات بالكامل', 'success');
        }
        await window.db.collection('transactions').doc(txnId).update({ status: 'cancelled', updatedAt: new Date() });
        if (txn && txn.referenceType === 'purchase' && txn.referenceId) {
            await window.db.collection('purchases').doc(txn.referenceId).update({ status: 'cancelled', updatedAt: new Date() });
        }
        window.TadbeerUI.closeModal();
        await this.refreshData();
        window.TadbeerUI.showToast('تم إلغاء العملية', 'success');
    };
})();
