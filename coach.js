/* ====================== COACH: PLAN DEL ALUMNO ====================== */
async function renderPlanCoach(profile){
  const box = document.getElementById("planCard");
  if(!box) return;
  const cat = profile.categoria;
  const catSelect = `
    <div class="inline-add" style="align-items:end;margin-bottom:6px">
      <div style="flex:1"><label for="coachCat" style="margin-top:0">Categoría</label>
        <select id="coachCat"><option value="">Sin definir</option>${Object.entries(CATEGORIAS).map(([k,c]) => `<option value="${k}" ${cat === k ? "selected" : ""}>${c.nombre}</option>`).join("")}</select></div>
      <div style="flex:1"><label for="coachInicio" style="margin-top:0">Inicio en Gymnika</label>
        <input type="date" id="coachInicio" value="${esc(profile.fecha_inicio || "")}"></div>
      <button type="button" class="btn-outline" id="btnGuardarCat">Guardar</button>
    </div><div id="catMsg" aria-live="polite"></div>`;
  if(!cat){ box.innerHTML = catSelect + `<p class="muted" style="margin-top:10px">Elige la categoría para ver sus sesiones o su acceso mensual.</p>`; bindCat(); return; }
  const plan = await cargarPlanDe(profile.id, cat);
  if(!document.getElementById("planCard")) return;
  const comprasHTML = plan.compras.length ? `
    <details class="records"><summary>Pagos (${plan.compras.length})</summary>
      <ul class="mov-list">${plan.compras.map(c => `<li><span class="mov-txt">${esc(c.paquete_nombre)} · ${dinero(c.monto, c.moneda)} · ${esc(METODOS_PAGO[c.metodo] || c.metodo)}</span>
        <span class="res-state st-${c.estado}">${c.estado === "pendiente" ? "Pendiente" : c.estado === "aprobada" ? "Aprobado" : "Rechazado"}</span>
        <span class="muted">${fmtFecha(String(c.created_at).slice(0,10))}</span></li>`).join("")}</ul></details>` : "";

  if(cat === "terapia"){
    const ahora = new Date();
    const prox = plan.reservas.filter(r => ["confirmada","espera"].includes(r.estado) && new Date(r.inicio) > ahora)
      .sort((a,b)=> String(a.inicio).localeCompare(String(b.inicio)));
    box.innerHTML = catSelect + riesgoPickerHTML(profile) + `
      <div class="plan-hero compact">
        <div class="plan-big"><span class="plan-num num">${plan.saldo}</span><span class="plan-unit">${plan.saldo === 1 ? "sesión disponible" : "sesiones disponibles"}</span></div>
      </div>
      <div class="inline-add tokens-adj">
        <input type="number" id="adjCant" inputmode="numeric" placeholder="+2 o −1" aria-label="Sesiones a sumar o restar">
        <input id="adjNota" placeholder="Motivo (ej: cortesía)" aria-label="Motivo del ajuste">
        <button type="button" class="btn-outline" id="btnAjustar">Ajustar</button>
      </div>
      <div id="adjMsg" aria-live="polite"></div>
      <h3 class="sub-h">Próximas reservas</h3>
      ${prox.length ? `<ul class="res-list">${prox.map(r => `
        <li class="res-item"><div class="res-when"><strong>${fmtFechaHora(r.inicio)}</strong><span class="badge ${r.estado === "espera" ? "outline" : ""}">${ESTADO_RESERVA[r.estado]}</span></div>
          <button type="button" class="btn-danger" data-coach-cancelar="${esc(r.id)}">Cancelar y devolver</button></li>`).join("")}</ul>`
        : `<p class="muted">Sin reservas próximas.</p>`}
      ${plan.movs.length ? `<details class="records"><summary>Movimientos (${plan.movs.length})</summary>
        <ul class="mov-list">${plan.movs.slice(0, 40).map(m => `<li><span class="mov-cant ${m.cantidad > 0 ? "pos" : "neg"} num">${m.cantidad > 0 ? "+" : "−"}${Math.abs(m.cantidad)}</span><span class="mov-txt">${esc(movimientoTexto(m))}</span><span class="muted">${fmtFecha(String(m.created_at).slice(0,10))}</span></li>`).join("")}</ul></details>` : ""}
      ${comprasHTML}`;
    bindCat();
    bindRiesgo(profile);
    const ba = document.getElementById("btnAjustar");
    ba.onclick = ()=> withBusy(ba, "…", async ()=>{
      const n = parseInt(document.getElementById("adjCant").value, 10);
      const msg = document.getElementById("adjMsg");
      if(!n){ showMsg(msg, "error", "Escribe cuántas sesiones sumar (ej: 2) o restar (ej: -1)."); return; }
      const { error } = await sb.rpc("ajustar_tokens", { p_user: profile.id, p_cantidad: n, p_nota: document.getElementById("adjNota").value });
      if(error){ showError(msg, error); return; }
      await renderPlanCoach(profile);
      showMsg(document.getElementById("adjMsg"), "ok", "Saldo actualizado.");
    });
    box.querySelectorAll("[data-coach-cancelar]").forEach(b => {
      b.onclick = ()=>{
        if(!confirm("¿Cancelar esta reserva? La sesión se devuelve al alumno y se le avisa.")) return;
        withBusy(b, "…", async ()=>{
          const { error } = await sb.rpc("cancelar_reserva", { p_reserva: b.dataset.coachCancelar });
          if(error){ showError(document.getElementById("adjMsg"), error); return; }
          renderPlanCoach(profile);
        });
      };
    });
    return;
  }

  const est = estadoMembresia(plan);
  const hoy = todayStr();
  box.innerHTML = catSelect + `
    <div class="plan-hero compact"><div class="plan-big">
      ${est.congelado ? `<span class="plan-num plan-word">Congelado</span><span class="plan-unit">hasta el ${fmtFecha(est.congelado.hasta, true)} · vence el ${fmtFecha(est.finTotal, true)}</span>`
        : est.vigente ? `<span class="plan-num plan-word">Activo</span><span class="plan-unit">vence el ${fmtFecha(est.finTotal, true)} · ${plural(diasEntre(hoy, est.finTotal) + 1, "día", "días")}</span>`
        : est.futura ? `<span class="plan-num plan-word">Programado</span><span class="plan-unit">del ${fmtFecha(est.futura.inicio)} al ${fmtFecha(est.finTotal, true)}</span>`
        : `<span class="plan-num plan-word off">${est.ultima ? "Vencido" : "Sin acceso"}</span><span class="plan-unit">${est.ultima ? "venció el " + fmtFecha(est.ultima.fin, true) : ""}</span>`}
    </div></div>
    ${suscripcionHTML(plan, true)}
    <p class="muted">Asistencias registradas: <strong>${plan.asistencias.length}</strong>${plan.asistencias[0] ? " · última: " + fmtFecha(plan.asistencias[0].fecha) : ""}</p>
    ${plan.congelamientos.length ? `<details class="records"><summary>Congelamientos (${plan.congelamientos.length})</summary>
      <ul class="mov-list">${plan.congelamientos.map(c => `<li><span class="mov-txt">Del ${fmtFecha(c.desde)} al ${fmtFecha(c.hasta)}${c.motivo ? " · " + esc(c.motivo) : ""}</span></li>`).join("")}</ul></details>` : ""}
    ${comprasHTML}`;
  bindCat();

  function bindCat(){
    const b = document.getElementById("btnGuardarCat");
    b.onclick = ()=> withBusy(b, "…", async ()=>{
      const nueva = document.getElementById("coachCat").value || null;
      const inicio = document.getElementById("coachInicio").value || null;
      const { error } = await sb.from("profiles").update({ categoria: nueva, fecha_inicio: inicio }).eq("id", profile.id);
      if(error){ showError(document.getElementById("catMsg"), error); return; }
      profile.categoria = nueva; profile.fecha_inicio = inicio;
      const i = state.athleteList.findIndex(a => a.id === profile.id);
      if(i > -1){ state.athleteList[i].categoria = nueva; renderAthleteListInto(filterAthletes(state.search)); }
      renderAthleteDetail(profile, true, document.getElementById("coachMain"));
    });
  }
}

