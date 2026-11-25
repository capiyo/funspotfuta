(function (scope) {
  'use strict';
  function normalizeNotificationUrl(input) {
    if (typeof input !== 'string' || input.trim() === '') return '/app/';
    try {
      var url = new URL(input, scope.location.origin);
      if (url.origin !== scope.location.origin) return '/app/';
      if (url.pathname === '/app') url.pathname = '/app/';
      if (url.pathname !== '/app' && !url.pathname.startsWith('/app/')) return '/app/';
      return url.pathname + url.search + url.hash;
    } catch {
      return '/app/';
    }
  }
  scope.FunspotNotificationUrl = Object.freeze({ normalize: normalizeNotificationUrl });
})(typeof self !== 'undefined' ? self : window);
