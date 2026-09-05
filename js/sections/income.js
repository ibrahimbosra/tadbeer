(function () {
    'use strict';

    const app = window.TadbeerApp;

    app.renderIncome = function() {
        const items = (this.appData.transactions || []).filter(t => t.type === 'income' && t.status === 'active');
        document.getElementById('incomeList').innerHTML = items.length ? items.map(t => window.TadbeerUI.renderTxnItem(t)).join('') : window.TadbeerUI.emptyState('لا يوجد دخل مسجل');
    };

    app.openIncomeModal = function() {
        const accounts = this.appData.accounts || [];
        const html = `
            <div class="modal-header"><h3 class="modal-title">إضافة دخل</h3><button class="modal-close" onclick="window.TadbeerUI.closeModal()">✕</button></div>
            <div class="form-group"><label class="required">المبلغ</label><input type="number" id="incAmount" placeholder="0" step="any" /></div>
            <div class="form-group"><label>المصدر</label><input type="text" id="incSource" placeholder="راتب، هدية..." /></div>
            <div class="form-group"><label>التاريخ</label><input type="date" id="incDate" value="${window.TadbeerUtils.formatDateInput(new Date())}" /></div>
            <div class="form-group"><label class="required">الحساب</label><select id="incAccount" required><option value="">اختر الحساب</option>${accounts.map(a => `<option value="${a.id}">${a.name} (${a.currency || '-'})</option>`).join('')}</select></div>
            <div class="form-group"><label>ملاحظات</label><textarea id="incNotes"></textarea></div>
            <button class="btn btn-primary btn-block" onclick="window.TadbeerApp.saveIncome()">حفظ الدخل</button>
        `;
        window.TadbeerUI.openModalHtml(html);
    };

    app.saveIncome = async function() {
        const amount = Number(document.getElementById('incAmount').value || 0);
        if (!amount || amount <= 0) return window.TadbeerUI.showToast('أدخل مبلغًا صحيحًا', 'error');
        const accountId = document.getElementById('incAccount').value;
        const account = (this.appData.accounts || []).find(item => item.id === accountId);
        if (!accountId || !account) return window.TadbeerUI.showToast('اختر الحساب', 'error');
        await window.db.collection('transactions').add({
            userId: this.currentUserId,
            type: 'income',
            ...this.getCurrentUserFields(),
            ...window.TadbeerCurrencies.operationFields(amount, account.currency || window.TadbeerCurrencies.state.first.code),
            date: new Date(document.getElementById('incDate').value || Date.now()),
            categoryId: null,
            accountId,
            description: document.getElementById('incSource').value || 'دخل',
            referenceType: null,
            referenceId: null,
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date(),
            notes: document.getElementById('incNotes').value || ''
        });
        window.TadbeerUI.closeModal();
        await this.refreshData();
        window.TadbeerUI.showToast('تم تسجيل الدخل', 'success');
    };
})();
