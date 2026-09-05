(function () {
    'use strict';

    const app = window.TadbeerApp;

    app.renderExpenses = function () {
        const search = (document.getElementById('expenseSearch')?.value || '').toLowerCase();
        const accounts = this.appData.accounts || [];
        const categories = this.appData.categories || [];
        const items = (this.appData.transactions || [])
            .filter(transaction => transaction.type === 'expense' && !transaction.referenceType)
            .filter(transaction => {
                const account = accounts.find(item => item.id === transaction.accountId);
                const category = categories.find(item => item.id === transaction.categoryId);
                const text = [transaction.description, account?.name, category?.name].filter(Boolean).join(' ').toLowerCase();
                return !search || text.includes(search);
            })
            .sort((a, b) => (window.TadbeerUtils.toDateValue(b.date) || 0) - (window.TadbeerUtils.toDateValue(a.date) || 0));

        const list = document.getElementById('expensesList');
        list.innerHTML = items.length ? items.map(transaction => {
            const date = window.TadbeerUtils.toDateValue(transaction.date);
            const account = accounts.find(item => item.id === transaction.accountId);
            const category = categories.find(item => item.id === transaction.categoryId);
            const amount = window.TadbeerCurrencies.format(
                transaction.amount || 0,
                transaction.currency || window.TadbeerCurrencies.state.first.code,
                window.TadbeerCurrencies.mode('expenses')
            );
            const status = transaction.status === 'cancelled' ? 'ملغى' : 'نشط';
            return `<div class="card expense-card" onclick="window.TadbeerApp.viewTransaction('${transaction.id}')">
                <div class="flex-between">
                    <div><strong>${transaction.description || 'مصروف'}</strong></div>
                    <div class="font-bold ${transaction.status === 'cancelled' ? 'text-gray' : 'text-red'}">-${amount}</div>
                </div>
                <div class="text-sm text-gray">${date ? date.toLocaleDateString('en-GB') : '-'} • ${category?.name || transaction.categoryName || 'بدون فئة'} • ${account?.name || 'بدون حساب'} • ${status}${transaction.createdByName ? ` • ${transaction.createdByName}` : ''}</div>
            </div>`;
        }).join('') : window.TadbeerUI.emptyState('لا توجد مصروفات');
    };
})();
