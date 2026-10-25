// ===== Cash Dashboard — datos editables, filtros estilo Stripe =====
const KEY = 'cashdash.data.v1';
const COS = ['estonia','usa','paraguay'];
const COLORS = {estonia:'#635bff', usa:'#0ea5e9', paraguay:'#f59e0b'};

const state = { company:'all', period:'30d', from:null, to:null };

// ---------- utilidades de fecha
const pad = n => String(n).padStart(2,'0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parseISO = s => { const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); };
const addDays = (d,n) => { const x=new Date(d); x.setDate(x.getDate()+n); return x; };
const fmt$ = n => '$'+Math.round(n).toLocaleString('en-US');
const fmtShort = n => n>=1000 ? '$'+(n/1000).toFixed(n>=10000?0:1)+'k' : '$'+Math.round(n);

// ---------- datos (seed + persistencia)
function seed(){
  const rows=[]; const today=new Date(); today.setHours(0,0,0,0);
  for(let i=59;i>=0;i--){
    const d=addDays(today,-i); const dow=d.getDay();
    const wk = (dow===0||dow===6)?0.55:1;          // menos en finde
    const trend = 1 + (59-i)/120;                   // leve crecimiento
    const r=(base,v)=>Math.max(0,Math.round((base+Math.random()*v)*wk*trend/10)*10);
    rows.push({date:iso(d), estonia:r(900,1400), usa:r(1500,2600), paraguay:r(400,900)});
  }
  return rows;
}
function load(){ try{const r=JSON.parse(localStorage.getItem(KEY)); if(Array.isArray(r)&&r.length) return r;}catch(e){} const s=seed(); save(s); return s; }
function save(d){ try{localStorage.setItem(KEY,JSON.stringify(d));}catch(e){} }
let DATA = load();

// ---------- rango según periodo
function rangeDates(){
  const today=new Date(); today.setHours(0,0,0,0);
  if(state.period==='custom' && state.from && state.to) return [parseISO(state.from), parseISO(state.to)];
  switch(state.period){
    case 'today': return [today, today];
    case 'yesterday': { const y=addDays(today,-1); return [y,y]; }
    case 'week': { const dow=(today.getDay()+6)%7; return [addDays(today,-dow), today]; } // lunes→hoy
    case 'month': return [new Date(today.getFullYear(),today.getMonth(),1), today];
    case '30d': default: return [addDays(today,-29), today];
  }
}
const LABELS={today:'Hoy',yesterday:'Ayer',week:'Esta semana',month:'Este mes','30d':'Últimos 30 días',custom:'Rango'};

// serie diaria dentro de un rango, según empresa
function series(from,to){
  const out=[]; const map={}; DATA.forEach(r=>map[r.date]=r);
  for(let d=new Date(from); d<=to; d=addDays(d,1)){
    const r=map[iso(d)];
    let v=0; if(r){ v = state.company==='all' ? (r.estonia+r.usa+r.paraguay) : (r[state.company]||0); }
    out.push({date:iso(d), value:v, row:r});
  }
  return out;
}
const sum = arr => arr.reduce((a,b)=>a+b.value,0);

// ---------- render principal
function render(){
  const [from,to]=rangeDates();
  const s=series(from,to);
  const total=sum(s);

  // periodo anterior equivalente
  const days=s.length;
  const pFrom=addDays(from,-days), pTo=addDays(from,-1);
  const prevTotal=sum(series(pFrom,pTo));

  document.getElementById('heroValue').textContent=fmt$(total);
  document.getElementById('rangeLabel').textContent=LABELS[state.period];

  const delta=document.getElementById('heroDelta');
  if(prevTotal>0){
    const pct=((total-prevTotal)/prevTotal)*100;
    const up=pct>=0;
    delta.innerHTML=`<span class="${up?'up':'down'}">${up?'▲':'▼'} ${Math.abs(pct).toFixed(1)}%</span> <small>vs. periodo anterior (${fmt$(prevTotal)})</small>`;
  } else delta.innerHTML=`<small>Sin datos del periodo anterior para comparar</small>`;

  // mini KPIs por empresa (siempre el total de cada una en el rango)
  COS.forEach(co=>{
    const t=DATA.filter(r=>{const d=parseISO(r.date);return d>=from&&d<=to;}).reduce((a,r)=>a+(r[co]||0),0);
    const id='val'+co.charAt(0).toUpperCase()+co.slice(1);
    const el=document.getElementById(id); if(el) el.textContent=fmt$(t);
  });

  document.getElementById('chartSub').textContent=`${s[0]?.date||''} → ${s[s.length-1]?.date||''} · ${fmt$(total)} en total`;
  drawChart(s);
}

// ---------- gráfica SVG con degradado + hover
const svg=document.getElementById('chart');
const tip=document.getElementById('tooltip');
let CHART=[];
function drawChart(s){
  CHART=s;
  const W=svg.clientWidth||900, H=svg.clientHeight||280;
  const padL=6,padR=6,padT=14,padB=6;
  const max=Math.max(10,...s.map(p=>p.value))*1.15;
  const n=s.length;
  const x=i=> n<=1 ? W/2 : padL+(i/(n-1))*(W-padL-padR);
  const y=v=> padT+(1-v/max)*(H-padT-padB);
  const col=state.company==='all'?'#635bff':COLORS[state.company];

  let line='', area='';
  s.forEach((p,i)=>{ const px=x(i),py=y(p.value); line+=(i?'L':'M')+px+' '+py+' '; });
  area=line+`L ${x(n-1)} ${H-padB} L ${x(0)} ${H-padB} Z`;

  // grid horizontal (4 líneas)
  let grid='';
  for(let g=0;g<=3;g++){ const gy=padT+(g/3)*(H-padT-padB); grid+=`<line x1="0" y1="${gy}" x2="${W}" y2="${gy}" stroke="#eef1f7" stroke-width="1"/>`; }

  svg.innerHTML=`
    <defs>
      <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${col}" stop-opacity="0.28"/>
        <stop offset="100%" stop-color="${col}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${grid}
    <path d="${area}" fill="url(#grad)"/>
    <path d="${line}" fill="none" stroke="${col}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    <g id="hoverG" style="opacity:0">
      <line id="hLine" y1="${padT}" y2="${H-padB}" stroke="${col}" stroke-width="1" stroke-dasharray="4 4"/>
      <circle id="hDot" r="5" fill="#fff" stroke="${col}" stroke-width="2.5"/>
    </g>`;

  // eje x: ~6 etiquetas
  const ax=document.getElementById('xAxis'); ax.innerHTML='';
  const step=Math.max(1,Math.floor(n/6));
  for(let i=0;i<n;i+=step){ const d=parseISO(s[i].date); ax.insertAdjacentHTML('beforeend',`<span>${d.getDate()}/${d.getMonth()+1}</span>`); }

  svg._x=x; svg._y=y; svg._W=W;
}

function onMove(ev){
  if(!CHART.length) return;
  const rect=svg.getBoundingClientRect();
  const mx=ev.clientX-rect.left;
  const n=CHART.length;
  let i=n<=1?0:Math.round(((mx)/(svg._W))*(n-1)); i=Math.max(0,Math.min(n-1,i));
  const p=CHART[i]; const px=svg._x(i), py=svg._y(p.value);
  const g=document.getElementById('hoverG'); if(g){g.style.opacity=1;
    document.getElementById('hLine').setAttribute('x1',px);
    document.getElementById('hLine').setAttribute('x2',px);
    document.getElementById('hDot').setAttribute('cx',px);
    document.getElementById('hDot').setAttribute('cy',py);
  }
  const d=parseISO(p.date);
  let rows='';
  if(state.company==='all' && p.row){
    rows=COS.map(co=>`<div class="trow"><span class="dot" style="background:${COLORS[co]}"></span>${co==='usa'?'EE. UU.':co.charAt(0).toUpperCase()+co.slice(1)}: ${fmt$(p.row[co]||0)}</div>`).join('');
  }
  tip.innerHTML=`<div>${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}</div><b>${fmt$(p.value)}</b>${rows}`;
  tip.style.left=px+'px'; tip.style.top=py+'px'; tip.classList.remove('hidden');
}
svg.addEventListener('mousemove',onMove);
svg.addEventListener('mouseleave',()=>{tip.classList.add('hidden');const g=document.getElementById('hoverG');if(g)g.style.opacity=0;});

// ---------- interacción filtros
document.getElementById('periodPills').addEventListener('click',e=>{
  const b=e.target.closest('.pill'); if(!b)return;
  document.querySelectorAll('.pill').forEach(p=>p.classList.remove('active'));
  b.classList.add('active'); state.period=b.dataset.p; render();
});
document.getElementById('companyTabs').addEventListener('click',e=>{
  const b=e.target.closest('.co-tab'); if(!b)return;
  document.querySelectorAll('.co-tab').forEach(p=>p.classList.remove('active'));
  b.classList.add('active'); state.company=b.dataset.co; render();
});
document.getElementById('applyRange').addEventListener('click',()=>{
  const f=document.getElementById('from').value, t=document.getElementById('to').value;
  if(!f||!t){alert('Elige las dos fechas');return;}
  if(f>t){alert('«Desde» no puede ser posterior a «Hasta»');return;}
  state.from=f; state.to=t; state.period='custom';
  document.querySelectorAll('.pill').forEach(p=>p.classList.remove('active'));
  render();
});

// ---------- panel de edición
const drawer=document.getElementById('drawer'), overlay=document.getElementById('overlay');
function openDrawer(){ buildTable(); drawer.classList.remove('hidden'); overlay.classList.remove('hidden'); }
function closeDrawer(){ drawer.classList.add('hidden'); overlay.classList.add('hidden'); }
document.getElementById('btnEdit').addEventListener('click',openDrawer);
document.getElementById('closeDrawer').addEventListener('click',closeDrawer);
overlay.addEventListener('click',closeDrawer);

function buildTable(){
  const body=document.getElementById('dataBody'); body.innerHTML='';
  [...DATA].reverse().forEach(r=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td><input type="date" value="${r.date}" data-f="date"></td>
      <td><input type="number" value="${r.estonia}" data-f="estonia" min="0"></td>
      <td><input type="number" value="${r.usa}" data-f="usa" min="0"></td>
      <td><input type="number" value="${r.paraguay}" data-f="paraguay" min="0"></td>
      <td><button class="del" title="Borrar">🗑</button></td>`;
    tr.querySelectorAll('input').forEach(inp=>inp.addEventListener('input',()=>{
      const f=inp.dataset.f; r[f]= f==='date'?inp.value:(parseFloat(inp.value)||0);
      DATA.sort((a,b)=>a.date.localeCompare(b.date)); save(DATA); render();
    }));
    tr.querySelector('.del').addEventListener('click',()=>{
      DATA=DATA.filter(x=>x!==r); save(DATA); buildTable(); render();
    });
    body.appendChild(tr);
  });
}
document.getElementById('addRow').addEventListener('click',()=>{
  const last=DATA.length?parseISO(DATA[DATA.length-1].date):new Date();
  DATA.push({date:iso(addDays(last,1)),estonia:0,usa:0,paraguay:0});
  DATA.sort((a,b)=>a.date.localeCompare(b.date)); save(DATA); buildTable(); render();
});
document.getElementById('resetData').addEventListener('click',()=>{
  if(!confirm('¿Restablecer los datos de ejemplo? Se perderán tus cambios.'))return;
  DATA=seed(); save(DATA); buildTable(); render();
});

// ---------- init
(function init(){
  const [f,t]=rangeDates();
  document.getElementById('from').value=iso(f);
  document.getElementById('to').value=iso(t);
  render();
  window.addEventListener('resize',()=>drawChart(CHART));
})();
