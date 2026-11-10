/* ====================== CHAT CON GYMNIKA ======================
   Cada atleta tiene una conversación con Gymnika; la responde cualquier master coach.
   El atleta ve las respuestas del equipo dichas por MarianI.A., el avatar de Gymnika (marianIA.js).
   Los mensajes llegan en vivo (Supabase Realtime) y avisan por la campanita y notificación push. */
const chatUI = { canal: null, abiertoDe: null, sinLeer: 0, lista: [], tLista: null };
function chatRouteId(){
  const m = location.hash.match(/^#\/chat\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}
function horaChat(iso){
  const d = new Date(iso), hoy = new Date();
  const h = d.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Lima" });
  if(d.toDateString() === hoy.toDateString()) return h;
  return d.toLocaleDateString("es-PE", { day: "numeric", month: "short", timeZone: "America/Lima" }) + " · " + h;
}
/* Burbujas: las mías a la derecha; las del otro lado a la izquierda con quién escribió */
function burbujasChatHTML(msgs, atletaId){
  if(!msgs.length) return `<p class="chat-vacio">${esEquipo() ? "Todavía no hay mensajes. Escríbele para empezar." : "Escríbenos lo que necesites: dudas, molestias, horarios. Te responde un master coach."}</p>`;
  const yo = state.profile.id;
  let dia = "";
  return msgs.map(m => {
    const mio = m.autor_id === yo;
    const deEquipo = m.autor_id !== atletaId;
    const habla = !mio && !esEquipo() && deEquipo;   // respuesta del equipo vista por el atleta: la dice MarianI.A.
    const quien = mio ? "" : esEquipo()
      ? (deEquipo ? nombreAutor(m.autor_id) : primerNombre(((state.athleteList || []).find(a => a.id === atletaId) || {}).nombre) || "Atleta")
      : habla ? "MarianI.A." : (nombreEquipoChat(m.autor_id) || "Atleta");
    const d = new Date(m.created_at).toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Lima" });
    const sep = d !== dia ? `<li class="chat-dia"><span>${esc(d)}</span></li>` : "";
    dia = d;
    if(habla) return `${sep}<li class="chat-habla"><span class="chat-av">${avatarMarianIA("feliz")}</span>
      <div class="chat-msg globo-comic"><span class="chat-quien">MarianI.A.</span>
      <p>${esc(m.texto)}</p><span class="chat-hora">${esc(horaChat(m.created_at))}</span></div></li>`;
    return `${sep}<li class="chat-msg${mio ? " mio" : ""}${esEquipo() && deEquipo && !mio ? " equipo" : ""}">
      ${quien ? `<span class="chat-quien">${esc(quien)}</span>` : ""}
      <p>${esc(m.texto)}</p><span class="chat-hora">${esc(horaChat(m.created_at))}</span></li>`;
  }).join("");
}
function nombreEquipoChat(id){
  const m = (state.equipo || []).find(x => x.id === id);
  return m ? primerNombre(m.nombre) : "";
}
async function cargarMensajes(atletaId){
  const { data, error } = await sb.from("chat_mensajes").select("id, atleta_id, autor_id, texto, created_at, leido_at")
    .eq("atleta_id", atletaId).order("created_at", { ascending: false }).limit(200);
  if(error){ console.error(error); return null; }
  return (data || []).reverse();
}
function formChatHTML(id){
  return `<form class="chat-form" data-chat-form="${esc(id)}">
    <label class="sr-only" for="chatTxt_${esc(id)}">Mensaje</label>
    <textarea id="chatTxt_${esc(id)}" rows="1" maxlength="2000" placeholder="Escribe un mensaje…" required></textarea>
    <button type="submit" class="btn-primary chat-enviar" aria-label="Enviar"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg></button>
  </form><p class="chat-error" aria-live="polite"></p>`;
}
/* Conecta el formulario: Enter envía (Shift+Enter, salto de línea) */
function enlazarFormChat(box, atletaId, alEnviar){
  const form = box.querySelector("[data-chat-form]"), ta = form.querySelector("textarea"), err = box.querySelector(".chat-error");
  const ajustar = ()=>{ ta.style.height = "auto"; ta.style.height = Math.min(140, ta.scrollHeight) + "px"; };
  ta.addEventListener("input", ajustar);
  ta.addEventListener("keydown", (e)=>{ if(e.key === "Enter" && !e.shiftKey && !e.isComposing){ e.preventDefault(); form.requestSubmit(); } });
  form.onsubmit = async (e)=>{
    e.preventDefault();
    const texto = ta.value.trim();
    if(!texto) return;
    const btn = form.querySelector("button");
    btn.disabled = true; err.textContent = "";
    const { data, error } = await sb.from("chat_mensajes").insert({ atleta_id: atletaId, texto }).select("id, atleta_id, autor_id, texto, created_at, leido_at").single();
    btn.disabled = false;
    if(error){ err.textContent = errorES(error); return; }
    ta.value = ""; ajustar(); ta.focus();
    alEnviar(data);
  };
}
function bajarAlFinal(lista){ requestAnimationFrame(()=>{ lista.scrollTop = lista.scrollHeight; }); }

/* ---------- Atleta: botón flotante y ventana de chat ---------- */
function iniciarChatAtleta(){
  if(!state.profile || esEquipo()) return;
  if(!document.getElementById("chatFab")){
    const b = document.createElement("button");
    b.type = "button"; b.id = "chatFab"; b.className = "chat-fab";
    b.setAttribute("aria-label", "Chat con MarianI.A. de Gymnika");
    b.innerHTML = `<span class="chat-fab-dice" aria-hidden="true">¿Dudas?</span><span class="chat-fab-av">${avatarMarianIA("feliz")}</span><span class="chat-badge" hidden></span>`;
    b.onclick = abrirChatAtleta;
    document.body.appendChild(b);
  }
  contarSinLeerAtleta();
  suscribirChat();
}
function quitarChat(){
  document.getElementById("chatFab")?.remove();
  document.getElementById("chatDialog")?.remove();
  if(chatUI.canal){ try{ sb.removeChannel(chatUI.canal); } catch { /* ya cerrado */ } chatUI.canal = null; }
  chatUI.abiertoDe = null; chatUI.sinLeer = 0;
}
async function contarSinLeerAtleta(){
  const { count } = await sb.from("chat_mensajes").select("id", { count: "exact", head: true })
    .eq("atleta_id", state.profile.id).is("leido_at", null).neq("autor_id", state.profile.id);
  pintarBadgeAtleta(count || 0);
}
function pintarBadgeAtleta(n){
  chatUI.sinLeer = n;
  const b = document.querySelector("#chatFab .chat-badge");
  if(!b) return;
  b.hidden = !n; b.textContent = n > 9 ? "9+" : String(n);
  document.getElementById("chatFab").setAttribute("aria-label", n ? `Chat con MarianI.A. de Gymnika: ${plural(n, "mensaje nuevo", "mensajes nuevos")}` : "Chat con MarianI.A. de Gymnika");
}
async function abrirChatAtleta(){
  const yo = state.profile.id;
  let dlg = document.getElementById("chatDialog");
  if(!dlg){
    dlg = document.createElement("dialog");
    dlg.id = "chatDialog"; dlg.className = "chat-dialog";
    dlg.setAttribute("aria-labelledby", "chatTit");
    dlg.innerHTML = `
      <header class="chat-top"><span class="chat-top-av">${avatarMarianIA("feliz")}</span>
        <div><h2 id="chatTit">MarianI.A.</h2><p>Te responde un master coach de Gymnika</p></div>
        <button type="button" class="icon-btn" data-chat-cerrar aria-label="Cerrar el chat">✕</button></header>
      <ol class="chat-lista" aria-live="polite"><li class="chat-vacio">Cargando…</li></ol>
      ${formChatHTML(yo)}`;
    document.body.appendChild(dlg);
    const cerrar = ()=>{ chatUI.abiertoDe = null; if(dlg.open) dlg.close(); };
    dlg.addEventListener("cancel", (e)=>{ e.preventDefault(); cerrar(); });
    dlg.querySelector("[data-chat-cerrar]").onclick = cerrar;
    enlazarFormChat(dlg, yo, (m)=> agregarMensaje(m));
  }
  try{ dlg.showModal(); } catch { dlg.setAttribute("open", ""); }
  chatUI.abiertoDe = yo;
  const msgs = await cargarMensajes(yo);
  const lista = dlg.querySelector(".chat-lista");
  chatUI.lista = msgs || [];
  lista.innerHTML = msgs ? burbujasChatHTML(chatUI.lista, yo) : `<li class="chat-vacio">No pudimos cargar los mensajes. Revisa tu conexión.</li>`;
  bajarAlFinal(lista);
  setTimeout(()=> dlg.querySelector("textarea")?.focus(), 50);
  await sb.rpc("chat_marcar_leido", { p_atleta: yo });
  pintarBadgeAtleta(0);
}
/* Un mensaje nuevo (mío o que llegó en vivo) en la conversación abierta */
function agregarMensaje(m){
  if(!m || chatUI.lista.some(x => x.id === m.id)) return;
  chatUI.lista.push(m);
  const cont = esEquipo() ? document.querySelector("#chatConv .chat-lista") : document.querySelector("#chatDialog .chat-lista");
  if(!cont) return;
  cont.innerHTML = burbujasChatHTML(chatUI.lista, m.atleta_id);
  bajarAlFinal(cont);
}

/* ---------- En vivo ---------- */
function suscribirChat(){
  if(chatUI.canal || typeof sb.channel !== "function") return;
  chatUI.canal = sb.channel("chat-vivo").on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_mensajes" }, (pl)=>{
    const m = pl && pl.new;
    if(!m) return;
    const mio = m.autor_id === state.profile.id;
    if(chatUI.abiertoDe === m.atleta_id){
      agregarMensaje(m);
      if(!mio) sb.rpc("chat_marcar_leido", { p_atleta: m.atleta_id }).then(()=>{ if(esMaster()) refrescarConversaciones(); }, ()=>{});
      return;
    }
    if(mio) return;
    if(esEquipo()) refrescarConversaciones();
    else pintarBadgeAtleta(chatUI.sinLeer + 1);
  }).subscribe();
}

