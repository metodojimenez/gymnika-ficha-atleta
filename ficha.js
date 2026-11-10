/* ====================== FICHA DEL ATLETA ====================== */
function panelHTML(id, title, span, opts = {}){
  const plegado = opts.plegable && panelPlegado(id);
  const cls = ["panel", "span-" + span, opts.cls || "", opts.plegable ? "plegable" : "", plegado ? "plegado" : ""].join(" ").replace(/\s+/g, " ").trim();
  return `
    <section class="${cls}" aria-labelledby="h_${id}">
      <div class="panel-head">
        <div>${opts.eyebrow ? `<p class="eyebrow">${opts.eyebrow}</p>` : ""}<h2 id="h_${id}">${title}</h2></div>
        ${opts.note ? `<span class="muted">${opts.note}</span>` : ""}
        ${opts.plegable ? `<button type="button" class="btn-link plegar" data-plegar="${id}" aria-expanded="${!plegado}" aria-controls="${id}">${plegado ? "Mostrar" : "Minimizar"}</button>` : ""}
      </div>
      <div id="${id}"${plegado ? " hidden" : ""}>${opts.body || ""}</div>
    </section>`;
}
/* Paneles que se pueden minimizar: el estado se recuerda en este dispositivo */
function panelPlegado(id){
  try{ return localStorage.getItem("gymnika_plegado_" + id) === "1"; } catch { return false; }
}
function enlazarPlegables(root){
  root.querySelectorAll("[data-plegar]").forEach(b => {
    b.onclick = ()=>{
      const id = b.dataset.plegar;
      const cuerpo = document.getElementById(id);
      const plegar = !cuerpo.hidden;
      cuerpo.hidden = plegar;
      b.closest("section").classList.toggle("plegado", plegar);
      b.textContent = plegar ? "Mostrar" : "Minimizar";
      b.setAttribute("aria-expanded", String(!plegar));
      try{ localStorage.setItem("gymnika_plegado_" + id, plegar ? "1" : "0"); } catch { /* sin almacenamiento */ }
      if(!plegar && id === "medidasCard" && state.detail) renderPesoGrasaChart(state.detail.medidas || []);
    };
  });
}

function detailSkeleton(){
  return `
    <div role="status" aria-label="Cargando ficha">
      <div class="skel skel-line" style="width:120px;margin-top:0"></div>
      <div class="skel" style="height:44px;width:min(420px,80%);margin:8px 0 20px"></div>
      <div class="grid">
        <div class="skel span-12" style="height:150px"></div>
        <div class="skel span-6" style="height:110px"></div>
        <div class="skel span-6" style="height:110px"></div>
        <div class="skel span-8 skel-block" style="height:280px"></div>
        <div class="skel span-4 skel-block" style="height:280px"></div>
      </div>
    </div>`;
}

async function renderAthleteDetail(profile, isCoach, container){
  if(!container) return;
  const token = ++state.renderToken;
  const uid = profile.id;
  container.innerHTML = detailSkeleton();
  const results = await Promise.all([
    sb.from("medidas").select("*").eq("user_id", uid).order("fecha"),
    sb.from("fuerza").select("*").eq("user_id", uid).order("semana"),
    sb.from("ejercicios_fuerza").select("*").eq("user_id", uid).order("created_at"),
    sb.from("eventos").select("*").eq("user_id", uid).order("fecha"),
    sb.from("solicitudes_nutricion").select("*").eq("user_id", uid).order("fecha", { ascending: false }),
    isCoach ? sb.from("ficha_interna").select("*").eq("user_id", uid).maybeSingle() : Promise.resolve({ data: null })
  ]);
  if(token !== state.renderToken) return; // el coach ya abrió otro atleta
  const [{ data: medidas }, { data: fuerza }, { data: ejercicios }, { data: eventos }, { data: solicitudes }, { data: interna }] = results;
  const fallo = results.find(r => r.error);
  state.detail = { medidas: medidas || [], fuerza: fuerza || [], eventos: eventos || [], interna: interna || null };

  const edad = calcEdad(profile.fecha_nacimiento);
  const chips = [
    profile.deporte,
    profile.nivel_experiencia,
    edad !== null ? `${edad} años` : null,
    profile.objetivo ? `Objetivo: ${profile.objetivo}` : null
  ].filter(Boolean).map(t=>`<li class="chip">${esc(t)}</li>`);
  if(isCoach && tieneLesion(profile.lesiones)) chips.push(`<li class="chip warn">Lesión: ${esc(profile.lesiones)}</li>`);
  if(isCoach && profile.autorizacion_medica === false) chips.push(`<li class="chip warn">Sin autorización médica</li>`);
  if(isCoach && profile.tutor_id){
    const tutor = state.athleteList.find(a => a.id === profile.tutor_id);
    chips.push(`<li class="chip">Menor · a cargo de ${esc(tutor ? tutor.nombre : "su papá o mamá")}</li>`);
  }
  /* Papá o mamá viendo el panel de su hijo (ficha sin cuenta propia) */
  const esHijo = !isCoach && state.profile && profile.id !== state.profile.id;

  const tip = tipDelDia();
  const cat = profile.categoria;
  const esTerapia = cat === "terapia";
  const graficoPeso = (span)=> panelHTML("pesoGrasaCard", "Peso y % grasa", span, { body: `<div class="chart-box"><canvas id="pesoGrasaChart" role="img" aria-label="Gráfico de peso y porcentaje de grasa en el tiempo"></canvas></div>` });
  const resumenHTML = `
        <section class="span-12" aria-labelledby="h_resumen">
          <h2 class="sr-only" id="h_resumen">${isCoach ? "Resumen del proceso" : "Tu proceso"}</h2>
          <div class="stats" id="resumenCard"></div>
        </section>`;
  const macroHTML = `<section class="panel macro span-12" id="macroCard" aria-label="Macrociclo"></section>`;
  let panels, tabsAlumno = null;
  if(!isCoach){
    const estirar = panelHTML("estiramientosCard", "Rutina de estiramiento diaria", 12, { eyebrow: "Todas las mañanas" });
    const familia = !esHijo && !state.profile.tutor_id ? panelHTML("familiaCard", "Mi familia", 12, { eyebrow: "Hijos a tu cargo" }) : "";
    /* Inicio: próxima sesión con el botón del QR, estiramientos diarios y consejo del coach; abajo, su plan */
    const hoyAlumno = `<section class="panel span-12 hoy-alumno" id="inicioHoyCard" aria-label="${esHijo ? "Su próxima sesión" : "Tu próxima sesión"}"><div class="skel skel-block"></div></section>`;
    const consejoCoach = panelHTML("notasCard", "Consejo de tu coach", 12, { cls: "coach-voice", eyebrow: "Tu coach" });
    /* Tu reloj: pasos y sueño + atajo a «Entrenamiento fuera de Gymnika» (vive en Progreso) */
    const reloj = panelHTML("relojCard", "Tu reloj", 12, { eyebrow: "Pasos, sueño y entrenamientos" });
    tabsAlumno = esTerapia ? {
      inicio: `
    ${hoyAlumno}
    ${panelHTML("planCard", esHijo ? "Sus sesiones" : "Mis sesiones", 12, { cls: "plan-panel", eyebrow: "Terapia" })}
    ${reloj}
    ${estirar}
    ${consejoCoach}
    ${panelHTML("tipCard", esc(tip.titulo), 12, { cls: "coach-voice consejo-dia", eyebrow: "Consejo del día", body: `<p class="coach-quote">${esc(tip.texto)}</p>` })}
    ${familia}`,
      reservar: `
    ${panelHTML("reservarCard", "Reservar sesión", 8, { note: "Cada reserva usa 1 sesión" })}
    ${panelHTML("misReservasCard", esHijo ? "Sus reservas" : "Mis reservas", 4)}`,
      progreso: `
    ${resumenHTML}
    ${panelHTML("externosCard", "Entrenamiento fuera de Gymnika", 12, { eyebrow: "Tu reloj o a mano" })}
    ${panelHTML("medidasCard", "Medidas corporales", 12, { plegable: true })}`,
      ficha: `
    ${panelHTML("fichaCard", "Datos personales", 12)}`
    } : {
      inicio: `
    ${hoyAlumno}
    ${panelHTML("planCard", cat === "transicion" ? (esHijo ? "Su plan" : "Mi plan") : (esHijo ? "Su acceso" : "Mi acceso"), 8, { cls: "plan-panel", eyebrow: cat === "transicion" ? "Transición · terapia y fortalecimiento" : "Fortalecimiento" })}
    ${panelHTML("constanciaCard", "Tu rueda de constancia", 4, { eyebrow: "Desde tu último entrenamiento" })}
    ${reloj}
    ${estirar}
    ${consejoCoach}`,
      reservar: `
    ${panelHTML("reservarCard", "Reservar horario", 8, { note: "Obligatorio para entrar" })}
    ${panelHTML("misReservasCard", esHijo ? "Sus horarios" : "Mis horarios", 4)}`,
      progreso: `
    ${panelHTML("tipCard", esc(tip.titulo), 12, { cls: "coach-voice consejo-dia", eyebrow: "Consejo del día", body: `<p class="coach-quote">${esc(tip.texto)}</p>` })}
    ${macroHTML}
    ${resumenHTML}
    ${panelHTML("fuerzaCard", "Progresión de fuerza", 8, { note: "Carga el coach" })}
    ${graficoPeso(4)}
    ${panelHTML("medidasCard", "Medidas corporales", 12, { plegable: true })}
    ${panelHTML("externosCard", "Entrenamiento fuera de Gymnika", 12, { eyebrow: "Tu reloj o a mano" })}`,
      ficha: `
    ${familia}
    ${panelHTML("agendaCard", "Agenda: viajes y competencias", 6)}
    ${panelHTML("nutricionCard", "Plan nutricional", 6)}
    ${panelHTML("fichaCard", "Datos personales", 12)}`
    };
  } else if(esTerapia){
    panels = `
    ${panelHTML("planCard", esMaster() ? "Plan y pagos" : "Sesiones", 12, { eyebrow: "Terapia" })}
    ${agendaMasterHTML(profile)}
    ${panelHTML("evolucionCard", "Evolución", 12, { eyebrow: "Color de riesgo y dolor en el tiempo" })}
    ${panelHTML("notasCard", "Notas del coach", 6)}
    ${panelHTML("estiramientosCard", "Rutina de estiramiento diaria", 6)}
    ${panelHTML("nutricionCard", "Plan nutricional", 6)}
    ${panelHTML("externosCard", "Entrenamiento fuera de Gymnika", 12, { eyebrow: "Reloj o a mano" })}
    ${panelHTML("medidasCard", "Medidas corporales", 12, { plegable: true })}
    ${panelHTML("fichaCard", "Datos personales", 12)}`;
  } else {
    panels = `
    ${panelHTML("planCard", esMaster() ? "Plan y pagos" : cat === "transicion" ? "Plan" : "Acceso", 12, { eyebrow: cat ? CATEGORIAS[cat].nombre + (cat === "transicion" ? " · terapia y fortalecimiento" : "") : "Sin categoría" })}
    ${agendaMasterHTML(profile)}
    ${macroHTML}
    ${resumenHTML}
    ${panelHTML("evolucionCard", "Evolución", 12, { eyebrow: "Color de riesgo y dolor en el tiempo" })}
    ${panelHTML("notasCard", "Notas del coach", 6)}
    ${panelHTML("agendaCard", "Agenda: viajes y competencias", 6)}
    ${panelHTML("fuerzaCard", "Progresión de fuerza", 8)}
    ${graficoPeso(4)}
    ${panelHTML("medidasCard", "Medidas corporales", 12, { plegable: true })}
    ${panelHTML("externosCard", "Entrenamiento fuera de Gymnika", 12, { eyebrow: "Reloj o a mano" })}
    ${panelHTML("nutricionCard", "Plan nutricional", 6)}
    ${panelHTML("estiramientosCard", "Rutina de estiramiento diaria", 6)}
    ${panelHTML("fichaCard", "Datos personales", 6)}`;
  }
  if(isCoach && cat) chips.unshift(`<li class="chip cat-chip cat-${cat}">${CATEGORIAS[cat].nombre}</li>`);
  /* El master ve de un vistazo cuánto acceso le queda (se llena al cargar su plan) */
  if(isCoach && cat && esMaster()) chips.splice(1, 0, `<li class="chip acceso-chip" id="accesoChip" hidden></li>`);
  state.detail.profile = profile;

  if(tabsAlumno){
    container.innerHTML = detalleAlumnoHTML(profile, chips, tabsAlumno, fallo);
  } else container.innerHTML = `
    <div class="detail">
      <header class="detail-head">
        ${isCoach ? `<a class="back" href="#/">← Atletas</a>` : ""}
        <div class="detail-title">
          <div>
            <p class="eyebrow">${isCoach ? "Ficha del atleta" : "Mi ficha"}</p>
            <h1>${esc(profile.nombre || (isCoach ? "(sin nombre)" : "Mi ficha"))}</h1>
            ${chips.length ? `<ul class="chips">${chips.join("")}</ul>` : ""}
          </div>
          ${isCoach ? `<div class="detail-acc"><a class="btn-outline" href="#/bitacora/${encodeURIComponent(profile.id)}"><span aria-hidden="true">✎</span> Bitácora</a>
            ${esMaster() ? `<button type="button" class="btn-danger" id="btnDelAthlete">Borrar atleta</button>` : ""}</div>` : ""}
        </div>
        <div id="detailMsg">${fallo ? `<div class="error" role="alert">${esc("Parte de la ficha no cargó. " + errorES(fallo.error))}</div>` : ""}</div>
      </header>
      <div class="grid">${panels}</div>
    </div>
  `;

  if(isCoach){
    const delBtn = document.getElementById("btnDelAthlete");
    if(delBtn) delBtn.onclick = ()=>{
      if(!confirm(`¿Borrar a ${profile.nombre || "este atleta"} y todos sus registros? Esta acción no se puede deshacer.`)) return;
      withBusy(delBtn, "Borrando…", async ()=>{
        const { error } = await sb.from("profiles").delete().eq("id", uid);
        if(error){ showError(document.getElementById("detailMsg"), error); return; }
        location.hash = "#/";
        await refreshCoachAside();
        showCoachRoute();
      });
    };
  }

  const hay = (id)=> !!document.getElementById(id);
  if(tabsAlumno) activarSeccionAlumno(seccionAlumnoDeURL(), false);
  enlazarPlegables(container);
  renderMacro(state.detail.eventos, true);
  renderResumen();
  renderFichaForm(profile, uid, isCoach);
  renderNotasCoach(profile, uid, isCoach);
  if(hay("agendaCard")) renderAgenda(eventos || [], uid, isCoach);
  renderMedidas(medidas || [], uid, isCoach);
  if(hay("fuerzaCard")) renderFuerza(fuerza || [], ejercicios || [], uid, isCoach);
  if(hay("externosCard")) renderExternos(document.getElementById("externosCard"), uid, { esCoach: isCoach });
  if(hay("relojCard")) renderReloj(document.getElementById("relojCard"), uid);
  if(hay("evolucionCard") && isCoach) renderEvolucion(document.getElementById("evolucionCard"), uid);
  if(hay("nutricionCard")) renderNutricion(profile, uid, isCoach, solicitudes || []);
  renderEstiramientos(profile, uid, isCoach);
  container.querySelectorAll("[data-volver-panel]").forEach(b => { b.onclick = volverAMiPanel; });
  enlazarIrExternos(container);
  if(isCoach){
    await renderPlanCoach(profile);
    if(token === state.renderToken && hay("reservarCard")) await renderReservasAlumno(profile);
  } else {
    await renderPlanAlumno(profile); await renderReservasAlumno(profile);
    if(hay("familiaCard")) renderFamilia();
  }
}

