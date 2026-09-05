(function () {
  'use strict';

  function registerReportHelpers(app) {
    if (!app) return null;
    app.reportHelpers = {
      ...(app.reportHelpers || {}),
      getReportSummary: () => ({})
    };
    window.registerReportHelpers = registerReportHelpers;
    return app;
  }

  window.registerReportHelpers = registerReportHelpers;
})();
