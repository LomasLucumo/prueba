
// ================== Datos del circuito (JSON) ==================
// El contenido vive en circuits/*.json (mismo formato reutilizable en una app móvil).
const $=id=>document.getElementById(id);
const U={units:'meters'};
const getJSON=async u=>{const r=await fetch(u);if(!r.ok)throw new Error(u+' → '+r.status);return r.json()};
let C;
try{
  const idx=await getJSON('circuits/index.json');
  const want=new URLSearchParams(location.search).get('c')||idx.default;
  const item=idx.circuits.find(x=>x.id===want)||idx.circuits[0];
  C=await getJSON(item.file);
}catch(e){
  document.body.innerHTML='<p style="padding:20px;font-family:system-ui">No se pudo cargar el circuito. Abre la app una vez con internet.</p>';
  throw e;
}
const R=C.route.coordinates, CFG=C.settings;
const GEO_R=CFG.arrivalRadiusM, OFF=CFG.offRouteM, MIN_ACC=CFG.minAccuracyM,
      FAR_IN=CFG.farEnterM, FAR_OUT=CFG.farExitM, RADIUS=CFG.followRadiusM;
const KEY='circuito:'+C.id;
const ruta=turf.lineString(R), total=turf.length(ruta,U);
// Paradas en orden de recorrido; "m" = metros desde el inicio sobre la ruta
const STOPS=C.stops.map(s=>({id:s.id,n:s.label,name:s.name,description:s.description,c:s.coordinates,
  m:turf.nearestPointOnLine(ruta,turf.point(s.coordinates),U).properties.location}));
STOPS[STOPS.length-1].m=total;
document.title=C.name;$('title').textContent=C.name;

// ---------- Estado persistente ----------
const fresh=()=>({v:C.version,maxM:0,lastM:0,t:0,visited:{}});
let S=fresh();
try{const x=JSON.parse(localStorage.getItem(KEY));if(x&&x.visited&&x.v===C.version)S=x}catch(e){}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}};

STOPS.forEach(s=>{const t=document.createElement('div');t.className='tick';t.id='t'+s.n;t.style.left=(s.m/total*100)+'%';t.textContent=s.n;$('bar').appendChild(t)});

// ---------- Mapa SVG ----------
function drawFull(user,dev){
  // El mapa se ajusta a la ruta; el usuario solo entra en el encuadre si está cerca (<200 m)
  const pts=R.slice(); if(user&&dev<=200) pts.push(user);
  const k=Math.cos(R[0][1]*Math.PI/180);
  const xs=pts.map(p=>p[0]*k), ys=pts.map(p=>-p[1]);
  const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
  const pad=28,W=360,H=280,sc=Math.min((W-2*pad)/((x1-x0)||1e-6),(H-2*pad)/((y1-y0)||1e-6));
  const P=c=>[pad+(c[0]*k-x0)*sc+((W-2*pad)-(x1-x0)*sc)/2, pad+(-c[1]-y0)*sc+((H-2*pad)-(y1-y0)*sc)/2];
  const path=cs=>cs.map((c,i)=>(i?'L':'M')+P(c).map(v=>v.toFixed(1)).join(' ')).join('');
  let s=`<path d="${path(R)}" fill="none" stroke="var(--ln)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`;
  if(S.maxM>1){s+=`<path d="${path(turf.lineSliceAlong(ruta,0,Math.min(S.maxM,total),U).geometry.coordinates)}" fill="none" stroke="var(--ac)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`}
  STOPS.forEach(st=>{const [x,y]=P(st.c),v=S.visited[st.n];
    s+=`<circle cx="${x}" cy="${y}" r="11" fill="${v?'var(--ac)':'var(--card)'}" stroke="${v?'var(--ac)':'var(--tx)'}" stroke-width="2"/><text x="${x}" y="${y+4}" text-anchor="middle" font-size="11" font-weight="700" fill="${v?'#fff':'var(--tx)'}">${st.n}</text>`});
  if(user){
    let [x,y]=P(user);
    const cx=Math.min(W-14,Math.max(14,x)), cy=Math.min(H-14,Math.max(14,y));
    if(cx!==x||cy!==y){ // fuera del encuadre: marcador pegado al borde + distancia
      x=cx;y=cy;
      const d=dev>=1000?(dev/1000).toFixed(1)+' km':Math.round(dev)+' m';
      s+=`<circle cx="${x}" cy="${y}" r="9" fill="#2b7bff" stroke="#fff" stroke-width="2.5" stroke-dasharray="3 2"/><text x="${W/2}" y="16" text-anchor="middle" font-size="11" fill="var(--mu)">Estás a ${d} de la ruta</text>`;
    } else {
      s+=`<circle cx="${x}" cy="${y}" r="16" fill="#2b7bff" opacity=".2"/><circle cx="${x}" cy="${y}" r="7" fill="#2b7bff" stroke="#fff" stroke-width="2.5"/>`;
    }
  }
  $('map').innerHTML=s;
}

