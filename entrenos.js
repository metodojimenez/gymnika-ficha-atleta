/* ====================== ENTRENAMIENTO FUERA DE GYMNIKA ======================
   El alumno sube el archivo de su reloj (.FIT, .GPX, .TCX o el .zip de Garmin) o lo anota a mano.
   El archivo se lee en el mismo teléfono (sin servicios externos) y el original se guarda en el bucket «entrenamientos».
   El coach lo ve en la ficha y en la Bitácora. */

const DEPORTES = {
  correr:    { n: "Correr",     ico: "🏃", dist: "km" },
  bicicleta: { n: "Bicicleta",  ico: "🚴", dist: "km" },
  nadar:     { n: "Nadar",      ico: "🏊", dist: "m" },
  boxeo:     { n: "Boxeo",      ico: "🥊" },
  surf:      { n: "Surf",       ico: "🏄" },
  jiujitsu:  { n: "Jiu-jitsu",  ico: "🥋" },
  golf:      { n: "Golf",       ico: "⛳" },
  tenis:     { n: "Tenis",      ico: "🎾" },
  futbol:    { n: "Fútbol",     ico: "⚽" },
  yoga:      { n: "Yoga",       ico: "🧘" },
  otro:      { n: "Otro",       ico: "🏅" }
};
/* Datos propios de cada deporte (se guardan en «detalles») */
const DETALLES_DEPORTE = {
  nadar:    [{ k: "lugar", t: "¿Dónde?", ops: ["Piscina", "Mar"] }],
  boxeo:    [{ k: "tipo", t: "Tipo", ops: ["Saco", "Manoplas", "Sparring", "Técnica"] }, { k: "rounds", t: "Rounds", num: true }],
  surf:     [{ k: "playa", t: "Playa", txt: true }, { k: "tamano", t: "Tamaño", ops: ["Flat", "Chico", "Mediano", "Grande", "Pasado"] },
             { k: "periodo", t: "Periodo (segundos)", num: true }, { k: "viento", t: "Viento", ops: ["Nada", "Poco", "Normal", "Ventoso"] },
             { k: "tabla", t: "Tipo de tabla", ops: ["Corta", "Longboard", "Bodyboard"] }],
  jiujitsu: [{ k: "tipo", t: "Tipo", ops: ["Técnica", "Rolls", "Competencia"] }, { k: "rolls", t: "Número de rolls", num: true }, { k: "modalidad", t: "Modalidad", ops: ["Gi", "No-gi"] }],
  golf:     [{ k: "hoyos", t: "Hoyos", ops: ["9", "18"] }, { k: "golpes", t: "Golpes", num: true }, { k: "modo", t: "¿Cómo?", ops: ["Caminando", "En carrito"] }]
};
const conDistancia = (d)=> !!(DEPORTES[d] && DEPORTES[d].dist);
const conDesnivel = (d)=> d === "correr" || d === "bicicleta";
const numExt = (n, dec = 2)=> new Intl.NumberFormat("es-PE", { maximumFractionDigits: dec }).format(n);

/* ---------- Lectura de archivos del reloj ---------- */
const FIT_EPOCH = 631065600; /* 31/12/1989 en segundos Unix */
const FIT_DEPORTE = { 1: "correr", 2: "bicicleta", 5: "nadar", 7: "futbol", 8: "tenis", 25: "golf", 38: "surf", 47: "boxeo" };
function deporteDeTexto(t){
  const s = String(t || "").toLowerCase();
  if(/run|correr|trail/.test(s)) return "correr";
  if(/bik|cycl|ride|bici/.test(s)) return "bicicleta";
  if(/swim|nata|nadar/.test(s)) return "nadar";
  if(/surf/.test(s)) return "surf";
  if(/box/.test(s)) return "boxeo";
  if(/tennis|tenis/.test(s)) return "tenis";
  if(/soccer|football|futbol|fútbol/.test(s)) return "futbol";
  if(/golf/.test(s)) return "golf";
  if(/yoga/.test(s)) return "yoga";
  if(/jiu|bjj|grappl/.test(s)) return "jiujitsu";
  return null;
}
function reducirSerie(vals, max = 120){
  const v = vals.filter(x => x > 0);
  if(v.length <= max) return v;
  const paso = v.length / max, out = [];
  for(let i = 0; i < max; i++){
    const tramo = v.slice(Math.floor(i * paso), Math.floor((i + 1) * paso));
    out.push(Math.round(tramo.reduce((a, b) => a + b, 0) / tramo.length));
  }
  return out;
}
function resumenDeSerie(r){
  const hr = r.hr.filter(x => x > 0);
  if(hr.length){
    if(!r.fc_media) r.fc_media = Math.round(hr.reduce((a, b) => a + b, 0) / hr.length);
    if(!r.fc_max) r.fc_max = Math.max(...hr);
  }
  r.serie_fc = hr.length ? reducirSerie(hr) : null;
  delete r.hr;
  return r;
}
function desdeInicio(r, inicio){
  if(!inicio || isNaN(inicio)) return;
  const d = new Date(inicio);
  r.fecha = d.toLocaleDateString("en-CA", { timeZone: "America/Lima" });
  r.hora = d.toLocaleTimeString("en-GB", { timeZone: "America/Lima", hour: "2-digit", minute: "2-digit" });
}

