const CATEGORIAS = [
  { nombre: "Política", descripcion: "Gobierno, elecciones, presidentes, ministros, congresos, leyes, reformas, diplomacia, tratados, partidos y asuntos de Estado." },
  { nombre: "Economía y Finanzas", descripcion: "Mercados, empresas, inflación, bancos, impuestos, inversión, empleo, divisas, bolsa, criptomonedas y finanzas personales." },
  { nombre: "Seguridad y Justicia", descripcion: "Delincuencia, crimen organizado, narcotráfico, policía, juicios, tribunales, fiscalías, sentencias y sucesos violentos." },
  { nombre: "Tecnología", descripcion: "Software, internet, inteligencia artificial, ciberseguridad, plataformas digitales, apps y novedades generales de tecnología." },
  { nombre: "Celulares", descripcion: "Smartphones, teléfonos móviles, iPhone, Android y dispositivos móviles, accesorios móviles y wearables." },
  { nombre: "Computadoras", descripcion: "PC, laptops, procesadores, tarjetas gráficas, sistemas operativos, hardware, memoria y periféricos." },
  { nombre: "Videojuegos", descripcion: "Videojuegos, consolas, PC gaming, eSports y la industria del entretenimiento interactivo." },
  { nombre: "Ciencia y Espacio", descripcion: "Astronomía, exploración espacial, física, química, biología, arqueología, fósiles y hallazgos científicos." },
  { nombre: "Salud y Medicina", descripcion: "Medicina, hospitales, enfermedades, tratamientos, vacunas, fármacos, clínicas y salud mental." },
  { nombre: "Fitness y Nutrición", descripcion: "Ejercicio, entrenamiento, gimnasio, dietas, nutrición y hábitos de vida saludable." },
  { nombre: "Medio Ambiente", descripcion: "Cambio climático, contaminación, energías renovables, biodiversidad, ecología, fauna, flora y conservación." },
  { nombre: "Clima y Meteorología", descripcion: "Pronóstico del tiempo, huracanes, tormentas, frentes fríos, lluvias, temperaturas y fenómenos meteorológicos." },
  { nombre: "Deportes", descripcion: "Fútbol, tenis, Fórmula 1, baloncesto, beisbol, boxeo, UFC y cualquier disciplina o competición deportiva." },
  { nombre: "Cultura y Arte", descripcion: "Literatura, pintura, escultura, museos, teatro, arquitectura, exposiciones y patrimonio cultural." },
  { nombre: "Cine y Series", descripcion: "Películas, series, streaming, actores, estrenos, festivales de cine y la industria audiovisual." },
  { nombre: "Música", descripcion: "Álbumes, conciertos, cantantes, bandas, canciones, giras y la industria musical." },
  { nombre: "Gastronomía", descripcion: "Comida, recetas, restaurantes, chefs, vinos, cervezas, bebidas y cocina en general." },
  { nombre: "Viajes y Turismo", descripcion: "Viajes, vuelos, hoteles, aerolíneas, destinos turísticos, excursiones y turismo." },
  { nombre: "Motor", descripcion: "Automóviles, motocicletas, coches eléctricos, concesionarios, pruebas de manejo y el mundo del motor." },
  { nombre: "Educación", descripcion: "Universidades, escuelas, colegios, estudiantes, profesores, becas, exámenes y el sistema educativo." },
  { nombre: "Moda y Belleza", descripcion: "Ropa, desfiles, cosmética, maquillaje, perfumes, cabello y tendencias de estilo." },
  { nombre: "Hogar y Vida Diaria", descripcion: "Decoración, jardinería, mascotas, rutinas domésticas y consejos de vida cotidiana." },
  { nombre: "General", descripcion: "Noticias que no encajan claramente en ninguna otra categoría del catálogo." },
];

export const CATEGORIAS_DISPONIBLES = CATEGORIAS.map(({ nombre }) => nombre).sort((a, b) => a.localeCompare(b, "es"));

export const CATALOGO_PROMPT = CATEGORIAS.map(({ nombre, descripcion }) => `- ${nombre}: ${descripcion}`).join("\n");