/* Master: agenda horarios por el alumno desde su ficha (por ejemplo, para que nadie pierda su horario de siempre) */
function agendaMasterHTML(profile){
  if(!esMaster() || !profile.categoria) return "";
  return `
    ${panelHTML("reservarCard", `Agendar a ${esc(primerNombre(profile.nombre) || "este alumno")}`, 12, { eyebrow: "Agenda", note: "Reservas a su nombre", cls: "agenda-master" })}
    ${panelHTML("misReservasCard", "Sus reservas", 12)}`;
}

/* ---- Mi familia: hijos sin cuenta propia que el papá o la mamá maneja desde su panel ---- */
async function cargarHijos(){
  const { data, error } = await sb.from("profiles").select("*").eq("tutor_id", state.profile.id).order("nombre");
  state.hijos = error ? [] : (data || []);
  return state.hijos;
}
async function renderFamilia(){
  if(!document.getElementById("familiaCard")) return;
  const hijos = await cargarHijos();
  const box = document.getElementById("familiaCard");
  if(!box) return;
  box.innerHTML = `
    ${hijos.length ? `<ul class="familia-list">${hijos.map(h => {
      const edad = calcEdad(h.fecha_nacimiento);
      const sub = [h.categoria ? CATEGORIAS[h.categoria].nombre : null, edad !== null ? `${edad} años` : null].filter(Boolean).join(" · ");
      return `
      <li class="familia-item">
        <span class="avatar" aria-hidden="true">${esc(initials(h.nombre || ""))}</span>
        <span class="familia-info"><strong>${esc(h.nombre || "")}</strong><span class="muted">${esc(sub)}</span></span>
        <button type="button" class="btn-outline" data-ver-hijo="${esc(h.id)}">Ver su panel</button>
      </li>`; }).join("")}</ul>`
      : `<p class="muted" style="margin-top:0">¿Vienes con tus hijos? Agrégalos aquí para reservar sus horarios, ver sus sesiones y su ficha desde tu cuenta. No necesitan correo ni contraseña.</p>`}
    <button type="button" class="${hijos.length ? "btn-link" : "btn-outline"} familia-add" id="btnAgregarHijo">+ Agregar hijo o hija</button>
    <div id="familiaMsg" aria-live="polite"></div>`;
  box.querySelectorAll("[data-ver-hijo]").forEach(b => { b.onclick = ()=> verPanelHijo(hijos.find(h => h.id === b.dataset.verHijo)); });
  document.getElementById("btnAgregarHijo").onclick = abrirAgregarHijo;
}
async function verPanelHijo(hijo){
  if(!hijo) return;
  history.replaceState(null, "", "#/inicio");
  window.scrollTo(0, 0);
  await renderAthleteDetail(hijo, false, document.getElementById("athleteMain"));
}
async function volverAMiPanel(){
  history.replaceState(null, "", "#/inicio");
  window.scrollTo(0, 0);
  await renderAthleteDetail(state.profile, false, document.getElementById("athleteMain"));
}
function abrirAgregarHijo(){
  const d = openDialog("Agregar hijo o hija", `
    <form id="hijoForm" novalidate>
      <div class="form-grid">
        <div class="full">${categoriaPickerHTML("h_", null).replace("¿A qué vienes a Gymnika?", "¿A qué viene a Gymnika?")}</div>
        <div class="full"><label for="h_nombre">Nombre completo<span class="req" aria-hidden="true">*</span></label><input id="h_nombre" autocomplete="off" required></div>
        <div><label for="h_fnac">Fecha de nacimiento<span class="req" aria-hidden="true">*</span></label><input type="date" id="h_fnac" max="${todayStr()}" required></div>
        <div><label for="h_sexo">Sexo <span class="muted">(opcional)</span></label><select id="h_sexo"><option value="">—</option><option value="F">Femenino</option><option value="M">Masculino</option></select></div>
        <div class="full"><label for="h_les">Lesión o molestia <span class="muted">(obligatorio si viene a terapia o en transición)</span></label><input id="h_les" autocomplete="off"></div>
      </div>
      <p class="muted">Su ficha queda a tu cargo: tú reservas sus horarios, pagas sus sesiones y recibes sus avisos. No necesita correo ni contraseña.</p>
      <button type="submit" class="btn-primary" id="btnGuardarHijo">Agregar</button>
      <div id="hijoMsg" aria-live="polite"></div>
    </form>`);
  const form = d.el.querySelector("#hijoForm");
  form.onsubmit = (e)=>{
    e.preventDefault();
    const btn = d.el.querySelector("#btnGuardarHijo");
    withBusy(btn, "Guardando…", async ()=>{
      const msg = d.el.querySelector("#hijoMsg");
      const cat = categoriaElegida("h_");
      const nombre = d.el.querySelector("#h_nombre").value.trim();
      const fnac = d.el.querySelector("#h_fnac").value;
      const les = d.el.querySelector("#h_les").value.trim();
      if(!cat){ showMsg(msg, "error", "Elige si viene a terapia, a fortalecimiento o en transición."); return; }
      if(!nombre){ showMsg(msg, "error", "Escribe su nombre completo."); return; }
      if(!fnac){ showMsg(msg, "error", "Escribe su fecha de nacimiento."); return; }
      if(pideLesion(cat) && !les){ showMsg(msg, "error", "Cuéntanos su lesión o molestia para preparar la terapia."); return; }
      const { error } = await sb.rpc("agregar_hijo", { p_nombre: nombre, p_fecha_nacimiento: fnac, p_categoria: cat, p_lesiones: les || null, p_sexo: d.el.querySelector("#h_sexo").value || null });
      if(error){ showError(msg, error); return; }
      d.close();
      await renderFamilia();
      showMsg(document.getElementById("familiaMsg"), "ok", `Listo: ${primerNombre(nombre)} ya está en tu familia. Toca «Ver su panel» para reservar sus horarios.`);
    });
  };
}

