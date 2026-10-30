// ===== Cash Dashboard — iOS · cash collected por negocio y destino =====
const KEY = 'cashdash.data.v4';
const YEAR = 2026;

const NEGOCIOS = [
  { key:'agencia',    label:'Agencia' },
  { key:'consultoria',label:'Consultoría' },
  { key:'bicicletas', label:'Bicicletas' },
];
const NEG_LABEL = Object.fromEntries(NEGOCIOS.map(n=>[n.key,n.label]));
const NEG_COLOR = { agencia:'var(--llc)', consultoria:'var(--ou)', bicicletas:'var(--eas)' };

const DESTINOS = [
  { key:'cripto', label:'Cripto',     sub:'Wallet',   color:'var(--cripto)' },
  { key:'llc',    label:'Banco LLC',  sub:'EE. UU.',  color:'var(--llc)' },
  { key:'ou',     label:'Banco OÜ',   sub:'Estonia',  color:'var(--ou)' },
  { key:'eas',    label:'Banco EAS',  sub:'Paraguay', color:'var(--eas)' },
];
const DEST_LABEL = Object.fromEntries(DESTINOS.map(d=>[d.key,d.label]));

const state = { negocio:'all', period:'year', from:null, to:null, year:YEAR };

// ---------- utils de fecha / formato
const pad = n => String(n).padStart(2,'0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parseISO = s => { const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); };
const addDays = (d,n) => { const x=new Date(d); x.setDate(x.getDate()+n); return x; };
const monthsEs = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const fmt$ = n => '$'+Math.round(n).toLocaleString('en-US');
const fmtK = n => n>=1e6 ? '$'+(n/1e6).toFixed(n>=1e7?1:2)+'M'
                : n>=1e3 ? '$'+Math.round(n/1e3)+'k'
                : '$'+Math.round(n);

// ---------- datos (seed + persistencia)
// Reparto por destino de cobro: cripto ~9% del total; el resto que no es
// LLC/EAS cae en OÜ (decisión de Jorge).
const WEIGHTS = {
  agencia:    { llc:0.60, ou:0.31, cripto:0.09 },
  consultoria:{ ou:0.71, llc:0.20, cripto:0.09 },
  bicicletas: { eas:0.80, ou:0.11, cripto:0.09 },
};
// --- Agencia: cash = 40% del facturado; cobro semanal lun–mié (martes fuerte)
const BILLED_AGENCIA = 200000;                   // facturado/mes
const COLLECT_AGENCIA = 0.40;                    // % que entra como cash (el resto va a clientes)
const DOW_AGENCIA = { 1:0.15, 2:0.50, 3:0.35 };  // lun/mar/mié (getDay)
// --- Bicicletas: cobramos el 100%; 197$/u, 600–800/mes; cobro mié–vie
const BIKE_PRICE = 197;
const BIKE_UNITS = [600, 800];                   // unidades/mes (random)
const DOW_BIKES = { 3:0.30, 4:0.55, 5:0.15 };    // mié/jue/vie (getDay)
const BIKES_FROM = 8;                            // septiembre (0-index)
// --- Consultoría: mentorías de 10k; sin ventas ene–mar; julio pico (4); total 20 = 200k
const CONSULT_TICKET = 10000;
const CONSULT_PLAN = { 3:2, 4:3, 5:3, 6:4, 7:3, 8:2, 9:3 }; // mes(0-index):nº mentorías

function firstWeekday(from,dow){ const d=new Date(from); return addDays(d,(dow-d.getDay()+7)%7); }
function pickDest(w){ let r=Math.random(),acc=0; for(const [k,v] of Object.entries(w)){ acc+=v; if(r<=acc) return k; } return Object.keys(w)[0]; }

function seed(){
  const out=[]; let id=1;
  const today=new Date(); today.setHours(0,0,0,0);
  const y=YEAR, y0=new Date(y,0,1);
  const add=(d,neg,amt,w)=>{ if(d<y0||d>today||amt<=0) return; out.push({id:id++,date:iso(d),negocio:neg,destino:pickDest(w),amount:Math.round(amt/10)*10}); };

  // Agencia — semanal, anclado en martes (dow 2)
  const wkAgencia = BILLED_AGENCIA*COLLECT_AGENCIA*12/52;
  for(let d=firstWeekday(y0,2); d<=today; d=addDays(d,7)){
    const wk=wkAgencia*(0.9+Math.random()*0.2);
    add(addDays(d,-1),'agencia',wk*DOW_AGENCIA[1],WEIGHTS.agencia); // lunes
    add(d,            'agencia',wk*DOW_AGENCIA[2],WEIGHTS.agencia); // martes
    add(addDays(d,1), 'agencia',wk*DOW_AGENCIA[3],WEIGHTS.agencia); // miércoles
  }

  // Bicicletas — semanal, anclado en jueves (dow 4), desde septiembre
  for(let d=firstWeekday(new Date(y,BIKES_FROM,1),4); d<=today; d=addDays(d,7)){
    const units=BIKE_UNITS[0]+Math.floor(Math.random()*(BIKE_UNITS[1]-BIKE_UNITS[0]+1));
    const wk=units*12/52*BIKE_PRICE;
    add(addDays(d,-1),'bicicletas',wk*DOW_BIKES[3],WEIGHTS.bicicletas); // miércoles
    add(d,            'bicicletas',wk*DOW_BIKES[4],WEIGHTS.bicicletas); // jueves
    add(addDays(d,1), 'bicicletas',wk*DOW_BIKES[5],WEIGHTS.bicicletas); // viernes
  }

  // Consultoría — mentorías de 10k en días sueltos (abr–oct)
  for(const [m,n] of Object.entries(CONSULT_PLAN)){
    const mi=Number(m);
    for(let k=0;k<n;k++){
      let maxD=new Date(y,mi+1,0).getDate();
      if(y===today.getFullYear()&&mi===today.getMonth()) maxD=today.getDate();
      let dt=new Date(y,mi,1+Math.floor(Math.random()*maxD));
      if(dt.getDay()===0) dt=addDays(dt,1); else if(dt.getDay()===6) dt=addDays(dt,2);
      add(dt,'consultoria',CONSULT_TICKET,WEIGHTS.consultoria);
    }
  }

  return out.sort((a,b)=>a.date.localeCompare(b.date));
}
function load(){ try{const r=JSON.parse(localStorage.getItem(KEY)); if(Array.isArray(r)&&r.length) return r;}catch(e){} const s=seed(); save(s); return s; }
function save(d){ try{localStorage.setItem(KEY,JSON.stringify(d));}catch(e){} }
let DATA = load();

// ---------- rango de fechas según periodo
function rangeDates(){
  const today=new Date(); today.setHours(0,0,0,0);
  if(state.period==='custom' && state.from && state.to) return [parseISO(state.from), parseISO(state.to)];
  const y=state.year;
  const curYear = today.getFullYear();
  switch(state.period){
    case 'today':  return y===curYear ? [today,today] : [new Date(y,11,31),new Date(y,11,31)];
    case 'week': { const dow=(today.getDay()+6)%7; return [addDays(today,-dow), today]; }
    case 'month':  return y===curYear ? [new Date(y,today.getMonth(),1), today] : [new Date(y,11,1), new Date(y,11,31)];
    case 'year':
    default: {
      const end = y===curYear ? today : new Date(y,11,31);
      return [new Date(y,0,1), end];
    }
  }
}
const LABELS={today:'Hoy',week:'Esta semana',month:'Este mes',year:'Año',custom:'Rango'};
function periodLabel(){
  if(state.period==='year') return 'Año '+state.year;
  if(state.period==='custom') return 'Rango personalizado';
  return LABELS[state.period];
}

// ---------- filtrado
function inRange(entry,from,to){ const d=parseISO(entry.date); return d>=from && d<=to; }
function filtered(from,to){
  return DATA.filter(e => inRange(e,from,to) && (state.negocio==='all' || e.negocio===state.negocio));
}
const sum = arr => arr.reduce((a,e)=>a+e.amount,0);

// ---------- bucketización para la gráfica
function weekStart(d){ const x=new Date(d); const dow=(x.getDay()+6)%7; return addDays(x,-dow); }
function bucketize(entries,from,to){
  const spanDays=Math.round((to-from)/864e5)+1;
  const mode = spanDays>95?'month' : spanDays>35?'week' : 'day';
  const buckets=[]; const index=new Map();
  const push=(key,label,date)=>{ index.set(key,buckets.length); buckets.push({key,label,date,value:0}); };
  if(mode==='month'){
    let d=new Date(from.getFullYear(),from.getMonth(),1);
    while(d<=to){ push(d.getFullYear()+'-'+pad(d.getMonth()+1), monthsEs[d.getMonth()], new Date(d)); d=new Date(d.getFullYear(),d.getMonth()+1,1); }
  } else if(mode==='week'){
    let d=weekStart(from);
    while(d<=to){ push(iso(d), d.getDate()+'/'+(d.getMonth()+1), new Date(d)); d=addDays(d,7); }
  } else {
    let d=new Date(from);
    while(d<=to){ push(iso(d), d.getDate()+'/'+(d.getMonth()+1), new Date(d)); d=addDays(d,1); }
  }
  const keyOf=d => mode==='month' ? d.getFullYear()+'-'+pad(d.getMonth()+1)
               : mode==='week'  ? iso(weekStart(d)) : iso(d);
  for(const e of entries){ const i=index.get(keyOf(parseISO(e.date))); if(i!=null) buckets[i].value+=e.amount; }
  return buckets;
}

// ---------- render principal
function render(){
  const [from,to]=rangeDates();
  const set=filtered(from,to);
  const total=sum(set);

  document.getElementById('heroSub').textContent = periodLabel()
    + (state.negocio!=='all' ? ' · '+NEG_LABEL[state.negocio] : '');
  document.getElementById('heroValue').textContent = fmt$(total);

  // delta vs periodo anterior equivalente
  const days=Math.round((to-from)/864e5)+1;
  const pFrom=addDays(from,-days), pTo=addDays(from,-1);
  const prev=sum(DATA.filter(e=>inRange(e,pFrom,pTo)&&(state.negocio==='all'||e.negocio===state.negocio)));
  const delta=document.getElementById('heroDelta');
  if(prev>0){
    const pct=((total-prev)/prev)*100, up=pct>=0;
    delta.innerHTML=`<span class="${up?'up':'down'}">${up?'↑':'↓'} ${Math.abs(pct).toFixed(1)}%</span> <small>vs. periodo anterior</small>`;
  } else delta.innerHTML=`<small>Sin periodo anterior para comparar</small>`;

  // por negocio (solo en "Todos")
  const byNeg=document.getElementById('byNeg');
  if(state.negocio==='all' && total>0){
    byNeg.classList.remove('hidden');
    const totals=NEGOCIOS.map(n=>({...n, v:sum(set.filter(e=>e.negocio===n.key))})).filter(n=>n.v>0);
    document.getElementById('negStack').innerHTML=totals.map(n=>`<span style="flex:${n.v};background:${NEG_COLOR[n.key]}"></span>`).join('');
    document.getElementById('negLegend').innerHTML=totals.map(n=>
      `<div><span class="dot" style="background:${NEG_COLOR[n.key]}"></span>${n.label} <b>${fmtK(n.v)}</b> · ${Math.round(n.v/total*100)}%</div>`).join('');
  } else byNeg.classList.add('hidden');

  // destino cards
  document.getElementById('destGrid').innerHTML=DESTINOS.map(d=>{
    const v=sum(set.filter(e=>e.destino===d.key));
    const pct= total>0 ? Math.round(v/total*100) : 0;
    return `<div class="card dest">
      <div class="dest-top"><span class="dot" style="background:${d.color}"></span>${d.label}
        <span class="dest-sub">· ${d.sub}</span></div>
      <div class="dest-val">${fmtK(v)}</div>
      <div class="dest-pct">${pct}% del total</div></div>`;
  }).join('');

  const buckets=bucketize(set,from,to);
  document.getElementById('chartSub').textContent = `${fmt$(total)} · ${periodLabel()}`;
  drawChart(buckets);
}

// ---------- gráfica SVG suave (iOS)
const svg=document.getElementById('chart');
const tip=document.getElementById('tooltip');
let CHART=[];
function smoothPath(pts){
  if(pts.length<2) return pts.length?`M ${pts[0].x} ${pts[0].y}`:'';
  let d=`M ${pts[0].x} ${pts[0].y}`;
  for(let i=0;i<pts.length-1;i++){
    const p0=pts[i-1]||pts[i], p1=pts[i], p2=pts[i+1], p3=pts[i+2]||p2;
    const c1x=p1.x+(p2.x-p0.x)/6, c1y=p1.y+(p2.y-p0.y)/6;
    const c2x=p2.x-(p3.x-p1.x)/6, c2y=p2.y-(p3.y-p1.y)/6;
    d+=` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}
function drawChart(buckets){
  CHART=buckets;
  const W=svg.clientWidth||840, H=svg.clientHeight||230;
  const padT=16,padB=6,padX=4;
  const max=Math.max(10,...buckets.map(b=>b.value))*1.18;
  const n=buckets.length;
  const x=i=> n<=1 ? W/2 : padX+(i/(n-1))*(W-2*padX);
  const y=v=> padT+(1-v/max)*(H-padT-padB);
  const col='var(--accent)';
  const pts=buckets.map((b,i)=>({x:x(i),y:y(b.value)}));
  const line=smoothPath(pts);
  const area=line+` L ${x(n-1)} ${H-padB} L ${x(0)} ${H-padB} Z`;

  let grid='';
  for(let g=0;g<=3;g++){ const gy=padT+(g/3)*(H-padT-padB); grid+=`<line x1="0" y1="${gy}" x2="${W}" y2="${gy}" stroke="var(--sep)" stroke-width="1"/>`; }

  svg.innerHTML=`
    <defs><linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${col}" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="${col}" stop-opacity="0"/>
    </linearGradient></defs>
    ${grid}
    <path d="${area}" fill="url(#grad)"/>
    <path d="${line}" fill="none" stroke="${col}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    <g id="hoverG" style="opacity:0">
      <line id="hLine" y1="${padT}" y2="${H-padB}" stroke="${col}" stroke-width="1" stroke-dasharray="3 4"/>
      <circle id="hDot" r="5" fill="var(--card)" stroke="${col}" stroke-width="2.5"/>
    </g>`;

  const ax=document.getElementById('xAxis'); ax.innerHTML='';
  const step=Math.max(1,Math.floor(n/6));
  for(let i=0;i<n;i+=step) ax.insertAdjacentHTML('beforeend',`<span>${buckets[i].label}</span>`);
  svg._x=x; svg._y=y; svg._W=W;
}
function onMove(ev){
  if(!CHART.length) return;
  const rect=svg.getBoundingClientRect();
  const mx=ev.clientX-rect.left, n=CHART.length;
  let i=n<=1?0:Math.round((mx/svg._W)*(n-1)); i=Math.max(0,Math.min(n-1,i));
  const b=CHART[i], px=svg._x(i), py=svg._y(b.value);
  const g=document.getElementById('hoverG');
  if(g){ g.style.opacity=1;
    document.getElementById('hLine').setAttribute('x1',px); document.getElementById('hLine').setAttribute('x2',px);
    document.getElementById('hDot').setAttribute('cx',px); document.getElementById('hDot').setAttribute('cy',py); }
  tip.innerHTML=`<div>${b.label}</div><b>${fmt$(b.value)}</b>`;
  tip.style.left=px+'px'; tip.style.top=py+'px'; tip.classList.remove('hidden');
}
svg.addEventListener('mousemove',onMove);
svg.addEventListener('mouseleave',()=>{tip.classList.add('hidden');const g=document.getElementById('hoverG');if(g)g.style.opacity=0;});

// ---------- interacción
document.getElementById('negSeg').addEventListener('click',e=>{
  const b=e.target.closest('button'); if(!b)return;
  document.querySelectorAll('#negSeg button').forEach(x=>x.classList.remove('active'));
  b.classList.add('active'); state.negocio=b.dataset.neg; render();
});
document.getElementById('periodSeg').addEventListener('click',e=>{
  const b=e.target.closest('button'); if(!b)return;
  document.querySelectorAll('#periodSeg button').forEach(x=>x.classList.remove('active'));
  b.classList.add('active'); state.period=b.dataset.p;
  document.getElementById('rangeBox').classList.remove('open'); render();
});
document.getElementById('btnRange').addEventListener('click',()=>document.getElementById('rangeBox').classList.toggle('open'));
document.getElementById('applyRange').addEventListener('click',()=>{
  const f=document.getElementById('from').value, t=document.getElementById('to').value;
  if(!f||!t){alert('Elige las dos fechas');return;}
  if(f>t){alert('«Desde» no puede ser posterior a «Hasta»');return;}
  state.from=f; state.to=t; state.period='custom';
  document.querySelectorAll('#periodSeg button').forEach(x=>x.classList.remove('active'));
  render();
});
const yearPick=document.getElementById('yearPick');
yearPick.innerHTML=`<option value="${YEAR}">${YEAR}</option>`;
yearPick.value=String(state.year);
yearPick.addEventListener('change',()=>{ state.year=Number(yearPick.value); render(); });

// ---------- drawer menú
const drawer=document.getElementById('drawer'), scrim=document.getElementById('scrim');
function openDrawer(){ drawer.classList.add('open'); scrim.classList.add('open'); }
function closeDrawer(){ drawer.classList.remove('open'); scrim.classList.remove('open'); }
document.getElementById('btnMenu').addEventListener('click',openDrawer);
scrim.addEventListener('click',closeDrawer);

// ---------- modal editor
const editScrim=document.getElementById('editScrim');
function openEdit(){ buildTable(); editScrim.classList.add('open'); }
function closeEdit(){ editScrim.classList.remove('open'); }
document.getElementById('mEdit').addEventListener('click',()=>{ closeDrawer(); openEdit(); });
document.getElementById('editClose').addEventListener('click',closeEdit);
editScrim.addEventListener('click',e=>{ if(e.target===editScrim) closeEdit(); });
document.getElementById('mReset').addEventListener('click',()=>{
  if(!confirm('¿Restablecer los datos de ejemplo? Se perderán tus cambios.'))return;
  DATA=seed(); save(DATA); closeDrawer(); render();
});

function selectHTML(opts,val,field){
  return `<select data-f="${field}">`+opts.map(o=>`<option value="${o.key}" ${o.key===val?'selected':''}>${o.label}</option>`).join('')+`</select>`;
}
function buildTable(){
  const body=document.getElementById('dataBody'); body.innerHTML='';
  [...DATA].reverse().forEach(r=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td><input type="date" value="${r.date}" data-f="date"></td>
      <td>${selectHTML(NEGOCIOS,r.negocio,'negocio')}</td>
      <td>${selectHTML(DESTINOS,r.destino,'destino')}</td>
      <td><input type="number" value="${r.amount}" data-f="amount" min="0" step="10"></td>
      <td><button class="del" title="Borrar">✕</button></td>`;
    tr.querySelectorAll('input,select').forEach(inp=>inp.addEventListener('input',()=>{
      const f=inp.dataset.f; r[f]= f==='amount'?(parseFloat(inp.value)||0):inp.value;
      DATA.sort((a,b)=>a.date.localeCompare(b.date)); save(DATA); render();
    }));
    tr.querySelector('.del').addEventListener('click',()=>{ DATA=DATA.filter(x=>x!==r); save(DATA); buildTable(); render(); });
    body.appendChild(tr);
  });
}
document.getElementById('addRow').addEventListener('click',()=>{
  const last=DATA.length?parseISO(DATA[DATA.length-1].date):new Date();
  DATA.push({ id:Date.now(), date:iso(last), negocio:'agencia', destino:'llc', amount:0 });
  DATA.sort((a,b)=>a.date.localeCompare(b.date)); save(DATA); buildTable(); render();
});

// ---------- init
(function init(){
  const [f,t]=rangeDates();
  document.getElementById('from').value=iso(f);
  document.getElementById('to').value=iso(t);
  render();
  window.addEventListener('resize',()=>drawChart(CHART));
})();
