const CATEGORIAS = [
  { nombre: "Política", prioridad: 10, fuertes: ["gobierno", "presidente", "primer ministro", "ministro", "congreso", "senado", "parlamento", "elecciones", "eleccion", "candidato", "candidatura", "candidaturas", "partido politico", "morena", "pri", "trump", "biden", "milei", "putin", "zelenski", "guerra comercial", "aranceles", "tratado", "diplomacia", "embajada", "otan", "geopolitica", "politica exterior", "reforma constitucional"], palabras: ["politica", "decreto", "ley", "gobernador", "alcalde", "oposicion", "oficialismo", "legislador", "diputado", "senador", "votacion", "campaña", "presupuesto publico", "poder judicial"] },
  { nombre: "Economía y Finanzas", prioridad: 9, fuertes: ["economia", "inflacion", "banco central", "banxico", "banco de mexico", "tasas de interes", "tipo de cambio", "peso mexicano", "dolar", "aranceles", "deuda", "pib", "recesion", "bolsa de valores", "acciones", "wall street", "hacienda", "impuestos", "inversion", "mercado financiero", "crecimiento economico"], palabras: ["banco", "empleo", "desempleo", "empresa", "startup", "mercado", "finanzas", "dinero", "credito", "hipoteca", "salario", "comercio", "exportaciones", "importaciones", "petróleo", "pemex"] },
  { nombre: "Seguridad y Justicia", prioridad: 9, fuertes: ["asesinato", "asesinan", "homicidio", "multihomicidio", "multihomicida", "secuestro", "narcotrafico", "metanfetamina", "fentanilo", "cartel", "crimen organizado", "laboratorio clandestino", "operativo policial", "orden de aprehension", "sentencia judicial", "fiscalia", "ministerio publico", "huachicol", "corrupcion", "garcia luna", "agente federal"], palabras: ["policia", "guardia nacional", "detenido", "arrestado", "delito", "robo", "asalto", "juez", "tribunal", "fiscal", "investigacion", "decomiso", "incautacion", "violencia", "victima", "autoridad", "matanza", "ataque armado"] },
  { nombre: "Tecnología", prioridad: 5, fuertes: ["inteligencia artificial", "machine learning", "aprendizaje automatico", "chatgpt", "openai", "gemini", "claude", "deepseek", "copilot", "modelo de lenguaje", "ciberseguridad", "ciberataque", "ransomware", "phishing", "malware", "vulnerabilidad", "robotica", "computacion cuantica"], palabras: ["tecnologia", "software", "hardware", "internet", "algoritmo", "programacion", "codigo", "aplicacion", "app", "google", "meta", "redes sociales", "privacidad digital", "datos"] },
  { nombre: "Celulares", prioridad: 8, fuertes: ["iphone", "ipad", "android", "samsung galaxy", "xiaomi", "pixel", "snapdragon", "mediatek", "oneplus", "motorola", "huawei", "oppo", "vivo", "realme", "smartwatch", "wearable"], palabras: ["smartphone", "celular", "telefono movil", "movil", "tableta", "ios", "cargador", "bateria", "pantalla"] },
  { nombre: "Computadoras", prioridad: 8, fuertes: ["windows", "linux", "ubuntu", "macos", "macbook", "nvidia", "amd", "intel", "procesador", "tarjeta grafica", "gpu", "cpu", "laptop", "pc gamer"], palabras: ["computadora", "ordenador", "portatil", "hardware", "memoria ram", "disco duro", "ssd", "monitor", "teclado", "periferico"] },
  { nombre: "Videojuegos", prioridad: 8, fuertes: ["videojuego", "gaming", "gamer", "nintendo", "playstation", "ps5", "xbox", "steam", "valve", "esports", "fortnite", "minecraft", "zelda", "mario", "call of duty", "league of legends"], palabras: ["juego", "consola", "jugador", "gameplay", "dlc", "expansion"] },
  { nombre: "Ciencia y Espacio", prioridad: 7, fuertes: ["nasa", "esa", "spacex", "astronomia", "astrofisica", "agujero negro", "galaxia", "universo", "planeta", "marte", "luna", "telescopio", "fisica cuantica", "fosil", "arqueologia"], palabras: ["espacio", "astronomia", "cientifico", "investigacion", "experimento", "laboratorio", "biologia", "quimica", "fisica", "especie", "hallazgo"] },
  { nombre: "Salud y Medicina", prioridad: 8, fuertes: ["hospital", "medicina", "medicamento", "farmaco", "cancer", "vacuna", "virus", "pandemia", "trasplante", "sintoma", "diagnostico", "tratamiento", "salud mental", "oms"], palabras: ["salud", "medico", "doctor", "enfermedad", "infeccion", "bacteria", "clinica", "paciente", "terapia", "psicologia", "ansiedad", "depresion"] },
  { nombre: "Fitness y Nutrición", prioridad: 7, fuertes: ["ejercicio", "entrenamiento", "fitness", "gimnasio", "nutricion", "dieta", "perder peso", "adelgazar", "proteina", "musculo", "running", "cardio"], palabras: ["bienestar", "calorias", "correr", "rutina de ejercicio", "deportista amateur"] },
  { nombre: "Medio Ambiente", prioridad: 7, fuertes: ["cambio climatico", "calentamiento global", "medio ambiente", "contaminacion", "reciclaje", "energia renovable", "energia solar", "deforestacion", "ecosistema", "biodiversidad", "especies en peligro", "lobo gris", "proteccion ambiental"], palabras: ["ecologia", "naturaleza", "sostenibilidad", "sustentable", "fauna", "flora", "sequía", "incendio forestal", "agua", "especie protegida", "vida silvestre"] },
  { nombre: "Clima y Meteorología", prioridad: 8, fuertes: ["frente frio", "frentes frios", "servicio meteorologico", "meteorologico", "ciclón", "ciclones", "huracan", "tormenta tropical", "onda tropical", "pronostico del tiempo", "alerta meteorologica", "el niño", "la niña"], palabras: ["clima", "lluvias", "temperatura", "precipitaciones", "viento", "oleaje", "sequía", "inundacion", "calor", "frio"] },
  { nombre: "Deportes", prioridad: 7, fuertes: ["futbol", "futbol americano", "liga", "real madrid", "barcelona", "champions league", "mundial", "tenis", "formula 1", "baloncesto", "nba", "beisbol", "boxeo", "ufc", "olimpiadas"], palabras: ["deporte", "atleta", "jugador", "seleccion", "entrenador", "partido", "torneo", "campeonato", "medalla"] },
  { nombre: "Cultura y Arte", prioridad: 6, fuertes: ["museo", "pintura", "escultura", "literatura", "letras", "novela", "poesia", "poeta", "escritor", "premio literario", "teatro", "arquitectura", "exposicion", "patrimonio"], palabras: ["cultura", "arte", "artista", "libro", "autor", "obra", "galeria", "festival cultural", "premio iberoamericano"] },
  { nombre: "Cine y Series", prioridad: 7, fuertes: ["cine", "pelicula", "serie", "netflix", "hbo", "disney", "oscar", "premios goya", "trailer", "actor", "actriz", "director de cine"], palabras: ["streaming", "estreno", "temporada", "episodio", "produccion audiovisual"] },
  { nombre: "Música", prioridad: 7, fuertes: ["musica", "concierto", "album", "cantante", "banda", "cancion", "gira musical", "festival musical", "rapero", "salsa", "rock"], palabras: ["artista musical", "melodia", "disco", "single", "escenario"] },
  { nombre: "Gastronomía", prioridad: 6, fuertes: ["gastronomia", "receta", "restaurante", "chef", "comida", "vino", "cerveza", "postre", "reposteria"], palabras: ["cocina", "ingrediente", "sabor", "menu", "plato", "bebida"] },
  { nombre: "Viajes y Turismo", prioridad: 6, fuertes: ["viaje", "turismo", "turista", "hotel", "vuelo", "aerolinea", "destino turistico", "vacaciones", "senderismo"], palabras: ["destino", "paisaje", "playa", "mochilero", "excursion", "guia de viajes", "aeropuerto"] },
  { nombre: "Motor", prioridad: 7, fuertes: ["automovil", "coche", "vehiculo", "motocicleta", "moto", "tesla", "volkswagen", "toyota", "formula 1", "concesionario"], palabras: ["motor", "conduccion", "carretera", "trafico", "gasolina", "electrico", "hibrido"] },
  { nombre: "Educación", prioridad: 6, fuertes: ["educacion", "universidad", "escuela", "colegio", "estudiante", "profesor", "docente", "beca", "examen", "campus"], palabras: ["clase", "alumno", "aprendizaje", "maestro", "carrera universitaria", "investigacion academica"] },
  { nombre: "Moda y Belleza", prioridad: 6, fuertes: ["moda", "belleza", "cosmetica", "maquillaje", "perfume", "ropa", "desfile", "diseñador", "cabello"], palabras: ["piel", "tendencia", "coleccion", "modelo", "estilo"] },
  { nombre: "Hogar y Vida Diaria", prioridad: 4, fuertes: ["hogar", "casa", "decoracion", "bricolaje", "jardineria", "limpieza del hogar", "mascotas", "perros", "gatos"], palabras: ["rutina", "habitos", "vida cotidiana", "consejo", "familia"] },
];

