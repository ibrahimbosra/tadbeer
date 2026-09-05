(function () {
  'use strict';

  function registerBudgetHelpers(app) {
    if (!app) return null;
    app.budgetHelpers = {
      ...(app.budgetHelpers || {}),
      currentMonthBudget: (budgets = []) => budgets
    };
    window.registerBudgetHelpers = registerBudgetHelpers;
    return app;
  }

  window.registerBudgetHelpers = registerBudgetHelpers;
})();
