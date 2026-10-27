/* ====================== FICHA DEL ATLETA ====================== */
function panelHTML(id, title, span, opts = {}){
  const cls = ["panel", "span-" + span, opts.cls || ""].join(" ").trim();
  return `
    <section class="${cls}" aria-labelledby="h_${id}">
      <div class="panel-head">
        <div>${opts.eyebrow ? `<p class="eyebrow">${opts.eyebrow}</p>` : ""}<h2 id="h_${id}">${title}</h2></div>
        ${opts.note ? `<span class="muted">${opts.note}</span>` : ""}
      </div>
      <div id="${id}">${opts.body || ""}</div>
    </section>`;
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
    sb.from("tiempos").select("*").eq("user_id", uid).order("fecha"),
    sb.from("eventos").select("*").eq("user_id", uid).order("fecha"),
    sb.from("solicitudes_nutricion").select("*").eq("user_id", uid).order("fecha", { ascending: false })
  ]);
  if(token !== state.renderToken) return; // el coach ya abrió otro atleta
  const [{ data: medidas }, { data: fuerza }, { data: ejercicios }, { data: tiempos }, { data: eventos }, { data: solicitudes }] = results;
  const fallo = results.find(r => r.error);
  state.detail = { medidas: medidas || [], fuerza: fuerza || [], eventos: eventos || [] };

  const edad = calcEdad(profile.fecha_nacimiento);
  const chips = [
    profile.deporte,
    profile.nivel_experiencia,
    edad !== null ? `${edad} años` : null,
    profile.objetivo ? `Objetivo: ${profile.objetivo}` : null
  ].filter(Boolean).map(t=>`<li class="chip">${esc(t)}</li>`);
  if(isCoach && tieneLesion(profile.lesiones)) chips.push(`<li class="chip warn">Lesión: ${esc(profile.lesiones)}</li>`);
  if(isCoach && profile.autorizacion_medica === false) chips.push(`<li class="chip warn">Sin autorización médica</li>`);

  const tip = tipDelDia();
  const cat = profile.categoria;
  const esTerapia = cat === "terapia";
  const graficoPeso = (span)=> panelHTML("pesoGrasaCard", "Peso y % grasa", span, { body: `<div class="chart-box"><canvas id="pesoGrasaChart" role="img" aria-label="Gráfico de peso y porcentaje de grasa en el tiempo"></canvas></div>` });
  const datosPersonales = `
    <section class="panel span-12" aria-label="Datos personales">
      <details class="ficha-details">
        <summary><h2>Datos personales</h2><span class="muted">Ver y editar</span></summary>
        <div id="fichaCard"></div>
      </details>
    </section>`;
  const resumenHTML = `
        <section class="span-12" aria-labelledby="h_resumen">
          <h2 class="sr-only" id="h_resumen">${isCoach ? "Resumen del proceso" : "Tu proceso"}</h2>
          <div class="stats" id="resumenCard"></div>
        </section>`;
  const macroHTML = `<section class="panel macro span-12" id="macroCard" aria-label="Macrociclo"></section>`;
  let panels;
  if(!isCoach && esTerapia){
    panels = `
    ${panelHTML("planCard", "Mis sesiones", 12, { cls: "plan-panel", eyebrow: "Terapia" })}
    ${panelHTML("reservarCard", "Reservar sesión", 8, { note: "Cada reserva usa 1 sesión" })}
    ${panelHTML("misReservasCard", "Mis reservas", 4)}
    ${panelHTML("estiramientosCard", "Rutina de estiramiento diaria", 12, { eyebrow: "Todos los días" })}
    ${panelHTML("notasCard", "Consejos de tu coach", 6, { cls: "coach-voice", eyebrow: "Tu coach" })}
    ${panelHTML("tipCard", esc(tip.titulo), 6, { cls: "coach-voice", eyebrow: "Consejo del día", body: `<p class="coach-quote">${esc(tip.texto)}</p>` })}
    ${panelHTML("medidasCard", "Medidas corporales", 12)}
    ${datosPersonales}`;
  } else if(!isCoach){
    panels = `
    ${panelHTML("planCard", "Mi acceso mensual", 12, { cls: "plan-panel", eyebrow: "Fortalecimiento" })}
    ${panelHTML("reservarCard", "Reservar horario", 8, { note: "Obligatorio para entrar" })}
    ${panelHTML("misReservasCard", "Mis horarios", 4)}
    ${macroHTML}
    ${resumenHTML}
    ${panelHTML("notasCard", "Consejos de tu coach", 6, { cls: "coach-voice", eyebrow: "Tu coach" })}
    ${panelHTML("tipCard", esc(tip.titulo), 6, { cls: "coach-voice", eyebrow: "Consejo del día", body: `<p class="coach-quote">${esc(tip.texto)}</p>` })}
    ${panelHTML("fuerzaCard", "Progresión de fuerza", 8, { note: "Carga el coach" })}
    ${graficoPeso(4)}
    ${panelHTML("medidasCard", "Medidas corporales", 12)}
    ${panelHTML("tiemposCard", "Tiempos deportivos", 6)}
    ${panelHTML("agendaCard", "Agenda: viajes y competencias", 6)}
    ${panelHTML("nutricionCard", "Plan nutricional", 6)}
    ${panelHTML("estiramientosCard", "Compensación", 6)}
    ${datosPersonales}`;
  } else if(esTerapia){
    panels = `
    ${panelHTML("planCard", "Plan y pagos", 12, { eyebrow: "Terapia" })}
    ${panelHTML("notasCard", "Notas del coach", 6)}
    ${panelHTML("estiramientosCard", "Rutina de estiramiento diaria", 6)}
    ${panelHTML("nutricionCard", "Plan nutricional", 6)}
    ${panelHTML("medidasCard", "Medidas corporales", 12)}
    ${panelHTML("fichaCard", "Datos personales", 12)}`;
  } else {
    panels = `
    ${panelHTML("planCard", "Plan y pagos", 12, { eyebrow: cat ? "Fortalecimiento" : "Sin categoría" })}
    ${macroHTML}
    ${resumenHTML}
    ${panelHTML("notasCard", "Notas del coach", 6)}
    ${panelHTML("agendaCard", "Agenda: viajes y competencias", 6)}
    ${panelHTML("fuerzaCard", "Progresión de fuerza", 8)}
    ${graficoPeso(4)}
    ${panelHTML("medidasCard", "Medidas corporales", 12)}
    ${panelHTML("tiemposCard", "Tiempos deportivos", 6)}
    ${panelHTML("nutricionCard", "Plan nutricional", 6)}
    ${panelHTML("estiramientosCard", "Compensación", 6)}
    ${panelHTML("fichaCard", "Datos personales", 6)}`;
  }
  if(isCoach && cat) chips.unshift(`<li class="chip cat-chip cat-${cat}">${CATEGORIAS[cat].nombre}</li>`);
  state.detail.profile = profile;

  container.innerHTML = `
    <div class="detail">
      <header class="detail-head">
        ${isCoach ? `<a class="back" href="#/">← Atletas</a>` : ""}
        <div class="detail-title">
          <div>
            <p class="eyebrow">${isCoach ? "Ficha del atleta" : "Mi ficha"}</p>
            <h1>${esc(profile.nombre || (isCoach ? "(sin nombre)" : "Mi ficha"))}</h1>
            ${chips.length ? `<ul class="chips">${chips.join("")}</ul>` : ""}
          </div>
          ${isCoach ? `<button type="button" class="btn-danger" id="btnDelAthlete">Borrar atleta</button>` : ""}
        </div>
        <div id="detailMsg">${fallo ? `<div class="error" role="alert">${esc("Parte de la ficha no cargó. " + errorES(fallo.error))}</div>` : ""}</div>
      </header>
      <div class="grid">${panels}</div>
    </div>
  `;

  if(isCoach){
    const delBtn = document.getElementById("btnDelAthlete");
    delBtn.onclick = ()=>{
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
  renderMacro(state.detail.eventos, true);
  renderResumen();
  renderFichaForm(profile, uid, isCoach);
  renderNotasCoach(profile, uid, isCoach);
  if(hay("agendaCard")) renderAgenda(eventos || [], uid, isCoach);
  renderMedidas(medidas || [], uid, isCoach);
  if(hay("fuerzaCard")) renderFuerza(fuerza || [], ejercicios || [], uid, isCoach);
  if(hay("tiemposCard")) renderTiempos(tiempos || [], uid, isCoach);
  if(hay("nutricionCard")) renderNutricion(profile, uid, isCoach, solicitudes || []);
  renderEstiramientos(profile, uid, isCoach);
  if(isCoach) await renderPlanCoach(profile);
  else { await renderPlanAlumno(profile); await renderReservasAlumno(profile); }
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
    const checkKeys = prefix==="su_" ? FICHA_REQUIRED.filter(k=>k!=="nombre") : FICHA_REQUIRED;
    missing = checkKeys.some(k => payload[k] === null || payload[k] === undefined || String(payload[k]).trim() === "");
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
    box.innerHTML = `
      <label for="n_consejos" style="margin-top:0">Consejos para el atleta <span class="muted">(el atleta sí los ve)</span></label>
      <textarea id="n_consejos" rows="3">${esc(profile.consejos_coach || "")}</textarea>
      <label for="n_comentarios">Comentarios internos <span class="muted">(solo coaches)</span></label>
      <textarea id="n_comentarios" rows="3">${esc(profile.comentarios_coach || "")}</textarea>
      <button type="button" class="btn-primary" id="btnSaveNotas">Guardar notas</button>
      <div id="notasMsg" aria-live="polite"></div>
    `;
    const btn = document.getElementById("btnSaveNotas");
    btn.onclick = ()=> withBusy(btn, "Guardando…", async ()=>{
      const payload = {
        consejos_coach: document.getElementById("n_consejos").value || null,
        comentarios_coach: document.getElementById("n_comentarios").value || null
      };
      const { error } = await sb.from("profiles").update(payload).eq("id", uid);
      const msg = document.getElementById("notasMsg");
      if(error){ showError(msg, error); return; }
      Object.assign(profile, payload);
      showMsg(msg, "ok", "Notas guardadas.");
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
              <th scope="row" class="sticky-col" style="font-size:14.5px;letter-spacing:0;color:var(--ink);background:var(--surface)">${fmtFecha(m.fecha)}</th>
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
            <h3>${fmtFecha(m.fecha)}</h3>
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

/* ---- Tiempos ---- */
let tiemposChartInstance = null;

function renderTiempos(tiempos, uid, isCoach){
  const box = document.getElementById("tiemposCard");
  const pruebas = [...new Set(tiempos.map(t=>t.prueba))];
  const colorFor = (p)=> CHART_COLORS[pruebas.indexOf(p) % CHART_COLORS.length];

  const rows = [...tiempos].reverse().map(t => `
    <tr>
      <td>${fmtFecha(t.fecha)}</td><td style="text-align:left">${esc(t.prueba)}</td><td>${fmt(t.valor)} ${esc(t.unidad)}</td>
      <td class="actions"><button type="button" class="btn-danger icon" data-delt="${esc(t.id)}" aria-label="Borrar ${esc(t.prueba)} del ${fmtFecha(t.fecha)}">✕</button></td>
    </tr>
  `).join("");

  box.innerHTML = `
    <div id="tiemposLegend" class="legend"></div>
    <div class="chart-box"><canvas id="tiemposChart" role="img" aria-label="Gráfico de tiempos deportivos"></canvas></div>
    ${tiempos.length ? `
    <div class="table-wrap">
      <table>
        <thead><tr><th scope="col">Fecha</th><th scope="col" style="text-align:left">Prueba</th><th scope="col">Tiempo</th><th scope="col"><span class="sr-only">Acciones</span></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>` : emptyHTML("Sin tiempos registrados. Agrega tu primera prueba para seguir su evolución.")}
    <div id="tiemposListMsg" aria-live="polite"></div>
    <button type="button" class="btn-outline btn-block" id="btnAddTiempo" style="margin-top:14px">+ Agregar tiempo</button>
    <div id="tiempoForm"></div>
  `;
  drawTiemposChart(tiempos, colorFor);

  const reload = async ()=>{
    const { data, error } = await sb.from("tiempos").select("*").eq("user_id",uid).order("fecha");
    if(error){ showError(document.getElementById("tiemposListMsg"), error); return; }
    renderTiempos(data||[], uid, isCoach);
  };

  document.getElementById("btnAddTiempo").onclick = ()=>{
    document.getElementById("tiempoForm").innerHTML = `
      <label for="t_fecha">Fecha</label><input type="date" id="t_fecha" value="${todayStr()}">
      <label for="t_prueba">Prueba / evento</label><input id="t_prueba" placeholder="Ej: 100m libre, 5K, salto largo">
      <div class="row">
        <div><label for="t_valor">Tiempo / valor</label><input type="number" inputmode="decimal" step="0.01" id="t_valor"></div>
        <div><label for="t_unidad">Unidad</label>
          <select id="t_unidad">
            <option value="seg">segundos</option>
            <option value="min">minutos</option>
            <option value="m">metros</option>
            <option value="pts">puntos</option>
          </select>
        </div>
      </div>
      <button type="button" class="btn-primary" id="btnSaveTiempo">Guardar</button>
      <div id="tiempoMsg" aria-live="polite"></div>
    `;
    document.getElementById("t_prueba").focus();
    const saveBtn = document.getElementById("btnSaveTiempo");
    saveBtn.onclick = ()=> withBusy(saveBtn, "Guardando…", async ()=>{
      const fecha = document.getElementById("t_fecha").value;
      const prueba = document.getElementById("t_prueba").value.trim();
      const valor = parseFloat(document.getElementById("t_valor").value);
      const msg = document.getElementById("tiempoMsg");
      if(!fecha || !prueba || isNaN(valor)){ showMsg(msg, "error", "Completa fecha, prueba y valor."); return; }
      const payload = { user_id: uid, fecha, prueba, valor, unidad: document.getElementById("t_unidad").value };
      const { error } = await sb.from("tiempos").insert(payload);
      if(error){ showError(msg, error); return; }
      await reload();
    });
  };
  box.querySelectorAll("[data-delt]").forEach(btn=>{
    btn.onclick = ()=> withBusy(btn, "…", async ()=>{
      const { error } = await sb.from("tiempos").delete().eq("id", btn.dataset.delt);
      if(error){ showError(document.getElementById("tiemposListMsg"), error); return; }
      await reload();
    });
  });
}

function drawTiemposChart(tiempos, colorFor){
  const legendBox = document.getElementById("tiemposLegend");
  const canvas = document.getElementById("tiemposChart");
  if(tiemposChartInstance){ tiemposChartInstance.destroy(); tiemposChartInstance = null; }
  if(!tiempos.length || !window.Chart){
    legendBox.innerHTML = "";
    canvas.parentElement.style.display = "none";
    return;
  }
  canvas.parentElement.style.display = "block";
  const allDates = [...new Set(tiempos.map(t=>t.fecha))].sort();
  const pruebas = [...new Set(tiempos.map(t=>t.prueba))];
  legendBox.innerHTML = pruebas.map(p=>`<span><span class="dot" style="background:${esc(colorFor(p))}"></span>${esc(p)}</span>`).join("");
  const datasets = pruebas.map(p=>{
    const puntos = allDates.map(d=>{
      const reg = tiempos.find(t=>t.fecha===d && t.prueba===p);
      return reg ? reg.valor : null;
    });
    return lineDataset(p, puntos, colorFor(p));
  });
  tiemposChartInstance = new Chart(canvas, {
    type: "line",
    data: { labels: allDates.map(d=>fmtFecha(d, false)), datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction:{ mode:"index", intersect:false },
      plugins: { legend: { display:false }, tooltip: { callbacks: { label: (c)=> c.dataset.label+": "+c.parsed.y } } },
      scales: { x: { grid:{display:false} }, y: { grace:"5%" } }
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

/* ---- Compensación (Documento Master: 1 de la base + 2 del menú Gymnika + 1 rotación) ---- */
const COMPENSACION_GRUPOS = [
  { grupo: "Base", items: ["Colgado relajado en barra", "Respiración 90/90 con exhalación larga"] },
  { grupo: "Menú Gymnika", items: ["Ranas", "San José", "Aperturas en L", "El 4 (estiramiento de glúteo)", "Hinge de cadera", "Good morning", "Pivoteos de cadera"] },
  { grupo: "Rotaciones Gymnika", items: ["Patada de Ballet", "Caballero", "Cachetadas"] },
  { grupo: "Tobillo (se suma en la Fase 4)", items: ["Pantorrilla en pared", "Rodilla a la pared"] }
];
const ESTIRAMIENTOS_PREDETERMINADOS = COMPENSACION_GRUPOS.flatMap(g => g.items);
/* Nombres antiguos guardados en fichas anteriores */
const ESTIRAMIENTO_RENOMBRES = { "Señorita ballet": "Patada de Ballet" };
const COMPENSACION_NOTA = "Al final de cada rutina: 1 de la base + 2 del menú Gymnika + 1 rotación, 30-45 segundos o 6-8 repeticiones por lado.";

const ESTIRAMIENTO_DIARIO_NOTA = "Esta rutina debe ser ejecutada todos los días de forma constante. La finalidad es prepararnos para empezar bien el día: no debes luchar contra el dolor.";
function renderEstiramientos(profile, uid, isCoach){
  const box = document.getElementById("estiramientosCard");
  const esTerapia = profile.categoria === "terapia";
  const nota = esTerapia ? ESTIRAMIENTO_DIARIO_NOTA : COMPENSACION_NOTA;
  const actuales = [...new Set((profile.estiramientos || []).map(e => ESTIRAMIENTO_RENOMBRES[e] || e))];

  if(!isCoach){
    box.innerHTML = esTerapia
      ? `<p class="resena-rutina">${esc(nota)}</p>
         ${actuales.length ? `<ol class="stretch-list">${actuales.map(e=>`<li>${esc(e)}</li>`).join("")}</ol>`
           : `<p class="muted">Tu coach todavía no asignó tu rutina de estiramiento diaria.</p>`}`
      : actuales.length
        ? `<ol class="stretch-list">${actuales.map(e=>`<li>${esc(e)}</li>`).join("")}</ol>
           <p class="muted" style="margin-top:12px">${esc(nota)}</p>`
        : `<p class="muted">Tu coach todavía no asignó tu rutina de compensación.</p>`;
    return;
  }

  let customList = actuales.filter(e => !ESTIRAMIENTOS_PREDETERMINADOS.includes(e));
  let marcados = new Set(actuales.filter(e => ESTIRAMIENTOS_PREDETERMINADOS.includes(e)));

  function paint(){
    box.innerHTML = `
      <p class="${esTerapia ? "resena-rutina" : "muted"}" style="margin:0">${esc(nota)}</p>
      ${COMPENSACION_GRUPOS.map(g => `
        <fieldset class="comp-group">
          <legend>${esc(g.grupo)}</legend>
          <div class="check-grid">
            ${g.items.map(ej => {
              const i = ESTIRAMIENTOS_PREDETERMINADOS.indexOf(ej);
              return `
              <label class="checkline" for="est_${i}">
                <input type="checkbox" id="est_${i}" data-preset-idx="${i}" ${marcados.has(ej)?"checked":""}>
                <span>${esc(ej)}</span>
              </label>`;
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
        const ej = ESTIRAMIENTOS_PREDETERMINADOS[parseInt(cb.dataset.presetIdx,10)];
        if(cb.checked) marcados.add(ej); else marcados.delete(ej);
      };
    });
    box.querySelectorAll("[data-rmchip]").forEach(x=>{
      x.onclick = ()=>{ customList.splice(parseInt(x.dataset.rmchip,10),1); paint(); };
    });
    const input = document.getElementById("estOtro");
    const agregar = ()=>{
      const val = input.value.trim();
      if(val && !customList.includes(val) && !ESTIRAMIENTOS_PREDETERMINADOS.includes(val)){ customList.push(val); }
      if(val){ paint(); document.getElementById("estOtro").focus(); }
    };
    document.getElementById("btnAddOtro").onclick = agregar;
    input.onkeydown = (e)=>{ if(e.key === "Enter"){ e.preventDefault(); agregar(); } };
    const saveBtn = document.getElementById("btnSaveEstiramientos");
    saveBtn.onclick = ()=> withBusy(saveBtn, "Guardando…", async ()=>{
      const seleccionados = ESTIRAMIENTOS_PREDETERMINADOS.filter(ej => marcados.has(ej));
      const final = [...seleccionados, ...customList];
      const { error } = await sb.from("profiles").update({ estiramientos: final }).eq("id", uid);
      const msg = document.getElementById("estMsg");
      if(error){ showError(msg, error); return; }
      showMsg(msg, "ok", "Rutina guardada.");
      profile.estiramientos = final;
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
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  setupChartDefaults();
  /* Llegada desde el QR de recepción: #/checkin/CODIGO */
  const codigoQR = codigoCheckinDeURL();
  if(codigoQR){ guardarCheckinPendiente(codigoQR); history.replaceState(null, "", location.pathname + location.search); }
  sb.auth.onAuthStateChange((event, session) => {
    if(event === "PASSWORD_RECOVERY"){ recoveryMode = true; setTimeout(renderNewPassword, 0); return; }
    if(!session){ state.session=null; state.profile=null; }
  });
  bootAfterAuth();
});
