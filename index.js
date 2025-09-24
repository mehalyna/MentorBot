import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import { DateTime } from 'luxon';
import http from 'http';

// --- Configuration ---
const {
  DISCORD_TOKEN,
  MENTOR_ROLE_ID,
  SHARE_CHAT_URL,
  WORK_DAYS = '1,2,3,4,5',
  WORK_START = '9',
  WORK_END = '18',
  KYIV_TZ = 'Europe/Kyiv',
  COOLDOWN_MS = '3000',
  FALLBACK_DM = 'true',
  HEALTH_PORT = 8080
} = process.env;

// --- Validation ---
function requireEnv(varName, value) {
  if (!value) {
    console.error(`Missing ${varName} in env`);
    process.exit(1);
  }
}
requireEnv('DISCORD_TOKEN', DISCORD_TOKEN);
requireEnv('MENTOR_ROLE_ID', MENTOR_ROLE_ID);

// --- Constants ---
const WORK_DAYS_ARR = WORK_DAYS.split(',').map(Number);
const WORK_START_H = Number(WORK_START);
const WORK_END_H = Number(WORK_END);
const COOLDOWN = Number(COOLDOWN_MS);
const DO_FALLBACK_DM = FALLBACK_DM.toLowerCase() === 'true';

// --- Warning Handler ---
process.on('warning', (warning) => {
  if (
    warning.name === 'DeprecationWarning' &&
    /ready event has been renamed to clientReady/i.test(String(warning.message))
  ) return;
  console.warn(warning);
});

// --- Discord Client ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// --- Health Endpoint ---
http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
  } else {
    res.writeHead(404);
    res.end();
  }
}).listen(HEALTH_PORT, () => {
  console.log(`Health server listening on ${HEALTH_PORT}`);
});

// --- Cooldown Map ---
const userCooldown = new Map();

// --- Helpers ---
function isInWorkHours(now) {
  return WORK_DAYS_ARR.includes(now.weekday) && now.hour >= WORK_START_H && now.hour < WORK_END_H;
}

function isOnCooldown(userId) {
  const last = userCooldown.get(userId) || 0;
  return Date.now() - last < COOLDOWN;
}

function setCooldown(userId) {
  userCooldown.set(userId, Date.now());
}

function getTimeStr(now) {
  return now.toFormat('cccc, HH:mm');
}

async function trySendDM(user, content) {
  try {
    await user.send(content);
    return true;
  } catch (err) {
    console.debug(`Could not send DM to ${user.tag}: ${err?.message ?? err}`);
    return false;
  }
}

// --- Ready Handler ---
let readyHandled = false;
function handleClientReady() {
  if (readyHandled) return;
  readyHandled = true;
  console.log(`Bot ready: ${client.user.tag}`);
}
client.once('clientReady', handleClientReady);

// --- Message Handler ---
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const now = DateTime.now().setZone(KYIV_TZ);

  // --- Bot Mention ---
  if (message.mentions?.users?.has(client.user.id)) {
    if (isOnCooldown(message.author.id)) return;
    setCooldown(message.author.id);

    const publicReply =
      `${message.author}, привіт! 👋 Я — MentorBot. Ось посилання на наш натренований ChatGPT-чат: ` +
      `${SHARE_CHAT_URL ?? '(посилання не налаштоване)'}\n\n` +
      `Порада: опишіть своє питання коротко й подайте приклад коду або очікуваний результат — так відповідь буде точнішою.`;

    await message.reply({
      content: publicReply,
      allowedMentions: { parse: [] }
    });

    if (DO_FALLBACK_DM) {
      await trySendDM(
        message.author,
        `Привіт! Ви тегнули мене в ${message.guild ? message.guild.name : 'DM'}. ` +
        `Ось чат: ${SHARE_CHAT_URL ?? '(посилання не налаштоване)'}\n\n` +
        `Якщо хочете — напишіть тут питання, або скористайтеся чатом.`
      );
    }
    return;
  }

  // --- Mentor Role Mention ---
  const mentionsMentor = !!message.mentions?.roles?.some(r => r.id === MENTOR_ROLE_ID);
  if (!mentionsMentor) return;
  if (isOnCooldown(message.author.id)) return;
  setCooldown(message.author.id);

  if (isInWorkHours(now)) return;

  const replyText =
    `${message.author}, вибачте — зараз поза робочим часом менторів (Kyiv: ${getTimeStr(now)}). ` +
    `Ось швидка самодопомога: ${SHARE_CHAT_URL ?? '(посилання не налаштоване)'}\n\n` +
    `Порада: опишіть коротко проблему й вставте фрагмент коду або очікуваний результат — ` +
    `це допоможе отримати швидку і точну відповідь від чату. 😊`;

  await message.reply({
    content: replyText,
    allowedMentions: { parse: [] }
  });

  if (DO_FALLBACK_DM) {
    await trySendDM(
      message.author,
      `Привіт! Ваше питання помічено. Тимчасова самодопомога: ${SHARE_CHAT_URL}\n\n` +
      `Якщо після цього залишаться питання — ментори дадуть відповідь у робочий час.`
    );
  }
});

// --- Unhandled Promise Rejection Handler ---
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

client.login(DISCORD_TOKEN);