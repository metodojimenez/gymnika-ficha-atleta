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
const ZONAS_DOLOR = ["Cabeza", "Cuello", "Hombro derecho", "Hombro izquierdo", "Codo derecho", "Codo izquierdo",
  "Muñeca o mano derecha", "Muñeca o mano izquierda", "Espalda alta", "Espalda media", "Zona lumbar", "Sacro o coxis",
  "Cadera derecha", "Cadera izquierda", "Ingle derecha", "Ingle izquierda", "Muslo derecho", "Muslo izquierdo",
  "Rodilla derecha", "Rodilla izquierda", "Pantorrilla derecha", "Pantorrilla izquierda",
  "Tobillo derecho", "Tobillo izquierdo", "Pie derecho", "Pie izquierdo"];
/* Zonas de una entrada; las entradas de antes (sin zonas) se leen como una zona general */
function zonasDe(d){
  if(d && Array.isArray(d.zonas) && d.zonas.length) return d.zonas;
  if(d && (d.dolor_inicio || d.dolor_salida)) return [{ zona: null, inicio: d.dolor_inicio || null, salida: d.dolor_salida || null }];
  return [];
}
const nombreZona = (z)=> (z && z.zona) || "Zona general";
function burbujasFila(name, valor, etiqueta){
  return `<div class="burbujas" role="radiogroup" aria-label="${esc(etiqueta)}">${[1,2,3,4,5,6,7,8,9,10].map(n => `
    <label class="burbuja b-${nivelDolor(n)}"><input type="radio" name="${name}" value="${n}"${Number(valor) === n ? " checked" : ""}><span>${n}</span></label>`).join("")}</div>`;
}
function zonaLlegadaHTML(pre, k, z = {}){
  const otra = z.zona && !ZONAS_DOLOR.includes(z.zona);
  return `<div class="zona-row" data-z="${k}">
    <div class="zona-top">
      <label class="sr-only" for="${pre}zsel${k}">Zona de dolor</label>
      <select id="${pre}zsel${k}" data-zona-sel>
        <option value="">Zona general</option>
        ${ZONAS_DOLOR.map(n => `<option${z.zona === n ? " selected" : ""}>${esc(n)}</option>`).join("")}
        <option value="__otra"${otra ? " selected" : ""}>Otra zona…</option>
      </select>
      <button type="button" class="icon-btn zona-quitar" data-zona-quitar aria-label="Quitar esta zona">✕</button>
    </div>
    <input type="text" class="zona-otra" data-zona-otra maxlength="60" placeholder="Escribe la zona" aria-label="Otra zona" value="${otra ? esc(z.zona) : ""}"${otra ? "" : " hidden"}>
    ${burbujasFila(`${pre}zi${k}`, z.inicio, "Dolor al llegar")}
  </div>`;
}
function zonaSalidaHTML(pre, k, z = {}){
  return `<div class="zona-row" data-z="${k}"><p class="zona-nombre">${esc(nombreZona(z))}</p>${burbujasFila(`${pre}zs${k}`, z.salida, "Dolor al irse")}</div>`;
}
function camposBitacoraHTML(pre, d = {}){
  const t = (campo, titulo)=> `<div class="bit-campo"><label for="${pre}${campo}">${esc(titulo)}</label>
    <textarea id="${pre}${campo}" data-campo="${campo}" rows="2">${esc(d[campo] || "")}</textarea></div>`;
  const zonas = zonasDe(d).length ? zonasDe(d) : [{}];
  return `<div class="bit-campos" data-pre="${pre}" data-zn="${zonas.length}">
    <fieldset class="bit-zonas" data-lista="llegada"><legend>Dolor al llegar</legend>
      <div class="zonas-lista">${zonas.map((z, k) => zonaLlegadaHTML(pre, k, z)).join("")}</div>
      <button type="button" class="btn-outline sm zona-add" data-zona-add>+ Agregar zona</button></fieldset>
    ${t("como_llego", "¿Cómo llegó?")}
    ${t("que_hizo", "¿Qué hizo hoy?")}
    ${t("que_ocurrio", "¿Qué ocurrió?")}
    <fieldset class="bit-si-no"><legend>¿Hizo sus estiramientos?</legend>
      <div class="seg">
        <label><input type="radio" name="${pre}estiramientos" value="si"${d.estiramientos === true ? " checked" : ""}><span>Sí</span></label>
        <label><input type="radio" name="${pre}estiramientos" value="no"${d.estiramientos === false ? " checked" : ""}><span>No</span></label>
      </div></fieldset>
    ${t("pendiente", "¿Pendiente para la próxima?")}
    <fieldset class="bit-zonas" data-lista="salida"><legend>¿Con cuánto dolor se va?</legend>
      <div class="zonas-lista">${zonas.map((z, k) => zonaSalidaHTML(pre, k, z)).join("")}</div></fieldset>
    <div class="bit-fotos-campo"><p class="bit-fotos-tit">Fotos</p>
      <div class="fotos-previa">${(d._fotos || []).map(f => `<div class="foto-mini" data-foto-id="${esc(f.id)}">
        <img src="${esc(f.url || "")}" alt="Foto guardada"><button type="button" class="foto-quitar" data-foto-quitar aria-label="Quitar foto">✕</button></div>`).join("")}</div>
      <label class="btn-outline sm foto-add"><span aria-hidden="true">📷</span> Agregar fotos<input type="file" accept="image/*" multiple data-fotos class="sr-only"></label>
    </div>
  </div>`;
}
/* Tocar la burbuja o la opción marcada la desmarca (ningún campo es obligatorio) + agregar, quitar y nombrar zonas */
function enlazarCampos(box){
  box.addEventListener("pointerdown", (e)=>{
    const inp = e.target.closest("label")?.querySelector("input[type=radio]");
    if(inp) inp.dataset.estaba = inp.checked ? "1" : "";
  });
  const filas = (campos, k)=> campos.querySelectorAll(`.zona-row[data-z="${k}"]`);
  const renombrar = (row)=>{
    const campos = row.closest(".bit-campos");
    const sel = row.querySelector("[data-zona-sel]"), otra = row.querySelector("[data-zona-otra]");
    const nombre = sel.value === "__otra" ? (otra.value.trim() || "Otra zona") : (sel.value || "Zona general");
    const sal = campos.querySelector(`[data-lista="salida"] .zona-row[data-z="${row.dataset.z}"] .zona-nombre`);
    if(sal) sal.textContent = nombre;
  };
  box.addEventListener("click", (e)=>{
    const inp = e.target.closest("input[type=radio]");
    if(inp && inp.dataset.estaba === "1"){ inp.checked = false; inp.dataset.estaba = ""; inp.dispatchEvent(new Event("change", { bubbles: true })); return; }
    const add = e.target.closest("[data-zona-add]");
    if(add){
      const campos = add.closest(".bit-campos"), pre = campos.dataset.pre, k = Number(campos.dataset.zn || 0);
      campos.dataset.zn = k + 1;
      campos.querySelector('[data-lista="llegada"] .zonas-lista').insertAdjacentHTML("beforeend", zonaLlegadaHTML(pre, k));
      campos.querySelector('[data-lista="salida"] .zonas-lista').insertAdjacentHTML("beforeend", zonaSalidaHTML(pre, k));
      campos.querySelector(`[data-lista="llegada"] .zona-row[data-z="${k}"] select`).focus();
      return;
    }
    const quitar = e.target.closest("[data-zona-quitar]");
    if(quitar){
      const row = quitar.closest(".zona-row"), campos = row.closest(".bit-campos");
      filas(campos, row.dataset.z).forEach(f => f.remove());
    }
  });
  box.addEventListener("change", (e)=>{
    const sel = e.target.closest("[data-zona-sel]");
    if(!sel) return;
    const row = sel.closest(".zona-row"), otra = row.querySelector("[data-zona-otra]");
    otra.hidden = sel.value !== "__otra";
    if(!otra.hidden) otra.focus();
    renombrar(row);
  });
  box.addEventListener("input", (e)=>{ if(e.target.closest("[data-zona-otra]")) renombrar(e.target.closest(".zona-row")); });
  /* Fotos: se eligen (cámara o galería), se ven en miniatura y se suben al guardar */
  box.addEventListener("change", (e)=>{
    const inp = e.target.closest("[data-fotos]");
    if(!inp) return;
    const campos = inp.closest(".bit-campos"), previa = campos.querySelector(".fotos-previa");
    const lista = fotosUI.nuevas.get(campos) || [];
    [...inp.files].filter(f => /^image\//.test(f.type) || /\.(heic|heif)$/i.test(f.name)).forEach(f => {
      lista.push(f);
      previa.insertAdjacentHTML("beforeend", `<div class="foto-mini nueva" data-nueva="${lista.length - 1}">
        <img src="${URL.createObjectURL(f)}" alt="Foto nueva"><button type="button" class="foto-quitar" data-foto-quitar aria-label="Quitar foto">✕</button></div>`);
    });
    fotosUI.nuevas.set(campos, lista);
    inp.value = "";
  });
  box.addEventListener("click", (e)=>{
    const q = e.target.closest("[data-foto-quitar]");
    if(!q) return;
    const mini = q.closest(".foto-mini"), campos = mini.closest(".bit-campos");
    if(mini.dataset.fotoId){ const b = fotosUI.borrar.get(campos) || []; b.push(mini.dataset.fotoId); fotosUI.borrar.set(campos, b); }
    else { const l = fotosUI.nuevas.get(campos) || []; l[Number(mini.dataset.nueva)] = null; }
    mini.remove();
  });
}
const fotosUI = { nuevas: new WeakMap(), borrar: new WeakMap() };
function fotosDe(box){
  const campos = box.matches(".bit-campos") ? box : box.querySelector(".bit-campos");
  return { nuevas: (fotosUI.nuevas.get(campos) || []).filter(Boolean), borrar: fotosUI.borrar.get(campos) || [] };
}
/* Achica la foto (máx. 1600 px, JPEG) para que suba rápido desde el celular */
async function prepararFoto(file){
  try{
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, "image/jpeg", 0.82));
    if(blob) return blob;
  } catch { /* el navegador no la pudo leer: se sube tal cual */ }
  return file;
}
async function subirFotos(atletaId, entradaId, files){
  let fallas = 0;
  for(let i = 0; i < files.length; i++){
    const listo = await prepararFoto(files[i]);
    const ext = listo.type === "image/jpeg" ? "jpg" : ((files[i].name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg");
    const path = `${atletaId}/${entradaId}/${Date.now()}-${i}.${ext}`;
    const { error: e1 } = await sb.storage.from("bitacora").upload(path, listo, { contentType: listo.type || "image/jpeg", upsert: false });
    if(e1){ console.error(e1); fallas++; continue; }
    const { error: e2 } = await sb.from("bitacora_fotos").insert({ bitacora_id: entradaId, atleta_id: atletaId, path, autor_id: state.profile.id });
    if(e2){ console.error(e2); fallas++; sb.storage.from("bitacora").remove([path]); }
  }
  return fallas;
}
async function borrarFotos(fotos){
  if(!fotos.length) return;
  await sb.storage.from("bitacora").remove(fotos.map(f => f.path));
  await sb.from("bitacora_fotos").delete().in("id", fotos.map(f => f.id));
}
/* Fotos de un alumno con su enlace temporal (1 h) */
async function cargarFotos(atletaId){
  const { data, error } = await sb.from("bitacora_fotos").select("id, bitacora_id, path, created_at").eq("atleta_id", atletaId).order("created_at");
  if(error || !data || !data.length) return [];
  const { data: urls } = await sb.storage.from("bitacora").createSignedUrls(data.map(f => f.path), 3600);
  const url = {}; (urls || []).forEach(u => { if(u && u.signedUrl) url[u.path] = u.signedUrl; });
  return data.map(f => ({ ...f, url: url[f.path] || null }));
}
function verFoto(url){
  openDialog("Foto de la bitácora", `<img class="foto-grande" src="${esc(url)}" alt="Foto de la bitácora">`).el.classList.add("foto-dialog");
}
function leerCampos(box, pre){
  const radio = (nombre)=> box.querySelector(`input[name="${pre}${nombre}"]:checked`);
  const d = {};
  BIT_CAMPOS.forEach(([c]) => { const v = (box.querySelector(`[data-campo="${c}"]`)?.value || "").trim(); d[c] = v || null; });
  const zonas = [];
  box.querySelectorAll('[data-lista="llegada"] .zona-row').forEach(row => {
    const k = row.dataset.z, sel = row.querySelector("[data-zona-sel]").value;
    const zona = sel === "__otra" ? (row.querySelector("[data-zona-otra]").value.trim() || null) : (sel || null);
    const i = radio("zi" + k), s = radio("zs" + k);
    const z = { zona, inicio: i ? Number(i.value) : null, salida: s ? Number(s.value) : null };
    if(z.zona || z.inicio || z.salida) zonas.push(z);
  });
  d.zonas = zonas.length ? zonas : null;
  const max = (c)=> zonas.reduce((m, z) => z[c] && z[c] > (m || 0) ? z[c] : m, null);
  d.dolor_inicio = max("inicio"); d.dolor_salida = max("salida");
  const e = radio("estiramientos");
  d.estiramientos = e ? e.value === "si" : null;
  return d;
}
/* Dolor por zona para el historial: «Rodilla derecha 7 → 3» */
function dolorZonasHTML(b){
  const zonas = zonasDe(b).filter(z => z.inicio || z.salida);
  if(!zonas.length) return "";
  return `<div class="bit-dolores">${zonas.map(z => `<div class="dolor-zona"><span class="dz-nombre">${esc(nombreZona(z))}</span>
    ${z.inicio ? `<span class="dolor-pill b-${nivelDolor(z.inicio)}">Llegó <strong>${z.inicio}</strong></span>` : ""}
    ${z.inicio && z.salida ? `<span aria-hidden="true">→</span>` : ""}
    ${z.salida ? `<span class="dolor-pill b-${nivelDolor(z.salida)}">Se fue <strong>${z.salida}</strong></span>` : ""}</div>`).join("")}</div>`;
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
    const { data, error } = await sb.from("bitacora").select("id, atleta_id, fecha, created_at, autor_nombre, dolor_inicio, dolor_salida, zonas, como_llego, que_hizo, que_ocurrio, estiramientos, pendiente")
      .eq("atleta_id", id).order("fecha", { ascending: false }).order("created_at", { ascending: false }).limit(5);
    if(!error) miradorUI.hist[id] = data || [];
  }));
}
function referenciasHTML(lista){
  if(!lista) return "";
  if(!lista.length) return `<p class="mir-ref-vacio muted">Primera vez en la bitácora: todavía no hay sesiones anteriores.</p>`;
  const ant = lista[0];
  const quien = (b)=> `${esc(fmtFecha(b.fecha))}${b.autor_nombre ? " · " + esc(primerNombre(b.autor_nombre)) : ""}`;
  const dolor = (b)=> zonasDe(b).filter(z => z.inicio || z.salida).map(z =>
    `<span class="mir-ult-dolor">${esc(z.zona || "Dolor")} ${z.inicio || "–"} → ${z.salida || "–"}</span>`).join("");
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
    const { data: nueva, error } = await sb.from("bitacora").insert({ atleta_id: p.atleta_id, reserva_id: reserva, ...leerCampos(card, card.dataset.pre) }).select("id").single();
    if(error && !/23505|duplicate|unique/i.test((error.code || "") + " " + (error.message || ""))){ msg.textContent = errorES(error); return; }
    if(error) msg.textContent = "Otro coach ya guardó la bitácora de esta sesión.";
    let fallas = 0;
    const fotos = fotosDe(card).nuevas;
    if(!error && nueva && fotos.length){ msg.textContent = "Subiendo fotos…"; fallas = await subirFotos(p.atleta_id, nueva.id, fotos); }
    if(fallas) msg.textContent = `Se guardó, pero ${plural(fallas, "foto no se subió", "fotos no se subieron")}. Agrégalas desde la Bitácora.`;
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
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches && !fallas) fuera(); else setTimeout(fuera, error || fallas ? 2200 : 320);
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
  const fotos = await cargarFotos(id);
  if(!document.getElementById("bitLista") || routeBitacoraId() !== id) return;
  lista.forEach(b => { b._fotos = fotos.filter(f => f.bitacora_id === b.id); });
  document.getElementById("bitCuenta").textContent = lista.length ? plural(lista.length, "entrada", "entradas") : "";
  if(!lista.length){ box.innerHTML = emptyHTML("Todavía no hay entradas. Se llena desde el Mirador cuando llega, o con «Nueva entrada»."); return; }
  const puede = (b)=> b.autor_id === state.profile.id || esMaster();
  box.innerHTML = `<ol class="bit-timeline">${lista.map(b => {
    const dolor = dolorZonasHTML(b);
    const filas = BIT_CAMPOS.filter(([c]) => b[c]).map(([c, t]) => `<div class="bit-fila"><dt>${esc(t)}</dt><dd>${esc(b[c])}</dd></div>`);
    if(b.estiramientos !== null && b.estiramientos !== undefined) filas.splice(2, 0, `<div class="bit-fila"><dt>¿Hizo sus estiramientos?</dt><dd>${b.estiramientos ? "Sí" : "No"}</dd></div>`);
    return `<li class="bit-entrada">
      <div class="bit-meta"><strong>${esc(mayuscula(fechaLarga(b.fecha)))}${b.fecha.slice(0, 4) !== todayStr().slice(0, 4) ? " " + b.fecha.slice(0, 4) : ""}</strong>
        <span class="muted">por ${esc(b.autor_nombre || "el equipo")} · ${esc(horaDe(b.created_at))}${b.reserva_id ? " · sesión" : ""}</span></div>
      ${dolor}
      ${filas.length ? `<dl class="bit-datos">${filas.join("")}</dl>` : (dolor || b._fotos.length ? "" : `<p class="muted">Sin notas.</p>`)}
      ${b._fotos.length ? `<div class="bit-fotos">${b._fotos.map(f => f.url ? `<button type="button" class="foto-mini" data-ver-foto="${esc(f.url)}" aria-label="Ver foto"><img src="${esc(f.url)}" alt="" loading="lazy"></button>` : "").join("")}</div>` : ""}
      ${puede(b) ? `<div class="bit-acc"><button type="button" class="btn-link" data-bit-editar="${esc(b.id)}">Editar</button><button type="button" class="btn-link danger" data-bit-borrar="${esc(b.id)}">Borrar</button></div>` : ""}
    </li>`;
  }).join("")}</ol>`;
  box.querySelectorAll("[data-ver-foto]").forEach(b => { b.onclick = ()=> verFoto(b.dataset.verFoto); });
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
      const entrada = lista.find(x => x.id === btn.dataset.bitBorrar);
      if(entrada && entrada._fotos.length) await borrarFotos(entrada._fotos);
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
    const msg = dlg.el.querySelector("#nbMsg");
    const { data: fila, error } = previa
      ? await sb.from("bitacora").update(datos).eq("id", previa.id).select("id").single()
      : await sb.from("bitacora").insert({ atleta_id: a.id, ...datos }).select("id").single();
    if(error){ showError(msg, error); return; }
    const { nuevas, borrar } = fotosDe(dlg.el);
    if(borrar.length) await borrarFotos((previa._fotos || []).filter(f => borrar.includes(f.id)));
    let fallas = 0;
    if(nuevas.length){ showMsg(msg, "ok", "Subiendo fotos…"); fallas = await subirFotos(a.id, (fila && fila.id) || (previa && previa.id), nuevas); }
    if(fallas){ showMsg(msg, "error", `Se guardó, pero ${plural(fallas, "foto no se subió", "fotos no se subieron")}. Inténtalo de nuevo con «Editar».`); pintarHistorial(a.id); return; }
    dlg.close();
    pintarHistorial(a.id);
  });
}
