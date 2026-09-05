(function () {
    'use strict';

    window.TadbeerApp = {
        currentUser: null,
        currentUserId: null,
        currentPage: 'dashboard',
        reportPeriod: 'this_month',
        transactionFilter: 'expense',
        transactionDisplayLimit: 25,
        isDemoMode: false,
        demoDataInitialized: false,
        appData: {
            accounts: [],
            transactions: [],
            products: [],
            merchants: [],
            purchases: [],
            budgets: [],
            recurring: [],
            needs: [],
            debts: [],
            debtPayments: {},
            users: [],
            categories: [],
            priceHistory: [],
            purchaseItems: {}
        },
        purchaseItems: [],

        async init() {
            if (!window.auth) return;
            window.auth.onAuthStateChanged(async (user) => {
                if (user) {
                    if (!this.isAuthorizedEmail(user.email)) {
                        await window.auth.signOut();
                        this.showLogin();
                        window.TadbeerUI.showToast('هذا البريد غير مصرح له باستخدام النظام', 'error');
                        return;
                    }
                    this.currentUser = user;
                    this.currentUserId = user.uid;
                    const initialized = await this.initApp();
                    if (initialized) this.showMainApp();
                } else {
                    this.showLogin();
                }
            });

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const loginScreen = document.getElementById('loginScreen');
                    if (loginScreen && !loginScreen.classList.contains('hidden')) {
                        this.handleLogin();
                    }
                }
            });
        },

        showLogin() {
            const loginScreen = document.getElementById('loginScreen');
            const mainApp = document.getElementById('mainApp');
            if (loginScreen) loginScreen.classList.remove('hidden');
            if (mainApp) mainApp.classList.add('hidden');
        },

        showMainApp() {
            const loginScreen = document.getElementById('loginScreen');
            const mainApp = document.getElementById('mainApp');
            if (loginScreen) loginScreen.classList.add('hidden');
            if (mainApp) mainApp.classList.remove('hidden');
        },

        isAuthorizedEmail(email) {
            return String(email || '').trim().toLowerCase() === 'ibrahim.bosra@gmail.com';
        },

        async handleLogin() {
            const email = document.getElementById('loginEmail').value.trim();
            const pass = document.getElementById('loginPassword').value.trim();
            
            console.log('Login attempt:', { email, passLength: pass.length });
            
            if (!email || !pass) {
                window.TadbeerUI.showToast('أدخل البريد وكلمة المرور', 'error');
                return;
            }
            if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
                window.TadbeerUI.showToast('البريد الإلكتروني غير صحيح', 'error');
                return;
            }
            if (!this.isAuthorizedEmail(email)) {
                window.TadbeerUI.showToast('هذا البريد غير مصرح له باستخدام النظام', 'error');
                return;
            }
            
            if (!window.auth) {
                console.error('Firebase auth not initialized');
                window.TadbeerUI.showToast('خطأ: Firebase لم يحمّل بشكل صحيح', 'error');
                return;
            }
            
            try {
                console.log('Calling signInWithEmailAndPassword...');
                const cred = await window.auth.signInWithEmailAndPassword(email, pass);
                console.log('Login successful:', cred.user.uid);
                this.currentUser = cred.user;
                this.currentUserId = cred.user.uid;
                const initialized = await this.initApp();
                if (initialized) this.showMainApp();
                window.TadbeerUI.showToast('تم تسجيل الدخول بنجاح', 'success');
            } catch (e) {
                console.error('Login error:', e.code, e.message);
                let msg = 'خطأ في تسجيل الدخول';
                if (e.code === 'auth/user-not-found') {
                    msg = 'الحساب غير موجود - أنشئ حسابًا جديدًا';
                } else if (e.code === 'auth/wrong-password') {
                    msg = 'كلمة المرور غير صحيحة';
                } else if (e.code === 'auth/invalid-email') {
                    msg = 'البريد الإلكتروني غير صحيح';
                } else if (e.code === 'auth/user-disabled') {
                    msg = 'الحساب معطّل';
                } else if (e.code === 'auth/too-many-requests') {
                    msg = 'محاولات كثيرة - جرّب لاحقًا';
                } else if (e.code === 'auth/network-request-failed') {
                    msg = 'خطأ في الشبكة - تحقق من الاتصال';
                }
                window.TadbeerUI.showToast(msg, 'error');
            }
        },

        async handleRegister() {
            const email = document.getElementById('loginEmail').value.trim();
            const pass = document.getElementById('loginPassword').value.trim();
            
            console.log('Register attempt:', { email, passLength: pass.length });
            
            if (!email || !pass) {
                window.TadbeerUI.showToast('أدخل البريد وكلمة المرور', 'error');
                return;
            }
            if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
                window.TadbeerUI.showToast('البريد الإلكتروني غير صحيح', 'error');
                return;
            }
            if (!this.isAuthorizedEmail(email)) {
                window.TadbeerUI.showToast('هذا البريد غير مصرح له باستخدام النظام', 'error');
                return;
            }
            if (pass.length < 6) {
                window.TadbeerUI.showToast('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error');
                return;
            }
            
            if (!window.auth) {
                console.error('Firebase auth not initialized');
                window.TadbeerUI.showToast('خطأ: Firebase لم يحمّل بشكل صحيح', 'error');
                return;
            }
            
            try {
                console.log('Calling createUserWithEmailAndPassword...');
                const cred = await window.auth.createUserWithEmailAndPassword(email, pass);
                console.log('Registration successful:', cred.user.uid);
                this.currentUser = cred.user;
                this.currentUserId = cred.user.uid;
                const initialized = await this.initApp();
                if (initialized) this.showMainApp();
                window.TadbeerUI.showToast('تم إنشاء الحساب بنجاح', 'success');
            } catch (e) {
                console.error('Register error:', e.code, e.message);
                let msg = 'خطأ في إنشاء الحساب';
                if (e.code === 'auth/email-already-in-use') {
                    msg = 'هذا البريد مستخدم بالفعل - جرب حسابًا آخر';
                } else if (e.code === 'auth/weak-password') {
                    msg = 'كلمة المرور ضعيفة - استخدم أحرف وأرقام';
                } else if (e.code === 'auth/invalid-email') {
                    msg = 'البريد الإلكتروني غير صحيح';
                } else if (e.code === 'auth/operation-not-allowed') {
                    msg = 'تسجيل حساب غير مفعل حالياً';
                } else if (e.code === 'auth/network-request-failed') {
                    msg = 'خطأ في الشبكة - تحقق من الاتصال';
                }
                window.TadbeerUI.showToast(msg, 'error');
            }
        },

        async handleLogout() {
            await window.auth.signOut();
            this.currentUser = null;
            this.currentUserId = null;
            this.currentUserProfile = null;
            this.isDemoMode = false;
            this.showLogin();
            window.TadbeerUI.showToast('تم تسجيل الخروج', 'info');
        },

        async initApp() {
            if (!this.currentUserId) return;
            if (!this.isAuthorizedEmail(this.currentUser?.email)) {
                this.showLogin();
                return false;
            }
            await window.TadbeerCurrencies.loadForUser(this.currentUserId);
            await this.syncCurrentUserProfile();
            await this.refreshData();
            this.renderAll();
            return true;
        },

        async refreshData() {
            if (!this.currentUserId) return;
            const loaded = await window.TadbeerDB.loadAllData(this.currentUserId);
            this.appData = { ...this.appData, ...loaded };
            this.appData.purchaseItems = loaded.purchaseItems || {};
            this.renderAll();
        },

        renderAll() {
            this.renderDashboard();
            this.renderTransactions();
            this.renderPurchases();
            this.renderProducts();
            this.renderMerchants();
            this.renderPriceComparison();
            this.renderReports();
            this.renderBudgets();
            this.renderNeeds();
            this.renderRecurring();
            this.renderIncome();
            this.renderExpenses();
            this.renderAccounts();
            this.renderTransfers();
            this.renderDebts();
            this.renderUsers();
            this.renderCategories();
            this.renderAlerts();
            this.renderMoreGrid();
            this.renderGlobalSearch();
            window.TadbeerCurrencies.render();
            window.TadbeerUI.updateBottomNav(this.currentPage);
        },

        showSettingsSection(section, tab) {
            document.querySelectorAll('#page-settings .settings-panel').forEach(panel => {
                panel.classList.toggle('active', panel.id === `settings${section.charAt(0).toUpperCase()}${section.slice(1)}`);
            });
            document.querySelectorAll('#page-settings .settings-tabs button').forEach(button => {
                const isActive = button === tab;
                button.classList.toggle('active', isActive);
                button.setAttribute('aria-selected', String(isActive));
            });
        },


        renderMoreGrid() {
            const items = [
                { label: 'المعاملات', icon: '📋', page: 'transactions' },
                { label: 'التقارير', icon: '📊', page: 'reports' },
                { label: 'التجار', icon: '🏪', page: 'merchants' },
                { label: 'الميزانية', icon: '📊', page: 'budgets' },
                { label: 'الاحتياجات', icon: '📝', page: 'needs' },
                { label: 'المصاريف المتكررة', icon: '🔄', page: 'recurring' },
                { label: 'الدخل', icon: '💰', page: 'income' },
                { label: 'الحسابات', icon: '💳', page: 'accounts' },
                { label: 'التحويلات', icon: '🔀', page: 'transfers' },
                { label: 'الأسعار', icon: '💰', page: 'prices' },
                { label: 'الفئات', icon: '🏷️', page: 'categories' },
                { label: 'إدارة العملات', icon: '💱', page: 'currencies' },
                { label: 'التنبيهات', icon: '🔔', page: 'alerts' },
                { label: 'البحث', icon: '🔍', page: 'search' },
            ];
            document.getElementById('moreGrid').innerHTML = items.map(item => `<div class="more-item" onclick="window.TadbeerUI.showPage('${item.page}')"><div class="more-icon">${item.icon}</div><div class="more-label">${item.label}</div></div>`).join('');
        },

        renderGlobalSearch() {
            const q = (document.getElementById('globalSearch')?.value || '').toLowerCase();
            const container = document.getElementById('searchResults');
            if (!q) {
                container.innerHTML = '<p class="text-center text-gray mt-4">اكتب للبحث...</p>';
                return;
            }
            const products = (this.appData.products || []).filter(p => (p.name || '').toLowerCase().includes(q));
            const merchants = (this.appData.merchants || []).filter(m => (m.name || '').toLowerCase().includes(q));
            const txns = (this.appData.transactions || []).filter(t => (t.description || '').toLowerCase().includes(q));
            let html = '';
            if (products.length) {
                html += `<div class="card"><div class="card-title">الأصناف (${window.TadbeerUtils.formatNumber(products.length)})</div>${products.map(p => `<div class="flex-between text-sm"><span>${p.name}</span><span class="text-gray">${this.getProductLastPrice(p.id) ? window.TadbeerUtils.formatMoney(this.getProductLastPrice(p.id).unitPrice || 0, this.getProductLastPrice(p.id).currency || '') : '-'}</span></div>`).join('')}</div>`;
            }
            if (merchants.length) html += `<div class="card"><div class="card-title">التجار (${window.TadbeerUtils.formatNumber(merchants.length)})</div>${merchants.map(m => `<div class="flex-between text-sm"><span>${m.name}</span><span class="text-gray">${m.phone || ''}</span></div>`).join('')}</div>`;
            if (txns.length) html += `<div class="card"><div class="card-title">العمليات (${window.TadbeerUtils.formatNumber(txns.length)})</div>${txns.slice(0, 10).map(t => window.TadbeerUI.renderTxnItem(t)).join('')}</div>`;
            if (!html) html = window.TadbeerUI.emptyState('لا توجد نتائج');
            container.innerHTML = html;
        },

        getProductLastPrice(productId) {
            const list = this.getActiveProductPriceHistory
                ? this.getActiveProductPriceHistory(productId)
                : (this.appData.priceHistory || []).filter(ph => ph.productId === productId);
            if (!list.length) return null;
            return [...list].sort((a, b) => (window.TadbeerUtils.toDateValue(b.date) || 0) - (window.TadbeerUtils.toDateValue(a.date) || 0))[0];
        },

        openAddMenu() {
            if (document.getElementById('radialAddMenu')) {
                window.TadbeerUI.closeModal();
                return;
            }
            const items = [
                { type: 'expense', label: 'مصروف', icon: '💸', color: '#df5b5b' },
                { type: 'purchase', label: 'شراء', icon: '🛒', color: '#e39a3b' },
                { type: 'income', label: 'دخل', icon: '💰', color: '#1eaa78' },
                { type: 'transfer', label: 'تحويل', icon: '🔀', color: '#4f6ef7' },
                { type: 'currency-transfer', label: 'تحويل بين العملات', icon: '💱', color: '#8158c7' },
                { type: 'debt', label: 'دين', icon: '📋', color: '#c9794a' }
            ];
            const addButton = document.querySelector('.nav-item.add-btn');
            if (addButton) {
                addButton.classList.add('is-open');
                addButton.setAttribute('aria-expanded', 'true');
            }
            const html = `
                <div class="bottom-add-menu" id="radialAddMenu" onclick="if(event.target===this)window.TadbeerUI.closeModal()" aria-label="إضافة عملية">
                    <section class="bottom-add-panel" role="dialog" aria-label="إضافة عملية">
                        <div class="bottom-add-panel-header">
                            <span>إضافة عملية</span>
                            <button type="button" class="bottom-add-close" onclick="window.TadbeerUI.closeModal()" aria-label="إغلاق">×</button>
                        </div>
                        <div class="bottom-add-actions">
                            ${items.map((item, index) => `<button type="button" class="bottom-add-action" style="--action-color: ${item.color}; --delay: ${index * 35}ms" onclick="window.TadbeerApp.selectAddAction('${item.type}')" aria-label="إضافة ${item.label}"><span class="bottom-add-icon">${item.icon}</span><span class="bottom-add-label">إضافة ${item.label}</span></button>`).join('')}
                        </div>
                    </section>
                </div>
            `;
            window.TadbeerUI.openModalHtml(html, 'radial-modal-overlay');
            requestAnimationFrame(() => {
                document.getElementById('radialAddMenu')?.classList.add('is-open');
            });
        },

        selectAddAction(type) {
            const menu = document.getElementById('radialAddMenu');
            if (!menu) {
                this.openAddForm(type);
                return;
            }
            menu.classList.add('is-closing');
            setTimeout(() => {
                window.TadbeerUI.closeModal(true);
                this.openAddForm(type);
            }, 180);
        },

        openAddForm(type) {
            if (type === 'expense') this.openExpenseModal();
            else if (type === 'purchase') this.openPurchaseModal();
            else if (type === 'income') this.openIncomeModal();
            else if (type === 'transfer') this.openTransferModal();
            else if (type === 'currency-transfer') this.openCurrencyTransferModal();
            else if (type === 'debt') this.openDebtModal();
        },

        openTxnModal() {
            this.openAddMenu();
        },

        openExpenseModal() {
            const categories = [...(this.appData.categories || [])].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
            const accounts = this.appData.accounts || [];
            const html = `
                <div class="modal-header"><h3 class="modal-title">إضافة مصروف</h3><button class="modal-close" onclick="window.TadbeerUI.closeModal()">✕</button></div>
                <div class="form-group"><label class="required">المبلغ</label><input type="number" id="expAmount" placeholder="0" step="any" /></div>
                <div class="form-group"><label>الفئة</label><select id="expCategory">${categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select></div>
                <div class="form-group"><label>الوصف</label><input type="text" id="expDesc" placeholder="مثال: فاتورة كهرباء" /></div>
                <div class="form-row">
                    <div class="form-group"><label>التاريخ</label><input type="date" id="expDate" value="${window.TadbeerUtils.formatDateInput(new Date())}" /></div>
                </div>
                <div class="form-group"><label class="required">مصدر المال</label><select id="expAccount" required><option value="">اختر الحساب</option>${accounts.map(a => `<option value="${a.id}">${a.name} (${a.currency || '-'})</option>`).join('')}</select></div>
                <div class="form-group"><label>ملاحظات</label><textarea id="expNotes" placeholder="اختياري"></textarea></div>
                <button class="btn btn-primary btn-block" onclick="window.TadbeerApp.saveExpense()">حفظ المصروف</button>
            `;
            window.TadbeerUI.openModalHtml(html);
        },

        async saveExpense() {
            const amount = Number(document.getElementById('expAmount').value || 0);
            if (!amount || amount <= 0) return window.TadbeerUI.showToast('أدخل مبلغًا صحيحًا', 'error');
            const accountId = document.getElementById('expAccount').value;
            const account = (this.appData.accounts || []).find(item => item.id === accountId);
            if (!accountId || !account) return window.TadbeerUI.showToast('اختر مصدر المال', 'error');
            const currency = account.currency || window.TadbeerCurrencies.state.first.code;
            const payload = {
                userId: this.currentUserId,
                type: 'expense',
                ...window.TadbeerCurrencies.operationFields(amount, currency),
                date: new Date(document.getElementById('expDate').value || Date.now()),
                categoryId: document.getElementById('expCategory').value || null,
                categoryName: (this.appData.categories || []).find(category => category.id === document.getElementById('expCategory').value)?.name || null,
                accountId,
                ...this.getCurrentUserFields(),
                description: document.getElementById('expDesc').value || 'مصروف',
                referenceType: null,
                referenceId: null,
                status: 'active',
                createdAt: new Date(),
                updatedAt: new Date(),
                notes: document.getElementById('expNotes').value || ''
            };
            await window.db.collection('transactions').add(payload);
            window.TadbeerUI.closeModal();
            await this.refreshData();
            window.TadbeerUI.showToast('تم تسجيل المصروف', 'success');
        },


    };

    const app = window.TadbeerApp;
    if (window.registerAuthHelpers) window.registerAuthHelpers(app);
    if (window.registerTransactionHelpers) window.registerTransactionHelpers(app);
    if (window.registerPurchaseHelpers) window.registerPurchaseHelpers(app);
    if (window.registerBudgetHelpers) window.registerBudgetHelpers(app);
    if (window.registerReportHelpers) window.registerReportHelpers(app);

    window.handleLogin = () => app.handleLogin();
    window.handleRegister = () => app.handleRegister();
    window.handleLogout = () => app.handleLogout();
    window.showPage = (pageId) => { app.currentPage = pageId; window.TadbeerUI.showPage(pageId); };
    window.setReportPeriod = (period) => { app.reportPeriod = period; document.querySelectorAll('#reportPeriodTabs button').forEach(btn => btn.classList.toggle('active', btn.dataset.period === period)); app.renderReports(); };
    window.openAddMenu = () => app.openAddMenu();
    window.openTxnModal = () => app.openTxnModal();
    window.renderTransactions = () => app.renderTransactions();
    window.renderPurchases = () => app.renderPurchases();
    window.renderProducts = () => app.renderProducts();
    window.renderMerchants = () => app.renderMerchants();
    window.renderBudgets = () => app.renderBudgets();
    window.searchProductForPrice = () => app.renderPriceComparison();
    window.globalSearch = () => app.renderGlobalSearch();
    window.openPurchaseModal = () => app.openPurchaseModal();
    window.openProductModal = () => app.openProductModal();
    window.openMerchantModal = () => app.openMerchantModal();
    window.openBudgetModal = () => app.openBudgetModal();
    window.openNeedModal = () => app.openNeedModal();
    window.openRecurringModal = () => app.openRecurringModal();
    window.openIncomeModal = () => app.openIncomeModal();
    window.openAccountModal = () => app.openAccountModal();
    window.openTransferModal = () => app.openTransferModal();
    window.openCurrencyTransferModal = () => app.openCurrencyTransferModal();
    window.openDebtModal = () => app.openDebtModal();
    window.openCategoryModal = () => app.openCategoryModal();
    window.openAddForm = (type) => app.openAddForm(type);
    window.closeModal = () => window.TadbeerUI.closeModal();

    window.addEventListener('DOMContentLoaded', () => {
        app.init();
    });
})();
