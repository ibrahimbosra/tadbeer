(function () {
    'use strict';

    function toDateValue(value) {
        if (!value) return null;
        if (value instanceof Date) return value;
        if (value && typeof value.toDate === 'function') return value.toDate();
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date;
    }

    function formatNumber(value) {
        if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
        return Math.trunc(Number(value)).toLocaleString('en-US');
    }

    function formatMoney(amount, currency = '') {
        if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return '-';
        return `${formatNumber(amount)} ${currency}`.trim();
    }

    function toSafeNumber(value, fallback = 0) {
        const v = Number(value);
        return Number.isFinite(v) ? v : fallback;
    }

    function normalizeDateString(dateValue) {
        const d = toDateValue(dateValue);
        return d ? d.toLocaleDateString('en-GB') : '-';
    }

    function formatDateInput(dateValue) {
        const d = toDateValue(dateValue) || new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function formatMonthInput(dateValue) {
        const d = toDateValue(dateValue) || new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    }

    function makeId(prefix = 'id') {
        return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
    }

    function safeText(value) {
        return value === null || value === undefined ? '' : String(value);
    }

    window.TadbeerUtils = {
        toDateValue,
        formatNumber,
        formatMoney,
        toSafeNumber,
        normalizeDateString,
        formatDateInput,
        formatMonthInput,
        makeId,
        safeText
    };
})();
