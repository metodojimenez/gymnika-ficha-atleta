/* ====================== PLANES: TERAPIA (TOKENS + RESERVAS) Y FORTALECIMIENTO (ACCESO MENSUAL) ======================
   Las reglas (saldo, aforo, lista de espera, plazos, check-in) viven en la base de datos.
   Este archivo solo muestra la información y llama a esas funciones. */

const CATEGORIAS = {
  terapia: { nombre: "Terapia", desc: "Sesiones de terapia con reserva de horario. Compras sesiones y cada una vale 1 token." },
  fortalecimiento: { nombre: "Fortalecimiento", desc: "Entrenamiento en los horarios de fortalecimiento con acceso mensual." }
};
const DIAS_SEMANA = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const DIAS_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const METODOS_PAGO = { yape: "Yape", plin: "Plin", transferencia: "Transferencia", mercadopago: "Mercado Pago" };
const ESTADO_RESERVA = {
  confirmada: "Confirmada", espera: "Lista de espera", cancelada: "Cancelada",
  cancelada_tarde: "Cancelada fuera de plazo", asistio: "Asistió", no_asistio: "No asistió"
};

const TERMINOS_BORRADOR = `TÉRMINOS Y CONDICIONES DE USO — GYMNIKA

1. Sobre la app
La Ficha del Atleta es la herramienta de Gymnika para registrar tu información, tu progreso, tus sesiones y tus pagos. Al crear tu cuenta aceptas estas condiciones.

2. Tus datos
Usamos tus datos personales y de salud (lesiones, autorización médica, medidas) solo para planificar y hacer seguimiento de tu entrenamiento o terapia. Solo los ven tú y el equipo de coaches de Gymnika. Puedes pedir que corrijamos o eliminemos tus datos escribiéndonos. Tratamos tu información conforme a la Ley N.° 29733, Ley de Protección de Datos Personales del Perú.

3. Terapia: sesiones con tokens
Cada sesión de terapia usa 1 token. Los tokens se compran en paquetes y se acreditan cuando el coach valida tu pago (Yape, Plin o transferencia). Cada horario tiene un aforo máximo; si está lleno, entras a la lista de espera y, si se libera un cupo, tu reserva se confirma automáticamente usando 1 token.

4. Cancelaciones
Puedes cancelar sin costo hasta 24 horas antes del inicio de tu sesión y el token vuelve a tu saldo. Si cancelas con menos de 24 horas o no asistes, el token se pierde.

5. Fortalecimiento: acceso mensual
El acceso mensual te permite asistir en los horarios de fortalecimiento durante el periodo pagado. Debes reservar tu horario en la app antes de venir; sin reserva no se registra tu entrada. Si no puedes asistir, cancela para liberar el cupo. El congelamiento del acceso es a criterio del centro y extiende la fecha de vencimiento por los días congelados.

6. Asistencia
Registras tu asistencia escaneando el código QR de recepción desde la app, en el horario que reservaste.

7. Salud
Debes informar cualquier lesión, condición o cambio en tu salud. Si no cuentas con autorización médica para entrenamiento intenso, el coach adaptará o suspenderá la actividad.

8. Cambios
Gymnika puede actualizar estas condiciones; te avisaremos dentro de la app.`;

const planes = { ajustes: null, horarios: null, paquetes: null };

