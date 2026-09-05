(function () {
    'use strict';

    const app = window.TadbeerApp;

    function normalizeEmail(email) {
        return String(email || '').trim().toLowerCase();
    }

    function validateUserData(name, email) {
        const normalizedName = String(name || '').trim();
        const normalizedEmail = normalizeEmail(email);
        if (!normalizedName) return { valid: false, message: 'أدخل اسم المستخدم' };
        if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return { valid: false, message: 'أدخل بريدًا إلكترونيًا صحيحًا' };
        return { valid: true, name: normalizedName, email: normalizedEmail };
    }

    function isDuplicateEmail(users, email, userId = '') {
        const normalizedEmail = normalizeEmail(email);
        const targetId = normalizeEmail(userId);
        return (users || []).some(user => normalizeEmail(user.email || user.id) === normalizedEmail && normalizeEmail(user.id || user.email) !== targetId);
    }

    function resolveUserName(users, emailOrUid, snapshot = '') {
        const search = normalizeEmail(emailOrUid);
        const user = (users || []).find(item => normalizeEmail(item.email) === search || normalizeEmail(item.id) === search || normalizeEmail(item.authUid) === search);
        return user?.name || snapshot || '';
    }

    function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
    }

    app.getCurrentUserFields = function () {
        const profile = this.currentUserProfile;
        const email = normalizeEmail(this.currentUser?.email);
        const listedProfile = (this.appData?.users || []).find(user => normalizeEmail(user.email || user.id) === email);
        return {
            createdBy: this.currentUser?.uid || this.currentUserId || null,
            createdByName: profile?.name || listedProfile?.name || this.currentUser?.displayName || ''
        };
    };

    app.syncCurrentUserProfile = async function () {
        const email = normalizeEmail(this.currentUser?.email);
        if (!email || !window.db) return null;
        const snapshot = await window.db.collection('users').doc(email).get();
        const profile = snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null;
        if (!profile) return null;
        if (!profile.authUid && this.currentUser?.uid) {
            await window.db.collection('users').doc(email).update({ authUid: this.currentUser.uid, updatedAt: new Date() });
            profile.authUid = this.currentUser.uid;
        }
        this.currentUserProfile = profile;
        return profile;
    };

    app.renderUsers = function () {
        const list = document.getElementById('usersList');
        if (!list) return;
        const users = this.appData.users || [];
        const email = normalizeEmail(this.currentUser?.email);
        const storedCurrent = users.find(user => normalizeEmail(user.email || user.id) === email);
        const current = storedCurrent || {
            name: this.currentUserProfile?.name || this.currentUser?.displayName || '',
            email: this.currentUser?.email || '',
            familyRole: this.currentUserProfile?.familyRole || ''
        };
        const others = users.filter(user => normalizeEmail(user.email || user.id) !== email);
        const renderUser = user => `<div class="list-item-card"><div class="item-name">${escapeHtml(user.name || 'مستخدم بلا اسم')}</div><div class="item-sub">${escapeHtml(user.email || 'بريد غير مسجل')}${user.familyRole ? ` • ${escapeHtml(user.familyRole)}` : ''}</div><div class="btn-group mt-4"><button class="btn btn-sm btn-outline" type="button" onclick="window.TadbeerApp.openUserModal('${escapeHtml(user.id || user.email || '')}')">تعديل</button></div></div>`;
        list.innerHTML = `<div class="settings-user-group"><div class="section-title">المستخدم الحالي</div>${renderUser(current)}</div><hr class="settings-user-divider"><div class="section-header"><h3 class="section-title">المستخدمون الآخرون</h3><button class="btn btn-primary btn-sm" type="button" onclick="window.TadbeerApp.openUserModal()">+ إضافة مستخدم</button></div>${others.length ? `<div class="list-grid">${others.map(renderUser).join('')}</div>` : window.TadbeerUI.emptyState('لا يوجد مستخدمون آخرون')}`;
    };

    app.openUserModal = function (userId = null) {
        const user = userId ? (this.appData.users || []).find(item => normalizeEmail(item.id || item.email) === normalizeEmail(userId)) : null;
        const html = `<div class="modal-header"><h3 class="modal-title">${user ? 'تعديل المستخدم' : 'إضافة مستخدم'}</h3><button class="modal-close" onclick="window.TadbeerUI.closeModal()" aria-label="إغلاق">✕</button></div><div class="form-group"><label class="required">الاسم</label><input type="text" id="userName" value="${escapeHtml(user?.name)}" placeholder="اسم المستخدم" /></div><div class="form-group"><label class="required">البريد الإلكتروني</label><input type="email" id="userEmail" value="${escapeHtml(user?.email || '')}" placeholder="example@email.com" dir="ltr" ${user ? 'readonly' : ''} /></div><div class="form-group"><label>الدور العائلي</label><input type="text" id="userFamilyRole" value="${escapeHtml(user?.familyRole)}" placeholder="أب، أم، ابن، ابنة" /></div><button class="btn btn-primary btn-block" type="button" onclick="window.TadbeerApp.saveUser('${userId || ''}')">${user ? 'حفظ التعديلات' : 'إضافة المستخدم'}</button>`;
        window.TadbeerUI.openModalHtml(html);
    };

    app.saveUser = async function (userId = '') {
        const validation = validateUserData(document.getElementById('userName')?.value, document.getElementById('userEmail')?.value || userId);
        if (!validation.valid) return window.TadbeerUI.showToast(validation.message, 'error');
        const email = validation.email;
        const existing = (this.appData.users || []).find(user => normalizeEmail(user.id) === normalizeEmail(userId) || normalizeEmail(user.email) === email);
        if (userId && existing && normalizeEmail(existing.email) !== email) return window.TadbeerUI.showToast('لا يمكن تغيير البريد الإلكتروني', 'error');
        if (userId && !existing && normalizeEmail(userId) !== email) return window.TadbeerUI.showToast('لا يمكن تغيير البريد الإلكتروني', 'error');
        if (!userId && isDuplicateEmail(this.appData.users, email)) return window.TadbeerUI.showToast('يوجد مستخدم مسجل بهذا البريد الإلكتروني', 'error');
        const familyRole = document.getElementById('userFamilyRole')?.value.trim() || '';
        const data = { email, name: validation.name, familyRole, updatedAt: new Date() };
        if (existing?.authUid) data.authUid = existing.authUid;
        try {
            if (userId) {
                await window.db.collection('users').doc(userId).update(data);
                Object.assign(existing || {}, data);
            } else {
                await window.db.collection('users').doc(email).set({ ...data, createdAt: new Date() });
                this.appData.users.unshift({ id: email, ...data, createdAt: new Date() });
            }
            window.TadbeerUI.closeModal();
            this.renderUsers();
            window.TadbeerUI.showToast(userId ? 'تم تعديل المستخدم بنجاح' : 'تمت إضافة المستخدم بنجاح', 'success');
        } catch (error) {
            console.error('خطأ في حفظ المستخدم:', error);
            window.TadbeerUI.showToast('تعذر حفظ المستخدم', 'error');
        }
    };

    window.TadbeerUsers = { normalizeEmail, validateUserData, isDuplicateEmail, resolveUserName };
})();