// Vista de seguimiento: centrada en el usuario, ~500 m de ancho
function drawFollow(user,rec){
  const W=360,H=280,sc=(W/2)/RADIUS;
  const mLat=110540, mLng=111320*Math.cos(user[1]*Math.PI/180);
  const P=c=>[W/2+(c[0]-user[0])*mLng*sc, H/2-(c[1]-user[1])*mLat*sc];
  const path=cs=>cs.map((c,i)=>(i?'L':'M')+P(c).map(v=>v.toFixed(1)).join(' ')).join('');
  let s=`<path d="${path(R)}" fill="none" stroke="var(--ln)" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`;
  if(S.maxM>1){s+=`<path d="${path(turf.lineSliceAlong(ruta,0,Math.min(S.maxM,total),U).geometry.coordinates)}" fill="none" stroke="var(--ac)" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`}
  const next=STOPS.find(st=>!S.visited[st.n]&&st.m>rec+GEO_R);
  STOPS.forEach(st=>{
    const [x,y]=P(st.c),v=S.visited[st.n];
    const inside=x>-12&&x<W+12&&y>-12&&y<H+12;
    if(inside){
      s+=`<circle cx="${x}" cy="${y}" r="13" fill="${v?'var(--ac)':'var(--card)'}" stroke="${v?'var(--ac)':'var(--tx)'}" stroke-width="2"/><text x="${x}" y="${y+4}" text-anchor="middle" font-size="12" font-weight="700" fill="${v?'#fff':'var(--tx)'}">${st.n}</text>`;
    } else if(st===next){ // próxima parada fuera de vista: indicador en el borde
      const cx=Math.min(W-18,Math.max(18,x)), cy=Math.min(H-18,Math.max(18,y));
      const d=Math.round(st.m-rec), ty=cy<H/2?cy+28:cy-20, tx=Math.min(W-42,Math.max(42,cx));
      s+=`<circle cx="${cx}" cy="${cy}" r="12" fill="var(--card)" stroke="var(--tx)" stroke-width="2" stroke-dasharray="3 2"/><text x="${cx}" y="${cy+4}" text-anchor="middle" font-size="12" font-weight="700" fill="var(--tx)">${st.n}</text><text x="${tx}" y="${ty}" text-anchor="middle" font-size="11" fill="var(--mu)">${d} m</text>`;
    }
  });
  s+=`<circle cx="${W/2}" cy="${H/2}" r="18" fill="#2b7bff" opacity=".2"/><circle cx="${W/2}" cy="${H/2}" r="7" fill="#2b7bff" stroke="#fff" stroke-width="2.5"/>`;
  s+=`<path d="M12 ${H-12}h${100*sc}" stroke="var(--mu)" stroke-width="2"/><text x="12" y="${H-17}" font-size="10" fill="var(--mu)">100 m</text>`;
  $('map').innerHTML=s;
}

// Tarjeta "estás lejos": ir al inicio (si aún no empezó) o volver a la ruta
const fmt=m=>m>=1000?(m/1000).toFixed(1).replace('.',',')+' km':Math.round(m)+' m';
function farCard(user,dev){
  $('farT').textContent=`Estás a ${fmt(dev)} de la ruta`;
  $('farS').textContent=`Cuando estés a menos de ${FAR_OUT} m de la ruta verás el mapa de seguimiento.`;
}

// Decide qué mostrar: tarjeta (lejos) / seguimiento (cerca) / circuito completo (manual)
let far=false, full=false, last=null;
function paint(user,rec,dev){
  last=[user,rec,dev];
  $('view').hidden=!user;
  if(!user){$('map').style.display='block';$('far').hidden=true;drawFull(null,0);return}
  far=dev>FAR_IN||(far&&dev>FAR_OUT);
  const card=far&&!full;
  $('map').style.display=card?'none':'block';
  $('far').hidden=!card;
  if(card) farCard(user,dev);
  else if(full||far) drawFull(user,dev);
  else drawFollow(user,rec);
  $('view').textContent=full?'Volver al seguimiento':'Ver circuito completo';
}
$('view').onclick=()=>{full=!full;if(last)paint(...last)};

// ---------- Ubicar al usuario sobre la ruta (con ventana para rutas que se cruzan) ----------
function locate(user,useWindow){
  const pt=turf.point(user);
  if(useWindow&&S.t){
    const dt=(Date.now()-S.t)/1000;
    const a=Math.max(0,S.lastM-150), b=Math.min(total,S.lastM+300+2.5*dt);
    if(b>a&&b-a<total){
      const s=turf.nearestPointOnLine(turf.lineSliceAlong(ruta,a,b,U),pt,U);
      if(s.properties.dist<=OFF*2) return {rec:a+s.properties.location,dev:s.properties.dist};
    }
  }
  const g=turf.nearestPointOnLine(ruta,pt,U);
  return {rec:g.properties.location,dev:g.properties.dist};
}

