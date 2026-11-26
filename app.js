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
function isStaff() { return me && (me.role === 'sheikh' || me.role === 'supervisor' || me.role === 'super_admin'); }

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
  const row = ([k, ic, t, s]) => `<li class="flex items-center gap-3 px-4 py-3"><span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-700"><i class="${ic} text-[14px]"></i></span><span class="min-w-0 flex-1"><span class="block text-[12.5px] font-medium text-foreground-800">${t}</span><span class="block text-[10.5px] text-foreground-500">${s}</span></span><button data-k="${k}" role="switch" aria-checked="${!!prefs[k]}" style="position:relative;width:44px;height:24px;border-radius:9999px;border:0;flex-shrink:0;transition:background .2s;background:${prefs[k] ? '#4a7766' : '#d9d3c4'}"><span style="position:absolute;top:2px;width:20px;height:20px;border-radius:9999px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:all .2s;${prefs[k] ? 'right:2px' : 'right:22px'}"></span></button></li>`;
  $app.innerHTML = shell(`<div class="space-y-4 md:space-y-5"><div><h2 class="font-heading text-2xl font-semibold text-foreground-900">الإشعارات والتذكيرات</h2><p class="mt-1 text-[12px] text-foreground-600">تصلك على هاتفك كإشعارات حقيقية.</p></div>
  <div class="rounded-xl border border-background-300 bg-white p-4"><div class="flex items-center justify-between gap-3"><div><p class="text-[13px] font-semibold text-foreground-800">إشعارات هذا الجهاز</p><p class="text-[11px] text-foreground-500">${on ? 'مفعّلة' : 'غير مفعّلة'}</p></div><button id="pushb" style="border-radius:10px;padding:8px 18px;font-size:12px;font-weight:600;${on ? 'background:#fff;border:1px solid #d9d3c4;color:#333' : 'background:#4a7766;border:0;color:#fff'}">${on ? 'إيقاف' : 'تفعيل'}</button></div>${msg ? `<p style="margin-top:12px;border-radius:10px;background:#fbf3dc;padding:12px;font-size:11px;line-height:1.8;color:#6b4e08">${msg}</p>` : ''}${on ? '<button id="pusht" class="mt-3 text-[11.5px] font-medium text-primary-700 underline">أرسل إشعار تجربة</button>' : ''}</div>
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
  const tb = document.getElementById('pusht'); if (tb) tb.onclick = async () => { const reg = await navigator.serviceWorker.ready; reg.showNotification('تجربة التذكير', { body: 'الإشعارات تعمل على هذا الجهاز.', icon: 'icon-192-v3.png', dir: 'rtl', lang: 'ar' }); };
  document.querySelectorAll('[data-k]').forEach(b => b.onclick = async () => {
    prefs[b.dataset.k] = !prefs[b.dataset.k];
    try { await api('/rest/v1/reminder_prefs?on_conflict=user_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: { user_id: S.uid, wird: prefs.wird, prayers: prefs.prayers, monthu: prefs.monthu, whitedays: prefs.whitedays } }); } catch (e) { toast('تعذّر الحفظ'); }
    b.setAttribute('aria-checked', prefs[b.dataset.k]); b.style.background = prefs[b.dataset.k] ? '#4a7766' : '#d9d3c4'; const d = b.firstElementChild; d.style.right = prefs[b.dataset.k] ? '2px' : '22px';
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
    if (me && (me.role === 'sheikh' || me.role === 'super_admin')) { me.real_role = me.role; const pv = localStorage.getItem('prev_role'); if (pv === 'sheikh' || pv === 'supervisor' || pv === 'member') me.role = pv; }
    if (me) rpc('touch_last_active').catch(() => { });
  } catch (e) { if (e.status === 401) { saveS(null); } me = null; }
}

function previewChip() { const el = document.getElementById('pvc'); if (el) el.remove(); }
const ROLE_AR = { sheikh: 'شيخ', supervisor: 'مشرف', member: 'عضو', super_admin: 'مدير' };
function setPreview(v) { if (v) localStorage.setItem('prev_role', v); else localStorage.removeItem('prev_role'); me = null; go('/'); render(); }
function roleBadge() {
  if (!me) return '';
  if (!me.real_role) return `<span class="inline-flex items-center gap-1.5 rounded-full border border-primary-300 bg-primary-50 px-3 py-1.5 text-[12px] font-semibold text-primary-800"><i class="ri-user-3-line text-[13px]"></i>${ROLE_AR[me.role] || 'عضو'}</span>`;
  const prev = localStorage.getItem('prev_role') || '', opt = (v, t, ic) => `<button type="button" data-pv="${v}" style="display:flex;width:100%;align-items:center;gap:10px;padding:10px 12px;border:0;background:${prev === v ? '#edf3ee' : 'transparent'};border-radius:10px;font:inherit;font-size:14px;font-weight:${prev === v ? 700 : 500};color:#2b4a3f;cursor:pointer;text-align:right"><i class="${ic}" style="font-size:17px;color:#4a7766"></i><span style="flex:1">${t}</span>${prev === v ? '<i class="ri-check-line" style="color:#4a7766"></i>' : ''}</button>`;
  return `<div class="relative"><button type="button" id="rb" style="display:flex;align-items:center;gap:6px;border:1px solid #d3e2d9;background:#f0f8f2;color:#3b6556;border-radius:999px;padding:6px 12px;font:inherit;font-size:13px;font-weight:700;cursor:pointer"><i class="ri-user-star-line" style="font-size:15px"></i><span>${ROLE_AR[me.role]}${prev ? ' (معاينة)' : ''}</span><i class="ri-arrow-down-s-line" style="font-size:15px"></i></button><div id="rbp" style="display:none;position:absolute;left:0;top:calc(100% + 8px);width:230px;background:#fff;border:1px solid #e1e8df;border-radius:14px;box-shadow:0 12px 30px rgba(15,60,35,.18);padding:6px;z-index:70"><p style="margin:6px 10px 4px;font-size:12px;color:#4b5b50;font-weight:600">عرض التطبيق كـ</p>${opt('', 'حسابي (' + ROLE_AR[me.real_role] + ')', 'ri-shield-user-line')}${opt('sheikh', 'شيخ', 'ri-user-star-line')}${opt('supervisor', 'مشرف', 'ri-user-settings-line')}${opt('member', 'عضو', 'ri-user-line')}<p style="margin:6px 10px 6px;font-size:11.5px;color:#5b6b60;line-height:1.6">المعاينة تغيّر شكل الشاشات فقط، وصلاحياتك الفعلية لا تتغيّر.</p></div></div>`;
}
document.addEventListener('click', e => {
  const p = document.getElementById('rbp'); if (!p) return;
  const o = e.target.closest && e.target.closest('[data-pv]'); if (o) { p.style.display = 'none'; return setPreview(o.dataset.pv); }
  if (e.target.closest && e.target.closest('#rb')) { p.style.display = p.style.display === 'block' ? 'none' : 'block'; return; }
  p.style.display = 'none';
});
async function render() {
  const p = (location.hash.slice(1) || '/');
  route = p.split('?')[0];
  if (!S) { return (route === '/register') ? viewRegister() : (route === '/login') ? viewLogin() : viewWelcome(); }
  if (!me) { await loadMe(); }
  if (!S) return viewWelcome();
  if (!me) return viewComplete();
  previewChip();
  if (me.status !== 'active') return viewPending();
  try {
    if (route === '/') return await viewHome();
    if (route === '/ward') return await viewWard();
    if (route === '/ward/history') return await viewHistory();
    if (route === '/more') return await viewMore();
    if (route === '/settings') return await viewSettings();
    if (route === '/quran') return go('/ward');
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
      if (route === '/sheikh/reports') return await viewReports();
      if (route === '/sheikh/requests') return await viewRequests();
      if (route === '/sheikh/promotions') return await viewPromotions();
      if (route === '/sheikh/stages') return await viewStages();
      if (route === '/sheikh/wird') return me.role === 'supervisor' ? go('/sheikh') : await viewWirdMgmt();
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
.ra .err{color:#b0524c;font-size:13px;margin-top:8px;min-height:1px}
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
  $app.innerHTML = authShell(`<form class="card" id="f"><label>البريد الإلكتروني</label><input name="email" type="email" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" required dir="ltr"><label>كلمة المرور</label><input name="password" type="password" autocomplete="current-password" autocapitalize="none" autocorrect="off" spellcheck="false" required dir="ltr"><div class="err" id="e"></div><button class="btn block">تسجيل الدخول</button><p class="center" style="margin:12px 0 0"><a class="lnk" href="#" id="fp">نسيت كلمة المرور؟</a></p></form><p class="center">ما عندكش حساب؟ <a class="lnk" href="#/register">إنشاء حساب</a></p>`);
  document.getElementById('fp').onclick = async ev => {
    ev.preventDefault(); const em = (document.querySelector('[name=email]').value || '').trim(), e = document.getElementById('e');
    if (!em) { e.textContent = 'اكتب بريدك أولًا ثم اضغط نسيت كلمة المرور'; return; }
    try { await fetch(SB + '/auth/v1/recover?redirect_to=' + encodeURIComponent(location.origin + location.pathname), { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: em }) }); e.style.color = '#4a7766'; e.textContent = 'لو البريد مسجّل هتوصلك رسالة لتغيير كلمة المرور.'; } catch (x) { e.textContent = errAr(x); }
  };
  document.getElementById('f').onsubmit = async ev => {
    ev.preventDefault(); const f = new FormData(ev.target), b = ev.target.querySelector('button'); b.disabled = true; document.getElementById('e').textContent = '';
    try {
      const em = f.get('email').trim(), pw0 = f.get('password'), a2e = x => x.replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 1776));
      const flip = x => x ? (x[0] === x[0].toUpperCase() ? x[0].toLowerCase() : x[0].toUpperCase()) + x.slice(1) : x;
      const tries = [...new Set([pw0, pw0.trim(), a2e(pw0), a2e(pw0.trim()), flip(pw0.trim())])];
      let r, j;
      for (const pw of tries) { r = await fetch(SB + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: em, password: pw }) }); j = await r.json(); if (r.ok) break; if (r.status !== 400) break; }
      if (!r.ok) throw new Error(j.msg || j.error_description || j.error || 'error');
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

const THEMES = [['green', 'أخضر هادئ', 0], ['blue', 'أزرق هادئ', 62], ['lav', 'بنفسجي هادئ', 125], ['sand', 'رملي دافئ', -95]];
function applyTheme() { const t = THEMES.find(x => x[0] === localStorage.getItem('theme')) || THEMES[0]; document.documentElement.style.filter = t[2] ? `hue-rotate(${t[2]}deg) saturate(.92)` : ''; }
applyTheme();
(function () { const st = document.createElement('style'); st.textContent = `
body{font-size:16px;line-height:1.65}
.text-foreground-400,.text-foreground-500,.text-foreground-600{color:oklch(var(--foreground-800))!important}
.text-foreground-700,.text-foreground-800{color:oklch(var(--foreground-950))!important}
[class*="text-[9"],[class*="text-[10"]{font-size:13px!important}
[class*="text-[11"]{font-size:13.5px!important}
[class*="text-[12"]{font-size:14.5px!important}
[class*="text-[13"]{font-size:15.5px!important}
[class*="text-[14"],[class*="text-[15"]{font-size:17px!important}

body{background:#f6f3ec!important}
.bg-primary-800{background-color:#3d6656!important}.bg-primary-700{background-color:#456f5e!important}.bg-primary-600,.bg-primary-500{background-color:#55806c!important}
.border-primary-800{border-color:#3d6656!important}
.pattern-emerald{background-image:none!important;background:linear-gradient(160deg,#3f6a59,#355b4c)!important}
.text-primary-700,.text-primary-800{color:#2f5646!important}
.bg-accent-50,.bg-accent-100{background-color:#f7f0dc!important}
.border-accent-300,.border-accent-200{border-color:#e4d6a8!important}
.na{background:#eef0ea!important}td.no{background:#f7e9e7!important;color:#b0524c!important}td.ok{background:#e7f0e8!important;color:#3f7a5a!important}

.rp{font-size:14px!important}
.rp th{background:#dce8e0!important;color:#2b4a3f!important;border-left:2px solid #fff!important;border-top:0!important;padding:11px 8px!important;font-size:14.5px!important;font-weight:700!important}
.rp thead tr:nth-child(2) th{background:#e8f0ea!important}
.rp th.g{background:#cbdcd1!important}
.rp th:first-child{background:#cbdcd1!important;color:#2b4a3f!important}
.rp td{padding:10px 6px!important;font-size:15.5px!important;border-bottom:1px solid #eceee6!important;border-left:1px solid #f3f3ec!important}
.rp tr:nth-child(even) td{background:#fbfaf6}
.rp td:first-child{background:#f1f5ef!important;color:#2b4a3f!important;border-left:2px solid #dbe6dc!important;font-size:14.5px!important}
.rp td.fr{box-shadow:inset 0 0 0 99px rgba(196,170,98,.10)}
.rv,.rv .panel{border-radius:16px}

.rp td{background:#fff!important}.rp tr:nth-child(even) td{background:#fbfaf6!important}
td.no{background:#fff!important;color:#d2b3af!important;font-size:15px!important;font-weight:400!important}
td.ok{background:#e4f0e7!important;color:#3a7a56!important;font-weight:800!important;font-size:18px!important}
td.na{background:#f1f1ec!important}
.rp td:first-child{background:#f1f5ef!important}
.hubw{background:#f7f0dc!important;border:1.5px solid #e4d6a8!important;border-radius:18px!important;padding:16px!important}
.hubw h2{color:#6b4a14!important}.hubw .mt{color:#6b5a30!important}
.hubw a{border-color:#e4d6a8!important}
.hubw a span:first-child{background:#f3e5b8!important;color:#8a5f12!important}
main h1{font-size:clamp(24px,5.2vw,34px)!important;font-weight:800!important;line-height:1.35!important}
main h2{font-size:20px!important;font-weight:700!important}
main h3{font-size:17px!important;font-weight:700!important}
.sp header h1{font-size:26px!important}.sp h3{font-size:17px!important}
.mt,.sp .mt,.rv .mt{opacity:1!important;color:#33443a!important;font-size:13.5px!important}
.ra .muted{opacity:1;color:#33443a}
.sp .l,.sp p{opacity:1!important}
input,select,textarea{font-size:16px}
.no-scrollbar::-webkit-scrollbar{display:none}.no-scrollbar{scrollbar-width:none}
`; document.head.appendChild(st); })();
/* ---------- data shared ---------- */
async function loadActivities() { return await q('wird_activities', 'select=*&is_active=eq.true&order=order_index.asc,created_at.asc'); }
async function loadMyActs() {
  const acts0 = await loadActivities(); if (!me.stage_id) return acts0;
  const sw = await q('stage_wird', 'select=*&stage_id=eq.' + me.stage_id + '&limit=500'); if (!sw.length) return acts0;
  const m = {}; sw.forEach(r => m[r.activity_id] = r); const now = new Date(), w = now.getDay(), hd = hjDay(now), out = [];
  acts0.forEach(a => {
    const r = m[a.id]; if (!r || !r.enabled) return; const rl = a.day_rule || 'daily', c = Object.assign({}, a);
    if (rl === 'fri' && w !== 5) return;
    if (rl === 'fast') { const qt = r.per_week || r.per_month; if (!qt) { if (!(w === 1 || w === 4 || (hd >= 13 && hd <= 15))) return; } else { c.description = (r.note ? r.note + ' · ' : '') + (r.per_week ? 'المطلوب ' + n2a(r.per_week) + ' في الأسبوع' : '') + (r.per_month ? ' · ' + n2a(r.per_month) + ' أيام في الشهر' : ''); } }
    if (r.target_count != null) { if (a.type === 'quran') { if (r.target_count < 1) { c.quran_parts = 1; c._half = true; } else c.quran_parts = Math.round(r.target_count); } else c.target_count = r.target_count; }
    if (r.max_val != null) c.max_val = r.max_val;
    if (r.monthly_juz) c.monthly_juz = r.monthly_juz;
    out.push(c);
  });
  return out;
}
async function loadDay(uid, date) {
  const [logs, parts] = await Promise.all([q('wird_logs', `select=*&member_id=eq.${uid}&log_date=eq.${date}`), q('wird_part_logs', `select=*&member_id=eq.${uid}&log_date=eq.${date}&completed=eq.true`)]);
  return { logs, parts };
}
function actState(a, day) {
  const log = day.logs.find(l => l.activity_id === a.id);
  if (a.type === 'toggle') return { done: !!(log && log.completed), val: 0, total: 1 };
  if (a.type === 'counter' && a.max_val != null) { const v = log ? +log.counter_value : 0; return { done: v > 0 && v <= a.max_val && (a.min_val == null || v >= a.min_val), val: v, total: a.max_val, sleep: true }; }
  if (a.type === 'counter' && (a.target_count || 0) >= 100) { const v = log ? +log.counter_value : 0, t = a.target_count; return { done: v >= t, val: v, total: t, typed: true }; }
  if (a.type === 'counter') { const v = log ? log.counter_value : 0, t = a.target_count || 1; return { done: v >= t, val: v, total: t }; }
  const n = a.quran_parts || 1, got = day.parts.filter(p => p.activity_id === a.id).map(p => p.part_index); return { done: got.length >= n, val: got.length, total: n, got };
}
async function setLog(a, completed, counter) {
  return api('/rest/v1/wird_logs?on_conflict=member_id,activity_id,log_date', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: { tenant_id: TENANT, member_id: me.id, activity_id: a.id, log_date: today(), completed, counter_value: counter, recorded_at: new Date().toISOString() } });
}

