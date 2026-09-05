(function () {
    const app = window.TadbeerApp;

    app.renderPriceComparison = function() {
        const q = (document.getElementById('priceProductSearch')?.value || '').toLowerCase();
        const container = document.getElementById('priceComparisonResults');
        if (!q) {
            container.innerHTML = '<p class="text-center text-gray mt-4">ابحث عن صنف للمقارنة بين التجار</p>';
            return;
        }
        const product = (this.appData.products || []).find(p => (p.name || '').toLowerCase().includes(q));
        if (!product) {
            container.innerHTML = window.TadbeerUI.emptyState('لا يوجد صنف بهذا الاسم');
            return;
        }
        const history = this.getActiveProductPriceHistory(product.id);
        const merchantMap = {};
        for (const item of history) {
            if (!merchantMap[item.merchantId]) merchantMap[item.merchantId] = [];
            merchantMap[item.merchantId].push(item);
        }
        const rows = Object.entries(merchantMap).map(([merchantId, list]) => {
            const merchant = (this.appData.merchants || []).find(m => m.id === merchantId);
            const sorted = list.sort((a, b) => (window.TadbeerUtils.toDateValue(b.date) || 0) - (window.TadbeerUtils.toDateValue(a.date) || 0));
            const toCurrentBase = item => window.TadbeerCurrencies.toCurrentValue(item.unitPrice || 0, item.currency || window.TadbeerCurrencies.state.first.code);
            const lastPrice = toCurrentBase(sorted[0] || {});
            const minPrice = Math.min(...sorted.map(toCurrentBase));
            const maxPrice = Math.max(...sorted.map(toCurrentBase));
            const avg = sorted.reduce((sum, x) => sum + toCurrentBase(x), 0) / sorted.length;
            return { merchant, lastPrice, minPrice, maxPrice, avg, lastDate: sorted[0]?.date || null };
        }).sort((a, b) => a.lastPrice - b.lastPrice);

        const best = rows[0];
        container.innerHTML = `
            <div class="card">
                <h3 style="margin-bottom:12px;">${product.name} <span class="text-sm text-gray">(${product.unit || ''} ${product.size || ''})</span></h3>
                ${best ? `<div class="alert-item success">🏆 أفضل سعر حاليًا: <strong>${best.merchant ? best.merchant.name : 'غير معروف'}</strong> - ${window.TadbeerCurrencies.format(best.lastPrice, window.TadbeerCurrencies.state.first.code, window.TadbeerCurrencies.mode('prices'))}</div>` : ''}
                <div class="table-wrap">
                    <table>
                        <thead><tr><th>التاجر</th><th>آخر سعر</th><th>أقل سعر</th><th>أعلى سعر</th><th>متوسط السعر</th><th>آخر شراء</th></tr></thead>
                        <tbody>
                            ${rows.map(r => `
                                <tr>
                                    <td>${r.merchant ? r.merchant.name : 'غير معروف'}</td>
                                    <td><strong>${window.TadbeerCurrencies.format(r.lastPrice, window.TadbeerCurrencies.state.first.code, window.TadbeerCurrencies.mode('prices'))}</strong></td>
                                    <td>${window.TadbeerCurrencies.format(r.minPrice, window.TadbeerCurrencies.state.first.code, window.TadbeerCurrencies.mode('prices'))}</td>
                                    <td>${window.TadbeerCurrencies.format(r.maxPrice, window.TadbeerCurrencies.state.first.code, window.TadbeerCurrencies.mode('prices'))}</td>
                                    <td>${window.TadbeerCurrencies.format(r.avg, window.TadbeerCurrencies.state.first.code, window.TadbeerCurrencies.mode('prices'))}</td>
                                    <td>${window.TadbeerUtils.normalizeDateString(r.lastDate)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    };
})();
