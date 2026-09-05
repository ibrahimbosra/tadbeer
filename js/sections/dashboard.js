(function () {
    'use strict';

    const app = window.TadbeerApp;

    const dashboardStatDescriptions = [
        { label: 'الرصيد الحالي', description: 'إجمالي قيمة الأرصدة المتاحة في جميع الحسابات، محسوبة بالعملة الأساسية وسعر الصرف الحالي.' },
        { label: 'دخل الشهر', description: 'مجموع مبالغ الدخل المسجلة خلال الشهر الحالي، بعد تحويلها إلى العملة الأساسية.' },
        { label: 'مصروف الشهر', description: 'مجموع المصروفات المسجلة خلال الشهر الحالي، باستثناء العمليات الملغاة.' },
        { label: 'مشتريات الشهر', description: 'إجمالي المصروفات المرتبطة بفواتير المشتريات خلال الشهر الحالي.' },
        { label: 'التزامات قادمة', description: 'قيمة المصروفات المتكررة التي حالتها معلّقة، كما هي مسجلة في التطبيق.' },
        { label: 'متبقي الميزانية', description: 'الحد الإجمالي للميزانيات الحالية مطروحًا منه مصروف الشهر، ولا يقل الناتج عن صفر.' },
        { label: 'مصروف اليوم', description: 'مجموع المصروفات المسجلة في تاريخ اليوم، بعد استبعاد العمليات الملغاة.' },
        { label: 'عدد العمليات', description: 'عدد العمليات النشطة بعد احتساب التحويلات المرتبطة كعملية منطقية واحدة.' }
    ];

    function isCurrencyTransferLeg(transaction) {
        return transaction.type === 'transfer' && transaction.transferId &&
            (transaction.referenceType === 'currency_transfer_from' || transaction.referenceType === 'currency_transfer_to');
    }

    function recentCurrencyTransferHtml(appData, group) {
        const fromAccount = (appData.accounts || []).find(account => account.id === group.from.accountId);
        const toAccount = (appData.accounts || []).find(account => account.id === group.to.accountId);
        const date = group.from.date || group.to.date;
        return `<div class="txn-item"><div class="txn-icon transfer">🔄</div><div class="txn-info"><div class="txn-desc">تحويل عملة</div><div class="txn-meta"><span>${window.TadbeerUtils.toDateValue(date)?.toLocaleDateString('en-GB') || '-'}</span><span>${fromAccount?.name || 'حساب المصدر'} → ${toAccount?.name || 'حساب الهدف'}</span></div></div><div class="txn-amount neutral">${window.TadbeerCurrencies.format(group.from.amount, group.from.currency, 'native')} → ${window.TadbeerCurrencies.format(group.to.amount, group.to.currency, 'native')}</div></div>`;
    }

    function recentAccountTransferHtml(appData, pair) {
        const fromAccount = (appData.accounts || []).find(account => account.id === pair.from.accountId);
        const toAccount = (appData.accounts || []).find(account => account.id === pair.to.accountId);
        const date = pair.from.date || pair.to.date;
        return `<div class="txn-item"><div class="txn-icon transfer">🔄</div><div class="txn-info"><div class="txn-desc">تحويل من حساب</div><div class="txn-meta"><span>${window.TadbeerUtils.toDateValue(date)?.toLocaleDateString('en-GB') || '-'}</span><span>${fromAccount?.name || 'حساب المصدر'} → ${toAccount?.name || 'حساب الهدف'}</span></div></div><div class="txn-amount neutral">${window.TadbeerCurrencies.format(pair.from.amount, pair.from.currency, 'native')}</div></div>`;
    }

    function recentDebtHtml(debt) {
        const balance = Math.max(0, Number(debt.totalAmount || 0) - Number(debt.paidAmount || 0));
        const date = window.TadbeerUtils.toDateValue(debt.date);
        return `<div class="txn-item" onclick="window.TadbeerApp.viewDebt('${debt.id}')"><div class="txn-icon debt">📋</div><div class="txn-info"><div class="txn-desc">${debt.party || debt.description || 'دين'}</div><div class="txn-meta"><span>${date?.toLocaleDateString('en-GB') || '-'}</span><span>${debt.type === 'payable' ? 'دين علينا' : 'دين لنا'}</span>${debt.createdByName ? `<span>${debt.createdByName}</span>` : ''}</div></div><div class="txn-amount neutral">${window.TadbeerCurrencies.format(balance, debt.currency || window.TadbeerCurrencies.state.first.code, 'native')}</div></div>`;
    }

    function recentTransactionsHtml(appData) {
        const groups = new Map();
        const renderedAccountLegs = new Set();
        const recent = [];
        for (const transaction of (appData.transactions || []).filter(item => item.status === 'active')) {
            if (window.TadbeerCalculations.isAccountTransferLeg(transaction)) {
                if (renderedAccountLegs.has(transaction)) continue;
                const pair = window.TadbeerCalculations.findAccountTransferPair(appData.transactions, transaction);
                if (pair) {
                    renderedAccountLegs.add(pair.from);
                    renderedAccountLegs.add(pair.to);
                    recent.push({ accountGroup: pair });
                    continue;
                }
            }
            if (!isCurrencyTransferLeg(transaction)) {
                recent.push({ transaction });
                continue;
            }
            let group = groups.get(transaction.transferId);
            if (!group) {
                group = { from: null, to: null };
                groups.set(transaction.transferId, group);
                recent.push({ group });
            }
            if (transaction.referenceType === 'currency_transfer_from') group.from = transaction;
            else group.to = transaction;
        }
        const debts = (appData.debts || []).filter(item => item.status === 'active').map(debt => ({ debt }));
        return [...recent, ...debts].slice(0, 8).map(item => item.debt
            ? recentDebtHtml(item.debt)
            : item.group?.from && item.group?.to
            ? recentCurrencyTransferHtml(appData, item.group)
            : item.accountGroup
                ? recentAccountTransferHtml(appData, item.accountGroup)
                : window.TadbeerUI.renderTxnItem(item.transaction || item.group?.from || item.group?.to)).join('');
    }

    app.openDashboardStatInfo = function (index) {
        const stat = dashboardStatDescriptions[index];
        if (!stat) return;
        window.TadbeerUI.openModalHtml(`
            <div class="modal-header"><h3 class="modal-title">${stat.label}</h3><button class="modal-close" onclick="window.TadbeerUI.closeModal()" aria-label="إغلاق">✕</button></div>
            <p class="stat-info-description">${stat.description}</p>
        `);
    };

    app.openActualBalancesInfo = function () {
        window.TadbeerUI.openModalHtml(`
            <div class="modal-header"><h3 class="modal-title">الأرصدة الفعلية</h3><button class="modal-close" onclick="window.TadbeerUI.closeModal()" aria-label="إغلاق">✕</button></div>
            <p class="stat-info-description">الأرصدة الحالية لكل حساب، معروضة حسب عملتها الأصلية. أما الرصيد الحالي الإجمالي فيحوّل هذه القيم إلى العملة الأساسية وفق سعر الصرف الحالي.</p>
        `);
    };

    app.renderDashboard = function () {
        const stats = window.TadbeerCalculations.calculateDashboardStats(this.appData);
        const money = value => window.TadbeerCurrencies.format(value, window.TadbeerCurrencies.state.first.code, window.TadbeerCurrencies.mode('dashboard'));
        const actualBalanceItems = (this.appData.accounts || []).map(account => {
            const currency = account.currency || window.TadbeerCurrencies.state.first.code;
            const balance = (this.appData.transactions || [])
                .filter(transaction => transaction.accountId === account.id && transaction.status === 'active')
                .reduce((total, transaction) => {
                    const amount = window.TadbeerCurrencies.toCurrentValue(transaction.amount || 0, transaction.currency || currency, currency);
                    if (transaction.type === 'income') return total + amount;
                    if (transaction.type === 'expense') return total - amount;
                    if (transaction.type === 'transfer') {
                        if (transaction.referenceType === 'transfer_to' || transaction.referenceType === 'currency_transfer_to') return total + amount;
                        if (transaction.referenceType === 'transfer_from' || transaction.referenceType === 'currency_transfer_from') return total - amount;
                    }
                    return total;
                }, 0);
            return { name: account.name || 'حساب', balance, currency };
        }).filter(account => account.balance > 0)
            .map(account => `<span class="actual-balance-item"><span>${account.name}</span> <strong>${window.TadbeerCurrencies.formatBalance(account.balance, account.currency)}</strong></span>`);
        const actualBalances = actualBalanceItems.length
            ? actualBalanceItems.join('')
            : '<span class="text-gray">لا توجد حسابات فيها أموال</span>';
        const dashboardStats = [
            ['primary', money(stats.balance)],
            ['green', money(stats.monthIncome)],
            ['red', money(stats.monthExpense)],
            ['orange', money(stats.monthPurchases)],
            ['', money(stats.upcomingObligations)],
            ['', money(stats.remainingBudget)],
            ['red', money(stats.todayExpense)],
            ['primary', window.TadbeerUtils.formatNumber(stats.txnCount)]
        ];
        const statsHtml = dashboardStats.map(([color, value], index) => {
            const stat = dashboardStatDescriptions[index];
            return `<div class="stat-card ${color}"><button type="button" class="stat-info-btn" onclick="window.TadbeerApp.openDashboardStatInfo(${index})" aria-label="معلومات عن ${stat.label}" title="معلومات عن ${stat.label}">!</button><div class="stat-value">${value}</div><div class="stat-label">${stat.label}</div></div>`;
        }).join('');
        document.getElementById('dashboardStats').innerHTML = statsHtml;
        document.getElementById('actualBalancesCard')?.remove();
        document.getElementById('dashboardStats').insertAdjacentHTML('afterend', `<div class="card" id="actualBalancesCard"><div class="card-title"><span>الأرصدة الفعلية</span><button type="button" class="stat-info-btn card-info-btn" onclick="window.TadbeerApp.openActualBalancesInfo()" aria-label="معلومات عن الأرصدة الفعلية" title="معلومات عن الأرصدة الفعلية">!</button></div><div class="actual-balances-grid">${actualBalances}</div></div>`);

        const hasRecent = [...(this.appData.transactions || []), ...(this.appData.debts || [])].some(item => item.status === 'active');
        document.getElementById('dashboardRecentTxns').innerHTML = hasRecent ? recentTransactionsHtml(this.appData) : window.TadbeerUI.emptyState('لا توجد عمليات بعد');

        const topCats = window.TadbeerCalculations.getTopCategories(this.appData, 5);
        document.getElementById('dashboardTopCategories').innerHTML = topCats.length ? topCats.map(c => `
            <div class="budget-cat">
                <div class="budget-cat-header">
                    <span class="budget-cat-name">${c.name}</span>
                    <span class="budget-cat-values"><span>${window.TadbeerCurrencies.format(c.total, window.TadbeerCurrencies.state.first.code, window.TadbeerCurrencies.mode())}</span><span>${window.TadbeerUtils.formatNumber(c.count)} عملية</span></span>
                </div>
                <div class="progress-bar"><div class="progress-fill safe" style="width:${c.percentage}%"></div></div>
            </div>`).join('') : window.TadbeerUI.emptyState('لا توجد بيانات');

        const topProds = window.TadbeerCalculations.getTopProducts(this.appData, 5);
        document.getElementById('dashboardTopProducts').innerHTML = topProds.length ? topProds.map(p => `
            <div class="budget-cat">
                <div class="budget-cat-header">
                    <span class="budget-cat-name">${p.name}</span>
                    <span class="budget-cat-values"><span>${window.TadbeerUtils.formatNumber(p.totalQty)} وحدة</span><span>${window.TadbeerCurrencies.format(p.totalSpent, window.TadbeerCurrencies.state.first.code, window.TadbeerCurrencies.mode())}</span></span>
                </div>
                <div class="progress-bar"><div class="progress-fill safe" style="width:${p.percentage}%"></div></div>
            </div>`).join('') : window.TadbeerUI.emptyState('لا توجد بيانات');

        const priceAlerts = window.TadbeerCalculations.getPriceAlerts(this.appData).slice(0, 5);
        const alertsBadge = document.getElementById('alertsBadge');
        const alertCount = window.TadbeerCalculations.generateAlerts(this.appData).length + priceAlerts.length;
        if (alertsBadge) {
            alertsBadge.classList.toggle('hidden', alertCount === 0);
            alertsBadge.setAttribute('aria-label', `${alertCount} تنبيه`);
        }

        document.getElementById('dashboardPriceAlerts').innerHTML = priceAlerts.length
            ? priceAlerts.map(a => `<div class="alert-item ${a.type}">${a.message}</div>`).join('')
            : window.TadbeerUI.emptyState('لا توجد تنبيهات أسعار');
    };
})();
