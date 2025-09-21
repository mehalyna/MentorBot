// Requirements: node >=18, dependencies: discord.js, dotenv, luxon

import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import { DateTime } from 'luxon';

const {
  DISCORD_TOKEN,
  MENTOR_ROLE_ID,
  // ON_DUTY_ROLE_ID,   
  SHARE_CHAT_URL,
  WORK_DAYS = '1,2,3,4,5',
  WORK_START = '9',
  WORK_END = '18',
  KYIV_TZ = 'Europe/Kyiv',
  COOLDOWN_MS = '3000',
  FALLBACK_DM = 'true'
} = process.env;

if (!DISCORD_TOKEN) {
  console.error('Missing DISCORD_TOKEN in env');
  process.exit(1);
}
if (!MENTOR_ROLE_ID) {
  console.error('Missing MENTOR_ROLE_ID in env');
  process.exit(1);
}
// ON_DUTY_ROLE_ID 

const WORK_DAYS_ARR = WORK_DAYS.split(',').map(s => Number(s.trim()));
const WORK_START_H = Number(WORK_START);
const WORK_END_H = Number(WORK_END);
const COOLDOWN = Number(COOLDOWN_MS);
const DO_FALLBACK_DM = FALLBACK_DM.toLowerCase() === 'true';

// Filtered warning handler: specifically ignore this DeprecationWarning about ready -> clientReady
process.on('warning', (warning) => {
  try {
    if (
      warning.name === 'DeprecationWarning' &&
      /ready event has been renamed to clientReady/i.test(String(warning.message))
    ) {
      // ignore this specific warning
      return;
    }
  } catch (e) {
    // if something went wrong while filtering — just log the warning
    console.warn(warning);
  }
  // For all other warnings — show as usual
  console.warn(warning);
});


const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Simple health HTTP endpoint (optional) — useful for deployment
import http from 'http';
const HEALTH_PORT = process.env.HEALTH_PORT || 8080;
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

const userCooldown = new Map();

function isInWorkHours(now) {
  return WORK_DAYS_ARR.includes(now.weekday) && now.hour >= WORK_START_H && now.hour < WORK_END_H;
}

// Compatible ready handler: subscribe to both events to avoid DeprecationWarning
let readyHandled = false;
function handleClientReady() {
  if (readyHandled) return;
  readyHandled = true;
  console.log(`Bot ready: ${client.user.tag}`);
// additional initializations if needed
}
client.once('ready', handleClientReady);
client.once('clientReady', handleClientReady); // for future versions

client.on('messageCreate', async (message) => {
  try {
    if (message.author.bot) return;

    // Check if the mentor role is mentioned in the message
    const mentionsMentor = !!message.mentions?.roles?.some(r => r.id === MENTOR_ROLE_ID);
    if (!mentionsMentor) return;

    // Cooldown for the user
    const last = userCooldown.get(message.author.id) || 0;
    if (Date.now() - last < COOLDOWN) return;
    userCooldown.set(message.author.id, Date.now());

    const now = DateTime.now().setZone(KYIV_TZ);

    // If during work hours — do nothing
    if (isInWorkHours(now)) {
      return;
    }

    // OUTSIDE WORKING HOURS — reply in the channel without pinging the role
    const timeStr = now.toFormat('cccc, HH:mm');
    const replyText =
      `${message.author}, вибачте — зараз поза робочим часом менторів (Kyiv: ${timeStr}). ` +
      `Ось швидка самодопомога: ${SHARE_CHAT_URL ?? '(посилання не налаштоване)'}\n\n` +
      `Порада: опишіть коротко проблему й вставте фрагмент коду або очікуваний результат — ` +
      `це допоможе отримати швидку і точну відповідь від чату. 😊`;

    // Send a message to the channel. allowedMentions is empty to avoid accidental pings
    await message.reply({
      content: replyText,
      allowedMentions: { parse: [] }
    });

    // Fallback: DM the user with the link (if allowed by their settings)
    if (DO_FALLBACK_DM) {
      try {
        await message.author.send(
          `Привіт! Ваше питання помічено. Тимчасова самодопомога: ${SHARE_CHAT_URL}\n\n` +
          `Якщо після цього залишаться питання — ментори дадуть відповідь у робочий час.`
        );
        console.log(`DM sent to ${message.author.tag}`);
      } catch (dmErr) {
        console.log(`Could not send DM to ${message.author.tag}: ${dmErr?.message ?? dmErr}`);
        // If the DM was not delivered — the channel message was already sent, which is usually sufficient
      }
    }

  } catch (err) {
    console.error('Error processing messageCreate:', err);
    try {
      await message.reply('Сталася помилка при обробці повідомлення. Спробуйте ще раз, будь ласка.');
    } catch (e) {
      console.error('Also failed to send fallback reply in channel:', e);
    }
  }
});

// Useful handling of unhandled Promise rejections
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

client.login(DISCORD_TOKEN);
