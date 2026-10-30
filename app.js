/* ====================== CONFIG ====================== */
const SUPABASE_URL = "https://ucsogyvrplsonqpmufty.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjc29neXZycGxzb25xcG11ZnR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5ODA0NDUsImV4cCI6MjEwNzU1NjQ0NX0.XZ_enfBu30iFH9nUiKnpB4LDJDHvQIvbu2WSIAFV_tc";
let sb = null; // se crea al cargar la página (los scripts externos usan defer)
/* El logo incrustado del archivo recibido estaba dañado; se usa el de gymnika.pe. Si no carga, se oculta y queda el texto. */
const LOGO_URL = "https://assets.cdn.filesafe.space/meD3VpHRGa6RpJRNHfQd/media/6a3061ddd64da5ce6b762b80.png";
const LOGO_HTML = `<img class="logo-img" src="${LOGO_URL}" alt="" height="30" decoding="async" onerror="this.remove()">`;
const BRAND_HTML = `<div class="brand">${LOGO_HTML}<span class="mark">GYMNIKA</span></div>`;

const MEDIDA_FIELDS = [
  ["peso","Peso (kg)"],["grasa_pct","% Grasa"],["cintura","Cintura (cm)"],["cadera","Cadera (cm)"],
  ["pecho","Pecho (cm)"],["brazo_relajado","Brazo relajado (cm)"],["brazo_contraido","Brazo contraído (cm)"],
  ["muslo","Muslo (cm)"],["pantorrilla","Pantorrilla (cm)"]
];
let state = { session: null, profile: null, viewingAthleteId: null, athleteList: [], search: "", renderToken: 0, detail: null };

/* ====================== EQUIPO: ROLES ======================
   coach = master coach (administra todo: pagos, ajustes, equipo); coach_general ve terapia y fortalecimiento sin nada de administración;
   coach_terapia y coach_fortalecimiento solo ven a los alumnos de su área.
   La base de datos aplica estas mismas reglas; aquí solo se ocultan las partes que cada uno no usa. */
