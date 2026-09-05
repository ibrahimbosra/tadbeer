(function () {
    'use strict';

    const app = window.TadbeerApp;

    function findCategory(appData, budget) {
        return (appData.categories || []).find(category => category.id === budget.categoryId) || null;
    }

    function budgetCategoryLabel(appData, budget) {
        const category = findCategory(appData, budget);
        if (category) return category.name;
        if (budget.categoryId) return 'الفئة المحذوفة ⚠️';
        return budget.categoryName ? `${budget.categoryName} ⚠️ (ميزانية قديمة)` : 'فئة غير معروفة ⚠️';
    }

    function resolveCategoryName(appData, categoryId, fallback = null) {
        if (!categoryId) return fallback;
        const category = (appData.categories || []).find(c => c.id === categoryId || c.name === categoryId);
        if (category) return category.name;
        return categoryId || fallback;
    }

    app.renderBudgets = function () {
        const monthInput = document.getElementById('budgetMonth');
        const now = new Date();
        let budgets = this.appData.budgets || [];
        if (monthInput && monthInput.value) {
            const [year, month] = monthInput.value.split('-').map(Number);
            budgets = budgets.filter(b => b.year === year && b.month === month - 1);
        } else {
            budgets = budgets.filter(b => b.month === now.getMonth() && b.year === now.getFullYear());
        }
        const container = document.getElementById('budgetsContent');
        if (!budgets.length) {
            container.innerHTML = window.TadbeerUI.emptyState('لا توجد ميزانية لهذا الشهر');
            return;
        }
        const monthExpense = (this.appData.transactions || []).filter(t => {
            if (t.status !== 'active' || t.type !== 'expense') return false;
            if (t.referenceType === 'purchase') {
                const purchase = (this.appData.purchases || []).find(p => p.id === t.referenceId);
                if (purchase && purchase.status === 'cancelled') return false;
            }
            return true;
        }).reduce((sum, t) => {
            const d = window.TadbeerUtils.toDateValue(t.date);
            return budgets.some(b => d && d.getMonth() === b.month && d.getFullYear() === b.year) ? sum + window.TadbeerCurrencies.toCurrentValue(t.amount || 0, t.currency || window.TadbeerCurrencies.state.first.code) : sum;
        }, 0);
        const totalLimit = budgets.reduce((sum, b) => sum + window.TadbeerCurrencies.toCurrentValue(b.limit || 0, b.currency || window.TadbeerCurrencies.state.first.code), 0);

        const displayMode = window.TadbeerCurrencies.mode('budgets');
        const displayTotal = value => window.TadbeerCurrencies.format(value, window.TadbeerCurrencies.state.first.code, displayMode);
        container.innerHTML = `
            <div class="card">
                <div class="flex-between"><span>إجمالي الميزانية:</span><strong>${displayTotal(totalLimit)}</strong></div>
                <div class="flex-between"><span>إجمالي المصروف:</span><strong class="text-red">${displayTotal(monthExpense)}</strong></div>
                <div class="flex-between"><span>المتبقي:</span><strong class="${totalLimit - monthExpense >= 0 ? 'text-green' : 'text-red'}">${displayTotal(totalLimit - monthExpense)}</strong></div>
                <div class="progress-bar mt-4"><div class="progress-fill ${monthExpense > totalLimit ? 'danger' : monthExpense > totalLimit * 0.8 ? 'warning' : 'safe'}" style="width:${totalLimit > 0 ? Math.min(100, (monthExpense / totalLimit) * 100) : 0}%"></div></div>
            </div>
            ${budgets.map(b => {
                const budgetCurrency = b.currency || window.TadbeerCurrencies.state.first.code;
                const catExpense = window.TadbeerCalculations.getBudgetCategorySpend(this.appData, b);
                const limit = Number(b.limit || 0);
                const pct = limit > 0 ? Math.min(100, (catExpense / limit) * 100) : 0;
                const remaining = limit - catExpense;
                const categoryLabel = budgetCategoryLabel(this.appData, b);
                const missingLabel = !findCategory(this.appData, b) ? '<div class="text-sm text-orange mt-4">لا يمكن ربط مصروفات جديدة بهذه الميزانية حتى تُعاد الفئة.</div>' : '';
                const displayMode = window.TadbeerCurrencies.mode('budgets');
                return `<div class="card"><div class="budget-cat-header"><span class="budget-cat-name">${categoryLabel}</span><span class="budget-cat-values"><span>${window.TadbeerCurrencies.format(limit, budgetCurrency, displayMode)}</span><span class="${remaining >= 0 ? 'text-green' : 'text-red'}">${window.TadbeerCurrencies.format(remaining, budgetCurrency, displayMode)}</span></span></div><div class="progress-bar"><div class="progress-fill ${pct > 100 ? 'danger' : pct > 80 ? 'warning' : 'safe'}" style="width:${pct}%"></div></div><div class="text-sm text-gray mt-4">استخدام: ${window.TadbeerUtils.formatNumber(pct)}%</div>${missingLabel}<div class="btn-group mt-4"><button class="btn btn-sm btn-outline" onclick="window.TadbeerApp.openBudgetModal('${b.id}')">تعديل</button></div></div>`;
            }).join('')}
        `;
    };

    app.openBudgetModal = function (budgetId = null) {
        const now = new Date();
        const budget = budgetId ? (this.appData.budgets || []).find(item => item.id === budgetId) : null;
        const categories = [...(this.appData.categories || [])].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
        const selectedCategoryId = budget?.categoryId || '';
        const categoryOptions = categories.length
            ? categories.map(category => `<option value="${category.id}" ${category.id === selectedCategoryId ? 'selected' : ''}>${category.name}</option>`).join('')
            : '<option value="">لا توجد فئات</option>';
        const budgetMonth = budget ? `${budget.year}-${String(budget.month + 1).padStart(2, '0')}` : window.TadbeerUtils.formatMonthInput(now);
        const html = `
            <div class="modal-header"><h3 class="modal-title">${budget ? 'تعديل الميزانية' : 'ميزانية شهرية'}</h3><button class="modal-close" onclick="window.TadbeerUI.closeModal()">✕</button></div>
            <div class="form-row">
                <div class="form-group"><label>الشهر</label><input type="month" id="budgMonth" value="${budgetMonth}" /></div>
                <div class="form-group"><label class="required">الفئة</label><select id="budgCategory" ${categories.length ? '' : 'disabled'}><option value="">اختر فئة</option>${categoryOptions}</select></div>
            </div>
            ${categories.length ? '' : '<div class="text-sm text-gray">يجب إنشاء فئة أولاً من قسم الفئات.</div>'}
            <div class="form-row"><div class="form-group"><label class="required">المبلغ المحدد</label><input type="number" id="budgLimit" value="${budget ? Number(budget.limit || 0) : ''}" placeholder="0" step="any" /></div><div class="form-group"><label>العملة</label><select id="budgCurrency">${window.TadbeerCurrencies.currencyOptions(budget?.currency || window.TadbeerCurrencies.state.first.code)}</select></div></div>
            <button class="btn btn-primary btn-block" onclick="window.TadbeerApp.saveBudget('${budgetId || ''}')">${budget ? 'حفظ التعديلات' : 'حفظ الميزانية'}</button>
        `;
        window.TadbeerUI.openModalHtml(html);
    };

    app.saveBudget = async function (budgetId = '') {
        const monthInput = document.getElementById('budgMonth').value;
        const limit = Number(document.getElementById('budgLimit').value || 0);
        const categoryId = document.getElementById('budgCategory').value;
        const category = (this.appData.categories || []).find(item => item.id === categoryId);
        if (!monthInput || !limit || limit <= 0 || !category) return window.TadbeerUI.showToast('اختر فئة وأدخل بيانات صحيحة', 'error');

        try {
            const [year, month] = monthInput.split('-').map(Number);
            const currency = document.getElementById('budgCurrency').value;
            const budgetData = {
                month: month - 1,
                year,
                categoryId,
                categoryName: category.name,
                currency,
                limit,
                exchangeRate: window.TadbeerCurrencies.rateFor(currency),
                updatedAt: new Date()
            };
            let savedBudget;
            if (budgetId) {
                await window.db.collection('budgets').doc(budgetId).update(budgetData);
                savedBudget = (this.appData.budgets || []).find(item => item.id === budgetId);
                if (savedBudget) Object.assign(savedBudget, budgetData);
            } else {
                const docRef = await window.db.collection('budgets').add({ userId: this.currentUserId, ...budgetData, createdAt: new Date() });
                savedBudget = { id: docRef.id, userId: this.currentUserId, ...budgetData, createdAt: new Date() };
                if (!this.appData.budgets) this.appData.budgets = [];
                this.appData.budgets.unshift(savedBudget);
            }

            window.TadbeerUI.closeModal();
            this.renderBudgets();
            this.renderDashboard();
            window.TadbeerUI.showToast(budgetId ? 'تم تعديل الميزانية بنجاح ✓' : 'تم حفظ الميزانية بنجاح ✓', 'success');
        } catch (e) {
            console.error('خطأ في حفظ الميزانية:', e);
            window.TadbeerUI.showToast('خطأ: ' + e.message, 'error');
        }
    };
})();
