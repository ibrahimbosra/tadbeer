(function () {
    'use strict';

    const app = window.TadbeerApp;

    app.renderAccounts = function() {
        const list = document.getElementById('accountsList');
        const items = this.appData.accounts || [];
        list.innerHTML = items.length ? items.map(acc => {
            const txns = (this.appData.transactions || []).filter(t => t.accountId === acc.id && t.status === 'active');
            let balance = 0;
            for (const t of txns) {
                const accountCurrency = acc.currency || window.TadbeerCurrencies.state.first.code;
                const value = window.TadbeerCurrencies.toCurrentValue(t.amount || 0, t.currency || accountCurrency, accountCurrency);
                if (t.type === 'income') balance += value;
                else if (t.type === 'expense') balance -= value;
                else if (t.type === 'transfer') {
                    if (t.referenceType === 'transfer_from' || t.referenceType === 'currency_transfer_from') balance -= value;
                    else if (t.referenceType === 'transfer_to' || t.referenceType === 'currency_transfer_to') balance += value;
                }
            }
            const accountCurrency = acc.currency || window.TadbeerCurrencies.state.first.code;
            const displayMode = window.TadbeerCurrencies.mode('accounts');
            const displayBalance = displayMode === 'native'
                ? window.TadbeerCurrencies.formatBalance(balance, accountCurrency)
                : window.TadbeerCurrencies.format(
                    window.TadbeerCurrencies.toCurrentValue(balance, accountCurrency),
                    window.TadbeerCurrencies.state.first.code,
                    displayMode
                );
            return `<div class="card"><div class="flex-between"><div><strong>${acc.name}</strong> <span class="text-sm text-gray">${acc.type || ''}</span></div><div class="font-bold">${displayBalance}</div></div></div>`;
        }).join('') : window.TadbeerUI.emptyState('لا توجد حسابات');
    };

    app.openAccountModal = function() {
        const html = `
            <div class="modal-header"><h3 class="modal-title">حساب جديد</h3><button class="modal-close" onclick="window.TadbeerUI.closeModal()">✕</button></div>
            <div class="form-group"><label class="required">اسم الحساب</label><input type="text" id="accName" placeholder="نقد البيت، بنك..." /></div>
            <div class="form-row">
                <div class="form-group"><label>النوع</label><select id="accType"><option value="cash">نقد</option><option value="bank">بنك</option><option value="ewallet">محفظة إلكترونية</option></select></div>
                <div class="form-group"><label>العملة</label><select id="accCurrency">${window.TadbeerCurrencies.currencyOptions()}</select></div>
            </div>
            <button class="btn btn-primary btn-block" onclick="window.TadbeerApp.saveAccount()">حفظ الحساب</button>
        `;
        window.TadbeerUI.openModalHtml(html);
    };

    app.saveAccount = async function() {
        const name = document.getElementById('accName').value.trim();
        if (!name) return window.TadbeerUI.showToast('أدخل اسم الحساب', 'error');
        
        try {
            const docRef = await window.db.collection('accounts').add({
                userId: this.currentUserId,
                name,
                type: document.getElementById('accType').value,
                currency: document.getElementById('accCurrency').value,
                status: 'active',
                createdAt: new Date(),
                updatedAt: new Date()
            });
            
            if (!this.appData.accounts) this.appData.accounts = [];
            this.appData.accounts.unshift({
                id: docRef.id,
                userId: this.currentUserId,
                name,
                type: document.getElementById('accType').value,
                currency: document.getElementById('accCurrency').value,
                status: 'active',
                createdAt: new Date(),
                updatedAt: new Date()
            });
            
            window.TadbeerUI.closeModal();
            this.renderDashboard();
            window.TadbeerUI.showToast('تم حفظ الحساب بنجاح ✓', 'success');
        } catch (e) {
            console.error('خطأ في حفظ الحساب:', e);
            window.TadbeerUI.showToast('خطأ: ' + e.message, 'error');
        }
    };
})();