/* Color de riesgo o dificultad del alumno de terapia (rojo = más riesgo, azul = menos). Solo lo ve el equipo. */
function riesgoPickerHTML(profile){
  return `
    <fieldset class="riesgo-picker">
      <legend>Color de riesgo <span class="muted">· rojo = más riesgo, azul = menos</span></legend>
      <div class="riesgo-ops">
        ${COLORES_RIESGO.map(([k, n]) => `
          <label class="riesgo-op"><input type="radio" name="riesgo" value="${k}" ${profile.color_riesgo === k ? "checked" : ""}>
            <span class="riesgo-sw r-${k}" aria-hidden="true"></span><span>${n}</span></label>`).join("")}
        ${profile.color_riesgo ? `<button type="button" class="btn-link" id="btnQuitarRiesgo">Quitar</button>` : ""}
      </div>
      <div id="riesgoMsg" aria-live="polite"></div>
    </fieldset>`;
}
function bindRiesgo(profile){
  const guardar = async (valor)=>{
    const msg = document.getElementById("riesgoMsg");
    const { error } = await sb.from("profiles").update({ color_riesgo: valor }).eq("id", profile.id);
    if(error){ showError(msg, error); return; }
    profile.color_riesgo = valor;
    const a = state.athleteList.find(x => x.id === profile.id);
    if(a) a.color_riesgo = valor;
    await renderPlanCoach(profile);
    showMsg(document.getElementById("riesgoMsg"), "ok", valor ? "Color guardado. Ya se ve en el horario general." : "Color quitado.");
  };
  document.querySelectorAll('input[name="riesgo"]').forEach(r => { r.onchange = ()=> guardar(r.value); });
  const q = document.getElementById("btnQuitarRiesgo");
  if(q) q.onclick = ()=> withBusy(q, "…", ()=> guardar(null));
}

