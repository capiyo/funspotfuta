(function (scope) {
  'use strict';
  function normalizeNotificationUrl(input) {
    if (typeof input !== 'string' || input.trim() === '') return '/app/';
    try {
      var url = new URL(input, scope.location.origin);
      if (url.origin !== scope.location.origin || url.username || url.password) return '/app/';
      var path = url.pathname;
      if (path === '/' || path === '/app' || path === '/app/') return '/app/';
      var legacyRoute = /^\/(?:login|messages(?:\/[^/]+)?\/?|comments\/[^/]+\/?)$/.test(path);
      var appRoute = /^\/app\/(?:login|messages(?:\/[^/]+)?\/?|comments\/[^/]+\/?)$/.test(path);
      if (legacyRoute) return '/app' + path;
      if (appRoute) return path;
      return '/app/';
    } catch { return '/app/'; }
  }
  scope.FunspotNotificationUrl = Object.freeze({ normalize: normalizeNotificationUrl });
})(typeof self !== 'undefined' ? self : window);
