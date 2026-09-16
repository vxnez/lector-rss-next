// Script inteligente para recategorizar feeds según contenido (título + descripción)
// usando coincidencia de palabras clave con las 24 categorías del dashboard

const CATEGORIAS_DASHBOARD = [
  "Política",
  "Economía y Finanzas",
  "Seguridad y Justicia",
  "Tecnología",
  "Celulares",
  "Computadoras",
  "Videojuegos",
  "Ciencia y Espacio",
  "Salud y Medicina",
  "Fitness y Nutrición",
  "Medio Ambiente",
  "Clima y Meteorología",
  "Deportes",
  "Cultura y Arte",
  "Cine y Series",
  "Música",
  "Gastronomía",
  "Viajes y Turismo",
  "Motor",
  "Educación",
  "Moda y Belleza",
  "Hogar y Vida Diaria",
  "General"
];

// Palabras clave por categoría (basadas en las descripciones del clasificador)
const PALABRAS_CLAVE = {
  "Política": ["política", "gobierno", "elecciones", "president", "ministro", "congreso", "ley", "reforma", "diplomacia", "tratado", "partido", "estado", "parlamento", "senado", "diputado", "votación", "campaña", "candidato", "oficialismo", "oposición", "poder ejecutivo", "poder legislativo"],
  "Economía y Finanzas": ["economía", "finanzas", "mercado", "empresa", "inflación", "banco", "impuesto", "inversión", "empleo", "divisa", "bolsa", "cripto", "finanzas personales", "mercado financiero", "económ", "business", "economist", "expansión", "mercados", "dinero", "moneda", "tipo de cambio", "pib", "crecimiento", "recesión"],
  "Seguridad y Justicia": ["seguridad", "justicia", "delincuencia", "crimen", "narcotráfico", "policía", "juicio", "tribunal", "fiscalía", "sentencia", "suceso", "violento", "homicidio", "robo", "secuestro", "extorsión", "cárcel", "prisión", "derechos humanos", "víctima", "denuncia", "investigación"],
  "Tecnología": ["tecnología", "software", "internet", "inteligencia artificial", "ciberseguridad", "plataforma digital", "app", "novedad tecnológica", "digital", "tech", "gadget", "startup", "innovación", "programación", "desarrollo", "código", "algoritmo", "datos", "big data", "cloud", "nube", "blockchain", "web3"],
  "Celulares": ["smartphone", "teléfono móvil", "iphone", "android", "dispositivo móvil", "accesorio móvil", "wearable", "móvil", "celular", "smartwatch", "tablet", "5g", "móviles"],
  "Computadoras": ["pc", "laptop", "portátil", "procesador", "tarjeta gráfica", "gpu", "cpu", "sistema operativo", "hardware", "memoria", "periférico", "computadora", "ordenador", "macbook", "windows", "linux", "componentes", "ram", "ssd", "placa base", "motherboard"],
  "Videojuegos": ["videojuego", "consola", "gaming", "esports", "entretenimiento interactivo", "juego", "playstation", "xbox", "nintendo", "steam", "epic games", "indie", "gameplay", "análisis", "reseña", "lanzamiento", "beta", "dlc", "season pass"],
  "Ciencia y Espacio": ["ciencia", "espacio", "astronomía", "exploración espacial", "física", "química", "biología", "arqueología", "fósil", "hallazgo científico", "nasa", "esa", "telescopio", "planeta", "estrella", "galaxia", "universo", "marte", "luna", "satélite", "cohete", "misión", "investigación", "científico", "estudio", "publicación"],
  "Salud y Medicina": ["salud", "medicina", "hospital", "enfermedad", "tratamiento", "vacuna", "fármaco", "clínica", "salud mental", "médico", "doctor", "paciente", "síntoma", "diagnóstico", "terapia", "medicamento", "farmacia", "epidemiología", "virus", "bacteria", "infección", "cirugía", "especialista"],
  "Fitness y Nutrición": ["fitness", "nutrición", "ejercicio", "entrenamiento", "gimnasio", "dieta", "nutrición", "hábito", "vida saludable", "deporte", "running", "ciclismo", "natación", "yoga", "pilates", "crossfit", "musculación", "cardio", "proteína", "suplemento", "vitamina", "peso", "adelgazar"],
  "Medio Ambiente": ["medio ambiente", "cambio climático", "contaminación", "energía renovable", "biodiversidad", "ecología", "fauna", "flora", "conservación", "verde", "sostenible", "sustentable", "carbono", "emisión", "calentamiento global", "huella ecológica", "reciclaje", "residuos", "océano", "bosque", "selva", "especie", "extinción"],
  "Clima y Meteorología": ["clima", "meteorología", "pronóstico", "tiempo", "huracán", "tormenta", "frente frío", "lluvia", "temperatura", "fenómeno meteorológico", "temperatura máxima", "temperatura mínima", "precipitación", "humedad", "viento", "alerta meteorológica", "avisos", "aemet", "servicio meteorológico"],
  "Deportes": ["deporte", "fútbol", "tenis", "fórmula 1", "f1", "baloncesto", "beisbol", "boxeo", "ufc", "competición", "campeonato", "liga", "copa", "mundial", "juegos olímpicos", "atleta", "deportista", "equipo", "club", "partido", "gol", "victoria", "derrota", "clasificación"],
  "Cultura y Arte": ["cultura", "arte", "literatura", "pintura", "escultura", "museo", "teatro", "arquitectura", "exposición", "patrimonio cultural", "artista", "obra", "creación", "cultural", "festival cultural", "bienal", "galería", "colección", "restauración", "monumento", "historico"],
  "Cine y Series": ["cine", "serie", "streaming", "actor", "actriz", "estreno", "festival de cine", "audiovisual", "película", "movie", "series", "netflix", "hbo", "disney", "amazon prime", "director", "guion", "producción", "rodaje", "premiere", "taquilla", "crítica", "review"],
  "Música": ["música", "álbum", "concierto", "cantante", "banda", "canción", "gira", "industria musical", "spotify", "apple music", "single", "ep", "lp", "tour", "festival musical", "premio", "grammy", "latin grammy", "billboard", "chart", "ranking", "estreno musical", "videoclip"],
  "Gastronomía": ["gastronomía", "comida", "receta", "restaurante", "chef", "vino", "cerveza", "bebida", "cocina", "plato", "ingrediente", "cocinar", "horno", "sartén", "postre", "entrante", "principal", "maridaje", "cata", "denominación origen", "michelin", "guía michelin"],
  "Viajes y Turismo": ["viaje", "turismo", "vuelo", "hotel", "aerolínea", "destino turístico", "excursión", "vacaciones", "pasaporte", "visado", "equipaje", "alojamiento", "hostel", "resort", "crucero", "tren", "alquiler coche", "guía viaje", "mochilero", "backpacker", "itinerario"],
  "Motor": ["motor", "automóvil", "coche", "motocicleta", "moto", "eléctrico", "concesionario", "prueba manejo", "test drive", "suv", "sedán", "compacto", "deportivo", "híbrido", "enchufable", "autonomía", "carga", "estación carga", "neumático", "freno", "motorización", "cv", "potencia"],
  "Educación": ["educación", "universidad", "escuela", "colegio", "estudiante", "profesor", "maestro", "becas", "examen", "sistema educativo", "título", "grado", "máster", "doctorado", "fp", "formación profesional", "oposiciones", "selectividad", "eva", "campus", "facultad", "departamento", "investigación académica"],
  "Moda y Belleza": ["moda", "belleza", "ropa", "desfile", "cosmética", "maquillaje", "perfume", "cabello", "estilo", "tendencia", "diseñador", "pasarela", "fashion week", "colección", "primavera verano", "otoño invierno", "prêt-à-porter", "alta costura", "street style", "look", "outfit", "accesorio", "bolso", "zapato"],
  "Hogar y Vida Diaria": ["hogar", "decoración", "jardinería", "mascota", "rutina doméstica", "vida cotidiana", "casa", "piso", "apartamento", "mueble", "texto", "cortina", "alfombra", "lámpara", "pintura pared", "reforma", "renovación", "bricolaje", "diy", "limpieza", "orden", "organización", "perro", "gato", "veterinario"],
};

