(function () {
  'use strict';

  function registerPurchaseHelpers(app) {
    if (!app) return null;
    app.purchaseHelpers = {
      ...(app.purchaseHelpers || {}),
      getPurchaseItems: (purchaseId) => (app.appData.purchaseItems && app.appData.purchaseItems[purchaseId]) || []
    };
    window.registerPurchaseHelpers = registerPurchaseHelpers;
    return app;
  }

  window.registerPurchaseHelpers = registerPurchaseHelpers;
})();
