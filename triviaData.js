// Banco de preguntas de Trivia "Nivel Leyenda".
// Se arma de dos formas:
// 1) FIXED_QUESTIONS: preguntas curadas a mano (hechos históricos conocidos).
// 2) buildDynamicQuestions(CATEGORIES): genera automáticamente muchas más
//    preguntas del tipo "¿cuál de estos SÍ ganó...?" usando las listas de
//    campeones que ya existen en gameData.js (Balón de Oro, Mundiales,
//    Champions, Copa América) combinadas con nombres célebres que NUNCA
//    ganaron eso. Así el pool es grande y cada partida arma combinaciones
//    distintas de opciones, sin depender de ninguna IA externa.

function q(question, options, correctIndex) {
  return { question, options, correctIndex };
}

// En todas estas, la respuesta correcta está en el índice 0. El servidor
// se encarga de mezclar el orden de las opciones antes de mandarlas.
const FIXED_QUESTIONS = [
  q('¿Qué selección ganó la primera Copa del Mundo de la FIFA, en 1930?', ['Uruguay', 'Argentina', 'Brasil', 'Italia'], 0),
  q('¿Quién ganó el primer Balón de Oro de la historia, en 1956?', ['Stanley Matthews', 'Alfredo Di Stéfano', 'Raymond Kopa', 'Lev Yashin'], 0),
  q('¿Qué arquero es el único portero en ganar el Balón de Oro?', ['Lev Yashin', 'Gianluigi Buffon', 'Iker Casillas', 'Manuel Neuer'], 0),
  q('¿Qué club ganó las primeras cinco ediciones de la Copa de Europa, entre 1956 y 1960?', ['Real Madrid', 'AC Milan', 'Benfica', 'Barcelona'], 0),
  q('¿Cuántos Mundiales ganó Pelé con la selección de Brasil?', ['3', '2', '4', '1'], 0),
  q('¿A qué edad ganó Pelé su primer Mundial, en 1958?', ['17 años', '21 años', '19 años', '23 años'], 0),
  q('¿Qué jugador francés anotó 13 goles en un solo Mundial (1958), un récord que sigue vigente?', ['Just Fontaine', 'Michel Platini', 'Zinédine Zidane', 'Thierry Henry'], 0),
  q('¿En qué partido Diego Maradona marcó "La Mano de Dios" y el "Gol del Siglo" en el mismo encuentro?', ['Argentina vs Inglaterra, cuartos de final del Mundial 1986', 'Argentina vs Alemania, final del Mundial 1986', 'Argentina vs Brasil, octavos del Mundial 1990', 'Argentina vs Bélgica, semifinal del Mundial 1986'], 0),
  q('¿A qué club llevó Diego Maradona a ganar sus únicos dos títulos de la Serie A italiana?', ['Napoli', 'Juventus', 'AC Milan', 'Inter de Milán'], 0),
  q('¿Cuántos Balones de Oro ganó Johan Cruyff en su carrera?', ['3', '2', '4', '1'], 0),
  q('¿Qué selección era la gran favorita e invicta durante años, y perdió sorpresivamente la final del Mundial 1954 ante Alemania Occidental?', ['Hungría', 'Brasil', 'Uruguay', 'Inglaterra'], 0),
  q('¿Qué delantero húngaro se exilió tras el levantamiento de 1956 y se convirtió en referente del Real Madrid junto a Di Stéfano en los años 60?', ['Ferenc Puskás', 'Sándor Kocsis', 'Nándor Hidegkuti', 'Zoltán Czibor'], 0),
  q('¿Cómo era conocido el extraordinario extremo brasileño Manuel Francisco dos Santos, campeón del mundo en 1958 y 1962?', ['Garrincha', 'Zico', 'Sócrates', 'Jairzinho'], 0),
  q('¿En qué Mundial fue expulsado Zinédine Zidane en la final, por un cabezazo a Marco Materazzi?', ['2006', '1998', '2002', '2010'], 0),
  q('¿Qué selección ganó el Mundial de 1998 como local?', ['Francia', 'Brasil', 'Italia', 'Alemania'], 0),
  q('¿Qué dos países organizaron juntos el Mundial 2002, el primero disputado en Asia?', ['Corea del Sur y Japón', 'Japón y China', 'Corea del Sur y China', 'China y Japón'], 0),
  q('¿Cuántos goles anotó Ronaldo Nazário en el Mundial 2002, siendo el máximo goleador del torneo?', ['8', '6', '10', '7'], 0),
  q('¿En qué año se creó el premio Balón de Oro, de la revista France Football?', ['1956', '1950', '1960', '1965'], 0),
  q('¿Quién ganó el primer Balón de Oro femenino de la historia, en 2018?', ['Ada Hegerberg', 'Marta', 'Megan Rapinoe', 'Alexia Putellas'], 0),
  q('¿Qué jugadora brasileña ganó en seis ocasiones el premio a mejor futbolista del mundo de la FIFA?', ['Marta', 'Formiga', 'Cristiane', 'Debinha'], 0),
  q('¿Entre qué dos jugadores se repartieron todos los Balones de Oro entre 2008 y 2017?', ['Cristiano Ronaldo y Lionel Messi', 'Ronaldinho y Kaká', 'Cristiano Ronaldo y Kaká', 'Messi y Ronaldinho'], 0),
  q('¿Cuántos Balones de Oro consecutivos ganó Michel Platini a mediados de los 80?', ['3', '2', '4', '5'], 0),
  q('¿Con qué selección ganó Marco van Basten la Eurocopa de 1988, el mismo año que empezó a ganar Balones de Oro?', ['Países Bajos', 'Bélgica', 'Alemania Occidental', 'Dinamarca'], 0),
  q('¿Cuál es el club con más títulos de Copa Libertadores de la historia?', ['Independiente', 'Boca Juniors', 'River Plate', 'Peñarol'], 0),
  q('¿Qué país organizará el Mundial 2026, junto a Estados Unidos y Canadá?', ['México', 'Costa Rica', 'Guatemala', 'Cuba'], 0),
  q('¿Cuántas selecciones participarán en el Mundial 2026, el primero con este formato?', ['48', '32', '40', '64'], 0),
  q('¿A qué club se transfirió Neymar desde el Barcelona en 2017, en el traspaso más caro de la historia?', ['Paris Saint-Germain', 'Real Madrid', 'Manchester City', 'Juventus'], 0),
  q('¿Qué inglés jugó en la primera división de su país hasta los 50 años, un récord histórico de longevidad?', ['Stanley Matthews', 'Bobby Charlton', 'Gordon Banks', 'Bobby Moore'], 0),
  q('¿Cuántas Copas del Mundo ganó la selección de Brasil, la máxima ganadora histórica?', ['5', '4', '6', '3'], 0),
  q('¿Qué selección ganó el primer Mundial femenino de la FIFA, disputado en China en 1991?', ['Estados Unidos', 'Alemania', 'Noruega', 'China'], 0),
  q('¿Qué jugador ganó el Balón de Oro en 2005, además del premio FIFA World Player del mismo año?', ['Ronaldinho', 'Kaká', 'Fabio Cannavaro', 'Thierry Henry'], 0),
  q('¿Qué arquero fue titular en la conquista del Mundial 1994 con Brasil?', ['Cláudio Taffarel', 'Dida', 'Júlio César', 'Marcos'], 0),
  q('¿Qué capitán alemán levantó la Copa del Mundo en 1990, tras perder la final anterior en 1986?', ['Lothar Matthäus', 'Franz Beckenbauer', 'Jürgen Klinsmann', 'Rudi Völler'], 0),
  q('¿Qué selección ganó la Eurocopa de forma invicta y luego el Mundial dos años después, entre 2008 y 2010?', ['España', 'Alemania', 'Italia', 'Países Bajos'], 0),
  q('¿Cuántos títulos de Copa América sumaba Argentina tras ganar la edición de 2024, superando a Uruguay como máxima ganadora?', ['16', '15', '14', '17'], 0),
  q('¿En qué país se disputó la Copa América 2024, ganada por Argentina?', ['Estados Unidos', 'Brasil', 'Argentina', 'Chile'], 0),
  q('¿Qué selección ganó su primer título grande, la Eurocopa 2016, tras perder varias finales previas?', ['Portugal', 'Croacia', 'Países Bajos', 'Bélgica'], 0),
  q('¿Qué técnico argentino dirigió a la selección campeona del Mundial 2022 en Qatar?', ['Lionel Scaloni', 'Diego Maradona', 'Marcelo Bielsa', 'Jorge Sampaoli'], 0),
  q('¿A qué selección venció Argentina en la final del Mundial 2022, en una definición por penales?', ['Francia', 'Croacia', 'Marruecos', 'Países Bajos'], 0),
  q('¿Cuántos goles convirtió Lionel Messi en tiempo reglamentario y suplementario en la final del Mundial 2022 (sin contar la tanda de penales)?', ['2', '1', '3', '0'], 0)
];

