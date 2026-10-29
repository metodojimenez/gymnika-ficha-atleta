/* ====================== RUTINAS (PANEL DEL COACH) ======================
   Fuente: Macrociclo Gymnika · Documento Master 2026-2027.
   Vista general para el equipo: qué rutinas R1-R5 tocan en la semana del macrociclo, con su dosis.
   R1, R2 y R3 son el 1.º, 2.º y 3.º día de la semana de cada persona; R4 y R5 se reparten según
   cuántos días viene (tabla "Reparto según los días de asistencia"). */

const RUTINAS = {
  R1: { titulo: "Empuje inferior (sentadilla) + jalón superior", pre: "mov" },
  R2: { titulo: "Bisagra + empuje superior", pre: "est" },
  R3: { titulo: "Empuje y arrastre con trineo + unilateral + resistir rotación", pre: "mov" },
  R4: { titulo: "Movilidad y descompresión", pre: null },
  R5: { titulo: "Propiocepción, equilibrio y SNC", pre: "est" }
};

/* Reparto de la semana (semana 1, 2 y 3 del bloque de 3 semanas) según los días de asistencia */
const REPARTO = {
  3: [["R1", "R2", "R3"], ["R1", "R2", "R4"], ["R1", "R2", "R5"]],
  4: [["R1", "R2", "R3", "R4"], ["R1", "R2", "R3", "R5"], ["R1", "R2", "R3", "R4"]],
  5: [["R1", "R2", "R3", "R4", "R5"], ["R1", "R2", "R3", "R4", "R5"], ["R1", "R2", "R3", "R4", "R5"]]
};
/* Semanas de descarga (6 y 20): prioridad a 2 rutinas R4; "r" = reducida */
const REPARTO_DESCARGA = {
  3: ["R4", "R1r", "R4"],
  4: ["R4", "R1r", "R4", "R2r"], 5: ["R4", "R1r", "R4", "R2r", "R5"]
};

const PRECALENTAMIENTO = {
  mov: { nombre: "Movilidad", ej: "Gatos · Zancada con un pie a la altura de la mano, alternando · Aperturas de cadera · World's greatest stretch · Círculos con palo adelante y atrás, por encima y por debajo de la cabeza · Aperturas de cadera en L · 90-90" },
  est: { nombre: "Estabilidad", ej: "Loaded beast con pierna extendida · Rotaciones de nadador · Amarrocados · Halos con poca resistencia · Pulpos" }
};
const CALENTAMIENTO = [
  ["Respiración y control", "Respiración diafragmática 90/90", "5 respiraciones, exhalación larga", "Igual"],
  ["Respiración y control", "Dead bug con exhalación", "6 c/l", "Solo piernas"],
  ["Movilidad", "Inchworm con rotación torácica", "4", "Caminar manos desde cajón"],
  ["Movilidad", "Sentadilla cosaca sin carga", "4 c/l", "Rango parcial, con apoyo"],
  ["Activación", "Bear crawl", "2 × 10 m", "Cuadrupedia estática 20''"],
  ["Activación", "Puente de glúteo con marcha", "8 c/l", "Puente bilateral"],
  ["Activación", "Band pull-apart + push-up escapular", "12 + 8", "Push-up escapular en pared"],
  ["Aproximación", "Series progresivas del primer principal", "2-3 series al 40-70% del peso de trabajo", "Igual, con la regresión"]
];

/* e(nombre, series, reps, intensidad, descanso, claves, regresión, principal) */
function e(n, s, r, i, d, c, g, p){ return { n, s, r, i, d, c, g, p: !!p }; }