/* ---- Resumen "Tu proceso": se calcula con los datos que ya existen ---- */
function statTile(label, valueHTML, subHTML){
  return `<div class="stat"><p class="stat-label" title="${esc(label)}">${esc(label)}</p><p class="stat-value">${valueHTML}</p><p class="stat-sub">${subHTML}</p></div>`;
}
function renderResumen(){
  const box = document.getElementById("resumenCard");
  if(!box || !state.detail) return;
  const { medidas, fuerza, eventos } = state.detail;
  const tiles = [];

  const serie = (key)=> medidas.filter(m => m[key] !== null && m[key] !== undefined && m[key] !== "").sort((a,b)=> String(a.fecha).localeCompare(String(b.fecha)));
  [["peso","Peso","kg"],["grasa_pct","% Grasa","%"]].forEach(([key,label,u])=>{
    const s = serie(key);
    if(!s.length){ tiles.push(statTile(label, "—", "Sin registros todavía")); return; }
    const first = s[0], last = s[s.length-1];
    const sub = s.length > 1
      ? `<strong>${esc(fmtDelta(Number(last[key]) - Number(first[key]), u === "%" ? "pts" : u))}</strong> desde el ${fmtFecha(first.fecha, false)}`
      : `Registrado el ${fmtFecha(last.fecha, false)}`;
    tiles.push(statTile(label, `${fmtNum(last[key])}<small>${u}</small>`, sub));
  });

  const imc = calcIMC(state.detail.profile, medidas);
  tiles.push(imc
    ? statTile("IMC", `${fmtNum(imc.valor)}`, `<strong>${imc.cat}</strong> · con tu peso del ${fmtFecha(imc.fecha, false)}`)
    : statTile("IMC", "—", "Necesita tu altura y un registro de peso"));
  if(state.detail.profile && state.detail.profile.categoria === "terapia"){ box.innerHTML = tiles.join(""); return; }

  const movs = {};
  fuerza.forEach(f=>{ (movs[f.movimiento] = movs[f.movimiento] || []).push(f); });
  const progresos = Object.entries(movs).map(([mov, regs])=>{
    regs.sort((a,b)=> a.semana - b.semana);
    const a = regs[0], b = regs[regs.length-1];
    return { mov, a, b, delta: Number(b.peso) - Number(a.peso), n: regs.length };
  }).sort((x,y)=> (y.n > 1) - (x.n > 1) || y.delta - x.delta);
  if(progresos.length){
    const p = progresos[0];
    const sub = p.n > 1
      ? `<strong>${esc(fmtDelta(p.delta, "kg"))}</strong> · Sem. ${esc(p.a.semana)} → ${esc(p.b.semana)}`
      : `Semana ${esc(p.b.semana)} · ${p.b.es_test_real ? "test real" : "estimado"}`;
    tiles.push(statTile(p.mov, `${fmtNum(p.b.peso)}<small>kg</small>`, sub));
  } else {
    tiles.push(statTile("Fuerza", "—", "Tu coach carga tus marcas cada semana"));
  }

  const hoy = todayStr();
  const prox = eventos.filter(e => e.tipo === "competencia" && e.fecha >= hoy).sort((a,b)=> a.fecha.localeCompare(b.fecha))[0];
  if(prox){
    const dias = Math.round((parseFecha(prox.fecha) - parseFecha(hoy)) / 86400000);
    const sem = semanaDeFecha(prox.fecha);
    const val = dias === 0 ? "Hoy" : dias === 1 ? "Mañana" : `${dias}<small>días</small>`;
    tiles.push(statTile("Próxima competencia", val, `<strong>${esc(prox.titulo)}</strong> · ${fmtFecha(prox.fecha, false)}${sem ? " · Sem. " + sem.semana : ""}`));
  } else {
    tiles.push(statTile("Próxima competencia", "—", "Agrégala en la agenda"));
  }
  box.innerHTML = tiles.join("");
}

/* ---- Datos personales ---- */
function fichaFieldsInnerHTML(profile, required, prefix){
  const req = required ? 'required aria-required="true"' : "";
  const reqMark = required ? '<span class="req" aria-hidden="true">*</span>' : "";
  const v = (x)=> esc(x ?? "");
  const f = (id, label, input, full)=> `<div${full ? ' class="full"' : ""}><label for="${prefix}${id}">${label}${reqMark}</label>${input}</div>`;
  return `
    ${prefix==="su_" ? "" : f("nombre", "Nombre completo", `<input ${req} id="${prefix}nombre" autocomplete="name" value="${v(profile.nombre)}">`, true)}
    ${f("fnac", "Fecha de nacimiento", `<input ${req} type="date" id="${prefix}fnac" value="${v(profile.fecha_nacimiento)}">`)}
    ${f("sexo", "Sexo", `<select ${req} id="${prefix}sexo">
        <option value="">—</option>
        <option value="F" ${profile.sexo==="F"?"selected":""}>Femenino</option>
        <option value="M" ${profile.sexo==="M"?"selected":""}>Masculino</option>
      </select>`)}
    ${f("tel", "Teléfono", `<input ${req} type="tel" inputmode="tel" autocomplete="tel" id="${prefix}tel" value="${v(profile.telefono)}">`)}
    ${f("altura", "Altura (cm)", `<input ${req} type="number" inputmode="numeric" id="${prefix}altura" value="${v(profile.altura_cm)}">`)}
    ${f("emer", "Contacto de emergencia", `<input ${req} id="${prefix}emer" value="${v(profile.contacto_emergencia)}" placeholder="Nombre y teléfono">`, true)}
    ${f("deporte", "Deporte / actividad", `<input ${req} id="${prefix}deporte" value="${v(profile.deporte)}">`)}
    ${f("nivel", "Nivel de experiencia", `<select ${req} id="${prefix}nivel">
        <option value="">—</option>
        <option value="Principiante" ${profile.nivel_experiencia==="Principiante"?"selected":""}>Principiante</option>
        <option value="Intermedio" ${profile.nivel_experiencia==="Intermedio"?"selected":""}>Intermedio</option>
        <option value="Avanzado" ${profile.nivel_experiencia==="Avanzado"?"selected":""}>Avanzado</option>
      </select>`)}
    ${f("disp", "Disponibilidad semanal", `<input ${req} id="${prefix}disp" value="${v(profile.disponibilidad)}" placeholder="Ej: Lun a Vie">`, true)}
    ${f("obj", "Objetivo principal", `<input ${req} id="${prefix}obj" value="${v(profile.objetivo)}">`, true)}
    ${f("plazo", "Plazo del objetivo", `<input ${req} id="${prefix}plazo" value="${v(profile.plazo_objetivo)}" placeholder="Ej: 20 semanas">`)}
    <div><label for="${prefix}les">Lesiones o limitaciones</label><input id="${prefix}les" value="${v(profile.lesiones)}" placeholder="Escribe 'Ninguna' si no aplica"></div>
    <div class="full">
      <label class="checkline" for="${prefix}auth">
        <input type="checkbox" id="${prefix}auth" ${profile.autorizacion_medica?"checked":""}>
        <span>Autorización médica para entrenamiento intenso</span>
      </label>
    </div>
  `;
}
/* Registro y "un último paso": solo fecha de nacimiento (para la edad), teléfono y lesión (obligatoria en terapia) */
function registroCamposHTML(profile, prefix){
  const v = (x)=> esc(x ?? "");
  const req = '<span class="req" aria-hidden="true">*</span>';
  return `
    <div><label for="${prefix}fnac">Fecha de nacimiento${req}</label><input type="date" id="${prefix}fnac" required value="${v(profile.fecha_nacimiento)}" max="${todayStr()}"></div>
    <div><label for="${prefix}tel">Teléfono (WhatsApp)${req}</label><input type="tel" inputmode="tel" autocomplete="tel" id="${prefix}tel" required value="${v(profile.telefono)}" placeholder="Ej: 987 654 321"></div>
    <div class="full"><label for="${prefix}les">Lesión o molestia <span class="muted">(obligatorio si vienes a terapia o en transición)</span></label>
      <input id="${prefix}les" value="${v(profile.lesiones)}" placeholder="Ej: dolor de rodilla derecha al correr"></div>`;
}
function registroDatos(prefix, categoria){
  const val = (id)=> (document.getElementById(prefix + id).value || "").trim();
  const payload = { fecha_nacimiento: val("fnac") || null, telefono: val("tel") || null, lesiones: val("les") || null };
  let falta = null;
  if(!payload.fecha_nacimiento) falta = "Escribe tu fecha de nacimiento.";
  else if(payload.fecha_nacimiento > todayStr()) falta = "Revisa tu fecha de nacimiento.";
  else if(!payload.telefono || payload.telefono.replace(/\D/g, "").length < 6) falta = "Escribe tu número de teléfono.";
  else if(pideLesion(categoria) && !payload.lesiones) falta = "Cuéntanos tu lesión o molestia para preparar tu terapia.";
  return { payload, falta };
}
function fichaFieldsHTML(profile, required, prefix){
  return `<div class="form-grid">${fichaFieldsInnerHTML(profile, required, prefix)}</div>
    <button type="button" class="btn-primary" id="btnSaveFicha${required?"Gate":""}">${required?"Guardar y continuar":"Guardar ficha"}</button>
    <div id="${required?"gateMsg":"fichaMsg"}" aria-live="polite"></div>
  `;
}
function collectFichaFields(prefix, required){
  const payload = {
    fecha_nacimiento: document.getElementById(prefix+"fnac").value || null,
    sexo: document.getElementById(prefix+"sexo").value || null,
    telefono: document.getElementById(prefix+"tel").value || null,
    altura_cm: document.getElementById(prefix+"altura").value || null,
    contacto_emergencia: document.getElementById(prefix+"emer").value || null,
    deporte: document.getElementById(prefix+"deporte").value || null,
    nivel_experiencia: document.getElementById(prefix+"nivel").value || null,
    disponibilidad: document.getElementById(prefix+"disp").value || null,
    objetivo: document.getElementById(prefix+"obj").value || null,
    plazo_objetivo: document.getElementById(prefix+"plazo").value || null,
    lesiones: document.getElementById(prefix+"les").value || null,
    autorizacion_medica: document.getElementById(prefix+"auth").checked
  };
  const nombreEl = document.getElementById(prefix+"nombre");
  if(nombreEl) payload.nombre = nombreEl.value.trim();
  let missing = false;
  if(required){
    missing = FICHA_REQUIRED.some(k => payload[k] === null || payload[k] === undefined || String(payload[k]).trim() === "");
  }
  return { payload, missing };
}
function renderFichaForm(profile, uid, isCoach){
  const box = document.getElementById("fichaCard");
  box.innerHTML = fichaFieldsHTML(profile, false, "f_");
  const btn = document.getElementById("btnSaveFicha");
  btn.onclick = ()=> withBusy(btn, "Guardando…", async ()=>{
    const { payload } = collectFichaFields("f_", false);
    const msg = document.getElementById("fichaMsg");
    const { error } = await sb.from("profiles").update(payload).eq("id", uid);
    if(error){ showError(msg, error); return; }
    showMsg(msg, "ok", "Ficha guardada.");
    Object.assign(profile, payload);
    if(isCoach){
      const idx = state.athleteList.findIndex(a=>a.id===uid);
      if(idx > -1){ state.athleteList[idx] = { ...state.athleteList[idx], ...payload }; renderAthleteListInto(filterAthletes(state.search)); }
    } else {
      state.profile = { ...state.profile, ...payload };
    }
  });
}

function renderNotasCoach(profile, uid, isCoach){
  const box = document.getElementById("notasCard");
  if(isCoach){
    const interna = (state.detail && state.detail.interna) || {};
    box.innerHTML = `
      <label for="n_consejos" style="margin-top:0">Consejos para el atleta <span class="muted">(el atleta sí los ve)</span></label>
      <textarea id="n_consejos" rows="3">${esc(profile.consejos_coach || "")}</textarea>
      ${autoriaHTML(profile.consejos_por, profile.consejos_at, uid)}
      <label for="n_comentarios">Comentarios internos <span class="muted">(solo el equipo)</span></label>
      <textarea id="n_comentarios" rows="3">${esc(interna.comentarios || "")}</textarea>
      ${autoriaHTML(interna.editado_por, interna.editado_at, uid)}
      <button type="button" class="btn-primary" id="btnSaveNotas">Guardar notas</button>
      <div id="notasMsg" aria-live="polite"></div>
    `;
    const btn = document.getElementById("btnSaveNotas");
    btn.onclick = ()=> withBusy(btn, "Guardando…", async ()=>{
      const consejos = document.getElementById("n_consejos").value || null;
      const comentarios = document.getElementById("n_comentarios").value || null;
      const msg = document.getElementById("notasMsg");
      if(consejos !== (profile.consejos_coach || null)){
        const { error } = await sb.from("profiles").update({ consejos_coach: consejos }).eq("id", uid);
        if(error){ showError(msg, error); return; }
        Object.assign(profile, { consejos_coach: consejos, consejos_por: state.profile.id, consejos_at: new Date().toISOString() });
      }
      if(comentarios !== (interna.comentarios || null)){
        const { data, error } = await sb.from("ficha_interna").upsert({ user_id: uid, comentarios }).select().maybeSingle();
        if(error){ showError(msg, error); return; }
        if(state.detail) state.detail.interna = data || { ...interna, comentarios, editado_por: state.profile.id, editado_at: new Date().toISOString() };
      }
      renderNotasCoach(profile, uid, isCoach);
      showMsg(document.getElementById("notasMsg"), "ok", "Notas guardadas.");
    });
  } else {
    box.innerHTML = profile.consejos_coach
      ? `<p class="coach-quote">${esc(profile.consejos_coach)}</p>`
      : `<p class="muted">Tu coach todavía no dejó consejos aquí. Cuando lo haga, los verás en esta tarjeta.</p>`;
  }
}

