(function () {
    'use strict';

    const app = window.TadbeerApp;

    function latestProductPrice(productId, targetCurrency) {
        const history = (app.getActiveProductPriceHistory
            ? app.getActiveProductPriceHistory(productId)
            : (app.appData.priceHistory || []).filter(item => item.productId === productId))
            .filter(item => Number(item.unitPrice || 0) > 0)
            .sort((a, b) => (window.TadbeerUtils.toDateValue(b.date) || 0) - (window.TadbeerUtils.toDateValue(a.date) || 0));
        const price = history[0];
        if (!price) return null;
        const sourceCurrency = price.currency || window.TadbeerCurrencies.state.first.code;
        const currency = targetCurrency || sourceCurrency;
        return {
            amount: Number(window.TadbeerCurrencies.toHistoricalValue(price.unitPrice, sourceCurrency, price.exchangeRate, currency)),
            sourceAmount: Number(price.unitPrice),
            sourceCurrency,
            exchangeRate: price.exchangeRate || window.TadbeerCurrencies.rateFor(sourceCurrency)
        };
    }

    function accountBalance(account, excludedTransactionId = null) {
        const currency = account?.currency || window.TadbeerCurrencies.state.first.code;
        return (app.appData.transactions || [])
            .filter(transaction => transaction.id !== excludedTransactionId && transaction.accountId === account?.id && transaction.status === 'active')
            .reduce((balance, transaction) => {
                const amount = window.TadbeerCurrencies.toCurrentValue(transaction.amount || 0, transaction.currency || currency, currency);
                if (transaction.type === 'income') return balance + amount;
                if (transaction.type === 'expense') return balance - amount;
                if (transaction.type === 'transfer') {
                    if (transaction.referenceType === 'transfer_to' || transaction.referenceType === 'currency_transfer_to') return balance + amount;
                    if (transaction.referenceType === 'transfer_from' || transaction.referenceType === 'currency_transfer_from') return balance - amount;
                }
                return balance;
            }, 0);
    }

    function normalizeSearchText(value) {
        return String(value || '')
            .normalize('NFKD')
            .replace(/[\u064B-\u065F\u0670]/g, '')
            .replace(/[إأآٱ]/g, 'ا')
            .replace(/ى/g, 'ي')
            .replace(/ؤ/g, 'و')
            .replace(/ئ/g, 'ي')
            .replace(/ة/g, 'ه')
            .replace(/\s+/g, ' ')
            .trim()
            .toLocaleLowerCase('ar');
    }

    function searchRank(name, query) {
        const normalizedName = normalizeSearchText(name);
        const normalizedQuery = normalizeSearchText(query);
        if (!normalizedQuery) return [0, 0, normalizedName];
        const start = normalizedName.indexOf(normalizedQuery);
        if (start === -1) return null;
        const wordStart = new RegExp(`(?:^|\\s)${normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
        const wordMatch = wordStart.exec(normalizedName);
        const wordIndex = wordMatch ? wordMatch.index : Number.MAX_SAFE_INTEGER;
        const startsName = start === 0 ? 0 : 1;
        const startsWord = wordMatch && wordIndex === 0 ? 0 : wordMatch ? 1 : 2;
        return [startsName, startsWord, wordMatch ? wordIndex : start, normalizedName];
    }

    function escapeSearchHtml(value) {
        return String(value || '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
    }

    app.syncPurchaseSearchSelect = function (select) {
        const wrapper = select?.closest('.purchase-search-select');
        const trigger = wrapper?.querySelector('.purchase-search-trigger');
        const option = select?.selectedOptions?.[0];
        if (trigger) trigger.textContent = option?.value ? option.textContent : (select.dataset.placeholder || 'اختر');
    };

    app.refreshPurchaseSearchOptions = function () {
        document.querySelectorAll('.purchase-search-product').forEach(wrapper => wrapper.purchaseRenderResults?.());
    };

    app.removeMultiSelectProduct = function (productId) {
        const index = (this.purchaseItems || []).findIndex(item => item?.multiSelectCreated && item.productId === productId);
        if (index === -1) return;
        const searchQuery = document.querySelector('.purchase-search-select.is-open .purchase-search-input')?.value || '';
        this.purchaseMultiSelectProducts?.delete(productId);
        this.removePurchaseItem(index);
        if (!this.purchaseMultiSelectMode) return;
        if (!(this.purchaseItems || []).some(Boolean)) this.addPurchaseItemRow();
        const wrapper = document.querySelector('.purchase-search-product');
        if (!wrapper) return;
        wrapper.classList.add('is-multi', 'is-open');
        const input = wrapper.querySelector('.purchase-search-input');
        const toggle = wrapper.querySelector('.purchase-multi-toggle');
        if (toggle) toggle.textContent = 'الخروج من التحديد';
        if (input) input.value = searchQuery;
        wrapper.purchaseRenderResults?.();
    };

    app.enhancePurchaseSearchSelect = function (select, kind) {
        if (!select || select.dataset.searchEnhanced === 'true') return;
        select.dataset.searchEnhanced = 'true';
        const wrapper = document.createElement('div');
        wrapper.className = `purchase-search-select purchase-search-${kind}`;
        select.parentNode.insertBefore(wrapper, select);
        wrapper.appendChild(select);
        select.dataset.placeholder = kind === 'product' ? 'اختر صنف' : 'اختر تاجر';
        select.classList.add('purchase-search-native');
        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'purchase-search-trigger';
        trigger.textContent = select.selectedOptions?.[0]?.value ? select.selectedOptions[0].textContent : select.dataset.placeholder;
        trigger.setAttribute('aria-haspopup', 'listbox');
        const popup = document.createElement('div');
        popup.className = 'purchase-search-popup';
        popup.innerHTML = `<div class="purchase-search-tools"><input class="purchase-search-input" type="search" placeholder="بحث عن ${kind === 'product' ? 'منتج' : 'تاجر'}..." autocomplete="off" />${kind === 'product' ? '<button type="button" class="purchase-multi-toggle">تحديد الأصناف</button>' : ''}</div><div class="purchase-search-results" role="listbox"></div>`;
        wrapper.append(trigger, popup);
        const input = popup.querySelector('.purchase-search-input');
        const multiToggle = popup.querySelector('.purchase-multi-toggle');
        const results = popup.querySelector('.purchase-search-results');
        if (kind === 'product' && this.purchaseMultiSelectMode) {
            wrapper.classList.add('is-multi');
            multiToggle.textContent = 'الخروج من التحديد';
        }
        if (!this.purchaseSearchOutsideBound) {
            document.addEventListener('click', event => {
                if (!event.target.closest('.purchase-search-select')) {
                    document.querySelectorAll('.purchase-search-select.is-open').forEach(item => item.classList.remove('is-open'));
                }
            });
            this.purchaseSearchOutsideBound = true;
        }
        const getUsedProductIds = () => {
            if (kind !== 'product') return new Set();
            return new Set([...document.querySelectorAll('.pi-name')]
                .filter(item => item !== select && item.value)
                .map(item => item.value));
        };
        const renderResults = query => {
            const usedProductIds = getUsedProductIds();
            const selectedProductIds = this.purchaseMultiSelectProducts || new Set();
            const entries = [...select.options]
                .filter(option => option.value)
                .map(option => ({ value: option.value, label: option.textContent, rank: searchRank(option.textContent, query), used: usedProductIds.has(option.value), selected: selectedProductIds.has(option.value) }))
                .filter(entry => !query || entry.rank)
                .sort((a, b) => {
                    if (!query) return a.label.localeCompare(b.label, 'ar');
                    for (let index = 0; index < a.rank.length - 1; index += 1) {
                        if (a.rank[index] !== b.rank[index]) return a.rank[index] - b.rank[index];
                    }
                    return a.label.localeCompare(b.label, 'ar');
                });
            const emptyMessage = kind === 'product' ? 'لا توجد منتجات مطابقة' : 'لا يوجد تجار مطابقون';
                results.innerHTML = entries.length ? entries.map(entry => {
                    const isMulti = kind === 'product' && wrapper.classList.contains('is-multi');
                    const disabled = entry.used && !entry.selected;
                    const status = isMulti && entry.selected ? '<small class="purchase-selected-mark">✓</small>' : entry.used ? '<small>مضاف بالفعل</small>' : '';
                    return `<button type="button" class="purchase-search-result${entry.used && !entry.selected ? ' is-added' : ''}${isMulti && entry.selected ? ' is-selected' : ''}" data-value="${escapeSearchHtml(entry.value)}"${disabled ? ' disabled aria-disabled="true"' : ''}><span>${escapeSearchHtml(entry.label)}</span>${status}</button>`;
                }).join('') : `<div class="purchase-search-empty">${emptyMessage}</div>`;
        };
            wrapper.purchaseRenderResults = () => renderResults(input.value);
        trigger.addEventListener('click', () => {
            document.querySelectorAll('.purchase-search-select.is-open').forEach(item => item !== wrapper && item.classList.remove('is-open'));
            wrapper.classList.toggle('is-open');
            if (wrapper.classList.contains('is-open')) {
                input.value = '';
                renderResults('');
                input.focus();
            }
        });
        input.addEventListener('input', () => renderResults(input.value));
        multiToggle?.addEventListener('click', () => {
            wrapper.classList.toggle('is-multi');
            this.purchaseMultiSelectMode = wrapper.classList.contains('is-multi');
            multiToggle.textContent = this.purchaseMultiSelectMode ? 'الخروج من التحديد' : 'تحديد الأصناف';
            renderResults(input.value);
            input.focus();
        });
        results.addEventListener('click', event => {
            event.stopPropagation();
            const result = event.target.closest('.purchase-search-result');
            if (!result || result.disabled) return;
            if (kind === 'product' && wrapper.classList.contains('is-multi')) {
                const productId = result.dataset.value;
                this.purchaseMultiSelectProducts ||= new Set();
                if (this.purchaseMultiSelectProducts.has(productId)) {
                    this.purchaseMultiSelectProducts.delete(productId);
                    this.removeMultiSelectProduct(productId);
                } else {
                    this.purchaseMultiSelectProducts.add(productId);
                    const emptyIndex = (this.purchaseItems || []).findIndex(item => item && !item.productId);
                    const index = emptyIndex === -1 ? this.purchaseItems.length : emptyIndex;
                    if (emptyIndex === -1) this.addPurchaseItemRow({ productId: '', categoryId: null, categoryNameSnapshot: '', quantity: 1, unitPrice: 0, total: 0 });
                    const item = this.purchaseItems[index];
                    if (item) item.multiSelectCreated = true;
                    const row = document.getElementById(`purItemRow_${index}`);
                    const rowSelect = row?.querySelector('.pi-name');
                    if (rowSelect) rowSelect.value = productId;
                    this.selectPurchaseProduct(index, productId);
                }
                renderResults(input.value);
                return;
            }
            if (kind === 'product' && getUsedProductIds().has(result.dataset.value)) return;
            select.value = result.dataset.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            this.syncPurchaseSearchSelect(select);
            wrapper.classList.remove('is-open');
            this.refreshPurchaseSearchOptions();
        });
        renderResults('');
    };

    app.renderPurchases = function () {
        const search = (document.getElementById('purchaseSearch')?.value || '').toLowerCase();
        const filtered = (this.appData.purchases || []).filter(p => {
            const merchant = (this.appData.merchants || []).find(m => m.id === p.merchantId);
            return !search || (merchant && merchant.name.toLowerCase().includes(search));
        }).sort((a, b) => {
            const merchantA = (this.appData.merchants || []).find(m => m.id === a.merchantId);
            const merchantB = (this.appData.merchants || []).find(m => m.id === b.merchantId);
            return (merchantA?.name || '').localeCompare(merchantB?.name || '', 'ar');
        });
        const list = document.getElementById('purchasesList');
        list.innerHTML = filtered.length ? filtered.map(p => {
            const merchant = (this.appData.merchants || []).find(m => m.id === p.merchantId);
            const date = window.TadbeerUtils.toDateValue(p.date);
            const items = this.appData.purchaseItems[p.id] || [];
            const displayMode = window.TadbeerCurrencies.mode('purchases');
            const purchaseTotal = p.total ?? p.amount ?? 0;
            const displayTotal = window.TadbeerCurrencies.format(
                window.TadbeerCurrencies.toCurrentValue(purchaseTotal, p.currency || window.TadbeerCurrencies.state.first.code),
                window.TadbeerCurrencies.state.first.code,
                displayMode
            );
            return `
                <div class="card" style="cursor:pointer;" onclick="window.TadbeerApp.viewPurchase('${p.id}')">
                    <div class="flex-between">
                        <div><strong>${merchant ? merchant.name : 'تاجر غير معروف'}</strong>${p.editCount ? ' ✎' : ''}</div>
                        <div class="font-bold ${p.status === 'cancelled' ? 'text-gray' : 'text-red'}">${displayTotal}</div>
                    </div>
                    <div class="text-sm text-gray">${date ? date.toLocaleDateString('en-GB') : '-'} • ${window.TadbeerUtils.formatNumber(items.length)} صنف • ${p.status === 'cancelled' ? 'ملغاة' : p.editCount ? 'معدلة' : 'نشطة'}${p.createdByName ? ` • ${p.createdByName}` : ''}</div>
                </div>
            `;
        }).join('') : window.TadbeerUI.emptyState('لا توجد فواتير شراء');
    };

    app.viewPurchase = function (purchaseId) {
        const purchase = (this.appData.purchases || []).find(p => p.id === purchaseId);
        if (!purchase) return;
        const merchant = (this.appData.merchants || []).find(m => m.id === purchase.merchantId);
        const items = this.appData.purchaseItems[purchaseId] || [];
        const itemsHtml = items.length ? `<div class="table-wrap"><table class="purchase-details-table"><thead><tr><th>#</th><th>الصنف</th><th>الفئة</th><th>سعر الوحدة</th><th>الكمية</th><th>الإجمالي</th></tr></thead><tbody>${items.map((item, index) => {
            const product = (this.appData.products || []).find(p => p.id === item.productId);
            const name = product ? product.name : item.productNameSnapshot || 'منتج';
            const categoryName = item.categoryNameSnapshot || ((this.appData.categories || []).find(c => c.id === item.categoryId)?.name) || 'غير مضاف إلى فئة';
            const currency = item.currency || purchase.currency || window.TadbeerCurrencies.state.first.code;
            return `<tr><td>${index + 1}</td><td>${name}</td><td>${categoryName}</td><td>${window.TadbeerCurrencies.format(item.unitPrice || 0, currency)}</td><td>${window.TadbeerUtils.formatNumber(item.quantity || 0)}</td><td>${window.TadbeerCurrencies.format(item.total || 0, currency)}</td></tr>`;
        }).join('')}</tbody></table></div>` : '<p class="text-gray text-sm">لا توجد أصناف</p>';
        const html = `
            <div class="modal-header"><h3 class="modal-title">فاتورة شراء</h3><button class="modal-close" onclick="window.TadbeerUI.closeModal()">✕</button></div>
            <div style="margin-bottom:12px;">
                <div class="flex-between"><span>التاجر:</span><strong>${merchant ? merchant.name : 'غير معروف'}</strong></div>
                <div class="flex-between"><span>التاريخ:</span><strong>${window.TadbeerUtils.normalizeDateString(purchase.date)}</strong></div>
                <div class="flex-between"><span>الإجمالي:</span><strong>${window.TadbeerCurrencies.format(purchase.total ?? purchase.amount ?? 0, purchase.currency || window.TadbeerCurrencies.state.first.code)}</strong></div>
                <div class="flex-between"><span>الحالة:</span><strong class="${purchase.status === 'cancelled' ? 'text-red' : 'text-green'}">${purchase.status === 'cancelled' ? 'ملغاة' : purchase.editCount ? 'معدلة' : 'نشطة'}</strong></div>
                ${purchase.createdByName ? `<div class="flex-between"><span>أنشأها:</span><strong>${purchase.createdByName}</strong></div>` : ''}
            </div>
            <div style="border-top:1px solid var(--border);padding-top:8px;">
                <strong>الأصناف:</strong>
                ${itemsHtml}
            </div>
            <div class="btn-group mt-4 purchase-actions">
                ${purchase.status === 'active' ? `<button class="btn btn-outline" onclick="window.TadbeerApp.openPurchaseEditModal('${purchase.id}')">تعديل</button><button class="btn btn-danger" onclick="window.TadbeerApp.cancelPurchase('${purchase.id}')">إلغاء العملية</button>` : ''}
                ${purchase.editCount ? `<button class="btn btn-outline" onclick="window.TadbeerApp.showPurchaseEditHistory('${purchase.id}')">سجل التعديلات</button>` : ''}
            </div>
        `;
        window.TadbeerUI.openModalHtml(html);
    };

    function purchaseSnapshot(purchase, items) {
        return {
            merchantId: purchase.merchantId || null,
            date: purchase.date || null,
            currency: purchase.currency || window.TadbeerCurrencies.state.first.code,
            accountId: purchase.accountId || null,
            total: Number(purchase.total ?? purchase.amount ?? 0),
            notes: purchase.notes || '',
            items: (items || []).map(item => ({
                productId: item.productId || null,
                productNameSnapshot: item.productNameSnapshot || '',
                categoryId: item.categoryId || null,
                categoryNameSnapshot: item.categoryNameSnapshot || '',
                quantity: Number(item.quantity || 0),
                unit: item.unit || '',
                unitPrice: Number(item.unitPrice || 0),
                total: Number(item.total || 0),
                currency: item.currency || purchase.currency || window.TadbeerCurrencies.state.first.code
            }))
        };
    }

    function snapshotKey(snapshot) {
        return JSON.stringify(snapshot, (key, value) => value instanceof Date ? value.toISOString() : value);
    }

    function changedFields(before, after) {
        const changes = [];
        ['merchantId', 'date', 'currency', 'accountId', 'total', 'notes', 'items'].forEach(field => {
            const oldValue = JSON.stringify(before[field], (key, value) => value instanceof Date ? value.toISOString() : value);
            const newValue = JSON.stringify(after[field], (key, value) => value instanceof Date ? value.toISOString() : value);
            if (oldValue !== newValue) changes.push({ field, before: before[field], after: after[field] });
        });
        return changes;
    }

    app.openPurchaseEditModal = function (purchaseId) {
        const purchase = (this.appData.purchases || []).find(p => p.id === purchaseId);
        if (!purchase || purchase.status !== 'active') return;
        const items = this.appData.purchaseItems[purchaseId] || [];
        this.purchaseEditId = purchaseId;
        this.purchaseMultiSelectMode = false;
        this.purchaseMultiSelectProducts = new Set();
        this.purchaseItems = items.map(item => ({ ...item, quantity: Number(item.quantity || 0), unitPrice: Number(item.unitPrice || 0), total: Number(item.total || 0) }));
        const merchants = [...(this.appData.merchants || [])].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
        const accounts = this.appData.accounts || [];
        const html = `
            <div class="modal-header"><h3 class="modal-title">تعديل فاتورة الشراء</h3><button class="modal-close" onclick="window.TadbeerUI.closeModal()">✕</button></div>
            <div class="form-group"><label class="required">التاجر</label><select id="purMerchant" required>${merchants.map(m => `<option value="${m.id}" ${m.id === purchase.merchantId ? 'selected' : ''}>${m.name}</option>`).join('')}</select></div>
            <div class="form-row"><div class="form-group"><label class="required">مصدر المال</label><select id="purAccount" required><option value="">اختر الحساب</option>${accounts.map(a => `<option value="${a.id}" ${a.id === purchase.accountId ? 'selected' : ''}>${a.name} (${a.currency || '-'})</option>`).join('')} </select><div id="purAccountBalance" class="text-sm text-gray"></div></div><div class="form-group"><label>التاريخ</label><input type="date" id="purDate" value="${window.TadbeerUtils.formatDateInput(window.TadbeerUtils.toDateValue(purchase.date) || new Date())}" /></div></div>
            <div class="form-group"><label>ملاحظات</label><input type="text" id="purNotes" value="${(purchase.notes || '').replace(/"/g, '&quot;')}" /></div>
            <div class="flex-between"><strong>الأصناف</strong></div><div class="table-wrap purchase-entry-table"><table><thead><tr><th>#</th><th>الصنف</th><th>الفئة</th><th>السعر</th><th>الكمية</th><th>الإجمالي</th><th></th></tr></thead><tbody id="purchaseItemsContainer"></tbody><tfoot><tr class="purchase-total-row"><th colspan="5">الإجمالي الكلي للفاتورة</th><th id="purTotalDisplay">0</th><th></th></tr></tfoot></table><button class="btn btn-sm btn-outline purchase-add-item-btn" onclick="window.TadbeerApp.addPurchaseItemRow()">+ صنف</button></div>
            <button class="btn btn-primary btn-block mt-4" onclick="window.TadbeerApp.savePurchaseEdit()">حفظ التعديل</button>
        `;
        window.TadbeerUI.openModalHtml(html);
        this.enhancePurchaseSearchSelect(document.getElementById('purMerchant'), 'merchant');
        this.bindPurchaseAccount();
        const initialItems = this.purchaseItems.slice();
        this.purchaseItems = [];
        initialItems.forEach(item => {
            this.addPurchaseItemRow(item);
            const index = this.purchaseItems.length - 1;
            const row = document.getElementById(`purItemRow_${index}`);
            if (row) {
                row.querySelector('.pi-name').value = item.productId || '';
                this.syncPurchaseSearchSelect(row.querySelector('.pi-name'));
                row.querySelector('.pi-qty').value = item.quantity;
                row.querySelector('.pi-price').value = window.TadbeerCurrencies.formatNumber(item.unitPrice);
            }
        });
        this.updatePurchaseTotal();
    };

    app.showPurchaseEditHistory = async function (purchaseId) {
        const snapshot = await window.db.collection('purchases').doc(purchaseId).collection('editHistory').get();
        const history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => (window.TadbeerUtils.toDateValue(b.editedAt) || 0) - (window.TadbeerUtils.toDateValue(a.editedAt) || 0));
        const fieldNames = { merchantId: 'التاجر', date: 'التاريخ', currency: 'العملة', accountId: 'الحساب', total: 'الإجمالي', notes: 'الملاحظات', items: 'الأصناف' };
        const displayValue = (field, value) => field === 'items'
            ? `${window.TadbeerUtils.formatNumber((value || []).length)} صنف / ${window.TadbeerCurrencies.format((value || []).reduce((sum, item) => sum + window.TadbeerCurrencies.toHistoricalValue(item.total || 0, item.currency || window.TadbeerCurrencies.state.first.code, item.exchangeRate), 0), window.TadbeerCurrencies.state.first.code, 'first')}`
            : value === null || value === undefined || value === '' ? '-'
                : typeof value === 'number' ? window.TadbeerUtils.formatNumber(value) : String(value);
        const rows = history.length ? history.map(entry => `<div class="card"><strong>${window.TadbeerUtils.normalizeDateString(entry.editedAt)}</strong><div class="text-sm text-gray mt-4">${entry.changes.map(change => `<div><strong>${fieldNames[change.field] || change.field}</strong>: ${displayValue(change.field, change.before)} ← ${displayValue(change.field, change.after)}</div>`).join('')}</div></div>`).join('') : '<p class="text-gray">لا توجد تعديلات</p>';
        window.TadbeerUI.openModalHtml(`<div class="modal-header"><h3 class="modal-title">سجل التعديلات</h3><button class="modal-close" onclick="window.TadbeerUI.closeModal()">✕</button></div>${rows}`);
    };

    app.savePurchaseEdit = async function () {
        const purchaseId = this.purchaseEditId;
        const purchase = (this.appData.purchases || []).find(p => p.id === purchaseId);
        if (!purchase) return;
        const validItems = (this.purchaseItems || []).filter(Boolean).filter(item => item.productId && Number(item.unitPrice || 0) > 0 && Number(item.quantity || 0) > 0);
        if (!validItems.length) return window.TadbeerUI.showToast('يجب أن تحتوي الفاتورة على صنف واحد على الأقل', 'error');
        const products = this.appData.products || [];
        const missingCategory = validItems.map(item => products.find(product => product.id === item.productId)).filter(product => !product || !product.categoryId || !(this.appData.categories || []).some(category => category.id === product.categoryId));
        if (missingCategory.length) return window.TadbeerUI.showToast(`لا يمكن حفظ التعديل. الأصناف غير المرتبطة بفئة:\n${[...new Set(missingCategory.map(product => product ? product.name : 'صنف غير معروف'))].map(name => `- ${name}`).join('\n')}`, 'error');
        const accountId = document.getElementById('purAccount').value;
        const account = (this.appData.accounts || []).find(item => item.id === accountId);
        if (!accountId || !account) return window.TadbeerUI.showToast('اختر مصدر المال', 'error');
        const currency = account.currency || window.TadbeerCurrencies.state.first.code;
        const transaction = (this.appData.transactions || []).find(t => t.referenceType === 'purchase' && t.referenceId === purchaseId);
        const balance = accountBalance(account, transaction?.id);
        const nextTotal = validItems.reduce((sum, item) => sum + Number(item.total || 0), 0);
        if (balance < nextTotal) return window.TadbeerUI.showToast(`لا يمكن حفظ التعديل: إجمالي الفاتورة ${window.TadbeerCurrencies.format(nextTotal, currency)}، بينما الرصيد المتوفر في الحساب المحدد ${window.TadbeerCurrencies.format(balance, currency)}.`, 'error');
        const updated = { ...purchase, merchantId: document.getElementById('purMerchant').value, date: new Date(document.getElementById('purDate').value || Date.now()), currency, accountId: document.getElementById('purAccount').value || null, notes: document.getElementById('purNotes').value || '', total: validItems.reduce((sum, item) => sum + Number(item.total || 0), 0), exchangeRate: window.TadbeerCurrencies.rateFor(currency) };
        updated.baseAmount = window.TadbeerCurrencies.toBase(updated.total, currency, updated.exchangeRate);
        const afterItems = validItems.map(item => { const product = products.find(p => p.id === item.productId); const category = (this.appData.categories || []).find(c => c.id === product.categoryId); return { productId: item.productId, productNameSnapshot: product.name, categoryId: product.categoryId, categoryNameSnapshot: category.name, merchantId: updated.merchantId, quantity: Number(item.quantity), unit: product.unit || '', unitPrice: Number(item.unitPrice), total: Number(item.total), currency, exchangeRate: updated.exchangeRate, createdAt: item.createdAt || new Date() }; });
        const before = purchaseSnapshot(purchase, this.appData.purchaseItems[purchaseId]);
        const after = purchaseSnapshot(updated, afterItems);
        const changes = changedFields(before, after);
        if (!changes.length || snapshotKey(before) === snapshotKey(after)) return window.TadbeerUI.showToast('لم يطرأ أي تغيير على الفاتورة', 'error');
        const batch = window.db.batch();
        batch.update(window.db.collection('purchases').doc(purchaseId), { merchantId: updated.merchantId, date: updated.date, currency, accountId: updated.accountId, notes: updated.notes, total: updated.total, exchangeRate: updated.exchangeRate, baseAmount: updated.baseAmount, editCount: Number(purchase.editCount || 0) + 1, editedAt: new Date(), updatedAt: new Date() });
        (this.appData.purchaseItems[purchaseId] || []).forEach(item => batch.delete(window.db.collection('purchases').doc(purchaseId).collection('items').doc(item.id)));
        afterItems.forEach(item => batch.set(window.db.collection('purchases').doc(purchaseId).collection('items').doc(), item));
        if (transaction) batch.update(window.db.collection('transactions').doc(transaction.id), { amount: updated.total, date: updated.date, currency, exchangeRate: updated.exchangeRate, baseAmount: updated.baseAmount, accountId: updated.accountId, updatedAt: new Date() });
        batch.set(window.db.collection('purchases').doc(purchaseId).collection('editHistory').doc(), { editedAt: new Date(), before, after, changes });
        await batch.commit();
        Object.assign(purchase, { ...updated, editCount: Number(purchase.editCount || 0) + 1, editedAt: new Date() });
        this.appData.purchaseItems[purchaseId] = afterItems;
        if (transaction) Object.assign(transaction, { amount: updated.total, date: updated.date, currency, accountId: updated.accountId });
        this.purchaseEditId = null;
        window.TadbeerUI.closeModal();
        this.renderPurchases();
        window.TadbeerUI.showToast('تم تعديل الفاتورة وتسجيل التغيير ✓', 'success');
    };

    app.cancelPurchase = async function (purchaseId) {
        if (!confirm('هل أنت متأكد من إلغاء هذه الفاتورة؟ سيتم إلغاء العملية المالية المرتبطة بها.')) return;
        const txn = (this.appData.transactions || []).find(t => t.referenceType === 'purchase' && t.referenceId === purchaseId);
        const batch = window.db.batch();
        const update = { status: 'cancelled', updatedAt: new Date() };
        batch.update(window.db.collection('purchases').doc(purchaseId), update);
        if (txn) batch.update(window.db.collection('transactions').doc(txn.id), update);
        await batch.commit();
        window.TadbeerUI.closeModal();
        await this.refreshData();
        window.TadbeerUI.showToast('تم إلغاء الفاتورة', 'success');
    };

    app.openPurchaseModal = function () {
        this.purchaseItems = [];
        this.purchaseMultiSelectMode = false;
        this.purchaseMultiSelectProducts = new Set();
        const merchants = this.appData.merchants || [];
        const accounts = this.appData.accounts || [];

        if (merchants.length === 0) {
            window.TadbeerUI.showToast('أضف تاجراً أولاً قبل إضافة فاتورة', 'error');
            return;
        }

        const html = `
            <div class="modal-header"><h3 class="modal-title">فاتورة شراء</h3><button class="modal-close" onclick="window.TadbeerUI.closeModal()">✕</button></div>
            <div class="form-group"><label class="required">التاجر</label><select id="purMerchant">${merchants.map(m => `<option value="${m.id}">${m.name}</option>`).join('')}</select></div>
            <div class="form-row"><div class="form-group"><label class="required">مصدر المال</label><select id="purAccount" required><option value="">اختر الحساب</option>${accounts.map(a => `<option value="${a.id}">${a.name} (${a.currency || '-'})</option>`).join('')}</select><div id="purAccountBalance" class="text-sm text-gray"></div></div><div class="form-group"><label>التاريخ</label><input type="date" id="purDate" value="${window.TadbeerUtils.formatDateInput(new Date())}" /></div></div>
            <div class="form-group"><label>ملاحظات</label><input type="text" id="purNotes" placeholder="اختياري" /></div>
            <hr style="border:none;border-top:1px solid var(--border);margin:12px 0;">
            <div class="flex-between"><strong>الأصناف</strong></div>
            <div class="table-wrap purchase-entry-table"><table><thead><tr><th>#</th><th>الصنف</th><th>الفئة</th><th>السعر</th><th>الكمية</th><th>الإجمالي</th><th></th></tr></thead><tbody id="purchaseItemsContainer"></tbody><tfoot><tr class="purchase-total-row"><th colspan="5">الإجمالي الكلي للفاتورة</th><th id="purTotalDisplay">0</th><th></th></tr></tfoot></table><button class="btn btn-sm btn-outline purchase-add-item-btn" onclick="window.TadbeerApp.addPurchaseItemRow()">+ صنف</button></div>
            <button class="btn btn-primary btn-block mt-4" onclick="window.TadbeerApp.savePurchase()">حفظ الفاتورة</button>
        `;
        window.TadbeerUI.openModalHtml(html);
        this.enhancePurchaseSearchSelect(document.getElementById('purMerchant'), 'merchant');
        this.bindPurchaseAccount();
        this.addPurchaseItemRow();
        setTimeout(() => this.refreshData(), 1000);
    };

    app.addPurchaseItemRow = function (item = null) {
        const rowItem = item ? { ...item } : { productId: '', categoryId: null, categoryNameSnapshot: '', quantity: 1, unitPrice: 0, total: 0 };
        if (rowItem.productId && rowItem.priceSourceAmount === undefined) {
            const currentAccount = (this.appData.accounts || []).find(entry => entry.id === document.getElementById('purAccount')?.value);
            rowItem.priceSourceAmount = Number(rowItem.unitPrice || 0);
            rowItem.priceSourceCurrency = rowItem.currency || currentAccount?.currency || window.TadbeerCurrencies.state.first.code;
            rowItem.priceSourceExchangeRate = rowItem.exchangeRate || window.TadbeerCurrencies.rateFor(rowItem.priceSourceCurrency);
        }
        const productOptions = [...(this.appData.products || [])].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar')).map(p => {
            const category = (this.appData.categories || []).find(c => c.id === p.categoryId);
            if (!p.categoryId || !category) return '';
            return `<option value="${p.id}" ${rowItem.productId === p.id ? 'selected' : ''} data-category-id="${p.categoryId || ''}" data-category-name="${(category ? category.name : 'غير مضاف إلى فئة').replace(/"/g, '&quot;')}">${p.name}</option>`;
        }).join('');
        const idx = this.purchaseItems.length;
        this.purchaseItems.push(rowItem);
        const row = document.createElement('tr');
        row.className = 'purchase-item-row';
        row.id = `purItemRow_${idx}`;
        row.innerHTML = `
            <td>${idx + 1}</td>
            <td><select class="pi-name" required onchange="window.TadbeerApp.selectPurchaseProduct(${idx}, this.value)"><option value="">اختر صنف</option>${productOptions}</select></td>
            <td class="pi-category">${rowItem.categoryNameSnapshot || '-'}</td>
            <td><input type="number" class="pi-price" placeholder="السعر" step="any" value="${window.TadbeerCurrencies.formatNumber(rowItem.unitPrice)}" oninput="window.TadbeerApp.updatePurchaseItemInput(${idx}, 'price', this.value)" /></td>
            <td><input type="number" class="pi-qty" placeholder="الكمية" value="${rowItem.quantity || ''}" oninput="window.TadbeerApp.updatePurchaseItemInput(${idx}, 'quantity', this.value)" /></td>
            <td class="pi-total">${rowItem.total ? window.TadbeerCurrencies.format(rowItem.total, (this.appData.accounts || []).find(account => account.id === document.getElementById('purAccount')?.value)?.currency || window.TadbeerCurrencies.state.first.code) : ''}</td>
            <td><span class="pi-remove" onclick="window.TadbeerApp.removePurchaseItem(${idx})">✕</span></td>
        `;
        document.getElementById('purchaseItemsContainer').appendChild(row);
        this.enhancePurchaseSearchSelect(row.querySelector('.pi-name'), 'product');
        this.refreshPurchaseSearchOptions();
        this.updatePurchaseTotal();
    };

    app.updatePurchaseRowTotal = function (idx) {
        const item = this.purchaseItems[idx];
        const row = document.getElementById(`purItemRow_${idx}`);
        const account = (this.appData.accounts || []).find(entry => entry.id === document.getElementById('purAccount')?.value);
        if (row && item) row.querySelector('.pi-total').textContent = item.total ? window.TadbeerCurrencies.format(item.total, account?.currency || window.TadbeerCurrencies.state.first.code) : '';
        this.updatePurchaseTotal();
    };

    app.selectPurchaseProduct = function (idx, productId) {
        const item = this.purchaseItems[idx];
        const product = (this.appData.products || []).find(entry => entry.id === productId);
        if (!item || !product) return;
        const previousProductId = item.productId;
        const duplicate = (this.purchaseItems || []).some((entry, entryIndex) => entryIndex !== idx && entry?.productId === productId);
        if (duplicate) {
            const row = document.getElementById(`purItemRow_${idx}`);
            if (row) {
                const select = row.querySelector('.pi-name');
                select.value = item.productId || '';
                this.syncPurchaseSearchSelect(select);
            }
            this.refreshPurchaseSearchOptions();
            window.TadbeerUI.showToast('هذا المنتج مضاف بالفعل إلى الفاتورة', 'warning');
            return;
        }
        const category = product.categoryId ? (this.appData.categories || []).find(entry => entry.id === product.categoryId) : null;
        const account = (this.appData.accounts || []).find(entry => entry.id === document.getElementById('purAccount')?.value);
        const price = latestProductPrice(productId, account?.currency);
        const targetCurrency = account?.currency || window.TadbeerCurrencies.state.first.code;
        item.productId = productId;
        if (item.multiSelectCreated) {
            this.purchaseMultiSelectProducts ||= new Set();
            if (previousProductId && previousProductId !== productId) this.purchaseMultiSelectProducts.delete(previousProductId);
            this.purchaseMultiSelectProducts.add(productId);
        }
        item.categoryId = product.categoryId || null;
        item.categoryNameSnapshot = category ? category.name : 'غير مضاف إلى فئة';
        item.priceSourceAmount = price ? price.sourceAmount : 0;
        item.priceSourceCurrency = price ? price.sourceCurrency : targetCurrency;
        item.priceSourceExchangeRate = price ? price.exchangeRate : window.TadbeerCurrencies.rateFor(targetCurrency);
        item.unitPrice = price ? price.amount : 0;
        item.total = item.unitPrice * Number(item.quantity || 0);
        const row = document.getElementById(`purItemRow_${idx}`);
        if (row) {
            this.syncPurchaseSearchSelect(row.querySelector('.pi-name'));
            row.querySelector('.pi-category').textContent = item.categoryNameSnapshot;
            row.querySelector('.pi-price').value = window.TadbeerCurrencies.formatNumber(item.unitPrice);
        }
        this.refreshPurchaseSearchOptions();
        this.updatePurchaseRowTotal(idx);
    };

    app.removePurchaseItem = function (idx) {
        const item = this.purchaseItems[idx];
        if (item?.multiSelectCreated && item.productId) this.purchaseMultiSelectProducts?.delete(item.productId);
        if (this.purchaseEditId) this.purchaseItems[idx] = null;
        else this.purchaseItems.splice(idx, 1);
        this.renderPurchaseItemRows();
    };

    app.renderPurchaseItemRows = function () {
        const container = document.getElementById('purchaseItemsContainer');
        if (!container) return;
        const items = (this.purchaseItems || []).filter(Boolean).map(item => ({ ...item }));
        this.purchaseItems = [];
        container.innerHTML = '';
        items.forEach(item => this.addPurchaseItemRow(item));
        this.refreshPurchaseSearchOptions();
    };

    app.updatePurchaseTotal = function () {
        const total = (this.purchaseItems || []).filter(Boolean).reduce((sum, item) => sum + (Number(item.total) || 0), 0);
        const display = document.getElementById('purTotalDisplay');
        const account = (this.appData.accounts || []).find(item => item.id === document.getElementById('purAccount')?.value);
        if (display) display.textContent = window.TadbeerCurrencies.format(total, account?.currency || window.TadbeerCurrencies.state.first.code);
    };

    app.updatePurchaseAccountSummary = function () {
        const account = (this.appData.accounts || []).find(item => item.id === document.getElementById('purAccount')?.value);
        const display = document.getElementById('purAccountBalance');
        if (!display) return;
        if (!account) {
            display.textContent = '';
            return;
        }
        display.textContent = `الرصيد المتوفر: ${window.TadbeerCurrencies.formatBalance(accountBalance(account), account.currency || window.TadbeerCurrencies.state.first.code)}`;
    };

    app.refreshPurchaseCurrency = function () {
        const account = (this.appData.accounts || []).find(item => item.id === document.getElementById('purAccount')?.value);
        const currency = account?.currency || window.TadbeerCurrencies.state.first.code;
        (this.purchaseItems || []).forEach((item, index) => {
            if (!item || !item.productId) return;
            const sourceCurrency = item.priceSourceCurrency || item.currency || currency;
            const sourceAmount = Number(item.priceSourceAmount ?? item.unitPrice ?? 0);
            item.priceSourceAmount = sourceAmount;
            item.priceSourceCurrency = sourceCurrency;
            item.priceSourceExchangeRate = item.priceSourceExchangeRate || item.exchangeRate || window.TadbeerCurrencies.rateFor(sourceCurrency);
            item.unitPrice = Number(window.TadbeerCurrencies.toHistoricalValue(sourceAmount, sourceCurrency, item.priceSourceExchangeRate, currency));
            item.total = item.unitPrice * Number(item.quantity || 0);
            const row = document.getElementById(`purItemRow_${index}`);
            if (row) {
                row.querySelector('.pi-price').value = window.TadbeerCurrencies.formatNumber(item.unitPrice);
                row.querySelector('.pi-total').textContent = item.total ? window.TadbeerCurrencies.format(item.total, currency) : '';
            }
        });
        this.updatePurchaseTotal();
        this.updatePurchaseAccountSummary();
    };

    app.updatePurchaseItemInput = function (idx, field, value) {
        const item = this.purchaseItems[idx];
        if (!item) return;
        const account = (this.appData.accounts || []).find(entry => entry.id === document.getElementById('purAccount')?.value);
        const currency = account?.currency || window.TadbeerCurrencies.state.first.code;
        const numericValue = Number(value || 0);
        if (field === 'price') {
            item.priceSourceAmount = numericValue;
            item.priceSourceCurrency = currency;
            item.priceSourceExchangeRate = window.TadbeerCurrencies.rateFor(currency);
            item.unitPrice = numericValue;
        } else if (field === 'quantity') {
            item.quantity = numericValue;
        }
        item.total = Number(item.unitPrice || 0) * Number(item.quantity || 0);
        this.updatePurchaseRowTotal(idx);
    };

    app.bindPurchaseAccount = function () {
        const accountSelect = document.getElementById('purAccount');
        if (!accountSelect || accountSelect.dataset.currencyBound === 'true') return;
        accountSelect.dataset.currencyBound = 'true';
        accountSelect.addEventListener('change', () => this.refreshPurchaseCurrency());
        this.refreshPurchaseCurrency();
    };

    app.savePurchase = async function () {
        const validItems = (this.purchaseItems || []).filter(Boolean).filter(item => item.productId && Number(item.unitPrice || 0) > 0 && Number(item.quantity || 0) > 0);
        if (!document.getElementById('purMerchant').value) return window.TadbeerUI.showToast('اختر التاجر', 'error');
        const accountId = document.getElementById('purAccount').value;
        const account = (this.appData.accounts || []).find(item => item.id === accountId);
        if (!accountId || !account) return window.TadbeerUI.showToast('اختر مصدر المال', 'error');
        if (!validItems.length) return window.TadbeerUI.showToast('أضف صنفًا واحدًا على الأقل بسعر صحيح', 'error');
        const unassignedNames = validItems.map(item => (this.appData.products || []).find(p => p.id === item.productId)).filter(product => {
            if (!product || !product.categoryId) return true;
            return !(this.appData.categories || []).some(category => category.id === product.categoryId);
        }).map(product => product ? product.name : 'صنف غير معروف');
        if (unassignedNames.length) {
            const names = [...new Set(unassignedNames)].map(name => `- ${name}`).join('\n');
            return window.TadbeerUI.showToast(`لا يمكن حفظ فاتورة الشراء. الأصناف التالية غير مضافة إلى فئة:\n${names}\nيرجى إضافة هذه الأصناف إلى فئة ثم إعادة المحاولة.`, 'error');
        }
        const merchantId = document.getElementById('purMerchant').value;
        const date = new Date(document.getElementById('purDate').value || Date.now());
        const currency = account.currency || window.TadbeerCurrencies.state.first.code;
        const total = validItems.reduce((sum, item) => sum + Number(item.total || 0), 0);
        const balance = accountBalance(account);
        if (balance < total) return window.TadbeerUI.showToast(`لا يمكن حفظ الفاتورة: إجمالي الفاتورة ${window.TadbeerCurrencies.format(total, currency)}، بينما الرصيد المتوفر في الحساب المحدد ${window.TadbeerCurrencies.format(balance, currency)}.`, 'error');
        const exchangeRate = window.TadbeerCurrencies.rateFor(currency);
        const payload = {
            userId: this.currentUserId,
            ...this.getCurrentUserFields(),
            merchantId,
            date,
            currency,
            accountId,
            ...window.TadbeerCurrencies.operationFields(total, currency, exchangeRate),
            categoryId: null,
            notes: document.getElementById('purNotes').value || '',
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date()
        };
        const purchaseRef = window.db.collection('purchases').doc();
        const batch = window.db.batch();
        batch.set(purchaseRef, payload);
        for (const item of validItems) {
            const product = (this.appData.products || []).find(p => p.id === item.productId);
            const category = (this.appData.categories || []).find(c => c.id === product.categoryId);
            const itemCategoryId = product.categoryId;
            const itemCategoryName = category.name;

            batch.set(window.db.collection('purchases').doc(purchaseRef.id).collection('items').doc(), {
                productId: item.productId,
                productNameSnapshot: product ? product.name : '',
                categoryId: itemCategoryId,
                categoryNameSnapshot: itemCategoryName,
                merchantId,
                quantity: Number(item.quantity || 0),
                unit: product ? product.unit : '',
                unitPrice: Number(item.unitPrice || 0),
                total: Number(item.total || 0),
                currency,
                exchangeRate,
                createdAt: new Date()
            });
            batch.set(window.db.collection('priceHistory').doc(), {
                userId: this.currentUserId,
                productId: item.productId,
                merchantId,
                unitPrice: Number(item.unitPrice || 0),
                currency,
                exchangeRate,
                unit: product ? product.unit : '',
                quantity: Number(item.quantity || 0),
                date,
                purchaseId: purchaseRef.id,
                createdAt: new Date()
            });
        }
        batch.set(window.db.collection('transactions').doc(), {
            userId: this.currentUserId,
            type: 'expense',
            ...this.getCurrentUserFields(),
            ...window.TadbeerCurrencies.operationFields(total, currency, exchangeRate),
            date,
            categoryId: null,
            accountId: document.getElementById('purAccount').value || null,
            description: 'فاتورة شراء',
            referenceType: 'purchase',
            referenceId: purchaseRef.id,
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date()
        });
        await batch.commit();
        window.TadbeerUI.closeModal();
        await this.refreshData();
        window.TadbeerUI.showToast('تم حفظ الفاتورة', 'success');
    };
})();