// ---- Generador de preguntas dinámicas a partir de las categorías del Mentiroso ----

const NEVER_WON_MUNDIAL = ['México', 'Países Bajos', 'Bélgica', 'Hungría', 'Suecia', 'Portugal', 'Croacia', 'Polonia', 'Chile', 'Perú', 'Estados Unidos', 'Colombia'];
const NEVER_WON_CHAMPIONS = ['Atlético de Madrid', 'Valencia', 'Tottenham Hotspur', 'Arsenal', 'Bayer Leverkusen', 'Mónaco', 'Leeds United', 'Stade de Reims', 'Malmö FF', 'Olympique de Lyon'];
const NEVER_WON_BALON_DE_ORO = ['Pelé', 'Diego Maradona', 'Garrincha', 'Zico', 'Romário', 'Neymar', 'Thierry Henry', 'Xavi Hernández', 'Andrés Iniesta', 'Francesco Totti', 'Raúl González', 'David Beckham', 'Sergio Ramos'];
const NEVER_WON_COPA_AMERICA = ['México', 'Venezuela', 'Ecuador', 'Costa Rica', 'Honduras', 'Panamá', 'Jamaica', 'Estados Unidos'];

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateFromList(correctList, wrongPool, questionText) {
  return correctList.map(correct => {
    const wrongs = shuffle(wrongPool.filter(w => w !== correct)).slice(0, 3);
    return q(questionText, [correct, ...wrongs], 0);
  });
}

function buildDynamicQuestions(CATEGORIES) {
  const mundialItems = CATEGORIES.mundial.items.map(i => i.display);
  const championsItems = CATEGORIES.champions.items.map(i => i.display);
  const balonItems = CATEGORIES.balon_de_oro.items.map(i => i.display);
  const copaItems = CATEGORIES.copa_america.items.map(i => i.display);

  return [
    ...generateFromList(mundialItems, NEVER_WON_MUNDIAL, '¿Cuál de estas selecciones SÍ ganó una Copa del Mundo?'),
    ...generateFromList(championsItems, NEVER_WON_CHAMPIONS, '¿Cuál de estos clubes SÍ ganó la Champions League / Copa de Europa?'),
    ...generateFromList(balonItems, NEVER_WON_BALON_DE_ORO, '¿Cuál de estos futbolistas SÍ ganó el Balón de Oro?'),
    ...generateFromList(copaItems, NEVER_WON_COPA_AMERICA, '¿Cuál de estas selecciones SÍ ganó la Copa América?')
  ];
}

module.exports = { FIXED_QUESTIONS, buildDynamicQuestions, shuffle };