const SESIONES = {
  F1: {
    R1: [
      e("Sentadilla frontal", "4", "4-6", "RPE 7 → 9", "2'30-3'", "Codos altos, tronco vertical, rodilla sigue al pie", "Goblet squat", 1),
      e("Dominada lastrada", "4", "3-6", "RPE 7 → 9", "2'30-3'", "Escápulas abajo antes de tirar, sin balanceo", "Dominada con banda", 1),
      e("Búlgara con KB en rack", "3", "6 c/l", "RIR 2", "90''", "Pie delantero completo, pelvis nivelada", "Split squat"),
      e("Pallof con pausa semi-arrodillado", "3", "8 c/l, pausa 3''", "RIR 2", "60''", "Costillas abajo, cadera fija", "Pallof de pie, banda ligera")
    ],
    R2: [
      e("Peso muerto con barra", "4", "3-5", "RPE 7 → 9", "3'", "Barra pegada, columna neutra, empujar el piso", "PM con KB", 1),
      e("Press landmine 1 brazo semi-arrodillado", "4", "5-6 c/l", "RPE 7 → 9", "2'", "Glúteo de la rodilla apoyada activo, sin arquear", "Press landmine 2 manos", 1),
      e("Remo Meadows", "3", "6-8 c/l", "RIR 2", "90''", "Codo hacia la cadera, tronco quieto", "Remo con mancuerna apoyado"),
      e("Carrera de maleta pesada", "3", "20-30 m c/l", "RPE 8", "90''", "Hombros nivelados, paso normal", "15 m, carga ligera")
    ],
    R3: [
      e("Empuje de trineo pesado", "5", "15 m", "RPE 8", "2'", "Línea hombro-cadera-tobillo, pasos cortos", "Trineo ligero", 1),
      e("Fondos lastrados", "4", "4-6", "RPE 7 → 9", "2'30", "Hombro bajo control, rango sin dolor", "Fondos en banco", 1),
      e("PMR 1 pierna con KB contralateral", "3", "6 c/l", "RIR 2", "90''", "Cadera cuadrada, espalda larga", "PMR 1 pierna con apoyo de mano"),
      e("Arrastre de trineo hacia atrás", "4", "20 m", "RPE 7-8", "90''", "Talones que empujan, tronco inclinado", "Carga ligera"),
      e("Remo renegado", "3", "6 c/l", "RIR 2", "60''", "Pies separados, cadera sin girar", "Desde rodillas")
    ]
  },
  F2: {
    R1: [
      e("Goblet squat con pausa 2''", "3→4", "10-12", "RIR 2-3", "60-90''", "Pausa abajo sin rebote", "Goblet a cajón", 1),
      e("Remo invertido TRX pies elevados", "3→4", "10-15", "RIR 2-3", "60-90''", "Cuerpo en tabla, pecho a las manos", "TRX más vertical", 1),
      e("Zancada inversa con chaleco", "3", "10 c/l", "RIR 2", "60''", "Rodilla trasera cerca del piso, tronco alto", "Sin chaleco, con apoyo"),
      e("Plank pull-through con KB", "3", "8 c/l", "RIR 2", "45''", "Cadera quieta al arrastrar", "Desde rodillas")
    ],
    R2: [
      e("KB swing ruso", "3→4", "15", "RIR 2-3", "60-90''", "Bisagra, no sentadilla; brazos pasivos", "PMR con KB", 1),
      e("Push-up con chaleco o en déficit", "3→4", "10-15", "RIR 2", "60-90''", "Cuerpo en bloque, codos a 45°", "Manos en cajón", 1),
      e("Remo con mancuerna a 1 brazo apoyado en banco", "3", "10 c/l", "RIR 2", "60''", "Mano y rodilla apoyadas, columna neutra", "Remo con elásticos"),
      e("Farmer asimétrico", "3", "30 m", "RPE 7", "45''", "Tronco recto con cargas distintas", "Simétrico ligero")
    ],
    R3: [
      e("Step-up alto con mancuernas", "3", "10 c/l", "RIR 2", "60''", "Sube la pierna de arriba, sin impulso de la de abajo", "Cajón bajo", 1),
      e("Press landmine de pie", "3", "12 c/l", "RIR 2", "60''", "Costillas abajo, empuje hacia adelante y arriba", "Semi-arrodillado 2 manos", 1),
      e("Hip thrust 1 pierna", "3", "12 c/l", "RIR 2", "60''", "Pelvis nivelada arriba", "Puente bilateral"),
      e("Trineo adelante/atrás", "4", "20 + 20 m", "RPE 7", "60''", "Ritmo constante", "Carga ligera"),
      e("Bear crawl con chaleco", "3", "20 m", "RPE 7", "45''", "Rodillas a 2 cm del piso, espalda plana", "Sin chaleco, 10 m")
    ]
  },
  F3: {
    R1: [
      e("Sentadilla frontal → salto a cajón", "3-4 pares", "3 + 4", "RPE 8 + máxima intención", "60-90'' / 2'30-3'", "Aterrizar suave en el cajón y bajar caminando", "Goblet → sentarse y levantarse rápido con med ball", 1),
      e("Dominada lastrada → slam de med ball", "3 pares", "3 + 5", "RPE 8 + máxima", "60-90'' / 2'30", "Slam con todo el cuerpo, no solo brazos", "Dominada con banda → slam ligero", 1),
      e("Pallof explosivo", "3", "6 c/l", "Salida rápida, pausa 1''", "60''", "Cadera fija durante la salida", "Pallof con pausa")
    ],
    R2: [
      e("Peso muerto → KB swing explosivo", "3-4 pares", "3 + 5", "RPE 8 + máxima", "60-90'' / 3'", "Swing con cadera que «chasquea»", "PM con KB → PMR con KB rápido", 1),
      e("Press landmine pesado → pase de pecho med ball", "3 pares", "3 c/l + 5", "RPE 8 + máxima", "60-90'' / 2'30", "Pase de pie, soltar al final del empuje", "Landmine 2 manos → pase ligero", 1),
      e("Carrera de maleta", "3", "20 m c/l", "RPE 7-8", "60''", "Hombros nivelados", "Carga ligera")
    ],
    R3: [
      e("Sprint con trineo ligero", "6", "10-15 m", "Carga que permita postura de sprint", "2'", "Inclinación desde el tobillo, brazos activos", "Trineo en marcha rápida", 1),
      e("Landmine push press", "4", "3-4 c/l", "Carga moderada, máxima velocidad", "2'", "Impulso de piernas y extensión completa", "Landmine 2 manos rápido", 1),
      e("Clean de KB", "4", "4-5 c/l", "Moderada, máxima velocidad", "2'", "KB cerca del cuerpo, recepción suave", "High pull KB", 1),
      e("High pull KB", "3", "5", "Moderada", "90''", "Codos altos, cadera explosiva", "Swing corto")
    ]
  }
};
const PLIO_EXTENSIVA = [
  e("Pogos", "3", "10-15 contactos", "Baja, rítmica", "60''", "Tobillo rígido, contacto corto, rodilla casi recta", "Pogos sin despegar (talones)"),
  e("Saltos de tobillo adelante/atrás y laterales sobre línea", "3", "10 c/dirección", "Baja", "60''", "Silenciosos, mirada al frente", "Paso rápido sin salto"),
  e("Saltos con minivallas continuos", "3", "6-8 contactos", "Baja-media", "90''", "Rebote corto, brazos coordinados", "Pasar caminando rápido"),
  e("Saltos laterales con estabilización", "3", "5 c/l", "Media, aterrizaje 2''", "60''", "Rodilla sobre el pie, cadera atrás", "Paso lateral con freno"),
  e("Push-up pliométrico a cajón", "3", "5-6", "Media", "90''", "Manos elevadas, recepción suave", "Push-up rápido en pared")
];
const PLIO_INTENSIVA = [
  e("Drop jump desde cajón 30-45 cm", "3-4", "4-5 contactos", "Máxima, contacto mínimo", "2'", "Caer, rebotar rápido y alto; si se hunde, bajar el cajón", "Extensiva", 1),
  e("Saltos continuos con vallas", "3", "5 contactos", "Máxima", "2'", "Rodillas arriba, sin pausa entre vallas", "Minivallas", 1),
  e("Bounds alternos", "3", "6 contactos", "Alta", "2'", "Empuje horizontal largo, brazos opuestos", "Skips largos", 1),
  e("Skater reactivo", "3", "4 c/l", "Alta", "90''", "Rebote inmediato al lado contrario", "Salto lateral con estabilización"),
  e("Drop push-up", "3", "4-5", "Alta", "2'", "Caer desde cajones bajos y empujar al instante", "Push-up pliométrico a cajón"),
  e("Pase de rebote med ball a pared", "3", "8", "Alta", "90''", "Recibir y soltar sin pausa", "Pase normal")
];
const MANTENIMIENTO = {
  R1: e("Mantenimiento: sentadilla frontal + dominada lastrada", "2-3", "3", "RPE 7-8", "2'", "Igual que en la Fase 1", "Regresión de la Fase 1", 1),
  R2: e("Mantenimiento: peso muerto + press landmine", "2-3", "3", "RPE 7-8", "2'", "Igual que en la Fase 1", "Regresión de la Fase 1", 1)
};

