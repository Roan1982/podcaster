import 'dotenv/config';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import schedule from 'node-schedule';
import OBSWebSocket from 'obs-websocket-js';
import tmi from 'tmi.js';
import { YoutubeChat } from 'youtube-chat';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const DATA_DIR = path.join(__dirname, '..', 'data');
const RUNTIME_DIR = path.join(__dirname, '..', 'runtime');
const VOICE_DIR = path.join(RUNTIME_DIR, 'voice');
const VOICE_FILE = path.join(VOICE_DIR, 'latest.mp3');
const MUSIC_DIR = path.join(__dirname, '..', 'assets', 'music');

await fs.ensureDir(DATA_DIR);
await fs.ensureDir(VOICE_DIR);
await fs.ensureDir(MUSIC_DIR);

// ENV
const {
  OPENAI_API_KEY,
  TEXT_MODEL = 'gpt-4o-mini',
  VOICE_MODEL = 'gpt-4o-mini-tts',
  TWITCH_USERNAME,
  TWITCH_OAUTH_TOKEN,
  TWITCH_CHANNELS,
  YT_API_KEY,
  YT_LIVE_CHAT_ID,
  OBS_HOST = '127.0.0.1',
  OBS_PORT = 4455,
  OBS_PASSWORD,
  LANG = 'es'
} = process.env;

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

function log(...args) {
  const ts = new Date().toISOString();
  console.log(`[${ts}]`, ...args);
}

// OBS Controller
const obs = new OBSWebSocket();
async function connectOBS() {
  try {
    await obs.connect(`ws://${OBS_HOST}:${OBS_PORT}`, OBS_PASSWORD ? { password: OBS_PASSWORD } : undefined);
    log('OBS conectado');
  } catch (e) {
    log('OBS error de conexión:', e.message);
  }
}

// TTS
async function synthVoiceToFile(text, outputPath) {
  if (!OPENAI_API_KEY) {
    log('OPENAI_API_KEY no configurada; simulando audio.');
    await fs.writeFile(outputPath, '');
    return;
  }
  // Usa la API TTS de OpenAI (Audio Speech) disponible en el SDK v4
  const speech = await openai.audio.speech.create({
    model: VOICE_MODEL,
    voice: 'alloy',
    input: text,
    format: 'mp3',
    language: LANG
  });
  const buffer = Buffer.from(await speech.arrayBuffer());
  await fs.writeFile(outputPath, buffer);
}

// Content generation
async function genTextPrompt(system, user) {
  if (!OPENAI_API_KEY) {
    return `Simulación: ${user}`;
  }
  const resp = await openai.chat.completions.create({
    model: TEXT_MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    temperature: 0.8,
  });
  return resp.choices[0]?.message?.content?.trim() || '';
}

// Twitch Chat
let twitchClient;
function connectTwitch() {
  if (!TWITCH_USERNAME || !TWITCH_OAUTH_TOKEN || !TWITCH_CHANNELS) {
    log('Twitch no configurado.');
    return;
  }
  twitchClient = new tmi.Client({
    options: { debug: false },
    identity: { username: TWITCH_USERNAME, password: TWITCH_OAUTH_TOKEN },
    channels: TWITCH_CHANNELS.split(',').map(s => s.trim()).filter(Boolean)
  });
  twitchClient.connect().catch(err => log('Twitch error:', err.message));
  twitchClient.on('message', async (channel, tags, message, self) => {
    if (self) return;
    const user = tags['display-name'] || tags['username'];
    log(`[TWITCH:${channel}] <${user}> ${message}`);
    // Respuesta básica con IA
    if (/^!pregunta\b/i.test(message)) {
      const q = message.replace(/^!pregunta\s*/i, '').trim();
      const answer = await genTextPrompt('Eres un locutor de radio amigable y entretenido, en español, conciso.', `Responde a: ${q}`);
      twitchClient.say(channel, `@${user} ${answer}`);
    }
  });
}

// YouTube Chat
let ytChat;
function connectYouTube() {
  if (!YT_LIVE_CHAT_ID) {
    log('YouTube no configurado.');
    return;
  }
  ytChat = new YoutubeChat({ liveId: YT_LIVE_CHAT_ID });
  ytChat.on('chat', async (m) => {
    const user = m.author?.name || 'usuario';
    log(`[YOUTUBE] <${user}> ${m.message}`);
    if (/^!pregunta\b/i.test(m.message)) {
      const q = m.message.replace(/^!pregunta\s*/i, '').trim();
      const answer = await genTextPrompt('Eres un locutor de radio amigable y entretenido, en español, conciso.', `Responde a: ${q}`);
      // Nota: youtube-chat no envía mensajes, solo lee. Para responder, usar API de YouTube LiveChat insert si se requiere.
      await speak(answer);
    }
  });
  ytChat.start().catch(err => log('YouTube chat error:', err.message));
}

