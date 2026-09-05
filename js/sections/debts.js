(function () {
    'use strict';
    const app = window.TadbeerApp;

    function escapeHtml(value) { return String(value || '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])); }
    function remaining(debt) { return Math.max(0, Number(debt.totalAmount || 0) - Number(debt.paidAmount || 0)); }
    function directionLabel(type) { return type === 'payable' ? 'دين علينا' : 'دين لنا'; }
    function paymentsFor(data, id) { return (data.debtPayments || {})[id] || []; }
    function accountOptions(accounts, selectedId = '') {
        if (!accounts.length) return '<option value="">لا توجد حسابات متاحة</option>';
        return accounts.map(account => `<option value="${account.id}" ${selectedId === account.id ? 'selected' : ''}>${escapeHtml(account.name)} (${escapeHtml(account.currency || '')})</option>`).join('');
    }

    app.renderDebts = function () {
        const list = document.getElementById('debtsList');
        const items = this.appData.debts || [];
        list.innerHTML = items.length ? items.map(debt => {
            const currency = debt.currency || window.TadbeerCurrencies.state.first.code;
            const balance = remaining(debt);
            const actions = debt.status === 'active' ? `<div class="btn-group mt-4"><button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); window.TadbeerApp.openDebtPaymentModal('${debt.id}', false)">تسجيل دفعة</button><button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); window.TadbeerApp.openDebtPaymentModal('${debt.id}', true)">سداد كامل</button>${!Number(debt.paidAmount || 0) ? `<button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); window.TadbeerApp.cancelDebt('${debt.id}')">إلغاء الدين</button>` : ''}</div>` : '';
            return `<div class="card" onclick="window.TadbeerApp.viewDebt('${debt.id}')"><div class="flex-between"><div><strong>${escapeHtml(debt.party || debt.description || 'دين')}</strong><div class="text-sm text-gray">${directionLabel(debt.type)}${debt.createdByName ? ` • ${escapeHtml(debt.createdByName)}` : ''}</div></div><strong>${window.TadbeerCurrencies.format(balance, currency)}</strong></div><div class="text-sm text-gray">الأصلي: ${window.TadbeerCurrencies.format(debt.totalAmount, currency)} • المدفوع: ${window.TadbeerCurrencies.format(debt.paidAmount || 0, currency)} • المتبقي: ${window.TadbeerCurrencies.format(balance, currency)} • ${debt.status === 'paid' ? 'مسدد' : debt.status === 'cancelled' ? 'ملغى' : 'قائم'}</div>${actions}</div>`;
        }).join('') : window.TadbeerUI.emptyState('لا توجد ديون');
    };

    app.openDebtModal = function () {
        const accountField = `<div class="form-group" id="debtAccountField"><label class="required">الحساب الذي خرج منه المبلغ</label><select id="debtAccount" required><option value="">اختر الحساب</option>${accountOptions(this.appData.accounts || [])}</select></div>`;
        window.TadbeerUI.openModalHtml(`<div class="modal-header"><h3 class="modal-title">إضافة دين</h3><button class="modal-close" onclick="window.TadbeerUI.closeModal()">✕</button></div><div class="form-group"><label class="required">الشخص أو الجهة</label><input id="debtParty" placeholder="اسم الشخص أو الجهة"></div><div class="form-group"><label class="required">المبلغ</label><input type="number" id="debtAmount" min="0" step="any"></div><div class="form-group"><label>اتجاه الدين</label><select id="debtType" onchange="window.TadbeerApp.toggleDebtAccountField()"><option value="receivable">دين لنا</option><option value="payable">دين علينا</option></select></div><div class="form-group"><label>التاريخ</label><input type="date" id="debtDate" value="${window.TadbeerUtils.formatDateInput(new Date())}"></div>${accountField}<div class="form-group"><label>ملاحظات</label><textarea id="debtNotes"></textarea></div><button class="btn btn-primary btn-block" onclick="window.TadbeerApp.saveDebt()">حفظ الدين</button>`);
        this.toggleDebtAccountField();
    };

    app.toggleDebtAccountField = function () {
        const type = document.getElementById('debtType')?.value || 'receivable';
        const accountField = document.getElementById('debtAccountField');
        if (!accountField) return;
        const shouldShow = type === 'receivable';
        accountField.style.display = shouldShow ? 'block' : 'none';
        const accountSelect = document.getElementById('debtAccount');
        if (accountSelect && !shouldShow) accountSelect.value = '';
    };

    app.saveDebt = async function () {
        const party = document.getElementById('debtParty').value.trim();
        const amount = Number(document.getElementById('debtAmount').value || 0);
        const type = document.getElementById('debtType').value;
        const accountId = type === 'receivable' ? document.getElementById('debtAccount')?.value : null;
        const account = (this.appData.accounts || []).find(item => item.id === accountId);
        if (!party || !amount || amount <= 0) return window.TadbeerUI.showToast('أدخل الجهة والمبلغ بشكل صحيح', 'error');
        if (type === 'receivable' && (!accountId || !account)) return window.TadbeerUI.showToast('اختر الحساب الذي خرج منه المبلغ', 'error');
        const currency = account?.currency || window.TadbeerCurrencies.state.first.code;
        const now = new Date();
        const debtData = { userId: this.currentUserId, ...this.getCurrentUserFields(), party, description: party, type, totalAmount: amount, paidAmount: 0, remainingAmount: amount, currency, accountId: type === 'receivable' ? accountId : null, ...window.TadbeerCurrencies.operationFields(amount, currency), date: new Date(document.getElementById('debtDate').value || Date.now()), notes: document.getElementById('debtNotes').value || '', status: 'active', createdAt: now, updatedAt: now };
        try {
            const debtRef = window.db.collection('debts').doc();
            const batch = window.db.batch();
            batch.set(debtRef, debtData);
            if (type === 'receivable' && accountId) {
                const transactionRef = window.db.collection('transactions').doc();
                batch.set(transactionRef, {
                    userId: this.currentUserId,
                    debtId: debtRef.id,
                    type: 'expense',
                    amount: amount,
                    currency,
                    accountId,
                    referenceType: 'debt_created',
                    referenceId: debtRef.id,
                    description: `إنشاء دين لنا - ${party}`,
                    date: debtData.date,
                    status: 'active',
                    ...window.TadbeerCurrencies.operationFields(amount, currency),
                    ...this.getCurrentUserFields(),
                    createdAt: now,
                    updatedAt: now
                });
            }
            await batch.commit();
            window.TadbeerUI.closeModal(); await this.refreshData(); window.TadbeerUI.showToast('تم تسجيل الدين', 'success');
        } catch (error) { console.error(error); window.TadbeerUI.showToast('تعذر حفظ الدين', 'error'); }
    };

    app.openDebtPaymentModal = function (debtId, fullPayment) {
        const debt = (this.appData.debts || []).find(item => item.id === debtId);
        if (!debt || debt.status !== 'active' || !remaining(debt)) return;
        const max = remaining(debt);
        const accounts = this.appData.accounts || [];
        const accountLabel = debt.type === 'payable' ? 'من أي حساب سيتم دفع المبلغ؟' : 'إلى أي حساب سيتم وضع المبلغ؟';
        window.TadbeerUI.openModalHtml(`<div class="modal-header"><h3 class="modal-title">${fullPayment ? 'سداد كامل' : 'تسجيل دفعة'}</h3><button class="modal-close" onclick="window.TadbeerUI.closeModal()">✕</button></div><div class="form-group"><label class="required">مبلغ الدفعة</label><input type="number" id="debtPaymentAmount" value="${fullPayment ? max : ''}" max="${max}" min="0.01" step="any" ${fullPayment ? 'readonly' : ''}></div><div class="form-group"><label class="required">${accountLabel}</label><select id="debtPaymentAccount" required><option value="">اختر الحساب</option>${accountOptions(accounts)}</select></div><div class="form-group"><label>التاريخ</label><input type="date" id="debtPaymentDate" value="${window.TadbeerUtils.formatDateInput(new Date())}"></div><div class="form-group"><label>ملاحظات</label><textarea id="debtPaymentNotes"></textarea></div><button class="btn btn-primary btn-block" onclick="window.TadbeerApp.saveDebtPayment('${debtId}')">حفظ الدفعة</button>`);
    };

    app.saveDebtPayment = async function (debtId) {
        const debt = (this.appData.debts || []).find(item => item.id === debtId);
        const amount = Number(document.getElementById('debtPaymentAmount')?.value || 0);
        const accountId = document.getElementById('debtPaymentAccount')?.value;
        const account = (this.appData.accounts || []).find(item => item.id === accountId);
        if (!debt || debt.status !== 'active' || !account || !amount || amount <= 0 || amount > remaining(debt)) return window.TadbeerUI.showToast('بيانات الدفعة غير صحيحة أو تتجاوز المتبقي', 'error');
        const nextPaid = Number(debt.paidAmount || 0) + amount;
        const now = new Date();
        const direction = debt.type === 'payable' ? 'out' : 'in';
        const creator = this.getCurrentUserFields();
        const paymentRef = window.db.collection('debts').doc(debtId).collection('payments').doc();
        const transactionRef = window.db.collection('transactions').doc();
        const paymentDate = new Date(document.getElementById('debtPaymentDate').value || Date.now());
        const fields = window.TadbeerCurrencies.operationFields(amount, debt.currency);
        const debtUpdate = {
            paidAmount: nextPaid,
            remainingAmount: Math.max(0, Number(debt.totalAmount || 0) - nextPaid),
            status: nextPaid >= Number(debt.totalAmount || 0) ? 'paid' : 'active',
            updatedAt: now
        };
        const payment = { debtId, amount, currency: debt.currency, accountId, accountName: account.name, date: paymentDate, direction, referenceType: 'debt_payment', notes: document.getElementById('debtPaymentNotes').value || '', ...fields, ...creator, createdAt: now, updatedAt: now };
        const transaction = {
            userId: this.currentUserId,
            debtId,
            type: direction === 'in' ? 'income' : 'expense',
            referenceType: 'debt_payment',
            referenceId: debtId,
            accountId,
            description: `دفعة ${debt.party || debt.description || 'دين'}`,
            date: paymentDate,
            status: 'active',
            amount: amount,
            currency: debt.currency,
            exchangeRate: fields.exchangeRate,
            baseAmount: fields.baseAmount,
            ...creator,
            createdAt: now,
            updatedAt: now
        };
        try {
            const batch = window.db.batch();
            batch.update(window.db.collection('debts').doc(debtId), debtUpdate);
            batch.set(paymentRef, payment);
            batch.set(transactionRef, transaction);
            await batch.commit();
            window.TadbeerUI.closeModal(); await this.refreshData(); window.TadbeerUI.showToast(nextPaid >= Number(debt.totalAmount || 0) ? 'تم سداد الدين بالكامل' : 'تم تسجيل الدفعة', 'success');
        } catch (error) { console.error(error); window.TadbeerUI.showToast('تعذر تسجيل الدفعة، لم يتم حفظ أي جزء منها', 'error'); }
    };

    app.cancelDebt = async function (debtId) {
        const debt = (this.appData.debts || []).find(item => item.id === debtId);
        if (!debt || debt.status !== 'active' || Number(debt.paidAmount || 0) > 0) return window.TadbeerUI.showToast('لا يمكن إلغاء دين عليه دفعات', 'error');
        if (!confirm('هل أنت متأكد من إلغاء هذا الدين؟')) return;
        const now = new Date();
        try {
            const batch = window.db.batch();
            batch.update(window.db.collection('debts').doc(debtId), { status: 'cancelled', remainingAmount: 0, updatedAt: now });
            if (debt.type === 'receivable' && debt.accountId) {
                const reversalRef = window.db.collection('transactions').doc();
                batch.set(reversalRef, {
                    userId: this.currentUserId,
                    debtId,
                    type: 'income',
                    amount: Number(debt.totalAmount || 0),
                    currency: debt.currency,
                    accountId: debt.accountId,
                    referenceType: 'debt_cancelled',
                    referenceId: debtId,
                    description: `إلغاء دين لنا - ${debt.party || debt.description || 'دين'}`,
                    date: now,
                    status: 'active',
                    exchangeRate: debt.exchangeRate,
                    baseAmount: debt.baseAmount,
                    ...this.getCurrentUserFields(),
                    createdAt: now,
                    updatedAt: now
                });
            }
            await batch.commit();
            window.TadbeerUI.closeModal(); await this.refreshData(); window.TadbeerUI.showToast('تم إلغاء الدين', 'success');
        } catch (error) { console.error(error); window.TadbeerUI.showToast('تعذر إلغاء الدين', 'error'); }
    };

    app.viewDebt = async function (debtId) {
        const debt = (this.appData.debts || []).find(item => item.id === debtId);
        if (!debt) return;
        let payments = paymentsFor(this.appData, debtId);
        if (!payments.length) { try { const snapshot = await window.db.collection('debts').doc(debtId).collection('payments').orderBy('createdAt', 'desc').get(); payments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); } catch (error) { console.warn(error); } }
        const paymentHtml = payments.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt)).map(payment => `<div class="card"><strong>${window.TadbeerCurrencies.format(payment.amount, payment.currency || debt.currency)}</strong> • ${window.TadbeerUtils.normalizeDateString(payment.date)} • ${escapeHtml(payment.accountName || '')}${payment.createdByName ? ` • ${escapeHtml(payment.createdByName)}` : ''}</div>`).join('') || '<p class="text-gray">لا توجد دفعات</p>';
        const actions = debt.status === 'active' ? `<div class="btn-group mt-4"><button class="btn btn-primary" onclick="window.TadbeerApp.openDebtPaymentModal('${debt.id}', false)">تسجيل دفعة</button><button class="btn btn-outline" onclick="window.TadbeerApp.openDebtPaymentModal('${debt.id}', true)">سداد كامل</button>${!Number(debt.paidAmount || 0) ? `<button class="btn btn-danger" onclick="window.TadbeerApp.cancelDebt('${debt.id}')">إلغاء الدين</button>` : ''}</div>` : '';
        const accountText = debt.accountId ? `<div>الحساب: <strong>${escapeHtml((this.appData.accounts || []).find(account => account.id === debt.accountId)?.name || 'غير محدد')}</strong></div>` : '<div>الحساب: <strong>غير محدد</strong></div>';
        window.TadbeerUI.openModalHtml(`<div class="modal-header"><h3 class="modal-title">تفاصيل الدين</h3><button class="modal-close" onclick="window.TadbeerUI.closeModal()">✕</button></div><div class="card"><div>الجهة: <strong>${escapeHtml(debt.party || debt.description)}</strong></div><div>الاتجاه: <strong>${directionLabel(debt.type)}</strong></div>${accountText}<div>الأصلي: <strong>${window.TadbeerCurrencies.format(debt.totalAmount, debt.currency)}</strong></div><div>المدفوع: <strong>${window.TadbeerCurrencies.format(debt.paidAmount || 0, debt.currency)}</strong></div><div>المتبقي: <strong>${window.TadbeerCurrencies.format(remaining(debt), debt.currency)}</strong></div><div>الحالة: <strong>${debt.status === 'paid' ? 'مسدد' : debt.status === 'cancelled' ? 'ملغى' : 'قائم'}</strong></div><div>أنشأه: <strong>${escapeHtml(debt.createdByName || '')}</strong></div>${actions}</div><h4 class="section-title mt-4">سجل الدفعات</h4>${paymentHtml}`);
    };
})();
