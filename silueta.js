/* ====================== SILUETA 3D PARA MARCAR EL DOLOR ======================
   Silueta blanca, redondeada y sin facciones. Se gira con el dedo; al tocar una zona se elige el dolor (1 a 10)
   y la zona se pinta de amarillo (leve) a rojo (fuerte). La «zona maldita» (zona principal de dolor) queda en la
   ficha del atleta. Three.js se carga solo la primera vez que se abre. */

const SIL_COLORES = ["", "#FFF1A6", "#FFE15A", "#FFCD1C", "#FFB04A", "#FF9320", "#F27405", "#EF4B3F", "#DB2B25", "#B91C1C", "#7F0000"];
const SIL_GRUPOS = {
  dorsal: { nombre: "Dorsal (las 3)", corto: "toda la dorsal", ids: ["dorsal_der", "dorsal_central", "dorsal_izq"] },
  lumbar: { nombre: "Lumbar (las 3)", corto: "toda la lumbar", ids: ["lumbar_der", "lumbar_central", "lumbar_izq"] }
};
const SIL_NOMBRES = (()=>{
  const n = {
    cabeza: "Cabeza", cuello: "Cuello (adelante)", cervical: "Cervical",
    trapecio_der: "Trapecio derecho", trapecio_izq: "Trapecio izquierdo",
    pecho_der: "Pecho derecho", pecho_izq: "Pecho izquierdo",
    dorsal_der: "Dorsal derecha", dorsal_central: "Dorsal central", dorsal_izq: "Dorsal izquierda",
    abdomen: "Abdomen",
    lumbar_der: "Lumbar derecha", lumbar_central: "Lumbar central", lumbar_izq: "Lumbar izquierda",
    sacro: "Sacro / coxis",
    ingle_der: "Cadera / ingle derecha", ingle_izq: "Cadera / ingle izquierda",
    gluteo_der: "Glúteo derecho", gluteo_izq: "Glúteo izquierdo"
  };
  [["der", "derecho", "derecha"], ["izq", "izquierdo", "izquierda"]].forEach(([s, m, f]) => Object.assign(n, {
    ["hombro_" + s]: "Hombro " + m, ["brazo_" + s]: "Brazo " + m, ["codo_" + s]: "Codo " + m, ["antebrazo_" + s]: "Antebrazo " + m,
    ["muneca_" + s]: "Muñeca " + f, ["mano_" + s]: "Mano " + f, ["muslo_" + s]: "Muslo " + m + " (adelante)", ["isquio_" + s]: "Isquiotibial " + m,
    ["rodilla_" + s]: "Rodilla " + f, ["tibia_" + s]: "Tibia " + f, ["pantorrilla_" + s]: "Pantorrilla " + f, ["tobillo_" + s]: "Tobillo " + m, ["pie_" + s]: "Pie " + m
  }));
  return n;
})();
/* Lista de zonas para el selector de la bitácora (mismo orden: de la cabeza a los pies) */
const SIL_ZONAS_LISTA = (()=>{
  const ids = Object.keys(SIL_NOMBRES);
  const l = [];
  ids.forEach(id => {
    l.push(SIL_NOMBRES[id]);
    if(id === "dorsal_izq") l.push(SIL_GRUPOS.dorsal.nombre);
    if(id === "lumbar_izq") l.push(SIL_GRUPOS.lumbar.nombre);
  });
  return l;
})();
const silGrupoDe = (id)=> Object.keys(SIL_GRUPOS).find(g => SIL_GRUPOS[g].ids.includes(id)) || null;
/* Nombre → zona (o grupo) de la silueta */
function silIdDeNombre(nombre){
  if(!nombre) return null;
  for(const g in SIL_GRUPOS) if(SIL_GRUPOS[g].nombre === nombre) return "grupo:" + g;
  return Object.keys(SIL_NOMBRES).find(id => SIL_NOMBRES[id] === nombre) || null;
}

const silUI = { three: null, geo: null };
function silCargarThree(){
  if(window.THREE) return Promise.resolve();
  silUI.three = silUI.three || new Promise((ok, fail) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js";
    s.onload = ok; s.onerror = ()=>{ silUI.three = null; fail(new Error("No se pudo cargar la silueta. Revisa tu conexión.")); };
    document.head.appendChild(s);
  });
  return silUI.three;
}

/* ---------- Forma del cuerpo: óvalos y cápsulas fundidos en una sola superficie lisa ----------
   Mira a la cámara (+z); su lado derecho queda en x negativa. */