/* ---- Medidas ---- */
/* En terapia no se registran peso, % de grasa ni IMC: solo perímetros */
function camposMedida(){
  const p = state.detail && state.detail.profile;
  return p && p.categoria === "terapia" ? MEDIDA_FIELDS.filter(([k]) => k !== "peso" && k !== "grasa_pct") : MEDIDA_FIELDS;
}
function renderMedidas(medidas, uid, isCoach){
  const box = document.getElementById("medidasCard");
  const CAMPOS = camposMedida();
  if(state.detail) state.detail.medidas = medidas;
  const orden = [...medidas].sort((a,b)=> String(b.fecha).localeCompare(String(a.fecha)));
  const tabla = `
    <div class="table-wrap medidas-table">
      <table>
        <thead><tr><th class="sticky-col" scope="col">Fecha</th>${CAMPOS.map(([,label])=>`<th scope="col">${esc(label)}</th>`).join("")}${isCoach ? `<th scope="col"><span class="sr-only">Acciones</span></th>` : ""}</tr></thead>
        <tbody>
          ${orden.map(m => `
            <tr>
              <th scope="row" class="sticky-col" style="font-size:14.5px;letter-spacing:0;color:var(--ink);background:var(--surface)">${fmtFecha(m.fecha)}${isCoach ? autoriaHTML(m.editado_por, null, uid) : ""}</th>
              ${CAMPOS.map(([key])=>`<td>${fmt(m[key])}</td>`).join("")}
              ${isCoach ? `<td class="actions"><button type="button" class="btn-danger icon" data-delm="${esc(m.id)}" aria-label="Borrar medidas del ${fmtFecha(m.fecha)}">✕</button></td>` : ""}
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
  const tarjetas = `
    <ol class="medidas-cards">
      ${orden.map(m => `
        <li class="medida-card">
          <header>
            <h3>${fmtFecha(m.fecha)}${isCoach ? autoriaHTML(m.editado_por, null, uid) : ""}</h3>
            ${isCoach ? `<button type="button" class="btn-danger icon" data-delm="${esc(m.id)}" aria-label="Borrar medidas del ${fmtFecha(m.fecha)}">✕</button>` : ""}
          </header>
          <dl>${CAMPOS.map(([key,label])=>`<div><dt>${esc(label)}</dt><dd>${fmt(m[key])}</dd></div>`).join("")}</dl>
        </li>`).join("")}
    </ol>`;
  box.innerHTML = `
    ${medidas.length ? tabla + tarjetas : emptyHTML("Aún no hay medidas. Agrega el primer registro para empezar a ver tu evolución.")}
    <button type="button" class="btn-outline btn-block" id="btnAddMedida" style="margin-top:14px" aria-expanded="false" aria-controls="medidaForm">+ Agregar medidas</button>
    <div id="medidaForm"></div>
    <div id="medidaListMsg" aria-live="polite"></div>
  `;
  const addBtn = document.getElementById("btnAddMedida");
  addBtn.onclick = ()=>{
    addBtn.setAttribute("aria-expanded", "true");
    document.getElementById("medidaForm").innerHTML = `
      <div class="form-grid" style="margin-top:4px">
        <div class="full"><label for="m_fecha">Fecha</label><input type="date" id="m_fecha" value="${todayStr()}"></div>
        ${CAMPOS.map(([key,label])=>`<div><label for="m_${key}">${esc(label)}</label><input type="number" inputmode="decimal" step="0.1" id="m_${key}"></div>`).join("")}
      </div>
      <button type="button" class="btn-primary" id="btnSaveMedida">Guardar medidas</button>
      <div id="medidaMsg" aria-live="polite"></div>
    `;
    document.getElementById("m_fecha").focus();
    const saveBtn = document.getElementById("btnSaveMedida");
    saveBtn.onclick = ()=> withBusy(saveBtn, "Guardando…", async ()=>{
      const payload = { user_id: uid, fecha: document.getElementById("m_fecha").value };
      CAMPOS.forEach(([key])=>{ const v = document.getElementById("m_"+key).value; payload[key] = v===""?null:parseFloat(v); });
      const msg = document.getElementById("medidaMsg");
      if(!payload.fecha){ showMsg(msg, "error", "Selecciona una fecha."); return; }
      if(CAMPOS.every(([key])=> payload[key] === null)){ showMsg(msg, "error", "Completa al menos una medida."); return; }
      const { error } = await sb.from("medidas").insert(payload);
      if(error){ showError(msg, error); return; }
      await reloadMedidas(uid, isCoach);
    });
  };
  box.querySelectorAll("[data-delm]").forEach(btn=>{
    btn.onclick = ()=> withBusy(btn, "…", async ()=>{
      const { error } = await sb.from("medidas").delete().eq("id", btn.dataset.delm);
      if(error){ showError(document.getElementById("medidaListMsg"), error); return; }
      await reloadMedidas(uid, isCoach);
    });
  });
  renderPesoGrasaChart(medidas);
  renderResumen();
}
async function reloadMedidas(uid, isCoach){
  const { data, error } = await sb.from("medidas").select("*").eq("user_id",uid).order("fecha");
  if(error){ showError(document.getElementById("medidaListMsg"), error); return; }
  renderMedidas(data || [], uid, isCoach);
}

/* ---- Gráficos: colores de la marca leídos de las variables CSS ---- */
const CHART_COLORS = ["#0E7C86","#8B5A2B","#B7841A","#3F5E7A","#B5523B","#5E7F5A","#6E4A6B","#35292F"];
const OLD_PALETTE = ["#2a78d6","#eb6834","#1baf7a","#eda100","#6250d6","#e87ba4","#2fa8a0","#c0392b"];
function serieColor(stored, i){
  return (!stored || OLD_PALETTE.includes(String(stored).toLowerCase())) ? CHART_COLORS[i % CHART_COLORS.length] : stored;
}
function lineDataset(label, data, color, extra = {}){
  return { label, data, borderColor: color, backgroundColor: color, borderWidth: 2.5, spanGaps: true, pointRadius: 3.5, pointHoverRadius: 6, tension: 0.25, ...extra };
}
function setupChartDefaults(){
  const css = getComputedStyle(document.documentElement);
  const read = (v, fb)=> (css.getPropertyValue(v).trim() || fb);
  CHART_COLORS.forEach((fb, i)=>{ CHART_COLORS[i] = read("--c" + (i+1), fb); });
  if(!window.Chart) return;
  Chart.defaults.font.family = "'Atkinson Hyperlegible Next', system-ui, sans-serif";
  Chart.defaults.font.size = 13;
  Chart.defaults.color = read("--ink-soft", "#5B5155");
  Chart.defaults.borderColor = "rgba(53,41,47,.1)";
  Chart.defaults.plugins.tooltip.backgroundColor = read("--ink", "#35292F");
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.titleFont = { weight: "700" };
}

let pesoGrasaChartInstance = null;
function renderPesoGrasaChart(medidas){
  const canvas = document.getElementById("pesoGrasaChart");
  if(!canvas) return;
  if(pesoGrasaChartInstance){ pesoGrasaChartInstance.destroy(); pesoGrasaChartInstance = null; }
  const prevEmpty0 = document.getElementById("pesoGrasaEmpty");
  if(prevEmpty0) prevEmpty0.remove();
  const datos = medidas.filter(m => m.peso !== null || m.grasa_pct !== null);
  if(!datos.length || !window.Chart){
    canvas.parentElement.style.display = "none";
    canvas.parentElement.insertAdjacentHTML("afterend", `<div id="pesoGrasaEmpty">${emptyHTML(window.Chart ? "Sin registros de peso o % de grasa todavía." : "No se pudo cargar el gráfico. Revisa tu conexión.")}</div>`);
    return;
  }
  canvas.parentElement.style.display = "block";
  const labels = datos.map(m=>fmtFecha(m.fecha, false));
  pesoGrasaChartInstance = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        lineDataset("Peso (kg)", datos.map(m=>m.peso), CHART_COLORS[0], { yAxisID:"yPeso" }),
        lineDataset("% Grasa", datos.map(m=>m.grasa_pct), CHART_COLORS[1], { yAxisID:"yGrasa", borderDash:[6,4] })
      ]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      interaction:{ mode:"index", intersect:false },
      plugins:{ legend:{ display:true, position:"bottom", labels:{ boxWidth:12, boxHeight:3, usePointStyle:false } } },
      scales:{
        yPeso:{ position:"left", title:{display:true,text:"kg"}, grace:"5%" },
        yGrasa:{ position:"right", title:{display:true,text:"% grasa"}, grid:{drawOnChartArea:false}, grace:"5%" },
        x:{ grid:{display:false} }
      }
    }
  });
}

/* ---- Fuerza ---- */
let chartInstance = null;
const PALETTE = CHART_COLORS; // colores para ejercicios nuevos

