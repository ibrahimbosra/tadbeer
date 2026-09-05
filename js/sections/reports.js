(function () {
    'use strict';

    const app = window.TadbeerApp;

    app.renderReports = function () {
        const stats = window.TadbeerCalculations.getReportStats(this.appData, this.reportPeriod);
        const container = document.getElementById('reportsContent');
        if (!stats) {
            container.innerHTML = window.TadbeerUI.emptyState('لا توجد بيانات لهذه الفترة');
            return;
        }
        const money = value => window.TadbeerCurrencies.format(value, window.TadbeerCurrencies.state.first.code, window.TadbeerCurrencies.mode('reports'));
        container.innerHTML = `
            <div class="stats-grid" style="grid-template-columns:repeat(2,1fr);">
                <div class="stat-card green"><div class="stat-value">${money(stats.totalIncome)}</div><div class="stat-label">إجمالي الدخل</div></div>
                <div class="stat-card red"><div class="stat-value">${money(stats.totalExpense)}</div><div class="stat-label">إجمالي المصروف</div></div>
                <div class="stat-card primary"><div class="stat-value">${money(stats.netFlow)}</div><div class="stat-label">صافي التدفق</div></div>
                    <div class="stat-card"><div class="stat-value">${window.TadbeerUtils.formatNumber(stats.txnCount)}</div><div class="stat-label">عدد العمليات</div></div>
            </div>
            <div class="card">
                <div class="card-title">حسب الفئة</div>
                ${stats.byCategory.map(c => `
                    <div class="budget-cat">
                        <div class="budget-cat-header"><span class="budget-cat-name">${c.name}</span><span>${money(c.total)} (${window.TadbeerUtils.formatNumber(c.count)})</span></div>
                        <div class="progress-bar"><div class="progress-fill ${c.total > stats.totalExpense * 0.3 ? 'danger' : c.total > stats.totalExpense * 0.15 ? 'warning' : 'safe'}" style="width:${stats.totalExpense > 0 ? (c.total / stats.totalExpense * 100) : 0}%"></div></div>
                    </div>
                `).join('') || window.TadbeerUI.emptyState('لا توجد بيانات')}
            </div>
            <div class="card">
                <div class="card-title">معلومات إضافية</div>
                <div style="display:grid;gap:6px;font-size:0.9rem;">
                    <div class="flex-between"><span>متوسط المصروف اليومي:</span><strong>${money(stats.avgDailyExpense)}</strong></div>
                    <div class="flex-between"><span>أكثر يوم إنفاقًا:</span><strong>${stats.mostExpensiveDay || '-'}</strong></div>
                </div>
            </div>
        `;
    };
})();