/* ====================== COACH: PAGOS ====================== */
async function renderCoachPagos(main){
  main.innerHTML = `<div class="detail"><header class="detail-head">
    <a class="back" href="#/">← Atletas</a>
    <p class="eyebrow">Panel del coach</p><h1>Pagos</h1>
    <p class="lede" style="margin-top:6px">Revisa el comprobante y aprueba: las sesiones o el acceso se activan al instante y el alumno recibe un aviso.</p></header>
    <section class="panel"><div class="panel-head"><h2>Por revisar</h2><span class="muted" id="pendCount"></span></div><div id="pagosPend"><div class="skel skel-block"></div></div></section>
    <section class="panel" style="margin-top:var(--gap)"><div class="panel-head"><h2>Revisados recientemente</h2></div><div id="pagosHist"></div></section>
  </div>`;
  const [{ data: pend }, { data: hist }] = await Promise.all([
    sb.from("compras").select("*").eq("estado", "pendiente").order("created_at"),
    sb.from("compras").select("*").neq("estado", "pendiente").order("revisado_at", { ascending: false }).limit(30)
  ]);
  const nombre = (id)=> (state.athleteList.find(a => a.id === id) || {}).nombre || "Alumno";
  const pendBox = document.getElementById("pagosPend");
  if(!pendBox) return;
  document.getElementById("pendCount").textContent = (pend || []).length ? plural(pend.length, "pago", "pagos") : "";
  pendBox.innerHTML = (pend || []).length ? `<ul class="pay-list">${pend.map(c => `
    <li class="pay-item" data-id="${esc(c.id)}">
      <div class="pay-main">
        <span class="avatar" aria-hidden="true">${esc(initials(nombre(c.user_id)))}</span>
        <div class="pay-info"><strong>${esc(nombre(c.user_id))}</strong>
          <span>${esc(c.paquete_nombre)} · <strong class="num">${dinero(c.monto, c.moneda)}</strong></span>
          <span class="muted">${esc(METODOS_PAGO[c.metodo] || c.metodo)}${c.operacion ? " · Op. " + esc(c.operacion) : ""} · ${fmtFechaHora(c.created_at)}</span></div>
      </div>
      <div class="pay-actions">
        ${c.comprobante_path ? `<button type="button" class="btn-outline" data-ver="${esc(c.comprobante_path)}">Ver comprobante</button>` : `<span class="muted">Sin captura</span>`}
        <button type="button" class="btn-primary pay-ok" data-aprobar="${esc(c.id)}">Aprobar</button>
        <button type="button" class="btn-danger" data-rechazar="${esc(c.id)}">Rechazar</button>
      </div>
      <div class="pay-msg" aria-live="polite"></div>
    </li>`).join("")}</ul>` : emptyHTML("No hay pagos por revisar.");
  document.getElementById("pagosHist").innerHTML = (hist || []).length ? `<ul class="mov-list">${hist.map(c => `
    <li><span class="mov-txt">${esc(nombre(c.user_id))} · ${esc(c.paquete_nombre)} · ${dinero(c.monto, c.moneda)}</span>
      <span class="res-state st-${c.estado}">${c.estado === "aprobada" ? "Aprobado" : "Rechazado"}</span>
      <span class="muted">${c.revisado_at ? fmtFecha(String(c.revisado_at).slice(0,10)) : ""}</span></li>`).join("")}</ul>` : `<p class="muted">Todavía no hay pagos revisados.</p>`;

  pendBox.querySelectorAll("[data-ver]").forEach(b => { b.onclick = ()=> verComprobante(b.dataset.ver); });
  pendBox.querySelectorAll("[data-aprobar]").forEach(b => {
    b.onclick = ()=> withBusy(b, "Aprobando…", async ()=>{
      const { error } = await sb.rpc("aprobar_compra", { p_compra: b.dataset.aprobar });
      if(error){ showError(b.closest(".pay-item").querySelector(".pay-msg"), error); return; }
      await renderCoachPagos(main); actualizarBadgePagos();
    });
  });
  pendBox.querySelectorAll("[data-rechazar]").forEach(b => {
    b.onclick = ()=>{
      const nota = prompt("Motivo del rechazo (el alumno lo verá):", "No encontramos el pago con esos datos.");
      if(nota === null) return;
      withBusy(b, "…", async ()=>{
        const { error } = await sb.rpc("rechazar_compra", { p_compra: b.dataset.rechazar, p_nota: nota });
        if(error){ showError(b.closest(".pay-item").querySelector(".pay-msg"), error); return; }
        await renderCoachPagos(main); actualizarBadgePagos();
      });
    };
  });
}
async function verComprobante(path){
  const { data, error } = await sb.storage.from("comprobantes").createSignedUrl(path, 300);
  if(error || !data){ openDialog("Comprobante", `<div class="error">${esc(errorES(error))}</div>`); return; }
  const url = data.signedUrl;
  openDialog("Comprobante", /\.pdf$/i.test(path)
    ? `<p><a class="btn-outline" href="${esc(url)}" target="_blank" rel="noopener">Abrir PDF</a></p>`
    : `<img class="voucher-img" src="${esc(url)}" alt="Comprobante de pago">`);
}
async function actualizarBadgePagos(){
  const el = document.getElementById("navPagosBadge");
  if(!el) return;
  const { data } = await sb.from("compras").select("id").eq("estado", "pendiente");
  const n = (data || []).length;
  el.hidden = n === 0; el.textContent = String(n);
}

/* ====================== COACH: HORARIO GENERAL DE LA SEMANA ======================
   Cada hora muestra a los reservados: terapia con el color de riesgo de su ficha, fortalecimiento con su propio fondo.
   Se vuelve a leer cada 30 segundos, así los check-in con QR aparecen solos (✓). */
const COLORES_RIESGO = [["rojo", "Rojo"], ["anaranjado", "Anaranjado"], ["amarillo", "Amarillo"], ["verde", "Verde"], ["azul", "Azul"]];
const agendaUI = { semana: null, timer: null };

function nombreCorto(n){
  const p = String(n || "Alumno").replace(/\(.*?\)/g, "").trim().split(/\s+/);
  return p[0] + (p[1] ? " " + p[1][0] + "." : "");
}
function lunesDe(d){ return sumarDias(d, 1 - isoDow(d)); }

async function renderCoachAgenda(main){
  const hoy = parseFecha(todayStr());
  agendaUI.semana = agendaUI.semana || fechaISO(lunesDe(hoy));
  const lunes = parseFecha(agendaUI.semana);
  const domingo = sumarDias(lunes, 6);
  const mismoMes = lunes.getMonth() === domingo.getMonth();
  const titulo = `Semana del ${lunes.getDate()}${mismoMes ? "" : " de " + MESES_LARGOS[lunes.getMonth()]} al ${domingo.getDate()} de ${MESES_LARGOS[domingo.getMonth()]}`;
  main.innerHTML = `<div class="detail"><header class="detail-head">
    <a class="back" href="#/">← Atletas</a>
    <div class="detail-title"><div><p class="eyebrow">Panel del coach</p><h1>Horario general</h1></div>
      <button type="button" class="btn-outline" id="btnVerQR">QR de recepción</button></div></header>
    <div class="agenda-bar">
      <button type="button" class="icon-btn" id="agPrev" aria-label="Semana anterior">‹</button>
      <span class="agenda-day">${titulo}</span>
      <button type="button" class="icon-btn" id="agNext" aria-label="Semana siguiente">›</button>
      ${agendaUI.semana === fechaISO(lunesDe(hoy)) ? "" : `<button type="button" class="btn-link" id="agHoy">Esta semana</button>`}
    </div>
    <p class="wk-leyenda">
      <span class="wk-l-titulo">Terapia:</span>${COLORES_RIESGO.map(([k, n]) => `<span><i class="wk-sw r-${k}"></i>${n}</span>`).join("")}<span><i class="wk-sw r-sin"></i>Sin color</span>
      <span class="wk-l-sep"><i class="wk-sw fort"></i>Fortalecimiento</span><span>✓ llegó</span>
    </p>
    <div id="wkBody"><div class="skel skel-block" style="height:320px"></div></div></div>`;
  const ir = (iso)=>{ agendaUI.semana = iso; renderCoachAgenda(main); };
  document.getElementById("agPrev").onclick = ()=> ir(fechaISO(sumarDias(lunes, -7)));
  document.getElementById("agNext").onclick = ()=> ir(fechaISO(sumarDias(lunes, 7)));
  const bh = document.getElementById("agHoy"); if(bh) bh.onclick = ()=> ir(fechaISO(lunesDe(hoy)));
  document.getElementById("btnVerQR").onclick = abrirQRRecepcion;
  await pintarSemana(main);
  clearInterval(agendaUI.timer);
  agendaUI.timer = setInterval(()=>{
    if(!document.getElementById("wkBody") || routeCoachSeccion() !== "agenda"){ clearInterval(agendaUI.timer); agendaUI.timer = null; return; }
    if(!document.querySelector(".overlay")) pintarSemana(main);
  }, 30000);
}

