(function (scope) {
  'use strict';
  function normalizeNotificationUrl(input) {
    if (typeof input !== 'string' || input.trim() === '') return '/';
    try {
      var url = new URL(input, scope.location.origin);
      if (url.origin !== scope.location.origin || url.username || url.password) return '/';
      var path = url.pathname;
      var allowed = path === '/' || path === '/login'
        || /^\/messages(?:\/[^/]+)?\/?$/.test(path)
        || /^\/comments\/[^/]+\/?$/.test(path);
      return allowed ? path : '/';
    } catch { return '/'; }
  }
  scope.FunspotNotificationUrl = Object.freeze({ normalize: normalizeNotificationUrl });
})(typeof self !== 'undefined' ? self : window);
