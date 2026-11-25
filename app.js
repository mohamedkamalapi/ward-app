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

function tabs(active) {
  const t = [['/ward', '✅', 'وردي'], ['/', '🏠', 'الرئيسية'], ['/ward/history', '🗓️', 'المتابعة'], ['/more', '☰', 'المزيد']];
  if (isStaff()) t.splice(3, 0, ['/sheikh', '🎓', 'الشيخ']);
  return '<nav class="tabs">' + t.map(([p, i, l]) => `<a href="#${p}" class="${active === p ? 'on' : ''}"><b>${i}</b>${l}</a>`).join('') + '</nav>';
}

async function boot() {
  // email-confirmation / magic link returns tokens in the hash
  if (location.hash.includes('access_token=')) {
    const p = new URLSearchParams(location.hash.slice(1));
    if (p.get('access_token')) {
      saveS({ at: p.get('access_token'), rt: p.get('refresh_token'), exp: Date.now() + (+p.get('expires_in') || 3600) * 1000 - 60000 });
      history.replaceState(null, '', location.pathname);
      try { const u = await api('/auth/v1/user'); S.uid = u.id; S.email = u.email; saveS(S); } catch (e) { saveS(null); }
    }
  } else if (location.hash.includes('error_description')) {
    history.replaceState(null, '', location.pathname);
  }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
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
  if (!S) { return (route === '/register') ? viewRegister() : viewLogin(); }
  if (!me) { await loadMe(); }
  if (!S) return viewLogin();
  if (!me) return viewComplete();
  if (me.status !== 'active') return viewPending();
  try {
    if (route === '/') return await viewHome();
    if (route === '/ward') return await viewWard();
    if (route === '/ward/history') return await viewHistory();
    if (route === '/more') return await viewMore();
    if (isStaff()) {
      if (route === '/sheikh') return await viewSheikh();
      if (route === '/sheikh/members') return await viewMembers();
      if (route.startsWith('/sheikh/member/')) return await viewMember(route.split('/')[3]);
      if (route === '/sheikh/requests') return await viewRequests();
      if (route === '/sheikh/promotions') return await viewPromotions();
      if (route === '/sheikh/wird') return await viewWirdMgmt();
    }
    return go('/');
  } catch (e) {
    if (e.status === 401) { saveS(null); return render(); }
    $app.innerHTML = `<div class="page"><div class="card center"><p>تعذّر تحميل الصفحة</p><p class="err">${esc(errAr(e))}</p><button class="btn" onclick="render()">إعادة المحاولة</button></div>${tabs(route)}</div>`;
  }
}