function silConstruir(){
  if(silUI.geo) return silUI.geo;
  const P = [];
  const cap = (part, a, b, ra, rb, k)=> P.push({ t: 0, part, a, b, ra, rb, k });
  const eli = (part, c, r, k)=> P.push({ t: 1, part, c, r, k });
  eli("cabeza", [0, 3.86, 0], [.47, .47, .46], .06);
  cap("cuello", [0, 3.14, 0], [0, 3.42, 0], .14, .13, .09);
  eli("pecho", [0, 2.84, 0], [.47, .40, .31], .16);
  eli("cintura", [0, 2.38, 0], [.39, .34, .28], .16);
  eli("pelvis", [0, 1.98, 0], [.39, .27, .28], .14);
  eli("gluteo", [-.15, 1.93, -.08], [.19, .19, .17], .09);
  eli("gluteo", [.15, 1.93, -.08], [.19, .19, .17], .09);
  [-1, 1].forEach(s => {
    eli("hombro", [s * .49, 3.04, 0], [.17, .16, .16], .10);
    cap("brazo", [s * .53, 3.0, 0], [s * .63, 2.47, 0], .12, .105, .07);
    cap("antebrazo", [s * .63, 2.47, 0], [s * .69, 2.04, .02], .1, .085, .06);
    eli("mano", [s * .71, 1.86, .03], [.1, .13, .085], .06);
    cap("muslo", [s * .19, 1.88, 0], [s * .21, 1.05, .01], .2, .15, .1);
    cap("pierna", [s * .21, 1.05, .01], [s * .22, .24, 0], .14, .1, .08);
    eli("pie", [s * .23, .11, .09], [.13, .1, .21], .07);
  });
  P.forEach(p => {
    if(p.t === 0){ p.ba = [p.b[0] - p.a[0], p.b[1] - p.a[1], p.b[2] - p.a[2]]; p.bb = p.ba[0] ** 2 + p.ba[1] ** 2 + p.ba[2] ** 2;
      p.cen = [(p.a[0] + p.b[0]) / 2, (p.a[1] + p.b[1]) / 2, (p.a[2] + p.b[2]) / 2]; p.rad = Math.sqrt(p.bb) / 2 + Math.max(p.ra, p.rb); }
    else { p.cen = p.c; p.rad = Math.max(...p.r); }
  });
  const dPrim = (p, x, y, z)=>{
    if(p.t === 0){
      const px = x - p.a[0], py = y - p.a[1], pz = z - p.a[2];
      let h = (px * p.ba[0] + py * p.ba[1] + pz * p.ba[2]) / p.bb; h = h < 0 ? 0 : h > 1 ? 1 : h;
      const dx = px - p.ba[0] * h, dy = py - p.ba[1] * h, dz = pz - p.ba[2] * h;
      return Math.sqrt(dx * dx + dy * dy + dz * dz) - (p.ra + (p.rb - p.ra) * h);
    }
    const qx = (x - p.c[0]) / p.r[0], qy = (y - p.c[1]) / p.r[1], qz = (z - p.c[2]) / p.r[2];
    const k0 = Math.sqrt(qx * qx + qy * qy + qz * qz);
    const k1 = Math.sqrt((qx / p.r[0]) ** 2 + (qy / p.r[1]) ** 2 + (qz / p.r[2]) ** 2);
    return k1 < 1e-6 ? -p.rad : k0 * (k0 - 1) / k1;
  };
  const sdf = (x, y, z)=>{
    let d = 1e9;
    for(let i = 0; i < P.length; i++){
      const p = P[i];
      const ex = x - p.cen[0], ey = y - p.cen[1], ez = z - p.cen[2];
      if(ex * ex + ey * ey + ez * ez > (p.rad + .25) ** 2) continue;
      const di = dPrim(p, x, y, z);
      const h = Math.max(p.k - Math.abs(d - di), 0) / p.k;
      d = Math.min(d, di) - h * h * p.k * .25;
    }
    return d;
  };
  const duenio = (x, y, z)=>{ let best = null, bd = 1e9; for(const p of P){ const d = dPrim(p, x, y, z); if(d < bd){ bd = d; best = p; } } return best; };

  /* Superficie con «surface nets» */
  const H = .022, X0 = -1.0, Y0 = -.04, Z0 = -.5;
  const nx = Math.ceil(2.0 / H) + 1, ny = Math.ceil(4.42 / H) + 1, nz = Math.ceil(1.05 / H) + 1;
  const f = new Float32Array(nx * ny * nz);
  for(let k = 0; k < nz; k++) for(let j = 0; j < ny; j++) for(let i = 0; i < nx; i++) f[i + nx * (j + ny * k)] = sdf(X0 + i * H, Y0 + j * H, Z0 + k * H);
  const idx = (i, j, k)=> i + nx * (j + ny * k);
  const celda = new Int32Array(nx * ny * nz).fill(-1);
  const pos = [];
  const E = [[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]];
  const C = [[0,0,0],[1,0,0],[0,1,0],[1,1,0],[0,0,1],[1,0,1],[0,1,1],[1,1,1]];
  const v = new Float32Array(8);
  for(let k = 0; k < nz - 1; k++) for(let j = 0; j < ny - 1; j++) for(let i = 0; i < nx - 1; i++){
    let m = 0;
    for(let c = 0; c < 8; c++){ v[c] = f[idx(i + C[c][0], j + C[c][1], k + C[c][2])]; if(v[c] < 0) m |= 1 << c; }
    if(m === 0 || m === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for(const [a, b] of E){
      if((v[a] < 0) === (v[b] < 0)) continue;
      const t = v[a] / (v[a] - v[b]);
      sx += C[a][0] + (C[b][0] - C[a][0]) * t; sy += C[a][1] + (C[b][1] - C[a][1]) * t; sz += C[a][2] + (C[b][2] - C[a][2]) * t; n++;
    }
    celda[idx(i, j, k)] = pos.length / 3;
    pos.push(X0 + (i + sx / n) * H, Y0 + (j + sy / n) * H, Z0 + (k + sz / n) * H);
  }
  const ind = [];
  const quad = (a, b, c, d, flip)=>{ if(a < 0 || b < 0 || c < 0 || d < 0) return; if(flip) ind.push(a, d, c, a, c, b); else ind.push(a, b, c, a, c, d); };
  for(let k = 1; k < nz - 1; k++) for(let j = 1; j < ny - 1; j++) for(let i = 1; i < nx - 1; i++){
    const a = f[idx(i, j, k)] < 0;
    if(a !== (f[idx(i + 1, j, k)] < 0)) quad(celda[idx(i, j - 1, k - 1)], celda[idx(i, j, k - 1)], celda[idx(i, j, k)], celda[idx(i, j - 1, k)], a);
    if(a !== (f[idx(i, j + 1, k)] < 0)) quad(celda[idx(i - 1, j, k - 1)], celda[idx(i - 1, j, k)], celda[idx(i, j, k)], celda[idx(i, j, k - 1)], a);
    if(a !== (f[idx(i, j, k + 1)] < 0)) quad(celda[idx(i - 1, j - 1, k)], celda[idx(i, j - 1, k)], celda[idx(i, j, k)], celda[idx(i - 1, j, k)], a);
  }
  const nv = pos.length / 3, nor = new Float32Array(nv * 3), e = .012;
  for(let q = 0; q < nv; q++){
    const x = pos[q * 3], y = pos[q * 3 + 1], z = pos[q * 3 + 2];
    const gx = sdf(x + e, y, z) - sdf(x - e, y, z), gy = sdf(x, y + e, z) - sdf(x, y - e, z), gz = sdf(x, y, z + e) - sdf(x, y, z - e);
    const l = Math.hypot(gx, gy, gz) || 1; nor[q * 3] = gx / l; nor[q * 3 + 1] = gy / l; nor[q * 3 + 2] = gz / l;
  }

  /* Zona de cada vértice */
  const IDS = Object.keys(SIL_NOMBRES);
  const cerca = (x, y, z, px, py, pz, r)=> (x - px) ** 2 + (y - py) ** 2 + (z - pz) ** 2 < r * r;
  const zonaDe = (x, y, z)=>{
    const part = duenio(x, y, z).part, s = x < 0 ? "der" : "izq", sx = x < 0 ? -1 : 1, ax = Math.abs(x);
    const frente = z >= 0;
    if(part === "cabeza") return "cabeza";
    if(part === "cuello") return y > 3.44 ? "cabeza" : ax > .12 && y < 3.26 ? "trapecio_" + s : frente ? "cuello" : "cervical";
    if(part === "pecho"){
      if(y > 3.08) return ax < .13 ? (frente ? "cuello" : "cervical") : ax < .38 ? "trapecio_" + s : "hombro_" + s;
      return frente ? "pecho_" + s : ax < .12 ? "dorsal_central" : "dorsal_" + s;
    }
    if(part === "cintura"){
      if(y > 2.62) return frente ? "pecho_" + s : ax < .12 ? "dorsal_central" : "dorsal_" + s;
      return frente ? "abdomen" : ax < .11 ? "lumbar_central" : "lumbar_" + s;
    }
    if(part === "pelvis" || part === "gluteo"){
      if(y > 2.16) return frente ? "abdomen" : ax < .11 ? "lumbar_central" : "lumbar_" + s;
      if(z <= -.02 && ax < .09 && y > 1.8) return "sacro";
      return z > -.02 ? "ingle_" + s : "gluteo_" + s;
    }
    if(part === "hombro") return "hombro_" + s;
    if(part === "brazo") return cerca(x, y, z, sx * .63, 2.47, 0, .14) ? "codo_" + s : y > 2.96 ? "hombro_" + s : "brazo_" + s;
    if(part === "antebrazo") return cerca(x, y, z, sx * .63, 2.47, 0, .14) ? "codo_" + s : cerca(x, y, z, sx * .69, 2.04, .02, .11) ? "muneca_" + s : "antebrazo_" + s;
    if(part === "mano") return cerca(x, y, z, sx * .69, 2.04, .02, .09) ? "muneca_" + s : "mano_" + s;
    if(part === "muslo") return cerca(x, y, z, sx * .21, 1.05, .01, .19) ? "rodilla_" + s : y > 1.86 ? (z > -.02 ? "ingle_" + s : "gluteo_" + s) : (frente ? "muslo_" + s : "isquio_" + s);
    if(part === "pierna") return cerca(x, y, z, sx * .21, 1.05, .01, .19) ? "rodilla_" + s : y < .3 ? "tobillo_" + s : (z >= -.03 ? "tibia_" + s : "pantorrilla_" + s);
    if(part === "pie") return y > .2 && z < .05 ? "tobillo_" + s : "pie_" + s;
    return "cabeza";
  };
  const zonaV = new Uint8Array(nv);
  const verticesDe = IDS.map(() => []);
  for(let q = 0; q < nv; q++){ const zi = IDS.indexOf(zonaDe(pos[q * 3], pos[q * 3 + 1], pos[q * 3 + 2])); zonaV[q] = zi; verticesDe[zi].push(q); }
  /* Vecinos (para suavizar el borde de color entre zonas) */
  const I = nv > 65535 ? new Uint32Array(ind) : new Uint16Array(ind);
  const vecIni = new Uint32Array(nv + 1), grado = new Uint32Array(nv);
  for(let t = 0; t < I.length; t++) grado[I[t]] += 2;
  for(let q = 0; q < nv; q++) vecIni[q + 1] = vecIni[q] + grado[q];
  const vec = new Uint32Array(vecIni[nv]), lleno = new Uint32Array(nv);
  for(let t = 0; t < I.length; t += 3){
    const a = I[t], b = I[t + 1], c = I[t + 2];
    vec[vecIni[a] + lleno[a]++] = b; vec[vecIni[a] + lleno[a]++] = c;
    vec[vecIni[b] + lleno[b]++] = a; vec[vecIni[b] + lleno[b]++] = c;
    vec[vecIni[c] + lleno[c]++] = a; vec[vecIni[c] + lleno[c]++] = b;
  }
  /* Centro y orientación de cada zona (para la etiqueta de la zona maldita) */
  const centros = IDS.map((id, i) => {
    let cx = 0, cy = 0, cz = 0, nxs = 0, nzs = 0;
    verticesDe[i].forEach(q => { cx += pos[q * 3]; cy += pos[q * 3 + 1]; cz += pos[q * 3 + 2]; nxs += nor[q * 3]; nzs += nor[q * 3 + 2]; });
    const n = verticesDe[i].length || 1, l = Math.hypot(nxs, nzs) || 1;
    return { c: [cx / n + nxs / l * .2, cy / n, cz / n + nzs / l * .2], n: [nxs / l, 0, nzs / l] };
  });
  silUI.geo = { pos: new Float32Array(pos), nor, ind: I, nv, IDS, zonaV, verticesDe, vecIni, vec, centros };
  return silUI.geo;
}

/* ---------- Abrir la silueta ----------
   opts.zonas: [{ zona: "Lumbar central", inicio: 7 }], opts.maldita: nombre o null,
   opts.onMaldita(nombre|null) → guarda en la ficha (devuelve error o null), opts.onListo(zonas) */
async function abrirSilueta(opts = {}){
  const dlg = document.createElement("dialog");
  dlg.className = "sil-dialog";
  dlg.setAttribute("aria-labelledby", "silTit");
  dlg.innerHTML = `
    <div class="sil-top"><div><p class="eyebrow">${esc(opts.eyebrow || "Dolor al llegar")}</p><h2 id="silTit">${esc(opts.titulo || "Marcar en el cuerpo")}</h2></div>
      <button type="button" class="icon-btn" data-sil-cerrar aria-label="Cerrar sin cambios">✕</button></div>
    <div class="sil-cuerpo">
      <div class="sil-escena">
        <canvas class="sil-lienzo" aria-label="Silueta del cuerpo en 3D. Arrastra para girar y toca una zona."></canvas>
        <div class="sil-vistas" role="group" aria-label="Girar a">
          <button type="button" data-vista="0">Frente</button><button type="button" data-vista="3.1416">Espalda</button>
          <button type="button" data-vista="1.5708">Lado izq.</button><button type="button" data-vista="-1.5708">Lado der.</button></div>
        <div class="sil-etq" hidden aria-hidden="true"><span>Zona maldita</span><i></i><b></b></div>
        <p class="sil-ayuda">Cargando la silueta…</p>
      </div>
      <div class="sil-panel">
        <div class="sil-sel" aria-live="polite">
          <p class="sil-zona">${opts.onListo ? "Toca una zona del cuerpo" : "Toca la zona y marca «Zona maldita»"}</p>
          <div class="seg sil-grupo" role="group" aria-label="Qué parte marcar" hidden>
            <button type="button" data-modo="parte" aria-pressed="true">Solo esta parte</button>
            <button type="button" data-modo="grupo" aria-pressed="false"></button></div>
          ${opts.onListo ? `<div class="sil-escala" role="group" aria-label="Dolor del 0 al 10">${SIL_COLORES.map((c, n) => `<button type="button" data-n="${n}"${n ? ` style="background:${c}"` : ""} aria-pressed="false" disabled>${n === 0 ? "Sin dolor" : n}</button>`).join("")}</div>` : ""}
          ${opts.onMaldita ? `<label class="sil-maldita"><input type="checkbox" data-sil-maldita disabled><span><strong>Zona maldita</strong> · su zona principal de dolor. Queda en su ficha.</span></label>` : ""}
          <p class="sil-msg" aria-live="polite"></p>
        </div>
        <ul class="sil-lista"></ul>
        <div class="sil-acc"><button type="button" class="btn-outline" data-sil-cerrar>${opts.onListo ? "Cancelar" : "Cerrar"}</button>${opts.onListo ? `<button type="button" class="btn-primary" data-sil-listo>Listo</button>` : ""}</div>
      </div>
    </div>`;
  document.body.appendChild(dlg);
  try{ dlg.showModal(); } catch { dlg.setAttribute("open", ""); }
  let vivo = true, raf = 0;
  const cerrar = ()=>{ vivo = false; cancelAnimationFrame(raf); if(silUI.ro) silUI.ro.disconnect(); if(dlg.open) dlg.close(); dlg.remove(); if(silUI.renderer){ silUI.renderer.dispose(); silUI.renderer = null; } };
  dlg.addEventListener("cancel", (e)=>{ e.preventDefault(); cerrar(); });
  dlg.querySelectorAll("[data-sil-cerrar]").forEach(b => b.onclick = cerrar);
  const ayuda = dlg.querySelector(".sil-ayuda");
  try{ await silCargarThree(); }
  catch(err){ ayuda.textContent = err.message; return; }
  await new Promise(r => setTimeout(r, 30));
  if(!vivo) return;
  const G = silConstruir();
  const THREE = window.THREE;
  const lienzo = dlg.querySelector(".sil-lienzo"), escena = dlg.querySelector(".sil-escena");
  let renderer;
  try{ renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true }); }
  catch { ayuda.textContent = "Este teléfono no puede mostrar la silueta 3D. Usa la lista de zonas."; return; }
  silUI.renderer = renderer;
  THREE.ColorManagement.legacyMode = false;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  const MIRA = new THREE.Vector3(0, 2.22, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d0ca, 1.0));
  const key = new THREE.DirectionalLight(0xfff6ee, .75); key.position.set(3.5, 6, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(0xcfe9ff, .45); rim.position.set(-5, 4, -6); scene.add(rim);
  const rim2 = new THREE.DirectionalLight(0xffffff, .2); rim2.position.set(5, 2, -4); scene.add(rim2);
  const frontal = new THREE.DirectionalLight(0xffffff, .45); frontal.position.set(0, 2.5, 10); scene.add(frontal);
  const cuerpo = new THREE.Group(); scene.add(cuerpo);

  const nv = G.nv, IDS = G.IDS;
  const BASE = new THREE.Color("#F7F6F3");
  const col = new Float32Array(nv * 3), crudo = new Float32Array(nv * 3), aux = new Float32Array(nv * 3), liso = new Float32Array(nv * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(G.pos, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(G.nor, 3));
  const colAttr = new THREE.BufferAttribute(col, 3);
  geo.setAttribute("color", colAttr);
  geo.setIndex(new THREE.BufferAttribute(G.ind, 1));
  geo.computeBoundingSphere();
  const malla = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: .45, metalness: 0, clearcoat: .35, clearcoatRoughness: .4, side: THREE.DoubleSide }));
  cuerpo.add(malla);
  const sc = document.createElement("canvas"); sc.width = sc.height = 128;
  const c2 = sc.getContext("2d"); const gr = c2.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, "rgba(40,30,30,.32)"); gr.addColorStop(1, "rgba(40,30,30,0)");
  c2.fillStyle = gr; c2.fillRect(0, 0, 128, 128);
  const sombra = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
  sombra.rotation.x = -Math.PI / 2; sombra.position.y = .005; scene.add(sombra);

  /* ---------- Estado ---------- */
  const zonas = {};
  IDS.forEach((id, i) => { zonas[id] = { id, i, dolor: 0 }; });
  const grupoActivo = {};   // grupo → true si se marcó «las 3»
  let maldita = silIdDeNombre(opts.maldita);
  (opts.zonas || []).forEach(z => {
    const id = silIdDeNombre(z.zona), n = Number(z.inicio);
    if(!id || !(n > 0)) return;
    if(id.startsWith("grupo:")){ const g = id.slice(6); grupoActivo[g] = true; SIL_GRUPOS[g].ids.forEach(s => { zonas[s].dolor = n; }); }
    else zonas[id].dolor = n;
  });
  const tmp = new THREE.Color(), BLANCO = new THREE.Color(1, 1, 1);
  function recolorear(){
    const cz = IDS.map(id => zonas[id].dolor ? new THREE.Color(SIL_COLORES[zonas[id].dolor]) : null);
    for(let q = 0; q < nv; q++){
      const c = cz[G.zonaV[q]] || BASE;
      crudo[q * 3] = c.r; crudo[q * 3 + 1] = c.g; crudo[q * 3 + 2] = c.b;
    }
    let src = crudo, dst = aux;
    for(let pasada = 0; pasada < 3; pasada++){
      for(let q = 0; q < nv; q++){
        let r = src[q * 3] * 2, g = src[q * 3 + 1] * 2, b = src[q * 3 + 2] * 2, n = 2;
        for(let k = G.vecIni[q]; k < G.vecIni[q + 1]; k++){ const w = G.vec[k]; r += src[w * 3]; g += src[w * 3 + 1]; b += src[w * 3 + 2]; n++; }
        dst[q * 3] = r / n; dst[q * 3 + 1] = g / n; dst[q * 3 + 2] = b / n;
      }
      const t2 = src === crudo ? liso : src; src = dst; dst = t2;
    }
    liso.set(src); col.set(src); colAttr.needsUpdate = true;
  }
  function brillar(ids, k){
    col.set(liso);
    if(k > .001) ids.forEach(id => { for(const q of G.verticesDe[zonas[id].i]){ tmp.setRGB(liso[q * 3], liso[q * 3 + 1], liso[q * 3 + 2]).lerp(BLANCO, k); col[q * 3] = tmp.r; col[q * 3 + 1] = tmp.g; col[q * 3 + 2] = tmp.b; } });
    colAttr.needsUpdate = true;
  }

  /* ---------- Panel ---------- */
  let sel = null, modo = "parte", destello = 0;
  const zonaT = dlg.querySelector(".sil-zona"), escalaEl = dlg.querySelector(".sil-escala"), segG = dlg.querySelector(".sil-grupo");
  const chk = dlg.querySelector("[data-sil-maldita]"), msgEl = dlg.querySelector(".sil-msg"), listaEl = dlg.querySelector(".sil-lista");
  const idsSel = ()=> !sel ? [] : modo === "grupo" && silGrupoDe(sel) ? SIL_GRUPOS[silGrupoDe(sel)].ids : [sel];
  const claveSel = ()=> modo === "grupo" && silGrupoDe(sel) ? "grupo:" + silGrupoDe(sel) : sel;
  const nombreDe = (clave)=> clave && clave.startsWith("grupo:") ? SIL_GRUPOS[clave.slice(6)].nombre : SIL_NOMBRES[clave];
  function pintarPanel(){
    if(!sel) return;
    const g = silGrupoDe(sel);
    segG.hidden = !g;
    if(g){
      segG.querySelector('[data-modo="grupo"]').textContent = "Las 3 · " + SIL_GRUPOS[g].corto;
      segG.querySelectorAll("[data-modo]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.modo === modo)));
    }
    const ids = idsSel(), d = zonas[ids[0]].dolor, iguales = ids.every(id => zonas[id].dolor === d);
    zonaT.textContent = nombreDe(claveSel()) + (d && iguales ? ` · ${d} de 10` : "");
    if(escalaEl) escalaEl.querySelectorAll("button").forEach(b => { b.disabled = false; b.setAttribute("aria-pressed", String(iguales && Number(b.dataset.n) === d)); });
    if(chk){ chk.disabled = false; chk.checked = maldita === claveSel(); }
  }
  function elegir(id){ sel = id; modo = silGrupoDe(id) && grupoActivo[silGrupoDe(id)] ? "grupo" : "parte"; msgEl.textContent = ""; pintarPanel(); destello = 1; }
  segG.onclick = (e)=>{ const b = e.target.closest("[data-modo]"); if(!b) return; modo = b.dataset.modo; pintarPanel(); destello = 1; };
  if(escalaEl) escalaEl.onclick = (e)=>{
    const b = e.target.closest("button"); if(!b || !sel) return;
    const n = Number(b.dataset.n), g = silGrupoDe(sel);
    idsSel().forEach(id => { zonas[id].dolor = n; });
    if(g){ if(modo === "grupo") grupoActivo[g] = n > 0; else grupoActivo[g] = false; }
    recolorear(); pintarPanel(); lista();
  };
  if(chk) chk.onchange = async ()=>{
    const nuevo = chk.checked ? claveSel() : null, antes = maldita;
    chk.disabled = true;
    const err = await opts.onMaldita(nuevo ? nombreDe(nuevo) : null);
    chk.disabled = false;
    if(err){ chk.checked = !chk.checked; msgEl.textContent = err; return; }
    maldita = nuevo;
    msgEl.textContent = nuevo ? `Guardado en su ficha: ${nombreDe(nuevo)} es su zona maldita.` : (antes ? "Zona maldita quitada de su ficha." : "");
    lista();
  };
  /* Zonas marcadas, como quedarán en la bitácora */
  function resultado(){
    const out = [], usados = new Set();
    Object.keys(SIL_GRUPOS).forEach(g => {
      const ids = SIL_GRUPOS[g].ids, d = zonas[ids[0]].dolor;
      if(grupoActivo[g] && d > 0 && ids.every(id => zonas[id].dolor === d)){ out.push({ zona: SIL_GRUPOS[g].nombre, inicio: d, clave: "grupo:" + g }); ids.forEach(id => usados.add(id)); }
    });
    IDS.forEach(id => { if(!usados.has(id) && zonas[id].dolor > 0) out.push({ zona: SIL_NOMBRES[id], inicio: zonas[id].dolor, clave: id }); });
    return out;
  }
  function lista(){
    const r = resultado();
    const m = maldita && !r.some(z => z.clave === maldita) ? [{ zona: nombreDe(maldita), inicio: null, clave: maldita }] : [];
    const todas = [...r, ...m].sort((a, b) => (b.clave === maldita) - (a.clave === maldita) || (b.inicio || 0) - (a.inicio || 0));
    listaEl.innerHTML = todas.length ? todas.map(z => `<li><button type="button" data-z="${esc(z.clave)}">
      <span class="sil-n${z.inicio >= 7 ? " osc" : ""}" style="background:${z.inicio ? SIL_COLORES[z.inicio] : "var(--paper-2)"}">${z.inicio || "–"}</span>
      <span class="sil-nom">${esc(z.zona)}</span>${z.clave === maldita ? `<span class="sil-tag">Zona maldita</span>` : ""}</button></li>`).join("")
      : `<li class="muted">Todavía no hay zonas marcadas.</li>`;
    listaEl.querySelectorAll("[data-z]").forEach(b => b.onclick = ()=>{
      const k = b.dataset.z;
      if(k.startsWith("grupo:")){ sel = SIL_GRUPOS[k.slice(6)].ids[1]; modo = "grupo"; pintarPanel(); destello = 1; }
      else elegir(k);
      objetivo = /dorsal|lumbar|sacro|gluteo|isquio|pantorrilla|cervical/.test(k) ? Math.PI : 0;
    });
  }
  const listo = dlg.querySelector("[data-sil-listo]");
  if(listo) listo.onclick = ()=>{ opts.onListo(resultado().map(({ zona, inicio }) => ({ zona, inicio }))); cerrar(); };

  /* ---------- Girar y tocar ---------- */
  let rotY = .5, rotX = 0, objetivo = null, abajo = null;
  lienzo.addEventListener("pointerdown", (e)=>{ abajo = { x: e.clientX, y: e.clientY, rx: rotY, ry: rotX, mov: 0 }; try{ lienzo.setPointerCapture(e.pointerId); } catch { /* sin captura */ } objetivo = null; });
  lienzo.addEventListener("pointermove", (e)=>{
    if(!abajo) return;
    const dx = e.clientX - abajo.x, dy = e.clientY - abajo.y;
    abajo.mov = Math.max(abajo.mov, Math.hypot(dx, dy));
    rotY = abajo.rx + dx * .012;
    rotX = Math.max(-.3, Math.min(.3, abajo.ry + dy * .004));
    marcarVista();
  });
  lienzo.addEventListener("pointerup", (e)=>{ if(abajo && abajo.mov < 8) tocar(e); abajo = null; });
  lienzo.addEventListener("pointercancel", ()=>{ abajo = null; });
  const ray = new THREE.Raycaster(), punto = new THREE.Vector2();
  function tocar(e){
    const r = lienzo.getBoundingClientRect();
    punto.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(punto, cam);
    const hit = ray.intersectObject(malla, false)[0];
    if(!hit) return;
    const p = cuerpo.worldToLocal(hit.point.clone());
    let mejor = hit.face.a, md = 1e9;
    for(const q of [hit.face.a, hit.face.b, hit.face.c]){ const d = (G.pos[q * 3] - p.x) ** 2 + (G.pos[q * 3 + 1] - p.y) ** 2 + (G.pos[q * 3 + 2] - p.z) ** 2; if(d < md){ md = d; mejor = q; } }
    elegir(IDS[G.zonaV[mejor]]);
  }
  const vistas = dlg.querySelectorAll("[data-vista]");
  vistas.forEach(b => b.onclick = ()=>{ objetivo = Number(b.dataset.vista); rotX = 0; });
  function marcarVista(){
    const a = ((rotY % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    vistas.forEach(b => { const v = ((Number(b.dataset.vista) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); const d = Math.min(Math.abs(a - v), 2 * Math.PI - Math.abs(a - v)); b.setAttribute("aria-pressed", String(d < .4)); });
  }
  const etq = dlg.querySelector(".sil-etq");
  const wp = new THREE.Vector3(), wn = new THREE.Vector3(), hc = new THREE.Vector3();
  function ponerEtiqueta(){
    if(!maldita){ etq.hidden = true; return; }
    const id = maldita.startsWith("grupo:") ? SIL_GRUPOS[maldita.slice(6)].ids[1] : maldita;
    const k = G.centros[IDS.indexOf(id)];
    wp.set(k.c[0], k.c[1], k.c[2]); cuerpo.localToWorld(wp);
    wn.set(k.n[0], 0, k.n[2]).applyQuaternion(cuerpo.quaternion);
    hc.copy(cam.position).sub(wp); hc.y = 0; hc.normalize();
    const p = wp.clone().project(cam);
    etq.hidden = false;
    etq.style.left = ((p.x + 1) / 2 * escena.clientWidth) + "px";
    etq.style.top = ((-p.y + 1) / 2 * escena.clientHeight + 6) + "px";
    etq.style.opacity = wn.dot(hc) > -.15 ? "1" : ".35";
  }
  function ajustar(){
    const w = escena.clientWidth, h = escena.clientHeight;
    if(!w || !h) return;
    renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
    cam.position.set(0, 2.6, w / h < .8 ? 11.0 : 10.3); cam.lookAt(MIRA);
  }
  silUI.ro = new ResizeObserver(ajustar); silUI.ro.observe(escena); ajustar();
  const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function loop(t){
    if(!vivo) return;
    if(objetivo !== null){
      let d = objetivo - rotY; d = Math.atan2(Math.sin(d), Math.cos(d));
      rotY += d * (quieto ? 1 : .12);
      if(Math.abs(d) < .002){ rotY = objetivo; objetivo = null; }
      marcarVista();
    }
    cuerpo.rotation.y = rotY; cuerpo.rotation.x = rotX;
    if(!quieto) cuerpo.position.y = Math.sin(t / 900) * .006;
    if(sel && destello > 0){ destello = Math.max(0, destello - .018); brillar(idsSel(), quieto ? 0 : Math.max(0, Math.sin(t / 110)) * .45 * destello); }
    renderer.render(scene, cam);
    ponerEtiqueta();
    raf = requestAnimationFrame(loop);
  }
  dlg.silElegir = elegir;   // para las pruebas automáticas
  recolorear(); lista(); marcarVista();
  ayuda.textContent = "Arrastra para girar · toca una zona";
  raf = requestAnimationFrame(loop);
}