function normalizar(texto = "") {
  return texto.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9ñ\s-]/g, " ").replace(/\s+/g, " ").trim();
}

function coincide(texto, palabra) {
  return new RegExp(`(^|\\s)${palabra.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\s|$)`, "i").test(texto);
}

export function clasificarCategoriaPorTexto(titulo = "", resumen = "") {
  const tituloNormalizado = normalizar(titulo);
  const resumenNormalizado = normalizar(resumen);
  const resultados = CATEGORIAS.map((categoria, indice) => {
    const fuertesTitulo = categoria.fuertes.filter((palabra) => coincide(tituloNormalizado, normalizar(palabra))).length;
    const fuertesResumen = categoria.fuertes.filter((palabra) => coincide(resumenNormalizado, normalizar(palabra))).length;
    const palabrasTitulo = categoria.palabras.filter((palabra) => coincide(tituloNormalizado, normalizar(palabra))).length;
    const palabrasResumen = categoria.palabras.filter((palabra) => coincide(resumenNormalizado, normalizar(palabra))).length;
    const puntuacion = fuertesTitulo * 12 + fuertesResumen * 3 + palabrasTitulo * 5 + palabrasResumen + categoria.prioridad * (fuertesTitulo > 0 ? 1 : 0);
    return { nombre: categoria.nombre, puntuacion, indice };
  });

  resultados.sort((a, b) => b.puntuacion - a.puntuacion || a.indice - b.indice);
  return resultados[0].puntuacion > 0 ? resultados[0].nombre : "General";
}

export const CATEGORIAS_DISPONIBLES = CATEGORIAS.map(({ nombre }) => nombre).sort((a, b) => a.localeCompare(b, "es"));
