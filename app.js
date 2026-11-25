'use strict';
const SB = 'https://qieauxaywwapmmgnihih.supabase.co';
const KEY = 'sb_publishable_OuIXX5yXgJUy0UmrfTkoDw_vV4PrAup';
const TENANT = '067b7aa1-aac1-4255-9e4c-aa865b88bda3';
const $app = document.getElementById('app');

/* ---------- helpers ---------- */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const today = () => ymd(new Date());
const AR = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
const n2a = n => String(n).replace(/\d/g, d => AR[d]);
const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const CATS = { obligations: 'الفرائض', worship: 'العبادات', dhikr: 'الأذكار', quran: 'القرآن' };
const CAT_EMO = { obligations: '🕌', worship: '🌙', dhikr: '📿', quran: '📖' };
const CATEGORY = { member: 'عضو', father: 'أب', mother: 'أم', boy: 'ولد', girl: 'بنت', sheikh: 'شيخ' };
let toastT;
function toast(m) { const t = document.getElementById('toast'); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 2800); }

/* ---------- auth + api ---------- */
let S = null; try { S = JSON.parse(localStorage.getItem('ward_s') || 'null'); } catch (e) { }
let me = null; // profile
function saveS(s) { S = s; if (s) localStorage.setItem('ward_s', JSON.stringify(s)); else localStorage.removeItem('ward_s'); }
function setSession(j) { saveS({ at: j.access_token, rt: j.refresh_token, exp: Date.now() + (j.expires_in || 3600) * 1000 - 60000, uid: j.user && j.user.id || (S && S.uid), email: j.user && j.user.email || (S && S.email) }); }
async function refresh() {
  if (!S || !S.rt) return false;
  const r = await fetch(SB + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: S.rt }) });
  if (!r.ok) { saveS(null); return false; }
  setSession(await r.json()); return true;
}
async function api(path, o = {}) {
  if (S && Date.now() > S.exp) await refresh();
  const h = { apikey: KEY, 'Content-Type': 'application/json', ...(o.headers || {}) };
  if (S) h.Authorization = 'Bearer ' + S.at;
  const r = await fetch(SB + path, { method: o.method || 'GET', headers: h, body: o.body ? JSON.stringify(o.body) : undefined });
  const txt = await r.text(); let j = null; try { j = txt ? JSON.parse(txt) : null; } catch (e) { }
  if (!r.ok) { const e = new Error((j && (j.message || j.msg || j.error_description || j.error)) || ('HTTP ' + r.status)); e.status = r.status; e.body = j; throw e; }
  return j;
}
const q = (t, params) => api('/rest/v1/' + t + (params ? '?' + params : ''));
const ins = (t, row, extra) => api('/rest/v1/' + t, { method: 'POST', body: row, headers: { Prefer: 'return=representation' + (extra || '') } });
const upd = (t, filter, row) => api('/rest/v1/' + t + '?' + filter, { method: 'PATCH', body: row, headers: { Prefer: 'return=representation' } });
const del = (t, filter) => api('/rest/v1/' + t + '?' + filter, { method: 'DELETE' });
const rpc = (f, a) => api('/rest/v1/rpc/' + f, { method: 'POST', body: a || {} });
function errAr(e) {
  const m = (e && e.message) || '';
  if (/Invalid login/i.test(m)) return 'البريد أو كلمة المرور غير صحيحة';
  if (/Email not confirmed/i.test(m)) return 'لازم تفعّل بريدك أولًا من الرسالة اللي وصلتك';
  if (/already registered|already been registered/i.test(m)) return 'البريد مسجل من قبل، جرّب تسجيل الدخول';
  if (/Password should be/i.test(m)) return 'كلمة المرور قصيرة (٦ حروف على الأقل)';
  if (/rate limit|too many/i.test(m)) return 'محاولات كثيرة، استنى شوية وجرّب تاني';
  if (/sheikh_exists/.test(m)) return 'يوجد شيخ مفعّل بالفعل';
  if (/email_not_confirmed/.test(m)) return 'فعّل بريدك أولًا';
  return m || 'حدث خطأ';
}

/* ---------- routing ---------- */
let route = '/', ctx = {};
function go(p) { location.hash = '#' + p; }
window.addEventListener('hashchange', render);
function isStaff() { return me && (me.role === 'sheikh' || me.role === 'super_admin'); }

