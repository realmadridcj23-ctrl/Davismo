# davismo

Sitio web de davismo con:
- **Registro real** de usuarios (backend en Node.js, sin errores fuera del entorno de Claude — ya no depende de `window.storage`, que solo existe dentro de los artifacts de Claude).
- **Mentiroso Futbolero online**: dos jugadores pueden jugar en tiempo real desde cualquier combinación de dispositivos (celu con PC, PC con PC, celu con celu), conectados al mismo servidor por internet. También se mantiene el modo local (hot-seat) en el mismo dispositivo.
- **Verificación de respuestas por IA real** (Claude, de Anthropic): cada respuesta que dice un jugador en el Mentiroso (modo local u online) se manda al modelo, que juzga si es correcta para la categoría usando su conocimiento real de fútbol — no una lista fija cerrada. Acepta apodos, apellidos solos, errores de tipeo menores, etc.
- **Asistente de IA de davismo**: botón "Preguntarle a la IA" bien visible en el inicio (y también en el menú de arriba) que abre un chat donde le podés preguntar lo que quieras (fútbol, del sitio, o cualquier otra cosa), además de una pestaña para revisar una respuesta puntual del Mentiroso.
- Los demás juegos (Álbum Davista, Impostor, Trivia) muestran el aviso **"En desarrollo, próximamente disponible."** al tocar "Jugar".

## Requisitos

- [Node.js](https://nodejs.org) 18 o superior instalado en la máquina/servidor donde lo vas a correr.
- Una clave de API de Anthropic (gratis para probar) para que funcionen el Asistente y la verificación de respuestas — sin esto, el resto del sitio (registro, Mentiroso en modo "todo vale sin IA" queda deshabilitado) sigue funcionando, pero esas dos funciones muestran un aviso pidiendo configurarla.

## Instalación y uso local

```bash
cd davismo
npm install
cp .env.example .env
# abrí .env y pegá tu ANTHROPIC_API_KEY (la sacás gratis en https://console.anthropic.com/)
npm start
```

Esto levanta el servidor en `http://localhost:3000`. Abrí esa URL en el navegador.

### Configurar la IA (Asistente + verificación de respuestas)

1. Entrá a [console.anthropic.com](https://console.anthropic.com/), creá una cuenta y generá una API Key (sección "API Keys").
2. Copiá `.env.example` a `.env` en la raíz del proyecto.
3. Pegá la clave: `ANTHROPIC_API_KEY=sk-ant-...`
4. Reiniciá el servidor (`npm start`).

Si estás en un hosting (Render, Railway, etc.), en vez de un archivo `.env` normalmente configurás la variable de entorno `ANTHROPIC_API_KEY` desde el panel del hosting.

Sin esta clave configurada:
- El botón "Preguntarle a la IA" muestra un mensaje explicando que falta la clave.
- En el Mentiroso, al llegar a la pantalla donde hay que nombrar las respuestas, va a fallar la verificación con el mismo aviso (podés seguir jugando apuestas, pero no se puede validar quién nombra bien).

Para probar el multijugador online necesitás abrirlo desde **dos dispositivos distintos** (o dos pestañas/navegadores) apuntando a la **misma URL**:

- Si jugás dos personas en la misma red Wi-Fi: en la PC que corre el servidor, fijate tu IP local (`ipconfig` en Windows o `ifconfig`/`ip a` en Mac/Linux, algo como `192.168.0.x`) y desde el celular entrá a `http://192.168.0.x:3000`.
- Si querés jugar con alguien fuera de tu red (por ejemplo, tu celu con datos, o un amigo en otra casa), necesitás desplegar el servidor en un hosting con IP pública (ver más abajo) para que ambos entren a la misma URL de internet.

## Cómo se juega el modo online

1. Un jugador toca **Jugar** en Mentiroso → **Online** → escribe su nombre → **Crear sala**. Le aparece un código de 5 caracteres.
2. El otro jugador (desde su celu o PC) entra al mismo sitio → **Jugar** → **Online** → **Unirme con código** → escribe el código.
3. Cuando los dos están conectados, el que creó la sala elige la categoría y el tiempo, y arranca la partida. Cada respuesta que se escribe durante un desafío se manda al servidor, que la manda a su vez a la IA para juzgarla; mientras tanto se muestra "Revisando con la IA...". El servidor decide quién ganó cada ronda, así que no hay forma de hacer trampa viendo el código fuente.

## Desplegarlo en internet (para jugar desde cualquier lado)

Cualquier hosting que corra Node.js sirve, por ejemplo Render, Railway o un VPS propio:

1. Subí esta carpeta a un repositorio (GitHub, GitLab, etc.) o directamente al hosting.
2. Configurá el comando de build como `npm install` y el de arranque como `npm start` (o `node server.js`).
3. Configurá la variable de entorno `ANTHROPIC_API_KEY` en el panel del hosting (no subas el archivo `.env` a un repo público; ya está en `.gitignore`).
4. El hosting te va a dar una URL pública (`https://tu-app.onrender.com`, por ejemplo). Esa es la URL que comparten los dos jugadores.

## Estructura del proyecto

```
davismo/
├── server.js        # Backend: Express (registro + IA) + Socket.io (Mentiroso online)
├── gameData.js       # Categorías y datos de referencia del juego (contexto para la IA)
├── package.json
├── .env.example      # Plantilla de variables de entorno (copiar a .env)
├── data/
│   └── users.json    # Se crea solo; ahí quedan guardados los usuarios registrados
└── public/
    └── index.html    # Todo el frontend (estilos, registro, asistente, juegos, Mentiroso local + online)
```

## Notas sobre el registro

- Los datos se guardan en `data/users.json` (usuario, correo y fecha de alta). No se guardan contraseñas porque el formulario original no las pedía; si más adelante querés login con contraseña, avisame y lo sumamos.
- El nombre de usuario debe tener 3–20 caracteres (letras, números, guion o guion bajo) y no puede repetirse. El correo tampoco puede repetirse.

## Notas sobre la IA

- Se usa la API de Anthropic (Claude) directamente desde el servidor, con `fetch` nativo de Node 18+ (no hace falta ninguna librería extra para eso).
- Cada verificación de respuesta y cada mensaje del asistente cuesta una llamada a la API (con costo asociado a tu cuenta de Anthropic, aunque el uso de prueba suele entrar en el crédito gratis inicial). Si el tráfico del sitio crece mucho, tené en cuenta el consumo.
- El modelo usado por defecto es `claude-sonnet-5`; se puede cambiar con la variable de entorno opcional `ANTHROPIC_MODEL`.

