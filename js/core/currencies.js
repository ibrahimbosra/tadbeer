(function () {
    'use strict';

    const STORAGE_KEY = 'tadbeer-currency-settings';
    const defaults = { first: { name: '', code: '' }, second: null, rate: null, display: 'first' };

    function emptySettings() { return { first: { ...defaults.first }, second: null, rate: null, display: defaults.display }; }

    function normalizeSettings(saved) {
        const first = saved?.currency1 || saved?.first;
        const second = saved?.currency2 || saved?.second;
        const normalizedFirst = first?.name && (first.symbol || first.code)
            ? { name: String(first.name), code: String(first.symbol || first.code).toUpperCase() }
            : { ...defaults.first };
        const normalizedSecond = second?.name && (second.symbol || second.code)
            ? { name: String(second.name), code: String(second.symbol || second.code).toUpperCase() }
            : null;
        const rate = normalizedSecond && Number(saved.exchangeRate ?? saved.rate) > 0
            ? Number(saved.exchangeRate ?? saved.rate)
            : null;
        const display = ['first', 'second', 'both'].includes(saved?.displayMode || saved?.display)
            ? (saved.displayMode || saved.display)
            : defaults.display;
        return { first: normalizedFirst, second: normalizedSecond, rate, display };
    }

    function readSettings() {
        try {
            return normalizeSettings(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'));
        } catch (error) { return { ...defaults }; }
    }

    const state = readSettings();

    function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    function firestoreData() {
        return {
            currency1: state.first.code ? { name: state.first.name, symbol: state.first.code } : null,
            currency2: state.second?.code ? { name: state.second.name, symbol: state.second.code } : null,
            exchangeRate: state.rate,
            displayMode: state.display,
            updatedAt: new Date()
        };
    }
    async function loadForUser(id) {
        if (!id) return false;
        const fallback = readSettings();
        try {
            if (!window.db || !window.db.collection) {
                Object.assign(state, fallback);
                return true;
            }
            const snapshot = await window.db.collection('settings').doc(`currency:${id}`).get();
            if (!snapshot || !snapshot.exists) {
                Object.assign(state, fallback);
                return true;
            }
            const saved = snapshot.data() || {};
            const next = normalizeSettings(saved);
            Object.assign(state, next);
            save();
            return true;
        } catch (error) {
            console.warn('تعذر جلب إعدادات العملات من Firestore:', error);
            Object.assign(state, fallback);
            return true;
        }
    }
    async function persist() {
        save();
        try {
            if (!window.db || !window.db.collection) return true;
            const payload = firestoreData();
            await window.db.collection('settings').doc(`currency:${window.TadbeerApp?.currentUserId || 'anonymous'}`).set(payload, { merge: true });
            return true;
        } catch (error) {
            console.warn('تعذر حفظ إعدادات العملات في Firestore، تم الاحتفاظ بالنسخة المحلية:', error);
            return true;
        }
    }
    function rateFor(currency, exchangeRate = null) {
        if (!state.second) return 1;
        return Number(exchangeRate || state.rate || 0);
    }
    function toFirst(value, currency, exchangeRate = null) { return currency === state.first.code ? Number(value || 0) : Number(value || 0) * rateFor(currency, exchangeRate); }
    function fromFirst(value, currency, exchangeRate = null) { return currency === state.first.code ? Number(value || 0) : rateFor(currency, exchangeRate) ? Number(value || 0) / rateFor(currency, exchangeRate) : 0; }
    function convertAmount(value, sourceCurrency, targetCurrency, exchangeRate = null) {
        const amount = Number(value || 0);
        if (!sourceCurrency || !targetCurrency || sourceCurrency === targetCurrency) return amount;
        const firstValue = toFirst(amount, sourceCurrency, exchangeRate);
        return fromFirst(firstValue, targetCurrency, exchangeRate);
    }
    function toCurrentValue(value, currency, targetCurrency = state.first.code) { return convertAmount(value, currency, targetCurrency); }
    function toHistoricalValue(value, currency, historicalRate, targetCurrency = state.first.code) { return convertAmount(value, currency, targetCurrency, historicalRate); }
    function number(value, currency = '') {
        const amount = Number(value || 0);
        const wholeDisplay = isWholeDisplayCurrency(currency);
        const decimals = wholeDisplay ? 0 : 2;
        const displayValue = wholeDisplay ? Math.trunc(amount) : amount;
        return displayValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: decimals });
    }
    function native(value, currency) { return `${number(value, currency)} ${currency || ''}`.trim(); }
    function format(value, sourceCurrency = state.first.code, displayMode = 'native', exchangeRate = null) {
        const first = state.first.code;
        const second = state.second?.code;
        const mode = displayMode === 'base' ? 'first' : displayMode === 'secondary' ? 'second' : displayMode;
        if (!first) return '-';
        if (!second || mode === 'native') return native(value, sourceCurrency);
        const firstValue = toFirst(value, sourceCurrency, exchangeRate);
        if (mode === 'first') return native(firstValue, first);
        if (mode === 'second') return native(fromFirst(firstValue, second, exchangeRate), second);
        if (mode === 'both') return sourceCurrency === second ? `${native(value, second)} ≈ ${native(firstValue, first)}` : `${native(value, first)} ≈ ${native(fromFirst(firstValue, second, exchangeRate), second)}`;
        return native(value, sourceCurrency);
    }
    function isWholeDisplayCurrency(currency) {
        return currency === 'SYP' || (currency === state.first.code && /ليرة|لیر|سوري|syria/i.test(`${state.first.name} ${currency}`));
    }
    function formatBalance(value, currency = state.first.code) {
        return isWholeDisplayCurrency(currency)
            ? `${Math.trunc(Number(value || 0)).toLocaleString('en-US')} ${currency}`.trim()
            : format(value, currency);
    }
    function operationFields(amount, currency, exchangeRate = state.rate) {
        const snapshotRate = state.second && Number(exchangeRate) > 0 ? Number(exchangeRate) : null;
        return {
            amount: Number(amount),
            currency,
            exchangeRate: snapshotRate,
            baseAmount: toHistoricalValue(amount, currency, snapshotRate)
        };
    }
    function mode() { return state.display; }
    function currencyOptions(selected = state.first.code) { const currencies = [state.first, state.second].filter(item => item?.code); return currencies.length ? currencies.map(item => `<option value="${item.code}" ${item.code === selected ? 'selected' : ''}>${item.name} (${item.code})</option>`).join('') : '<option value="">عرّف العملة الأولى من قسم إدارة العملات</option>'; }

    function render() {
        const container = document.getElementById('currenciesContent');
        if (!container) return;
        const choices = ['first', 'second', 'both'].map(value => `<button class="chip ${state.display === value ? 'active' : ''}" ${value !== 'first' && !state.second ? 'disabled' : ''} onclick="window.TadbeerCurrencies.setDisplay('${value}')">${value === 'first' ? 'العملة الأولى' : value === 'second' ? 'العملة الثانية' : 'العملتان'}</button>`).join('');
        container.innerHTML = `<div class="card"><div class="card-title">العملة الأولى</div><div class="form-group"><label>اسم العملة</label><input id="currencyFirstName" value="${state.first.name}" placeholder="مثال: الليرة السورية"></div><div class="form-group"><label>رمز العملة</label><input id="currencyFirstCode" value="${state.first.code}" placeholder="مثال: SYP"></div><button class="btn btn-primary" onclick="window.TadbeerCurrencies.saveFirst()">حفظ العملة الأولى</button></div><div class="card"><div class="card-title">العملة الثانية</div>${state.second ? `<div class="form-group"><label>اسم العملة</label><input id="currencySecondName" value="${state.second.name}"></div><div class="form-group"><label>رمز العملة</label><input id="currencySecondCode" value="${state.second.code}"></div><div class="form-group"><label>سعر الصرف: 1 ${state.second.code} = ? ${state.first.code}</label><input type="number" id="currencyRate" value="${state.rate ?? ''}" min="0" step="any"></div><button class="btn btn-primary" onclick="window.TadbeerCurrencies.saveSecond()">حفظ العملة الثانية</button><button class="btn btn-outline" onclick="window.TadbeerCurrencies.removeSecond()">إزالة العملة الثانية</button>` : '<button class="btn btn-outline" onclick="window.TadbeerCurrencies.addSecond()">+ إضافة عملة ثانية</button>'}</div><div class="card"><div class="card-title">طريقة عرض المبالغ</div><div class="btn-group">${choices}</div></div>`;
    }
    function refreshApp() { if (window.TadbeerApp?.renderAll) window.TadbeerApp.renderAll(); }
    async function saveFirst() { const name = document.getElementById('currencyFirstName').value.trim(); const code = document.getElementById('currencyFirstCode').value.trim().toUpperCase(); if (!name || !code) return alert('أدخل اسم ورمز العملة الأولى'); state.first = { name, code }; try { await persist(); render(); refreshApp(); } catch (error) { alert('تعذر حفظ إعدادات العملات في Firestore'); console.error(error); } }
    function addSecond() { if (!state.first.code) return alert('احفظ العملة الأولى أولًا'); state.second = { name: '', code: '' }; state.rate = null; render(); }
    async function saveSecond() { const name = document.getElementById('currencySecondName').value.trim(); const code = document.getElementById('currencySecondCode').value.trim().toUpperCase(); const rate = Number(document.getElementById('currencyRate').value); if (!name || !code || code === state.first.code || !rate || rate <= 0) return alert('أدخل بيانات العملة الثانية وسعر صرف صالح'); state.second = { name, code }; state.rate = rate; try { await persist(); render(); refreshApp(); } catch (error) { alert('تعذر حفظ إعدادات العملات في Firestore'); console.error(error); } }
    async function removeSecond() { state.second = null; state.rate = null; state.display = 'first'; try { await persist(); render(); refreshApp(); } catch (error) { alert('تعذر حفظ إعدادات العملات في Firestore'); console.error(error); } }
    async function setDisplay(value) { if (value !== 'first' && !state.second) return; state.display = value; try { await persist(); render(); refreshApp(); } catch (error) { alert('تعذر حفظ إعدادات العملات في Firestore'); console.error(error); } }

    window.TadbeerCurrencies = { state, save, loadForUser, persist, rateFor, convertAmount, toCurrentValue, toHistoricalValue, toBase: toFirst, fromBase: fromFirst, format, formatBalance, formatNumber: number, operationFields, mode, currencyOptions, render, saveFirst, addSecond, saveSecond, removeSecond, setDisplay, isConfigured: () => Boolean(state.first.code) };
    window.addEventListener('DOMContentLoaded', render);
})();