function renderFuerza(fuerza, ejercicios, uid, isCoach){
  const box = document.getElementById("fuerzaCard");
  if(state.detail) state.detail.fuerza = fuerza;
  const colorMap = {};
  ejercicios.forEach((e,i) => colorMap[e.nombre] = serieColor(e.color, i));

  const semanasPresentes = [...new Set(fuerza.map(f=>f.semana))].sort((a,b)=>a-b);
  const rows = semanasPresentes.flatMap(sem =>
    fuerza.filter(f=>f.semana===sem).map(f => `
      <tr>
        <td>Sem. ${esc(f.semana)}</td><td style="text-align:left">${esc(f.movimiento)}</td><td>${fmt(f.peso)} kg</td><td>${f.es_test_real?"Real":"Estimado"}</td>
        ${isCoach ? `<td class="actions"><button type="button" class="btn-danger icon" data-delf="${esc(f.id)}" aria-label="Borrar ${esc(f.movimiento)} de la semana ${esc(f.semana)}">✕</button></td>` : ""}
      </tr>
    `)
  ).join("");

  const semanaDefault = (()=>{
    const diffDias = Math.floor((new Date() - MACRO_START) / 86400000);
    if(diffDias < 0) return 1;
    return ((Math.floor(diffDias/7)) % 20) + 1;
  })();

  box.innerHTML = `
    <div id="legendBox" class="legend"></div>
    <div class="chart-box"><canvas id="fuerzaChart" role="img" aria-label="Gráfico de progresión de fuerza por semana"></canvas></div>
    ${fuerza.length ? `
    <details class="records">
      <summary>Ver registros (${fuerza.length})</summary>
      <div class="table-wrap">
        <table>
          <thead><tr><th scope="col">Semana</th><th scope="col" style="text-align:left">Movimiento</th><th scope="col">Peso</th><th scope="col">Tipo</th>${isCoach ? `<th scope="col"><span class="sr-only">Acciones</span></th>` : ""}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </details>` : emptyHTML(isCoach ? "Sin marcas todavía. Carga los pesos de la semana para empezar el gráfico." : "Sin marcas todavía. Tu coach las irá cargando cada semana.")}
    <div id="fuerzaListMsg" aria-live="polite"></div>
    ${isCoach ? `
      <button type="button" class="btn-outline btn-block" id="btnAddFuerza" style="margin-top:14px">+ Cargar pesos de la semana</button>
      <div id="fuerzaForm"></div>
      <details class="records">
        <summary>Gestionar ejercicios (${ejercicios.length})</summary>
        <div id="gestionEjercicios" style="margin-top:6px"></div>
      </details>
    ` : ""}
  `;
  drawFuerzaChart(fuerza, colorMap);
  renderResumen();

  if(!isCoach) return;

  const reload = async ()=>{
    const [{ data: f2, error: e1 }, { data: e2, error: e2err }] = await Promise.all([
      sb.from("fuerza").select("*").eq("user_id",uid).order("semana"),
      sb.from("ejercicios_fuerza").select("*").eq("user_id",uid).order("created_at")
    ]);
    if(e1 || e2err){ showError(document.getElementById("fuerzaListMsg"), e1 || e2err); return; }
    renderFuerza(f2||[], e2||[], uid, isCoach);
  };

  document.getElementById("btnAddFuerza").onclick = ()=>{
    if(ejercicios.length === 0){
      document.getElementById("fuerzaForm").innerHTML = `<p class="error" role="alert">Primero agrega al menos un ejercicio en "Gestionar ejercicios".</p>`;
      return;
    }
    document.getElementById("fuerzaForm").innerHTML = `
      <label for="fu_semana">Semana del macrociclo</label>
      <select id="fu_semana">
        ${Array.from({length:20},(_,i)=>i+1).map(n=>`<option value="${n}" ${n===semanaDefault?"selected":""}>Semana ${n}</option>`).join("")}
      </select>
      <p class="muted" style="margin:8px 0 0">Completa el peso de cada ejercicio. Deja en blanco los que no apliquen esta semana.</p>
      <div class="form-grid">
        ${ejercicios.map((e,i)=>`
          <div>
            <label for="fu_val_${esc(e.id)}" style="display:flex;align-items:center;gap:8px">
              <span class="dot" style="background:${esc(serieColor(e.color, i))}"></span>${esc(e.nombre)}
            </label>
            <input type="number" inputmode="decimal" step="0.5" id="fu_val_${esc(e.id)}" placeholder="kg">
          </div>
        `).join("")}
      </div>
      <label class="checkline" for="fu_real">
        <input type="checkbox" id="fu_real" checked> <span>Son tests reales (no estimados)</span>
      </label>
      <button type="button" class="btn-primary" id="btnSaveFuerza">Guardar semana</button>
      <div id="fuerzaMsg" aria-live="polite"></div>
    `;
    const saveBtn = document.getElementById("btnSaveFuerza");
    saveBtn.onclick = ()=> withBusy(saveBtn, "Guardando…", async ()=>{
      const semana = parseInt(document.getElementById("fu_semana").value, 10);
      const esReal = document.getElementById("fu_real").checked;
      const msg = document.getElementById("fuerzaMsg");
      const filas = ejercicios
        .map(e => ({ e, v: document.getElementById("fu_val_"+e.id).value }))
        .filter(({v}) => v !== "" && !isNaN(parseFloat(v)));
      if(filas.length === 0){ showMsg(msg, "error", "Completa el peso de al menos un ejercicio."); return; }
      /* Primero se insertan los nuevos registros y solo si eso funciona se borran los anteriores de esa semana.
         Así, si la inserción falla, no se pierde la semana ya guardada. */
      const { data: previos, error: prevErr } = await sb.from("fuerza").select("id").eq("user_id", uid).eq("semana", semana);
      if(prevErr){ showError(msg, prevErr); return; }
      const payload = filas.map(({e,v}) => ({
        user_id: uid, semana, movimiento: e.nombre, peso: parseFloat(v), es_test_real: esReal
      }));
      const { error } = await sb.from("fuerza").insert(payload);
      if(error){ showError(msg, error); return; }
      const idsPrevios = (previos || []).map(r=>r.id);
      if(idsPrevios.length){
        const { error: delErr } = await sb.from("fuerza").delete().in("id", idsPrevios);
        if(delErr) console.error(delErr);
      }
      await reload();
    });
  };
  box.querySelectorAll("[data-delf]").forEach(btn=>{
    btn.onclick = ()=> withBusy(btn, "…", async ()=>{
      const { error } = await sb.from("fuerza").delete().eq("id", btn.dataset.delf);
      if(error){ showError(document.getElementById("fuerzaListMsg"), error); return; }
      await reload();
    });
  });

  const gestionBox = document.getElementById("gestionEjercicios");
  gestionBox.innerHTML = `
    ${ejercicios.length ? `<ul style="list-style:none;margin:0;padding:0">${ejercicios.map((e,i) => `
      <li style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--line)">
        <span class="dot" style="background:${esc(serieColor(e.color, i))}"></span>
        <span style="flex:1">${esc(e.nombre)}</span>
        <button type="button" class="btn-danger" data-delej="${esc(e.id)}">Borrar</button>
      </li>
    `).join("")}</ul>` : ""}
    <label for="nuevoEjercicio">Nuevo ejercicio</label>
    <div class="inline-add">
      <input id="nuevoEjercicio" placeholder="Ej: Peso muerto sumo">
      <button type="button" class="btn-outline" id="btnAddEjercicio">+ Agregar</button>
    </div>
    <div id="ejercicioMsg" aria-live="polite"></div>
  `;
  gestionBox.querySelectorAll("[data-delej]").forEach(btn=>{
    btn.onclick = ()=>{
      if(!confirm("¿Borrar este ejercicio de la lista? Las marcas ya registradas se conservan.")) return;
      withBusy(btn, "…", async ()=>{
        const { error } = await sb.from("ejercicios_fuerza").delete().eq("id", btn.dataset.delej);
        if(error){ showError(document.getElementById("ejercicioMsg"), error); return; }
        await reload();
      });
    };
  });
  const addEjBtn = document.getElementById("btnAddEjercicio");
  addEjBtn.onclick = ()=> withBusy(addEjBtn, "…", async ()=>{
    const nombre = document.getElementById("nuevoEjercicio").value.trim();
    const msg = document.getElementById("ejercicioMsg");
    if(!nombre){ showMsg(msg, "error", "Escribe un nombre."); return; }
    const color = PALETTE[ejercicios.length % PALETTE.length];
    const { error } = await sb.from("ejercicios_fuerza").insert({ user_id: uid, nombre, color });
    if(error){ showError(msg, error); return; }
    await reload();
    const det = document.querySelector("#fuerzaCard details.records:last-of-type");
    if(det) det.open = true;
  });
}

function drawFuerzaChart(fuerza, colorMap){
  const legendBox = document.getElementById("legendBox");
  const canvas = document.getElementById("fuerzaChart");
  if(chartInstance){ chartInstance.destroy(); chartInstance = null; }
  if(!fuerza.length || !window.Chart){
    legendBox.innerHTML = "";
    canvas.parentElement.style.display = "none";
    return;
  }
  canvas.parentElement.style.display = "block";
  const allSemanas = [...new Set(fuerza.map(f=>f.semana))].sort((a,b)=>a-b);
  const movsPresentes = [...new Set(fuerza.map(f=>f.movimiento))];
  const colorDe = (m, i)=> colorMap[m] || CHART_COLORS[i % CHART_COLORS.length];
  legendBox.innerHTML = movsPresentes.map((m,i)=>`
    <span><span class="dot" style="background:${esc(colorDe(m,i))}"></span>${esc(m)}</span>
  `).join("");
  const datasets = movsPresentes.map((mov,i)=>{
    const puntos = allSemanas.map(sem=>{
      const reg = fuerza.find(f=>f.semana===sem && f.movimiento===mov);
      return reg ? reg.peso : null;
    });
    return lineDataset(mov, puntos, colorDe(mov, i));
  });
  chartInstance = new Chart(canvas, {
    type: "line",
    data: { labels: allSemanas.map(s=>"Sem. "+s), datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction:{ mode:"index", intersect:false },
      plugins: { legend: { display:false }, tooltip: { callbacks: { label: (c)=> c.dataset.label+": "+c.parsed.y+" kg" } } },
      scales: { y: { title:{display:true,text:"kg"}, grace:"5%" }, x: { grid:{display:false} } }
    }
  });
}

/* ---- Plan nutricional (3 opciones: perder peso, ganar peso, personalizado) ---- */
const PLAN_PERDER_PESO = `Plan Nutricional General para Pérdida de Grasa

Objetivo
Generar un déficit calórico moderado que permita perder grasa de forma progresiva mientras se intenta mantener la masa muscular y el rendimiento.

Parámetros generales
- Déficit aproximado: 10–20% menos calorías que el gasto diario.
- Ritmo esperado de pérdida: 0,25–0,75 kg por semana.
- Priorizar alimentos frescos y mínimamente procesados.
- Mantener una buena hidratación y un consumo adecuado de fibra.

Distribución de macronutrientes
Proteínas: 1,6–2,2 g por kg de peso corporal al día. Función: ayudar a preservar la masa muscular y aumentar la saciedad.
Carbohidratos: 2–5 g por kg de peso corporal al día, dependiendo del nivel de actividad física. Función: aportar energía para entrenamientos y actividades diarias.
Grasas: 0,8–1,0 g por kg de peso corporal al día. Función: producción hormonal, salud celular y absorción de vitaminas.

Calidad de alimentos recomendada
- Proteínas: pollo, pescado, huevos, carnes magras, lácteos, legumbres.
- Carbohidratos: arroz, avena, papa, camote, frutas, quinua.
- Grasas saludables: palta, frutos secos, aceite de oliva, semillas.

Ejemplo general de un día
Desayuno: huevos, avena y fruta.
Almuerzo: pollo con arroz y ensalada.
Merienda: yogurt con fruta.
Cena: pescado con verduras y papa.

Principio más importante
Más allá del plan específico, los resultados dependen principalmente de tres factores: consistencia (mantener la estrategia durante semanas y meses), cantidad adecuada de calorías (déficit para perder grasa), y proteína suficiente junto con entrenamiento de fuerza para mejorar la composición corporal.`;

