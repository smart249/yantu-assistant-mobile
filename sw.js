/* 研途小助手 Service Worker —— 网络优先 + 离线回退 */
var CACHE = 'yantu-v28';
var CACHE_PREFIX = 'yantu-';
var ASSETS = ['./','./index.html','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];

self.addEventListener('install', function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(ASSETS); }).then(function(){ return self.skipWaiting(); }));
});

self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){ return k.indexOf(CACHE_PREFIX) === 0 && k !== CACHE; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

self.addEventListener('fetch', function(e){
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(function(res){
      var sameOrigin = new URL(e.request.url).origin === self.location.origin;
      if(!sameOrigin || !res.ok)return res;
      var cp = res.clone();
      return caches.open(CACHE).then(function(c){ return c.put(e.request, cp); }).then(function(){ return res; });
    }).catch(function(error){
      return caches.match(e.request).then(function(hit){
        if(hit)return hit;
        if(e.request.mode === 'navigate')return caches.match('./index.html');
        throw error;
      });
    })
  );
});
