/* ====================== BITÁCORA, TURNOS Y MIRADOR (EQUIPO) ======================
   Bitácora: historial de trabajo de cada persona, escrito por los coaches (los alumnos no la ven).
   Turno: el coach escanea el QR de recepción para empezar; «Fin de turno» lo cierra (y la base cierra sola los de días anteriores).
   Mirador: mientras el turno está abierto, cada persona que registra su llegada aparece en una tarjeta deslizable
   para llenar su bitácora del día. Al guardar, la tarjeta se cierra para todo el equipo. */

const BIT_CAMPOS = [
  ["como_llego", "¿Cómo llegó?"],
  ["que_hizo", "¿Qué hizo hoy?"],
  ["que_ocurrio", "¿Qué ocurrió?"],
  ["pendiente", "¿Pendiente para la próxima?"]
];
const miradorUI = { turno: null, pend: [], vistos: new Set(), cargando: false, borradores: {}, hist: {} };
const bitUI = { filtro: "", q: "" };

function routeBitacoraId(){
  const m = location.hash.match(/^#\/bitacora\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}
const mayuscula = (t)=> String(t || "").charAt(0).toUpperCase() + String(t || "").slice(1);
const nivelDolor = (n)=> n >= 7 ? "alto" : n >= 4 ? "medio" : "bajo";

/* ---------- Campos (los mismos en el Mirador y en «Nueva entrada») ---------- */
function burbujasHTML(campo, pre, valor, titulo){
  return `<fieldset class="bit-dolor" data-dolor="${campo}">
    <legend>${esc(titulo)}</legend>
    <div class="burbujas">${[1,2,3,4,5,6,7,8,9,10].map(n => `
      <label class="burbuja b-${nivelDolor(n)}"><input type="radio" name="${pre}${campo}" value="${n}"${Number(valor) === n ? " checked" : ""}><span>${n}</span></label>`).join("")}
    </div></fieldset>`;
}
function camposBitacoraHTML(pre, d = {}){
  const t = (campo, titulo)=> `<div class="bit-campo"><label for="${pre}${campo}">${esc(titulo)}</label>
    <textarea id="${pre}${campo}" data-campo="${campo}" rows="2">${esc(d[campo] || "")}</textarea></div>`;
  return `<div class="bit-campos">
    ${burbujasHTML("dolor_inicio", pre, d.dolor_inicio, "Nivel de dolor al llegar")}
    ${t("como_llego", "¿Cómo llegó?")}
    ${t("que_hizo", "¿Qué hizo hoy?")}
    ${t("que_ocurrio", "¿Qué ocurrió?")}
    <fieldset class="bit-si-no"><legend>¿Hizo sus estiramientos?</legend>
      <div class="seg">
        <label><input type="radio" name="${pre}estiramientos" value="si"${d.estiramientos === true ? " checked" : ""}><span>Sí</span></label>
        <label><input type="radio" name="${pre}estiramientos" value="no"${d.estiramientos === false ? " checked" : ""}><span>No</span></label>
      </div></fieldset>
    ${t("pendiente", "¿Pendiente para la próxima?")}
    ${burbujasHTML("dolor_salida", pre, d.dolor_salida, "¿Con cuánto dolor se va?")}
  </div>`;
}
/* Tocar la burbuja o la opción marcada la desmarca: ningún campo es obligatorio */
function enlazarCampos(box){
  box.addEventListener("pointerdown", (e)=>{
    const inp = e.target.closest("label")?.querySelector("input[type=radio]");
    if(inp) inp.dataset.estaba = inp.checked ? "1" : "";
  });
  box.addEventListener("click", (e)=>{
    const inp = e.target.closest("input[type=radio]");
    if(inp && inp.dataset.estaba === "1"){ inp.checked = false; inp.dataset.estaba = ""; inp.dispatchEvent(new Event("change", { bubbles: true })); }
  });
}
function leerCampos(box, pre){
  const radio = (nombre)=> box.querySelector(`input[name="${pre}${nombre}"]:checked`);
  const d = {};
  BIT_CAMPOS.forEach(([c]) => { const v = (box.querySelector(`[data-campo="${c}"]`)?.value || "").trim(); d[c] = v || null; });
  ["dolor_inicio", "dolor_salida"].forEach(c => { const r = radio(c); d[c] = r ? Number(r.value) : null; });
  const e = radio("estiramientos");
  d.estiramientos = e ? e.value === "si" : null;
  return d;
}

/* ---------- Turno ---------- */
async function cargarTurno(){
  if(!esEquipo()) return;
  const { data, error } = await sb.from("turnos_coach").select("id, inicio").eq("coach_id", state.profile.id).is("fin", null).limit(1);
  if(error){ console.error(error); return; }
  miradorUI.turno = (data || [])[0] || null;
  /* Si quedó abierto de otro día, la base lo cierra sola: aquí tampoco cuenta */
  if(miradorUI.turno && String(new Date(miradorUI.turno.inicio).toLocaleDateString("en-CA", { timeZone: "America/Lima" })) !== todayStr()) miradorUI.turno = null;
  pintarTurno();
  if(miradorUI.turno) actualizarMirador();
}
async function iniciarTurnoConQR(codigo){
  const { data, error } = await sb.rpc("iniciar_turno", { p_codigo: codigo });
  if(error){
    openDialog("No se inició tu turno", `<div class="checkin-res bad"><span class="ck-icon" aria-hidden="true">!</span><p>${esc(errorES(error))}</p></div>`);
    return;
  }
  const res = typeof data === "string" ? JSON.parse(data) : (data || {});
  miradorUI.turno = { id: res.id, inicio: res.inicio };
  miradorUI.vistos = new Set(); miradorUI.hist = {};
  pintarTurno();
  const dlg = openDialog(res.ya_abierto ? "Ya estabas en turno" : "Turno iniciado", `
    <div class="checkin-res ok"><span class="ck-icon" aria-hidden="true">✓</span>
      <p class="ck-name">${res.ya_abierto ? "Tu turno sigue abierto" : "¡Buen turno, " + esc(primerNombre(state.profile.nombre)) + "!"}</p>
      <p>Empezó a las <strong>${esc(horaDe(res.inicio))}</strong>. Cada persona que llegue y escanee el QR te aparecerá en el Mirador para llenar su bitácora.</p>
      <p class="muted">Cuando termines, toca «Fin de turno».</p>
    </div>`);
  await actualizarMirador();
  if(miradorUI.pend.length) dlg.close();
}
function confirmarFinTurno(){
  const dlg = openDialog("Fin de turno", `
    <p>¿Terminas tu turno? El Mirador deja de abrirse solo hasta que vuelvas a escanear el QR.</p>
    ${miradorUI.pend.length ? `<p class="muted">Quedan ${plural(miradorUI.pend.length, "persona", "personas")} sin bitácora de hoy. Otro coach en turno o tú mismo pueden llenarla desde la Bitácora.</p>` : ""}
    <div class="sheet-actions"><button type="button" class="btn-outline" data-no>Seguir en turno</button><button type="button" class="btn-primary" data-si>Terminar turno</button></div>
    <div id="finTurnoMsg" aria-live="polite"></div>`);
  dlg.el.querySelector("[data-no]").onclick = dlg.close;
  const b = dlg.el.querySelector("[data-si]");
  b.onclick = ()=> withBusy(b, "Cerrando…", async ()=>{
    const { error } = await sb.rpc("terminar_turno");
    if(error){ showError(dlg.el.querySelector("#finTurnoMsg"), error); return; }
    miradorUI.turno = null; miradorUI.pend = []; miradorUI.vistos = new Set(); miradorUI.borradores = {}; miradorUI.hist = {};
    const m = document.getElementById("modalMirador");
    if(m){ if(m.open) m.close(); m.remove(); }
    pintarTurno();
    dlg.close();
  });
}
/* Barra del turno en «Hoy» + botón flotante del Mirador en todo el panel */
function turnoBarHTML(){ return `<section class="panel span-12 turno-bar" id="turnoBar" aria-live="polite"></section>`; }
function pintarTurno(){
  const bar = document.getElementById("turnoBar");
  const t = miradorUI.turno, n = miradorUI.pend.length;
  if(bar){
    bar.classList.toggle("activo", !!t);
    bar.innerHTML = t ? `
      <span class="turno-luz" aria-hidden="true"></span>
      <div class="turno-txt"><strong>En turno desde las ${esc(horaDe(t.inicio))}</strong>
        <span class="muted">Mirador activo · ${n ? plural(n, "persona presente sin bitácora", "personas presentes sin bitácora") : "nadie pendiente por ahora"}</span></div>
      <div class="turno-acc"><button type="button" class="btn-outline sm" data-abrir-mirador>Abrir Mirador${n ? ` (${n})` : ""}</button>
        <button type="button" class="btn-danger sm" data-fin-turno>Fin de turno</button></div>` : `
      <span class="turno-luz off" aria-hidden="true"></span>
      <div class="turno-txt"><strong>No has iniciado tu turno</strong>
        <span class="muted">Escanea el QR de recepción al llegar. Así se activa el Mirador con cada persona que llegue.</span></div>
      <div class="turno-acc"><button type="button" class="btn-primary sm" data-escanear-turno>Escanear QR · iniciar turno</button></div>`;
    bar.querySelector("[data-abrir-mirador]")?.addEventListener("click", ()=> abrirMirador());
    bar.querySelector("[data-fin-turno]")?.addEventListener("click", confirmarFinTurno);
    bar.querySelector("[data-escanear-turno]")?.addEventListener("click", ()=> abrirEscanerQR());
  }
  let fab = document.getElementById("miradorFab");
  document.body.classList.toggle("mirador-activo", !!t);
  if(!t){ if(fab) fab.remove(); return; }
  if(!fab){
    fab = document.createElement("button");
    fab.type = "button"; fab.id = "miradorFab"; fab.className = "mirador-fab";
    fab.onclick = ()=> abrirMirador();
    document.body.appendChild(fab);
  }
  fab.classList.toggle("con-pend", n > 0);
  fab.innerHTML = `<span class="turno-luz" aria-hidden="true"></span>Mirador${n ? `<span class="fab-n">${n}</span>` : ""}`;
  fab.setAttribute("aria-label", "Abrir el Mirador" + (n ? `: ${plural(n, "persona pendiente", "personas pendientes")}` : ""));
  fab.hidden = !!document.querySelector("#modalMirador[open]");
}

/* ---------- Mirador ---------- */
async function actualizarMirador(){
  if(!miradorUI.turno || miradorUI.cargando) return;
  miradorUI.cargando = true;
  try{
    const { data, error } = await sb.rpc("mirador_pendientes");
    if(error){ console.error(error); return; }
    const lista = data || [];
    await cargarReferencias(lista.map(p => p.atleta_id));
    const nuevos = lista.filter(p => !miradorUI.vistos.has(p.reserva_id));
    nuevos.forEach(p => miradorUI.vistos.add(p.reserva_id));
    miradorUI.pend = lista;
    pintarTurno();
    const dlg = document.getElementById("modalMirador");
    if(dlg && dlg.open) sincronizarTarjetas(dlg);
    else if(nuevos.length) abrirMirador(nuevos[0].reserva_id);
  } finally { miradorUI.cargando = false; }
}
/* Referencia en cada tarjeta: lo pendiente de la sesión anterior y las últimas 5 entradas de su bitácora */
async function cargarReferencias(ids){
  const faltan = [...new Set(ids)].filter(id => !(id in miradorUI.hist));
  await Promise.all(faltan.map(async id => {
    const { data, error } = await sb.from("bitacora").select("id, atleta_id, fecha, created_at, autor_nombre, dolor_inicio, dolor_salida, como_llego, que_hizo, que_ocurrio, estiramientos, pendiente")
      .eq("atleta_id", id).order("fecha", { ascending: false }).order("created_at", { ascending: false }).limit(5);
    if(!error) miradorUI.hist[id] = data || [];
  }));
}
function referenciasHTML(lista){
  if(!lista) return "";
  if(!lista.length) return `<p class="mir-ref-vacio muted">Primera vez en la bitácora: todavía no hay sesiones anteriores.</p>`;
  const ant = lista[0];
  const quien = (b)=> `${esc(fmtFecha(b.fecha))}${b.autor_nombre ? " · " + esc(primerNombre(b.autor_nombre)) : ""}`;
  const dolor = (b)=> b.dolor_inicio || b.dolor_salida ? `<span class="mir-ult-dolor">Dolor ${b.dolor_inicio || "–"} → ${b.dolor_salida || "–"}</span>` : "";
  const linea = (t, v)=> v ? `<p><strong>${t}</strong> ${esc(v)}</p>` : "";
  return `<div class="mir-pend${ant.pendiente ? "" : " vacio"}">
      <p class="mir-pend-tit">Pendiente de la sesión anterior <span class="muted">(${quien(ant)})</span></p>
      <p class="mir-pend-txt">${ant.pendiente ? esc(ant.pendiente) : "No se dejó nada pendiente."}</p></div>
    <details class="mir-ult"><summary>Últimas ${lista.length === 1 ? "sesión" : lista.length + " sesiones"}</summary>
      <ol>${lista.map(b => `<li><p class="mir-ult-meta"><strong>${quien(b)}</strong>${dolor(b)}</p>
        ${linea("Llegó:", b.como_llego)}${linea("Hizo:", b.que_hizo)}${linea("Ocurrió:", b.que_ocurrio)}
        ${b.estiramientos === true || b.estiramientos === false ? `<p><strong>Estiramientos:</strong> ${b.estiramientos ? "Sí" : "No"}</p>` : ""}
        ${linea("Pendiente:", b.pendiente)}</li>`).join("")}</ol></details>`;
}
function tarjetaMiradorHTML(p){
  const pre = "m" + p.reserva_id.replace(/[^a-z0-9]/gi, "").slice(0, 12) + "_";
  const cat = (CATEGORIAS[p.categoria] || {}).nombre || "";
  return `<article class="mir-card" data-reserva="${esc(p.reserva_id)}" data-pre="${pre}" aria-label="${esc(p.nombre || "Alumno")}">
    <header class="mir-head"><span class="avatar" aria-hidden="true">${esc(initials(p.nombre || ""))}</span>
      <div><h3>${esc(p.nombre || "Alumno")}</h3>
        <p class="muted">${esc(cat)} · ${esc(horaDe(p.inicio))} · llegó ${esc(horaDe(p.checkin_at))}</p></div>
      <a class="link-inline mir-hist" href="#/bitacora/${encodeURIComponent(p.atleta_id)}" data-ir-bitacora>Historial</a></header>
    ${tieneLesion(p.lesiones) ? `<p class="mir-lesion"><strong>Lesión:</strong> ${esc(p.lesiones)}</p>` : ""}
    ${referenciasHTML(miradorUI.hist[p.atleta_id])}
    ${camposBitacoraHTML(pre, miradorUI.borradores[p.reserva_id] || {})}
    <div class="mir-acc"><span class="mir-msg" aria-live="polite"></span><button type="button" class="btn-primary" data-guardar-mir>Guardar</button></div>
  </article>`;
}
function abrirMirador(irA){
  let dlg = document.getElementById("modalMirador");
  if(!dlg){
    dlg = document.createElement("dialog");
    dlg.id = "modalMirador"; dlg.className = "modal-pago modal-mirador";
    dlg.setAttribute("aria-labelledby", "mirTitulo");
    dlg.innerHTML = `
      <div class="mir-top"><div><p class="eyebrow">Mirador · en turno</p><h2 id="mirTitulo"></h2></div>
        <button type="button" class="icon-btn" data-mir-cerrar aria-label="Cerrar el Mirador">✕</button></div>
      <div class="mir-nav"><button type="button" class="icon-btn" data-mir-prev aria-label="Anterior">‹</button>
        <span class="mir-pos num" aria-live="polite"></span>
        <button type="button" class="icon-btn" data-mir-next aria-label="Siguiente">›</button></div>
      <div class="mir-track" tabindex="-1"></div>
      <div class="mir-puntos" aria-hidden="true"></div>
      <div class="mir-pie"><button type="button" class="btn-link" data-mir-fin>Fin de turno</button><button type="button" class="btn-outline sm" data-mir-cerrar>Cerrar por ahora</button></div>`;
    document.body.appendChild(dlg);
    const track = dlg.querySelector(".mir-track");
    enlazarCampos(track);
    const cerrar = ()=>{ guardarBorradores(dlg); if(dlg.open) dlg.close(); pintarTurno(); };
    dlg.addEventListener("cancel", (e)=>{ e.preventDefault(); cerrar(); });
    dlg.addEventListener("click", (e)=>{
      if(e.target.closest("[data-mir-cerrar]")){ cerrar(); return; }
      if(e.target.closest("[data-mir-fin]")){ cerrar(); confirmarFinTurno(); return; }
      if(e.target.closest("[data-ir-bitacora]")){ cerrar(); return; }
      if(e.target.closest("[data-mir-prev]")){ moverMirador(dlg, -1); return; }
      if(e.target.closest("[data-mir-next]")){ moverMirador(dlg, 1); return; }
      const p = e.target.closest(".mir-puntos button");
      if(p){ irATarjeta(dlg, Number(p.dataset.i)); return; }
      const g = e.target.closest("[data-guardar-mir]");
      if(g) guardarTarjeta(dlg, g.closest(".mir-card"), g);
    });
    let t = null;
    track.addEventListener("scroll", ()=>{ clearTimeout(t); t = setTimeout(()=> marcarPosicion(dlg), 60); }, { passive: true });
  }
  sincronizarTarjetas(dlg);
  if(!dlg.open){ try{ dlg.showModal(); } catch { dlg.setAttribute("open", ""); } }
  pintarTurno();
  if(irA){
    const cards = [...dlg.querySelectorAll(".mir-card")];
    const i = cards.findIndex(c => c.dataset.reserva === irA);
    if(i >= 0) requestAnimationFrame(()=> irATarjeta(dlg, i, "instant"));
  }
}
function guardarBorradores(dlg){
  dlg.querySelectorAll(".mir-card").forEach(c => { miradorUI.borradores[c.dataset.reserva] = leerCampos(c, c.dataset.pre); });
}
/* Agrega a los que llegaron y quita a los que otro coach ya registró, sin borrar lo que se está escribiendo */
function sincronizarTarjetas(dlg){
  const track = dlg.querySelector(".mir-track");
  const ids = new Set(miradorUI.pend.map(p => p.reserva_id));
  track.querySelectorAll(".mir-card").forEach(c => { if(!ids.has(c.dataset.reserva) && !c.classList.contains("saliendo")) c.remove(); });
  const hay = new Set([...track.querySelectorAll(".mir-card")].map(c => c.dataset.reserva));
  miradorUI.pend.forEach(p => { if(!hay.has(p.reserva_id)) track.insertAdjacentHTML("beforeend", tarjetaMiradorHTML(p)); });
  const vacio = track.querySelector(".mir-vacio");
  if(!miradorUI.pend.length && !track.querySelector(".mir-card")){
    if(!vacio) track.insertAdjacentHTML("beforeend", `<div class="mir-vacio"><p class="empty-title">Nadie pendiente</p><p class="muted">Cuando alguien escanee el QR al llegar, aparecerá aquí.</p></div>`);
  } else if(vacio) vacio.remove();
  marcarPosicion(dlg);
}
function tarjetas(dlg){ return [...dlg.querySelectorAll(".mir-card:not(.saliendo)")]; }
function indiceActual(dlg){
  const track = dlg.querySelector(".mir-track");
  const cards = tarjetas(dlg);
  if(!cards.length) return 0;
  const x = track.scrollLeft;
  let mejor = 0, dist = Infinity;
  cards.forEach((c, i) => { const d = Math.abs(c.offsetLeft - track.offsetLeft - x); if(d < dist){ dist = d; mejor = i; } });
  return mejor;
}
function irATarjeta(dlg, i, comportamiento){
  const cards = tarjetas(dlg);
  const c = cards[Math.max(0, Math.min(cards.length - 1, i))];
  if(!c) return;
  const track = dlg.querySelector(".mir-track");
  const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  track.scrollTo({ left: c.offsetLeft - track.offsetLeft, behavior: comportamiento || (reducido ? "instant" : "smooth") });
  setTimeout(()=> marcarPosicion(dlg), comportamiento === "instant" || reducido ? 0 : 380);
}
function moverMirador(dlg, d){ irATarjeta(dlg, indiceActual(dlg) + d); }
function marcarPosicion(dlg){
  const cards = tarjetas(dlg), n = cards.length, i = indiceActual(dlg);
  dlg.querySelector("#mirTitulo").textContent = n === 0 ? "Sin pendientes" : n === 1 ? "1 persona presente" : `${n} personas presentes`;
  dlg.querySelector(".mir-pos").textContent = n ? `${i + 1} de ${n}` : "";
  dlg.querySelector(".mir-nav").hidden = n < 2;
  dlg.querySelector("[data-mir-prev]").disabled = i <= 0;
  dlg.querySelector("[data-mir-next]").disabled = i >= n - 1;
  dlg.querySelector(".mir-puntos").innerHTML = n > 1 ? cards.map((c, k) => `<button type="button" tabindex="-1" data-i="${k}" class="${k === i ? "on" : ""}"></button>`).join("") : "";
}
async function guardarTarjeta(dlg, card, btn){
  const reserva = card.dataset.reserva;
  const p = miradorUI.pend.find(x => x.reserva_id === reserva);
  if(!p) return;
  const msg = card.querySelector(".mir-msg");
  await withBusy(btn, "Guardando…", async ()=>{
    const { error } = await sb.from("bitacora").insert({ atleta_id: p.atleta_id, reserva_id: reserva, ...leerCampos(card, card.dataset.pre) });
    if(error && !/23505|duplicate|unique/i.test((error.code || "") + " " + (error.message || ""))){ msg.textContent = errorES(error); return; }
    if(error) msg.textContent = "Otro coach ya guardó la bitácora de esta sesión.";
    delete miradorUI.borradores[reserva];
    delete miradorUI.hist[p.atleta_id];
    miradorUI.pend = miradorUI.pend.filter(x => x.reserva_id !== reserva);
    const i = tarjetas(dlg).indexOf(card);
    card.classList.add("saliendo");
    const fuera = ()=>{
      card.remove();
      if(!tarjetas(dlg).length){ sincronizarTarjetas(dlg); if(dlg.open) dlg.close(); pintarTurno(); return; }
      irATarjeta(dlg, Math.min(i, tarjetas(dlg).length - 1), "instant");
      pintarTurno();
    };
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches) fuera(); else setTimeout(fuera, error ? 900 : 320);
    if(document.getElementById("bitLista") && routeBitacoraId() === p.atleta_id) pintarHistorial(p.atleta_id);
  });
}

/* ---------- Sección Bitácora ---------- */
async function renderCoachBitacora(main){
  const id = routeBitacoraId();
  if(id){ await renderBitacoraAtleta(main, id); return; }
  const area = areaCoach();
  main.innerHTML = `<div class="detail"><header class="detail-head">
      <a class="back" href="#/">← Atletas</a>
      <p class="eyebrow">Herramienta del equipo</p><h1>Bitácora</h1>
      <p class="lede">El historial de trabajo de cada persona. Toca un nombre para ver su bitácora y escribir la de hoy.</p></header>
    <section class="panel span-12 bit-panel">
      <div class="bit-filtros">
        <label class="sr-only" for="bitBuscar">Buscar cliente</label>
        <input type="search" id="bitBuscar" placeholder="Buscar por nombre" value="${esc(bitUI.q)}" autocomplete="off">
        ${area ? "" : `<div class="seg" role="group" aria-label="Filtrar por categoría">${[["", "Todos"], ["terapia", "Terapia"], ["fortalecimiento", "Fortalecimiento"]].map(([v, t]) =>
          `<button type="button" data-bit-filtro="${v}" aria-pressed="${bitUI.filtro === v}">${t}</button>`).join("")}</div>`}
      </div>
      <div id="bitClientes"><div class="skel skel-block"></div></div>
    </section></div>`;
  const { data, error } = await sb.from("bitacora").select("atleta_id, fecha, created_at").order("fecha", { ascending: false }).order("created_at", { ascending: false }).limit(5000);
  if(routeCoachSeccion() !== "bitacora" || routeBitacoraId()) return;
  const resumen = {};
  (data || []).forEach(b => { const r = resumen[b.atleta_id] = resumen[b.atleta_id] || { n: 0, ultima: b.fecha }; r.n++; });
  const pintar = ()=>{
    const q = bitUI.q.trim().toLowerCase();
    const lista = (state.athleteList || []).filter(a =>
      (!bitUI.filtro || catsDe(a.categoria).includes(bitUI.filtro)) && (!q || (a.nombre || "").toLowerCase().includes(q)));
    const box = document.getElementById("bitClientes");
    if(!box) return;
    if(error){ box.innerHTML = `<div class="error" role="alert">${esc(errorES(error))}</div>`; return; }
    box.innerHTML = lista.length ? `<ul class="bit-clientes">${lista.map(a => {
      const r = resumen[a.id];
      return `<li><a href="#/bitacora/${encodeURIComponent(a.id)}">
        <span class="avatar" aria-hidden="true">${esc(initials(a.nombre))}</span>
        <span class="bit-cli"><strong>${esc(a.nombre || "(sin nombre)")}</strong>
          <span class="muted">${a.categoria ? esc(CATEGORIAS[a.categoria].nombre) + " · " : ""}${r ? `${plural(r.n, "entrada", "entradas")} · última ${fmtFecha(r.ultima)}` : "Sin entradas todavía"}</span></span>
        <span class="bit-ir" aria-hidden="true">›</span></a></li>`;
    }).join("")}</ul>` : emptyHTML(state.athleteList.length ? "Nadie coincide con la búsqueda." : "Todavía no hay clientes registrados.");
  };
  pintar();
  const buscar = document.getElementById("bitBuscar");
  buscar.oninput = ()=>{ bitUI.q = buscar.value; pintar(); };
  main.querySelectorAll("[data-bit-filtro]").forEach(b => { b.onclick = ()=>{
    bitUI.filtro = b.dataset.bitFiltro;
    main.querySelectorAll("[data-bit-filtro]").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    pintar();
  }; });
}
async function renderBitacoraAtleta(main, id){
  const a = (state.athleteList || []).find(x => x.id === id);
  if(!a){
    main.innerHTML = `<a class="back" href="#/bitacora">← Bitácora</a>
      <div class="empty" style="padding:48px 20px;margin-top:8px"><p class="empty-title">No encontramos a esta persona</p>
      <p>${areaCoach() ? "Puede que no sea de tu área." : "Puede que se haya borrado."}</p></div>`;
    return;
  }
  main.innerHTML = `<div class="detail"><header class="detail-head">
      <a class="back" href="#/bitacora">← Bitácora</a>
      <p class="eyebrow">Bitácora${a.categoria ? " · " + esc(CATEGORIAS[a.categoria].nombre) : ""}</p><h1>${esc(a.nombre || "(sin nombre)")}</h1>
      ${tieneLesion(a.lesiones) ? `<p class="lede"><strong>Lesión:</strong> ${esc(a.lesiones)}</p>` : ""}
      <div class="bit-head-acc"><button type="button" class="btn-primary" id="btnNuevaBit">+ Nueva entrada</button>
        <a class="btn-outline" href="#/atleta/${encodeURIComponent(a.id)}">Ver ficha</a></div></header>
    <section class="panel span-12" aria-labelledby="bitHist"><div class="panel-head"><h2 id="bitHist">Historial</h2><span class="muted" id="bitCuenta"></span></div>
      <div id="bitLista"><div class="skel skel-block"></div></div></section></div>`;
  document.getElementById("btnNuevaBit").onclick = ()=> abrirEntradaBitacora(a);
  await pintarHistorial(id);
}
async function pintarHistorial(id){
  const box = document.getElementById("bitLista");
  if(!box) return;
  const { data, error } = await sb.from("bitacora").select("*").eq("atleta_id", id).order("fecha", { ascending: false }).order("created_at", { ascending: false });
  if(!document.getElementById("bitLista") || routeBitacoraId() !== id) return;
  if(error){ box.innerHTML = `<div class="error" role="alert">${esc(errorES(error))}</div>`; return; }
  const lista = data || [];
  document.getElementById("bitCuenta").textContent = lista.length ? plural(lista.length, "entrada", "entradas") : "";
  if(!lista.length){ box.innerHTML = emptyHTML("Todavía no hay entradas. Se llena desde el Mirador cuando llega, o con «Nueva entrada»."); return; }
  const puede = (b)=> b.autor_id === state.profile.id || esMaster();
  box.innerHTML = `<ol class="bit-timeline">${lista.map(b => {
    const dolor = (b.dolor_inicio || b.dolor_salida) ? `<div class="bit-dolores">
      ${b.dolor_inicio ? `<span class="dolor-pill b-${nivelDolor(b.dolor_inicio)}">Llegó con <strong>${b.dolor_inicio}</strong>/10</span>` : ""}
      ${b.dolor_inicio && b.dolor_salida ? `<span aria-hidden="true">→</span>` : ""}
      ${b.dolor_salida ? `<span class="dolor-pill b-${nivelDolor(b.dolor_salida)}">Se fue con <strong>${b.dolor_salida}</strong>/10</span>` : ""}</div>` : "";
    const filas = BIT_CAMPOS.filter(([c]) => b[c]).map(([c, t]) => `<div class="bit-fila"><dt>${esc(t)}</dt><dd>${esc(b[c])}</dd></div>`);
    if(b.estiramientos !== null && b.estiramientos !== undefined) filas.splice(2, 0, `<div class="bit-fila"><dt>¿Hizo sus estiramientos?</dt><dd>${b.estiramientos ? "Sí" : "No"}</dd></div>`);
    return `<li class="bit-entrada">
      <div class="bit-meta"><strong>${esc(mayuscula(fechaLarga(b.fecha)))}${b.fecha.slice(0, 4) !== todayStr().slice(0, 4) ? " " + b.fecha.slice(0, 4) : ""}</strong>
        <span class="muted">por ${esc(b.autor_nombre || "el equipo")} · ${esc(horaDe(b.created_at))}${b.reserva_id ? " · sesión" : ""}</span></div>
      ${dolor}
      ${filas.length ? `<dl class="bit-datos">${filas.join("")}</dl>` : (dolor ? "" : `<p class="muted">Sin notas.</p>`)}
      ${puede(b) ? `<div class="bit-acc"><button type="button" class="btn-link" data-bit-editar="${esc(b.id)}">Editar</button><button type="button" class="btn-link danger" data-bit-borrar="${esc(b.id)}">Borrar</button></div>` : ""}
    </li>`;
  }).join("")}</ol>`;
  box.querySelectorAll("[data-bit-editar]").forEach(btn => { btn.onclick = ()=>{
    const b = lista.find(x => x.id === btn.dataset.bitEditar);
    abrirEntradaBitacora((state.athleteList || []).find(x => x.id === id), b);
  }; });
  box.querySelectorAll("[data-bit-borrar]").forEach(btn => { btn.onclick = ()=>{
    const dlg = openDialog("Borrar entrada", `<p>¿Borrar esta entrada de la bitácora? No se puede deshacer.</p>
      <div class="sheet-actions"><button type="button" class="btn-outline" data-no>Cancelar</button><button type="button" class="btn-danger" data-si>Borrar</button></div><div id="bitBorrarMsg"></div>`);
    dlg.el.querySelector("[data-no]").onclick = dlg.close;
    const si = dlg.el.querySelector("[data-si]");
    si.onclick = ()=> withBusy(si, "Borrando…", async ()=>{
      const { error: e } = await sb.from("bitacora").delete().eq("id", btn.dataset.bitBorrar);
      if(e){ showError(dlg.el.querySelector("#bitBorrarMsg"), e); return; }
      dlg.close(); pintarHistorial(id);
    });
  }; });
}
function abrirEntradaBitacora(a, previa){
  const pre = "nb_";
  const dlg = openDialog(previa ? "Editar entrada" : "Nueva entrada · " + primerNombre(a.nombre), `
    <p class="muted" style="margin-top:0">${previa ? esc(fechaLarga(previa.fecha)) + " · por " + esc(previa.autor_nombre || "el equipo") : "Hoy, " + esc(fechaLarga(todayStr())) + ". Ningún campo es obligatorio."}</p>
    ${camposBitacoraHTML(pre, previa || {})}
    <div id="nbMsg" aria-live="polite"></div>
    <button type="button" class="btn-primary" id="btnGuardarBit">Guardar</button>`);
  dlg.el.classList.add("bit-dialog");
  enlazarCampos(dlg.el);
  const btn = dlg.el.querySelector("#btnGuardarBit");
  btn.onclick = ()=> withBusy(btn, "Guardando…", async ()=>{
    const datos = leerCampos(dlg.el, pre);
    const { error } = previa
      ? await sb.from("bitacora").update(datos).eq("id", previa.id)
      : await sb.from("bitacora").insert({ atleta_id: a.id, ...datos });
    if(error){ showError(dlg.el.querySelector("#nbMsg"), error); return; }
    dlg.close();
    pintarHistorial(a.id);
  });
}