// Función para clasificar un feed por su título y descripción
// Reglas específicas por URL/título conocido (override para feeds problemáticos)
const REGLAS_ESPECIFICAS = {
  // Feeds que el clasificador de palabras clave falla
  "www.gamespot.com": "Videojuegos",
  "www.gamesradar.com": "Videojuegos",
  "pitchfork.com": "Música",
  "www.ft.com": "Economía y Finanzas",
  "feeds.bbci.co.uk": "Deportes",
  "www.autofacil.es": "Motor",
  "wwwhatsnew.com": "Tecnología",
  "www.jornada.com.mx/rss/deportes": "Deportes",
  "www.jornada.com.mx/rss/economia": "Economía y Finanzas",
  "www.jornada.com.mx/rss/cultura": "Cultura y Arte",
  "www.jornada.com.mx/rss/espectaculos": "Cine y Series",
  "www.jornada.com.mx/rss/politica": "Política",
  "www.jornada.com.mx/rss/capital": "Política",
  "www.jornada.com.mx/rss/estados": "Política",
  "www.jornada.com.mx/rss/mundo": "Política",
  "www.jornada.com.mx/rss/opinion": "Política",
  "www.jornada.com.mx/rss/edicion": "General",
  "www.menshealth.com": "Fitness y Nutrición",
  "www.womenshealthmag.com": "Fitness y Nutrición",
  "www.tomshardware.com": "Computadoras",
  "www.pcworld.com": "Computadoras",
  "www.androidauthority.com": "Celulares",
  "es.gizmodo.com": "Tecnología",
  "www.technologyreview.com": "Tecnología",
  "www.quantamagazine.org": "Ciencia y Espacio",
  "www.space.com": "Ciencia y Espacio",
  "www.nasa.gov": "Ciencia y Espacio",
  "es.ign.com": "Cine y Series",
  "www.hobbyconsolas.com": "Videojuegos",
  "www.rollingstone.com": "Música",
  "www.mondosonoro.com": "Música",
  "www.nme.com": "Música",
  "www.stereogum.com": "Música",
  "consequence.net": "Música",
  "www.expansion.com": "Economía y Finanzas",
  "www.bloomberg.com": "Economía y Finanzas",
  "www.who.int": "Salud y Medicina",
  "www.medscape.com": "Salud y Medicina",
  "consultorsalud.com.mx": "Salud y Medicina",
  "www.cocina-familiar.com": "Gastronomía",
  "www.gastronomiaycia.com": "Gastronomía",
  "colnal.mx": "Educación",
  "conectate.um.edu.mx": "Educación",
  "diarioecologia.com": "Medio Ambiente",
  "diariohumano.com.mx": "Seguridad y Justicia",
  "contralinea.com.mx": "Seguridad y Justicia",
  "cedhchihuahua.org.mx": "Seguridad y Justicia",
  "congreso.chihuahua.gob.mx": "Política",
  "europapress.es": "Política",
  "diariopresente.mx/feedgooglenews/politica": "Política",
  "diariopresente.mx/feedgooglenews/sucesos": "Seguridad y Justicia",
  "diariopresente.mx/feedgooglenews/cultura": "Cultura y Arte",
  "diariopresente.mx/feedgooglenews/espectaculos": "Cine y Series",
};