/* ---------- Readdy-style shell & member views ---------- */
function navItems() {
  const b = [['/', 'ri-home-4-line', 'الرئيسية'], ['/ward', 'ri-checkbox-circle-line', 'وردي'], ['/progress', 'ri-line-chart-line', 'تقدمي'], ['/seasons', 'ri-calendar-line', 'المواسم'], ['/group', 'ri-group-line', 'مجموعتي']];
  const st = isStaff() ? [['/sheikh/reports', 'ri-table-line', 'الجداول'], ['/sheikh', 'ri-tools-line', 'الإدارة والبناء']] : [];
  return b.concat(st, [['/settings', 'ri-settings-3-line', 'الإعدادات']]);
}
const navOn = (r, p) => p === '/' ? r === '/' : p === '/sheikh' ? (r.startsWith('/sheikh') && !r.startsWith('/sheikh/reports')) : p === '/settings' ? ['/settings', '/more', '/reminders', '/install'].includes(r) : (r === p || r.startsWith(p + '/') || (p === '/ward' && r === '/ward/history') || (p === '/sheikh/members' && r.startsWith('/sheikh/member/')));
const fG = new Intl.DateTimeFormat('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fH = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' });
const fW = new Intl.DateTimeFormat('ar-EG', { weekday: 'long' });
let lastStreak = 0, bellOpen = false;
const NOTIFS = [['ri-trophy-line', 'bg-accent-100 text-accent-800', 'أنت مؤهل للانتقال إلى المرحلة الأولى', 'استوفيت شروط المرحلة التمهيدية، وبانتظار اعتماد الشيخ.', 'قبل ساعة', 1], ['ri-calendar-line', 'bg-primary-100 text-primary-800', 'بقي ٩ أيام على انتهاء موسم الست من شوال', 'أكملت ٤ أيام من ٦، وترتيبك الرابع في المجموعة.', 'قبل ٣ ساعات', 1], ['ri-notification-3-line', 'bg-secondary-100 text-secondary-800', 'إعلان جديد من شيخك', 'مجلس التربية الأسبوعي مساء الخميس بعد العشاء.', 'أمس', 1], ['ri-time-line', 'bg-background-200 text-foreground-700', 'تذكير بورد اليوم', 'لم تُسجّل أذكار المساء بعد. الورد بانتظارك.', 'أمس', 0]];
function shell(inner, opts = {}) {
  const r = route, d = new Date(), init = esc((me.full_name || 'م').trim()[0] || 'م');
  const nl = (c) => navItems().map(([p, i, l]) => c(p, i, l, navOn(r, p)));
  const side = nl((p, i, l, on) => `<li><a class="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors duration-smooth ${on ? 'bg-primary-50 font-medium text-primary-800' : 'text-foreground-700 hover:bg-background-100 hover:text-foreground-900'}" href="#${p}"><span class="flex h-8 w-8 items-center justify-center rounded-md ${on ? 'bg-primary-100 text-primary-700' : 'bg-background-100 text-foreground-500'}"><i class="${i} text-base"></i></span><span class="whitespace-nowrap">${l}</span>${on ? '<span class="mr-auto h-1.5 w-1.5 rounded-full bg-accent-500"></span>' : ''}</a></li>`).join('');
  const bot = nl((p, i, l, on) => `<li class="min-w-[68px] flex-1 shrink-0"><a class="group flex cursor-pointer flex-col items-center gap-0.5 rounded-md px-1 py-1.5 transition-colors duration-smooth ${on ? 'text-primary-700' : 'text-foreground-500 hover:text-primary-600'}" href="#${p}"><span class="flex h-8 w-8 items-center justify-center rounded-md transition-colors duration-smooth ${on ? 'bg-primary-100' : 'bg-transparent group-hover:bg-background-200'}"><i class="${i} text-[17px] leading-none"></i></span><span class="whitespace-nowrap text-[11px] font-semibold leading-tight">${l}</span></a></li>`).join('');
  const notes = NOTIFS.map(([ic, cl, t, s, w, u]) => `<li class="flex gap-3 px-4 py-3 transition-colors duration-smooth hover:bg-background-100"><span class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${cl}"><i class="${ic} text-sm"></i></span><div class="min-w-0 flex-1"><div class="flex items-start justify-between gap-2"><p class="text-[13px] font-medium leading-snug text-foreground-900">${t}</p>${u ? '<span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500"></span>' : ''}</div><p class="mt-0.5 text-[11px] leading-relaxed text-foreground-600">${s}</p><p class="mt-1 text-[10px] text-foreground-400">${w}</p></div></li>`).join('');
  const sub = (me.group_name || 'بدون حلقة');
  return `<div class="min-h-[100dvh] w-full overflow-x-clip bg-background-100"><div class="mx-auto flex w-full max-w-[1600px]">
<aside class="sticky top-0 hidden h-screen w-[272px] shrink-0 flex-col border-l border-background-200 bg-background-50 lg:flex"><div class="px-5 pb-5 pt-6"><a class="flex cursor-pointer items-center gap-3" href="#/"><span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-700 font-heading text-[15px] font-semibold text-accent-200">م</span><span class="min-w-0"><span class="block font-heading text-[15px] font-semibold text-foreground-950">مُتَرَبِّي</span><span class="block truncate text-[11px] text-foreground-500">منصة التربية والورد اليومي</span></span></a></div>
<nav class="flex-1 overflow-y-auto px-3 no-scrollbar"><p class="px-3 pb-2 text-[11px] font-medium tracking-wide text-foreground-400">القائمة الرئيسية</p><ul class="space-y-1">${side}</ul></nav>
<div class="space-y-3 px-4 pb-5">${lastStreak > 0 ? `<div class="rounded-lg border border-accent-200/80 bg-accent-50 p-3.5"><div class="flex items-center gap-2 text-accent-800"><span class="flex h-6 w-6 items-center justify-center"><i class="ri-fire-line text-base"></i></span><p class="text-xs font-semibold">${lastStreak} يومًا متتاليًا</p></div><p class="mt-1.5 text-[11px] leading-relaxed text-accent-900/80">استمر على وردك اليومي، فالقليل الدائم خير من الكثير المنقطع.</p></div>` : ''}
<a class="flex cursor-pointer items-center gap-3 rounded-lg border border-background-200 bg-background-50 p-3 transition-colors duration-smooth hover:bg-background-100" href="#/more"><span class="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 font-heading text-sm font-semibold text-primary-800">${init}</span><span class="min-w-0 flex-1"><span class="block truncate text-[13px] font-medium text-foreground-900">${esc(me.full_name)}</span><span class="block truncate text-[11px] text-foreground-500">${esc(sub)}</span></span><span class="flex h-6 w-6 items-center justify-center text-foreground-400"><i class="ri-arrow-left-s-line text-base"></i></span></a></div></aside>
<div class="flex min-h-[100dvh] w-full min-w-0 flex-1 flex-col"><header class="sticky top-0 z-30 border-b border-background-200 bg-background-100/90 backdrop-blur-md"><div class="mx-auto flex w-full max-w-[1180px] items-center justify-between gap-3 px-4 py-3 md:px-8"><div class="flex min-w-0 items-center gap-2.5"><a class="flex cursor-pointer items-center gap-2 lg:hidden" href="#/"><span class="flex h-8 w-8 items-center justify-center rounded-md bg-primary-700 font-heading text-[11px] font-semibold text-accent-200">م</span><span class="font-heading text-[13px] font-semibold text-foreground-950">مُتَرَبِّي</span></a><div class="hidden min-w-0 lg:block"><p class="font-heading text-[13px] font-semibold text-foreground-900">${fW.format(d)} · ${fH.format(d)}</p><p class="text-[11px] text-foreground-500">${fG.format(d)}</p></div></div>
<div class="flex items-center gap-2">${roleBadge()}
<div class="relative"><button type="button" id="bellb" class="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-background-200 bg-background-50 text-foreground-700 transition-colors duration-smooth hover:bg-background-200" aria-label="الإشعارات"><i class="ri-notification-3-line text-base"></i><span class="absolute -top-1 -left-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-500 px-1 text-[9px] font-semibold text-accent-950">3</span></button>
<div id="bellp" style="display:none"><div id="bello" class="fixed inset-0 z-40"></div><div class="fixed inset-x-3 top-[68px] z-50 overflow-hidden rounded-lg border border-background-200 bg-background-50 md:absolute md:inset-x-auto md:left-0 md:top-full md:mt-2 md:w-[370px]"><div class="flex items-center justify-between border-b border-background-200 px-4 py-3"><div><p class="font-heading text-sm font-semibold text-foreground-950">الإشعارات</p><p class="text-[11px] text-foreground-500">آخر التحديثات على وردك ومرحلتك</p></div><button type="button" id="bellc" class="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-foreground-500 hover:bg-background-100" aria-label="إغلاق الإشعارات"><i class="ri-close-line text-base"></i></button></div><ul class="max-h-[60vh] divide-y divide-background-200 overflow-y-auto no-scrollbar">${notes}</ul><div class="border-t border-background-200 bg-background-100 px-4 py-2.5 text-center"><p class="text-[11px] text-foreground-500">عيّنة توضيحية: الإشعارات الحقيقية تأتي مع تفعيل التذكيرات</p></div></div></div></div>
<a class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-primary-100 font-heading text-[13px] font-semibold text-primary-800 transition-colors duration-smooth hover:bg-primary-200" aria-label="حسابي" href="#/more">${init}</a></div></div></header>
<main class="mx-auto w-full max-w-[1180px] flex-1 px-4 pb-28 pt-5 md:px-8 md:pt-7 lg:pb-14">${inner}</main></div></div>
<nav class="fixed inset-x-0 bottom-0 z-40 border-t border-background-200 bg-background-50/95 backdrop-blur-md lg:hidden"><ul class="no-scrollbar mx-auto flex max-w-full items-stretch overflow-x-auto px-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1.5">${bot}</ul></nav>`;
}
function draw(inner) {
  $app.innerHTML = shell(inner); window.scrollTo(0, 0);
  try { const a = $app.querySelector('nav.fixed li a.text-primary-700'); if (a) a.scrollIntoView({ inline: 'center', block: 'nearest' }); } catch (e) { }
  bellOpen = false;
}
function addBack() {
  const r = (location.hash.replace(/^#/, '') || '/').split('?')[0], m = document.querySelector('main'); if (!m || document.getElementById('bk')) return;
  const inner = ['/more', '/reminders', '/install', '/ward/history'].includes(r) || (r.startsWith('/sheikh/') && r !== '/sheikh/reports') || (r === '/sheikh/reports');
  if (!inner) return;
  const up = r === '/more' || r === '/reminders' || r === '/install' ? '/settings' : r === '/ward/history' ? '/ward' : r.startsWith('/sheikh/member/') ? '/sheikh/members' : '/sheikh';
  const b = document.createElement('button'); b.id = 'bk'; b.type = 'button'; b.innerHTML = '<i class="ri-arrow-right-line" style="font-size:22px"></i><span>رجوع</span>';
  b.style.cssText = 'display:inline-flex;align-items:center;gap:6px;margin:0 0 10px;padding:9px 16px;border:1.5px solid #cddfd3;background:#fff;color:#2b4a3f;border-radius:999px;font:inherit;font-size:16px;font-weight:700;cursor:pointer';
  b.onclick = () => { go(up); render(); };
  m.insertBefore(b, m.firstChild);
}
new MutationObserver(() => addBack()).observe(document.getElementById('app') || document.body, { childList: true, subtree: false });
document.addEventListener('click', e => {
  const p = document.getElementById('bellp'); if (!p) return;
  const hit = id => e.target.closest && e.target.closest('#' + id);
  if (hit('bellb')) { bellOpen = !bellOpen; p.style.display = bellOpen ? 'block' : 'none'; }
  else if ((hit('bello') || hit('bellc')) && bellOpen) { bellOpen = false; p.style.display = 'none'; }
});
const wrapS = inner => `<div class="space-y-4 md:space-y-5">${inner}</div>`;
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
const UNIT = a => a.target_unit || 'مرة';
const stepOf = a => /ركع/.test(a.target_unit || '') || /رواتب|ركعة|الضحى|القيام/.test(a.title || '') ? 2 : 1;
function iconFor(a) { const t = a.title || ''; if (/قرآن/.test(t) || a.type === 'quran') return 'ri-book-open-line'; if (/صباح|مساء/.test(t)) return 'ri-sun-line'; if (/استغفار/.test(t)) return 'ri-heart-3-line'; if (/النبي/.test(t)) return 'ri-heart-line'; if (/صلوات|فرائض|جماعة/.test(t) || a.category === 'obligations') return 'ri-star-line'; if (a.category === 'worship') return 'ri-moon-line'; return 'ri-heart-line'; }
const CAT_SUB = { obligations: 'أساس الورد اليومي', quran: 'وردك اليومي من الكتاب', dhikr: 'حصن اليوم', worship: 'صلة يومك بالله' };
const CAT_ORDER = ['obligations', 'quran', 'dhikr', 'worship'];
function meta(a) { if (a.type === 'counter' && a.max_val != null) return `حتى ${n2a(a.max_val)} ساعات`; if (a.type === 'counter') return `الهدف ${n2a(a.target_count || 1)} ${esc(UNIT(a))}`; if (a.type === 'quran') return `الهدف ${n2a(a.quran_parts || 1)} ${a.quran_unit === 'pages' ? 'صفحات' : 'أجزاء'}`; return 'إتمام مرة واحدة'; }
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

async function activeCount() { try { const r = await q('profiles', 'select=id&status=eq.active&limit=2000'); return r.length; } catch (e) { return 0; } }
const fGD = new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' });
const fHD = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' });
const fDN = new Intl.DateTimeFormat('ar-EG', { weekday: 'long' });
function dateCard() { const d = new Date(); return `<section class="rounded-lg border border-primary-200 bg-background-50 p-4 md:p-5" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap"><div><p style="margin:0;font-size:32px;font-weight:800;color:#2b4a3f;line-height:1.2">${fDN.format(d)}</p><p style="margin:4px 0 0;font-size:22px;font-weight:700;color:#4a7766">${fHD.format(d).replace(/\u200f?\s?هـ?$/, '')} هـ</p></div><div style="text-align:left"><p style="margin:0;font-size:13px;color:#33443a;font-weight:600">التاريخ الميلادي</p><p style="margin:2px 0 0;font-size:20px;font-weight:700;color:#2b4a3f">${fGD.format(d)}</p></div></section>`; }
async function viewHome() {
  await loadMeCtx();
  const [acts, day] = await Promise.all([loadMyActs(), loadDay(me.id, today())]);
  const [st, active] = await Promise.all([stats(acts), activeCount()]);
  const states = acts.map(a => [a, actState(a, day)]), total = acts.length, done = states.filter(s => s[1].done).length, left = states.filter(s => !s[1].done), P = pct(done, total);
  const nm = (me.full_name || '').trim().split(/\s+/).slice(0, 2).join(' ');
  const card = (t, v, ic) => `<div class="rounded-lg border border-background-300 bg-background-50 p-4" style="text-align:center"><i class="${ic}" style="font-size:24px;color:#4a7766"></i><p class="num" style="margin:6px 0 0;font-size:30px;font-weight:800;color:#2b4a3f;line-height:1.1">${v}</p><p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#33443a">${t}</p></div>`;
  draw(wrapS(whiteBanner() + dateCard() + `
<section class="overflow-hidden rounded-lg border border-primary-800 bg-primary-800"><div class="pattern-emerald"><div class="flex flex-col gap-5 p-5 md:flex-row md:items-center md:justify-between md:p-7"><div class="min-w-0"><p style="margin:0;font-size:17px;font-weight:600;color:#d8f3e3">السلام عليكم ورحمة الله وبركاته</p><h1 style="margin:4px 0 0;color:#fff">${esc(nm)}</h1>
<p style="margin:10px 0 0;font-size:17px;line-height:1.7;color:#ecfdf3;max-width:460px">${total ? (left.length ? `المطلوب منك اليوم: ${n2a(left.length)} من ${n2a(total)} أوراد. اضغط الزر وسجّل ما أتممته.` : 'ما شاء الله، أتممت ورد اليوم كله. ثبّتك الله.') : 'لا توجد أوراد لمرحلتك بعد.'}</p>
<a href="#/ward" style="margin-top:16px;display:flex;align-items:center;justify-content:center;gap:8px;background:#fff;color:#2b4a3f;border-radius:14px;padding:14px 22px;font-size:19px;font-weight:800;text-decoration:none;max-width:360px"><i class="ri-checkbox-circle-line" style="font-size:22px"></i>سجّل ورد اليوم</a></div>
<div class="shrink-0" style="align-self:center"><div class="relative rounded-full" role="img" aria-label="${n2a(done)} من ${n2a(total)}" style="width:150px;height:150px;background:conic-gradient(#fff ${P}%, rgba(255,255,255,.22) ${P}% 100%)"><div class="absolute flex flex-col items-center justify-center rounded-full bg-primary-800" style="inset:10px"><span class="num" style="font-size:34px;font-weight:800;color:#fff;line-height:1">${n2a(done)}<span style="font-size:19px;color:#d8f3e3">/${n2a(total)}</span></span><span style="margin-top:4px;font-size:14px;color:#d8f3e3;font-weight:600">تم اليوم</span></div></div></div></div></div></section>
<div class="grid grid-cols-3 gap-3">${card('أيام متتالية', n2a(st.streak), 'ri-fire-line')}${card('أوراد اليوم', n2a(done) + '/' + n2a(total), 'ri-checkbox-circle-line')}${card('عدد النشطين', n2a(active), 'ri-group-line')}</div>
${left.length ? `<section class="rounded-lg border border-background-300 bg-background-50 p-4 md:p-5"><h2 style="margin:0 0 10px;color:#2b4a3f">المتبقي من وردك</h2><ul style="list-style:none;margin:0;padding:0;display:grid;gap:8px">${left.slice(0, 6).map(([a]) => `<li><a href="#/ward" style="display:flex;align-items:center;gap:10px;padding:11px 12px;border:1px solid #e1e8df;border-radius:12px;text-decoration:none;color:#2b4a3f;font-size:16px;font-weight:600"><span style="width:20px;height:20px;border-radius:50%;border:2px solid #b3cdbf;flex:none"></span><span style="flex:1">${esc(a.title)}</span><i class="ri-arrow-left-s-line" style="color:#4a7766"></i></a></li>`).join('')}</ul>${left.length > 6 ? `<p style="margin:10px 0 0;font-size:14px;color:#33443a">و${n2a(left.length - 6)} أوراد أخرى في صفحة وردي.</p>` : ''}</section>` : ''}`));
}

/* ward */
let syncT;
function setSync(s) {
  const el = document.getElementById('sync'); if (!el) return; clearTimeout(syncT);
  const M = { idle: ['ri-save-3-line', 'يُحفظ تلقائيًا', 'border-primary-200 bg-primary-50 text-primary-800'], saving: ['ri-loader-4-line animate-spin', 'جارٍ الحفظ…', 'border-accent-200 bg-accent-50 text-accent-900'], ok: ['ri-check-line', 'تم الحفظ', 'border-primary-300 bg-primary-100 text-primary-800'], err: ['ri-error-warning-line', 'تعذّر الحفظ', 'border-background-300 bg-secondary-100 text-secondary-900'] }[s];
  el.className = 'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] ' + M[2]; el.innerHTML = `<i class="${M[0]} text-[11px]"></i>${M[1]}`;
  if (s === 'ok') syncT = setTimeout(() => setSync('idle'), 2000);
}
function juzBlock(a) {
  if (!a.monthly_juz) return ''; const l = ctx.day.logs.find(x => x.activity_id === a.id), td = l && l.qiyam_juz ? +l.qiyam_juz : 0, tot = ctx.juzOther + td, P = Math.min(100, pct(tot, a.monthly_juz));
  return `<div class="mt-2.5 rounded-md border border-accent-200 bg-accent-50 p-2.5"><div class="flex items-center justify-between gap-3"><label for="jz" class="text-[11.5px] text-foreground-800">كم جزءًا قرأت في قيامك اليوم؟</label><input id="jz" data-j="${a.id}" type="number" inputmode="decimal" min="0" max="30" step="0.5" value="${td || ''}" placeholder="٠" style="width:78px;height:36px;text-align:center;border:1px solid #cfd9cc;border-radius:8px;font:inherit;font-size:15px;background:#fff"></div><p class="mt-2 text-[11px] text-foreground-700">ختمة القيام هذا الشهر: <b class="num">${n2a(tot)}</b> من ${n2a(a.monthly_juz)} جزءًا${tot >= a.monthly_juz ? ' · ما شاء الله، تمّت الختمة' : ''}</p><div class="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-background-200"><div class="h-full rounded-full bg-accent-500" style="width:${P}%"></div></div></div>`;
}
function whiteBanner() {
  const q0 = new URLSearchParams(location.search).get('hj'), hd = q0 ? +q0 : hjDay(new Date()); let t = '', s = '';
  if (hd === 11 || hd === 12) { t = 'الأيام البيض تبدأ ' + (hd === 12 ? 'غدًا' : 'بعد غدٍ'); s = 'الثالث عشر والرابع عشر والخامس عشر من الشهر الهجري. نوِ الصيام من الآن.'; }
  else if (hd >= 13 && hd <= 15) { t = 'اليوم من الأيام البيض (' + n2a(hd) + ' هجري)'; s = 'صيام ثلاثة أيام من كل شهر سنّة مؤكدة. سجّل صيامك في ورد اليوم.'; }
  else return '';
  return `<div class="animate-rise flex items-start gap-3 rounded-lg border border-accent-300 bg-accent-50 p-3.5" role="status"><span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent-100 text-accent-800"><i class="ri-moon-line text-base"></i></span><div><p class="text-[13px] font-semibold text-accent-900">${t}</p><p class="mt-0.5 text-[11px] leading-relaxed text-accent-900/80">${s}</p></div></div>`;
}
function wardArticle(a) {
  const st = actState(a, ctx.day), done = st.done, ic = iconFor(a);
  const badge = { toggle: 'إتمام بسيط', counter: 'عدّاد', quran: 'ورد قرآن' }[a.type];
  const head = `<div class="flex items-start gap-3"><span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${done ? 'bg-primary-100 text-primary-700' : 'bg-background-100 text-foreground-500'}"><i class="${ic} text-base"></i></span><div class="min-w-0 flex-1"><div class="flex flex-wrap items-center gap-x-2 gap-y-1"><h3 class="text-[13px] font-medium leading-snug ${done ? 'text-foreground-600' : 'text-foreground-950'}">${esc(a.title)}</h3><span class="rounded-full border border-background-300 bg-background-100 px-2 py-0.5 text-[10px] text-foreground-500">${badge}</span>${done ? '<span class="inline-flex items-center gap-0.5 rounded-full bg-primary-100 px-2 py-0.5 text-[10px] text-primary-800"><i class="ri-check-double-line text-[11px]"></i>مكتمل</span>' : ''}</div>${a.description ? `<p class="mt-1 text-[11px] leading-relaxed text-foreground-500">${esc(a.description)}</p>` : ''}<p class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px] text-foreground-500"><span class="num">${meta(a)}</span></p></div>`;
  const wrap = body => `<article class="rounded-lg border p-3.5 transition-colors duration-smooth ${done ? 'border-primary-200 bg-primary-50' : 'border-background-200 bg-background-50'}">${body}</article>`;
  if (a.type === 'toggle') return wrap(head + `<button type="button" data-a="${a.id}" data-k="t" aria-pressed="${done}" aria-label="${done ? 'إلغاء تسجيل ' : 'تسجيل '}${esc(a.title)}" style="width:46px;height:46px;border-radius:50%;flex:none;cursor:pointer;display:flex;align-items:center;justify-content:center;border:2.5px solid ${done ? '#4a7766' : '#9bb8a5'};background:${done ? '#4a7766' : '#fff'};color:#fff;font-size:24px;line-height:1"><i class="ri-check-line" style="opacity:${done ? 1 : 0}"></i></button></div>`);
  if (st.typed) return wrap(head + `</div><div class="mt-3 flex items-center justify-between gap-3 rounded-md border border-background-200 bg-background-100/70 p-2.5"><label for="nv${a.id.slice(0, 4)}" class="text-[13px] font-semibold text-foreground-900">اكتب العدد الذي ذكرته <span style="font-weight:500">(الهدف ${n2a(st.total)})</span></label><input id="nv${a.id.slice(0, 4)}" data-nv="${a.id}" type="number" inputmode="numeric" min="0" max="100000" step="1" value="${st.val || ''}" placeholder="٠" style="width:110px;height:44px;text-align:center;border:1.5px solid #b3cdbf;border-radius:10px;font:inherit;font-size:20px;font-weight:700;background:#fff"></div>`);
  if (st.sleep) return wrap(head + `</div><div class="mt-3 flex items-center justify-between gap-3 rounded-md border border-background-200 bg-background-100/70 p-2.5"><label for="sl" class="text-[11.5px] text-foreground-700">كم ساعة نمت؟ <span class="text-foreground-400">(الحد الأقصى ${n2a(st.total)})</span></label><input id="sl" data-h="${a.id}" type="number" inputmode="decimal" min="0" max="24" step="0.5" value="${st.val || ''}" placeholder="٠" style="width:84px;height:38px;text-align:center;border:1px solid #cfd9cc;border-radius:8px;font:inherit;font-size:15px;background:#fff"></div>`);
  if (a.type === 'counter') { const stp = stepOf(a); return wrap(head + `</div><div class="mt-3 rounded-md border border-background-200 bg-background-100/70 p-2.5"><div style="display:flex;align-items:center;gap:12px"><button type="button" data-a="${a.id}" data-k="p" aria-label="تسجيل ${esc(a.title)}" style="width:64px;height:64px;border-radius:50%;flex:none;cursor:pointer;display:flex;align-items:center;justify-content:center;border:3px solid ${done ? '#4a7766' : '#b3cdbf'};background:${done ? '#4a7766' : '#fff'};color:${done ? '#fff' : '#2b4a3f'};font:inherit;font-size:24px;font-weight:800">${n2a(st.val)}</button><div style="flex:1;min-width:0"><p style="margin:0;font-size:16px;font-weight:700;color:#2b4a3f">${n2a(st.val)} من ${n2a(st.total)} ${esc(UNIT(a))}</p><p style="margin:2px 0 0;font-size:14px;color:#33443a">اضغط الدائرة لتسجيل ${n2a(stp)} ${esc(UNIT(a))}</p></div><button type="button" data-a="${a.id}" data-k="m" ${st.val <= 0 ? 'disabled' : ''} aria-label="تراجع" style="border:1px solid #d3e2d9;background:#fff;color:#3b6556;border-radius:12px;padding:8px 10px;font:inherit;font-size:14px;font-weight:600;cursor:pointer;opacity:${st.val <= 0 ? .4 : 1}"><i class="ri-arrow-go-back-line"></i> تراجع</button></div><div class="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-background-200"><div class="h-full rounded-full bg-primary-500" style="width:${Math.min(100, pct(st.val, st.total))}%"></div></div></div></div>`); }
  const lbl = a._half ? 'نصف جزء' : a.quran_unit === 'pages' ? 'الصفحة' : 'الجزء';
  return wrap(head + `</div><div class="mt-3"><p class="num text-[10.5px] text-foreground-500">سجّلت ${n2a(st.val)} من ${n2a(st.total)}</p><div class="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">${Array.from({ length: st.total }, (_, i) => { const on = st.got.includes(i); return `<button type="button" data-a="${a.id}" data-k="q" data-i="${i}" aria-pressed="${on}" class="flex cursor-pointer items-center justify-between gap-1.5 rounded-md border px-2.5 py-2 text-[11px] transition-colors duration-smooth ${on ? 'border-primary-300 bg-primary-100 text-primary-800' : 'border-background-300 bg-background-50 text-foreground-600 hover:border-primary-300 hover:bg-background-100'}"><span class="whitespace-nowrap">${a._half ? lbl : lbl + ' ' + n2a(i + 1)}</span><span class="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${on ? 'border-primary-600 bg-primary-600 text-background-50' : 'border-background-300 text-transparent'}"><i class="ri-check-line text-[10px]"></i></span></button>`; }).join('')}</div><div class="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-background-200"><div class="h-full rounded-full bg-primary-500 transition-all duration-smooth" style="width:${pct(st.val, st.total)}%"></div></div></div>${ctx.qr && a === ctx.acts.find(x => x.type === 'quran') ? '<div id="qp" class="mt-3"></div>' : ''}`);
}
function wardPicker() {
  if (!isStaff() || !ctx.pm) return '';
  return `<div class="rounded-lg border border-accent-300 bg-accent-50 p-3" style="display:grid;gap:6px"><label for="wp" style="font-size:15px;font-weight:700;color:#3d2a00">عرض ورد:</label><select id="wp" style="height:46px;border:1.5px solid #d9b66a;border-radius:12px;background:#fff;font:inherit;font-size:17px;font-weight:700;padding:0 10px;color:#2b4a3f"><option value="">وردي أنا</option>${ctx.pm.map(m => `<option value="${m.id}" ${window.__wardFor === m.id ? 'selected' : ''}>${esc(m.full_name)}</option>`).join('')}</select></div>`;
}
function bindPicker() { const e = document.getElementById('wp'); if (e) e.onchange = () => { window.__wardFor = e.value || null; render(); }; }
async function loadPicker() { ctx.pm = null; if (isStaff()) { try { ctx.pm = (await q('profiles', 'select=id,full_name,role&status=eq.active&order=full_name')).filter(m => m.id !== me.id); } catch (e) { } } }
async function viewWardOf(uid) {
  const [pr] = await q('profiles', 'select=id,full_name,stage_id&id=eq.' + uid);
  if (!pr) { window.__wardFor = null; return viewWard(); }
  const real = me; me = Object.assign({}, real, { stage_id: pr.stage_id }); let acts; try { acts = await loadMyActs(); } finally { me = real; }
  const [day, reads] = await Promise.all([loadDay(uid, today()), q('quran_reads', `select=*&member_id=eq.${uid}&read_date=eq.${today()}&order=created_at.asc`)]);
  const sts = acts.map(a => [a, actState(a, day)]), dn = sts.filter(x => x[1].done).length;
  const row = ([a, st]) => `<li style="display:flex;align-items:center;gap:10px;padding:11px 12px;border:1px solid ${st.done ? '#b3cdbf' : '#e1e8df'};background:${st.done ? '#f3faf5' : '#fff'};border-radius:12px;font-size:16px;font-weight:600;color:#2b4a3f"><span style="flex:1">${esc(a.title)}</span><span style="font-weight:800;color:${st.done ? '#4a7766' : '#b0524c'}">${st.done ? '✓' : '✗'}${st.val > 0 && !st.done ? ' ' + n2a(st.val) + '/' + n2a(st.total) : (st.typed || st.sleep) && st.val ? ' ' + n2a(st.val) : ''}</span></li>`;
  draw(wrapS(wardPicker() + `<div style="display:grid;gap:12px;margin-top:12px"><div><h1 style="margin:0;color:#2b4a3f">ورد ${esc(pr.full_name)}</h1><p style="margin:4px 0 0;font-size:16px;color:#33443a">عرض فقط لليوم: ${n2a(dn)} من ${n2a(acts.length)} أوراد.</p></div><ul style="list-style:none;margin:0;padding:0;display:grid;gap:8px">${sts.map(row).join('') || '<li style="font-size:16px">لا توجد أوراد لمرحلته.</li>'}</ul>
<section class="rounded-lg border border-background-300 bg-background-50 p-4"><h2 style="margin:0 0 8px;color:#2b4a3f">قراءة القرآن اليوم</h2>${reads.length ? `<ul style="list-style:none;margin:0;padding:0;display:grid;gap:8px">${reads.map(r => `<li style="padding:9px 12px;border:1px solid #e1e8df;border-radius:12px;font-size:16px;font-weight:600;color:#2b4a3f;background:#fff">${esc(SURAH[r.surah - 1][0])} · من ${n2a(r.from_ayah)} إلى ${n2a(r.to_ayah)}</li>`).join('')}</ul>` : '<p style="margin:0;font-size:15px;color:#33443a">لم يسجّل قراءة اليوم.</p>'}</section></div>`));
  bindPicker();
}
async function viewWard() {
  await loadPicker();
  if (isStaff() && window.__wardFor && ctx.pm && ctx.pm.some(m => m.id === window.__wardFor)) return await viewWardOf(window.__wardFor);
  window.__wardFor = null;
  const [acts, day] = await Promise.all([loadMyActs(), loadDay(me.id, today())]);
  ctx.acts = acts; ctx.day = day; ctx.juzOther = 0; ctx.wardFast = false; ctx.qr = null; if (acts.some(a => a.type === 'quran')) { try { await qpLoad(); } catch (e) { } }
  if (acts.some(a => a.monthly_juz)) { try { const t0 = new Date(); t0.setDate(t0.getDate() - (hjDay(t0) - 1)); const rows = await q('wird_logs', `select=log_date,qiyam_juz&member_id=eq.${me.id}&log_date=gte.${ymd(t0)}&log_date=lt.${today()}&qiyam_juz=gt.0`); ctx.juzOther = rows.reduce((a, r) => a + (+r.qiyam_juz || 0), 0); } catch (e) { } }
  const paint = () => {
    const sts = acts.map(a => actState(a, ctx.day)), done = sts.filter(s => s.done).length, partial = sts.filter(s => !s.done && s.val > 0).length, total = acts.length, P = pct(done, total), rem = total - done, d = new Date();
    const sec = CAT_ORDER.map(c => { const l = acts.filter(a => a.category === c); if (!l.length) return ''; const dn = l.filter(a => actState(a, ctx.day).done).length; return `<section class="animate-fade"><div class="mb-2 flex items-end justify-between gap-2 px-1"><div><h2 class="font-heading text-[13.5px] font-semibold text-foreground-950">${CATS[c]}</h2><p class="text-[10.5px] text-foreground-400">${CAT_SUB[c]}</p></div><p class="num shrink-0 text-[11px] text-foreground-500">${n2a(dn)}/${n2a(l.length)}</p></div><div class="space-y-2">${l.map(wardArticle).join('')}</div></section>`; }).join('');
    const y = window.scrollY;
    const HTML = (wardPicker() + whiteBanner() + `<div class="animate-rise rounded-lg border border-background-200 bg-background-50"><div class="flex items-center justify-between gap-2 border-b border-background-200 px-3 py-2.5"><div class="flex items-center gap-1.5 text-[11.5px] text-foreground-500"><i class="ri-calendar-event-line text-[13px]"></i>${fG.format(d)}</div><div class="flex items-center gap-1.5"><a class="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-full border border-background-300 bg-background-50 px-2.5 py-1 text-[10px] text-foreground-700 transition-colors duration-smooth hover:bg-background-200" href="#/ward/history"><i class="ri-calendar-2-line text-[11px]"></i>سجل الشهر</a><span id="sync"></span></div></div>
<div class="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between md:p-5"><div class="flex items-center gap-4"><div class="relative shrink-0 rounded-full" role="img" aria-label="نسبة الإنجاز ${P} بالمئة" style="width:92px;height:92px;background:conic-gradient(oklch(var(--primary-500)) ${P}%, oklch(var(--background-200)) ${P}% 100%)"><div class="absolute flex flex-col items-center justify-center rounded-full bg-background-50" style="inset:7px"><span class="num text-[19px] font-semibold leading-none text-foreground-950">${n2a(done)}<span class="text-[12px] text-foreground-400">/${n2a(total)}</span></span><span class="mt-1 text-[9px] text-foreground-400">مكتمل</span></div></div><div><p class="text-[11.5px] text-foreground-500">${esc(me.full_name)}</p><h1 class="mt-0.5 font-heading text-lg font-semibold text-foreground-950">ورد اليوم</h1><p class="mt-1 text-[11.5px] text-foreground-500">بقي ${n2a(rem)} أوراد</p><p class="mt-0.5 text-[10.5px] text-foreground-400">${fH.format(d)}</p></div></div>
<div class="grid w-full grid-cols-3 gap-2 sm:w-auto sm:min-w-[260px]"><div class="rounded-md border border-primary-200 bg-primary-50 px-2 py-2 text-center"><p class="num text-[15px] font-semibold leading-none text-primary-800">${n2a(done)}</p><p class="mt-1 text-[9.5px] text-primary-700">مكتمل</p></div><div class="rounded-md border border-secondary-200 bg-secondary-50 px-2 py-2 text-center"><p class="num text-[15px] font-semibold leading-none text-secondary-900">${n2a(partial)}</p><p class="mt-1 text-[9.5px] text-secondary-800">قيد الإنجاز</p></div><div class="rounded-md border border-background-300 bg-background-100 px-2 py-2 text-center"><p class="num text-[15px] font-semibold leading-none text-foreground-800">${n2a(total - done - partial)}</p><p class="mt-1 text-[9.5px] text-foreground-500">لم يبدأ</p></div></div></div>
<div class="border-t border-background-200 bg-background-100 px-4 py-2.5"><p class="flex items-start gap-1.5 text-[10.5px] leading-relaxed text-foreground-500"><i class="ri-lock-line mt-0.5 text-[12px]"></i>القالب معتمد من شيخك ولا يمكن تعديله. الورد غير المسجل يبقى غير مسجل ولا يُحتسب تلقائيًا، وسجل اليوم يُغلق بعد منتصف الليل.</p></div></div>
${sec || '<div class="rounded-lg border border-background-200 bg-background-50 p-6 text-center text-[12px] text-foreground-500">لا توجد أوراد بعد. سيضيفها الشيخ.</div>'}`);
    const wr = document.getElementById('wr'); if (ctx.wardFast && wr) { wr.innerHTML = HTML; wr.querySelectorAll('[class*=animate-]').forEach(e => e.classList.remove('animate-rise', 'animate-fade')); } else { draw(wrapS('<div id="wr" class="space-y-4 md:space-y-5">' + HTML + '</div>')); window.scrollTo(0, y); }
    ctx.wardFast = true; setSync(ctx.syncState || 'idle'); bindWard(paint);
  };
  paint();
}
function bindWard(paint) {
  qpPaint(); bindPicker();
  $app.querySelectorAll('[data-nv]').forEach(el => el.onchange = async () => {
    const a = ctx.acts.find(x => x.id === el.dataset.nv), day = ctx.day, prev = JSON.stringify(day); let v = Math.round(parseFloat(el.value)); if (!(v >= 0)) v = 0; v = Math.min(100000, v);
    const c = v >= (a.target_count || 1), l = day.logs.find(l => l.activity_id === a.id); if (l) { l.completed = c; l.counter_value = v; } else day.logs.push({ activity_id: a.id, completed: c, counter_value: v });
    try { paint(); setSync('saving'); await setLog(a, c, v); setSync('ok'); } catch (e) { ctx.day = JSON.parse(prev); paint(); toast('تعذّر الحفظ: ' + errAr(e)); }
  });
  $app.querySelectorAll('[data-j]').forEach(el => el.onchange = async () => {
    const a = ctx.acts.find(x => x.id === el.dataset.j), day = ctx.day, prev = JSON.stringify(day); let v = parseFloat(el.value); if (!(v >= 0)) v = 0; v = Math.min(30, Math.round(v * 2) / 2);
    let l = day.logs.find(l => l.activity_id === a.id); if (!l) { l = { activity_id: a.id, completed: false, counter_value: 0 }; day.logs.push(l); } l.qiyam_juz = v;
    try { ctx.syncState = 'saving'; paint(); await api('/rest/v1/wird_logs?on_conflict=member_id,activity_id,log_date', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: { tenant_id: TENANT, member_id: me.id, activity_id: a.id, log_date: today(), completed: !!l.completed, counter_value: l.counter_value || 0, qiyam_juz: v, recorded_at: new Date().toISOString() } }); ctx.syncState = 'ok'; setSync('ok'); ctx.syncState = 'idle'; } catch (e) { ctx.day = JSON.parse(prev); ctx.syncState = 'err'; paint(); toast('تعذّر الحفظ: ' + errAr(e)); ctx.syncState = 'idle'; }
  });
  $app.querySelectorAll('[data-h]').forEach(el => el.onchange = async () => {
    const a = ctx.acts.find(x => x.id === el.dataset.h), day = ctx.day, prev = JSON.stringify(day); let v = parseFloat(el.value); if (!(v >= 0)) v = 0; v = Math.min(24, Math.round(v * 2) / 2);
    const c = v > 0 && v <= a.max_val; const l = day.logs.find(l => l.activity_id === a.id); if (l) { l.completed = c; l.counter_value = v; } else day.logs.push({ activity_id: a.id, completed: c, counter_value: v });
    try { ctx.syncState = 'saving'; paint(); await setLog(a, c, v); ctx.syncState = 'ok'; setSync('ok'); ctx.syncState = 'idle'; } catch (e) { ctx.day = JSON.parse(prev); ctx.syncState = 'err'; paint(); toast('تعذّر الحفظ: ' + errAr(e)); ctx.syncState = 'idle'; }
  });
  $app.querySelectorAll('[data-a]').forEach(el => el.onclick = async () => {
    const a = ctx.acts.find(x => x.id === el.dataset.a), k = el.dataset.k, day = ctx.day, prev = JSON.stringify(day);
    const log = day.logs.find(l => l.activity_id === a.id);
    const put = (completed, counter) => { const l = day.logs.find(l => l.activity_id === a.id); if (l) { l.completed = completed; l.counter_value = counter; } else day.logs.push({ activity_id: a.id, completed, counter_value: counter }); };
    try {
      ctx.syncState = 'saving';
      if (k === 't') { const c = !(log && log.completed); put(c, 0); paint(); await setLog(a, c, 0); }
      else if (k === 'p' || k === 'm') { const v = Math.max(0, (log ? +log.counter_value : 0) + (k === 'p' ? stepOf(a) : -stepOf(a))); const c = v >= (a.target_count || 1); put(c, v); paint(); await setLog(a, c, v); }
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
/* ---------- quran picker ---------- */
const SURAH = [['الفاتحة',7],['البقرة',286],['آل عمران',200],['النساء',176],['المائدة',120],['الأنعام',165],['الأعراف',206],['الأنفال',75],['التوبة',129],['يونس',109],['هود',123],['يوسف',111],['الرعد',43],['إبراهيم',52],['الحجر',99],['النحل',128],['الإسراء',111],['الكهف',110],['مريم',98],['طه',135],['الأنبياء',112],['الحج',78],['المؤمنون',118],['النور',64],['الفرقان',77],['الشعراء',227],['النمل',93],['القصص',88],['العنكبوت',69],['الروم',60],['لقمان',34],['السجدة',30],['الأحزاب',73],['سبأ',54],['فاطر',45],['يس',83],['الصافات',182],['ص',88],['الزمر',75],['غافر',85],['فصلت',54],['الشورى',53],['الزخرف',89],['الدخان',59],['الجاثية',37],['الأحقاف',35],['محمد',38],['الفتح',29],['الحجرات',18],['ق',45],['الذاريات',60],['الطور',49],['النجم',62],['القمر',55],['الرحمن',78],['الواقعة',96],['الحديد',29],['المجادلة',22],['الحشر',24],['الممتحنة',13],['الصف',14],['الجمعة',11],['المنافقون',11],['التغابن',18],['الطلاق',12],['التحريم',12],['الملك',30],['القلم',52],['الحاقة',52],['المعارج',44],['نوح',28],['الجن',28],['المزمل',20],['المدثر',56],['القيامة',40],['الإنسان',31],['المرسلات',50],['النبأ',40],['النازعات',46],['عبس',42],['التكوير',29],['الانفطار',19],['المطففين',36],['الانشقاق',25],['البروج',22],['الطارق',17],['الأعلى',19],['الغاشية',26],['الفجر',30],['البلد',20],['الشمس',15],['الليل',21],['الضحى',11],['الشرح',8],['التين',8],['العلق',19],['القدر',5],['البينة',8],['الزلزلة',8],['العاديات',11],['القارعة',11],['التكاثر',8],['العصر',3],['الهمزة',9],['الفيل',5],['قريش',4],['الماعون',7],['الكوثر',3],['الكافرون',6],['النصر',3],['المسد',5],['الإخلاص',4],['الفلق',5],['الناس',6]];
async function qpLoad() { const reads = await q('quran_reads', `select=*&member_id=eq.${me.id}&order=created_at.desc&limit=200`); ctx.qr = { reads, sel: null }; }
function qpPaint() {
  const box = document.getElementById('qp'); if (!box || !ctx.qr) return;
  const R = ctx.qr, reads = R.reads, td = today(), list = reads.filter(r => r.read_date === td), last = reads[0], sName = n => SURAH[n - 1][0];
  const tot = list.reduce((a, r) => a + (r.to_ayah - r.from_ayah + 1), 0);
  const cur = R.sel || (last ? (last.to_ayah < SURAH[last.surah - 1][1] ? { s: last.surah, f: last.to_ayah + 1 } : { s: Math.min(114, last.surah + 1), f: 1 }) : { s: 1, f: 1 }), max = SURAH[cur.s - 1][1];
  const inp = 'width:100%;height:48px;border:1.5px solid #b3cdbf;border-radius:12px;font:inherit;font-size:19px;font-weight:700;text-align:center;background:#fff;color:#2b4a3f';
  box.innerHTML = `<div style="border-top:1px dashed #d3e2d9;padding-top:12px;display:grid;gap:10px">${last ? `<p style="margin:0;font-size:15px;font-weight:700;color:#6b4a00;background:#fdf3d8;border-radius:10px;padding:8px 12px">آخر موضع وقفت عنده: سورة ${esc(sName(last.surah))} · الآية ${n2a(last.to_ayah)}</p>` : ''}
<label style="font-size:16px;font-weight:700;color:#2b4a3f">السورة</label><select id="qs" style="${inp};text-align-last:center">${SURAH.map((x, i) => `<option value="${i + 1}" ${i + 1 === cur.s ? 'selected' : ''}>${n2a(i + 1)}. ${x[0]} (${n2a(x[1])} آية)</option>`).join('')}</select>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div><label style="font-size:16px;font-weight:700;color:#2b4a3f">من الآية</label><input id="qf" type="number" inputmode="numeric" min="1" max="${max}" value="${cur.f}" style="${inp}"></div><div><label style="font-size:16px;font-weight:700;color:#2b4a3f">إلى الآية</label><input id="qt" type="number" inputmode="numeric" min="1" max="${max}" value="${max}" style="${inp}"></div></div>
<button type="button" id="qall" style="border:1px solid #b3cdbf;background:#fff;color:#4a7766;border-radius:12px;padding:9px;font:inherit;font-size:15px;font-weight:700;cursor:pointer">إلى آخر السورة (${n2a(max)})</button>
<button type="button" id="qsave" style="border:0;background:#4a7766;color:#fff;border-radius:14px;padding:13px;font:inherit;font-size:18px;font-weight:800;cursor:pointer">سجّل هذه القراءة</button><p id="qe" style="margin:0;color:#b0524c;font-size:15px;font-weight:600"></p>
<p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#2b4a3f">قراءة اليوم · ${n2a(tot)} آية</p>${list.length ? `<ul style="list-style:none;margin:0;padding:0;display:grid;gap:8px">${list.map(r => `<li style="display:flex;align-items:center;gap:10px;padding:9px 12px;border:1px solid #e1e8df;border-radius:12px;font-size:16px;font-weight:600;color:#2b4a3f;background:#fff"><span style="flex:1">${esc(sName(r.surah))} · من ${n2a(r.from_ayah)} إلى ${n2a(r.to_ayah)}</span><button data-qd="${r.id}" style="border:1px solid #f1b4b4;background:#fff5f5;color:#b0524c;border-radius:10px;padding:5px 10px;font:inherit;font-size:14px;cursor:pointer">حذف</button></li>`).join('')}</ul>` : '<p style="margin:0;font-size:15px;color:#33443a">لم تسجّل قراءة اليوم بعد.</p>'}</div>`;
  const ss = document.getElementById('qs'), qf = document.getElementById('qf'), qt = document.getElementById('qt');
  ss.onchange = () => { R.sel = { s: +ss.value, f: 1 }; qpPaint(); };
  document.getElementById('qall').onclick = () => { qt.value = max; };
  document.getElementById('qsave').onclick = async () => {
    const f = Math.round(+qf.value), t = Math.round(+qt.value), e = document.getElementById('qe');
    if (!(f >= 1 && t >= f && t <= max)) { e.textContent = 'تأكد أن الآية الأولى أقل من أو تساوي الأخيرة، ولا تزيد عن ' + n2a(max); return; }
    const row = { tenant_id: TENANT, member_id: me.id, read_date: td, surah: cur.s, from_ayah: f, to_ayah: t };
    const tmp = Object.assign({ id: 'tmp' + Date.now(), created_at: new Date().toISOString() }, row); reads.unshift(tmp); R.sel = { s: t >= max ? Math.min(114, cur.s + 1) : cur.s, f: t >= max ? 1 : t + 1 }; qpPaint();
    try { const r = await ins('quran_reads', row); const real = Array.isArray(r) ? r[0] : r; if (real && real.id) { tmp.id = real.id; qpPaint(); } toast('تم الحفظ'); } catch (er) { const k = reads.indexOf(tmp); if (k >= 0) reads.splice(k, 1); qpPaint(); toast('تعذّر الحفظ: ' + errAr(er)); }
  };
  box.querySelectorAll('[data-qd]').forEach(b => b.onclick = async () => { const id = b.dataset.qd, k = reads.findIndex(x => x.id === id); if (k >= 0) reads.splice(k, 1); qpPaint(); try { await del('quran_reads', 'id=eq.' + id); } catch (er) { toast('تعذّر الحذف'); } });
}

/* ---------- settings ---------- */
async function viewSettings() {
  await loadMeCtx();
  const prev = localStorage.getItem('prev_role') || '';
  const row = (href, ic, t, sub) => `<a href="${href}" style="display:flex;align-items:center;gap:12px;padding:14px;border:1px solid #e1e8df;border-radius:14px;background:#fff;text-decoration:none;color:#2b4a3f"><span style="width:42px;height:42px;border-radius:12px;background:#edf3ee;color:#4a7766;display:flex;align-items:center;justify-content:center;font-size:21px;flex:none"><i class="${ic}"></i></span><span style="flex:1"><span style="display:block;font-size:17px;font-weight:700">${t}</span><span style="display:block;font-size:14px;color:#33443a">${sub}</span></span><i class="ri-arrow-left-s-line" style="font-size:20px;color:#4a7766"></i></a>`;
  const seg = (v, t) => `<button type="button" data-pv="${v}" style="flex:1;border:1.5px solid ${prev === v ? '#4a7766' : '#d3e2d9'};background:${prev === v ? '#4a7766' : '#fff'};color:${prev === v ? '#fff' : '#3b6556'};border-radius:12px;padding:11px 6px;font:inherit;font-size:15px;font-weight:700;cursor:pointer">${t}</button>`;
  draw(wrapS(`<div style="display:grid;gap:14px"><div><h1 style="margin:0;color:#2b4a3f">الإعدادات</h1><p style="margin:4px 0 0;font-size:16px;color:#33443a">${esc(me.full_name)} · ${esc(me.email || '')} · ${ROLE_AR[me.real_role || me.role] || ''}</p></div>
${me.real_role ? `<section class="rounded-lg border border-accent-300 bg-accent-50 p-4"><h2 style="margin:0;color:#3d2a00">معاينة التطبيق (للمالك فقط)</h2><p style="margin:4px 0 10px;font-size:15px;color:#4a3600">اعرض التطبيق كما يراه الشيخ أو المشرف أو العضو. صلاحياتك الفعلية لا تتغيّر.</p><div style="display:flex;gap:8px;flex-wrap:wrap">${seg('', 'حسابي')}${seg('sheikh', 'شيخ')}${seg('supervisor', 'مشرف')}${seg('member', 'عضو')}</div></section>` : ''}
<section class="rounded-lg border border-background-300 bg-background-50 p-4"><h2 style="margin:0;color:#2b4a3f">ألوان التطبيق</h2><p style="margin:4px 0 10px;font-size:15px;color:#33443a">اختر اللون الذي يريح عينك. الأخضر الهادئ هو الافتراضي.</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${THEMES.map(t => `<button type="button" data-th="${t[0]}" style="border:2px solid ${(localStorage.getItem('theme') || 'green') === t[0] ? '#4a7766' : '#d3e2d9'};background:#fff;border-radius:14px;padding:12px;font:inherit;font-size:16px;font-weight:700;color:#2b4a3f;cursor:pointer;display:flex;align-items:center;gap:8px;justify-content:center"><span style="width:18px;height:18px;border-radius:50%;background:#4a7766;filter:hue-rotate(${t[2]}deg)"></span>${t[1]}</button>`).join('')}</div></section>
<div style="display:grid;gap:10px">${row('#/more', 'ri-user-3-line', 'حسابي', 'بيانات الحساب والمرحلة والحلقة')}${row('#/reminders', 'ri-notification-3-line', 'الإشعارات والتذكيرات', 'مواقيت الأذكار والأيام البيض وغيرها')}${row('#/install', 'ri-smartphone-line', 'تثبيت التطبيق', 'إضافته إلى الشاشة الرئيسية')}${row('#/ward/history', 'ri-calendar-2-line', 'سجل الشهر', 'ما سجّلته في الأيام السابقة')}</div>
<button type="button" id="lo2" style="border:1.5px solid #d3e2d9;background:#fff;color:#3b6556;border-radius:14px;padding:14px;font:inherit;font-size:17px;font-weight:700;cursor:pointer">تسجيل الخروج</button></div>`));
  document.getElementById('lo2').onclick = logout;
  document.querySelectorAll('[data-th]').forEach(b => b.onclick = () => { localStorage.setItem('theme', b.dataset.th); applyTheme(); viewSettings(); });
}

/* ---------- stage editor ---------- */
async function viewStages(sel) {
  const [stages, acts, swr] = await Promise.all([q('stages', 'select=*&order=order_index.asc'), q('wird_activities', 'select=*&order=order_index.asc,created_at.asc'), q('stage_wird', 'select=*&limit=2000')]);
  sel = sel || window.__stSel || (stages[0] || {}).id; window.__stSel = sel; const stg = stages.find(x => x.id === sel) || stages[0]; if (!stg) return draw(wrapS('<p>لا توجد مراحل.</p>'));
  const rows = {}; swr.filter(r => r.stage_id === stg.id).forEach(r => rows[r.activity_id] = r);
  const ro = me.role === 'supervisor'; const dis = ro ? 'disabled' : '';
  const num = (id, f, v, ph, step) => `<input data-sw="${id}" data-f="${f}" type="number" step="${step || 1}" min="0" value="${v == null ? '' : v}" placeholder="${ph}" ${dis} style="width:88px;height:40px;border:1.5px solid #d3e2d9;border-radius:10px;text-align:center;font:inherit;font-size:16px;font-weight:600;background:#fff">`;
  const lab = t => `<span style="font-size:13.5px;color:#33443a;font-weight:600">${t}</span>`;
  const item = a => { const r = rows[a.id] || {}; const on = !!r.enabled; const fields = []; 
    if (a.type === 'counter') { fields.push(lab('الهدف') + num(a.id, 'target_count', r.target_count, 'الهدف', 1)); fields.push(lab('الحد الأقصى') + num(a.id, 'max_val', r.max_val, 'اختياري', 1)); }
    if (a.type === 'quran') fields.push(lab('أجزاء (٠.٥ = نصف جزء)') + num(a.id, 'target_count', r.target_count, 'العدد', 0.5));
    if (a.day_rule === 'fast') { fields.push(lab('في الأسبوع') + num(a.id, 'per_week', r.per_week, '٠', 1)); fields.push(lab('في الشهر') + num(a.id, 'per_month', r.per_month, '٠', 1)); }
    return `<li data-row="${a.id}" style="border:1px solid ${on ? '#b3cdbf' : '#e1e8df'};background:${on ? '#f3faf5' : '#fafafa'};border-radius:14px;padding:12px;display:grid;gap:10px"><label style="display:flex;align-items:center;gap:10px;font-size:17px;font-weight:700;color:#2b4a3f;cursor:pointer"><input data-sw="${a.id}" data-f="enabled" type="checkbox" ${on ? 'checked' : ''} ${dis} style="width:22px;height:22px;accent-color:#4a7766"><span style="flex:1">${esc(a.title)}</span><span style="font-size:13px;font-weight:600;color:#33443a">${esc(a.grp || CATS[a.category] || '')}${a.is_active ? '' : ' · موقوف عامًا'}</span></label>${fields.length ? `<div style="display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center">${fields.join('')}</div>` : ''}<input data-sw="${a.id}" data-f="note" value="${esc(r.note || '')}" placeholder="ملاحظة (اختياري)" ${dis} style="height:40px;border:1.5px solid #e1e8df;border-radius:10px;padding:0 10px;font:inherit;font-size:15px;background:#fff"></li>`; };
  $app.innerHTML = sheikhPage('/sheikh/stages', 'المراحل وأوراد كل مرحلة', `<div style="display:grid;gap:12px"><div style="display:flex;gap:8px;flex-wrap:wrap">${stages.map(x => `<button type="button" data-st="${x.id}" style="border:1.5px solid ${x.id === stg.id ? '#4a7766' : '#d3e2d9'};background:${x.id === stg.id ? '#4a7766' : '#fff'};color:${x.id === stg.id ? '#fff' : '#3b6556'};border-radius:999px;padding:9px 16px;font:inherit;font-size:16px;font-weight:700;cursor:pointer">${esc(x.name)}</button>`).join('')}</div>
<section class="panel"><b style="font-size:17px">${esc(stg.name)}</b><div class="mt" style="margin-top:6px">${ro ? 'عرض فقط للمشرف.' : 'فعّل الورد لهذه المرحلة وعدّل هدفه. كل تغيير يُحفظ تلقائيًا.'}</div>
<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:10px"><label style="font-size:15px;font-weight:600">اسم المرحلة</label><input id="stn" value="${esc(stg.name)}" ${dis} style="height:42px;border:1.5px solid #d3e2d9;border-radius:10px;padding:0 10px;font:inherit;font-size:16px;min-width:200px"><label style="font-size:15px;font-weight:600">أيام التأهل</label><input id="std" type="number" value="${stg.min_days == null ? '' : stg.min_days}" ${dis} style="height:42px;width:90px;border:1.5px solid #d3e2d9;border-radius:10px;text-align:center;font:inherit;font-size:16px"></div></section>
<ul style="list-style:none;margin:0;padding:0;display:grid;gap:10px">${acts.map(item).join('')}</ul></div>`, 'تحكم كامل في أوراد المراحل', '');
  document.querySelectorAll('[data-st]').forEach(b => b.onclick = () => viewStages(b.dataset.st));
  if (ro) return;
  const sv = async (id, el) => {
    const li = document.querySelector(`[data-row="${id}"]`), g = f => li.querySelector(`[data-f="${f}"]`), nv = f => { const e = g(f); if (!e || e.value === '') return null; return +e.value; };
    const row = { tenant_id: TENANT, stage_id: stg.id, activity_id: id, enabled: g('enabled').checked, target_count: nv('target_count'), max_val: nv('max_val'), per_week: nv('per_week'), per_month: nv('per_month'), note: g('note').value.trim() || null };
    const old = rows[id]; if (old && old.monthly_juz) row.monthly_juz = old.monthly_juz;
    li.style.borderColor = row.enabled ? '#b3cdbf' : '#e1e8df'; li.style.background = row.enabled ? '#f3faf5' : '#fafafa';
    try { await api('/rest/v1/stage_wird?on_conflict=stage_id,activity_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: row }); rows[id] = Object.assign(old || {}, row); toast('تم الحفظ'); } catch (e) { toast('تعذّر الحفظ: ' + errAr(e)); }
  };
  document.querySelectorAll('[data-sw]').forEach(el => el.onchange = () => sv(el.dataset.sw, el));
  const sn = async () => { try { await upd('stages', 'id=eq.' + stg.id, { name: document.getElementById('stn').value.trim() || stg.name, min_days: document.getElementById('std').value === '' ? null : +document.getElementById('std').value }); toast('تم الحفظ'); } catch (e) { toast('تعذّر الحفظ: ' + errAr(e)); } };
  document.getElementById('stn').onchange = sn; document.getElementById('std').onchange = sn;
}


boot();

/* ---------- roster (groups, leaders, members) ---------- */
const MARK = { '✅': ['منتظم', '#4a7766', '#dcfce7'], '❌': ['متأخر', '#92400e', '#fef3c7'], '⛔': ['منقطع', '#9a4742', '#f4e1df'] };
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
      const link = x.user_id ? '<span style="font-size:10px;padding:1px 7px;border-radius:99px;background:#dcfce7;color:#4a7766">مسجّل</span>' : '<span style="font-size:10px;padding:1px 7px;border-radius:99px;background:#f1f5f9;color:#64748b">غير مسجّل</span>';
      return `<li style="padding:11px 14px;border-top:1px solid rgba(0,0,0,.07)"><div style="display:flex;align-items:center;gap:8px;justify-content:space-between"><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><b style="font-size:14px">${esc(x.full_name)}</b>${x.is_leader ? '<span style="font-size:10px;padding:1px 7px;border-radius:99px;background:#fef3c7;color:#92400e">قائد</span>' : ''}${link}</div>${mk ? `<span style="font-size:10px;padding:1px 7px;border-radius:99px;background:${mk[2]};color:${mk[1]}">${mk[0]}</span>` : ''}</div>
<div style="margin-top:7px;height:5px;border-radius:9px;background:rgba(0,0,0,.08);overflow:hidden"><div style="height:100%;width:${pc}%;background:#5a9272"></div></div><div style="margin-top:4px;font-size:11px;opacity:.65">الفجر: ${n2a(x.fajr_done || 0)} من ${n2a(x.fajr_total || 0)} يومًا</div>
${staff ? `<div style="display:flex;gap:6px;margin-top:8px;align-items:center">${x.user_id ? `<button data-unlink="${x.id}" style="font-size:11px;padding:5px 10px;border-radius:8px;border:1px solid rgba(0,0,0,.15);background:#fff">فك الربط</button>` : `<select data-sel="${x.id}" style="flex:1;font-size:12px;padding:5px;border-radius:8px;border:1px solid rgba(0,0,0,.15);background:#fff"><option value="">ربط بحساب مسجّل…</option>${accts.map(a => `<option value="${a.id}">${esc(a.full_name)}</option>`).join('')}</select><button data-link="${x.id}" style="font-size:11px;padding:5px 10px;border-radius:8px;border:0;background:#4a7766;color:#fff">ربط</button>`}<button data-rm="${x.id}" style="font-size:11px;padding:5px 10px;border-radius:8px;border:1px solid #ecc9c6;background:#fff;color:#b0524c">حذف</button></div>` : ''}</li>`;
    }).join('');
    return `<section class="rounded-lg border border-background-200 bg-background-50" style="overflow:hidden;${mine ? 'box-shadow:0 0 0 2px #5a9272' : ''}"><div style="padding:12px 14px;background:#f0fdf4;display:flex;justify-content:space-between;align-items:center"><div><b style="font-size:15px">${esc(gr.name)}</b><div style="font-size:12px;opacity:.7;margin-top:2px">القائد: ${esc(gr.leader_name || '—')}</div></div><span style="font-size:11px;opacity:.7">${n2a(ms.length)} أعضاء${mine ? ' · مجموعتك' : ''}</span></div><ul style="list-style:none;margin:0;padding:0">${rows}</ul>${staff ? `<div style="display:flex;gap:6px;padding:10px 14px;border-top:1px solid rgba(0,0,0,.07)"><input data-addn="${gr.id}" placeholder="اسم عضو جديد" style="flex:1;font-size:13px;padding:7px 9px;border-radius:8px;border:1px solid rgba(0,0,0,.15)"><button data-add="${gr.id}" style="font-size:12px;padding:7px 12px;border-radius:8px;border:0;background:#4a7766;color:#fff">إضافة</button></div>` : ''}</section>`;
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

/* ---------- sheikh area, Readdy layout ---------- */
const SP_CSS = `<style>
.sp{font-family:var(--font-body);padding-bottom:24px;color:oklch(var(--foreground-900))}.sp *{box-sizing:border-box}
.sp .hd{display:flex;flex-direction:column;gap:10px}.sp .hd h1{font-family:var(--font-heading);font-size:20px;font-weight:600;margin:0;color:oklch(var(--foreground-950))}
.sp .hd p{font-size:12px;margin:4px 0 0;color:oklch(var(--foreground-500));line-height:1.7}
.sp .btn0{display:inline-flex;align-items:center;gap:6px;align-self:flex-start;white-space:nowrap;border-radius:6px;border:1px solid oklch(var(--background-300));background:oklch(var(--background-50));padding:6px 12px;font:inherit;font-size:11.5px;color:oklch(var(--foreground-700));cursor:pointer}
.sp .btn1{display:inline-flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap;border-radius:6px;border:0;background:oklch(var(--primary-700));padding:8px 14px;font:inherit;font-size:11.5px;font-weight:500;color:#fff;cursor:pointer;text-decoration:none}
.sp .btn1.red{background:#b0524c}.sp .btn1.sec{background:transparent;color:oklch(var(--primary-800));border:1px solid oklch(var(--primary-300))}
.sp .chips{display:flex;gap:8px;overflow-x:auto;padding:12px 0 2px;scrollbar-width:none}.sp .chips::-webkit-scrollbar{display:none}
.sp .chip{flex:none;padding:6px 13px;border-radius:99px;border:1px solid oklch(var(--background-300));background:oklch(var(--background-50));font-size:12px;white-space:nowrap;text-decoration:none;color:oklch(var(--foreground-700))}
.sp .chip.on{background:oklch(var(--primary-800));color:#fff;border-color:transparent}
.sp .tiles{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px}
.sp .tile{border-radius:12px;border:1px solid oklch(var(--background-200));background:oklch(var(--background-50));padding:14px}
.sp .ti{display:flex;width:32px;height:32px;align-items:center;justify-content:center;border-radius:6px;background:oklch(var(--primary-100));color:oklch(var(--primary-700));font-size:14px}
.sp .ti.a{background:oklch(var(--accent-100));color:oklch(var(--accent-900))}.sp .ti.b{background:oklch(var(--secondary-100));color:oklch(var(--secondary-900))}
.sp .tile b{display:block;margin-top:8px;font-size:20px;font-weight:600;line-height:1;color:oklch(var(--foreground-950))}.sp .tile span.l{display:block;margin-top:6px;font-size:10.5px;color:oklch(var(--foreground-500))}
.sp .panel{margin-top:16px;border-radius:12px;border:1px solid oklch(var(--background-200));background:oklch(var(--background-50));padding:14px}
.sp .it{width:100%;border-radius:6px;border:1px solid oklch(var(--background-300));background:oklch(var(--background-50));padding:9px 12px;font:inherit;font-size:12px;color:oklch(var(--foreground-900))}
.sp .it:focus{outline:1px solid oklch(var(--primary-300));border-color:oklch(var(--primary-400))}
.sp .pills{display:flex;gap:6px;overflow-x:auto;margin-top:10px;scrollbar-width:none}
.sp .pl{flex:none;display:flex;align-items:center;gap:6px;border-radius:99px;border:1px solid oklch(var(--background-300));background:oklch(var(--background-50));padding:6px 12px;font:inherit;font-size:11px;color:oklch(var(--foreground-600));cursor:pointer}
.sp .pl.on{background:oklch(var(--primary-700));border-color:oklch(var(--primary-700));color:#fff}
.sp .cnt{margin:12px 0 0;font-size:11px;color:oklch(var(--foreground-500))}
.sp .cd{display:block;margin-top:10px;border-radius:12px;border:1px solid oklch(var(--background-200));background:oklch(var(--background-50));padding:14px;text-decoration:none;color:inherit}
.sp .rw{display:flex;align-items:center;justify-content:space-between;gap:8px}
.sp .av{display:flex;flex:none;width:38px;height:38px;align-items:center;justify-content:center;border-radius:99px;background:oklch(var(--primary-100));color:oklch(var(--primary-800));font-family:var(--font-heading);font-weight:600;font-size:14px}
.sp .nm{font-size:13.5px;font-weight:600;color:oklch(var(--foreground-950))}.sp .mt{font-size:11px;color:oklch(var(--foreground-500));margin-top:2px}
.sp .bd{display:inline-block;border-radius:99px;padding:2px 9px;font-size:10.5px;background:oklch(var(--primary-100));color:oklch(var(--primary-800))}.sp .bd.w{background:oklch(var(--accent-100));color:oklch(var(--accent-900))}.sp .bd.r{background:#f4e1df;color:#9a4742}
.sp .em{margin-top:10px;border-radius:12px;border:1px dashed oklch(var(--background-300));background:oklch(var(--background-50));padding:30px 16px;text-align:center}
.sp .em i{display:flex;margin:0 auto;width:44px;height:44px;align-items:center;justify-content:center;border-radius:99px;background:oklch(var(--background-100));color:oklch(var(--foreground-500));font-size:18px}
.sp .em p{margin:10px 0 0;font-size:12.5px;font-weight:500}.sp .em small{display:block;margin-top:4px;font-size:11px;color:oklch(var(--foreground-500))}
.sp label{display:block;font-size:11.5px;font-weight:600;margin:12px 0 5px}.sp .err{color:#b0524c;font-size:12px;margin-top:8px}
.sp h3{font-size:14px;font-family:var(--font-heading);margin:18px 0 0}
.sp .tw{overflow-x:auto;margin-top:12px;border-radius:12px;border:1px solid oklch(var(--background-200))}
.sp table.rp{border-collapse:collapse;width:100%;font-size:11.5px;background:#fff}
.sp table.rp th{background:oklch(var(--primary-800));color:#fff;padding:8px 6px;font-weight:600;white-space:nowrap;border:1px solid oklch(var(--primary-900))}
.sp table.rp td{padding:7px 6px;text-align:center;border:1px solid oklch(var(--background-200))}
.sp table.rp td.dy{background:oklch(var(--background-100));font-weight:600;white-space:nowrap}
.sp td.ok{background:#dcfce7;color:#4a7766;font-weight:700}.sp td.no{background:#f4e1df;color:#9a4742;font-weight:700}.sp td.na{color:#94a3b8}
</style>`;
function sheikhTabs(a) {
  const l = [['/sheikh', 'الرئيسية'], ['/sheikh/reports', 'التقارير'], ['/sheikh/stages', 'المراحل'], ['/sheikh/members', 'الأعضاء'], ['/sheikh/roster', 'المجموعات'], ['/sheikh/requests', 'الطلبات'], ['/sheikh/promotions', 'الترقيات'], ['/sheikh/wird', 'الأوراد']].filter(x => !(x[0] === '/sheikh/wird' && me && me.role === 'supervisor'));
  return '<div class="chips">' + l.map(([p, t]) => `<a class="chip ${a === p ? 'on' : ''}" href="#${p}">${p === '/sheikh/reports' ? '<i class="ri-file-chart-line" style="margin-left:4px"></i>' : ''}${t}</a>`).join('') + '</div>';
}
const sheikhPage = (a, title, body, sub, extra) => shell(`${SP_CSS}<div class="sp"><header class="hd"><div><h1>${title}</h1><p>${sub || 'مساحة الشيخ'}</p></div>${extra === undefined ? '<button class="btn0" id="rfb"><i class="ri-refresh-line"></i>تحديث</button>' : extra}</header>${sheikhTabs(a)}${body}</div>`);
const bindRefresh = fn => { const b = document.getElementById('rfb'); if (b) b.onclick = () => fn(); };
const emptyBox = (ic, t, s) => `<div class="em"><i class="${ic}"></i><p>${t}</p><small>${s || ''}</small></div>`;
const tile = (ic, cls, n, l) => `<div class="tile"><span class="ti ${cls}"><i class="${ic}"></i></span><b>${n2a(n)}</b><span class="l">${l}</span></div>`;
const ini = n => (String(n || '؟').trim()[0] || '؟');

async function viewMembers() {
  const [members, groups, stages] = await Promise.all([q('profiles', 'select=*&role=eq.member&order=created_at.desc'), q('tarbiyah_groups', 'select=id,name'), q('stages', 'select=id,name&order=order_index')]);
  const gn = id => (groups.find(g => g.id === id) || {}).name || '—', sn = id => (stages.find(s => s.id === id) || {}).name || '—';
  const stp = { active: ['نشط', ''], pending: ['معلّق', 'w'], suspended: ['موقوف', 'r'], archived: ['مؤرشف', 'r'] };
  let fq = '', fs = 'all', fl = 'all';
  const week = Date.now() - 7 * 864e5;
  const paint = () => {
    const list = members.filter(m => (!fq || (m.full_name + ' ' + (m.email || '')).toLowerCase().includes(fq)) && (fs === 'all' || m.stage_id === fs) && (fl === 'all' || (fl === 'follow' && (!m.last_active_at || new Date(m.last_active_at) < week)) || (fl === 'pending' && m.status === 'pending')));
    document.getElementById('cnt').innerHTML = `عرض <b>${n2a(list.length)}</b> من أصل <b>${n2a(members.length)}</b> عضو`;
    document.getElementById('lst').innerHTML = list.length ? list.map(m => { const st = stp[m.status] || ['—', '']; return `<a class="cd" href="#/sheikh/member/${m.id}"><div class="rw"><div class="rw" style="justify-content:flex-start;gap:10px"><span class="av">${esc(ini(m.full_name))}</span><div><div class="nm">${esc(m.full_name)}</div><div class="mt">${({ man: 'رجل', woman: 'امرأة', child: 'طفل' })[m.audience] || '<span style="color:#b45309">فئة غير محددة</span>'} · ${esc(gn(m.group_id))}</div></div></div><span class="bd ${st[1]}">${st[0]}</span></div><div class="rw" style="margin-top:10px;font-size:11px;color:oklch(var(--foreground-500))"><span><i class="ri-medal-line"></i> ${esc(sn(m.stage_id))}</span><span>آخر نشاط: ${m.last_active_at ? new Date(m.last_active_at).toLocaleDateString('ar-EG') : '—'}</span></div></a>`; }).join('') : emptyBox('ri-team-line', 'لا يوجد أعضاء مطابقون', 'جرّب تعديل البحث أو اختيار مرحلة أخرى.');
    document.querySelectorAll('[data-fl]').forEach(b => b.classList.toggle('on', b.dataset.fl === fl));
  };
  $app.innerHTML = sheikhPage('/sheikh/members', 'أعضاء الحلقة', `<section class="panel" style="margin-top:14px"><div style="position:relative"><i class="ri-search-line" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);font-size:14px;opacity:.5"></i><input class="it" id="sq" type="search" placeholder="ابحث بالاسم أو البريد…" style="padding-right:36px"></div><select class="it" id="ss" style="margin-top:10px"><option value="all">كل المراحل</option>${stages.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select><div class="pills"><button class="pl on" data-fl="all"><i class="ri-team-line"></i>كل الأعضاء</button><button class="pl" data-fl="follow"><i class="ri-alarm-warning-line"></i>يحتاجون متابعة</button><button class="pl" data-fl="pending"><i class="ri-time-line"></i>بانتظار الاعتماد</button></div></section><p class="cnt" id="cnt"></p><div id="lst"></div>`, 'تابع مدة كل عضو في مرحلته، وآخر نشاط له، وملاحظات المتابعة التربوية.');
  document.getElementById('sq').oninput = e => { fq = e.target.value.trim().toLowerCase(); paint(); };
  document.getElementById('ss').onchange = e => { fs = e.target.value; paint(); };
  document.querySelectorAll('[data-fl]').forEach(b => b.onclick = () => { fl = b.dataset.fl; paint(); });
  bindRefresh(viewMembers); paint();
}

async function viewRequests() {
  const reqs = await q('membership_requests', 'select=*&order=created_at.desc&limit=60');
  const pend = reqs.filter(r => r.status === 'pending'), rest = reqs.filter(r => r.status !== 'pending');
  const ap = reqs.filter(r => r.status === 'approved').length, rj = reqs.filter(r => r.status === 'rejected').length;
  const card = (r, act) => `<div class="cd"><div class="rw"><div class="rw" style="justify-content:flex-start;gap:10px"><span class="av">${esc(ini(r.full_name))}</span><div><div class="nm">${esc(r.full_name)}</div><div class="mt" dir="ltr" style="text-align:right">${esc(r.email)}</div></div></div><span class="bd ${r.status === 'pending' ? 'w' : r.status === 'approved' ? '' : 'r'}">${{ pending: 'معلّق', approved: 'مقبول', rejected: 'مرفوض' }[r.status]}</span></div><div class="mt" style="margin-top:8px">${CATEGORY[r.category] || ''} · ${esc(r.group_name || 'بدون حلقة')}</div>${r.note ? `<div class="mt" style="margin-top:6px;color:inherit">${esc(r.note)}</div>` : ''}${act ? `<div class="rw" style="margin-top:12px;gap:8px"><button class="btn1" style="flex:1" data-ok="${r.id}"><i class="ri-check-line"></i>قبول</button><button class="btn1 red" style="flex:1" data-no="${r.id}"><i class="ri-close-line"></i>رفض</button></div>` : ''}</div>`;
  $app.innerHTML = sheikhPage('/sheikh/requests', 'طلبات العضوية', `<section class="tiles">${tile('ri-time-line', 'a', pend.length, 'بانتظار المراجعة')}${tile('ri-user-follow-line', '', ap, 'طلبات معتمدة')}${tile('ri-close-circle-line', 'b', rj, 'طلبات مرفوضة')}${tile('ri-file-list-3-line', 'b', reqs.length, 'إجمالي الطلبات')}</section>${pend.length ? pend.map(r => card(r, true)).join('') : emptyBox('ri-checkbox-circle-line', 'لا توجد طلبات معلّقة', 'ستظهر هنا طلبات الانضمام الجديدة.')}${rest.length ? '<h3>الطلبات السابقة</h3>' + rest.map(r => card(r, false)).join('') : ''}`, 'راجع طلبات الانضمام واعتمدها لتفعيل حساب المتربّي في مرحلته التمهيدية.');
  bindRefresh(viewRequests);
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
  const mon = new Date(); mon.setDate(1); mon.setHours(0, 0, 0, 0);
  const thisMonth = promos.filter(p => new Date(p.created_at) >= mon).length;
  const cand = members.filter(m => byId[m.stage_id] && stages.find(s => s.order_index > byId[m.stage_id].order_index)).length;
  $app.innerHTML = sheikhPage('/sheikh/promotions', 'الترقيات والمراحل', `<section class="tiles">${tile('ri-arrow-up-double-line', 'a', cand, 'يمكن ترقيتهم')}${tile('ri-calendar-check-line', '', thisMonth, 'ترقيات هذا الشهر')}${tile('ri-history-line', 'b', promos.length, 'إجمالي الترقيات')}${tile('ri-team-line', 'b', members.length, 'أعضاء نشطون')}</section>
${members.length ? members.map(m => { const cur = byId[m.stage_id], next = cur ? stages.find(s => s.order_index > cur.order_index) : null; return `<div class="cd"><div class="rw"><div class="rw" style="justify-content:flex-start;gap:10px"><span class="av">${esc(ini(m.full_name))}</span><div class="nm">${esc(m.full_name)}</div></div><span class="bd">${esc(cur ? cur.name : 'بدون مرحلة')}</span></div>${cur ? (next ? `<button class="btn1" style="width:100%;margin-top:12px" data-p="${m.id}" data-to="${next.id}"><i class="ri-arrow-up-double-line"></i>اعتماد الترقية إلى «${esc(next.name)}»</button>` : '<div class="mt" style="margin-top:10px">أعلى مرحلة</div>') : `<button class="btn1 sec" style="width:100%;margin-top:12px" data-s="${m.id}">بدء المرحلة الأولى</button>`}</div>`; }).join('') : emptyBox('ri-arrow-up-double-line', 'لا يوجد أعضاء نشطون', 'تظهر الترقيات بعد تفعيل الأعضاء.')}
<h3>سجل الترقيات</h3>${promos.length ? promos.map(p => `<div class="cd" style="font-size:12px">${esc((mById[p.member_id] || {}).full_name || 'عضو')}: ${esc((byId[p.from_stage_id] || {}).name || '—')} ← ${esc((byId[p.to_stage_id] || {}).name || '—')}<div class="mt">${new Date(p.created_at).toLocaleDateString('ar-EG')}</div></div>`).join('') : emptyBox('ri-history-line', 'لا توجد ترقيات بعد', '')}`, 'راجع الأعضاء المستوفين لمدة مراحلهم، واعتمد انتقالهم بعد التثبّت من حالهم.');
  bindRefresh(viewPromotions);
  $app.querySelectorAll('[data-p]').forEach(b => b.onclick = async () => { try { await rpc('approve_stage_promotion', { p_member_id: b.dataset.p, p_to_stage_id: b.dataset.to }); toast('تمت الترقية'); viewPromotions(); } catch (e) { toast(errAr(e)); } });
  $app.querySelectorAll('[data-s]').forEach(b => b.onclick = async () => { try { await rpc('start_member_stage', { p_member_id: b.dataset.s }); toast('تم'); viewPromotions(); } catch (e) { toast(errAr(e)); } });
}

async function viewWirdMgmt(editId) {
  const [acts, stg] = await Promise.all([q('wird_activities', 'select=*&order=order_index.asc,created_at.asc'), q('stages', 'select=id,name&order=order_index')]);
  const e = acts.find(a => a.id === editId) || { type: 'toggle', category: 'worship', is_active: true, order_index: acts.length + 1, quran_unit: 'juz', quran_parts: 1 };
  const tl = { toggle: 'زر (تم / تراجع)', counter: 'عدّاد', quran: 'قرآن (أجزاء)' };
  const on = acts.filter(a => a.is_active).length;
  $app.innerHTML = sheikhPage('/sheikh/wird', 'إدارة أوراد الحلقة', `<section class="tiles">${tile('ri-list-check-2', '', acts.length, 'إجمالي الأوراد')}${tile('ri-checkbox-circle-line', '', on, 'المفعّلة اليوم')}${tile('ri-pause-circle-line', 'a', acts.length - on, 'المعطّلة')}${tile('ri-book-open-line', 'b', acts.filter(a => a.type === 'quran').length, 'أوراد قرآن')}</section>
<form class="panel" id="f"><h3 style="margin:0">${editId ? 'تعديل ورد' : 'إضافة ورد'}</h3>
<label>العنوان</label><input class="it" name="title" required value="${esc(e.title || '')}"><label>الوصف</label><input class="it" name="description" value="${esc(e.description || '')}">
<label>نوع التسجيل</label><select class="it" name="type" id="ty">${Object.entries(tl).map(([k, v]) => `<option value="${k}" ${e.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
<label>التصنيف</label><select class="it" name="category">${Object.entries(CATS).map(([k, v]) => `<option value="${k}" ${e.category === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
<div id="cn"><label>الهدف (للعدّاد)</label><input class="it" name="target_count" type="number" min="1" value="${e.target_count || ''}"><label>الوحدة (مثال: مرة، ساعة)</label><input class="it" name="target_unit" value="${esc(e.target_unit || '')}"></div>
<div id="qn"><label>وحدة القرآن</label><select class="it" name="quran_unit"><option value="juz" ${e.quran_unit === 'juz' ? 'selected' : ''}>جزء</option><option value="pages" ${e.quran_unit === 'pages' ? 'selected' : ''}>صفحة</option></select><label>العدد اليومي</label><input class="it" name="quran_parts" type="number" min="1" value="${e.quran_parts || 1}"></div>
<label>المرحلة (اتركها «كل المراحل» للورد العام)</label><select class="it" name="stage_id"><option value="">كل المراحل</option>${stg.map(x => `<option value="${x.id}" ${e.stage_id === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select><label>الترتيب</label><input class="it" name="order_index" type="number" value="${e.order_index}"><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="is_active" style="width:auto" ${e.is_active ? 'checked' : ''}> مفعّل</label>
<div class="err" id="er"></div><div class="rw" style="margin-top:12px;gap:8px"><button class="btn1" style="flex:1"><i class="ri-add-line"></i>${editId ? 'حفظ' : 'إضافة ورد'}</button>${editId ? '<button type="button" class="btn0" id="cx">إلغاء</button>' : ''}</div></form>
<h3>الأوراد الحالية</h3>${acts.length ? acts.map(a => `<div class="cd"><div class="rw"><div><div class="nm">${esc(a.title)}</div><div class="mt">${CATS[a.category]}${a.stage_id ? ' · ' + esc((stg.find(x => x.id === a.stage_id) || {}).name || '') : ' · كل المراحل'}${a.type === 'counter' ? ' · الهدف ' + n2a(a.target_count || 0) + ' ' + esc(a.target_unit || '') : ''}${a.type === 'quran' ? ' · ' + n2a(a.quran_parts) + (a.quran_unit === 'pages' ? ' صفحة' : ' جزء') : ''}</div></div><span class="bd ${a.is_active ? '' : 'w'}">${a.is_active ? tl[a.type] : 'معطّل'}</span></div><div class="rw" style="margin-top:10px;gap:8px;justify-content:flex-start"><button class="btn0" data-e="${a.id}"><i class="ri-edit-line"></i>تعديل</button><button class="btn0" style="color:#b0524c;border-color:#ecc9c6" data-d="${a.id}"><i class="ri-delete-bin-line"></i>حذف</button></div></div>`).join('') : emptyBox('ri-list-check-2', 'لا توجد أوراد', 'أضف أول ورد من النموذج أعلاه.')}`, 'اعتمد الأوراد اليومية لأعضاء حلقتك: إتمام بسيط، عدّاد بهدف يومي، أو ورد قرآن بأجزاء منفصلة.');
  bindRefresh(() => viewWirdMgmt());
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

const hubTile = (h, ic, t, sub) => `<a href="#${h}" style="display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;padding:16px 8px;border:1.5px solid #d3e2d9;border-radius:16px;background:#fff;text-decoration:none;color:#2b4a3f"><span style="width:52px;height:52px;border-radius:14px;background:#edf3ee;color:#4a7766;display:flex;align-items:center;justify-content:center;font-size:27px"><i class="${ic}"></i></span><b style="font-size:17px">${t}</b><span style="font-size:13.5px;color:#33443a;line-height:1.5">${sub}</span></a>`;
function hubGrid() { return `<section class="panel hubw"><h2 style="margin:0 0 4px;font-size:21px;color:#2b4a3f">الإدارة والبناء</h2><p class="mt" style="margin:0 0 12px">كل التعديلات في مكان واحد. اضغط على ما تريد تعديله.</p><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px">${hubTile('/sheikh/stages', 'ri-stairs-line', 'المراحل', 'أوراد كل مرحلة وأهدافها')}${me.role === 'supervisor' ? '' : hubTile('/sheikh/wird', 'ri-list-check-2', 'الأوراد', 'إضافة وتعديل الأوراد')}${hubTile('/sheikh/members', 'ri-team-line', 'الأعضاء', 'بيانات الأعضاء وملاحظاتهم')}${hubTile('/sheikh/roster', 'ri-group-2-line', 'المجموعات', 'الحلقات والأسر')}${hubTile('/sheikh/requests', 'ri-user-add-line', 'الطلبات', 'طلبات الانضمام')}${hubTile('/sheikh/promotions', 'ri-medal-line', 'الترقيات', 'ترقية الأعضاء بين المراحل')}${hubTile('/sheikh/reports', 'ri-table-line', 'الجداول', 'متابعة الأعضاء والتقارير')}</div></section>`; }
async function viewSheikh() {
  const [members, reqs, acts, logs] = await Promise.all([
    q('profiles', 'select=id,full_name,last_active_at,group_id,stage_id&role=eq.member&status=eq.active'),
    q('membership_requests', 'select=id&status=eq.pending'), loadActivities(), q('wird_logs', `select=member_id,completed&log_date=eq.${today()}&completed=eq.true`)]);
  const per = {}; logs.forEach(l => per[l.member_id] = (per[l.member_id] || 0) + 1);
  const logged = members.filter(m => per[m.id]).length, full = members.filter(m => acts.length && per[m.id] >= acts.length).length;
  $app.innerHTML = sheikhPage('/sheikh', 'الإدارة والبناء', `${hubGrid()}<section class="tiles" style="margin-top:14px">${tile('ri-team-line', '', members.length, 'أعضاء نشطون')}${tile('ri-time-line', 'a', reqs.length, 'طلبات معلّقة')}${tile('ri-edit-line', 'b', logged, 'سجّلوا اليوم')}${tile('ri-checkbox-circle-line', '', full, 'أكملوا الورد كاملًا')}</section>
<section class="panel"><b style="font-size:14px">التزام اليوم</b>${members.length ? members.map(m => `<a class="rw" style="padding:10px 0;border-top:1px solid oklch(var(--background-200));text-decoration:none;color:inherit;margin-top:6px" href="#/sheikh/member/${m.id}"><span style="font-size:13px">${esc(m.full_name)}</span><span class="bd ${per[m.id] ? '' : 'w'}">${n2a(per[m.id] || 0)} / ${n2a(acts.length)}</span></a>`).join('') : emptyBox('ri-team-line', 'لا يوجد أعضاء مفعّلون بعد', '')}</section>`, 'ملخص حلقتك اليوم.');
  bindRefresh(viewSheikh);
}
async function viewMember(id) {
  const [p, fams, notes] = await Promise.all([q('profiles', 'select=*&id=eq.' + id), q('families', 'select=id,name&order=name'), q('member_notes', `select=*&member_id=eq.${id}&order=created_at.desc`)]);
  const m = p[0]; if (!m) return go('/sheikh/members');
  $app.innerHTML = sheikhPage('/sheikh/members', esc(m.full_name), `<section class="panel"><div class="mt" style="margin:0">${esc(m.email)} · ${CATEGORY[m.category] || ''}</div></section><section class="panel"><b style="font-size:14px">الفئة والأسرة والدور</b><div class="mt">يحدّدها الشيخ أو المشرف. العضو غير المحدَّد لا يراه إلا الشيخ والمشرفون.</div><label>الفئة</label><select class="it" id="au"><option value="">غير محدد</option><option value="man" ${m.audience === 'man' ? 'selected' : ''}>رجل</option><option value="woman" ${m.audience === 'woman' ? 'selected' : ''}>امرأة</option><option value="child" ${m.audience === 'child' ? 'selected' : ''}>طفل</option></select><label>الأسرة</label><select class="it" id="fa"><option value="">بدون أسرة</option>${fams.map(f => `<option value="${f.id}" ${m.family_id === f.id ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}<option value="__new">+ أسرة جديدة…</option></select>${me.role !== 'member' && me.role !== 'supervisor' ? `<label>الدور</label><select class="it" id="ro"><option value="member" ${m.role === 'member' ? 'selected' : ''}>عضو</option><option value="supervisor" ${m.role === 'supervisor' ? 'selected' : ''}>مشرف</option></select>` : ''}<button class="btn1" id="sv" style="margin-top:12px">حفظ</button></section><section class="panel"><div class="lg" id="cal"></div></section>
<section class="panel"><b style="font-size:14px">ملاحظات الشيخ</b><form id="nf"><textarea class="it" name="b" rows="2" required placeholder="اكتب ملاحظة…" style="margin-top:10px"></textarea><button class="btn1" style="margin-top:8px">إضافة</button></form>${notes.map(n => `<div style="border-top:1px solid oklch(var(--background-200));margin-top:10px;padding-top:8px"><div style="font-size:12.5px">${esc(n.body)}</div><div class="mt">${esc(n.author_name || '')} · ${new Date(n.created_at).toLocaleDateString('ar-EG')}</div></div>`).join('')}</section>`, 'متابعة العضو', '');
  const n = new Date(); renderCal(document.getElementById('cal'), id, { y: n.getFullYear(), m: n.getMonth(), sel: null });
  document.getElementById('nf').onsubmit = async ev => { ev.preventDefault(); try { await ins('member_notes', { tenant_id: TENANT, member_id: id, author_id: me.id, author_name: me.full_name, body: new FormData(ev.target).get('b').trim() }); toast('تمت الإضافة'); viewMember(id); } catch (e) { toast(errAr(e)); } };
}

/* ---------- reports ---------- */
const DAYN = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

/* ---------- reports v2 (sheet-style) ---------- */
const HJ = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric' });
const hjDay = d => +HJ.format(d).replace(/\D/g, '');
const hjTitle = d => new Intl.DateTimeFormat('ar-u-ca-islamic-umalqura', { month: 'long', year: 'numeric' }).format(d).replace(/\s?هـ$/, '');
const RPCSS = `<style>
.rv .tw{max-height:72vh;overflow:auto;border-radius:14px;border:1px solid #e1e8df;background:#fff}
.rv table.rp{border-collapse:separate;border-spacing:0;width:100%;font-size:12px}
.rv table.rp th{position:sticky;top:0;z-index:2;background:#4a7766;color:#fff;padding:8px 6px;font-weight:600;white-space:nowrap;border-left:1px solid #1f7a45}
.rv table.rp thead tr:nth-child(2) th{top:33px;background:#1f7a45}
.rv table.rp th.g{background:#3f6a58}
.rv table.rp td{padding:6px 4px;text-align:center;border-bottom:1px solid #e8efe5;border-left:1px solid #eef3ec;min-width:44px}
.rv table.rp tr:nth-child(even) td{background:#f8fbf6}
.rv table.rp td:first-child,.rv table.rp th:first-child{position:sticky;right:0;z-index:3;min-width:84px;font-weight:700;background:#eef5ea;color:#2b4a3f;border-left:2px solid #cfe0c9}
.rv table.rp th:first-child{background:#3f6a58;color:#fff;z-index:4}
.rv td.fr:first-child,.rv td.fr{background:#e9f1ea!important}
.rv td.ok{color:#4a8062;font-weight:800}.rv td.no{color:#c0605a;background:#f8eceb!important;font-weight:800}.rv td.na{color:#cbd5c8}
.rv td.pk{background:#f6e6e4!important}.rv td small{display:block;font-size:10px;color:#475569;font-weight:600}
.rv tr.sm td{background:#e7f1e3!important;font-weight:800;color:#2b4a3f}
</style>`;
async function viewReports(st) {
  st = st || window.__rp || { mode: 'member', member: '', days: 'm' }; window.__rp = st;
  let [members, acts0, swRows] = await Promise.all([q('profiles', 'select=id,full_name,stage_id,role&status=eq.active&order=full_name'), q('wird_activities', 'select=*&is_active=eq.true&order=order_index.asc'), q('stage_wird', 'select=*&limit=2000')]);
  { const only = members.filter(m => m.role === 'member'); if (only.length) members = only; }
  const FR = 'وليمة الجمعة';
  const mainActs = acts0.filter(a => a.grp !== FR), friActs = acts0.filter(a => a.grp === FR);
  const sw = {}; swRows.forEach(r => sw[r.stage_id + '|' + r.activity_id] = r);
  const stOf = uid => (members.find(m => m.id === uid) || {}).stage_id;
  const ov = (uid, a) => sw[stOf(uid) + '|' + a.id];
  const enabled = (uid, a) => { const sid = stOf(uid); if (!sid || !swRows.length) return true; const r = ov(uid, a); return r ? r.enabled : false; };
  const tdy = new Date(); tdy.setHours(12, 0, 0, 0);
  let dates = [];
  if (st.days === 'm') { const h = hjDay(tdy), s0 = new Date(tdy); s0.setDate(s0.getDate() - (h - 1)); let prev = 0; for (let i = 0; i < 31; i++) { const d = new Date(s0); d.setDate(s0.getDate() + i); const x = hjDay(d); if (x < prev) break; prev = x; dates.push(d); } }
  else { for (let i = +st.days - 1; i >= 0; i--) { const d = new Date(tdy); d.setDate(tdy.getDate() - i); dates.push(d); } }
  const ds = dates.map(ymd), f = ds[0], t = ds[ds.length - 1];
  const [logs, parts] = await Promise.all([q('wird_logs', `select=member_id,activity_id,log_date,completed,counter_value&log_date=gte.${f}&log_date=lte.${t}&limit=20000`), q('wird_part_logs', `select=member_id,activity_id,log_date,part_index&completed=eq.true&log_date=gte.${f}&log_date=lte.${t}&limit=20000`)]);
  if (!st.member && members[0]) st.member = members[0].id;
  const todayS = ymd(tdy);
  const quota = (uid, a) => { const r = ov(uid, a); return a.day_rule === 'fast' && r && (r.per_week || r.per_month) ? r : null; };
  const fixedMT = (uid, a) => { const r = ov(uid, a); return r && /الاثنين/.test(r.note || ''); };
  const due = (uid, a, d) => { if (!enabled(uid, a)) return false; if (ymd(d) > todayS) return false; const rl = a.day_rule || 'daily', w = d.getDay(); if (rl === 'fri') return w === 5; if (rl === 'fast') { if (quota(uid, a)) return fixedMT(uid, a) ? (w === 1 || w === 4) : false; return w === 1 || w === 4 || (hjDay(d) >= 13 && hjDay(d) <= 15); } return true; };
  const val = (uid, a, d1) => logs.find(x => x.member_id === uid && x.activity_id === a.id && x.log_date === d1);
  const done = (uid, a, d1) => {
    const r = ov(uid, a);
    if (a.type === 'quran') { const need = r && r.target_count >= 1 ? r.target_count : (a.quran_parts || 1); return parts.filter(p => p.member_id === uid && p.activity_id === a.id && p.log_date === d1).length >= need; }
    const l = val(uid, a, d1); if (!l) return false;
    if (a.type === 'counter') { const v = +l.counter_value || 0, mx = r && r.max_val != null ? r.max_val : a.max_val, tg = r && r.target_count != null ? r.target_count : a.target_count; if (mx != null || a.min_val != null) return v > 0 && (a.min_val == null || v >= a.min_val) && (mx == null || v <= mx); return v >= (tg || 1); }
    return !!l.completed;
  };
  const DAYN = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const cell = (uid, a, d) => {
    const ok = done(uid, a, ymd(d)), l = val(uid, a, ymd(d)), fr = d.getDay() === 5 ? 'fr' : '';
    const qa = quota(uid, a);
    if (!enabled(uid, a) || ymd(d) > todayS) return `<td class="na ${fr}" data-k="na"></td>`;
    if (qa && !fixedMT(uid, a) || (qa && !due(uid, a, d))) return ok ? `<td class="ok ${fr}" data-k="ok" data-n="">✓</td>` : `<td class="na ${fr}" data-k="na"></td>`;
    if (!due(uid, a, d)) return `<td class="na ${fr}" data-k="na"></td>`;
    const isN = a.type === 'counter' && l && +l.counter_value, n = isN ? +l.counter_value : '';
    const mx = (ov(uid, a) || {}).max_val != null ? ov(uid, a).max_val : a.max_val, pk = mx != null && l && +l.counter_value > mx;
    if (a.type === 'counter' && mx != null && l && +l.counter_value > 0) { const g = +l.counter_value <= mx; return `<td class="${g ? 'ok' : 'no'} ${fr}" data-k="${g ? 'ok' : 'no'}" data-t="1" style="font-weight:700;color:${g ? '#4a8062' : '#b0524c'}">${n2a(+l.counter_value)}</td>`; }
    return `<td class="${ok ? 'ok' : 'no'} ${pk ? 'pk' : ''} ${fr}" data-k="${ok ? 'ok' : 'no'}" data-n="${n}">${ok ? '✓' : '✗'}${n !== '' ? `<small>${n2a(n)}</small>` : ''}</td>`;
  };
  const stat = (uid, list) => list.map(a => {
    if (!enabled(uid, a)) return { dn: 0, du: 0, off: true };
    const qa = quota(uid, a);
    if (qa) { let du = 0, dn = 0; const fd = dates.filter(d => ymd(d) <= todayS && done(uid, a, ymd(d))); const weeks = Math.ceil(dates.filter(d => ymd(d) <= todayS).length / 7);
      if (qa.per_week) { du += qa.per_week * weeks; dn += Math.min(qa.per_week * weeks, fd.filter(d => !(fixedMT(uid, a)) || !(d.getDay() === 1 || d.getDay() === 4)).length + (fixedMT(uid, a) ? 0 : 0)); }
      if (fixedMT(uid, a)) { dates.forEach(d => { if (due(uid, a, d)) { du++; if (done(uid, a, ymd(d))) dn++; } }); }
      if (qa.per_month) { du += qa.per_month; dn += Math.min(qa.per_month, fd.filter(d => hjDay(d) >= 13 && hjDay(d) <= 15).length); }
      return { dn, du }; }
    let dn = 0, du = 0; dates.forEach(d => { if (due(uid, a, d)) { du++; if (done(uid, a, ymd(d))) dn++; } }); return { dn, du };
  });
  const head = (list, first) => { let r1 = `<tr><th rowspan="2">${first}</th>`, r2 = '<tr>'; for (let i = 0; i < list.length;) { const g = list[i].grp || ''; if (!g) { r1 += `<th rowspan="2" class="g">${esc(list[i].title)}</th>`; i++; continue; } let j = i; while (j < list.length && (list[j].grp || '') === g) j++; r1 += `<th colspan="${j - i}" class="g">${esc(g)}</th>`; for (let k = i; k < j; k++) r2 += `<th>${esc(list[k].title)}</th>`; i = j; } return '<thead>' + r1 + '</tr>' + r2 + '</tr></thead>'; };
  const mk = list => {
    if (!list.length) return '';
    if (st.mode === 'member') {
      const own = list.filter(a => enabled(st.member, a)), S = stat(st.member, own), sumD = S.reduce((x, y) => x + y.dn, 0), sumU = S.reduce((x, y) => x + y.du, 0);
      if (!own.length) return '';
      return `<table class="rp">${head(own, 'اليوم')}<tbody>${dates.map((d, i) => [d, i]).filter(([d]) => list !== friActs || d.getDay() === 5).map(([d, i]) => `<tr><td class="${d.getDay() === 5 ? 'fr' : ''}">${n2a(i + 1)} ${DAYN[d.getDay()]}</td>${own.map(a => cell(st.member, a, d)).join('')}</tr>`).join('')}
<tr class="sm"><td>الدرجة الفعلية</td>${S.map(x => `<td data-k="sm">${n2a(x.dn)}</td>`).join('')}</tr><tr class="sm"><td>الدرجة النهائية</td>${S.map(x => `<td data-k="sm">${n2a(x.du)}</td>`).join('')}</tr></tbody></table>`;
    }
    return `<table class="rp">${head(list, 'العضو')}<tbody>${members.map(m => { const S = stat(m.id, list); return `<tr><td>${esc(m.full_name)}</td>${S.map(x => { if (x.off) return '<td class="na" data-k="na"></td>'; const k = x.du && x.dn >= x.du ? 'ok' : x.du && !x.dn ? 'no' : 'sm'; return `<td class="${k === 'sm' ? '' : k}" data-k="${k}" data-n="${x.du ? x.dn + '/' + x.du : ''}">${x.du ? n2a(x.dn) + '/' + n2a(x.du) : ''}</td>`; }).join('')}</tr>`; }).join('')}</tbody></table>`;
  };
  const dayMode = st.mode === 'member' && st.view !== 'table';
  const tblMain = mk(mainActs), tblFri = mk(friActs);
  const dayHtml = (() => {
    if (!dayMode || !members.length) return '';
    const m = st.member, all = acts0.filter(a => enabled(m, a)), shown = dates.filter(d => ymd(d) <= todayS);
    const sel = st.day && shown.some(d => ymd(d) === st.day) ? st.day : ymd(shown[shown.length - 1] || dates[0]);
    const dueL = d => all.filter(a => due(m, a, d)), stat1 = d => { const l = dueL(d); const n = l.filter(a => done(m, a, ymd(d))).length; return { n, t: l.length }; };
    const chips = dates.map(d => { const k = ymd(d), fut = k > todayS, x = fut ? { n: 0, t: 0 } : stat1(d), c = fut ? '#eceee6' : !x.t ? '#eceee6' : x.n >= x.t ? '#bfe0cb' : x.n ? '#f3e3b0' : '#f6e1de', on = k === sel; return `<button type="button" data-dy="${k}" ${fut ? 'disabled' : ''} style="flex:none;min-width:54px;padding:8px 6px;border-radius:14px;border:2.5px solid ${on ? '#3b6556' : 'transparent'};background:${c};font:inherit;color:#2b4a3f;cursor:pointer;opacity:${fut ? .5 : 1}"><div style="font-size:19px;font-weight:800">${n2a(hjDay(d))}</div><div style="font-size:12px;font-weight:600">${DAYN[d.getDay()]}</div></button>`; }).join('');
    const d0 = dates.find(d => ymd(d) === sel), list = dueL(d0), row = a => { const ok = done(m, a, sel), l = val(m, a, sel), n = a.type === 'counter' && l && +l.counter_value ? ` <span style="font-weight:600;color:#33443a">(${n2a(+l.counter_value)})</span>` : ''; return `<li style="display:flex;align-items:center;gap:12px;padding:12px;border:1px solid ${ok ? '#b3cdbf' : '#e6e9e0'};background:${ok ? '#eef6f0' : '#fff'};border-radius:14px;font-size:17px;font-weight:600;color:#2b4a3f"><span style="width:30px;height:30px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;border:2.5px solid ${ok ? '#4a7766' : '#cfd6cb'};background:${ok ? '#4a7766' : '#fff'};color:#fff;font-size:18px">${ok ? '✓' : ''}</span><span style="flex:1">${esc(a.title)}${n}</span><span style="font-size:13px;color:#5b6b60">${esc(a.grp || '')}</span></li>`; };
    const sx = stat1(d0);
    return `<div style="margin:14px 0 6px;font-weight:800;font-size:17px;color:#2b4a3f">اختر اليوم</div><div class="no-scrollbar" style="display:flex;gap:8px;overflow-x:auto;padding:4px 2px 10px">${chips}</div><section class="panel" style="margin-top:6px"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px"><b style="font-size:19px;color:#2b4a3f">${DAYN[d0.getDay()]} ${n2a(hjDay(d0))} ${hjTitle(d0).replace(/\s?[\d٠-٩]+$/, '')}</b><span style="font-size:16px;font-weight:700;color:#3b6556">${n2a(sx.n)} من ${n2a(sx.t)}</span></div>${list.length ? `<ul style="list-style:none;margin:0;padding:0;display:grid;gap:8px">${list.map(row).join('')}</ul>` : '<p style="margin:0;font-size:16px;color:#33443a">لا أوراد مستحقة في هذا اليوم.</p>'}</section>`;
  })();
  /* sections shown under the main table; add more { id, title, html } here later */
  const SECS = [{ id: 'fri', title: FR, html: tblFri }].filter(x => x.html);
  const pctG = (uid, g) => { const l = mainActs.filter(a => a.grp === g); const S = stat(uid, l), du = S.reduce((x, y) => x + y.du, 0), dn = S.reduce((x, y) => x + y.dn, 0); return du ? Math.round(100 * dn / du) : null; };
  const pc = v => v === null ? '—' : n2a(v) + '٪';
  const pctBox = false ? `<section class="panel"><b style="font-size:14px">نسبة الفرائض والنوافل</b><div class="mt">الفرائض = الصلوات الخمس في المسجد، النوافل = 12 ركعة والضحى والقيام والوتر. الأيام المستحقة فقط، بحسب مرحلة كل عضو.</div><div class="tw nx" style="max-height:none"><table class="rp"><thead><tr><th>العضو</th><th>الفرائض</th><th>النوافل</th></tr></thead><tbody>${members.map(m => `<tr><td>${esc(m.full_name)}</td><td>${pc(pctG(m.id, 'الصلوات في المسجد'))}</td><td>${pc(pctG(m.id, 'النوافل'))}</td></tr>`).join('')}</tbody></table></div></section>` : '';
  const fajr = mainActs.find(a => a.title === 'الفجر');
  const rk = fajr ? members.map(m => ({ n: m.full_name, c: dates.filter(d => due(m.id, fajr, d) && done(m.id, fajr, ymd(d))).length, u: dates.filter(d => due(m.id, fajr, d)).length })).sort((a, b) => b.c - a.c) : [];
  const rank = fajr ? `<section class="panel"><b style="font-size:14px"><i class="ri-trophy-line"></i> ترتيب صلاة الفجر</b>${rk.map((x, i) => `<div class="rw" style="padding:8px 0;border-top:1px solid oklch(var(--background-200));margin-top:${i ? 0 : 8}px"><span style="font-size:13px"><b style="display:inline-block;width:22px;color:oklch(var(--primary-700))">${n2a(i + 1)}</b>${esc(x.n)}</span><span class="bd ${x.c ? '' : 'w'}">${n2a(x.c)} / ${n2a(x.u)}</span></div>`).join('')}</section>` : '';
  const who = st.mode === 'member' ? (members.find(m => m.id === st.member) || {}).full_name || '' : 'كل أعضاء الحلقة';
  window.__rpData = { who, title: 'متابعة شهر ' + hjTitle(tdy) + ' هـ', from: f, to: t };
  $app.innerHTML = sheikhPage('/sheikh/reports', 'التقارير', `${RPCSS}<div class="rv"><section class="panel" style="margin-top:14px"><div class="pills" style="margin:0"><button class="pl ${st.mode === 'member' ? 'on' : ''}" data-m="member"><i class="ri-user-line"></i>عضو واحد</button>${st.mode === 'member' ? `<button class="pl ${dayMode ? 'on' : ''}" data-vw="day"><i class="ri-calendar-todo-line"></i>يوم بيوم</button><button class="pl ${!dayMode ? 'on' : ''}" data-vw="table"><i class="ri-table-line"></i>الجدول</button>` : ''}<button class="pl ${st.mode === 'group' ? 'on' : ''}" data-m="group"><i class="ri-group-line"></i>الحلقة كلها</button></div>${st.mode === 'member' ? `<select class="it" id="rm" style="margin-top:10px">${members.map(m => `<option value="${m.id}" ${m.id === st.member ? 'selected' : ''}>${esc(m.full_name)}</option>`).join('')}</select>` : ''}<select class="it" id="rd" style="margin-top:10px"><option value="m" ${st.days === 'm' ? 'selected' : ''}>الشهر الهجري الحالي (${esc(hjTitle(tdy))})</option>${[7, 14, 30].map(n => `<option value="${n}" ${st.days === n ? 'selected' : ''}>آخر ${n2a(n)} يومًا</option>`).join('')}</select><div class="rw" style="margin-top:12px;gap:8px"><button class="btn1" style="flex:1" id="xpdf"><i class="ri-file-pdf-2-line"></i>تصدير PDF</button><button class="btn1 sec" style="flex:1" id="xpng"><i class="ri-image-line"></i>تصدير صورة</button></div></section>
${members.length ? `<div style="margin:14px 2px 4px;font-weight:700;font-size:14px">${esc(window.__rpData.title)} · ${esc(who)}</div>${dayHtml}${dayMode ? '' : `<div class="tw main">${tblMain || '<div class="em">لا توجد أوراد لهذه المرحلة.</div>'}</div>`}${(dayMode ? [] : SECS).map(x => `<section class="rsec" data-sec="${x.id}"><div style="margin:16px 2px 4px;font-weight:700;font-size:14px">${x.title}</div><div class="tw main ${x.id}">${x.html}</div></section>`).join('')}${pctBox}${rank}` : emptyBox('ri-file-chart-line', 'لا يوجد أعضاء مفعّلون', 'تظهر التقارير بعد تفعيل الأعضاء وتسجيلهم.')}</div>`, 'جدول تلقائي بعلامات ✓ و ✗ من التسجيلات الفعلية فقط. الخانة الفارغة = غير مستحقة أو لم يحن يومها أو ليست في مرحلة العضو.');
  bindRefresh(() => viewReports(st));
  document.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { st.mode = b.dataset.m; viewReports(st); });
  const rm = document.getElementById('rm'); if (rm) rm.onchange = e => { st.member = e.target.value; viewReports(st); };
  document.getElementById('rd').onchange = e => { st.days = e.target.value === 'm' ? 'm' : +e.target.value; viewReports(st); };
  document.querySelectorAll('[data-vw]').forEach(b => b.onclick = () => { st.view = b.dataset.vw; viewReports(st); });
  document.querySelectorAll('[data-dy]').forEach(b => b.onclick = () => { st.day = b.dataset.dy; viewReports(st); });
  const needT = async fn => { if (dayMode) { st.view = 'table'; await viewReports(st); } fn(); };
  document.getElementById('xpdf').onclick = () => needT(exportPdf);
  document.getElementById('xpng').onclick = () => needT(exportPng);
}
function reportDoc() { const R = window.__rpData, tbs = [...document.querySelectorAll('.rv .tw.main table.rp')]; return { title: R.title + '، ' + R.who, sub: `من ${R.from} إلى ${R.to}`, tables: tbs.map(x => x.outerHTML), heads: ['', 'وليمة الجمعة'], tbs }; }
function exportPdf() {
  const d = reportDoc(), w = window.open('', '_blank'); if (!w) return toast('اسمح بالنوافذ المنبثقة');
  w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${d.title}</title><style>@page{size:A4 landscape;margin:8mm}body{font-family:Tahoma,'Noto Sans Arabic',Arial,sans-serif;color:#2b4a3f;margin:0}h1{font-size:17px;margin:0;color:#3f6a58}p{margin:3px 0 8px;color:#555;font-size:11px}table{border-collapse:collapse;width:100%;font-size:9px;table-layout:fixed}th{background:#4a7766;color:#fff;padding:4px 2px;border:1px solid #3f6a58;font-weight:600}th.g{background:#3f6a58}td{padding:2px;text-align:center;border:1px solid #e1e8df;height:15px}td:first-child{background:#eef5ea;font-weight:700;width:62px}td.fr{background:#e9f1ea}td.ok{color:#4a8062;font-weight:800}td.no{color:#c0605a;background:#f8eceb;font-weight:800}td.pk{background:#f6e6e4}td.na{color:#ccc}tr.sm td{background:#e7f1e3;font-weight:800}small{font-size:7px;color:#475569;display:block}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head><body><h1>مُتَرَبِّي · ${d.title}</h1><p>${d.sub}</p>${d.tables.map((t, i) => (i ? '<h2 style="font-size:13px;margin:10px 0 4px">' + d.heads[1] + '</h2>' : '') + t).join('')}<script>setTimeout(function(){window.print()},400)<\/script></body></html>`);
  w.document.close();
}
function pngCanvas(tb, d, first) {
  const FONT = '"Noto Sans Arabic","Tajawal",Tahoma,Arial,sans-serif';
  const grid = [], cells = []; [...tb.rows].forEach((tr, ri) => { grid[ri] = grid[ri] || []; let ci = 0; [...tr.cells].forEach(c => { while (grid[ri][ci]) ci++; const cs = c.colSpan, rs = c.rowSpan; for (let a = 0; a < rs; a++) for (let b = 0; b < cs; b++) { grid[ri + a] = grid[ri + a] || []; grid[ri + a][ci + b] = 1; } cells.push({ c, r: ri, col: ci, cs, rs }); ci += cs; }); });
  const nc = Math.max(...cells.map(x => x.col + x.cs)), nr = grid.length, fw = 96, cw = 50, rh = 24, pad = 20, hh = first ? 60 : 36;
  const W = pad * 2 + fw + (nc - 1) * cw, H = hh + nr * rh + 50;
  const cv = document.createElement('canvas'); cv.width = W * 2; cv.height = H * 2; const c = cv.getContext('2d'); c.scale(2, 2); c.direction = 'rtl'; c.textBaseline = 'middle'; c.textAlign = 'center';
  c.fillStyle = '#fbf8ef'; c.fillRect(0, 0, W, H); c.fillStyle = '#3b6556'; c.fillRect(0, 0, W, hh - 8);
  c.fillStyle = '#fff'; c.textAlign = 'right'; if (first) { c.font = `700 17px ${FONT}`; c.fillText('مُتَرَبِّي · ' + d.title, W - pad, 20); c.font = `11px ${FONT}`; c.fillStyle = '#d8f3e3'; c.fillText(d.sub, W - pad, 40); } else { c.font = `700 15px ${FONT}`; c.fillText('وليمة الجمعة', W - pad, 14); } c.textAlign = 'center';
  const rowOf = ri => ri, X = (col, cs) => { const right = W - pad - (col === 0 ? 0 : fw + (col - 1) * cw), w = (col === 0 ? fw : 0) + (col === 0 ? (cs - 1) * cw : cs * cw); return [right - w, w]; };
  cells.forEach(({ c: el, r, col, cs, rs }) => {
    const [x, w] = X(col, cs), y = hh + r * rh, h = rs * rh, k = el.dataset.k, isH = el.tagName === 'TH';
    let bg = '#fff', fg = '#2b4a3f'; if (isH) { bg = el.classList.contains('g') ? '#3f6a58' : '#4a7766'; fg = '#fff'; } else if (col === 0) bg = '#eef5ea'; else if (k === 'ok') bg = '#f0fdf4'; else if (k === 'no') bg = '#f8eceb'; else if (k === 'sm') bg = '#e7f1e3'; else if (el.classList.contains('fr')) bg = '#e9f1ea'; else if (r % 2) bg = '#f8fbf6';
    if (el.classList.contains('pk')) bg = '#f6e6e4'; if (!isH && k !== 'ok' && k !== 'no' && col !== 0 && el.parentElement.classList.contains('sm')) bg = '#e7f1e3'; if (!isH && el.classList.contains('fr') && k === 'na') bg = '#e9f1ea';
    c.fillStyle = bg; c.fillRect(x, y, w, h); c.strokeStyle = isH ? '#3f6a58' : '#e1e8df'; c.strokeRect(x, y, w, h);
    const cx = x + w / 2, cy = y + h / 2, n = el.dataset.n;
    if ((k === 'ok' || k === 'no') && !(el.dataset.n || '').includes('/') && !el.dataset.t) {
      c.lineWidth = 2; c.lineCap = 'round'; c.lineJoin = 'round'; const ox = n ? -6 : 0;
      if (k === 'ok') { c.strokeStyle = '#5a9272'; c.beginPath(); c.moveTo(cx + ox - 5, cy); c.lineTo(cx + ox - 1, cy + 4); c.lineTo(cx + ox + 5, cy - 4); c.stroke(); } else { c.strokeStyle = '#c0605a'; c.beginPath(); c.moveTo(cx + ox - 4, cy - 4); c.lineTo(cx + ox + 4, cy + 4); c.moveTo(cx + ox + 4, cy - 4); c.lineTo(cx + ox - 4, cy + 4); c.stroke(); }
      if (n) { c.fillStyle = '#475569'; c.font = `9px ${FONT}`; c.fillText(String(el.querySelector('small') ? el.querySelector('small').textContent : n), cx + 12, cy, 22); }
    } else { c.fillStyle = el.dataset.t ? (k === 'ok' ? '#4a8062' : '#b0524c') : fg; c.font = `${isH || col === 0 || k === 'sm' || el.dataset.t ? '700 ' : ''}${isH ? 10.5 : 11}px ${FONT}`; c.fillText(el.textContent.trim(), cx, cy, w - 4); }
  });
  if (!first) { /* no footer */ }
  return { cv, W, H };
}
function exportPng() {
  const d = reportDoc(), tbs = [...document.querySelectorAll('.rv .tw.main table.rp')], FONT = '"Noto Sans Arabic","Tajawal",Tahoma,Arial,sans-serif';
  const parts = tbs.map((t, i) => pngCanvas(t, d, i === 0)); const W = Math.max(...parts.map(p => p.W)), gap = 12, foot = 30;
  const H = parts.reduce((a, p) => a + p.H - 40 + gap, 0) + foot;
  const cv = document.createElement('canvas'); cv.width = W * 2; cv.height = H * 2; const c = cv.getContext('2d'); c.scale(2, 2); c.fillStyle = '#fbf8ef'; c.fillRect(0, 0, W, H);
  let y = 0; parts.forEach(p => { c.drawImage(p.cv, 0, 0, p.cv.width, (p.H - 40) * 2, W - p.W, y, p.W, p.H - 40); y += p.H - 40 + gap; });
  c.fillStyle = '#6b7a6f'; c.font = `10px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.direction = 'rtl'; c.fillText('أُنشئ تلقائيًا من تسجيلات الورد في مُتَرَبِّي · الخانة الفارغة = غير مستحقة', W / 2, H - 14);
  const url = cv.toDataURL('image/png');
  const o = document.createElement('div'); o.style.cssText = 'position:fixed;inset:0;z-index:99;background:rgba(0,0,0,.7);overflow:auto;padding:16px';
  o.innerHTML = `<div style="background:#fff;border-radius:14px;padding:12px;max-width:900px;margin:0 auto"><img src="${url}" style="width:100%;border-radius:8px"><div style="display:flex;gap:8px;margin-top:10px"><a id="dl" download="تقرير-الورد.png" href="${url}" style="flex:1;text-align:center;background:#4a7766;color:#fff;padding:10px;border-radius:8px;text-decoration:none;font-size:13px">حفظ الصورة</a><button id="sh" style="flex:1;border:1px solid #4a7766;color:#4a7766;background:#fff;border-radius:8px;font:inherit;font-size:13px">مشاركة</button><button id="cl" style="border:1px solid #ccc;background:#fff;border-radius:8px;padding:0 14px">إغلاق</button></div></div>`;
  document.body.appendChild(o); o.querySelector('#cl').onclick = () => o.remove();
  o.querySelector('#sh').onclick = async () => { try { const b = await (await fetch(url)).blob(), file = new File([b], 'report.png', { type: 'image/png' }); if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: d.title }); else toast('المشاركة غير مدعومة، استخدم حفظ الصورة'); } catch (e) { } };
}