/* ---------- auth views ---------- */
function authShell(inner) { return `<div class="auth"><div class="logo">ورد</div><h2 class="center" style="margin:6px 0 2px">ورد المتربين</h2><p class="center muted" style="margin-top:0">منصة متابعة الورد والتربية الإيمانية</p>${inner}</div>`; }
function viewLogin() {
  $app.innerHTML = authShell(`<form class="card" id="f"><label>البريد الإلكتروني</label><input name="email" type="email" autocomplete="username" required dir="ltr"><label>كلمة المرور</label><input name="password" type="password" autocomplete="current-password" required dir="ltr"><div class="err" id="e"></div><button class="btn block">تسجيل الدخول</button></form><p class="center">ما عندكش حساب؟ <a class="lnk" href="#/register">إنشاء حساب</a></p>`);
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
<label>ملاحظة (اختياري)</label><textarea name="note" rows="2"></textarea><div class="err" id="e"></div><button class="btn block">إنشاء الحساب</button></form><p class="center">عندك حساب؟ <a class="lnk" href="#/">دخول</a></p>`);
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

/* ---------- member views ---------- */
async function viewWard() {
  const [acts, day] = await Promise.all([loadActivities(), loadDay(me.id, today())]);
  ctx.acts = acts; ctx.day = day;
  const draw = () => {
    const done = acts.filter(a => actState(a, ctx.day).done).length;
    $app.innerHTML = `<div class="page"><header class="top"><div><h1>وردي اليوم</h1><small>${esc(me.full_name)} · ${n2a(new Date().getDate())} ${MONTHS[new Date().getMonth()]}</small></div><div class="logo">ورد</div></header>
<div class="card"><div class="row sp"><b>التقدم</b><span class="pill">${n2a(done)} / ${n2a(acts.length)}</span></div><div class="bar" style="margin-top:8px"><i style="width:${acts.length ? done / acts.length * 100 : 0}%"></i></div></div>
${acts.length ? acts.map(a => actCard(a)).join('') : '<div class="card center muted">لا توجد أنشطة بعد. سيضيفها الشيخ.</div>'}
<p class="muted small center">كل ما سجّلته اليوم محفوظ في حسابك ويراه الشيخ والمشرفون.</p></div>${tabs('/ward')}`;
    bindWard(draw);
  };
  draw();
}
function actCard(a) {
  const st = actState(a, ctx.day), emo = CAT_EMO[a.category] || '✨';
  if (a.type === 'toggle') return `<div class="item ${st.done ? 'done' : ''}"><button class="chk ${st.done ? 'on' : ''}" data-a="${a.id}" data-k="t">${st.done ? '✓' : ''}</button><div class="grow"><div class="t">${esc(a.title)}</div><div class="s">${st.done ? '✓ تم التسجيل · اضغط للتراجع' : esc(a.description || CATS[a.category] || '')}</div></div><span class="emo">${emo}</span></div>`;
  if (a.type === 'counter') return `<div class="item ${st.done ? 'done' : ''}" style="display:block"><div class="row"><div class="grow"><div class="t">${esc(a.title)}</div><div class="s">${n2a(st.val)} من ${n2a(st.total)} ${esc(a.target_unit || '')}</div></div><span class="emo">${emo}</span></div>
<div class="cnt"><button data-a="${a.id}" data-k="p">+</button><div class="bar"><i style="width:${Math.min(100, st.val / st.total * 100)}%"></i></div><button data-a="${a.id}" data-k="m">−</button></div></div>`;
  const label = a.quran_unit === 'pages' ? 'صفحة' : 'جزء';
  return `<div class="item ${st.done ? 'done' : ''}" style="display:block"><div class="row"><div class="grow"><div class="t">${esc(a.title)}</div><div class="s">${n2a(st.val)} من ${n2a(st.total)} ${label} · اضغط على كل ${label} بعد قراءته</div></div><span class="emo">${emo}</span></div>
<div class="parts">${Array.from({ length: st.total }, (_, i) => `<button class="part ${st.got.includes(i) ? 'on' : ''}" data-a="${a.id}" data-k="q" data-i="${i}">${label} ${n2a(i + 1)}</button>`).join('')}</div></div>`;
}
function bindWard(draw) {
  $app.querySelectorAll('[data-a]').forEach(el => el.onclick = async () => {
    const a = ctx.acts.find(x => x.id === el.dataset.a), k = el.dataset.k, day = ctx.day, prev = JSON.stringify(day);
    try {
      const log = day.logs.find(l => l.activity_id === a.id);
      const put = (completed, counter) => { if (log) { log.completed = completed; log.counter_value = counter; } else day.logs.push({ activity_id: a.id, completed, counter_value: counter }); };
      if (k === 't') { const c = !(log && log.completed); put(c, 0); draw(); await setLog(a, c, 0); }
      else if (k === 'p' || k === 'm') { const v = Math.max(0, (log ? log.counter_value : 0) + (k === 'p' ? 1 : -1)); const c = v >= (a.target_count || 1); put(c, v); draw(); await setLog(a, c, v); }
      else {
        const i = +el.dataset.i, has = day.parts.find(p => p.activity_id === a.id && p.part_index === i);
        if (has) { day.parts = day.parts.filter(p => p !== has); draw(); await del('wird_part_logs', `member_id=eq.${me.id}&activity_id=eq.${a.id}&log_date=eq.${today()}&part_index=eq.${i}`); }
        else { day.parts.push({ activity_id: a.id, part_index: i, completed: true }); draw(); await api('/rest/v1/wird_part_logs?on_conflict=member_id,activity_id,log_date,part_index', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: { tenant_id: TENANT, member_id: me.id, activity_id: a.id, log_date: today(), part_index: i, completed: true } }); }
        const st = actState(a, day); put(st.done, 0); await setLog(a, st.done, 0);
      }
    } catch (e) { ctx.day = JSON.parse(prev); draw(); toast('تعذّر الحفظ: ' + errAr(e)); }
  });
}

async function viewHome() {
  const [acts, day, st] = await Promise.all([loadActivities(), loadDay(me.id, today()), me.stage_id ? q('stages', 'select=*&id=eq.' + me.stage_id) : Promise.resolve([])]);
  const done = acts.filter(a => actState(a, day).done).length;
  // streak: consecutive days (ending today/yesterday) with all done
  const from = new Date(); from.setDate(from.getDate() - 60);
  const logs = await q('wird_logs', `select=log_date,completed&member_id=eq.${me.id}&completed=eq.true&log_date=gte.${ymd(from)}`);
  const per = {}; logs.forEach(l => per[l.log_date] = (per[l.log_date] || 0) + 1);
  let streak = 0; const d = new Date(); if (!(per[ymd(d)] >= acts.length && acts.length)) d.setDate(d.getDate() - 1);
  while (acts.length && per[ymd(d)] >= acts.length) { streak++; d.setDate(d.getDate() - 1); }
  $app.innerHTML = `<div class="page"><header class="top"><div><h1>السلام عليكم، ${esc(me.full_name.split(' ')[0])}</h1><small>${isStaff() ? 'الشيخ' : CATEGORY[me.category] || ''}</small></div><div class="logo">ورد</div></header>
<div class="card"><div class="row sp"><b>ورد اليوم</b><span class="pill">${n2a(done)} / ${n2a(acts.length)}</span></div><div class="bar" style="margin:8px 0"><i style="width:${acts.length ? done / acts.length * 100 : 0}%"></i></div><a class="btn block" href="#/ward">${done >= acts.length && acts.length ? 'راجع وردك' : 'سجّل وردك الآن'}</a></div>
<div class="stats"><div class="stat"><b>${n2a(streak)}</b>أيام متتالية</div><div class="stat"><b>${st[0] ? esc(st[0].name) : '—'}</b>المرحلة الحالية</div></div>
${st[0] ? `<div class="card"><h3>${esc(st[0].name)}</h3><p class="muted">${esc(st[0].purpose || '')}</p>${(st[0].requirements || []).map(r => `<div class="small">• ${esc(r)}</div>`).join('')}</div>` : ''}
</div>${tabs('/')}`;
}

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
async function viewHistory() {
  $app.innerHTML = `<div class="page"><header class="top"><div><h1>المتابعة اليومية</h1><small>سجل التزامك بالشهر</small></div><div class="logo">ورد</div></header><div class="card" id="cal"></div></div>${tabs('/ward/history')}`;
  const n = new Date(); await renderCal(document.getElementById('cal'), me.id, { y: n.getFullYear(), m: n.getMonth(), sel: null });
}

async function viewMore() {
  let stage = null, group = null;
  try { if (me.stage_id) stage = (await q('stages', 'select=name&id=eq.' + me.stage_id))[0]; if (me.group_id) group = (await q('tarbiyah_groups', 'select=*&id=eq.' + me.group_id))[0]; } catch (e) { }
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  $app.innerHTML = `<div class="page"><header class="top"><div><h1>المزيد</h1><small>${esc(me.email)}</small></div><div class="logo">ورد</div></header>
<div class="card"><h3>${esc(me.full_name)}</h3><div class="muted">${isStaff() ? 'شيخ' : CATEGORY[me.category]}${stage ? ' · ' + esc(stage.name) : ''}</div>${group ? `<hr><b>${esc(group.name)}</b><div class="muted small">${esc(group.sheikh_name || '')}</div><div class="muted small">${esc(group.meeting_note || '')}</div>` : ''}</div>
${isStaff() ? '<a class="btn sec block" style="margin-bottom:12px" href="#/sheikh">مساحة الشيخ</a>' : ''}
<div class="card"><h3>📲 تثبيت التطبيق على الموبايل</h3>${standalone ? '<p class="muted">التطبيق مثبّت بالفعل ✅</p>' : `<div id="ins"></div><p class="muted small">${ios ? 'على الآيفون: افتح الموقع في Safari، اضغط زر المشاركة ثم «إضافة إلى الشاشة الرئيسية».' : 'على الأندرويد: من قائمة المتصفح (⋮) اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».'}</p>`}</div>
<button class="btn red block" id="lo">تسجيل الخروج</button></div>${tabs('/more')}`;
  document.getElementById('lo').onclick = logout;
  if (window._bip && document.getElementById('ins')) { const b = document.getElementById('ins'); b.innerHTML = '<button class="btn block" style="margin-bottom:10px" id="bi">تثبيت الآن</button>'; document.getElementById('bi').onclick = () => { window._bip.prompt(); }; }
}
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); window._bip = e; });

/* ---------- sheikh views ---------- */
function sheikhTabs(a) {
  const l = [['/sheikh', 'الرئيسية'], ['/sheikh/members', 'الأعضاء'], ['/sheikh/requests', 'الطلبات'], ['/sheikh/promotions', 'الترقيات'], ['/sheikh/wird', 'الأوراد']];
  return '<div class="chips">' + l.map(([p, t]) => `<a class="chip ${a === p ? 'on' : ''}" href="#${p}" style="text-decoration:none;color:inherit">${t}</a>`).join('') + '</div>';
}
const sheikhPage = (a, title, body) => `<div class="page wide"><header class="top"><div><h1>${title}</h1><small>مساحة الشيخ</small></div><div class="logo">ورد</div></header>${sheikhTabs(a)}${body}</div>${tabs('/sheikh')}`;

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
