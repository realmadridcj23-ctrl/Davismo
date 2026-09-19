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
  q('¿Cuántos goles convirtió Lionel Messi en tiempo reglamentario y suplementario en la final del Mundial 2022 (sin contar la tanda de penales)?', ['2', '1', '3', '0'], 0),

  // ---- Balón de Oro: cantidades y años exactos ----
  q('¿En qué años ganó Michel Platini sus tres Balones de Oro consecutivos?', ['1983, 1984 y 1985', '1982, 1983 y 1984', '1984, 1985 y 1986', '1985, 1986 y 1987'], 0),
  q('¿Cuántos Balones de Oro ganó Lionel Messi hasta la edición de 2023?', ['8', '7', '6', '9'], 0),
  q('¿Cuántos Balones de Oro ganó Cristiano Ronaldo en toda su carrera?', ['5', '4', '6', '3'], 0),
  q('¿En qué año ganó Cristiano Ronaldo su primer Balón de Oro?', ['2008', '2007', '2009', '2010'], 0),
  q('¿Qué jugador ganó el Balón de Oro 2023, tras consagrarse campeón del mundo con Argentina en Qatar 2022?', ['Lionel Messi', 'Kylian Mbappé', 'Erling Haaland', 'Karim Benzema'], 0),
  q('¿Qué delantero francés ganó el Balón de Oro 2022 por su temporada con el Real Madrid, antes de que Argentina fuera campeona del mundo?', ['Karim Benzema', 'Kylian Mbappé', 'Sadio Mané', 'Kevin De Bruyne'], 0),
  q('¿En qué década ganó Johan Cruyff sus tres Balones de Oro?', ['Los 70 (1971, 1973 y 1974)', 'Los 60 (1966, 1968 y 1969)', 'Los 80 (1981, 1983 y 1984)', 'Los 70 y 80 (1974, 1979 y 1984)'], 0),
  q('¿Qué defensor central terminó segundo en la votación del Balón de Oro 2019 detrás de Messi, algo muy poco común para su posición?', ['Virgil van Dijk', 'Sergio Ramos', 'Giorgio Chiellini', 'Raphaël Varane'], 0),

  // ---- Mundiales: datos duros ----
  q('¿Cuántos goles convirtió Diego Maradona en total durante el Mundial 1986, el torneo que ganó con Argentina?', ['5', '4', '6', '7'], 0),
  q('¿Qué jugador francés marcó un hat-trick en la final del Mundial 2022 y aun así no pudo evitar la derrota por penales?', ['Kylian Mbappé', 'Antoine Griezmann', 'Olivier Giroud', 'Ousmane Dembélé'], 0),
  q('¿Qué selección ganó el Mundial de Sudáfrica 2010, el primero disputado en suelo africano?', ['España', 'Países Bajos', 'Alemania', 'Brasil'], 0),
  q('¿Quién anotó el gol decisivo de España en la final del Mundial 2010 ante Países Bajos?', ['Andrés Iniesta', 'Xavi Hernández', 'David Villa', 'Fernando Torres'], 0),
  q('¿Quién anotó el gol de la victoria de Alemania en la final del Mundial 2014 ante Argentina, en tiempo suplementario?', ['Mario Götze', 'Thomas Müller', 'Miroslav Klose', 'André Schürrle'], 0),
  q('¿En qué Mundial se usó por primera vez el VAR (videoarbitraje) en la historia del torneo?', ['Rusia 2018', 'Brasil 2014', 'Catar 2022', 'Sudáfrica 2010'], 0),
  q('¿Qué selección asiática eliminó a Alemania, vigente campeona del mundo, en la primera ronda del Mundial 2018?', ['Corea del Sur', 'Japón', 'Arabia Saudita', 'Irán'], 0),
  q('¿Quién es el máximo goleador histórico de los Mundiales masculinos, con 16 goles entre 2002 y 2014?', ['Miroslav Klose', 'Ronaldo Nazário', 'Gerd Müller', 'Pelé'], 0),
  q('¿Qué jugador ostenta, junto a Cristiano Ronaldo, el récord de disputar 5 Mundiales, cerrando su racha en Qatar 2022 como capitán y campeón de Argentina?', ['Lionel Messi', 'Javier Mascherano', 'Ángel Di María', 'Rodrigo De Paul'], 0),
  q('¿Qué jugador turco convirtió el gol más rápido en la historia de los Mundiales, a los 11 segundos de iniciado el partido (Corea-Japón 2002)?', ['Hakan Şükür', 'Ronaldo Nazário', 'Davor Šuker', 'Miroslav Klose'], 0),
  q('¿En qué estadio se jugó la final del Mundial 1950, escenario del histórico "Maracanazo"?', ['Maracaná', 'Centenario', 'Monumental', 'Azteca'], 0),
  q('¿Qué selección venció a Brasil, como local y favorita, en el histórico "Maracanazo" de la final del Mundial 1950?', ['Uruguay', 'Argentina', 'Paraguay', 'Perú'], 0),

  // ---- Escudos, parches y por qué de las cosas ----
  q('¿Por qué el Ajax de Ámsterdam luce un parche con tres estrellas sobre su escudo?', ['Por haber ganado tres Copas de Europa consecutivas, entre 1971 y 1973', 'Por ser tricampeón de la liga holandesa', 'Por sus tres títulos de la Copa Intercontinental', 'Por cumplir 100 años de historia del club'], 0),
  q('¿Qué club luce una estrella dorada de honor por ser el máximo ganador histórico de la Champions League / Copa de Europa?', ['Real Madrid', 'AC Milan', 'Liverpool', 'Bayern Múnich'], 0),
  q('¿Cuántas Champions League / Copas de Europa ganó el AC Milan en toda su historia, la segunda marca histórica del torneo?', ['7', '6', '8', '5'], 0),

  // ---- Finales y protagonistas ----
  q('¿Qué entrenador dirigió al Liverpool en su histórica remontada de 0-3 a 3-3 ante el Milan en la final de Estambul 2005?', ['Rafael Benítez', 'Gérard Houllier', 'Jürgen Klopp', 'Kenny Dalglish'], 0),
  q('¿Qué club alemán ganó el triplete (liga, copa nacional y Champions) en la temporada 2019/20, con Hansi Flick como entrenador?', ['Bayern Múnich', 'Borussia Dortmund', 'RB Leipzig', 'Bayer Leverkusen'], 0),
  q('¿Qué club español ganó la Champions League de forma consecutiva tres veces entre 2016 y 2018, con Zinédine Zidane como entrenador?', ['Real Madrid', 'Barcelona', 'Atlético de Madrid', 'Sevilla'], 0),
  q('¿Qué selección ganó la Copa América 2021, disputada en Brasil, venciendo a los locales en la final jugada en el Maracaná?', ['Argentina', 'Uruguay', 'Chile', 'Colombia'], 0),
  q('¿Quién anotó el único gol de la final de la Copa América 2021 entre Argentina y Brasil?', ['Ángel Di María', 'Lionel Messi', 'Lautaro Martínez', 'Rodrigo De Paul'], 0),
  q('¿Qué selección ganó la primera Copa América de la historia, en 1916, cuando el torneo se llamaba Campeonato Sudamericano?', ['Uruguay', 'Argentina', 'Brasil', 'Chile'], 0),

  // ---- Transferencias y récords de mercado ----
  q('¿Cuál fue, en 2017, el traspaso más caro de la historia del fútbol hasta la fecha, el de Neymar del Barcelona al PSG?', ['222 millones de euros', '180 millones de euros', '200 millones de euros', '250 millones de euros'], 0),
  q('¿Qué jugador fue, en el verano de 2009, el fichaje más caro de la historia hasta ese momento, al pasar del Manchester United al Real Madrid?', ['Cristiano Ronaldo', 'Kaká', 'Zinédine Zidane', 'Gareth Bale'], 0),
  q('¿Qué joven delantero francés fichó por el PSG en 2017 (inicialmente a préstamo desde el Mónaco), en una operación que rondó los 180 millones de euros, la segunda más cara de la historia?', ['Kylian Mbappé', 'Antoine Griezmann', 'Ousmane Dembélé', 'Kingsley Coman'], 0),

  // ---- Estadios ----
  q('¿Cómo se llama el estadio del Real Madrid?', ['Santiago Bernabéu', 'Camp Nou', 'Wanda Metropolitano', 'Mestalla'], 0),
  q('¿Cómo se llama el estadio del FC Barcelona, uno de los más grandes de Europa?', ['Camp Nou', 'Santiago Bernabéu', 'Wanda Metropolitano', 'San Siro'], 0),
  q('¿Qué estadio italiano comparten el AC Milan y el Inter de Milán?', ['San Siro (Giuseppe Meazza)', 'Allianz Stadium', 'Stadio Olimpico', 'Artemio Franchi'], 0),

  // ---- Números y camisetas ----
  q('¿Qué número de camiseta usó Diego Maradona y hoy es un símbolo de la selección argentina?', ['10', '9', '7', '5'], 0),
  q('¿Qué número usó Pelé en el Mundial 1958, casi por casualidad ya que la federación brasileña asignó los números sin un criterio fijo?', ['10', '9', '11', '7'], 0),

  // ---- Entrenadores ----
  q('¿Qué entrenador llevó al FC Barcelona a ganar el histórico "sextete" de 6 títulos en la temporada 2008/09?', ['Pep Guardiola', 'Frank Rijkaard', 'Luis Enrique', 'Tito Vilanova'], 0),
  q('¿Cuántos títulos ganó el Barcelona de Guardiola en el histórico "sextete" de 2009?', ['6', '5', '7', '4'], 0),
  q('¿Qué entrenador italiano ganó la Champions League con dos clubes distintos, el Milan y en tres ocasiones el Real Madrid?', ['Carlo Ancelotti', 'Fabio Capello', 'Massimiliano Allegri', 'Antonio Conte'], 0),

  // ---- Clásicos y apodos ----
  q('¿Cómo se conoce popularmente al clásico entre River Plate y Boca Juniors?', ['El Superclásico', 'El Clásico', 'El Derbi della Madonnina', 'El Old Firm'], 0),
  q('¿Cómo se conoce al clásico entre Real Madrid y Barcelona?', ['El Clásico', 'El Derbi', 'El Superclásico', 'El Merengazo'], 0),
  q('¿Cómo se conoce al derbi entre AC Milan e Inter de Milán, disputado en el mismo estadio San Siro?', ['Derby della Madonnina', 'Derby d\'Italia', 'Derby del Nord', 'Derby Meneghino oficial'], 0),
  q('¿Cómo se conoce al clásico entre Juventus e Inter de Milán, dos de los clubes más ganadores de Italia?', ['Derby d\'Italia', 'Derby della Madonnina', 'Derby delle Rivali', 'Derby del Nord'], 0)
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

