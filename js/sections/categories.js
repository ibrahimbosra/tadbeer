(function () {
    'use strict';

    const app = window.TadbeerApp;

    app.renderCategories = function() {
        const list = document.getElementById('categoriesList');
        const items = [...(this.appData.categories || [])].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
        list.innerHTML = items.length ? `<div class="list-grid">${items.map(c => {
            const count = (this.appData.products || []).filter(p => p.categoryId === c.id).length;
            return `<div class="list-item-card" onclick="window.TadbeerApp.openCategory('${c.id}')"><div class="item-name">${c.name}</div><div class="item-sub">${window.TadbeerUtils.formatNumber(count)} صنف</div></div>`;
        }).join('')}</div>` : window.TadbeerUI.emptyState('لا توجد فئات');
    };

    app.openCategoryModal = function(categoryId = null) {
        const category = categoryId ? (this.appData.categories || []).find(c => c.id === categoryId) : null;
        const html = `
            <div class="modal-header"><h3 class="modal-title">${category ? 'تعديل الفئة' : 'فئة جديدة'}</h3><button class="modal-close" onclick="window.TadbeerUI.closeModal()">✕</button></div>
            <div class="form-group"><label class="required">اسم الفئة</label><input type="text" id="catName" value="${category ? (category.name || '').replace(/"/g, '&quot;') : ''}" placeholder="مثال: غذاء" /></div>
            <button class="btn btn-primary btn-block" onclick="window.TadbeerApp.saveCategory('${categoryId || ''}')">حفظ</button>
        `;
        window.TadbeerUI.openModalHtml(html);
    };

    app.saveCategory = async function(categoryId = '') {
        const name = document.getElementById('catName').value.trim();
        if (!name) return window.TadbeerUI.showToast('أدخل اسم الفئة', 'error');
        
        try {
            if (categoryId) {
                await window.db.collection('categories').doc(categoryId).update({ name, updatedAt: new Date() });
                const category = (this.appData.categories || []).find(c => c.id === categoryId);
                if (category) category.name = name;
            } else {
                const docRef = await window.db.collection('categories').add({ userId: this.currentUserId, name, createdAt: new Date(), updatedAt: new Date() });
                if (!this.appData.categories) this.appData.categories = [];
                this.appData.categories.unshift({ id: docRef.id, userId: this.currentUserId, name, createdAt: new Date(), updatedAt: new Date() });
            }
            
            window.TadbeerUI.closeModal();
            this.renderCategories();
            this.renderProducts();
            window.TadbeerUI.showToast(categoryId ? 'تم تعديل الفئة بنجاح ✓' : 'تم حفظ الفئة بنجاح ✓', 'success');
        } catch (e) {
            console.error('خطأ في حفظ الفئة:', e);
            window.TadbeerUI.showToast('خطأ: ' + e.message, 'error');
        }
    };

    app.openCategory = function(categoryId) {
        const category = (this.appData.categories || []).find(c => c.id === categoryId);
        if (!category) return;
        const assigned = (this.appData.products || []).filter(p => p.categoryId === categoryId);
        const available = (this.appData.products || []).filter(p => !p.categoryId);
        const productRows = assigned.length
            ? assigned.map(p => `<div class="flex-between text-sm"><span>${p.name}</span><button class="btn btn-sm btn-outline" onclick="window.TadbeerApp.openProductModal('${p.id}')">تعديل</button></div>`).join('')
            : '<p class="text-gray text-sm">لا توجد أصناف مرتبطة بهذه الفئة</p>';
        const options = available.length
            ? available.map(p => `<option value="${p.id}">${p.name}</option>`).join('')
            : '<option value="">لا توجد أصناف غير مضافة إلى فئة</option>';
        const html = `
            <div class="modal-header"><h3 class="modal-title">فئة: ${category.name}</h3><button class="modal-close" onclick="window.TadbeerUI.closeModal()">✕</button></div>
            <div class="flex-between" style="margin-bottom:12px;"><strong>الأصناف المرتبطة (${window.TadbeerUtils.formatNumber(assigned.length)})</strong><div><button class="btn btn-sm btn-outline" onclick="window.TadbeerApp.openCategoryModal('${category.id}')">تعديل الاسم</button><button class="btn btn-sm btn-danger" onclick="window.TadbeerApp.deleteCategory('${category.id}')">حذف</button></div></div>
            <div style="border-bottom:1px solid var(--border);padding-bottom:10px;">${productRows}</div>
            <div class="form-group" style="margin-top:12px;"><label>إضافة صنف غير مضاف إلى فئة</label><select id="categoryProductSelect">${options}</select></div>
            <button class="btn btn-primary btn-block" onclick="window.TadbeerApp.assignProductToCategory('${category.id}')">إضافة إلى الفئة</button>
        `;
        window.TadbeerUI.openModalHtml(html);
    };

    app.assignProductToCategory = async function(categoryId) {
        const productId = document.getElementById('categoryProductSelect')?.value;
        const product = (this.appData.products || []).find(p => p.id === productId);
        if (!productId || !product) return window.TadbeerUI.showToast('اختر صنفًا غير مضاف إلى فئة', 'error');
        if (product.categoryId) return window.TadbeerUI.showToast('هذا الصنف مرتبط بفئة أخرى بالفعل', 'error');
        try {
            await window.db.collection('products').doc(productId).update({ categoryId, updatedAt: new Date() });
            product.categoryId = categoryId;
            window.TadbeerUI.closeModal();
            this.renderCategories();
            this.renderProducts();
            window.TadbeerUI.showToast('تمت إضافة الصنف إلى الفئة ✓', 'success');
        } catch (e) {
            console.error('خطأ في ربط الصنف بالفئة:', e);
            window.TadbeerUI.showToast('خطأ: ' + e.message, 'error');
        }
    };

    app.deleteCategory = async function(categoryId) {
        const category = (this.appData.categories || []).find(c => c.id === categoryId);
        if (!category || !confirm(`سيتم إزالة فئة ${category.name} من الأصناف المرتبطة بها دون حذف الأصناف. هل تريد المتابعة؟`)) return;
        const products = (this.appData.products || []).filter(p => p.categoryId === categoryId);
        try {
            const batch = window.db.batch();
            batch.delete(window.db.collection('categories').doc(categoryId));
            products.forEach(product => batch.update(window.db.collection('products').doc(product.id), { categoryId: null, updatedAt: new Date() }));
            await batch.commit();
            products.forEach(product => { product.categoryId = null; });
            this.appData.categories = (this.appData.categories || []).filter(c => c.id !== categoryId);
            window.TadbeerUI.closeModal();
            this.renderCategories();
            this.renderProducts();
            window.TadbeerUI.showToast('تم حذف الفئة وإزالة ارتباطها بالأصناف ✓', 'success');
        } catch (e) {
            console.error('خطأ في حذف الفئة:', e);
            window.TadbeerUI.showToast('خطأ: ' + e.message, 'error');
        }
    };
})();