const ROLES_EQUIPO = { coach: "Master coach", coach_general: "Coach general", coach_terapia: "Coach de terapia", coach_fortalecimiento: "Coach de fortalecimiento" };
function esEquipo(p = state.profile){ return !!p && Object.prototype.hasOwnProperty.call(ROLES_EQUIPO, p.role); }
function esMaster(p = state.profile){ return !!p && p.role === "coach"; }
function areaCoach(p = state.profile){
  return !p ? null : p.role === "coach_terapia" ? "terapia" : p.role === "coach_fortalecimiento" ? "fortalecimiento" : null;
}
/* Secciones del panel según el rol, en el orden del menú */
const SECCIONES_COACH = {
  hoy:         { t: "Hoy",      ico: "◉" },
  agenda:      { t: "Horario",  ico: "◷" },
  rutinas:     { t: "Rutinas",  ico: "R" },
  pagos:       { t: "Pagos",    ico: "S/", master: true },
  resumen:     { t: "Resumen",  ico: "▤", master: true },
  equipo:      { t: "Equipo",   ico: "☰", master: true },
  comunicados: { t: "Avisos",   ico: "✉" },
  ajustes:     { t: "Ajustes",  ico: "⚙", master: true }
};
function seccionesPermitidas(p = state.profile){
  return Object.keys(SECCIONES_COACH).filter(k => {
    if(SECCIONES_COACH[k].master && !esMaster(p)) return false;
    if(k === "rutinas" && areaCoach(p) === "terapia") return false;
    return true;
  });
}
/* Nombre de quien hizo un cambio (equipo o el propio alumno) */
function nombreAutor(id, alumnoId){
  if(!id) return "";
  if(id === alumnoId) return "el alumno";
  if(state.profile && id === state.profile.id) return "ti";
  const m = (state.equipo || []).find(x => x.id === id);
  return m ? (m.nombre || "un coach") : "un coach";
}
function autoriaHTML(id, fecha, alumnoId){
  if(!id) return "";
  const d = fecha ? new Date(fecha) : null;
  return `<span class="autoria">Por ${esc(nombreAutor(id, alumnoId))}${d && !isNaN(d) ? " · " + esc(d.toLocaleDateString("es-PE", { day: "numeric", month: "short" })) : ""}</span>`;
}
/* Enlace del correo "olvidé mi contraseña": se detecta antes de que Supabase limpie la URL */
let recoveryMode = /(^|[#&?])type=recovery(&|$)/.test(location.hash + "&" + location.search);
let recoveryError = /error_code=|error_description=/.test(location.hash) && !recoveryMode;
if(recoveryError) history.replaceState(null, "", location.pathname + location.search);
const app = document.getElementById("app");

/* ====================== UTILIDADES ====================== */
function esc(s){
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}
function initials(name){
  if(!name) return "?";
  return name.trim().split(/\s+/).slice(0,2).map(w=>w[0].toUpperCase()).join("");
}
function fmt(n){ return (n===null||n===undefined||n==="") ? "—" : esc(n); }
/* Fecha local (Lima), no UTC: evita que después de las 7 p. m. se proponga la fecha de mañana */
function todayStr(){
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,10);
}
function parseFecha(str){
  if(!str) return null;
  const [y,m,d] = String(str).slice(0,10).split("-").map(Number);
  if(!y || !m || !d) return null;
  return new Date(y, m-1, d);
}
const MESES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
function fmtFecha(str, conAnio = "auto"){
  const d = parseFecha(str);
  if(!d) return esc(str || "—");
  if(conAnio === "auto") conAnio = d.getFullYear() !== new Date().getFullYear();
  return `${d.getDate()} ${MESES[d.getMonth()]}${conAnio ? " " + d.getFullYear() : ""}`;
}
function fmtNum(n, dec = 1){
  const x = Number(n);
  if(!isFinite(x)) return "—";
  const f = 10 ** dec;
  return String(Math.round(x * f) / f);
}
function fmtDelta(x, unidad){
  const v = Math.round(Number(x) * 10) / 10;
  if(!isFinite(v) || v === 0) return "Sin cambio";
  return `${v > 0 ? "+" : "−"}${Math.abs(v)} ${unidad}`;
}
function calcEdad(fnac){
  const d = parseFecha(fnac); if(!d) return null;
  const hoy = new Date();
  let e = hoy.getFullYear() - d.getFullYear();
  if(hoy.getMonth() < d.getMonth() || (hoy.getMonth() === d.getMonth() && hoy.getDate() < d.getDate())) e--;
  return e >= 0 && e < 120 ? e : null;
}
function tieneLesion(txt){
  const v = String(txt || "").trim().toLowerCase();
  return !!v && !["ninguna","ninguno","no","n/a","na","-","—","nada"].includes(v);
}

/* Errores de Supabase en español */
const ERROR_ES = [
  [/invalid login credentials/i, "Email o contraseña incorrectos."],
  [/email not confirmed/i, "Todavía no confirmas tu email. Revisa tu bandeja de entrada (y la carpeta de spam)."],
  [/already registered|already been registered|already exists/i, "Ya existe una cuenta con ese email. Inicia sesión."],
  [/password should be at least/i, "La contraseña debe tener al menos 6 caracteres."],
  [/invalid email|email address .* is invalid|unable to validate email/i, "Revisa el formato del email."],
  [/for security purposes|rate limit|too many requests/i, "Demasiados intentos seguidos. Espera un minuto e inténtalo de nuevo."],
  [/failed to fetch|networkerror|network request failed|load failed/i, "Sin conexión. Revisa tu internet e inténtalo de nuevo."],
  [/row-level security|permission denied|not authorized/i, "No tienes permiso para hacer este cambio."],
  [/jwt expired|invalid jwt|refresh token/i, "Tu sesión expiró. Vuelve a iniciar sesión."],
  [/should be different from the old password/i, "La nueva contraseña debe ser distinta de la anterior."],
  [/email address not authorized|error sending recovery email|error sending .*email/i, "No pudimos enviar el correo. Inténtalo más tarde o avisa a tu coach."],
  [/no tienes permiso para cambiar el rol/i, "No tienes permiso para cambiar el rol."]
];
function errorES(error){
  const m = (error && (error.message || String(error))) || "";
  const hit = ERROR_ES.find(([re]) => re.test(m));
  if(hit) return hit[1];
  /* Mensajes propios de la base de datos (reservas, pagos, check-in): ya vienen en español */
  if(error && (error.code === "P0001" || error.code === "42501") && /[áéíóúñ¿]|^(No |Ese |Ya |Solo |La |El |Este |Esta |Tu |Primero|Inicia|Las )/.test(m)) return m;
  return "No se pudo completar la acción. Inténtalo de nuevo.";
}
function showMsg(el, type, text){
  if(!el) return;
  el.innerHTML = type === "ok"
    ? `<div class="success" role="status">${esc(text)}</div>`
    : `<div class="error" role="alert">${esc(text)}</div>`;
}
function showError(el, error){
  if(error) console.error(error);
  showMsg(el, "error", errorES(error));
}
/* Desactiva el botón mientras se guarda: evita registros duplicados por doble toque */
async function withBusy(btn, label, fn){
  if(!btn || btn.disabled) return;
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.setAttribute("aria-busy", "true");
  btn.textContent = label;
  try { return await fn(); }
  finally {
    if(btn.isConnected){ btn.disabled = false; btn.removeAttribute("aria-busy"); btn.innerHTML = original; }
  }
}
function emptyHTML(text){ return `<div class="empty">${esc(text)}</div>`; }

/* Diálogo accesible: Escape, clic fuera, foco atrapado y devuelto */
function openDialog(title, bodyHTML){
  const prevFocus = document.activeElement;
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="dlgTitle">
      <div class="sheet-head">
        <h2 class="sheet-title" id="dlgTitle">${esc(title)}</h2>
        <button type="button" class="icon-btn" data-close aria-label="Cerrar">✕</button>
      </div>
      <div class="sheet-body">${bodyHTML}</div>
    </div>`;
  function close(){
    overlay.remove();
    document.removeEventListener("keydown", onKey);
    document.body.classList.remove("no-scroll");
    if(prevFocus && prevFocus.focus) prevFocus.focus();
  }
  function onKey(e){
    if(e.key === "Escape"){ e.preventDefault(); close(); return; }
    if(e.key === "Tab"){
      const f = [...overlay.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')];
      if(!f.length) return;
      const first = f[0], last = f[f.length-1];
      if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
    }
  }
  overlay.addEventListener("click", (e)=>{ if(e.target === overlay) close(); });
  overlay.querySelector("[data-close]").onclick = close;
  document.addEventListener("keydown", onKey);
  document.body.appendChild(overlay);
  document.body.classList.add("no-scroll");
  overlay.querySelector("[data-close]").focus();
  return { el: overlay, close };
}

/* ====================== ACCESO ====================== */
function authShell(innerHTML){
  document.body.className = "";
  app.innerHTML = `
    <div class="auth">
      <section class="auth-brand" aria-label="Gymnika">
        ${BRAND_HTML}
        <div class="auth-hero">
          <p class="eyebrow">Gymnika Wellness Center</p>
          <p class="auth-display">Wellness.<br>Recovery.<br><em>Performance.</em></p>
          <p class="auth-lede">Tu terapia, tu entrenamiento y tu progreso en un solo lugar. Reserva tus sesiones, registra tu llegada y sigue tu evolución con tu coach.</p>
        </div>
        <ul class="auth-facts">
          <li><strong>20</strong><span>semanas por ciclo</span></li>
          <li><strong>${MACRO_PHASES.length}</strong><span>bloques de entrenamiento</span></li>
          <li><strong>${MEDIDA_FIELDS.length}</strong><span>medidas corporales</span></li>
        </ul>
      </section>
      <main class="auth-form">
        <div class="auth-form-inner">${innerHTML}</div>
      </main>
    </div>`;
}

function renderAuth(notice){
  authShell(`
    <h1>Bienvenido a Gymnika</h1>
    <p class="lede" style="margin-top:10px">Ingresa con tu correo o crea tu cuenta para reservar tus sesiones.</p>
    <div class="tabs" role="tablist" aria-label="Acceso">
      <button type="button" class="tab" role="tab" id="tabLogin" aria-controls="authCard">Iniciar sesión</button>
      <button type="button" class="tab" role="tab" id="tabSignup" aria-controls="authCard">Registrarme</button>
    </div>
    <div class="card" id="authCard" role="tabpanel"></div>
  `);
  document.getElementById("tabLogin").onclick = ()=>{ setAuthTab(true); };
  document.getElementById("tabSignup").onclick = ()=>{ setAuthTab(false); };
  document.querySelector('[role="tablist"]').addEventListener("keydown", (e)=>{
    if(e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const toLogin = document.getElementById("tabLogin").getAttribute("aria-selected") !== "true";
    setAuthTab(toLogin);
    document.getElementById(toLogin ? "tabLogin" : "tabSignup").focus();
  });
  setAuthTab(true);
  if(notice) showMsg(document.getElementById("authMsg"), "error", notice);
}

function setAuthTab(isLogin){
  const tl = document.getElementById("tabLogin"), ts = document.getElementById("tabSignup");
  tl.setAttribute("aria-selected", String(isLogin));
  ts.setAttribute("aria-selected", String(!isLogin));
  tl.tabIndex = isLogin ? 0 : -1;
  ts.tabIndex = isLogin ? -1 : 0;
  const card = document.getElementById("authCard");
  card.setAttribute("aria-labelledby", isLogin ? "tabLogin" : "tabSignup");
  if(isLogin){
    card.innerHTML = `
      <form id="loginForm" novalidate>
        <label for="loginEmail" style="margin-top:0">Email</label>
        <input type="email" id="loginEmail" autocomplete="email" inputmode="email" placeholder="nombre@correo.com">
        <label for="loginPass">Contraseña</label>
        <input type="password" id="loginPass" autocomplete="current-password" placeholder="••••••••">
        <div class="forgot-row"><button type="button" class="btn-link" id="btnForgot">¿Olvidaste tu contraseña?</button></div>
        <button type="submit" class="btn-primary" id="btnLogin" style="margin-top:10px">Entrar</button>
        <div id="authMsg" aria-live="polite"></div>
      </form>
    `;
    document.getElementById("loginForm").onsubmit = (e)=>{ e.preventDefault(); doLogin(); };
    document.getElementById("btnForgot").onclick = ()=> renderForgot(document.getElementById("loginEmail").value.trim());
  } else {
    card.innerHTML = `
      <form id="signupForm" novalidate>
        <div class="form-grid">
          <p class="eyebrow form-section">Tu programa</p>
          <div class="full">${categoriaPickerHTML("su_", null)}</div>
          <p class="eyebrow form-section">Tu cuenta</p>
          <div class="full"><label for="suNombre">Nombre completo<span class="req" aria-hidden="true">*</span></label><input type="text" id="suNombre" autocomplete="name" placeholder="Tu nombre" required></div>
          <div class="full"><label for="suEmail">Email<span class="req" aria-hidden="true">*</span></label><input type="email" id="suEmail" autocomplete="email" inputmode="email" placeholder="nombre@correo.com" required></div>
          <div><label for="suPass">Contraseña<span class="req" aria-hidden="true">*</span></label><input type="password" id="suPass" autocomplete="new-password" placeholder="Mínimo 6 caracteres" required></div>
          <div><label for="suPass2">Confirmar contraseña<span class="req" aria-hidden="true">*</span></label><input type="password" id="suPass2" autocomplete="new-password" placeholder="Repite la contraseña" required></div>
          <p class="eyebrow form-section">Tu información</p>
          ${fichaFieldsInnerHTML({}, true, "su_")}
          ${terminosCheckHTML("su_")}
        </div>
        <button type="submit" class="btn-primary" id="btnSignup">Crear cuenta</button>
        <div id="authMsg" aria-live="polite"></div>
      </form>
    `;
    activarLinksTerminos(card);
    document.getElementById("signupForm").onsubmit = (e)=>{ e.preventDefault(); doSignup(); };
  }
}

/* ---- Olvidé mi contraseña: Supabase envía un enlace para crear una nueva ---- */
function renderForgot(emailPrevio){
  const card = document.getElementById("authCard");
  if(!card) return;
  card.innerHTML = `
    <form id="forgotForm" novalidate>
      <h2 style="margin-bottom:6px">Recupera tu acceso</h2>
      <p class="muted" style="margin-bottom:4px">Escribe tu email y te enviaremos un enlace para crear una contraseña nueva.</p>
      <label for="forgotEmail">Email</label>
      <input type="email" id="forgotEmail" autocomplete="email" inputmode="email" placeholder="nombre@correo.com" value="${esc(emailPrevio || "")}">
      <button type="submit" class="btn-primary" id="btnForgotSend">Enviar enlace</button>
      <button type="button" class="btn-link" id="btnBackLogin" style="margin-top:8px;padding-left:0">← Volver a iniciar sesión</button>
      <div id="forgotMsg" aria-live="polite"></div>
    </form>
  `;
  document.getElementById("forgotEmail").focus();
  document.getElementById("btnBackLogin").onclick = ()=> setAuthTab(true);
  document.getElementById("forgotForm").onsubmit = (e)=>{ e.preventDefault(); doForgot(); };
}
async function doForgot(){
  const btn = document.getElementById("btnForgotSend");
  await withBusy(btn, "Enviando…", async ()=>{
    const email = document.getElementById("forgotEmail").value.trim();
    const msg = document.getElementById("forgotMsg");
    if(!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){ showMsg(msg, "error", "Escribe un email válido."); return; }
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    if(error){ showError(msg, error); return; }
    showMsg(msg, "ok", "Si ese email tiene una cuenta, te llegará un correo con un enlace para crear tu nueva contraseña. Revisa también la carpeta de spam.");
  });
}
function renderNewPassword(){
  if(document.getElementById("newPassForm")) return;
  authShell(`
    <p class="eyebrow">Recuperar acceso</p>
    <h1>Crea tu nueva contraseña</h1>
    <p class="lede" style="margin:10px 0 20px">Elige una contraseña de al menos 6 caracteres. Después entrarás directo a tu ficha.</p>
    <div class="card">
      <form id="newPassForm" novalidate>
        <label for="newPass" style="margin-top:0">Nueva contraseña</label>
        <input type="password" id="newPass" autocomplete="new-password" placeholder="Mínimo 6 caracteres">
        <label for="newPass2">Repite la contraseña</label>
        <input type="password" id="newPass2" autocomplete="new-password" placeholder="Repite la contraseña">
        <button type="submit" class="btn-primary" id="btnNewPass">Guardar contraseña</button>
        <div id="newPassMsg" aria-live="polite"></div>
      </form>
    </div>
  `);
  document.getElementById("newPass").focus();
  document.getElementById("newPassForm").onsubmit = (e)=>{
    e.preventDefault();
    const btn = document.getElementById("btnNewPass");
    withBusy(btn, "Guardando…", async ()=>{
      const p1 = document.getElementById("newPass").value;
      const p2 = document.getElementById("newPass2").value;
      const msg = document.getElementById("newPassMsg");
      if(p1.length < 6){ showMsg(msg, "error", "La contraseña debe tener al menos 6 caracteres."); return; }
      if(p1 !== p2){ showMsg(msg, "error", "Las contraseñas no coinciden."); return; }
      const { error } = await sb.auth.updateUser({ password: p1 });
      if(error){ showError(msg, error); return; }
      recoveryMode = false;
      showMsg(msg, "ok", "Contraseña actualizada. Entrando a tu ficha…");
      setTimeout(()=>{ bootAfterAuth(); }, 1200);
    });
  };
}

async function doLogin(){
  const btn = document.getElementById("btnLogin");
  await withBusy(btn, "Entrando…", async ()=>{
    const email = document.getElementById("loginEmail").value.trim();
    const pass = document.getElementById("loginPass").value;
    const msg = document.getElementById("authMsg");
    if(!email || !pass){ showMsg(msg, "error", "Completa email y contraseña."); return; }
    const { error } = await sb.auth.signInWithPassword({ email, password: pass });
    if(error){ showError(msg, error); return; }
    await bootAfterAuth();
  });
}

async function doSignup(){
  const btn = document.getElementById("btnSignup");
  await withBusy(btn, "Creando cuenta…", async ()=>{
    const nombre = document.getElementById("suNombre").value.trim();
    const email = document.getElementById("suEmail").value.trim();
    const pass = document.getElementById("suPass").value;
    const pass2 = document.getElementById("suPass2").value;
    const msg = document.getElementById("authMsg");
    if(!nombre || !email || !pass || !pass2){ showMsg(msg, "error", "Completa todos los campos."); return; }
    if(pass.length < 6){ showMsg(msg, "error", "La contraseña debe tener al menos 6 caracteres."); return; }
    if(pass !== pass2){ showMsg(msg, "error", "Las contraseñas no coinciden."); return; }
    const categoria = categoriaElegida("su_");
    if(!categoria){ showMsg(msg, "error", "Elige si vienes a terapia o a fortalecimiento."); return; }
    const { payload: fichaPayload, missing } = collectFichaFields("su_", true);
    if(missing){ showMsg(msg, "error", "Completa toda tu información personal, disponibilidad y objetivos."); return; }
    if(!document.getElementById("su_terminos").checked){ showMsg(msg, "error", "Para crear tu cuenta debes aceptar los términos y condiciones."); return; }
    fichaPayload.nombre = nombre;
    fichaPayload.categoria = categoria;
    fichaPayload.acepto_terminos_at = new Date().toISOString();
    const { data, error } = await sb.auth.signUp({ email, password: pass, options: { data: { nombre, categoria, acepto_terminos: "true" } } });
    if(error){ showError(msg, error); return; }
    if(data.session){
      const { error: upErr } = await sb.from("profiles").update(fichaPayload).eq("id", data.session.user.id);
      if(upErr) console.error(upErr); // si falla, la pantalla "completa tu ficha" la vuelve a pedir
      await bootAfterAuth();
    } else {
      showMsg(msg, "ok", "Cuenta creada. Revisa tu correo para confirmarla. Al iniciar sesión por primera vez te pediremos tu información una vez más para guardarla.");
      setTimeout(()=>{ if(document.getElementById("tabLogin")) setAuthTab(true); }, 3200);
    }
  });
}

async function doLogout(){
  stopInbox();
  await sb.auth.signOut();
  state = { session: null, profile: null, viewingAthleteId: null, athleteList: [], search: "", renderToken: state.renderToken + 1, detail: null };
  if(location.hash) history.replaceState(null, "", location.pathname + location.search);
  renderAuth();
}

/* ====================== MACROCICLO ====================== */
const MACRO_START = new Date("2026-09-07T00:00:00");
/* Fuente: Macrociclo Gymnika · Documento Master 2026-2027 (ciclo de 20 semanas que se repite) */
const MACRO_PHASES = [
  { hasta: 6, nombre: "Miofibrilar", num: "1" },
  { hasta: 8, nombre: "Sarcoplasmático", num: "2" },
  { hasta: 13, nombre: "Fuerza Explosiva", num: "3" },
  { hasta: 16, nombre: "Pliometría extensiva", num: "4a" },
  { hasta: 18, nombre: "Pliometría intensiva", num: "4b" },
  { hasta: 20, nombre: "Cierre", num: "" }
];
const MACRO_PHASE_INFO = {
  "Miofibrilar": {
    objetivo: "Fuerza máxima, base del ciclo.",
    que_es: "Fuerza máxima en los cuatro patrones, con cargas que suben de un punto conservador a un pico en la semana 5 y descarga en la semana 6.",
    para_que: "La fuerza es la base de la potencia y la reactividad de las fases siguientes.",
    caracteristicas: [
      "3-5 series × 3-6 repeticiones en los ejercicios principales.",
      "Intensidad de RPE 7 a 9, con el pico en la semana 5.",
      "Descansos de 2 a 3 minutos.",
      "Nadie trabaja al fallo en esta fase.",
      "Semana 5: prueba de fuerza. Semana 6: descarga con volumen reducido."
    ]
  },
  "Sarcoplasmático": {
    objetivo: "Capacidad de trabajo y densidad.",
    que_es: "Capacidad de trabajo y tolerancia al volumen, con cargas moderadas, más repeticiones y descansos cortos.",
    para_que: "Preparar al grupo para sostener trabajo denso antes de la fase de potencia.",
    caracteristicas: [
      "3-4 series × 10-15 repeticiones, dejando 2-3 en reserva (RIR 2-3).",
      "Descansos de 60-90 segundos.",
      "Semana 7 de adaptación; semana 8 con una serie más.",
      "Se entrena por volumen y densidad."
    ]
  },
  "Fuerza Explosiva": {
    objetivo: "Convertir fuerza en velocidad.",
    que_es: "Convertir la fuerza de la Fase 1 en velocidad, alternando en la misma sesión un ejercicio pesado y uno explosivo del mismo patrón.",
    para_que: "Combinar el trabajo pesado y el explosivo mejora la potencia más que cualquiera de los dos por separado.",
    caracteristicas: [
      "Pares: pesado (3 repeticiones, RPE 8) → 60-90 segundos → explosivo (3-5 repeticiones a máxima velocidad).",
      "2'30-3' de descanso entre pares.",
      "Los saltos terminan en cajón o con aterrizaje estabilizado; máximo 25 saltos por sesión.",
      "La serie se corta si la velocidad cae a simple vista."
    ]
  },
  "Pliometría extensiva": {
    objetivo: "Tolerancia del tejido al impacto.",
    que_es: "Muchos contactos con el suelo de baja intensidad.",
    para_que: "Preparar el tejido para el impacto antes de la pliometría intensiva.",
    caracteristicas: [
      "60-100 contactos de baja intensidad por sesión, subiendo semana a semana.",
      "La fuerza se mantiene con 2-3 series × 3 a RPE 7-8.",
      "La pliometría va al inicio de la sesión, con el cuerpo fresco.",
      "Al final de la semana 16 el coach evalúa los criterios de ingreso a la intensiva."
    ]
  },
  "Pliometría intensiva": {
    objetivo: "Reactividad máxima.",
    que_es: "Pocos contactos de máxima intensidad, solo para quien cumple los criterios de ingreso.",
    para_que: "Desarrollar la reactividad máxima.",
    caracteristicas: [
      "30-50 contactos de alta intensidad por sesión.",
      "Solo en R1 y R3, con al menos 48 h entre ellas.",
      "Criterios de ingreso: aterrizaje estable, dolor ≤2/10, base de fuerza y asistencia mínima a la extensiva.",
      "Quien no los cumple sigue en extensiva con progresión de complejidad."
    ]
  },
  "Cierre": {
    objetivo: "Preparación para reiniciar.",
    que_es: "Las dos últimas semanas del ciclo: pruebas, reclasificación y transición al próximo ciclo.",
    para_que: "Medir lo ganado, reclasificar aptos y no aptos por patrón y llegar recuperados a la semana 1 del próximo ciclo.",
    caracteristicas: [
      "Semana 19: pruebas (saltos primero, fuerza después) y el resto de la sesión a RPE 6.",
      "Semana 20: transición con 2 rutinas R4 y técnica de los principales de la Fase 1 a RPE 5-6.",
      "Se fijan las cargas de referencia para la semana 1 del próximo ciclo."
    ]
  }
};
const PHASE_SHORT = {
  "Miofibrilar": "Miofib.",
  "Sarcoplasmático": "Sarcop.",
  "Fuerza Explosiva": "Explosiva",
  "Pliometría extensiva": "Plio. ext.",
  "Pliometría intensiva": "Plio. int.",
  "Cierre": "Cierre"
};
function sumarDias(fecha, dias){
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate() + dias);
}
function fmtDia(d, conAnio = true){
  return `${d.getDate()} ${MESES[d.getMonth()]}${conAnio ? " " + d.getFullYear() : ""}`;
}
/* Fechas de una fase dentro del ciclo actual */
function rangoFase(nombre){
  const i = MACRO_PHASES.findIndex(p => p.nombre === nombre);
  if(i < 0) return null;
  const desde = i === 0 ? 1 : MACRO_PHASES[i-1].hasta + 1;
  const hasta = MACRO_PHASES[i].hasta;
  const est = macrocicloEstado();
  const base = (est.antes ? 0 : est.ciclo - 1) * 140;
  return {
    desde, hasta,
    inicio: sumarDias(MACRO_START, base + (desde - 1) * 7),
    fin: sumarDias(MACRO_START, base + hasta * 7 - 1)
  };
}
function openPhaseInfo(faseName){
  const info = MACRO_PHASE_INFO[faseName];
  if(!info) return;
  const fase = MACRO_PHASES.find(p => p.nombre === faseName);
  const r = rangoFase(faseName);
  const titulo = (fase && fase.num ? `Fase ${fase.num} · ` : "") + faseName;
  openDialog(titulo, `
    ${r ? `<p class="muted">Semanas ${r.desde}-${r.hasta} · ${fmtDia(r.inicio, r.inicio.getFullYear() !== r.fin.getFullYear())} al ${fmtDia(r.fin)}</p>` : ""}
    <h3>Objetivo</h3>
    <p>${esc(info.objetivo)}</p>
    <h3>¿Qué es?</h3>
    <p>${esc(info.que_es)}</p>
    <h3>¿Para qué sirve?</h3>
    <p>${esc(info.para_que)}</p>
    <h3>Características</h3>
    <ul>${info.caracteristicas.map(c=>`<li>${esc(c)}</li>`).join("")}</ul>
  `);
}
function macrocicloEstado(){
  const now = new Date();
  const diffDias = Math.floor((now - MACRO_START) / 86400000);
  if(diffDias < 0) return { antes: true, semana: 0, ciclo: 1, fase: null };
  const semanaAbs = Math.floor(diffDias / 7);
  const semana = (semanaAbs % 20) + 1;
  return {
    antes: false,
    semana,
    ciclo: Math.floor(semanaAbs / 20) + 1,
    fase: MACRO_PHASES.find(p => semana <= p.hasta)?.nombre || null
  };
}
/* "Macrociclo 2026-2027": años del ciclo en curso */
function etiquetaCiclo(est){
  const ini = sumarDias(MACRO_START, (est.antes ? 0 : est.ciclo - 1) * 140);
  const fin = sumarDias(ini, 139);
  return "Macrociclo " + ini.getFullYear() + (fin.getFullYear() !== ini.getFullYear() ? "-" + fin.getFullYear() : "");
}
function semanaDeFecha(fechaStr){
  const d = parseFecha(fechaStr); if(!d) return null;
  const diff = Math.floor((d - MACRO_START) / 86400000);
  if(diff < 0) return null;
  const abs = Math.floor(diff / 7);
  return { semana: (abs % 20) + 1, ciclo: Math.floor(abs / 20) + 1 };
}
function renderMacro(eventos, animate){
  const box = document.getElementById("macroCard");
  if(!box) return;
  const est = macrocicloEstado();
  const comps = {};
  (eventos || []).filter(e => e.tipo === "competencia").forEach(e=>{
    const s = semanaDeFecha(e.fecha);
    if(s && s.ciclo === est.ciclo) (comps[s.semana] = comps[s.semana] || []).push(e);
  });
  let desde = 1;
  const grupos = MACRO_PHASES.map(p=>{
    const semanas = [];
    for(let w = desde; w <= p.hasta; w++) semanas.push(w);
    const rango = desde === p.hasta ? `${desde}` : `${desde}–${p.hasta}`;
    desde = p.hasta + 1;
    const actual = !est.antes && p.nombre === est.fase;
    const celdas = semanas.map(w=>{
      const cls = ["macro-cell"];
      if(!est.antes && w < est.semana) cls.push("done");
      if(!est.antes && w === est.semana) cls.push("current");
      if(comps[w]) cls.push("has-comp");
      const t = `Semana ${w}` + (comps[w] ? " · Competencia: " + comps[w].map(c=>c.titulo).join(", ") : "");
      return `<span class="${cls.join(" ")}" style="--i:${w}" title="${esc(t)}"></span>`;
    }).join("");
    return `
      <div class="macro-group${actual ? " is-current" : ""}" style="flex:${semanas.length} 1 0">
        <div class="macro-cells" aria-hidden="true">${celdas}</div>
        <button type="button" class="macro-label" data-fase="${esc(p.nombre)}" aria-label="${esc(p.nombre)}, semanas ${rango}${actual ? ", fase actual" : ""}. Ver en qué consiste">
          <span class="macro-name"><span class="full">${esc(p.nombre)}</span><span class="short">${esc(PHASE_SHORT[p.nombre] || p.nombre)}</span></span>
          <span class="macro-range"><span class="pre">Sem. </span>${rango}</span>
        </button>
      </div>`;
  }).join("");
  const inicio = `${MACRO_START.getDate()} ${MESES[MACRO_START.getMonth()]}`;
  box.classList.toggle("animate", !!animate);
  box.classList.remove("is-in");
  box.innerHTML = `
    <div class="macro-head">
      <div>
        <p class="eyebrow">${esc(etiquetaCiclo(est))}</p>
        <h2 class="macro-title">${est.antes
          ? `Empieza el ${inicio}`
          : `Semana <span class="num">${est.semana}</span><span class="of"> de 20</span>`}</h2>
      </div>
      ${est.fase ? `<button type="button" class="phase-chip" data-fase="${esc(est.fase)}">Fase actual: <strong>${esc(est.fase)}</strong><span aria-hidden="true">→</span></button>` : ""}
    </div>
    <div class="macro-track">${grupos}</div>
    <div class="macro-foot muted">
      <span><i class="key key-done"></i>Completadas</span>
      <span><i class="key key-now"></i>Semana actual</span>
      <span><i class="key key-next"></i>Por venir</span>
      ${Object.keys(comps).length ? `<span><i class="key key-comp"></i>Competencia</span>` : ""}
      <span>Toca una fase para ver en qué consiste.</span>
    </div>
  `;
  box.querySelectorAll("[data-fase]").forEach(b=>{ b.onclick = ()=> openPhaseInfo(b.dataset.fase); });
  if(animate){
    requestAnimationFrame(()=> requestAnimationFrame(()=> box.classList.add("is-in")));
  }
}

/* ====================== ARRANQUE ====================== */
const FICHA_REQUIRED = ["nombre","fecha_nacimiento","sexo","telefono","contacto_emergencia","altura_cm","deporte","nivel_experiencia","disponibilidad","objetivo","plazo_objetivo"];
function isProfileComplete(p){
  return FICHA_REQUIRED.every(k => p[k] !== null && p[k] !== undefined && String(p[k]).trim() !== "")
    && (p.autorizacion_medica === true || p.autorizacion_medica === false)
    && !!p.categoria && !!p.acepto_terminos_at;
}

async function bootAfterAuth(){
  const { data: { session } } = await sb.auth.getSession();
  if(recoveryMode){
    if(session){ renderNewPassword(); return; }
    recoveryMode = false;
    renderAuth("El enlace para cambiar tu contraseña expiró o ya se usó. Pide uno nuevo con «¿Olvidaste tu contraseña?».");
    return;
  }
  if(recoveryError){
    recoveryError = false;
    renderAuth("El enlace para cambiar tu contraseña expiró o ya se usó. Pide uno nuevo con «¿Olvidaste tu contraseña?».");
    return;
  }
  if(!session){ renderAuth(planes.checkinPendiente ? "Inicia sesión para registrar tu asistencia." : undefined); return; }
  state.session = session;
  const { data: profile, error } = await sb.from("profiles").select("*").eq("id", session.user.id).single();
  if(error || !profile){
    const sinFila = error && (error.code === "PGRST116" || /0 rows|no rows/i.test((error.message || "") + " " + (error.details || "")));
    renderAuth(error && !sinFila ? errorES(error) : null);
    return;
  }
  state.profile = profile;
  if(esEquipo(profile)){ tomarCheckinPendiente(); renderCoachHome(); return; }
  if(!isProfileComplete(profile)){ renderCompleteProfileGate(profile); return; }
  await renderAthleteHome();
  const codigo = tomarCheckinPendiente();
  if(codigo) procesarCheckin(codigo);
}

function renderCompleteProfileGate(profile){
  authShell(`
    <p class="eyebrow">Completa tu ficha</p>
    <h1>Antes de empezar</h1>
    <p class="lede" style="margin:10px 0 20px">Necesitamos tu información personal y tus objetivos para activar tu cuenta. Esto no incluye medidas corporales: esas las cargas después.</p>
    <div class="card" id="gateCard"></div>
    <button type="button" class="btn-link" id="btnLogoutGate" style="margin-top:10px">Salir</button>
  `);
  document.getElementById("btnLogoutGate").onclick = doLogout;
  document.getElementById("gateCard").innerHTML = `<div class="form-grid">
      ${profile.categoria ? "" : `<div class="full">${categoriaPickerHTML("g_", null)}</div>`}
      ${fichaFieldsInnerHTML(profile, true, "g_")}
      ${profile.acepto_terminos_at ? "" : terminosCheckHTML("g_")}
    </div>
    <button type="button" class="btn-primary" id="btnSaveFichaGate">Guardar y continuar</button>
    <div id="gateMsg" aria-live="polite"></div>`;
  activarLinksTerminos(document.getElementById("gateCard"));
  const btn = document.getElementById("btnSaveFichaGate");
  btn.onclick = ()=> withBusy(btn, "Guardando…", async ()=>{
    const { payload, missing } = collectFichaFields("g_", true);
    const msg = document.getElementById("gateMsg");
    if(!profile.categoria){
      payload.categoria = categoriaElegida("g_");
      if(!payload.categoria){ showMsg(msg, "error", "Elige si vienes a terapia o a fortalecimiento."); return; }
    }
    if(missing){ showMsg(msg, "error", "Completa todos los campos antes de continuar."); return; }
    if(!profile.acepto_terminos_at){
      if(!document.getElementById("g_terminos").checked){ showMsg(msg, "error", "Debes aceptar los términos y condiciones para continuar."); return; }
      payload.acepto_terminos_at = new Date().toISOString();
    }
    const { error } = await sb.from("profiles").update(payload).eq("id", profile.id);
    if(error){ showError(msg, error); return; }
    state.profile = { ...profile, ...payload };
    await renderAthleteHome();
    const codigo = tomarCheckinPendiente();
    if(codigo) procesarCheckin(codigo);
  });
}

function appbarHTML(tag){
  return `
    <header class="appbar">
      <div class="appbar-inner">
        <div class="brand">${LOGO_HTML}<span class="mark">GYMNIKA</span><span class="tag">${esc(tag)}</span></div>
        <div class="appbar-user">
          <div class="inbox-wrap">
            <button type="button" class="icon-btn inbox-btn" id="btnInbox" aria-haspopup="dialog" aria-expanded="false" aria-controls="inboxPanel" aria-label="Notificaciones" hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M3 13.5 5.6 5.4A2 2 0 0 1 7.5 4h9a2 2 0 0 1 1.9 1.4L21 13.5V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4.5Z"/>
                <path d="M3 13.5h5l1.5 2.5h5l1.5-2.5h5"/>
              </svg>
              <span class="inbox-badge" id="inboxBadge" hidden></span>
            </button>
            <div class="inbox-panel" id="inboxPanel" role="dialog" aria-label="Notificaciones" hidden></div>
          </div>
          <span class="user-name">${esc(state.profile?.nombre || "")}</span>
          <button type="button" class="btn-link" id="btnLogout">Salir</button>
        </div>
      </div>
    </header>`;
}

async function renderAthleteHome(){
  document.body.className = "";
  app.innerHTML = `${appbarHTML((CATEGORIAS[state.profile.categoria] || {}).nombre || "mi ficha")}<main class="athlete-main" id="athleteMain" tabindex="-1"></main>`;
  document.getElementById("btnLogout").onclick = doLogout;
  initInbox();
  state.viewingAthleteId = state.profile.id;
  await renderAthleteDetail(state.profile, false, document.getElementById("athleteMain"));
}

const TIPS = [
  "Entrena con constancia: La regularidad supera a la intensidad ocasional.",
  "Prioriza la técnica: Ejecuta cada ejercicio con control y buena postura.",
  "Aumenta progresivamente: Incrementa peso, repeticiones o dificultad poco a poco.",
  "Duerme bien: Apunta a 7–9 horas de sueño cada noche.",
  "Consume suficiente proteína: Incluye una fuente proteica en cada comida.",
  "Hidrátate: Bebe agua regularmente durante todo el día.",
  "Come alimentos variados: Prioriza frutas, verduras, proteínas y cereales integrales.",
  "No entrenes siempre al máximo: Deja espacio para recuperarte.",
  "Calienta antes de entrenar: Prepara músculos y articulaciones para el esfuerzo.",
  "Estira después: Utiliza estiramientos suaves para relajarte y recuperar movilidad.",
  "Muévete durante el día: Evita permanecer sentado durante muchas horas seguidas.",
  "Camina más: Caminar diariamente mejora tu actividad física general.",
  "Descansa entre series: Recupera lo suficiente para mantener una buena técnica.",
  "Entrena todo el cuerpo: Busca equilibrio entre tren superior, inferior y core.",
  "Fortalece el core: Un abdomen fuerte ayuda a estabilizar el cuerpo.",
  "Escucha a tu cuerpo: Distingue entre esfuerzo normal y dolor preocupante.",
  "Mantén horarios: Una rutina estable facilita crear hábitos saludables.",
  "Planifica tus comidas: Reduce decisiones impulsivas y mejora tu alimentación.",
  "Incluye grasas saludables: Consume alimentos como frutos secos, palta y pescado.",
  "Prioriza alimentos reales: Basa tu dieta principalmente en alimentos poco procesados.",
  "Controla el estrés: Dedica unos minutos al día a respirar, caminar o desconectar.",
  "Respira correctamente: No contengas la respiración innecesariamente durante el ejercicio.",
  "Registra tus progresos: Anota pesos, repeticiones y sensaciones.",
  "Sé paciente: Los cambios físicos requieren tiempo y consistencia.",
  "Reduce el alcohol: Puede afectar la recuperación, el sueño y el rendimiento.",
  "Cuida tu movilidad: Trabaja regularmente las zonas que sientas rígidas.",
  "Mantén una buena postura: Varía de posición y evita mantener posturas incómodas mucho tiempo.",
  "Descansa cuando lo necesites: La recuperación también forma parte del entrenamiento.",
  "Disfruta el proceso: El mejor entrenamiento es el que puedes mantener a largo plazo.",
  "Busca equilibrio: Entrenamiento, alimentación, sueño y bienestar deben trabajar juntos."
];
/* Consejo del día: cambia una vez al día (antes era una ventana emergente en cada entrada) */
function tipDelDia(){
  const d = new Date();
  const dia = Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86400000);
  const tip = TIPS[dia % TIPS.length];
  const i = tip.indexOf(":");
  return i > 0 ? { titulo: tip.slice(0, i), texto: tip.slice(i + 1).trim() } : { titulo: "Consejo del día", texto: tip };
}

/* ====================== INBOX DE NOTIFICACIONES ====================== */
/* Las notificaciones las crea la base de datos (triggers). La app solo las lee y las marca como leídas. */
const inbox = { items: [], enabled: true, timer: null, open: false, cargando: false, vistos: null };
const INBOX_SECCION = {
  consejos: "notasCard", plan: "nutricionCard", compensacion: "estiramientosCard", ficha: "fichaCard",
  medidas: "medidasCard", fuerza: "fuerzaCard", tiempos: "tiemposCard", eventos: "agendaCard",
  pago: "planCard", reserva: "misReservasCard", sesiones: "planCard", checkin_error: "misReservasCard"
};
function tiempoRelativo(iso){
  const d = new Date(iso); if(isNaN(d)) return "";
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if(min < 1) return "Hace un momento";
  if(min < 60) return `Hace ${min} min`;
  const h = Math.round(min / 60);
  if(h < 24) return `Hace ${h} h`;
  const dias = Math.round(h / 24);
  if(dias === 1) return "Ayer";
  if(dias < 7) return `Hace ${dias} días`;
  return fmtDia(d, d.getFullYear() !== new Date().getFullYear());
}
function initInbox(){
  const btn = document.getElementById("btnInbox");
  if(!btn || !inbox.enabled) return;
  btn.hidden = false;
  btn.onclick = (e)=>{ e.stopPropagation(); inbox.open ? closeInbox(true) : openInbox(); };
  stopInbox();
  inbox.timer = setInterval(loadInbox, esMaster() ? 20000 : 60000);
  loadInbox();
}
function stopInbox(){
  if(inbox.timer){ clearInterval(inbox.timer); inbox.timer = null; }
  inbox.items = []; inbox.open = false; inbox.vistos = null;
}
async function loadInbox(){
  if(!state.profile || !inbox.enabled || inbox.cargando) return;
  inbox.cargando = true;
  try{
    const { data, error } = await sb.from("notificaciones").select("*")
      .eq("user_id", state.profile.id).order("created_at", { ascending: false }).limit(30);
    if(error){
      /* Si la tabla aún no existe en Supabase, el inbox se oculta sin molestar */
      if(/42P01|PGRST205|notificaciones|does not exist|schema cache/i.test((error.code || "") + " " + (error.message || ""))){
        inbox.enabled = false; stopInbox();
        const b = document.getElementById("btnInbox"); if(b) b.hidden = true;
      } else console.error(error);
      return;
    }
    inbox.items = data || [];
    avisarNuevas(inbox.items);
    renderInboxBadge();
    if(inbox.open) renderInboxPanel();
  } finally { inbox.cargando = false; }
}
/* ====================== VENTANAS EMERGENTES (MASTER) ======================
   Cuando un alumno reserva un horario, el master ve una ventana emergente en la app y, si dio permiso,
   una notificación del sistema en este dispositivo. Funciona mientras la app esté abierta (aunque esté en otra pestaña). */
const TIPOS_EMERGENTES = ["reserva_nueva", "checkin_error"];
function avisarNuevas(items){
  const primeraVez = !inbox.vistos;
  inbox.vistos = inbox.vistos || new Set();
  const nuevas = items.filter(n => !inbox.vistos.has(n.id));
  nuevas.forEach(n => inbox.vistos.add(n.id));
  if(primeraVez || !esMaster()) return;
  nuevas.filter(n => !n.leida && TIPOS_EMERGENTES.includes(n.tipo)).reverse().forEach(mostrarEmergente);
}
function mostrarEmergente(n){
  let pila = document.getElementById("emergentes");
  if(!pila){
    pila = document.createElement("div");
    pila.id = "emergentes"; pila.className = "emergentes"; pila.setAttribute("aria-live", "polite");
    document.body.appendChild(pila);
  }
  const el = document.createElement("div");
  el.className = "emergente" + (n.tipo === "checkin_error" ? " alerta" : ""); el.setAttribute("role", "status");
  el.innerHTML = `<span class="em-ico" aria-hidden="true">${n.tipo === "checkin_error" ? "!" : "◷"}</span>
    <div class="em-txt"><strong>${esc(n.titulo)}</strong>${n.mensaje ? `<span>${esc(n.mensaje)}</span>` : ""}</div>
    <div class="em-acc"><button type="button" class="btn-link" data-ver>Ver horario</button><button type="button" class="icon-btn" data-cerrar aria-label="Cerrar aviso">✕</button></div>`;
  const cerrar = ()=>{ el.classList.add("sale"); setTimeout(()=> el.remove(), 220); };
  el.querySelector("[data-cerrar]").onclick = cerrar;
  el.querySelector("[data-ver]").onclick = ()=>{ cerrar(); marcarLeida([n.id]); if(location.hash === "#/agenda") showCoachRoute(); else location.hash = "#/agenda"; };
  pila.prepend(el);
  while(pila.children.length > 4) pila.lastElementChild.remove();
  setTimeout(cerrar, 12000);
  try{
    if("Notification" in window && Notification.permission === "granted"){
      const sis = new Notification(n.titulo, { body: n.mensaje || "", tag: n.id, icon: LOGO_URL });
      sis.onclick = ()=>{ window.focus(); location.hash = "#/agenda"; sis.close(); };
    }
  } catch { /* algunos navegadores no permiten notificaciones aquí */ }
}
function avisosSistemaHTML(){
  if(!esMaster() || !("Notification" in window) || Notification.permission !== "default") return "";
  return `<div class="plan-alert avisos-sis" id="avisosSis"><span>Activa los avisos de reservas en este dispositivo para verlos aunque estés en otra pestaña.</span>
    <button type="button" class="btn-outline sm" id="btnAvisosSis">Activar avisos</button></div>`;
}
function enlazarAvisosSistema(){
  const b = document.getElementById("btnAvisosSis");
  if(b) b.onclick = async ()=>{
    try{ await Notification.requestPermission(); } catch { /* sin soporte */ }
    const box = document.getElementById("avisosSis"); if(box) box.remove();
  };
}

function renderInboxBadge(){
  const btn = document.getElementById("btnInbox"), badge = document.getElementById("inboxBadge");
  if(!btn || !badge) return;
  const n = inbox.items.filter(x => !x.leida).length;
  badge.hidden = n === 0;
  badge.textContent = n > 9 ? "9+" : String(n);
  btn.setAttribute("aria-label", n ? `Notificaciones: ${n} sin leer` : "Notificaciones");
}
function renderInboxPanel(){
  const panel = document.getElementById("inboxPanel");
  if(!panel) return;
  const esCoach = esEquipo();
  const sinLeer = inbox.items.some(x => !x.leida);
  panel.innerHTML = `
    <div class="inbox-head">
      <h2>Notificaciones</h2>
      ${sinLeer ? `<button type="button" class="btn-link" id="btnInboxAll">Marcar todo como leído</button>` : ""}
    </div>
    ${inbox.items.length ? `<ul class="inbox-list">${inbox.items.map(n => `
      <li><button type="button" class="inbox-item${n.leida ? "" : " unread"}" data-notif="${esc(n.id)}">
        <span class="inbox-dot" aria-hidden="true"></span>
        <span class="inbox-text">
          <span class="inbox-title">${n.leida ? "" : '<span class="sr-only">Sin leer: </span>'}${esc(n.titulo)}</span>
          ${n.mensaje ? `<span class="inbox-msg">${esc(n.mensaje)}</span>` : ""}
          <span class="inbox-time">${esc(tiempoRelativo(n.created_at))}</span>
        </span>
      </button></li>`).join("")}</ul>`
    : `<div class="inbox-empty"><strong>Todo al día</strong>${esCoach
        ? (esMaster() ? "Aquí te avisaremos cuando un alumno reserve, llegue, cree su cuenta, registre un pago o se quede con pocas sesiones."
                      : areaCoach() ? "Aquí te avisaremos cuando un alumno de tu área llegue o cree su cuenta."
                      : "Aquí te avisaremos cuando un alumno llegue o cree su cuenta.")
        : "Aquí verás los avisos del centro, tus pagos, tus reservas y los cambios de tu coach."}</div>`}
  `;
  const all = document.getElementById("btnInboxAll");
  if(all) all.onclick = (e)=>{ e.stopPropagation(); marcarTodasLeidas(); };
  panel.querySelectorAll("[data-notif]").forEach(b => { b.onclick = (e)=>{ e.stopPropagation(); abrirNotificacion(b.dataset.notif); }; });
}
function onInboxKey(e){ if(e.key === "Escape"){ e.preventDefault(); closeInbox(true); } }
function onInboxOutside(e){
  const panel = document.getElementById("inboxPanel"), btn = document.getElementById("btnInbox");
  if(panel && !panel.contains(e.target) && btn && !btn.contains(e.target)) closeInbox(false);
}
function openInbox(){
  const panel = document.getElementById("inboxPanel"), btn = document.getElementById("btnInbox");
  if(!panel || !btn) return;
  inbox.open = true;
  renderInboxPanel();
  panel.hidden = false;
  btn.setAttribute("aria-expanded", "true");
  document.addEventListener("keydown", onInboxKey);
  document.addEventListener("click", onInboxOutside);
  const primero = panel.querySelector("button");
  if(primero) primero.focus();
  loadInbox();
}
function closeInbox(devolverFoco){
  const panel = document.getElementById("inboxPanel"), btn = document.getElementById("btnInbox");
  inbox.open = false;
  if(panel) panel.hidden = true;
  if(btn){ btn.setAttribute("aria-expanded", "false"); if(devolverFoco) btn.focus(); }
  document.removeEventListener("keydown", onInboxKey);
  document.removeEventListener("click", onInboxOutside);
}
async function marcarLeida(ids){
  if(!ids.length) return;
  inbox.items.forEach(x => { if(ids.includes(x.id)) x.leida = true; });
  renderInboxBadge();
  if(inbox.open) renderInboxPanel();
  const { error } = await sb.from("notificaciones").update({ leida: true }).in("id", ids);
  if(error) console.error(error);
}
function marcarTodasLeidas(){
  return marcarLeida(inbox.items.filter(x => !x.leida).map(x => x.id));
}
async function abrirNotificacion(id){
  const n = inbox.items.find(x => x.id === id);
  if(!n) return;
  closeInbox(false);
  if(!n.leida) marcarLeida([n.id]);
  if(n.tipo === "comunicado"){
    openDialog(n.titulo, `<p class="muted">${esc(tiempoRelativo(n.created_at))}</p><div class="prose" style="margin-top:8px">${esc(n.mensaje || "")}</div>`);
    return;
  }
  if(esEquipo()){
    if(n.tipo === "pago" && esMaster()){ if(location.hash === "#/pagos") showCoachRoute(); else location.hash = "#/pagos"; return; }
    if(n.tipo === "checkin" || n.tipo === "reserva_nueva" || n.tipo === "checkin_error"){ if(location.hash === "#/agenda") showCoachRoute(); else location.hash = "#/agenda"; return; }
    if(!n.atleta_id) return;
    if(!state.athleteList.some(a => a.id === n.atleta_id)) await refreshCoachAside();
    const destino = "#/atleta/" + encodeURIComponent(n.atleta_id);
    if(location.hash === destino) showCoachRoute(); else location.hash = destino;
    return;
  }
  /* Alumno: recarga su ficha con lo último que cargó el coach y lo lleva a esa sección */
  const { data: fresco } = await sb.from("profiles").select("*").eq("id", state.profile.id).single();
  if(fresco) state.profile = fresco;
  await renderAthleteDetail(state.profile, false, document.getElementById("athleteMain"));
  const sec = document.getElementById(INBOX_SECCION[n.tipo] || "");
  if(sec){
    const det = sec.closest("details");
    if(det) det.open = true;
    sec.closest("section").scrollIntoView({ behavior: "smooth", block: "start" });
  }
}
window.addEventListener("focus", ()=>{ if(inbox.timer) loadInbox(); });

/* ====================== PANEL DEL COACH ====================== */
function routeAthleteId(){
  const m = location.hash.match(/^#\/atleta\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}
function routeCoachSeccion(){
  const m = location.hash.match(/^#\/(hoy|agenda|rutinas|pagos|resumen|equipo|comunicados|ajustes)\b/);
  return m ? m[1] : null;
}
/* Alertas del equipo (última semana de acceso en fortalecimiento, 2 o menos sesiones en terapia) */
async function cargarAlertas(){
  const { data, error } = await sb.rpc("alertas_equipo");
  state.alertas = error ? [] : (data || []);
  return state.alertas;
}
function alertaTexto(a){
  if(a.tipo === "sesiones") return a.valor <= 0 ? "Sin sesiones" : a.valor === 1 ? "Le queda 1 sesión" : `Le quedan ${a.valor} sesiones`;
  return a.valor <= 1 ? "Su acceso vence hoy" : `Última semana · vence en ${a.valor} días`;
}

async function renderCoachHome(){
  document.body.className = "";
  app.innerHTML = `
    ${appbarHTML((ROLES_EQUIPO[state.profile.role] || "panel del coach").toLowerCase())}
    <div class="coach-layout" id="coachLayout">
      <aside class="coach-aside" id="coachAside" aria-label="Atletas">
        <div class="skel skel-line" style="width:60%"></div>
        <div class="skel skel-block" style="margin-top:16px"></div>
      </aside>
      <main class="coach-main" id="coachMain" tabindex="-1"></main>
    </div>
  `;
  document.getElementById("btnLogout").onclick = doLogout;
  initInbox();
  if(routeAthleteId() || routeCoachSeccion()) document.getElementById("coachLayout").classList.add("has-selection");
  await refreshCoachAside();
  showCoachRoute();
  if(esMaster()) actualizarBadgePagos();
}

async function refreshCoachAside(){
  const aside = document.getElementById("coachAside");
  if(!aside) return;
  const [{ data: athletes, error }, { data: solicitudesPend }, { data: equipo }, { data: interna }] = await Promise.all([
    sb.from("profiles").select("*").eq("role","atleta").order("nombre"),
    sb.from("solicitudes_nutricion").select("*").eq("atendida", false).order("fecha"),
    sb.from("profiles").select("id,nombre,role").neq("role", "atleta"),
    sb.from("ficha_interna").select("user_id,color_riesgo"),
    cargarAlertas()
  ]);
  state.athleteList = athletes || [];
  state.equipo = equipo || [];
  state.riesgo = {};
  (interna || []).forEach(x => { state.riesgo[x.user_id] = x.color_riesgo; });
  const area = areaCoach();
  if(area) state.catFiltro = "";
  const est = macrocicloEstado();
  const secciones = seccionesPermitidas();
  aside.innerHTML = `
    ${area === "terapia" ? `<div class="aside-week"><span class="week-num num" aria-hidden="true">T</span><div><div style="font-weight:700">Coach de terapia</div><div class="muted">Ves a los pacientes de terapia</div></div></div>` : `
    <div class="aside-week">
      <span class="week-num num">${est.antes ? "—" : est.semana}</span>
      <div>
        <div style="font-weight:700">${est.antes ? "El macrociclo aún no comienza" : "Semana " + est.semana + " de 20 del macrociclo"}</div>
        <div class="muted">${est.fase ? "Fase: " + esc(est.fase) : ""}${est.ciclo > 1 ? " · Ciclo " + est.ciclo : ""}</div>
      </div>
    </div>`}
    <nav class="coach-nav n-${secciones.length}" aria-label="Secciones del coach">
      ${secciones.map(k => `<a href="#/${k}" data-nav="${k}"><span class="cn-ico" aria-hidden="true">${SECCIONES_COACH[k].ico}</span>${SECCIONES_COACH[k].t}${k === "pagos" ? `<span class="cn-badge" id="navPagosBadge" hidden></span>` : k === "hoy" && state.alertas.length ? `<span class="cn-badge alerta" aria-label="${plural(state.alertas.length, "alerta", "alertas")}">${state.alertas.length}</span>` : ""}</a>`).join("")}
    </nav>
    ${error ? `<div class="error" role="alert">${esc(errorES(error))}</div>` : ""}
    ${(solicitudesPend && solicitudesPend.length) ? `
      <section class="card solicitudes" aria-labelledby="solTitle">
        <h2 id="solTitle">Solicitudes de plan nutricional (${solicitudesPend.length})</h2>
        ${solicitudesPend.map(s=>{
          const at = state.athleteList.find(a=>a.id===s.user_id);
          return `
          <div class="sol-row">
            <div class="sol-info">
              <div style="font-weight:700">${esc(at ? at.nombre : "(atleta)")}</div>
              <div class="muted">${esc(new Date(s.fecha).toLocaleDateString("es-PE"))}</div>
            </div>
            <a class="btn-outline" href="#/atleta/${encodeURIComponent(s.user_id)}">Ver ficha</a>
            <button type="button" class="btn-danger" data-atendida="${esc(s.id)}">Atendida</button>
          </div>`;
        }).join("")}
        <div id="solMsg"></div>
      </section>` : ""}
    <div class="aside-head">
      <h1>${area === "terapia" ? "Pacientes" : "Atletas"}</h1>
      <span class="count">${state.athleteList.length} ${area ? "de " + CATEGORIAS[area].nombre.toLowerCase() : "registrados"}</span>
    </div>
    ${area ? "" : `<div class="seg cat-filter" role="group" aria-label="Filtrar por programa">
      ${[["", "Todos"], ["terapia", "Terapia"], ["fortalecimiento", "Fortalecimiento"]].map(([k, t]) => `<button type="button" aria-pressed="${(state.catFiltro || "") === k}" data-filtro="${k}">${t}<span class="num">${k ? state.athleteList.filter(a => a.categoria === k).length : state.athleteList.length}</span></button>`).join("")}
    </div>`}
    <label class="sr-only" for="searchAthlete">Buscar atleta</label>
    <input type="search" id="searchAthlete" placeholder="Buscar por nombre o deporte" value="${esc(state.search)}" autocomplete="off">
    <div class="athlete-list" id="athleteListCard"></div>
  `;
  document.getElementById("searchAthlete").oninput = (e)=>{
    state.search = e.target.value;
    renderAthleteListInto(filterAthletes(state.search));
  };
  aside.querySelectorAll("[data-filtro]").forEach(b => {
    b.onclick = ()=>{
      state.catFiltro = b.dataset.filtro;
      aside.querySelectorAll("[data-filtro]").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
      renderAthleteListInto(filterAthletes(state.search));
    };
  });
  marcarNavCoach();
  renderAthleteListInto(filterAthletes(state.search));
  aside.querySelectorAll("[data-atendida]").forEach(btn=>{
    btn.onclick = ()=> withBusy(btn, "…", async ()=>{
      const { error: e2 } = await sb.from("solicitudes_nutricion").update({ atendida: true }).eq("id", btn.dataset.atendida);
      if(e2){ showError(document.getElementById("solMsg"), e2); return; }
      await refreshCoachAside();
    });
  });
}

function filterAthletes(q){
  q = (q || "").toLowerCase().trim();
  const base = state.catFiltro ? state.athleteList.filter(a => a.categoria === state.catFiltro) : state.athleteList;
  if(!q) return base;
  return base.filter(a => (a.nombre||"").toLowerCase().includes(q) || (a.deporte||"").toLowerCase().includes(q));
}
function marcarNavCoach(){
  const sec = routeCoachSeccion();
  document.querySelectorAll("[data-nav]").forEach(a => {
    if(a.dataset.nav === sec) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
}

function renderAthleteListInto(list){
  const box = document.getElementById("athleteListCard");
  if(!box) return;
  if(list.length === 0){
    box.innerHTML = `<div style="padding:14px">${emptyHTML(state.athleteList.length ? "Ningún atleta coincide con el filtro o la búsqueda." : "Todavía no hay atletas registrados.")}</div>`;
    return;
  }
  box.innerHTML = list.map(a => {
    const flags = [];
    const alerta = (state.alertas || []).find(x => x.user_id === a.id);
    if(alerta) flags.push(`<span class="flag alerta">${esc(alertaTexto(alerta))}</span>`);
    if(a.categoria && !areaCoach()) flags.push(`<span class="flag cat-${a.categoria}">${CATEGORIAS[a.categoria].nombre}</span>`);
    if(tieneLesion(a.lesiones)) flags.push(`<span class="flag warn">Lesión</span>`);
    if(a.autorizacion_medica === false) flags.push(`<span class="flag warn">Sin autorización médica</span>`);
    if(!isProfileComplete(a)) flags.push(`<span class="flag info">Ficha incompleta</span>`);
    const sub = [a.deporte, a.nivel_experiencia].filter(Boolean).join(" · ") || a.objetivo || "Sin deporte registrado";
    const active = a.id === state.viewingAthleteId;
    return `
    <div class="athlete-row${active ? " is-active" : ""}" data-id="${esc(a.id)}">
      <a class="athlete-link" href="#/atleta/${encodeURIComponent(a.id)}"${active ? ' aria-current="page"' : ""}>
        <span class="avatar" aria-hidden="true">${esc(initials(a.nombre))}</span>
        <span class="athlete-info">
          <span class="athlete-name">${esc(a.nombre || "(sin nombre)")}</span>
          <span class="muted">${esc(sub)}</span>
          ${flags.length ? `<span class="flags">${flags.join("")}</span>` : ""}
        </span>
      </a>
    </div>`;
  }).join("");
}

async function showCoachRoute(){
  const layout = document.getElementById("coachLayout");
  const main = document.getElementById("coachMain");
  if(!layout || !main) return;
  const id = routeAthleteId();
  const seccion = routeCoachSeccion();
  const athlete = id ? state.athleteList.find(a=>a.id===id) : null;
  state.viewingAthleteId = athlete ? athlete.id : null;
  layout.classList.toggle("has-selection", !!id || !!seccion);
  marcarNavCoach();
  if(seccion){
    state.renderToken++;
    document.querySelectorAll(".athlete-row").forEach(r=>{ r.classList.remove("is-active"); r.querySelector(".athlete-link").removeAttribute("aria-current"); });
    if(window.matchMedia("(max-width: 1023px)").matches) window.scrollTo(0, 0);
    if(!seccionesPermitidas().includes(seccion)){
      main.innerHTML = `<a class="back" href="#/">← Atletas</a>
        <div class="empty" style="padding:48px 20px;margin-top:8px"><p class="empty-title">Esta sección no está en tu panel</p>
        <p>${SECCIONES_COACH[seccion].master ? "Solo los master coach pueden verla." : "No corresponde a tu área."}</p></div>`;
      return;
    }
    main.innerHTML = `<div class="skel skel-line" style="width:120px"></div><div class="skel skel-block" style="margin-top:16px"></div>`;
    if(seccion === "pagos") await renderCoachPagos(main);
    else if(seccion === "hoy") await renderCoachHoy(main);
    else if(seccion === "agenda") await renderCoachAgenda(main);
    else if(seccion === "rutinas") renderCoachRutinas(main);
    else if(seccion === "resumen") await renderCoachResumen(main);
    else if(seccion === "equipo") await renderCoachEquipo(main);
    else if(seccion === "comunicados") await renderCoachComunicados(main);
    else await renderCoachAjustes(main);
    return;
  }
  document.querySelectorAll(".athlete-row").forEach(r=>{
    const on = r.dataset.id === state.viewingAthleteId;
    r.classList.toggle("is-active", on);
    const link = r.querySelector(".athlete-link");
    if(on) link.setAttribute("aria-current","page"); else link.removeAttribute("aria-current");
  });
  if(!athlete){
    state.renderToken++;
    if(!id){ await renderCoachHoy(main); return; } // sin selección: en computadora se muestra "Hoy"
    main.innerHTML = `
      <a class="back" href="#/">← Atletas</a>
      <div class="empty" style="padding:48px 20px;margin-top:8px">
        <p class="empty-title">No encontramos este atleta</p>
        <p>${areaCoach() ? "Puede que se haya borrado o que no sea de tu área." : "Puede que se haya borrado. Vuelve a la lista."}</p>
      </div>`;
    return;
  }
  if(window.matchMedia("(max-width: 1023px)").matches) window.scrollTo(0, 0);
  await openAthleteAsCoach(athlete);
}

async function openAthleteAsCoach(athleteProfile){
  state.viewingAthleteId = athleteProfile.id;
  await renderAthleteDetail(athleteProfile, true, document.getElementById("coachMain"));
}

window.addEventListener("hashchange", ()=>{
  const codigo = codigoCheckinDeURL();
  if(codigo){
    history.replaceState(null, "", location.pathname + location.search);
    if(state.profile && !esEquipo() && document.getElementById("athleteMain")) procesarCheckin(codigo);
    else guardarCheckinPendiente(codigo);
    return;
  }
  if(esEquipo() && document.getElementById("coachLayout")) showCoachRoute();
});

