(function () {
    'use strict';

    function isActiveTransaction(appData, transaction) {
        if (transaction.status !== 'active') return false;
        if (transaction.referenceType !== 'purchase') return true;
        const purchase = (appData.purchases || []).find(p => p.id === transaction.referenceId);
        return !purchase || purchase.status !== 'cancelled';
    }

    function currentValue(record, amountField = 'amount', targetCurrency = window.TadbeerCurrencies.state.first.code) {
        return window.TadbeerCurrencies.toCurrentValue(record[amountField] || 0, record.currency || targetCurrency, targetCurrency);
    }

    function historicalValue(record, amountField = 'amount', targetCurrency = window.TadbeerCurrencies.state.first.code) {
        return window.TadbeerCurrencies.toHistoricalValue(record[amountField] || 0, record.currency || targetCurrency, record.exchangeRate, targetCurrency);
    }

    function isCancelledPurchase(purchase) {
        const status = String(purchase?.status || '').toLowerCase();
        return status === 'cancelled' || status === 'canceled';
    }

    function isAccountTransferLeg(transaction) {
        return transaction?.type === 'transfer' &&
            (transaction.referenceType === 'transfer_from' || transaction.referenceType === 'transfer_to');
    }

    function timestampKey(value) {
        if (!value) return null;
        if (typeof value.toMillis === 'function') return String(value.toMillis());
        if (typeof value.toDate === 'function') return String(value.toDate().getTime());
        if (value.seconds !== undefined) return `${value.seconds}.${value.nanoseconds || 0}`;
        const time = new Date(value).getTime();
        return Number.isNaN(time) ? null : String(time);
    }

    function findAccountTransferPair(transactions, transaction) {
        if (!isAccountTransferLeg(transaction)) return null;
        const oppositeType = transaction.referenceType === 'transfer_from' ? 'transfer_to' : 'transfer_from';
        const candidates = (transactions || []).filter(candidate =>
            candidate.id !== transaction.id &&
            isAccountTransferLeg(candidate) &&
            candidate.referenceType === oppositeType &&
            candidate.accountId === transaction.referenceId &&
            candidate.referenceId === transaction.accountId &&
            candidate.status === 'active'
        );
        const matchingCreatedAt = candidates.filter(candidate =>
            timestampKey(candidate.createdAt) && timestampKey(candidate.createdAt) === timestampKey(transaction.createdAt)
        );
        const counterpart = matchingCreatedAt.length === 1
            ? matchingCreatedAt[0]
            : candidates.length === 1 ? candidates[0] : null;
        if (!counterpart) return null;
        return transaction.referenceType === 'transfer_from'
            ? { from: transaction, to: counterpart }
            : { from: counterpart, to: transaction };
    }

    function countLogicalTransactions(transactions) {
        const countedTransactions = new Set();
        let count = 0;
        for (const transaction of transactions || []) {
            if (countedTransactions.has(transaction)) continue;
            count += 1;
            countedTransactions.add(transaction);
            if (transaction.transferId && transaction.referenceType?.startsWith('currency_transfer_')) {
                for (const leg of transactions) {
                    if (leg.transferId === transaction.transferId) countedTransactions.add(leg);
                }
                continue;
            }
            const pair = findAccountTransferPair(transactions, transaction);
            if (pair) {
                countedTransactions.add(pair.from);
                countedTransactions.add(pair.to);
            }
        }
        return count;
    }

    function calculateBalances(appData) {
        const firstCode = window.TadbeerCurrencies.state.first.code;
        const secondCode = window.TadbeerCurrencies.state.second?.code;
        const balances = {};
        if (firstCode) balances[firstCode] = 0;
        if (secondCode) balances[secondCode] = 0;
        for (const transaction of appData.transactions || []) {
            if (!isActiveTransaction(appData, transaction) || !balances.hasOwnProperty(transaction.currency)) continue;
            const amount = Number(transaction.amount || 0);
            if (transaction.type === 'income') balances[transaction.currency] += amount;
            else if (transaction.type === 'expense') balances[transaction.currency] -= amount;
            else if (transaction.type === 'transfer' && (transaction.referenceType === 'transfer_from' || transaction.referenceType === 'currency_transfer_from')) balances[transaction.currency] -= amount;
            else if (transaction.type === 'transfer' && (transaction.referenceType === 'transfer_to' || transaction.referenceType === 'currency_transfer_to')) balances[transaction.currency] += amount;
        }
        const currentTotal = Object.entries(balances).reduce((sum, [currency, amount]) => sum + window.TadbeerCurrencies.toBase(amount, currency), 0);
        return { balances, currentTotal };
    }

    function calculateDashboardStats(appData) {
        const now = new Date();
        const month = now.getMonth();
        const year = now.getFullYear();
        const activeTxns = (appData.transactions || []).filter(t => isActiveTransaction(appData, t));
        const monthTxns = activeTxns.filter(t => {
            const d = window.TadbeerUtils.toDateValue(t.date);
            return d && d.getMonth() === month && d.getFullYear() === year;
        });
        const todayTxns = activeTxns.filter(t => {
            const d = window.TadbeerUtils.toDateValue(t.date);
            return d && d.toDateString() === now.toDateString();
        });

        const balanceData = calculateBalances(appData);
        let monthIncome = 0;
        let monthExpense = 0;
        let monthPurchases = 0;
        let todayExpense = 0;

        for (const t of monthTxns) {
            const amount = currentValue(t);
            if (t.type === 'income') monthIncome += amount;
            else if (t.type === 'expense') monthExpense += amount;
        }

        for (const t of monthTxns) {
            if (t.type === 'expense' && t.referenceType === 'purchase') monthPurchases += currentValue(t);
        }

        for (const t of todayTxns) {
            if (t.type === 'expense') todayExpense += currentValue(t);
        }

        const upcomingObligations = (appData.recurring || []).filter(r => r.status === 'pending').reduce((sum, r) => sum + currentValue(r), 0);
        const totalBudgetLimit = (appData.budgets || []).filter(b => b.month === month && b.year === year).reduce((sum, b) => sum + currentValue(b, 'limit'), 0);
        const remainingBudget = totalBudgetLimit > 0 ? Math.max(0, totalBudgetLimit - monthExpense) : 0;

        return {
            balance: balanceData.currentTotal,
            balances: balanceData.balances,
            monthIncome,
            monthExpense,
            monthPurchases,
            upcomingObligations,
            remainingBudget,
            todayExpense,
            txnCount: countLogicalTransactions(activeTxns)
        };
    }

    function resolveCategoryName(appData, categoryId, fallback = null) {
        if (!categoryId) return fallback;
        const category = (appData.categories || []).find(c => c.id === categoryId || c.name === categoryId);
        if (category) return category.name;
        return categoryId || fallback;
    }

    function matchesBudgetCategory(appData, value, budget) {
        if (!value) return false;
        if (value === budget.categoryId) return true;
        const category = (appData.categories || []).find(item => item.id === budget.categoryId || item.name === budget.categoryId || item.name === budget.categoryName);
        return Boolean(category && (value === category.id || value === category.name));
    }

    function getCategorySpendMap(appData) {
        const catMap = {};

        for (const t of appData.transactions || []) {
            if (t.status !== 'active' || t.type !== 'expense') continue;
            if (t.referenceType === 'purchase') continue;
            const key = resolveCategoryName(appData, t.categoryId, 'أخرى');
            if (!catMap[key]) catMap[key] = { name: key, total: 0, count: 0 };
            catMap[key].total += currentValue(t);
            catMap[key].count += 1;
        }

        for (const purchaseId of Object.keys(appData.purchaseItems || {})) {
            const purchase = (appData.purchases || []).find(p => p.id === purchaseId);
            if (isCancelledPurchase(purchase)) continue;
            const items = appData.purchaseItems[purchaseId] || [];
            for (const item of items) {
                const categoryId = item.categoryId || null;
                const categoryName = item.categoryNameSnapshot || null;
                const key = categoryName || resolveCategoryName(appData, categoryId, null);
                if (!key) continue;
                if (!catMap[key]) catMap[key] = { name: key, total: 0, count: 0 };
                catMap[key].total += currentValue(item, 'total');
                catMap[key].count += 1;
            }
        }

        return catMap;
    }

    function getTopCategories(appData, limit = 5) {
        const catMap = getCategorySpendMap(appData);
        const sorted = Object.values(catMap).sort((a, b) => b.total - a.total);
        const maxTotal = sorted.length ? sorted[0].total : 1;
        return sorted.slice(0, limit).map(c => ({ ...c, percentage: Math.round((c.total / maxTotal) * 100) }));
    }

    function getTopProducts(appData, limit = 5) {
        const map = {};
        for (const purchaseId of Object.keys(appData.purchaseItems || {})) {
            const purchase = (appData.purchases || []).find(p => p.id === purchaseId);
            if (isCancelledPurchase(purchase)) continue;
            const items = appData.purchaseItems[purchaseId] || [];
            for (const item of items) {
                if (!item.productId) continue;
                if (!map[item.productId]) {
                    const product = (appData.products || []).find(p => p.id === item.productId);
                    map[item.productId] = {
                        name: product ? product.name : (item.productNameSnapshot || 'منتج'),
                        totalQty: 0,
                        totalSpent: 0
                    };
                }
                map[item.productId].totalQty += Number(item.quantity || 0);
                map[item.productId].totalSpent += currentValue(item, 'total');
            }
        }
        const sorted = Object.values(map).sort((a, b) => b.totalSpent - a.totalSpent);
        const maxTotal = sorted.length ? sorted[0].totalSpent : 1;
        return sorted.slice(0, limit).map(product => ({
            ...product,
            percentage: Math.round((product.totalSpent / maxTotal) * 100)
        }));
    }

    function getBudgetCategorySpend(appData, budget) {
        const monthTransactions = (appData.transactions || []).filter(transaction => {
            if (transaction.status !== 'active' || transaction.type !== 'expense') return false;
            const date = window.TadbeerUtils.toDateValue(transaction.date);
            return date && date.getMonth() === budget.month && date.getFullYear() === budget.year && matchesBudgetCategory(appData, transaction.categoryId, budget);
        });
        const targetCurrency = budget.currency || window.TadbeerCurrencies.state.first.code;
        const transactionTotal = monthTransactions.filter(transaction => transaction.referenceType !== 'purchase')
            .reduce((sum, transaction) => sum + currentValue(transaction, 'amount', targetCurrency), 0);
        const purchaseTotal = Object.keys(appData.purchaseItems || {}).reduce((sum, purchaseId) => {
            const purchase = (appData.purchases || []).find(item => item.id === purchaseId);
            const date = purchase ? window.TadbeerUtils.toDateValue(purchase.date) : null;
            if (!purchase || isCancelledPurchase(purchase) || !date || date.getMonth() !== budget.month || date.getFullYear() !== budget.year) return sum;
            return sum + (appData.purchaseItems[purchaseId] || [])
                .filter(item => matchesBudgetCategory(appData, item.categoryId || item.categoryNameSnapshot, budget))
                .reduce((itemsTotal, item) => itemsTotal + currentValue(item, 'total', budget.currency || window.TadbeerCurrencies.state.first.code), 0);
        }, 0);
        return transactionTotal + purchaseTotal;
    }

    function generateAlerts(appData) {
        const alerts = [];
        const stats = calculateDashboardStats(appData);
        const now = new Date();
        const month = now.getMonth();
        const year = now.getFullYear();
        const budgets = (appData.budgets || []).filter(b => b.month === month && b.year === year);
        for (const budget of budgets) {
            const targetCurrency = budget.currency || window.TadbeerCurrencies.state.first.code;
            const limit = Number(budget.limit || 0);
            const categoryExpense = getBudgetCategorySpend(appData, budget);
            if (limit > 0 && categoryExpense > limit) {
                alerts.push({ type: 'danger', message: `⚠️ تجاوزت ميزانية الفئة: ${window.TadbeerCurrencies.format(categoryExpense, targetCurrency, window.TadbeerCurrencies.mode())} من ${window.TadbeerCurrencies.format(limit, targetCurrency, window.TadbeerCurrencies.mode())}` });
            } else if (limit > 0 && categoryExpense > limit * 0.8) {
                alerts.push({ type: 'warning', message: `⚠️ اقتربت من تجاوز ميزانية الفئة: ${window.TadbeerCurrencies.format(categoryExpense, targetCurrency, window.TadbeerCurrencies.mode())} من ${window.TadbeerCurrencies.format(limit, targetCurrency, window.TadbeerCurrencies.mode())}` });
            }
        }

        for (const recurring of appData.recurring || []) {
            const due = window.TadbeerUtils.toDateValue(recurring.dueDate);
            if (recurring.status === 'pending' && due && due < now) {
                alerts.push({ type: 'warning', message: `⚠️ متأخر: ${recurring.name} - ${window.TadbeerCurrencies.format(recurring.amount || 0, recurring.currency || window.TadbeerCurrencies.state.first.code, window.TadbeerCurrencies.mode(), recurring.exchangeRate)}` });
            }
        }

        return alerts;
    }

    function getPriceAlerts(appData) {
        const alerts = [];
        const byProduct = {};
        const purchases = new Map((appData.purchases || []).map(purchase => [purchase.id, purchase]));
        for (const ph of appData.priceHistory || []) {
            if (!ph.productId || !ph.unitPrice) continue;
            if (ph.purchaseId && isCancelledPurchase(purchases.get(ph.purchaseId))) continue;
            if (!byProduct[ph.productId]) byProduct[ph.productId] = [];
            byProduct[ph.productId].push(ph);
        }
        for (const productId of Object.keys(byProduct)) {
            const history = byProduct[productId].sort((a, b) => {
                const da = window.TadbeerUtils.toDateValue(a.date);
                const db = window.TadbeerUtils.toDateValue(b.date);
                return (db || 0) - (da || 0);
            });
            if (history.length >= 2) {
                const latest = history[0];
                const previous = history[1];
                const product = (appData.products || []).find(p => p.id === productId);
                const name = product ? product.name : 'صنف';
                const latestValue = currentValue(latest, 'unitPrice');
                const previousValue = currentValue(previous, 'unitPrice');
                const change = ((latestValue - previousValue) / Math.max(previousValue, 1)) * 100;
                if (change > 10) {
                    alerts.push({ type: 'warning', message: `⚠️ ارتفع سعر ${name} بنسبة ${change.toFixed(1)}%` });
                } else if (change < -10) {
                    alerts.push({ type: 'success', message: `⬇️ انخفض سعر ${name} بنسبة ${Math.abs(change).toFixed(1)}%` });
                }
            }
        }
        return alerts;
    }

    function getReportStats(appData, period) {
        const now = new Date();
        const filtered = (appData.transactions || []).filter(t => {
            if (!isActiveTransaction(appData, t)) return false;
            const d = window.TadbeerUtils.toDateValue(t.date);
            if (!d) return false;
            switch (period) {
                case 'this_month':
                    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                case 'last_month': {
                    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    return d.getMonth() === lastMonth.getMonth() && d.getFullYear() === lastMonth.getFullYear();
                }
                case 'this_year':
                    return d.getFullYear() === now.getFullYear();
                case 'all':
                    return true;
                default:
                    return false;
            }
        });

        if (!filtered.length) return null;

        let totalIncome = 0;
        let totalExpense = 0;
        const byCategory = {};
        const byDay = {};

        for (const t of filtered) {
            const amt = currentValue(t);
            if (t.type === 'income') totalIncome += amt;
            else if (t.type === 'expense') totalExpense += amt;

            if (t.type === 'expense' && t.referenceType !== 'purchase') {
                const catName = resolveCategoryName(appData, t.categoryId, 'أخرى');
                if (!byCategory[catName]) byCategory[catName] = { name: catName, total: 0, count: 0 };
                byCategory[catName].total += amt;
                byCategory[catName].count += 1;
            }

            if (t.type === 'expense') {
                const d = window.TadbeerUtils.toDateValue(t.date);
                if (d) {
                    const dayKey = d.toLocaleDateString('en-GB');
                    if (!byDay[dayKey]) byDay[dayKey] = 0;
                    byDay[dayKey] += amt;
                }
            }
        }

        for (const purchaseId of Object.keys(appData.purchaseItems || {})) {
            const purchase = (appData.purchases || []).find(p => p.id === purchaseId);
            if (!purchase || isCancelledPurchase(purchase)) continue;
            const purchaseDate = window.TadbeerUtils.toDateValue(purchase.date);
            if (!purchaseDate) continue;
            const inPeriod = (() => {
                switch (period) {
                    case 'this_month':
                        return purchaseDate.getMonth() === now.getMonth() && purchaseDate.getFullYear() === now.getFullYear();
                    case 'last_month': {
                        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                        return purchaseDate.getMonth() === lastMonth.getMonth() && purchaseDate.getFullYear() === lastMonth.getFullYear();
                    }
                    case 'this_year':
                        return purchaseDate.getFullYear() === now.getFullYear();
                    case 'all':
                        return true;
                    default:
                        return false;
                }
            })();

            if (!inPeriod) continue;

            for (const item of appData.purchaseItems[purchaseId] || []) {
                const categoryId = item.categoryId || null;
                const categoryName = item.categoryNameSnapshot || null;
                const key = categoryName || resolveCategoryName(appData, categoryId, null);
                if (!key) continue;
                if (!byCategory[key]) byCategory[key] = { name: key, total: 0, count: 0 };
                byCategory[key].total += currentValue(item, 'total');
                byCategory[key].count += 1;
            }
        }

        const dayCount = Object.keys(byDay).length || 1;
        const avgDailyExpense = totalExpense / dayCount;
        const mostExpensiveDay = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0];

        return {
            totalIncome,
            totalExpense,
            netFlow: totalIncome - totalExpense,
            txnCount: countLogicalTransactions(filtered),
            byCategory: Object.values(byCategory).sort((a, b) => b.total - a.total),
            avgDailyExpense: Math.round(avgDailyExpense),
            mostExpensiveDay: mostExpensiveDay ? `${mostExpensiveDay[0]} (${window.TadbeerCurrencies.format(mostExpensiveDay[1], window.TadbeerCurrencies.state.first.code, window.TadbeerCurrencies.mode())})` : null
        };
    }

    window.TadbeerCalculations = {
        calculateDashboardStats,
        calculateBalances,
        isAccountTransferLeg,
        findAccountTransferPair,
        countLogicalTransactions,
        getBudgetCategorySpend,
        getTopCategories,
        getTopProducts,
        generateAlerts,
        getPriceAlerts,
        getReportStats
    };
})();