// ---------- Render ----------
const hhmm=ts=>new Date(ts).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
function render(user,rec,dev,acc,saved){
  const r=rec==null?S.lastM:rec;
  let seg='Antes de A';
  for(let i=0;i<STOPS.length-1;i++){
    const a=STOPS[i].m,b=STOPS[i+1].m;
    if(r>=a&&r<b){seg=`Entre ${STOPS[i].n} y ${STOPS[i+1].n} · ${Math.round((r-a)/(b-a)*100)}%`;break}
  }
  if(r>=total-GEO_R) seg='Llegaste a B 🎉';
  $('seg').textContent=(saved?'Último avance: ':'')+seg;
  $('fill').style.width=(S.maxM/total*100)+'%';
  STOPS.forEach(s=>$('t'+s.n).classList.toggle('on',!!S.visited[s.n]));
  const next=STOPS.find(s=>s.m>r+GEO_R);
  $('det').innerHTML=`${Math.round(r)} m de ${Math.round(total)} m · avance máximo ${Math.round(S.maxM)} m`+(next?`<br>Faltan ${Math.round(next.m-r)} m para ${next.name||'la parada '+next.n}`:'')+(acc?` · GPS ±${Math.round(acc)} m`:'');
  $('vis').textContent=STOPS.filter(s=>S.visited[s.n]).map(s=>`${s.n} ${hhmm(S.visited[s.n])}`).join(' · ');
  const at=user&&STOPS.find(s=>turf.distance(turf.point(user),turf.point(s.c),U)<=GEO_R);
  $('info').textContent=at?(at.description||''):'';
  $('alert').textContent=at?`📍 ${at.name||'Parada '+at.n}`:(dev>OFF?`⚠ Estás a ${Math.round(dev)} m de la ruta`:'');
  paint(user,rec,dev);
}

// sim=true no toca el progreso guardado
function update(lng,lat,acc,sim){
  const user=[lng,lat], {rec,dev}=locate(user,!sim);
  if(!sim&&dev<=OFF*2){
    S.lastM=rec;S.t=Date.now();S.maxM=Math.max(S.maxM,rec);
    // parada visitada por distancia recorrida, aunque la app no estuviera activa al pasar
    STOPS.forEach(s=>{if(rec>=s.m-GEO_R&&!S.visited[s.n])S.visited[s.n]=Date.now()});
    save();
  }
  render(user,rec,dev,acc,false);
}

// ---------- GPS, Wake Lock y reanudación ----------
let watchId=null,buf=[],wl=null,mode='idle';
async function lock(){try{wl=await navigator.wakeLock.request('screen')}catch(e){}}
function onPos(pos){
  const c=pos.coords;
  if(c.accuracy>MIN_ACC){$('src').textContent=`Señal débil (±${Math.round(c.accuracy)} m), esperando…`;return}
  buf.push([c.longitude,c.latitude]);if(buf.length>4)buf.shift();
  const lng=buf.reduce((a,b)=>a+b[0],0)/buf.length, lat=buf.reduce((a,b)=>a+b[1],0)/buf.length;
  $('src').textContent='GPS en vivo';
  update(lng,lat,c.accuracy,false);
}
function startGPS(){
  if(!navigator.geolocation){$('src').textContent='Este navegador no tiene geolocalización';return}
  if(watchId!==null)navigator.geolocation.clearWatch(watchId);
  mode='gps';buf=[];$('src').textContent='Buscando señal GPS…';lock();
  watchId=navigator.geolocation.watchPosition(onPos,e=>{$('src').textContent='GPS no disponible: '+e.message},{enableHighAccuracy:true,maximumAge:1000,timeout:20000});
}
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'&&mode==='gps'){
    buf=[];lock();$('src').textContent='Actualizando posición…';
    navigator.geolocation.getCurrentPosition(onPos,()=>{},{enableHighAccuracy:true,timeout:15000});
  }
});
$('gps').onclick=startGPS;
$('sl').oninput=e=>{
  mode='sim';if(watchId!==null){navigator.geolocation.clearWatch(watchId);watchId=null}
  const p=turf.along(ruta,e.target.value/1000*total,U).geometry.coordinates;
  $('src').textContent='Simulación (no se guarda)';update(p[0],p[1],null,true);
};
$('reset').onclick=()=>{
  if(!confirm('¿Borrar el progreso guardado?'))return;
  S=fresh();save();render(null,null,0,null,true);
};

// ---------- Estado de red y Service Worker ----------
const net=()=>{$('net').textContent=navigator.onLine?'● En línea':'○ Sin conexión'};
addEventListener('online',net);addEventListener('offline',net);net();
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('sw.js').then(()=>navigator.serviceWorker.ready)
    .then(()=>{$('sw').textContent='✓ Disponible sin conexión'}).catch(()=>{$('sw').textContent='Modo sin conexión no disponible (requiere HTTPS)'});
}

// ---------- Arranque: mostrar progreso guardado y pedir GPS ----------
render(null,null,0,null,S.t>0);
$('src').textContent=S.t>0?`Progreso restaurado (${hhmm(S.t)})`:'Sin progreso guardado';
startGPS();
