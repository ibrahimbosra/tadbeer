(function () {
  'use strict';

  function registerTransactionHelpers(app) {
    if (!app) return null;
    app.transactionHelpers = {
      ...(app.transactionHelpers || {}),
      addTransaction: (payload) => payload,
      cancelTransaction: (id) => id
    };
    window.registerTransactionHelpers = registerTransactionHelpers;
    return app;
  }

  window.registerTransactionHelpers = registerTransactionHelpers;
})();