/* Dosis de la semana (progresión de cada fase): aptos · no aptos · qué cambia */
const DOSIS_SEMANA = {
  1: ["3 × 5-6, RPE 7", "2-3 × 8, RIR 3-4", "Cargas de referencia y técnica"],
  2: ["4 × 5-6, RPE 7-7,5", "3 × 8, RIR 3", "+1 serie"],
  3: ["4 × 4-5, RPE 8", "3 × 6-8, RIR 3", "+carga"],
  4: ["4 × 4-5, RPE 8-8,5", "3 × 6-8, RIR 2-3", "+carga"],
  5: ["4 × 3-4, RPE 8,5-9 (pico)", "3 × 6, RIR 2", "+carga; prueba de fuerza"],
  6: ["Descarga: 2 rutinas R4 y el resto reducidas", "Igual", "Volumen reducido antes de la Fase 2"],
  7: ["3 series, RIR 3", "2 series, RIR 3-4", "Adaptación; crusher de 5' a ritmo cómodo"],
  8: ["4 series, RIR 2", "3 series, RIR 3", "+1 serie; crusher de 5' a ritmo alto"],
  9: ["3 pares, pesado RPE 7,5", "2-3 pares, RPE ≤7; explosivos con med ball", "Técnica del par"],
  10: ["4 pares, RPE 8", "3 pares", "+1 par"],
  11: ["4 pares, RPE 8-8,5", "3 pares", "+carga en el pesado"],
  12: ["4 pares, RPE 8,5; med ball +1-2 kg", "3 pares", "+carga en el explosivo"],
  13: ["3 pares, RPE 8", "2-3 pares", "Consolidación y pruebas antes de la Fase 4"],
  14: ["60 contactos, baja altura", "30-40 contactos", "Inicio extensiva"],
  15: ["80 contactos", "40-50 contactos", "+contactos"],
  16: ["100 contactos; evaluación de criterios", "50-60 contactos", "+contactos"],
  17: ["Intensiva: 30-40 contactos, cajón 30 cm", "Extensiva 50-60", "Cambio a alta intensidad"],
  18: ["Intensiva: 40-50 contactos, cajón hasta 45 cm", "Extensiva 50-60", "+contactos y altura"],
  19: ["Pruebas: saltos primero (R1), fuerza después (R2-R3); resto de la sesión a RPE 6", "Igual", "Registrar todo y reclasificar por patrón"],
  20: ["Transición: 2 rutinas R4 + técnica de los principales de la Fase 1 a RPE 5-6", "Igual", "Fijar cargas de referencia de la semana 1"]
};
const PRUEBAS = [
  { sem: [5, 19], txt: "3-5 RM estimado (aptos) o reps a carga fija (no aptos) en sentadilla, peso muerto, dominada y press landmine" },
  { sem: [5, 19], txt: "Push-up máximas con técnica y dominadas máximas" },
  { sem: [7, 8, 19], txt: "Rondas del crusher estándar en 5'" },
  { sem: [9, 13, 16, 19], txt: "Salto vertical con alcance en pared (3 intentos, el mejor)" },
  { sem: [9, 13, 19], txt: "Salto horizontal con aterrizaje estabilizado (3 intentos)" },
  { sem: [17, 18, 19], txt: "Triple salto horizontal desde parado (solo quienes hacen intensiva)" }
];
const CRUSHER = {
  F1: ["KTB complex pesado y corto · Farmer carry pesado 30 m + arrastre de trineo 20 m", "KTB complex ligero · Farmer moderado 20 m", "3 rondas, descanso libre. Carga alta, técnica simple, sin fallo"],
  F2: ["KTB complex por rondas · Bear crawl complex · EMOM: KB swing 10 + goblet squat 8 + push-up 8 + remo TRX 10", "Mismos formatos con regresiones y 60-70% de las reps", "AMRAP o EMOM de 5'. Poca pausa, técnica estable"],
  F3: ["Piques con resistencia · Saltos con resistencia de liga · Slam de med ball × 5", "Marcha rápida con resistencia · Slam ligero", "5-6 series de 5-8'', descanso completo. Se corta si la velocidad cae"],
  F4: ["Saltos largos, altos y laterales · Skater jump", "Saltos laterales con estabilización · Farmer + bear crawl", "3-4 series; los saltos se suman a los contactos del día"]
};
/* Rutinas de rotación: cada fila va de lo más fácil a lo más difícil; las regresiones son para no aptos */
const ROT_OPCIONES = {
  pallof: ["Resistir", "Pallof", "Pallof isométrico arrodillado con banda ligera → Pallof press semi-arrodillado", "Pallof press de pie, pies paralelos", "Pallof en zancada estática con pausa 3'' → Pallof con elevación sobre la cabeza"],
  zancada: ["Rotar", "Zancada con rotación", "Split squat estático con rotación, sin carga y con apoyo → Zancada inversa con rotación sin carga", "Zancada inversa con rotación, med ball al frente", "Zancada caminando con rotación → Zancada con rotación contra banda o landmine"],
  renegade: ["Resistir", "Renegade row", "Plancha alta con toques de hombro → Renegade row desde rodillas o con manos en banco", "Renegade row con pies anchos", "Renegade row con pies juntos y pausa 2'' → Renegade row + push-up"],
  lanzamiento: ["Rotar", "Lanzamiento rotacional de med ball", "Giro y pase lento a un compañero → Lanzamiento rotacional semi-arrodillado con balón ligero", "Lanzamiento rotacional de med ball a pared, de pie", "Lanzamiento con paso previo → Lanzamiento con rebote y recepción continua"],
  presslandmine: ["Rotar", "Press landmine con rotación", "Press landmine a 2 manos semi-arrodillado con giro corto → Press landmine a 1 brazo semi-arrodillado con rotación", "Press landmine a 1 brazo de pie con rotación", "Press con rotación e impulso de piernas → Press con rotación y paso"],
  plancha: ["Resistir", "Plancha frontal", "Plancha con manos en banco → Plancha en antebrazos desde rodillas", "Plancha frontal en antebrazos, 30-40''", "Plancha con antebrazos en pelota de yoga → Círculos con los antebrazos en la pelota"],
  lateral: ["Resistir", "Plancha lateral", "Plancha lateral desde rodillas → Plancha lateral con pies escalonados", "Plancha lateral en antebrazo, 20-30''", "Plancha lateral con elevación de pierna → Plancha lateral con remo de banda"],
  marcha: ["Resistir", "Marcha estática", "Marcha estática sin carga con apoyo en pared → Marcha estática sin carga, pausa 2'' arriba", "Marcha estática con KB en una mano", "Marcha estática con KB en rack a un lado → Marcha estática con KB sobre la cabeza"],
  halo: ["Resistir", "Halo", "Halo sentado con disco ligero → Halo arrodillado con disco ligero", "Halo de pie con KB", "Halo semi-arrodillado con KB más pesada → Halo en zancada estática"],
  chop: ["Rotar", "Chop", "Chop arrodillado con banda ligera → Chop semi-arrodillado con banda", "Chop wood de pie con banda, de arriba hacia abajo", "Chop de abajo hacia arriba con pivote → Chop con med ball a velocidad"],
  pressuni: ["Rotar", "Press unilateral con rotación", "Press unilateral sentado sin rotación → Press unilateral semi-arrodillado con giro corto", "Press de hombro unilateral de pie con rotación", "Press unilateral con KB invertida y rotación → Push press unilateral con rotación"],
  suitcase: ["Resistir", "Marcha suitcase", "Sostén suitcase estático 20-30'' → Marcha suitcase 10-15 m con carga ligera", "Marcha suitcase 20 m, carga moderada", "Marcha suitcase pesada 30 m → Marcha suitcase con KB invertida"],
  windmill: ["Rotar", "Windmill", "Windmill sin carga, mano deslizando por la pierna → Windmill semi-arrodillado sin carga", "Windmill de pie con KB en la mano de abajo", "Windmill con KB arriba → Windmill con 2 KB"],
  cadera: ["Rotar", "Rotación de cadera", "Rotación de cadera de pie con apoyo en pared → Patada lateral en cuadrupedia con manos en el piso", "Rotación de cadera con el pecho apoyado en la pelota de yoga", "En la pelota con pausa 2'' arriba → En la pelota con banda sobre las rodillas"],
  silla: ["Resistir", "Silla romana", "Bird-dog → Isometría frontal en silla romana 15-20''", "Silla romana: extensión frontal hasta la línea neutra", "Isometría lateral en silla romana → Extensión lateral en silla romana"],
  barra: ["Resistir", "Barra asimétrica", "Sostén suitcase con KB → Barra asimétrica con poca carga, 15''", "Barra asimétrica sostenida de pie, 20-30''", "Barra asimétrica en zancada estática → Marcha estática con barra asimétrica"]
};
/* Qué se elige en cada fase (tabla "Fase · Énfasis · De dónde elegir") */
const ROTACION = {
  F1: ["Control lento con pausa", ["pallof", "chop", "windmill", "halo", "suitcase", "barra"]],
  F2: ["Más repeticiones y tiempo bajo tensión", ["plancha", "lateral", "renegade", "zancada", "marcha", "silla"]],
  F3: ["Rotación con velocidad", ["lanzamiento", "presslandmine", "pressuni", "chop"]],
  F4: ["Rotación reactiva y control", ["lanzamiento", "cadera", "pallof"]],
  C: ["Variantes medias a baja intensidad (libre)", Object.keys(ROT_OPCIONES)]
};
const COMPENSACION = [
  ["Base (elige 1)", "Colgado relajado en barra · Respiración 90/90 con exhalación larga"],
  ["Menú Gymnika (elige 2)", "Ranas · San José · Aperturas en L · El 4 (estiramiento de glúteo) · Hinge de cadera · Good morning · Pivoteos de cadera"],
  ["Rotaciones Gymnika (elige 1)", "Patada de Ballet · Caballero · Cachetadas"]
];
const BLOQUES_R4 = [
  ["Respiración", "5'", "Respiración diafragmática 90/90 con exhalación larga", "2 × 5 respiraciones"],
  ["Movilidad de columna y cadera", "15'", "Gatos · World's greatest stretch · Zancada con un pie a la altura de la mano · Aperturas de cadera · Aperturas de cadera en L · 90-90", "2 rondas, 6-8 por lado"],
  ["Movilidad escapular", "10'", "Círculos con palo · Rotaciones de nadador · Amarrocados · Halos con poca resistencia", "2 rondas, 8 repeticiones"],
  ["Rotaciones Gymnika", "10'", "Caballero · Cachetadas · Patada de Ballet", "8 repeticiones cada una"],
  ["Descompresión", "15'", "Colgado relajado en barra · Ranas · San José · El 4 · Hinge de cadera · Good morning · Pivoteos de cadera", "Colgado 3 × 20-30''; el resto 45-60'' por lado"],
  ["Respiración final", "5'", "Respiración 90/90", "2-3' y salida suave"]
];
const BLOQUES_R5 = [
  ["Pre-calentamiento de estabilidad", "5'", "Loaded beast con pierna extendida · Rotaciones de nadador · Halos con poca resistencia", "1 ronda"],
  ["Equilibrio estático", "12'", "Marcha estática · Barra asimétrica en isometría · Plancha lateral", "3 × 20-30'' por lado"],
  ["Equilibrio dinámico a 1 pierna", "15'", "PMR 1 pierna · Step-up alto lento · Windmill", "3 × 6 por lado, sin llegar a la fatiga"],
  ["Propiocepción en pelota", "10'", "Plancha con antebrazos en pelota de yoga · Rotación de cadera en pelota de yoga", "3 × 20-30'' u 8 por lado"],
  ["SNC", "13'", "Ejercicios con pelotas en equilibrio, coordinando movimientos distintos de brazos y piernas · Ejercicios posturales", "Series de 20-40'' con calidad, sin llegar a la fatiga"],
  ["Compensación", "5'", "Menú Gymnika", "3-4 ejercicios"]
];

