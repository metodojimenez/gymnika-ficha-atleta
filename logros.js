/* Medallas y carnet del atleta (logros.js). Las medallas se calculan con los datos reales de asistencia, estiramiento y bitácora. */
const Logros = (function(){
"use strict";
/* ---------- Clases de metal (de la primera a la más alta) ---------- */
const CLASES = [
  { nombre:"Bronce",              a:"#F2C9A0", b:"#B07040", c:"#5E3418", luz:"#F8DEC4" },
  { nombre:"Plata",               a:"#FFFFFF", b:"#B4BCC5", c:"#5E6873", luz:"#FFFFFF" },
  { nombre:"Oro",                 a:"#FFF0B8", b:"#D9A21B", c:"#7E520C", luz:"#FFF4CF" },
  { nombre:"Oro esmaltado",       a:"#FFF0B8", b:"#D9A21B", c:"#7E520C", luz:"#FFF4CF", esmalte:true },
  { nombre:"Gran placa de plata", a:"#FFF0B8", b:"#D9A21B", c:"#7E520C", luz:"#FFF4CF", esmalte:true, placa:"plata" },
  { nombre:"Gran placa de oro",   a:"#FFF0B8", b:"#D9A21B", c:"#7E520C", luz:"#FFF4CF", esmalte:true, placa:"oro", gemas:true }
];
const PLACAS = { plata:["#FFFFFF","#AEB7C1","#58616C"], oro:["#FFF0B8","#E0AE36","#80540C"] };
const claseDe = (i, n) => n === 1 ? 2 : Math.round(i * 5 / (n - 1));

/* ---------- Emblemas del centro (caja de -20 a 20) ---------- */
const S = 'fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"';
const T = (t, y, fs) => `<text x="0" y="${y}" text-anchor="middle" font-family="Bricolage Grotesque, Arial Narrow, sans-serif" font-weight="800" font-size="${fs}" stroke="none">${t}</text>`;
const GLIFOS = {
  salida: `<path ${S} d="M-14 -16h14v32h-14z"/><path ${S} d="M4 0h15M13 -6l6 6-6 6"/>`,
  llegada:`<path ${S} d="M0 -16h14v32H0z"/><path ${S} d="M-19 0h15M-10 -6l6 6-6 6"/>`,
  racha:  `<path ${S} d="M0 -18C6 -8 14 -4 12 6C10 14 4 18 0 18C-4 18-10 14-12 6C-13-2-6-4-6-10C-2-7-1-10 0-18Z"/>`,
  semana: (n) => `<path ${S} d="M-15 -11h30v27h-30zM-15 -3h30M-8 -16v8M8 -16v8"/>${T(n, 13, 13)}`,
  deporte:`<path ${S} d="M-19 16L-5 -4L1 4L7 -2L19 16Z"/><path ${S} d="M-5 -4V-19L6 -15L-5 -11"/>`,
  pesa:   (t) => `${T(t, -6, 14)}<path ${S} d="M-15 4v10M-10 0v18M10 0v18M15 4v10M-10 9h20"/>`,
  cadena: `<path ${S} d="M-3 -6h-7a7 7 0 0 0 0 14h5"/><path ${S} d="M3 6h7a7 7 0 0 0 0-14h-5"/><path ${S} d="M-6 1h12"/>`,
  brote:  `<path ${S} d="M0 17V-1M-10 17h20"/><path ${S} d="M0 4C-2-7-10-9-16-7C-14-1-8 3 0 4Z"/><path ${S} d="M0 -1C2-12 10-16 16-14C14-6 8-2 0-1Z"/>`
};

/* ---------- Medallas: forma, cinta (mitad izquierda, se refleja) y esmalte ---------- */
const TER = "#A84A33", CREMA = "#F1E4D3", TURQ = "#0E7C86", HONDO = "#073F45", ORO = "#D9A21B", PIZ = "#334155", ARENA = "#C9B48A", VERDE = "#2F6B3E", BLANCO = "#FBF7F0";
const LOGROS = [
  { id:"salida", cat:"terapia", nombre:"Saliste en cero", como:"Terminas la sesión con 0 de dolor en tu zona maldita. No tienen que ser seguidas.",
    forma:"cruz", esmalte:TER, cinta:[[HONDO,5],[CREMA,3],[TER,14]], glifo:GLIFOS.salida,
    niveles:[1,3,5,10,20,50], etq:n => n === 1 ? "1 vez" : n + " veces", unidad:"veces" },
  { id:"llegada", cat:"terapia", nombre:"Llegaste en cero", como:"Llegas a la sesión con 0 de dolor en tu zona maldita. No tienen que ser seguidas.",
    forma:"estrella", esmalte:TURQ, cinta:[[TER,7],[CREMA,2],[TURQ,13]], glifo:GLIFOS.llegada,
    niveles:[1,3,5,10,20,50], etq:n => n === 1 ? "1 vez" : n + " veces", unidad:"veces" },
  { id:"racha", cat:"terapia", nombre:"Racha de estiramiento", como:"Días seguidos marcando «Sí, la hice» en tu rutina de estiramiento.",
    forma:"sol", esmalte:TER, cinta:[[ORO,4],[TER,6],[CREMA,2],[TER,10]], glifo:GLIFOS.racha,
    niveles:[5,14,30,60,90], etq:n => ({5:"5 días",14:"2 semanas",30:"1 mes",60:"2 meses",90:"3 meses"})[n], unidad:"días" },
  { id:"semana1", cat:"terapia", hito:true, nombre:"Primera semana sin dolor", como:"Tu coach lo marca en la bitácora: 7 días seguidos sin dolor.",
    forma:"laurel", esmalte:TURQ, cinta:[[TURQ,9],[BLANCO,4],[TURQ,9]], glifo:GLIFOS.semana(7),
    niveles:[1], etq:() => "7 días", unidad:"" },
  { id:"semana2", cat:"terapia", hito:true, nombre:"Dos semanas sin dolor", como:"Tu coach lo marca en la bitácora: 14 días seguidos sin dolor.",
    forma:"laurel", esmalte:TURQ, cinta:[[TURQ,6],[BLANCO,2],[TURQ,5],[BLANCO,2],[TURQ,7]], glifo:GLIFOS.semana(14),
    niveles:[1], etq:() => "14 días", unidad:"" },
  { id:"deporte", cat:"terapia", hito:true, nombre:"Volviste a tu deporte", como:"Tu coach lo marca en la bitácora: tu primera sesión de deporte sin dolor.",
    forma:"laurel", esmalte:HONDO, cinta:[[TER,4],[ORO,3],[HONDO,15]], glifo:GLIFOS.deporte,
    niveles:[1], etq:() => "1.ª sesión", unidad:"" },

  { id:"m12", cat:"fort", nombre:"Meses con 12 o más entrenamientos", como:"Meses con 12 clases o más en Gymnika. Se acumulan, no tienen que ser seguidos.",
    forma:"escudo", esmalte:PIZ, cinta:[[PIZ,9],[ARENA,4],[PIZ,9]], glifo:GLIFOS.pesa("12+"),
    niveles:[1,2,3,4,5,6], etq:n => n === 1 ? "1 mes" : n + " meses", unidad:"meses" },
  { id:"m20", cat:"fort", nombre:"Meses con 16 o más entrenamientos", como:"Meses con 16 clases o más en Gymnika (4 por semana). Se acumulan, no tienen que ser seguidos.",
    forma:"griega", esmalte:PIZ, cinta:[[PIZ,5],[ORO,3],[PIZ,4],[ORO,3],[PIZ,7]], glifo:GLIFOS.pesa("16+"),
    niveles:[1,2,3,4,5,6], etq:n => n === 1 ? "1 mes" : n + " meses", unidad:"meses" },
  { id:"seguidos", cat:"fort", nombre:"Meses seguidos entrenando", como:"Meses consecutivos con al menos 8 clases en Gymnika.",
    forma:"estrella8", esmalte:TURQ, cinta:[[TURQ,4],[PIZ,18]], glifo:GLIFOS.cadena,
    niveles:[3,6,9,12], etq:n => n + " meses", unidad:"meses" },
  { id:"constante", cat:"fort", nombre:"Estiraste constantemente", como:"Meses seguidos con 16 días o más de estiramiento. Si un mes no llega, la cuenta vuelve a empezar.",
    forma:"ovalo", esmalte:VERDE, cinta:[[VERDE,7],[CREMA,3],[PIZ,12]], glifo:GLIFOS.brote,
    niveles:[1,2,3,6,9,12], etq:n => n === 1 ? "1 mes" : n + " meses", unidad:"meses" }
];

/* ---------- Lo que dice la medalla al recibirla ---------- */
const veces = (n, una, varias) => n === 1 ? una : varias.replace("#", n);
const MENSAJES = {
  salida:   n => veces(n, "Terminaste tu primera sesión en cero dolor.", "Ya son # veces que saliste en cero dolor."),
  llegada:  n => veces(n, "Llegaste en cero dolor por primera vez.", "Ya son # veces que llegaste en cero dolor."),
  racha:    n => ({5:"5 días seguidos",14:"2 semanas seguidas",30:"1 mes seguido",60:"2 meses seguidos",90:"3 meses seguidos"})[n] + " haciendo tu rutina de estiramiento.",
  semana1:  () => "Tu primera semana completa sin dolor.",
  semana2:  () => "Dos semanas seguidas sin dolor.",
  deporte:  () => "Volviste a tu deporte sin dolor.",
  m12:      n => veces(n, "Tu primer mes con 12 o más entrenamientos en Gymnika.", "Ya son # meses con 12 o más entrenamientos en Gymnika."),
  m20:      n => veces(n, "Tu primer mes con 16 o más entrenamientos en Gymnika.", "Ya son # meses con 16 o más entrenamientos en Gymnika."),
  seguidos: n => `${n} meses seguidos entrenando en Gymnika.`,
  constante:n => veces(n, "Un mes completo estirando 16 días o más.", "# meses seguidos estirando 16 días o más.")
};

/* ---------- Geometría ---------- */
const CX = 60, CY = 112;
const p2 = (x, y) => x.toFixed(2) + " " + y.toFixed(2);
function estrella(cx, cy, puntas, r1, r2, giro = -Math.PI / 2){
  let d = "";
  for(let i = 0; i < puntas * 2; i++){ const r = i % 2 ? r2 : r1, a = Math.PI * i / puntas + giro; d += (i ? "L" : "M") + p2(cx + r * Math.cos(a), cy + r * Math.sin(a)); }
  return d + "Z";
}
function brazos(local){ // 4 brazos en cruz a partir de un brazo dibujado hacia la derecha
  return [0, 1, 2, 3].map(k => { const a = k * Math.PI / 2 - Math.PI / 2, c = Math.cos(a), s = Math.sin(a);
    return "M" + local.map(([x, y]) => p2(CX + x * c - y * s, CY + x * s + y * c)).join("L") + "Z"; }).join("");
}
const FORMAS = {
  cruz:     () => brazos([[6,-6],[42,-19],[34,0],[42,19],[6,6]]),
  griega:   () => brazos([[0,-11],[33,-11],[43,-18],[43,18],[33,11],[0,11]]),
  estrella: () => estrella(CX, CY, 5, 46, 19),
  sol:      () => estrella(CX, CY, 16, 45, 31),
  estrella8:() => estrella(CX, CY, 8, 45, 25),
  escudo:   () => `M${CX-34} ${CY-38}H${CX+34}V${CY-4}C${CX+34} ${CY+22} ${CX+16} ${CY+36} ${CX} ${CY+45}C${CX-16} ${CY+36} ${CX-34} ${CY+22} ${CX-34} ${CY-4}Z`,
  laurel:   () => `M${CX-36} ${CY}a36 36 0 1 0 72 0a36 36 0 1 0 -72 0Z`,
  ovalo:    () => `M${CX-31} ${CY}a31 40 0 1 0 62 0a31 40 0 1 0 -62 0Z`
};
function corona(r){ // rama de laurel a cada lado, abierta arriba
  let h = "";
  for(const lado of [-1, 1]) for(let j = 0; j < 9; j++){
    const ang = Math.PI / 2 + lado * (0.25 + j * 0.27), x = CX + r * Math.cos(ang), y = CY + r * Math.sin(ang);
    const rot = ang * 180 / Math.PI + (lado > 0 ? 70 : 110);
    h += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="6" ry="2.6" transform="rotate(${rot.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
  }
  return h;
}
function franjas(l, x0, w, y, h){
  const mitad = l.cinta, total = mitad.reduce((s, f) => s + f[1], 0) * 2, k = w / total;
  const todas = [...mitad, ...mitad.slice().reverse()];
  let x = x0, out = "";
  for(const [c, a] of todas){ out += `<rect x="${x.toFixed(2)}" y="${y}" width="${(a * k + .05).toFixed(2)}" height="${h}" fill="${c}"/>`; x += a * k; }
  return out;
}
function estrellasCinta(cant, cx, cy, r, color){
  if(!cant) return "";
  const sep = r * 2.3, x0 = cx - (cant - 1) * sep / 2;
  return Array.from({ length: cant }, (_, j) => `<path d="${estrella(x0 + j * sep, cy, 5, r, r * .42)}" fill="${color}" stroke="rgba(0,0,0,.35)" stroke-width=".4"/>`).join("");
}

/* ---------- Medalla completa: pasador, cinta, anilla y venera ---------- */
let serie = 0;
function medallaSVG(l, i, ganada, clase = ""){
  const n = l.niveles.length, ci = claseDe(i, n), m = CLASES[ci], k = ++serie, forma = FORMAS[l.forma]();
  const est = l.hito ? 0 : i;
  const metal = `url(#m${k})`;
  const placa = m.placa ? PLACAS[m.placa] : null;
  const cuerpo = `
    ${placa ? `<path d="${estrella(CX, CY, 24, 57, 41)}" fill="url(#p${k})" stroke="${placa[2]}" stroke-width=".8"/>
               <path d="${estrella(CX, CY, 8, 60, 30, -Math.PI / 2 + Math.PI / 8)}" fill="url(#p${k})" stroke="${placa[2]}" stroke-width=".8" opacity=".9"/>` : ""}
    ${l.forma === "laurel" ? `<g fill="${m.b}" stroke="${m.c}" stroke-width=".7">${corona(41)}</g>` : ""}
    <path d="${forma}" fill="${metal}" stroke="${m.c}" stroke-width="1.6" stroke-linejoin="round"/>
    ${m.esmalte ? `<path d="${forma}" transform="translate(${CX} ${CY}) scale(.8) translate(${-CX} ${-CY})" fill="${l.esmalte}" stroke="${m.a}" stroke-width="1.4" stroke-linejoin="round"/>` : `<path d="${forma}" transform="translate(${CX} ${CY}) scale(.84) translate(${-CX} ${-CY})" fill="none" stroke="${m.c}" stroke-opacity=".45" stroke-width="1"/>`}
    <circle cx="${CX}" cy="${CY}" r="19" fill="${metal}" stroke="${m.c}" stroke-width="1.2"/>
    <circle cx="${CX}" cy="${CY}" r="15.5" fill="${l.esmalte}" stroke="${m.a}" stroke-width="1"/>
    <g transform="translate(${CX} ${CY}) scale(.6)" stroke="${m.luz}" fill="${m.luz}">${l.glifo}</g>
    ${m.gemas ? [0, 1, 2, 3].map(j => { const a = j * Math.PI / 2 + Math.PI / 4; return `<circle cx="${(CX + 25 * Math.cos(a)).toFixed(1)}" cy="${(CY + 25 * Math.sin(a)).toFixed(1)}" r="2.6" fill="#FFFFFF" stroke="${m.c}" stroke-width=".6"/>`; }).join("") : ""}
    <g clip-path="url(#c${k})"><rect class="med-brillo" x="${CX - 60}" y="${CY - 60}" width="14" height="120" fill="#fff" opacity=".35" transform="rotate(25 ${CX} ${CY})"/></g>`;
  return `<svg class="${clase}" viewBox="0 0 120 180" role="img" aria-label="${l.nombre}, ${l.etq(l.niveles[i])}, ${m.nombre}${ganada ? "" : " (por ganar)"}">
    <defs>
      <linearGradient id="m${k}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${m.a}"/><stop offset=".45" stop-color="${m.b}"/><stop offset="1" stop-color="${m.c}"/></linearGradient>
      ${placa ? `<radialGradient id="p${k}" cx="40%" cy="35%" r="75%"><stop offset="0" stop-color="${placa[0]}"/><stop offset=".6" stop-color="${placa[1]}"/><stop offset="1" stop-color="${placa[2]}"/></radialGradient>` : ""}
      <linearGradient id="d${k}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".28"/><stop offset=".18" stop-color="#000" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".18"/><stop offset=".82" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></linearGradient>
      <clipPath id="c${k}"><path d="${forma}"/></clipPath>
      <filter id="g${k}"><feColorMatrix type="saturate" values="0"/></filter>
    </defs>
    <g ${ganada ? "" : `filter="url(#g${k})" opacity=".38"`}>
      <rect x="35" y="2" width="50" height="6" rx="1.5" fill="url(#m${k})" stroke="${m.c}" stroke-width=".8"/>
      ${franjas(l, 38, 44, 8, 42)}
      <rect x="38" y="8" width="44" height="42" fill="url(#d${k})"/>
      ${estrellasCinta(est, 60, 30, 3.6, "#F3D27A")}
      <rect x="35" y="49" width="50" height="5" rx="1.5" fill="url(#m${k})" stroke="${m.c}" stroke-width=".8"/>
      <circle cx="60" cy="60" r="4.5" fill="none" stroke="url(#m${k})" stroke-width="2.4"/>
      ${cuerpo}
    </g>
    ${ganada ? "" : `<g transform="translate(96 74)"><circle r="10" fill="#FFFDF9" stroke="rgba(53,41,47,.24)"/><path d="M-4 -1h8v7h-8zM-2.5 -1v-2.5a2.5 2.5 0 0 1 5 0V-1" fill="none" stroke="#8A8185" stroke-width="1.6" stroke-linejoin="round"/></g>`}
  </svg>`;
}
/* ---------- Cálculo con los datos reales (rpc logros_datos) ---------- */
const mesDe = (f) => f.slice(0, 7);
const mesSig = (m) => { const [y, mm] = m.split("-").map(Number); return mm === 12 ? `${y + 1}-01` : `${y}-${String(mm + 1).padStart(2, "0")}`; };
const diaSig = (f) => fechaISO(sumarDias(parseFecha(f), 1));
/* Meses que llegan a `minimo` fechas: [{ mes, fecha en que llegó }] */
function mesesCon(fechas, minimo){
  const por = {};
  fechas.forEach(f => { (por[mesDe(f)] = por[mesDe(f)] || []).push(f); });
  return Object.keys(por).sort().filter(m => por[m].length >= minimo).map(m => ({ mes: m, fecha: por[m].sort()[minimo - 1] }));
}
/* La racha más larga de elementos seguidos; `fechas[n]` = cuándo una racha llegó por primera vez a n */
function mejorRacha(items, clave, siguiente, fechaDe){
  let racha = 0, previo = null, mejor = 0, actual = 0;
  const fechas = {};
  items.forEach(it => {
    racha = previo !== null && siguiente(previo) === clave(it) ? racha + 1 : 1;
    previo = clave(it);
    if(racha > mejor){ mejor = racha; fechas[racha] = fechaDe(it); }
    actual = racha;
  });
  return { mejor, fechas, actual, ultimo: previo };
}
function calcularLogros(d){
  d = d || {};
  const salida = d.salida || [], llegada = d.llegada || [], clases = d.clases || [], estiro = d.estiro || [], hitos = d.hitos || [];
  const hoy = todayStr(), ayer = fechaISO(sumarDias(parseFecha(hoy), -1));
  const r = {};
  r.salida = { valor: salida.length, fecha: n => salida[n - 1] };
  r.llegada = { valor: llegada.length, fecha: n => llegada[n - 1] };
  const rd = mejorRacha(estiro, f => f, diaSig, f => f);
  r.racha = { valor: rd.mejor, fecha: n => rd.fechas[n], actual: rd.ultimo === hoy || rd.ultimo === ayer ? rd.actual : 0 };
  const m12 = mesesCon(clases, 12), m16 = mesesCon(clases, 16), m8 = mesesCon(clases, 8), e16 = mesesCon(estiro, 16);
  r.m12 = { valor: m12.length, fecha: n => (m12[n - 1] || {}).fecha };
  r.m20 = { valor: m16.length, fecha: n => (m16[n - 1] || {}).fecha };
  const rs = mejorRacha(m8, x => x.mes, mesSig, x => x.fecha);
  r.seguidos = { valor: rs.mejor, fecha: n => rs.fechas[n] };
  const rc = mejorRacha(e16, x => x.mes, mesSig, x => x.fecha);
  r.constante = { valor: rc.mejor, fecha: n => rc.fechas[n] };
  ["semana1", "semana2", "deporte"].forEach(t => { const h = hitos.find(x => x.tipo === t); r[t] = { valor: h ? 1 : 0, fecha: () => h && h.fecha }; });
  return LOGROS.map(l => {
    const x = r[l.id];
    return { ...l, valor: x.valor, actual: x.actual, fechas: l.niveles.map(n => x.valor >= n ? x.fecha(n) : null) };
  });
}
const ganadas = (l) => l.niveles.filter(n => l.valor >= n).length;
/* Qué medallas le tocan según su categoría (la racha de estiramiento es de todos) */
function logrosDe(cat, lista){
  return lista.filter(l => cat === "transicion" || !cat ? true : cat === "terapia" ? l.cat === "terapia" : (l.cat === "fort" || l.id === "racha"));
}
async function cargarLogros(uid){
  const { data, error } = await sb.rpc("logros_datos", { p_user: uid });
  if(error) throw error;
  return calcularLogros(typeof data === "string" ? JSON.parse(data) : data);
}

/* ---------- Confeti y serpentinas al recibir una medalla ---------- */
const COLORES_FIESTA = ["#0E7C86","#A84A33","#D9A21B","#F3D27A","#2F6B3E","#E08A70","#4FC0C8","#FBF7F0","#334155"];
let fiestaId = 0;
function fiesta(cv){
  if(matchMedia("(prefers-reduced-motion: reduce)").matches || !cv || !cv.getContext) return;
  const cx = cv.getContext("2d"), dpr = Math.min(2, devicePixelRatio || 1);
  const W = innerWidth, H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const azar = (a, b) => a + Math.random() * (b - a), color = () => COLORES_FIESTA[Math.floor(Math.random() * COLORES_FIESTA.length)];
  const lanzar = (lado, tipo) => ({ tipo, x: lado < 0 ? -10 : W + 10, y: H * azar(.55, .8), vx: -lado * azar(5, 13) * (W / 900 + .5), vy: -azar(11, 19) * (H / 900 + .3),
    rot: azar(0, 6.28), vr: azar(-.25, .25), w: azar(6, 10), h: azar(10, 16), c: color(), fase: azar(0, 6.28), rastro: [] });
  const ps = [];
  for(let j = 0; j < 90; j++) ps.push(lanzar(j % 2 ? 1 : -1, "papel"));
  for(let j = 0; j < 18; j++) ps.push(lanzar(j % 2 ? 1 : -1, "serpentina"));
  for(let j = 0; j < 50; j++) ps.push({ tipo:"papel", x: azar(0, W), y: azar(-H * .6, -10), vx: azar(-1, 1), vy: azar(1, 4), rot: azar(0, 6.28), vr: azar(-.2, .2), w: azar(6, 10), h: azar(10, 16), c: color(), fase: azar(0, 6.28), rastro: [] });
  const id = ++fiestaId, t0 = performance.now();
  let u = t0;
  (function cuadro(t){
    if(id !== fiestaId || !cv.isConnected) return;
    const dt = Math.min(2, (t - u) / 16.7 || 1); u = t;
    cx.clearRect(0, 0, W, H);
    let vivos = 0;
    for(const q of ps){
      q.vy += .32 * dt; q.vx *= Math.pow(.985, dt); q.vy *= Math.pow(.992, dt);
      if(q.tipo === "papel" && q.vy > 2.5) q.vy = 2.5 + (q.vy - 2.5) * .9;
      q.x += (q.vx + Math.sin(t / 300 + q.fase) * .6) * dt; q.y += q.vy * dt; q.rot += q.vr * dt;
      if(q.y < H + 60) vivos++;
      if(q.tipo === "papel"){
        cx.save(); cx.translate(q.x, q.y); cx.rotate(q.rot); cx.scale(1, Math.cos(t / 140 + q.fase));
        cx.fillStyle = q.c; cx.fillRect(-q.w / 2, -q.h / 2, q.w, q.h); cx.restore();
      }else{
        q.rastro.unshift([q.x, q.y]); if(q.rastro.length > 22) q.rastro.pop();
        cx.beginPath(); cx.lineWidth = 3.2; cx.lineCap = "round"; cx.strokeStyle = q.c;
        q.rastro.forEach(([x, y], j) => { const o = Math.sin(j * .7 + t / 90 + q.fase) * 6; if(j) cx.lineTo(x + o, y); else cx.moveTo(x + o, y); });
        cx.stroke();
      }
    }
    if(vivos && t - t0 < 6000) requestAnimationFrame(cuadro); else cx.clearRect(0, 0, W, H);
  })(t0);
}

/* ---------- Detalle de una medalla (y el momento de recibirla) ---------- */
function abrirMedalla(l, i, celebrar){
  document.querySelectorAll("dialog.medalla-dlg").forEach(x => x.remove());
  const n = l.niveles[i], ok = l.valor >= n, m = CLASES[claseDe(i, l.niveles.length)];
  const estado = celebrar ? `${m.nombre}. ¡Sigue así!`
    : ok ? `${l.fechas[i] ? `Recibida el ${fechaLargaMedalla(l.fechas[i])} · ` : ""}${m.nombre}`
    : l.hito ? "Aún no. Tu coach la marca en la bitácora cuando lo logres."
    : `Te faltan ${n - l.valor} ${l.unidad} · Llevas ${l.valor} de ${n}`;
  const dlg = document.createElement("dialog");
  dlg.className = "medalla-dlg";
  dlg.setAttribute("aria-labelledby", "medT");
  dlg.innerHTML = `
    <div class="med-det${celebrar ? " celebrar" : ""}">
      <div class="med-foco" aria-hidden="true"></div>
      ${celebrar ? `<span class="med-nuevo">Nueva medalla</span>` : ""}
      ${medallaSVG(l, i, ok, "grande")}
      <h2 id="medT">${esc(l.nombre)}</h2>
      <p>${esc(ok ? MENSAJES[l.id](n) : l.como)}</p>
      <p class="med-estado">${esc(estado)}</p>
      ${l.niveles.length > 1 ? `<div class="med-niveles" role="group" aria-label="Niveles de esta medalla">${l.niveles.map((nv, j) =>
        `<button type="button" data-nivel="${j}" class="${j === i ? "on" : ""}" aria-pressed="${j === i}" aria-label="${esc(l.etq(nv))}${l.valor >= nv ? "" : " (por ganar)"}">${medallaSVG(l, j, l.valor >= nv)}<span>${esc(l.etq(nv))}</span></button>`).join("")}</div>` : ""}
      <button type="button" class="btn-primary" data-med-ok autofocus>Listo</button>
    </div>
    <canvas class="med-fiesta" aria-hidden="true"></canvas>`;
  document.body.appendChild(dlg);
  const cerrar = ()=>{ fiestaId++; if(dlg.open) dlg.close(); dlg.remove(); };
  dlg.addEventListener("cancel", (e)=>{ e.preventDefault(); cerrar(); });
  dlg.addEventListener("click", (e)=>{ if(e.target === dlg) cerrar(); });
  dlg.querySelector("[data-med-ok]").onclick = cerrar;
  dlg.querySelectorAll("[data-nivel]").forEach(b => { b.onclick = ()=> abrirMedalla(l, Number(b.dataset.nivel), false); });
  try{ dlg.showModal(); } catch { dlg.setAttribute("open", ""); }
  if(celebrar) fiesta(dlg.querySelector(".med-fiesta"));
}
const fechaLargaMedalla = (f) => { const d = parseFecha(f); return d ? `${d.getDate()} de ${MESES_LARGOS[d.getMonth()]} de ${d.getFullYear()}` : f; };

/* Todas las medallas que puede ganar, con la que sigue de cada una */
function abrirMedallero(lista){
  const d = openDialog("Mis medallas", `
    <p class="muted" style="margin-top:0">Toca una medalla para ver cómo se gana y sus niveles.</p>
    <ul class="medallero">${lista.map((l, k) => {
      const g = ganadas(l), i = g ? g - 1 : 0, sig = l.niveles[g];
      return `<li><button type="button" data-med="${k}">${medallaSVG(l, i, g > 0)}
        <span class="ml-t">${esc(l.nombre)}</span>
        <span class="ml-s">${g ? esc(l.etq(l.niveles[i])) : "Por ganar"}${g && sig && !l.hito ? ` · siguiente: ${esc(l.etq(sig))}` : ""}</span></button></li>`;
    }).join("")}</ul>`);
  d.el.querySelectorAll("[data-med]").forEach(b => { b.onclick = ()=>{ const l = lista[Number(b.dataset.med)], g = ganadas(l); abrirMedalla(l, g ? g - 1 : 0, false); }; });
}

/* ---------- Carnet ---------- */
function aroCarnet(pct, color, num, sub){
  const c = 2 * Math.PI * 34;
  return `<svg viewBox="0 0 90 90" aria-hidden="true">
    <circle cx="45" cy="45" r="34" fill="none" stroke="rgba(53,41,47,.1)" stroke-width="9"/>
    <circle cx="45" cy="45" r="34" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${(c * Math.max(0, Math.min(1, pct))).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 45 45)"/>
    <text x="45" y="50" class="aro-num">${num}</text><text x="45" y="63" class="aro-sub">${sub}</text></svg>`;
}
function carnetHTML(profile){
  const cat = profile.categoria;
  const edad = calcEdad(profile.fecha_nacimiento);
  const desde = parseFecha(profile.fecha_inicio || (profile.created_at ? new Date(profile.created_at).toLocaleDateString("en-CA", { timeZone: "America/Lima" }) : ""));
  const sub = [edad !== null ? `<b>${edad} años</b>` : "", profile.deporte ? esc(profile.deporte) : "", desde ? `atleta desde ${MESES[desde.getMonth()]} ${desde.getFullYear()}` : ""].filter(Boolean).join(" · ");
  const conMedidores = cat === "fortalecimiento" || cat === "transicion";
  return `
    <section class="colgado" aria-label="Carnet de atleta">
      <div class="carnet-cinta" aria-hidden="true"></div><div class="carnet-gancho" aria-hidden="true"></div>
      <article class="carnet" id="carnet">
        <div class="carnet-top">
          <span class="carnet-ranura" aria-hidden="true"></span>
          <div class="carnet-marca"><b>GYMNIKA</b><span>Carnet de atleta</span></div>
          ${cat && CATEGORIAS[cat] ? `<span class="carnet-cat">${esc(CATEGORIAS[cat].nombre)}</span>` : ""}
        </div>
        <div class="carnet-foto" aria-hidden="true">${esc(initials(profile.nombre || ""))}</div>
        <div class="carnet-datos">
          <h2>${esc(profile.nombre || "Mi ficha")}</h2>
          ${sub ? `<p>${sub}</p>` : ""}
        </div>
        ${conMedidores ? `<div class="carnet-medidores">
          <div class="cm"><span class="t">Constancia</span><div id="cmConst"><div class="skel cm-skel"></div></div><span class="v" id="cmConstV"></span></div>
          <div class="cm"><span class="t">Asistencia del mes</span><div id="cmAsis"><div class="skel cm-skel"></div></div><span class="v" id="cmAsisV"></span></div>
          <div class="cm"><span class="t">Estirando en casa</span><div id="cmDisc"><div class="skel cm-skel"></div></div><span class="v" id="cmDiscV"></span></div>
        </div>` : ""}
        <div class="carnet-insignias"><span class="t">Mis medallas</span><div class="fila-m" id="carnetMedallas"><div class="skel cm-skel"></div></div>
          <button type="button" class="link-inline" id="carnetVerTodas" hidden>Ver todas las medallas</button></div>
        <div class="carnet-compartir" id="carnetCompartir" hidden><button type="button" class="btn-primary sm" id="btnCompartirCarnet">Compartir mi carnet del mes</button></div>
        <div class="carnet-pie">
          <div class="id" id="carnetPie">&nbsp;</div>
          <div class="carnet-barras" aria-hidden="true"></div>
        </div>
        <span class="carnet-brillo" aria-hidden="true"></span>
      </article>
    </section>`;
}
/* ---------- Carnet compartido y «Mejores fichas del mes» ----------
   Los últimos 6 días del mes el atleta comparte su carnet: a los demás les aparece una vez y entra al podio del mes.
   Los números los calcula la base (rpc compartir_carnet): puntos = asistencias del mes + días de estiramiento. */
/* Equipo (panel Hoy): podio y todas las fichas compartidas, con enlace a la ficha de cada atleta */
async function pintarMejoresCoach(box){
  if(!box) return;
  let r;
  try{ r = await cargarCarnetsMes(); }
  catch(e){ console.error(e); if(box.isConnected) box.innerHTML = `<p class="muted" style="margin:0">No pudimos cargar las fichas compartidas.</p>`; return; }
  if(!box.isConnected) return;
  const l = r.carnets || [];
  if(!l.length){ box.innerHTML = `<p class="muted" style="margin:0">Todavía nadie compartió su carnet. Los alumnos pueden compartirlo los últimos 6 días de cada mes.</p>`; return; }
  const item = (x, i) => `<li>${miniCarnetHTML(x, i < 3 ? i + 1 : 0)}<a class="link-inline mc-ver" href="#/atleta/${x.user_id}">Ver su ficha</a></li>`;
  box.innerHTML = `<p class="muted mejores-mes">Podio de ${esc(nombreMes(r.mes))}${r.actual ? "" : " (mes pasado)"} · puntos = asistencias + días de estiramiento</p>
    <ol class="podio">${l.slice(0, 3).map(item).join("")}</ol>
    ${l.length > 3 ? `<details class="records"><summary>Las demás fichas compartidas (${l.length - 3})</summary><ol class="podio" start="4" style="margin-top:12px">${l.slice(3).map((x, i) => item(x, i + 3)).join("")}</ol></details>` : ""}`;
}
function miniCarnetHTML(x, puesto){
  const meds = (Array.isArray(x.medallas) ? x.medallas : []).map(m => { const l = LOGROS.find(y => y.id === m.id); return l && l.niveles[m.i] !== undefined ? medallaSVG(l, m.i, true) : ""; }).join("");
  return `<article class="mini-carnet${puesto ? " p" + puesto : ""}">
    ${puesto ? `<span class="mc-puesto" aria-label="Puesto ${puesto}">${puesto}</span>` : ""}
    <div class="mc-top"><span class="mc-foto" aria-hidden="true">${esc(initials(x.nombre || ""))}</span>
      <div><strong>${esc(x.nombre || "Atleta")}</strong>${x.categoria && CATEGORIAS[x.categoria] ? `<span>${esc(CATEGORIAS[x.categoria].nombre)}</span>` : ""}</div></div>
    <dl class="mc-nums"><div><dt>Asistencias</dt><dd class="num">${x.asistencias}</dd></div><div><dt>Días estirando</dt><dd class="num">${x.estiro_dias}</dd></div><div><dt>Puntos</dt><dd class="num">${x.puntos}</dd></div></dl>
    ${meds ? `<div class="mc-meds" aria-label="Sus medallas">${meds}</div>` : ""}
  </article>`;
}
async function cargarCarnetsMes(){
  const { data, error } = await sb.rpc("carnets_del_mes");
  if(error) throw error;
  return typeof data === "string" ? JSON.parse(data) : (data || { carnets: [] });
}
function nombreMes(iso){ const d = parseFecha(iso); return d ? MESES_LARGOS[d.getMonth()] : ""; }
/* Podio: solo las 3 mejores fichas compartidas */
function pintarMejores(r){
  const box = document.getElementById("mejoresCard");
  if(!box) return;
  const top = (r.carnets || []).slice(0, 3);
  box.innerHTML = top.length
    ? `<p class="muted mejores-mes">Podio de ${esc(nombreMes(r.mes))}${r.actual ? "" : " (mes pasado)"} · puntos = asistencias + días de estiramiento</p>
       <ol class="podio">${top.map((x, i) => `<li>${miniCarnetHTML(x, i + 1)}</li>`).join("")}</ol>`
    : `<p class="muted" style="margin:0">Todavía nadie compartió su carnet. Los últimos 6 días de cada mes podrás compartir el tuyo y entrar al podio.</p>`;
}
/* A los demás les aparece una sola vez cada carnet compartido este mes */
function mostrarCarnetsNuevos(r, uid){
  if(!r.actual) return;
  const clave = "gymCarnetsVistos:" + uid;
  let vistos = [];
  try{ vistos = JSON.parse(localStorage.getItem(clave) || "[]") || []; } catch { vistos = []; }
  const nuevos = (r.carnets || []).filter(x => x.user_id !== uid && !vistos.includes(x.id));
  if(!nuevos.length) return;
  let intentos = 0;
  const abrir = ()=>{
    if(document.querySelector("dialog[open], .overlay")){ if(++intentos < 20) setTimeout(abrir, 1500); return; }
    try{ localStorage.setItem(clave, JSON.stringify([...vistos, ...nuevos.map(x => x.id)].slice(-300))); } catch { /* sin almacenamiento */ }
    let k = 0;
    const d = openDialog("Carnet compartido", `<div id="carnetNuevo"></div>`);
    const pintar = ()=>{
      const x = nuevos[k], quedan = nuevos.length - k - 1;
      d.el.querySelector("#carnetNuevo").innerHTML = `
        <p style="margin-top:0"><strong>${esc(primerNombre(x.nombre) || "Un atleta")}</strong> compartió cómo le fue en ${esc(nombreMes(r.mes))}.</p>
        ${miniCarnetHTML(x, 0)}
        <div class="sheet-actions"><button type="button" class="btn-primary" data-sig>${quedan ? `Siguiente (${quedan} más)` : "Listo"}</button></div>`;
      d.el.querySelector("[data-sig]").onclick = ()=>{ if(quedan){ k++; pintar(); } else d.close(); };
    };
    pintar();
  };
  abrir();
}
function confirmarCompartir(profile, mias, yaCompartido){
  const d = openDialog(yaCompartido ? "Actualizar mi carnet compartido" : "Compartir mi carnet", `
    <p style="margin-top:0">Los demás atletas de Gymnika verán una vez tu carnet de este mes: <strong>tu nombre, tu categoría, tus asistencias, tus días de estiramiento y tus medallas</strong>. También entras al podio de «Mejores fichas del mes».</p>
    <div id="compMsg" aria-live="polite"></div>
    <div class="sheet-actions"><button type="button" class="btn-outline" data-no>Ahora no</button><button type="button" class="btn-primary" data-si>${yaCompartido ? "Actualizar" : "Compartir"}</button></div>`);
  d.el.querySelector("[data-no]").onclick = d.close;
  const b = d.el.querySelector("[data-si]");
  b.onclick = ()=> withBusy(b, "Compartiendo…", async ()=>{
    const { error } = await sb.rpc("compartir_carnet", { p_medallas: mias.map(l => ({ id: l.id, i: ganadas(l) - 1 })) });
    if(error){ showError(d.el.querySelector("#compMsg"), error); return; }
    d.close();
    const bc = document.getElementById("btnCompartirCarnet"); if(bc) bc.textContent = "Actualizar mi carnet compartido";
    try{ const r = await cargarCarnetsMes(); pintarMejores(r); compartidoYa = !!r.yo; } catch(e){ console.error(e); }
  });
}
let compartidoYa = false;

/* Rueda «Estirando en casa» del carnet (se vuelve a pintar cuando marca su rutina) */
function pintarDiscCarnet(d){
  const a = document.getElementById("cmDisc"), v = document.getElementById("cmDiscV");
  if(!a || !d) return;
  a.innerHTML = aroCarnet((d.pct || 0) / 100, "#0E7C86", d.pct === null ? "–" : d.pct + "%", "DEL MES");
  if(v) v.textContent = d.total > 0 ? `${plural(d.dias, "día", "días")} de ${d.total}` : "Empieza hoy";
}
/* Rellena el carnet cuando ya cargó el plan: ruedas, medallas y pie. Si hay una medalla nueva, la celebra una vez. */
async function pintarCarnet(profile, plan){
  const box = document.getElementById("carnet");
  if(!box) return;
  const cat = profile.categoria, uid = profile.id;
  const el = (id)=> document.getElementById(id);
  /* Pie: hasta cuándo tiene acceso o cuántas sesiones le quedan */
  const pie = el("carnetPie");
  if(pie && plan){
    if(cat === "terapia") pie.innerHTML = `Sesiones disponibles: <b>${Math.max(0, Number(plan.saldo) || 0)}</b>`;
    else { const est = estadoMembresia(plan); pie.innerHTML = est.vigente ? `Acceso hasta <b>${fmtFecha(est.finTotal || est.vigente.fin, true)}</b>` : "Sin acceso vigente"; }
  }
  /* Ruedas (fortalecimiento y transición) */
  if(el("cmConst")){
    const n = nivelMedidor(plan && plan.asistencias);
    el("cmConst").innerHTML = `<button type="button" class="cm-btn" data-rueda aria-label="Ver qué significa la rueda de constancia">${ruedaSVG(n, 86)}</button>`;
    el("cmConstV").textContent = !n ? "Escanea el QR al llegar" : n.horas < 24 ? "Entrenaste hoy" : `Hace ${plural(Math.floor(n.horas / 24), "día", "días")}`;
    el("cmConst").querySelector("[data-rueda]").onclick = ()=> abrirRueda(plan && plan.asistencias);
    clasesDelMes(uid).then(c => {
      if(!el("cmAsis")) return;
      const z = zonaBateria(c), color = { b1: "#D8432F", b2: "#E0A21B", b3: "#8DB33A", b4: "#2E7D4F" }[z.cls] || "#0E7C86";
      el("cmAsis").innerHTML = aroCarnet(c / BATERIA_TOPE, color, c, c === 1 ? "CLASE" : "CLASES");
      el("cmAsisV").textContent = z.corto || z.titulo;
    }, ()=>{ if(el("cmAsis")) el("cmAsis").innerHTML = aroCarnet(0, "#0E7C86", "–", "CLASES"); });
    datosDisciplina(uid).then(pintarDiscCarnet, ()=>{});
  }
  /* Medallas: solo la más alta de cada logro */
  const fila = el("carnetMedallas");
  let lista;
  try{ lista = logrosDe(cat, await cargarLogros(uid)); }
  catch(e){ console.error(e); if(fila && fila.isConnected) fila.innerHTML = `<p class="muted carnet-vacio">No pudimos cargar tus medallas.</p>`; return; }
  if(!fila || !fila.isConnected) return;
  const mias = lista.filter(l => ganadas(l));
  fila.innerHTML = mias.length
    ? mias.map(l => `<button type="button" class="cm-medalla" data-logro="${l.id}" aria-label="${esc(l.nombre)}: ${esc(l.etq(l.niveles[ganadas(l) - 1]))}. Ver detalle">${medallaSVG(l, ganadas(l) - 1, true)}</button>`).join("")
    : `<p class="muted carnet-vacio">Todavía no tienes medallas. La primera está cerca.</p>`;
  fila.querySelectorAll("[data-logro]").forEach(b => { b.onclick = ()=>{ const l = lista.find(x => x.id === b.dataset.logro); abrirMedalla(l, ganadas(l) - 1, false); }; });
  const propio = !!state.profile && uid === state.profile.id && !esEquipo();
  const conPodio = cat === "fortalecimiento" || cat === "transicion";   // terapia no comparte ni tiene podio
  const vt = el("carnetVerTodas");
  if(vt){ vt.hidden = false; vt.onclick = ()=> abrirMedallero(lista); }
  /* Los últimos 6 días del mes puede compartir cómo le fue */
  const hoyD = parseFecha(todayStr()), finMes = new Date(hoyD.getFullYear(), hoyD.getMonth() + 1, 0).getDate();
  const cc = el("carnetCompartir");
  if(cc && conPodio && hoyD.getDate() > finMes - 6){
    cc.hidden = false;
    const bc = el("btnCompartirCarnet");
    bc.onclick = ()=> confirmarCompartir(profile, mias, compartidoYa);
  }
  if(!propio && cc) cc.hidden = true;
  if(conPodio) try{
    const r = await cargarCarnetsMes();
    compartidoYa = !!r.yo;
    if(compartidoYa && el("btnCompartirCarnet")) el("btnCompartirCarnet").textContent = "Actualizar mi carnet compartido";
    pintarMejores(r);
    if(propio) mostrarCarnetsNuevos(r, uid);
  } catch(e){ console.error(e); const mb = el("mejoresCard"); if(mb) mb.innerHTML = `<p class="muted" style="margin:0">No pudimos cargar las mejores fichas.</p>`; }
  /* Medalla nueva: se celebra una vez (la primera vez que abre el carnet solo se toma nota de las que ya tenía) */
  if(!propio) return;
  const clave = "gymMedallas:" + uid;
  const tengo = lista.flatMap(l => l.niveles.map((n, i) => l.valor >= n ? `${l.id}:${i}` : null).filter(Boolean));
  let vistas = null;
  try{ vistas = JSON.parse(localStorage.getItem(clave) || "null"); } catch { vistas = null; }
  const guardar = ()=>{ try{ localStorage.setItem(clave, JSON.stringify(tengo)); } catch { /* sin almacenamiento */ } };
  if(!Array.isArray(vistas)){ guardar(); return; }
  const nuevas = tengo.filter(k => !vistas.includes(k));
  if(!nuevas.length) return;
  /* Si hay otra ventana abierta (un aviso de MarianI.A., por ejemplo), espera a que se cierre; si no, se celebra la próxima vez */
  let intentos = 0;
  const celebrar = ()=>{
    if(!box.isConnected) return;
    if(document.querySelector("dialog[open], .overlay")){ if(++intentos < 20) setTimeout(celebrar, 1500); return; }
    guardar();
    const [id, i] = nuevas[nuevas.length - 1].split(":");
    abrirMedalla(lista.find(l => l.id === id), Number(i), true);
  };
  celebrar();
}

/* ---------- Bitácora: el coach marca los hitos sin dolor ---------- */
const HITOS = LOGROS.filter(l => l.hito);
async function pintarHitosCoach(box, atletaId){
  if(!box) return;
  const { data, error } = await sb.from("hitos_sin_dolor").select("tipo, fecha").eq("user_id", atletaId);
  if(!box.isConnected) return;
  if(error){ box.innerHTML = ""; return; }
  const tiene = (t)=> (data || []).find(x => x.tipo === t);
  box.innerHTML = `<span class="hitos-t">Hitos sin dolor:</span>${HITOS.map(l => { const h = tiene(l.id);
    return `<button type="button" class="hito-chip${h ? " on" : ""}" data-hito="${l.id}" aria-pressed="${!!h}" title="${esc(l.como)}">${h ? "🏅 " : ""}${esc(l.nombre)}${h ? ` · ${fmtFecha(h.fecha)}` : ""}</button>`; }).join("")}
    <span class="hitos-msg" aria-live="polite"></span>`;
  box.querySelectorAll("[data-hito]").forEach(b => { b.onclick = ()=> withBusy(b, "…", async ()=>{
    const l = HITOS.find(x => x.id === b.dataset.hito), ya = tiene(l.id);
    if(ya && !confirm(`¿Quitar la medalla «${l.nombre}»?`)) return;
    if(!ya && !confirm(`¿Marcar «${l.nombre}»? El atleta recibirá esta medalla en su carnet.`)) return;
    const r = ya ? await sb.from("hitos_sin_dolor").delete().eq("user_id", atletaId).eq("tipo", l.id)
                 : await sb.from("hitos_sin_dolor").insert({ user_id: atletaId, tipo: l.id, marcado_por: state.profile.id });
    if(r.error){ showError(box.querySelector(".hitos-msg"), r.error); return; }
    pintarHitosCoach(box, atletaId);
  }); });
}

return { pintarMejoresCoach, carnetHTML, pintarCarnet, pintarDiscCarnet, pintarHitosCoach, calcularLogros, abrirMedalla, medallaSVG };
})();
function carnetHTML(profile){ return Logros.carnetHTML(profile); }
function pintarMejoresCoach(box){ return Logros.pintarMejoresCoach(box); }
function pintarCarnet(profile, plan){ return Logros.pintarCarnet(profile, plan); }
function pintarDiscCarnet(d){ return Logros.pintarDiscCarnet(d); }
function pintarHitosCoach(box, atletaId){ return Logros.pintarHitosCoach(box, atletaId); }
