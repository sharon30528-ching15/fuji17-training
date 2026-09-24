// Date-only values are UTC midnights; the current day uses the plan's time zone.
export const DAY = 86400000;
export function dateValue(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) throw new Error('日期格式錯誤');
  const value = Date.parse(iso + 'T00:00:00Z');
  if (!Number.isFinite(value) || new Date(value).toISOString().slice(0, 10) !== iso) throw new Error('日期無效');
  return value;
}
export const addDays = (iso, days) => new Date(dateValue(iso) + days * DAY).toISOString().slice(0, 10);
export function todayISO(now = new Date(), timeZone = 'Asia/Taipei') {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {timeZone, year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(now).map(p => [p.type,p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export const shortDate = iso => {const dt = new Date(dateValue(iso)); return `${dt.getUTCMonth()+1}/${dt.getUTCDate()}（${'日一二三四五六'[dt.getUTCDay()]}）`;};
export function distanceRange(text) {
  const match = String(text).match(/(\d+(?:\.\d+)?)(?:[–—~～-](\d+(?:\.\d+)?))?\s*K/i);
  return match ? [Number(match[1]), Number(match[2] || match[1])] : [0,0];
}
export function validateData(d) {
  if (!d || !Array.isArray(d.plan) || !d.plan.length || !Array.isArray(d.results) || !Array.isArray(d.weekSessions)) throw new Error('訓練資料格式錯誤');
  dateValue(d.planStart); dateValue(d.raceDate);
  if (!Number.isFinite(d.raceDistanceKm) || d.raceDistanceKm <= 0) throw new Error('賽事距離錯誤');
  const ids = new Set();
  d.plan.forEach((p, i) => {
    if (p.week !== i + 1 || !Array.isArray(p.sessions)) throw new Error('週課表格式錯誤');
    p.sessions.forEach(s => {
      dateValue(s.dateISO);
      if (!s.id || ids.has(s.id) || !s.type || !Number.isFinite(s.minKm) || !Number.isFinite(s.maxKm) || s.minKm < 0 || s.maxKm < s.minKm) throw new Error('課程格式錯誤');
      ids.add(s.id);
    });
  });
  d.results.forEach(r => {
    dateValue(r.dateISO);
    if (r.scheduledDateISO) dateValue(r.scheduledDateISO);
    if (!Number.isFinite(r.distanceKm) || r.distanceKm <= 0) throw new Error('實際距離錯誤');
  });
  return d;
}
export const sumKm = rows => Math.round(rows.reduce((n,r)=>n+r.distanceKm,0)*100)/100;
export const resultsInRange = (d,start,end) => d.results.filter(r=>r.dateISO>=start && r.dateISO<end);
export const resultForSession = (d,s) => d.results.find(r => r.sessionId === s.id || (!r.sessionId && (r.scheduledDateISO || r.dateISO) === s.dateISO && r.type === s.type));
export function monthStats(d, key) {
  const rows = d.results.filter(r=>r.dateISO.startsWith(key+'-'));
  const sessions = d.plan.flatMap(p=>p.sessions).filter(s=>s.dateISO.startsWith(key+'-'));
  return {km:sumKm(rows),count:rows.length,min:sessions.reduce((n,s)=>n+s.minKm,0),max:sessions.reduce((n,s)=>n+s.maxKm,0),unknown:sessions.some(s=>s.distanceUnknown)};
}
export function buildState(d, today = todayISO(new Date(), d.timeZone)) {
  validateData(d); dateValue(today);
  const week = Math.max(1,Math.min(d.plan.length,Math.floor((dateValue(today)-dateValue(d.planStart))/(7*DAY))+1));
  const plan = d.plan[week-1], start = addDays(d.planStart,(week-1)*7), end = addDays(start,7);
  const sessions = plan.sessions.map(s => {
    const detail = d.weekSessions.find(x=>x.id===s.id);
    const result = resultForSession(d,s);
    return {...s,main:s.label,sub:detail?.sub || '依課表與當週狀態安排',note:detail?.note || plan.focus,detail:detail?.detail,result,actual:result,done:!!result};
  });
  const next = sessions.find(s=>!s.done && s.dateISO>=today);
  return {week,plan,start,end,today,sessions:sessions.map(s=>({...s,next:s===next})),km:sumKm(resultsInRange(d,start,end)),completed:sessions.filter(s=>s.done).length,total:sessions.length,min:sessions.reduce((n,s)=>n+s.minKm,0),max:sessions.reduce((n,s)=>n+s.maxKm,0),longest:Math.max(0,...d.results.map(r=>r.distanceKm)),totalKm:sumKm(d.results),before:today<d.planStart,after:today>d.raceDate};
}
export const percent = (value,target) => target > 0 ? Math.max(0,Math.min(100,Math.round(value/target*100))) : 0;
