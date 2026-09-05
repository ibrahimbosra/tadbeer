(function () {
    'use strict';
    const app = window.TadbeerApp;

    app.renderMerchants = function() {
        const search = (document.getElementById('merchantSearch')?.value || '').toLowerCase();
        const filtered = (this.appData.merchants || []).filter(m => (m.name || '').toLowerCase().includes(search)).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
        const list = document.getElementById('merchantsList');
        list.innerHTML = filtered.length ? `<div class="list-grid">${filtered.map(m => `
            <div class="list-item-card" onclick="window.TadbeerApp.viewMerchant('${m.id}')">
                <div class="item-name">${m.name}</div>
                <div class="item-sub">${m.phone || 'لا هاتف'}</div>
            </div>
        `).join('')}</div>` : window.TadbeerUI.emptyState('لا يوجد تجار');
    };

    app.openMerchantModal = function() {
        const html = `
            <div class="modal-header"><h3 class="modal-title">تاجر جديد</h3><button class="modal-close" onclick="window.TadbeerUI.closeModal()">✕</button></div>
            <div class="form-group"><label class="required">اسم التاجر</label><input type="text" id="merName" /></div>
            <div class="form-group"><label>رقم الهاتف</label><input type="text" id="merPhone" /></div>
            <div class="form-group"><label>العنوان</label><input type="text" id="merAddress" /></div>
            <div class="form-group"><label>ملاحظات</label><textarea id="merNotes"></textarea></div>
            <button class="btn btn-primary btn-block" onclick="window.TadbeerApp.saveMerchant()">حفظ التاجر</button>
        `;
        window.TadbeerUI.openModalHtml(html);
    };

    app.saveMerchant = async function() {
        const name = document.getElementById('merName').value.trim();
        if (!name) return window.TadbeerUI.showToast('أدخل اسم التاجر', 'error');
        
        try {
            const docRef = await window.db.collection('merchants').add({
                userId: this.currentUserId,
                name,
                phone: document.getElementById('merPhone').value || '',
                address: document.getElementById('merAddress').value || '',
                notes: document.getElementById('merNotes').value || '',
                status: 'active',
                createdAt: new Date(),
                updatedAt: new Date()
            });
            
            // إضافة فورية للبيانات المحلية
            if (!this.appData.merchants) this.appData.merchants = [];
            this.appData.merchants.unshift({
                id: docRef.id,
                userId: this.currentUserId,
                name,
                phone: document.getElementById('merPhone').value || '',
                address: document.getElementById('merAddress').value || '',
                notes: document.getElementById('merNotes').value || '',
                status: 'active',
                createdAt: new Date(),
                updatedAt: new Date()
            });
            
            window.TadbeerUI.closeModal();
            
            // تحديث الشاشة المحلية فقط بدون إعادة تحميل من Firestore
            this.renderMerchants();
            
            window.TadbeerUI.showToast('تم حفظ التاجر بنجاح ✓', 'success');
        } catch (e) {
            console.error('خطأ في حفظ التاجر:', e);
            window.TadbeerUI.showToast('خطأ: ' + e.message, 'error');
        }
    };

    app.viewMerchant = function(merchantId) {
        const merchant = (this.appData.merchants || []).find(m => m.id === merchantId);
        if (!merchant) return;
        const purchases = (this.appData.purchases || []).filter(p => p.merchantId === merchantId && p.status === 'active');
        const total = purchases.reduce((sum, p) => sum + window.TadbeerCurrencies.toCurrentValue(p.total || 0, p.currency || window.TadbeerCurrencies.state.first.code), 0);
        const html = `
            <div class="modal-header"><h3 class="modal-title">${merchant.name}</h3><button class="modal-close" onclick="window.TadbeerUI.closeModal()">✕</button></div>
            <div style="display:grid;gap:8px;">
                <div class="flex-between"><span>الهاتف:</span><strong>${merchant.phone || '-'}</strong></div>
                <div class="flex-between"><span>العنوان:</span><strong>${merchant.address || '-'}</strong></div>
                <div class="flex-between"><span>عدد الفواتير:</span><strong>${window.TadbeerUtils.formatNumber(purchases.length)}</strong></div>
                <div class="flex-between"><span>إجمالي المشتريات:</span><strong>${window.TadbeerCurrencies.format(total, window.TadbeerCurrencies.state.first.code, window.TadbeerCurrencies.mode())}</strong></div>
                <div class="flex-between"><span>الحالة:</span><strong class="${merchant.status === 'active' ? 'text-green' : 'text-gray'}">${merchant.status === 'active' ? 'نشط' : 'غير نشط'}</strong></div>
            </div>
        `;
        window.TadbeerUI.openModalHtml(html);
    };
})();