const PLAN_GANAR_PESO = `Plan Nutricional General para Ganancia de Peso y Masa Muscular

Objetivo
Mantener un superávit calórico controlado para favorecer el aumento de peso y, si se acompaña de entrenamiento de fuerza, la ganancia de masa muscular.

Parámetros generales
- Superávit aproximado: 10–20% más calorías que el gasto diario.
- Ritmo esperado de ganancia: 0,25–0,5 kg por semana.
- Aumentar progresivamente las porciones si el peso no cambia.

Distribución de macronutrientes
Proteínas: 1,6–2,2 g por kg de peso corporal al día. Función: favorecer la recuperación y construcción muscular.
Carbohidratos: 4–7 g por kg de peso corporal al día. Función: aportar energía y facilitar el aumento de peso.
Grasas: 0,8–1,2 g por kg de peso corporal al día. Función: aumentar la densidad calórica y apoyar la función hormonal.

Calidad de alimentos recomendada
- Proteínas: carnes, pollo, pescado, huevos, lácteos, legumbres.
- Carbohidratos: arroz, pasta, avena, papa, camote, frutas.
- Grasas saludables: frutos secos, palta, aceite de oliva, mantequilla de maní.

Ejemplo general de un día
Desayuno: huevos, avena con leche, fruta y frutos secos.
Almuerzo: carne o pollo con arroz, verduras y palta.
Merienda: yogurt con avena y fruta.
Cena: pescado o carne con papa o pasta y verduras.

Principio más importante
Más allá del plan específico, los resultados dependen principalmente de tres factores: consistencia (mantener la estrategia durante semanas y meses), cantidad adecuada de calorías (superávit para ganar peso), y proteína suficiente junto con entrenamiento de fuerza para mejorar la composición corporal.`;
function renderNutricion(profile, uid, isCoach, solicitudes){
  const box = document.getElementById("nutricionCard");
  if(isCoach){
    const tipoLabel = { perder_peso: "Perder peso (general)", ganar_peso: "Ganar peso (general)", personalizado: "Personalizado" };
    box.innerHTML = `
      <p class="muted" style="margin:0 0 4px">${profile.tipo_plan_nutricional
        ? `Opción elegida por el atleta: <strong style="color:var(--ink)">${esc(tipoLabel[profile.tipo_plan_nutricional] || profile.tipo_plan_nutricional)}</strong>`
        : "El atleta todavía no eligió ninguna opción."}</p>
      ${solicitudes.some(s=>!s.atendida) ? `<div class="error" role="status" style="margin-top:10px">Este atleta solicitó un plan nutricional personalizado.</div>` : ""}
      <label for="nu_plan">Plan personalizado <span class="muted">(se muestra si el atleta eligió "Personalizado")</span></label>
      <textarea id="nu_plan" rows="7" placeholder="Ej: 4-5 comidas al día, proteína en cada una, hidratación...">${esc(profile.plan_nutricional_basico || "")}</textarea>
      <button type="button" class="btn-primary" id="btnSaveNutricion">Guardar plan personalizado</button>
      <div id="nutricionMsg" aria-live="polite"></div>
    `;
    const btn = document.getElementById("btnSaveNutricion");
    btn.onclick = ()=> withBusy(btn, "Guardando…", async ()=>{
      const payload = { plan_nutricional_basico: document.getElementById("nu_plan").value || null };
      const { error } = await sb.from("profiles").update(payload).eq("id", uid);
      const msg = document.getElementById("nutricionMsg");
      if(error){ showError(msg, error); return; }
      Object.assign(profile, payload);
      showMsg(msg, "ok", "Plan guardado.");
    });
    return;
  }

  const pendiente = solicitudes.find(s=>!s.atendida);

  const pedirPersonalizado = async (msgEl)=>{
    const { error } = await sb.from("profiles").update({ tipo_plan_nutricional: "personalizado" }).eq("id", uid);
    if(error){ showError(msgEl, error); return; }
    profile.tipo_plan_nutricional = "personalizado";
    const { error: insErr } = await sb.from("solicitudes_nutricion").insert({ user_id: uid });
    if(insErr){ showError(msgEl, insErr); return; }
    const { data } = await sb.from("solicitudes_nutricion").select("*").eq("user_id",uid).order("fecha",{ascending:false});
    renderNutricion(profile, uid, isCoach, data||[]);
  };

  if(!profile.tipo_plan_nutricional){
    box.innerHTML = `
      <p style="margin:0 0 14px">Elige qué tipo de plan nutricional quieres ver:</p>
      <div class="plan-options">
        <button type="button" class="plan-option" data-elegir="perder_peso"><strong>Perder peso</strong><span>Parámetros generales para un déficit moderado</span></button>
        <button type="button" class="plan-option" data-elegir="ganar_peso"><strong>Ganar peso</strong><span>Parámetros generales para un superávit controlado</span></button>
        <button type="button" class="plan-option featured" data-elegir="personalizado"><strong>Plan personalizado</strong><span>Tu coach lo prepara según tus datos y objetivos</span></button>
      </div>
      <div id="nutricionMsg" aria-live="polite"></div>
    `;
    box.querySelectorAll("[data-elegir]").forEach(btn=>{
      btn.onclick = ()=> withBusy(btn, "Guardando…", async ()=>{
        const tipo = btn.dataset.elegir;
        const msg = document.getElementById("nutricionMsg");
        if(tipo === "personalizado"){ await pedirPersonalizado(msg); return; }
        const { error } = await sb.from("profiles").update({ tipo_plan_nutricional: tipo }).eq("id", uid);
        if(error){ showError(msg, error); return; }
        profile.tipo_plan_nutricional = tipo;
        renderNutricion(profile, uid, isCoach, solicitudes);
      });
    });
    return;
  }

  if(profile.tipo_plan_nutricional === "personalizado"){
    box.innerHTML = `
      ${profile.plan_nutricional_basico
        ? `<div class="plan-text prose">${esc(profile.plan_nutricional_basico)}</div>`
        : (pendiente
          ? `<div class="success" role="status" style="margin-top:0">Ya solicitaste tu plan nutricional personalizado. Tu coach lo verá pronto.</div>`
          : `<p class="muted">Tu coach todavía no cargó tu plan personalizado.</p>`)}
      <button type="button" class="btn-link" id="btnCambiarOpcion" style="margin-top:10px;padding-left:0">Elegir otra opción</button>
      <div id="nutricionMsg" aria-live="polite"></div>
    `;
  } else {
    const contenido = profile.tipo_plan_nutricional === "perder_peso" ? PLAN_PERDER_PESO : PLAN_GANAR_PESO;
    box.innerHTML = `
      <div class="plan-text prose">${esc(contenido)}</div>
      <p class="muted" style="line-height:1.5;margin:14px 0 0">Estos son parámetros generales, no un plan hecho a tu medida. Si quieres algo ajustado a ti, solicita el plan personalizado.</p>
      <button type="button" class="btn-primary" id="btnPedirPersonalizado">Solicitar plan personalizado</button>
      <button type="button" class="btn-link" id="btnCambiarOpcion" style="margin-top:8px;padding-left:0">Elegir otra opción</button>
      <div id="nutricionMsg" aria-live="polite"></div>
    `;
    const btnPers = document.getElementById("btnPedirPersonalizado");
    btnPers.onclick = ()=> withBusy(btnPers, "Enviando solicitud…", ()=> pedirPersonalizado(document.getElementById("nutricionMsg")));
  }
  const btnCambiar = document.getElementById("btnCambiarOpcion");
  btnCambiar.onclick = ()=> withBusy(btnCambiar, "…", async ()=>{
    const { error } = await sb.from("profiles").update({ tipo_plan_nutricional: null }).eq("id", uid);
    if(error){ showError(document.getElementById("nutricionMsg"), error); return; }
    profile.tipo_plan_nutricional = null;
    renderNutricion(profile, uid, isCoach, solicitudes);
  });
}

/* ---- Rutina de estiramiento diaria (todas las categorías): se hace en las mañanas.
   Este orden es el que ve el alumno. ---- */
const ESTIRAMIENTO_DIARIO_GRUPOS = [
  { grupo: "Cucarachas", items: ["Cucarachas piernas estiradas", "Cucarachas piernas dobladas", "Cucarachas con una pierna estirada y una doblada", "Cucarachas con brazos estirados sobre la cabeza y piernas estiradas", "Cucarachas en posición de caballero", "Cucarachas de costado posición fetal", "Cucarachas de costado piernas estiradas"] },
  { grupo: "Gatos", items: ["Gatos", "Gatos distancia corta", "Gatos sobre los codos", "Gatos codos pegados a las rodillas"] },
  { grupo: "Rotaciones", items: ["Cachetadas", "Jesucristo", "Palanquita", "Señorita", "Caballero", "Ballet"] },
  { grupo: "Rotaciones con cucarachas", items: ["Cachetadas con cucarachas", "Jesucristo con cucarachas", "Palanquita con cucarachas", "Señorita con cucarachas", "Caballero con cucarachas", "Ballet con cucarachas"] },
  { grupo: "Pivoteos", items: ["Pivoteos piernas dobladas", "Pivoteos piernas estiradas", "Pivoteo piernas dobladas en el aire", "Pivoteo de costado posición fetal"] },
  { grupo: "Libro", items: ["Libro abierto", "Libro cerrado"] },
  { grupo: "Cuello", items: ["Cuello sí", "Cuello no"] },
  { grupo: "Estiramientos", items: ["Estiramiento del 4"] }
];
/* Nombres que tenían las fichas antes de esta lista */
const ESTIRAMIENTO_DIARIO_RENOMBRES = { "Patada de Ballet": "Ballet", "Señorita ballet": "Ballet", "Señoritas": "Señorita", "Tobillos cruzados": "Jesucristo",
  "Cucarachas con brazos estirados sobre la cabeza": "Cucarachas con brazos estirados sobre la cabeza y piernas estiradas" };
const ESTIRAMIENTO_DIARIO_NOTA = "Hazla todas las mañanas, de forma constante. La finalidad es prepararnos para empezar bien el día: no debes luchar contra el dolor.";
function renderEstiramientos(profile, uid, isCoach){
  const box = document.getElementById("estiramientosCard");
  const nota = ESTIRAMIENTO_DIARIO_NOTA;
  const actuales = [...new Set((profile.estiramientos || []).map(e => ESTIRAMIENTO_DIARIO_RENOMBRES[e] || e))];
  /* Repeticiones por ejercicio ({"Cachetadas": 5}); se respetan los nombres antiguos */
  const reps = {};
  Object.entries(profile.estiramientos_reps || {}).forEach(([k, v]) => { const n = parseInt(v, 10); if(n > 0) reps[ESTIRAMIENTO_DIARIO_RENOMBRES[k] || k] = n; });

  /* El alumno ve solo su rutina personalizada; el menú de opciones es para el coach */
  if(!isCoach){ pintarEstiramientosAlumno(box, actuales, uid, nota, reps); return; }

  const grupos = ESTIRAMIENTO_DIARIO_GRUPOS;
  const predet = grupos.flatMap(g => g.items);
  let customList = actuales.filter(e => !predet.includes(e));
  let marcados = new Set(actuales.filter(e => predet.includes(e)));

  function paint(){
    box.innerHTML = `
      <p class="resena-rutina" style="margin:0">${esc(nota)}</p>
      ${grupos.map(g => `
        <fieldset class="comp-group">
          <legend>${esc(g.grupo)}</legend>
          <div class="check-grid">
            ${g.items.map(ej => {
              const i = predet.indexOf(ej);
              return `
              <div class="est-item">
                <label class="checkline" for="est_${i}">
                  <input type="checkbox" id="est_${i}" data-preset-idx="${i}" ${marcados.has(ej)?"checked":""}>
                  <span>${esc(ej)}</span>
                </label>
                <label class="est-reps"${marcados.has(ej) ? "" : " hidden"}><input type="number" inputmode="numeric" min="1" max="99" data-reps-idx="${i}" value="${reps[ej] || ""}" placeholder="–" aria-label="Repeticiones de ${esc(ej)}"><span>reps</span></label>
              </div>`;
            }).join("")}
          </div>
        </fieldset>`).join("")}
      ${customList.length ? `<p class="muted" style="margin:16px 0 0">Otros asignados:</p><div class="chip-list" style="margin-top:6px">${customList.map((c,i)=>`
        <span class="badge soft">${esc(c)} <button type="button" data-rmchip="${i}" aria-label="Quitar ${esc(c)}">✕</button></span>
      `).join("")}</div>` : ""}
      <label for="estOtro">Otros <span class="muted">(escribe y agrega)</span></label>
      <div class="inline-add">
        <input id="estOtro" placeholder="Ej: Estiramiento de isquiotibiales">
        <button type="button" class="btn-outline" id="btnAddOtro">+ Agregar</button>
      </div>
      <button type="button" class="btn-primary" id="btnSaveEstiramientos">Guardar rutina</button>
      <div id="estMsg" aria-live="polite"></div>
    `;
    box.querySelectorAll("[data-preset-idx]").forEach(cb=>{
      cb.onchange = ()=>{
        const ej = predet[parseInt(cb.dataset.presetIdx,10)];
        if(cb.checked) marcados.add(ej); else marcados.delete(ej);
        const r = box.querySelector(`[data-reps-idx="${cb.dataset.presetIdx}"]`);
        if(r){ r.closest(".est-reps").hidden = !cb.checked; if(cb.checked && !r.value) r.focus(); }
      };
    });
    box.querySelectorAll("[data-reps-idx]").forEach(r => {
      r.oninput = ()=>{
        const ej = predet[parseInt(r.dataset.repsIdx, 10)];
        const n = parseInt(r.value, 10);
        if(n > 0 && n < 100) reps[ej] = n; else delete reps[ej];
      };
    });
    box.querySelectorAll("[data-rmchip]").forEach(x=>{
      x.onclick = ()=>{ customList.splice(parseInt(x.dataset.rmchip,10),1); paint(); };
    });
    const input = document.getElementById("estOtro");
    const agregar = ()=>{
      const val = input.value.trim();
      if(val && !customList.includes(val) && !predet.includes(val)){ customList.push(val); }
      if(val){ paint(); document.getElementById("estOtro").focus(); }
    };
    document.getElementById("btnAddOtro").onclick = agregar;
    input.onkeydown = (e)=>{ if(e.key === "Enter"){ e.preventDefault(); agregar(); } };
    const saveBtn = document.getElementById("btnSaveEstiramientos");
    saveBtn.onclick = ()=> withBusy(saveBtn, "Guardando…", async ()=>{
      const seleccionados = predet.filter(ej => marcados.has(ej));
      const final = [...seleccionados, ...customList];
      const repsFinal = {};
      seleccionados.forEach(ej => { if(reps[ej]) repsFinal[ej] = reps[ej]; });
      const { error } = await sb.from("profiles").update({ estiramientos: final, estiramientos_reps: repsFinal }).eq("id", uid);
      const msg = document.getElementById("estMsg");
      if(error){ showError(msg, error); return; }
      showMsg(msg, "ok", "Rutina guardada.");
      profile.estiramientos = final; profile.estiramientos_reps = repsFinal;
    });
  }
  paint();
}

