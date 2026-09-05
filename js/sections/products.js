(function () {
    'use strict';
    const app = window.TadbeerApp;

    function isCancelledPurchase(purchase) {
        const status = String(purchase?.status || '').toLowerCase();
        return status === 'cancelled' || status === 'canceled';
    }

    function activeProductPriceHistory(productId) {
        const purchases = new Map((app.appData.purchases || []).map(purchase => [purchase.id, purchase]));
        const activePurchaseItems = new Set();
        Object.entries(app.appData.purchaseItems || {}).forEach(([purchaseId, items]) => {
            const purchase = purchases.get(purchaseId);
            if (isCancelledPurchase(purchase)) return;
            (items || []).filter(item => item.productId === productId).forEach(item => activePurchaseItems.add(item.id));
        });
        return (app.appData.priceHistory || [])
            .filter(price => price.productId === productId)
            .filter(price => {
                if (!price.purchaseId) return true;
                return !isCancelledPurchase(purchases.get(price.purchaseId));
            })
            .filter(price => {
                if (price.purchaseItemId) return activePurchaseItems.has(price.purchaseItemId);
                return true;
            });
    }

    app.getActiveProductPriceHistory = activeProductPriceHistory;

    app.renderProducts = function() {
        const search = (document.getElementById('productSearch')?.value || '').toLowerCase();
        const filtered = (this.appData.products || []).filter(p => (p.name || '').toLowerCase().includes(search)).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
        const list = document.getElementById('productsList');
        list.innerHTML = filtered.length ? `<div class="list-grid">${filtered.map(p => {
            const lastPrice = this.getProductLastPrice(p.id);
            const category = (this.appData.categories || []).find(c => c.id === p.categoryId);
            const categoryLabel = category ? category.name : 'غير مضاف إلى فئة ⚠️';
            return `
                <div class="list-item-card" onclick="window.TadbeerApp.viewProduct('${p.id}')">
                    <div class="item-name">${p.name}</div>
                    <div class="item-sub">${categoryLabel} • ${p.unit || ''} ${p.size || ''}</div>
                    <div class="item-price">${lastPrice ? window.TadbeerCurrencies.format(lastPrice.unitPrice || 0, lastPrice.currency || window.TadbeerCurrencies.state.first.code, window.TadbeerCurrencies.mode()) : 'لا يوجد سعر'}</div>
                </div>
            `;
        }).join('')}</div>` : window.TadbeerUI.emptyState('لا توجد أصناف');
    };

    app.openProductModal = function(productId = null) {
        const product = productId ? (this.appData.products || []).find(p => p.id === productId) : null;
        const categories = [...(this.appData.categories || [])].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
        const selectedCategoryId = product && product.categoryId ? product.categoryId : '';
        const categoryOptions = categories.length
            ? categories.map(c => `<option value="${c.id}" ${selectedCategoryId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')
            : '<option value="">لا توجد فئات</option>';

        const html = `
            <div class="modal-header"><h3 class="modal-title">${product ? 'تعديل الصنف' : 'صنف جديد'}</h3><button class="modal-close" onclick="window.TadbeerUI.closeModal()">✕</button></div>
            <div class="form-group"><label class="required">اسم الصنف</label><input type="text" id="prodName" value="${product ? (product.name || '').replace(/"/g, '&quot;') : ''}" placeholder="مثال: زيت دوار الشمس 1 لتر" /></div>
            <div class="form-group"><label class="required">الفئة</label><select id="prodCategory" ${categories.length ? '' : 'disabled'} required>
                <option value="">اختر فئة</option>
                ${categoryOptions}
            </select></div>
            ${categories.length ? '' : '<div class="text-sm text-gray">يجب إنشاء فئة أولاً من قسم الفئات.</div>'}
            <div class="form-row">
                <div class="form-group"><label>الوحدة</label><input type="text" id="prodUnit" value="${product ? (product.unit || '').replace(/"/g, '&quot;') : ''}" placeholder="لتر، كغ، قطعة" /></div>
                <div class="form-group"><label>الحجم/العلامة</label><input type="text" id="prodSize" value="${product ? (product.size || '').replace(/"/g, '&quot;') : ''}" placeholder="1 لتر، 5 كغ" /></div>
            </div>
            <div class="form-group"><label>ملاحظات</label><textarea id="prodNotes">${product ? (product.notes || '') : ''}</textarea></div>
            <button class="btn btn-primary btn-block" onclick="window.TadbeerApp.saveProduct('${productId || ''}')">${product ? 'حفظ التعديلات' : 'حفظ الصنف'}</button>
        `;
        window.TadbeerUI.openModalHtml(html);
    };

    app.saveProduct = async function(productId = '') {
        const name = document.getElementById('prodName').value.trim();
        const categoryId = document.getElementById('prodCategory')?.value || '';
        if (!name) return window.TadbeerUI.showToast('أدخل اسم الصنف', 'error');
        if (!categoryId) return window.TadbeerUI.showToast('اختر فئة للصنف', 'error');

        try {
            const productData = {
                userId: this.currentUserId,
                name,
                categoryId,
                unit: document.getElementById('prodUnit').value || '',
                brand: '',
                size: document.getElementById('prodSize').value || '',
                notes: document.getElementById('prodNotes').value || '',
                updatedAt: new Date()
            };

            if (productId) {
                const existing = (this.appData.products || []).find(p => p.id === productId) || {};
                await window.db.collection('products').doc(productId).update({
                    ...productData,
                    createdAt: existing.createdAt || new Date()
                });

                const index = (this.appData.products || []).findIndex(p => p.id === productId);
                if (index >= 0) {
                    this.appData.products[index] = {
                        ...this.appData.products[index],
                        ...productData,
                        createdAt: existing.createdAt || new Date()
                    };
                }
                window.TadbeerUI.closeModal();
                this.renderProducts();
                window.TadbeerUI.showToast('تم تحديث الصنف بنجاح ✓', 'success');
                return;
            }

            const docRef = await window.db.collection('products').add({
                ...productData,
                status: 'active',
                createdAt: new Date()
            });

            if (!this.appData.products) this.appData.products = [];
            this.appData.products.unshift({
                id: docRef.id,
                ...productData,
                status: 'active',
                createdAt: new Date()
            });

            window.TadbeerUI.closeModal();
            this.renderProducts();
            window.TadbeerUI.showToast('تم حفظ الصنف بنجاح ✓', 'success');
        } catch (e) {
            console.error('خطأ في حفظ الصنف:', e);
            window.TadbeerUI.showToast('خطأ: ' + e.message, 'error');
        }
    };

    app.viewProduct = function(productId) {
        const product = (this.appData.products || []).find(p => p.id === productId);
        if (!product) return;
        const category = (this.appData.categories || []).find(c => c.id === product.categoryId);
            const history = this.getActiveProductPriceHistory(productId).sort((a, b) => (window.TadbeerUtils.toDateValue(b.date) || 0) - (window.TadbeerUtils.toDateValue(a.date) || 0));
        const lastPrice = history[0];
        const prices = history.map(ph => window.TadbeerCurrencies.toCurrentValue(ph.unitPrice || 0, ph.currency || window.TadbeerCurrencies.state.first.code));
        const minPrice = prices.length ? Math.min(...prices) : 0;
        const maxPrice = prices.length ? Math.max(...prices) : 0;
        const avg = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
        const change = history.length >= 2 ? ((history[0].unitPrice - history[history.length - 1].unitPrice) / Math.max(history[history.length - 1].unitPrice || 1, 1)) * 100 : 0;
        const histHtml = history.slice(0, 10).map(ph => {
            const merchant = (this.appData.merchants || []).find(m => m.id === ph.merchantId);
            return `<div class="flex-between text-sm"><span>${window.TadbeerUtils.normalizeDateString(ph.date)} • ${merchant ? merchant.name : 'تاجر'}</span><strong>${window.TadbeerCurrencies.format(ph.unitPrice || 0, ph.currency || window.TadbeerCurrencies.state.first.code, window.TadbeerCurrencies.mode(), ph.exchangeRate)}</strong></div>`;
        }).join('');
        const html = `
            <div class="modal-header"><h3 class="modal-title">${product.name}</h3><button class="modal-close" onclick="window.TadbeerUI.closeModal()">✕</button></div>
            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:12px;">
                <div class="stat-card"><div class="stat-value">${lastPrice ? window.TadbeerCurrencies.format(lastPrice.unitPrice || 0, lastPrice.currency || window.TadbeerCurrencies.state.first.code, window.TadbeerCurrencies.mode()) : '-'}</div><div class="stat-label">آخر سعر</div></div>
                <div class="stat-card"><div class="stat-value">${minPrice ? window.TadbeerCurrencies.format(minPrice, window.TadbeerCurrencies.state.first.code, window.TadbeerCurrencies.mode()) : '-'}</div><div class="stat-label">أقل سعر</div></div>
                <div class="stat-card"><div class="stat-value">${maxPrice ? window.TadbeerCurrencies.format(maxPrice, window.TadbeerCurrencies.state.first.code, window.TadbeerCurrencies.mode()) : '-'}</div><div class="stat-label">أعلى سعر</div></div>
                <div class="stat-card"><div class="stat-value">${avg ? window.TadbeerCurrencies.format(avg, window.TadbeerCurrencies.state.first.code, window.TadbeerCurrencies.mode()) : '-'}</div><div class="stat-label">متوسط السعر</div></div>
            </div>
            <div class="flex-between" style="margin-bottom:12px;"><span>الفئة:</span><strong>${category ? category.name : 'غير مضاف إلى فئة ⚠️'}</strong></div>
            ${Math.abs(change) > 0 ? `<div class="alert-item ${change > 0 ? 'warning' : 'success'}">${change > 0 ? '📈' : '📉'} تغير السعر: ${change > 0 ? '+' : ''}${change.toFixed(1)}%</div>` : ''}
            <div style="margin-top:12px;">
                <strong>تاريخ الأسعار:</strong>
                ${histHtml || '<p class="text-gray text-sm">لا يوجد سجل أسعار</p>'}
            </div>
            <button class="btn btn-primary btn-block mt-4" onclick="window.TadbeerApp.openProductModal('${product.id}')">تعديل الصنف</button>
        `;
        window.TadbeerUI.openModalHtml(html);
    };
})();