/* ---------- reminders (web push) ---------- */
const VAPID_PUB = 'BBZJdy5-CMO6V7L4qrQ9gmdPncigkz_2uki4aENfG8pK2qztLzZ3ztme6Y6iNhhCwPJenTHFDYIKPUgo7h42DPo';
const u8 = b => { const p = '='.repeat((4 - b.length % 4) % 4), s = atob((b + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...s].map(c => c.charCodeAt(0))); };
const RKEYS = [['wird', 'ri-book-open-line', 'تذكير ورد اليوم', 'كل يوم الساعة ٨:٣٠ مساءً'], ['prayers', 'ri-time-line', 'أذكار بعد كل صلاة', 'بعد الأذان بـ١٠ دقائق، من حصن المسلم (توقيت القاهرة)'], ['monthu', 'ri-moon-line', 'صيام الاثنين والخميس', 'تنبيه الليلة السابقة الساعة ٩ مساءً'], ['whitedays', 'ri-contrast-2-line', 'الأيام البيض', '١٣ و١٤ و١٥ من كل شهر هجري']];
function pushState() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent), standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return ios && !standalone ? 'ios-install' : 'unsupported';
  return Notification.permission;
}
async function viewReminders() {
  let prefs = { wird: true, prayers: true, monthu: true, whitedays: true }; let sub = null;
  try { const r = await q('reminder_prefs', 'select=*&user_id=eq.' + S.uid); if (r[0]) prefs = r[0]; } catch (e) { }
  try { const reg = await navigator.serviceWorker.ready; sub = await reg.pushManager.getSubscription(); } catch (e) { }
  const st = pushState(), on = !!sub && st === 'granted';
  const msg = st === 'ios-install' ? 'على الآيفون: افتح الموقع في Safari، اضغط مشاركة ثم "إضافة إلى الشاشة الرئيسية"، وافتح التطبيق من الأيقونة، ثم فعّل الإشعارات.' : st === 'unsupported' ? 'هذا المتصفح لا يدعم الإشعارات.' : st === 'denied' ? 'الإشعارات محظورة لهذا الموقع. فعّلها من إعدادات المتصفح أو الهاتف.' : '';
  const row = ([k, ic, t, s]) => `<li class="flex items-center gap-3 px-4 py-3"><span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-700"><i class="${ic} text-[14px]"></i></span><span class="min-w-0 flex-1"><span class="block text-[12.5px] font-medium text-foreground-800">${t}</span><span class="block text-[10.5px] text-foreground-500">${s}</span></span><button data-k="${k}" role="switch" aria-checked="${!!prefs[k]}" style="position:relative;width:44px;height:24px;border-radius:9999px;border:0;flex-shrink:0;transition:background .2s;background:${prefs[k] ? '#0a5a38' : '#d9d3c4'}"><span style="position:absolute;top:2px;width:20px;height:20px;border-radius:9999px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:all .2s;${prefs[k] ? 'right:2px' : 'right:22px'}"></span></button></li>`;
  $app.innerHTML = shell(`<div class="space-y-4 md:space-y-5"><div><h2 class="font-heading text-2xl font-semibold text-foreground-900">الإشعارات والتذكيرات</h2><p class="mt-1 text-[12px] text-foreground-600">تصلك على هاتفك كإشعارات حقيقية.</p></div>
  <div class="rounded-xl border border-background-300 bg-white p-4"><div class="flex items-center justify-between gap-3"><div><p class="text-[13px] font-semibold text-foreground-800">إشعارات هذا الجهاز</p><p class="text-[11px] text-foreground-500">${on ? 'مفعّلة' : 'غير مفعّلة'}</p></div><button id="pushb" style="border-radius:10px;padding:8px 18px;font-size:12px;font-weight:600;${on ? 'background:#fff;border:1px solid #d9d3c4;color:#333' : 'background:#0a5a38;border:0;color:#fff'}">${on ? 'إيقاف' : 'تفعيل'}</button></div>${msg ? `<p style="margin-top:12px;border-radius:10px;background:#fbf3dc;padding:12px;font-size:11px;line-height:1.8;color:#6b4e08">${msg}</p>` : ''}${on ? '<button id="pusht" class="mt-3 text-[11.5px] font-medium text-primary-700 underline">أرسل إشعار تجربة</button>' : ''}</div>
  <ul class="divide-y divide-background-200 overflow-hidden rounded-xl border border-background-300 bg-white">${RKEYS.map(row).join('')}</ul>
  <p class="text-[10.5px] leading-6 text-foreground-500">المواقيت من خدمة Aladhan المجانية (القاهرة، الهيئة المصرية). الوصول بأفضل جهد وقد يتأخر قليلًا، خاصة مع توفير البطارية في أندرويد.</p></div>`);
  document.getElementById('pushb').onclick = async () => {
    try {
      if (on) { await sub.unsubscribe(); await api('/rest/v1/push_subs?endpoint=eq.' + encodeURIComponent(sub.endpoint), { method: 'DELETE' }); toast('تم الإيقاف'); return render(); }
      if (Notification.permission !== 'granted' && (await Notification.requestPermission()) !== 'granted') { toast('لم يتم السماح بالإشعارات'); return render(); }
      const reg = await navigator.serviceWorker.ready;
      const s = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: u8(VAPID_PUB) });
      const j = s.toJSON();
      await api('/rest/v1/push_subs?on_conflict=endpoint', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: { user_id: S.uid, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth } });
      await api('/rest/v1/reminder_prefs?on_conflict=user_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: { user_id: S.uid, ...prefs } });
      toast('تم التفعيل'); render();
    } catch (e) { toast('تعذّر التفعيل: ' + e.message); }
  };
  const tb = document.getElementById('pusht'); if (tb) tb.onclick = async () => { const reg = await navigator.serviceWorker.ready; reg.showNotification('تجربة التذكير', { body: 'الإشعارات تعمل على هذا الجهاز.', icon: 'icon-192.png', dir: 'rtl', lang: 'ar' }); };
  document.querySelectorAll('[data-k]').forEach(b => b.onclick = async () => {
    prefs[b.dataset.k] = !prefs[b.dataset.k];
    try { await api('/rest/v1/reminder_prefs?on_conflict=user_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: { user_id: S.uid, wird: prefs.wird, prayers: prefs.prayers, monthu: prefs.monthu, whitedays: prefs.whitedays } }); } catch (e) { toast('تعذّر الحفظ'); }
    b.setAttribute('aria-checked', prefs[b.dataset.k]); b.style.background = prefs[b.dataset.k] ? '#0a5a38' : '#d9d3c4'; const d = b.firstElementChild; d.style.right = prefs[b.dataset.k] ? '2px' : '22px';
  });
}

function tabs() { return ''; }

async function boot() {
  // email-confirmation / magic link returns tokens in the hash
  if (location.hash.includes('access_token=')) {
    const p = new URLSearchParams(location.hash.slice(1));
    if (p.get('type') === 'recovery') window.__recovery = true;
    if (p.get('access_token')) {
      saveS({ at: p.get('access_token'), rt: p.get('refresh_token'), exp: Date.now() + (+p.get('expires_in') || 3600) * 1000 - 60000 });
      history.replaceState(null, '', location.pathname);
      try { const u = await api('/auth/v1/user'); S.uid = u.id; S.email = u.email; saveS(S); } catch (e) { saveS(null); }
    }
  } else if (location.hash.includes('error_description')) {
    history.replaceState(null, '', location.pathname);
  }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
  if (window.__recovery && S) return viewNewPassword();
  render();
}

async function loadMe() {
  if (!S) { me = null; return; }
  if (!S.uid) { try { const u = await api('/auth/v1/user'); S.uid = u.id; S.email = u.email; saveS(S); } catch (e) { saveS(null); me = null; return; } }
  try {
    const r = await q('profiles', 'select=*&id=eq.' + S.uid);
    me = r[0] || null;
    if (me) rpc('touch_last_active').catch(() => { });
  } catch (e) { if (e.status === 401) { saveS(null); } me = null; }
}

async function render() {
  const p = (location.hash.slice(1) || '/');
  route = p.split('?')[0];
  if (!S) { return (route === '/register') ? viewRegister() : (route === '/login') ? viewLogin() : viewWelcome(); }
  if (!me) { await loadMe(); }
  if (!S) return viewWelcome();
  if (!me) return viewComplete();
  if (me.status !== 'active') return viewPending();
  try {
    if (route === '/') return await viewHome();
    if (route === '/ward') return await viewWard();
    if (route === '/ward/history') return await viewHistory();
    if (route === '/more') return await viewMore();
    if (route === '/progress') return await viewStatic('progress');
    if (route === '/seasons') return await viewStatic('seasons');
    if (route.startsWith('/seasons/')) return await viewStatic('season');
    if (route === '/group') return await viewRosterGroup();
    if (route === '/install') return await viewInstall();
    if (route === '/reminders') return await viewReminders();
    if (isStaff()) {
      if (route === '/sheikh') return await viewSheikh();
      if (route === '/sheikh/members') return await viewMembers();
      if (route.startsWith('/sheikh/member/')) return await viewMember(route.split('/')[3]);
      if (route === '/sheikh/roster') return await viewSheikhRoster();
      if (route === '/sheikh/requests') return await viewRequests();
      if (route === '/sheikh/promotions') return await viewPromotions();
      if (route === '/sheikh/wird') return await viewWirdMgmt();
    }
    return go('/');
  } catch (e) {
    if (e.status === 401) { saveS(null); return render(); }
    $app.innerHTML = `<div class="lg"><div class="page"><div class="card center"><p>تعذّر تحميل الصفحة</p><p class="err">${esc(errAr(e))}</p><button class="btn" onclick="render()">إعادة المحاولة</button></div></div></div>`;
  }
}

/* ---------- auth views ---------- */
const RA_CSS = `<style>
.ra{min-height:100vh;background:oklch(var(--background-100));display:flex;flex-direction:column;align-items:center;padding:28px 18px 40px;font-family:var(--font-body)}
.ra .brand{width:64px;height:64px;border-radius:18px;background:oklch(var(--primary-800));color:oklch(var(--accent-300));display:flex;align-items:center;justify-content:center;font-family:var(--font-heading);font-size:26px;font-weight:700;margin-top:18px;box-shadow:0 6px 18px oklch(var(--primary-800)/.25)}
.ra h2{font-family:var(--font-heading);font-size:21px;margin:14px 0 4px;color:oklch(var(--primary-900))}
.ra .sub{font-size:13px;opacity:.7;margin:0 0 18px;text-align:center}
.ra .box{width:100%;max-width:420px}
.ra .card,.ra form.card{background:oklch(var(--background-50));border:1px solid oklch(var(--background-300));border-radius:16px;padding:18px;box-shadow:0 1px 2px rgba(0,0,0,.04)}
.ra label{display:block;font-size:12px;font-weight:600;margin:12px 0 5px;color:oklch(var(--primary-900))}
.ra input,.ra select,.ra textarea{width:100%;box-sizing:border-box;font:inherit;font-size:15px;padding:11px 12px;border-radius:12px;border:1px solid oklch(var(--background-300));background:#fff}
.ra input:focus,.ra select:focus,.ra textarea:focus{outline:2px solid oklch(var(--primary-400));border-color:transparent}
.ra .btn{display:block;width:100%;box-sizing:border-box;margin-top:16px;padding:12px;border:0;border-radius:12px;font:inherit;font-weight:700;font-size:15px;background:oklch(var(--primary-700));color:#fff;text-align:center;text-decoration:none;cursor:pointer}
.ra .btn.sec{background:transparent;color:oklch(var(--primary-800));border:1px solid oklch(var(--primary-300))}
.ra .err{color:#b91c1c;font-size:13px;margin-top:8px;min-height:1px}
.ra .muted{opacity:.7}.ra .small{font-size:12px}.ra .center{text-align:center}
.ra .lnk{color:oklch(var(--primary-700));font-weight:700;text-decoration:none}
.ra p.center{font-size:13px;margin-top:14px}
.ra .feat{display:flex;gap:12px;align-items:center;padding:12px 14px;border:1px solid oklch(var(--background-300));border-radius:14px;background:oklch(var(--background-50));margin-bottom:10px;font-size:14px}
.ra .feat i{width:36px;height:36px;border-radius:10px;background:oklch(var(--primary-100));color:oklch(var(--primary-700));display:flex;align-items:center;justify-content:center;font-size:18px;flex:none}
</style>`;
function authShell(inner, head) { return `${RA_CSS}<div class="ra"><div class="box"><div style="display:flex;flex-direction:column;align-items:center"><div class="brand">م</div><h2>مُتَرَبِّي</h2><p class="sub">${head || 'منصة متابعة الورد والتربية الإيمانية'}</p></div>${inner}</div></div>`; }
function viewWelcome() {
  $app.innerHTML = authShell(`<div style="margin-top:6px"><div class="feat"><i class="ri-checkbox-circle-line"></i><div><b>ورد يومي منظّم</b><div class="muted small">سجّل أورادك كل يوم في ثوانٍ</div></div></div><div class="feat"><i class="ri-notification-3-line"></i><div><b>تذكيرات على الفون</b><div class="muted small">الورد، أذكار بعد الصلاة، وصيام الاثنين والخميس والأيام البيض</div></div></div><div class="feat"><i class="ri-group-line"></i><div><b>مجموعتك ومتابعة الشيخ</b><div class="muted small">تقدّمك وترتيبك وسط إخوانك</div></div></div></div><a class="btn" href="#/login">تسجيل الدخول</a><a class="btn sec" href="#/register">إنشاء حساب جديد</a>`, 'أهلًا بك. السلام عليكم ورحمة الله');
}
function viewLogin() {
  $app.innerHTML = authShell(`<form class="card" id="f"><label>البريد الإلكتروني</label><input name="email" type="email" autocomplete="username" required dir="ltr"><label>كلمة المرور</label><input name="password" type="password" autocomplete="current-password" required dir="ltr"><div class="err" id="e"></div><button class="btn block">تسجيل الدخول</button><p class="center" style="margin:12px 0 0"><a class="lnk" href="#" id="fp">نسيت كلمة المرور؟</a></p></form><p class="center">ما عندكش حساب؟ <a class="lnk" href="#/register">إنشاء حساب</a></p>`);
  document.getElementById('fp').onclick = async ev => {
    ev.preventDefault(); const em = (document.querySelector('[name=email]').value || '').trim(), e = document.getElementById('e');
    if (!em) { e.textContent = 'اكتب بريدك أولًا ثم اضغط نسيت كلمة المرور'; return; }
    try { await fetch(SB + '/auth/v1/recover?redirect_to=' + encodeURIComponent(location.origin + location.pathname), { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: em }) }); e.style.color = '#166534'; e.textContent = 'لو البريد مسجّل هتوصلك رسالة لتغيير كلمة المرور.'; } catch (x) { e.textContent = errAr(x); }
  };
  document.getElementById('f').onsubmit = async ev => {
    ev.preventDefault(); const f = new FormData(ev.target), b = ev.target.querySelector('button'); b.disabled = true; document.getElementById('e').textContent = '';
    try {
      const r = await fetch(SB + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: f.get('email').trim(), password: f.get('password') }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.msg || j.error_description || j.error || 'error');
      setSession(j); me = null; go('/'); render();
    } catch (e) { document.getElementById('e').textContent = errAr(e); b.disabled = false; }
  };
}
async function groupsOptions() { try { const g = await q('tarbiyah_groups', 'select=id,name&order=name'); return g; } catch (e) { return []; } }
async function viewRegister() {
  const groups = await groupsOptions();
  $app.innerHTML = authShell(`<form class="card" id="f"><label>الاسم الكامل</label><input name="name" required>
<label>البريد الإلكتروني</label><input name="email" type="email" required dir="ltr"><label>كلمة المرور (٦ حروف على الأقل)</label><input name="password" type="password" minlength="6" required dir="ltr" autocomplete="new-password">
<label>النوع</label><select name="gender"><option value="male">ذكر</option><option value="female">أنثى</option></select>
<label>الفئة</label><select name="category">${['member', 'father', 'mother', 'boy', 'girl'].map(c => `<option value="${c}">${CATEGORY[c]}</option>`).join('')}</select>
<label>الحلقة</label><select name="group"><option value="">— اختر —</option>${groups.map(g => `<option value="${g.id}">${esc(g.name)}</option>`).join('')}</select>
<label>ملاحظة (اختياري)</label><textarea name="note" rows="2"></textarea><div class="err" id="e"></div><button class="btn block">إنشاء الحساب</button></form><p class="center">عندك حساب؟ <a class="lnk" href="#/login">دخول</a></p>`);
  document.getElementById('f').onsubmit = async ev => {
    ev.preventDefault(); const f = new FormData(ev.target), b = ev.target.querySelector('button'); b.disabled = true; const e = document.getElementById('e'); e.textContent = '';
    const reg = { name: f.get('name').trim(), gender: f.get('gender'), category: f.get('category'), group: f.get('group') || null, note: f.get('note').trim() };
    try {
      const redirect = location.origin + location.pathname;
      const r = await fetch(SB + '/auth/v1/signup?redirect_to=' + encodeURIComponent(redirect), { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: f.get('email').trim(), password: f.get('password') }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.msg || j.error_description || j.error || 'error');
      localStorage.setItem('ward_reg_' + f.get('email').trim().toLowerCase(), JSON.stringify(reg));
      if (j.access_token) { setSession(j); me = null; go('/'); render(); return; }
      $app.innerHTML = authShell(`<div class="card center"><h3>تم إنشاء الحساب</h3><p>أرسلنا رسالة تفعيل إلى <b dir="ltr">${esc(f.get('email'))}</b>. افتح الرسالة واضغط الرابط، ثم سجّل الدخول.</p><p class="muted small">لو الرسالة ما وصلتش، شوف مجلد الرسائل غير المرغوبة.</p><a class="btn block" href="#/">تسجيل الدخول</a></div>`);
    } catch (er) { e.textContent = errAr(er); b.disabled = false; }
  };
}
async function viewComplete() {
  const groups = await groupsOptions();
  let saved = {}; try { saved = JSON.parse(localStorage.getItem('ward_reg_' + (S.email || '').toLowerCase()) || '{}'); } catch (e) { }
  $app.innerHTML = authShell(`<form class="card" id="f"><h3>إكمال التسجيل</h3><p class="muted">بياناتك هتتراجع من الشيخ قبل التفعيل.</p>
<label>الاسم الكامل</label><input name="name" required value="${esc(saved.name || '')}">
<label>النوع</label><select name="gender"><option value="male" ${saved.gender === 'male' ? 'selected' : ''}>ذكر</option><option value="female" ${saved.gender === 'female' ? 'selected' : ''}>أنثى</option></select>
<label>الفئة</label><select name="category">${['member', 'father', 'mother', 'boy', 'girl'].map(c => `<option value="${c}" ${saved.category === c ? 'selected' : ''}>${CATEGORY[c]}</option>`).join('')}</select>
<label>الحلقة</label><select name="group"><option value="">— اختر —</option>${groups.map(g => `<option value="${g.id}" ${saved.group === g.id ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}</select>
<label>ملاحظة (اختياري)</label><textarea name="note" rows="2">${esc(saved.note || '')}</textarea><div class="err" id="e"></div><button class="btn block">إرسال الطلب</button><button type="button" class="btn sec block" style="margin-top:8px" id="lo">تسجيل الخروج</button></form>`);
  document.getElementById('lo').onclick = logout;
  document.getElementById('f').onsubmit = async ev => {
    ev.preventDefault(); const f = new FormData(ev.target), b = ev.target.querySelector('button'); b.disabled = true; const e = document.getElementById('e'); e.textContent = '';
    try {
      const gid = f.get('group') || null; const gname = gid ? (groups.find(g => g.id === gid) || {}).name : null;
      await ins('profiles', { id: S.uid, tenant_id: TENANT, full_name: f.get('name').trim(), email: S.email, gender: f.get('gender'), category: f.get('category'), group_id: gid, status: 'pending', role: 'member' });
      await ins('membership_requests', { tenant_id: TENANT, user_id: S.uid, full_name: f.get('name').trim(), email: S.email, gender: f.get('gender'), category: f.get('category'), group_id: gid, group_name: gname, note: f.get('note').trim() || null, status: 'pending' });
      me = null; render();
    } catch (er) { e.textContent = errAr(er); b.disabled = false; }
  };
}
async function logout() { saveS(null); me = null; go('/'); render(); }
async function viewPending() {
  const rejected = me.status === 'archived' || me.status === 'suspended';
  $app.innerHTML = authShell(`<div class="card center"><h3>${rejected ? 'الحساب غير مفعّل' : 'طلبك قيد المراجعة'}</h3><p>${rejected ? 'تواصل مع الشيخ للمراجعة.' : 'أهلًا ' + esc(me.full_name) + '، الشيخ هيراجع طلبك ويفعّل حسابك قريبًا.'}</p>
<button class="btn block" id="rf">تحديث الحالة</button>
<details style="margin-top:14px"><summary class="muted">أنا الشيخ المسؤول (تفعيل أول مرة)</summary><p class="muted small">يعمل مرة واحدة فقط لو لا يوجد شيخ مفعّل بعد.</p><button class="btn sec block" id="cs">تفعيل صلاحية الشيخ</button><div class="err" id="e"></div></details>
<button class="btn sec block" style="margin-top:14px" id="lo">تسجيل الخروج</button></div>`);
  document.getElementById('rf').onclick = async () => { me = null; await loadMe(); render(); };
  document.getElementById('lo').onclick = logout;
  document.getElementById('cs').onclick = async () => { try { await rpc('claim_sheikh_role'); me = null; await loadMe(); toast('تم تفعيل صلاحية الشيخ'); go('/sheikh'); render(); } catch (e) { document.getElementById('e').textContent = errAr(e); } };
}

/* ---------- data shared ---------- */
async function loadActivities() { return await q('wird_activities', 'select=*&is_active=eq.true&order=order_index.asc,created_at.asc'); }
async function loadDay(uid, date) {
  const [logs, parts] = await Promise.all([q('wird_logs', `select=*&member_id=eq.${uid}&log_date=eq.${date}`), q('wird_part_logs', `select=*&member_id=eq.${uid}&log_date=eq.${date}&completed=eq.true`)]);
  return { logs, parts };
}
function actState(a, day) {
  const log = day.logs.find(l => l.activity_id === a.id);
  if (a.type === 'toggle') return { done: !!(log && log.completed), val: 0, total: 1 };
  if (a.type === 'counter') { const v = log ? log.counter_value : 0, t = a.target_count || 1; return { done: v >= t, val: v, total: t }; }
  const n = a.quran_parts || 1, got = day.parts.filter(p => p.activity_id === a.id).map(p => p.part_index); return { done: got.length >= n, val: got.length, total: n, got };
}
async function setLog(a, completed, counter) {
  return api('/rest/v1/wird_logs?on_conflict=member_id,activity_id,log_date', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: { tenant_id: TENANT, member_id: me.id, activity_id: a.id, log_date: today(), completed, counter_value: counter, recorded_at: new Date().toISOString() } });
}

/* ---------- Readdy-style shell & member views ---------- */
const NAV = [['/', 'ri-home-line', 'الرئيسية'], ['/ward', 'ri-checkbox-circle-line', 'وردي'], ['/progress', 'ri-line-chart-line', 'تقدمي'], ['/seasons', 'ri-calendar-line', 'المواسم'], ['/group', 'ri-group-line', 'مجموعتي'], ['/more', 'ri-menu-line', 'المزيد']];
const navOn = (r, p) => p === '/' ? r === '/' : (r === p || r.startsWith(p + '/') || (p === '/more' && r.startsWith('/sheikh')) || (p === '/ward' && r === '/ward/history'));
const fG = new Intl.DateTimeFormat('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fH = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' });
const fW = new Intl.DateTimeFormat('ar-EG', { weekday: 'long' });
let lastStreak = 0, bellOpen = false;
const NOTIFS = [['ri-trophy-line', 'bg-accent-100 text-accent-800', 'أنت مؤهل للانتقال إلى المرحلة الأولى', 'استوفيت شروط المرحلة التمهيدية، وبانتظار اعتماد الشيخ.', 'قبل ساعة', 1], ['ri-calendar-line', 'bg-primary-100 text-primary-800', 'بقي ٩ أيام على انتهاء موسم الست من شوال', 'أكملت ٤ أيام من ٦، وترتيبك الرابع في المجموعة.', 'قبل ٣ ساعات', 1], ['ri-notification-3-line', 'bg-secondary-100 text-secondary-800', 'إعلان جديد من شيخك', 'مجلس التربية الأسبوعي مساء الخميس بعد العشاء.', 'أمس', 1], ['ri-time-line', 'bg-background-200 text-foreground-700', 'تذكير بورد اليوم', 'لم تُسجّل أذكار المساء بعد. الورد بانتظارك.', 'أمس', 0]];
function shell(inner, opts = {}) {
  const r = route, d = new Date(), init = esc((me.full_name || 'م').trim()[0] || 'م');
  const nl = (c) => NAV.map(([p, i, l]) => c(p, i, l, navOn(r, p)));
  const side = nl((p, i, l, on) => `<li><a class="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors duration-smooth ${on ? 'bg-primary-50 font-medium text-primary-800' : 'text-foreground-700 hover:bg-background-100 hover:text-foreground-900'}" href="#${p}"><span class="flex h-8 w-8 items-center justify-center rounded-md ${on ? 'bg-primary-100 text-primary-700' : 'bg-background-100 text-foreground-500'}"><i class="${i} text-base"></i></span><span class="whitespace-nowrap">${l}</span>${on ? '<span class="mr-auto h-1.5 w-1.5 rounded-full bg-accent-500"></span>' : ''}</a></li>`).join('');
  const bot = nl((p, i, l, on) => `<li class="min-w-0"><a class="group flex cursor-pointer flex-col items-center gap-0.5 rounded-md px-1 py-1.5 transition-colors duration-smooth ${on ? 'text-primary-700' : 'text-foreground-500 hover:text-primary-600'}" href="#${p}"><span class="flex h-8 w-8 items-center justify-center rounded-md transition-colors duration-smooth ${on ? 'bg-primary-100' : 'bg-transparent group-hover:bg-background-200'}"><i class="${i} text-[17px] leading-none"></i></span><span class="whitespace-nowrap text-[10px] font-medium leading-tight">${l}</span></a></li>`).join('');
  const notes = NOTIFS.map(([ic, cl, t, s, w, u]) => `<li class="flex gap-3 px-4 py-3 transition-colors duration-smooth hover:bg-background-100"><span class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${cl}"><i class="${ic} text-sm"></i></span><div class="min-w-0 flex-1"><div class="flex items-start justify-between gap-2"><p class="text-[13px] font-medium leading-snug text-foreground-900">${t}</p>${u ? '<span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500"></span>' : ''}</div><p class="mt-0.5 text-[11px] leading-relaxed text-foreground-600">${s}</p><p class="mt-1 text-[10px] text-foreground-400">${w}</p></div></li>`).join('');
  const sub = (me.group_name || 'بدون حلقة');
  return `<div class="min-h-[100dvh] w-full overflow-x-clip bg-background-100"><div class="mx-auto flex w-full max-w-[1600px]">
<aside class="sticky top-0 hidden h-screen w-[272px] shrink-0 flex-col border-l border-background-200 bg-background-50 lg:flex"><div class="px-5 pb-5 pt-6"><a class="flex cursor-pointer items-center gap-3" href="#/"><span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-700 font-heading text-[15px] font-semibold text-accent-200">م</span><span class="min-w-0"><span class="block font-heading text-[15px] font-semibold text-foreground-950">مُتَرَبِّي</span><span class="block truncate text-[11px] text-foreground-500">منصة التربية والورد اليومي</span></span></a></div>
<nav class="flex-1 overflow-y-auto px-3 no-scrollbar"><p class="px-3 pb-2 text-[11px] font-medium tracking-wide text-foreground-400">القائمة الرئيسية</p><ul class="space-y-1">${side}</ul></nav>
<div class="space-y-3 px-4 pb-5">${lastStreak > 0 ? `<div class="rounded-lg border border-accent-200/80 bg-accent-50 p-3.5"><div class="flex items-center gap-2 text-accent-800"><span class="flex h-6 w-6 items-center justify-center"><i class="ri-fire-line text-base"></i></span><p class="text-xs font-semibold">${lastStreak} يومًا متتاليًا</p></div><p class="mt-1.5 text-[11px] leading-relaxed text-accent-900/80">استمر على وردك اليومي، فالقليل الدائم خير من الكثير المنقطع.</p></div>` : ''}
<a class="flex cursor-pointer items-center gap-3 rounded-lg border border-background-200 bg-background-50 p-3 transition-colors duration-smooth hover:bg-background-100" href="#/more"><span class="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 font-heading text-sm font-semibold text-primary-800">${init}</span><span class="min-w-0 flex-1"><span class="block truncate text-[13px] font-medium text-foreground-900">${esc(me.full_name)}</span><span class="block truncate text-[11px] text-foreground-500">${esc(sub)}</span></span><span class="flex h-6 w-6 items-center justify-center text-foreground-400"><i class="ri-arrow-left-s-line text-base"></i></span></a></div></aside>
<div class="flex min-h-[100dvh] w-full min-w-0 flex-1 flex-col"><header class="sticky top-0 z-30 border-b border-background-200 bg-background-100/90 backdrop-blur-md"><div class="mx-auto flex w-full max-w-[1180px] items-center justify-between gap-3 px-4 py-3 md:px-8"><div class="flex min-w-0 items-center gap-2.5"><a class="flex cursor-pointer items-center gap-2 lg:hidden" href="#/"><span class="flex h-8 w-8 items-center justify-center rounded-md bg-primary-700 font-heading text-[11px] font-semibold text-accent-200">م</span><span class="font-heading text-[13px] font-semibold text-foreground-950">مُتَرَبِّي</span></a><div class="hidden min-w-0 lg:block"><p class="font-heading text-[13px] font-semibold text-foreground-900">${fW.format(d)} · ${fH.format(d)}</p><p class="text-[11px] text-foreground-500">${fG.format(d)}</p></div></div>
<div class="flex items-center gap-2"><span class="hidden items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 px-2.5 py-1 text-[10.5px] text-primary-800 md:inline-flex"><i class="ri-verified-badge-line text-[12px]"></i>حساب معتمد</span>
<div class="relative"><button type="button" id="bellb" class="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-background-200 bg-background-50 text-foreground-700 transition-colors duration-smooth hover:bg-background-200" aria-label="الإشعارات"><i class="ri-notification-3-line text-base"></i><span class="absolute -top-1 -left-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-500 px-1 text-[9px] font-semibold text-accent-950">3</span></button>
<div id="bellp" style="display:none"><div id="bello" class="fixed inset-0 z-40"></div><div class="fixed inset-x-3 top-[68px] z-50 overflow-hidden rounded-lg border border-background-200 bg-background-50 md:absolute md:inset-x-auto md:left-0 md:top-full md:mt-2 md:w-[370px]"><div class="flex items-center justify-between border-b border-background-200 px-4 py-3"><div><p class="font-heading text-sm font-semibold text-foreground-950">الإشعارات</p><p class="text-[11px] text-foreground-500">آخر التحديثات على وردك ومرحلتك</p></div><button type="button" id="bellc" class="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-foreground-500 hover:bg-background-100" aria-label="إغلاق الإشعارات"><i class="ri-close-line text-base"></i></button></div><ul class="max-h-[60vh] divide-y divide-background-200 overflow-y-auto no-scrollbar">${notes}</ul><div class="border-t border-background-200 bg-background-100 px-4 py-2.5 text-center"><p class="text-[11px] text-foreground-500">عيّنة توضيحية: الإشعارات الحقيقية تأتي مع تفعيل التذكيرات</p></div></div></div></div>
<a class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-primary-100 font-heading text-[13px] font-semibold text-primary-800 transition-colors duration-smooth hover:bg-primary-200" aria-label="حسابي" href="#/more">${init}</a></div></div></header>
<main class="mx-auto w-full max-w-[1180px] flex-1 px-4 pb-28 pt-5 md:px-8 md:pt-7 lg:pb-14">${inner}</main></div></div>
<nav class="fixed inset-x-0 bottom-0 z-40 border-t border-background-200 bg-background-50/95 backdrop-blur-md lg:hidden"><ul class="mx-auto grid max-w-2xl grid-cols-6 items-stretch px-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1.5">${bot}</ul></nav>`;
}
function draw(inner) {
  $app.innerHTML = shell(inner); window.scrollTo(0, 0);
  bellOpen = false;
}
document.addEventListener('click', e => {
  const p = document.getElementById('bellp'); if (!p) return;
  const hit = id => e.target.closest && e.target.closest('#' + id);
  if (hit('bellb')) { bellOpen = !bellOpen; p.style.display = bellOpen ? 'block' : 'none'; }
  else if ((hit('bello') || hit('bellc')) && bellOpen) { bellOpen = false; p.style.display = 'none'; }
});
const wrapS = inner => `<div class="space-y-4 md:space-y-5">${inner}</div>`;
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
const UNIT = a => a.target_unit || 'مرة';
function iconFor(a) { const t = a.title || ''; if (/قرآن/.test(t) || a.type === 'quran') return 'ri-book-open-line'; if (/صباح|مساء/.test(t)) return 'ri-sun-line'; if (/استغفار/.test(t)) return 'ri-heart-3-line'; if (/النبي/.test(t)) return 'ri-heart-line'; if (/صلوات|فرائض|جماعة/.test(t) || a.category === 'obligations') return 'ri-star-line'; if (a.category === 'worship') return 'ri-moon-line'; return 'ri-heart-line'; }
const CAT_SUB = { obligations: 'أساس الورد اليومي', quran: 'وردك اليومي من الكتاب', dhikr: 'حصن اليوم', worship: 'صلة يومك بالله' };
const CAT_ORDER = ['obligations', 'quran', 'dhikr', 'worship'];
function meta(a) { if (a.type === 'counter') return `الهدف ${n2a(a.target_count || 1)} ${esc(UNIT(a))}`; if (a.type === 'quran') return `الهدف ${n2a(a.quran_parts || 1)} ${a.quran_unit === 'pages' ? 'صفحات' : 'أجزاء'}`; return 'إتمام مرة واحدة'; }
async function loadMeCtx() {
  if (me.group_name === undefined) { me.group_name = ''; try { if (me.group_id) { const g = await q('tarbiyah_groups', 'select=name,sheikh_name&id=eq.' + me.group_id); me.group_name = g[0] ? g[0].name : ''; me.sheikh_name = g[0] ? g[0].sheikh_name : ''; } } catch (e) { } }
}
async function stats(acts) {
  const from = new Date(); from.setDate(from.getDate() - 60);
  const logs = await q('wird_logs', `select=log_date,completed,activity_id&member_id=eq.${me.id}&completed=eq.true&log_date=gte.${ymd(from)}&limit=2000`);
  const per = {}; logs.forEach(l => per[l.log_date] = (per[l.log_date] || 0) + 1);
  const tot = acts.length; let streak = 0; const d = new Date(); if (!(tot && per[ymd(d)] >= tot)) d.setDate(d.getDate() - 1);
  while (tot && per[ymd(d)] >= tot) { streak++; d.setDate(d.getDate() - 1); }
  let week = 0; for (let i = 0; i < 7; i++) { const x = new Date(); x.setDate(x.getDate() - i); week += tot ? Math.min(1, (per[ymd(x)] || 0) / tot) : 0; }
  let qual = 0; for (let i = 0; i < 30; i++) { const x = new Date(); x.setDate(x.getDate() - i); if (tot && (per[ymd(x)] || 0) / tot >= .8) qual++; }
  lastStreak = streak; return { per, streak, week: Math.round(week / 7 * 100), qual };
}
function sample(t) { return `<span class="inline-flex items-center rounded-full border border-accent-300 bg-accent-100 px-1.5 py-0.5 text-[9px] font-medium text-accent-900">${t || 'عيّنة'}</span>`; }

async function viewHome() {
  await loadMeCtx();
  const [acts, day, stages] = await Promise.all([loadActivities(), loadDay(me.id, today()), q('stages', 'select=*&order=order_index.asc')]);
  const st = await stats(acts);
  const total = acts.length, states = acts.map(a => [a, actState(a, day)]), done = states.filter(s => s[1].done).length, P = pct(done, total), rem = total - done;
  const cur = stages.find(s => s.id === me.stage_id) || stages[0] || { name: 'المرحلة التمهيدية', min_days: 30 }, ci = Math.max(0, stages.findIndex(s => s.id === cur.id));
  const need = cur.min_days || 30, elig = st.qual >= need;
  const todayLogs = day.logs.filter(l => l.recorded_at).map(l => new Date(l.recorded_at)).sort((a, b) => b - a)[0];
  const lastT = todayLogs ? `آخر تسجيل اليوم ${new Intl.DateTimeFormat('ar-EG', { hour: 'numeric', minute: '2-digit' }).format(todayLogs)}` : 'لم تسجّل شيئًا اليوم بعد';
  const cats = CAT_ORDER.map(c => { const l = states.filter(s => s[0].category === c); return { c, name: CATS[c], d: l.filter(s => s[1].done).length, t: l.length }; }).filter(x => x.t);
  const left = states.filter(s => !s[1].done);
  const stepper = (stages.length ? stages : [cur]).map((s, i) => `<li class="min-w-0 flex-1"><div class="flex items-center"><span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${i < ci ? 'bg-primary-600 text-background-50' : i === ci ? 'bg-accent-500 text-accent-950' : 'border border-background-300 bg-background-100 text-foreground-400'}">${i + 1}</span>${i < stages.length - 1 ? '<span class="mx-1 h-px flex-1 bg-background-300"></span>' : ''}</div><p class="mt-2 truncate text-[10.5px] leading-tight ${i === ci ? 'font-semibold text-primary-800' : 'text-foreground-400'}">${esc(s.name)}</p><p class="mt-0.5 text-[9.5px] text-foreground-400">${i < ci ? 'مكتملة' : i === ci ? 'الحالية' : 'مقفلة'}</p></li>`).join('');
  const card = (t, v, s, ic, cl, d, smp) => `<div class="animate-rise delay-${d} rounded-lg border border-background-200 bg-background-50 p-3.5 transition-colors duration-smooth hover:border-primary-200"><div class="flex items-start justify-between gap-2"><p class="text-[11px] text-foreground-500">${t}</p><span class="flex h-7 w-7 items-center justify-center rounded-md ${cl}"><i class="${ic} text-[13px]"></i></span></div><p class="num mt-2 text-xl font-semibold leading-none text-foreground-950 md:text-[22px]">${v}</p><p class="mt-1.5 truncate text-[10.5px] text-foreground-400">${s}${smp ? ' ' + sample() : ''}</p></div>`;
  draw(wrapS(`
<section class="animate-rise overflow-hidden rounded-lg border border-primary-800 bg-primary-800"><div class="pattern-emerald"><div class="flex flex-col gap-6 p-5 md:flex-row md:items-center md:justify-between md:gap-8 md:p-7"><div class="min-w-0"><span class="inline-flex items-center gap-1.5 rounded-full border border-accent-300/30 bg-accent-400/10 px-2.5 py-1 text-[11px] text-accent-200"><i class="ri-shield-check-line text-[13px]"></i>${esc(cur.name)} · ${esc(me.group_name || 'بدون حلقة')}</span>
<h1 class="mt-3 font-heading text-[22px] font-semibold leading-snug text-background-50 md:text-[28px]">السلام عليكم، ${esc(me.full_name.split(' ')[0])}</h1>
<p class="mt-1.5 max-w-[440px] text-[13px] leading-relaxed text-primary-100/85">${total ? (rem ? `بقي ${n2a(rem)} أوراد من ورد اليوم. خطوة صغيرة الآن، وأثر يبقى.` : 'ما شاء الله، أتممت ورد اليوم. ثبّتك الله.') : 'لم يضف الشيخ أوراد اليوم بعد.'}</p>
<div class="mt-5 flex flex-wrap items-center gap-2.5"><a class="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-md bg-accent-500 px-4 py-2.5 text-[13px] font-semibold text-accent-950 transition-colors duration-smooth hover:bg-accent-400" href="#/ward">متابعة ورد اليوم<i class="ri-arrow-left-line text-sm"></i></a><a class="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-primary-400/40 px-4 py-2.5 text-[13px] text-primary-50 transition-colors duration-smooth hover:bg-primary-700" href="#/progress">رحلتي في المراحل</a></div></div>
<div class="flex items-center gap-5 md:gap-6"><div class="relative shrink-0 rounded-full" role="img" aria-label="نسبة الإنجاز ${P} بالمئة" style="width:138px;height:138px;background:conic-gradient(oklch(var(--accent-400)) ${P}%, oklch(var(--primary-950) / 0.55) ${P}% 100%)"><div class="absolute flex flex-col items-center justify-center rounded-full bg-primary-800" style="inset:9px"><span class="num text-[26px] font-semibold leading-none text-background-50">${n2a(done)}<span class="text-[15px] text-primary-200">/${n2a(total)}</span></span><span class="mt-1.5 text-[10px] text-primary-200">أوراد اليوم</span></div></div>
<div class="space-y-2.5"><div><p class="num text-lg font-semibold leading-none text-background-50">${n2a(P)}%</p><p class="mt-1 text-[10.5px] text-primary-200">إنجاز اليوم</p></div><div class="h-px w-16 bg-primary-400/30"></div><div><p class="num text-lg font-semibold leading-none text-accent-300">${n2a(st.streak)}</p><p class="mt-1 text-[10.5px] text-primary-200">يوم متتالٍ</p></div></div></div></div></div>
<div class="flex flex-wrap items-center justify-between gap-2 border-t border-primary-900/60 px-5 py-2.5 md:px-7"><p class="flex items-center gap-1.5 text-[10.5px] text-primary-200/80"><i class="ri-time-line text-[12px]"></i>${lastT} · يُقفل تسجيل اليوم بعد منتصف الليل</p><p class="text-[10.5px] text-primary-200/70">${fH.format(new Date())}</p></div></section>
<div class="grid grid-cols-2 gap-3 md:grid-cols-4">${card('التزام الأسبوع', n2a(st.week) + '%', 'متوسط آخر ٧ أيام', 'ri-line-chart-line', 'bg-primary-100 text-primary-700', 1)}${card('أيام متتالية', n2a(st.streak), 'بدون انقطاع', 'ri-fire-line', 'bg-accent-100 text-accent-800', 2)}${card('ترتيب المجموعة', '٣/١٨', 'حسب التزام الشهر', 'ri-trophy-line', 'bg-secondary-100 text-secondary-700', 3, 1)}${card('الأيام المؤهلة', n2a(Math.min(st.qual, need)) + '/' + n2a(need), 'شروط الترقية', 'ri-shield-check-line', 'bg-primary-100 text-primary-700', 4)}</div>
<a class="animate-rise flex cursor-pointer flex-col gap-2 rounded-lg border border-accent-200 bg-accent-50 px-4 py-3 transition-colors duration-smooth hover:border-accent-300 sm:flex-row sm:items-center sm:justify-between" href="#/progress"><div class="flex items-start gap-2.5"><span class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent-500 text-accent-950"><i class="ri-trophy-line text-[14px]"></i></span><div><p class="text-[13px] font-semibold text-accent-950">${elig ? 'مؤهل للانتقال إلى ' + esc((stages[ci + 1] || cur).name) : 'في طريقك إلى ' + esc((stages[ci + 1] || cur).name)}</p><p class="text-[11px] text-accent-900/75">${elig ? `استوفيت ${n2a(Math.min(st.qual, need))} من ${n2a(need)} يومًا مؤهلاً · بانتظار اعتماد الشيخ` : `استوفيت ${n2a(st.qual)} من ${n2a(need)} يومًا مؤهلاً · يُحسب اليوم المؤهل عند إنجاز ٨٠٪ من الورد`}</p></div></div><span class="inline-flex shrink-0 items-center gap-1 text-[11.5px] font-medium text-accent-900">عرض شروط الترقية<i class="ri-arrow-left-s-line text-sm"></i></span></a>
<div class="grid gap-4 md:gap-5 lg:grid-cols-[1.55fr_1fr]"><div class="space-y-4 md:space-y-5">
<section class="rounded-lg border border-background-200 bg-background-50 p-4 md:p-5"><div class="mb-4 flex items-start justify-between gap-3"><div><h2 class="font-heading text-[15px] font-semibold text-foreground-950">رحلة المراحل</h2><p class="mt-0.5 text-[11.5px] text-foreground-500">أنت في ${esc(cur.name)} · المرحلة ${n2a(ci + 1)} من ${n2a(stages.length || 1)}</p></div><a class="inline-flex shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-md border border-background-300 px-2.5 py-1.5 text-[11px] text-foreground-700 transition-colors duration-smooth hover:border-primary-300 hover:text-primary-700" href="#/progress">التفاصيل<i class="ri-arrow-left-s-line text-sm"></i></a></div><ol class="flex items-start gap-1.5">${stepper}</ol></section>
<section class="rounded-lg border border-background-200 bg-background-50"><div class="flex items-start justify-between gap-3 border-b border-background-200 px-4 py-3.5 md:px-5"><div><h2 class="font-heading text-[15px] font-semibold text-foreground-950">ورد اليوم</h2><p class="mt-0.5 text-[11.5px] text-foreground-500">قالب معتمد من شيخك · لا يمكن تعديله</p></div><span class="num shrink-0 rounded-full bg-primary-50 px-2.5 py-1 text-[11px] font-medium text-primary-700">${n2a(done)} من ${n2a(total)}</span></div>
<div class="space-y-3.5 px-4 py-4 md:px-5">${cats.map(c => `<div><div class="flex items-center justify-between gap-2"><p class="text-[12.5px] font-medium text-foreground-800">${c.name}</p><p class="num text-[11px] text-foreground-500">${n2a(c.d)}/${n2a(c.t)}</p></div><div class="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-background-200"><div class="h-full rounded-full transition-all duration-smooth ${c.d === c.t ? 'bg-primary-500' : 'bg-accent-500'}" style="width:${pct(c.d, c.t)}%"></div></div></div>`).join('') || '<p class="text-[12px] text-foreground-500">لا توجد أوراد بعد.</p>'}</div>
<div class="border-t border-background-200 px-4 py-3.5 md:px-5">${left.length ? `<p class="mb-2 text-[11px] text-foreground-500">المتبقي من وردك</p><ul class="space-y-1.5">${left.map(([a]) => `<li class="flex items-center gap-2 text-[12px] text-foreground-700"><span class="flex h-4 w-4 items-center justify-center rounded-full border border-background-300"><span class="h-1.5 w-1.5 rounded-full bg-accent-500"></span></span><span class="min-w-0 flex-1 truncate">${esc(a.title)}</span><span class="num shrink-0 text-[10.5px] text-foreground-400">${meta(a)}</span></li>`).join('')}</ul>` : '<p class="text-[12px] text-primary-700">أتممت كل أوراد اليوم، بارك الله فيك.</p>'}<a class="mt-3 inline-flex w-full cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-primary-600 px-3 py-2.5 text-[12.5px] font-medium text-background-50 transition-colors duration-smooth hover:bg-primary-700" href="#/ward">فتح ورد اليوم<i class="ri-arrow-left-line text-[13px]"></i></a></div></section></div>
<div class="space-y-4 md:space-y-5">
<section class="overflow-hidden rounded-lg border border-accent-200 bg-accent-50"><div class="pattern-gold px-4 py-4"><div class="flex items-center justify-between gap-2"><span class="inline-flex items-center gap-1.5 rounded-full bg-accent-500 px-2.5 py-1 text-[10.5px] font-semibold text-accent-950"><i class="ri-calendar-line text-[11px]"></i>جارية الآن</span><span class="num text-[11px] text-accent-800">بقي ٩ أيام ${sample()}</span></div><h2 class="mt-2.5 font-heading text-[16px] font-semibold text-accent-950">صيام الست من شوال</h2><p class="mt-1 text-[11.5px] leading-relaxed text-accent-900/80">صيام ٦ أيام · ٤٦ مشاركًا</p><div class="mt-3.5 flex items-center gap-3"><div class="h-1.5 flex-1 overflow-hidden rounded-full bg-accent-200/70"><div class="h-full rounded-full bg-accent-600" style="width:67%"></div></div><span class="num shrink-0 text-[11px] font-medium text-accent-900">٦٧%</span></div><div class="mt-4 flex items-center justify-between gap-2"><div class="flex items-center gap-1.5 text-[11px] text-accent-900"><i class="ri-trophy-line text-[13px]"></i>ترتيبك ٤ من ٤٦</div><a class="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md bg-accent-950 px-3 py-1.5 text-[11.5px] font-medium text-accent-50 transition-colors duration-smooth hover:bg-accent-900" href="#/seasons/shawwal-six">التفاصيل<i class="ri-arrow-left-s-line text-sm"></i></a></div></div></section>
<section class="rounded-lg border border-background-200 bg-background-50"><div class="flex items-center justify-between gap-2 border-b border-background-200 px-4 py-3"><h2 class="flex items-center gap-2 font-heading text-[14px] font-semibold text-foreground-950">إعلانات شيخي ${sample()}</h2><a class="cursor-pointer text-[11px] text-primary-700 hover:underline" href="#/group">الكل</a></div><ul class="divide-y divide-background-200">${[['مجلس التربية الأسبوعي', 'يُعقد مجلس التربية هذا الأسبوع مساء الخميس بعد صلاة العشاء، والحضور جزء من متطلبات المرحلة.', 'الشيخ · أمس'], ['بدء التسجيل في موسم العشر من ذي الحجة', 'فُتح التسجيل في موسم العشر. يمكنك اختيار الأوراد التي ترغب بالمنافسة فيها قبل بداية الموسم.', 'إدارة الحلقة · قبل يومين'], ['تذكير بورد القرآن', 'من لم يكمل ورد القرآن اليوم فليبدأ بأقل القليل ولا يتركه، فالقليل الدائم خير من الكثير المنقطع.', 'الشيخ · قبل ٣ أيام']].map(a => `<li class="px-4 py-3 transition-colors duration-smooth hover:bg-background-100"><p class="text-[12.5px] font-medium text-foreground-900">${a[0]}</p><p class="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-foreground-500">${a[1]}</p><p class="mt-1 text-[10px] text-foreground-400">${a[2]}</p></li>`).join('')}</ul></section></div></div>
<p class="pt-1 text-center text-[10.5px] leading-relaxed text-foreground-400">الأقسام الموسومة بـ «عيّنة» بيانات توضيحية لحين تفعيل المواسم والترتيب. أورادك وتقدّمك محفوظة فعليًا في حسابك.</p>`));
}

/* ward */
let syncT;
function setSync(s) {
  const el = document.getElementById('sync'); if (!el) return; clearTimeout(syncT);
  const M = { idle: ['ri-save-3-line', 'يُحفظ تلقائيًا', 'border-primary-200 bg-primary-50 text-primary-800'], saving: ['ri-loader-4-line animate-spin', 'جارٍ الحفظ…', 'border-accent-200 bg-accent-50 text-accent-900'], ok: ['ri-check-line', 'تم الحفظ', 'border-primary-300 bg-primary-100 text-primary-800'], err: ['ri-error-warning-line', 'تعذّر الحفظ', 'border-background-300 bg-secondary-100 text-secondary-900'] }[s];
  el.className = 'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] ' + M[2]; el.innerHTML = `<i class="${M[0]} text-[11px]"></i>${M[1]}`;
  if (s === 'ok') syncT = setTimeout(() => setSync('idle'), 2000);
}
function wardArticle(a) {
  const st = actState(a, ctx.day), done = st.done, ic = iconFor(a);
  const badge = { toggle: 'إتمام بسيط', counter: 'عدّاد', quran: 'ورد قرآن' }[a.type];
  const head = `<div class="flex items-start gap-3"><span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${done ? 'bg-primary-100 text-primary-700' : 'bg-background-100 text-foreground-500'}"><i class="${ic} text-base"></i></span><div class="min-w-0 flex-1"><div class="flex flex-wrap items-center gap-x-2 gap-y-1"><h3 class="text-[13px] font-medium leading-snug ${done ? 'text-foreground-600' : 'text-foreground-950'}">${esc(a.title)}</h3><span class="rounded-full border border-background-300 bg-background-100 px-2 py-0.5 text-[10px] text-foreground-500">${badge}</span>${done ? '<span class="inline-flex items-center gap-0.5 rounded-full bg-primary-100 px-2 py-0.5 text-[10px] text-primary-800"><i class="ri-check-double-line text-[11px]"></i>مكتمل</span>' : ''}</div>${a.description ? `<p class="mt-1 text-[11px] leading-relaxed text-foreground-500">${esc(a.description)}</p>` : ''}<p class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px] text-foreground-500"><span class="num">${meta(a)}</span></p></div>`;
  const wrap = body => `<article class="rounded-lg border p-3.5 transition-colors duration-smooth ${done ? 'border-primary-200 bg-primary-50' : 'border-background-200 bg-background-50'}">${body}</article>`;
  if (a.type === 'toggle') return wrap(head + `<button type="button" data-a="${a.id}" data-k="t" aria-pressed="${done}" aria-label="${done ? 'إلغاء تسجيل ' : 'تسجيل '}${esc(a.title)}" class="mt-0.5 flex h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border px-3 text-[11.5px] transition-colors duration-smooth ${done ? 'border-primary-300 bg-primary-100 text-primary-800 hover:bg-primary-200' : 'border-background-300 bg-background-50 text-foreground-700 hover:border-primary-300 hover:bg-background-100'}"><i class="${done ? 'ri-check-line' : 'ri-add-line'} text-[13px]"></i>${done ? 'تم' : 'تسجيل'}</button></div>`);
  if (a.type === 'counter') return wrap(head + `</div><div class="mt-3 rounded-md border border-background-200 bg-background-100/70 p-2.5"><div class="flex items-center justify-between gap-2"><button type="button" data-a="${a.id}" data-k="m" ${st.val <= 0 ? 'disabled' : ''} aria-label="إنقاص عدد ${esc(a.title)}" class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-background-300 bg-background-50 text-foreground-700 transition-colors duration-smooth hover:bg-background-200 disabled:cursor-not-allowed disabled:opacity-40"><i class="ri-subtract-line text-[14px]"></i></button><div class="min-w-0 flex-1 text-center"><p class="num text-[16px] font-semibold leading-none text-foreground-950">${n2a(st.val)}<span class="text-[11px] font-normal text-foreground-400"> / ${n2a(st.total)}</span></p><p class="mt-1 text-[10px] text-foreground-500">الهدف اليومي ${n2a(st.total)} ${esc(UNIT(a))}</p></div><button type="button" data-a="${a.id}" data-k="p" aria-label="زيادة عدد ${esc(a.title)}" class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-primary-300 bg-primary-600 text-background-50 transition-colors duration-smooth hover:bg-primary-700"><i class="ri-add-line text-[14px]"></i></button></div><div class="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-background-200"><div class="h-full rounded-full bg-primary-500 transition-all duration-smooth" style="width:${Math.min(100, pct(st.val, st.total))}%"></div></div></div>`);
  const lbl = a.quran_unit === 'pages' ? 'الصفحة' : 'الجزء';
  return wrap(head + `</div><div class="mt-3"><p class="num text-[10.5px] text-foreground-500">سجّلت ${n2a(st.val)} من ${n2a(st.total)}</p><div class="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">${Array.from({ length: st.total }, (_, i) => { const on = st.got.includes(i); return `<button type="button" data-a="${a.id}" data-k="q" data-i="${i}" aria-pressed="${on}" class="flex cursor-pointer items-center justify-between gap-1.5 rounded-md border px-2.5 py-2 text-[11px] transition-colors duration-smooth ${on ? 'border-primary-300 bg-primary-100 text-primary-800' : 'border-background-300 bg-background-50 text-foreground-600 hover:border-primary-300 hover:bg-background-100'}"><span class="whitespace-nowrap">${lbl} ${n2a(i + 1)}</span><span class="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${on ? 'border-primary-600 bg-primary-600 text-background-50' : 'border-background-300 text-transparent'}"><i class="ri-check-line text-[10px]"></i></span></button>`; }).join('')}</div><div class="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-background-200"><div class="h-full rounded-full bg-primary-500 transition-all duration-smooth" style="width:${pct(st.val, st.total)}%"></div></div></div>`);
}
async function viewWard() {
  const [acts, day] = await Promise.all([loadActivities(), loadDay(me.id, today())]);
  ctx.acts = acts; ctx.day = day;
  const paint = () => {
    const sts = acts.map(a => actState(a, ctx.day)), done = sts.filter(s => s.done).length, partial = sts.filter(s => !s.done && s.val > 0).length, total = acts.length, P = pct(done, total), rem = total - done, d = new Date();
    const sec = CAT_ORDER.map(c => { const l = acts.filter(a => a.category === c); if (!l.length) return ''; const dn = l.filter(a => actState(a, ctx.day).done).length; return `<section class="animate-fade"><div class="mb-2 flex items-end justify-between gap-2 px-1"><div><h2 class="font-heading text-[13.5px] font-semibold text-foreground-950">${CATS[c]}</h2><p class="text-[10.5px] text-foreground-400">${CAT_SUB[c]}</p></div><p class="num shrink-0 text-[11px] text-foreground-500">${n2a(dn)}/${n2a(l.length)}</p></div><div class="space-y-2">${l.map(wardArticle).join('')}</div></section>`; }).join('');
    const y = window.scrollY;
    draw(wrapS(`<div class="animate-rise rounded-lg border border-background-200 bg-background-50"><div class="flex items-center justify-between gap-2 border-b border-background-200 px-3 py-2.5"><div class="flex items-center gap-1.5 text-[11.5px] text-foreground-500"><i class="ri-calendar-event-line text-[13px]"></i>${fG.format(d)}</div><div class="flex items-center gap-1.5"><a class="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-full border border-background-300 bg-background-50 px-2.5 py-1 text-[10px] text-foreground-700 transition-colors duration-smooth hover:bg-background-200" href="#/ward/history"><i class="ri-calendar-2-line text-[11px]"></i>سجل الشهر</a><span id="sync"></span></div></div>
<div class="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between md:p-5"><div class="flex items-center gap-4"><div class="relative shrink-0 rounded-full" role="img" aria-label="نسبة الإنجاز ${P} بالمئة" style="width:92px;height:92px;background:conic-gradient(oklch(var(--primary-500)) ${P}%, oklch(var(--background-200)) ${P}% 100%)"><div class="absolute flex flex-col items-center justify-center rounded-full bg-background-50" style="inset:7px"><span class="num text-[19px] font-semibold leading-none text-foreground-950">${n2a(done)}<span class="text-[12px] text-foreground-400">/${n2a(total)}</span></span><span class="mt-1 text-[9px] text-foreground-400">مكتمل</span></div></div><div><p class="text-[11.5px] text-foreground-500">${esc(me.full_name)}</p><h1 class="mt-0.5 font-heading text-lg font-semibold text-foreground-950">ورد اليوم</h1><p class="mt-1 text-[11.5px] text-foreground-500">بقي ${n2a(rem)} أوراد · ${n2a(P)}% إنجاز</p><p class="mt-0.5 text-[10.5px] text-foreground-400">${fH.format(d)}</p></div></div>
<div class="grid w-full grid-cols-3 gap-2 sm:w-auto sm:min-w-[260px]"><div class="rounded-md border border-primary-200 bg-primary-50 px-2 py-2 text-center"><p class="num text-[15px] font-semibold leading-none text-primary-800">${n2a(done)}</p><p class="mt-1 text-[9.5px] text-primary-700">مكتمل</p></div><div class="rounded-md border border-secondary-200 bg-secondary-50 px-2 py-2 text-center"><p class="num text-[15px] font-semibold leading-none text-secondary-900">${n2a(partial)}</p><p class="mt-1 text-[9.5px] text-secondary-800">قيد الإنجاز</p></div><div class="rounded-md border border-background-300 bg-background-100 px-2 py-2 text-center"><p class="num text-[15px] font-semibold leading-none text-foreground-800">${n2a(total - done - partial)}</p><p class="mt-1 text-[9.5px] text-foreground-500">لم يبدأ</p></div></div></div>
<div class="border-t border-background-200 bg-background-100 px-4 py-2.5"><p class="flex items-start gap-1.5 text-[10.5px] leading-relaxed text-foreground-500"><i class="ri-lock-line mt-0.5 text-[12px]"></i>القالب معتمد من شيخك ولا يمكن تعديله. الورد غير المسجل يبقى غير مسجل ولا يُحتسب تلقائيًا، وسجل اليوم يُغلق بعد منتصف الليل.</p></div></div>
${sec || '<div class="rounded-lg border border-background-200 bg-background-50 p-6 text-center text-[12px] text-foreground-500">لا توجد أوراد بعد. سيضيفها الشيخ.</div>'}`));
    window.scrollTo(0, y); setSync(ctx.syncState || 'idle'); bindWard(paint);
  };
  paint();
}
function bindWard(paint) {
  $app.querySelectorAll('[data-a]').forEach(el => el.onclick = async () => {
    const a = ctx.acts.find(x => x.id === el.dataset.a), k = el.dataset.k, day = ctx.day, prev = JSON.stringify(day);
    const log = day.logs.find(l => l.activity_id === a.id);
    const put = (completed, counter) => { const l = day.logs.find(l => l.activity_id === a.id); if (l) { l.completed = completed; l.counter_value = counter; } else day.logs.push({ activity_id: a.id, completed, counter_value: counter }); };
    try {
      ctx.syncState = 'saving';
      if (k === 't') { const c = !(log && log.completed); put(c, 0); paint(); await setLog(a, c, 0); }
      else if (k === 'p' || k === 'm') { const v = Math.max(0, (log ? log.counter_value : 0) + (k === 'p' ? 1 : -1)); const c = v >= (a.target_count || 1); put(c, v); paint(); await setLog(a, c, v); }
      else {
        const i = +el.dataset.i, has = day.parts.find(p => p.activity_id === a.id && p.part_index === i);
        if (has) { day.parts = day.parts.filter(p => p !== has); paint(); await del('wird_part_logs', `member_id=eq.${me.id}&activity_id=eq.${a.id}&log_date=eq.${today()}&part_index=eq.${i}`); }
        else { day.parts.push({ activity_id: a.id, part_index: i, completed: true }); paint(); await api('/rest/v1/wird_part_logs?on_conflict=member_id,activity_id,log_date,part_index', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: { tenant_id: TENANT, member_id: me.id, activity_id: a.id, log_date: today(), part_index: i, completed: true } }); }
        const st = actState(a, day); put(st.done, 0); await setLog(a, st.done, 0);
      }
      ctx.syncState = 'ok'; setSync('ok'); ctx.syncState = 'idle';
    } catch (e) { ctx.day = JSON.parse(prev); ctx.syncState = 'err'; paint(); toast('تعذّر الحفظ: ' + errAr(e)); ctx.syncState = 'idle'; }
  });
}

