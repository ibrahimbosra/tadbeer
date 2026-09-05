(function () {
    'use strict';

    const app = window.TadbeerApp;

    app.renderNeeds = function() {
        const list = document.getElementById('needsList');
        const items = this.appData.needs || [];
        list.innerHTML = items.length ? items.map(n => {
            const product = (this.appData.products || []).find(p => p.id === n.productId);
            return `<div class="card"><div class="flex-between"><div><strong>${n.name}</strong>${product ? ` <span class="text-sm text-gray">(${product.name})</span>` : ''}</div><span class="chip ${n.status === 'pending' ? 'orange' : n.status === 'purchased' ? 'green' : 'gray'}">${n.status === 'pending' ? 'مطلوب' : n.status === 'purchased' ? 'تم الشراء' : 'ملغي'}</span></div><div class="text-sm text-gray">الكمية: ${window.TadbeerUtils.formatNumber(n.quantity || 1)} • الأولوية: ${n.priority || 'عادية'}</div></div>`;
        }).join('') : window.TadbeerUI.emptyState('لا توجد احتياجات');
    };

    app.openNeedModal = function() {
        const products = this.appData.products || [];
        const html = `
            <div class="modal-header"><h3 class="modal-title">احتياج جديد</h3><button class="modal-close" onclick="window.TadbeerUI.closeModal()">✕</button></div>
            <div class="form-group"><label class="required">اسم الاحتياج</label><input type="text" id="needName" /></div>
            <div class="form-group"><label>الصنف المرتبط</label><select id="needProduct"><option value="">-</option>${products.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}</select></div>
            <div class="form-row">
                <div class="form-group"><label>الكمية</label><input type="number" id="needQty" value="1" /></div>
                <div class="form-group"><label>الأولوية</label><select id="needPriority"><option value="high">عالية</option><option value="medium">متوسطة</option><option value="low">منخفضة</option></select></div>
            </div>
            <div class="form-group"><label>ملاحظات</label><input type="text" id="needNotes" /></div>
            <button class="btn btn-primary btn-block" onclick="window.TadbeerApp.saveNeed()">حفظ الاحتياج</button>
        `;
        window.TadbeerUI.openModalHtml(html);
    };

    app.saveNeed = async function() {
        const name = document.getElementById('needName').value.trim();
        if (!name) return window.TadbeerUI.showToast('أدخل اسم الاحتياج', 'error');
        await window.db.collection('needs').add({
            userId: this.currentUserId,
            name,
            productId: document.getElementById('needProduct').value || null,
            quantity: Number(document.getElementById('needQty').value || 1),
            priority: document.getElementById('needPriority').value,
            status: 'pending',
            notes: document.getElementById('needNotes').value || '',
            createdAt: new Date(),
            updatedAt: new Date()
        });
        window.TadbeerUI.closeModal();
        await this.refreshData();
        window.TadbeerUI.showToast('تم حفظ الاحتياج', 'success');
    };
})();
