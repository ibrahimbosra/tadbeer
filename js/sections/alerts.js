(function () {
    'use strict';

    const app = window.TadbeerApp;

    app.renderAlerts = function () {
        const alerts = [...window.TadbeerCalculations.generateAlerts(this.appData), ...window.TadbeerCalculations.getPriceAlerts(this.appData)];
        document.getElementById('alertsFullList').innerHTML = alerts.length ? alerts.map(a => `<div class="alert-item ${a.type}">${a.message}</div>`).join('') : window.TadbeerUI.emptyState('لا توجد تنبيهات');
    };

    app.renderMoreGrid = function () {
        const items = [
            { label: 'المعاملات', icon: '📋', page: 'transactions' },
            { label: 'التجار', icon: '🏪', page: 'merchants' },
            { label: 'التقارير', icon: '📊', page: 'reports' },
            { label: 'الميزانية', icon: '📊', page: 'budgets' },
            { label: 'الاحتياجات', icon: '📝', page: 'needs' },
            { label: 'المصاريف المتكررة', icon: '🔄', page: 'recurring' },
            { label: 'الدخل', icon: '💰', page: 'income' },
            { label: 'الحسابات', icon: '💳', page: 'accounts' },
            { label: 'التحويلات', icon: '🔀', page: 'transfers' },
            { label: 'الأسعار', icon: '💰', page: 'prices' },
            { label: 'الفئات', icon: '🏷️', page: 'categories' },
        ];
        items.sort((a, b) => a.label.localeCompare(b.label, 'ar'));
        document.getElementById('moreGrid').innerHTML = items.map(item => `<div class="more-item" onclick="window.TadbeerUI.showPage('${item.page}')"><div class="more-icon">${item.icon}</div><div class="more-label">${item.label}</div></div>`).join('');
    };

    app.renderGlobalSearch = function () {
        const q = (document.getElementById('globalSearch')?.value || '').toLowerCase();
        const container = document.getElementById('searchResults');
        if (!q) {
            container.innerHTML = '<p class="text-center text-gray mt-4">اكتب للبحث...</p>';
            return;
        }
        const products = (this.appData.products || []).filter(p => (p.name || '').toLowerCase().includes(q));
        const merchants = (this.appData.merchants || []).filter(m => (m.name || '').toLowerCase().includes(q));
        const txns = (this.appData.transactions || []).filter(t => (t.description || '').toLowerCase().includes(q));
        let html = '';
        if (products.length) {
            html += `<div class="card"><div class="card-title">الأصناف (${window.TadbeerUtils.formatNumber(products.length)})</div>${products.map(p => `<div class="flex-between text-sm"><span>${p.name}</span><span class="text-gray">${this.getProductLastPrice(p.id) ? window.TadbeerCurrencies.format(this.getProductLastPrice(p.id).unitPrice || 0, this.getProductLastPrice(p.id).currency || window.TadbeerCurrencies.state.first.code, window.TadbeerCurrencies.mode()) : '-'}</span></div>`).join('')}</div>`;
        }
        if (merchants.length) html += `<div class="card"><div class="card-title">التجار (${window.TadbeerUtils.formatNumber(merchants.length)})</div>${merchants.map(m => `<div class="flex-between text-sm"><span>${m.name}</span><span class="text-gray">${m.phone || ''}</span></div>`).join('')}</div>`;
        if (txns.length) html += `<div class="card"><div class="card-title">العمليات (${window.TadbeerUtils.formatNumber(txns.length)})</div>${txns.slice(0, 10).map(t => window.TadbeerUI.renderTxnItem(t)).join('')}</div>`;
        if (!html) html = window.TadbeerUI.emptyState('لا توجد نتائج');
        container.innerHTML = html;
    };

})();