/* history */
async function viewHistory() {
  const acts = await loadActivities(), st = ctx.hist || (ctx.hist = { y: new Date().getFullYear(), m: new Date().getMonth(), sel: today() });
  const first = new Date(st.y, st.m, 1), nd = new Date(st.y, st.m + 1, 0).getDate(), a = ymd(first), b = ymd(new Date(st.y, st.m, nd));
  const [logs, parts] = await Promise.all([q('wird_logs', `select=log_date,activity_id,completed,counter_value&member_id=eq.${me.id}&log_date=gte.${a}&log_date=lte.${b}&limit=2000`), q('wird_part_logs', `select=log_date,activity_id,part_index&member_id=eq.${me.id}&completed=eq.true&log_date=gte.${a}&log_date=lte.${b}&limit=3000`)]);
  const tot = acts.length, dayState = date => { const l = logs.filter(x => x.log_date === date), p = parts.filter(x => x.log_date === date); const r = acts.map(ac => actState(ac, { logs: l, parts: p })); return { done: r.filter(x => x.done).length, any: r.filter(x => x.done || x.val > 0).length, r }; };
  const t = today(), days = []; for (let d = 1; d <= nd; d++) { const date = st.y + '-' + pad(st.m + 1) + '-' + pad(d); days.push({ d, date, ...(date <= t ? dayState(date) : { done: 0, any: 0, r: [] }) }); }
  const past = days.filter(x => x.date <= t), full = past.filter(x => tot && x.done >= tot).length, recd = past.filter(x => x.any).length, avg = past.length && tot ? Math.round(past.reduce((s, x) => s + x.done / tot, 0) / past.length * 100) : 0;
  let best = 0, run = 0; past.forEach(x => { if (tot && x.done >= tot) { run++; best = Math.max(best, run); } else run = 0; });
  const lead = first.getDay(); // week starts Sunday
  const cell = x => { const f = tot && x.done >= tot, any = x.any > 0, fut = x.date > t, ratio = tot ? x.done / tot : 0; const cl = fut ? 'border-background-200 bg-background-50 text-foreground-300' : f ? 'border-primary-600 bg-primary-600 text-background-50' : ratio >= .5 ? 'border-primary-300 bg-primary-300 text-primary-950' : any ? 'border-primary-200 bg-primary-100 text-primary-900' : x.date === t ? 'border-background-300 bg-background-100 text-foreground-600' : 'border-background-200 bg-background-100 text-foreground-500'; return `<button type="button" data-date="${x.date}" ${fut ? 'disabled' : ''} aria-pressed="${x.date === st.sel}" class="flex h-12 cursor-pointer flex-col items-center justify-center rounded-md border transition-colors duration-smooth ${cl} ${x.date === st.sel ? 'ring-2 ring-accent-500' : ''} disabled:cursor-default"><span class="num text-[12px] font-semibold leading-none ${x.date === t ? 'underline' : ''}">${n2a(x.d)}</span><span class="num mt-1 text-[8.5px] leading-none opacity-80">${fut ? '—' : n2a(x.done) + '/' + n2a(tot)}</span></button>`; };
  const sd = days.find(x => x.date === st.sel) || days[0], sdP = tot ? Math.round(sd.done / tot * 100) : 0;
  const chip = sd.date > t ? ['bg-background-100 text-foreground-500', 'ri-time-line', 'قادم'] : tot && sd.done >= tot ? ['bg-primary-100 text-primary-800', 'ri-check-double-line', 'مكتمل'] : sd.any ? ['bg-accent-100 text-accent-900', 'ri-progress-3-line', 'جزئي'] : ['bg-secondary-100 text-secondary-900', 'ri-close-circle-line', 'لم يُسجل'];
  const sc = (t_, v, ic, cl) => `<div class="rounded-lg border border-background-200 bg-background-50 p-3"><div class="flex items-center justify-between gap-2"><p class="text-[10.5px] text-foreground-500">${t_}</p><span class="flex h-7 w-7 items-center justify-center rounded-md ${cl}"><i class="${ic} text-[13px]"></i></span></div><p class="num mt-1.5 text-[19px] font-semibold leading-none text-foreground-950">${v}</p></div>`;
  const nb = 'flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-background-300 bg-background-50 text-foreground-600 transition-colors duration-smooth hover:bg-background-200';
  const isNow = st.y === new Date().getFullYear() && st.m === new Date().getMonth();
  draw(wrapS(`<header class="animate-rise flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><div class="flex items-center gap-2"><a class="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-background-300 bg-background-50 text-foreground-600 transition-colors duration-smooth hover:bg-background-200" aria-label="العودة إلى ورد اليوم" href="#/ward"><i class="ri-arrow-right-s-line text-[15px]"></i></a><h1 class="font-heading text-xl font-semibold text-foreground-950 md:text-2xl">سجل وردي</h1></div><p class="mt-1 text-[12px] leading-relaxed text-foreground-500">تقويم شهري يوضح إنجازك اليومي من الأوراد، مع تفصيل كل يوم.</p></div><a class="inline-flex cursor-pointer items-center gap-1.5 self-start whitespace-nowrap rounded-md bg-primary-700 px-3.5 py-2 text-[11.5px] font-medium text-background-50 transition-colors duration-smooth hover:bg-primary-800 sm:self-auto" href="#/ward"><i class="ri-checkbox-circle-line text-[13px]"></i>تسجيل ورد اليوم</a></header>
<section class="animate-rise delay-1 grid grid-cols-2 gap-2.5 lg:grid-cols-4">${sc('أيام مكتملة', n2a(full), 'ri-calendar-check-line', 'bg-primary-100 text-primary-700')}${sc('متوسط الإنجاز', n2a(avg) + '%', 'ri-line-chart-line', 'bg-secondary-100 text-secondary-900')}${sc('أيام مسجّلة', n2a(recd), 'ri-checkbox-circle-line', 'bg-accent-100 text-accent-900')}${sc('أطول سلسلة', n2a(best), 'ri-fire-line', 'bg-primary-100 text-primary-700')}</section>
<div class="animate-fade grid gap-4 lg:grid-cols-[1.55fr_1fr]"><div class="rounded-lg border border-background-200 bg-background-50"><div class="flex items-center justify-between gap-2 border-b border-background-200 px-3 py-2.5"><button type="button" id="hp" aria-label="الشهر السابق" class="${nb}"><i class="ri-arrow-right-s-line text-[16px]"></i></button><div class="text-center"><p class="font-heading text-[13px] font-semibold text-foreground-950">${MONTHS[st.m]} ${n2a(st.y)}</p><p class="text-[10px] text-foreground-400">سجل الورد اليومي</p></div><div class="flex items-center gap-1"><button type="button" id="hn0" class="cursor-pointer whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-2 py-1 text-[10px] text-foreground-600 transition-colors duration-smooth hover:bg-background-200">هذا الشهر</button><button type="button" id="hn" ${isNow ? 'disabled' : ''} aria-label="الشهر التالي" class="${nb} disabled:cursor-not-allowed disabled:opacity-40"><i class="ri-arrow-left-s-line text-[16px]"></i></button></div></div>
<div class="p-3"><div class="grid grid-cols-7 gap-1">${['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'].map(n => `<div class="pb-1.5 text-center text-[9.5px] font-medium text-foreground-400">${n}</div>`).join('')}${'<div></div>'.repeat(lead)}${days.map(cell).join('')}</div>
<div class="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-background-200 pt-2.5"><div class="flex flex-wrap items-center gap-2">${[['border-background-300 bg-background-100', 'لم يُسجّل'], ['border-primary-200 bg-primary-100', 'بداية'], ['border-primary-300 bg-primary-300', 'جزئي'], ['border-primary-600 bg-primary-600', 'مكتمل']].map(([c, l]) => `<span class="flex items-center gap-1 text-[9.5px] text-foreground-500"><span class="h-2.5 w-2.5 rounded-sm border ${c}"></span>${l}</span>`).join('')}</div></div></div></div>
<div class="space-y-3"><div class="rounded-lg border border-background-200 bg-background-50"><div class="border-b border-background-200 px-3.5 py-3"><div class="flex items-start justify-between gap-2"><div class="min-w-0"><h2 class="font-heading text-[12.5px] font-semibold text-foreground-950">${fG.format(new Date(sd.date + 'T12:00:00'))}</h2><p class="num mt-0.5 text-[10.5px] text-foreground-500">${n2a(sd.done)} من ${n2a(tot)} أوراد · ${n2a(sdP)}%</p></div><span class="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${chip[0]}"><i class="${chip[1]} text-[11px]"></i>${chip[2]}</span></div><div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-background-200"><div class="h-full rounded-full transition-all duration-smooth ${sdP === 100 ? 'bg-primary-500' : 'bg-accent-500'}" style="width:${sdP}%"></div></div></div>
<ul class="divide-y divide-background-200">${acts.map((ac, i) => { const r = sd.r[i] || { done: false, val: 0 }; return `<li class="flex items-start gap-2.5 px-3.5 py-2.5"><span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${r.done ? 'bg-primary-100 text-primary-700' : 'bg-background-100 text-foreground-500'}"><i class="${iconFor(ac)} text-[14px]"></i></span><div class="min-w-0 flex-1"><div class="flex flex-wrap items-center gap-x-2 gap-y-0.5"><p class="text-[11.5px] font-medium leading-snug text-foreground-900">${esc(ac.title)}</p><span class="rounded-full bg-background-100 px-1.5 py-0.5 text-[9px] text-foreground-500">${{ toggle: 'إتمام بسيط', counter: 'عدّاد', quran: 'ورد قرآن' }[ac.type]}</span></div><p class="num mt-0.5 text-[10px] text-foreground-500">${r.done ? 'مكتمل' : r.val > 0 ? n2a(r.val) + (ac.type === 'counter' ? ' من ' + n2a(r.total) : ' من ' + n2a(r.total) + ' أجزاء') : 'لم يُسجّل'}</p></div><span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${r.done ? 'bg-primary-600 text-background-50' : 'bg-background-100 text-foreground-400'}"><i class="${r.done ? 'ri-check-line' : 'ri-close-line'} text-[11px]"></i></span></li>`; }).join('')}</ul></div></div></div>`));
  const re = () => viewHistory();
  document.getElementById('hp').onclick = () => { st.m--; if (st.m < 0) { st.m = 11; st.y--; } st.sel = ymd(new Date(st.y, st.m, 1)); re(); };
  document.getElementById('hn').onclick = () => { st.m++; if (st.m > 11) { st.m = 0; st.y++; } st.sel = ymd(new Date(st.y, st.m, 1)); re(); };
  document.getElementById('hn0').onclick = () => { const n = new Date(); st.y = n.getFullYear(); st.m = n.getMonth(); st.sel = today(); re(); };
  $app.querySelectorAll('[data-date]').forEach(el => el.onclick = () => { st.sel = el.dataset.date; re(); });
}

