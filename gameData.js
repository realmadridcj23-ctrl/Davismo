// Datos de categorías compartidos con el cliente (mismo contenido que public/index.html)
// Cada jugador/selección/club tiene una lista de alias (apodos, apellidos solos,
// formas cortas) para que el chequeo LOCAL (sin IA) reconozca cómo la gente
// realmente escribe los nombres al jugar.

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
        mk('Alfredo Di Stéfano','di stefano,alfredo di stefano,la saeta rubia'),
        mk('Raymond Kopa','kopa'),
        mk('Luis Suárez Miramontes','luis suarez,suarez miramontes,suarez miramontes luis'),
        mk('Omar Sívori','sivori'),
        mk('Josef Masopust','masopust'),
        mk('Lev Yashin','yashin,la arana negra'),
        mk('Denis Law','law'),
        mk('Eusébio','eusebio,la pantera negra'),
        mk('Bobby Charlton','charlton'),
        mk('Flórián Albert','florian albert,albert'),
        mk('George Best','best'),
        mk('Gianni Rivera','rivera'),
        mk('Gerd Müller','gerd muller,muller,der bomber'),
        mk('Johan Cruyff','cruyff'),
        mk('Franz Beckenbauer','beckenbauer,kaiser,el kaiser,der kaiser'),
        mk('Oleg Blokhin','blokhin'),
        mk('Allan Simonsen','simonsen'),
        mk('Kevin Keegan','keegan'),
        mk('Karl-Heinz Rummenigge','rummenigge,karl heinz rummenigge'),
        mk('Paolo Rossi','rossi,pablito'),
        mk('Michel Platini','platini'),
        mk('Igor Belanov','belanov'),
        mk('Ruud Gullit','gullit'),
        mk('Marco van Basten','van basten,basten'),
        mk('Lothar Matthäus','lothar matthaus,matthaus'),
        mk('Jean-Pierre Papin','papin,jean pierre papin'),
        mk('Roberto Baggio','baggio,il divin codino,codino'),
        mk('Hristo Stoichkov','stoichkov'),
        mk('George Weah','weah'),
        mk('Matthias Sammer','sammer'),
        mk('Ronaldo Nazário','ronaldo nazario,ronaldo fenomeno,el fenomeno,r9,ronaldo'),
        mk('Zinédine Zidane','zinedine zidane,zidane,zizou'),
        mk('Rivaldo',''),
        mk('Luís Figo','luis figo,figo'),
        mk('Michael Owen','owen'),
        mk('Pavel Nedvěd','pavel nedved,nedved'),
        mk('Andriy Shevchenko','shevchenko,sheva'),
        mk('Ronaldinho','ronaldinho gaucho,gaucho'),
        mk('Fabio Cannavaro','cannavaro'),
        mk('Kaká','kaka'),
        mk('Cristiano Ronaldo','cristiano,cr7,el bicho,cristiano ronaldo dos santos aveiro,cr'),
        mk('Lionel Messi','messi,leo messi,leo,la pulga,lio messi'),
        mk('Luka Modrić','luka modric,modric'),
        mk('Karim Benzema','benzema,km9'),
        mk('Rodri','rodrigo hernandez,rodri hernandez'),
        mk('Ousmane Dembélé','ousmane dembele,dembele')
      ]
    },
    mundial: {
      label: 'Campeones del Mundo',
      short: 'campeones del Mundial',
      hint: 'Selecciones que ganaron la Copa Mundial de la FIFA (1930–2026).',
      items: [
        mk('Uruguay','la celeste'),
        mk('Italia','azzurri,gli azzurri'),
        mk('Alemania','alemania occidental,rfa,la mannschaft,mannschaft'),
        mk('Brasil','la canarinha,canarinha,verdeamarela'),
        mk('Inglaterra','los tres leones,three lions'),
        mk('Argentina','la albiceleste,seleccion argentina'),
        mk('Francia','les bleus'),
        mk('España','la roja,la furia roja')
      ]
    },
    champions: {
      label: 'Campeones de la Champions',
      short: 'campeones de la Champions League',
      hint: 'Clubes que ganaron la Copa de Europa / Champions League (1956–2026).',
      items: [
        mk('Real Madrid','madrid,merengues,los blancos'),
        mk('AC Milan','milan,rossoneri'),
        mk('Liverpool','los reds,liverpool fc'),
        mk('Bayern Múnich','bayern munich,bayern,die roten'),
        mk('Ajax','ajax amsterdam'),
        mk('Barcelona','fc barcelona,barca,blaugrana,culers'),
        mk('Manchester United','man united,man utd,red devils,diablos rojos'),
        mk('Inter de Milán','inter,internazionale,inter milan,nerazzurri'),
        mk('Nottingham Forest','forest'),
        mk('Juventus','juve,la vecchia signora,bianconeri'),
        mk('Benfica','aguias,las aguilas'),
        mk('Porto','fc porto,oporto'),
        mk('Chelsea','the blues,los blues'),
        mk('Manchester City','man city,citizens'),
        mk('Celtic','celtic fc,los bhoys'),
        mk('Feyenoord','feyenoord rotterdam'),
        mk('PSV Eindhoven','psv'),
        mk('Aston Villa','villa'),
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
        mk('Uruguay','la celeste'),
        mk('Argentina','la albiceleste'),
        mk('Brasil','la canarinha,canarinha'),
        mk('Paraguay','la albirroja'),
        mk('Perú','peru,la blanquirroja'),
        mk('Bolivia','la verde'),
        mk('Chile','la roja'),
        mk('Colombia','los cafeteros,la tricolor')
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

// Lista de nombres de referencia (solo como contexto/ejemplos, por ejemplo
// para mostrar pistas en pantalla).
function referenceNames(key){
  const cat = CATEGORIES[key];
  if(!cat) return [];
  return cat.items.map(i => i.display);
}

module.exports = { CATEGORIES, normalize, referenceNames };