function generateFromList(correctList, wrongPool, questionTemplates) {
  return correctList.map(correct => {
    const wrongs = shuffle(wrongPool.filter(w => w !== correct)).slice(0, 3);
    const text = questionTemplates[Math.floor(Math.random() * questionTemplates.length)];
    return q(text, [correct, ...wrongs], 0);
  });
}

const MUNDIAL_TEMPLATES = [
  '¿Cuál de estas selecciones SÍ ganó una Copa del Mundo?',
  '¿Cuál de estos países es campeón mundial de fútbol?',
  'De estas selecciones, ¿cuál levantó alguna vez la Copa del Mundo?'
];
const CHAMPIONS_TEMPLATES = [
  '¿Cuál de estos clubes SÍ ganó la Champions League / Copa de Europa?',
  '¿Cuál de estos equipos es campeón de Europa?',
  'De estos clubes, ¿cuál tiene una Champions League en su historia?'
];
const BALON_TEMPLATES = [
  '¿Cuál de estos futbolistas SÍ ganó el Balón de Oro?',
  '¿Cuál de estos jugadores tiene un Balón de Oro en su palmarés?',
  'De estos nombres, ¿cuál ganó alguna vez el Balón de Oro?'
];
const COPA_AMERICA_TEMPLATES = [
  '¿Cuál de estas selecciones SÍ ganó la Copa América?',
  '¿Cuál de estos países es campeón de la Copa América?',
  'De estas selecciones, ¿cuál levantó alguna vez la Copa América?'
];

function buildDynamicQuestions(CATEGORIES) {
  const mundialItems = CATEGORIES.mundial.items.map(i => i.display);
  const championsItems = CATEGORIES.champions.items.map(i => i.display);
  const balonItems = CATEGORIES.balon_de_oro.items.map(i => i.display);
  const copaItems = CATEGORIES.copa_america.items.map(i => i.display);

  return [
    ...generateFromList(mundialItems, NEVER_WON_MUNDIAL, MUNDIAL_TEMPLATES),
    ...generateFromList(championsItems, NEVER_WON_CHAMPIONS, CHAMPIONS_TEMPLATES),
    ...generateFromList(balonItems, NEVER_WON_BALON_DE_ORO, BALON_TEMPLATES),
    ...generateFromList(copaItems, NEVER_WON_COPA_AMERICA, COPA_AMERICA_TEMPLATES)
  ];
}

module.exports = { FIXED_QUESTIONS, buildDynamicQuestions, shuffle };