/* ---- Agenda: viajes y competencias (el propio atleta la gestiona) ---- */
function renderAgenda(eventos, uid, isCoach){
  const box = document.getElementById("agendaCard");
  if(state.detail) state.detail.eventos = eventos;
  const hoy = todayStr();
  const ordenados = [...eventos].sort((a,b)=> a.fecha.localeCompare(b.fecha));
  const proximos = ordenados.filter(e => e.fecha >= hoy);
  const pasados = ordenados.filter(e => e.fecha < hoy).reverse();
  const item = (ev)=>{
    const d = parseFecha(ev.fecha);
    const esComp = ev.tipo === "competencia";
    return `
      <li class="agenda-item${esComp ? " is-comp" : ""}${ev.fecha < hoy ? " is-past" : ""}">
        <div class="agenda-date" aria-hidden="true"><span class="d">${d ? d.getDate() : "?"}</span><span class="m">${d ? MESES[d.getMonth()] : ""}</span></div>
        <div class="agenda-info">
          <div class="agenda-title">${esc(ev.titulo)}</div>
          <div class="muted">${fmtFecha(ev.fecha)}${ev.notas ? " · " + esc(ev.notas) : ""}</div>
        </div>
        <span class="badge${esComp ? "" : " outline"}">${esComp ? "Competencia" : "Viaje"}</span>
        <button type="button" class="btn-danger icon" data-delev="${esc(ev.id)}" aria-label="Borrar ${esc(ev.titulo)}">✕</button>
      </li>`;
  };
  box.innerHTML = `
    ${ordenados.length ? `
      ${proximos.length ? `<ul class="agenda-list">${proximos.map(item).join("")}</ul>` : `<p class="muted">No hay viajes ni competencias próximas.</p>`}
      ${pasados.length ? `<details class="records"><summary>Pasados (${pasados.length})</summary><ul class="agenda-list">${pasados.map(item).join("")}</ul></details>` : ""}
    ` : emptyHTML("Sin viajes ni competencias registradas. Agrégalos para verlos en tu macrociclo.")}
    <div id="agendaListMsg" aria-live="polite"></div>
    <button type="button" class="btn-outline btn-block" id="btnAddEvento" style="margin-top:14px">+ Agregar</button>
    <div id="eventoForm"></div>
  `;
  const reload = async ()=>{
    const { data, error } = await sb.from("eventos").select("*").eq("user_id",uid).order("fecha");
    if(error){ showError(document.getElementById("agendaListMsg"), error); return; }
    renderAgenda(data||[], uid, isCoach);
    renderMacro(data||[], false);
    renderResumen();
  };
  document.getElementById("btnAddEvento").onclick = ()=>{
    document.getElementById("eventoForm").innerHTML = `
      <div class="row">
        <div><label for="ev_tipo">Tipo</label>
          <select id="ev_tipo">
            <option value="competencia">Competencia</option>
            <option value="viaje">Viaje</option>
          </select>
        </div>
        <div><label for="ev_fecha">Fecha</label><input type="date" id="ev_fecha" value="${todayStr()}"></div>
      </div>
      <label for="ev_titulo">Título</label><input id="ev_titulo" placeholder="Ej: Nacional de natación">
      <label for="ev_notas">Notas <span class="muted">(opcional)</span></label><input id="ev_notas" placeholder="Ciudad, detalles...">
      <button type="button" class="btn-primary" id="btnSaveEvento">Guardar</button>
      <div id="eventoMsg" aria-live="polite"></div>
    `;
    document.getElementById("ev_titulo").focus();
    const saveBtn = document.getElementById("btnSaveEvento");
    saveBtn.onclick = ()=> withBusy(saveBtn, "Guardando…", async ()=>{
      const titulo = document.getElementById("ev_titulo").value.trim();
      const fecha = document.getElementById("ev_fecha").value;
      const msg = document.getElementById("eventoMsg");
      if(!titulo || !fecha){ showMsg(msg, "error", "Completa título y fecha."); return; }
      const payload = {
        user_id: uid, fecha, titulo,
        tipo: document.getElementById("ev_tipo").value,
        notas: document.getElementById("ev_notas").value || null
      };
      const { error } = await sb.from("eventos").insert(payload);
      if(error){ showError(msg, error); return; }
      await reload();
    });
  };
  box.querySelectorAll("[data-delev]").forEach(btn=>{
    btn.onclick = ()=> withBusy(btn, "…", async ()=>{
      const { error } = await sb.from("eventos").delete().eq("id", btn.dataset.delev);
      if(error){ showError(document.getElementById("agendaListMsg"), error); return; }
      await reload();
    });
  });
}

/* ====================== START ====================== */
/* Los scripts de Supabase y Chart.js se cargan con "defer": este arranque espera a que estén listos */
window.addEventListener("DOMContentLoaded", ()=>{
  if(!window.supabase){
    app.innerHTML = `<div class="boot" role="alert"><span class="boot-mark">GYMNIKA</span><span class="muted">No se pudo conectar. Revisa tu internet y recarga la página.</span></div>`;
    return;
  }
  /* La sesión queda guardada en el teléfono y se renueva sola: solo se cierra con "Salir" */
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  setupChartDefaults();
  /* Llegada desde el QR de recepción: #/checkin/CODIGO */
  const codigoQR = codigoCheckinDeURL();
  if(codigoQR){ guardarCheckinPendiente(codigoQR); history.replaceState(null, "", location.pathname + location.search); }
  sb.auth.onAuthStateChange((event, session) => {
    if(event === "PASSWORD_RECOVERY"){ recoveryMode = true; setTimeout(renderNewPassword, 0); return; }
    if(session) state.session = session;
    if(!session){ state.session=null; state.profile=null; }
  });
  /* Al volver a la app (teléfono bloqueado, otra app), renueva la sesión enseguida */
  document.addEventListener("visibilitychange", ()=>{
    if(document.visibilityState === "visible") sb.auth.startAutoRefresh(); else sb.auth.stopAutoRefresh();
  });
  bootAfterAuth();
});

/* ====================== SECCIONES DEL ALUMNO ======================
   Inicio (su perfil), Reservar, Progreso y Mi ficha. En el teléfono el menú va abajo, como en una app;
   en computadora va debajo del encabezado. La sección elegida queda en la dirección (#/reservar…). */
