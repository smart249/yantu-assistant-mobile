/* 研途小助手 Service Worker —— 网络优先 + 离线回退 */
var CACHE = 'yantu-v24';
var ASSETS = ['./','./index.html','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];

self.addEventListener('install', function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(ASSETS); }).then(function(){ return self.skipWaiting(); }));
});

self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

self.addEventListener('fetch', function(e){
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(function(res){
      var cp = res.clone();
      caches.open(CACHE).then(function(c){ c.put(e.request, cp); });
      return res;
    }).catch(function(){
      return caches.match(e.request).then(function(hit){ return hit || caches.match('./index.html'); });
    })
  );
});
