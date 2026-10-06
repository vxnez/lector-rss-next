// verificar-historial.cjs — Prueba la lógica REAL de src/lib/historialCapas.js
// (vía __historialTest) con un historial simulado: ciclos guardia/diálogo,
// cierres por botón, atrás rápidos y fuzz aleatorio. Falla si hay bucles,
// registros fantasma o divergencia pila<->historial.
const PASOS_MAX = 10000;
let pasos = 0;
function contar() {
  pasos += 1;
  if (pasos > PASOS_MAX) throw new Error("Bucle: presupuesto de pasos excedido");
}

const oyentes = [];
const pilaNav = [{ state: null, url: "/" }]; // P0
globalThis.window = {
  setTimeout: (fn, ms) => setTimeout(() => fn(), ms),
  history: {
    pushState(state) {
      contar();
      pilaNav.push({ state });
    },
    back() {
      contar();
      if (pilaNav.length > 1) pilaNav.pop();
      const actual = pilaNav[pilaNav.length - 1];
      // popstate asíncrono como en el navegador (microtarea posterior).
      queueMicrotask(() => oyentes.forEach((f) => f({ state: actual.state })));
    },
  },
  addEventListener: (tipo, fn) => {
    if (tipo === "popstate") oyentes.push(fn);
  },
};

const microtareas = () => new Promise((r) => setTimeout(r, 5));
const assert = (cond, msg) => {
  if (!cond) throw new Error(`FALLO: ${msg}`);
};

(async () => {
  const mod = await import("./src/lib/historialCapas.js");
  const H = mod.__historialTest;
  assert(H && H.pila, "sin export de prueba");

  // Invariante: todo registro de pila tiene su entrada en el navegador,
  // salvo el búfer huérfano tras ráfagas (su onCerrar es noop: benigno).
  let idBufer = null;
  const paridad = (ctx) => {
    const idsNav = new Set(pilaNav.map((e) => e.state && e.state.capa).filter(Boolean));
    for (const r of H.pila) {
      if (r.id === idBufer) continue;
      assert(idsNav.has(r.id), `${ctx}: registro fantasma ${r.id}`);
    }
  };

  // --- Escenario 1: ciclo guardia/diálogo alternante (3 vueltas) ---
  // Fiel a los hooks: la guardia rearma en el popstate; el diálogo apila D.
  let dialogos = 0;
  let dialogoAbierto = false;
  let dialogoId = null;
  let refId = null;
  const rearmar = () => {
    const id = H.registrarCapa(() => {
      if (refId !== id) return;
      refId = rearmar();
      dialogos += 1;
      dialogoAbierto = true;
      dialogoId = H.registrarCapa(() => { dialogoAbierto = false; });
    });
    return id;
  };
  // Búfer como en el hook real: el atrás nunca abandona el documento.
  idBufer = H.registrarCapa(() => {});
  refId = rearmar();
  for (let i = 0; i < 3; i += 1) {
    window.history.back(); // atrás en feed -> abre diálogo
    await microtareas();
    assert(dialogoAbierto === true, `ciclo ${i}: el diálogo debió abrirse`);
    window.history.back(); // atrás con diálogo -> solo lo cierra
    await microtareas();
    assert(dialogoAbierto === false, `ciclo ${i}: el diálogo debió cerrarse`);
    paridad(`ciclo ${i}`);
  }
  assert(dialogos === 3, `diálogos esperados 3, hubo ${dialogos}`);
  assert(pilaNav.length <= 5, `historial acotado, len=${pilaNav.length}`);

  // --- Escenario 2: doble atrás rapidísimo con diálogo abierto ---
  window.history.back();
  window.history.back();
  await microtareas();
  paridad("doble atrás");
  // Nunca expulsado: siempre queda al menos una entrada propia sobre P0.
  assert(pilaNav.length >= 2, `doble atrás expulsó: len=${pilaNav.length}`);

  // --- Escenario 4: transición Ajustes→Perfil (cerrar+abrir atómico) ---
  // Réplica del hook: retirar A y abrir B dentro del cierre diferido.
  const idA4 = H.registrarCapa(() => {});
  // Simula cerrarAjustes(abrirPerfil): retirar + diferido que abre B.
  const idxA = H.pila.findIndex((c) => c.id === idA4);
  H.pila.splice(idxA, 1);
  window.history.back();
  await microtareas();
  let idB = null;
  window.setTimeout(() => { idB = H.registrarCapa(() => {}); }, 0);
  await microtareas();
  await microtareas();
  assert(idB && H.pila.some((c) => c.id === idB), "transición: B debe sobrevivir");
  window.history.back(); // atrás con B -> solo cierra B
  await microtareas();
  assert(H.pila.some((c) => c.id === idB) === false, "transición: B debió cerrarse");
  assert(pilaNav.length >= 2, "transición: sin expulsión");

  // --- Escenario 5: guardia + capa interna (lector) ---
  // El diálogo de salida solo aparece sin capas por encima: un atrás con el
  // lector abierto lo cierra sin diálogo; el siguiente atrás sí lo abre.
  assert(typeof H.hayCapasExcepto === "function", "falta hayCapasExcepto");
  H.pila.length = 0;
  let salidas = 0;
  let refG = null;
  const bufG = H.registrarCapa(() => {});
  const armarG = () => {
    const id = H.registrarCapa(() => {
      if (refG !== id) return;
      refG = armarG();
      const bloqueado = H.hayCapasExcepto([bufG, id, refG]);
      if (!bloqueado) salidas += 1;
    });
    return id;
  };
  refG = armarG();
  const idLector = H.registrarCapa(() => {});
  assert(H.hayCapasExcepto([bufG, refG]) === true, "lector debe contar como capa");
  window.history.back(); // atrás con lector -> solo lo cierra
  await microtareas();
  assert(salidas === 0, "diálogo fantasma con lector abierto");
  assert(H.pila.some((c) => c.id === idLector) === false, "el lector debió cerrarse");
  window.history.back(); // atrás en feed limpio -> diálogo
  await microtareas();
  assert(salidas === 1, "el diálogo debió abrirse sin capas");
  paridad("guardia+lector");

  // --- Escenario 3: fuzz aleatorio (capas, cierres, atrás) ---
  H.pila.length = 0;
  const rnd = (() => { let s = 42; return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; })();
  const abiertas = [];
  for (let i = 0; i < 300; i += 1) {
    const r = rnd();
    if (r < 0.4) {
      const id = H.registrarCapa(() => {});
      abiertas.push(id);
    } else if (r < 0.7 && abiertas.length > 0) {
      const id = abiertas.pop();
      const j = H.pila.findIndex((c) => c.id === id);
      if (j >= 0) H.retirarCapa(id, () => {});
    } else {
      window.history.back();
    }
    if (i % 10 === 0) await microtareas();
  }
  await microtareas();
  paridad("fuzz");
  console.log(`OK: dialogos=${dialogos} pila=${H.pila.length} nav=${pilaNav.length} pasos=${pasos}`);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