/* ---------- Cálculo ---------- */
function faseDeSemana(s){
  return s <= 6 ? "F1" : s <= 8 ? "F2" : s <= 13 ? "F3" : s <= 16 ? "F4a" : s <= 18 ? "F4b" : "C";
}
const FASE_NOMBRE = { F1: "Fase 1 · Miofibrilar", F2: "Fase 2 · Sarcoplasmático", F3: "Fase 3 · Fuerza Explosiva", F4a: "Fase 4 · Pliometría extensiva", F4b: "Fase 4 · Pliometría intensiva", C: "Cierre" };

/* ---------- Pintado ---------- */
const rutinaUI = { tab: "R1", desfase: 0 };

function ejercicioHTML(x){
  return `
    <li class="rt-ej${x.p ? " principal" : ""}">
      <div class="rt-ej-top">
        <span class="rt-ej-n">${x.p ? '<span class="rt-star" aria-label="Principal">★</span> ' : ""}${esc(x.n)}</span>
        <span class="rt-ej-dosis num">${esc(x.s)} × ${esc(x.r)}</span>
      </div>
      <p class="rt-ej-meta"><span>${esc(x.i)}</span><span>Descanso ${esc(x.d)}</span></p>
      <p class="rt-ej-claves">${esc(x.c)}</p>
      ${x.g ? `<p class="rt-ej-reg"><span>Reg.</span> ${esc(x.g)}</p>` : ""}
    </li>`;
}
function bloqueHTML(b){
  return `<li class="rt-bloque"><div class="rt-ej-top"><span class="rt-ej-n">${esc(b[0])}</span><span class="rt-ej-dosis num">${esc(b[1])}</span></div>
    <p class="rt-ej-claves">${esc(b[2])}</p><p class="rt-ej-meta"><span>${esc(b[3])}</span></p></li>`;
}
function seccionHTML(num, titulo, tiempo, cuerpo){
  return `<section class="rt-bloque-sesion"><h4 class="rt-h"><span class="rt-num">${num}</span>${titulo}${tiempo ? `<span class="rt-tiempo">${tiempo}</span>` : ""}</h4>${cuerpo}</section>`;
}
function rotacionHTML(fBase){
  const [enfasis, claves] = ROTACION[fBase];
  return `
    <p>1 ejercicio de rotar + 1 de resistir rotación, 2 rondas de 6-10 repeticiones por lado o 20-30''. <strong>Énfasis:</strong> ${esc(enfasis)}.</p>
    <ul class="rt-lista rt-rot">${claves.map(k => {
      const o = ROT_OPCIONES[k];
      return `<li class="rt-ej"><div class="rt-ej-top"><span class="rt-ej-n">${esc(o[1])}</span><span class="rt-tipo">${esc(o[0])}</span></div>
        <p class="rt-ej-reg"><span>Reg.</span> ${esc(o[2])}</p>
        <p class="rt-ej-claves"><strong>Media:</strong> ${esc(o[3])}</p>
        <p class="rt-ej-reg"><span>Prog.</span> ${esc(o[4])}</p></li>`;
    }).join("")}</ul>
    <p class="muted">${fBase === "F1" || fBase === "F2" ? "Los lanzamientos a velocidad entran desde la Fase 3; antes solo van las versiones lentas. " : ""}Windmill con carga y extensión lateral en silla romana: solo aptos.</p>`;
}

