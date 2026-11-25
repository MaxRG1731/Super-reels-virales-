// Catálogo estático: categorías, duraciones, plataformas y estilos.

export const FAMILIES = {
  fear: 'Miedo',
  mystery: 'Misterio',
  conflict: 'Tensión y acción',
  wonder: 'Asombro',
  humor: 'Humor',
  heart: 'Emoción',
};

export const CATEGORIES = [
  { id: 'terror', name: 'Terror', emoji: '👻', color: '#ff3b4a', family: 'fear', blurb: 'Miedo que se queda contigo' },
  { id: 'suspenso', name: 'Suspenso', emoji: '😰', color: '#ff7a3d', family: 'fear', blurb: 'Tensión hasta el último segundo' },
  { id: 'misterio', name: 'Misterio', emoji: '🔍', color: '#8b7bff', family: 'mystery', blurb: 'Pistas que no encajan' },
  { id: 'intriga', name: 'Intriga', emoji: '🕶️', color: '#6a8cff', family: 'mystery', blurb: 'Secretos que alguien oculta' },
  { id: 'crimen', name: 'Crimen', emoji: '🚔', color: '#ff4d6d', family: 'mystery', blurb: 'Casos con giro final' },
  { id: 'comedia', name: 'Comedia', emoji: '😂', color: '#ffc233', family: 'humor', blurb: 'Situaciones imposibles' },
  { id: 'humor_negro', name: 'Humor negro', emoji: '💀', color: '#b36bff', family: 'humor', blurb: 'Reír cuando no se debe' },
  { id: 'romance', name: 'Romance', emoji: '💘', color: '#ff6fa8', family: 'heart', blurb: 'Amor con un obstáculo' },
  { id: 'drama', name: 'Drama', emoji: '🎭', color: '#c97b5a', family: 'heart', blurb: 'Decisiones que lo cambian todo' },
  { id: 'accion', name: 'Acción', emoji: '💥', color: '#ff8a1f', family: 'conflict', blurb: 'Adrenalina sin pausa' },
  { id: 'scifi', name: 'Ciencia ficción', emoji: '🚀', color: '#37d6ff', family: 'wonder', blurb: 'El futuro y sus riesgos' },
  { id: 'fantasia', name: 'Fantasía', emoji: '🐉', color: '#9b7bff', family: 'wonder', blurb: 'Magia con reglas propias' },
  { id: 'aventura', name: 'Aventura', emoji: '🧭', color: '#3ddc97', family: 'conflict', blurb: 'Un viaje sin vuelta atrás' },
  { id: 'supervivencia', name: 'Supervivencia', emoji: '🏕️', color: '#7bc96f', family: 'conflict', blurb: 'Sobrevivir o rendirse' },
  { id: 'real_dramatizada', name: 'Historias reales dramatizadas', emoji: '🎬', color: '#d8b36a', family: 'heart', blurb: 'Hechos reales, contados con cine' },
  { id: 'mitologia', name: 'Mitología', emoji: '⚡', color: '#ffd24d', family: 'wonder', blurb: 'Dioses, héroes y castigos' },
  { id: 'deportes', name: 'Deportes', emoji: '🏆', color: '#4dd2ff', family: 'conflict', blurb: 'El partido de su vida' },
  { id: 'curiosidades', name: 'Curiosidades', emoji: '🤯', color: '#46e0c2', family: 'wonder', blurb: 'Datos que parecen mentira' },
  { id: 'motivacion', name: 'Motivación', emoji: '🔥', color: '#ff9f43', family: 'heart', blurb: 'Levantarse una vez más' },
  { id: 'emocional', name: 'Historias emocionales', emoji: '🥹', color: '#ff8fb1', family: 'heart', blurb: 'Para llorar y compartir' },
  { id: 'traiciones', name: 'Traiciones', emoji: '🗡️', color: '#e04a5f', family: 'heart', blurb: 'Quien menos esperas' },
  { id: 'leyendas_urbanas', name: 'Leyendas urbanas', emoji: '🌫️', color: '#9aa7b8', family: 'fear', blurb: '«Dicen que pasó de verdad»' },
  { id: 'fenomenos', name: 'Fenómenos inexplicables', emoji: '🛸', color: '#59e0a8', family: 'mystery', blurb: 'Sin explicación científica' },
  { id: 'conspiraciones', name: 'Conspiraciones ficticias', emoji: '🧩', color: '#7b8cff', family: 'mystery', blurb: 'Teorías inventadas, tensión real' },
];

