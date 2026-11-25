const V='ward-v8';
const SHELL=['./','index.html','style.css','app.js','pages.js','manifest.webmanifest','icon-192.png','icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin)return; // never cache Supabase
  e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(V).then(x=>x.put(e.request,c));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('index.html'))));
});

self.addEventListener('push',e=>{let d={};try{d=e.data.json()}catch(_){d={title:'مُتَرَبِّي',body:e.data?e.data.text():''}}e.waitUntil(self.registration.showNotification(d.title||'مُتَرَبِّي',{body:d.body||'',icon:'icon-192.png',badge:'icon-192.png',dir:'rtl',lang:'ar',data:{url:d.url||'./'}}))});
self.addEventListener('notificationclick',e=>{e.notification.close();const u=new URL((e.notification.data&&e.notification.data.url)||'./',self.registration.scope).href;e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(l=>{for(const c of l){if('focus' in c){c.navigate(u);return c.focus()}}return clients.openWindow(u)}))});