/* Contenido de una rutina (R1-R5) para la semana del macrociclo dada, en el orden de la plantilla de sesión */
function contenidoRutina(base, semana, reducida){
  const fase = faseDeSemana(semana);
  const info = RUTINAS[base];
  if(base === "R4" || base === "R5"){
    return `
      <p class="rt-nota">${base === "R4" ? "Sin principales pesados ni crusher." : "Misma estructura en todas las fases."} No aptos: ${base === "R4"
        ? "mismo contenido en rango sin dolor; el colgado se hace con los pies apoyados."
        : "apoyo de una mano en pared en los ejercicios a 1 pierna, propiocepción sin pelota y, en el bloque SNC, coordinación sentado en la pelota o de pie en el piso."}</p>
      <ol class="rt-lista">${(base === "R4" ? BLOQUES_R4 : BLOQUES_R5).map(bloqueHTML).join("")}</ol>`;
  }

  const fBase = fase === "F4a" || fase === "F4b" ? "F4" : fase;
  const lista = (xs)=> `<ul class="rt-lista">${xs.map(ejercicioHTML).join("")}</ul>`;
  const notas = [];
  let bloquesCentrales = [];
  if(fase === "C" && semana === 19){
    const fuerza = PRUEBAS.filter(p => p.sem.includes(19) && /RM|Push-up/.test(p.txt));
    const saltos = PRUEBAS.filter(p => p.sem.includes(19) && /[Ss]alto/.test(p.txt));
    bloquesCentrales.push([base === "R1" ? "Pruebas de salto (van primero)" : "Pruebas de fuerza", "",
      `<ul class="rt-pruebas">${(base === "R1" ? saltos : fuerza).map(p => `<li>${esc(p.txt)}</li>`).join("")}</ul><p class="muted">El resto de la sesión, a RPE 6.</p>`]);
    if(base === "R1") notas.push("Quien arrastra dolor o fatiga de la Fase 4 no hace las pruebas de salto esta semana; quien faltó a más de la mitad de la Fase 4 no hace el triple salto.");
  } else if(fase === "C" || (semana === 6 && reducida)){
    bloquesCentrales.push(["Principales ★", "24'", lista(SESIONES.F1[base].filter(x => x.p))]);
    notas.push(semana === 20
      ? "Transición: técnica de los principales de la Fase 1 a RPE 5-6."
      : "Reducida: los mismos principales con la mitad de las series, a RPE 6-7 y sin crusher.");
  } else if(fBase === "F4"){
    const intensiva = fase === "F4b" && (base === "R1" || base === "R3");
    const plio = fase === "F4b" && base === "R2" ? [] : intensiva ? PLIO_INTENSIVA : PLIO_EXTENSIVA;
    if(plio.length) bloquesCentrales.push([`Pliometría ${intensiva ? "intensiva" : "extensiva"} (con el cuerpo fresco)`, "", lista(plio)]);
    bloquesCentrales.push(["Mantenimiento de fuerza ★", "", MANTENIMIENTO[base] ? lista([MANTENIMIENTO[base]]) : `<p class="muted">Según la sesión: 2-3 × 3 a RPE 7-8.</p>`]);
    if(intensiva) notas.push("Intensiva solo para quien cumple los criterios de ingreso; quien no, sigue en extensiva (50-60 contactos) con progresión de complejidad.");
    if(fase === "F4b" && base === "R2") notas.push("La pliometría intensiva va solo en R1 y R3, con al menos 48 h entre ellas.");
    notas.push("Si el contacto con el suelo se alarga o el aterrizaje se vuelve ruidoso, termina la serie. Dolor >2/10 en articulaciones de carga: vuelve a la extensiva esa semana.");
  } else {
    const ses = SESIONES[fase][base];
    bloquesCentrales.push(["Principales ★", "24'", lista(ses.filter(x => x.p))]);
    bloquesCentrales.push(["Complementarios", "8'", lista(ses.filter(x => !x.p))]);
    if(fase === "F3") notas.push("En R1-R3 los saltos totales por sesión no pasan de 25. La serie se corta si la velocidad cae a simple vista.");
    if(fase === "F1") notas.push("Nadie trabaja al fallo en esta fase.");
  }

  const pre = PRECALENTAMIENTO[info.pre];
  const cal = `<div class="table-wrap"><table class="rt-tabla"><thead><tr><th scope="col">Parte</th><th scope="col">Ejercicio</th><th scope="col">Dosis</th><th scope="col">Reg. (no aptos)</th></tr></thead>
    <tbody>${CALENTAMIENTO.map(c => `<tr><td class="muted">${esc(c[0])}</td><td><strong>${esc(c[1])}</strong></td><td>${esc(c[2])}</td><td>${esc(c[3])}</td></tr>`).join("")}</tbody></table></div>
    <p class="muted">${fBase === "F3" ? "Fase 3: al final, + 2 × 5 pogos suaves y 2 saltos submáximos a cajón."
      : fBase === "F4" ? "Fase 4: al final, + 2 × 10 pogos y 2 × 10 m de skips; esos contactos cuentan en el total pliométrico del día."
      : "Fases 1 y 2: la última parte son solo las series de aproximación."}</p>`;
  const cr = CRUSHER[fBase];
  const crusher = semana === 20 ? `<p>Carries ligeros o ninguno.</p>`
    : semana === 19 ? (base === "R3" ? `<p>Test de capacidad: crusher de la Fase 2, 5'.</p>` : `<p class="muted">Sin crusher: semana de pruebas.</p>`)
    : reducida ? `<p class="muted">Sin crusher en la rutina reducida.</p>`
    : `<p><strong>Aptos:</strong> ${esc(cr[0])}</p><p><strong>No aptos:</strong> ${esc(cr[1])}</p><p class="muted">${esc(cr[2])}</p>`;
  const comp = `<p>Elegir 1 de la base + 2 del menú Gymnika + 1 rotación: 30-45'' o 6-8 repeticiones por lado.</p>
    <ul class="rt-simple">${COMPENSACION.map(c => `<li><strong>${esc(c[0])}:</strong> ${esc(c[1])}</li>`).join("")}${fBase === "F4" ? "<li>En la Fase 4 se suma pantorrilla en pared y rodilla a la pared para el tobillo.</li>" : ""}</ul>`;

  let n = 1;
  return `
    ${notas.length ? `<p class="rt-nota">${notas.map(esc).join(" ")}</p>` : ""}
    ${seccionHTML(n++, `Pre-calentamiento · ${pre.nombre}`, "5'", `<p>Elegir 3-4: 1 ronda de 45-60'' o 6-8 repeticiones por lado.</p><p class="rt-opciones">${pre.ej.split(" · ").map(x => `<span>${esc(x)}</span>`).join("")}</p>${info.pre === "est" ? `<p class="muted">Pulpos: rotación externa e interna de hombros, con cada hombro moviéndose independiente del otro.</p>` : ""}`)}
    ${seccionHTML(n++, "Calentamiento", "8'", cal)}
    ${seccionHTML(n++, "Rotación", "5'", rotacionHTML(fBase))}
    ${bloquesCentrales.map(([t, tm, html]) => seccionHTML(n++, t, tm, html)).join("")}
    ${seccionHTML(n++, "Crusher", "5'", crusher)}
    ${seccionHTML(n++, "Compensación", "5'", comp)}`;
}