export const DURATIONS = [15, 30, 45, 60, 90];

export const PLATFORMS = [
  { id: 'tiktok', name: 'TikTok', short: 'TikTok', tags: ['#fyp', '#parati', '#tiktokhistorias'], tip: 'Gancho en el primer segundo y subtítulos grandes.' },
  { id: 'reels', name: 'Instagram Reels', short: 'Reels', tags: ['#reels', '#reelsinstagram', '#explore'], tip: 'Evita poner texto en el borde inferior: lo tapa la interfaz.' },
  { id: 'shorts', name: 'YouTube Shorts', short: 'Shorts', tags: ['#shorts', '#youtubeshorts', '#historias'], tip: 'Un título claro ayuda más que en las otras plataformas.' },
];

// grad: colores del fondo generado cuando una escena aún no tiene imagen.
export const STYLES = [
  { id: 'cinematico', name: 'Cinematográfico', suffix: 'cinematic film still, anamorphic lens, shallow depth of field, color graded', mood: 'orquestal', grad: ['#1b2440', '#07070b'] },
  { id: 'terror_realista', name: 'Terror realista', suffix: 'photorealistic horror, found footage, harsh shadows, desaturated, film grain', mood: 'drone oscuro', grad: ['#2a0b0f', '#030304'] },
  { id: 'animacion', name: 'Animación', suffix: '2D animation, bold outlines, expressive characters, painterly background', mood: 'juguetón', grad: ['#3b2a73', '#0e0b24'] },
  { id: '3d', name: '3D', suffix: 'stylized 3D render, soft global illumination, pixar-like materials', mood: 'épico ligero', grad: ['#143a52', '#07131c'] },
  { id: 'documental', name: 'Documental', suffix: 'documentary photography, natural light, handheld, archival look', mood: 'ambiental', grad: ['#2f2a22', '#0b0a08'] },
  { id: 'realista', name: 'Realista', suffix: 'realistic photo, natural lighting, 35mm', mood: 'minimal', grad: ['#22303a', '#080c10'] },
  { id: 'epico', name: 'Épico', suffix: 'epic wide shot, dramatic sky, golden rim light, grand scale', mood: 'épico coral', grad: ['#4a2b0d', '#0d0703'] },
  { id: 'comico', name: 'Cómico', suffix: 'bright saturated colors, comedic framing, exaggerated expressions', mood: 'cómico', grad: ['#5a3d00', '#140e00'] },
  { id: 'oscuro', name: 'Oscuro', suffix: 'dark moody low-key lighting, deep blacks, neon accents', mood: 'synthwave oscuro', grad: ['#1a0b33', '#030208'] },
  { id: 'emocional', name: 'Emocional', suffix: 'warm intimate close-ups, golden hour, soft focus', mood: 'piano suave', grad: ['#4d2330', '#0f070a'] },
];

export const ROLE_LABELS = {
  hook: 'Gancho',
  setup: 'Presentación',
  esc: 'Escalada',
  twist: 'Giro',
  climax: 'Clímax',
  ending: 'Final',
  extra: 'Escena',
};

export const ROLE_COLORS = {
  hook: '#ff3d4a',
  setup: '#6a8cff',
  esc: '#ffb020',
  twist: '#b36bff',
  climax: '#ff7a3d',
  ending: '#3ddc97',
  extra: '#8a8fa3',
};

export const byId = (list, id) => list.find((x) => x.id === id);
