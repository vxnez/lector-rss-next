// src/lib/iconosCategorias.js — Mapeo centralizado categoría → icono vectorial.
// Usa datos de "lucide" (paquete vanilla) para el wrapper MorphIcon
// (morphicons): cero emojis en pills, filtros e insignias. El icono hereda
// el color del contexto (temas claro/oscuro) y escala sin distorsión.
import {
  Newspaper as NewspaperData,
  Landmark as LandmarkData,
  TrendingUp as TrendingUpData,
  Scale as ScaleData,
  Cpu as CpuData,
  CodeXml as CodeXmlData,
  Smartphone as SmartphoneData,
  Monitor as MonitorData,
  Gamepad2 as Gamepad2Data,
  Rocket as RocketData,
  HeartPulse as HeartPulseData,
  Dumbbell as DumbbellData,
  Leaf as LeafData,
  CloudSun as CloudSunData,
  Trophy as TrophyData,
  Palette as PaletteData,
  Clapperboard as ClapperboardData,
  Music as MusicData,
  UtensilsCrossed as UtensilsCrossedData,
  Plane as PlaneData,
  Car as CarData,
  GraduationCap as GraduationCapData,
  Shirt as ShirtData,
  House as HouseData,
} from "lucide";

const ICONOS = {
  General: NewspaperData,
  Política: LandmarkData,
  "Economía y Finanzas": TrendingUpData,
  "Seguridad y Justicia": ScaleData,
  Tecnología: CpuData,
  Developers: CodeXmlData,
  Celulares: SmartphoneData,
  Computadoras: MonitorData,
  Videojuegos: Gamepad2Data,
  "Ciencia y Espacio": RocketData,
  "Salud y Medicina": HeartPulseData,
  "Fitness y Nutrición": DumbbellData,
  "Medio Ambiente": LeafData,
  "Clima y Meteorología": CloudSunData,
  Deportes: TrophyData,
  "Cultura y Arte": PaletteData,
  "Cine y Series": ClapperboardData,
  Música: MusicData,
  Gastronomía: UtensilsCrossedData,
  "Viajes y Turismo": PlaneData,
  Motor: CarData,
  Educación: GraduationCapData,
  "Moda y Belleza": ShirtData,
  "Hogar y Vida Diaria": HouseData,
};

// Dato de icono para una categoría (nombre ES canónico o id). Desconocida o
// vacía → neutro. El anuncio lo da el texto adyacente (aria-hidden en el JSX).
export function iconoDeCategoria(nombre) {
  const clave = String(nombre || "").trim();
  return ICONOS[clave] || NewspaperData;
}