/* Semana del macrociclo a mostrar: la actual, o la que el coach elige con las flechas */
function semanaRutinas(desfase){
  const est = macrocicloEstado();
  const hoy = parseFecha(todayStr());
  const actual = est.antes ? 0 : Math.floor((hoy - MACRO_START) / (7 * 86400000));
  const abs = Math.max(0, actual + desfase);
  const inicio = sumarDias(MACRO_START, abs * 7);
  return { abs, semana: (abs % 20) + 1, ciclo: Math.floor(abs / 20) + 1, inicio, fin: sumarDias(inicio, 6), esActual: !est.antes && abs === actual, antes: est.antes };
}
function repartoHTML(semana){
  const descarga = semana === 6 || semana === 20;
  const filas = [3, 4, 5].map(n => descarga ? REPARTO_DESCARGA[n] : REPARTO[n][(semana - 1) % 3]);
  return `
    <p class="rt-reparto-t">${descarga ? "Semana de descarga: cada persona prioriza 2 rutinas R4." : "Qué rutina hace cada persona según cuántos días viene esta semana."}</p>
    <div class="table-wrap"><table class="rt-reparto">
      <thead><tr><th scope="col">Días</th>${[1, 2, 3, 4, 5].map(i => `<th scope="col">${i}.º</th>`).join("")}</tr></thead>
      <tbody>${filas.map((f, i) => `<tr><th scope="row">${i + 3}</th>${[0, 1, 2, 3, 4].map(j => {
        const c = f[j];
        return `<td>${c ? `<span class="rt-cod ${c.slice(0, 2)}">${c.slice(0, 2)}</span>${c.endsWith("r") ? `<span class="muted"> red.</span>` : ""}` : `<span class="muted">—</span>`}</td>`;
      }).join("")}</tr>`).join("")}</tbody>
    </table></div>`;
}

