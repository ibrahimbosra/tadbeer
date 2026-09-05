(function () {
    'use strict';

    const COLLECTIONS = [
        'accounts', 'transactions', 'products', 'merchants', 'purchases', 'budgets',
        'recurringExpenses', 'needs', 'debts', 'users', 'categories', 'priceHistory'
    ];

    function getCollectionName(name) {
        if (name === 'recurring') return 'recurringExpenses';
        return name;
    }

    function readCollection(collectionName, userId) {
        if (!window.db || !userId) return Promise.resolve([]);
        const col = window.db.collection(collectionName);
        const query = col.where('userId', '==', userId).orderBy('createdAt', 'desc').limit(500);
        return query.get()
            .then(snapshot => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
            .catch(() => []);
    }

    function readUsers() {
        if (!window.db) return Promise.resolve([]);
        return window.db.collection('users').get()
            .then(snapshot => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
            .catch(() => []);
    }

    async function loadAllData(userId) {
        if (!userId) return { accounts: [], transactions: [], products: [], merchants: [], purchases: [], budgets: [], recurring: [], needs: [], debts: [], users: [], categories: [], priceHistory: [], debtPayments: {}, purchaseItems: {} };

        const results = {};
        const tasks = COLLECTIONS.map(async (collectionName) => {
            const key = collectionName === 'recurringExpenses' ? 'recurring' : collectionName;
            results[key] = collectionName === 'users' ? await readUsers() : await readCollection(collectionName, userId);
        });
        await Promise.all(tasks);

        results.debtPayments = {};
        for (const debt of results.debts || []) {
            results.debtPayments[debt.id] = await window.db.collection('debts').doc(debt.id).collection('payments').orderBy('createdAt', 'desc').get()
                .then(snapshot => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
                .catch(() => []);
        }

        results.purchaseItems = {};
        for (const purchase of results.purchases || []) {
            results.purchaseItems[purchase.id] = await window.db.collection('purchases').doc(purchase.id).collection('items').get()
                .then(snapshot => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
                .catch(() => []);
        }

        // Upgrade legacy budgets once their category name can be resolved safely.
        for (const budget of results.budgets || []) {
            if (budget.categoryId || !budget.categoryName) continue;
            const matchingCategories = (results.categories || []).filter(item => item.name === budget.categoryName);
            if (matchingCategories.length !== 1) continue;
            const category = matchingCategories[0];
            budget.categoryId = category.id;
            budget.categoryName = category.name;
            try {
                await window.db.collection('budgets').doc(budget.id).update({ categoryId: category.id, categoryName: category.name, updatedAt: new Date() });
            } catch (error) {
                console.warn('تعذر ترقية الميزانية القديمة:', budget.id, error);
            }
        }

        return results;
    }

    function subscribeToCollection(collectionName, userId, callback) {
        if (!window.db || !userId) return null;
        return window.db.collection(collectionName)
            .where('userId', '==', userId)
            .onSnapshot(snapshot => callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))))
    }

    async function initDemoData(currentUserId) {
        if (!window.db || !currentUserId) return false;
        const storageKey = `tadbeer_demo_${currentUserId}`;
        if (localStorage.getItem(storageKey) === 'done') return false;

        const now = Date.now();
        const twoMonthsAgo = now - 60 * 86400000;
        const userId = currentUserId;
        const creatorName = window.TadbeerApp?.currentUserProfile?.name || window.TadbeerApp?.currentUser?.displayName || '';

        const accountRef = await window.db.collection('accounts').add({
            userId,
            name: 'نقد البيت',
            type: 'cash',
            currency: 'SYP',
            status: 'active',
            createdAt: new Date(twoMonthsAgo),
            updatedAt: new Date(twoMonthsAgo)
        });

        const merchantRef = await window.db.collection('merchants').add({
            userId,
            name: 'ماركت أحمد',
            status: 'active',
            phone: '',
            address: '',
            notes: '',
            createdAt: new Date(twoMonthsAgo),
            updatedAt: new Date(twoMonthsAgo)
        });

        const productRef = await window.db.collection('products').add({
            userId,
            name: 'زيت دوار الشمس 1 لتر',
            categoryId: null,
            unit: 'لتر',
            brand: '',
            size: '1 لتر',
            notes: '',
            status: 'active',
            createdAt: new Date(twoMonthsAgo),
            updatedAt: new Date(twoMonthsAgo)
        });

        await window.db.collection('priceHistory').add({
            userId,
            productId: productRef.id,
            merchantId: merchantRef.id,
            unitPrice: 22000,
            currency: 'SYP',
            unit: 'لتر',
            quantity: 1,
            date: new Date(now - 5 * 86400000),
            purchaseId: null,
            createdAt: new Date(now - 5 * 86400000)
        });

        const purchaseRef = await window.db.collection('purchases').add({
            userId,
            merchantId: merchantRef.id,
            date: new Date(now - 2 * 86400000),
            currency: 'SYP',
            accountId: accountRef.id,
            createdBy: userId,
            createdByName: creatorName,
            total: 22000,
            categoryId: null,
            notes: '',
            status: 'active',
            createdAt: new Date(now - 2 * 86400000),
            updatedAt: new Date(now - 2 * 86400000)
        });

        await window.db.collection('purchases').doc(purchaseRef.id).collection('items').add({
            productId: productRef.id,
            productNameSnapshot: 'زيت دوار الشمس 1 لتر',
            merchantId: merchantRef.id,
            quantity: 1,
            unit: 'لتر',
            unitPrice: 22000,
            total: 22000,
            currency: 'SYP',
            createdAt: new Date(now - 2 * 86400000)
        });

        await window.db.collection('transactions').add({
            userId,
            type: 'expense',
            amount: 22000,
            currency: 'SYP',
            date: new Date(now - 2 * 86400000),
            categoryId: null,
            accountId: accountRef.id,
            createdBy: userId,
            createdByName: creatorName,
            description: 'فاتورة شراء',
            referenceType: 'purchase',
            referenceId: purchaseRef.id,
            status: 'active',
            createdAt: new Date(now - 2 * 86400000),
            updatedAt: new Date(now - 2 * 86400000)
        });

        await window.db.collection('transactions').add({
            userId,
            type: 'income',
            amount: 5000000,
            currency: 'SYP',
            date: new Date(now - 10 * 86400000),
            categoryId: null,
            accountId: accountRef.id,
            createdBy: userId,
            createdByName: creatorName,
            description: 'راتب شهري',
            referenceType: null,
            referenceId: null,
            status: 'active',
            createdAt: new Date(now - 10 * 86400000),
            updatedAt: new Date(now - 10 * 86400000)
        });

        localStorage.setItem(storageKey, 'done');
        return true;
    }

    window.TadbeerDB = {
        COLLECTIONS,
        getCollectionName,
        loadAllData,
        subscribeToCollection,
        initDemoData
    };
})();
