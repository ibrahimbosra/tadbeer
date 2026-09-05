(function () {
    'use strict';
    const app = window.TadbeerApp;

    function getAccountBalance(appData, accountId, accountCurrency) {
        return (appData.transactions || []).filter(transaction => transaction.accountId === accountId && transaction.status === 'active').reduce((sum, transaction) => {
            const value = window.TadbeerCurrencies.toCurrentValue(transaction.amount || 0, transaction.currency || accountCurrency, accountCurrency);
            if (transaction.type === 'income' || (transaction.type === 'transfer' && (transaction.referenceType === 'transfer_to' || transaction.referenceType === 'currency_transfer_to'))) return sum + value;
            if (transaction.type === 'expense' || (transaction.type === 'transfer' && (transaction.referenceType === 'transfer_from' || transaction.referenceType === 'currency_transfer_from'))) return sum - value;
            return sum;
        }, 0);
    }

    app.renderTransfers = function() {
        const list = document.getElementById('transfersList');
        const items = (this.appData.transactions || []).filter(t => t.type === 'transfer' && t.status === 'active');
        const currencyTransfers = new Map();
        const accountTransfers = [];
        items.forEach(item => {
            if (!item.transferId || !item.referenceType?.startsWith('currency_transfer_')) {
                accountTransfers.push(item);
                return;
            }
            const group = currencyTransfers.get(item.transferId) || { from: null, to: null };
            if (item.referenceType === 'currency_transfer_from') group.from = item;
            if (item.referenceType === 'currency_transfer_to') group.to = item;
            currencyTransfers.set(item.transferId, group);
        });
        const currencyHtml = [...currencyTransfers.values()].map(group => {
            if (!group.from || !group.to) return '';
            const fromAccount = (this.appData.accounts || []).find(account => account.id === group.from.accountId);
            const toAccount = (this.appData.accounts || []).find(account => account.id === group.to.accountId);
            return `<div class="card"><div class="flex-between"><strong>تحويل عملة</strong><strong>${window.TadbeerCurrencies.format(group.from.amount, group.from.currency, 'native')} → ${window.TadbeerCurrencies.format(group.to.amount, group.to.currency, 'native')}</strong></div><div class="text-sm text-gray">${fromAccount?.name || 'حساب المصدر'} → ${toAccount?.name || 'حساب الهدف'} • سعر الصرف: ${window.TadbeerUtils.formatNumber(group.from.exchangeRate)} • ${window.TadbeerUtils.normalizeDateString(group.from.date)}${group.from.createdByName ? ` • ${group.from.createdByName}` : ''}</div>${group.from.notes ? `<div class="text-sm text-gray">${group.from.notes}</div>` : ''}</div>`;
        }).join('');
        const renderedAccountLegs = new Set();
        const accountHtml = accountTransfers.map(transaction => {
            if (window.TadbeerCalculations.isAccountTransferLeg(transaction)) {
                if (renderedAccountLegs.has(transaction)) return '';
                const pair = window.TadbeerCalculations.findAccountTransferPair(accountTransfers, transaction);
                if (pair) {
                    renderedAccountLegs.add(pair.from);
                    renderedAccountLegs.add(pair.to);
                    const fromAccount = (this.appData.accounts || []).find(account => account.id === pair.from.accountId);
                    const toAccount = (this.appData.accounts || []).find(account => account.id === pair.to.accountId);
                    return `<div class="card"><div class="flex-between"><strong>تحويل بين الحسابات</strong><strong>${window.TadbeerCurrencies.format(pair.from.amount, pair.from.currency, 'native')}</strong></div><div class="text-sm text-gray">${fromAccount?.name || 'حساب المصدر'} → ${toAccount?.name || 'حساب الهدف'} • ${window.TadbeerUtils.normalizeDateString(pair.from.date || pair.to.date)}${pair.from.createdByName ? ` • ${pair.from.createdByName}` : ''}</div></div>`;
                }
            }
            return window.TadbeerUI.renderTxnItem(transaction);
        }).join('');
        list.innerHTML = currencyHtml + accountHtml || window.TadbeerUI.emptyState('لا توجد تحويلات');
    };

    app.openTransferModal = function() {
        const accounts = this.appData.accounts || [];
        const html = `
            <div class="modal-header"><h3 class="modal-title">تحويل بين الحسابات</h3><button class="modal-close" onclick="window.TadbeerUI.closeModal()">✕</button></div>
            <div class="form-row"><div class="form-group"><label class="required">المبلغ من العملة</label><input type="number" id="trfAmount" placeholder="0" step="any" /></div><div class="form-group"><label class="required">المبلغ إلى العملة</label><input type="number" id="trfToAmount" placeholder="0" step="any" /></div></div>
            <div class="form-row">
                <div class="form-group"><label class="required">من حساب</label><select id="trfFrom" required><option value="">اختر الحساب</option>${accounts.map(a => `<option value="${a.id}">${a.name} (${a.currency || '-'})</option>`).join('')}</select></div>
                <div class="form-group"><label class="required">إلى حساب</label><select id="trfTo" required><option value="">اختر الحساب</option>${accounts.map(a => `<option value="${a.id}">${a.name} (${a.currency || '-'})</option>`).join('')}</select></div>
            </div>
            <div class="form-group"><label>التاريخ</label><input type="date" id="trfDate" value="${window.TadbeerUtils.formatDateInput(new Date())}" /></div>
            <div class="form-group"><label>ملاحظات</label><input type="text" id="trfNotes" /></div>
            <button class="btn btn-primary btn-block" onclick="window.TadbeerApp.saveTransfer()">تنفيذ التحويل</button>
        `;
        window.TadbeerUI.openModalHtml(html);
    };

    app.saveTransfer = async function() {
        const amount = Number(document.getElementById('trfAmount').value || 0);
        const fromId = document.getElementById('trfFrom').value;
        const toId = document.getElementById('trfTo').value;
        const fromAccount = (this.appData.accounts || []).find(account => account.id === fromId);
        const toAccount = (this.appData.accounts || []).find(account => account.id === toId);
        const fromCurrency = fromAccount?.currency || window.TadbeerCurrencies.state.first.code;
        const toCurrency = toAccount?.currency || window.TadbeerCurrencies.state.first.code;
        const toAmount = Number(document.getElementById('trfToAmount').value || 0);
        if (!amount || amount <= 0 || !toAmount || toAmount <= 0) return window.TadbeerUI.showToast('أدخل المبلغين بشكل صحيح', 'error');
        if (!fromId || !toId || fromId === toId) return window.TadbeerUI.showToast('اختر حسابين مختلفين', 'error');
        const date = new Date(document.getElementById('trfDate').value || Date.now());
        const now = new Date();
        const fromMoney = window.TadbeerCurrencies.operationFields(amount, fromCurrency);
        const toMoney = window.TadbeerCurrencies.operationFields(toAmount, toCurrency);
        const transactionCollection = window.db.collection('transactions');
        const batch = window.db.batch();
        batch.set(transactionCollection.doc(), { userId: this.currentUserId, ...this.getCurrentUserFields(), type: 'transfer', ...fromMoney, date, categoryId: null, accountId: fromId, description: 'تحويل من حساب', referenceType: 'transfer_from', referenceId: toId, status: 'active', createdAt: now, updatedAt: now, notes: document.getElementById('trfNotes').value || '' });
        batch.set(transactionCollection.doc(), { userId: this.currentUserId, ...this.getCurrentUserFields(), type: 'transfer', ...toMoney, date, categoryId: null, accountId: toId, description: 'تحويل إلى حساب', referenceType: 'transfer_to', referenceId: fromId, status: 'active', createdAt: now, updatedAt: now, notes: document.getElementById('trfNotes').value || '' });
        await batch.commit();
        window.TadbeerUI.closeModal();
        await this.refreshData();
        window.TadbeerUI.showToast('تم تنفيذ التحويل', 'success');
    };

    app.openCurrencyTransferModal = function() {
        const accounts = this.appData.accounts || [];
        const accountOptions = accounts.map(account => `<option value="${account.id}">${account.name} (${account.currency || '-'})</option>`).join('');
        const html = `
            <div class="modal-header"><h3 class="modal-title">تحويل بين العملات</h3><button class="modal-close" onclick="window.TadbeerUI.closeModal()">✕</button></div>
            <div class="form-row"><div class="form-group"><label class="required">الحساب المصدر</label><select id="curTrfFrom" onchange="window.TadbeerApp.updateCurrencyTransferForm()"><option value="">اختر الحساب</option>${accountOptions}</select></div><div class="form-group"><label>عملة المصدر</label><input id="curTrfSourceCurrency" readonly /></div></div>
            <div class="form-row"><div class="form-group"><label class="required">المبلغ المصدر</label><input type="number" id="curTrfAmount" min="0" step="any" oninput="window.TadbeerApp.updateCurrencyTransferForm()" /></div><div class="form-group"><label class="required">سعر الصرف</label><input type="number" id="curTrfRate" min="0" step="any" value="${window.TadbeerCurrencies.state.rate || ''}" oninput="window.TadbeerApp.updateCurrencyTransferForm()" /></div></div>
            <div class="form-row"><div class="form-group"><label class="required">الحساب الهدف</label><select id="curTrfTo" onchange="window.TadbeerApp.updateCurrencyTransferForm()"><option value="">اختر الحساب</option>${accountOptions}</select></div><div class="form-group"><label>عملة الهدف</label><input id="curTrfTargetCurrency" readonly /></div></div>
            <div class="form-group"><label>المبلغ الناتج</label><input id="curTrfTargetAmount" readonly /></div>
            <div class="form-group"><label>التاريخ</label><input type="date" id="curTrfDate" value="${window.TadbeerUtils.formatDateInput(new Date())}" /></div>
            <div class="form-group"><label>الملاحظات</label><input type="text" id="curTrfNotes" /></div>
            <button class="btn btn-primary btn-block" onclick="window.TadbeerApp.saveCurrencyTransfer()">تنفيذ تحويل العملة</button>
        `;
        window.TadbeerUI.openModalHtml(html);
        this.updateCurrencyTransferForm();
    };

    app.updateCurrencyTransferForm = function() {
        const from = (this.appData.accounts || []).find(account => account.id === document.getElementById('curTrfFrom')?.value);
        const to = (this.appData.accounts || []).find(account => account.id === document.getElementById('curTrfTo')?.value);
        const sourceCurrency = from?.currency || '';
        const targetCurrency = to?.currency || '';
        const rate = Number(document.getElementById('curTrfRate')?.value || 0);
        const amount = Number(document.getElementById('curTrfAmount')?.value || 0);
        document.getElementById('curTrfSourceCurrency').value = sourceCurrency;
        document.getElementById('curTrfTargetCurrency').value = targetCurrency;
        document.getElementById('curTrfTargetAmount').value = sourceCurrency && targetCurrency && rate > 0 && amount > 0
            ? window.TadbeerCurrencies.convertAmount(amount, sourceCurrency, targetCurrency, rate)
            : '';
    };

    app.saveCurrencyTransfer = async function() {
        const fromId = document.getElementById('curTrfFrom').value;
        const toId = document.getElementById('curTrfTo').value;
        const fromAccount = (this.appData.accounts || []).find(account => account.id === fromId);
        const toAccount = (this.appData.accounts || []).find(account => account.id === toId);
        const sourceCurrency = fromAccount?.currency || '';
        const targetCurrency = toAccount?.currency || '';
        const sourceAmount = Number(document.getElementById('curTrfAmount').value || 0);
        const exchangeRate = Number(document.getElementById('curTrfRate').value || 0);
        const targetAmount = sourceCurrency && targetCurrency ? window.TadbeerCurrencies.convertAmount(sourceAmount, sourceCurrency, targetCurrency, exchangeRate) : 0;
        if (!fromAccount || !toAccount || fromId === toId) return window.TadbeerUI.showToast('اختر حسابين مختلفين', 'error');
        if (!sourceCurrency || !targetCurrency || sourceCurrency === targetCurrency) return window.TadbeerUI.showToast('يجب أن تكون عملتا الحسابين مختلفتين', 'error');
        if (!sourceAmount || sourceAmount <= 0 || !exchangeRate || exchangeRate <= 0 || !targetAmount || targetAmount <= 0) return window.TadbeerUI.showToast('أدخل مبلغًا وسعر صرف صالحين', 'error');
        const balance = getAccountBalance(this.appData, fromId, sourceCurrency);
        if (balance < sourceAmount) return window.TadbeerUI.showToast(`الرصيد غير كافٍ. المتاح: ${window.TadbeerCurrencies.format(balance, sourceCurrency)}`, 'error');
        const transferId = window.db.collection('transactions').doc().id;
        const now = new Date();
        const common = { userId: this.currentUserId, ...this.getCurrentUserFields(), type: 'transfer', transferId, sourceCurrency, sourceAmount, targetCurrency, targetAmount, exchangeRate, date: new Date(document.getElementById('curTrfDate').value || Date.now()), status: 'active', notes: document.getElementById('curTrfNotes').value || '', createdAt: now, updatedAt: now };
        const sourceMoney = window.TadbeerCurrencies.operationFields(sourceAmount, sourceCurrency, exchangeRate);
        const targetMoney = window.TadbeerCurrencies.operationFields(targetAmount, targetCurrency, exchangeRate);
        const batch = window.db.batch();
        batch.set(window.db.collection('transactions').doc(), { ...common, ...sourceMoney, accountId: fromId, referenceType: 'currency_transfer_from', description: 'تحويل عملة من الحساب' });
        batch.set(window.db.collection('transactions').doc(), { ...common, ...targetMoney, accountId: toId, referenceType: 'currency_transfer_to', description: 'تحويل عملة إلى الحساب' });
        await batch.commit();
        window.TadbeerUI.closeModal();
        await this.refreshData();
        window.TadbeerUI.showToast('تم تنفيذ تحويل العملة', 'success');
    };
})();
