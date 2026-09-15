# davismo

Sitio web de davismo con:
- **Registro real** de usuarios (backend en Node.js, sin errores fuera del entorno de Claude — ya no depende de `window.storage`, que solo existe dentro de los artifacts de Claude).
- **Mentiroso Futbolero online**: dos jugadores pueden jugar en tiempo real desde cualquier combinación de dispositivos (celu con PC, PC con PC, celu con celu), conectados al mismo servidor por internet. También se mantiene el modo local (hot-seat) en el mismo dispositivo.
- Los demás juegos (Álbum Davista, Impostor, Trivia) muestran el aviso **"En desarrollo, próximamente disponible."** al tocar "Jugar".

## Requisitos

- [Node.js](https://nodejs.org) 18 o superior instalado en la máquina/servidor donde lo vas a correr.

## Instalación y uso local

```bash
cd davismo
npm install
npm start
```

Esto levanta el servidor en `http://localhost:3000`. Abrí esa URL en el navegador.

Para probar el multijugador online necesitás abrirlo desde **dos dispositivos distintos** (o dos pestañas/navegadores) apuntando a la **misma URL**:

- Si jugás dos personas en la misma red Wi-Fi: en la PC que corre el servidor, fijate tu IP local (`ipconfig` en Windows o `ifconfig`/`ip a` en Mac/Linux, algo como `192.168.0.x`) y desde el celular entrá a `http://192.168.0.x:3000`.
- Si querés jugar con alguien fuera de tu red (por ejemplo, tu celu con datos, o un amigo en otra casa), necesitás desplegar el servidor en un hosting con IP pública (ver más abajo) para que ambos entren a la misma URL de internet.

## Cómo se juega el modo online

1. Un jugador toca **Jugar** en Mentiroso → **Online** → escribe su nombre → **Crear sala**. Le aparece un código de 5 caracteres.
2. El otro jugador (desde su celu o PC) entra al mismo sitio → **Jugar** → **Online** → **Unirme con código** → escribe el código.
3. Cuando los dos están conectados, el que creó la sala elige la categoría y el tiempo, y arranca la partida. El servidor valida cada apuesta y cada respuesta, así que no hay forma de hacer trampa viendo el código fuente.

## Desplegarlo en internet (para jugar desde cualquier lado)

Cualquier hosting que corra Node.js sirve, por ejemplo Render, Railway o un VPS propio:

1. Subí esta carpeta a un repositorio (GitHub, GitLab, etc.) o directamente al hosting.
2. Configurá el comando de build como `npm install` y el de arranque como `npm start` (o `node server.js`).
3. El hosting te va a dar una URL pública (`https://tu-app.onrender.com`, por ejemplo). Esa es la URL que comparten los dos jugadores.

## Estructura del proyecto

```
davismo/
├── server.js       # Backend: Express (API de registro) + Socket.io (Mentiroso online)
├── gameData.js      # Categorías y datos del juego (compartidos por el modo online)
├── package.json
├── data/
│   └── users.json   # Se crea solo; ahí quedan guardados los usuarios registrados
└── public/
    └── index.html   # Todo el frontend (estilos, registro, juegos, Mentiroso local + online)
```

## Notas sobre el registro

- Los datos se guardan en `data/users.json` (usuario, correo y fecha de alta). No se guardan contraseñas porque el formulario original no las pedía; si más adelante querés login con contraseña, avisame y lo sumamos.
- El nombre de usuario debe tener 3–20 caracteres (letras, números, guion o guion bajo) y no puede repetirse. El correo tampoco puede repetirse.