async function pintarSemana(main){
  const body = document.getElementById("wkBody");
  if(!body) return;
  const lunes = parseFecha(agendaUI.semana);
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
  const [horarios, { data: res, error }] = await Promise.all([
    cargarHorarios(true),
    sb.from("reservas").select("*").gte("fecha", fechaISO(dias[0])).lte("fecha", fechaISO(dias[6]))
      .in("estado", ["confirmada", "espera", "asistio", "no_asistio"]).order("created_at")
  ]);
  if(!document.getElementById("wkBody")) return;
  if(error){ body.innerHTML = `<div class="error" role="alert">${esc(errorES(error))}</div>`; return; }
  const activos = horarios.filter(h => h.activo);
  const conReserva = new Set((res || []).map(r => r.horario_id));
  const visibles = horarios.filter(h => h.activo || conReserva.has(h.id));
  const columnas = dias.filter(d => visibles.some(h => h.dia_semana === isoDow(d)));
  const horas = [...new Set(visibles.map(h => horaCorta(h.hora)))].sort();
  if(!activos.length){ body.innerHTML = emptyHTML("No hay horarios publicados. Agrégalos en Ajustes."); return; }
  const hoyISO = todayStr();
  const ahora = new Date();
  const perfil = (id)=> state.athleteList.find(a => a.id === id) || {};

  const celda = (d, hora)=>{
    const iso = fechaISO(d);
    const hs = visibles.filter(h => h.dia_semana === isoDow(d) && horaCorta(h.hora) === hora);
    if(!hs.length) return `<td class="wk-cell vacia"></td>`;
    return `<td class="wk-cell">${hs.map(h => {
      const rs = (res || []).filter(r => r.horario_id === h.id && r.fecha === iso);
      const conf = rs.filter(r => r.estado !== "espera");
      const llegaron = rs.filter(r => r.estado === "asistio").length;
      const pasado = inicioLocal(iso, h.hora) < ahora;
      return `
        <div class="wk-slot ${h.categoria === "terapia" ? "ter" : "fort"}${pasado ? " pasado" : ""}">
          <span class="wk-cap"><span class="sr-only">${CATEGORIAS[h.categoria].nombre}: </span>${h.categoria === "terapia" ? "Terapia" : "Fortalecimiento"} · <span class="num">${conf.length}/${h.aforo}</span>${llegaron ? ` · <span class="num">${llegaron}</span> ✓` : ""}</span>
          ${rs.length ? `<ul class="wk-people">${rs.map(r => {
            const p = perfil(r.user_id);
            const tono = h.categoria === "terapia" ? `r-${p.color_riesgo || "sin"}` : "fort";
            const marca = r.estado === "asistio" ? " ✓" : r.estado === "espera" ? " · espera" : "";
            return `<li><button type="button" class="wk-chip ${tono} st-${r.estado}" data-res="${esc(r.id)}" title="${esc(p.nombre || "Alumno")}">${esc(nombreCorto(p.nombre))}${marca}</button></li>`;
          }).join("")}</ul>` : ""}
        </div>`;
    }).join("")}</td>`;
  };

  body.innerHTML = `
    <div class="wk-scroll" tabindex="0" aria-label="Horario de la semana">
      <table class="wk-grid" id="wkGrid">
        <thead><tr><th scope="col" class="wk-hora"><span class="sr-only">Hora</span></th>${columnas.map(d => {
          const iso = fechaISO(d);
          return `<th scope="col" class="${iso === hoyISO ? "hoy" : ""}"${iso === hoyISO ? ' aria-current="date"' : ""}><span class="wk-dia">${DIAS_SEMANA[isoDow(d)]}</span><span class="wk-num num">${d.getDate()}</span></th>`;
        }).join("")}</tr></thead>
        <tbody>${horas.map(hora => `<tr><th scope="row" class="wk-hora num">${hora}</th>${columnas.map(d => celda(d, hora)).join("")}</tr>`).join("")}</tbody>
      </table>
    </div>
    <p class="muted wk-nota">Toca un nombre para marcar asistencia, cancelar o abrir su ficha. Se actualiza solo cada 30 segundos.</p>`;

  const colHoy = body.querySelector("th.hoy");
  if(colHoy && window.matchMedia("(max-width: 1023px)").matches){
    const sc = body.querySelector(".wk-scroll");
    sc.scrollLeft = Math.max(0, colHoy.offsetLeft - 64);
  }
  body.querySelectorAll("[data-res]").forEach(b => {
    b.onclick = ()=> abrirReservaCoach((res || []).find(r => r.id === b.dataset.res), horarios, main);
  });
}