/* static (sample) pages from the Readdy design */
async function viewStatic(k) {
  await loadMeCtx();
  let h = PG[k].split('أحمد بن سالم العتيبي').join(esc(me.full_name));
  if (k === 'group') { h = h.split('حلقة الفرقان').join('حلقتي'); }
  draw(h);
  if (k === 'seasons') bindSeasonTabs();
}
function bindSeasonTabs() {
  const btns = [...$app.querySelectorAll('main button')].filter(b => ['الكل', 'جارية', 'قادمة', 'منتهية'].includes(b.textContent.trim()));
  const grid = [...$app.querySelectorAll('main .grid')].find(g => g.children.length >= 3 && /متابعة الموسم|التفاصيل والتسجيل|النتائج النهائية/.test(g.textContent));
  if (!btns.length || !grid) return;
  const on = btns[0].className, off = btns[1].className;
  const map = { 'الكل': null, 'جارية': 'جارية الآن', 'قادمة': 'يبدأ بعد', 'منتهية': 'منتهي' };
  btns.forEach(b => b.onclick = () => { btns.forEach(x => x.className = x === b ? on : off); const f = map[b.textContent.trim()]; [...grid.children].forEach(c => c.style.display = (!f || c.textContent.includes(f)) ? '' : 'none'); });
}
async function viewMore() {
  await loadMeCtx();
  let stage = null; try { if (me.stage_id) stage = (await q('stages', 'select=name&id=eq.' + me.stage_id))[0]; } catch (e) { }
  let h = PG.more.replace('>تجريبي<', '>' + esc(me.full_name) + '<').replace(/mohamedkamalapi\+wardport@gmail\.com|mohamedkamalapi@gmail\.com/, esc(me.email || ''));
  h = h.replace('>متربٍّ<', '>' + (isStaff() ? 'شيخ' : (CATEGORY[me.category] || 'متربٍّ')) + '<').replace('>بدون حلقة<', '>' + esc(me.group_name || 'بدون حلقة') + '<');
  h = h.replace(/١٧ جمادى الآخرة ١٤٤٨ هـ/, fH.format(new Date(me.created_at || Date.now())));
  const mi = h.indexOf('المشرف'); if (mi > 0) { const j = h.indexOf('>—<', mi); if (j > 0) h = h.slice(0, j) + '>' + esc(me.sheikh_name || '—') + '<' + h.slice(j + 3); }
  h = h.replace('لم تُحدد بعد', stage ? esc(stage.name) : 'لم تُحدد بعد');
  if (isStaff()) { const p = h.indexOf('href="#/ward"'), g = h.lastIndexOf('<div class="grid', p); h = h.slice(0, g) + `<a class="animate-rise group flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-secondary-200 bg-secondary-50 px-4 py-3.5 transition-colors duration-smooth hover:bg-secondary-100" href="#/sheikh"><div class="flex items-center gap-3"><span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-700 text-accent-200"><i class="ri-shield-user-line text-base"></i></span><div><p class="text-[13px] font-semibold text-foreground-950">مساحة الشيخ</p><p class="text-[11px] text-foreground-500">متابعة الأعضاء واعتماد الترقيات</p></div></div><i class="ri-arrow-left-s-line text-lg text-foreground-400"></i></a>` + h.slice(g); }
  draw(h);
  [...$app.querySelectorAll('main button')].filter(b => b.textContent.includes('تسجيل الخروج')).forEach(b => b.onclick = logout);
}
async function viewInstall() { await loadMeCtx(); draw(PG.install); }
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); window._bip = e; });

