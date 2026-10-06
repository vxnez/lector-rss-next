// Script plano y bloqueante: aplica tema, movimiento, densidad y fuente
// antes del primer pintado, sin depender del framework.
// Coincide con lib/temas.js, lib/fuentes.js y el pre-pintado del RootLayout.
(function () {
  try {
    var validos = ["medianoche", "duna", "mineral", "bosque", "ebano", "obsidiana", "celeste", "menta", "celadon", "marfil", "vainilla", "alabastro"];
    // Purga de claves obsoletas en cada arranque (todas las rutas, antes del
    // primer pintado): ningún lector las lee, solo ocupan y confunden.
    try {
      localStorage.removeItem("lector_familia_fuente");
      localStorage.removeItem("lector_tamano_fuente");
    } catch (e2) {
      // Sin escritura: se sigue con la lectura.
    }
    var t = localStorage.getItem("lector_tema");
    if (validos.indexOf(t) < 0) {
      // Forzado del defecto absoluto: se persiste para que /login, /register
      // y el dashboard pinten Vainilla sin parpadeos ni re-lecturas.
      t = "vainilla"; // Defecto absoluto (con elección guardada manda el guardado).
      try {
        localStorage.setItem("lector_tema", "vainilla");
      } catch (e3) {
        // Sin escritura: igual se pinta Vainilla en este arranque.
      }
    }
    var claros = { celeste: 1, menta: 1, celadon: 1, marfil: 1, vainilla: 1, alabastro: 1 };
    document.documentElement.dataset.theme = t;
    if (claros[t]) {
      document.documentElement.dataset.temaClaro = "1";
    }
    if (localStorage.getItem("lector_movimiento") === "reducido") {
      document.documentElement.dataset.motion = "reduced";
    }
    var d = localStorage.getItem("lector_densidad");
    if (d === "compacta") {
      document.documentElement.dataset.densidad = "compacta";
    }
    var fuentes = ["readex", "line", "calsans", "jakarta", "outfit", "sora", "grotesk", "inter", "vietnam", "epilogue"];
    var f = localStorage.getItem("lector_fuente_app");
    document.documentElement.dataset.fuente = fuentes.indexOf(f) >= 0 ? f : "readex";
    var px = parseInt(localStorage.getItem("lector_fuente_px"), 10);
    if (!isFinite(px)) px = 16;
    px = Math.min(Math.max(px, 12), 24);
    document.documentElement.style.setProperty("--font-size-base", px + "px");
    var idiomas = ["es", "en"];
    var lang = localStorage.getItem("lector_idioma");
    document.documentElement.lang = idiomas.indexOf(lang) >= 0 ? lang : "es";
  } catch (e) {
    // Sin almacenamiento/DOM: se conservan los valores por defecto del CSS.
  }
})();
