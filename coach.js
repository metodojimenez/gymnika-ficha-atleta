/* ====================== COACH: PLAN DEL ALUMNO ====================== */
/* Chip en la cabecera de la ficha (solo master): días de acceso que le quedan o sesiones de terapia */
function pintarAccesoChip(plan, cat, rs){
  const chip = document.getElementById("accesoChip");
  if(!chip) return;
  const hoy = todayStr();
  let txt = "", nivel = "ok";
  if(cat === "terapia"){
    const n = rs.disponibles;
    txt = rs.debe ? `−${rs.debe} a crédito${rs.puede ? ` · puede agendar ${rs.puede}` : ""}` : n > 0 ? `${plural(n, "sesión disponible", "sesiones disponibles")}` : "Sin sesiones disponibles";
    nivel = rs.debe ? "fin" : n > 2 ? "ok" : n > 0 ? "poco" : "fin";
  } else {
    const est = estadoMembresia(plan);
    if(est.congelado){ txt = `Acceso congelado hasta el ${fmtFecha(est.congelado.hasta)}`; nivel = "poco"; }
    else if(est.vigente){
      const d = diasEntre(hoy, est.finTotal) + 1;
      txt = `Acceso: ${plural(d, "día", "días")} · vence el ${fmtFecha(est.finTotal)}`;
      nivel = d > 7 ? "ok" : "poco";
    }
    else if(est.futura){ txt = `Acceso desde el ${fmtFecha(est.futura.inicio)} · ${plural(diasEntre(est.futura.inicio, est.finTotal) + 1, "día", "días")}`; }
    else { txt = est.ultima ? `Acceso vencido el ${fmtFecha(est.ultima.fin)}` : "Sin acceso"; nivel = "fin"; }
    if(plan.membresias.some(m => m.provisional)){ txt += " · por regularizar"; if(nivel === "ok") nivel = "poco"; }
  }
  chip.textContent = txt;
  chip.className = "chip acceso-chip acc-" + nivel;
  chip.hidden = false;
}
async function renderPlanCoach(profile){
  const box = document.getElementById("planCard");
  if(!box) return;
  const cat = profile.categoria;
  const master = esMaster();
  const catSelect = `
    <div class="inline-add" style="align-items:end;margin-bottom:6px">
      ${master ? `<div style="flex:1 1 140px;min-width:0"><label for="coachCat" style="margin-top:0">Categoría</label>
        <select id="coachCat"><option value="">Sin definir</option>${Object.entries(CATEGORIAS).map(([k,c]) => `<option value="${k}" ${cat === k ? "selected" : ""}>${c.nombre}</option>`).join("")}</select></div>` : ""}
      <div style="flex:1 1 140px;min-width:0"><label for="coachInicio" style="margin-top:0">Inicio en Gymnika</label>
        <input type="date" id="coachInicio" value="${esc(profile.fecha_inicio || "")}"></div>
      <button type="button" class="btn-outline" id="btnGuardarCat">Guardar</button>
    </div><div id="catMsg" aria-live="polite"></div>`;
  if(!cat){ box.innerHTML = catSelect + `<p class="muted" style="margin-top:10px">Elige la categoría para ver sus sesiones o su acceso mensual.</p>`; bindCat(); return; }
  const [plan] = await Promise.all([cargarPlanDe(profile.id, cat), cargarHorarios()]);
  if(!document.getElementById("planCard")) return;
  plan.credito = profile.credito_sesiones || 0;
  const rs = resumenSesiones(plan, cat);
  pintarAccesoChip(plan, cat, rs);
  const avisoSesiones = !rs.debe && rs.disponibles <= 0 && rs.agendadas.length <= 2 && (plan.movs || []).length
    ? `<p class="plan-alert warn" role="status">${rs.agendadas.length ? `Ya agendó todas sus sesiones: le ${rs.agendadas.length === 1 ? "queda 1" : "quedan 2"} por hacer.` : "No le quedan sesiones."}${master ? " Conviene ofrecerle un nuevo paquete." : ""}</p>` : "";
  const comprasHTML = master && plan.compras.length ? `
    <details class="records"><summary>Pagos (${plan.compras.length})</summary>
      <ul class="mov-list">${plan.compras.map(c => `<li><span class="mov-txt">${esc(c.paquete_nombre)} · ${dinero(c.monto, c.moneda)} · ${esc(METODOS_PAGO[c.metodo] || c.metodo)}</span>
        <span class="res-state st-${c.estado}">${c.estado === "pendiente" ? "Pendiente" : c.estado === "aprobada" ? "Aprobado" : "Rechazado"}</span>
        <span class="muted">${fmtFecha(String(c.created_at).slice(0,10))}</span></li>`).join("")}</ul></details>` : "";

  if(cat === "terapia"){
    const ahora = new Date();
    const prox = plan.reservas.filter(r => ["confirmada","espera"].includes(r.estado) && new Date(r.inicio) > ahora)
      .sort((a,b)=> String(a.inicio).localeCompare(String(b.inicio)));
    box.innerHTML = catSelect + riesgoPickerHTML(profile) + `
      ${sesionesHTML(rs, { propio: false, sinCredito: master })}
      ${avisoSesiones}
      ${master ? `<div class="inline-add tokens-adj">
        <input type="number" id="adjCant" inputmode="numeric" placeholder="+2 o −1" aria-label="Sesiones a sumar o restar">
        <input id="adjNota" placeholder="Motivo (ej: cortesía) · solo lo ve el equipo" aria-label="Motivo del ajuste (solo lo ve el equipo)" title="El alumno no ve este motivo">
        <button type="button" class="btn-outline" id="btnAjustar">Ajustar</button>
      </div>
      ${creditoControlHTML(profile, plan, rs)}` : ""}
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
    bindCredito(profile, rs);
    const ba = document.getElementById("btnAjustar");
    if(ba) ba.onclick = ()=> withBusy(ba, "…", async ()=>{
      const n = parseInt(document.getElementById("adjCant").value, 10);
      const msg = document.getElementById("adjMsg");
      if(!n){ showMsg(msg, "error", "Escribe cuántas sesiones sumar (ej: 2) o restar (ej: -1)."); return; }
      const { error } = await sb.rpc("ajustar_tokens", { p_user: profile.id, p_cantidad: n, p_nota: document.getElementById("adjNota").value });
      if(error){ showError(msg, error); return; }
      await renderPlanCoach(profile);
      if(document.getElementById("reservarCard")){ state.plan = null; await renderReservasAlumno(profile); }
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
  /* Con acceso activo, congelado o programado no se ofrece «Habilitar acceso»: queda «Extender acceso» plegado */
  const conAcceso = !!(est.vigente || est.congelado || est.futura);
  /* Acceso de bienvenida: 7 días automáticos al registrarse en fortalecimiento, hasta que un master lo regularice */
  const bienvenida = plan.membresias.find(m => m.provisional);
  const bienvenidaHTML = !bienvenida || !master ? "" : `
    <div class="plan-alert warn bienvenida" role="status">
      <strong>Acceso de bienvenida por regularizar.</strong> Al crear su cuenta recibió 7 días (del ${fmtFecha(bienvenida.inicio)} al ${fmtFecha(bienvenida.fin, true)}).
      Cuando pague, extiende su acceso o aprueba su compra y queda regularizado. Si no va a seguir, quítale el acceso.
      <div class="bienvenida-acc"><button type="button" class="btn-outline" id="btnRegularizar">Ya está regularizado</button></div>
      <div id="regMsg" aria-live="polite"></div>
    </div>`;
  /* Transición: además del acceso de fortalecimiento, las sesiones de terapia (y el color de riesgo para el horario de terapia) */
  const terHTML = cat !== "transicion" ? "" : `
    <div class="trans-ter-coach">
      <p class="eyebrow">Terapia</p>
      ${riesgoPickerHTML(profile)}
      ${sesionesHTML(rs, { propio: false, sinCredito: master })}
      ${avisoSesiones}
      ${master ? `<div class="inline-add tokens-adj">
        <input type="number" id="adjCant" inputmode="numeric" placeholder="+2 o −1" aria-label="Sesiones a sumar o restar">
        <input id="adjNota" placeholder="Motivo (ej: cortesía) · solo lo ve el equipo" aria-label="Motivo del ajuste (solo lo ve el equipo)" title="El alumno no ve este motivo">
        <button type="button" class="btn-outline" id="btnAjustar">Ajustar</button>
      </div>
      ${creditoControlHTML(profile, plan, rs)}` : ""}
      <div id="adjMsg" aria-live="polite"></div>
      <p class="eyebrow" style="margin-top:14px">Fortalecimiento</p>
    </div>`;
  box.innerHTML = catSelect + terHTML + `
    <div class="plan-hero compact"><div class="plan-big">
      ${est.congelado ? `<span class="plan-num plan-word">Congelado</span><span class="plan-unit">hasta el ${fmtFecha(est.congelado.hasta, true)} · vence el ${fmtFecha(est.finTotal, true)}</span>`
        : est.vigente ? `<span class="plan-num plan-word">Activo</span><span class="plan-unit">vence el ${fmtFecha(est.finTotal, true)} · ${plural(diasEntre(hoy, est.finTotal) + 1, "día", "días")}</span>`
        : est.futura ? `<span class="plan-num plan-word">Programado</span><span class="plan-unit">del ${fmtFecha(est.futura.inicio)} al ${fmtFecha(est.finTotal, true)}</span>`
        : `<span class="plan-num plan-word off">${est.ultima ? "Vencido" : "Sin acceso"}</span><span class="plan-unit">${est.ultima ? "venció el " + fmtFecha(est.ultima.fin, true) : ""}</span>`}
    </div></div>
    ${bienvenidaHTML || alertaAccesoHTML(profile.id)}
    ${master ? `<label class="checkline especial-linea"><input type="checkbox" id="chkHorarioEspecial"${profile.horario_especial ? " checked" : ""}>
        <span><strong>Horario especial</strong> · puede reservar los horarios bloqueados (por ejemplo «Específico de jiu-jitsu»).</span></label>
      <div id="especialMsg" aria-live="polite"></div>`
      : profile.horario_especial ? `<p style="margin:10px 0 0"><span class="flag especial">Horario especial</span></p>` : ""}
    ${master ? `
    ${conAcceso ? `<details class="acceso-ext"${bienvenida ? " open" : ""}><summary>Extender acceso</summary>` : ""}
    <div class="acceso-adj">
      ${conAcceso ? `<p class="muted" style="margin-top:0">Suma días a partir de cuando termina el acceso actual.</p>` : `<p class="acceso-adj-t">Habilitar acceso${cat === "transicion" ? " a fortalecimiento" : ""}</p>`}
      <div class="inline-add">
        <div><label for="accDesde" style="margin-top:0">Desde</label><input type="date" id="accDesde" value="${esc(est.finTotal && est.finTotal >= hoy ? fechaISO(sumarDias(parseFecha(est.finTotal), 1)) : hoy)}"></div>
        <div><label for="accDias" style="margin-top:0">Días</label><input type="number" id="accDias" inputmode="numeric" min="1" max="400" value="30"></div>
        <button type="button" class="btn-outline" id="btnAsignarAcceso">${conAcceso ? "Extender" : "Habilitar"}</button>
      </div>
      <p class="muted">${cat === "transicion" ? "En transición el acceso se cobra y coordina en el centro. Al habilitarlo, se le avisa para que escoja su horario." : "Para pagos coordinados en el centro. Se le avisa para que escoja su horario."}</p>
      <div id="accMsg" aria-live="polite"></div>
    </div>${conAcceso ? `</details>` : ""}
    ${conAcceso ? `<button type="button" class="btn-link danger acc-quitar" id="btnQuitarAcceso">Quitar acceso</button>` : ""}
    <div id="accOk" aria-live="polite"></div>` : ""}
    ${master ? suscripcionHTML(plan, true) : ""}
    <p class="muted">Asistencias registradas: <strong>${plan.asistencias.length}</strong>${plan.asistencias[0] ? " · última: " + fmtFecha(plan.asistencias[0].fecha) : ""}</p>
    ${plan.congelamientos.length ? `<details class="records"><summary>Congelamientos (${plan.congelamientos.length})</summary>
      <ul class="mov-list">${plan.congelamientos.map(c => `<li><span class="mov-txt">Del ${fmtFecha(c.desde)} al ${fmtFecha(c.hasta)}${c.motivo ? " · " + esc(c.motivo) : ""}</span></li>`).join("")}</ul></details>` : ""}
    ${comprasHTML}`;
  bindCat();
  const bacc = document.getElementById("btnAsignarAcceso");
  if(bacc) bacc.onclick = ()=> withBusy(bacc, "…", async ()=>{
    const desde = document.getElementById("accDesde").value;
    const dias = parseInt(document.getElementById("accDias").value, 10);
    const msg = document.getElementById("accMsg");
    if(!desde){ showMsg(msg, "error", "Elige desde qué día."); return; }
    if(!dias || dias < 1){ showMsg(msg, "error", "Escribe cuántos días de acceso."); return; }
    const { data, error } = await sb.rpc("asignar_acceso", { p_user: profile.id, p_desde: desde, p_dias: dias });
    if(error){ showError(msg, error); return; }
    if(state.porRegularizar) delete state.porRegularizar[profile.id];
    await renderPlanCoach(profile);
    if(document.getElementById("reservarCard")){ state.plan = null; await renderReservasAlumno(profile); }
    showMsg(document.getElementById("accOk"), "ok", `Acceso habilitado hasta el ${fmtFecha(data, true)}. Ya puede escoger su horario.`);
  });
  const chkEsp = document.getElementById("chkHorarioEspecial");
  if(chkEsp) chkEsp.onchange = async ()=>{
    const v = chkEsp.checked, msg = document.getElementById("especialMsg");
    chkEsp.disabled = true;
    const { error } = await sb.from("profiles").update({ horario_especial: v }).eq("id", profile.id);
    chkEsp.disabled = false;
    if(error){ chkEsp.checked = !v; showError(msg, error); return; }
    profile.horario_especial = v;
    const enLista = (state.athleteList || []).find(a => a.id === profile.id);
    if(enLista) enLista.horario_especial = v;
    showMsg(msg, "ok", v ? "Listo: ya puede reservar los horarios bloqueados." : "Listo: ya no puede reservar los horarios bloqueados.");
  };
  const breg = document.getElementById("btnRegularizar");
  if(breg) breg.onclick = ()=> withBusy(breg, "…", async ()=>{
    const { error } = await sb.rpc("regularizar_acceso", { p_user: profile.id });
    if(error){ showError(document.getElementById("regMsg"), error); return; }
    if(state.porRegularizar) delete state.porRegularizar[profile.id];
    await renderPlanCoach(profile);
  });
  const bq = document.getElementById("btnQuitarAcceso");
  if(bq) bq.onclick = ()=> abrirQuitarAcceso(profile, plan);
  if(cat === "transicion"){
    bindRiesgo(profile);
    bindCredito(profile, rs);
    const ba = document.getElementById("btnAjustar");
    if(ba) ba.onclick = ()=> withBusy(ba, "…", async ()=>{
      const n = parseInt(document.getElementById("adjCant").value, 10);
      const msg = document.getElementById("adjMsg");
      if(!n){ showMsg(msg, "error", "Escribe cuántas sesiones sumar (ej: 2) o restar (ej: -1)."); return; }
      const { error } = await sb.rpc("ajustar_tokens", { p_user: profile.id, p_cantidad: n, p_nota: document.getElementById("adjNota").value });
      if(error){ showError(msg, error); return; }
      await renderPlanCoach(profile);
      if(document.getElementById("reservarCard")){ state.plan = null; await renderReservasAlumno(profile); }
      showMsg(document.getElementById("adjMsg"), "ok", "Saldo actualizado.");
    });
  }

  function bindCat(){
    const b = document.getElementById("btnGuardarCat");
    b.onclick = ()=> withBusy(b, "…", async ()=>{
      const selCat = document.getElementById("coachCat");
      const nueva = selCat ? (selCat.value || null) : profile.categoria;
      const inicio = document.getElementById("coachInicio").value || null;
      const { error } = await sb.from("profiles").update(selCat ? { categoria: nueva, fecha_inicio: inicio } : { fecha_inicio: inicio }).eq("id", profile.id);
      if(error){ showError(document.getElementById("catMsg"), error); return; }
      profile.categoria = nueva; profile.fecha_inicio = inicio;
      const i = state.athleteList.findIndex(a => a.id === profile.id);
      if(i > -1){ state.athleteList[i].categoria = nueva; renderAthleteListInto(filterAthletes(state.search)); }
      renderAthleteDetail(profile, true, document.getElementById("coachMain"));
    });
  }
}

/* Tokens a crédito (solo master): de 0 a 8 con motivo obligatorio (solo lo ve el equipo).
   Se ven como −N en «Disponibles», se agendan normal y siguen en negativo hasta que un master registra el pago */
function creditoControlHTML(profile, plan, rs){
  const actual = profile.credito_sesiones || 0;
  const ult = (plan.creditoHist || []).find(h => h.credito_nuevo === actual && h.credito_nuevo > 0);
  return `<div class="credito-adj">
      <p class="cred-tit">Tokens a crédito (negativos)</p>
      ${actual ? `<div class="cred-actual">
        <p><strong class="num">−${actual}</strong> a crédito · ${rs.puede ? `puede agendar ${rs.puede} más` : "ya los agendó todos"}${ult ? `<br><span class="muted">Motivo: <strong>${esc(ult.motivo || "")}</strong> · ${esc(nombreAutor(ult.creado_por))}, ${fmtFecha(String(ult.created_at).slice(0, 10))}</span>` : ""}</p>
        <button type="button" class="btn-primary sm" id="btnRegCredito">Registrar pago</button>
      </div>` : ""}
      <div class="cred-form">
        <div class="cred-campo"><label for="credSel">Cantidad</label>
          <select id="credSel">${Array.from({ length: 9 }, (_, i) => `<option value="${i}" ${i === actual ? "selected" : ""}>${i === 0 ? "Sin crédito" : "−" + i + (i === 1 ? " sesión" : " sesiones")}</option>`).join("")}</select></div>
        <div class="cred-campo cred-motivo"><label for="credMotivo">Motivo <span class="req" aria-hidden="true">*</span> <span class="muted">· solo lo ve el equipo</span></label>
          <input id="credMotivo" placeholder="Ej: paga el viernes por Yape" maxlength="200" required></div>
        <button type="button" class="btn-outline" id="btnCredito">${actual ? "Cambiar" : "Asignar"}</button>
      </div>
      <p class="muted">Se ven como −N en sus disponibles y puede agendarlas normal. Siguen en negativo hasta que registres su pago.</p>
      <div id="credMsg" aria-live="polite"></div>
    </div>`;
}
function bindCredito(profile, rs){
  const b = document.getElementById("btnCredito");
  if(!b) return;
  const recargar = async ()=>{
    const a = (state.athleteList || []).find(x => x.id === profile.id);
    if(a) a.credito_sesiones = profile.credito_sesiones;
    await renderPlanCoach(profile);
    if(document.getElementById("reservarCard")){ state.plan = null; await renderReservasAlumno(profile); }
    await cargarAlertas();
    renderAthleteListInto(filterAthletes(state.search));
  };
  b.onclick = ()=> withBusy(b, "…", async ()=>{
    const n = parseInt(document.getElementById("credSel").value, 10);
    const motivo = document.getElementById("credMotivo").value.trim();
    const msg = document.getElementById("credMsg");
    if(n === (profile.credito_sesiones || 0)){ showMsg(msg, "error", "Elige otra cantidad."); return; }
    if(!motivo){ showMsg(msg, "error", "Escribe el motivo del crédito."); document.getElementById("credMotivo").focus(); return; }
    const { error } = await sb.rpc("asignar_credito", { p_user: profile.id, p_credito: n, p_motivo: motivo });
    if(error){ showError(msg, error); return; }
    profile.credito_sesiones = n;
    await recargar();
    showMsg(document.getElementById("credMsg"), "ok", n ? `Listo: −${n} a crédito. Puede agendarlas y le llegó un aviso.` : "Crédito quitado.");
  });
  const reg = document.getElementById("btnRegCredito");
  if(reg) reg.onclick = ()=> abrirRegistrarPagoCredito(profile, rs, recargar);
}
/* Quitar el acceso a mano (solo master): desde ese día no tiene acceso y se cancelan sus horarios de fortalecimiento */
function abrirQuitarAcceso(profile, plan){
  const hoy = todayStr();
  const horariosFort = (desde)=> (plan.reservas || []).filter(r => ["confirmada", "espera"].includes(r.estado) && r.fecha >= desde
    && new Date(r.inicio) > new Date() && ((planes.horarios || []).find(h => h.id === r.horario_id) || {}).categoria === "fortalecimiento").length;
  const susc = (plan.suscripciones || []).some(s => s.estado === "activa");
  const d = openDialog(`Quitar acceso · ${primerNombre(profile.nombre) || "alumno"}`, `
    <label for="qaDesde" style="margin-top:0">Sin acceso desde</label>
    <input type="date" id="qaDesde" value="${hoy}" min="${hoy}">
    <p class="muted" id="qaRes" style="margin-top:6px"></p>
    ${susc ? `<p class="plan-alert warn" role="status">Tiene una suscripción activa de Mercado Pago: el próximo cobro le volvería a dar acceso. Cancélala en Mercado Pago.</p>` : ""}
    <div class="sheet-actions"><button type="button" class="btn-outline" data-no>Cancelar</button><button type="button" class="btn-danger" id="qaOk">Quitar acceso</button></div>
    <div id="qaMsg" aria-live="polite"></div>`);
  const inp = d.el.querySelector("#qaDesde");
  const resumen = ()=>{
    const desde = inp.value || hoy;
    const n = horariosFort(desde);
    d.el.querySelector("#qaRes").textContent = `${desde === hoy ? "Desde hoy" : "Desde el " + fmtFecha(desde)} no podrá reservar ni entrar.${n ? ` Se cancelarán ${n === 1 ? "su horario reservado" : `sus ${n} horarios reservados`} desde ese día.` : ""} Le llegará un aviso.`;
  };
  resumen();
  inp.onchange = resumen;
  d.el.querySelector("[data-no]").onclick = d.close;
  const ok = d.el.querySelector("#qaOk");
  ok.onclick = ()=> withBusy(ok, "Quitando…", async ()=>{
    const { data, error } = await sb.rpc("quitar_acceso", { p_user: profile.id, p_desde: inp.value || hoy });
    if(error){ showError(d.el.querySelector("#qaMsg"), error); return; }
    d.close();
    await renderPlanCoach(profile);
    if(document.getElementById("reservarCard")){ state.plan = null; await renderReservasAlumno(profile); }
    refreshCoachAside();
    const n = (data && data.cancelados) || 0;
    showMsg(document.getElementById("accOk"), "ok", `Acceso quitado${n ? ` y ${n === 1 ? "1 horario cancelado" : n + " horarios cancelados"}` : ""}. Le llegó un aviso.`);
  });
}
function abrirRegistrarPagoCredito(profile, rs, recargar){
  const credito = profile.credito_sesiones || 0;
  const usadas = Math.max(0, -rs.saldo);
  const d = openDialog("Registrar pago del crédito", `
    <p style="margin-top:0">${esc(profile.nombre || "")} tiene <strong>−${credito}</strong> a crédito${usadas ? ` y ya usó ${plural(usadas, "sesión", "sesiones")}` : ""}.</p>
    <label for="regSes">Sesiones que pagó</label>
    <input type="number" id="regSes" inputmode="numeric" min="${usadas}" max="200" value="${credito}">
    <p class="muted" style="margin-top:4px">Se suman a su saldo y el crédito se cierra${usadas ? ` (mínimo ${usadas}, las que ya usó)` : ""}. Si ya pagó con un paquete que aprobaste en Pagos, pon ${usadas ? "lo que falte" : "0"}.</p>
    <label for="regNota">Nota (opcional · solo la ve el equipo)</label>
    <input id="regNota" placeholder="Ej: pagó por Yape el 12/11" maxlength="200">
    <button type="button" class="btn-primary" id="regOk">Registrar pago y cerrar crédito</button>
    <div id="regMsg" aria-live="polite"></div>`);
  const ok = d.el.querySelector("#regOk");
  ok.onclick = ()=> withBusy(ok, "Guardando…", async ()=>{
    const n = parseInt(d.el.querySelector("#regSes").value, 10);
    const msg = d.el.querySelector("#regMsg");
    if(!Number.isInteger(n) || n < 0){ showMsg(msg, "error", "Escribe cuántas sesiones pagó."); return; }
    const { data, error } = await sb.rpc("regularizar_credito", { p_user: profile.id, p_sesiones: n, p_nota: d.el.querySelector("#regNota").value });
    if(error){ showError(msg, error); return; }
    d.close();
    profile.credito_sesiones = 0;
    await recargar();
    showMsg(document.getElementById("credMsg"), "ok", `Pago registrado. Ahora tiene ${plural((data && data.saldo) || 0, "sesión disponible", "sesiones disponibles")}.`);
  });
}

/* Color de riesgo o dificultad del alumno de terapia (rojo = más riesgo, azul = menos). Solo lo ve el equipo. */
function riesgoPickerHTML(profile){
  const actual = (state.riesgo || {})[profile.id] || null;
  return `
    <fieldset class="riesgo-picker">
      <legend>Color de riesgo <span class="muted">· rojo = más riesgo, azul = menos</span></legend>
      <div class="riesgo-ops">
        ${COLORES_RIESGO.map(([k, n]) => `
          <label class="riesgo-op"><input type="radio" name="riesgo" value="${k}" ${actual === k ? "checked" : ""}>
            <span class="riesgo-sw r-${k}" aria-hidden="true"></span><span>${n}</span></label>`).join("")}
        ${actual ? `<button type="button" class="btn-link" id="btnQuitarRiesgo">Quitar</button>` : ""}
      </div>
      <div id="riesgoMsg" aria-live="polite"></div>
    </fieldset>`;
}
function bindRiesgo(profile){
  const guardar = async (valor)=>{
    const msg = document.getElementById("riesgoMsg");
    const { error } = await sb.from("ficha_interna").upsert({ user_id: profile.id, color_riesgo: valor });
    if(error){ showError(msg, error); return; }
    state.riesgo = state.riesgo || {};
    state.riesgo[profile.id] = valor;
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
      ${esMaster() ? `<button type="button" class="btn-outline" id="btnVerQR">QR de recepción</button>` : ""}</div></header>
    <div class="agenda-bar">
      <button type="button" class="icon-btn" id="agPrev" aria-label="Semana anterior">‹</button>
      <span class="agenda-day">${titulo}</span>
      <button type="button" class="icon-btn" id="agNext" aria-label="Semana siguiente">›</button>
      ${agendaUI.semana === fechaISO(lunesDe(hoy)) ? "" : `<button type="button" class="btn-link" id="agHoy">Esta semana</button>`}
    </div>
    <p class="wk-leyenda">
      ${areaCoach() === "fortalecimiento" ? "" : `<span class="wk-l-titulo">Terapia:</span>${COLORES_RIESGO.map(([k, n]) => `<span><i class="wk-sw r-${k}"></i>${n}</span>`).join("")}<span><i class="wk-sw r-sin"></i>Sin color</span>`}
      ${areaCoach() === "terapia" ? "" : `<span class="${areaCoach() ? "" : "wk-l-sep"}"><i class="wk-sw fort"></i>Fortalecimiento</span>`}<span>✓ llegó</span>
    </p>
    <div id="wkBody"><div class="skel skel-block" style="height:320px"></div></div></div>`;
  const ir = (iso)=>{ agendaUI.semana = iso; renderCoachAgenda(main); };
  document.getElementById("agPrev").onclick = ()=> ir(fechaISO(sumarDias(lunes, -7)));
  document.getElementById("agNext").onclick = ()=> ir(fechaISO(sumarDias(lunes, 7)));
  const bh = document.getElementById("agHoy"); if(bh) bh.onclick = ()=> ir(fechaISO(lunesDe(hoy)));
  const bqr = document.getElementById("btnVerQR"); if(bqr) bqr.onclick = abrirQRRecepcion;
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
  const area = areaCoach();
  const [todos, { data: res, error }] = await Promise.all([
    cargarHorarios(true),
    sb.from("reservas").select("*").gte("fecha", fechaISO(dias[0])).lte("fecha", fechaISO(dias[6]))
      .in("estado", ["confirmada", "espera", "asistio", "no_asistio"]).order("created_at")
  ]);
  if(!document.getElementById("wkBody")) return;
  if(error){ body.innerHTML = `<div class="error" role="alert">${esc(errorES(error))}</div>`; return; }
  const horarios = area ? todos.filter(h => h.categoria === area) : todos;
  const activos = horarios.filter(h => h.activo);
  const conReserva = new Set((res || []).map(r => r.horario_id));
  const visibles = horarios.filter(h => h.activo || conReserva.has(h.id));
  const columnas = dias.filter(d => visibles.some(h => h.dia_semana === isoDow(d)));
  const horas = [...new Set(visibles.map(h => horaCorta(h.hora)))].sort();
  if(!activos.length){ body.innerHTML = emptyHTML(esMaster() ? "No hay horarios publicados. Agrégalos en Ajustes." : "No hay horarios publicados para tu área."); return; }
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
        <div class="wk-slot ${h.categoria === "terapia" ? "ter" : "fort"}${h.bloqueo ? " bloq" : ""}${pasado ? " pasado" : ""}">
          <button type="button" class="wk-cap" data-slot="${esc(h.id)}|${iso}" aria-label="Abrir ${esc(h.bloqueo ? `${h.bloqueo} (bloqueado)` : CATEGORIAS[h.categoria].nombre)} del ${esc(fechaLarga(iso))} a las ${horaCorta(h.hora)}: ${conf.length} de ${h.aforo}${esMaster() ? (pasado ? ". Registrar quienes vinieron" : ". Agregar personas") : ""}"><span aria-hidden="true">${h.categoria === "terapia" ? "Terapia" : h.bloqueo ? `<span class="wk-bloq">🔒 ${esc(h.bloqueo)}</span>` : "Fortalecimiento"} · <span class="num">${conf.length}/${h.aforo}</span>${llegaron ? ` · <span class="num">${llegaron}</span> ✓` : ""}</span>${esMaster() ? `<span class="wk-mas" aria-hidden="true">+</span>` : ""}</button>
          ${rs.length ? `<ul class="wk-people">${rs.map(r => {
            const p = perfil(r.user_id);
            const tono = h.categoria === "terapia" ? `r-${(state.riesgo || {})[r.user_id] || "sin"}` : "fort";
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
    <p class="muted wk-nota">Toca la hora para ver quiénes van${esMaster() ? " y agregar a varias personas de una vez" : ""}; toca un nombre para marcar asistencia, cancelar o abrir su ficha. Se actualiza solo cada 30 segundos.</p>`;

  const colHoy = body.querySelector("th.hoy");
  if(colHoy && window.matchMedia("(max-width: 1023px)").matches){
    const sc = body.querySelector(".wk-scroll");
    sc.scrollLeft = Math.max(0, colHoy.offsetLeft - 64);
  }
  body.querySelectorAll("[data-res]").forEach(b => {
    b.onclick = ()=> abrirReservaCoach((res || []).find(r => r.id === b.dataset.res), horarios, main);
  });
  body.querySelectorAll("[data-slot]").forEach(b => {
    const [hid, iso] = b.dataset.slot.split("|");
    b.onclick = ()=> abrirHoraCoach(horarios.find(h => h.id === hid), iso, horarios, main);
  });
}

/* Una hora del Horario: quiénes van y (master) agregar a varias personas de una vez */
async function abrirHoraCoach(h, iso, horarios, main){
  if(!h) return;
  const pasado = inicioLocal(iso, h.hora) <= new Date();
  const puedeAgregar = esMaster();
  const ter = h.categoria === "terapia";
  const d = openDialog(`${horaCorta(h.hora)} · ${h.bloqueo ? "🔒 " + h.bloqueo : CATEGORIAS[h.categoria].nombre}`, `
    <div class="confirm-slot">
      <span class="cs-day">${fechaLarga(iso)}</span>
      <span class="cs-time num">${horaCorta(h.hora)}</span>
      <span class="muted" id="hcCupos"></span>
    </div>
    <div id="hcMsg" aria-live="polite"></div>
    <h3 class="hc-tit" id="hcTitVan">Van</h3>
    <ul class="hc-van" id="hcVan" aria-labelledby="hcTitVan"><li class="muted">Cargando…</li></ul>
    ${puedeAgregar ? `
    <h3 class="hc-tit">${pasado ? "Registrar a quienes vinieron" : "Agregar personas"}</h3>
    <p class="muted hc-ayuda">${pasado
      ? `Esta hora ya ${inicioLocal(iso, h.hora).getTime() + (h.duracion_min || 60) * 60000 < Date.now() ? "pasó" : "empezó"}: quedan como «asistió».${ter ? " Cada una usa 1 sesión de su saldo (o de su crédito)." : ""} Si alguien ya tiene otro horario ese día, ábrelo y usa «Mover a otra hora».`
      : `${ter ? "Cada reserva usa 1 sesión de su saldo (o de su crédito). Si ya no hay cupo, queda en lista de espera." : "Necesitan acceso vigente ese día. Si se llena, los demás no entran."} Cada persona recibe un aviso.`}</p>
    <label class="sr-only" for="hcQ">Buscar por nombre</label>
    <input type="search" id="hcQ" placeholder="Buscar por nombre" autocomplete="off">
    <ul class="hc-lista" id="hcLista"></ul>
    <div class="hc-pie">
      <button type="button" class="btn-link" id="hcLimpiar" hidden>Quitar selección</button>
      <button type="button" class="btn-primary sm" id="hcAgregar" disabled>Agregar</button>
    </div>` : `<p class="muted hc-ayuda">Solo un master coach puede agregar personas a una hora.</p>`}`);
  const sel = new Set();
  const perfil = (id)=> state.athleteList.find(a => a.id === id) || {};
  const alumnos = (state.athleteList || []).filter(a => catsDe(a.categoria).includes(h.categoria))
    .sort((x, y) => String(x.nombre || "").localeCompare(String(y.nombre || ""), "es"));
  let delDia = [];
  const cargar = async ()=>{
    const { data, error } = await sb.from("reservas").select("id, user_id, horario_id, estado, inicio")
      .eq("fecha", iso).in("estado", ["confirmada", "espera", "asistio", "no_asistio"]).order("created_at");
    if(error){ showError(d.el.querySelector("#hcMsg"), error); return false; }
    delDia = data || [];
    return true;
  };
  const pintarVan = ()=>{
    const aqui = delDia.filter(r => r.horario_id === h.id);
    const conf = aqui.filter(r => r.estado !== "espera").length;
    const libres = Math.max(0, h.aforo - conf);
    d.el.querySelector("#hcCupos").textContent = `${conf} de ${h.aforo} · ${libres ? `${libres} ${libres === 1 ? "cupo libre" : "cupos libres"}` : "lleno"}`;
    d.el.querySelector("#hcTitVan").textContent = `Van (${aqui.length})`;
    d.el.querySelector("#hcVan").innerHTML = aqui.length ? aqui.map(r => {
      const p = perfil(r.user_id);
      return `<li><button type="button" class="hc-persona" data-hc-res="${esc(r.id)}">
        <span class="avatar" aria-hidden="true">${esc(initials(p.nombre || ""))}</span>
        <span class="hc-nombre">${esc(p.nombre || "Alumno")}</span>
        <span class="hc-estado st-${esc(r.estado)}">${esc(ESTADO_RESERVA[r.estado] || r.estado)}</span></button></li>`;
    }).join("") : `<li class="muted">Nadie reservó esta hora todavía.</li>`;
    d.el.querySelectorAll("[data-hc-res]").forEach(b => {
      b.onclick = async ()=>{
        const { data: r } = await sb.from("reservas").select("*").eq("id", b.dataset.hcRes).maybeSingle();
        d.close(); abrirReservaCoach(r, horarios, main);
      };
    });
  };
  const pintarLista = ()=>{
    if(!puedeAgregar) return;
    const t = normalizar(d.el.querySelector("#hcQ").value);
    const ocupado = (id)=> delDia.find(r => r.user_id === id && r.estado !== "no_asistio");
    const vis = alumnos.filter(a => !t || normalizar(a.nombre).includes(t))
      .sort((x, y) => Number(!!ocupado(x.id)) - Number(!!ocupado(y.id)));
    d.el.querySelector("#hcLista").innerHTML = vis.length ? vis.map(a => {
      const otra = ocupado(a.id);
      const nota = otra ? (otra.horario_id === h.id ? "ya está en esta hora" : `${pasado ? "tiene horario" : "ya reservó"} a las ${horaDe(otra.inicio)} ese día`) : (CATEGORIAS[a.categoria] || {}).nombre || "";
      return `<li><label class="hc-item${otra ? " ocupado" : ""}">
        <input type="checkbox" value="${esc(a.id)}"${sel.has(a.id) ? " checked" : ""}${otra ? " disabled" : ""}>
        <span class="avatar" aria-hidden="true">${esc(initials(a.nombre || ""))}</span>
        <span class="hc-txt"><strong>${esc(a.nombre || "(sin nombre)")}</strong><span class="muted">${esc(nota)}</span></span></label></li>`;
    }).join("") : `<li class="muted" style="padding:10px 4px">Nadie con ese nombre.</li>`;
  };
  const pintarPie = ()=>{
    if(!puedeAgregar) return;
    const n = sel.size;
    const b = d.el.querySelector("#hcAgregar");
    b.disabled = !n;
    b.textContent = n ? `${pasado ? "Registrar" : "Agregar"} ${n === 1 ? "1 persona" : n + " personas"}` : (pasado ? "Registrar" : "Agregar");
    d.el.querySelector("#hcLimpiar").hidden = !n;
  };
  if(await cargar()){ pintarVan(); pintarLista(); pintarPie(); }
  if(!puedeAgregar) return;
  d.el.querySelector("#hcQ").oninput = pintarLista;
  d.el.querySelector("#hcLista").onchange = (e)=>{
    const c = e.target.closest("input[type=checkbox]");
    if(!c) return;
    if(c.checked) sel.add(c.value); else sel.delete(c.value);
    pintarPie();
  };
  d.el.querySelector("#hcLimpiar").onclick = ()=>{ sel.clear(); pintarLista(); pintarPie(); };
  d.el.querySelector("#hcAgregar").onclick = async (e)=>{
    const btn = e.currentTarget;
    const ids = [...sel];
    btn.disabled = true; btn.textContent = pasado ? "Registrando…" : "Agregando…";
    const res = [];
    for(const id of ids){
      const { data, error } = pasado
        ? await sb.rpc("registrar_pasado", { p_horario: h.id, p_fecha: iso, p_para: id })
        : await sb.rpc("reservar", { p_horario: h.id, p_fecha: iso, p_lugar: null, p_para: id });
      res.push({ id, ok: !error, estado: data && data.estado, error });
    }
    const bien = res.filter(r => r.ok);
    res.filter(r => r.ok).forEach(r => sel.delete(r.id));
    const linea = (r)=> `<li class="${r.ok ? "ok" : "mal"}"><strong>${esc(perfil(r.id).nombre || "Alumno")}</strong> · ${r.ok ? (r.estado === "espera" ? "en lista de espera" : r.estado === "asistio" ? "registrado: asistió" : "reservado") : esc(errorES(r.error))}</li>`;
    d.el.querySelector("#hcMsg").innerHTML = `<div class="${bien.length === res.length ? "success" : "error"} hc-res" role="${bien.length === res.length ? "status" : "alert"}">
      <p>${bien.length === res.length ? (bien.length === 1 ? "Se agregó 1 persona." : `Se agregaron ${bien.length} personas.`) : `Se agregaron ${bien.length} de ${res.length}.`}</p>
      <ul>${res.map(linea).join("")}</ul></div>`;
    d.el.querySelector("#hcQ").value = "";
    if(await cargar()){ pintarVan(); pintarLista(); }
    pintarPie();
    alCambiarReserva(main);
  };
}

/* Después de marcar o cancelar: repinta la vista abierta (Horario u Hoy) */
function alCambiarReserva(main){
  if(document.getElementById("wkBody")) pintarSemana(main);
  else if(document.getElementById("hoyBody")) pintarHoy();
}
function abrirReservaCoach(r, horarios, main){
  if(!r) return;
  const h = horarios.find(x => x.id === r.horario_id) || {};
  const p = state.athleteList.find(a => a.id === r.user_id) || {};
  const ini = new Date(r.inicio);
  const empezo = ini <= new Date();
  const color = COLORES_RIESGO.find(([k]) => k === (state.riesgo || {})[r.user_id]);
  const d = openDialog(p.nombre || "Alumno", `
    <div class="confirm-slot">
      <span class="cs-day">${fechaLarga(r.fecha)}</span>
      <span class="cs-time num">${horaCorta(h.hora)}</span>
      <span class="muted">${CATEGORIAS[h.categoria] ? CATEGORIAS[h.categoria].nombre : ""}${h.categoria === "terapia" ? ` · ${color ? "color " + color[1].toLowerCase() : "sin color de riesgo"}` : ""}</span>
    </div>
    <p><strong>${ESTADO_RESERVA[r.estado]}</strong>${r.checkin_at ? ` · llegó a las ${new Date(r.checkin_at).toTimeString().slice(0, 5)}` : ""}${r.asistencia_por ? ` · ${r.asistencia_por === r.user_id ? "registró su llegada con el QR" : "marcado por " + esc(nombreAutor(r.asistencia_por, r.user_id))}` : ""}</p>
    <div class="row" style="margin-top:6px">
      ${r.estado !== "espera" && (empezo || r.estado !== "confirmada") ? `
        <button type="button" class="btn-outline" data-asis="1" style="margin-top:0">✓ Asistió</button>
        <button type="button" class="btn-outline" data-asis="0" style="margin-top:0">✕ No asistió</button>` : ""}
      ${!empezo && ["confirmada", "espera"].includes(r.estado) ? `<button type="button" class="btn-danger" id="rcCancelar">Cancelar reserva</button>` : ""}
    </div>
    ${esMaster() && ["confirmada", "asistio", "no_asistio"].includes(r.estado) ? `<div class="row rc-master">
      <button type="button" class="btn-outline" id="rcMover" style="margin-top:0">Mover a otra hora</button>
      ${empezo ? `<button type="button" class="btn-link danger" id="rcQuitar">Quitar de esta hora</button>` : ""}
    </div>` : ""}
    <a class="btn-link" href="#/atleta/${encodeURIComponent(r.user_id)}" id="rcFicha" style="margin-top:10px">Abrir ficha →</a>
    <div id="rcMsg" aria-live="polite"></div>`);
  d.el.querySelector("#rcFicha").onclick = ()=> d.close();
  d.el.querySelectorAll("[data-asis]").forEach(b => {
    b.onclick = ()=> withBusy(b, "…", async ()=>{
      const { error } = await sb.rpc("marcar_asistencia", { p_reserva: r.id, p_asistio: b.dataset.asis === "1" });
      if(error){ showError(d.el.querySelector("#rcMsg"), error); return; }
      d.close(); alCambiarReserva(main);
    });
  });
  const bq = d.el.querySelector("#rcQuitar");
  if(bq) bq.onclick = ()=>{
    if(!confirm(h.categoria === "terapia" ? "¿Quitar a esta persona de esta hora? Se le devuelve la sesión." : "¿Quitar a esta persona de esta hora? También se quita su asistencia de ese día.")) return;
    withBusy(bq, "…", async ()=>{
      const { error } = await sb.rpc("quitar_reserva_pasada", { p_reserva: r.id });
      if(error){ showError(d.el.querySelector("#rcMsg"), error); return; }
      d.close(); alCambiarReserva(main);
    });
  };
  const bm = d.el.querySelector("#rcMover");
  if(bm) bm.onclick = ()=>{ d.close(); abrirMoverReserva(r, h, p, horarios, main); };
  const bc = d.el.querySelector("#rcCancelar");
  if(bc) bc.onclick = ()=>{
    if(!confirm(h.categoria === "terapia" ? "¿Cancelar esta reserva? La sesión se devuelve al alumno y se le avisa." : "¿Cancelar este horario? Se le avisa al alumno.")) return;
    withBusy(bc, "…", async ()=>{
      const { error } = await sb.rpc("cancelar_reserva", { p_reserva: r.id });
      if(error){ showError(d.el.querySelector("#rcMsg"), error); return; }
      d.close(); alCambiarReserva(main);
    });
  };
}

/* Mover una reserva a otra hora u otro día (master). La bitácora, si hay, se mueve con ella. */
function abrirMoverReserva(r, h, p, horarios, main){
  const opciones = (iso)=> (horarios || []).filter(x => x.categoria === h.categoria && x.dia_semana === isoDow(parseFecha(iso)) && (x.activo || x.id === r.horario_id))
    .sort((a, b) => String(a.hora).localeCompare(String(b.hora)));
  const marcada = r.estado !== "confirmada";
  const d = openDialog(`Mover · ${primerNombre(p.nombre) || "alumno"}`, `
    <p class="muted" style="margin-top:0">Ahora: ${esc(fechaLarga(r.fecha))} a las ${horaCorta(h.hora)} · ${esc(ESTADO_RESERVA[r.estado])}.${marcada ? " Como ya está marcada, solo se puede mover a una hora que ya empezó." : ""}</p>
    <div class="inline-add">
      <div><label for="mvFecha" style="margin-top:0">Día</label><input type="date" id="mvFecha" value="${esc(r.fecha)}"${marcada ? ` max="${todayStr()}"` : ""}></div>
      <div><label for="mvHora" style="margin-top:0">Hora</label><select id="mvHora"></select></div>
    </div>
    <button type="button" class="btn-primary" id="mvOk">Mover</button>
    <div id="mvMsg" aria-live="polite"></div>`);
  const f = d.el.querySelector("#mvFecha"), sel = d.el.querySelector("#mvHora");
  const pintar = ()=>{
    const ops = f.value ? opciones(f.value) : [];
    sel.innerHTML = ops.length ? ops.map(x => `<option value="${esc(x.id)}"${x.id === r.horario_id && f.value === r.fecha ? " disabled" : ""}>${horaCorta(x.hora)}${x.id === r.horario_id && f.value === r.fecha ? " (actual)" : ""}</option>`).join("")
      : `<option value="">Sin horarios ese día</option>`;
    const primera = [...sel.options].find(o => !o.disabled && o.value);
    if(primera) sel.value = primera.value;
  };
  pintar();
  f.onchange = pintar;
  const ok = d.el.querySelector("#mvOk");
  ok.onclick = ()=> withBusy(ok, "Moviendo…", async ()=>{
    const msg = d.el.querySelector("#mvMsg");
    if(!f.value || !sel.value){ showMsg(msg, "error", "Elige el día y la hora."); return; }
    const { error } = await sb.rpc("mover_reserva", { p_reserva: r.id, p_horario: sel.value, p_fecha: f.value });
    if(error){ showError(msg, error); return; }
    d.close(); alCambiarReserva(main);
  });
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
  const [aj, paquetes, horarios, { data: avisos }, { data: links }] = await Promise.all([
    cargarAjustes(true), cargarPaquetes(true), cargarHorarios(true),
    sb.from("avisos_config").select("*").eq("id", 1).maybeSingle(),
    sb.from("pago_links").select("enviado_a,enviado_at,error,created_at").order("created_at", { ascending: false }).limit(1)
  ]);
  const ultimoAviso = (links || [])[0] || null;
  main.innerHTML = `<div class="detail"><header class="detail-head">
    <a class="back" href="#/">← Atletas</a>
    <p class="eyebrow">Panel del coach</p><h1>Ajustes del centro</h1></header>
    <div class="grid">
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
        <div class="table-wrap"><table class="edit-table"><thead><tr><th scope="col">Nombre</th><th scope="col">${cat === "terapia" ? "Sesiones" : "Días"}</th><th scope="col">Precio ${cat === "terapia" ? "US$" : "S/"}</th><th scope="col">Activo</th><th scope="col">Link de pago</th><th scope="col"><span class="sr-only">Guardar</span></th></tr></thead>
        <tbody>${paquetes.filter(p => p.categoria === cat).map(p => `
          <tr data-paq="${esc(p.id)}"><td><input class="t-in" data-f="nombre" value="${esc(p.nombre)}" aria-label="Nombre"></td>
            <td><input class="t-in num-in" type="number" min="1" data-f="${cat === "terapia" ? "sesiones" : "dias"}" value="${cat === "terapia" ? p.sesiones : p.dias}" aria-label="Cantidad"></td>
            <td><input class="t-in num-in" type="number" min="0" step="0.5" data-f="precio" value="${Number(p.precio)}" aria-label="Precio"></td>
            <td><input type="checkbox" data-f="activo" ${p.activo ? "checked" : ""} aria-label="Activo"></td>
            <td><input class="t-in link-in" type="url" data-f="link_pago" value="${esc(p.link_pago || "")}" placeholder="https://…" aria-label="Link de pago (Mercado Pago o Culqi)"></td>
            <td class="actions"><button type="button" class="btn-outline sm" data-save-paq>Guardar</button></td></tr>`).join("")}
          <tr class="new-row" data-new-paq="${cat}"><td><input class="t-in" data-f="nombre" placeholder="Nuevo paquete" aria-label="Nombre"></td>
            <td><input class="t-in num-in" type="number" min="1" data-f="${cat === "terapia" ? "sesiones" : "dias"}" placeholder="${cat === "terapia" ? "4" : "30"}" aria-label="Cantidad"></td>
            <td><input class="t-in num-in" type="number" min="0" step="0.5" data-f="precio" placeholder="0" aria-label="Precio"></td><td></td><td></td>
            <td class="actions"><button type="button" class="btn-outline sm" data-add-paq>Agregar</button></td></tr>
        </tbody></table></div><div class="paq-msg" aria-live="polite"></div>
      </section>`).join("")}
      ${["terapia","fortalecimiento"].map(cat => `
      <section class="panel span-6"><div class="panel-head"><h2>Horarios de ${CATEGORIAS[cat].nombre.toLowerCase()}</h2><span class="muted">${cat === "terapia" ? "Aforo por horario" : "Reserva obligatoria · aforo por horario"}</span></div>
        <ul class="sched-list">${[1,2,3,4,5,6,7].map(dw => {
          const hs = horarios.filter(h => h.categoria === cat && h.dia_semana === dw);
          return hs.length ? `<li><span class="wl-day">${DIAS_SEMANA[dw]}</span><span class="wl-hours">${hs.map(h => `
            <span class="hour-chip edit${h.activo ? "" : " off"}${h.bloqueo ? " bloq" : ""}"${h.bloqueo ? ` title="Bloqueado: ${esc(h.bloqueo)}"` : ""}><span class="num">${horaCorta(h.hora)}</span><span class="muted">·${h.aforo}</span>${h.bloqueo ? `<span class="chip-bloqueo">🔒 ${esc(h.bloqueo)}</span>` : ""}
              ${cat === "fortalecimiento" ? `<button type="button" data-bloq-h="${esc(h.id)}" aria-label="${h.bloqueo ? "Cambiar o quitar el bloqueo de" : "Bloquear"} ${horaCorta(h.hora)}">${h.bloqueo ? "🔓" : "🔒"}</button>` : ""}
              <button type="button" data-toggle-h="${esc(h.id)}" aria-label="${h.activo ? "Pausar" : "Activar"} ${horaCorta(h.hora)}">${h.activo ? "⏸" : "▶"}</button>
              <button type="button" data-del-h="${esc(h.id)}" aria-label="Borrar ${horaCorta(h.hora)}">✕</button></span>`).join("")}</span></li>` : "";
        }).join("")}</ul>
        <div class="inline-add sched-add" data-cat="${cat}">
          <select data-f="dia" aria-label="Día">${[1,2,3,4,5,6,7].map(dw => `<option value="${dw}">${DIAS_SEMANA[dw]}</option>`).join("")}</select>
          <input type="time" data-f="hora" value="18:00" aria-label="Hora">
          <input type="number" data-f="aforo" min="1" max="50" value="${cat === "terapia" ? 6 : 10}" aria-label="Aforo" title="Aforo">
          <button type="button" class="btn-outline" data-add-h>Agregar</button>
        </div><div class="h-msg" aria-live="polite"></div>
      </section>`).join("")}
      <section class="panel span-12"><div class="panel-head"><h2>Términos y condiciones</h2><span class="muted">Se muestran al registrarse</span></div>
        <textarea id="ajTerminos" rows="10">${esc(aj.terminos || TERMINOS_BORRADOR)}</textarea>
        <button type="button" class="btn-primary" id="btnGuardarTerminos">Guardar términos</button><div id="termMsg" aria-live="polite"></div>
      </section>
      <section class="panel span-12" aria-labelledby="hAccesos"><div class="panel-head"><h2 id="hAccesos">Acceso de fortalecimiento</h2><span class="muted">Habilita o extiende el acceso de cada alumno</span></div>
        <div class="acc-filtros">
          <input type="search" id="accBuscar" placeholder="Buscar alumno" aria-label="Buscar alumno">
          <select id="accFiltro" aria-label="Qué alumnos mostrar"><option value="">Todos</option><option value="sin">Sin acceso o vencido</option><option value="vence">Vence en 7 días o menos</option><option value="activo">Con acceso</option></select>
        </div>
        <div id="accAjMsg" aria-live="polite"></div>
        <div id="accLista"><div class="skel skel-block"></div></div>
      </section>
      <section class="panel span-12" aria-labelledby="hHistCons"><div class="panel-head"><h2 id="hHistCons">Historial de consejos</h2><span class="muted">Todos los consejos de los coaches, del más reciente al más antiguo</span></div>
        <div class="hist-cons-filtros">
          <input type="search" id="histConsBuscar" placeholder="Buscar por alumno o por texto" aria-label="Buscar en el historial de consejos">
          <select id="histConsCoach" aria-label="Filtrar por coach"><option value="">Todos los coaches</option></select>
        </div>
        <div id="histConsBox" style="margin-top:12px"><div class="skel skel-block"></div></div>
      </section>
    </div></div>`;
  pintarHistorialConsejos();
  pintarAccesosAjustes();

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
  const leerFila = (tr)=>{ const o = {}; tr.querySelectorAll("[data-f]").forEach(i => { o[i.dataset.f] = i.type === "checkbox" ? i.checked : i.value; }); return o; };
  main.querySelectorAll("[data-save-paq]").forEach(b => {
    b.onclick = ()=> withBusy(b, "…", async ()=>{
      const tr = b.closest("tr"); const v = leerFila(tr); const msg = tr.closest("section").querySelector(".paq-msg");
      const payload = { nombre: v.nombre.trim(), precio: Number(v.precio), activo: v.activo, link_pago: (v.link_pago || "").trim() || null };
      if(payload.link_pago && !/^https:\/\/\S+$/.test(payload.link_pago)){ showMsg(msg, "error", "El link de pago debe empezar con https://"); return; }
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
      const { error } = await sb.from("horarios").insert({ categoria: box.dataset.cat, dia_semana: parseInt(v.dia, 10), hora: v.hora, aforo: parseInt(v.aforo, 10) || (box.dataset.cat === "terapia" ? 6 : 10), duracion_min: 60 });
      if(error){ showError(msg, error); return; }
      planes.horarios = null; renderCoachAjustes(main);
    });
  });
  /* Bloquear un horario: los clientes lo ven con ese nombre y solo lo reserva quien tiene «Horario especial» */
  main.querySelectorAll("[data-bloq-h]").forEach(b => {
    b.onclick = ()=>{
      const h = horarios.find(x => x.id === b.dataset.bloqH);
      const d = openDialog(`${h.bloqueo ? "Horario bloqueado" : "Bloquear horario"} · ${DIAS_SEMANA[h.dia_semana]} ${horaCorta(h.hora)}`, `
        <p class="muted" style="margin-top:0">Los clientes ven este horario con el nombre que pongas y no pueden reservarlo. Solo lo reservan los atletas con la etiqueta «Horario especial».</p>
        <label for="bloqNombre">Nombre que verán</label>
        <input id="bloqNombre" maxlength="60" value="${esc(h.bloqueo || "")}" placeholder="Ej: Específico de jiu-jitsu">
        <div id="bloqMsg" aria-live="polite"></div>
        <div class="sheet-actions">${h.bloqueo ? `<button type="button" class="btn-outline" data-bloq-quitar>Quitar bloqueo</button>` : ""}<button type="button" class="btn-primary" data-bloq-ok>${h.bloqueo ? "Guardar" : "Bloquear"}</button></div>`);
      const guardar = async (valor, btn)=> withBusy(btn, "…", async ()=>{
        const { error } = await sb.from("horarios").update({ bloqueo: valor }).eq("id", h.id);
        if(error){ showError(d.el.querySelector("#bloqMsg"), error); return; }
        d.close(); planes.horarios = null; renderCoachAjustes(main);
      });
      d.el.querySelector("[data-bloq-ok]").onclick = (e)=>{
        const v = d.el.querySelector("#bloqNombre").value.trim();
        if(!v){ showMsg(d.el.querySelector("#bloqMsg"), "error", "Escribe el nombre que verán los clientes."); return; }
        guardar(v, e.currentTarget);
      };
      const q = d.el.querySelector("[data-bloq-quitar]");
      if(q) q.onclick = (e)=> guardar(null, e.currentTarget);
    };
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

/* ====================== COACH: HOY ======================
   Lo que pasa hoy en el área del coach (el master ve las dos) y las alertas:
   fortalecimiento en su última semana de acceso, terapia con 2 sesiones o menos. Se actualiza cada 30 segundos. */
const hoyUI = { timer: null };
function alertaAccesoHTML(uid){
  const a = (state.alertas || []).find(x => x.user_id === uid && x.tipo === "acceso");
  return a ? `<p class="plan-alert warn" role="status"><strong>Última semana de acceso:</strong> vence el ${fmtFecha(a.fin, true)}${a.paquete ? " · " + esc(a.paquete) : ""}.</p>` : "";
}
function alertasListaHTML(alertas){
  if(!alertas.length) return `<p class="muted" style="margin:0">Sin alertas por ahora.</p>`;
  const orden = [...alertas].sort((a, b) => a.valor - b.valor || String(a.nombre).localeCompare(String(b.nombre)));
  return `<ul class="alert-list">${orden.map(a => `
    <li><a class="alert-item" href="#/atleta/${encodeURIComponent(a.user_id)}">
      <span class="alert-dot" aria-hidden="true"></span>
      <span class="alert-txt"><strong>${esc(a.nombre || "Alumno")}</strong><span>${esc(alertaTexto(a))}${a.tipo === "acceso" && a.paquete ? " · " + esc(a.paquete) : ""}</span></span>
      ${areaCoach() ? "" : `<span class="flag cat-${a.categoria}">${CATEGORIAS[a.categoria].nombre}</span>`}
    </a></li>`).join("")}</ul>`;
}
async function renderCoachHoy(main){
  const area = areaCoach();
  const nota = !area ? "Fortalecimiento: última semana de acceso · Terapia: sin sesiones por agendar y 2 o menos agendadas"
    : area === "terapia" ? "Pacientes sin sesiones por agendar y con 2 o menos agendadas" : "Alumnos en su última semana de acceso";
  main.innerHTML = `<div class="detail"><header class="detail-head">
    <a class="back" href="#/">← Atletas</a>
    <p class="eyebrow">${esc(ROLES_EQUIPO[state.profile.role] || "Panel del coach")}</p><h1>Hoy</h1>
    <p class="lede hoy-fecha">${esc(fechaLarga(todayStr()))}${area ? " · " + CATEGORIAS[area].nombre : ""}</p></header>
    <div class="grid">
      ${turnoBarHTML()}
      ${area === "terapia" ? "" : `<section class="panel span-12 rt-hoy" aria-labelledby="hRt"><div class="panel-head"><h2 id="hRt">Esta semana toca</h2><span class="muted">Fortalecimiento · toca una rutina para leerla entera</span></div>
        <div id="hoyRutinas"><div class="skel skel-line" style="width:70%"></div></div></section>`}
      <section class="panel span-12 hoy-alertas" aria-labelledby="hAl"><div class="panel-head"><h2 id="hAl">Alertas</h2><span class="muted">${nota}</span></div>
        <div id="hoyAlertas"><div class="skel skel-block"></div></div></section>
      ${esMaster() ? `<section class="panel span-6 tareas-panel" aria-labelledby="hTm"><div class="panel-head"><h2 id="hTm">Tareas de los master</h2><span class="muted" id="tmCuenta"></span></div>
        <p class="muted tareas-nota">Solo entre los master coach. Para darle una tarea a un coach, usa <a href="#tareasEquipo" class="link-inline" data-ir-equipo>Tareas del equipo</a>.</p>
        ${formTareaHTML("master")}
        <div id="tareasMasterLista"><div class="skel skel-block"></div></div></section>` : ""}
      <section class="panel ${esMaster() ? "span-6" : "span-12"} tareas-panel" id="tareasEquipo" aria-labelledby="hTe"><div class="panel-head"><h2 id="hTe">Tareas del equipo</h2><span class="muted" id="teCuenta"></span></div>
        <p class="muted tareas-nota">${esMaster() ? "Asígnale tareas a un coach o a todos. Cada coach ve solo las suyas y las que son para todos." : "Tus tareas y las que son para todo el equipo. Márcalas cuando las termines."}</p>
        ${formTareaHTML("equipo")}
        <div id="tareasEquipoMsg" aria-live="polite"></div>
        <div id="tareasEquipoLista"><div class="skel skel-block"></div></div></section>
      <section class="panel span-12" aria-labelledby="hCl"><div class="panel-head"><h2 id="hCl">Clases de hoy</h2><span class="muted" id="hoyResumen"></span></div>
        <div id="hoyBody"><div class="skel skel-block"></div></div>
        <p class="muted wk-nota">Toca un nombre para marcar asistencia, cancelar o abrir su ficha. Se actualiza solo cada 30 segundos.</p></section>
      ${area === "terapia" ? "" : `<section class="panel span-12" aria-labelledby="hMf"><p class="eyebrow">Fortalecimiento · Podio</p><div class="panel-head"><h2 id="hMf">Los más aplicados del mes</h2></div>
        <div id="mejoresCoach"><div class="skel skel-block"></div></div></section>`}
    </div></div>`;
  pintarTurno();
  pintarPodio(document.getElementById("mejoresCoach"), true);
  enlazarFormsTareas();
  suscribirTareas();
  main.querySelectorAll("[data-ir-equipo]").forEach(l => { l.onclick = (e)=>{ e.preventDefault(); document.getElementById("tareasEquipo").scrollIntoView({ behavior: "smooth", block: "start" }); document.getElementById("tt_equipo")?.focus({ preventScroll: true }); }; });
  await Promise.all([pintarHoy(), pintarTareasHoy()]);
  if(location.hash === "#/hoy" && hoyUI.irATareas){ hoyUI.irATareas = false; document.getElementById("tareasEquipo")?.scrollIntoView({ behavior: "smooth", block: "start" }); }
  clearInterval(hoyUI.timer);
  hoyUI.timer = setInterval(()=>{
    if(!document.getElementById("hoyBody")){ clearInterval(hoyUI.timer); hoyUI.timer = null; return; }
    if(document.querySelector(".overlay")) return;
    pintarHoy();
    if(!document.activeElement || !document.activeElement.closest(".tareas-panel")) pintarTareasHoy();
  }, 30000);
}
async function pintarHoy(){
  const body = document.getElementById("hoyBody");
  if(!body) return;
  const iso = todayStr();
  const area = areaCoach();
  const [todos, { data: res, error }, alertas, rh] = await Promise.all([
    cargarHorarios(true),
    sb.from("reservas").select("*").eq("fecha", iso).in("estado", ["confirmada", "espera", "asistio", "no_asistio"]).order("created_at"),
    cargarAlertas(),
    area === "terapia" ? Promise.resolve(null) : cargarRutinasDeHoy()
  ]);
  if(!document.getElementById("hoyBody")) return;
  document.getElementById("hoyAlertas").innerHTML = alertasListaHTML(alertas);
  const rtBox = document.getElementById("hoyRutinas");
  if(rtBox){ rutinaSel.rh = rh; if(rh) repintarSemana(rtBox, false); else rtBox.innerHTML = rutinasHoyHTML(null); }
  if(error){ body.innerHTML = `<div class="error" role="alert">${esc(errorES(error))}</div>`; return; }
  const dow = isoDow(parseFecha(iso));
  const horarios = todos.filter(h => h.dia_semana === dow && (!area || h.categoria === area) && (h.activo || (res || []).some(r => r.horario_id === h.id)))
    .sort((a, b) => String(a.hora).localeCompare(String(b.hora)) || a.categoria.localeCompare(b.categoria));
  const delDia = (res || []).filter(r => horarios.some(h => h.id === r.horario_id));
  const conf = delDia.filter(r => r.estado !== "espera");
  const llegaron = conf.filter(r => r.estado === "asistio").length;
  document.getElementById("hoyResumen").textContent = conf.length ? `${plural(conf.length, "reserva", "reservas")} · ${llegaron} ${llegaron === 1 ? "llegó" : "llegaron"}` : "";
  if(!horarios.length){ body.innerHTML = emptyHTML(area ? "Hoy no hay clases de tu área." : "Hoy no hay clases."); return; }
  const ahora = new Date();
  const perfil = (id)=> state.athleteList.find(a => a.id === id) || {};
  body.innerHTML = `<ol class="hoy-list">${horarios.map(h => {
    const rs = delDia.filter(r => r.horario_id === h.id);
    const ini = inicioLocal(iso, h.hora);
    const fin = new Date(ini.getTime() + (h.duracion_min || 60) * 60000);
    const momento = ahora >= fin ? "pasada" : ahora >= ini ? "ahora" : "";
    return `<li class="hoy-slot ${h.categoria === "terapia" ? "ter" : "fort"} ${momento}">
      <div class="hoy-hora"><span class="num">${horaCorta(h.hora)}</span>${momento === "ahora" ? `<span class="hoy-ahora">En curso</span>` : ""}</div>
      <div class="hoy-info">
        <p class="hoy-cap">${CATEGORIAS[h.categoria].nombre} · <span class="num">${rs.filter(r => r.estado !== "espera").length}/${h.aforo}</span></p>
        ${rs.length ? `<ul class="hoy-people">${rs.map(r => {
          const p = perfil(r.user_id);
          const tono = h.categoria === "terapia" ? `r-${(state.riesgo || {})[r.user_id] || "sin"}` : "fort";
          const marca = r.estado === "asistio" ? "✓ Llegó" : r.estado === "no_asistio" ? "No vino" : r.estado === "espera" ? "En espera" : momento ? "Por llegar" : "Reservó";
          const cod = rh && h.categoria === "fortalecimiento" ? rh.porReserva[r.id] : null;
          return `<li><button type="button" class="hoy-chip st-${r.estado}" data-res="${esc(r.id)}"><span class="hoy-sw ${tono}" aria-hidden="true"></span><span class="hoy-name">${esc(p.nombre || "Alumno")}</span>${cod ? rutinaChipHTML(cod) : ""}<span class="hoy-st">${marca}</span></button></li>`;
        }).join("")}</ul>` : `<p class="muted" style="margin:2px 0 0">Sin reservas.</p>`}
      </div></li>`;
  }).join("")}</ol>`;
  body.querySelectorAll("[data-res]").forEach(b => {
    b.onclick = ()=> abrirReservaCoach(delDia.find(r => r.id === b.dataset.res), todos, document.getElementById("coachMain"));
  });
}

/* ====================== COACH: AVISOS (COMUNICADOS) ======================
   El master escribe a todos o a un área; el coach de área solo a los alumnos de su área. */
async function renderCoachComunicados(main){
  const area = areaCoach();
  const { data: comunicados, error } = await sb.from("comunicados").select("*").order("created_at", { ascending: false }).limit(30);
  const destinos = area ? [[area, `Alumnos de ${CATEGORIAS[area].nombre.toLowerCase()}`]]
    : [["todos", "Todos los alumnos"], ["terapia", "Solo terapia"], ["fortalecimiento", "Solo fortalecimiento"]];
  const puedeBorrar = (c)=> esMaster() || c.autor === state.profile.id;
  main.innerHTML = `<div class="detail"><header class="detail-head">
    <a class="back" href="#/">← Atletas</a>
    <p class="eyebrow">Panel del coach</p><h1>Avisos</h1>
    <p class="lede" style="margin-top:6px">Los comunicados llegan a las notificaciones de los alumnos${area ? " de tu área" : ""}.</p></header>
    <div class="grid">
      <section class="panel span-6"><div class="panel-head"><h2>Nuevo comunicado</h2></div>
        <div class="form-grid">
          <div class="full"><label for="comTitulo" style="margin-top:0">Título</label><input id="comTitulo" placeholder="Ej: Feriado del lunes"></div>
          <div class="full"><label for="comMsg">Mensaje</label><textarea id="comMsg" rows="4" placeholder="Ej: El lunes 1 de noviembre no habrá sesiones."></textarea></div>
          <div class="full"><label for="comDestino">Para</label><select id="comDestino"${destinos.length === 1 ? " disabled" : ""}>${destinos.map(([k, t]) => `<option value="${k}">${t}</option>`).join("")}</select></div>
        </div>
        <button type="button" class="btn-primary" id="btnPublicar">Publicar comunicado</button><div id="comMsgBox" aria-live="polite"></div>
      </section>
      <section class="panel span-6"><div class="panel-head"><h2>Enviados</h2><span class="muted">${(comunicados || []).length ? plural(comunicados.length, "comunicado", "comunicados") : ""}</span></div>
        ${error ? `<div class="error" role="alert">${esc(errorES(error))}</div>` : (comunicados || []).length ? `<ul class="mov-list com-list">${comunicados.map(c => `
          <li><span class="mov-txt"><strong>${esc(c.titulo)}</strong> · ${esc(c.destino === "todos" ? "Todos" : CATEGORIAS[c.destino].nombre)}
            <span class="autoria">${esc(fmtFecha(String(c.created_at).slice(0, 10)))} · por ${esc(nombreAutor(c.autor))}</span></span>
            ${puedeBorrar(c) ? `<button type="button" class="btn-danger icon" data-del-com="${esc(c.id)}" aria-label="Borrar comunicado ${esc(c.titulo)}">✕</button>` : ""}</li>`).join("")}</ul>`
          : `<p class="muted">Todavía no hay comunicados.</p>`}
      </section>
    </div></div>`;
  const bP = document.getElementById("btnPublicar");
  bP.onclick = ()=> withBusy(bP, "Publicando…", async ()=>{
    const titulo = document.getElementById("comTitulo").value.trim();
    const mensaje = document.getElementById("comMsg").value.trim();
    const box = document.getElementById("comMsgBox");
    if(!titulo || !mensaje){ showMsg(box, "error", "Escribe título y mensaje."); return; }
    const { error: e2 } = await sb.from("comunicados").insert({ titulo, mensaje, destino: document.getElementById("comDestino").value, autor: state.profile.id });
    if(e2){ showError(box, e2); return; }
    await renderCoachComunicados(main);
    showMsg(document.getElementById("comMsgBox"), "ok", "Comunicado enviado a las notificaciones de los alumnos.");
  });
  main.querySelectorAll("[data-del-com]").forEach(b => {
    b.onclick = ()=>{ if(!confirm("¿Borrar este comunicado del historial?")) return;
      withBusy(b, "…", async ()=>{ const { error: e3 } = await sb.from("comunicados").delete().eq("id", b.dataset.delCom); if(e3){ alert(errorES(e3)); return; } renderCoachComunicados(main); }); };
  });
}

/* ====================== MASTER: RESUMEN DEL CENTRO ====================== */
const resumenUI = { mes: null };
async function renderCoachResumen(main){
  const hoy = parseFecha(todayStr());
  const mesActual = fechaISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  resumenUI.mes = resumenUI.mes || mesActual;
  const m = parseFecha(resumenUI.mes);
  const titulo = `${MESES_LARGOS[m.getMonth()][0].toUpperCase()}${MESES_LARGOS[m.getMonth()].slice(1)} ${m.getFullYear()}`;
  main.innerHTML = `<div class="detail"><header class="detail-head">
    <a class="back" href="#/">← Atletas</a>
    <p class="eyebrow">Solo master coach</p><h1>Resumen del centro</h1></header>
    <div class="agenda-bar rt-bar">
      <button type="button" class="icon-btn" id="rsPrev" aria-label="Mes anterior">‹</button>
      <span class="agenda-day">${titulo}${resumenUI.mes === mesActual ? " · este mes" : ""}</span>
      <button type="button" class="icon-btn" id="rsNext" aria-label="Mes siguiente"${resumenUI.mes >= mesActual ? " disabled" : ""}>›</button>
    </div>
    <div id="rsBody"><div class="skel skel-block" style="height:260px"></div></div></div>`;
  const ir = (delta)=>{ resumenUI.mes = fechaISO(new Date(m.getFullYear(), m.getMonth() + delta, 1)); renderCoachResumen(main); };
  document.getElementById("rsPrev").onclick = ()=> ir(-1);
  document.getElementById("rsNext").onclick = ()=> ir(1);
  const { data: r, error } = await sb.rpc("resumen_centro", { p_mes: resumenUI.mes });
  const body = document.getElementById("rsBody");
  if(!body) return;
  if(error || !r){ body.innerHTML = `<div class="error" role="alert">${esc(errorES(error))}</div>`; return; }
  const ingresos = r.ingresos || [];
  const pagos = ingresos.reduce((s, x) => s + Number(x.pagos || 0), 0);
  const nuevos = r.nuevos || {};
  const tiles = [
    statTile("Ingresos del mes", ingresos.length ? ingresos.map(x => `<span class="rs-money">${dinero(x.total, x.moneda)}</span>`).join("") : "—",
      pagos ? plural(pagos, "pago aprobado", "pagos aprobados") : "Sin pagos aprobados"),
    statTile("Fortalecimiento activos", `<span class="num">${r.activos_fortalecimiento || 0}</span>`, "con acceso vigente hoy"),
    statTile("Terapia activos", `<span class="num">${r.activos_terapia || 0}</span>`, "con sesiones o reserva cercana"),
    statTile("Nuevos en el mes", `<span class="num">${(nuevos.terapia || 0) + (nuevos.fortalecimiento || 0)}</span>`,
      `${nuevos.terapia || 0} terapia · ${nuevos.fortalecimiento || 0} fortalecimiento`),
    statTile("Asistencias del mes", `<span class="num">${r.asistencias_mes || 0}</span>`, "llegadas registradas")
  ];
  const oc = r.ocupacion || [];
  const porDia = (cat)=> [1, 2, 3, 4, 5, 6, 7].map(d => {
    const hs = oc.filter(o => o.categoria === cat && o.dia_semana === d);
    if(!hs.length) return "";
    const res = hs.reduce((s, o) => s + o.reservas, 0), cap = hs.reduce((s, o) => s + o.aforo, 0);
    const pct = cap ? Math.round(res / cap * 100) : 0;
    return `<li class="oc-row"><span class="oc-when">${DIAS_SEMANA[d].slice(0, 3)}</span>
      <span class="oc-bar" role="img" aria-label="${pct}% ocupado"><i style="width:${Math.min(100, pct)}%"></i></span>
      <span class="oc-num num">${res}/${cap}</span></li>`;
  }).join("");
  const top = [...oc].filter(o => o.reservas > 0).sort((a, b) => b.reservas / b.aforo - a.reservas / a.aforo).slice(0, 5);
  const lunes = parseFecha(r.semana);
  body.innerHTML = `
    <div class="stats rs-stats">${tiles.join("")}</div>
    <section class="panel" style="margin-top:var(--gap)"><div class="panel-head"><h2>Ocupación de esta semana</h2><span class="muted">Desde el lunes ${lunes.getDate()} de ${MESES_LARGOS[lunes.getMonth()]} · reservas sobre aforo</span></div>
      <div class="oc-grid">
        ${["fortalecimiento", "terapia"].map(cat => `<div><h3 class="sub-h">${CATEGORIAS[cat].nombre}</h3><ul class="oc-list">${porDia(cat) || `<li class="muted">Sin horarios activos.</li>`}</ul></div>`).join("")}
      </div>
      ${top.length ? `<h3 class="sub-h">Horarios más llenos</h3><ul class="mov-list">${top.map(o => `<li><span class="mov-txt">${DIAS_SEMANA[o.dia_semana]} ${o.hora} · ${CATEGORIAS[o.categoria].nombre}</span><span class="num">${o.reservas}/${o.aforo}</span></li>`).join("")}</ul>` : ""}
    </section>`;
}

/* ====================== MASTER: EQUIPO ======================
   Cada persona crea su cuenta en la app (Registrarme) y un master le asigna su rol aquí. */
const ROL_OPCIONES = [["coach", "Master coach"], ["coach_general", "Lead coach (terapia y fortalecimiento)"], ["coach_terapia", "Coach de terapia"], ["coach_fortalecimiento", "Coach de fortalecimiento"]];
function rolSelectHTML(id, actual, conQuitar){
  return `<select data-rol-de="${esc(id)}" aria-label="Rol">
    ${actual === "atleta" || !actual ? `<option value="" selected>Elegir rol…</option>` : ""}
    ${ROL_OPCIONES.map(([k, t]) => `<option value="${k}"${k === actual ? " selected" : ""}>${t}</option>`).join("")}
    ${conQuitar ? `<option value="atleta">Quitar del equipo (vuelve a ser alumno)</option>` : ""}
  </select>`;
}
async function renderCoachEquipo(main){
  main.innerHTML = `<div class="detail"><header class="detail-head">
    <a class="back" href="#/">← Atletas</a>
    <p class="eyebrow">Solo master coach</p><h1>Equipo</h1>
    <p class="lede" style="margin-top:6px">El master ve todo y administra pagos, ajustes y el equipo. El lead coach ve terapia y fortalecimiento, sin pagos ni administración. El coach de terapia y el de fortalecimiento solo ven a los alumnos de su área.</p></header>
    <div class="grid">
      <section class="panel span-12"><div class="panel-head"><h2>Equipo actual</h2><span class="muted" id="eqCount"></span></div>
        <div id="eqLista"><div class="skel skel-block"></div></div></section>
      <section class="panel span-12"><div class="panel-head"><h2>Agregar al equipo</h2></div>
        <p class="muted" style="margin:0 0 10px">La persona primero crea su cuenta en la app con «Registrarme». Luego búscala aquí por nombre o correo y elige su rol.</p>
        <form class="inline-add" id="eqBuscarForm" role="search">
          <input type="search" id="eqQ" placeholder="Nombre o correo" aria-label="Buscar cuenta por nombre o correo" autocomplete="off">
          <button type="submit" class="btn-outline">Buscar</button>
        </form>
        <div id="eqResultados" aria-live="polite"></div></section>
    </div></div>`;
  const filaHTML = (c, conQuitar)=> `
    <li class="eq-row" data-id="${esc(c.id)}">
      <span class="avatar" aria-hidden="true">${esc(initials(c.nombre))}</span>
      <span class="eq-info"><strong>${esc(c.nombre || "(sin nombre)")}${c.id === state.profile.id ? " <span class=\"muted\">(tú)</span>" : ""}</strong>
        <span class="muted">${esc(c.email || "")}${c.role === "atleta" ? ` · alumno${c.categoria ? " de " + CATEGORIAS[c.categoria].nombre.toLowerCase() : ""}` : ""}</span>
        ${c.role !== "atleta" ? `<span class="eq-turno" data-turno-de="${esc(c.id)}"></span>` : ""}</span>
      <span class="eq-actions">${c.id === state.profile.id ? `<span class="badge">${ROLES_EQUIPO[c.role]}</span>`
        : `${rolSelectHTML(c.id, c.role, conQuitar)}<button type="button" class="btn-outline sm" data-guardar-rol="${esc(c.id)}">${c.role === "atleta" ? "Agregar" : "Guardar"}</button>`}</span>
      <span class="eq-msg" aria-live="polite"></span>
    </li>`;
  const enlazar = (box)=>{
    box.querySelectorAll("[data-guardar-rol]").forEach(b => {
      b.onclick = ()=>{
        const li = b.closest(".eq-row");
        const rol = li.querySelector("[data-rol-de]").value;
        const nombre = li.querySelector("strong").textContent;
        const msg = li.querySelector(".eq-msg");
        if(!rol){ showMsg(msg, "error", "Elige un rol."); return; }
        if(rol === "atleta" && !confirm(`¿Quitar a ${nombre} del equipo? Volverá a ser alumno y dejará de ver el panel.`)) return;
        if(rol !== "atleta" && b.textContent === "Agregar" && !confirm(`¿Dar a ${nombre} el rol de ${ROLES_EQUIPO[rol].toLowerCase()}? Dejará de ver su ficha de alumno y verá el panel del coach.`)) return;
        withBusy(b, "…", async ()=>{
          const { error } = await sb.rpc("asignar_rol", { p_user: li.dataset.id, p_rol: rol });
          if(error){ showError(msg, error); return; }
          await refreshCoachAside();
          await renderCoachEquipo(main);
        });
      };
    });
  };
  const { data: equipo, error } = await sb.rpc("equipo_cuentas", { p_q: null });
  const lista = document.getElementById("eqLista");
  if(!lista) return;
  if(error){ lista.innerHTML = `<div class="error" role="alert">${esc(errorES(error))}</div>`; return; }
  const orden = { coach: 0, coach_general: 1, coach_terapia: 2, coach_fortalecimiento: 3 };
  const eq = (equipo || []).sort((a, b) => (orden[a.role] - orden[b.role]) || String(a.nombre).localeCompare(String(b.nombre)));
  document.getElementById("eqCount").textContent = plural(eq.length, "persona", "personas");
  lista.innerHTML = `<ul class="eq-list">${eq.map(c => filaHTML(c, true)).join("")}</ul>`;
  enlazar(lista);
  pintarTurnosEquipo();
  document.getElementById("eqBuscarForm").onsubmit = async (e)=>{
    e.preventDefault();
    const q = document.getElementById("eqQ").value.trim();
    const out = document.getElementById("eqResultados");
    if(q.length < 2){ out.innerHTML = `<p class="muted">Escribe al menos 2 letras.</p>`; return; }
    out.innerHTML = `<div class="skel skel-line" style="width:60%;margin-top:12px"></div>`;
    const { data, error: e2 } = await sb.rpc("equipo_cuentas", { p_q: q });
    if(e2){ out.innerHTML = `<div class="error" role="alert">${esc(errorES(e2))}</div>`; return; }
    const nuevos = (data || []).filter(c => c.role === "atleta");
    out.innerHTML = nuevos.length ? `<ul class="eq-list" style="margin-top:10px">${nuevos.map(c => filaHTML(c, false)).join("")}</ul>`
      : `<p class="muted" style="margin-top:10px">${(data || []).length ? "Esa persona ya está en el equipo." : "No encontramos una cuenta con ese nombre o correo. Pídele que se registre primero."}</p>`;
    enlazar(out);
  };
}

/* Equipo: el master ve quién está en turno y puede iniciar o terminar el turno de cualquier coach */
async function pintarTurnosEquipo(){
  const box = document.getElementById("eqLista");
  if(!box) return;
  const { data, error } = await sb.from("turnos_coach").select("id, coach_id, inicio, iniciado_por").is("fin", null);
  if(error || !document.getElementById("eqLista")) return;
  const hoy = todayStr();
  const abiertos = (data || []).filter(t => new Date(t.inicio).toLocaleDateString("en-CA", { timeZone: "America/Lima" }) === hoy);
  box.querySelectorAll("[data-turno-de]").forEach(el => {
    const id = el.dataset.turnoDe;
    const t = abiertos.find(x => x.coach_id === id);
    const quien = t && t.iniciado_por && t.iniciado_por !== id ? (t.iniciado_por === state.profile.id ? " · lo iniciaste tú" : " · lo inició " + esc(primerNombre(nombreEquipo(t.iniciado_por)))) : "";
    el.innerHTML = t
      ? `<span class="eq-turno-on"><span class="turno-luz" aria-hidden="true"></span>En turno desde las ${esc(horaDe(t.inicio))}${quien}</span>
         <button type="button" class="btn-link danger" data-fin-turno-de="${esc(id)}">Terminar turno</button>`
      : `<span class="muted">Sin turno</span><button type="button" class="btn-outline sm" data-iniciar-turno-de="${esc(id)}">Iniciar turno</button>`;
  });
  const nombreDe = (id)=> id === state.profile.id ? "tu" : "el de " + (primerNombre(nombreEquipo(id)) || "este coach");
  box.querySelectorAll("[data-iniciar-turno-de]").forEach(b => { b.onclick = ()=> withBusy(b, "…", async ()=>{
    const id = b.dataset.iniciarTurnoDe;
    const { error: e } = await sb.rpc("iniciar_turno_de", { p_coach: id });
    const msg = b.closest(".eq-row").querySelector(".eq-msg");
    if(e){ showError(msg, e); return; }
    if(id === state.profile.id) await cargarTurno();
    await pintarTurnosEquipo();
    showMsg(b.closest(".eq-row") ? b.closest(".eq-row").querySelector(".eq-msg") : msg, "ok", id === state.profile.id ? "Tu turno quedó iniciado." : "Turno iniciado. Le llegó un aviso.");
  }); });
  box.querySelectorAll("[data-fin-turno-de]").forEach(b => { b.onclick = ()=>{
    const id = b.dataset.finTurnoDe;
    if(!confirm(`¿Terminar ${nombreDe(id)} turno? Su Mirador se apaga.`)) return;
    withBusy(b, "…", async ()=>{
      const { error: e } = await sb.rpc("terminar_turno_de", { p_coach: id });
      const msg = b.closest(".eq-row").querySelector(".eq-msg");
      if(e){ showError(msg, e); return; }
      if(id === state.profile.id) await cargarTurno();
      await pintarTurnosEquipo();
      showMsg(msg, "ok", "Turno terminado.");
    });
  }; });
}

/* ====================== AJUSTES: HISTORIAL DE CONSEJOS (MASTER) ======================
   Cada vez que un coach deja un consejo nuevo, la base lo guarda con su fecha (tabla consejos_historial).
   La ficha del alumno muestra solo el último; aquí se ven todos. */
const normalizar = (t)=> String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
async function pintarHistorialConsejos(){
  const box = document.getElementById("histConsBox");
  if(!box) return;
  const { data, error } = await sb.from("consejos_historial").select("*").order("created_at", { ascending: false }).limit(500);
  if(!document.getElementById("histConsBox")) return;
  if(error){ box.innerHTML = `<div class="error">${esc(errorES(error))}</div>`; return; }
  const filas = data || [];
  const nombre = (id)=> (state.athleteList.find(a => a.id === id) || {}).nombre || "Alumno";
  const autorDe = (r)=> r.autor_nombre || (r.autor ? nombreAutor(r.autor) : "Sin autor");
  /* Filtro por coach: los que dejaron al menos un consejo, con cuántos */
  const sel = document.getElementById("histConsCoach");
  const coaches = {};
  filas.forEach(r => { const k = r.autor || ""; coaches[k] = coaches[k] || { n: 0, nombre: autorDe(r) }; coaches[k].n++; });
  if(sel) sel.innerHTML = `<option value="">Todos los coaches (${filas.length})</option>` + Object.entries(coaches)
    .sort((a, b) => a[1].nombre.localeCompare(b[1].nombre, "es"))
    .map(([k, c]) => `<option value="${esc(k || "_")}">${esc(c.nombre)} (${c.n})</option>`).join("");
  const pintar = ()=>{
    const t = normalizar((document.getElementById("histConsBuscar") || {}).value || "");
    const coach = sel ? sel.value : "";
    const vis = filas.filter(r => (!coach || (r.autor || "_") === coach) && (!t || normalizar(nombre(r.user_id) + " " + r.texto).includes(t)));
    box.innerHTML = vis.length ? `<ul class="hist-cons">${vis.map(r => `
      <li><div class="hist-cons-top"><strong>${esc(nombre(r.user_id))}</strong><span class="muted num">${esc(fmtFechaHora(r.created_at))}</span></div>
        <p>${esc(r.texto)}</p><span class="muted">Por ${esc(autorDe(r))}</span></li>`).join("")}</ul>
      ${vis.length === 500 ? `<p class="muted">Se muestran los 500 más recientes.</p>` : ""}`
      : emptyHTML(t || coach ? "Ningún consejo coincide con el filtro." : "Todavía no hay consejos guardados.");
  };
  pintar();
  const q = document.getElementById("histConsBuscar");
  if(q) q.oninput = pintar;
  if(sel) sel.onchange = pintar;
}

/* Ajustes: acceso de fortalecimiento de todos los alumnos (y transición), con «Habilitar» o «Extender» */
async function pintarAccesosAjustes(){
  const box = document.getElementById("accLista");
  if(!box) return;
  let alumnos = (state.athleteList || []);
  if(!alumnos.length){ const { data } = await sb.from("profiles").select("*").eq("role", "atleta").order("nombre"); alumnos = data || []; }
  alumnos = alumnos.filter(a => ["fortalecimiento", "transicion"].includes(a.categoria));
  const ids = alumnos.map(a => a.id);
  const [{ data: mems, error }, { data: congs }] = ids.length ? await Promise.all([
    sb.from("membresias").select("user_id, inicio, fin").in("user_id", ids),
    sb.from("congelamientos").select("user_id, desde, hasta").in("user_id", ids)
  ]) : [{ data: [] }, { data: [] }];
  if(!document.getElementById("accLista")) return;
  if(error){ box.innerHTML = `<div class="error" role="alert">${esc(errorES(error))}</div>`; return; }
  const hoy = todayStr();
  const filas = alumnos.map(a => {
    const membresias = (mems || []).filter(m => m.user_id === a.id).sort((x, y) => y.fin.localeCompare(x.fin));
    const est = estadoMembresia({ membresias, congelamientos: (congs || []).filter(c => c.user_id === a.id) });
    const dias = est.finTotal && est.finTotal >= hoy ? diasEntre(hoy, est.finTotal) + 1 : 0;
    const con = !!(est.vigente || est.congelado || est.futura);
    const grupo = !con ? "sin" : (est.vigente && dias <= 7) ? "vence" : "activo";
    const txt = est.congelado ? `Congelado hasta el ${fmtFecha(est.congelado.hasta, true)} · vence el ${fmtFecha(est.finTotal, true)}`
      : est.vigente ? `Activo · vence el ${fmtFecha(est.finTotal, true)} (${plural(dias, "día", "días")})`
      : est.futura ? `Programado desde el ${fmtFecha(est.futura.inicio, true)}`
      : est.ultima ? `Vencido el ${fmtFecha(est.ultima.fin, true)}` : "Sin acceso";
    return { a, est, con, grupo, txt, orden: { sin: 0, vence: 1, activo: 2 }[grupo] };
  }).sort((x, y) => x.orden - y.orden || String(x.a.nombre || "").localeCompare(String(y.a.nombre || ""), "es"));
  const pintar = ()=>{
    const t = normalizar((document.getElementById("accBuscar") || {}).value || "");
    const f = (document.getElementById("accFiltro") || {}).value || "";
    const vis = filas.filter(r => (!f || r.grupo === f || (f === "activo" && r.grupo === "vence")) && (!t || normalizar(r.a.nombre || "").includes(t)));
    box.innerHTML = vis.length ? `<ul class="acc-lista">${vis.map(r => `
      <li class="acc-fila">
        <span class="acc-nombre">${esc(r.a.nombre || "(sin nombre)")}${r.a.categoria === "transicion" ? ` <span class="badge soft">Transición</span>` : ""}</span>
        <span class="acc-estado"><span class="chip acceso-chip acc-${r.grupo === "sin" ? "fin" : r.grupo === "vence" ? "poco" : "ok"}">${esc(r.txt)}</span></span>
        <a class="btn-link" href="#/atleta/${encodeURIComponent(r.a.id)}">Ficha</a>
        <button type="button" class="${r.con ? "btn-outline" : "btn-primary"} sm" data-acc-hab="${esc(r.a.id)}">${r.con ? "Extender" : "Habilitar"}</button>
      </li>`).join("")}</ul>`
      : emptyHTML(filas.length ? "Nadie coincide con el filtro." : "Todavía no hay alumnos de fortalecimiento.");
    box.querySelectorAll("[data-acc-hab]").forEach(b => { b.onclick = ()=> abrirHabilitarAcceso(filas.find(r => r.a.id === b.dataset.accHab)); });
  };
  pintar();
  const q = document.getElementById("accBuscar"), sf = document.getElementById("accFiltro");
  if(q) q.oninput = pintar;
  if(sf) sf.onchange = pintar;
}
function abrirHabilitarAcceso(r){
  const hoy = todayStr();
  const desde = r.est.finTotal && r.est.finTotal >= hoy ? fechaISO(sumarDias(parseFecha(r.est.finTotal), 1)) : hoy;
  const nombre = primerNombre(r.a.nombre) || "el alumno";
  const d = openDialog(`${r.con ? "Extender" : "Habilitar"} acceso · ${nombre}`, `
    <p class="muted" style="margin-top:0">${esc(r.txt)}.${r.con ? " Los días se suman a partir de cuando termina su acceso actual." : ""}</p>
    <div class="inline-add">
      <div><label for="dlgAccDesde" style="margin-top:0">Desde</label><input type="date" id="dlgAccDesde" value="${esc(desde)}"></div>
      <div><label for="dlgAccDias" style="margin-top:0">Días</label><input type="number" id="dlgAccDias" inputmode="numeric" min="1" max="400" value="30"></div>
    </div>
    <p class="muted">${r.a.categoria === "transicion" ? "En transición el acceso se cobra y coordina en el centro." : "Para pagos coordinados en el centro."} Se le avisa para que escoja su horario.</p>
    <button type="button" class="btn-primary" id="btnDlgAcc">${r.con ? "Extender acceso" : "Habilitar acceso"}</button>
    <div id="dlgAccMsg" aria-live="polite"></div>`);
  const btn = d.el.querySelector("#btnDlgAcc");
  btn.onclick = ()=> withBusy(btn, "…", async ()=>{
    const desdeV = d.el.querySelector("#dlgAccDesde").value;
    const dias = parseInt(d.el.querySelector("#dlgAccDias").value, 10);
    const msg = d.el.querySelector("#dlgAccMsg");
    if(!desdeV){ showMsg(msg, "error", "Elige desde qué día."); return; }
    if(!dias || dias < 1){ showMsg(msg, "error", "Escribe cuántos días de acceso."); return; }
    const { data, error } = await sb.rpc("asignar_acceso", { p_user: r.a.id, p_desde: desdeV, p_dias: dias });
    if(error){ showError(msg, error); return; }
    d.close();
    await pintarAccesosAjustes();
    showMsg(document.getElementById("accAjMsg"), "ok", `Acceso de ${r.a.nombre || "el alumno"} habilitado hasta el ${fmtFecha(data, true)}.`);
  });
}

/* ====================== TAREAS EN "HOY" ======================
   Dos listas: "Tareas de los master" (solo master coach, compartida: los master agregan, asignan y marcan hecha) y
   "Tareas del equipo" (cada tarea va a un coach; todo el equipo la ve en un apartado con el nombre de cada uno).
   Los master agregan y asignan; cada coach marca como hechas las suyas. A quien se le asigna le llega un aviso. */
const tareasUI = { lista: [], canal: null, espera: null };
/* Cambios en las tareas (agregar, marcar, borrar) llegan al instante a todas las pantallas abiertas */
function suscribirTareas(){
  if(tareasUI.canal || typeof sb.channel !== "function") return;
  tareasUI.canal = sb.channel("tareas-equipo")
    .on("postgres_changes", { event: "*", schema: "public", table: "tareas_equipo" }, ()=>{
      clearTimeout(tareasUI.espera);
      tareasUI.espera = setTimeout(()=>{ if(document.getElementById("tareasEquipoLista")) pintarTareasHoy(); }, 300);
    })
    .subscribe();
}
function quitarSuscripcionTareas(){
  if(tareasUI.canal){ try { sb.removeChannel(tareasUI.canal); } catch { /* ya cerrado */ } tareasUI.canal = null; }
}
function nombreEquipo(id){
  if(id === state.profile.id) return "Tú";
  return ((state.equipo || []).find(p => p.id === id) || {}).nombre || "Coach";
}
function equipoOrdenado(soloMasters){
  return (state.equipo || []).filter(p => !soloMasters || p.role === "coach")
    .sort((a, b) => (a.id === state.profile.id ? -1 : b.id === state.profile.id ? 1 : String(a.nombre).localeCompare(String(b.nombre))));
}
function formTareaHTML(ambito){
  if(!esMaster()) return "";
  const yo = state.profile.id;
  const opcion = (m, conRol)=> `<option value="${esc(m.id)}">${esc(m.id === yo ? "Yo" : (m.nombre || "Coach") + (conRol ? " · " + (ROLES_EQUIPO[m.role] || "").toLowerCase() : ""))}</option>`;
  let opciones;
  if(ambito === "master"){
    opciones = equipoOrdenado(true).map(m => opcion(m, false)).join("");
  } else {
    /* Primero los coaches que no son master, luego los master */
    const coaches = equipoOrdenado(false).filter(m => m.role !== "coach");
    const masters = equipoOrdenado(true);
    opciones = `${coaches.length ? `<optgroup label="Coaches">${coaches.map(m => opcion(m, true)).join("")}</optgroup>` : ""}
      <optgroup label="Master coach">${masters.map(m => opcion(m, false)).join("")}</optgroup>`;
  }
  return `
    <form class="tarea-form" data-ambito="${ambito}" novalidate>
      <label for="tt_${ambito}" class="sr-only">Nueva tarea</label>
      <input id="tt_${ambito}" maxlength="500" placeholder="${ambito === "master" ? "Nueva tarea para los master" : "Nueva tarea para un coach o para todos"}" autocomplete="off">
      <div class="tarea-opts">
        <div><label for="tp_${ambito}">Para</label>
          <select id="tp_${ambito}"><option value="">Todos</option>${opciones}</select></div>
        <div><label for="tf_${ambito}">Para cuándo <span class="muted">(opcional)</span></label><input type="date" id="tf_${ambito}" min="${todayStr()}"></div>
        <button class="btn-primary" type="submit">Agregar</button>
      </div>
      <div class="tarea-msg" aria-live="polite"></div>
    </form>`;
}
function itemTareaHTML(t, conPara){
  const yo = state.profile.id, hoy = todayStr();
  const puedeMarcar = esMaster() || (t.ambito === "equipo" && (!t.asignada_a || t.asignada_a === yo));
  /* Para ti: contorno verde; si vence en 48 horas o menos (o ya venció), verde más brillante */
  const mia = t.asignada_a === yo && !t.hecha;
  const urgente = mia && t.fecha_limite && diasEntre(hoy, t.fecha_limite) <= 2;
  const vence = t.fecha_limite ? (t.fecha_limite < hoy && !t.hecha ? `<span class="tarea-vence tarde">Venció el ${fmtFecha(t.fecha_limite)}</span>`
    : `<span class="tarea-vence${t.fecha_limite === hoy ? " hoy" : ""}">${t.fecha_limite === hoy ? "Para hoy" : "Para el " + fmtFecha(t.fecha_limite)}</span>`) : "";
  const quien = (id)=> id === yo ? "ti" : nombreEquipo(id);
  const meta = t.hecha
    ? `${t.hecha_por === yo ? "La hiciste tú" : "Hecha por " + esc(quien(t.hecha_por))}${t.hecha_at ? " · " + esc(tiempoRelativo(t.hecha_at).toLowerCase()) : ""}`
    : [conPara ? (t.asignada_a ? "Para " + esc(quien(t.asignada_a)) : t.ambito === "master" ? "Para todos los master" : "Para todos") : "", t.creado_por === yo ? "la agregaste tú" : "la agregó " + esc(quien(t.creado_por))].filter(Boolean).join(" · ");
  return `
    <li class="tarea${t.hecha ? " hecha" : ""}${mia ? " mia" : ""}${urgente ? " urgente" : ""}">
      <label class="tarea-check"><input type="checkbox" data-hecha="${esc(t.id)}" ${t.hecha ? "checked" : ""}${puedeMarcar ? "" : " disabled"}><span class="sr-only">${t.hecha ? "Marcar como pendiente" : "Marcar como hecha"}</span></label>
      <div class="tarea-txt"><p>${esc(t.texto)}</p><p class="tarea-meta">${vence}<span>${meta}</span></p></div>
      ${esMaster() ? `<button type="button" class="icon-btn tarea-del" data-borrar-tarea="${esc(t.id)}" aria-label="Borrar tarea">✕</button>` : ""}
    </li>`;
}
function ordenPend(a, b){ return (a.fecha_limite || "9999").localeCompare(b.fecha_limite || "9999") || String(b.created_at).localeCompare(String(a.created_at)); }
async function pintarTareasHoy(){
  const boxM = document.getElementById("tareasMasterLista"), boxE = document.getElementById("tareasEquipoLista");
  if(!boxE) return;
  const { data, error } = await sb.from("tareas_equipo").select("*").order("created_at", { ascending: false }).limit(300);
  if(!document.getElementById("tareasEquipoLista")) return;
  if(error){ boxE.innerHTML = `<div class="error" role="alert">${esc(errorES(error))}</div>`; return; }
  tareasUI.lista = data || [];
  const yo = state.profile.id;
  /* La sección "Hechas" que estaba abierta sigue abierta al recargar la lista */
  const abiertas = new Set([...document.querySelectorAll(".tareas-panel details[data-hechas][open]")].map(d => d.dataset.hechas));
  const hechasHTML = (l, clave)=> l.length ? `<details class="records" data-hechas="${clave}"${abiertas.has(clave) ? " open" : ""}><summary>Hechas (${l.length})</summary><ul class="tareas-lista">${l.map(t => itemTareaHTML(t, true)).join("")}</ul></details>` : "";
  const hechasOrden = (l)=> l.sort((a, b) => String(b.hecha_at).localeCompare(String(a.hecha_at))).slice(0, 20);

  if(boxM){
    const m = tareasUI.lista.filter(t => t.ambito !== "equipo");
    const pend = m.filter(t => !t.hecha).sort(ordenPend);
    boxM.innerHTML = `${pend.length ? `<ul class="tareas-lista">${pend.map(t => itemTareaHTML(t, true)).join("")}</ul>` : emptyHTML("No hay tareas pendientes. ¡Todo al día!")}${hechasHTML(hechasOrden(m.filter(t => t.hecha)), "master")}`;
    const c = document.getElementById("tmCuenta"); if(c) c.textContent = pend.length ? plural(pend.length, "pendiente", "pendientes") : "";
  }

  /* Tareas del equipo: "Para todos", luego las tuyas y (solo los master) un apartado por cada coach.
     Cada coach solo recibe de la base sus tareas y las que son para todos. */
  const e = tareasUI.lista.filter(t => t.ambito === "equipo");
  const pend = e.filter(t => !t.hecha);
  const todos = pend.filter(t => !t.asignada_a).sort(ordenPend);
  const ids = [...new Set(pend.filter(t => t.asignada_a).map(t => t.asignada_a))]
    .filter(id => esMaster() || id === yo)
    .sort((a, b) => a === yo ? -1 : b === yo ? 1 : nombreEquipo(a).localeCompare(nombreEquipo(b)));
  const mias = pend.filter(t => t.asignada_a === yo).length + todos.length;
  const c = document.getElementById("teCuenta"); if(c) c.textContent = esMaster() ? (pend.length ? plural(pend.length, "pendiente", "pendientes") : "") : (mias ? `Tienes ${plural(mias, "pendiente", "pendientes")}` : "");
  const grupo = (clave, titulo, sub, iniciales, lista, mio)=> `
      <section class="tarea-grupo${mio ? " mio" : ""}${clave === "todos" ? " todos" : ""}" aria-label="${esc(titulo)}">
        <h3 class="tarea-grupo-t"><span class="avatar" aria-hidden="true">${esc(iniciales)}</span>
          <span>${esc(titulo)}${sub ? `<small>${esc(sub)}</small>` : ""}</span><span class="tarea-n">${lista.length}</span></h3>
        <ul class="tareas-lista">${lista.map(t => itemTareaHTML(t, false)).join("")}</ul></section>`;
  const grupos = [];
  if(todos.length) grupos.push(grupo("todos", "Para todos", "Todo el equipo la ve; la marca quien la haga", "✦", todos, false));
  ids.forEach(id => {
    const persona = (state.equipo || []).find(p => p.id === id);
    grupos.push(grupo(id, id === yo ? "Tus tareas" : nombreEquipo(id), id === yo ? "" : (ROLES_EQUIPO[(persona || {}).role] || ""),
      initials(id === yo ? state.profile.nombre || "" : (persona || {}).nombre || ""), pend.filter(t => t.asignada_a === id).sort(ordenPend), id === yo));
  });
  boxE.innerHTML = `
    ${grupos.length ? grupos.join("") : emptyHTML(esMaster() ? "Nadie tiene tareas pendientes." : "No tienes tareas pendientes.")}
    ${hechasHTML(hechasOrden(e.filter(t => t.hecha)), "equipo")}`;

  document.querySelectorAll(".tareas-panel [data-hecha]").forEach(cb => {
    cb.onchange = async ()=>{
      cb.disabled = true;
      const { error: e2 } = await sb.from("tareas_equipo").update({ hecha: cb.checked }).eq("id", cb.dataset.hecha);
      if(e2){ cb.disabled = false; cb.checked = !cb.checked; showError(cb.closest(".tareas-panel").querySelector(".tarea-msg") || document.getElementById("tareasEquipoMsg"), e2); return; }
      await pintarTareasHoy();
    };
  });
  document.querySelectorAll(".tareas-panel [data-borrar-tarea]").forEach(b => {
    b.onclick = async ()=>{
      if(!confirm("¿Borrar esta tarea?")) return;
      const { error: e3 } = await sb.from("tareas_equipo").delete().eq("id", b.dataset.borrarTarea);
      if(e3){ showError(b.closest(".tareas-panel").querySelector(".tarea-msg") || document.getElementById("tareasEquipoMsg"), e3); return; }
      await pintarTareasHoy();
    };
  });
}
function enlazarFormsTareas(){
  document.querySelectorAll(".tarea-form").forEach(form => {
    form.onsubmit = (ev)=>{
      ev.preventDefault();
      const ambito = form.dataset.ambito;
      const btn = form.querySelector("button[type=submit]");
      withBusy(btn, "…", async ()=>{
        const msg = form.querySelector(".tarea-msg");
        const texto = form.querySelector(`#tt_${ambito}`).value.trim();
        const para = form.querySelector(`#tp_${ambito}`).value || null;
        if(!texto){ showMsg(msg, "error", "Escribe la tarea."); return; }
        const { error } = await sb.from("tareas_equipo").insert({ texto, ambito, asignada_a: para, fecha_limite: form.querySelector(`#tf_${ambito}`).value || null });
        if(error){ showError(msg, error); return; }
        form.querySelector(`#tt_${ambito}`).value = ""; form.querySelector(`#tf_${ambito}`).value = "";
        msg.innerHTML = "";
        await pintarTareasHoy();
        form.querySelector(`#tt_${ambito}`).focus();
      });
    };
  });
}
