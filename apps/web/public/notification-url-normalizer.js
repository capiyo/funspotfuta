(function (scope) {
  'use strict';
  function normalizeNotificationUrl(input) {
    if (typeof input !== 'string' || input.trim() === '') return '/';
    try {
      var url = new URL(input, scope.location.origin);
      if (url.origin !== scope.location.origin || url.username || url.password) return '/';
      var path = url.pathname;
      if (path === '/' || path === '/app' || path === '/app/') return '/';
      var appRoute = /^\/app\/(?:login|messages(?:\/[^/]+)?\/?|comments\/[^/]+\/?)$/.test(path);
      if (appRoute) return path.slice(4) || '/';
      var rootRoute = /^\/(?:login|messages(?:\/[^/]+)?\/?|comments\/[^/]+\/?)$/.test(path);
      if (rootRoute) return path;
      return '/';
    } catch { return '/'; }
  }
  scope.FunspotNotificationUrl = Object.freeze({ normalize: normalizeNotificationUrl });
})(typeof self !== 'undefined' ? self : window);