/* FIT: se leen los mensajes de sesión (resumen) y de registro (pulso segundo a segundo) */
function leerFIT(buf){
  const dv = new DataView(buf);
  const hlen = dv.getUint8(0);
  if(buf.byteLength < 14 || String.fromCharCode(dv.getUint8(8), dv.getUint8(9), dv.getUint8(10), dv.getUint8(11)) !== ".FIT") throw new Error("noFIT");
  const fin = Math.min(buf.byteLength, hlen + dv.getUint32(4, true));
  const defs = {};
  let p = hlen, sesion = null, deporte = null;
  const hr = [], tiempos = [], dist = [];
  const TAM = { 0: 1, 1: 1, 2: 1, 3: 2, 4: 2, 5: 4, 6: 4, 7: 1, 8: 4, 9: 8, 10: 1, 11: 2, 12: 4, 13: 1, 14: 8, 15: 8, 16: 8 };
  const leer = (o, tipo, size, le)=>{
    const b = tipo & 0x1F;
    if(TAM[b] !== size) return null;
    switch(b){
      case 0: case 2: case 10: case 13: { const v = dv.getUint8(o); return v === 0xFF || (b === 10 && v === 0) ? null : v; }
      case 1: { const v = dv.getInt8(o); return v === 0x7F ? null : v; }
      case 3: { const v = dv.getInt16(o, le); return v === 0x7FFF ? null : v; }
      case 4: case 11: { const v = dv.getUint16(o, le); return v === 0xFFFF || (b === 11 && v === 0) ? null : v; }
      case 5: { const v = dv.getInt32(o, le); return v === 0x7FFFFFFF ? null : v; }
      case 6: case 12: { const v = dv.getUint32(o, le); return v === 0xFFFFFFFF || (b === 12 && v === 0) ? null : v; }
      case 8: { const v = dv.getFloat32(o, le); return isFinite(v) ? v : null; }
      default: return null;
    }
  };
  while(p < fin){
    const h = dv.getUint8(p); p++;
    if(!(h & 0x80) && (h & 0x40)){
      const local = h & 0x0F, dev = h & 0x20;
      const le = dv.getUint8(p + 1) === 0;
      const global = dv.getUint16(p + 2, le);
      const n = dv.getUint8(p + 4);
      p += 5;
      const campos = [];
      for(let i = 0; i < n; i++){ campos.push([dv.getUint8(p), dv.getUint8(p + 1), dv.getUint8(p + 2)]); p += 3; }
      let extra = 0;
      if(dev){ const nd = dv.getUint8(p); p++; for(let i = 0; i < nd; i++){ extra += dv.getUint8(p + 1); p += 3; } }
      defs[local] = { global, le, campos, extra };
      continue;
    }
    const local = (h & 0x80) ? (h >> 5) & 0x03 : h & 0x0F;
    const def = defs[local];
    if(!def) throw new Error("FIT");
    const v = {};
    for(const [num, size, tipo] of def.campos){ v[num] = leer(p, tipo, size, def.le); p += size; }
    p += def.extra;
    if(def.global === 18 && !sesion) sesion = v;
    else if(def.global === 12 && deporte === null) deporte = v;
    else if(def.global === 20){
      if(v[3] != null) hr.push(v[3]);
      if(v[253] != null) tiempos.push(v[253]);
      if(v[5] != null) dist.push(v[5]);
    }
  }
  const r = { hr };
  const sport = sesion ? sesion[5] : deporte ? deporte[0] : null;
  const sub = sesion ? sesion[6] : deporte ? deporte[1] : null;
  r.deporte = sub === 43 ? "yoga" : FIT_DEPORTE[sport] || null;
  if(sesion){
    desdeInicio(r, sesion[2] != null ? (sesion[2] + FIT_EPOCH) * 1000 : tiempos[0] != null ? (tiempos[0] + FIT_EPOCH) * 1000 : null);
    const t = sesion[8] != null ? sesion[8] : sesion[7];
    r.duracion_seg = t != null ? Math.round(t / 1000) : null;
    r.distancia_m = sesion[9] != null ? Math.round(sesion[9] / 100) : null;
    r.calorias = sesion[11];
    r.fc_media = sesion[16]; r.fc_max = sesion[17];
    r.desnivel_m = sesion[22];
  } else {
    desdeInicio(r, tiempos[0] != null ? (tiempos[0] + FIT_EPOCH) * 1000 : null);
    r.duracion_seg = tiempos.length > 1 ? tiempos[tiempos.length - 1] - tiempos[0] : null;
    r.distancia_m = dist.length ? Math.round(dist[dist.length - 1] / 100) : null;
  }
  return resumenDeSerie(r);
}
function distanciaGeo(a, b){
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
function subida(eles){
  let s = 0;
  for(let i = 1; i < eles.length; i++){ const d = eles[i] - eles[i - 1]; if(d > 0.5) s += d; }
  return eles.length > 1 ? Math.round(s) : null;
}
const hijo = (el, nombre)=> [...el.children].find(c => c.localName === nombre);
const hijos = (el, nombre)=> [...el.getElementsByTagName("*")].filter(c => c.localName === nombre);
function leerGPX(texto){
  const doc = new DOMParser().parseFromString(texto, "application/xml");
  const pts = hijos(doc, "trkpt").map(p => ({
    lat: parseFloat(p.getAttribute("lat")), lon: parseFloat(p.getAttribute("lon")),
    ele: hijo(p, "ele") ? parseFloat(hijo(p, "ele").textContent) : null,
    t: hijo(p, "time") ? Date.parse(hijo(p, "time").textContent) : null,
    hr: (hijos(p, "hr")[0] || {}).textContent
  }));
  if(!pts.length) throw new Error("GPX");
  const r = { hr: pts.map(p => parseInt(p.hr, 10) || 0) };
  const tipo = hijos(doc, "type")[0];
  r.deporte = tipo ? deporteDeTexto(tipo.textContent) : null;
  let d = 0;
  for(let i = 1; i < pts.length; i++) if(!isNaN(pts[i].lat) && !isNaN(pts[i - 1].lat)) d += distanciaGeo(pts[i - 1], pts[i]);
  r.distancia_m = d ? Math.round(d) : null;
  const ts = pts.map(p => p.t).filter(Boolean);
  desdeInicio(r, ts[0] || Date.parse((hijos(doc, "time")[0] || {}).textContent));
  r.duracion_seg = ts.length > 1 ? Math.round((ts[ts.length - 1] - ts[0]) / 1000) : null;
  r.desnivel_m = subida(pts.map(p => p.ele).filter(x => x !== null && !isNaN(x)));
  return resumenDeSerie(r);
}
function leerTCX(texto){
  const doc = new DOMParser().parseFromString(texto, "application/xml");
  const act = hijos(doc, "Activity")[0];
  if(!act) throw new Error("TCX");
  const laps = hijos(act, "Lap");
  const num = (el, n)=>{ const x = el && hijos(el, n)[0]; return x ? parseFloat(x.textContent) : null; };
  const r = { deporte: deporteDeTexto(act.getAttribute("Sport")) };
  desdeInicio(r, Date.parse((hijos(act, "Id")[0] || {}).textContent || (laps[0] && laps[0].getAttribute("StartTime"))));
  let t = 0, dist = 0, cal = 0, fcPond = 0, fcMax = 0;
  laps.forEach(l => {
    const tl = num(l, "TotalTimeSeconds") || 0;
    t += tl; dist += num(l, "DistanceMeters") || 0; cal += num(l, "Calories") || 0;
    const avg = hijos(l, "AverageHeartRateBpm")[0], mx = hijos(l, "MaximumHeartRateBpm")[0];
    if(avg) fcPond += (num(avg, "Value") || 0) * tl;
    if(mx) fcMax = Math.max(fcMax, num(mx, "Value") || 0);
  });
  r.duracion_seg = t ? Math.round(t) : null;
  r.distancia_m = dist ? Math.round(dist) : null;
  r.calorias = cal ? Math.round(cal) : null;
  r.fc_media = fcPond && t ? Math.round(fcPond / t) : null;
  r.fc_max = fcMax || null;
  const tps = hijos(act, "Trackpoint");
  r.hr = tps.map(tp => { const h = hijos(tp, "HeartRateBpm")[0]; return h ? num(h, "Value") || 0 : 0; });
  r.desnivel_m = subida(tps.map(tp => num(tp, "AltitudeMeters")).filter(x => x !== null));
  return resumenDeSerie(r);
}
/* .zip de Garmin («Exportar original»): se saca el primer .fit/.gpx/.tcx que traiga */
async function abrirZip(buf){
  const dv = new DataView(buf);
  let p = 0;
  while(p + 30 <= buf.byteLength && dv.getUint32(p, true) === 0x04034b50){
    const metodo = dv.getUint16(p + 8, true), comp = dv.getUint32(p + 18, true);
    const nlen = dv.getUint16(p + 26, true), xlen = dv.getUint16(p + 28, true);
    const nombre = new TextDecoder().decode(new Uint8Array(buf, p + 30, nlen));
    const ini = p + 30 + nlen + xlen;
    if(/\.(fit|gpx|tcx)$/i.test(nombre) && comp){
      const datos = buf.slice(ini, ini + comp);
      if(metodo === 0) return { nombre, buf: datos };
      if(metodo === 8 && "DecompressionStream" in window){
        const st = new Blob([datos]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
        return { nombre, buf: await new Response(st).arrayBuffer() };
      }
      throw new Error("zip");
    }
    p = ini + comp;
  }
  throw new Error("zipVacio");
}
async function leerArchivoEntreno(file){
  let nombre = file.name || "", buf = await file.arrayBuffer();
  if(/\.zip$/i.test(nombre) || new DataView(buf).getUint32(0, true) === 0x04034b50){ ({ nombre, buf } = await abrirZip(buf)); }
  const inicio = new TextDecoder().decode(new Uint8Array(buf, 0, Math.min(400, buf.byteLength)));
  if(/\.fit$/i.test(nombre) || inicio.slice(8, 12) === ".FIT") return leerFIT(buf);
  const texto = new TextDecoder().decode(buf);
  if(/<gpx[\s>]/i.test(texto)) return leerGPX(texto);
  if(/<TrainingCenterDatabase/i.test(texto)) return leerTCX(texto);
  throw new Error("formato");
}

/* ---------- Formatos ---------- */
function fmtDuracion(s){
  if(s == null) return "";
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = Math.round(s % 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}` : `${m}:${String(x).padStart(2, "0")}`;
}
function fmtDistancia(d, deporte){
  if(d == null) return "";
  return deporte === "nadar" ? `${numExt(Math.round(d), 0)} m` : `${numExt(d / 1000, 2)} km`;
}
function ritmoTexto(e){
  if(!e.distancia_m || !e.duracion_seg) return "";
  if(e.deporte === "bicicleta") return `${numExt(e.distancia_m / 1000 / (e.duracion_seg / 3600), 1)} km/h`;
  if(e.deporte === "nadar") return `${fmtDuracion(e.duracion_seg / (e.distancia_m / 100))} /100 m`;
  if(e.deporte === "correr") return `${fmtDuracion(e.duracion_seg / (e.distancia_m / 1000))} /km`;
  return "";
}
const nombreDeporte = (e)=> e.deporte === "otro" && e.deporte_otro ? e.deporte_otro : (DEPORTES[e.deporte] || DEPORTES.otro).n;
function lineaMetricas(e){
  const fc = e.fc_media ? `FC ${e.fc_media}${e.fc_max ? "/" + e.fc_max : ""}` : "";
  return [fmtDistancia(e.distancia_m, e.deporte), fmtDuracion(e.duracion_seg), ritmoTexto(e), fc,
    e.desnivel_m ? `+${e.desnivel_m} m` : "", e.calorias ? `${e.calorias} kcal` : ""].filter(Boolean).join(" · ");
}
function lineaDetalles(e){
  const d = e.detalles || {}, campos = DETALLES_DEPORTE[e.deporte] || [];
  return campos.filter(c => d[c.k] !== undefined && d[c.k] !== null && d[c.k] !== "").map(c => {
    if(c.k === "periodo") return `${d[c.k]} s de periodo`;
    if(c.k === "rounds") return `${d[c.k]} rounds`;
    if(c.k === "rolls") return `${d[c.k]} rolls`;
    if(c.k === "golpes") return `${d[c.k]} golpes`;
    if(c.k === "hoyos") return `${d[c.k]} hoyos`;
    if(c.k === "tamano") return `Tamaño ${String(d[c.k]).toLowerCase()}`;
    if(c.k === "viento") return `Viento ${String(d[c.k]).toLowerCase()}`;
    if(c.k === "tabla") return `Tabla ${String(d[c.k]).toLowerCase()}`;
    return String(d[c.k]);
  }).join(" · ");
}
function curvaFC(serie){
  if(!serie || serie.length < 3) return "";
  const min = Math.min(...serie), max = Math.max(...serie), rango = Math.max(1, max - min);
  const pts = serie.map((v, i) => `${(i / (serie.length - 1) * 300).toFixed(1)},${(56 - (v - min) / rango * 50).toFixed(1)}`).join(" ");
  return `<div class="ext-curva"><p>Frecuencia cardiaca <span class="muted">${min}–${max}</span></p>
    <svg viewBox="0 0 300 60" width="100%" height="60" preserveAspectRatio="none" role="img" aria-label="Curva de frecuencia cardiaca de ${min} a ${max}"><polyline fill="none" stroke="#C8372D" stroke-width="2" vector-effect="non-scaling-stroke" points="${pts}"/></svg></div>`;
}

/* ---------- Panel ---------- */
async function renderExternos(box, uid, opts = {}){
  if(!box) return;
  const esCoach = !!opts.esCoach;
  box.innerHTML = `<div class="skel skel-block"></div>`;
  const { data, error } = await sb.from("entrenamientos_externos").select("*").eq("user_id", uid).order("fecha", { ascending: false }).order("hora", { ascending: false }).limit(200);
  if(!box.isConnected) return;
  const lista = data || [];
  const hace30 = fechaISO(sumarDias(parseFecha(todayStr()), -29));
  const mes = lista.filter(e => e.fecha >= hace30);
  const tiempo = mes.reduce((a, e) => a + (e.duracion_seg || 0), 0);
  const dist = mes.reduce((a, e) => a + (e.distancia_m || 0), 0);
  const esf = mes.filter(e => e.esfuerzo !== null && e.esfuerzo !== undefined);
  const resumen = mes.length ? `<div class="ext-resumen">
      <div><span>Sesiones</span><strong>${mes.length}</strong></div>
      <div><span>Tiempo</span><strong>${tiempo ? fmtDuracion(tiempo).replace(/:\d\d$/, "") + (tiempo >= 3600 ? " h" : " min") : "—"}</strong></div>
      <div><span>Distancia</span><strong>${dist ? numExt(dist / 1000, 1) + " km" : "—"}</strong></div>
      <div><span>Esfuerzo prom.</span><strong>${esf.length ? numExt(esf.reduce((a, e) => a + e.esfuerzo, 0) / esf.length, 1) : "—"}</strong></div>
    </div><p class="muted ext-resumen-nota">Últimos 30 días</p>` : "";
  box.innerHTML = `
    ${esCoach ? "" : `<p class="muted" style="margin-top:0">Sube o anota lo que entrenaste fuera de Gymnika para que tu coach lo vea.</p>`}
    <div class="ext-botones">
      <label class="btn-primary ext-subir"><span aria-hidden="true">⌚</span> Subir del reloj<input type="file" class="sr-only" data-ext-archivo></label>
      <button type="button" class="btn-outline" data-ext-manual><span aria-hidden="true">✍️</span> Anotar a mano</button>
    </div>
    <p class="muted ext-formatos">Archivo .FIT, .GPX o .TCX de tu reloj (también el .zip de Garmin). <button type="button" class="link-inline" data-ext-ayuda>¿Cómo lo saco de mi reloj?</button></p>
    <div data-ext-msg aria-live="polite"></div>
    ${error ? `<div class="error" role="alert">${esc(errorES(error))}</div>` : ""}
    ${resumen}
    ${lista.length ? `<details class="records ext-historial"${opts.abierto ? " open" : ""}><summary>Ver historial (${lista.length})</summary><ul class="ext-lista">${lista.map(e => {
      const det = lineaDetalles(e);
      return `<li class="ext-item${e.molestia >= 6 ? " ext-alerta" : ""}">
        <span class="ext-ico" aria-hidden="true">${(DEPORTES[e.deporte] || DEPORTES.otro).ico}</span>
        <div class="ext-cuerpo">
          <h3>${esc(nombreDeporte(e))} · ${esc(fechaLarga(e.fecha))}${e.hora ? " · " + esc(String(e.hora).slice(0, 5)) : ""}${e.origen === "reloj" ? ` <span class="ext-reloj" title="Subido del reloj">⌚</span>` : ""}</h3>
          ${lineaMetricas(e) ? `<p>${esc(lineaMetricas(e))}</p>` : ""}
          ${det ? `<p>${esc(det)}</p>` : ""}
          ${e.esfuerzo !== null && e.esfuerzo !== undefined || e.molestia !== null && e.molestia !== undefined ? `<p class="ext-pills">
            ${e.esfuerzo !== null && e.esfuerzo !== undefined ? `<span class="dolor-pill b-${e.esfuerzo >= 7 ? "medio" : "bajo"}">Esfuerzo <strong>${e.esfuerzo}</strong></span>` : ""}
            ${e.molestia !== null && e.molestia !== undefined ? `<span class="dolor-pill b-${nivelDolorExt(e.molestia)}">Molestia <strong>${e.molestia}</strong></span>` : ""}</p>` : ""}
          ${e.comentario ? `<p class="ext-coment">«${esc(e.comentario)}»</p>` : ""}
          <div class="ext-acc">
            ${e.archivo_path ? `<button type="button" class="btn-link" data-ext-bajar="${esc(e.id)}">Archivo</button>` : ""}
            <button type="button" class="btn-link" data-ext-editar="${esc(e.id)}">Editar</button>
            <button type="button" class="btn-link danger" data-ext-borrar="${esc(e.id)}">Borrar</button>
          </div>
        </div></li>`;
    }).join("")}</ul></details>` : emptyHTML(esCoach ? "Todavía no registra entrenamientos fuera de Gymnika." : "Todavía no registras entrenamientos fuera de Gymnika.")}`;
  const msg = box.querySelector("[data-ext-msg]");
  /* Al guardar, editar o borrar, el historial queda abierto para ver el cambio */
  const refrescar = ()=> renderExternos(box, uid, { ...opts, abierto: true });
  box.querySelector("[data-ext-ayuda]").onclick = abrirAyudaReloj;
  box.querySelector("[data-ext-manual]").onclick = ()=> abrirFormEntreno(uid, null, null, refrescar);
  const inp = box.querySelector("[data-ext-archivo]");
  inp.onchange = async ()=>{
    const f = inp.files && inp.files[0];
    inp.value = "";
    if(!f) return;
    if(f.size > 15 * 1024 * 1024){ showMsg(msg, "error", "El archivo es muy grande (máximo 15 MB)."); return; }
    showMsg(msg, "ok", "Leyendo el archivo…");
    try{
      const leido = await leerArchivoEntreno(f);
      msg.innerHTML = "";
      abrirFormEntreno(uid, { ...leido, origen: "reloj" }, f, refrescar);
    } catch(err){
      console.error(err);
      showMsg(msg, "error", "No pudimos leer ese archivo. Sube el .FIT, .GPX o .TCX del entrenamiento (o el .zip que descarga Garmin).");
    }
  };
  box.querySelectorAll("[data-ext-editar]").forEach(b => { b.onclick = ()=> abrirFormEntreno(uid, lista.find(x => x.id === b.dataset.extEditar), null, refrescar); });
  box.querySelectorAll("[data-ext-borrar]").forEach(b => { b.onclick = ()=>{
    const e = lista.find(x => x.id === b.dataset.extBorrar);
    const dlg = openDialog("Borrar entrenamiento", `<p>¿Borrar ${esc(nombreDeporte(e).toLowerCase())} del ${esc(fechaLarga(e.fecha))}? No se puede deshacer.</p>
      <div class="sheet-actions"><button type="button" class="btn-outline" data-no>Cancelar</button><button type="button" class="btn-danger" data-si>Borrar</button></div><div id="extBorrarMsg"></div>`);
    dlg.el.querySelector("[data-no]").onclick = dlg.close;
    const si = dlg.el.querySelector("[data-si]");
    si.onclick = ()=> withBusy(si, "Borrando…", async ()=>{
      if(e.archivo_path) await sb.storage.from("entrenamientos").remove([e.archivo_path]);
      const { error: er } = await sb.from("entrenamientos_externos").delete().eq("id", e.id);
      if(er){ showError(dlg.el.querySelector("#extBorrarMsg"), er); return; }
      dlg.close(); refrescar();
    });
  }; });
  box.querySelectorAll("[data-ext-bajar]").forEach(b => { b.onclick = async ()=>{
    const e = lista.find(x => x.id === b.dataset.extBajar);
    const { data: u, error: er } = await sb.storage.from("entrenamientos").createSignedUrl(e.archivo_path, 600, { download: e.archivo_nombre || true });
    if(er || !u){ showError(msg, er || new Error("archivo")); return; }
    window.open(u.signedUrl, "_blank", "noopener");
  }; });
}
const nivelDolorExt = (n)=> n >= 6 ? "alto" : n >= 3 ? "medio" : "bajo";

/* ---------- Formulario (a mano o revisando lo que leyó del reloj) ---------- */
function opcionesHTML(nombre, ops, valor, etiquetaId){
  return `<div class="ext-ops" role="radiogroup"${etiquetaId ? ` aria-labelledby="${etiquetaId}"` : ""}>${ops.map(o => `<label class="ext-op"><input type="radio" name="${nombre}" value="${esc(o)}"${valor === o ? " checked" : ""}><span>${esc(o)}</span></label>`).join("")}</div>`;
}
function camposDeporteHTML(dep, e){
  const d = (e && e.detalles) || {};
  const det = (DETALLES_DEPORTE[dep] || []).map(c => `<div class="ext-campo${c.ops ? " full" : ""}">
      <p class="ext-lbl" id="lbl_${c.k}">${esc(c.t)}</p>
      ${c.ops ? opcionesHTML("det_" + c.k, c.ops, d[c.k], "lbl_" + c.k) : c.num
        ? `<input type="number" inputmode="numeric" min="0" max="999" data-det="${c.k}" aria-labelledby="lbl_${c.k}" value="${esc(d[c.k] ?? "")}">`
        : `<input type="text" maxlength="80" data-det="${c.k}" aria-labelledby="lbl_${c.k}" value="${esc(d[c.k] ?? "")}">`}
    </div>`).join("");
  const unidad = (DEPORTES[dep] || {}).dist;
  const distVal = e && e.distancia_m != null ? (unidad === "m" ? Math.round(e.distancia_m) : +(e.distancia_m / 1000).toFixed(2)) : "";
  return `
    ${conDistancia(dep) ? `<div class="ext-campo"><label for="extDist">Distancia (${unidad})<span class="req" aria-hidden="true">*</span></label>
      <input id="extDist" type="number" inputmode="decimal" step="any" min="0" value="${esc(distVal)}"></div>` : ""}
    ${conDesnivel(dep) ? `<div class="ext-campo"><label for="extDesn">Desnivel (m)</label><input id="extDesn" type="number" inputmode="numeric" min="0" value="${esc(e && e.desnivel_m != null ? e.desnivel_m : "")}"></div>` : ""}
    ${conDistancia(dep) ? `<div class="ext-campo"><label for="extFc">Pulso medio</label><input id="extFc" type="number" inputmode="numeric" min="20" max="250" value="${esc(e && e.fc_media != null ? e.fc_media : "")}"></div>` : ""}
    ${det}`;
}
function burbujasExt(nombre, valor, etiqueta){
  return `<div class="burbujas" role="radiogroup" aria-label="${esc(etiqueta)}">${[0,1,2,3,4,5,6,7,8,9,10].map(n => `
    <label class="burbuja b-${n >= 7 ? "alto" : n >= 4 ? "medio" : "bajo"}"><input type="radio" name="${nombre}" value="${n}"${valor !== null && valor !== undefined && Number(valor) === n ? " checked" : ""}><span>${n}</span></label>`).join("")}</div>`;
}
function abrirFormEntreno(uid, previo, archivo, alGuardar){
  const e = previo || {};
  const editando = !!e.id;
  let dep = e.deporte || null;
  const h = e.duracion_seg != null ? Math.floor(e.duracion_seg / 3600) : "";
  const m = e.duracion_seg != null ? Math.round((e.duracion_seg % 3600) / 60) : "";
  const dlg = openDialog(editando ? "Editar entrenamiento" : archivo ? "Revisa tu entrenamiento" : "Anotar entrenamiento", `
    ${archivo ? `<div class="ext-archivo"><span aria-hidden="true">📄</span> ${esc(archivo.name)} · leído en tu teléfono</div>` : ""}
    <p class="ext-lbl" style="margin-top:0">Deporte<span class="req" aria-hidden="true">*</span>${archivo && !e.deporte ? ` <span class="muted">(tu reloj no dice cuál: elígelo)</span>` : ""}</p>
    <div class="ext-deportes">${Object.entries(DEPORTES).map(([k, d]) => `<label class="ext-dep"><input type="radio" name="extDep" value="${k}"${dep === k ? " checked" : ""}><span><b aria-hidden="true">${d.ico}</b>${esc(d.n)}</span></label>`).join("")}</div>
    <div class="ext-campo" data-otro${dep === "otro" ? "" : " hidden"}><label for="extOtro">¿Qué deporte?<span class="req" aria-hidden="true">*</span></label><input id="extOtro" maxlength="60" value="${esc(e.deporte_otro || "")}" placeholder="Ej: pádel"></div>
    <div class="ext-grid">
      <div class="ext-campo"><label for="extFecha">Fecha<span class="req" aria-hidden="true">*</span></label><input id="extFecha" type="date" max="${todayStr()}" value="${esc(e.fecha || todayStr())}"></div>
      <div class="ext-campo"><label for="extHora">Hora</label><input id="extHora" type="time" value="${esc(e.hora ? String(e.hora).slice(0, 5) : "")}"></div>
      <div class="ext-campo"><p class="ext-lbl" id="lblTiempo">Tiempo</p>
        <div class="ext-tiempo"><input id="extH" type="number" inputmode="numeric" min="0" max="48" placeholder="0" value="${esc(h)}" aria-label="Horas"><span>h</span>
          <input id="extM" type="number" inputmode="numeric" min="0" max="59" placeholder="0" value="${esc(m)}" aria-label="Minutos"><span>min</span></div></div>
      <div class="ext-campo"><label for="extCal">Calorías</label><input id="extCal" type="number" inputmode="numeric" min="0" value="${esc(e.calorias != null ? e.calorias : "")}"></div>
    </div>
    <div class="ext-grid" data-propios>${dep ? camposDeporteHTML(dep, e) : ""}</div>
    ${curvaFC(e.serie_fc)}
    <p class="ext-lbl">Esfuerzo <span class="muted">(0 suave · 10 al máximo)</span></p>
    ${burbujasExt("extEsf", e.esfuerzo, "Esfuerzo")}
    <p class="ext-lbl">Molestia o dolor <span class="muted">(0 nada · 10 mucho)</span></p>
    ${burbujasExt("extMol", e.molestia, "Molestia o dolor")}
    <label for="extCom">¿Cómo te sentiste? <span class="muted">(opcional)</span></label>
    <textarea id="extCom" rows="2" maxlength="2000">${esc(e.comentario || "")}</textarea>
    <div id="extMsg" aria-live="polite"></div>
    <button type="button" class="btn-primary" id="btnGuardarExt">Guardar</button>`);
  dlg.el.classList.add("ext-dialog");
  const root = dlg.el;
  enlazarBurbujasExt(root);
  root.querySelectorAll('input[name="extDep"]').forEach(r => { r.onchange = ()=>{
    const previoDep = dep;
    const datos = leerPropios(root, previoDep);
    dep = r.value;
    root.querySelector("[data-otro]").hidden = dep !== "otro";
    root.querySelector("[data-propios]").innerHTML = camposDeporteHTML(dep, { ...e, ...datos, detalles: dep === previoDep ? datos.detalles : (e.deporte === dep ? e.detalles : {}) });
    if(dep === "otro") root.querySelector("#extOtro").focus();
  }; });
  const btn = root.querySelector("#btnGuardarExt");
  btn.onclick = ()=> withBusy(btn, "Guardando…", async ()=>{
    const msg = root.querySelector("#extMsg");
    if(!dep){ showMsg(msg, "error", "Elige el deporte."); return; }
    const otro = root.querySelector("#extOtro").value.trim();
    if(dep === "otro" && !otro){ showMsg(msg, "error", "Escribe qué deporte hiciste."); return; }
    const fecha = root.querySelector("#extFecha").value;
    if(!fecha){ showMsg(msg, "error", "Elige la fecha."); return; }
    const propios = leerPropios(root, dep);
    if(conDistancia(dep) && !propios.distancia_m){ showMsg(msg, "error", `Escribe la distancia en ${DEPORTES[dep].dist}.`); return; }
    const hh = parseInt(root.querySelector("#extH").value, 10) || 0, mm = parseInt(root.querySelector("#extM").value, 10) || 0;
    const radio = (n)=>{ const x = root.querySelector(`input[name="${n}"]:checked`); return x ? Number(x.value) : null; };
    const numOrNull = (v)=>{ const n = parseInt(v, 10); return isNaN(n) ? null : n; };
    /* Si el tiempo que vino del reloj no se tocó, se conserva al segundo */
    const durOriginal = e.duracion_seg != null && hh === Math.floor(e.duracion_seg / 3600) && mm === Math.round((e.duracion_seg % 3600) / 60);
    const fila = {
      user_id: uid, deporte: dep, deporte_otro: dep === "otro" ? otro : null, fecha,
      hora: root.querySelector("#extHora").value || null,
      duracion_seg: durOriginal ? e.duracion_seg : (hh || mm ? hh * 3600 + mm * 60 : null),
      calorias: numOrNull(root.querySelector("#extCal").value),
      distancia_m: conDistancia(dep) ? propios.distancia_m : null,
      desnivel_m: conDesnivel(dep) ? propios.desnivel_m : null,
      fc_media: conDistancia(dep) ? propios.fc_media : (e.fc_media ?? null),
      fc_max: e.fc_max ?? null,
      detalles: propios.detalles,
      esfuerzo: radio("extEsf"), molestia: radio("extMol"),
      comentario: root.querySelector("#extCom").value.trim() || null
    };
    if(!editando){
      fila.origen = archivo ? "reloj" : "manual";
      fila.serie_fc = e.serie_fc || null;
      if(archivo){
        const limpio = (archivo.name || "entrenamiento").replace(/[^\w.-]+/g, "_").slice(-80);
        const path = `${uid}/${Date.now()}-${limpio}`;
        const { error: eu } = await sb.storage.from("entrenamientos").upload(path, archivo, { contentType: archivo.type || "application/octet-stream", upsert: false });
        if(eu){ showError(msg, eu); return; }
        fila.archivo_path = path; fila.archivo_nombre = archivo.name || limpio;
      }
    }
    const { error } = editando
      ? await sb.from("entrenamientos_externos").update(fila).eq("id", e.id)
      : await sb.from("entrenamientos_externos").insert(fila);
    if(error){
      if(fila.archivo_path) sb.storage.from("entrenamientos").remove([fila.archivo_path]);
      showError(msg, error); return;
    }
    dlg.close();
    alGuardar && alGuardar();
  });
}
function leerPropios(root, dep){
  const val = (sel)=>{ const x = root.querySelector(sel); return x ? x.value : ""; };
  const num = (v)=>{ const n = parseFloat(String(v).replace(",", ".")); return isNaN(n) ? null : n; };
  const out = { detalles: {} };
  const dist = num(val("#extDist"));
  out.distancia_m = dist === null ? null : (DEPORTES[dep] && DEPORTES[dep].dist === "m" ? Math.round(dist) : Math.round(dist * 1000));
  const des = num(val("#extDesn")); out.desnivel_m = des === null ? null : Math.round(des);
  const fc = num(val("#extFc")); out.fc_media = fc === null ? null : Math.round(fc);
  (DETALLES_DEPORTE[dep] || []).forEach(c => {
    if(c.ops){ const x = root.querySelector(`input[name="det_${c.k}"]:checked`); if(x) out.detalles[c.k] = x.value; }
    else { const v = val(`[data-det="${c.k}"]`).trim(); if(v) out.detalles[c.k] = c.num ? Number(v) : v; }
  });
  return out;
}
/* Tocar de nuevo la opción marcada la desmarca (nada es obligatorio salvo el deporte) */
function enlazarBurbujasExt(root){
  root.addEventListener("pointerdown", (ev)=>{
    const inp = ev.target.closest("label")?.querySelector('input[type=radio]:not([name="extDep"])');
    if(inp) inp.dataset.estaba = inp.checked ? "1" : "";
  });
  root.addEventListener("click", (ev)=>{
    const inp = ev.target.closest('input[type=radio]:not([name="extDep"])');
    if(inp && inp.dataset.estaba === "1"){ inp.checked = false; inp.dataset.estaba = ""; }
  });
}

/* ---------- Ayuda: cómo sacar el archivo según la marca ---------- */
const AYUDA_RELOJ = {
  Coros: ["Abre la app COROS y entra a tu entrenamiento.", "Toca los tres puntos ⋯ arriba a la derecha.", "Elige «Exportar» → FIT.", "Guárdalo en tu teléfono (en iPhone: «Guardar en Archivos»).", "En Gymnika toca «Subir del reloj» y elige ese archivo."],
  Suunto: ["Abre la app Suunto y entra a tu entrenamiento.", "Toca los tres puntos ⋯ arriba a la derecha.", "Elige exportar como FIT.", "Guárdalo en tu teléfono.", "En Gymnika toca «Subir del reloj» y elige ese archivo."],
  Garmin: ["En el navegador del teléfono abre connect.garmin.com, inicia sesión y pide la versión para computadora (la app de Garmin no deja exportar).", "Abre el entrenamiento y toca el engranaje ⚙.", "Elige «Exportar original»: se descarga un .zip.", "En Gymnika toca «Subir del reloj» y elige ese .zip en Descargas."],
  Polar: ["Entra a Polar Flow y abre tu entrenamiento.", "Elige exportar la sesión (GPX o TCX).", "Guárdalo en tu teléfono.", "En Gymnika toca «Subir del reloj» y elige ese archivo."],
  "Apple Watch": ["El Apple Watch no exporta el archivo por sí solo.", "Con una app que exporte entrenamientos de Salud (por ejemplo HealthFit), expórtalo como FIT o GPX.", "En Gymnika toca «Subir del reloj» y elige ese archivo.", "Si no quieres instalar otra app, usa «Anotar a mano»."]
};
function abrirAyudaReloj(){
  const marcas = Object.keys(AYUDA_RELOJ);
  const dlg = openDialog("¿Cómo saco el archivo?", `
    <div class="seg ext-marcas" role="tablist">${marcas.map((m, i) => `<button type="button" role="tab" aria-selected="${i === 0}" data-marca="${esc(m)}">${esc(m)}</button>`).join("")}</div>
    <ol class="ext-pasos" id="extPasos"></ol>
    <p class="muted">Si no usas reloj, toca «Anotar a mano».</p>`);
  const pintar = (m)=>{
    dlg.el.querySelector("#extPasos").innerHTML = AYUDA_RELOJ[m].map(p => `<li>${esc(p)}</li>`).join("");
    dlg.el.querySelectorAll("[data-marca]").forEach(b => b.setAttribute("aria-selected", String(b.dataset.marca === m)));
  };
  dlg.el.querySelectorAll("[data-marca]").forEach(b => { b.onclick = ()=> pintar(b.dataset.marca); });
  pintar(marcas[0]);
}

/* ---------- Tu reloj (Inicio del alumno): pasos y sueño que anota cada día + resumen de 7 días ---------- */
function horasSueno(r){
  if(!r || !r.durmio || !r.desperto) return null;
  const min = (t)=>{ const [h, m] = String(t).split(":").map(Number); return h * 60 + m; };
  let d = min(r.desperto) - min(r.durmio);
  if(d <= 0) d += 24 * 60;
  return d / 60;
}
function fmtHoras(h){
  if(h == null) return "–";
  const t = Math.round(h * 60);
  return `${Math.floor(t / 60)} h${t % 60 ? " " + String(t % 60).padStart(2, "0") : ""}`;
}
const horaCortaR = (t)=> t ? String(t).slice(0, 5) : "";
async function renderReloj(box, uid){
  if(!box) return;
  const hoy = todayStr();
  const desde = fechaISO(sumarDias(parseFecha(hoy), -6));
  const [{ data: dias, error }, { data: entrenos }] = await Promise.all([
    sb.from("bienestar_diario").select("*").eq("user_id", uid).gte("fecha", desde).order("fecha"),
    sb.from("entrenamientos_externos").select("fecha, duracion_seg, distancia_m, deporte").eq("user_id", uid).gte("fecha", desde)
  ]);
  if(!document.body.contains(box)) return;
  if(error){ box.innerHTML = `<div class="error" role="alert">${esc(errorES(error))}</div>`; return; }
  const porFecha = {};
  (dias || []).forEach(r => { porFecha[r.fecha] = r; });
  const semana = Array.from({ length: 7 }, (_, i) => fechaISO(sumarDias(parseFecha(desde), i)));
  const conPasos = semana.map(f => porFecha[f]).filter(r => r && r.pasos != null);
  const conSueno = semana.map(f => horasSueno(porFecha[f])).filter(h => h != null);
  const promPasos = conPasos.length ? Math.round(conPasos.reduce((a, r) => a + r.pasos, 0) / conPasos.length) : null;
  const promSueno = conSueno.length ? conSueno.reduce((a, h) => a + h, 0) / conSueno.length : null;
  const maxPasos = Math.max(10000, ...conPasos.map(r => r.pasos));
  const ent = entrenos || [];
  const seg = ent.reduce((a, e) => a + (e.duracion_seg || 0), 0);
  const km = ent.reduce((a, e) => a + (e.deporte === "nadar" ? 0 : (e.distancia_m || 0)), 0) / 1000;
  const hoyR = porFecha[hoy];
  let dia = box.dataset.dia === "ayer" ? "ayer" : "hoy";
  const pintar = ()=>{
    const f = dia === "hoy" ? hoy : fechaISO(sumarDias(parseFecha(hoy), -1));
    const r = porFecha[f] || {};
    box.innerHTML = `
      <div class="reloj-stats">
        <div class="reloj-stat"><span class="reloj-ico" aria-hidden="true">👣</span>
          <span class="reloj-k">Pasos hoy</span><strong class="num">${hoyR && hoyR.pasos != null ? numExt(hoyR.pasos, 0) : "–"}</strong>
          <span class="muted">${promPasos != null ? `Promedio 7 días: ${numExt(promPasos, 0)}` : "Anota tus pasos para ver tu promedio"}</span></div>
        <div class="reloj-stat"><span class="reloj-ico" aria-hidden="true">🌙</span>
          <span class="reloj-k">Sueño de anoche</span><strong class="num">${fmtHoras(horasSueno(hoyR))}</strong>
          <span class="muted">${hoyR && hoyR.durmio ? `${horaCortaR(hoyR.durmio)} → ${horaCortaR(hoyR.desperto)}` : ""}${promSueno != null ? `${hoyR && hoyR.durmio ? " · " : ""}Promedio: ${fmtHoras(promSueno)}` : (hoyR && hoyR.durmio ? "" : "Anota a qué hora dormiste y despertaste")}</span></div>
      </div>
      <ol class="reloj-semana" aria-label="Últimos 7 días">${semana.map(fe => {
        const x = porFecha[fe], h = horasSueno(x), d = parseFecha(fe);
        return `<li${fe === hoy ? ' class="hoy"' : ""}><span class="reloj-dia">${DIAS_SEMANA[isoDow(d)].slice(0, 2)} <span class="num">${d.getDate()}</span></span>
          <span class="reloj-barra" title="${x && x.pasos != null ? numExt(x.pasos, 0) + " pasos" : "Sin pasos"}"><i style="height:${x && x.pasos ? Math.max(4, Math.round(x.pasos / maxPasos * 100)) : 0}%"></i></span>
          <span class="reloj-num num">${x && x.pasos != null ? (x.pasos >= 1000 ? numExt(x.pasos / 1000, 1) + "k" : x.pasos) : "–"}</span>
          <span class="reloj-sueno num">${h != null ? fmtHoras(h).replace(" ", "") : "–"}</span></li>`;
      }).join("")}</ol>
      <details class="reloj-anotar"${box.dataset.abierto === "1" ? " open" : ""}><summary>Anotar pasos y sueño</summary>
        <div class="seg reloj-cuando" role="group" aria-label="¿De qué día?">
          <button type="button" data-cuando="hoy" aria-pressed="${dia === "hoy"}">Hoy</button>
          <button type="button" data-cuando="ayer" aria-pressed="${dia === "ayer"}">Ayer</button></div>
        <div class="reloj-campos">
          <label>Pasos<input type="number" inputmode="numeric" min="0" max="150000" id="relPasos" value="${r.pasos ?? ""}" placeholder="Ej: 8500"></label>
          <label>Me dormí<input type="time" id="relDurmio" value="${horaCortaR(r.durmio)}"></label>
          <label>Desperté<input type="time" id="relDesperto" value="${horaCortaR(r.desperto)}"></label>
        </div>
        <p class="muted reloj-ayuda">Copia los pasos y el sueño de tu reloj o del celular. El sueño es la noche anterior al día que elijas.</p>
        <button type="button" class="btn-primary" id="btnRelGuardar">Guardar</button>
        <div id="relMsg" aria-live="polite"></div>
      </details>
      <div class="reloj-entrenos">
        <p><strong>Entrenamientos de tu reloj · 7 días:</strong> ${ent.length ? `${plural(ent.length, "entrenamiento", "entrenamientos")} · ${fmtHoras(seg / 3600)}${km ? ` · ${numExt(km, 1)} km` : ""}` : "todavía ninguno"}</p>
        <a class="btn-outline" href="#/progreso" data-ir-externos><span aria-hidden="true">⌚</span> Agregar entrenamiento externo</a>
      </div>`;
    const det = box.querySelector(".reloj-anotar");
    det.addEventListener("toggle", ()=>{ box.dataset.abierto = det.open ? "1" : ""; });
    box.querySelectorAll("[data-cuando]").forEach(b => { b.onclick = ()=>{ dia = b.dataset.cuando; box.dataset.dia = dia; pintar(); }; });
    const btn = box.querySelector("#btnRelGuardar");
    btn.onclick = ()=> withBusy(btn, "Guardando…", async ()=>{
      const msg = box.querySelector("#relMsg");
      const pv = box.querySelector("#relPasos").value.trim();
      const pasos = pv === "" ? null : parseInt(pv, 10);
      const durmio = box.querySelector("#relDurmio").value || null;
      const desperto = box.querySelector("#relDesperto").value || null;
      if(pasos != null && (isNaN(pasos) || pasos < 0 || pasos > 150000)){ showMsg(msg, "error", "Revisa los pasos (entre 0 y 150 000)."); return; }
      if(!!durmio !== !!desperto){ showMsg(msg, "error", "Para el sueño, anota a qué hora te dormiste y a qué hora despertaste."); return; }
      if(pasos == null && !durmio){ showMsg(msg, "error", "Anota tus pasos o tu sueño."); return; }
      const { error: e2 } = await sb.from("bienestar_diario").upsert({ user_id: uid, fecha: f, pasos, durmio, desperto }, { onConflict: "user_id,fecha" });
      if(e2){ showError(msg, e2); return; }
      box.dataset.abierto = "";
      await renderReloj(box, uid);
      const ok = box.querySelector(".reloj-entrenos");
      if(ok) ok.insertAdjacentHTML("beforebegin", `<div class="success" role="status">Guardado.</div>`);
    });
    enlazarIrExternos(box);
  };
  pintar();
}
/* «Agregar entrenamiento externo»: lleva a Progreso → Entrenamiento fuera de Gymnika y lo resalta */
function enlazarIrExternos(root){
  root.querySelectorAll("[data-ir-externos]").forEach(b => { b.onclick = (e)=>{
    const card = document.getElementById("externosCard");
    if(!card) return;
    e.preventDefault();
    history.pushState(null, "", "#/progreso");
    activarSeccionAlumno("progreso", false);
    const panel = card.closest("section") || card;
    panel.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    panel.classList.remove("resaltar"); void panel.offsetWidth; panel.classList.add("resaltar");
  }; });
}