function abrirReservaCoach(r, horarios, main){
  if(!r) return;
  const h = horarios.find(x => x.id === r.horario_id) || {};
  const p = state.athleteList.find(a => a.id === r.user_id) || {};
  const ini = new Date(r.inicio);
  const empezo = ini <= new Date();
  const color = COLORES_RIESGO.find(([k]) => k === p.color_riesgo);
  const d = openDialog(p.nombre || "Alumno", `
    <div class="confirm-slot">
      <span class="cs-day">${fechaLarga(r.fecha)}</span>
      <span class="cs-time num">${horaCorta(h.hora)}</span>
      <span class="muted">${CATEGORIAS[h.categoria] ? CATEGORIAS[h.categoria].nombre : ""}${h.categoria === "terapia" ? ` · ${color ? "color " + color[1].toLowerCase() : "sin color de riesgo"}` : ""}</span>
    </div>
    <p><strong>${ESTADO_RESERVA[r.estado]}</strong>${r.checkin_at ? ` · llegó a las ${new Date(r.checkin_at).toTimeString().slice(0, 5)}` : ""}</p>
    <div class="row" style="margin-top:6px">
      ${r.estado !== "espera" && (empezo || r.estado !== "confirmada") ? `
        <button type="button" class="btn-outline" data-asis="1" style="margin-top:0">✓ Asistió</button>
        <button type="button" class="btn-outline" data-asis="0" style="margin-top:0">✕ No asistió</button>` : ""}
      ${!empezo && ["confirmada", "espera"].includes(r.estado) ? `<button type="button" class="btn-danger" id="rcCancelar">Cancelar reserva</button>` : ""}
    </div>
    <a class="btn-link" href="#/atleta/${encodeURIComponent(r.user_id)}" id="rcFicha" style="margin-top:10px">Abrir ficha →</a>
    <div id="rcMsg" aria-live="polite"></div>`);
  d.el.querySelector("#rcFicha").onclick = ()=> d.close();
  d.el.querySelectorAll("[data-asis]").forEach(b => {
    b.onclick = ()=> withBusy(b, "…", async ()=>{
      const { error } = await sb.rpc("marcar_asistencia", { p_reserva: r.id, p_asistio: b.dataset.asis === "1" });
      if(error){ showError(d.el.querySelector("#rcMsg"), error); return; }
      d.close(); pintarSemana(main);
    });
  });
  const bc = d.el.querySelector("#rcCancelar");
  if(bc) bc.onclick = ()=>{
    if(!confirm(h.categoria === "terapia" ? "¿Cancelar esta reserva? La sesión se devuelve al alumno y se le avisa." : "¿Cancelar este horario? Se le avisa al alumno.")) return;
    withBusy(bc, "…", async ()=>{
      const { error } = await sb.rpc("cancelar_reserva", { p_reserva: r.id });
      if(error){ showError(d.el.querySelector("#rcMsg"), error); return; }
      d.close(); pintarSemana(main);
    });
  };
}