/* calendar (member or sheikh viewing a member) */
async function calendarHtml(uid, y, m, sel) {
  const first = new Date(y, m, 1), days = new Date(y, m + 1, 0).getDate();
  const acts = await loadActivities();
  const logs = await q('wird_logs', `select=log_date,activity_id,completed&member_id=eq.${uid}&completed=eq.true&log_date=gte.${ymd(first)}&log_date=lte.${ymd(new Date(y, m, days))}`);
  const per = {}; logs.forEach(l => (per[l.log_date] = per[l.log_date] || []).push(l.activity_id));
  const startDow = (first.getDay() + 1) % 7; // week starts Saturday
  const names = ['س', 'ح', 'ن', 'ث', 'ر', 'خ', 'ج'];
  let cells = names.map(n => `<div class="h">${n}</div>`).join('') + '<div></div>'.repeat(startDow);
  const t = today();
  for (let d = 1; d <= days; d++) {
    const date = y + '-' + pad(m + 1) + '-' + pad(d), c = (per[date] || []).length;
    const cls = date > t ? 'fut' : (c && c >= acts.length && acts.length ? 'full' : c ? 'part' : '');
    cells += `<div class="d ${cls} ${date === t ? 'today' : ''} ${date === sel ? 'sel' : ''}" data-date="${date}">${n2a(d)}</div>`;
  }
  return { html: `<div class="cal">${cells}</div>`, per, acts };
}
async function renderCal(host, uid, st, onSel) {
  const { html, per, acts } = await calendarHtml(uid, st.y, st.m, st.sel);
  host.innerHTML = `<div class="row sp" style="margin-bottom:10px"><button class="btn sec sm" id="nx">‹ التالي</button><b>${MONTHS[st.m]} ${n2a(st.y)}</b><button class="btn sec sm" id="pv">السابق ›</button></div>${html}
<div class="row small muted" style="margin:10px 0;gap:14px"><span>🟩 مكتمل</span><span>🟨 جزئي</span><span>⬜ بدون تسجيل</span></div><div id="dd"></div>`;
  host.querySelector('#pv').onclick = () => { st.m--; if (st.m < 0) { st.m = 11; st.y--; } st.sel = null; renderCal(host, uid, st); };
  host.querySelector('#nx').onclick = () => { st.m++; if (st.m > 11) { st.m = 0; st.y++; } st.sel = null; renderCal(host, uid, st); };
  host.querySelectorAll('.d[data-date]').forEach(el => el.onclick = () => {
    if (el.classList.contains('fut')) return; host.querySelectorAll('.d.sel').forEach(x => x.classList.remove('sel')); el.classList.add('sel'); st.sel = el.dataset.date;
    const ids = per[st.sel] || [];
    host.querySelector('#dd').innerHTML = `<div class="card"><b>${n2a(+st.sel.slice(8))} ${MONTHS[+st.sel.slice(5, 7) - 1]}</b><div class="muted small">${n2a(ids.length)} من ${n2a(acts.length)} مكتمل</div>${acts.map(a => `<div class="small" style="margin-top:4px">${ids.includes(a.id) ? '✅' : '▫️'} ${esc(a.title)}</div>`).join('')}</div>`;
  });
}
/* ---------- sheikh views ---------- */
function sheikhTabs(a) {
  const l = [['/sheikh', 'الرئيسية'], ['/sheikh/members', 'الأعضاء'], ['/sheikh/roster', 'المجموعات'], ['/sheikh/requests', 'الطلبات'], ['/sheikh/promotions', 'الترقيات'], ['/sheikh/wird', 'الأوراد']];
  return '<div class="chips">' + l.map(([p, t]) => `<a class="chip ${a === p ? 'on' : ''}" href="#${p}" style="text-decoration:none;color:inherit">${t}</a>`).join('') + '</div>';
}
const SP_CSS = `<style>
.sp{font-family:var(--font-body);padding-bottom:20px}.sp *{box-sizing:border-box}
.sp header.sh h1{font-family:var(--font-heading);font-size:18px;font-weight:700;margin:0;color:oklch(var(--primary-900))}.sp header.sh small{font-size:12px;opacity:.65}
.sp .chips{display:flex;gap:8px;overflow-x:auto;padding:12px 0;scrollbar-width:none}.sp .chip{flex:none;padding:7px 14px;border-radius:99px;border:1px solid oklch(var(--background-300));background:oklch(var(--background-50));font-size:13px;white-space:nowrap}
.sp .chip.on{background:oklch(var(--primary-800));color:#fff!important;border-color:transparent}
.sp .card,.sp form.card{display:block;background:oklch(var(--background-50));border:1px solid oklch(var(--background-300));border-radius:14px;padding:14px;margin-bottom:10px}
.sp .row{display:flex;align-items:center;gap:8px}.sp .sp,.sp .row.sp{justify-content:space-between}
.sp .muted{opacity:.68}.sp .small{font-size:12px}.sp .center{text-align:center}.sp h3{font-size:15px;margin:14px 0 8px}
.sp .stats{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px}.sp .stat{background:oklch(var(--background-50));border:1px solid oklch(var(--background-300));border-radius:14px;padding:14px;font-size:12px;opacity:1}
.sp .stat b{display:block;font-size:24px;font-family:var(--font-heading);color:oklch(var(--primary-700));margin-bottom:2px}
.sp .pill{font-size:11px;padding:2px 9px;border-radius:99px;background:oklch(var(--primary-100));color:oklch(var(--primary-800))}
.sp .btn{display:inline-block;padding:10px 16px;border:0;border-radius:11px;background:oklch(var(--primary-700));color:#fff;font:inherit;font-weight:700;font-size:14px;cursor:pointer;text-decoration:none}
.sp .btn.sec{background:transparent;color:oklch(var(--primary-800));border:1px solid oklch(var(--primary-300))}.sp .btn.sm{padding:8px 12px;font-size:13px}.sp .btn.block{display:block;width:100%;text-align:center}
.sp label{display:block;font-size:12px;font-weight:600;margin:10px 0 4px}
.sp input,.sp select,.sp textarea{width:100%;font:inherit;font-size:14px;padding:10px 11px;border-radius:11px;border:1px solid oklch(var(--background-300));background:#fff}
.sp .err{color:#b91c1c;font-size:13px}
</style>`;
const sheikhPage = (a, title, body) => shell(`${SP_CSS}<div class="sp"><header class="sh"><h1>${title}</h1><small>مساحة الشيخ</small></header>${sheikhTabs(a)}${body}</div>`);

