(function () {
    'use strict';

    const app = window.TadbeerApp;

    app.renderRecurring = function() {
        const list = document.getElementById('recurringList');
        const items = this.appData.recurring || [];
        list.innerHTML = items.length ? items.map(r => {
            const due = window.TadbeerUtils.toDateValue(r.dueDate);
            const isOverdue = due && due < new Date() && r.status === 'pending';
            const amountText = window.TadbeerCurrencies.format(r.amount || 0, r.currency || window.TadbeerCurrencies.state.first.code, window.TadbeerCurrencies.mode('recurring'), r.exchangeRate);
            return `<div class="card"><div class="flex-between"><div><strong>${r.name}</strong></div><div class="font-bold">${amountText}</div></div><div class="text-sm text-gray">${due ? due.toLocaleDateString('en-GB') : '-'} • ${r.frequency || 'شهري'} • <span class="${isOverdue ? 'text-red' : 'text-gray'}">${isOverdue ? 'متأخر' : r.status === 'paid' ? 'تم الدفع' : 'مستحق'}</span>${r.createdByName ? ` • ${r.createdByName}` : ''}</div></div>`;
        }).join('') : window.TadbeerUI.emptyState('لا توجد مصاريف متكررة');
    };

    app.openRecurringModal = function() {
        const html = `
            <div class="modal-header"><h3 class="modal-title">مصروف متكرر</h3><button class="modal-close" onclick="window.TadbeerUI.closeModal()">✕</button></div>
            <div class="form-group"><label class="required">الاسم</label><input type="text" id="recName" placeholder="إيجار، إنترنت..." /></div>
            <div class="form-row">
                <div class="form-group"><label class="required">المبلغ</label><input type="number" id="recAmount" placeholder="0" step="any" /></div>
                <div class="form-group"><label>العملة</label><select id="recCurrency">${window.TadbeerCurrencies.currencyOptions()}</select></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>التكرار</label><select id="recFrequency"><option value="monthly">شهري</option><option value="weekly">أسبوعي</option><option value="yearly">سنوي</option></select></div>
                <div class="form-group"><label>تاريخ الاستحقاق</label><input type="date" id="recDueDate" value="${window.TadbeerUtils.formatDateInput(new Date())}" /></div>
            </div>
            <div class="form-group"><label>ملاحظات</label><input type="text" id="recNotes" /></div>
            <button class="btn btn-primary btn-block" onclick="window.TadbeerApp.saveRecurring()">حفظ</button>
        `;
        window.TadbeerUI.openModalHtml(html);
    };

    app.saveRecurring = async function() {
        const name = document.getElementById('recName').value.trim();
        const amount = Number(document.getElementById('recAmount').value || 0);
        if (!name || !amount || amount <= 0) return window.TadbeerUI.showToast('أدخل بيانات صحيحة', 'error');
        await window.db.collection('recurringExpenses').add({
            userId: this.currentUserId,
            ...this.getCurrentUserFields(),
            name,
            amount,
            currency: document.getElementById('recCurrency').value,
            categoryId: null,
            frequency: document.getElementById('recFrequency').value,
            dueDate: new Date(document.getElementById('recDueDate').value || Date.now()),
            accountId: null,
            notes: document.getElementById('recNotes').value || '',
            status: 'pending',
            createdAt: new Date(),
            updatedAt: new Date()
        });
        window.TadbeerUI.closeModal();
        await this.refreshData();
        window.TadbeerUI.showToast('تم حفظ المصروف المتكرر', 'success');
    };
})();
