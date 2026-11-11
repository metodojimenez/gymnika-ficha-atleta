/* ====================== MarianI.A. ======================
   Avatar de Gymnika (ilustración a partir de fotos de Danilo): busto con cuatro caras: «molesto», «serio», «feliz» y «pulgar» (feliz con el pulgar arriba).
   Habla en el chat, dice el consejo del día y avisa si ayer no estiraste. Devuelve un SVG en texto. */
function avatarMarianIA(cara = "feliz", opts = {}){
  const id = "av" + Math.random().toString(36).slice(2, 8);
  const fondo = opts.fondo === false ? "" : `<circle cx="100" cy="100" r="100" fill="${opts.fondo || "#DDEFEE"}"/>`;
  const P = { piel:"#C98F6B", sombra:"#AC704E", luz:"#DDA987", oreja:"#B97C59",
              pelo:"#8E8984", peloOsc:"#5F5B57", peloClaro:"#D3CFCA",
              barba:"#BDB8B1", barbaOsc:"#8C8781", barbaClaro:"#ECE9E4",
              ceja:"#4A4542", ojo:"#3B2A22", camisa:"#173F43", camisaOsc:"#0F2D30", logo:"#2BA3A8", boca:"#5A1F1A", lengua:"#C9605A" };
  const molesto = cara === "molesto", serio = cara === "serio", pulgar = cara === "pulgar";
  /* Cejas */
  const cejas = molesto
    ? `<path d="M64 78 Q76 75 92 87" stroke="${P.ceja}" stroke-width="7" stroke-linecap="round" fill="none"/>
       <path d="M136 80 Q124 78 108 88" stroke="${P.ceja}" stroke-width="7" stroke-linecap="round" fill="none"/>
       <path d="M97 84 v8 M103 84 v8" stroke="${P.sombra}" stroke-width="1.8" stroke-linecap="round"/>`
    : serio
    ? `<path d="M65 80 Q77 77 92 80" stroke="${P.ceja}" stroke-width="6.5" stroke-linecap="round" fill="none"/>
       <path d="M135 80 Q123 77 108 80" stroke="${P.ceja}" stroke-width="6.5" stroke-linecap="round" fill="none"/>`
    : `<path d="M64 78 Q76 69 91 75" stroke="${P.ceja}" stroke-width="6.5" stroke-linecap="round" fill="none"/>
       <path d="M136 78 Q124 69 109 75" stroke="${P.ceja}" stroke-width="6.5" stroke-linecap="round" fill="none"/>`;
  /* Ojos */
  const ojo = (cx) => molesto
    ? `<ellipse cx="${cx}" cy="96" rx="8" ry="6" fill="#fff"/>
       <circle cx="${cx + (cx < 100 ? 1.5 : -1.5)}" cy="97" r="4.2" fill="${P.ojo}"/>
       <path d="M${cx - 10} 92 L${cx + 10} ${cx < 100 ? 95 : 89}" stroke="${P.piel}" stroke-width="6" stroke-linecap="round"/>
       <path d="M${cx - 9} 93.5 L${cx + 9} ${cx < 100 ? 96.5 : 90.5}" stroke="${P.sombra}" stroke-width="1.6" stroke-linecap="round"/>`
    : serio
    ? `<ellipse cx="${cx}" cy="95" rx="8" ry="6.5" fill="#fff"/>
       <circle cx="${cx}" cy="95.5" r="4.6" fill="${P.ojo}"/>
       <circle cx="${cx + 1.6}" cy="93.8" r="1.4" fill="#fff"/>
       <path d="M${cx - 9} 89.5 Q${cx} 87.5 ${cx + 9} 89.5" stroke="${P.piel}" stroke-width="3.5" stroke-linecap="round" fill="none"/>
       <path d="M${cx - 8.5} 90.5 Q${cx} 88.8 ${cx + 8.5} 90.5" stroke="${P.sombra}" stroke-width="1.3" stroke-linecap="round" fill="none"/>`
    : `<ellipse cx="${cx}" cy="94" rx="8" ry="7.5" fill="#fff"/>
       <circle cx="${cx}" cy="95" r="4.8" fill="${P.ojo}"/>
       <circle cx="${cx + 1.6}" cy="93.2" r="1.5" fill="#fff"/>
       <path d="M${cx - 9} 101 Q${cx} 97 ${cx + 9} 101" stroke="${P.piel}" stroke-width="3.5" stroke-linecap="round" fill="none"/>
       <path d="M${cx - 8} 102 Q${cx} 99 ${cx + 8} 102" stroke="${P.sombra}" stroke-width="1.3" stroke-linecap="round" fill="none"/>
       <path d="M${cx + (cx < 100 ? -11 : 11)} 98 l${cx < 100 ? -4 : 4} 2 M${cx + (cx < 100 ? -11 : 11)} 101 l${cx < 100 ? -4 : 4} 3" stroke="${P.sombra}" stroke-width="1.2" stroke-linecap="round"/>`;
  /* Boca dentro de la barba */
  const boca = molesto
    ? `<path d="M90 135 Q100 128 111 134 Q112 142 101 143 Q90 143 90 135 Z" fill="${P.boca}"/>
       <path d="M92 140.5 Q101 138 109 140 Q106 142.6 101 142.8 Q95 142.6 92 140.5 Z" fill="#fff"/>`
    : serio
    ? `<path d="M88 134 Q100 133 112 134" stroke="${P.boca}" stroke-width="3" stroke-linecap="round" fill="none"/>`
    : `<path d="M83 129 Q100 132 117 129 Q113 141 100 142 Q87 141 83 129 Z" fill="${P.boca}"/>
       <path d="M85 130 Q100 133 115 130 L114 134 Q100 136.5 86 134 Z" fill="#fff"/>
       <path d="M92 139 Q100 135.5 108 139 Q104 141.6 100 141.7 Q96 141.6 92 139 Z" fill="${P.lengua}"/>`;
  /* Bigote */
  const bigote = molesto || serio
    ? `<path d="M80 128 Q90 119 100 123 Q110 119 120 128 Q110 126 100 128 Q90 126 80 128 Z" fill="${P.barba}" stroke="${P.barbaOsc}" stroke-width="1"/>`
    : `<path d="M78 126 Q89 116 100 121 Q111 116 122 126 Q111 123 100 125 Q89 123 78 126 Z" fill="${P.barba}" stroke="${P.barbaOsc}" stroke-width="1"/>`;
  /* Textura de canas (pelo y barba) */
  let semilla = 7; const rnd = () => (semilla = (semilla * 9301 + 49297) % 233280) / 233280;
  const motas = (n, dentro, colores, r) => { let h = ""; let k = 0;
    while(k < n){ const x = 56 + rnd() * 88, y = 34 + rnd() * 130; if(!dentro(x, y)) continue; k++;
      h += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(r * (.6 + rnd() * .6)).toFixed(2)}" fill="${colores[k % colores.length]}"/>`; }
    return h; };
  const enPelo = (x, y) => y < 66 && y > 32;
  const enBarba = (x, y) => y > 104 && y < 162 && !(y < 145 && Math.abs(x - 100) < 18);
  const texturaPelo = motas(55, enPelo, [P.peloOsc, P.peloClaro], 1.2);
  const texturaBarba = motas(45, enBarba, [P.barbaOsc, P.barbaClaro], 1.05);
  /* Símbolo de enojo de cómic */
  const enojo = molesto && opts.simbolo !== false
    ? `<g transform="translate(150 50) rotate(12)" stroke="#D8432F" stroke-width="4" stroke-linecap="round" fill="none">
         <path d="M-12 -4 Q-4 -4 -4 -12 M12 -4 Q4 -4 4 -12 M-12 4 Q-4 4 -4 12 M12 4 Q4 4 4 12"/></g>` : "";
  return `<svg viewBox="0 0 200 200" class="avatar-mia ${cara}" aria-hidden="true" focusable="false">
    <defs><clipPath id="${id}"><circle cx="100" cy="100" r="100"/></clipPath><clipPath id="${id}h"><path d="M61 78 C58 56 70 40 88 38 C96 33 108 33 116 37 C132 40 143 54 139 78 C136 66 132 60 126 58 C118 54 112 56 106 55 C98 54 92 56 84 56 C76 58 68 63 61 78 Z"/></clipPath><clipPath id="${id}b"><path d="M62 104 C64 116 68 124 72 118 C76 128 84 125 92 126 L108 126 C116 125 124 128 128 118 C132 124 136 116 138 104 C140 130 128 156 100 160 C72 156 60 130 62 104 Z"/></clipPath>
      <radialGradient id="${id}g" cx="45%" cy="40%" r="65%"><stop offset="0" stop-color="${P.luz}"/><stop offset=".7" stop-color="${P.piel}"/><stop offset="1" stop-color="${P.sombra}"/></radialGradient></defs>
    <g clip-path="${opts.recorte === false ? "" : `url(#${id})`}">
      ${fondo}
      <!-- camiseta -->
      <path d="M14 214 C18 176 50 158 100 158 C150 158 182 176 186 214 Z" fill="${P.camisa}"/>
      <path d="M74 160 Q100 178 126 160 Q120 172 100 174 Q80 172 74 160 Z" fill="${P.camisaOsc}"/>
      <g transform="translate(138 186) scale(.42)" fill="${P.logo}"><path d="M-14 -16h32l-5 9h-27a5 5 0 0 0-5 5v6a5 5 0 0 0 5 5h18l2-4h-9l4-8h20l-7 17a6 6 0 0 1-5 4h-30a10 10 0 0 1-10-10v-14a10 10 0 0 1 10-10z"/></g>
      <!-- cuello -->
      <path d="M80 140 h40 v22 Q100 174 80 162 Z" fill="${P.sombra}"/>
      <!-- orejas -->
      <ellipse cx="58" cy="100" rx="9" ry="13" fill="${P.oreja}"/><path d="M58 94 q-4 6 0 12" stroke="${P.sombra}" stroke-width="2" fill="none"/>
      <ellipse cx="142" cy="100" rx="9" ry="13" fill="${P.oreja}"/><path d="M142 94 q4 6 0 12" stroke="${P.sombra}" stroke-width="2" fill="none"/>
      <!-- cabeza -->
      <path d="M58 86 C58 50 78 39 100 39 C122 39 142 50 142 86 C142 120 133 150 100 157 C67 150 58 120 58 86 Z" fill="url(#${id}g)"/>
      <!-- arrugas de la frente -->
      <path d="M82 64 Q100 60 118 64 M86 70 Q100 67 114 70" stroke="${P.sombra}" stroke-width="1.4" stroke-linecap="round" fill="none" opacity="${molesto ? .9 : .5}"/>
      <!-- pelo corto con canas, entradas en las sienes -->
      <path d="M61 78 C58 56 70 40 88 38 C96 33 108 33 116 37 C132 40 143 54 139 78 C136 66 132 60 126 58 C118 54 112 56 106 55 C98 54 92 56 84 56 C76 58 68 63 61 78 Z" fill="${P.pelo}"/>
      <g clip-path="url(#${id}h)" opacity=".75">${texturaPelo}</g>
      <path d="M60 80 C60 88 61 96 62 100 L64 100 C63 92 63 86 64 80 Z M140 80 C140 88 139 96 138 100 L136 100 C137 92 137 86 136 80 Z" fill="${P.pelo}"/>
      ${cejas}
      ${ojo(80)}${ojo(120)}
      <!-- nariz -->
      <path d="M100 92 C97 102 92 110 92 115 C92 120 97 121 100 120 C103 121 108 120 108 115 C108 110 103 102 100 92 Z" fill="${P.sombra}" opacity=".55"/>
      <path d="M93 116 Q100 122 107 116" stroke="${P.sombra}" stroke-width="2" stroke-linecap="round" fill="none"/>
      <ellipse cx="96" cy="108" rx="2.2" ry="5" fill="${P.luz}" opacity=".6"/>
      ${molesto || serio ? "" : `<ellipse cx="72" cy="110" rx="7" ry="4" fill="#E0796A" opacity=".28"/><ellipse cx="128" cy="110" rx="7" ry="4" fill="#E0796A" opacity=".28"/>`}
      <!-- barba corta canosa -->
      <path d="M62 104 C64 116 68 124 72 118 C76 128 84 125 92 126 L108 126 C116 125 124 128 128 118 C132 124 136 116 138 104 C140 130 128 156 100 160 C72 156 60 130 62 104 Z" fill="${P.barba}"/>
      <g clip-path="url(#${id}b)" opacity=".7">${texturaBarba}</g>
      ${boca}
      ${bigote}
      <path d="M100 150 v8" stroke="${P.barbaOsc}" stroke-width="1.3" opacity=".6"/>
      ${enojo}
      ${molesto && opts.dedo !== false ? `<g>
        <path d="M146 214 C148 198 154 190 164 188 L198 196 L200 214 Z" fill="${P.camisa}"/>
        <path d="M134 184 C132 172 140 164 152 164 L164 165 C173 167 175 177 171 186 C167 194 156 197 146 196 C139 195 135 190 134 184 Z" fill="${P.piel}" stroke="${P.sombra}" stroke-width="1.5"/>
        <path d="M152 175 C155 173 160 173 163 175 M150 183 C154 181 160 181 164 183" stroke="${P.sombra}" stroke-width="1.3" fill="none" stroke-linecap="round"/>
        <path d="M137 186 C139 192 146 193 150 189" stroke="${P.sombra}" stroke-width="1.3" fill="none" stroke-linecap="round"/>
        <ellipse cx="140" cy="168" rx="11" ry="12.5" fill="${P.piel}" stroke="${P.sombra}" stroke-width="1.5"/>
        <ellipse cx="139" cy="164.5" rx="6.5" ry="5.5" fill="${P.luz}" stroke="${P.sombra}" stroke-width="1"/>
        <path d="M131 175 Q140 181 149 175" stroke="${P.sombra}" stroke-width="1.2" fill="none" stroke-linecap="round"/>
      </g>` : ""}
      ${pulgar ? `<g transform="translate(-20 -16)">
        <path d="M140 234 C142 204 148 196 158 194 L224 204 L226 234 Z" fill="${P.camisa}"/>
        <!-- pulgar arriba -->
        <path d="M150 168 C147 156 148 144 152 134 C154 129 161 129 163 134 C165 142 164 154 165 166 Z" fill="${P.piel}" stroke="${P.sombra}" stroke-width="1.5" stroke-linejoin="round"/>
        <path d="M153.5 136 C154.5 132.5 160.5 132.5 161.5 136 L161 142 L154 142 Z" fill="${P.luz}" stroke="${P.sombra}" stroke-width=".9"/>
        <!-- puño -->
        <path d="M136 172 C136 165 141 162 148 162 L172 163 C180 164 183 170 183 178 L182 190 C181 198 175 202 166 202 L148 201 C140 200 136 195 136 188 Z" fill="${P.piel}" stroke="${P.sombra}" stroke-width="1.5" stroke-linejoin="round"/>
        <path d="M160 172 H182 M160 181 H182.5 M160 190 H181" stroke="${P.sombra}" stroke-width="1.3" stroke-linecap="round"/>
        <path d="M160 165 V199" stroke="${P.sombra}" stroke-width="1.2" stroke-linecap="round" opacity=".7"/>
      </g>` : ""}
    </g>
  </svg>`;
}