/* ---------- Utilidades ---------- */
/* Terapia se cobra en dólares y fortalecimiento en soles: cada paquete y cada pago guarda su moneda */
function dinero(n, moneda){
  const x = Number(n);
  const num = Number.isInteger(x) ? x.toLocaleString("en-US") : x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (moneda === "PEN" ? "S/ " : "US$ ") + num;
}
function isoDow(d){ return d.getDay() || 7; }
function fechaISO(d){
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function horaCorta(h){ return String(h || "").slice(0,5); }
function inicioLocal(fecha, hora){ return new Date(`${fecha}T${horaCorta(hora)}:00`); }
function fmtFechaHora(iso){
  const d = new Date(iso); if(isNaN(d)) return "";
  const dia = DIAS_CORTOS[d.getDay()];
  return `${dia} ${d.getDate()} ${MESES[d.getMonth()]} · ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
function diasEntre(a, b){ return Math.round((parseFecha(b) - parseFecha(a)) / 86400000); }
function plural(n, uno, varios){ return `${n} ${n === 1 ? uno : varios}`; }

async function cargarAjustes(forzar){
  if(planes.ajustes && !forzar) return planes.ajustes;
  const { data } = await sb.from("ajustes").select("*").eq("id", 1).single();
  planes.ajustes = data || { mostrar_aforo: true, seleccion_lugar: false, horas_cancelacion: 24, dias_reserva: 14 };
  return planes.ajustes;
}
async function cargarHorarios(forzar){
  if(planes.horarios && !forzar) return planes.horarios;
  const { data } = await sb.from("horarios").select("*").order("dia_semana").order("hora");
  planes.horarios = data || [];
  return planes.horarios;
}
async function cargarPaquetes(forzar){
  if(planes.paquetes && !forzar) return planes.paquetes;
  const { data } = await sb.from("paquetes").select("*").order("orden").order("precio");
  planes.paquetes = data || [];
  return planes.paquetes;
}
function terminosTexto(){ return (planes.ajustes && planes.ajustes.terminos) || TERMINOS_BORRADOR; }
async function abrirTerminos(){
  try { await cargarAjustes(); } catch { /* sin sesión: se muestra el texto base */ }
  openDialog("Términos y condiciones", `<div class="prose terms-text">${esc(terminosTexto())}</div>`);
}

/* Selector de categoría (registro, ficha incompleta y coach) */
function categoriaPickerHTML(prefix, actual){
  return `
    <fieldset class="cat-picker" id="${prefix}cat">
      <legend>¿A qué vienes a Gymnika?<span class="req" aria-hidden="true">*</span></legend>
      ${Object.entries(CATEGORIAS).map(([k, c]) => `
        <label class="cat-option">
          <input type="radio" name="${prefix}categoria" value="${k}" ${actual === k ? "checked" : ""}>
          <span><strong>${c.nombre}</strong><span>${esc(c.desc)}</span></span>
        </label>`).join("")}
    </fieldset>`;
}
function categoriaElegida(prefix){
  const el = document.querySelector(`input[name="${prefix}categoria"]:checked`);
  return el ? el.value : null;
}
function terminosCheckHTML(prefix){
  return `
    <div class="full terms-row">
      <label class="checkline" for="${prefix}terminos">
        <input type="checkbox" id="${prefix}terminos">
        <span>Acepto los <button type="button" class="link-inline" data-ver-terminos>términos y condiciones</button><span class="req" aria-hidden="true">*</span></span>
      </label>
    </div>`;
}
function activarLinksTerminos(root){
  (root || document).querySelectorAll("[data-ver-terminos]").forEach(b => {
    b.onclick = (e)=>{ e.preventDefault(); e.stopPropagation(); abrirTerminos(); };
  });
}

/* IMC con la última medida de peso y la altura de la ficha (categorías de la OMS) */
function calcIMC(profile, medidas){
  const alt = Number(profile && profile.altura_cm);
  const conPeso = (medidas || []).filter(m => m.peso !== null && m.peso !== undefined && m.peso !== "")
    .sort((a,b)=> String(a.fecha).localeCompare(String(b.fecha)));
  if(!alt || alt < 80 || !conPeso.length) return null;
  const peso = Number(conPeso[conPeso.length-1].peso);
  const imc = peso / Math.pow(alt / 100, 2);
  if(!isFinite(imc)) return null;
  const cat = imc < 18.5 ? "Bajo peso" : imc < 25 ? "Normal" : imc < 30 ? "Sobrepeso" : "Obesidad";
  return { valor: imc, cat, fecha: conPeso[conPeso.length-1].fecha };
}

/* ====================== ALUMNO: MI PLAN ====================== */
async function cargarPlanDe(uid, categoria){
  if(categoria === "terapia"){
    const [{ data: movs }, { data: compras }, { data: reservas }] = await Promise.all([
      sb.from("tokens_movimientos").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
      sb.from("compras").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
      sb.from("reservas").select("*").eq("user_id", uid).order("inicio", { ascending: false })
    ]);
    const saldo = (movs || []).reduce((s, m) => s + Number(m.cantidad || 0), 0);
    return { movs: movs || [], compras: compras || [], reservas: reservas || [], saldo };
  }
  const [{ data: membresias }, { data: congelamientos }, { data: compras }, { data: asistencias }, { data: suscripciones }, { data: reservas }, { data: fijo }] = await Promise.all([
    sb.from("membresias").select("*").eq("user_id", uid).order("fin", { ascending: false }),
    sb.from("congelamientos").select("*").eq("user_id", uid).order("desde", { ascending: false }),
    sb.from("compras").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
    sb.from("asistencias").select("*").eq("user_id", uid).order("fecha", { ascending: false }),
    sb.from("suscripciones").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
    sb.from("reservas").select("*").eq("user_id", uid).order("inicio", { ascending: false }),
    sb.from("horario_fijo").select("*").eq("user_id", uid).eq("activo", true)
  ]);
  return { membresias: membresias || [], congelamientos: congelamientos || [], compras: compras || [], asistencias: asistencias || [], suscripciones: suscripciones || [], reservas: reservas || [], fijo: fijo || [] };
}

function estadoMembresia(plan){
  const hoy = todayStr();
  const vigente = plan.membresias.find(m => m.inicio <= hoy && m.fin >= hoy);
  const futura = plan.membresias.filter(m => m.inicio > hoy).sort((a,b)=> a.inicio.localeCompare(b.inicio))[0];
  const congelado = plan.congelamientos.find(c => c.desde <= hoy && c.hasta >= hoy);
  const ultima = plan.membresias[0];
  const finTotal = plan.membresias.reduce((f, m) => (m.fin > f ? m.fin : f), "");
  return { vigente, futura, congelado, ultima, finTotal };
}

/* Suscripción de Mercado Pago: la más reciente que siga vigente o que haya terminado hace poco */
function suscripcionHTML(plan, esCoach){
  const s = (plan.suscripciones || []).find(x => x.estado !== "cancelada" || Date.now() - new Date(x.updated_at).getTime() < 15 * 86400000);
  if(!s) return "";
  const cuota = `${dinero(s.monto, s.moneda)}/mes`;
  const quien = esCoach ? "El alumno" : "Tú";
  if(s.estado === "pendiente"){
    const reciente = s.init_point && Date.now() - new Date(s.created_at).getTime() < 24 * 3600000;
    return `<div class="plan-alert" role="status"><strong>Suscripción por confirmar:</strong> ${esc(s.paquete_nombre)} · ${cuota}.
      ${esCoach ? "Mercado Pago aún no confirma el primer cobro."
        : reciente ? `Si no terminaste el pago, <a href="${esc(s.init_point)}" rel="noopener">continúa en Mercado Pago</a>. Si ya pagaste, en unos minutos se activa.` : "Si ya pagaste, en unos minutos se activa."}</div>`;
  }
  if(s.estado === "activa") return `<div class="plan-alert" role="status"><strong>Suscripción activa:</strong> ${esc(s.paquete_nombre)} · ${cuota} · cuota ${s.cobros} de ${s.cuotas}. Mercado Pago cobra solo cada mes.</div>`;
  if(s.estado === "finalizada") return `<div class="plan-alert" role="status"><strong>Suscripción completa:</strong> ${esc(s.paquete_nombre)} · ${s.cobros} de ${s.cuotas} cuotas cobradas.</div>`;
  return `<div class="plan-alert warn" role="status"><strong>Suscripción ${s.estado}:</strong> ${esc(s.paquete_nombre)}. ${s.estado === "pausada" ? `${quien} no ${esCoach ? "tiene" : "tienes"} cobros automáticos por ahora.` : "Ya no se harán más cobros."}</div>`;
}

function avisoComprasHTML(compras){
  const pend = compras.filter(c => c.estado === "pendiente");
  const rech = compras.filter(c => c.estado === "rechazada").slice(0, 1)
    .filter(c => !compras.some(o => o.estado !== "rechazada" && o.created_at > c.created_at));
  return `
    ${pend.map(c => `<div class="plan-alert" role="status"><strong>Pago en revisión:</strong> ${esc(c.paquete_nombre)} · ${dinero(c.monto, c.moneda)} por ${esc(METODOS_PAGO[c.metodo] || c.metodo)}. Te avisaremos cuando tu coach lo apruebe.</div>`).join("")}
    ${rech.map(c => `<div class="plan-alert warn" role="status"><strong>No pudimos validar tu pago</strong> de ${dinero(c.monto, c.moneda)}.${c.nota ? " " + esc(c.nota) : ""}</div>`).join("")}`;
}

/* ---------- Medidor de asistencia (fortalecimiento): horas desde el último check-in ---------- */
const MEDIDOR = [
  { max: 24, cls: "m1", etiqueta: "Hoy", txt: "Vas bien, recuerda descansar." },
  { max: 48, cls: "m2", etiqueta: "1 día", txt: "Bien, evalúa cómo te sientes y decide si entrenas o no." },
  { max: 72, cls: "m3", etiqueta: "2 días", txt: "Creo que ya deberías entrenar." },
  { max: 96, cls: "m4", etiqueta: "3 días", txt: "¿Todo bien? ¿Por qué no vienes a entrenar?" },
  { max: Infinity, cls: "m5", etiqueta: "4+ días", txt: "Tienes que venir a entrenar." }
];
function nivelMedidor(asistencias){
  const ult = (asistencias || []).map(a => new Date(a.checkin_at || `${a.fecha}T12:00:00`))
    .filter(d => !isNaN(d)).sort((a, b) => b - a)[0];
  if(!ult) return null;
  const horas = Math.max(0, (Date.now() - ult.getTime()) / 3600000);
  const i = MEDIDOR.findIndex(n => horas < n.max);
  return { ...MEDIDOR[i], i, horas };
}
/* Rueda de 5 tramos (uno por cada 24 h). Se encienden los tramos recorridos y un punto marca dónde estás. */
function ruedaSVG(n, tam){
  const pos = n ? Math.min(n.horas, 119) / 120 : 0;
  const ang = pos * 2 * Math.PI;
  const px = 60 + 48 * Math.sin(ang), py = 60 - 48 * Math.cos(ang);
  const dias = n ? Math.floor(n.horas / 24) : 0;
  const centro = !n ? `<text x="60" y="66" class="rueda-num">—</text>`
    : n.horas < 24 ? `<text x="60" y="62" class="rueda-num">${Math.floor(n.horas)}<tspan class="rueda-uni">h</tspan></text><text x="60" y="80" class="rueda-sub">hoy</text>`
    : `<text x="60" y="62" class="rueda-num">${dias}</text><text x="60" y="80" class="rueda-sub">${dias === 1 ? "día" : "días"}</text>`;
  return `<svg class="rueda-svg" viewBox="0 0 120 120" width="${tam}" height="${tam}" aria-hidden="true">
    <g transform="rotate(-90 60 60)">${MEDIDOR.map((x, i) => `
      <circle class="rueda-seg ${x.cls}${n && i <= n.i ? " on" : ""}${n && i === n.i ? " actual" : ""}" style="--i:${i}" cx="60" cy="60" r="48" pathLength="100" stroke-dasharray="18 82" stroke-dashoffset="${-(i * 20 + 1)}"></circle>`).join("")}
    </g>
    ${n ? `<circle class="rueda-punto ${n.cls}" cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="6"></circle>` : ""}
    ${centro}
  </svg>`;
}
function medidorHTML(asistencias){
  const n = nivelMedidor(asistencias);
  const hace = !n ? "" : n.horas < 1 ? "hace un momento" : n.horas < 24 ? `hace ${plural(Math.floor(n.horas), "hora", "horas")}` : `hace ${plural(Math.floor(n.horas / 24), "día", "días")}`;
  return `
    <div class="medidor ${n ? n.cls : "m0"}">
      <button type="button" class="rueda" data-rueda aria-label="${n ? `${esc(n.txt)} Último entrenamiento ${hace}.` : "Todavía no hay entrenamientos."} Ver qué significa cada color">
        ${ruedaSVG(n, 112)}
      </button>
      <div class="medidor-txt" role="status">
        <strong>${n ? esc(n.txt) : "Escanea el QR en tu primera visita."}</strong>
        <span>${n ? `Último entrenamiento: ${hace}` : "Aquí verás qué tan constante vas."}</span>
        <button type="button" class="link-inline medidor-ayuda" data-rueda>¿Qué significa cada color?</button>
      </div>
    </div>`;
}
function abrirRueda(asistencias){
  const n = nivelMedidor(asistencias);
  openDialog("Tu rueda de constancia", `
    <div class="rueda-grande ${n ? n.cls : "m0"}">${ruedaSVG(n, 180)}</div>
    <p class="muted" style="text-align:center;margin:6px 0 14px">Cuenta el tiempo desde tu último entrenamiento. Cada vez que escaneas el QR, vuelve a verde.</p>
    <ol class="rueda-leyenda">${MEDIDOR.map((x, i) => `
      <li class="${x.cls}${n && i === n.i ? " actual" : ""}"><i aria-hidden="true"></i>
        <span><strong>${i === 0 ? "Menos de 24 horas" : i === 4 ? "4 días o más" : `Más de ${i * 24} horas`}</strong>${esc(x.txt)}</span>
        ${n && i === n.i ? `<em>Estás aquí</em>` : ""}</li>`).join("")}
    </ol>`);
}

const ICONO_QR = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M8 8h3v3H8zM13 13h3v3h-3zM13 8h3M8 13v3"/></svg>`;
function botonEscanerHTML(){
  return `<button type="button" class="btn-primary btn-scan" data-escanear>${ICONO_QR}<span>Escanear QR</span></button>`;
}
function proximaReserva(plan){
  return (plan.reservas || []).filter(r => r.estado === "confirmada" && new Date(r.inicio) > new Date())
    .sort((a, b) => String(a.inicio).localeCompare(String(b.inicio)))[0] || null;
}

async function renderPlanAlumno(profile){
  const box = document.getElementById("planCard");
  if(!box) return;
  const cat = profile.categoria;
  const plan = await cargarPlanDe(profile.id, cat);
  if(!document.getElementById("planCard")) return;
  const saldoPrevio = state.plan && typeof state.plan.saldo === "number" ? state.plan.saldo : null;
  state.plan = plan;
  const inicio = profile.fecha_inicio ? `<span>En Gymnika desde el <strong>${fmtFecha(profile.fecha_inicio, true)}</strong></span>` : "";
  const prox = proximaReserva(plan);
  const proxHTML = `<p class="perfil-prox">${prox
    ? `${cat === "terapia" ? "Próxima sesión" : "Próximo entrenamiento"}: <strong>${fmtFechaHora(prox.inicio)}</strong>`
    : cat === "terapia" ? "No tienes sesiones reservadas. Elige un día en el calendario." : "No tienes horarios reservados. Reserva tu horario para poder entrar."}</p>`;

  if(cat === "terapia"){
    /* Cada reserva descuenta 1: si el saldo bajó desde la última vez, el número cae (único movimiento del panel) */
    const bajo = saldoPrevio !== null && plan.saldo < saldoPrevio;
    box.innerHTML = `
      <div class="perfil">
        <div class="perfil-saldo">
          <span class="plan-num num${bajo ? " baja" : ""}" id="saldoTokens">${plan.saldo}</span>
          <span class="plan-unit">${plan.saldo === 1 ? "sesión disponible" : "sesiones disponibles"}</span>
        </div>
        <div class="perfil-acciones">
          ${botonEscanerHTML()}
          <button type="button" class="btn-outline" id="btnComprar">Comprar sesiones</button>
        </div>
      </div>
      ${proxHTML}
      ${inicio ? `<div class="plan-meta muted">${inicio}</div>` : ""}
      ${avisoComprasHTML(plan.compras)}`;
  } else {
    const est = estadoMembresia(plan);
    const hoy = todayStr();
    let estadoHTML;
    if(est.congelado){
      estadoHTML = `<span class="plan-num plan-word">Congelado</span><span class="plan-unit">hasta el ${fmtFecha(est.congelado.hasta, true)} · vence el ${fmtFecha(est.finTotal, true)}</span>`;
    } else if(est.vigente){
      const quedan = diasEntre(hoy, est.finTotal) + 1;
      estadoHTML = `<span class="plan-num plan-word">Activo</span><span class="plan-unit">hasta el ${fmtFecha(est.finTotal, true)} · ${plural(quedan, "día", "días")}</span>`;
    } else if(est.futura){
      estadoHTML = `<span class="plan-num plan-word">Desde el ${fmtFecha(est.futura.inicio, false)}</span><span class="plan-unit">hasta el ${fmtFecha(est.finTotal, true)}</span>`;
    } else {
      estadoHTML = `<span class="plan-num plan-word off">${est.ultima ? "Vencido" : "Sin acceso"}</span><span class="plan-unit">${est.ultima ? "venció el " + fmtFecha(est.ultima.fin, true) : "Compra tu acceso mensual para empezar"}</span>`;
    }
    const asistMes = plan.asistencias.filter(a => String(a.fecha).startsWith(hoy.slice(0, 7))).length;
    box.innerHTML = `
      <div class="perfil">
        <div class="plan-big">${estadoHTML}</div>
        <div class="perfil-acciones">
          ${botonEscanerHTML()}
          <button type="button" class="btn-outline" id="btnComprar">${est.vigente || est.futura ? "Renovar acceso" : "Comprar acceso mensual"}</button>
        </div>
      </div>
      ${medidorHTML(plan.asistencias)}
      ${proxHTML}
      <div class="plan-meta muted">${inicio}<span>Entrenamientos este mes: <strong>${asistMes}</strong></span>
        ${plan.congelamientos.length ? `<span>Congelamientos: <strong>${plan.congelamientos.length}</strong></span>` : ""}</div>
      ${suscripcionHTML(plan, false)}
      ${avisoComprasHTML(plan.compras)}
      ${plan.congelamientos.length ? `
      <details class="records"><summary>Congelamientos (${plan.congelamientos.length})</summary>
        <ul class="mov-list">${plan.congelamientos.map(c => `<li><span class="mov-txt">Del ${fmtFecha(c.desde)} al ${fmtFecha(c.hasta)}${c.motivo ? " · " + esc(c.motivo) : ""}</span></li>`).join("")}</ul>
      </details>` : ""}`;
  }
  document.getElementById("btnComprar").onclick = ()=> abrirCompra(profile);
  box.querySelectorAll("[data-escanear]").forEach(b => { b.onclick = abrirEscanerQR; });
  box.querySelectorAll("[data-rueda]").forEach(b => { b.onclick = ()=> abrirRueda(plan.asistencias); });
  mostrarConsejoDelDia();
}

/* Consejo del día en una ventana: solo la primera vez que el alumno abre la app cada día */
function mostrarConsejoDelDia(){
  if(planes.consejoListo) return;
  planes.consejoListo = true;
  const clave = "gymnika_consejo_" + todayStr();
  try { if(localStorage.getItem(clave)) return; } catch { /* sin almacenamiento: se muestra igual */ }
  setTimeout(()=>{
    if(!document.getElementById("athleteMain")) return;
    if(document.querySelector(".overlay")){ planes.consejoListo = false; return; } // otra ventana abierta (ej. check-in): se intenta después
    const tip = tipDelDia();
    const d = openDialog("Consejo del día", `
      <div class="consejo-pop">
        <span class="consejo-ico" aria-hidden="true">✦</span>
        <p class="consejo-titulo">${esc(tip.titulo)}</p>
        <p class="consejo-texto">${esc(tip.texto)}</p>
      </div>
      <button type="button" class="btn-primary" data-ok-consejo>¡Entendido!</button>`);
    d.el.classList.add("consejo-overlay");
    const ok = d.el.querySelector("[data-ok-consejo]");
    ok.onclick = d.close; ok.focus();
    try { localStorage.setItem(clave, "1"); } catch { /* sin almacenamiento */ }
  }, 800);
}

function movimientoTexto(m){
  if(m.motivo === "compra") return "Compra" + (m.nota ? ": " + m.nota : "");
  if(m.motivo === "reserva") return m.nota === "Lista de espera" ? "Reserva (desde lista de espera)" : "Reserva de sesión";
  if(m.motivo === "devolucion") return "Devolución por cancelación";
  return "Ajuste del coach" + (m.nota ? ": " + m.nota : "");
}

/* ---------- Comprar sesiones o acceso (Yape / Plin / transferencia) ---------- */
async function abrirCompra(profile){
  const [aj, paquetes] = await Promise.all([cargarAjustes(true), cargarPaquetes(true)]);
  const lista = paquetes.filter(p => p.activo && p.categoria === profile.categoria);
  if(!lista.length){ openDialog("Comprar", emptyHTML("Todavía no hay paquetes disponibles. Escríbele a tu coach.")); return; }
  const base = lista.find(p => p.sesiones === 1);
  const esSusc = (p)=> p.modalidad === "suscripcion";
  const cuentas = [
    aj.yape_numero ? `<li><strong>Yape:</strong> <span class="num">${esc(aj.yape_numero)}</span></li>` : "",
    aj.plin_numero ? `<li><strong>Plin:</strong> <span class="num">${esc(aj.plin_numero)}</span></li>` : ""
  ].join("");
  const precioPaquete = (p)=> esSusc(p) ? `${dinero(p.precio, p.moneda)}<small> /mes</small>` : dinero(p.precio, p.moneda);
  const detallePaquete = (p)=>{
    if(esSusc(p)) return `${p.cuotas} cobros mensuales · total ${dinero(p.precio * p.cuotas, p.moneda)} · Mercado Pago`;
    if(p.categoria === "terapia"){
      const porSesion = p.sesiones > 1 ? " · " + dinero(Math.round(p.precio / p.sesiones * 100) / 100, p.moneda) + " por sesión" : "";
      return plural(p.sesiones, "sesión", "sesiones") + porSesion;
    }
    return plural(p.dias, "día", "días") + " de acceso · pago único";
  };
  const dlg = openDialog(profile.categoria === "terapia" ? "Comprar sesiones" : "Comprar acceso", `
    <form id="compraForm" novalidate>
      <p class="step-title"><span class="step-n">1</span>Elige tu plan</p>
      <div class="pack-grid" role="radiogroup" aria-label="Planes">
        ${lista.map((p, i) => {
          const ahorro = base && p.sesiones > 1 && base.precio * p.sesiones > p.precio ? Math.round((1 - p.precio / (base.precio * p.sesiones)) * 100) : 0;
          return `
          <label class="pack">
            <input type="radio" name="paquete" value="${esc(p.id)}" ${i === 0 ? "checked" : ""}>
            <span class="pack-body">
              <span class="pack-name">${esc(p.nombre)}</span>
              <span class="pack-price num">${precioPaquete(p)}</span>
              <span class="pack-sub">${detallePaquete(p)}</span>
              ${ahorro >= 3 ? `<span class="pack-save">Ahorras ${ahorro}%</span>` : ""}
            </span>
          </label>`; }).join("")}
      </div>
      <div id="pagoUnico">
        <p class="step-title"><span class="step-n">2</span>Paga <strong id="montoPagar"></strong></p>
        <p class="muted" id="notaCambio" style="margin:-2px 0 10px;font-size:14px">Por Yape o Plin, paga el equivalente en soles al tipo de cambio del día.</p>
        ${cuentas ? `<ul class="pay-accounts">${cuentas}</ul>${aj.titular_pago ? `<p class="muted">A nombre de: ${esc(aj.titular_pago)}</p>` : ""}`
          : `<p class="plan-alert warn">El centro todavía no registró su número de Yape o Plin. Pregúntale a tu coach cómo pagar.</p>`}
        <p class="step-title"><span class="step-n">3</span>Envía tu comprobante</p>
        <div class="row">
          <div><label for="cpMetodo" style="margin-top:4px">Pagaste con</label>
            <select id="cpMetodo">${["yape", "plin", "transferencia"].map(k => `<option value="${k}">${METODOS_PAGO[k]}</option>`).join("")}</select></div>
          <div><label for="cpOperacion" style="margin-top:4px">N.° de operación <span class="muted">(opcional)</span></label>
            <input id="cpOperacion" inputmode="numeric" autocomplete="off" placeholder="Ej: 12345678"></div>
        </div>
        <label for="cpArchivo">Captura del pago</label>
        <input type="file" id="cpArchivo" accept="image/*,application/pdf">
        <p class="muted" style="margin-top:6px">Sube la captura de pantalla de Yape/Plin o escribe el número de operación.</p>
        <button type="submit" class="btn-primary" id="btnEnviarPago">Enviar comprobante</button>
      </div>
      <div id="pagoMP" hidden>
        <p class="step-title"><span class="step-n">2</span>Suscríbete con Mercado Pago</p>
        <p id="mpResumen"></p>
        <p class="muted" style="margin-top:6px">Pagas con tarjeta o Yape dentro de Mercado Pago. Cada cobro mensual activa 30 días de acceso y te avisamos en el inbox. Si un cobro falla, Mercado Pago lo reintenta.</p>
        <label for="mpEmail">Email de tu cuenta de Mercado Pago</label>
        <input type="email" id="mpEmail" autocomplete="email" inputmode="email" value="${esc((state.session && state.session.user && state.session.user.email) || "")}" placeholder="nombre@correo.com">
        <p class="muted" style="margin-top:6px">Debe ser el mismo email con el que entras a Mercado Pago.</p>
        <button type="button" class="btn-primary" id="btnIrMP">Continuar a Mercado Pago</button>
      </div>
      <div id="compraMsg" aria-live="polite"></div>
    </form>`);
  const form = dlg.el.querySelector("#compraForm");
  const elegido = ()=> lista.find(x => x.id === (form.querySelector('input[name="paquete"]:checked') || {}).value);
  const pintar = ()=>{
    const p = elegido(); if(!p) return;
    dlg.el.querySelector("#pagoUnico").hidden = esSusc(p);
    dlg.el.querySelector("#pagoMP").hidden = !esSusc(p);
    dlg.el.querySelector("#montoPagar").textContent = dinero(p.precio, p.moneda);
    dlg.el.querySelector("#notaCambio").hidden = p.moneda === "PEN";
    if(esSusc(p)) dlg.el.querySelector("#mpResumen").innerHTML = `Se cobrará <strong>${dinero(p.precio, p.moneda)} cada mes durante ${p.cuotas} meses</strong> (total ${dinero(p.precio * p.cuotas, p.moneda)}).`;
    dlg.el.querySelector("#compraMsg").innerHTML = "";
  };
  form.querySelectorAll('input[name="paquete"]').forEach(r => { r.onchange = pintar; });
  pintar();
  const bMP = dlg.el.querySelector("#btnIrMP");
  bMP.onclick = ()=> withBusy(bMP, "Abriendo Mercado Pago…", async ()=>{
    const msg = dlg.el.querySelector("#compraMsg");
    const email = dlg.el.querySelector("#mpEmail").value.trim();
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){ showMsg(msg, "error", "Escribe el email de tu cuenta de Mercado Pago."); return; }
    const { data, error } = await sb.functions.invoke("mp-suscribir", { body: { paquete_id: elegido().id, email } });
    if(error || !data || !data.init_point){
      let texto = "No se pudo conectar con Mercado Pago. Inténtalo de nuevo.";
      try { const det = error && error.context && await error.context.json(); if(det && det.error) texto = det.error; } catch { /* respuesta sin detalle */ }
      showMsg(msg, "error", texto); return;
    }
    location.href = data.init_point;
  });
  form.onsubmit = (e)=>{
    e.preventDefault();
    if(esSusc(elegido())) return;
    const btn = dlg.el.querySelector("#btnEnviarPago");
    withBusy(btn, "Enviando…", async ()=>{
      const msg = dlg.el.querySelector("#compraMsg");
      const paqueteId = (elegido() || {}).id;
      const metodo = dlg.el.querySelector("#cpMetodo").value;
      const operacion = dlg.el.querySelector("#cpOperacion").value.trim();
      const archivo = dlg.el.querySelector("#cpArchivo").files[0];
      if(!paqueteId){ showMsg(msg, "error", "Elige un paquete."); return; }
      if(!archivo && !operacion){ showMsg(msg, "error", "Sube la captura del pago o escribe el número de operación."); return; }
      let path = null;
      if(archivo){
        const listo = await prepararComprobante(archivo);
        if(listo.size > 5 * 1024 * 1024){ showMsg(msg, "error", "La imagen pesa más de 5 MB. Envía una captura de pantalla."); return; }
        const ext = (listo.type.split("/")[1] || "jpg").replace("jpeg", "jpg").replace(/[^a-z0-9]/g, "");
        path = `${profile.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await sb.storage.from("comprobantes").upload(path, listo, { contentType: listo.type, upsert: false });
        if(upErr){ showError(msg, upErr); return; }
      }
      const { error } = await sb.from("compras").insert({
        user_id: profile.id, paquete_id: paqueteId, metodo, operacion: operacion || null, comprobante_path: path,
        categoria: profile.categoria, paquete_nombre: "-", monto: 0
      });
      if(error){ showError(msg, error); return; }
      form.innerHTML = `
        <div class="done-box">
          <span class="done-icon" aria-hidden="true">✓</span>
          <h3>Recibimos tu comprobante</h3>
          <p>Tu coach lo revisará y te avisaremos aquí apenas esté aprobado. ${profile.categoria === "terapia" ? "Las sesiones se suman a tu saldo." : "Tu acceso se activa al aprobarse."}</p>
          <button type="button" class="btn-primary" data-close-done>Entendido</button>
        </div>`;
      form.querySelector("[data-close-done]").onclick = ()=> dlg.close();
      renderPlanAlumno(profile);
    });
  };
}

/* Reduce fotos pesadas antes de subirlas (si el navegador puede leerlas) */
async function prepararComprobante(file){
  if(!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 1.2 * 1024 * 1024) return file;
  try{
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, "image/jpeg", 0.85));
    return blob ? new File([blob], "comprobante.jpg", { type: "image/jpeg" }) : file;
  } catch { return file; }
}

/* ====================== ALUMNO: RESERVAR EN EL CALENDARIO (TERAPIA Y FORTALECIMIENTO) ======================
   Terapia: cada reserva usa 1 sesión y hay lista de espera. Fortalecimiento: reservar es obligatorio para entrar,
   no usa sesiones y solo se puede en días que cubre el acceso mensual. Se reserva hasta el último día del mes siguiente. */
const MESES_LARGOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const reservaUI = { mes: null, dia: null };

function limiteReserva(){
  const h = new Date();
  return fechaISO(new Date(h.getFullYear(), h.getMonth() + 2, 0));
}
function cubreAcceso(plan, iso){
  return (plan.membresias || []).some(m => m.inicio <= iso && m.fin >= iso)
    && !(plan.congelamientos || []).some(c => c.desde <= iso && c.hasta >= iso);
}
function fechaLarga(iso){
  const d = parseFecha(iso);
  return `${DIAS_SEMANA[isoDow(d)]} ${d.getDate()} de ${MESES_LARGOS[d.getMonth()]}`;
}

async function renderReservasAlumno(profile){
  const box = document.getElementById("reservarCard");
  if(!box) return;
  const cat = profile.categoria;
  const esTer = cat === "terapia";
  const [aj, horarios] = await Promise.all([cargarAjustes(), cargarHorarios()]);
  const hs = horarios.filter(h => h.activo && h.categoria === cat);
  if(!hs.length){ box.innerHTML = emptyHTML(`Todavía no hay horarios de ${esTer ? "terapia" : "fortalecimiento"} publicados.`); renderMisReservas(profile); return; }

  const hoyISO = todayStr();
  const limISO = limiteReserva();
  const mesMin = hoyISO.slice(0, 7), mesMax = limISO.slice(0, 7);
  if(!reservaUI.mes || reservaUI.mes < mesMin || reservaUI.mes > mesMax) reservaUI.mes = mesMin;
  const [y, mo] = reservaUI.mes.split("-").map(Number);
  const primero = new Date(y, mo - 1, 1), ultimo = new Date(y, mo, 0);
  const ahora = new Date();
  const delDia = (iso)=> hs.filter(h => h.dia_semana === isoDow(parseFecha(iso)));
  const futurosDe = (iso)=> delDia(iso).filter(h => inicioLocal(iso, h.hora) > ahora);

  const desde = fechaISO(primero) < hoyISO ? hoyISO : fechaISO(primero);
  const [{ data: ocup }, plan] = await Promise.all([
    sb.rpc("ocupacion", { p_desde: desde, p_hasta: fechaISO(ultimo) }),
    state.plan ? Promise.resolve(state.plan) : cargarPlanDe(profile.id, cat)
  ]);
  if(!document.getElementById("reservarCard")) return;
  const mias = (plan.reservas || []).filter(r => ["confirmada", "espera", "asistio"].includes(r.estado));
  const saldo = plan.saldo || 0;

  /* Día elegido: el que ya estaba o el primero del mes con horarios por delante */
  const enMes = (iso)=> iso.slice(0, 7) === reservaUI.mes;
  if(!reservaUI.dia || !enMes(reservaUI.dia) || reservaUI.dia < hoyISO){
    reservaUI.dia = null;
    for(let d = new Date(Math.max(primero, parseFecha(hoyISO))); d <= ultimo; d = sumarDias(d, 1)){
      if(futurosDe(fechaISO(d)).length){ reservaUI.dia = fechaISO(d); break; }
    }
    reservaUI.dia = reservaUI.dia || (enMes(hoyISO) ? hoyISO : fechaISO(primero));
  }

  const celdas = [];
  for(let i = 1; i < isoDow(primero); i++) celdas.push(`<span class="cal-cell vacio" aria-hidden="true"></span>`);
  for(let n = 1; n <= ultimo.getDate(); n++){
    const iso = fechaISO(new Date(y, mo - 1, n));
    const disp = iso >= hoyISO && iso <= limISO && futurosDe(iso).length > 0;
    const mia = mias.some(r => r.fecha === iso);
    const sinAcceso = disp && !esTer && !cubreAcceso(plan, iso);
    const cls = ["cal-cell", disp ? "disp" : "off", mia ? "mia" : "", sinAcceso ? "sin-acceso" : "", iso === hoyISO ? "hoy" : "", iso === reservaUI.dia ? "sel" : ""].filter(Boolean).join(" ");
    const etiqueta = `${fechaLarga(iso)}${mia ? ", tienes reserva" : ""}${disp ? (sinAcceso ? ", fuera de tu acceso" : "") : ", sin horarios"}`;
    celdas.push(`<button type="button" class="${cls}" data-dia="${iso}" aria-pressed="${iso === reservaUI.dia}" aria-label="${etiqueta}"${disp || (mia && iso >= hoyISO) ? "" : " disabled"}>
      <span class="num">${n}</span>${mia ? '<i class="cal-dot" aria-hidden="true"></i>' : ""}</button>`);
  }

  box.innerHTML = `
    ${esTer ? "" : horarioFijoHTML(plan, hs)}
    <div class="cal">
      <div class="cal-head">
        <button type="button" class="icon-btn" id="calPrev" aria-label="Mes anterior"${reservaUI.mes <= mesMin ? " disabled" : ""}>‹</button>
        <h3 class="cal-mes" aria-live="polite">${MESES_LARGOS[mo - 1]} <span class="num">${y}</span></h3>
        <button type="button" class="icon-btn" id="calNext" aria-label="Mes siguiente"${reservaUI.mes >= mesMax ? " disabled" : ""}>›</button>
      </div>
      <div class="cal-grid" role="group" aria-label="Días de ${MESES_LARGOS[mo - 1]}">
        ${["L", "M", "M", "J", "V", "S", "D"].map(x => `<span class="cal-dow" aria-hidden="true">${x}</span>`).join("")}
        ${celdas.join("")}
      </div>
      <p class="cal-leyenda muted"><span><i class="lg lg-disp"></i>Con horarios</span><span><i class="lg lg-mia"></i>Tu reserva</span>${esTer ? "" : `<span><i class="lg lg-sin"></i>Fuera de tu acceso</span>`}</p>
    </div>
    <div class="cal-dia" id="calDia" aria-live="polite"></div>
    ${esTer && saldo < 1 ? `<div class="plan-alert" style="margin-top:12px">No tienes sesiones disponibles. <button type="button" class="link-inline" id="btnComprarDesdeReservas">Compra un paquete</button> para reservar.</div>` : ""}
    <div id="reservarMsg" aria-live="polite"></div>`;

  const pintarDia = ()=>{
    const iso = reservaUI.dia;
    const diaBox = document.getElementById("calDia");
    const misDelDia = mias.filter(r => r.fecha === iso).map(r => r.horario_id);
    const slots = delDia(iso).filter(h => inicioLocal(iso, h.hora) > ahora || misDelDia.includes(h.id));
    const sinAcceso = !esTer && !cubreAcceso(plan, iso);
    diaBox.innerHTML = `
      <h3 class="cal-dia-t">${fechaLarga(iso)}${iso === hoyISO ? " · hoy" : ""}</h3>
      ${!slots.length ? emptyHTML(iso < hoyISO ? "Este día ya pasó." : "No hay horarios disponibles este día. Elige otro.") : ""}
      ${slots.length && sinAcceso ? `<p class="plan-alert warn">Tu acceso mensual no cubre este día. <button type="button" class="link-inline" data-comprar>Renuévalo</button> para reservar.</p>` : ""}
      <ul class="slot-list">
        ${slots.map(h => {
          const o = (ocup || []).find(x => x.horario_id === h.id && x.fecha === iso) || { confirmadas: 0, en_espera: 0, lugares: [] };
          const mia = mias.find(r => r.horario_id === h.id && r.fecha === iso);
          const pasado = inicioLocal(iso, h.hora) <= ahora;
          const libres = Math.max(0, h.aforo - o.confirmadas);
          const lleno = libres === 0;
          const pct = Math.min(100, Math.round(o.confirmadas / h.aforo * 100));
          let accion;
          if(mia) accion = `<span class="slot-tag ${mia.estado === "espera" ? "wait" : "ok"}">${mia.estado === "espera" ? "En lista de espera" : mia.estado === "asistio" ? "Asististe ✓" : "Reservado ✓"}</span>`;
          else if(pasado) accion = `<span class="slot-tag off">Ya pasó</span>`;
          else if(sinAcceso) accion = `<span class="slot-tag off">Sin acceso</span>`;
          else if(lleno && !esTer) accion = `<span class="slot-tag off">Lleno</span>`;
          else accion = `<button type="button" class="${lleno ? "btn-outline" : "btn-primary"} slot-btn" data-reservar="${esc(h.id)}">${lleno ? "Lista de espera" : "Reservar"}</button>`;
          return `
          <li class="slot${lleno ? " full" : ""}${pasado ? " past" : ""}${mia ? " mine" : ""}">
            <div class="slot-time"><span class="num">${horaCorta(h.hora)}</span><span class="muted">${h.duracion_min} min</span></div>
            <div class="slot-cap">
              ${aj.mostrar_aforo
                ? `<span class="cap-txt">${lleno ? "Lleno" : plural(libres, "cupo libre", "cupos libres")}<span class="muted"> · ${o.confirmadas}/${h.aforo}</span></span>
                   <span class="cap-bar" aria-hidden="true"><span style="width:${pct}%"></span></span>`
                : `<span class="cap-txt">${lleno ? "Lleno" : "Hay cupos"}</span>`}
              ${lleno && o.en_espera ? `<span class="muted cap-wait">${plural(o.en_espera, "persona", "personas")} en espera</span>` : ""}
            </div>
            <div class="slot-act">${accion}</div>
          </li>`; }).join("")}
      </ul>`;
    diaBox.querySelectorAll("[data-comprar]").forEach(b => { b.onclick = ()=> abrirCompra(profile); });
    diaBox.querySelectorAll("[data-reservar]").forEach(b => {
      b.onclick = ()=>{
        const h = slots.find(x => x.id === b.dataset.reservar);
        const o = (ocup || []).find(x => x.horario_id === h.id && x.fecha === iso) || { confirmadas: 0, lugares: [] };
        confirmarReserva(profile, h, iso, o, aj, saldo);
      };
    });
  };
  pintarDia();

  const cambiarMes = (delta)=>{
    const d = new Date(y, mo - 1 + delta, 1);
    reservaUI.mes = fechaISO(d).slice(0, 7); reservaUI.dia = null;
    renderReservasAlumno(profile);
  };
  document.getElementById("calPrev").onclick = ()=> cambiarMes(-1);
  document.getElementById("calNext").onclick = ()=> cambiarMes(1);
  box.querySelectorAll(".cal-grid [data-dia]").forEach(b => {
    b.onclick = ()=>{
      reservaUI.dia = b.dataset.dia;
      box.querySelectorAll(".cal-grid [data-dia]").forEach(x => { const on = x === b; x.classList.toggle("sel", on); x.setAttribute("aria-pressed", String(on)); });
      pintarDia();
      const diaBox = document.getElementById("calDia");
      if(window.matchMedia("(max-width: 700px)").matches) diaBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
    };
  });
  const bc = document.getElementById("btnComprarDesdeReservas");
  if(bc) bc.onclick = ()=> abrirCompra(profile);
  const bf = document.getElementById("btnHorarioFijo");
  if(bf) bf.onclick = ()=> abrirHorarioFijo(profile, plan, hs);
  renderMisReservas(profile);
}

/* ---------- Fortalecimiento: horario fijo semanal (una hora por día; se reserva solo cada semana) ---------- */
function horarioFijoHTML(plan, hs){
  const elegidos = hs.filter(h => (plan.fijo || []).some(f => f.horario_id === h.id)).sort((a, b) => a.dia_semana - b.dia_semana);
  return `
    <div class="fijo${elegidos.length ? " on" : ""}">
      <div class="fijo-txt">
        <p class="fijo-t">Mi horario fijo</p>
        ${elegidos.length
          ? `<ul class="fijo-chips">${elegidos.map(h => `<li><span>${DIAS_SEMANA[h.dia_semana].slice(0, 3)}</span><strong class="num">${horaCorta(h.hora)}</strong></li>`).join("")}</ul>
             <p class="muted">Se reserva solo cada semana mientras tengas acceso.</p>`
          : `<p class="muted">Elige una hora por día y la app te reserva todas las semanas.</p>`}
      </div>
      <button type="button" class="${elegidos.length ? "btn-outline" : "btn-primary"} fijo-btn" id="btnHorarioFijo">${elegidos.length ? "Cambiar" : "Elegir mi horario fijo"}</button>
    </div>`;
}
function abrirHorarioFijo(profile, plan, hs){
  const dias = [...new Set(hs.map(h => h.dia_semana))].sort((a, b) => a - b);
  const actual = (plan.fijo || []).map(f => f.horario_id);
  const d = openDialog("Mi horario fijo", `
    <p class="muted" style="margin-top:0">Elige a qué hora vienes cada día. Te reservamos esa hora todas las semanas hasta que venza tu acceso. Si un día no puedes venir, cancela solo esa reserva.</p>
    <form id="fijoForm" class="fijo-form">
      ${dias.map(dw => `
        <fieldset class="fijo-dia">
          <legend>${DIAS_SEMANA[dw]}</legend>
          <div class="fijo-horas">
            <label class="fijo-op"><input type="radio" name="d${dw}" value="" ${hs.some(h => h.dia_semana === dw && actual.includes(h.id)) ? "" : "checked"}><span>No vengo</span></label>
            ${hs.filter(h => h.dia_semana === dw).map(h => `
              <label class="fijo-op"><input type="radio" name="d${dw}" value="${esc(h.id)}" ${actual.includes(h.id) ? "checked" : ""}><span class="num">${horaCorta(h.hora)}</span></label>`).join("")}
          </div>
        </fieldset>`).join("")}
      <button type="submit" class="btn-primary" id="btnGuardarFijo">Guardar horario fijo</button>
      <div id="fijoMsg" aria-live="polite"></div>
    </form>`);
  const form = d.el.querySelector("#fijoForm");
  form.onsubmit = (e)=>{
    e.preventDefault();
    const btn = d.el.querySelector("#btnGuardarFijo");
    withBusy(btn, "Guardando…", async ()=>{
      const ids = [...form.querySelectorAll('input[type="radio"]:checked')].map(i => i.value).filter(Boolean);
      const { data, error } = await sb.rpc("guardar_horario_fijo", { p_horarios: ids });
      if(error){ showError(d.el.querySelector("#fijoMsg"), error); return; }
      d.close();
      await refrescarReservas(profile);
      const r = typeof data === "string" ? JSON.parse(data) : (data || {});
      const partes = [];
      if(!ids.length) partes.push("Quitaste tu horario fijo.");
      else if(!r.hasta) partes.push("Horario guardado. Se reservará apenas tengas tu acceso activo.");
      else if(r.reservadas) partes.push(`Listo: ${plural(r.reservadas, "reserva nueva", "reservas nuevas")} hasta el ${fmtFecha(r.hasta, true)}.`);
      else partes.push(`Horario guardado. Tus reservas están listas hasta el ${fmtFecha(r.hasta, true)}.`);
      if(r.llenas) partes.push(`${plural(r.llenas, "día estaba lleno", "días estaban llenos")}: elige otra hora para esos días en el calendario.`);
      if(r.canceladas) partes.push(`Se cancelaron ${plural(r.canceladas, "reserva", "reservas")} del horario anterior.`);
      showMsg(document.getElementById("reservarMsg"), "ok", partes.join(" "));
    });
  };
}

function limiteCancelacion(inicio, aj){
  return new Date(new Date(inicio).getTime() - (aj.horas_cancelacion || 24) * 3600000);
}

function confirmarReserva(profile, h, fecha, o, aj, saldo){
  const esTer = profile.categoria === "terapia";
  const ini = inicioLocal(fecha, h.hora);
  const lleno = o.confirmadas >= h.aforo;
  const limite = limiteCancelacion(ini, aj);
  if(esTer && saldo < 1){
    const d = openDialog("Necesitas sesiones", `<p>Para reservar necesitas al menos 1 sesión disponible.</p><button type="button" class="btn-primary" id="dlgComprar">Comprar sesiones</button>`);
    d.el.querySelector("#dlgComprar").onclick = ()=>{ d.close(); abrirCompra(profile); };
    return;
  }
  const lugaresHTML = (esTer && !lleno && aj.seleccion_lugar) ? `
    <p class="step-title" style="margin-top:14px">Elige tu lugar</p>
    <div class="spot-grid">${Array.from({ length: h.aforo }, (_, i) => i + 1).map(n => {
      const ocupado = (o.lugares || []).includes(n);
      return `<label class="spot${ocupado ? " taken" : ""}"><input type="radio" name="lugar" value="${n}" ${ocupado ? "disabled" : ""}><span class="num">${n}</span></label>`;
    }).join("")}</div>` : "";
  const reglas = esTer
    ? `${lleno
        ? `<p>Este horario está lleno. Si se libera un cupo, tu reserva se confirma sola y se usa 1 sesión de tu saldo. Te avisaremos en el inbox.</p>`
        : `<p>Se usará <strong>1 sesión</strong> de tu saldo (te quedarán ${saldo - 1}).</p>`}
       <p class="muted">Puedes cancelar sin costo hasta el <strong>${fmtFechaHora(limite.toISOString())}</strong>. Después de eso, o si no asistes, la sesión se pierde.</p>`
    : `<p>Tu cupo queda guardado. Al llegar, escanea el QR de recepción desde la app.</p>
       <p class="muted">Si no puedes venir, cancela antes de la hora para liberar tu cupo.</p>`;
  const d = openDialog(lleno ? "Unirte a la lista de espera" : esTer ? "Confirmar reserva" : "Confirmar horario", `
    <div class="confirm-slot">
      <span class="cs-day">${DIAS_SEMANA[h.dia_semana]} ${ini.getDate()} de ${MESES_LARGOS[ini.getMonth()]}</span>
      <span class="cs-time num">${horaCorta(h.hora)}</span>
      <span class="muted">${h.duracion_min} minutos · ${esTer ? "Terapia" : "Fortalecimiento"}</span>
    </div>
    ${reglas}
    ${lugaresHTML}
    <button type="button" class="btn-primary" id="btnConfirmarReserva">${lleno ? "Unirme a la lista de espera" : "Confirmar reserva"}</button>
    <div id="confirmMsg" aria-live="polite"></div>`);
  const btn = d.el.querySelector("#btnConfirmarReserva");
  btn.onclick = ()=> withBusy(btn, "Reservando…", async ()=>{
    const lugarSel = d.el.querySelector('input[name="lugar"]:checked');
    if(lugaresHTML && !lugarSel){ showMsg(d.el.querySelector("#confirmMsg"), "error", "Elige un lugar."); return; }
    const { data, error } = await sb.rpc("reservar", { p_horario: h.id, p_fecha: fecha, p_lugar: lugarSel ? Number(lugarSel.value) : null });
    if(error){ showError(d.el.querySelector("#confirmMsg"), error); return; }
    d.close();
    await refrescarReservas(profile);
    const res = typeof data === "string" ? JSON.parse(data) : data;
    showMsg(document.getElementById("reservarMsg"), "ok", res && res.estado === "espera"
      ? `Estás en la lista de espera (puesto ${res.posicion}). Te avisaremos si se libera un cupo.`
      : `Reserva confirmada: ${fmtFechaHora(ini.toISOString())}${res && res.lugar ? " · lugar " + res.lugar : ""}.`);
  });
}

async function refrescarReservas(profile){
  await renderPlanAlumno(profile);
  await renderReservasAlumno(profile);
}

function renderMisReservas(profile){
  const box = document.getElementById("misReservasCard");
  if(!box) return;
  const esTer = profile.categoria === "terapia";
  const aj = planes.ajustes || { horas_cancelacion: 24 };
  const horarios = planes.horarios || [];
  const ahora = new Date();
  const todas = (state.plan && state.plan.reservas) || [];
  const proximas = todas.filter(r => ["confirmada","espera"].includes(r.estado) && new Date(r.inicio) > new Date(ahora.getTime() - 90 * 60000))
    .sort((a,b)=> String(a.inicio).localeCompare(String(b.inicio)));
  const pasadas = todas.filter(r => !proximas.includes(r)).slice(0, 30);
  const durDe = (r)=> (horarios.find(h => h.id === r.horario_id) || {}).duracion_min || 60;
  const estadoVisible = (r)=> (r.estado === "confirmada" && new Date(new Date(r.inicio).getTime() + durDe(r) * 60000) < ahora) ? "no_asistio" : r.estado;
  const regla = (r)=>{
    const empezo = new Date(r.inicio) <= ahora;
    if(r.estado === "espera") return "Si se libera un cupo, se confirma sola.";
    if(empezo) return "Registra tu asistencia con el botón Escanear QR.";
    if(!esTer) return "Si no puedes venir, cancela para liberar tu cupo.";
    const limite = limiteCancelacion(r.inicio, aj);
    return limite > ahora ? `Cancelación sin costo hasta el ${fmtFechaHora(limite.toISOString())}.` : "Si cancelas ahora, la sesión se pierde.";
  };
  box.innerHTML = `
    ${proximas.length ? `<ul class="res-list">${proximas.map(r => `
      <li class="res-item">
        <div class="res-when"><strong>${fmtFechaHora(r.inicio)}</strong>
          <span class="badge ${r.estado === "espera" ? "outline" : ""}">${ESTADO_RESERVA[r.estado]}</span>${r.lugar ? `<span class="badge soft">Lugar ${r.lugar}</span>` : ""}</div>
        <p class="muted res-rule">${regla(r)}</p>
        ${new Date(r.inicio) <= ahora ? "" : `<button type="button" class="btn-danger" data-cancelar="${esc(r.id)}">${r.estado === "espera" ? "Salir de la lista" : "Cancelar"}</button>`}
      </li>`).join("")}</ul>`
      : emptyHTML(esTer ? "No tienes reservas próximas." : "No tienes horarios reservados. Sin reserva, el QR no registra tu entrada.")}
    <div class="qr-hint"><span class="qr-ico" aria-hidden="true">▣</span><span>Al llegar, toca <strong>Escanear QR</strong> y apunta al código de recepción para registrar tu asistencia.</span></div>
    ${pasadas.length ? `<details class="records"><summary>Historial (${pasadas.length})</summary>
      <ul class="mov-list">${pasadas.map(r => `<li><span class="mov-txt">${fmtFechaHora(r.inicio)}</span><span class="res-state st-${estadoVisible(r)}">${ESTADO_RESERVA[estadoVisible(r)]}</span></li>`).join("")}</ul></details>` : ""}
    <div id="misResMsg" aria-live="polite"></div>`;
  box.querySelectorAll("[data-cancelar]").forEach(b => {
    b.onclick = ()=>{
      const r = proximas.find(x => x.id === b.dataset.cancelar);
      const enPlazo = limiteCancelacion(r.inicio, aj) > new Date();
      const d = openDialog(r.estado === "espera" ? "Salir de la lista de espera" : "Cancelar reserva", `
        <p><strong>${fmtFechaHora(r.inicio)}</strong></p>
        ${r.estado === "espera" ? "<p>Saldrás de la lista de espera. No se descuenta nada.</p>"
          : !esTer ? "<p>Se libera tu cupo para otra persona. Puedes reservar otro horario cuando quieras.</p>"
          : enPlazo ? `<p>Estás dentro del plazo: <strong>la sesión vuelve a tu saldo</strong>.</p>`
          : `<p class="plan-alert warn">Faltan menos de ${aj.horas_cancelacion} horas: <strong>si cancelas, la sesión se pierde</strong>.</p>`}
        <button type="button" class="btn-primary danger-fill" id="btnSiCancelar">Sí, cancelar</button>
        <button type="button" class="btn-link" id="btnNoCancelar" style="margin-top:6px">Volver</button>
        <div id="cancelMsg" aria-live="polite"></div>`);
      d.el.querySelector("#btnNoCancelar").onclick = ()=> d.close();
      const si = d.el.querySelector("#btnSiCancelar");
      si.onclick = ()=> withBusy(si, "Cancelando…", async ()=>{
        const { data, error } = await sb.rpc("cancelar_reserva", { p_reserva: r.id });
        if(error){ showError(d.el.querySelector("#cancelMsg"), error); return; }
        d.close();
        await refrescarReservas(profile);
        const res = typeof data === "string" ? JSON.parse(data) : data;
        showMsg(document.getElementById("misResMsg"), "ok", r.estado === "espera" ? "Saliste de la lista de espera."
          : !esTer ? "Reserva cancelada. Tu cupo quedó libre."
          : res && res.devuelto ? "Reserva cancelada. La sesión volvió a tu saldo." : "Reserva cancelada fuera de plazo: la sesión no se devuelve.");
      });
    };
  });
}

/* ====================== CHECK-IN CON QR ====================== */
function codigoCheckinDeURL(){
  const m = location.hash.match(/^#\/checkin\/([A-Za-z0-9]+)/);
  return m ? m[1] : null;
}
function guardarCheckinPendiente(codigo){
  try { sessionStorage.setItem("gymnika_checkin", codigo); } catch { /* sin almacenamiento */ }
  planes.checkinPendiente = codigo;
}
function tomarCheckinPendiente(){
  let c = planes.checkinPendiente || null;
  try { c = c || sessionStorage.getItem("gymnika_checkin"); sessionStorage.removeItem("gymnika_checkin"); } catch { /* sin almacenamiento */ }
  planes.checkinPendiente = null;
  return c;
}

/* Escáner dentro de la app: usa el lector del navegador si existe; si no, jsQR desde el CDN */
let jsQRPromise = null;
function cargarJsQR(){
  if(window.jsQR) return Promise.resolve();
  jsQRPromise = jsQRPromise || new Promise((ok, fail) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";
    s.onload = ok; s.onerror = ()=>{ jsQRPromise = null; fail(new Error("No se pudo cargar el lector de QR.")); };
    document.head.appendChild(s);
  });
  return jsQRPromise;
}
function codigoDeQR(texto){
  const t = String(texto || "").trim();
  const m = t.match(/#\/checkin\/([A-Za-z0-9]+)/);
  if(m) return m[1];
  return /^[A-Za-z0-9]{8,64}$/.test(t) ? t : null;
}
async function abrirEscanerQR(){
  const alternativa = "También puedes abrir la cámara de tu celular y apuntar al QR de recepción.";
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
    openDialog("Escanear QR", `<p>Este navegador no deja usar la cámara desde la app.</p><p class="muted">${alternativa}</p>`);
    return;
  }
  const dlg = openDialog("Escanear QR de recepción", `
    <div class="scan-box"><video id="scanVideo" playsinline muted></video><span class="scan-frame" aria-hidden="true"></span></div>
    <p class="scan-msg" id="scanMsg" aria-live="polite">Abriendo la cámara…</p>`);
  const video = dlg.el.querySelector("#scanVideo");
  const msg = dlg.el.querySelector("#scanMsg");
  let stream = null;
  const parar = ()=>{ if(stream){ stream.getTracks().forEach(t => t.stop()); stream = null; } };
  try{
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
  } catch(e){
    const negado = e && (e.name === "NotAllowedError" || e.name === "SecurityError");
    msg.innerHTML = `${negado ? "Para escanear, permite que la app use la cámara." : "No encontramos una cámara disponible."}<br><span class="muted">${alternativa}</span>`;
    return;
  }
  if(!dlg.el.isConnected){ parar(); return; }
  video.srcObject = stream;
  try { await video.play(); } catch { /* algunos navegadores reproducen solos */ }
  msg.textContent = "Apunta al QR de recepción.";

  let detector = null;
  if("BarcodeDetector" in window){
    try { if((await window.BarcodeDetector.getSupportedFormats()).includes("qr_code")) detector = new window.BarcodeDetector({ formats: ["qr_code"] }); }
    catch { detector = null; }
  }
  if(!detector){
    try { await cargarJsQR(); }
    catch(e){ parar(); msg.innerHTML = `${esc(e.message)}<br><span class="muted">${alternativa}</span>`; return; }
  }
  const lienzo = document.createElement("canvas");
  const ctx = lienzo.getContext("2d", { willReadFrequently: true });
  let avisado = false;
  const leer = async ()=>{
    if(!dlg.el.isConnected){ parar(); return; }
    let texto = null;
    try{
      if(video.readyState >= 2 && video.videoWidth){
        if(detector){
          const res = await detector.detect(video);
          texto = res[0] && res[0].rawValue;
        } else {
          const k = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
          lienzo.width = Math.round(video.videoWidth * k); lienzo.height = Math.round(video.videoHeight * k);
          ctx.drawImage(video, 0, 0, lienzo.width, lienzo.height);
          const img = ctx.getImageData(0, 0, lienzo.width, lienzo.height);
          const r = window.jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
          texto = r && r.data;
        }
      }
    } catch { texto = null; }
    if(texto){
      const codigo = codigoDeQR(texto);
      if(codigo){ parar(); dlg.close(); procesarCheckin(codigo); return; }
      if(!avisado){ msg.textContent = "Ese no es el QR de Gymnika. Apunta al código de recepción."; avisado = true; }
    }
    setTimeout(leer, 180);
  };
  leer();
}

async function procesarCheckin(codigo){
  if(!codigo || !state.profile || state.profile.role === "coach") return;
  const { data, error } = await sb.rpc("registrar_checkin", { p_codigo: codigo });
  if(error){
    openDialog("No se registró tu asistencia", `<div class="checkin-res bad"><span class="ck-icon" aria-hidden="true">!</span><p>${esc(errorES(error))}</p></div>`);
    return;
  }
  const res = typeof data === "string" ? JSON.parse(data) : (data || {});
  const esFort = state.profile.categoria === "fortalecimiento";
  openDialog("Asistencia registrada", `
    <div class="checkin-res ok"><span class="ck-icon" aria-hidden="true">✓</span>
      <p class="ck-name">${esc(state.profile.nombre || "")}</p>
      <p>${res.repetido ? "Ya habías registrado tu llegada." : esFort ? esc(MEDIDOR[0].txt) : "¡Bienvenido a Gymnika!"}</p>
      <p class="muted">${res.inicio ? (esFort ? "Horario de las " : "Sesión de las ") + fmtFechaHora(res.inicio).split("· ")[1] : ""}${res.vence ? " · tu acceso vence el " + fmtFecha(res.vence, true) : ""}</p>
    </div>`);
  if(document.getElementById("planCard")) refrescarReservas(state.profile);
}