/* ---------- Rutina que toca hoy ----------
   R1, R2, R3… es el 1.º, 2.º, 3.º día que la persona entrena en la semana (lunes a domingo).
   Cuenta las veces que ya vino esta semana + sus reservas de hoy y de los próximos días para saber
   cuántos días viene (3, 4 o 5; con menos de 3 se usa la fila de 3, con más de 5 la de 5). */
function codigoRutina(semana, total, n){
  const f = Math.min(5, Math.max(3, total));
  const fila = (semana === 6 || semana === 20) ? REPARTO_DESCARGA[f] : REPARTO[f][(semana - 1) % 3];
  return fila[Math.min(n, fila.length) - 1];
}
async function cargarRutinasDeHoy(){
  const w = semanaRutinas(0);
  if(w.antes) return null;
  const hoy = todayStr();
  const lun = fechaISO(lunesDe(parseFecha(hoy)));
  const [horarios, { data, error }] = await Promise.all([
    cargarHorarios(),
    sb.from("reservas").select("*").gte("fecha", lun).lte("fecha", fechaISO(sumarDias(parseFecha(lun), 6)))
      .in("estado", ["confirmada", "asistio", "no_asistio"]).order("inicio")
  ]);
  if(error) return null;
  const fort = new Set(horarios.filter(h => h.categoria === "fortalecimiento").map(h => h.id));
  const porUsuario = {};
  (data || []).filter(r => fort.has(r.horario_id)).forEach(r => { (porUsuario[r.user_id] = porUsuario[r.user_id] || []).push(r); });
  const porReserva = {}, grupos = {};
  Object.entries(porUsuario).forEach(([uid, rs]) => {
    const antes = rs.filter(r => r.fecha < hoy && r.estado === "asistio").length;
    const deHoy = rs.filter(r => r.fecha === hoy && r.estado !== "no_asistio");
    const despues = rs.filter(r => r.fecha > hoy && r.estado === "confirmada").length;
    const total = antes + deHoy.length + despues;
    deHoy.forEach((r, i) => {
      const cod = codigoRutina(w.semana, total, antes + i + 1);
      porReserva[r.id] = cod;
      (grupos[cod] = grupos[cod] || []).push(uid);
    });
  });
  return { semana: w.semana, fase: faseDeSemana(w.semana), porReserva, grupos };
}
function rutinaChipHTML(cod){
  return cod ? `<span class="rt-cod ${cod.slice(0, 2)}" title="${esc(RUTINAS[cod.slice(0, 2)].titulo)}${cod.endsWith("r") ? " (reducida)" : ""}">${cod.slice(0, 2)}${cod.endsWith("r") ? "<small>red.</small>" : ""}</span>` : "";
}
/* Bloque "Rutina de hoy": qué rutinas tocan hoy y a quién; cada una abre su detalle */
function rutinasHoyHTML(rh){
  if(!rh) return `<p class="muted" style="margin:0">El macrociclo aún no comienza.</p>`;
  const nombre = (id)=> nombreCorto((state.athleteList.find(a => a.id === id) || {}).nombre);
  const cods = Object.keys(rh.grupos).sort();
  const cab = `<p class="rt-hoy-fase">Semana <strong>${rh.semana}</strong> de 20 · ${esc(FASE_NOMBRE[rh.fase])}${rh.semana === 6 || rh.semana === 20 ? " · Descarga" : ""}</p>`;
  if(!cods.length) return cab + `<p class="muted" style="margin:6px 0 0">Hoy nadie de fortalecimiento tiene reserva. Toca una rutina para verla:</p>
    <div class="rt-hoy-grid">${Object.keys(RUTINAS).map(k => `<button type="button" class="rt-hoy-item" data-ver-rt="${k}">${rutinaChipHTML(k)}<span class="rt-hoy-txt"><strong>${esc(RUTINAS[k].titulo)}</strong></span></button>`).join("")}</div>`;
  return cab + `<div class="rt-hoy-grid">${cods.map(c => `
    <button type="button" class="rt-hoy-item" data-ver-rt="${c}">
      ${rutinaChipHTML(c)}
      <span class="rt-hoy-txt"><strong>${esc(RUTINAS[c.slice(0, 2)].titulo)}${c.endsWith("r") ? " · reducida" : ""}</strong>
        <span class="muted">${plural(rh.grupos[c].length, "persona", "personas")}: ${rh.grupos[c].map(id => esc(nombre(id))).join(", ")}</span></span>
      <span class="rt-hoy-ver" aria-hidden="true">Ver →</span>
    </button>`).join("")}</div>`;
}
function abrirRutina(cod){
  rutinaUI.tab = cod.slice(0, 2); rutinaUI.desfase = 0; rutinaUI.elegida = true;
  if(location.hash === "#/rutinas") showCoachRoute(); else location.hash = "#/rutinas";
}
function enlazarRutinasHoy(box, enRutinas, main){
  box.querySelectorAll("[data-ver-rt]").forEach(b => {
    b.onclick = ()=>{
      if(enRutinas){ rutinaUI.tab = b.dataset.verRt.slice(0, 2); rutinaUI.elegida = true; renderCoachRutinas(main); main.querySelector(".rt-tabs").scrollIntoView({ behavior: "smooth", block: "start" }); }
      else abrirRutina(b.dataset.verRt);
    };
  });
}

