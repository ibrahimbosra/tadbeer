(function () {
  'use strict';

  function registerAuthHelpers(app) {
    if (!app) return null;
    app.authHelpers = {
      ...app.authHelpers,
      isSignedIn: () => !!app.currentUserId,
      getCurrentUserLabel: () => app.currentUser ? (app.currentUser.email || 'demo') : 'guest'
    };
    window.registerAuthHelpers = registerAuthHelpers;
    return app;
  }

  window.registerAuthHelpers = registerAuthHelpers;
})();
