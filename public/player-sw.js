/* Service worker for offline-capable players.
 * - App shell (HTML + /assets/*) : network-first, cache fallback.
 * - Media files (images / videos) : cache-first + explicit precache,
 *   with Range request support so videos still seek while offline.
 * Written in ES5-ish promise style for old Android TV WebViews.
 */

var SHELL_CACHE = "player-shell-v1";
var MEDIA_CACHE = "player-media-v1";

self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (k) {
          if (k !== SHELL_CACHE && k !== MEDIA_CACHE) return caches.delete(k);
          return null;
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

function isMediaUrl(url) {
  return (
    url.indexOf("/storage/v1/object/") !== -1 ||
    /\.(mp4|webm|ogg|mov|m4v|jpg|jpeg|png|gif|webp|avif|svg)(\?|$)/i.test(url)
  );
}

/* Build a 206 Partial Content response out of a fully cached media file. */
function rangeResponse(cachedResponse, rangeHeader) {
  return cachedResponse.arrayBuffer().then(function (buffer) {
    var total = buffer.byteLength;
    var match = /bytes=(\d*)-(\d*)/.exec(rangeHeader || "");
    var start = match && match[1] ? parseInt(match[1], 10) : 0;
    var end = match && match[2] ? parseInt(match[2], 10) : total - 1;
    if (isNaN(start)) start = 0;
    if (isNaN(end) || end >= total) end = total - 1;
    var slice = buffer.slice(start, end + 1);
    return new Response(slice, {
      status: 206,
      statusText: "Partial Content",
      headers: {
        "Content-Type": cachedResponse.headers.get("Content-Type") || "application/octet-stream",
        "Content-Length": String(slice.byteLength),
        "Content-Range": "bytes " + start + "-" + end + "/" + total,
        "Accept-Ranges": "bytes",
      },
    });
  });
}

function handleMedia(event) {
  var request = event.request;
  var range = request.headers.get("range");
  var cacheKey = new Request(request.url, { mode: "cors", credentials: "omit" });

  return caches.open(MEDIA_CACHE).then(function (cache) {
    return cache.match(cacheKey).then(function (cached) {
      if (cached) {
        if (range) return rangeResponse(cached.clone(), range);
        return cached;
      }
      // Not cached yet: fetch the FULL file (no Range) so we can store it,
      // then answer the current request from that copy.
      return fetch(cacheKey).then(function (response) {
        if (!response || response.status !== 200) return fetch(request);
        cache.put(cacheKey, response.clone()).catch(function () {});
        if (range) return rangeResponse(response.clone(), range);
        return response;
      }).catch(function () {
        return fetch(request);
      });
    });
  });
}

function handleShell(event) {
  var request = event.request;
  return fetch(request)
    .then(function (response) {
      if (response && response.status === 200) {
        var copy = response.clone();
        caches.open(SHELL_CACHE).then(function (c) { c.put(request, copy).catch(function () {}); });
      }
      return response;
    })
    .catch(function () {
      return caches.match(request).then(function (cached) {
        if (cached) return cached;
        if (request.mode === "navigate") {
          return caches.match("/index.html").then(function (shell) {
            return shell || Response.error();
          });
        }
        return Response.error();
      });
    });
}

self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (request.method !== "GET") return;

  var url = request.url;
  if (url.indexOf("http") !== 0) return;

  // Never intercept API / realtime / auth traffic.
  if (
    url.indexOf("/rest/v1/") !== -1 ||
    url.indexOf("/auth/v1/") !== -1 ||
    url.indexOf("/realtime/v1") !== -1 ||
    url.indexOf("/functions/v1/") !== -1
  ) return;

  if (isMediaUrl(url)) {
    event.respondWith(handleMedia(event));
    return;
  }

  var sameOrigin = url.indexOf(self.location.origin) === 0;
  if (sameOrigin && (request.mode === "navigate" || url.indexOf("/assets/") !== -1)) {
    event.respondWith(handleShell(event));
  }
});

/* Explicit media precache asked by the player. */
self.addEventListener("message", function (event) {
  var data = event.data || {};
  if (data.type !== "PRECACHE_MEDIA" || !data.urls) return;
  event.waitUntil(
    caches.open(MEDIA_CACHE).then(function (cache) {
      return Promise.all(
        data.urls.map(function (u) {
          var key = new Request(u, { mode: "cors", credentials: "omit" });
          return cache.match(key).then(function (hit) {
            if (hit) return null;
            return fetch(key).then(function (res) {
              if (res && res.status === 200) return cache.put(key, res);
              return null;
            }).catch(function () { return null; });
          });
        })
      );
    })
  );
});