// Speak: genera TTS y notifica OBS
async function speak(text) {
  try {
    await synthVoiceToFile(text, VOICE_FILE);
    // Para OBS: si la fuente de audio "Voz" está apuntando a VOICE_FILE y con "reiniciar al cambiar archivo",
    // bastará con escribir el archivo. Para mayor control, podemos desactivar/activar fuente.
    try {
      await obs.call('SetSceneItemEnabled', { sceneName: 'Radio', sceneItemId: await getSceneItemId('Radio', 'Voz'), sceneItemEnabled: true });
    } catch {}
    log('Voz reproducida.');
  } catch (e) {
    log('Error speak:', e.message);
  }
}

async function getSceneItemId(sceneName, sourceName) {
  const { sceneItems } = await obs.call('GetSceneItemList', { sceneName });
  const item = sceneItems.find(si => si.sourceName === sourceName);
  return item?.sceneItemId;
}

// Simple schedule: cada 30 minutos
function setupSchedule() {
  // al minuto 0 y 30 de cada hora
  schedule.scheduleJob('0 0,30 * * * *', async () => {
    await blockOpen();
    await blockRadioNovela();
    await blockMusic(5);
  });
  log('Scheduler configurado: bloques cada 30 min');
}

async function blockOpen() {
  const script = await genTextPrompt(
    'Eres un locutor de radio carismático en español. Hablas 1-2 minutos, presentas el bloque y llamas a participar con !pregunta.',
    'Escribe una apertura breve (120-200 palabras) con tono cálido.'
  );
  await speak(script);
}

async function blockRadioNovela() {
  const statePath = path.join(DATA_DIR, 'state.json');
  let state = await fs.readJSON(statePath).catch(() => ({ chapter: 1 }));
  const script = await genTextPrompt(
    'Eres guionista de una radionovela en español. Crea un capítulo por entregas, narración en 2-3 minutos, termina con un cliffhanger. Mantén continuidad de personajes. Evita violencia gráfica o temas sensibles. Formato: narración continua en primera o tercera persona.',
    `Escribe el capítulo ${state.chapter} de la radionovela "Sombras en la Ciudad" (300-450 palabras).`
  );
  await speak(script);
  state.chapter += 1;
  await fs.writeJSON(statePath, state, { spaces: 2 });
}

async function blockMusic(minutes = 5) {
  // Si la música está configurada como fuente independiente en OBS, aquí solo bajamos/subimos volumen según "sidechain" simple.
  try {
    const sceneName = 'Radio';
    const musicId = await getSceneItemId(sceneName, 'Musica');
    if (musicId) {
      // Subir música por unos minutos
      await obs.call('SetSceneItemEnabled', { sceneName, sceneItemId: musicId, sceneItemEnabled: true });
      log(`Música ON por ${minutes} minutos`);
      setTimeout(async () => {
        await obs.call('SetSceneItemEnabled', { sceneName, sceneItemId: musicId, sceneItemEnabled: false });
        log('Música OFF');
      }, minutes * 60 * 1000);
    } else {
      log('Fuente "Musica" no encontrada en OBS.');
    }
  } catch (e) {
    log('blockMusic error:', e.message);
  }
}

// Volumen sidechain simple
async function sidechain(begin) {
  try {
    const sceneName = 'Radio';
    const musicId = await getSceneItemId(sceneName, 'Musica');
    if (!musicId) return;
    // OBS 5.x WebSocket requiere controlar filtros o niveles de fuente de audio; simplificado: toggle enable
    if (begin) {
      await obs.call('SetSceneItemEnabled', { sceneName, sceneItemId: musicId, sceneItemEnabled: false });
    } else {
      await obs.call('SetSceneItemEnabled', { sceneName, sceneItemId: musicId, sceneItemEnabled: true });
    }
  } catch {}
}

async function main() {
  log('Arrancando IA Radio 24/7...');
  await connectOBS();
  connectTwitch();
  connectYouTube();
  setupSchedule();

  // Al inicio, lanza una apertura de bienvenida
  await blockOpen();
}

process.on('unhandledRejection', (r) => log('unhandledRejection', r));
process.on('uncaughtException', (e) => log('uncaughtException', e));

main();
