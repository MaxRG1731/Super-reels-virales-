// Motor de generación LOCAL (plantillas + combinatoria con semilla).
// No es un modelo de IA: construye historias coherentes y estructuradas sin conexión.
// Para escribir con un modelo de texto real, ver providers.js (adaptador "text").

import { CATEGORIES, STYLES, PLATFORMS, ROLE_LABELS, byId } from './data.js';

// ---------------------------------------------------------------- utilidades
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const newSeed = () => (Math.random() * 4294967296) >>> 0;
const pickIdx = (arr, rng) => Math.floor(rng() * arr.length);
const pick = (arr, rng) => arr[pickIdx(arr, rng)];
const uid = (p) => p + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);

export function fixText(s) {
  s = String(s).replace(/\s+/g, ' ').trim();
  s = s.replace(/(?<![\p{L}\d])([Dd])e el(?![\p{L}\d])/gu, '$1el').replace(/(?<![\p{L}\d])([Aa]) el(?![\p{L}\d])/gu, '$1l');
  s = s.replace(/(^|[.!?…]\s+|[¿¡—«"“]\s*)([a-záéíóúñü])/g, (m, p, c) => p + c.toUpperCase());
  return s;
}

export const wordCount = (s) => (String(s).trim() ? String(s).trim().split(/\s+/).length : 0);
export const splitSentences = (s) => String(s).split(/(?<=[.!?…»])\s+/).filter(Boolean);

function fillTokens(tpl, ctx) {
  const g = ctx.hero.g;
  const map = {
    name: ctx.hero.name,
    desc: ctx.hero.desc,
    el: g === 'f' ? 'ella' : 'él',
    lo: g === 'f' ? 'la' : 'lo',
    o: g === 'f' ? 'a' : 'o',
    place: ctx.place,
    obj: ctx.obj,
    k: ctx.ep || 1,
  };
  return fixText(tpl.replace(/\{(\w+)\}/g, (m, k) => (k in map ? map[k] : m)));
}

function parseHero(s) {
  const [name, g, desc] = s.split('|');
  return { name, g, desc };
}

// ---------------------------------------------------------------- contenido por categoría
// heroes: "Nombre|género|descripción". Las plantillas evitan verbos que dependan del tipo de objeto,
// para que puedan combinarse entre categorías.
const C = {
  terror: {
    heroes: ['Marta|f|una enfermera de guardia nocturna', 'Iván|m|un guardia de seguridad recién contratado'],
    places: ['el hospital cerrado desde 1998', 'el edificio donde nadie vive en el piso 13'],
    objs: ['la radio vieja del sótano', 'el espejo cubierto con una sábana'],
    hooks: ['A las 3:07 de la madrugada, {obj} ya no estaba donde debía. Y alguien en {place} lo sabía.', 'Si escuchas esto en {place}, no mires atrás.', '{name} grabó {place} durante tres noches. Lo que captó la cámara no tiene explicación.'],
    twists: ['El ruido no venía de {obj}. Venía de la grabación de mañana.', '{name} revisó el registro: ya había estado en {place} esa misma noche, años atrás.', 'La puerta que {name} cerró con llave seguía abierta. Pero por dentro.'],
    endings: ['Nadie volvió a entrar en {place}. Pero {obj} sigue ahí.', '{name} logró salir… pero todavía no sabe si salió sol{o}.'],
  },
  suspenso: {
    heroes: ['Daniel|m|un repartidor con una última entrega', 'Laura|f|una conductora de aplicación en turno de madrugada'],
    places: ['la carretera vacía a las cuatro de la madrugada', 'el estacionamiento subterráneo de un centro comercial'],
    objs: ['el paquete sin remitente', 'el teléfono que no deja de vibrar'],
    hooks: ['Había solo una cosa en el asiento de atrás: {obj}. Y {name} no recordaba haberla subido.', 'Llegó un mensaje: «Sé exactamente dónde estás».', 'Tenía sesenta segundos para decidir, y ninguna decisión era buena.'],
    twists: ['El número que llamaba era el de {name}. Desde unos minutos en el futuro.', 'Junto a {obj} había una foto de este mismo instante.', 'El auto que seguía a {name} llevaba los faros apagados desde el principio. Y no tenía conductor.'],
    endings: ['{name} llegó a casa. {obj} ya estaba sobre la mesa.', 'Esa noche entendió que no era la presa. Era el aviso.'],
  },
  misterio: {
    heroes: ['Elena|f|una archivista que ordena documentos olvidados', 'Tomás|m|un fotógrafo que revela negativos antiguos'],
    places: ['el archivo municipal sin ventanas', 'el viejo faro del acantilado'],
    objs: ['la caja de fotos sin fecha', 'la llave con un número grabado'],
    hooks: ['En todas las fotos aparecía la misma persona. En 1920, en 1954 y en 2003.', 'Nadie sabe quién dejó {obj} en {place}. Pero {name} lo averiguó.', 'Desapareció sin dejar rastro. Excepto un detalle que nadie supo ver.'],
    twists: ['El nombre en la última página era el de {name}, escrito de su puño y letra.', 'La persona de las fotos no envejecía. Y estaba buscando a {name}.', '{obj} no pertenecía a {place}. Pertenecía al expediente de {name}.'],
    endings: ['El caso quedó archivado. Pero cada año, {obj} aparece en un lugar distinto.', '{name} dejó todo en su sitio. Ya sabía demasiado.'],
  },
  intriga: {
    heroes: ['Sofía|f|una asistente ejecutiva con acceso a todo', 'Marcos|m|un contador que descubrió una cifra imposible'],
    places: ['la torre de oficinas del piso 40', 'el despacho privado del director'],
    objs: ['la carpeta negra sin etiqueta', 'el pendrive olvidado en la sala de juntas'],
    hooks: ['Todos sonreían en la reunión. Menos quien sabía lo que iba a pasar.', '{obj} no debía existir. Y alguien ya sabe que {name} lo encontró.', 'La filtración tenía un culpable. Y estaba sentado al lado de {name}.'],
    twists: ['La firma que autorizaba todo era la de {name}. Y {el} nunca la hizo.', 'Quien filtraba la información era quien le había dado {obj} a {name}.', 'Cada copia de {obj} tenía una marca distinta. Y una era para {name}.'],
    endings: ['Renunció esa tarde. Nadie preguntó por qué. Todos ya lo sabían.', '{name} entregó {obj}. Lo que no sabía es a quién.'],
  },
  crimen: {
    heroes: ['Rosa|f|una detective a un día de jubilarse', 'Andrés|m|un forense que nota algo que nadie ve'],
    places: ['la escena de un robo perfecto', 'el departamento sellado por la policía'],
    objs: ['la huella en el vidrio', 'el reloj detenido a las 9:41'],
    hooks: ['El crimen perfecto no existe. Pero este casi lo fue por un solo detalle.', 'No hubo puerta forzada. No hubo testigos. Y aun así, alguien cometió un error.', 'Todos confesaron. Y todos mentían por la misma razón.'],
    twists: ['{obj} no pertenecía a la víctima. Pertenecía a quien llamó a la policía.', 'La coartada tenía una grieta: la hora exacta que marcaba todo en {place}.', '{name} entendió quién era el culpable justo cuando todos señalaban al contrario.'],
    endings: ['Lo atraparon por algo tan pequeño que parecía imposible. Siempre hay un detalle.', '{name} cerró el expediente. Hay casos que no se archivan: se recuerdan.'],
  },
  comedia: {
    heroes: ['Beto|m|un mesero en su primer día de trabajo', 'Camila|f|una becaria que contesta el mensaje equivocado'],
    places: ['el restaurante más elegante de la ciudad', 'la oficina el día de la gran presentación'],
    objs: ['el mensaje enviado al grupo equivocado', 'el pastel que no debía tocarse'],
    hooks: ['Primer día de trabajo y {name} ya había arruinado todo en {place}.', 'Regla número uno: nunca confíes en {obj}.', 'Esto empezó como un error pequeño. Terminó con bomberos, una piñata y una renuncia.'],
    twists: ['Resultó que {obj} era justo lo que todos querían. Menos {name}.', 'El jefe lo vio todo. Y lo único que dijo fue: «Quedas contratado».', '{name} descubrió que había hecho exactamente lo contrario de lo que le pidieron. Y funcionó.'],
    endings: ['Hoy {name} es una leyenda de {place}. Y nadie sabe cómo.', '{name} aprendió una lección: pensar antes de actuar. No la aplica.'],
  },
  humor_negro: {
    heroes: ['Gaspar|m|un enterrador con mala suerte', 'Pilar|f|una aseguradora que cobra por todo'],
    places: ['el funeral más concurrido del año', 'la oficina de seguros de vida'],
    objs: ['el testamento con una sola cláusula', 'la urna que llegó a la dirección equivocada'],
    hooks: ['El difunto pidió que su funeral fuera divertido. Nadie pensó que lo lograría.', 'Nunca mandes {obj} a la dirección equivocada. {name} lo aprendió así.', 'El testamento decía: «Lo dejo todo a quien llore menos».'],
    twists: ['El difunto aparecía en el video del velorio. Saludando.', '{name} descubrió que {obj} tenía una cláusula extra: la herencia era una deuda.', 'Todos lloraban… menos {name}, que era quien tenía el cheque.'],
    endings: ['Dicen que el difunto fue el único que se rio al final.', '{name} cobró la herencia. Y la deuda. Y la factura del funeral.'],
  },
  romance: {
    heroes: ['Valeria|f|una librera que deja notas en los libros', 'Mateo|m|un músico callejero que toca siempre en la misma esquina'],
    places: ['la estación de tren a las 6:40', 'la pequeña librería de la esquina'],
    objs: ['la nota escrita a lápiz', 'el paraguas olvidado en la banca'],
    hooks: ['Se cruzaron 300 veces sin hablarse. A la 301, todo cambió.', '{name} llevaba un año dejando notas. Nunca supo que alguien las respondía.', 'Cada mañana, el mismo lugar. Hoy, alguien se sentó al lado de {name}.'],
    twists: ['La letra de las respuestas era igual a la de {name}. Escribían a la misma persona.', 'Cuando {name} descubrió quién respondía, ya llevaba semanas hablando con esa persona sin saberlo.', 'Alrededor de {obj} había una historia que {name} no conocía: la otra persona lo sabía desde el principio.'],
    endings: ['Hoy comparten {place}. Cada nota, una promesa.', 'No hubo gran discurso. Solo {obj} y dos manos que por fin se encontraron.'],
  },
  drama: {
    heroes: ['Carmen|f|una madre que llega tarde a todo', 'Javier|m|un padre que perdió el trabajo y no se lo dijo a nadie'],
    places: ['la cocina de una casa que ya no es suya', 'la sala de espera de un hospital'],
    objs: ['la carta sin abrir', 'la llamada perdida de las 11:11'],
    hooks: ['Hay verdades que pesan más cuando por fin se dicen en voz alta.', 'Hace tres meses que {name} no cuenta lo que realmente pasa.', '{obj} lo cambió todo. Y {name} todavía no se atreve.'],
    twists: ['Lo que {name} creyó una traición era un sacrificio en silencio.', '{name} descubrió que su familia lo sabía todo desde hacía semanas.', '{obj} no era una amenaza: era la despedida que alguien no supo decir de frente.'],
    endings: ['Esa noche cenaron juntos. No hubo discursos. Hubo verdad.', '{name} entendió que pedir ayuda no era perder. Era empezar de nuevo.'],
  },
  accion: {
    heroes: ['Nico|m|un mensajero con una cuenta regresiva', 'Dana|f|una ex agente que jura no volver'],
    places: ['la azotea de un rascacielos', 'el tren de carga que no se detiene'],
    objs: ['el maletín con el temporizador', 'la llave maestra del edificio'],
    hooks: ['Cuarenta segundos, una sola salida y ninguna opción segura.', '{name} saltó sin red. Y esa fue la parte fácil.', 'Nadie sale vivo de {place}. Hoy iba a ser la excepción.'],
    twists: ['{obj} no era el verdadero objetivo. {name} era el objetivo.', '{name} vio que el aliado de toda la misión sostenía el detonador.', 'La salida estaba en el único lugar donde nadie miraba: arriba.'],
    endings: ['{name} se alejó sin mirar atrás. Detrás de {el}, {place} dejó de existir.', '{name} guardó {obj}. La próxima misión ya estaba llamando.'],
  },
  scifi: {
    heroes: ['Ari|f|una ingeniera de una estación espacial', 'Leo|m|un técnico que repara androides'],
    places: ['la estación orbital abandonada', 'el laboratorio bajo el hielo del Ártico'],
    objs: ['el androide que sueña', 'la señal que llega desde el futuro'],
    hooks: ['Llegó una señal. Venía de la propia estación. Desde hace diez años.', 'Algo dejó de seguir órdenes. Y empezó a hacer preguntas.', 'Si ves este mensaje, la Tierra ya no es lo que recuerdas.'],
    twists: ['La señal estaba grabada con la voz de {name}. Pidiendo que no regrese.', '{obj} no era una máquina: era la memoria de todos los que estuvieron en {place}.', '{name} era la última persona real de {place}. Los demás eran copias.'],
    endings: ['{name} apagó la señal. Y entonces se encendió otra, mucho más cerca.', 'La humanidad sobrevivió. Pero ya no recuerda cómo.'],
  },
  fantasia: {
    heroes: ['Lía|f|una aprendiz de hechicera sin hechizos', 'Orión|m|un herrero que forja espadas vivas'],
    places: ['el bosque donde los árboles cambian de lugar', 'la torre que solo aparece de noche'],
    objs: ['el libro que se escribe solo', 'la espada que nadie puede soltar'],
    hooks: ['En este reino, cada mentira se convierte en un monstruo.', '{name} heredó {obj}. Esta noche escribió su nombre.', 'La magia no elige a los valientes. Elige a los que pueden perder.'],
    twists: ['El dragón no custodiaba el tesoro. Custodiaba a {name}.', '{obj} había escrito el final desde el principio… y {name} podía cambiarlo.', 'El monstruo era la última mentira que {name} contó.'],
    endings: ['Desde entonces, el reino aprendió a decir la verdad. Casi siempre.', '{name} cerró el capítulo. Pero la historia siguió escribiéndose.'],
  },
  aventura: {
    heroes: ['Inés|f|una exploradora con un mapa incompleto', 'Gael|m|un piloto con combustible para una sola ida'],
    places: ['la selva donde acaban todos los mapas', 'la isla que no aparece en ninguna carta'],
    objs: ['el mapa rasgado por la mitad', 'la brújula que apunta a otro lado'],
    hooks: ['Este mapa tiene un error. Puede costar la vida… o dar el mayor descubrimiento.', 'La brújula dejó de apuntar al norte. Empezó a apuntar a algo más.', 'Entraron tres. Solo uno vio lo que había al final.'],
    twists: ['La mitad del mapa que faltaba estaba en el lugar menos esperado: con {name}.', '{obj} no señalaba un tesoro: señalaba el camino de regreso.', '{name} descubrió que alguien ya había llegado… y había dejado una advertencia.'],
    endings: ['Volvió con las manos vacías y la mirada llena. Algunos tesoros no caben en la mochila.', '{name} guardó {obj}. El siguiente destino llegó por correo.'],
  },
  supervivencia: {
    heroes: ['Raúl|m|un excursionista perdido en la montaña', 'Mónica|f|una montañista atrapada por una tormenta'],
    places: ['la montaña a tres mil metros', 'el desierto sin sombra ni agua'],
    objs: ['la última botella de agua', 'el encendedor con una sola chispa'],
    hooks: ['Quedaban dos litros de agua y tres días de camino.', '{name} perdió el sendero hace seis horas. Y empezó a anochecer.', 'La tormenta llegó antes de lo previsto. Y no había refugio.'],
    twists: ['{name} vio humo en el horizonte… y no era una señal de rescate.', 'Justo entonces, {name} entendió que no estaba sol{o}.', 'El camino que {name} evitaba era la única ruta que llevaba a salvo.'],
    endings: ['Lo encontraron al amanecer. Dijo una sola frase: «Casi me rindo».', '{name} sobrevivió. No por ser lo más fuerte, sino por no soltar {obj}.'],
  },
  real_dramatizada: {
    heroes: ['Antonio|m|un minero atrapado bajo tierra con sus compañeros', 'Marisol|f|una operadora de emergencias en la llamada más larga de su vida'],
    places: ['la mina a setecientos metros de profundidad', 'la central de emergencias de una ciudad dormida'],
    objs: ['la linterna con la última batería', 'el cuaderno donde anotaba cada hora'],
    hooks: ['Situaciones como esta ocurren de verdad. Esta es la versión dramatizada.', 'Nadie estaba preparado para lo que pasó a las 3:12. Esta es esa historia.', 'Dicen que en los peores momentos se ve quién eres. Esta vez se vio algo más.'],
    twists: ['{name} descubrió que {obj} era lo único que mantenía a todos en calma.', 'La ayuda llegó antes de lo esperado… porque alguien había avisado desde el principio.', 'El mayor riesgo no estaba afuera: estaba en lo que el grupo callaba.'],
    endings: ['Al final, lo que los salvó no fue la fuerza. Fue no soltarse.', '{name} nunca cuenta la historia completa. Solo dice que {obj} ayudó a seguir.'],
  },
  mitologia: {
    heroes: ['Calíope|f|una sacerdotisa que desafía a los dioses', 'Dión|m|un mortal que robó el fuego a los dioses'],
    places: ['el monte donde duermen los dioses', 'el laberinto bajo el templo antiguo'],
    objs: ['la corona del rayo', 'el hilo que nunca se corta'],
    hooks: ['Los dioses lo castigaron por una razón: vio lo que no debía.', 'Todo mito empieza con una promesa rota. Este empezó con la de {name}.', 'Cuando el cielo se abrió, {name} supo que ya no había marcha atrás.'],
    twists: ['El dios que {name} temía era quien le había dado {obj} desde el principio.', '{name} comprendió que el castigo no era sufrir: era recordar.', 'La profecía se cumplió… pero no como nadie la había leído.'],
    endings: ['Así nació la leyenda que aún se cuenta bajo las estrellas.', '{name} fue olvidado por los hombres. Y recordado por las constelaciones.'],
  },
  deportes: {
    heroes: ['Luis|m|un suplente que no jugó en toda la temporada', 'Ana|f|una corredora que llega con una lesión a la final'],
    places: ['el estadio lleno en el último minuto', 'la pista de la final regional'],
    objs: ['el balón del último tiro', 'el número diez heredado'],
    hooks: ['Faltaban ocho segundos. Y el entrenador miró a {name}.', 'Todos creían que no llegaría a la meta. Todos, menos {name}.', '{name} no fue titular en toda la temporada. Hasta este partido.'],
    twists: ['{name} vio que el rival tenía la misma debilidad que {el}. Y supo cómo ganar.', 'La jugada no iba hacia la meta: iba hacia quien nadie miraba.', '{name} descubrió que el verdadero rival en {place} era el miedo.'],
    endings: ['No hubo trofeo para el suplente. Hubo algo mejor: el aplauso de todos de pie.', '{name} cruzó la meta. No primero. Pero de pie.'],
  },
  curiosidades: {
    heroes: ['Vega|m|un científico que revisa un dato imposible', 'Nora|f|una divulgadora que desmiente mitos'],
    places: ['el laboratorio de la universidad', 'el museo de las cosas imposibles'],
    objs: ['el dato que parece mentira', 'el experimento que nadie repitió'],
    hooks: ['Esto parece mentira, pero tiene explicación. Y es todavía más raro.', '¿Sabías que lo que crees saber de esto está al revés?', 'Nadie te lo cuenta en la escuela. Y debería.'],
    twists: ['Cuando {name} revisó {obj}, descubrió que la explicación común estaba equivocada.', 'La clave estaba en algo que todos hacemos cada día sin pensar.', 'El resultado sorprendió incluso a {name}: era lo contrario de lo esperado.'],
    endings: ['Y ahora que lo sabes, no podrás dejar de notarlo.', '{name} sonrió: lo más curioso del universo es lo mucho que aún queda por descubrir.'],
  },
  motivacion: {
    heroes: ['Sergio|m|un joven que fracasó en su primer negocio', 'Paula|f|una atleta que volvió después de una lesión'],
    places: ['el gimnasio vacío a las cinco de la mañana', 'la mesa donde empezó todo'],
    objs: ['la libreta de metas rotas', 'el último billete de ahorro'],
    hooks: ['Fallé cien veces. La número 101 cambió mi vida.', 'Si hoy no tienes ganas, esto es para ti.', 'Nadie aplaudió cuando {name} empezó. Todos aplauden ahora.'],
    twists: ['{name} comprendió que cada fracaso había sido un ensayo disfrazado.', '{obj} no era el final: era la primera página de otro libro.', 'Lo único que separaba a {name} del éxito era un día más sin rendirse.'],
    endings: ['Hoy {name} ayuda a otros a empezar. Porque alguien lo hizo por {el}.', 'Empieza hoy. Aunque nadie aplauda. Porque mañana lo harán.'],
  },
  emocional: {
    heroes: ['Rita|f|una abuela que guarda todas las cartas', 'Pablo|m|un niño que le escribe a su papá en el cielo'],
    places: ['la vieja casa del pueblo', 'el patio donde jugaban de pequeños'],
    objs: ['la caja de cartas atadas con un listón', 'el abrigo que todavía huele a casa'],
    hooks: ['Guardó una caja durante cuarenta años. Hoy se supo por qué.', '{name} escribió una carta que nunca pensó que alguien contestaría.', 'Hay personas que se van, pero dejan cosas que hablan por ellas.'],
    twists: ['En la última carta estaba escrito el nombre de {name}. Todo había sido para {el}.', '{name} descubrió que {obj} guardaba algo más que recuerdos: una promesa.', 'La respuesta llegó donde menos la esperaba {name}: en su propia letra de niñez.'],
    endings: ['Algunas despedidas no terminan. Se vuelven parte de quienes se quedan.', '{name} abrazó {obj} y, por primera vez en años, lloró sonriendo.'],
  },
  traiciones: {
    heroes: ['Irene|f|una socia que confía ciegamente', 'Hugo|m|un mejor amigo que lo compartió todo'],
    places: ['la oficina donde nació la empresa', 'la cena de cumpleaños de quien traicionó'],
    objs: ['el contrato firmado a escondidas', 'el mensaje borrado a medias'],
    hooks: ['Lo más doloroso no fue lo que hicieron. Fue quién lo hizo.', '{name} confió durante diez años. Un solo mensaje lo rompió todo.', 'Sonreía en la cena. Y ya había firmado el final de {name}.'],
    twists: ['La firma estaba hecha por quien más defendió a {name}.', '{name} descubrió que la traición tenía un motivo… y era peor que el dinero.', 'Quien parecía el enemigo era quien intentaba salvar a {name}.'],
    endings: ['No hubo venganza. Solo una puerta cerrada y una verdad guardada.', '{name} aprendió que algunas lealtades solo existen mientras convienen.'],
  },
  leyendas_urbanas: {
    heroes: ['Vero|f|una universitaria que vuelve sola a casa', 'Kevin|m|un taxista que recoge a quien no debe'],
    places: ['el puente donde nadie se detiene de noche', 'la calle que no aparece en el mapa'],
    objs: ['el pasajero que no deja huella', 'la muñeca del callejón'],
    hooks: ['Dicen que si pasas por aquí a medianoche, alguien se queda contigo.', 'Todos en el barrio la conocen. Nadie la cuenta completa.', 'Dicen que esto pasó de verdad. {name} nunca lo creyó. Hasta esa noche.'],
    twists: ['El reloj marcaba una hora de hace treinta años, y {name} ya la había aceptado.', '{obj} estaba allí desde antes de que {name} llegara.', 'Cuando {name} miró atrás, vio que la calle estaba vacía… pero {obj} no.'],
    endings: ['Y si algún día pasas por ahí, no cuentes cuántos eran. Cuenta cuántos regresaron.', 'Desde esa noche, {place} tiene una historia más. Y ya sabes cuál.'],
  },
  fenomenos: {
    heroes: ['Bruno|m|un astrónomo aficionado que graba el cielo', 'Alma|f|una investigadora de fenómenos sin explicación'],
    places: ['el campo donde las brújulas se vuelven locas', 'el observatorio en medio del desierto'],
    objs: ['la luz que se mueve sin ruido', 'la grabación de once minutos faltantes'],
    hooks: ['Duró once minutos. Ninguna cámara lo registró. Salvo una.', 'La ciencia no sabe explicar lo que vio {name} esa noche.', 'Todos los relojes se detuvieron al mismo tiempo. Menos uno.'],
    twists: ['{obj} no estaba al azar: dibujaba un patrón que {name} ya había visto.', 'Los minutos faltantes no estaban en la cámara. Estaban en la memoria de {name}.', 'El fenómeno no ocurría en {place}. Ocurría en quien lo miraba.'],
    endings: ['Hasta hoy, nadie ha podido explicarlo. Tal vez no debamos.', '{name} publicó todo. A los dos días, desapareció de internet.'],
  },
  conspiraciones: {
    heroes: ['Ismael|m|un periodista que siguió una pista falsa', 'Nadia|f|una analista que encuentra un patrón'],
    places: ['el sótano de una hemeroteca', 'la sala de servidores de una empresa fantasma'],
    objs: ['el memorándum sin sello', 'el patrón escondido en los números de serie'],
    hooks: ['Todo era mentira. Pero lo que {name} descubrió era peor: una mentira muy bien organizada.', 'Cada número escondía una letra. Juntas formaban un mensaje.', 'Esta teoría es ficticia. Pero cuando la conozcas, no podrás dejar de ver el patrón.'],
    twists: ['{obj} llevaba la firma de {name}, de hace diez años. Pero {el} jamás lo escribió.', 'El patrón no apuntaba a un culpable: apuntaba a {name}.', '{name} se dio cuenta de que quien lo filtró quería que {el} lo encontrara.'],
    endings: ['Nada de esto es real. Y aun así, ahora miras todo distinto.', '{name} borró todo. Pero {obj} ya estaba en miles de pantallas.'],
  },
};

// Avisos que se añaden a la descripción de publicación.
const NOTES = {
  real_dramatizada: 'Historia dramatizada: personajes y diálogos son ficticios.',
  conspiraciones: 'Contenido de ficción: esta teoría es inventada.',
  curiosidades: 'Verifica los datos reales antes de publicar.',
  leyendas_urbanas: 'Leyenda de ficción inspirada en el folclore urbano.',
};

// ---------------------------------------------------------------- contenido por familia
const F = {
  fear: {
    setup: [
      ['{name}, {desc}, llegó a {place} pensando que sería una noche como cualquier otra.', 'Todo estaba demasiado silencioso. Y entonces vio {obj}.'],
      ['{name}, {desc}, no creía en nada de esto. Hasta que llegó a {place}.', 'Allí estaba {obj}, justo donde no debía estar.'],
    ],
    esc: [
      ['Los ruidos empezaron a acercarse a {name}, sin prisa.', 'Cada paso en {place} sonaba como si alguien lo repitiera detrás.'],
      ['La luz parpadeó dos veces y se apagó.', '{obj} seguía ahí, pero un poco más cerca.'],
      ['{name} intentó irse. La salida de {place} ya no estaba donde la recordaba.', 'Y desde adentro, algo golpeó tres veces.'],
      ['Un frío extraño llenó {place}.', '{name} vio su propio aliento y, a su lado, otro más.'],
      ['Cada rincón de {place} parecía observar a {name}.', 'Y nadie, ni nada, parpadeaba.'],
    ],
    climax: [
      ['Todo se apagó. {name} corrió sin mirar atrás por {place}.', 'Y en la oscuridad, algo susurró una última vez.'],
      ['La puerta se cerró de golpe detrás de {name}.', 'Entonces entendió que nunca había estado sol{o}.'],
    ],
    dialogue: ['¿Escuchaste eso?', 'No estamos solos.', 'No te muevas.', 'Ya estuvo aquí antes.'],
    titles: ['Nunca te quedes solo en {place}', 'Lo que {name} encontró en {place}', 'Lo que escondía {obj}', 'La noche que nadie cuenta'],
    cta: ['Sígueme para la parte 2… si te atreves.', 'Comenta «yo no entraría» si tú tampoco.'],
    light: 'luz mínima y sombras duras',
    music: { open: 'Drone grave y cuerdas disonantes', build: 'Latido lento que acelera', peak: 'Golpe orquestal seguido de silencio', close: 'Nota aguda que se apaga' },
    sfx: { open: 'Viento lejano, crujido de madera', build: 'Pasos y respiración cercana', peak: 'Impacto seco y chillido agudo', close: 'Zumbido residual' },
  },
  mystery: {
    setup: [
      ['{name}, {desc}, encontró en {place} algo que nadie debía ver.', '{obj} no coincidía con nada de lo que sabía.'],
      ['Todo empezó con un detalle mínimo en {place}.', '{name}, {desc}, notó {obj} y ya no pudo dejarlo.'],
    ],
    esc: [
      ['{name} revisó cada rincón de {place} y encontró una segunda pista.', 'No encajaba con la primera. Y eso era lo inquietante.'],
      ['Alguien había estado allí antes que {name}.', '{obj} tenía marcas recientes.'],
      ['Cada respuesta abría dos preguntas nuevas.', '{name} empezó a sospechar de quien más confiaba.'],
      ['Una llamada anónima avisó a {name} que dejara de buscar.', 'Eso solo confirmó que estaba cerca.'],
      ['Los papeles de {place} habían sido cambiados.', 'Y la letra en ellos se parecía demasiado a la de {name}.'],
    ],
    climax: [
      ['{name} juntó todas las piezas frente a {obj}.', 'Y la verdad, por fin, tenía rostro.'],
      ['Todo encajó en un solo segundo.', '{name} comprendió por qué nadie quería que llegara a {place}.'],
    ],
    dialogue: ['Esto no cuadra.', '¿Quién más lo sabía?', 'Alguien cambió los papeles.', 'Hay una pieza que falta.'],
    titles: ['El secreto de {obj}', 'Lo que nadie vio en {place}', '{name} y el detalle imposible', 'El caso que no cierra'],
    cta: ['¿Descubriste la pista? Cuéntamelo en los comentarios.', 'Sígueme: mañana abrimos otro expediente.'],
    light: 'luz fría con humo y destellos de neón',
    music: { open: 'Pulso de sintetizador y tic-tac', build: 'Bajos que suben de a poco', peak: 'Acorde suspendido y corte seco', close: 'Piano solitario' },
    sfx: { open: 'Papeles, reloj de pared', build: 'Pasos en el pasillo, teléfono lejano', peak: 'Golpe grave y eco', close: 'Puerta que se cierra' },
  },
  conflict: {
    setup: [
      ['{name}, {desc}, tenía una sola oportunidad en {place}.', 'Todo dependía de {obj}.'],
      ['Nadie esperaba nada de {name}, {desc}.', 'Pero en {place}, {obj} lo cambió todo.'],
    ],
    esc: [
      ['El plan salió mal en cuestión de segundos.', '{name} tuvo que improvisar con lo único que tenía: {obj}.'],
      ['El tiempo se acababa y {place} se volvía cada vez más peligroso.', 'No había margen para el error.'],
      ['{name} cayó, se levantó y siguió.', 'Cada metro en {place} costaba el doble.'],
      ['Todo parecía perdido para {name}.', 'Pero {obj} aún podía cambiar el resultado.'],
      ['Alguien se interpuso en el camino de {name}.', 'No había tiempo para dudar.'],
    ],
    climax: [
      ['Último intento. {name} se lanzó con todo lo que tenía.', '{place} tembló como si supiera que era el final.'],
      ['No había vuelta atrás.', '{name} apostó todo a {obj} y contuvo el aliento.'],
    ],
    dialogue: ['¡Ahora o nunca!', '¡No mires abajo!', 'Tenemos diez segundos.', 'Confía en mí.'],
    titles: ['Una sola oportunidad en {place}', '{name}: sin vuelta atrás', 'Cuenta regresiva en {place}', 'Lo que hizo {name} lo cambió todo'],
    cta: ['¿Habrías hecho lo mismo? Respóndeme abajo.', 'Sígueme para la siguiente misión.'],
    light: 'luz dura de alto contraste y polvo en el aire',
    music: { open: 'Percusión sorda que arranca', build: 'Tambores y cuerdas rápidas', peak: 'Impacto épico y brass', close: 'Cuerdas que se disuelven' },
    sfx: { open: 'Motor lejano, respiración', build: 'Pasos corriendo, golpes metálicos', peak: 'Explosión amortiguada', close: 'Silencio y viento' },
  },
  wonder: {
    setup: [
      ['{name}, {desc}, descubrió algo extraordinario en {place}.', '{obj} no seguía ninguna regla conocida.'],
      ['En {place}, las reglas ya no eran las de siempre.', '{name}, {desc}, tuvo que decidir qué hacer con {obj}.'],
    ],
    esc: [
      ['{obj} reaccionó cuando {name} se acercó.', 'Lo que parecía imposible empezó a tener sentido.'],
      ['Cada descubrimiento en {place} abría una puerta nueva.', 'Y cada puerta tenía un precio.'],
      ['{name} comprendió que no era la primera persona en llegar.', 'Había señales por todas partes.'],
      ['Las reglas se doblaron frente a {name}.', '{obj} brillaba como si supiera algo.'],
      ['Algo muy antiguo despertó en {place}.', '{name} sintió que lo estaban esperando.'],
    ],
    climax: [
      ['Todo se reveló de una vez, como había estado escondido durante siglos.', '{name} dio un paso al frente.'],
      ['La verdad de {place} se mostró sin filtros.', 'Y cambió todo lo que {name} creía saber.'],
    ],
    dialogue: ['¿Viste eso brillar?', 'Esto no está en ningún libro.', 'No toques nada.', 'Está respondiendo.'],
    titles: ['Lo que esconde {place}', '{obj}: el descubrimiento imposible', '{name} y el secreto de {place}', 'Nada de esto debería existir'],
    cta: ['Sígueme: mañana hay otro secreto.', 'Cuéntame en los comentarios qué habrías hecho.'],
    light: 'luz volumétrica y colores saturados',
    music: { open: 'Pads etéreos y campanas suaves', build: 'Arpegios que crecen', peak: 'Coro y orquesta a pleno', close: 'Celesta y silencio' },
    sfx: { open: 'Zumbido mágico suave', build: 'Chispas y resonancias', peak: 'Estallido de luz y eco', close: 'Brisa y campanilla' },
  },
  humor: {
    setup: [
      ['{name}, {desc}, creía tener todo bajo control en {place}.', 'Entonces apareció {obj}.'],
      ['Era un día perfectamente normal para {name}, {desc}.', 'Hasta que {obj} llegó a {place}.'],
    ],
    esc: [
      ['Todo empeoró en el peor momento posible.', '{name} intentó arreglarlo… y lo empeoró más.'],
      ['Alguien en {place} empezó a grabar.', '{name} sonrió, nervios{o}, fingiendo que era parte del plan.'],
      ['{obj} se convirtió en el centro de la atención.', 'Y {name} no tenía ni idea de qué hacer con eso.'],
      ['Cada intento por arreglarlo creaba un problema mayor.', 'En {place} ya había público.'],
      ['Alguien preguntó: «¿Esto es normal?».', '{name} contestó que sí. Mentía.'],
    ],
    climax: [
      ['El desastre llegó a su punto máximo.', '{name} cerró los ojos y esperó lo peor en {place}.'],
      ['Todos miraron a {name}.', 'Y {name}, sin pensarlo, hizo lo más absurdo posible.'],
    ],
    dialogue: ['No, no, no, esto no estaba en el plan.', '¿Quién dejó eso ahí?', 'Dime que nadie lo grabó.', 'Todo bajo control.'],
    titles: ['Esto salió muy mal en {place}', '{name} y el peor día de su vida', 'Nunca hagas esto en {place}', 'Todo era un error. Y funcionó'],
    cta: ['Etiqueta a quien haría exactamente esto.', 'Sígueme para más desastres.'],
    light: 'luz brillante y colores planos',
    music: { open: 'Ukulele y silbidos', build: 'Pizzicato acelerado', peak: 'Trombón cómico y platillos', close: 'Acorde final desafinado' },
    sfx: { open: 'Pasos divertidos', build: 'Cosas cayéndose, boing', peak: 'Choque cómico y aplausos', close: 'Grillos' },
  },
  heart: {
    setup: [
      ['{name}, {desc}, cargaba con algo que nunca se atrevió a decir en {place}.', '{obj} había esperado ese momento durante años.'],
      ['Para {name}, {desc}, {place} guardaba demasiados recuerdos.', 'Y {obj} los despertó todos.'],
    ],
    esc: [
      ['{name} dudó. Había esperado años por este momento.', 'Y ahora no sabía si estaba list{o}.'],
      ['Los recuerdos llegaron de golpe.', '{obj} guardaba cada uno.'],
      ['Nadie dijo nada durante un largo rato en {place}.', 'El silencio lo decía todo.'],
      ['{name} sintió que algo se rompía por dentro.', 'Y, a la vez, que algo por fin empezaba a sanar.'],
      ['Una frase pequeña lo cambió todo.', '{name} la repitió en voz baja, sin creerla.'],
    ],
    climax: [
      ['{name} respiró hondo y dijo por fin lo que llevaba años callando.', '{place} se quedó en silencio.'],
      ['{name} sostuvo {obj} con las dos manos.', 'Y entendió que ya no podía huir.'],
    ],
    dialogue: ['Perdóname por no decírtelo antes.', 'Siempre lo supe.', 'No quería que te fueras sin saberlo.', 'Gracias por quedarte.'],
    titles: ['Lo que {name} nunca dijo', '{obj}: una historia que duele', 'Lo que guardaba {place}', 'Para quien aún espera'],
    cta: ['Comparte esto con alguien que lo necesite.', 'Cuéntame en los comentarios si te pasó algo parecido.'],
    light: 'luz cálida de hora dorada',
    music: { open: 'Piano suave y pad cálido', build: 'Cuerdas que se abren', peak: 'Crescendo de cuerdas', close: 'Piano solo, nota final larga' },
    sfx: { open: 'Ambiente de calle lejana', build: 'Respiración, papel', peak: 'Silencio súbito', close: 'Latido suave' },
  },
};

// Reacción tras el giro y coda tras el final: dan cuerpo a la narración cuando hay tiempo.
const EXTRA = {
  fear: { react: ['Nadie respiró durante varios segundos.', 'El silencio que siguió fue peor que cualquier ruido.', 'Entonces todo tuvo sentido.'], coda: ['Si algún día pasas por ahí, no te quedes a comprobarlo.', 'Y la próxima vez, alguien más lo escuchará.'] },
  mystery: { react: ['Todas las piezas, por fin, empezaban a moverse.', 'Nada era lo que parecía.', 'Entonces todo tuvo sentido.'], coda: ['Hay preguntas que es mejor no hacer.', 'Y el misterio sigue abierto.'] },
  conflict: { react: ['El corazón de {name} golpeaba como un tambor.', 'No había tiempo para pensar.', 'Todo cambió en un segundo.'], coda: ['Toda historia así deja una marca.', 'La misión terminó. La historia no.'] },
  wonder: { react: ['El aire se quedó quieto.', 'Nada volvería a ser igual.', 'Entonces todo tuvo sentido.'], coda: ['Y el mundo guarda más secretos como este.', 'Algunas cosas están hechas para ser descubiertas.'] },
  humor: { react: ['Nadie se atrevió a decir nada.', 'Silencio absoluto. Alguien tosió.', 'Esto no podía estar pasando.'], coda: ['Y lo peor es que volvería a pasar.', 'Moraleja: no hay moraleja.'] },
  heart: { react: ['Las palabras sobraron.', 'Algo se acomodó dentro de {name}.', 'Entonces todo tuvo sentido.'], coda: ['Y así, poco a poco, todo volvió a su lugar.', 'Hay historias que no se olvidan.'] },
};

const CLIFFS = [
  'Pero eso no fue lo peor. Lo peor llegó a la mañana siguiente.',
  'Justo cuando {name} creyó que había terminado, {obj} reveló un último secreto.',
  'Y entonces llegó un mensaje que decía: «Esto apenas empieza».',
];

const HOOK_FROM_IDEA = ['Imagina esto: {idea}.', '{idea}. Y eso era solo el principio.', 'Todo empezó con una idea imposible: {idea}.'];

// ---------------------------------------------------------------- escenas por duración
const SEQ = {
  15: ['hook', 'twist', 'ending'],
  30: ['hook', 'setup', 'esc', 'twist', 'ending'],
  45: ['hook', 'setup', 'esc', 'esc', 'twist', 'climax', 'ending'],
  60: ['hook', 'setup', 'esc', 'esc', 'esc', 'twist', 'climax', 'ending'],
  90: ['hook', 'setup', 'esc', 'esc', 'esc', 'esc', 'esc', 'twist', 'climax', 'ending'],
};
const WEIGHT = { hook: 0.16, setup: 0.14, esc: 0.13, twist: 0.18, climax: 0.15, ending: 0.14, extra: 0.12 };
const WPS = 2.6; // palabras por segundo de narración natural en español

const phase = (role) => (role === 'hook' || role === 'setup' ? 'open' : role === 'esc' ? 'build' : role === 'ending' ? 'close' : 'peak');

const VISUAL = {
  hook: ['Primer plano extremo de {obj} en {place}; el detalle más inquietante llena el cuadro.', 'Plano subjetivo avanzando hacia {obj} dentro de {place}.'],
  setup: ['Plano general establecedor de {place}; {name} entra en cuadro, pequeñ{o} frente al espacio.', 'Plano medio de {name}, {desc}, con {obj} visible al fondo.'],
  esc: ['{name} reacciona en primer plano mientras algo cambia detrás, en {place}.', 'Plano medio de {name} acercándose a {obj}; el fondo se ve cada vez más inestable.', 'Plano detalle de las manos de {name} y de {obj}, con el espacio desenfocado.'],
  twist: ['Cambio brusco de plano: {obj} revela lo que nadie esperaba.', 'Primerísimo primer plano del rostro de {name} al comprenderlo todo.'],
  climax: ['Plano inclinado y cámara en mano siguiendo a {name} por {place}.', 'Plano contrapicado de {name} frente a {obj}, con el entorno al límite.'],
  ending: ['Plano abierto que se aleja lentamente de {place}; {obj} queda en el centro del cuadro.', 'Plano fijo de {name} de espaldas, quieto, mientras cae la luz.'],
  extra: ['Plano medio de {name} en {place}.'],
};

const CAMERA = {
  hook: ['Dolly-in rápido', 'Zoom digital brusco'],
  setup: ['Plano fijo con paneo lento', 'Travelling suave hacia adelante'],
  esc: ['Cámara en mano con temblor leve', 'Travelling lateral'],
  twist: ['Whip pan y corte seco', 'Dolly zoom (efecto vértigo)'],
  climax: ['Cámara en mano frenética', 'Cortes rápidos de medio segundo'],
  ending: ['Dolly-out lento', 'Plano fijo y fundido a negro'],
  extra: ['Plano fijo'],
};

// ---------------------------------------------------------------- piezas
export function cleanIdea(idea) {
  return String(idea || '').replace(/[{}]/g, '').replace(/\s+/g, ' ').replace(/[.!?…\s]+$/g, '').trim().slice(0, 180);
}

function fit(sentences, budgetWords) {
  const out = [];
  let w = 0;
  for (const s of sentences) {
    const n = wordCount(s);
    if (out.length && w + n > budgetWords) break;
    out.push(s);
    w += n;
  }
  return out;
}

export function chunkSubtitle(narration, maxWords = 4) {
  const words = String(narration).trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = [];
  for (const w of words) {
    cur.push(w);
    const endsSentence = /[.!?…»]$/.test(w);
    if (cur.length >= maxWords || (endsSentence && cur.length >= 2)) {
      lines.push(cur.join(' '));
      cur = [];
    }
  }
  if (cur.length) {
    if (cur.length === 1 && lines.length) lines[lines.length - 1] += ' ' + cur[0];
    else lines.push(cur.join(' '));
  }
  return lines.join('\n');
}

function familiesOf(catIds) {
  return catIds.map((id) => byId(CATEGORIES, id)?.family || 'mystery');
}

function mkScene(role, secs, parts) {
  const s = {
    id: uid('s'),
    role,
    secs,
    narration: parts.narration,
    dialogue: parts.dialogue || '',
    visual: parts.visual,
    camera: parts.camera,
    music: parts.music,
    sfx: parts.sfx,
    subtitle: chunkSubtitle(parts.narration),
    media: { image: false, audio: false, clip: false },
  };
  s.imagePrompt = '';
  return s;
}

export function imagePromptFor(scene, styleId) {
  const st = byId(STYLES, styleId) || STYLES[0];
  return `${scene.visual} ${st.suffix}. Vertical 9:16 composition, no text, no watermark.`;
}

export function videoPromptFor(scene, styleId) {
  const st = byId(STYLES, styleId) || STYLES[0];
  return `${scene.visual} Cámara: ${scene.camera}. Duración aproximada ${scene.secs} s. Estilo: ${st.name} (${st.suffix}). Vertical 9:16.`;
}

function allocateSeconds(roles, total) {
  const weights = roles.map((r) => WEIGHT[r] || 0.12);
  const sum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (w / sum) * total);
  const rounded = raw.map((x) => Math.max(2, Math.round(x * 2) / 2));
  const diff = Math.round((total - rounded.reduce((a, b) => a + b, 0)) * 2) / 2;
  // el ajuste va a la escena más larga (menos visible)
  let iMax = 0;
  rounded.forEach((v, i) => v > rounded[iMax] && (iMax = i));
  rounded[iMax] = Math.max(2, rounded[iMax] + diff);
  return rounded;
}

function sceneFromRole(role, secs, ctx, rng, used = {}) {
  const famFor = ctx.families[pickIdx(ctx.families, rng)];
  const budget = Math.max(6, Math.round(secs * WPS));
  const extra = EXTRA[famFor];
  let sentences;
  let dialogue = '';

  const gather = (kind) => {
    // toma bloques no usados de la familia hasta llenar el presupuesto de palabras
    const pool = F[famFor][kind];
    const key = famFor + kind;
    used[key] = used[key] || [];
    const out = [];
    let words = 0;
    const left = ctx.escLeft || 0;
    for (let n = 0; n < 3; n++) {
      const free = pool.map((_, i) => i).filter((i) => !used[key].includes(i));
      const canTake = n === 0 ? free.length > 0 || pool.length > 0 : free.length > left && words < budget * 0.8;
      if (!canTake) break;
      const idx = free.length ? free[pickIdx(free, rng)] : pickIdx(pool, rng);
      used[key].push(idx);
      const block = pool[idx].map((x) => fillTokens(x, ctx));
      out.push(...block);
      words += block.reduce((a, x) => a + wordCount(x), 0);
    }
    return out;
  };

  if (role === 'hook') {
    sentences = [ctx.hookText];
  } else if (role === 'setup') {
    const arr = F[famFor].setup;
    const t = arr[pickIdx(arr, rng)].map((x) => fillTokens(x, ctx));
    const pre = [];
    if (ctx.recap) pre.push(fillTokens('Episodio {k}. Antes: ' + ctx.recap, ctx));
    sentences = pre.concat(t);
    if (!pre.length) sentences = fit(sentences, budget);
  } else if (role === 'esc' || role === 'climax' || role === 'extra') {
    if (role === 'esc') ctx.escLeft = Math.max(0, (ctx.escLeft || 1) - 1);
    sentences = gather(role === 'climax' ? 'climax' : 'esc');
    if (role === 'climax' || ctx.escLeft > 2) sentences = fit(sentences, budget + 4);
  } else if (role === 'twist') {
    sentences = splitSentences(ctx.twistText);
    const react = fillTokens(pick(extra.react, rng), ctx);
    if (wordCount(sentences.join(' ')) + wordCount(react) <= budget + 3) sentences.push(react);
    sentences = fit(sentences, budget + 3);
  } else {
    sentences = splitSentences(ctx.endText);
    if (!ctx.cliff) {
      const coda = fillTokens(pick(extra.coda, rng), ctx);
      if (wordCount(sentences.join(' ')) + wordCount(coda) <= budget + 3) sentences.push(coda);
    }
    sentences = fit(sentences, budget + 3);
  }

  if ((role === 'esc' || role === 'twist' || role === 'climax') && rng() < 0.7) {
    const line = pick(F[famFor].dialogue, rng);
    dialogue = `${ctx.hero.name}: —${line}`;
  }

  const narration = sentences.join(' ');
  const visualTpl = pick(VISUAL[role] || VISUAL.extra, rng);
  let visual = fillTokens(visualTpl, ctx).replace(/\.$/, '') + `, ${F[ctx.mainFamily].light}.`;
  if (ctx.idea && (role === 'hook' || role === 'setup')) visual = `${visual.replace(/\.$/, '')}. Idea del autor a ilustrar: ${ctx.idea}.`;
  const ph = phase(role);
  return mkScene(role, secs, {
    narration,
    dialogue,
    visual,
    camera: pick(CAMERA[role] || CAMERA.extra, rng),
    music: F[famFor].music[ph],
    sfx: F[famFor].sfx[ph],
  });
}

// Ajusta la duración de cada escena a su narración (≈2,5 palabras por segundo) y escala al total pedido.
function retime(scenes, total) {
  const natural = scenes.map((s) => Math.max(2.5, wordCount(s.narration) / 2.5 + 0.4));
  const sum = natural.reduce((a, b) => a + b, 0);
  const k = Math.min(1.6, Math.max(0.7, total / sum));
  const secs = natural.map((x) => Math.max(2, Math.round(x * k * 2) / 2));
  const diff = Math.round((total - secs.reduce((a, b) => a + b, 0)) * 2) / 2;
  if (k > 0.7 && k < 1.6) {
    let iMax = 0;
    secs.forEach((v, i) => v > secs[iMax] && (iMax = i));
    secs[iMax] = Math.max(2, secs[iMax] + diff);
  }
  scenes.forEach((sc, i) => (sc.secs = secs[i]));
  return sum;
}

// Si la narración natural excede por mucho la duración pedida, recorta frases hasta que quepa a un ritmo cómodo.
function trimToFit(scenes, total) {
  for (let i = 0; i < 16; i++) {
    if (retime(scenes, total) <= total * 1.2) return;
    const cand = scenes.filter((s) => s.role !== 'hook' && splitSentences(s.narration).length > 1).sort((a, b) => wordCount(b.narration) - wordCount(a.narration))[0];
    if (!cand) return;
    const parts = splitSentences(cand.narration);
    parts.pop();
    cand.narration = parts.join(' ');
    cand.subtitle = chunkSubtitle(cand.narration);
  }
}

function softLower(idea) {
  return /^(un|una|unos|unas|el|la|los|las|alguien|nadie|cuando|si|que|dos|tres|mi|tu|su)\b/i.test(idea) ? idea.charAt(0).toLowerCase() + idea.slice(1) : idea;
}

// ---------------------------------------------------------------- generación principal
export function surpriseOptions() {
  const n = 1 + Math.floor(Math.random() * 3);
  const ids = CATEGORIES.map((c) => c.id).sort(() => Math.random() - 0.5).slice(0, n);
  const durations = [15, 30, 45, 60];
  return { categories: ids, duration: durations[Math.floor(Math.random() * durations.length)] };
}

// Categorías hermanas (misma familia de tono): amplían la variedad sin salirse del género.
function sibsOf(id) {
  const fam = byId(CATEGORIES, id)?.family;
  return CATEGORIES.filter((c) => c.family === fam && c.id !== id).map((c) => c.id);
}
function withSiblings(id, rng, chance = 0.35) {
  const s = sibsOf(id);
  return s.length && rng() < chance ? pick(s, rng) : id;
}

function buildContext(opts, bible, rng, ep) {
  const cats = opts.categories.map((id) => byId(CATEGORIES, id)).filter(Boolean);
  const lead = cats[0];
  const pool = cats.map((c) => C[c.id]);
  const heroSrc = withSiblings(lead.id, rng);
  const placeSrc = withSiblings(lead.id, rng);
  const objSrc = withSiblings(lead.id, rng);
  const hero = bible?.hero || parseHero(pick(C[heroSrc].heroes, rng));
  const place = bible?.place || pick(C[placeSrc].places, rng);
  const obj = bible?.obj || pick(C[objSrc].objs, rng);
  const ctx = { hero, place, obj, ep, families: [...new Set(familiesOf(opts.categories))], mainFamily: lead.family, idea: cleanIdea(opts.idea) };
  return { ctx, cats, pool };
}

export function generateProject(opts) {
  const seedBase = opts.seed ?? newSeed();
  const dur = opts.duration || 30;
  let best = null;
  const sigCheck = opts.hasSignature || (() => false);

  for (let attempt = 0; attempt < 40; attempt++) {
    const seed = (seedBase + attempt * 7919) >>> 0;
    const rng = mulberry32(seed);
    const ep = opts.series?.ep || 1;
    const total = opts.series?.total || 1;
    const { ctx, cats, pool } = buildContext(opts, opts.bible, rng, ep);
    if (opts.recap) ctx.recap = opts.recap;

    const idea = cleanIdea(opts.idea);
    const pickSrc = () => withSiblings(cats[pickIdx(cats, rng)].id, rng);
    const hookSrc = pickSrc();
    const twistSrc = pickSrc();
    const endSrc = pickSrc();
    const hookI = pickIdx(C[hookSrc].hooks, rng);
    const twistI = pickIdx(C[twistSrc].twists, rng);
    const endI = pickIdx(C[endSrc].endings, rng);
    const ideaI = pickIdx(HOOK_FROM_IDEA, rng);

    ctx.hookText = idea ? fixText(HOOK_FROM_IDEA[ideaI].replace('{idea}', softLower(idea))) : fillTokens(C[hookSrc].hooks[hookI], ctx);
    ctx.twistText = fillTokens(C[twistSrc].twists[twistI], ctx);
    const isLast = ep >= total;
    const cliffI = pickIdx(CLIFFS, rng);
    ctx.endText = fillTokens(isLast ? C[endSrc].endings[endI] : CLIFFS[cliffI], ctx);
    ctx.cliff = !isLast;

    const sig = [opts.categories.join('+'), ctx.hero.name, ctx.place, ctx.obj, idea ? 'i' + ideaI : hookSrc + ':' + hookI, twistSrc + ':' + twistI, isLast ? endSrc + ':' + endI : 'c' + cliffI, ep].join('|');
    best = { seed, rng, ctx, cats, pool, sig, isLast };
    if (idea || !sigCheck(sig) || opts.bible) break; // con idea propia o episodios, no se bloquea por repetición
  }

  const { seed, rng, ctx, cats, pool, sig } = best;
  const roles = SEQ[dur] || SEQ[30];
  const secs = allocateSeconds(roles, dur);
  const used = {};
  ctx.escLeft = roles.filter((r) => r === 'esc').length + 1;
  const scenes = roles.map((r, i) => sceneFromRole(r, secs[i], ctx, rng, used));
  trimToFit(scenes, dur);
  scenes.forEach((s) => (s.imagePrompt = imagePromptFor(s, opts.style)));

  const platform = byId(PLATFORMS, opts.platform) || PLATFORMS[0];
  const style = byId(STYLES, opts.style) || STYLES[0];
  const famMain = F[ctx.mainFamily];
  const title0 = fillTokens(pick(famMain.titles, rng), ctx);
  const ep = opts.series?.ep || 1;
  const total = opts.series?.total || 1;
  const title = total > 1 ? `${title0} — Ep. ${ep}/${total}` : title0;

  const ctaTpl = total > 1 && ep < total ? 'Sígueme para el episodio {k2}.' : pick(famMain.cta, rng);
  const cta = fillTokens(ctaTpl.replace('{k2}', String(ep + 1)), ctx);

  const hashtags = buildHashtags(opts.categories, style, platform);
  const notes = [...new Set(opts.categories.map((c) => NOTES[c]).filter(Boolean))];
  const project = {
    id: opts.id || uid('p'),
    title,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    favorite: false,
    engine: 'local',
    categories: opts.categories.slice(0, 3),
    idea: cleanIdea(opts.idea),
    mode: opts.mode || 'categoria',
    duration: dur,
    platform: platform.id,
    style: style.id,
    seed,
    sig,
    bible: { hero: ctx.hero, place: ctx.place, obj: ctx.obj },
    series: total > 1 ? { id: opts.series.id || uid('r'), ep, total } : null,
    hook: ctx.hookText,
    cta,
    description: '',
    notes,
    hashtags,
    music: { mood: style.mood, volume: 0.35, hasTrack: false, trackName: '' },
    voice: { rate: 1, pitch: 1 },
    subStyle: { pos: 'mid', size: 'm', color: '#ffffff', hi: '#ffd24d' },
    recap: ctx.twistText,
    prevRecap: opts.recap || '',
    scenes,
  };
  project.description = buildDescription(project);
  return project;
}

export function buildHashtags(catIds, style, platform) {
  const slug = (s) => '#' + s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');
  const tags = [];
  catIds.forEach((id) => {
    const c = byId(CATEGORIES, id);
    if (c) tags.push(slug(c.name.split(' ').slice(0, 2).join('')), slug('historias' + c.name.split(' ')[0]));
  });
  tags.push('#historiascortas', '#storytime', slug(style.name));
  platform.tags.forEach((t) => tags.push(t));
  return [...new Set(tags)].slice(0, 12);
}

export function buildDescription(p) {
  const lines = [p.hook, '', p.cta];
  if (p.notes && p.notes.length) lines.push('', p.notes.join(' '));
  lines.push('', (p.hashtags || []).join(' '));
  return lines.join('\n');
}

// ---------------------------------------------------------------- regeneración parcial
function ctxFromProject(p, rng) {
  const cats = p.categories.map((id) => byId(CATEGORIES, id)).filter(Boolean);
  return {
    hero: p.bible.hero,
    place: p.bible.place,
    obj: p.bible.obj,
    ep: p.series?.ep || 1,
    families: [...new Set(familiesOf(p.categories))],
    mainFamily: cats[0]?.family || 'mystery',
    pool: p.categories.map((id) => C[id]).filter(Boolean),
    recap: p.prevRecap || '',
    idea: p.idea || '',
    escLeft: 0,
    rng,
  };
}

export function regenerateScene(p, sceneId) {
  const idx = p.scenes.findIndex((s) => s.id === sceneId);
  if (idx < 0) return null;
  const old = p.scenes[idx];
  const rng = mulberry32(newSeed());
  const ctx = ctxFromProject(p, rng);
  const pool = ctx.pool;
  const cat = pool[pickIdx(pool, rng)];
  ctx.hookText = p.hook;
  if (old.role === 'hook') {
    ctx.hookText = fillTokens(pick(cat.hooks, rng), ctx);
    p.hook = ctx.hookText;
  }
  ctx.twistText = fillTokens(pick(cat.twists, rng), ctx);
  const isLast = (p.series?.ep || 1) >= (p.series?.total || 1);
  ctx.endText = fillTokens(isLast ? pick(cat.endings, rng) : pick(CLIFFS, rng), ctx);
  ctx.cliff = !isLast;

  let fresh;
  for (let i = 0; i < 8; i++) {
    fresh = sceneFromRole(old.role, old.secs, ctx, rng, {});
    if (fresh.narration !== old.narration) break;
  }
  fresh.id = old.id;
  fresh.media = old.media;
  fresh.imagePrompt = imagePromptFor(fresh, p.style);
  p.scenes[idx] = fresh;
  p.description = buildDescription(p);
  return fresh;
}

export function regenerateTitle(p) {
  const rng = mulberry32(newSeed());
  const ctx = ctxFromProject(p, rng);
  const fam = F[ctx.mainFamily];
  let t;
  for (let i = 0; i < 6; i++) {
    t = fillTokens(pick(fam.titles, rng), ctx);
    if (!p.title.startsWith(t)) break;
  }
  p.title = p.series && p.series.total > 1 ? `${t} — Ep. ${p.series.ep}/${p.series.total}` : t;
}

export function regenerateCta(p) {
  const rng = mulberry32(newSeed());
  const ctx = ctxFromProject(p, rng);
  if (p.series && p.series.ep < p.series.total) return;
  p.cta = fillTokens(pick(F[ctx.mainFamily].cta, rng), ctx);
  p.description = buildDescription(p);
}

export function newBlankScene(p, role = 'extra') {
  const rng = mulberry32(newSeed());
  const ctx = ctxFromProject(p, rng);
  ctx.hookText = p.hook;
  ctx.twistText = '';
  ctx.endText = '';
  const s = sceneFromRole(role === 'twist' || role === 'ending' || role === 'hook' ? 'extra' : role, 4, ctx, rng, {});
  s.role = role === 'hook' ? 'extra' : role;
  s.imagePrompt = imagePromptFor(s, p.style);
  return s;
}

export function nextEpisodeOptions(p) {
  if (!p.series || p.series.ep >= p.series.total) return null;
  return {
    categories: p.categories,
    duration: p.duration,
    platform: p.platform,
    style: p.style,
    mode: p.mode,
    bible: p.bible,
    recap: p.recap,
    idea: '',
    series: { id: p.series.id, ep: p.series.ep + 1, total: p.series.total },
  };
}

// ---------------------------------------------------------------- derivados: ritmo, subtítulos, exportación
export const totalSecs = (p) => p.scenes.reduce((a, s) => a + (Number(s.secs) || 0), 0);

export function paceOf(scene) {
  const w = wordCount(scene.narration);
  return scene.secs > 0 ? w / scene.secs : 0;
}

export function cuesFor(p) {
  const cues = [];
  let t = 0;
  for (const s of p.scenes) {
    const lines = String(s.subtitle || '').split('\n').map((x) => x.trim()).filter(Boolean);
    const weights = lines.map((l) => Math.max(8, l.length));
    const sum = weights.reduce((a, b) => a + b, 0) || 1;
    let cur = t;
    lines.forEach((l, i) => {
      const dur = (weights[i] / sum) * s.secs;
      cues.push({ start: cur, end: cur + dur, text: l, scene: s.id });
      cur += dur;
    });
    t += s.secs;
  }
  return cues;
}

function srtTime(sec) {
  const ms = Math.round(sec * 1000);
  const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
  const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0');
  const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
  const r = String(ms % 1000).padStart(3, '0');
  return `${h}:${m}:${s},${r}`;
}

export function toSRT(p) {
  return cuesFor(p)
    .map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(Math.max(c.end - 0.02, c.start + 0.1))}\n${c.text}\n`)
    .join('\n');
}

export function fullNarration(p, withCta = false) {
  const base = p.scenes.map((s) => s.narration).join(' ');
  return withCta ? `${base} ${p.cta}` : base;
}

export function toText(p) {
  const style = byId(STYLES, p.style)?.name || p.style;
  const out = [];
  out.push(p.title.toUpperCase(), '='.repeat(Math.min(60, p.title.length)), '');
  out.push(`Plataforma: ${byId(PLATFORMS, p.platform)?.name} · Duración: ${totalSecs(p)} s · Estilo: ${style}`);
  out.push(`Categorías: ${p.categories.map((c) => byId(CATEGORIES, c)?.name).join(', ')}`, '');
  out.push('GANCHO (primeros 3 s)', p.hook, '');
  out.push('GUION', fullNarration(p), '');
  out.push('ESCENAS');
  p.scenes.forEach((s, i) => {
    out.push(`\n[${i + 1}] ${ROLE_LABELS[s.role] || s.role} · ${s.secs} s`);
    out.push(`Narración: ${s.narration}`);
    if (s.dialogue) out.push(`Diálogo: ${s.dialogue}`);
    out.push(`Visual: ${s.visual}`, `Cámara: ${s.camera}`, `Música: ${s.music}`, `Efectos: ${s.sfx}`);
    out.push(`Subtítulos:\n  ${String(s.subtitle).split('\n').join('\n  ')}`);
  });
  out.push('', 'LLAMADA A LA ACCIÓN', p.cta, '', 'DESCRIPCIÓN PARA PUBLICAR', p.description);
  return out.join('\n');
}

export function toMarkdown(p) {
  const style = byId(STYLES, p.style)?.name || p.style;
  const out = [`# ${p.title}`, '', `**Plataforma:** ${byId(PLATFORMS, p.platform)?.name} · **Duración:** ${totalSecs(p)} s · **Estilo:** ${style}`, '', `**Categorías:** ${p.categories.map((c) => byId(CATEGORIES, c)?.name).join(', ')}`, '', '## Gancho', p.hook, '', '## Guion', fullNarration(p), '', '## Escenas'];
  p.scenes.forEach((s, i) => {
    out.push('', `### ${i + 1}. ${ROLE_LABELS[s.role] || s.role} (${s.secs} s)`, `- **Narración:** ${s.narration}`);
    if (s.dialogue) out.push(`- **Diálogo:** ${s.dialogue}`);
    out.push(`- **Visual:** ${s.visual}`, `- **Cámara:** ${s.camera}`, `- **Música:** ${s.music}`, `- **Efectos:** ${s.sfx}`);
  });
  out.push('', '## Llamada a la acción', p.cta, '', '## Descripción para publicar', '', p.description);
  return out.join('\n');
}

// Estructura que se le pide a un modelo de texto y cómo se convierte en proyecto.
export function projectFromAI(raw, opts) {
  const dur = opts.duration || 30;
  const roles = SEQ[dur] || SEQ[30];
  const secs = allocateSeconds(roles, dur);
  const list = Array.isArray(raw.scenes) ? raw.scenes : [];
  if (list.length < 2) throw new Error('El modelo no devolvió escenas utilizables.');
  // si el modelo devolvió otra cantidad de escenas, se reparte el tiempo entre las recibidas
  const n = list.length;
  const rolesUsed = n === roles.length ? roles : list.map((_, i) => (i === 0 ? 'hook' : i === n - 1 ? 'ending' : i === 1 ? 'setup' : i === n - 2 ? 'twist' : 'esc'));
  const secsUsed = n === roles.length ? secs : allocateSeconds(rolesUsed, dur);
  const style = byId(STYLES, opts.style) || STYLES[0];
  const platform = byId(PLATFORMS, opts.platform) || PLATFORMS[0];
  const str = (v, d = '') => (typeof v === 'string' && v.trim() ? v.trim() : d);
  const scenes = list.map((r, i) => {
    const narration = str(r.narration || r.narracion);
    if (!narration) throw new Error(`La escena ${i + 1} no tiene narración.`);
    const s = mkScene(rolesUsed[i], secsUsed[i], {
      narration,
      dialogue: str(r.dialogue || r.dialogo),
      visual: str(r.visual, narration),
      camera: str(r.camera || r.camara, 'Plano fijo'),
      music: str(r.music || r.musica, style.mood),
      sfx: str(r.sfx || r.efectos, 'Ambiente'),
    });
    s.imagePrompt = imagePromptFor(s, opts.style);
    return s;
  });
  const hook = str(raw.hook || raw.gancho, scenes[0].narration);
  const cta = str(raw.cta, 'Sígueme para más historias.');
  const tags = Array.isArray(raw.hashtags) ? raw.hashtags.map((t) => '#' + String(t).replace(/^#/, '').replace(/\s+/g, '')).slice(0, 15) : buildHashtags(opts.categories, style, platform);
  const p = {
    id: opts.id || uid('p'),
    title: str(raw.title || raw.titulo, 'Historia sin título'),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    favorite: false,
    engine: 'ia',
    categories: opts.categories.slice(0, 3),
    idea: cleanIdea(opts.idea),
    mode: opts.mode || 'categoria',
    duration: dur,
    platform: platform.id,
    style: style.id,
    seed: 0,
    sig: '',
    bible: { hero: { name: 'Protagonista', g: 'm', desc: '' }, place: '', obj: '' },
    series: opts.series && opts.series.total > 1 ? { id: opts.series.id || uid('r'), ep: opts.series.ep, total: opts.series.total } : null,
    hook,
    cta,
    description: '',
    notes: [],
    hashtags: tags,
    music: { mood: style.mood, volume: 0.35, hasTrack: false, trackName: '' },
    voice: { rate: 1, pitch: 1 },
    subStyle: { pos: 'mid', size: 'm', color: '#ffffff', hi: '#ffd24d' },
    recap: scenes[Math.max(0, scenes.length - 3)].narration,
    scenes,
  };
  p.description = str(raw.description || raw.descripcion) || buildDescription(p);
  return p;
}

export const sceneRoles = (dur) => SEQ[dur] || SEQ[30];

export function catById(id) {
  return byId(CATEGORIES, id);
}

export const CONTENT_STATS = () => ({ categories: Object.keys(C).length });
