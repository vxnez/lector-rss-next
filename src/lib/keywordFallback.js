// src/lib/keywordFallback.js — Respaldo heurístico por palabras clave.
// Sin dependencias: clasifica por términos del título+resumen cuando la IA
// falla o responde tibio (<0.8). Nunca asigna "General": su único trabajo es
// sacar noticias del default. Devolver null = sin evidencia suficiente.
const PALABRAS_POR_CATEGORIA = {
  "Videojuegos": ["videojueg", "gaming", "gamer", "roblox", "minecraft", "fortnite", "nintendo", "playstation", "xbox", "steam", "esport", "consola portatil", "retroid", "emulador", "gamepass", "juegos", "retro", "android", "snapdragon"],
  "Developers": ["github", "pull request", "api", "sdk", "framework", "devops", "kubernetes", "docker", "javascript", "python", "typescript", "codigo abierto", "open source", "programacion", "claude code", "copilot", "hacker", "hacker news", "linux"],
  "Celulares": ["iphone", "smartphone", "android phone", "telefono movil", "celular", "operador movil", "plan de datos", "galaxy s", "pixel 9", "pixel 8"],
  "Computadoras": ["laptop", "procesador", "cpu", "gpu", "tarjeta grafica", "windows 11", "linux", "macbook", "hardware", "ssd", "memoria ram"],
  "Tecnología": ["inteligencia artificial", "ciberseguridad", "hackeo", "malware", "ransomware", "startup", "silicon valley", "redes sociales", "tiktok", "chatbot"],
  "Seguridad y Justicia": ["detenido", "fiscalia", "tribunal", "sentencia", "narcotrafico", "homicidio", "policia", "juicio", "carcel", "delito"],
  "Economía y Finanzas": ["bitcoin", "bolsa", "inflacion", "banco central", "inversion", "criptomoneda", "dolar", "empleo", "impuestos", "finanzas"],
  "Política": ["eleccion", "presidente", "congreso", "senado", "ministro", "gobierno", "ley aprobada", "diplomacia", "partido politico"],
  "Deportes": ["futbol", "champions", "mundial", "tenis", "formula 1", "maraton", "juegos olimpicos", "boxeo", "nfl", "ciclismo"],
  "Ciencia y Espacio": ["nasa", "astronauta", "marte", "agujero negro", "fosil", "genoma", "particula", "telescopio", "arqueologia"],
  "Salud y Medicina": ["vacuna", "hospital", "cancer", "diabetes", "ensayo clinico", "medicamento", "salud mental", "epidemia"],
  "Cine y Series": ["netflix", "estreno", "taquilla", "oscar", "temporada", "streaming", "pelicula", "serie", "actor", "director"],
  "Música": ["album", "concierto", "gira", "cantante", "banda", "spotify", "festival de musica", "disco"],
  "Cultura y Arte": ["museo", "exposicion", "novela", "poesia", "teatro", "pintura", "patrimonio", "arquitectura"],
  "Gastronomía": ["receta", "restaurante", "chef", "vino", "cerveza", "cocina", "gastronomia"],
  "Viajes y Turismo": ["vuelo", "hotel", "aerolinea", "destino", "turismo", "crucero", "playa", "visa de viaje"],
  "Motor": ["tesla", "coche electrico", "motocicleta", "formula e", "concesionario", "suv", "camioneta"],
  "Educación": ["universidad", "beca", "examen", "estudiante", "profesor", "colegio", "escuela"],
  "Moda y Belleza": ["pasarela", "maquillaje", "perfume", "moda", "vestido", "cosmetica"],
  "Hogar y Vida Diaria": ["decoracion", "jardineria", "mascota", "perro", "gato", "hogar", "limpieza"],
  "Fitness y Nutrición": ["gimnasio", "entrenamiento", "dieta", "proteina", "yoga", "nutricion", "perder peso"],
  "Medio Ambiente": ["cambio climatico", "contaminacion", "energia renovable", "biodiversidad", "reciclaje", "deforestacion"],
  "Clima y Meteorología": ["huracan", "tormenta", "pronostico", "lluvia", "temperatura", "frente frio", "sismo", "terremoto"],
};

// Mínimo de coincidencias distintas para aceptar (evita falsos positivos de
// una sola palabra genérica).
const MIN_COINCIDENCIAS = 2;

function normalizar(texto = "") {
  return String(texto || "")
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, " ");
}

export function clasificarPorPalabras(titulo = "", resumen = "") {
  const texto = `${normalizar(titulo)} ${normalizar(resumen)}`;
  if (texto.trim().length < 10) return null;
  let mejor = null;
  let mejorPuntos = 0;
  for (const [categoria, palabras] of Object.entries(PALABRAS_POR_CATEGORIA)) {
    let puntos = 0;
    for (const p of palabras) {
      if (p && texto.includes(p)) puntos++;
    }
    if (puntos > mejorPuntos) {
      mejorPuntos = puntos;
      mejor = categoria;
    } else if (puntos === mejorPuntos && puntos > 0) {
      mejor = null; // Empate: sin veredicto.
    }
  }
  return mejorPuntos >= MIN_COINCIDENCIAS && mejor ? mejor : null;
}