function obtenerReglaEspecifica(url) {
  for (const [patron, categoria] of Object.entries(REGLAS_ESPECIFICAS)) {
    if (url.includes(patron)) {
      return categoria;
    }
  }
  return null;
}

function clasificarFeed(titulo, descripcion, url) {
  // Primero intentar regla específica por URL
  const reglaEspecifica = obtenerReglaEspecifica(url);
  if (reglaEspecifica) return reglaEspecifica;

  // Luego clasificación por palabras clave
  const texto = (titulo + " " + descripcion).toLowerCase();

  const puntuaciones = {};

  for (const [categoria, palabras] of Object.entries(PALABRAS_CLAVE)) {
    let puntuacion = 0;
    for (const palabra of palabras) {
      const regex = new RegExp(`\\b${palabra}\\b`, "gi");
      const matches = texto.match(regex);
      if (matches) {
        puntuacion += matches.length;
      }
    }
    if (puntuacion > 0) {
      puntuaciones[categoria] = puntuacion;
    }
  }

  if (Object.keys(puntuaciones).length === 0) {
    return "General";
  }

  return Object.entries(puntuaciones).sort((a, b) => b[1] - a[1])[0][0];
}

async function recategorizarInteligente() {
  const fs = await import("fs/promises");
  const path = await import("path");

  const filePath = path.join(process.cwd(), "src/data/recommended-feeds.json");
  const content = await fs.readFile(filePath, "utf-8");
  const data = JSON.parse(content);

  const nuevasCategorias = {};

  for (const [categoriaActual, feeds] of Object.entries(data.categorias)) {
    for (const feed of feeds) {
      const categoriaDetectada = clasificarFeed(feed.titulo, feed.descripcion, feed.url);

      if (!nuevasCategorias[categoriaDetectada]) {
        nuevasCategorias[categoriaDetectada] = [];
      }

      // Evitar duplicados por URL
      const existe = nuevasCategorias[categoriaDetectada].some(f => f.url === feed.url);
      if (!existe) {
        nuevasCategorias[categoriaDetectada].push(feed);
      }
    }
  }

  // Ordenar categorías según el orden del dashboard y feeds alfabéticamente
  const categoriasOrdenadas = {};
  for (const cat of CATEGORIAS_DASHBOARD) {
    if (nuevasCategorias[cat] && nuevasCategorias[cat].length > 0) {
      categoriasOrdenadas[cat] = nuevasCategorias[cat].sort((a, b) => a.titulo.localeCompare(b.titulo, "es"));
    }
  }

  const totalFeeds = Object.values(categoriasOrdenadas).reduce((acc, arr) => acc + arr.length, 0);

  const nuevoArchivo = {
    categorias: categoriasOrdenadas,
    metadata: {
      ...data.metadata,
      total_feeds: totalFeeds,
      actualizado: new Date().toISOString().split("T")[0],
      verificado: new Date().toISOString(),
      nota: "Categorías asignadas automáticamente por palabras clave (título + descripción) según las 24 categorías del dashboard"
    }
  };

  await fs.writeFile(filePath, JSON.stringify(nuevoArchivo, null, 2), "utf-8");

  console.log("✅ Recategorización inteligente completada");
  console.log(`📊 Total feeds: ${totalFeeds}`);
  console.log(`📁 Categorías con feeds: ${Object.keys(categoriasOrdenadas).length}`);

  for (const [cat, feeds] of Object.entries(categoriasOrdenadas)) {
    console.log(`   ${cat}: ${feeds.length} feeds`);
    for (const feed of feeds) {
      console.log(`      - ${feed.titulo}`);
    }
  }
}

recategorizarInteligente().catch(console.error);