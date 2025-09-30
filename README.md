# Canal en vivo 24/7 con IA (Twitch + YouTube)

Este proyecto crea un canal 24/7 con programación por bloques (cada 30 o 60 minutos), donde una IA conduce, habla con el chat, narra una radionovela por capítulos y pone música. El sistema orquesta OBS para emitir a Twitch y YouTube, genera voz TTS, lee y responde comentarios, y alterna escenas/medios según la programación.

## Arquitectura

- OBS Studio (streaming, escenas y fuentes) con WebSocket habilitado.
- Orquestador en Node.js que:
  - Programa bloques (charla, música, radionovela, pausas) con `node-schedule`.
  - Genera guiones y respuestas con OpenAI.
  - Genera audio TTS (voz) y lo reproduce en OBS como Media Source.
  - Lee chat de Twitch (tmi.js) y de YouTube (youtube-chat o Google API) y modera.
  - Maneja una playlist de música de fondo y transiciones.
- Persistencia simple (JSON) para estado: capítulo actual de la radionovela, historial de temas, colas.

## Requisitos previos

1. Software
   - Windows 10/11.
   - Node.js 20+ (https://nodejs.org) y npm.
   - OBS Studio 29+ (https://obsproject.com/).
2. OBS WebSocket
   - OBS 29+ ya trae WebSocket. Habilitarlo en:
     - Herramientas > OBS WebSocket Server Settings.
     - Puerto: 4455 (por defecto) o el que prefieras.
     - Establece una contraseña segura.
   - En Ajustes de las fuentes Media Source, activa "Reiniciar reproducción cuando el archivo cambie".
3. Escenas/fuentes en OBS (mínimo viable)
   - Escena: "Radio".
   - Fuentes dentro de "Radio":
     - "Voz": Media Source apuntando a un archivo de audio (ej: ./runtime/voice/latest.mp3). Marcar "Reiniciar cuando el archivo cambie" y "Cerrar archivo cuando no esté activo".
     - "Musica": VLC Video Source o Media Source con una carpeta ./assets/music/ (música sin copyright o con licencia). Si usas VLC Source, activa la opción de lista de reproducción.
   - Opcional: una fuente de imagen/animación del canal.
4. Cuentas y claves
   - OpenAI API Key para guiones y TTS.
   - Twitch:
     - Usuario del bot (puede ser tu usuario) y OAuth Token (https://twitchapps.com/tmi/).
     - Canal(es) al que conectarse.
   - YouTube:
     - API Key y Live Chat ID del stream, o credenciales OAuth si prefieres.
   - Datos de OBS WebSocket: host, puerto y contraseña.

## Configuración del proyecto

1. Clonar este repo o usar la carpeta actual.
2. Instalar Node.js (si no lo tienes). Verifica con:
   - cmd: node -v y npm -v
3. Instalar dependencias (cuando agreguemos package.json):
   - npm install
4. Copia .env.example a .env y completa valores:
   - OPENAI_API_KEY=...
   - TWITCH_USERNAME=...
   - TWITCH_OAUTH_TOKEN=oauth:...
   - TWITCH_CHANNELS=#canal1,#canal2
   - YT_API_KEY=...
   - YT_LIVE_CHAT_ID=...
   - OBS_HOST=127.0.0.1
   - OBS_PORT=4455
   - OBS_PASSWORD=...
   - VOICE_MODEL=gpt-4o-mini-tts
   - TEXT_MODEL=gpt-4o-mini

## Programación (Scheduler)

Se define una grilla con bloques de 30 o 60 minutos. Ejemplo:

- :00 a :10 – Apertura y charla con el chat (temas del día, respuestas).
- :10 a :25 – Radionovela: capítulo/escena del día (narración TTS + SFX opcionales).
- :25 a :30 – Música.
- :30 a :40 – Entrevista generada (IA hace Q&A ficticio o responde preguntas reales del chat).
- :40 a :55 – Música + comentarios destacados del chat.
- :55 a :00 – Cierre del bloque y adelanto del próximo.

El orquestador cambia escenas o activa/desactiva fuentes, y va reemplazando el archivo de voz para que OBS lo reproduzca automáticamente.

## Flujo de ejecución

1. Arranque
   - Conecta a OBS WebSocket.
   - Conecta a Twitch y YouTube Chat.
   - Carga estado (capítulo actual) y playlist.
2. Bucle 24/7
   - Scheduler lanza tareas a tiempos definidos.
   - Para cada segmento genera guion (OpenAI), convierte a TTS, guarda en ./runtime/voice/latest.mp3 y notifica a OBS para reproducir.
   - Escucha chat, filtra spam y responde mensajes relevantes en tiempo real.
   - Alterna música y voz para no superponer demasiado el volumen (sidechain simple: bajar música cuando habla la voz).
3. Persistencia
   - Guarda progreso de la radionovela y estadísticas en ./data/.

## Moderación y cumplimiento

- Filtra lenguaje ofensivo y temas sensibles.
- Respeta TOS de Twitch y YouTube.
- Usa música con derechos adecuados (sin copyright o con licencia).

## Estructura prevista

- package.json
- .env.example
- src/
  - index.js (orquestador principal)
  - services/
    - obs.js (conexión y control de fuentes/escenas)
    - twitch.js (lectura y respuestas en chat Twitch)
    - youtube.js (lectura y respuestas en chat YouTube)
    - tts.js (texto a voz)
    - content.js (prompts y generación de guiones/diálogos)
    - schedule.js (definición de grilla)
    - playlist.js (música)
  - utils/
    - logger.js
- data/
  - state.json
- assets/
  - music/
- runtime/
  - voice/latest.mp3

Para simplificar el primer MVP, comenzaremos con un único archivo `src/index.js` que hace todo, y luego modularizamos.

## Comandos (cuando esté el package.json)

- Desarrollo: npm run dev (con nodemon)
- Producción: npm start

## Próximos pasos

1. Crear package.json con dependencias (OBS WebSocket, tmi.js, youtube-chat, openai, node-schedule, fs-extra, dotenv).
2. Añadir .env.example y carpetas data/, assets/music/, runtime/voice/.
3. Implementar src/index.js con:
   - Conexión a OBS.
   - Conexión a Twitch/YT chat.
   - Scheduler con bloques cada 30/60 min.
   - Generación de guión y TTS por segmento.
   - Reproducción en OBS (actualizar archivo de voz) y control de música.
4. Pruebas locales con OBS y ajuste de volúmenes.
5. Modularización en services/.

## Troubleshooting

- "npm no reconocido": instala Node.js desde nodejs.org y reinicia la terminal.
- OBS no conecta: revisa puerto/contraseña del WebSocket y firewall.
- No suena la voz: verifica la ruta del archivo y la opción de reinicio al cambiar archivo en la fuente de OBS.
- Chat de YouTube: requiere tener un stream en vivo activo y obtener el Live Chat ID.

## Aviso

Este repo no incluye música ni voces. Debes añadir tus pistas a assets/music/ y configurar tu clave de OpenAI para TTS y textos. Este sistema automatiza, pero tú eres responsable por el contenido emitido y cumplimiento de licencias y TOS.