const SECCIONES_ALUMNO = {
  inicio: { t: "Inicio", ico: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/></svg>` },
  reservar: { t: "Reservar", ico: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16.5" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/><path d="m9 15 2 2 4-4"/></svg>` },
  progreso: { t: "Progreso", ico: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h18"/><path d="M6 16v-4M11 16V8M16 16v-6M21 4l-5 5-4-3-6 5"/></svg>` },
  ficha: { t: "Mi ficha", ico: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>` }
};
function seccionAlumnoDeURL(){
  const m = location.hash.match(/^#\/(inicio|reservar|progreso|ficha)\b/);
  return m ? m[1] : "inicio";
}
function saludoDelDia(){
  const h = Number(new Intl.DateTimeFormat("es-PE", { hour: "numeric", hour12: false, timeZone: "America/Lima" }).format(new Date()));
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
}
function detalleAlumnoHTML(profile, chips, tabs, fallo){
  const cat = profile.categoria;
  const est = macrocicloEstado();
  const semanaHTML = cat === "fortalecimiento" && !est.antes
    ? `<a class="perfil-semana" href="#/progreso"><span class="num">${est.semana}</span><span>Semana ${est.semana} de 20 · ${esc(est.fase || "")}</span><span aria-hidden="true">→</span></a>` : "";
  const nav = `<nav class="tabs-alumno" aria-label="Secciones de tu ficha">${Object.entries(SECCIONES_ALUMNO).map(([k, v]) =>
    `<a href="#/${k}" data-tab-alumno="${k}"><span class="ta-ico" aria-hidden="true">${v.ico}</span><span>${v.t}</span></a>`).join("")}</nav>`;
  const titulo = (k)=> `<header class="tab-head"><p class="eyebrow">${esc(profile.nombre || "Mi ficha")}</p><h1>${SECCIONES_ALUMNO[k].t}</h1></header>`;
  return `
    <div class="detail detail-alumno">
      ${nav}
      ${state.profile && profile.id !== state.profile.id ? `
      <div class="viendo-hijo" role="status">
        <span>Estás en el panel de <strong>${esc(profile.nombre || "")}</strong></span>
        <button type="button" class="btn-outline" data-volver-panel>Volver a mi panel</button>
      </div>` : ""}
      <div id="detailMsg">${fallo ? `<div class="error" role="alert">${esc("Parte de la ficha no cargó. " + errorES(fallo.error))}</div>` : ""}</div>
      <section class="tab-alumno" data-tab="inicio" aria-label="Inicio">
        <header class="detail-head perfil-head">
          <div class="perfil-id">
            <span class="avatar perfil-avatar" aria-hidden="true">${esc(initials(profile.nombre || ""))}</span>
            <div><p class="eyebrow">${saludoDelDia()}</p><h1>${esc(profile.nombre || "Mi ficha")}</h1></div>
          </div>
          ${chips.length ? `<ul class="chips">${chips.join("")}</ul>` : ""}
          ${semanaHTML}
        </header>
        <div class="grid">${tabs.inicio}</div>
      </section>
      ${["reservar", "progreso", "ficha"].map(k => `
      <section class="tab-alumno" data-tab="${k}" aria-label="${SECCIONES_ALUMNO[k].t}" hidden>
        ${titulo(k)}
        <div class="grid">${tabs[k]}</div>
      </section>`).join("")}
    </div>`;
}
function activarSeccionAlumno(k, subir = true){
  const tabs = document.querySelectorAll(".tab-alumno");
  if(!tabs.length) return;
  if(!SECCIONES_ALUMNO[k]) k = "inicio";
  tabs.forEach(t => { t.hidden = t.dataset.tab !== k; });
  document.querySelectorAll("[data-tab-alumno]").forEach(a => {
    if(a.dataset.tabAlumno === k) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  document.body.classList.add("con-tabs");
  if(subir) window.scrollTo(0, 0);
}
/* Lleva a la sección donde está un panel (lo usan los avisos de la campanita) */
function mostrarSeccionDe(el){
  const tab = el && el.closest(".tab-alumno");
  if(!tab) return;
  const k = tab.dataset.tab;
  if(location.hash !== "#/" + k) history.replaceState(null, "", "#/" + k);
  activarSeccionAlumno(k, false);
}

/* Rutina de estiramiento del alumno: la lista que asignó el coach, con la dosis y casillas para ir marcando
   lo que ya hizo hoy (se guarda en este teléfono y se reinicia cada día). */
function pintarEstiramientosAlumno(box, lista, uid, nota, reps){
  reps = reps || {};
  if(!lista.length){
    box.innerHTML = `<p class="muted">Tu coach todavía no asignó tu rutina de estiramiento diaria. Cuando lo haga, aparecerá aquí.</p>`;
    return;
  }
  const clave = "gymnika_estiro_" + uid + "_" + todayStr();
  let hechos = new Set();
  try{ hechos = new Set(JSON.parse(localStorage.getItem(clave) || "[]")); } catch { /* sin almacenamiento */ }
  const pintar = ()=>{
    const n = lista.filter(e => hechos.has(e)).length, total = lista.length;
    box.innerHTML = `
      <p class="resena-rutina">${esc(nota)}</p>
      <div class="estiro-avance" role="status">
        <span class="estiro-barra" aria-hidden="true"><i style="width:${Math.round(n / total * 100)}%"></i></span>
        <span>${n === total ? "<strong>Rutina de hoy completa.</strong> Buen trabajo." : `Hoy llevas <strong>${n} de ${total}</strong>`}</span>
      </div>
      <ol class="estiro-lista">${lista.map((e, i) => `
        <li><label class="${hechos.has(e) ? "hecho" : ""}">
          <input type="checkbox" data-estiro="${i}" ${hechos.has(e) ? "checked" : ""}>
          <span class="estiro-num num" aria-hidden="true">${i + 1}</span>
          <span class="estiro-txt"><strong>${esc(e)}</strong>${reps[e] ? `<span class="estiro-reps">${reps[e]} reps</span>` : ""}</span>
        </label></li>`).join("")}</ol>`;
    box.querySelectorAll("[data-estiro]").forEach(c => c.onchange = ()=>{
      const ej = lista[Number(c.dataset.estiro)];
      if(c.checked) hechos.add(ej); else hechos.delete(ej);
      try{ localStorage.setItem(clave, JSON.stringify([...hechos])); } catch { /* sin almacenamiento */ }
      pintar();
      const otra = box.querySelector(`[data-estiro="${c.dataset.estiro}"]`); if(otra) otra.focus();
    });
  };
  pintar();
}

/* ---------- Evolución (solo el equipo): el color de riesgo en el tiempo y el dolor de cada sesión de la bitácora ----------
   La franja muestra cuánto tiempo estuvo en cada color; el gráfico pinta el dolor al llegar y al salir sobre esos mismos
   colores de fondo, así se ve de un vistazo cómo bajó el dolor mientras el color mejoraba. */
let evolucionChart = null;
const RIESGO_NOMBRE = { rojo: "Rojo", anaranjado: "Anaranjado", amarillo: "Amarillo", verde: "Verde", azul: "Azul" };
function colorRiesgoCSS(c){
  const v = getComputedStyle(document.documentElement).getPropertyValue("--r-" + (c || "sin")).trim();
  return v || "#E4DDD3";
}
function conAlfa(hex, a){
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if(!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
async function renderEvolucion(box, uid){
  const panel = box.closest("section") || box;
  const [{ data: hist }, { data: bits }] = await Promise.all([
    sb.from("riesgo_historial").select("color, desde, autor_nombre").eq("user_id", uid).order("desde"),
    sb.from("bitacora").select("fecha, dolor_inicio, dolor_salida, created_at").eq("atleta_id", uid).order("fecha").order("created_at")
  ]);
  if(!document.body.contains(box)) return;
  const hoy = todayStr();
  const diaDe = (iso)=> new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Lima" });
  /* Un tramo por día: si el color cambió varias veces el mismo día, vale el último */
  const cambios = [];
  (hist || []).forEach(h => { const f = diaDe(h.desde); if(cambios.length && cambios[cambios.length - 1].f === f) cambios.pop(); cambios.push({ f, color: h.color }); });
  const ses = (bits || []).filter(b => b.dolor_inicio != null || b.dolor_salida != null);
  if(!cambios.some(c => c.color) && ses.length < 2){ panel.hidden = true; return; }
  panel.hidden = false;
  const ini = [cambios[0] && cambios[0].f, ses[0] && ses[0].fecha].filter(Boolean).sort()[0] || hoy;
  const total = Math.max(1, diasEntre(ini, hoy) + 1);
  const tramos = [];
  if(cambios.length && cambios[0].f > ini) tramos.push({ f: ini, color: null });
  cambios.forEach(c => tramos.push(c));
  tramos.forEach((t, i) => { t.d0 = diasEntre(ini, t.f); t.d1 = i < tramos.length - 1 ? diasEntre(ini, tramos[i + 1].f) : total; });
  const conColor = tramos.filter(t => t.color);
  const primero = conColor[0], actual = tramos[tramos.length - 1];

  /* Indicadores: color al inicio y hoy, dolor al llegar (primeras vs últimas 4 sesiones) y tiempo en Gymnika */
  const llegadas = ses.map(b => b.dolor_inicio).filter(v => v != null);
  const prom = (xs)=> xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : null;
  const n = Math.min(4, Math.floor(llegadas.length / 2));
  const dAntes = n ? prom(llegadas.slice(0, n)) : null, dHoy = n ? prom(llegadas.slice(-n)) : null;
  const meses = Math.round(total / 30.4);
  const sw = (c)=> `<span class="evo-sw" style="background:${colorRiesgoCSS(c)}" aria-hidden="true"></span>`;
  const kpis = [];
  if(primero) kpis.push(`<div class="evo-kpi"><span class="evo-k">Color</span>
    <strong>${sw(primero.color)}${esc(RIESGO_NOMBRE[primero.color])}${actual.color && actual.color !== primero.color ? ` <span class="evo-flecha" aria-hidden="true">→</span> ${sw(actual.color)}${esc(RIESGO_NOMBRE[actual.color])}` : ""}</strong>
    <span class="muted">${actual.color && actual.color !== primero.color ? `<span class="sr-only">de ${esc(RIESGO_NOMBRE[primero.color])} a ${esc(RIESGO_NOMBRE[actual.color])}. </span>Hoy desde el ${fmtFecha(actual.f)}` : `Desde el ${fmtFecha(primero.f)}`}</span></div>`);
  if(dAntes != null) kpis.push(`<div class="evo-kpi"><span class="evo-k">Dolor al llegar</span>
    <strong class="num">${fmtNum(dAntes)} <span class="evo-flecha" aria-hidden="true">→</span><span class="sr-only"> a </span> ${fmtNum(dHoy)}</strong>
    <span class="muted">${dHoy < dAntes ? `Bajó ${Math.round((1 - dHoy / dAntes) * 100)} %` : dHoy > dAntes ? "Subió" : "Igual"} · primeras vs. últimas ${n} sesiones</span></div>`);
  kpis.push(`<div class="evo-kpi"><span class="evo-k">En Gymnika</span>
    <strong class="num">${meses >= 1 ? plural(meses, "mes", "meses") : plural(total, "día", "días")}</strong>
    <span class="muted">${ses.length ? plural(ses.length, "sesión con bitácora", "sesiones con bitácora") : "Sin sesiones en la bitácora"}</span></div>`);

  box.innerHTML = `
    <div class="evo-kpis">${kpis.join("")}</div>
    ${conColor.length ? `<div class="evo-franja-wrap">
      <div class="evo-franja" role="img" aria-label="Color de riesgo en el tiempo: ${esc(conColor.map(t => RIESGO_NOMBRE[t.color] + " desde el " + fmtFecha(t.f)).join(", "))}">
        ${tramos.map(t => `<span class="evo-tramo${t.color ? "" : " sin"}" style="flex-grow:${Math.max(1, t.d1 - t.d0)};background:${colorRiesgoCSS(t.color)}"></span>`).join("")}
      </div>
      <ol class="evo-hitos" aria-hidden="true">${(()=>{
        /* En pantallas chicas se ocultan las etiquetas que quedarían encima de la anterior */
        const pos = conColor.map(t => t.d0 / total * 100);
        return conColor.map((t, i) => `<li class="${i && pos[i] - pos[i - 1] < 22 ? "cerca" : ""}" style="left:${pos[i].toFixed(2)}%"><strong>${esc(RIESGO_NOMBRE[t.color])}</strong><span>${fmtFecha(t.f)}</span></li>`).join("")
          + `<li class="evo-hoy${pos.length && 100 - pos[pos.length - 1] < 30 ? " cerca" : ""}" style="left:100%"><strong>Hoy</strong></li>`;
      })()}</ol>
    </div>` : ""}
    ${ses.length >= 2 ? `<div class="chart-box evo-chart"><canvas id="evolucionChart" role="img" aria-label="Dolor al llegar y al salir de cada sesión, de 0 a 10"></canvas></div>
      <div class="legend evo-leyenda"><span><span class="dot" style="background:${CHART_COLORS[0]}"></span>Dolor al llegar</span><span><span class="dot evo-dot-salida"></span>Dolor al salir</span>${conColor.length ? `<span class="muted">El fondo es el color de riesgo de cada momento</span>` : ""}</div>` : ""}`;

  if(evolucionChart){ evolucionChart.destroy(); evolucionChart = null; }
  const canvas = box.querySelector("#evolucionChart");
  if(!canvas || !window.Chart) return;
  const punto = (b, k)=> b[k] == null ? null : { x: diasEntre(ini, b.fecha), y: b[k] };
  const bandas = { id: "bandasRiesgo", beforeDatasetsDraw(chart){
    const { ctx, chartArea: a, scales: { x } } = chart;
    tramos.forEach(t => {
      if(!t.color) return;
      const x0 = Math.max(a.left, x.getPixelForValue(t.d0)), x1 = Math.min(a.right, x.getPixelForValue(t.d1));
      if(x1 <= x0) return;
      ctx.save(); ctx.fillStyle = conAlfa(colorRiesgoCSS(t.color), 0.16); ctx.fillRect(x0, a.top, x1 - x0, a.bottom - a.top); ctx.restore();
    });
  } };
  evolucionChart = new Chart(canvas, {
    type: "line",
    data: { datasets: [
      lineDataset("Dolor al llegar", ses.map(b => punto(b, "dolor_inicio")).filter(Boolean), CHART_COLORS[0], { pointRadius: 2.5, cubicInterpolationMode: "monotone" }),
      lineDataset("Dolor al salir", ses.map(b => punto(b, "dolor_salida")).filter(Boolean), CHART_COLORS[3], { pointRadius: 2, cubicInterpolationMode: "monotone", borderDash: [5, 4], borderWidth: 2 })
    ] },
    options: {
      responsive: true, maintainAspectRatio: false, parsing: true,
      interaction: { mode: "nearest", axis: "x", intersect: false },
      plugins: { legend: { display: false }, tooltip: { callbacks: {
        title: (it)=> it.length ? fmtFecha(fechaISO(sumarDias(parseFecha(ini), it[0].parsed.x)), true) : "",
        label: (c)=> `${c.dataset.label}: ${c.parsed.y}` } } },
      scales: {
        x: { type: "linear", min: 0, max: total, grid: { display: false },
             ticks: { stepSize: total > 120 ? 30 : 14, maxRotation: 0, callback: (v)=> fmtFecha(fechaISO(sumarDias(parseFecha(ini), v))) } },
        y: { min: 0, max: 10, ticks: { stepSize: 2 }, title: { display: true, text: "Dolor (0 a 10)" } }
      }
    },
    plugins: [bandas]
  });
}
