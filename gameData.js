// Datos de categorías compartidos con el cliente (mismo contenido que public/index.html)

function mk(display, aliasesCsv){
    const aliases = (aliasesCsv + ',' + display).split(',').map(a => a.trim()).filter(Boolean);
    return { display: display, aliases: aliases };
  }

  const CATEGORIES = {
    balon_de_oro: {
      label: 'Balón de Oro',
      short: 'balón de oro',
      hint: 'Futbolistas que ganaron el Balón de Oro masculino (1956–2025).',
      items: [
        mk('Stanley Matthews','matthews'),
        mk('Alfredo Di Stéfano','di stefano,alfredo di stefano'),
        mk('Raymond Kopa','kopa'),
        mk('Luis Suárez Miramontes','luis suarez,suarez miramontes'),
        mk('Omar Sívori','sivori'),
        mk('Josef Masopust','masopust'),
        mk('Lev Yashin','yashin'),
        mk('Denis Law','law'),
        mk('Eusébio','eusebio'),
        mk('Bobby Charlton','charlton'),
        mk('Flórián Albert','florian albert,albert'),
        mk('George Best','best'),
        mk('Gianni Rivera','rivera'),
        mk('Gerd Müller','gerd muller,muller'),
        mk('Johan Cruyff','cruyff'),
        mk('Franz Beckenbauer','beckenbauer'),
        mk('Oleg Blokhin','blokhin'),
        mk('Allan Simonsen','simonsen'),
        mk('Kevin Keegan','keegan'),
        mk('Karl-Heinz Rummenigge','rummenigge,karl heinz rummenigge'),
        mk('Paolo Rossi','rossi'),
        mk('Michel Platini','platini'),
        mk('Igor Belanov','belanov'),
        mk('Ruud Gullit','gullit'),
        mk('Marco van Basten','van basten'),
        mk('Lothar Matthäus','lothar matthaus,matthaus'),
        mk('Jean-Pierre Papin','papin,jean pierre papin'),
        mk('Roberto Baggio','baggio'),
        mk('Hristo Stoichkov','stoichkov'),
        mk('George Weah','weah'),
        mk('Matthias Sammer','sammer'),
        mk('Ronaldo Nazário','ronaldo nazario,ronaldo fenomeno,el fenomeno,r9'),
        mk('Zinédine Zidane','zinedine zidane,zidane'),
        mk('Rivaldo',''),
        mk('Luís Figo','luis figo,figo'),
        mk('Michael Owen','owen'),
        mk('Pavel Nedvěd','pavel nedved,nedved'),
        mk('Andriy Shevchenko','shevchenko'),
        mk('Ronaldinho','ronaldinho gaucho'),
        mk('Fabio Cannavaro','cannavaro'),
        mk('Kaká','kaka'),
        mk('Cristiano Ronaldo','cristiano,cr7'),
        mk('Lionel Messi','messi,leo messi'),
        mk('Luka Modrić','luka modric,modric'),
        mk('Karim Benzema','benzema'),
        mk('Rodri','rodrigo hernandez,rodri hernandez'),
        mk('Ousmane Dembélé','ousmane dembele,dembele')
      ]
    },
    mundial: {
      label: 'Campeones del Mundo',
      short: 'campeones del Mundial',
      hint: 'Selecciones que ganaron la Copa Mundial de la FIFA (1930–2026).',
      items: [
        mk('Uruguay',''),
        mk('Italia',''),
        mk('Alemania','alemania occidental,rfa'),
        mk('Brasil',''),
        mk('Inglaterra',''),
        mk('Argentina',''),
        mk('Francia',''),
        mk('España','')
      ]
    },
    champions: {
      label: 'Campeones de la Champions',
      short: 'campeones de la Champions League',
      hint: 'Clubes que ganaron la Copa de Europa / Champions League (1956–2026).',
      items: [
        mk('Real Madrid',''),
        mk('AC Milan','milan'),
        mk('Liverpool',''),
        mk('Bayern Múnich','bayern munich,bayern'),
        mk('Ajax',''),
        mk('Barcelona','fc barcelona,barca'),
        mk('Manchester United','man united,man utd'),
        mk('Inter de Milán','inter,internazionale,inter milan'),
        mk('Nottingham Forest',''),
        mk('Juventus',''),
        mk('Benfica',''),
        mk('Porto','fc porto,oporto'),
        mk('Chelsea',''),
        mk('Manchester City','man city'),
        mk('Celtic',''),
        mk('Feyenoord',''),
        mk('PSV Eindhoven','psv'),
        mk('Aston Villa',''),
        mk('Hamburgo','hamburger sv,hsv'),
        mk('Steaua Bucarest','steaua'),
        mk('Estrella Roja de Belgrado','estrella roja,red star belgrade,crvena zvezda'),
        mk('Olympique de Marsella','marsella,om'),
        mk('Borussia Dortmund','dortmund,bvb'),
        mk('Paris Saint-Germain','psg,paris sg')
      ]
    },
    copa_america: {
      label: 'Campeones de la Copa América',
      short: 'campeones de la Copa América',
      hint: 'Selecciones que ganaron la Copa América.',
      items: [
        mk('Uruguay',''),
        mk('Argentina',''),
        mk('Brasil',''),
        mk('Paraguay',''),
        mk('Perú','peru'),
        mk('Bolivia',''),
        mk('Chile',''),
        mk('Colombia','')
      ]
    }
  };

function normalize(str){
  return (str || '')
    .toString()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

<<<<<<< HEAD
// Lista de nombres de referencia (solo como contexto/ejemplos para la IA,
// YA NO se usa para validar de forma estricta: la IA puede aceptar
// respuestas correctas que no estén en esta lista, y las respuestas de
// esta lista siguen sirviendo como ejemplos para que no invente cosas).
function referenceNames(key){
  const cat = CATEGORIES[key];
  if(!cat) return [];
  return cat.items.map(i => i.display);
}

module.exports = { CATEGORIES, normalize, referenceNames };
=======
module.exports = { CATEGORIES, normalize };
>>>>>>> 36a0ca5f9d7d8cc4c548aa78946ca83919888375
