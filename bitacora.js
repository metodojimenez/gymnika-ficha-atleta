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
const miradorUI = { turno: null, pend: [], vistos: new Set(), cargando: false, borradores: {}, hist: {}, manuales: [], timers: {}, enviado: {}, guardados: new Set() };
const bitUI = { filtro: "", q: "" };

function routeBitacoraId(){
  const m = location.hash.match(/^#\/bitacora\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}
const mayuscula = (t)=> String(t || "").charAt(0).toUpperCase() + String(t || "").slice(1);
const hayValor = (v)=> v !== null && v !== undefined && v !== "";
const nivelDolor = (n)=> n >= 7 ? "alto" : n >= 4 ? "medio" : "bajo";

/* ---------- Campos (los mismos en el Mirador y en «Nueva entrada») ---------- */
/* Las mismas zonas de la silueta 3D (silueta.js), de la cabeza a los pies */
const ZONAS_DOLOR = SIL_ZONAS_LISTA;
/* Zonas de una entrada; las entradas de antes (sin zonas) se leen como una zona general */
function zonasDe(d){
  if(d && Array.isArray(d.zonas) && d.zonas.length) return d.zonas;
  if(d && (hayValor(d.dolor_inicio) || hayValor(d.dolor_salida))) return [{ zona: null, inicio: hayValor(d.dolor_inicio) ? d.dolor_inicio : null, salida: hayValor(d.dolor_salida) ? d.dolor_salida : null }];
  return [];
}
const nombreZona = (z)=> (z && z.zona) || "Zona general";
function burbujasFila(name, valor, etiqueta){
  return `<div class="burbujas" role="radiogroup" aria-label="${esc(etiqueta)}">${[0,1,2,3,4,5,6,7,8,9,10].map(n => `
    <label class="burbuja b-${nivelDolor(n)}"><input type="radio" name="${name}" value="${n}"${hayValor(valor) && Number(valor) === n ? " checked" : ""}><span>${n}</span></label>`).join("")}</div>`;
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
    <label class="sr-only" for="${pre}znota${k}">Comentario del dolor</label>
    <textarea class="zona-nota" id="${pre}znota${k}" data-zona-nota rows="1" maxlength="300" placeholder="Comentario del dolor (opcional)">${esc(z.nota || "")}</textarea>
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
      <div class="zona-botones"><button type="button" class="btn-outline sm" data-zona-cuerpo>Marcar en el cuerpo</button>
      <button type="button" class="btn-outline sm zona-add" data-zona-add>+ Agregar zona</button></div></fieldset>
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
      <div class="foto-botones">
        <label class="btn-outline sm foto-add"><span aria-hidden="true">📷</span> Tomar foto<input type="file" accept="image/*" capture="environment" data-fotos class="sr-only"></label>
        <label class="btn-outline sm foto-add"><span aria-hidden="true">🖼️</span> Elegir de la galería<input type="file" accept="image/*" multiple data-fotos class="sr-only"></label>
      </div>
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
    const cuerpoBtn = e.target.closest("[data-zona-cuerpo]");
    if(cuerpoBtn){ abrirSiluetaCampos(cuerpoBtn.closest(".bit-campos")); return; }
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
/* ---------- Silueta: marcar el dolor de llegada tocando el cuerpo ---------- */
const nombreFila = (row)=>{
  const sel = row.querySelector("[data-zona-sel]").value;
  return sel === "__otra" ? (row.querySelector("[data-zona-otra]").value.trim() || null) : (sel || null);
};
function abrirSiluetaCampos(campos){
  if(!campos) return;
  const atleta = campos.closest("[data-atleta]")?.dataset.atleta || null;
  const a = (state.athleteList || []).find(x => x.id === atleta);
  const zonas = (leerCampos(campos, campos.dataset.pre).zonas || []).filter(z => z.zona && hayValor(z.inicio));
  abrirSilueta({
    titulo: a ? primerNombre(a.nombre) + " · ¿dónde le duele?" : "¿Dónde le duele?",
    zonas, maldita: atleta ? (state.maldita || {})[atleta] || null : null,
    onMaldita: atleta ? (nombre)=> guardarZonaMaldita(atleta, nombre) : null,
    onListo: (zs)=> aplicarZonasSilueta(campos, zs),
    alCambiar: campos.closest(".mir-card") ? (zs)=>{ if(campos.isConnected) aplicarZonasSilueta(campos, zs); } : null,
    compartir: campos.closest(".mir-card") && atleta ? { clave: campos.closest(".mir-card").dataset.reserva, atleta } : null
  });
}
async function guardarZonaMaldita(atleta, nombre){
  const { error } = await sb.from("ficha_interna").upsert({ user_id: atleta, zona_maldita: nombre, zona_maldita_por: state.profile.id, zona_maldita_at: new Date().toISOString() });
  if(error) return errorES(error);
  state.maldita = state.maldita || {};
  if(nombre) state.maldita[atleta] = nombre; else delete state.maldita[atleta];
  document.querySelectorAll(`[data-maldita-de="${atleta}"]`).forEach(el => { el.outerHTML = malditaChipHTML(atleta); });
  return null;
}
function malditaChipHTML(atleta){
  const z = (state.maldita || {})[atleta];
  return `<span data-maldita-de="${esc(atleta)}">${z ? `<span class="maldita-chip" title="Zona principal de dolor">Zona maldita: ${esc(z)}</span>` : ""}</span>`;
}
/* Pasa lo marcado en la silueta a las filas de «Dolor al llegar» (y su par en «¿Con cuánto dolor se va?») */
function aplicarZonasSilueta(campos, zs){
  const pre = campos.dataset.pre;
  const lleg = campos.querySelector('[data-lista="llegada"] .zonas-lista'), sal = campos.querySelector('[data-lista="salida"] .zonas-lista');
  const filas = ()=> [...lleg.querySelectorAll(".zona-row")];
  const marcar = (row, n)=>{
    row.querySelectorAll(`input[name="${pre}zi${row.dataset.z}"]`).forEach(i => { i.checked = Number(i.value) === n; });
  };
  const porId = new Map(filas().map(r => [silIdDeNombre(nombreFila(r)) || nombreFila(r), r]));
  /* Las de la silueta que ya no están marcadas: se quitan (si no tienen dolor de salida) */
  const nuevos = new Set(zs.map(z => silIdDeNombre(z.zona)));
  filas().forEach(r => {
    const nom = nombreFila(r);
    if(!nom || !silIdDeNombre(nom) || nuevos.has(silIdDeNombre(nom))) return;
    const k = r.dataset.z, tieneSalida = campos.querySelector(`input[name="${pre}zs${k}"]:checked`);
    if(tieneSalida) marcar(r, -1);
    else campos.querySelectorAll(`.zona-row[data-z="${k}"]`).forEach(f => f.remove());
  });
  zs.forEach(z => {
    let row = porId.get(silIdDeNombre(z.zona));
    if(row && row.isConnected && nombreFila(row) !== z.zona){
      /* Nombre de antes (p. ej. «Zona lumbar»): pasa al de la silueta */
      const sel = row.querySelector("[data-zona-sel]"), otra = row.querySelector("[data-zona-otra]");
      sel.value = z.zona; otra.value = ""; otra.hidden = true;
      const n = sal.querySelector(`.zona-row[data-z="${row.dataset.z}"] .zona-nombre`); if(n) n.textContent = z.zona;
    }
    if(!row || !row.isConnected){
      /* Reusar la fila vacía del inicio si no tiene nada */
      const vacia = filas().find(r => !nombreFila(r) && !r.querySelector(`input[name="${pre}zi${r.dataset.z}"]:checked`) && !campos.querySelector(`input[name="${pre}zs${r.dataset.z}"]:checked`));
      if(vacia){ vacia.querySelector("[data-zona-sel]").value = z.zona; row = vacia; }
      else {
        const k = Number(campos.dataset.zn || 0);
        campos.dataset.zn = k + 1;
        lleg.insertAdjacentHTML("beforeend", zonaLlegadaHTML(pre, k, { zona: z.zona }));
        sal.insertAdjacentHTML("beforeend", zonaSalidaHTML(pre, k, { zona: z.zona }));
        row = lleg.querySelector(`.zona-row[data-z="${k}"]`);
      }
      const n = sal.querySelector(`.zona-row[data-z="${row.dataset.z}"] .zona-nombre`); if(n) n.textContent = z.zona;
    }
    marcar(row, z.inicio);
    const nt = row.querySelector("[data-zona-nota]"); if(nt) nt.value = z.nota || "";
  });
  if(!filas().length){
    const k = Number(campos.dataset.zn || 0); campos.dataset.zn = k + 1;
    lleg.insertAdjacentHTML("beforeend", zonaLlegadaHTML(pre, k)); sal.insertAdjacentHTML("beforeend", zonaSalidaHTML(pre, k));
  }
  campos.dispatchEvent(new Event("input", { bubbles: true }));
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
    const nota = (row.querySelector("[data-zona-nota]")?.value || "").trim();
    if(nota) z.nota = nota;
    if(z.zona || hayValor(z.inicio) || hayValor(z.salida) || nota) zonas.push(z);
  });
  d.zonas = zonas.length ? zonas : null;
  const max = (c)=> zonas.reduce((m, z) => hayValor(z[c]) && (m === null || z[c] > m) ? z[c] : m, null);
  d.dolor_inicio = max("inicio"); d.dolor_salida = max("salida");
  const e = radio("estiramientos");
  d.estiramientos = e ? e.value === "si" : null;
  return d;
}
/* Dolor por zona para el historial: «Rodilla derecha 7 → 3» */
function dolorZonasHTML(b){
  const zonas = zonasDe(b).filter(z => hayValor(z.inicio) || hayValor(z.salida) || z.nota);
  if(!zonas.length) return "";
  return `<div class="bit-dolores">${zonas.map(z => `<div class="dolor-zona"><span class="dz-nombre">${esc(nombreZona(z))}</span>
    ${hayValor(z.inicio) ? `<span class="dolor-pill b-${nivelDolor(z.inicio)}">Llegó <strong>${z.inicio}</strong></span>` : ""}
    ${hayValor(z.inicio) && hayValor(z.salida) ? `<span aria-hidden="true">→</span>` : ""}
    ${hayValor(z.salida) ? `<span class="dolor-pill b-${nivelDolor(z.salida)}">Se fue <strong>${z.salida}</strong></span>` : ""}
    ${z.nota ? `<span class="dz-nota">«${esc(z.nota)}»</span>` : ""}</div>`).join("")}</div>`;
}

/* ---------- Turno ---------- */
async function cargarTurno(){
  if(!esEquipo()) return;
  const { data, error } = await sb.from("turnos_coach").select("id, inicio").eq("coach_id", state.profile.id).is("fin", null).limit(1);
  if(error){ console.error(error); return; }
  miradorUI.turno = (data || [])[0] || null;
  /* Si quedó abierto de otro día, la base lo cierra sola: aquí tampoco cuenta */
  if(miradorUI.turno && String(new Date(miradorUI.turno.inicio).toLocaleDateString("en-CA", { timeZone: "America/Lima" })) !== todayStr()) miradorUI.turno = null;
  miradorUI.manuales = await cargarManuales();
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
        <button type="button" class="btn-outline sm" data-agregar-mirador>+ Agregar persona</button>
        <button type="button" class="btn-danger sm" data-fin-turno>Fin de turno</button></div>` : `
      <span class="turno-luz off" aria-hidden="true"></span>
      <div class="turno-txt"><strong>No has iniciado tu turno</strong>
        <span class="muted">Escanea el QR de recepción al llegar. Así se activa el Mirador con cada persona que llegue.</span></div>
      <div class="turno-acc"><button type="button" class="btn-primary sm" data-escanear-turno>Escanear QR · iniciar turno</button></div>`;
    bar.querySelector("[data-abrir-mirador]")?.addEventListener("click", ()=> abrirMirador());
    bar.querySelector("[data-agregar-mirador]")?.addEventListener("click", ()=> abrirAgregarMirador());
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
    const [{ data: todos, error }, manuales, { data: bors }] = await Promise.all([
      sb.rpc("mirador_pendientes"), cargarManuales(),
      sb.from("mirador_borradores").select("clave, datos, autor_id, autor_nombre, updated_at").eq("fecha", todayStr())
    ]);
    if(error){ console.error(error); return; }
    /* Fortalecimiento no entra como tarjeta: se lleva en la vista «Asistencia» */
    const data = (todos || []).filter(x => x.categoria !== "fortalecimiento");
    miradorUI.manuales = manuales;
    (bors || []).forEach(b => recibirBorrador(b, true));
    const lista = (data || []).concat(miradorUI.manuales.filter(m => !(data || []).some(x => x.reserva_id === m.reserva_id || (m.sinReserva && x.atleta_id === m.atleta_id))));
    await cargarReferencias(lista.map(p => p.atleta_id));
    const nuevos = lista.filter(p => !miradorUI.vistos.has(p.reserva_id));
    nuevos.forEach(p => miradorUI.vistos.add(p.reserva_id));
    miradorUI.pend = lista;
    pintarTurno();
    const dlg = document.getElementById("modalMirador");
    if(dlg && dlg.open){ sincronizarTarjetas(dlg); if(miradorUI.vista === "asis") verAsistenciaFort(dlg, true); }
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
  const dolor = (b)=> zonasDe(b).filter(z => hayValor(z.inicio) || hayValor(z.salida)).map(z =>
    `<span class="mir-ult-dolor">${esc(z.zona || "Dolor")} ${hayValor(z.inicio) ? z.inicio : "–"} → ${hayValor(z.salida) ? z.salida : "–"}${z.nota ? ` · «${esc(z.nota)}»` : ""}</span>`).join("");
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
  return `<article class="mir-card" data-reserva="${esc(p.reserva_id)}" data-atleta="${esc(p.atleta_id)}" data-pre="${pre}" aria-label="${esc(p.nombre || "Alumno")}">
    <header class="mir-head"><span class="avatar" aria-hidden="true">${esc(initials(p.nombre || ""))}</span>
      <div><h3>${esc(p.nombre || "Alumno")}</h3>
        <p class="muted">${esc(cat)}${p.sinReserva ? ` · sin reserva · agregado a las ${esc(horaDe(p.checkin_at))}` : p.diaSesion && p.diaSesion !== todayStr() ? ` · ${esc(horaDe(p.inicio))}` : ` · ${esc(horaDe(p.inicio))} · llegó ${esc(horaDe(p.checkin_at))}`}</p></div>
      <a class="link-inline mir-hist" href="#/bitacora/${encodeURIComponent(p.atleta_id)}" data-ir-bitacora>Historial</a></header>
    ${p.diaSesion && p.diaSesion !== todayStr() ? `<p class="mir-otro-dia">Sesión del ${esc(fechaLarga(p.diaSesion).toLowerCase())} · se sube hoy</p>` : ""}
    ${malditaChipHTML(p.atleta_id)}<p class="mir-vivo" hidden></p>
    ${tieneLesion(p.lesiones) ? `<p class="mir-lesion"><strong>Lesión:</strong> ${esc(p.lesiones)}</p>` : ""}
    ${referenciasHTML(miradorUI.hist[p.atleta_id])}
    ${camposBitacoraHTML(pre, miradorUI.borradores[p.reserva_id] || {})}
    <div class="mir-acc">${p.sinReserva ? `<button type="button" class="btn-link" data-mir-quitar>Quitar del Mirador</button>` : ""}<span class="mir-msg" aria-live="polite"></span><button type="button" class="btn-primary" data-guardar-mir>Guardar</button></div>
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
        <button type="button" class="btn-outline sm mir-agregar" data-mir-agregar>+ Agregar</button>
        <button type="button" class="icon-btn" data-mir-cerrar aria-label="Cerrar el Mirador">✕</button></div>
      <div class="mir-horas" role="group" aria-label="Ver el turno por horas"></div>
      <div class="mir-hora" hidden aria-live="polite"></div>
      <div class="mir-nav"><button type="button" class="icon-btn" data-mir-prev aria-label="Anterior">‹</button>
        <span class="mir-pos num" aria-live="polite"></span>
        <button type="button" class="icon-btn" data-mir-next aria-label="Siguiente">›</button></div>
      <div class="mir-track" tabindex="-1"></div>
      <div class="mir-puntos" aria-hidden="true"></div>
      <div class="mir-pie"><button type="button" class="btn-link" data-mir-fin>Fin de turno</button><button type="button" class="btn-outline sm" data-mir-cerrar>Cerrar por ahora</button></div>`;
    document.body.appendChild(dlg);
    const track = dlg.querySelector(".mir-track");
    enlazarCampos(track);
    const alEscribir = (e)=>{ const card = e.target.closest && e.target.closest(".mir-card"); if(card) programarBorrador(card); };
    track.addEventListener("input", alEscribir);
    track.addEventListener("change", alEscribir);
    const cerrar = ()=>{ guardarBorradores(dlg); if(dlg.open) dlg.close(); pintarTurno(); };
    dlg.addEventListener("cancel", (e)=>{ e.preventDefault(); cerrar(); });
    dlg.addEventListener("click", (e)=>{
      if(e.target.closest("[data-mir-cerrar]")){ cerrar(); return; }
      if(e.target.closest("[data-mir-fin]")){ cerrar(); confirmarFinTurno(); return; }
      if(e.target.closest("[data-ir-bitacora]")){ cerrar(); return; }
      if(e.target.closest("[data-mir-agregar]")){ cerrar(); abrirAgregarMirador(); return; }
      const qt = e.target.closest("[data-mir-quitar]");
      if(qt){ quitarManual(dlg, qt.closest(".mir-card")); return; }
      if(e.target.closest("[data-mir-prev]")){ moverMirador(dlg, -1); return; }
      if(e.target.closest("[data-mir-next]")){ moverMirador(dlg, 1); return; }
      const p = e.target.closest(".mir-puntos button");
      if(p){ irATarjeta(dlg, Number(p.dataset.i)); return; }
      const hb = e.target.closest("[data-mir-vista]");
      if(hb){ if(hb.dataset.mirVista === "asis") verAsistenciaFort(dlg); else verHoraMirador(dlg, hb.dataset.mirVista === "pend" ? "pend" : Number(hb.dataset.mirVista)); return; }
      const ac = e.target.closest("[data-asis-clase]");
      if(ac){ miradorUI.asisClase = ac.dataset.asisClase; verAsistenciaFort(dlg, true); return; }
      const am = e.target.closest("[data-asis-marca]");
      if(am){ marcarAsistenciaFort(dlg, am); return; }
      const ab = e.target.closest("[data-asis-bit]");
      if(ab){ abrirBitacoraFort(dlg, ab.dataset.asisBit); return; }
      const comp = e.target.closest("[data-mir-completar]");
      if(comp){ completarDesdeHora(dlg, comp.dataset.mirCompletar); return; }
      const g = e.target.closest("[data-guardar-mir]");
      if(g) guardarTarjeta(dlg, g.closest(".mir-card"), g);
    });
    let t = null;
    track.addEventListener("scroll", ()=>{ clearTimeout(t); t = setTimeout(()=> marcarPosicion(dlg), 60); }, { passive: true });
  }
  if(!dlg.open){
    miradorUI.vista = "pend";
    dlg.querySelector(".mir-track").hidden = false; dlg.querySelector(".mir-puntos").hidden = false; dlg.querySelector(".mir-hora").hidden = true;
  }
  sincronizarTarjetas(dlg);
  pintarHorasMirador(dlg);
  if(!dlg.open){ try{ dlg.showModal(); } catch { dlg.setAttribute("open", ""); } }
  pintarTurno();
  if(!irA && !miradorUI.pend.length && veFortalecimiento() && miradorUI.vista === "pend") verAsistenciaFort(dlg);
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
    if(!vacio) track.insertAdjacentHTML("beforeend", `<div class="mir-vacio"><p class="empty-title">Nadie pendiente</p><p class="muted">Cuando alguien escanee el QR al llegar, aparecerá aquí. Si no lo escaneó, agrégalo con «+ Agregar».</p></div>`);
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
  const btnPend = dlg.querySelector('[data-mir-vista="pend"]');
  if(btnPend) btnPend.innerHTML = `Pendientes${miradorUI.pend.length ? ` <span class="num">(${miradorUI.pend.length})</span>` : ""}`;
  if((miradorUI.vista || "pend") !== "pend") return;
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
    const { data: nueva, error } = await sb.from("bitacora").insert({ atleta_id: p.atleta_id, reserva_id: p.sinReserva ? null : reserva, ...(p.sinReserva && p.diaSesion ? { fecha: p.diaSesion } : {}), ...leerCampos(card, card.dataset.pre) }).select("id").single();
    if(error && !/23505|duplicate|unique/i.test((error.code || "") + " " + (error.message || ""))){ msg.textContent = errorES(error); return; }
    if(error) msg.textContent = "Otro coach ya guardó la bitácora de esta sesión.";
    let fallas = 0;
    const fotos = fotosDe(card).nuevas;
    if(!error && nueva && fotos.length){ msg.textContent = "Subiendo fotos…"; fallas = await subirFotos(p.atleta_id, nueva.id, fotos); }
    if(fallas) msg.textContent = `Se guardó, pero ${plural(fallas, "foto no se subió", "fotos no se subieron")}. Agrégalas desde la Bitácora.`;
    delete miradorUI.borradores[reserva];
    delete miradorUI.hist[p.atleta_id];
    clearTimeout(miradorUI.timers[reserva]); miradorUI.guardados.add(reserva);
    if(miradorUI.manuales.some(m => m.reserva_id === reserva)){ miradorUI.manuales = miradorUI.manuales.filter(m => m.reserva_id !== reserva); quitarManualDB(reserva); }
    sb.from("mirador_borradores").delete().eq("clave", reserva).then(()=>{}, ()=>{});
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
      <p class="bit-maldita">${malditaChipHTML(a.id)} <button type="button" class="btn-link" id="btnMaldita">${(state.maldita || {})[a.id] ? "Cambiar zona maldita" : "Marcar zona maldita"}</button></p>
      <div class="bit-head-acc"><button type="button" class="btn-primary" id="btnNuevaBit">+ Nueva entrada</button>
        <a class="btn-outline" href="#/atleta/${encodeURIComponent(a.id)}">Ver ficha</a></div></header>
    <div class="seg bit-tabs" role="tablist" aria-label="Secciones de la bitácora">
      <button type="button" role="tab" data-bit-tab="sesiones" aria-selected="true">Sesiones</button>
      <button type="button" role="tab" data-bit-tab="consejos" aria-selected="false">Consejos al atleta</button>
      <button type="button" role="tab" data-bit-tab="internos" aria-selected="false">Comentarios internos</button>
      <button type="button" role="tab" data-bit-tab="externos" aria-selected="false">Fuera de Gymnika</button>
    </div>
    <section class="panel span-12" data-bit-panel="sesiones" aria-labelledby="bitHist"><div class="panel-head"><h2 id="bitHist">Historial de sesiones</h2><span class="muted" id="bitCuenta"></span></div>
      <div id="bitLista"><div class="skel skel-block"></div></div></section>
    <section class="panel span-12" data-bit-panel="consejos" hidden aria-labelledby="bitCons"><div class="panel-head"><h2 id="bitCons">Consejos al atleta</h2><span class="muted">El atleta ve el último en su inicio</span></div>
      <div id="bitConsejos"><div class="skel skel-block"></div></div></section>
    <section class="panel span-12" data-bit-panel="internos" hidden aria-labelledby="bitInt"><div class="panel-head"><h2 id="bitInt">Comentarios internos</h2><span class="muted">Solo los ve el equipo</span></div>
      <div id="bitInternos"><div class="skel skel-block"></div></div></section>
    <section class="panel span-12" data-bit-panel="externos" hidden aria-labelledby="bitExt"><div class="panel-head"><h2 id="bitExt">Entrenamiento fuera de Gymnika</h2><span class="muted">Del reloj o anotado a mano</span></div>
      <div id="bitExternos"><div class="skel skel-block"></div></div></section></div>`;
  document.getElementById("btnNuevaBit").onclick = ()=> abrirEntradaBitacora(a);
  document.getElementById("btnMaldita").onclick = ()=> abrirSilueta({ eyebrow: "Ficha · zona maldita", titulo: "Zona maldita de " + (primerNombre(a.nombre) || "este atleta"),
    maldita: (state.maldita || {})[a.id] || null, onMaldita: async (nombre)=>{
      const err = await guardarZonaMaldita(a.id, nombre);
      const b = document.getElementById("btnMaldita"); if(b && !err) b.textContent = nombre ? "Cambiar zona maldita" : "Marcar zona maldita";
      return err;
    } });
  main.querySelectorAll("[data-bit-tab]").forEach(b => { b.onclick = ()=>{
    main.querySelectorAll("[data-bit-tab]").forEach(x => x.setAttribute("aria-selected", String(x === b)));
    main.querySelectorAll("[data-bit-panel]").forEach(p => { p.hidden = p.dataset.bitPanel !== b.dataset.bitTab; });
  }; });
  await Promise.all([pintarHistorial(id), pintarNotasHistorial(a, "consejos"), pintarNotasHistorial(a, "internos"),
    renderExternos(document.getElementById("bitExternos"), a.id, { esCoach: true })]);
}
/* Consejos al atleta (profiles.consejos_coach) y comentarios internos (ficha_interna.comentarios):
   cada vez que se guarda uno nuevo, la base lo deja en su historial con autor y fecha */
const NOTAS_BIT = {
  consejos: { caja: "bitConsejos", tabla: "consejos_historial", placeholder: "Ej: esta semana prioriza dormir bien y hacer tus estiramientos al despertar.",
    etiqueta: "Nuevo consejo para el atleta", ayuda: "El atleta lo ve en su inicio como «Consejo de tu coach».", vacio: "Todavía no hay consejos." },
  internos: { caja: "bitInternos", tabla: "comentarios_internos", placeholder: "Ej: refiere menos dolor al subir escaleras; evaluar carga la próxima semana.",
    etiqueta: "Nuevo comentario interno", ayuda: "Solo lo ve el equipo.", vacio: "Todavía no hay comentarios internos." }
};
async function pintarNotasHistorial(a, tipo){
  const cfg = NOTAS_BIT[tipo];
  const box = document.getElementById(cfg.caja);
  if(!box) return;
  const { data, error } = await sb.from(cfg.tabla).select("id, texto, autor_nombre, created_at").eq("user_id", a.id).order("created_at", { ascending: false }).limit(200);
  if(!document.getElementById(cfg.caja) || routeBitacoraId() !== a.id) return;
  const lista = data || [];
  /* Si llega un cambio en vivo mientras se escribe, se conserva lo escrito */
  const previo = document.getElementById("nota_" + tipo);
  const borrador = previo ? previo.value : "", enfocado = previo && document.activeElement === previo;
  box.innerHTML = `
    <label for="nota_${tipo}" style="margin-top:0">${esc(cfg.etiqueta)}</label>
    <textarea id="nota_${tipo}" rows="3" placeholder="${esc(cfg.placeholder)}"></textarea>
    <p class="muted" style="margin:4px 0 0">${esc(cfg.ayuda)}</p>
    <button type="button" class="btn-primary" id="btnNota_${tipo}">Guardar</button>
    <div id="notaMsg_${tipo}" aria-live="polite"></div>
    ${error ? `<div class="error" role="alert">${esc(errorES(error))}</div>`
      : lista.length ? `<ol class="nota-hist">${lista.map((n, i) => `<li${i === 0 && tipo === "consejos" ? ` class="actual"` : ""}>
          <p class="nota-meta"><strong>${esc(mayuscula(fechaLarga(fechaLima(n.created_at))))}</strong> <span class="muted">por ${esc(n.autor_nombre || "el equipo")} · ${esc(horaDe(n.created_at))}</span>${i === 0 && tipo === "consejos" ? ` <span class="badge soft">El que ve hoy</span>` : ""}</p>
          <p class="nota-txt">${esc(n.texto)}</p></li>`).join("")}</ol>`
      : `<p class="muted" style="margin-top:14px">${esc(cfg.vacio)}</p>`}`;
  const ta = document.getElementById("nota_" + tipo);
  if(borrador){ ta.value = borrador; }
  if(enfocado){ ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
  const btn = document.getElementById("btnNota_" + tipo);
  btn.onclick = ()=> withBusy(btn, "Guardando…", async ()=>{
    const texto = document.getElementById("nota_" + tipo).value.trim();
    const msg = document.getElementById("notaMsg_" + tipo);
    if(!texto){ showMsg(msg, "error", "Escribe el texto antes de guardar."); return; }
    const { error: e } = tipo === "consejos"
      ? await sb.from("profiles").update({ consejos_coach: texto }).eq("id", a.id)
      : await sb.from("ficha_interna").upsert({ user_id: a.id, comentarios: texto });
    if(e){ showError(msg, e); return; }
    if(tipo === "consejos") a.consejos_coach = texto;
    document.getElementById("nota_" + tipo).value = "";
    await pintarNotasHistorial(a, tipo);
    showMsg(document.getElementById("notaMsg_" + tipo), "ok", "Guardado.");
  });
}
const fechaLima = (iso)=> new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Lima" });
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
        <span class="muted">por ${esc(b.autor_nombre || "el equipo")} · ${esc(horaDe(b.created_at))}${b.reserva_id ? " · sesión" : ""}</span>
        ${b.created_at && fechaLima(b.created_at) !== b.fecha ? `<span class="bit-subida">Subida el ${esc(fechaLarga(fechaLima(b.created_at)).toLowerCase())}</span>` : ""}</div>
      ${dolor}
      ${filas.length ? `<dl class="bit-datos">${filas.join("")}</dl>` : (dolor || b._fotos.length ? "" : `<p class="muted">Sin notas.</p>`)}
      ${b._fotos.length ? `<div class="bit-fotos">${b._fotos.map(f => f.url ? `<button type="button" class="foto-mini" data-ver-foto="${esc(f.url)}" aria-label="Ver foto"><img src="${esc(f.url)}" alt="" loading="lazy"></button>` : "").join("")}</div>` : ""}
      <div class="bit-acc">
        <label class="btn-outline sm foto-add bit-foto-add"><span aria-hidden="true">📷</span> Agregar fotos<input type="file" accept="image/*" multiple class="sr-only" data-bit-foto="${esc(b.id)}"></label>
        ${puede(b) ? `<button type="button" class="btn-link" data-bit-editar="${esc(b.id)}">Editar</button><button type="button" class="btn-link danger" data-bit-borrar="${esc(b.id)}">Borrar</button>` : ""}
      </div>
      <div data-bit-foto-msg="${esc(b.id)}" aria-live="polite"></div>
    </li>`;
  }).join("")}</ol>`;
  box.querySelectorAll("[data-ver-foto]").forEach(b => { b.onclick = ()=> verFoto(b.dataset.verFoto); });
  /* Fotos directo a una sesión del historial (el teléfono ofrece cámara o galería) */
  box.querySelectorAll("[data-bit-foto]").forEach(inp => { inp.onchange = async ()=>{
    const files = [...(inp.files || [])].filter(f => !f.type || f.type.startsWith("image/"));
    const eid = inp.dataset.bitFoto;
    const msg = box.querySelector(`[data-bit-foto-msg="${CSS.escape(eid)}"]`);
    inp.value = "";
    if(!files.length) return;
    inp.disabled = true;
    showMsg(msg, "ok", files.length === 1 ? "Subiendo la foto…" : `Subiendo ${files.length} fotos…`);
    const fallas = await subirFotos(id, eid, files);
    await pintarHistorial(id);
    const nuevo = document.querySelector(`#bitLista [data-bit-foto-msg="${CSS.escape(eid)}"]`);
    if(nuevo) showMsg(nuevo, fallas ? "error" : "ok", fallas
      ? `${plural(fallas, "foto no se subió", "fotos no se subieron")}. Inténtalo de nuevo.`
      : files.length === 1 ? "Foto agregada." : `${files.length} fotos agregadas.`);
  }; });
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
    <p class="muted" style="margin-top:0">${previa ? esc(fechaLarga(previa.fecha)) + " · por " + esc(previa.autor_nombre || "el equipo") : "Ningún campo es obligatorio."}</p>
    ${previa ? "" : `<label for="nbDia">Día de la sesión</label>
    <input type="date" id="nbDia" value="${todayStr()}" max="${todayStr()}" min="${fechaISO(sumarDias(parseFecha(todayStr()), -60))}">
    <p class="mir-otro-dia" id="nbDiaTxt" hidden></p>`}
    ${camposBitacoraHTML(pre, previa || {})}
    <div id="nbMsg" aria-live="polite"></div>
    <button type="button" class="btn-primary" id="btnGuardarBit">Guardar</button>`);
  dlg.el.classList.add("bit-dialog");
  dlg.el.dataset.atleta = a ? a.id : (previa && previa.atleta_id) || "";
  enlazarCampos(dlg.el);
  const btn = dlg.el.querySelector("#btnGuardarBit");
  const inpDia = dlg.el.querySelector("#nbDia");
  const diaElegido = ()=> inpDia && inpDia.value && inpDia.value <= todayStr() && inpDia.value >= inpDia.min ? inpDia.value : todayStr();
  if(inpDia) inpDia.onchange = ()=>{
    const t = dlg.el.querySelector("#nbDiaTxt"), f = diaElegido();
    inpDia.value = f;
    t.hidden = f === todayStr();
    t.textContent = f === todayStr() ? "" : `Sesión del ${fechaLarga(f).toLowerCase()}. Se guarda con ese día y figura que se subió hoy.`;
  };
  btn.onclick = ()=> withBusy(btn, "Guardando…", async ()=>{
    const datos = leerCampos(dlg.el, pre);
    const msg = dlg.el.querySelector("#nbMsg");
    /* Día anterior: si ese día vino a una sesión que quedó sin bitácora, la entrada se une a esa sesión */
    const extra = {};
    if(!previa && diaElegido() !== todayStr()){
      extra.fecha = diaElegido();
      const { data: rs } = await sb.from("reservas").select("id").eq("user_id", a.id).eq("fecha", extra.fecha).eq("estado", "asistio").order("inicio");
      const ids = (rs || []).map(r => r.id);
      const { data: hechas } = ids.length ? await sb.from("bitacora").select("reserva_id").in("reserva_id", ids) : { data: [] };
      const libre = ids.find(x => !(hechas || []).some(h => h.reserva_id === x));
      if(libre) extra.reserva_id = libre;
    }
    const { data: fila, error } = previa
      ? await sb.from("bitacora").update(datos).eq("id", previa.id).select("id").single()
      : await sb.from("bitacora").insert({ atleta_id: a.id, ...extra, ...datos }).select("id").single();
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

/* ---------- Mirador por horas: volver a las horas anteriores del turno ---------- */
async function cargarHorasTurno(){
  const t = miradorUI.turno;
  if(!t) return [];
  const [horarios, { data, error }] = await Promise.all([
    cargarHorarios(),
    sb.from("reservas").select("id, user_id, inicio, checkin_at, horario_id").eq("fecha", todayStr()).eq("estado", "asistio").order("inicio")
  ]);
  if(error) throw error;
  const h = (id)=> horarios.find(x => x.id === id) || {};
  const desde = new Date(t.inicio).getTime();
  const rs = (data || []).filter(r => r.checkin_at && new Date(r.inicio).getTime() + (h(r.horario_id).duracion_min || 60) * 60000 >= desde);
  const ids = rs.map(r => r.id);
  const { data: bits, error: e2 } = ids.length
    ? await sb.from("bitacora").select("id, reserva_id, atleta_id, autor_nombre, dolor_inicio, dolor_salida, zonas, como_llego, que_hizo, que_ocurrio, estiramientos, pendiente, fecha").in("reserva_id", ids)
    : { data: [], error: null };
  if(e2) throw e2;
  return rs.map(r => ({ ...r, categoria: h(r.horario_id).categoria, bit: (bits || []).find(b => b.reserva_id === r.id) || null }));
}
/* Horas del turno: desde la hora en que empezó (o la primera sesión que alcanzó) hasta ahora */
function horasDelTurno(){
  const t = miradorUI.turno;
  if(!t) return [];
  const ahora = new Date().getHours();
  const desde = Math.min(new Date(t.inicio).getHours(), ...((miradorUI.horas || []).map(r => new Date(r.inicio).getHours())));
  const hs = [];
  for(let x = Math.max(0, desde); x <= ahora; x++) hs.push(x);
  return hs;
}
function pintarHorasMirador(dlg){
  const box = dlg.querySelector(".mir-horas");
  if(!box) return;
  const vista = miradorUI.vista || "pend";
  const hs = horasDelTurno();
  box.innerHTML = `<button type="button" data-mir-vista="pend" aria-pressed="${vista === "pend"}">Pendientes${miradorUI.pend.length ? ` <span class="num">(${miradorUI.pend.length})</span>` : ""}</button>
    ${veFortalecimiento() ? `<button type="button" data-mir-vista="asis" aria-pressed="${vista === "asis"}">Asistencia</button>` : ""}
    ${hs.map(x => `<button type="button" data-mir-vista="${x}" aria-pressed="${vista === x}" class="num">${x}:00</button>`).join("")}`;
  box.hidden = !hs.length && !veFortalecimiento();
  const sel = box.querySelector('[aria-pressed="true"]');
  if(sel && vista !== "pend") sel.scrollIntoView({ block: "nearest", inline: "center" });
}
async function verHoraMirador(dlg, vista){
  guardarBorradores(dlg);
  miradorUI.vista = vista;
  const enPend = vista === "pend";
  dlg.querySelector(".mir-track").hidden = !enPend;
  dlg.querySelector(".mir-puntos").hidden = !enPend;
  dlg.querySelector(".mir-nav").hidden = !enPend || tarjetas(dlg).length < 2;
  const caja = dlg.querySelector(".mir-hora");
  caja.hidden = enPend;
  pintarHorasMirador(dlg);
  if(enPend){ marcarPosicion(dlg); return; }
  dlg.querySelector("#mirTitulo").textContent = `${vista}:00 a ${vista + 1}:00`;
  caja.innerHTML = `<div class="skel skel-block"></div>`;
  try{ miradorUI.horas = await cargarHorasTurno(); }
  catch(err){ caja.innerHTML = `<div class="error" role="alert">${esc(errorES(err))}</div>`; return; }
  if(miradorUI.vista !== vista) return;
  pintarHorasMirador(dlg);
  const lista = miradorUI.horas.filter(r => new Date(r.inicio).getHours() === vista);
  const hechas = lista.filter(r => r.bit).length;
  dlg.querySelector("#mirTitulo").textContent = `${vista}:00 · ${lista.length ? plural(lista.length, "persona", "personas") : "nadie"}`;
  caja.innerHTML = lista.length ? `
    <p class="mir-hora-res muted">${hechas === lista.length ? "Todas con bitácora." : `${hechas} de ${lista.length} con bitácora.`}</p>
    <ul class="mir-hora-lista">${lista.map(filaHoraHTML).join("")}</ul>`
    : `<div class="mir-vacio"><p class="empty-title">Nadie en esta hora</p><p class="muted">No hubo sesiones con QR a las ${vista}:00 en tu turno.</p></div>`;
}
function filaHoraHTML(r){
  const a = (state.athleteList || []).find(x => x.id === r.user_id) || {};
  const b = r.bit;
  const linea = (t, v)=> v ? `<p><strong>${t}</strong> ${esc(v)}</p>` : "";
  const dolor = b ? zonasDe(b).filter(z => hayValor(z.inicio) || hayValor(z.salida)).map(z =>
    `<span class="mir-ult-dolor">${esc(z.zona || "Dolor")} ${hayValor(z.inicio) ? z.inicio : "–"} → ${hayValor(z.salida) ? z.salida : "–"}</span>`).join("") : "";
  return `<li class="mir-hora-fila${b ? " hecha" : ""}">
    <div class="mir-hora-cab"><strong>${esc(a.nombre || "Alumno")}</strong>
      ${r.categoria && CATEGORIAS[r.categoria] ? `<span class="badge soft">${esc(CATEGORIAS[r.categoria].nombre)}</span>` : ""}
      <span class="muted">Llegó ${esc(horaDe(r.checkin_at))}</span></div>
    ${b ? `<p class="mir-hora-ok">✓ Bitácora${b.autor_nombre ? " de " + esc(primerNombre(b.autor_nombre)) : ""}</p>
      <details class="mir-ult"><summary>Ver lo que se escribió</summary>
        ${dolor ? `<p class="mir-ult-meta">${dolor}</p>` : ""}
        ${linea("Llegó:", b.como_llego)}${linea("Hizo:", b.que_hizo)}${linea("Ocurrió:", b.que_ocurrio)}${linea("Pendiente:", b.pendiente)}
        <a class="btn-link" href="#/bitacora/${encodeURIComponent(r.user_id)}" data-ir-bitacora>Abrir su bitácora</a></details>`
      : `<div class="mir-hora-pend"><span>Sin bitácora</span><button type="button" class="btn-primary sm" ${r.categoria === "fortalecimiento" ? `data-asis-bit="${esc(r.id)}"` : `data-mir-completar="${esc(r.id)}"`}>Completar ahora</button></div>`}
  </li>`;
}
async function completarDesdeHora(dlg, reservaId){
  if(!miradorUI.pend.some(p => p.reserva_id === reservaId)) await actualizarMirador();
  await verHoraMirador(dlg, "pend");
  sincronizarTarjetas(dlg);
  const i = tarjetas(dlg).findIndex(c => c.dataset.reserva === reservaId);
  if(i >= 0) requestAnimationFrame(()=> irATarjeta(dlg, i, "instant"));
}

/* ---------- Agregar personas al Mirador a mano (no escanearon el QR) ----------
   Con reserva hoy: se marca su llegada y entra como si hubiera escaneado.
   Sin reserva: tarjeta «sin reserva» que guarda la bitácora sin sesión; se recuerda en este navegador hasta guardarla. */
/* Las personas agregadas a mano quedan en la base: todo el equipo en turno las ve al instante */
async function cargarManuales(){
  const { data, error } = await sb.from("mirador_manual").select("clave, atleta_id, datos").eq("fecha", todayStr());
  if(error){ console.error(error); return miradorUI.manuales || []; }
  return (data || []).map(r => ({ ...(r.datos || {}), reserva_id: r.clave, atleta_id: r.atleta_id }));
}
async function guardarManualDB(p){
  const { error } = await sb.from("mirador_manual").upsert({ clave: p.reserva_id, atleta_id: p.atleta_id, fecha: todayStr(), datos: p });
  if(error) console.error(error);
}
function quitarManualDB(clave){ sb.from("mirador_manual").delete().eq("clave", clave).then(()=>{}, (e)=> console.error(e)); }
function abrirAgregarMirador(){
  if(!miradorUI.turno) return;
  const area = areaCoach();
  const alumnos = (state.athleteList || []).filter(a => !area || catsDe(a.categoria).includes(area))
    .sort((x, y) => String(x.nombre || "").localeCompare(String(y.nombre || ""), "es"));
  const d = openDialog("Agregar al Mirador", `
    <p class="muted" style="margin-top:0">Para quien llegó y no escaneó el QR, o para completar la bitácora de un día anterior. Si tiene reserva ese día, se marca su llegada; si no, entra «sin reserva».</p>
    <div class="mir-dia" role="group" aria-label="¿De qué día es la sesión?">
      <button type="button" data-mir-dia="hoy" aria-pressed="true">Hoy</button>
      <button type="button" data-mir-dia="ayer" aria-pressed="false">Ayer</button>
      <label class="sr-only" for="mirAddDia">Otro día</label>
      <input type="date" id="mirAddDia" max="${fechaISO(sumarDias(parseFecha(todayStr()), -1))}" min="${fechaISO(sumarDias(parseFecha(todayStr()), -30))}" aria-label="Otro día">
    </div>
    <p class="mir-otro-dia" id="mirAddDiaTxt" hidden></p>
    <label class="sr-only" for="mirAddQ">Buscar por nombre</label>
    <input type="search" id="mirAddQ" placeholder="Buscar por nombre" autocomplete="off">
    <div id="mirAddMsg" aria-live="polite"></div>
    <ul class="mir-add-lista" id="mirAddLista"></ul>`);
  const lista = d.el.querySelector("#mirAddLista"), q = d.el.querySelector("#mirAddQ");
  /* Día de la sesión: hoy, ayer u otro día (hasta 30 días atrás). La bitácora queda con ese día y con la fecha en que se subió. */
  const hoy = todayStr(), ayer = fechaISO(sumarDias(parseFecha(hoy), -1));
  let dia = hoy;
  const inpDia = d.el.querySelector("#mirAddDia"), txtDia = d.el.querySelector("#mirAddDiaTxt");
  const ponerDia = (f)=>{
    dia = f || hoy;
    d.el.querySelector('[data-mir-dia="hoy"]').setAttribute("aria-pressed", String(dia === hoy));
    d.el.querySelector('[data-mir-dia="ayer"]').setAttribute("aria-pressed", String(dia === ayer));
    inpDia.value = dia !== hoy && dia !== ayer ? dia : "";
    txtDia.hidden = dia === hoy;
    txtDia.textContent = dia === hoy ? "" : `Sesión del ${fechaLarga(dia).toLowerCase()}. Se guarda con ese día y figura que se subió hoy.`;
    d.el.querySelector("#mirAddMsg").innerHTML = "";
    pintar();
  };
  d.el.querySelector('[data-mir-dia="hoy"]').onclick = ()=> ponerDia(hoy);
  d.el.querySelector('[data-mir-dia="ayer"]').onclick = ()=> ponerDia(ayer);
  inpDia.onchange = ()=> ponerDia(inpDia.value && inpDia.value < hoy && inpDia.value >= inpDia.min ? inpDia.value : hoy);
  const pintar = ()=>{
    const t = normalizar(q.value || "");
    const vis = alumnos.filter(a => !t || normalizar(a.nombre || "").includes(t)).slice(0, 40);
    lista.innerHTML = vis.length ? vis.map(a => {
      const ya = dia === hoy && miradorUI.pend.some(p => p.atleta_id === a.id);
      return `<li><button type="button" class="mir-add-item" data-mir-add="${esc(a.id)}">
        <span class="avatar" aria-hidden="true">${esc(initials(a.nombre || ""))}</span>
        <span class="mir-add-txt"><strong>${esc(a.nombre || "(sin nombre)")}</strong><span class="muted">${esc((CATEGORIAS[a.categoria] || {}).nombre || "")}${ya ? " · ya está en el Mirador" : ""}</span></span>
        <span class="mir-add-mas" aria-hidden="true">${ya ? "→" : "+"}</span></button></li>`;
    }).join("") : `<li class="muted" style="padding:10px 4px">Nadie con ese nombre.</li>`;
  };
  pintar();
  q.oninput = pintar;
  setTimeout(()=> q.focus(), 30);
  lista.onclick = (e)=>{
    const b = e.target.closest("[data-mir-add]");
    if(b) agregarAlMirador(alumnos.find(a => a.id === b.dataset.mirAdd), d, b, dia);
  };
}
async function agregarAlMirador(a, d, btn, dia){
  if(!a) return;
  const msg = d.el.querySelector("#mirAddMsg");
  dia = dia || todayStr();
  const pasado = dia !== todayStr();
  const ya = miradorUI.pend.find(p => p.atleta_id === a.id && (pasado ? p.diaSesion === dia : !p.diaSesion || p.diaSesion === dia));
  if(ya){ d.close(); abrirMirador(ya.reserva_id); return; }
  btn.disabled = true;
  const listo = (id)=>{ d.close(); abrirMirador(id); };
  try{
    const { data: rs, error } = await sb.from("reservas").select("id, horario_id, inicio, estado, checkin_at")
      .eq("user_id", a.id).eq("fecha", dia).in("estado", ["confirmada", "asistio", "no_asistio"]).order("inicio");
    if(error){ showError(msg, error); return; }
    const ahora = Date.now();
    const ids = (rs || []).map(r => r.id);
    const { data: hechas } = ids.length ? await sb.from("bitacora").select("reserva_id").in("reserva_id", ids) : { data: [] };
    const conBit = new Set((hechas || []).map(x => x.reserva_id));
    /* La sesión de hoy más cercana a esta hora que todavía no tiene bitácora */
    const libres = (rs || []).filter(r => !conBit.has(r.id)).sort((x, y) => Math.abs(new Date(x.inicio) - ahora) - Math.abs(new Date(y.inicio) - ahora));
    if((rs || []).length && !libres.length){
      showMsg(msg, "error", `${primerNombre(a.nombre) || "Esta persona"} ya tiene bitácora de ${rs.length === 1 ? "su sesión de las " + horaDe(rs[0].inicio) : "sus sesiones"} ${pasado ? "del " + fechaLarga(dia).toLowerCase() : "de hoy"}.`);
      return;
    }
    const cand = libres[0];
    if(cand){
      if(cand.estado !== "asistio" || !cand.checkin_at){
        const { error: e2 } = await sb.rpc("marcar_asistencia", { p_reserva: cand.id, p_asistio: true });
        if(e2){ showError(msg, e2); return; }
      }
      miradorUI.vistos.add(cand.id);
      if(!pasado){
        miradorUI.cargando = false;
        await actualizarMirador();
      } else await cargarReferencias([a.id]);
      if(miradorUI.pend.some(p => p.reserva_id === cand.id)){ listo(cand.id); return; }
      /* Su sesión terminó antes de tu turno: igual se agrega con su reserva */
      const [h] = (await cargarHorarios()).filter(x => x.id === cand.horario_id);
      const p = { reserva_id: cand.id, atleta_id: a.id, nombre: a.nombre, categoria: (h || {}).categoria || a.categoria, inicio: cand.inicio, checkin_at: cand.checkin_at || new Date().toISOString(), lesiones: a.lesiones, ...(pasado ? { diaSesion: dia } : {}) };
      miradorUI.manuales.push(p); await guardarManualDB(p);
      miradorUI.pend.push(p);
      pintarTurno();
      listo(p.reserva_id);
      return;
    }
    const ahoraISO = new Date().toISOString();
    const p = { reserva_id: "manual-" + a.id, atleta_id: a.id, nombre: a.nombre, categoria: a.categoria === "transicion" ? "fortalecimiento" : a.categoria,
      inicio: ahoraISO, checkin_at: ahoraISO, lesiones: a.lesiones, sinReserva: true, ...(pasado ? { diaSesion: dia } : {}) };
    /* Si ya había una tarjeta «sin reserva» de esta persona, se reemplaza por la del día elegido */
    miradorUI.manuales = miradorUI.manuales.filter(m => m.reserva_id !== p.reserva_id);
    miradorUI.pend = miradorUI.pend.filter(m => m.reserva_id !== p.reserva_id);
    miradorUI.manuales.push(p); await guardarManualDB(p);
    miradorUI.vistos.add(p.reserva_id);
    await cargarReferencias([a.id]);
    miradorUI.pend.push(p);
    pintarTurno();
    listo(p.reserva_id);
  } finally { btn.disabled = false; }
}
function quitarManual(dlg, card){
  if(!card) return;
  const id = card.dataset.reserva;
  miradorUI.manuales = miradorUI.manuales.filter(m => m.reserva_id !== id); quitarManualDB(id);
  sb.from("mirador_borradores").delete().eq("clave", id).then(()=>{}, ()=>{});
  miradorUI.pend = miradorUI.pend.filter(p => p.reserva_id !== id);
  delete miradorUI.borradores[id];
  card.remove();
  sincronizarTarjetas(dlg);
  pintarTurno();
}

/* ---------- Mirador en vivo: lo que cada coach escribe se comparte con el equipo en turno ---------- */
function programarBorrador(card){
  const clave = card.dataset.reserva;
  if(!clave || miradorUI.guardados.has(clave)) return;
  clearTimeout(miradorUI.timers[clave]);
  miradorUI.timers[clave] = setTimeout(()=> enviarBorrador(card), 700);
}
async function enviarBorrador(card){
  const clave = card.dataset.reserva;
  if(!card.isConnected || miradorUI.guardados.has(clave)) return;
  const datos = leerCampos(card, card.dataset.pre);
  miradorUI.borradores[clave] = datos;
  miradorUI.enviado[clave] = Date.now();
  const { error } = await sb.from("mirador_borradores").upsert({ clave, atleta_id: card.dataset.atleta, fecha: todayStr(), datos,
    autor_id: state.profile.id, autor_nombre: state.profile.nombre || null, updated_at: new Date().toISOString() });
  if(error) console.error(error);
}
function recibirBorrador(fila, inicial){
  if(!fila || !fila.clave || miradorUI.guardados.has(fila.clave)) return;
  const propio = fila.autor_id === state.profile.id;
  /* Lo que acabo de enviar desde este teléfono vuelve como eco: se ignora */
  if(propio && (inicial ? miradorUI.borradores[fila.clave] : Date.now() - (miradorUI.enviado[fila.clave] || 0) < 4000)) return;
  const dlg = document.getElementById("modalMirador");
  const card = dlg ? [...dlg.querySelectorAll(".mir-card")].find(c => c.dataset.reserva === fila.clave) : null;
  const quien = propio ? "otro dispositivo tuyo" : primerNombre(fila.autor_nombre) || "otro coach";
  miradorUI.borradores[fila.clave] = fila.datos || {};
  if(!card) return;
  /* En vivo, campo por campo: lo que estás escribiendo no se toca; todo lo demás se actualiza al instante */
  const activo = card.contains(document.activeElement) ? document.activeElement : null;
  const diferidas = aplicarBorrador(card, fila.datos || {}, activo);
  if(diferidas){ miradorUI.pendienteVivo = miradorUI.pendienteVivo || {}; miradorUI.pendienteVivo[fila.clave] = fila; }
  if(!inicial) avisoVivo(card, `✎ ${quien} está editando esta tarjeta`);
}
function avisoVivo(card, texto){
  const el = card.querySelector(".mir-vivo");
  if(!el) return;
  el.textContent = texto; el.hidden = false;
  clearTimeout(el._t); el._t = setTimeout(()=>{ el.hidden = true; }, 5000);
}
/* Pone en la tarjeta lo que escribió otro coach, sin tocar las fotos ni el campo que tienes abierto.
   Devuelve true si las zonas quedaron pendientes (las estabas editando y cambió su cantidad). */
function aplicarBorrador(card, d, activo){
  const pre = card.dataset.pre, campos = card.querySelector(".bit-campos");
  if(!campos) return false;
  BIT_CAMPOS.forEach(([c]) => { const t = campos.querySelector(`[data-campo="${c}"]`); if(t && t !== activo) t.value = d[c] || ""; });
  const est = campos.querySelectorAll(`input[name="${pre}estiramientos"]`);
  if(![...est].includes(activo)) est.forEach(i => { i.checked = (i.value === "si" && d.estiramientos === true) || (i.value === "no" && d.estiramientos === false); });
  const zs = zonasDe(d).length ? zonasDe(d) : [{}];
  const lleg = campos.querySelector('[data-lista="llegada"] .zonas-lista'), sal = campos.querySelector('[data-lista="salida"] .zonas-lista');
  const filas = [...lleg.querySelectorAll(".zona-row")];
  const enZonas = activo && (lleg.contains(activo) || sal.contains(activo));
  if(!enZonas){
    lleg.innerHTML = zs.map((z, k) => zonaLlegadaHTML(pre, k, z)).join("");
    sal.innerHTML = zs.map((z, k) => zonaSalidaHTML(pre, k, z)).join("");
    campos.dataset.zn = zs.length;
    return false;
  }
  if(filas.length !== zs.length) return true;
  /* Misma cantidad de zonas: se actualiza cada una en su lugar, salvo lo que tienes abierto */
  filas.forEach((row, i) => {
    const z = zs[i] || {}, k = row.dataset.z;
    const sel = row.querySelector("[data-zona-sel]"), otra = row.querySelector("[data-zona-otra]"), nota = row.querySelector("[data-zona-nota]");
    const conocida = !z.zona || ZONAS_DOLOR.includes(z.zona);
    if(sel !== activo){ sel.value = z.zona ? (conocida ? z.zona : "__otra") : ""; }
    if(otra !== activo){ otra.value = z.zona && !conocida ? z.zona : ""; otra.hidden = conocida; }
    if(nota && nota !== activo) nota.value = z.nota || "";
    const marcar = (nombre, v)=>{ const rs = campos.querySelectorAll(`input[name="${pre}${nombre}${k}"]`); if(![...rs].includes(activo)) rs.forEach(r => { r.checked = hayValor(v) && Number(r.value) === Number(v); }); };
    marcar("zi", z.inicio); marcar("zs", z.salida);
    const nom = sal.querySelector(`.zona-row[data-z="${k}"] .zona-nombre`); if(nom) nom.textContent = nombreZona(z);
  });
  return false;
}
/* Al salir de un campo, si quedó algo pendiente de otro coach, se aplica */
document.addEventListener("focusout", (e)=>{
  const card = e.target.closest && e.target.closest(".mir-card");
  if(!card || !miradorUI.pendienteVivo) return;
  const fila = miradorUI.pendienteVivo[card.dataset.reserva];
  if(!fila) return;
  setTimeout(()=>{
    delete miradorUI.pendienteVivo[card.dataset.reserva];
    recibirBorrador(fila);
  }, 150);
});

/* ---------- Bitácora en vivo ----------
   Cualquier cambio del equipo (entradas, fotos, consejos, comentarios internos, turnos) llega al instante a todas las
   pantallas abiertas. Realtime de Supabase respeta las políticas: cada coach solo recibe lo de su área. */
const vivoUI = { canal: null, espera: {} };
function suscribirBitacoraEnVivo(){
  if(vivoUI.canal || typeof sb.channel !== "function" || !esEquipo()) return;
  const ch = sb.channel("bitacora-en-vivo");
  ["bitacora", "bitacora_fotos", "comentarios_internos", "consejos_historial", "turnos_coach", "mirador_borradores", "mirador_manual", "reservas"].forEach(t => {
    ch.on("postgres_changes", { event: "*", schema: "public", table: t }, (payload)=>{
      if(t === "mirador_borradores"){ refrescarEnVivo(t, payload || {}); return; }
      clearTimeout(vivoUI.espera[t]);
      vivoUI.espera[t] = setTimeout(()=> refrescarEnVivo(t, payload || {}), 350);
    });
  });
  vivoUI.canal = ch.subscribe();
}
function quitarBitacoraEnVivo(){
  if(vivoUI.canal){ try { sb.removeChannel(vivoUI.canal); } catch { /* ya cerrado */ } vivoUI.canal = null; }
}
function refrescarEnVivo(tabla, payload){
  const fila = payload.new && Object.keys(payload.new).length ? payload.new : (payload.old || {});
  if(tabla === "mirador_borradores"){ if(payload.eventType !== "DELETE" && payload.new) recibirBorrador(payload.new); return; }
  if(tabla === "mirador_manual" || tabla === "reservas"){ if(miradorUI.turno) actualizarMirador(); return; }
  if(tabla === "turnos_coach"){
    if(!fila.coach_id || fila.coach_id === state.profile.id) cargarTurno();
    if(document.getElementById("eqLista")) pintarTurnosEquipo();
    return;
  }
  const id = routeBitacoraId();
  const uid = fila.atleta_id || fila.user_id;
  if(tabla === "bitacora" || tabla === "bitacora_fotos"){
    if(uid) delete miradorUI.hist[uid];
    if(miradorUI.turno) actualizarMirador();
    const dlg = document.getElementById("modalMirador");
    if(dlg && dlg.open && miradorUI.vista !== undefined && miradorUI.vista !== "pend") verHoraMirador(dlg, miradorUI.vista);
    if(id && document.getElementById("bitLista") && (!uid || uid === id)) pintarHistorial(id);
    if(!id && document.getElementById("bitClientes") && (!document.activeElement || document.activeElement.id !== "bitBuscar")) renderCoachBitacora(document.getElementById("coachMain"));
    return;
  }
  if(id && (!uid || uid === id)){
    const a = (state.athleteList || []).find(x => x.id === id);
    if(a) pintarNotasHistorial(a, tabla === "consejos_historial" ? "consejos" : "internos");
  }
}

/* ====================== Mirador de fortalecimiento: tomar asistencia ======================
   Lista de la clase: quien escaneó el QR ya sale «Asistió»; a los demás se les marca a mano.
   De cada presente solo se abre una bitácora corta: dolor al llegar, comentario de la clase y dolor al irse. */
function veFortalecimiento(){ const a = areaCoach(); return !a || a === "fortalecimiento"; }
async function cargarAsistenciaFort(){
  const horarios = (await cargarHorarios()).filter(h => h.categoria === "fortalecimiento");
  const { data, error } = await sb.from("reservas").select("id, user_id, horario_id, inicio, estado, checkin_at, asistencia_por")
    .eq("fecha", todayStr()).in("horario_id", horarios.map(h => h.id)).in("estado", ["confirmada", "asistio", "no_asistio"]).order("inicio");
  if(error) throw error;
  const ids = (data || []).map(r => r.id);
  const { data: bits, error: e2 } = ids.length ? await sb.from("bitacora").select("id, reserva_id").in("reserva_id", ids) : { data: [], error: null };
  if(e2) throw e2;
  const clases = [];
  (data || []).forEach(r => {
    let c = clases.find(x => x.inicio === r.inicio);
    if(!c){ c = { inicio: r.inicio, dur: (horarios.find(h => h.id === r.horario_id) || {}).duracion_min || 60, lista: [] }; clases.push(c); }
    c.lista.push({ ...r, bit: (bits || []).some(b => b.reserva_id === r.id) });
  });
  const nombre = (r)=> ((state.athleteList || []).find(a => a.id === r.user_id) || {}).nombre || "";
  clases.forEach(c => c.lista.sort((x, y) => nombre(x).localeCompare(nombre(y), "es")));
  return clases;
}
async function verAsistenciaFort(dlg, silencioso){
  if(miradorUI.vista !== "asis") guardarBorradores(dlg);
  miradorUI.vista = "asis";
  dlg.querySelector(".mir-track").hidden = true;
  dlg.querySelector(".mir-puntos").hidden = true;
  dlg.querySelector(".mir-nav").hidden = true;
  const caja = dlg.querySelector(".mir-hora");
  caja.hidden = false;
  pintarHorasMirador(dlg);
  if(!silencioso || !miradorUI.asis){
    dlg.querySelector("#mirTitulo").textContent = "Asistencia · Fortalecimiento";
    if(!miradorUI.asis) caja.innerHTML = `<div class="skel skel-block"></div>`;
  }
  let clases;
  try{ clases = await cargarAsistenciaFort(); }
  catch(err){ caja.innerHTML = `<div class="error" role="alert">${esc(errorES(err))}</div>`; return; }
  if(miradorUI.vista !== "asis") return;
  miradorUI.asis = clases;
  if(!clases.length){
    dlg.querySelector("#mirTitulo").textContent = "Asistencia · Fortalecimiento";
    caja.innerHTML = `<div class="mir-vacio"><p class="empty-title">Nadie reservó hoy</p><p class="muted">Cuando alguien reserve una clase de fortalecimiento de hoy, aparecerá aquí.</p></div>`;
    return;
  }
  /* Por defecto, la clase en curso; si no, la más cercana a esta hora */
  const ahora = Date.now();
  let c = clases.find(x => x.inicio === miradorUI.asisClase);
  if(!c){
    c = clases.find(x => ahora >= new Date(x.inicio).getTime() - 25 * 60000 && ahora <= new Date(x.inicio).getTime() + x.dur * 60000)
      || clases.slice().sort((x, y) => Math.abs(new Date(x.inicio) - ahora) - Math.abs(new Date(y.inicio) - ahora))[0];
    miradorUI.asisClase = c.inicio;
  }
  const vino = c.lista.filter(r => r.estado === "asistio").length;
  dlg.querySelector("#mirTitulo").textContent = `Asistencia · ${horaDe(c.inicio)}`;
  caja.innerHTML = `
    <div class="asis-clases" role="group" aria-label="Clase de fortalecimiento">${clases.map(x =>
      `<button type="button" class="num" data-asis-clase="${esc(x.inicio)}" aria-pressed="${x === c}">${esc(horaDe(x.inicio))} <span class="muted">${x.lista.filter(r => r.estado === "asistio").length}/${x.lista.length}</span></button>`).join("")}</div>
    <p class="mir-hora-res muted">${vino} de ${plural(c.lista.length, "reservado", "reservados")} ${vino === 1 ? "asistió" : "asistieron"}.</p>
    <ul class="asis-lista">${c.lista.map(filaAsistenciaHTML).join("")}</ul>
    <p class="asis-msg" aria-live="polite"></p>`;
}
function filaAsistenciaHTML(r){
  const a = (state.athleteList || []).find(x => x.id === r.user_id) || {};
  const escaneo = r.estado === "asistio" && (!r.asistencia_por || r.asistencia_por === r.user_id || r.asistencia_por === a.tutor_id);
  const estado = r.estado === "asistio"
    ? `<span class="asis-estado ok">✓ Asistió</span><span class="muted">${escaneo ? "escaneó el QR" + (r.checkin_at ? " · " + esc(horaDe(r.checkin_at)) : "") : "marcado a mano"}</span>`
    : r.estado === "no_asistio" ? `<span class="asis-estado no">No vino</span>` : `<span class="asis-estado">Sin marcar</span>`;
  const acc = r.estado === "asistio"
    ? `${r.bit ? `<span class="asis-bit-ok">✓ Bitácora</span><a class="btn-link" href="#/bitacora/${encodeURIComponent(r.user_id)}" data-ir-bitacora>Ver</a>` : `<button type="button" class="btn-outline sm" data-asis-bit="${esc(r.id)}">Bitácora</button>`}
       ${escaneo || r.bit ? "" : `<button type="button" class="btn-link" data-asis-marca="no" data-reserva="${esc(r.id)}">No vino</button>`}`
    : `<button type="button" class="btn-primary sm" data-asis-marca="si" data-reserva="${esc(r.id)}">Asistió</button>
       ${r.estado === "no_asistio" ? "" : `<button type="button" class="btn-outline sm" data-asis-marca="no" data-reserva="${esc(r.id)}">No vino</button>`}`;
  return `<li class="asis-fila ${r.estado === "asistio" ? "ok" : r.estado === "no_asistio" ? "no" : ""}">
    <span class="avatar" aria-hidden="true">${esc(initials(a.nombre || ""))}</span>
    <div class="asis-quien"><strong>${esc(a.nombre || "Alumno")}</strong><div class="asis-linea">${estado}</div></div>
    <div class="asis-acc">${acc}</div>
  </li>`;
}
async function marcarAsistenciaFort(dlg, btn){
  const msg = dlg.querySelector(".asis-msg");
  btn.disabled = true;
  const { error } = await sb.rpc("marcar_asistencia", { p_reserva: btn.dataset.reserva, p_asistio: btn.dataset.asisMarca === "si" });
  if(error){ btn.disabled = false; if(msg) msg.textContent = errorES(error); return; }
  await verAsistenciaFort(dlg, true);
}
/* Bitácora corta de fortalecimiento (encima del Mirador) */
function camposFortHTML(pre){
  return `<div class="bit-campos" data-pre="${pre}" data-zn="1">
    <fieldset class="bit-zonas" data-lista="llegada"><legend>¿Llegó con dolor?</legend>
      <div class="zonas-lista">${zonaLlegadaHTML(pre, 0, {})}</div>
      <div class="zona-botones"><button type="button" class="btn-outline sm" data-zona-cuerpo>Marcar en el cuerpo</button>
      <button type="button" class="btn-outline sm zona-add" data-zona-add>+ Agregar zona</button></div></fieldset>
    <div class="bit-campo"><label for="${pre}que_ocurrio">Comentario de la clase</label>
      <textarea id="${pre}que_ocurrio" data-campo="que_ocurrio" rows="3"></textarea></div>
    <fieldset class="bit-zonas" data-lista="salida"><legend>¿Con cuánto dolor se va?</legend>
      <div class="zonas-lista">${zonaSalidaHTML(pre, 0, {})}</div></fieldset>
  </div>`;
}
function abrirBitacoraFort(mir, reservaId){
  const r = (miradorUI.asis || []).flatMap(c => c.lista).find(x => x.id === reservaId) || (miradorUI.horas || []).find(x => x.id === reservaId);
  if(!r) return;
  const a = (state.athleteList || []).find(x => x.id === r.user_id) || {};
  const pre = "fb_";
  const dlg = document.createElement("dialog");
  dlg.className = "modal-pago asis-bit";
  dlg.dataset.atleta = r.user_id;
  dlg.setAttribute("aria-labelledby", "asisBitT");
  dlg.innerHTML = `
    <div class="asis-bit-top"><div><p class="eyebrow">Fortalecimiento · ${esc(horaDe(r.inicio))}</p><h2 id="asisBitT">${esc(a.nombre || "Alumno")}</h2></div>
      <button type="button" class="icon-btn" data-asis-cerrar aria-label="Cerrar sin guardar">✕</button></div>
    <div class="asis-bit-cuerpo">
      ${malditaChipHTML(r.user_id)}
      ${tieneLesion(a.lesiones) ? `<p class="mir-lesion"><strong>Lesión:</strong> ${esc(a.lesiones)}</p>` : ""}
      ${camposFortHTML(pre)}
    </div>
    <div class="asis-bit-pie"><span class="mir-msg" aria-live="polite"></span><button type="button" class="btn-primary" data-asis-guardar>Guardar</button></div>`;
  document.body.appendChild(dlg);
  enlazarCampos(dlg);
  const cerrar = ()=>{ if(dlg.open) dlg.close(); dlg.remove(); };
  dlg.addEventListener("cancel", (e)=>{ e.preventDefault(); cerrar(); });
  dlg.querySelector("[data-asis-cerrar]").onclick = cerrar;
  const btn = dlg.querySelector("[data-asis-guardar]"), msg = dlg.querySelector(".mir-msg");
  btn.onclick = ()=> withBusy(btn, "Guardando…", async ()=>{
    const d = leerCampos(dlg, pre);
    const { error } = await sb.from("bitacora").insert({ atleta_id: r.user_id, reserva_id: r.id, zonas: d.zonas, dolor_inicio: d.dolor_inicio, dolor_salida: d.dolor_salida, que_ocurrio: d.que_ocurrio });
    if(error && !/23505|duplicate|unique/i.test((error.code || "") + " " + (error.message || ""))){ msg.textContent = errorES(error); return; }
    cerrar();
    if(mir.isConnected && mir.open){ if(miradorUI.vista === "asis") verAsistenciaFort(mir, true); else if(miradorUI.vista !== "pend") verHoraMirador(mir, miradorUI.vista); }
  });
  try{ dlg.showModal(); } catch { dlg.setAttribute("open", ""); }
}