/* ---------- Master coach: sección «Chat» ---------- */
async function iniciarChatEquipo(){
  if(!esMaster()) return;
  suscribirChat();
  refrescarConversaciones();
}
function refrescarConversaciones(){
  clearTimeout(chatUI.tLista);
  chatUI.tLista = setTimeout(async ()=>{
    const { data, error } = await sb.rpc("chat_conversaciones");
    if(error){ console.error(error); return; }
    chatUI.convs = data || [];
    const total = chatUI.convs.reduce((s, c) => s + (c.sin_leer || 0), 0);
    const b = document.getElementById("navChatBadge");
    if(b){ b.hidden = !total; b.textContent = total > 9 ? "9+" : String(total); }
    if(document.getElementById("chatConvs")) pintarConversaciones();
  }, 150);
}
async function renderCoachChat(main){
  main.innerHTML = `<div class="detail"><header class="detail-head">
      <a class="back" href="#/">← Atletas</a>
      <p class="eyebrow">Master coach</p><h1>Chat con atletas</h1>
      <p class="lede">Lo que escriben los atletas a Gymnika. Cualquier master coach puede responder.</p></header>
    <div class="chat-panel">
      <aside class="chat-convs-box">
        <label class="sr-only" for="chatBuscar">Buscar o escribir a un atleta</label>
        <input type="search" id="chatBuscar" placeholder="Buscar o escribir a un atleta" autocomplete="off">
        <ul class="chat-convs" id="chatConvs"><li class="muted">Cargando…</li></ul>
      </aside>
      <section class="chat-conv" id="chatConv" aria-live="polite"></section>
    </div></div>`;
  document.getElementById("chatBuscar").oninput = pintarConversaciones;
  const { data } = await sb.rpc("chat_conversaciones");
  chatUI.convs = data || [];
  pintarConversaciones();
  const id = chatRouteId();
  if(id) abrirConversacionCoach(id);
  else document.getElementById("chatConv").innerHTML = `<div class="chat-elige"><p class="empty-title">Elige una conversación</p><p class="muted">O busca a un atleta para escribirle.</p></div>`;
  refrescarConversaciones();
}
function pintarConversaciones(){
  const ul = document.getElementById("chatConvs");
  if(!ul) return;
  const q = normalizar(document.getElementById("chatBuscar")?.value || "");
  const actual = chatRouteId();
  let filas = (chatUI.convs || []).map(c => ({ id: c.atleta_id, nombre: c.nombre, texto: c.ultimo_texto, at: c.ultimo_at, equipo: c.ultimo_del_equipo, n: c.sin_leer }));
  if(q){
    const ya = new Set(filas.map(f => f.id));
    filas = filas.filter(f => normalizar(f.nombre).includes(q))
      .concat((state.athleteList || []).filter(a => !ya.has(a.id) && normalizar(a.nombre).includes(q)).slice(0, 15).map(a => ({ id: a.id, nombre: a.nombre, texto: null })));
  }
  ul.innerHTML = filas.length ? filas.map(f => `<li><a href="#/chat/${encodeURIComponent(f.id)}" class="chat-conv-item${f.id === actual ? " on" : ""}${f.n ? " nuevo" : ""}"${f.id === actual ? ' aria-current="true"' : ""}>
      <span class="avatar" aria-hidden="true">${esc(initials(f.nombre || ""))}</span>
      <span class="chat-conv-txt"><strong>${esc(f.nombre || "Atleta")}</strong>
        <span class="muted">${f.texto ? `${f.equipo ? "Gymnika: " : ""}${esc(f.texto)}` : "Escribirle"}</span></span>
      <span class="chat-conv-meta">${f.at ? `<span class="muted">${esc(horaChat(f.at))}</span>` : ""}${f.n ? `<span class="chat-badge">${f.n}</span>` : ""}</span></a></li>`).join("")
    : `<li class="muted chat-sin">${q ? "Nadie con ese nombre." : "Todavía no hay conversaciones."}</li>`;
}
async function abrirConversacionCoach(id){
  const box = document.getElementById("chatConv");
  if(!box) return;
  const a = (state.athleteList || []).find(x => x.id === id) || (chatUI.convs || []).map(c => ({ id: c.atleta_id, nombre: c.nombre, categoria: c.categoria })).find(x => x.id === id) || { id, nombre: "Atleta" };
  box.innerHTML = `<header class="chat-conv-top"><a class="btn-link chat-volver" href="#/chat">←</a>
      <span class="avatar" aria-hidden="true">${esc(initials(a.nombre || ""))}</span>
      <div><h2>${esc(a.nombre || "Atleta")}</h2><p class="muted">${esc((CATEGORIAS[a.categoria] || {}).nombre || "")}</p></div>
      <a class="btn-link" href="#/atleta/${encodeURIComponent(id)}">Ficha</a></header>
    <ol class="chat-lista"><li class="chat-vacio">Cargando…</li></ol>
    ${formChatHTML(id)}`;
  document.querySelector(".chat-panel")?.classList.add("con-conv");
  chatUI.abiertoDe = id;
  const msgs = await cargarMensajes(id);
  if(chatUI.abiertoDe !== id) return;
  chatUI.lista = msgs || [];
  const lista = box.querySelector(".chat-lista");
  lista.innerHTML = burbujasChatHTML(chatUI.lista, id);
  bajarAlFinal(lista);
  enlazarFormChat(box, id, (m)=>{ agregarMensaje(m); refrescarConversaciones(); });
  if(window.matchMedia("(min-width: 900px)").matches) box.querySelector("textarea")?.focus();
  await sb.rpc("chat_marcar_leido", { p_atleta: id });
  refrescarConversaciones();
}