/* Vista general "Rutinas" del panel del coach */
function renderCoachRutinas(main){
  const w = semanaRutinas(rutinaUI.desfase);
  const fase = faseDeSemana(w.semana);
  const descarga = w.semana === 6 || w.semana === 20;
  const dosis = DOSIS_SEMANA[w.semana];
  const pruebas = PRUEBAS.filter(p => p.sem.includes(w.semana) && w.semana !== 19);
  const tab = rutinaUI.tab;
  const mismoMes = w.inicio.getMonth() === w.fin.getMonth();
  const rango = `${w.inicio.getDate()}${mismoMes ? "" : " de " + MESES_LARGOS[w.inicio.getMonth()]} al ${w.fin.getDate()} de ${MESES_LARGOS[w.fin.getMonth()]}`;
  main.innerHTML = `<div class="detail"><header class="detail-head">
    <a class="back" href="#/">← Atletas</a>
    <p class="eyebrow">Panel del coach</p><h1>Rutinas</h1>
    <p class="lede" style="margin-top:6px">Programación general de fortalecimiento según el macrociclo. Solo la ve el equipo.</p></header>
    <div class="agenda-bar rt-bar">
      <button type="button" class="icon-btn" id="rtPrev" aria-label="Semana anterior"${w.abs === 0 ? " disabled" : ""}>‹</button>
      <span class="agenda-day">Semana <span class="num">${w.semana}</span> de 20 · ${rango}${w.esActual ? " · esta semana" : ""}</span>
      <button type="button" class="icon-btn" id="rtNext" aria-label="Semana siguiente">›</button>
      ${w.esActual ? "" : `<button type="button" class="btn-link" id="rtHoy">Esta semana</button>`}
    </div>
    ${w.esActual ? `<section class="panel rt-hoy" aria-labelledby="rtHoyT"><div class="panel-head"><h2 id="rtHoyT">Hoy toca</h2><span class="muted">${esc(fechaLarga(todayStr()))}</span></div>
      <div id="rtHoyBox"><div class="skel skel-line" style="width:70%"></div></div></section>` : ""}
    <section class="panel rutina">
      <div class="panel-head"><div><p class="eyebrow">${esc(FASE_NOMBRE[fase])}${descarga ? " · Descarga" : ""}${w.ciclo > 1 ? " · Ciclo " + w.ciclo : ""}</p>
        <h2>${w.antes ? "El macrociclo aún no comienza" : esc(FASE_NOMBRE[fase].split(" · ").pop())}</h2></div></div>
      <div class="rt-dosis">
        <p><strong>Esta semana:</strong> ${esc(dosis[0])}${dosis[1] !== "Igual" ? ` <span class="muted">· No aptos: ${esc(dosis[1])}</span>` : ""}</p>
        <p class="muted">${esc(dosis[2])}</p>
        ${pruebas.length ? `<p><strong>Pruebas:</strong> ${pruebas.map(p => esc(p.txt)).join(" · ")}</p>` : ""}
      </div>
      ${repartoHTML(w.semana)}
      <div class="seg rt-tabs" role="tablist" aria-label="Rutinas">
        ${Object.keys(RUTINAS).map(k => `<button type="button" role="tab" aria-selected="${k === tab}" data-rt="${k}">${k}</button>`).join("")}
      </div>
      <div class="rt-panel" role="tabpanel">
        <h3 class="rt-titulo">${tab} · ${esc(RUTINAS[tab].titulo)}</h3>
        ${contenidoRutina(tab, w.semana, w.semana === 6 && (tab === "R1" || tab === "R2"))}
      </div>
      <p class="rt-pie muted">★ principal · Reg. = regresión para no aptos en ese patrón. R1, R2 y R3 son el 1.º, 2.º y 3.º día de entrenamiento de cada persona en la semana; R4 y R5 se reparten según la tabla.</p>
    </section></div>`;
  const ir = (d)=>{ rutinaUI.desfase = d; renderCoachRutinas(main); };
  main.querySelector("#rtPrev").onclick = ()=> ir(rutinaUI.desfase - 1);
  main.querySelector("#rtNext").onclick = ()=> ir(rutinaUI.desfase + 1);
  const bh = main.querySelector("#rtHoy"); if(bh) bh.onclick = ()=> ir(0);
  main.querySelectorAll("[data-rt]").forEach(b => {
    b.onclick = ()=>{ rutinaUI.tab = b.dataset.rt; rutinaUI.elegida = true; renderCoachRutinas(main); };
  });
  if(w.esActual) cargarRutinasDeHoy().then(rh => {
    const box = main.querySelector("#rtHoyBox");
    if(!box) return;
    /* La primera vez se abre la rutina que más personas hacen hoy */
    const masComun = rh && Object.keys(rh.grupos).sort((a, b) => rh.grupos[b].length - rh.grupos[a].length)[0];
    if(masComun && !rutinaUI.elegida && masComun.slice(0, 2) !== rutinaUI.tab){ rutinaUI.tab = masComun.slice(0, 2); rutinaUI.elegida = true; renderCoachRutinas(main); return; }
    box.innerHTML = rutinasHoyHTML(rh);
    enlazarRutinasHoy(box, true, main);
  });
}