async function viewSheikh() {
  const [members, reqs, acts, logs] = await Promise.all([
    q('profiles', 'select=id,full_name,last_active_at,group_id,stage_id&role=eq.member&status=eq.active'),
    q('membership_requests', 'select=id&status=eq.pending'), loadActivities(), q('wird_logs', `select=member_id,completed&log_date=eq.${today()}&completed=eq.true`)]);
  const per = {}; logs.forEach(l => per[l.member_id] = (per[l.member_id] || 0) + 1);
  const logged = members.filter(m => per[m.id]).length, full = members.filter(m => acts.length && per[m.id] >= acts.length).length;
  $app.innerHTML = sheikhPage('/sheikh', 'لوحة الشيخ', `<div class="stats"><div class="stat"><b>${n2a(members.length)}</b>أعضاء نشطون</div><div class="stat"><b>${n2a(reqs.length)}</b>طلبات معلّقة</div><div class="stat"><b>${n2a(logged)}</b>سجّلوا اليوم</div><div class="stat"><b>${n2a(full)}</b>أكملوا الورد كاملًا</div></div>
<div class="card"><h3>التزام اليوم</h3>${members.length ? members.map(m => `<a class="row sp" style="padding:8px 0;text-decoration:none;color:inherit" href="#/sheikh/member/${m.id}"><span>${esc(m.full_name)}</span><span class="pill ${per[m.id] ? '' : 'w'}">${n2a(per[m.id] || 0)} / ${n2a(acts.length)}</span></a>`).join('') : '<p class="muted">لا يوجد أعضاء مفعّلون بعد.</p>'}</div>`);
}
async function viewMembers() {
  const [members, groups, stages] = await Promise.all([q('profiles', 'select=*&role=eq.member&order=created_at.desc'), q('tarbiyah_groups', 'select=id,name'), q('stages', 'select=id,name')]);
  const gn = id => (groups.find(g => g.id === id) || {}).name || '—', sn = id => (stages.find(s => s.id === id) || {}).name || '—';
  const stp = { active: ['نشط', ''], pending: ['معلّق', 'w'], suspended: ['موقوف', 'r'], archived: ['مؤرشف', 'r'] };
  $app.innerHTML = sheikhPage('/sheikh/members', 'الأعضاء', members.length ? members.map(m => `<a class="card" style="display:block;text-decoration:none;color:inherit" href="#/sheikh/member/${m.id}"><div class="row sp"><b>${esc(m.full_name)}</b><span class="pill ${stp[m.status][1]}">${stp[m.status][0]}</span></div><div class="muted small">${CATEGORY[m.category]} · ${esc(gn(m.group_id))} · ${esc(sn(m.stage_id))}</div><div class="muted small">آخر نشاط: ${m.last_active_at ? new Date(m.last_active_at).toLocaleDateString('ar-EG') : '—'}</div></a>`).join('') : '<div class="card muted center">لا يوجد أعضاء.</div>');
}
async function viewMember(id) {
  const [p, notes] = await Promise.all([q('profiles', 'select=*&id=eq.' + id), q('member_notes', `select=*&member_id=eq.${id}&order=created_at.desc`)]);
  const m = p[0]; if (!m) return go('/sheikh/members');
  $app.innerHTML = sheikhPage('/sheikh/members', esc(m.full_name), `<div class="card"><div class="muted">${esc(m.email)} · ${CATEGORY[m.category]}</div></div><div class="card" id="cal"></div>
<div class="card"><h3>ملاحظات الشيخ</h3><form id="nf"><textarea name="b" rows="2" required placeholder="اكتب ملاحظة…"></textarea><button class="btn sm">إضافة</button></form>${notes.map(n => `<hr><div class="small">${esc(n.body)}</div><div class="muted small">${esc(n.author_name || '')} · ${new Date(n.created_at).toLocaleDateString('ar-EG')}</div>`).join('')}</div>`);
  const n = new Date(); renderCal(document.getElementById('cal'), id, { y: n.getFullYear(), m: n.getMonth(), sel: null });
  document.getElementById('nf').onsubmit = async ev => { ev.preventDefault(); try { await ins('member_notes', { tenant_id: TENANT, member_id: id, author_id: me.id, author_name: me.full_name, body: new FormData(ev.target).get('b').trim() }); toast('تمت الإضافة'); viewMember(id); } catch (e) { toast(errAr(e)); } };
}
async function viewRequests() {
  const reqs = await q('membership_requests', 'select=*&order=created_at.desc&limit=60');
  const pend = reqs.filter(r => r.status === 'pending'), rest = reqs.filter(r => r.status !== 'pending');
  const card = (r, act) => `<div class="card"><div class="row sp"><b>${esc(r.full_name)}</b><span class="pill ${r.status === 'pending' ? 'w' : r.status === 'approved' ? '' : 'r'}">${{ pending: 'معلّق', approved: 'مقبول', rejected: 'مرفوض' }[r.status]}</span></div><div class="muted small" dir="ltr" style="text-align:right">${esc(r.email)}</div><div class="muted small">${CATEGORY[r.category]} · ${esc(r.group_name || 'بدون حلقة')}</div>${r.note ? `<div class="small">${esc(r.note)}</div>` : ''}${act ? `<div class="row" style="margin-top:10px"><button class="btn sm grow" data-ok="${r.id}">قبول</button><button class="btn red sm grow" data-no="${r.id}">رفض</button></div>` : ''}</div>`;
  $app.innerHTML = sheikhPage('/sheikh/requests', 'طلبات العضوية', (pend.length ? pend.map(r => card(r, true)).join('') : '<div class="card muted center">لا توجد طلبات معلّقة ✅</div>') + (rest.length ? '<h3>السابقة</h3>' + rest.map(r => card(r, false)).join('') : ''));
  const act = async (id, ok) => {
    const r = reqs.find(x => x.id === id);
    try {
      await upd('membership_requests', 'id=eq.' + id, { status: ok ? 'approved' : 'rejected', reviewed_by: me.id, reviewed_at: new Date().toISOString() });
      if (r.user_id) {
        if (ok) { await upd('profiles', 'id=eq.' + r.user_id, { status: 'active', sheikh_id: me.id, group_id: r.group_id }); await rpc('start_member_stage', { p_member_id: r.user_id }).catch(() => { }); }
        else await upd('profiles', 'id=eq.' + r.user_id, { status: 'archived' });
      }
      toast(ok ? 'تم قبول العضو' : 'تم الرفض'); viewRequests();
    } catch (e) { toast(errAr(e)); }
  };
  $app.querySelectorAll('[data-ok]').forEach(b => b.onclick = () => act(b.dataset.ok, true));
  $app.querySelectorAll('[data-no]').forEach(b => b.onclick = () => act(b.dataset.no, false));
}
async function viewPromotions() {
  const [members, stages, promos] = await Promise.all([q('profiles', 'select=id,full_name,stage_id&role=eq.member&status=eq.active'), q('stages', 'select=*&order=order_index'), q('promotions', 'select=*&order=created_at.desc&limit=30')]);
  const byId = Object.fromEntries(stages.map(s => [s.id, s])), mById = Object.fromEntries(members.map(m => [m.id, m]));
  $app.innerHTML = sheikhPage('/sheikh/promotions', 'الترقيات', `${members.length ? members.map(m => { const cur = byId[m.stage_id], next = cur ? stages.find(s => s.order_index > cur.order_index) : null; return `<div class="card"><div class="row sp"><b>${esc(m.full_name)}</b><span class="pill">${esc(cur ? cur.name : 'بدون مرحلة')}</span></div>${cur ? (next ? `<button class="btn sm block" style="margin-top:10px" data-p="${m.id}" data-to="${next.id}">اعتماد الترقية إلى «${esc(next.name)}»</button>` : '<div class="muted small">أعلى مرحلة</div>') : `<button class="btn sec sm block" style="margin-top:10px" data-s="${m.id}">بدء المرحلة الأولى</button>`}</div>`; }).join('') : '<div class="card muted center">لا يوجد أعضاء نشطون.</div>'}
<h3>سجل الترقيات</h3>${promos.length ? promos.map(p => `<div class="card small">${esc((mById[p.member_id] || {}).full_name || 'عضو')}: ${esc((byId[p.from_stage_id] || {}).name || '—')} ← ${esc((byId[p.to_stage_id] || {}).name || '—')}<div class="muted">${new Date(p.created_at).toLocaleDateString('ar-EG')}</div></div>`).join('') : '<div class="muted">لا توجد ترقيات بعد.</div>'}`);
  $app.querySelectorAll('[data-p]').forEach(b => b.onclick = async () => { try { await rpc('approve_stage_promotion', { p_member_id: b.dataset.p, p_to_stage_id: b.dataset.to }); toast('تمت الترقية'); viewPromotions(); } catch (e) { toast(errAr(e)); } });
  $app.querySelectorAll('[data-s]').forEach(b => b.onclick = async () => { try { await rpc('start_member_stage', { p_member_id: b.dataset.s }); toast('تم'); viewPromotions(); } catch (e) { toast(errAr(e)); } });
}
async function viewWirdMgmt(editId) {
  const acts = await q('wird_activities', 'select=*&order=order_index.asc,created_at.asc');
  const e = acts.find(a => a.id === editId) || { type: 'toggle', category: 'worship', is_active: true, order_index: acts.length + 1, quran_unit: 'juz', quran_parts: 1 };
  const tl = { toggle: 'زر (تم / تراجع)', counter: 'عدّاد', quran: 'قرآن (أجزاء)' };
  $app.innerHTML = sheikhPage('/sheikh/wird', 'إدارة الأوراد', `<form class="card" id="f"><h3>${editId ? 'تعديل نشاط' : 'نشاط جديد'}</h3>
<label>العنوان</label><input name="title" required value="${esc(e.title || '')}"><label>الوصف</label><input name="description" value="${esc(e.description || '')}">
<label>نوع التسجيل</label><select name="type" id="ty">${Object.entries(tl).map(([k, v]) => `<option value="${k}" ${e.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
<label>التصنيف</label><select name="category">${Object.entries(CATS).map(([k, v]) => `<option value="${k}" ${e.category === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
<div id="cn"><label>الهدف (للعدّاد)</label><input name="target_count" type="number" min="1" value="${e.target_count || ''}"><label>الوحدة (مثال: مرة، ساعة)</label><input name="target_unit" value="${esc(e.target_unit || '')}"></div>
<div id="qn"><label>وحدة القرآن</label><select name="quran_unit"><option value="juz" ${e.quran_unit === 'juz' ? 'selected' : ''}>جزء</option><option value="pages" ${e.quran_unit === 'pages' ? 'selected' : ''}>صفحة</option></select><label>العدد اليومي</label><input name="quran_parts" type="number" min="1" value="${e.quran_parts || 1}"></div>
<label>الترتيب</label><input name="order_index" type="number" value="${e.order_index}"><label><input type="checkbox" name="is_active" style="width:auto;margin:0 0 0 8px" ${e.is_active ? 'checked' : ''}> مفعّل</label>
<div class="err" id="er"></div><div class="row"><button class="btn grow">${editId ? 'حفظ' : 'إضافة'}</button>${editId ? '<button type="button" class="btn sec" id="cx">إلغاء</button>' : ''}</div></form>
<h3>الأنشطة الحالية</h3>${acts.map(a => `<div class="card"><div class="row sp"><b>${esc(a.title)}</b><span class="pill ${a.is_active ? '' : 'w'}">${a.is_active ? tl[a.type] : 'معطّل'}</span></div><div class="muted small">${CATS[a.category]}${a.type === 'counter' ? ' · الهدف ' + n2a(a.target_count || 0) + ' ' + esc(a.target_unit || '') : ''}${a.type === 'quran' ? ' · ' + n2a(a.quran_parts) + (a.quran_unit === 'pages' ? ' صفحة' : ' جزء') : ''}</div><div class="row" style="margin-top:8px"><button class="btn sec sm" data-e="${a.id}">تعديل</button><button class="btn red sm" data-d="${a.id}">حذف</button></div></div>`).join('')}`);
  const sync = () => { const t = document.getElementById('ty').value; document.getElementById('cn').hidden = t !== 'counter'; document.getElementById('qn').hidden = t !== 'quran'; }; document.getElementById('ty').onchange = sync; sync();
  if (editId) document.getElementById('cx').onclick = () => viewWirdMgmt();
  document.getElementById('f').onsubmit = async ev => {
    ev.preventDefault(); const f = new FormData(ev.target), t = f.get('type');
    const row = { title: f.get('title').trim(), description: f.get('description').trim() || null, type: t, category: f.get('category'), order_index: +f.get('order_index') || 0, is_active: f.get('is_active') === 'on', target_count: t === 'counter' ? (+f.get('target_count') || 1) : null, target_unit: t === 'counter' ? (f.get('target_unit').trim() || null) : null, quran_unit: t === 'quran' ? f.get('quran_unit') : null, quran_parts: t === 'quran' ? (+f.get('quran_parts') || 1) : null, updated_at: new Date().toISOString() };
    try { if (editId) await upd('wird_activities', 'id=eq.' + editId, row); else await ins('wird_activities', { ...row, tenant_id: TENANT, icon: 'ri-checkbox-circle-line' }); toast('تم الحفظ'); viewWirdMgmt(); } catch (er) { document.getElementById('er').textContent = errAr(er); }
  };
  $app.querySelectorAll('[data-e]').forEach(b => b.onclick = () => { viewWirdMgmt(b.dataset.e); window.scrollTo(0, 0); });
  $app.querySelectorAll('[data-d]').forEach(b => b.onclick = async () => { if (!confirm('حذف النشاط وكل تسجيلاته؟ يمكنك تعطيله بدل الحذف.')) return; try { await del('wird_activities', 'id=eq.' + b.dataset.d); toast('تم الحذف'); viewWirdMgmt(); } catch (er) { toast(errAr(er)); } });
}

boot();

/* ---------- roster (groups, leaders, members) ---------- */
const MARK = { '✅': ['منتظم', '#166534', '#dcfce7'], '❌': ['متأخر', '#92400e', '#fef3c7'], '⛔': ['منقطع', '#991b1b', '#fee2e2'] };
async function loadRoster() {
  const [g, m] = await Promise.all([q('roster_groups', 'select=*&order=position'), q('roster_members', 'select=*&order=position')]);
  return { g, m };
}
function rosterHtml(g, m, staff, accts) {
  if (!g.length) return '<div class="rounded-lg border border-background-200 bg-background-50 p-6 text-center text-sm">لا توجد مجموعات بعد.</div>';
  return g.map(gr => {
    const ms = m.filter(x => x.group_id === gr.id), mine = ms.some(x => me && x.user_id === me.id);
    const rows = ms.map(x => {
      const mk = MARK[x.mark], pc = x.fajr_total ? Math.round(x.fajr_done / x.fajr_total * 100) : 0;
      const link = x.user_id ? '<span style="font-size:10px;padding:1px 7px;border-radius:99px;background:#dcfce7;color:#166534">مسجّل</span>' : '<span style="font-size:10px;padding:1px 7px;border-radius:99px;background:#f1f5f9;color:#64748b">غير مسجّل</span>';
      return `<li style="padding:11px 14px;border-top:1px solid rgba(0,0,0,.07)"><div style="display:flex;align-items:center;gap:8px;justify-content:space-between"><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><b style="font-size:14px">${esc(x.full_name)}</b>${x.is_leader ? '<span style="font-size:10px;padding:1px 7px;border-radius:99px;background:#fef3c7;color:#92400e">قائد</span>' : ''}${link}</div>${mk ? `<span style="font-size:10px;padding:1px 7px;border-radius:99px;background:${mk[2]};color:${mk[1]}">${mk[0]}</span>` : ''}</div>
<div style="margin-top:7px;height:5px;border-radius:9px;background:rgba(0,0,0,.08);overflow:hidden"><div style="height:100%;width:${pc}%;background:#16a34a"></div></div><div style="margin-top:4px;font-size:11px;opacity:.65">الفجر: ${n2a(x.fajr_done || 0)} من ${n2a(x.fajr_total || 0)} يومًا</div>
${staff ? `<div style="display:flex;gap:6px;margin-top:8px;align-items:center">${x.user_id ? `<button data-unlink="${x.id}" style="font-size:11px;padding:5px 10px;border-radius:8px;border:1px solid rgba(0,0,0,.15);background:#fff">فك الربط</button>` : `<select data-sel="${x.id}" style="flex:1;font-size:12px;padding:5px;border-radius:8px;border:1px solid rgba(0,0,0,.15);background:#fff"><option value="">ربط بحساب مسجّل…</option>${accts.map(a => `<option value="${a.id}">${esc(a.full_name)}</option>`).join('')}</select><button data-link="${x.id}" style="font-size:11px;padding:5px 10px;border-radius:8px;border:0;background:#166534;color:#fff">ربط</button>`}<button data-rm="${x.id}" style="font-size:11px;padding:5px 10px;border-radius:8px;border:1px solid #fecaca;background:#fff;color:#b91c1c">حذف</button></div>` : ''}</li>`;
    }).join('');
    return `<section class="rounded-lg border border-background-200 bg-background-50" style="overflow:hidden;${mine ? 'box-shadow:0 0 0 2px #16a34a' : ''}"><div style="padding:12px 14px;background:#f0fdf4;display:flex;justify-content:space-between;align-items:center"><div><b style="font-size:15px">${esc(gr.name)}</b><div style="font-size:12px;opacity:.7;margin-top:2px">القائد: ${esc(gr.leader_name || '—')}</div></div><span style="font-size:11px;opacity:.7">${n2a(ms.length)} أعضاء${mine ? ' · مجموعتك' : ''}</span></div><ul style="list-style:none;margin:0;padding:0">${rows}</ul>${staff ? `<div style="display:flex;gap:6px;padding:10px 14px;border-top:1px solid rgba(0,0,0,.07)"><input data-addn="${gr.id}" placeholder="اسم عضو جديد" style="flex:1;font-size:13px;padding:7px 9px;border-radius:8px;border:1px solid rgba(0,0,0,.15)"><button data-add="${gr.id}" style="font-size:12px;padding:7px 12px;border-radius:8px;border:0;background:#166534;color:#fff">إضافة</button></div>` : ''}</section>`;
  }).join('');
}
function bindRoster(reload) {
  $app.onclick = async e => {
    const t = e.target.closest('button'); if (!t) return;
    try {
      if (t.dataset.link) { const v = $app.querySelector(`[data-sel="${t.dataset.link}"]`).value; if (!v) return toast('اختر حسابًا'); await upd('roster_members', 'id=eq.' + t.dataset.link, { user_id: v }); }
      else if (t.dataset.unlink) await upd('roster_members', 'id=eq.' + t.dataset.unlink, { user_id: null });
      else if (t.dataset.rm) { if (!confirm('حذف هذا العضو من القائمة؟')) return; await del('roster_members', 'id=eq.' + t.dataset.rm); }
      else if (t.dataset.add) { const i = $app.querySelector(`[data-addn="${t.dataset.add}"]`), n = i.value.trim(); if (!n) return; await ins('roster_members', { tenant_id: TENANT, group_id: t.dataset.add, full_name: n, position: 99 }); }
      else return;
      reload();
    } catch (er) { toast(errAr(er)); }
  };
}
async function viewRosterGroup() {
  await loadMeCtx();
  const { g, m } = await loadRoster();
  draw(`<div class="space-y-4 md:space-y-5"><div><h1 style="font-size:18px;font-weight:700">مجموعتي</h1><p style="font-size:12px;opacity:.7;margin-top:2px">المجموعات وقادتها وأعضاؤها. الأرقام من قائمة الفجر، ١١ جمادى الآخرة ١٤٤٨.</p></div>${rosterHtml(g, m, false, [])}</div>`);
}
async function viewSheikhRoster() {
  const [{ g, m }, accts] = await Promise.all([loadRoster(), q('profiles', 'select=id,full_name&role=eq.member&order=full_name')]);
  const used = new Set(m.map(x => x.user_id).filter(Boolean)), free = accts.filter(a => !used.has(a.id));
  $app.innerHTML = sheikhPage('/sheikh/roster', 'المجموعات', `<div class="space-y-4" style="display:grid;gap:14px"><p style="font-size:12px;opacity:.7;margin:0">كل اسم هنا يُربط تلقائيًا بحسابه عند التسجيل إذا تطابق الاسم، أو اربطه يدويًا من القائمة. الشيخ غير مضاف لهذه المجموعات.</p>${rosterHtml(g, m, true, free)}</div>`);
  bindRoster(viewSheikhRoster);
}

function viewNewPassword() {
  $app.innerHTML = authShell(`<form class="card" id="f"><h3 style="margin:0">كلمة مرور جديدة</h3><label>كلمة المرور الجديدة (٦ حروف على الأقل)</label><input name="p" type="password" minlength="6" required dir="ltr" autocomplete="new-password"><div class="err" id="e"></div><button class="btn block">حفظ</button></form>`);
  document.getElementById('f').onsubmit = async ev => {
    ev.preventDefault(); const e = document.getElementById('e');
    try { await api('/auth/v1/user', { method: 'PUT', body: { password: new FormData(ev.target).get('p') } }); window.__recovery = false; toast('تم تغيير كلمة المرور'); go('/'); render(); } catch (er) { e.textContent = errAr(er); }
  };
}