/* QR de recepción para imprimir */
let qrLibPromise = null;
function cargarLibQR(){
  if(window.qrcode) return Promise.resolve();
  qrLibPromise = qrLibPromise || new Promise((ok, fail) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js";
    s.onload = ok; s.onerror = ()=>{ qrLibPromise = null; fail(new Error("No se pudo cargar el generador de QR.")); };
    document.head.appendChild(s);
  });
  return qrLibPromise;
}
async function abrirQRRecepcion(){
  const dlg = openDialog("QR de recepción", `<div id="qrBox" class="qr-box"><div class="skel" style="width:240px;height:240px;margin:auto"></div></div>`);
  try{
    const [{ data, error }] = await Promise.all([sb.from("checkin_qr").select("*").eq("id", 1).single(), cargarLibQR()]);
    if(error || !data) throw error || new Error("Sin código");
    pintarQR(dlg, data.codigo);
  } catch(e){
    dlg.el.querySelector("#qrBox").innerHTML = `<div class="error">${esc(e && e.message ? errorES(e) : "No se pudo generar el QR.")}</div>`;
  }
}
function pintarQR(dlg, codigo){
  const url = `${location.origin}${location.pathname}#/checkin/${codigo}`;
  const qr = window.qrcode(0, "M"); qr.addData(url); qr.make();
  dlg.el.querySelector("#qrBox").innerHTML = `
    <div class="qr-print" id="qrPrint">
      <p class="qr-brand">GYMNIKA</p>
      <div class="qr-svg">${qr.createSvgTag({ cellSize: 7, margin: 2, scalable: true })}</div>
      <p class="qr-title">Registra tu asistencia</p>
      <p class="qr-sub">Escanea con la cámara de tu celular</p>
    </div>
    <p class="muted" style="margin-top:12px">Imprímelo y déjalo en recepción. Si alguien lo comparte fuera del centro, genera uno nuevo: el anterior deja de funcionar.</p>
    <div class="row" style="margin-top:10px">
      <button type="button" class="btn-primary" id="btnImprimirQR" style="margin-top:0">Imprimir</button>
      <button type="button" class="btn-outline" id="btnNuevoQR">Generar código nuevo</button>
    </div>`;
  dlg.el.querySelector("#btnImprimirQR").onclick = ()=>{
    const w = window.open("", "_blank", "width=600,height=800");
    if(!w){ alert("Permite las ventanas emergentes para imprimir."); return; }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>QR Gymnika</title><style>
      body{font-family:system-ui,sans-serif;text-align:center;margin:40px;color:#35292F}
      .qr-brand{font-weight:800;letter-spacing:.12em;font-size:28px;margin:0 0 16px}
      .qr-svg svg{width:340px;height:340px}.qr-title{font-size:30px;font-weight:800;margin:18px 0 4px}.qr-sub{font-size:18px;margin:0}
      </style></head><body>${dlg.el.querySelector("#qrPrint").innerHTML}<script>onload=()=>{print()}${"<"}/script></body></html>`);
    w.document.close();
  };
  const bn = dlg.el.querySelector("#btnNuevoQR");
  bn.onclick = ()=>{
    if(!confirm("¿Generar un código nuevo? El QR impreso actual dejará de funcionar.")) return;
    withBusy(bn, "…", async ()=>{
      const { data, error } = await sb.rpc("regenerar_qr");
      if(error){ alert(errorES(error)); return; }
      pintarQR(dlg, data);
    });
  };
}

/* ====================== COACH: AJUSTES ====================== */
/* Números para el aviso de WhatsApp: solo dígitos, con código de país (un celular peruano de 9 dígitos recibe el 51) */
function normalizarWhatsapp(texto){
  const numeros = [], invalidos = [];
  String(texto || "").split(/[,;\n]+/).map(s => s.trim()).filter(Boolean).forEach(s => {
    let d = s.replace(/\D/g, "");
    if(/^9\d{8}$/.test(d)) d = "51" + d;
    if(d.length < 10 || d.length > 15) invalidos.push(s); else if(!numeros.includes(d)) numeros.push(d);
  });
  return { numeros, invalidos };
}
function estadoAvisoTexto(l){
  if(!l) return "Todavía no se ha enviado ningún aviso.";
  if(l.enviado_at) return `Último aviso enviado a ${esc(l.enviado_a)} · ${fmtFechaHora(l.enviado_at)}.`;
  return `El último aviso no se envió (${fmtFechaHora(l.created_at)}): ${esc(l.error || "motivo desconocido")}`;
}
async function renderCoachAjustes(main){
  const [aj, paquetes, horarios, { data: comunicados }, { data: avisos }, { data: links }] = await Promise.all([
    cargarAjustes(true), cargarPaquetes(true), cargarHorarios(true),
    sb.from("comunicados").select("*").order("created_at", { ascending: false }).limit(20),
    sb.from("avisos_config").select("*").eq("id", 1).maybeSingle(),
    sb.from("pago_links").select("enviado_a,enviado_at,error,created_at").order("created_at", { ascending: false }).limit(1)
  ]);
  const ultimoAviso = (links || [])[0] || null;
  main.innerHTML = `<div class="detail"><header class="detail-head">
    <a class="back" href="#/">← Atletas</a>
    <p class="eyebrow">Panel del coach</p><h1>Ajustes del centro</h1></header>
    <div class="grid">
      <section class="panel span-6"><div class="panel-head"><h2>Comunicados</h2><span class="muted">Llegan al inbox de los alumnos</span></div>
        <div class="form-grid">
          <div class="full"><label for="comTitulo" style="margin-top:0">Título</label><input id="comTitulo" placeholder="Ej: Feriado del lunes"></div>
          <div class="full"><label for="comMsg">Mensaje</label><textarea id="comMsg" rows="3" placeholder="Ej: El lunes 1 de noviembre no habrá sesiones."></textarea></div>
          <div class="full"><label for="comDestino">Para</label><select id="comDestino"><option value="todos">Todos los alumnos</option><option value="terapia">Solo terapia</option><option value="fortalecimiento">Solo fortalecimiento</option></select></div>
        </div>
        <button type="button" class="btn-primary" id="btnPublicar">Publicar comunicado</button><div id="comMsgBox" aria-live="polite"></div>
        ${(comunicados || []).length ? `<details class="records"><summary>Enviados (${comunicados.length})</summary><ul class="mov-list">${comunicados.map(c => `
          <li><span class="mov-txt"><strong>${esc(c.titulo)}</strong> · ${esc(c.destino === "todos" ? "Todos" : CATEGORIAS[c.destino].nombre)}</span><span class="muted">${fmtFecha(String(c.created_at).slice(0,10))}</span>
          <button type="button" class="btn-danger icon" data-del-com="${esc(c.id)}" aria-label="Borrar comunicado">✕</button></li>`).join("")}</ul></details>` : ""}
      </section>
      <section class="panel span-6"><div class="panel-head"><h2>Pagos y reservas</h2></div>
        <div class="form-grid">
          <div><label for="ajYape" style="margin-top:0">Número de Yape</label><input id="ajYape" inputmode="tel" value="${esc(aj.yape_numero || "")}"></div>
          <div><label for="ajPlin" style="margin-top:0">Número de Plin</label><input id="ajPlin" inputmode="tel" value="${esc(aj.plin_numero || "")}"></div>
          <div class="full"><label for="ajTitular">Titular de la cuenta</label><input id="ajTitular" value="${esc(aj.titular_pago || "")}"></div>
          <div><label for="ajHoras">Cancelación sin costo hasta (horas antes)</label><input type="number" id="ajHoras" min="0" max="168" value="${aj.horas_cancelacion}"></div>
          <div><label>Se puede reservar</label><p class="muted" style="margin:10px 0 0">Hasta el último día del mes siguiente.</p></div>
          <div class="full"><label class="checkline" for="ajAforo"><input type="checkbox" id="ajAforo" ${aj.mostrar_aforo ? "checked" : ""}><span>Mostrar a los alumnos cuántos cupos quedan</span></label></div>
          <div class="full"><label class="checkline" for="ajLugar"><input type="checkbox" id="ajLugar" ${aj.seleccion_lugar ? "checked" : ""}><span>Que el alumno elija su lugar (camilla o estación) al reservar</span></label></div>
        </div>
        <button type="button" class="btn-primary" id="btnGuardarAj">Guardar</button><div id="ajMsg" aria-live="polite"></div>
      </section>
      <section class="panel span-6"><div class="panel-head"><h2>Aviso de pagos por WhatsApp</h2></div>
        <p class="muted" style="margin:0">Cuando un alumno sube su comprobante, estos números reciben el pantallazo y un botón para aprobar el pago y acreditar sus sesiones.</p>
        <label for="ajWhatsapp">Números que reciben el aviso</label>
        <input id="ajWhatsapp" inputmode="tel" placeholder="Ej: 51987654321" value="${esc((avisos && avisos.whatsapp_aviso) || "")}">
        <p class="muted" style="margin-top:6px">Con código de país (51 para Perú). Si son varios, sepáralos con coma.</p>
        <p class="${ultimoAviso && ultimoAviso.error ? "plan-alert warn" : "plan-alert"}">${estadoAvisoTexto(ultimoAviso)}</p>
        <button type="button" class="btn-primary" id="btnGuardarWa">Guardar números</button><div id="waMsg" aria-live="polite"></div>
      </section>
      ${["terapia","fortalecimiento"].map(cat => `
      <section class="panel span-6"><div class="panel-head"><h2>Paquetes de ${CATEGORIAS[cat].nombre.toLowerCase()}</h2></div>
        <div class="table-wrap"><table class="edit-table"><thead><tr><th scope="col">Nombre</th><th scope="col">${cat === "terapia" ? "Sesiones" : "Días"}</th><th scope="col">Precio ${cat === "terapia" ? "US$" : "S/"}</th><th scope="col">Activo</th><th scope="col"><span class="sr-only">Guardar</span></th></tr></thead>
        <tbody>${paquetes.filter(p => p.categoria === cat).map(p => `
          <tr data-paq="${esc(p.id)}"><td><input class="t-in" data-f="nombre" value="${esc(p.nombre)}" aria-label="Nombre"></td>
            <td><input class="t-in num-in" type="number" min="1" data-f="${cat === "terapia" ? "sesiones" : "dias"}" value="${cat === "terapia" ? p.sesiones : p.dias}" aria-label="Cantidad"></td>
            <td><input class="t-in num-in" type="number" min="0" step="0.5" data-f="precio" value="${Number(p.precio)}" aria-label="Precio"></td>
            <td><input type="checkbox" data-f="activo" ${p.activo ? "checked" : ""} aria-label="Activo"></td>
            <td class="actions"><button type="button" class="btn-outline sm" data-save-paq>Guardar</button></td></tr>`).join("")}
          <tr class="new-row" data-new-paq="${cat}"><td><input class="t-in" data-f="nombre" placeholder="Nuevo paquete" aria-label="Nombre"></td>
            <td><input class="t-in num-in" type="number" min="1" data-f="${cat === "terapia" ? "sesiones" : "dias"}" placeholder="${cat === "terapia" ? "4" : "30"}" aria-label="Cantidad"></td>
            <td><input class="t-in num-in" type="number" min="0" step="0.5" data-f="precio" placeholder="0" aria-label="Precio"></td><td></td>
            <td class="actions"><button type="button" class="btn-outline sm" data-add-paq>Agregar</button></td></tr>
        </tbody></table></div><div class="paq-msg" aria-live="polite"></div>
      </section>`).join("")}
      ${["terapia","fortalecimiento"].map(cat => `
      <section class="panel span-6"><div class="panel-head"><h2>Horarios de ${CATEGORIAS[cat].nombre.toLowerCase()}</h2><span class="muted">${cat === "terapia" ? "Aforo por horario" : "Reserva obligatoria · aforo por horario"}</span></div>
        <ul class="sched-list">${[1,2,3,4,5,6,7].map(dw => {
          const hs = horarios.filter(h => h.categoria === cat && h.dia_semana === dw);
          return hs.length ? `<li><span class="wl-day">${DIAS_SEMANA[dw]}</span><span class="wl-hours">${hs.map(h => `
            <span class="hour-chip edit${h.activo ? "" : " off"}"><span class="num">${horaCorta(h.hora)}</span><span class="muted">·${h.aforo}</span>
              <button type="button" data-toggle-h="${esc(h.id)}" aria-label="${h.activo ? "Pausar" : "Activar"} ${horaCorta(h.hora)}">${h.activo ? "⏸" : "▶"}</button>
              <button type="button" data-del-h="${esc(h.id)}" aria-label="Borrar ${horaCorta(h.hora)}">✕</button></span>`).join("")}</span></li>` : "";
        }).join("")}</ul>
        <div class="inline-add sched-add" data-cat="${cat}">
          <select data-f="dia" aria-label="Día">${[1,2,3,4,5,6,7].map(dw => `<option value="${dw}">${DIAS_SEMANA[dw]}</option>`).join("")}</select>
          <input type="time" data-f="hora" value="18:00" aria-label="Hora">
          <input type="number" data-f="aforo" min="1" max="50" value="${cat === "terapia" ? 8 : 20}" aria-label="Aforo" title="Aforo">
          <button type="button" class="btn-outline" data-add-h>Agregar</button>
        </div><div class="h-msg" aria-live="polite"></div>
      </section>`).join("")}
      <section class="panel span-12"><div class="panel-head"><h2>Términos y condiciones</h2><span class="muted">Se muestran al registrarse</span></div>
        <textarea id="ajTerminos" rows="10">${esc(aj.terminos || TERMINOS_BORRADOR)}</textarea>
        <button type="button" class="btn-primary" id="btnGuardarTerminos">Guardar términos</button><div id="termMsg" aria-live="polite"></div>
      </section>
    </div></div>`;

  const bAj = document.getElementById("btnGuardarAj");
  bAj.onclick = ()=> withBusy(bAj, "Guardando…", async ()=>{
    const payload = {
      yape_numero: document.getElementById("ajYape").value.trim() || null,
      plin_numero: document.getElementById("ajPlin").value.trim() || null,
      titular_pago: document.getElementById("ajTitular").value.trim() || null,
      horas_cancelacion: parseInt(document.getElementById("ajHoras").value, 10) || 0,
      mostrar_aforo: document.getElementById("ajAforo").checked,
      seleccion_lugar: document.getElementById("ajLugar").checked,
      updated_at: new Date().toISOString()
    };
    const { error } = await sb.from("ajustes").update(payload).eq("id", 1);
    if(error){ showError(document.getElementById("ajMsg"), error); return; }
    planes.ajustes = { ...aj, ...payload };
    showMsg(document.getElementById("ajMsg"), "ok", "Ajustes guardados.");
  });
  const bW = document.getElementById("btnGuardarWa");
  bW.onclick = ()=> withBusy(bW, "Guardando…", async ()=>{
    const msg = document.getElementById("waMsg");
    const { numeros, invalidos } = normalizarWhatsapp(document.getElementById("ajWhatsapp").value);
    if(invalidos.length){ showMsg(msg, "error", `Revisa este número: ${invalidos[0]}. Escríbelo con código de país, por ejemplo 51987654321.`); return; }
    const valor = numeros.join(", ") || null;
    const { error } = await sb.from("avisos_config").update({ whatsapp_aviso: valor, updated_at: new Date().toISOString() }).eq("id", 1);
    if(error){ showError(msg, error); return; }
    document.getElementById("ajWhatsapp").value = valor || "";
    showMsg(msg, "ok", valor ? "Números guardados. El próximo pago llegará por WhatsApp." : "Aviso por WhatsApp desactivado.");
  });
  const bT = document.getElementById("btnGuardarTerminos");
  bT.onclick = ()=> withBusy(bT, "Guardando…", async ()=>{
    const terminos = document.getElementById("ajTerminos").value.trim() || null;
    const { error } = await sb.from("ajustes").update({ terminos, updated_at: new Date().toISOString() }).eq("id", 1);
    if(error){ showError(document.getElementById("termMsg"), error); return; }
    planes.ajustes = { ...aj, terminos };
    showMsg(document.getElementById("termMsg"), "ok", "Términos guardados.");
  });
  const bP = document.getElementById("btnPublicar");
  bP.onclick = ()=> withBusy(bP, "Publicando…", async ()=>{
    const titulo = document.getElementById("comTitulo").value.trim();
    const mensaje = document.getElementById("comMsg").value.trim();
    const box = document.getElementById("comMsgBox");
    if(!titulo || !mensaje){ showMsg(box, "error", "Escribe título y mensaje."); return; }
    const { error } = await sb.from("comunicados").insert({ titulo, mensaje, destino: document.getElementById("comDestino").value, autor: state.profile.id });
    if(error){ showError(box, error); return; }
    await renderCoachAjustes(main);
    showMsg(document.getElementById("comMsgBox"), "ok", "Comunicado enviado al inbox de los alumnos.");
  });
  main.querySelectorAll("[data-del-com]").forEach(b => {
    b.onclick = ()=>{ if(!confirm("¿Borrar este comunicado del historial?")) return;
      withBusy(b, "…", async ()=>{ const { error } = await sb.from("comunicados").delete().eq("id", b.dataset.delCom); if(error){ alert(errorES(error)); return; } renderCoachAjustes(main); }); };
  });
  const leerFila = (tr)=>{ const o = {}; tr.querySelectorAll("[data-f]").forEach(i => { o[i.dataset.f] = i.type === "checkbox" ? i.checked : i.value; }); return o; };
  main.querySelectorAll("[data-save-paq]").forEach(b => {
    b.onclick = ()=> withBusy(b, "…", async ()=>{
      const tr = b.closest("tr"); const v = leerFila(tr); const msg = tr.closest("section").querySelector(".paq-msg");
      const payload = { nombre: v.nombre.trim(), precio: Number(v.precio), activo: v.activo };
      if(v.sesiones !== undefined) payload.sesiones = parseInt(v.sesiones, 10); else payload.dias = parseInt(v.dias, 10);
      if(!payload.nombre || isNaN(payload.precio)){ showMsg(msg, "error", "Completa nombre y precio."); return; }
      const { error } = await sb.from("paquetes").update(payload).eq("id", tr.dataset.paq);
      if(error){ showError(msg, error); return; }
      planes.paquetes = null; showMsg(msg, "ok", "Paquete guardado.");
    });
  });
  main.querySelectorAll("[data-add-paq]").forEach(b => {
    b.onclick = ()=> withBusy(b, "…", async ()=>{
      const tr = b.closest("tr"); const v = leerFila(tr); const cat = tr.dataset.newPaq; const msg = tr.closest("section").querySelector(".paq-msg");
      const payload = { categoria: cat, nombre: (v.nombre || "").trim(), precio: Number(v.precio), orden: 99 };
      if(cat === "terapia") payload.sesiones = parseInt(v.sesiones, 10); else payload.dias = parseInt(v.dias, 10);
      if(!payload.nombre || !(payload.sesiones || payload.dias) || isNaN(payload.precio) || v.precio === ""){ showMsg(msg, "error", "Completa nombre, cantidad y precio."); return; }
      const { error } = await sb.from("paquetes").insert(payload);
      if(error){ showError(msg, error); return; }
      renderCoachAjustes(main);
    });
  });
  main.querySelectorAll("[data-add-h]").forEach(b => {
    b.onclick = ()=> withBusy(b, "…", async ()=>{
      const box = b.closest(".sched-add"); const v = leerFila(box); const msg = box.parentElement.querySelector(".h-msg");
      if(!v.hora){ showMsg(msg, "error", "Elige la hora."); return; }
      const { error } = await sb.from("horarios").insert({ categoria: box.dataset.cat, dia_semana: parseInt(v.dia, 10), hora: v.hora, aforo: parseInt(v.aforo, 10) || 8, duracion_min: 60 });
      if(error){ showError(msg, error); return; }
      planes.horarios = null; renderCoachAjustes(main);
    });
  });
  main.querySelectorAll("[data-toggle-h]").forEach(b => {
    b.onclick = ()=> withBusy(b, "…", async ()=>{
      const h = horarios.find(x => x.id === b.dataset.toggleH);
      const { error } = await sb.from("horarios").update({ activo: !h.activo }).eq("id", h.id);
      if(error){ alert(errorES(error)); return; }
      planes.horarios = null; renderCoachAjustes(main);
    });
  });
  main.querySelectorAll("[data-del-h]").forEach(b => {
    b.onclick = ()=>{
      if(!confirm("¿Borrar este horario? Si solo quieres dejar de ofrecerlo por un tiempo, usa ⏸.")) return;
      withBusy(b, "…", async ()=>{
        const { data: futuras } = await sb.from("reservas").select("id").eq("horario_id", b.dataset.delH)
          .in("estado", ["confirmada", "espera"]).gte("fecha", todayStr());
        if((futuras || []).length){ alert(`Este horario tiene ${plural(futuras.length, "reserva próxima", "reservas próximas")}. Páusalo con ⏸ o cancela esas reservas primero desde el Horario.`); return; }
        const { error } = await sb.from("horarios").delete().eq("id", b.dataset.delH);
        if(error){ alert(errorES(error)); return; }
        planes.horarios = null; renderCoachAjustes(main);
      });
    };
  });
}
