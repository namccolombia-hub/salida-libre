export interface TutorialEntry {
  icon: string;
  title: string;
  identify: string;
  resolve: string;
}

// One entry per mechanic — shown once ever, the first time the player
// actually encounters it (see ParkingScene/ChaseScene for the trigger
// conditions). Content mirrors the wording already used in badges/toasts
// elsewhere so the vocabulary stays consistent.
export const TUTORIAL_CONTENT: Record<string, TutorialEntry> = {
  movement: {
    icon: "🚗",
    title: "Cómo mover los autos",
    identify: "Cada auto tiene una dirección fija: solo avanza hacia adelante o hacia atrás, nunca de lado.",
    resolve: "Tócalo para lanzarlo en esa dirección. Si el camino está libre sale del todo. Si choca con otro auto, no pierdes la vida de una — pasás a modo persecución para intentar salvarlo.",
  },
  chase: {
    icon: "🏎️",
    title: "Modo persecución",
    identify: "Entrás a persecución por dos razones: te equivocaste al lanzar un auto (chocó), o tocaste un auto que sale bien pero estaba marcado para llevarte ahí de todos modos.",
    resolve:
      "Desliza o toca a los lados para cambiar de carril y esquivar lo que se acerca. Si fue por error: ganar devuelve el auto a la cuadrícula en otro lugar sin perder vida, perder sí cuesta una vida. Si el auto salía bien: ganar lo saca de verdad y suma puntos, perder cuesta una vida igual.",
  },
  floors: {
    icon: "🏢",
    title: "Segundo piso",
    identify: "El botón dorado \"PISO 1/2\" arriba de la cuadrícula indica que hay dos niveles de parqueadero.",
    resolve: "Los autos del piso 2 no salen directo del juego: bajan al piso 1 si la celda de abajo está libre, y ahí los vuelves a tocar para sacarlos.",
  },
  broken: {
    icon: "🔧",
    title: "Autos averiados",
    identify: "Un auto con la insignia 🔧 (como \"0/1\") está averiado y no se puede tocar todavía.",
    resolve: "Sácalo a la persecución para buscar la refacción — al recogerla se repara y ya se puede lanzar normalmente.",
  },
  obstacles: {
    icon: "🚧",
    title: "Obstáculos fijos",
    identify: "Los bloques naranjas con franjas no son autos: son obstáculos permanentes que nunca se mueven.",
    resolve: "Ningún auto puede atravesarlos — tenlos en cuenta al planear, porque bloquean ese camino para siempre.",
  },
  edgeClosures: {
    icon: "🚦",
    title: "Cierre de carriles",
    identify: "Una franja roja en un borde de la cuadrícula significa que esa salida está cerrada por un momento.",
    resolve: "Espera a que se abra de nuevo (se alterna cada pocos segundos) antes de lanzar un auto hacia ese lado.",
  },
  ambientTraffic: {
    icon: "🚗💨",
    title: "Tráfico ambiente",
    identify: "De vez en cuando un auto se mueve solo, sin que lo toques.",
    resolve: "Es normal en este nivel — aprovéchalo, puede abrirte un camino que antes estaba bloqueado.",
  },
  timer: {
    icon: "⏱",
    title: "Cronómetro de nivel",
    identify: "Una barra de tiempo aparece bajo el marcador de nivel.",
    resolve: "Si se agota pierdes una vida y el reloj se reinicia — sigue sacando autos para mantenerlo lleno.",
  },
  vip: {
    icon: "👑",
    title: "Auto VIP",
    identify: "Un auto con la insignia 👑 y un número es VIP: ese número son los toques de otros autos que le quedan antes de perder su bono.",
    resolve: "Sácalo antes de que llegue a 0 para ganar puntaje extra — si se acaba el tiempo no pasa nada malo, solo pierdes el bono.",
  },
  shortcut: {
    icon: "⚡",
    title: "Atajo de pago",
    identify: "El botón naranja \"⚡ Atajo (–1 vida)\" aparece cuando hay varios autos bloqueados.",
    resolve: "Úsalo para liberar hasta 3 autos bloqueados al instante, a cambio de 1 vida — útil si te quedaste sin movimientos claros.",
  },
  curvedRoad: {
    icon: "🌀",
    title: "Carretera curva",
    identify: "La carretera se mece lentamente de un lado a otro en vez de ir recta.",
    resolve: "Sigue el movimiento con la mirada — tu carril sigue siendo el mismo, solo cambia visualmente.",
  },
  fogRain: {
    icon: "🌫",
    title: "Niebla / lluvia",
    identify: "Los obstáculos aparecen difuminados cerca del horizonte en vez de verse nítidos de inmediato.",
    resolve: "Mantente atento apenas se empiecen a distinguir — tardan lo mismo en llegar, solo se ven después.",
  },
  crossLaneSwitch: {
    icon: "↔",
    title: "Cambio de carril",
    identify: "Algunos peatones o mascotas, después de cruzar y acomodarse en un carril, cambian a otro distinto.",
    resolve: "No te confíes apenas se acomodan la primera vez — espera a ver en qué carril quedan definitivamente antes de decidir.",
  },
};
