import {DAY,dateValue,addDays,todayISO,shortDate,validateData,monthStats,buildState,percent,sumKm,resultsInRange} from './model.mjs';

const $ = id => document.getElementById(id);
const text = (id,value) => {if ($(id)) $(id).textContent=value;};
function el(tag, className='', content) {
  const node=document.createElement(tag); if(className) node.className=className;
  if(content!==undefined) node.textContent=String(content); return node;
}
function ring(id,p) {$(id)?.style.setProperty('--p',Math.max(0,Math.min(100,p)));}
const km = n => Number.isInteger(n)?String(n):n.toFixed(2).replace(/0$/,'');
const target = (lo,hi) => lo===hi?`${km(lo)}K`:`${km(lo)}–${km(hi)}K`;
const pace = value => String(value || '—').replace(/\/km$/,'');
const CACHE='fuji17-training-data-v2';
let data,state,selected=null,monthKey,busy=false;
const notice=el('div','data-notice'); notice.setAttribute('role','status'); notice.hidden=true;
document.querySelector('main').prepend(notice);
function showNotice(message,retry=false) {
  notice.replaceChildren(el('span','',message)); notice.hidden=false;
  if(retry){const b=el('button','btn','重新載入');b.type='button';b.onclick=load;notice.append(b);}
}
function readCache(){try{return validateData(JSON.parse(localStorage.getItem(CACHE)));}catch{return null;}}
function saveCache(d){try{localStorage.setItem(CACHE,JSON.stringify(d));}catch{/* Storage may be unavailable in private browsing. */}}
async function load() {
  if(busy)return; busy=true; notice.setAttribute('aria-busy','true');
  showNotice('正在更新訓練資料…');
  let fresh=null, failure=null;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  try {
    const response=await fetch('./data.json',{cache:'no-cache',signal:controller.signal});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    fresh=validateData(await response.json());
  } catch(error){failure=error;} finally{clearTimeout(timer);}
  const next=fresh || readCache();
  try {
    if(!next){showNotice('無法取得訓練資料，請確認網路後重試。',true);return;}
    data=next; selected=null; render();
    if(fresh){saveCache(fresh);notice.hidden=true;}
    else showNotice(`目前顯示上次儲存的資料（${data.updated || '日期未知'}），連線恢復後請重新載入。`,true);
  } catch(error){console.error('Training display error',error);showNotice('資料顯示發生錯誤，請重新載入；若持續發生，請回報。',true);}
  finally{busy=false;notice.setAttribute('aria-busy','false');}
  if(failure)console.warn('Training data refresh failed',failure);
}
function render() {
  state=buildState(data);
  const first=data.planStart.slice(0,7),last=data.raceDate.slice(0,7),current=state.today.slice(0,7);
  monthKey=monthKey || (current<first?first:current>last?last:current);
  text('distancePct',percent(state.longest,data.raceDistanceKm)+'%');ring('distanceRing',percent(state.longest,data.raceDistanceKm));
  text('distanceKm',`${state.longest.toFixed(2)} / ${data.raceDistanceKm}K`);text('distanceMain',`目前最長 ${state.longest.toFixed(2)}K`);
  const milestone=[8,10,14,15,data.raceDistanceKm].find(n=>n>state.longest);
  text('distanceSteps',milestone?`下一里程碑 ${milestone}K → ${data.raceDistanceKm}K`:'已達賽事距離');
  const pp=data.paceProgress || {};
  text('pacePct',Number.isFinite(pp.percent)?pp.percent+'%':'—');ring('paceRing',Number.isFinite(pp.percent)?pp.percent:0);
  text('paceGoal','目標 '+(pp.goal || '—'));text('paceMain',pp.label || '尚無評估');text('paceSteps',(pp.steps || '')+'（教練評估）');
  text('goalPill',[data.goalStatus,data.goalNote].filter(Boolean).join('｜'));
  const planPct=state.before?0:percent(state.week,data.plan.length);
  ring('planRing',planPct);text('planPct',planPct+'%');text('planWeek',`W${state.week} / W${data.plan.length}`);
  text('planMain',state.before?'備賽尚未開始':state.after?'備賽計畫已結束':`目前第 ${state.week} 週`);
  text('planSteps',`W${state.week} → ${data.raceDate} 比賽`);
  text('weekTitle',state.after?'最後一週課表':state.before?'首週課表':'本週動態課表');
  text('weeklySub',`W${state.week} · ${state.plan.range}｜${state.plan.focus}`);
  const goal=target(state.min,state.max),p=percent(state.km,(state.min+state.max)/2);
  text('weeklyTarget','本週目標 '+goal);text('mobileWeekKm',`${state.km.toFixed(2)} / ${goal}`);
  text('mobileWeekSessions',`已完成 ${state.completed} / ${state.total} 堂`);$('mobileWeekProgress').value=p;
  text('desktopWeekPct',p+'%');$('desktopWeekFill').style.width=p+'%';text('desktopWeekKm',`已完成 ${state.km.toFixed(2)}K`);text('desktopWeekSessions',`${state.completed} / ${state.total} 堂`);
  ring('weekRing',p);text('weekPct',p+'%');text('fullWeekLabel',`W${state.week}｜本週跑量`);text('weekVolumeText',`${state.km.toFixed(2)} / ${goal}`);
  text('weekVolumeSub',`已完成 ${state.km.toFixed(2)}K ｜ 本週預計 ${goal} ｜ ${state.completed} / ${state.total} 堂`);
  const strategy=document.querySelector('.weekly-strategy');strategy.querySelector('.label').textContent=`W${state.week} 訓練策略`;strategy.querySelector('b').textContent=state.plan.focus;
  const lastWeekKm=sumKm(resultsInRange(data,addDays(state.start,-7),state.start));
  text('desktopWeekStrategy',state.week===4?`上週完成 ${lastWeekKm.toFixed(2)}K，本週總量 ${goal}；${state.plan.focus}，為下一階段做準備。`:`本週預計 ${goal}，重點：${state.plan.focus}。`);
  renderCards();renderDetail();renderPlan();renderCalendar();renderResults();text('updated','最後更新：'+data.updated);
}
function renderCards(){
  const nodes=state.sessions.map(s=>{
    const b=el('article','timeline-item');b.tabIndex=0;b.setAttribute('role','button');b.setAttribute('aria-expanded',String(selected===s.id));
    b.classList.toggle('active',selected===s.id);
    const head=el('div','course-head');head.append(el('div','muted',shortDate(s.dateISO)));
    const title=el('b','',s.type);if(s.done)title.append(el('span','course-completed-tag','✓ 已完成'));head.append(title);
    const card=el('div','card timeline-card');card.append(el('div','big',s.main),el('div','muted',s.sub));b.append(head,card);
    const choose=()=>{selected=selected===s.id?null:s.id;renderCards();renderDetail();const newCard=$('weekCards').children[state.sessions.indexOf(s)];newCard?.focus({preventScroll:true});};
    b.onclick=choose;b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose();}};return b;
  });$('weekCards').replaceChildren(...nodes);
}
function completedDetail(s){
  const r=s.result,box=el('div');box.append(el('div','label','課程執行成果'),el('h2','course-title',`${shortDate(r.dateISO)} ${r.type}`),el('p','course-result-status',r.outcome || '已完成'));
  const metrics=el('div','course-results-metrics');
  [['實際距離',`${r.distanceKm.toFixed(2)}K`],['總時間',r.time || '—'],['平均配速',r.pace?pace(r.pace)+'/km':'—'],['平均／最高心率',`${r.hr || r.avgHr || '—'} / ${r.maxHr || '—'} bpm`]].forEach(([label,value])=>{const row=el('div','course-result-row');row.append(el('span','',label),el('strong','',value));metrics.append(row);});box.append(metrics);
  if(r.laps?.length){
    box.append(el('div','course-split-title','實際分段'));
    const splits=el('div','course-splits'),seconds=r.laps.map(lap=>{const m=String(lap).match(/(\d+):(\d+)(?:\/km)?$/);return m?Number(m[1])*60+Number(m[2]):null;}),valid=seconds.filter(n=>n!==null),low=valid.length?Math.floor(Math.min(...valid)/60)*60:0,high=valid.length?Math.max(low+60,Math.ceil(Math.max(...valid)/60)*60):60;
    r.laps.forEach((lap,i)=>{const m=String(lap).match(/^(\S+)\s+(.+)$/),label=m?(m[1]==='1K'?`第 ${i+1} K`:m[1].replace('0.10K','末段 0.1K')):`第 ${i+1} 段`,row=el('div','course-split'),track=el('div','course-split-track'),bar=el('i');bar.style.width=(seconds[i]===null?0:Math.round(15+80*(high-seconds[i])/(high-low)))+'%';track.append(bar);row.append(el('span','',label),track,el('strong','',m?m[2]:lap));splits.append(row);});
    box.append(splits,el('p','course-split-note','條越長代表配速越快；不足 1K 的末段單獨標示。'));
  }
  if(r.analysis || r.nextStep){const coach=el('div','course-result-coach');coach.append(el('b','','教練判讀'));if(r.analysis)coach.append(el('p','',r.analysis));if(r.nextStep)coach.append(el('p','',r.nextStep));box.append(coach);}return box;
}
function plannedDetail(s){
  const box=el('div');box.append(el('div','label','課程詳情'),el('h2','course-title',`${shortDate(s.dateISO)} ${s.type} ${s.main}`),el('p','muted',s.sub),el('p','course-key-text',s.note));
  if(s.detail?.rpe)box.append(el('p','muted',s.detail.rpe));
  const segments=s.detail?.segments;
  if(segments?.length){box.append(el('h3','','分段配速表'));const wrap=el('div','pace-table-wrap'),table=el('table','pace-table'),head=el('thead'),row=el('tr');['階段','距離','目標配速','執行重點'].forEach(v=>row.append(el('th','',v)));head.append(row);table.append(head);const body=el('tbody');segments.forEach(values=>{const tr=el('tr');values.forEach(v=>tr.append(el('td','',v)));body.append(tr);});table.append(body);wrap.append(table);box.append(wrap);}
  else box.append(el('p','muted','本堂尚未設定詳細配速，請依後續課表更新。'));
  return box;
}
function renderDetail(){
  const mobile=$('mobileCourseDetail'),desktop=$('courseDetail'),session=state.sessions.find(s=>s.id===selected);
  desktop.classList.remove('hidden-detail');desktop.classList.toggle('course-selected',!!session);mobile.classList.toggle('open',!!session);
  if(!session){desktop.replaceChildren(el('div','detail-empty','點擊任一堂課，查看課程內容與執行成果。'));mobile.replaceChildren();return;}
  const content=session.done?completedDetail(session):plannedDetail(session);desktop.replaceChildren(content);
  const copy=el('div','detail course-selected');copy.append(content.cloneNode(true));mobile.replaceChildren(copy);
}
function renderPlan(){
  $('planBody').replaceChildren(...data.plan.map(p=>{const tr=el('tr',p.week===state.week?'currentrow':'');[p.week,p.range,...p.sessions.map(s=>`${s.type} ${s.label}`),p.volume,p.focus].forEach(v=>tr.append(el('td','',v)));return tr;}));
}
function renderResults(){
  text('resultWeek',`累積 ${data.results.length} 次，${state.totalKm.toFixed(2)}K`);
  $('results').replaceChildren(...data.results.map(r=>{const tr=el('tr');[shortDate(r.dateISO),r.type,r.planned,`${r.distanceKm.toFixed(2)}K ✓`,pace(r.pace),r.hr || r.avgHr || '—',r.outcome].forEach(v=>tr.append(el('td','',v || '—')));return tr;}));
}
let selectedDate=null;
function renderCalendar(){
  const stats=monthStats(data,monthKey),goal=target(stats.min,stats.max),p=percent(stats.km,(stats.min+stats.max)/2);
  text('monthVolumeLabel',`${monthKey.replace('-',' / ')}｜本月跑量`);text('monthKm',p+'%');ring('monthRing',p);text('monthVolumeText',`${stats.km.toFixed(2)} / ${goal}`);text('monthVolumeSub',`已完成 ${stats.km.toFixed(2)}K ｜ ${stats.count} 次${stats.unknown?' ｜ 部分課程距離待定':''}`);
  const [year,month]=monthKey.split('-').map(Number);text('monthTitle',`${year} 年 ${month} 月`);
  const first=`${monthKey}-01`,offset=(new Date(dateValue(first)).getUTCDay()+6)%7,start=addDays(first,-offset),days=new Date(Date.UTC(year,month,0)).getUTCDate(),rows=Math.ceil((offset+days)/7);
  const grid=$('calendarGrid');grid.replaceChildren(...['週次','週一','週二','週三','週四','週五','週六','週日'].map(v=>el('div','calhead',v)));
  const sessions=data.plan.flatMap(p=>p.sessions);
  for(let row=0;row<rows;row++){
    const monday=addDays(start,row*7),week=Math.floor((dateValue(monday)-dateValue(data.planStart))/(7*DAY))+1,current=week===state.week;
    grid.append(el('div','calweek'+(current?' currentweek':''),week>=1&&week<=data.plan.length?'W'+week:''));
    for(let col=0;col<7;col++){
      const iso=addDays(monday,col),inside=iso.startsWith(monthKey),cell=el('div','calday'+(!inside?' empty':'')+(current?' currentweek':''));
      cell.append(el('div','label',inside?Number(iso.slice(-2)):`${Number(iso.slice(5,7))}/${Number(iso.slice(-2))}`));
      const actuals=data.results.filter(r=>r.dateISO===iso);
      for(const r of actuals)cell.append(calendarButton(iso,`${r.type} ${r.distanceKm.toFixed(2)}K`,`實際配速 ${pace(r.pace)}/km`,true));
      for(const s of sessions.filter(s=>s.dateISO===iso)){
        const completed=data.results.some(r=>r.sessionId===s.id || (!r.sessionId && (r.scheduledDateISO||r.dateISO)===iso && r.type===s.type));
        if(!completed){
          const detail=data.weekSessions.find(x=>x.id===s.id),values=[];
          for(const segment of detail?.detail?.segments || [])for(const m of String(segment[2]).matchAll(/(\d+):(\d{2})/g))values.push(Number(m[1])*60+Number(m[2]));
          const fmt=n=>Math.floor(n/60)+':'+String(n%60).padStart(2,'0');
          const note=values.length?`配速 ${fmt(Math.min(...values))}–${fmt(Math.max(...values))}/km`:'依課表與當週狀態安排';
          cell.append(calendarButton(iso,`${s.type} ${s.label}`,note,false,iso<state.today));
        }
      }grid.append(cell);
    }
  }
  $('prevMonth').disabled=monthKey<=data.planStart.slice(0,7);$('nextMonth').disabled=monthKey>=data.raceDate.slice(0,7);
}
function calendarButton(iso,label,detail,done,stale=false){
  const b=el('button','calsession'+(done?' done':'')+(stale?' stale':'')+(selectedDate===iso?' selected':''));b.type='button';b.setAttribute('aria-expanded',String(selectedDate===iso));b.setAttribute('aria-label',`${shortDate(iso)} ${label}`);b.append(el('span','',label));if(done)b.append(el('span','calactual','✓ 實際完成'));b.append(el('span','calpace',detail));
  b.onclick=()=>{selectedDate=selectedDate===iso?null:iso;renderCalendar();};return b;
}
function changeMonth(delta){const [y,m]=monthKey.split('-').map(Number);monthKey=new Date(Date.UTC(y,m-1+delta,1)).toISOString().slice(0,7);selectedDate=null;renderCalendar();}
$('prevMonth').onclick=()=>changeMonth(-1);$('nextMonth').onclick=()=>changeMonth(1);
$('prevMonth').setAttribute('aria-label','上一個月');$('nextMonth').setAttribute('aria-label','下一個月');
function setView(calendar){$('tablePlan').hidden=calendar;$('calendarPlan').hidden=!calendar;for(const [id,on] of [['calendarMode',calendar],['tableMode',!calendar]]){$(id).classList.toggle('active',on);$(id).setAttribute('aria-pressed',String(on));}}
$('tableMode').onclick=()=>setView(false);$('calendarMode').onclick=()=>setView(true);setView(true);
document.addEventListener('visibilitychange',()=>{if(!document.hidden && data && todayISO(new Date(),data.timeZone)!==state.today){monthKey=null;selected=null;render();}});
load();
