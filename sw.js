/* Only the static app shell is cached. Personal records stay in browser storage. */
'use strict';
const APP_SCOPE=new URL(self.registration.scope);
const HOME_URL=new URL('./',APP_SCOPE).href;
const INDEX_URL=new URL('index.html',APP_SCOPE).href;
const CACHE_PREFIX='yantu-shell:'+APP_SCOPE.href+':';
const CACHE_NAME=CACHE_PREFIX+'b98c12c3e872';
const ASSETS=new Map([
  [new URL('manifest.webmanifest',APP_SCOPE).href,'manifest'],
  [new URL('icons/icon-192.png',APP_SCOPE).href,'png'],
  [new URL('icons/icon-512.png',APP_SCOPE).href,'png'],
  [new URL('icons/icon.svg',APP_SCOPE).href,'svg']
]);
const isHome=url=>url===HOME_URL||url===INDEX_URL;
async function safeCache(url,response,kind){
  if(!response||response.status!==200||response.redirected||response.type==='opaque'||response.type==='opaqueredirect')return false;
  if(response.url!==url)return false;
  const type=(response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
  if(kind==='html'){
    if(type!=='text/html')return false;
    const text=await response.clone().text(),head=/<head\b[^>]*>([\s\S]*?)<\/head>/i.exec(text)?.[1]||'';
    const marked=(head.match(/<meta\b[^>]*>/gi)||[]).some(tag=>/\bname\s*=\s*["']yantu-app["']/i.test(tag)&&/\bcontent\s*=\s*["']1["']/i.test(tag));
    if(!marked)return false;
  }else if(kind==='png'){
    if(type!=='image/png')return false;
  }else if(kind==='svg'){
    if(type!=='image/svg+xml')return false;
  }else if(kind==='manifest'){
    if(type!=='application/manifest+json'&&type!=='application/json')return false;
    const manifest=await response.clone().json();if(manifest.name!=='读研小助手'||manifest.scope!=='./')return false;
  }else return false;
  const cache=await caches.open(CACHE_NAME);await cache.put(kind==='html'?HOME_URL:url,response.clone());return true;
}
async function cacheQuietly(url,response,kind){try{return await safeCache(url,response,kind);}catch{return false;}}
async function cached(url){try{return await (await caches.open(CACHE_NAME)).match(url);}catch{return undefined;}}
function offlinePage(){
  return new Response('<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>读研小助手</title></head><body style="font-family:system-ui,sans-serif;margin:40px 24px;line-height:1.8;color:#182c40"><h1 style="font-size:22px">暂时无法打开</h1><p>请先联网打开一次读研小助手，之后即可离线查看已保存的课表、计划和训练。</p><a href="./" style="color:#245edb">重新打开</a></body></html>',{status:503,headers:{'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-store'}});
}
function navigation(event){
  const network=fetch(event.request).then(async response=>{await cacheQuietly(event.request.url,response,'html');return response;});
  const guarded=network.catch(()=>null);event.waitUntil(guarded.then(()=>undefined));
  return (async()=>{
    let timer;
    const response=await Promise.race([guarded,new Promise(resolve=>{timer=setTimeout(()=>resolve(null),2500);})]);
    clearTimeout(timer);
    if(response&&response.status<500)return response;
    const saved=await cached(HOME_URL);return saved||response||offlinePage();
  })();
}
function asset(event,kind){
  return (async()=>{
    const saved=await cached(event.request.url);if(saved)return saved;
    const response=await fetch(event.request);await cacheQuietly(event.request.url,response,kind);return response;
  })();
}
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    await caches.open(CACHE_NAME);
    const home=await fetch(HOME_URL,{cache:'no-cache',credentials:'same-origin'});
    // Reject this update if the required offline entry is unavailable. The old
    // worker and its validated shell remain active, including after auth expiry.
    if(!await safeCache(HOME_URL,home,'html'))throw Error('App shell is unavailable; keeping the previous offline version');
    await Promise.allSettled([...ASSETS].map(async([url,kind])=>{
      const response=await fetch(url,{cache:'no-cache',credentials:'same-origin'});await cacheQuietly(url,response,kind);
    }));
  })());
  // A newer worker waits for all old app windows to close. Never interrupt edits.
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const names=await caches.keys();await Promise.all(names.filter(name=>name.startsWith(CACHE_PREFIX)&&name!==CACHE_NAME).map(name=>caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',event=>{
  const request=event.request;if(request.method!=='GET')return;
  const url=new URL(request.url);if(url.origin!==APP_SCOPE.origin||url.search||url.hash)return;
  if(request.mode==='navigate'&&isHome(url.href)){event.respondWith(navigation(event));return;}
  const kind=ASSETS.get(url.href);if(kind)event.respondWith(asset(event,kind));
});
