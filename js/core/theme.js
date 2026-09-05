(function () {
    'use strict';

    const STORAGE_KEY = 'tadbeer-theme';

    function updateButton(theme) {
        const button = document.getElementById('themeToggle');
        if (!button) return;
        const dark = theme === 'dark';
        button.textContent = dark ? '☀️' : '🌙';
        button.title = dark ? 'الوضع الفاتح' : 'الوضع الداكن';
        button.setAttribute('aria-label', button.title);
    }

    function apply(theme) {
        const nextTheme = theme === 'dark' ? 'dark' : 'light';
        document.documentElement.dataset.theme = nextTheme;
        document.body.dataset.theme = nextTheme;
        localStorage.setItem(STORAGE_KEY, nextTheme);
        updateButton(nextTheme);
    }

    function init() {
        apply(localStorage.getItem(STORAGE_KEY) || document.documentElement.dataset.theme || 'light');
    }

    window.TadbeerTheme = {
        init,
        apply,
        toggle() {
            const current = document.body.dataset.theme || document.documentElement.dataset.theme;
            apply(current === 'dark' ? 'light' : 'dark');
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();