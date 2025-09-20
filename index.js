import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import { DateTime } from 'luxon';

const {
  DISCORD_TOKEN,
  MENTOR_ROLE_ID,
  ON_DUTY_ROLE_ID,
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
if (!ON_DUTY_ROLE_ID) {
  console.error('Missing ON_DUTY_ROLE_ID in env');
  process.exit(1);
}

const WORK_DAYS_ARR = WORK_DAYS.split(',').map(s => Number(s.trim()));
const WORK_START_H = Number(WORK_START);
const WORK_END_H = Number(WORK_END);
const COOLDOWN = Number(COOLDOWN_MS);
const DO_FALLBACK_DM = FALLBACK_DM.toLowerCase() === 'true';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const userCooldown = new Map();

function isInWorkHours(now) {
  return WORK_DAYS_ARR.includes(now.weekday) && now.hour >= WORK_START_H && now.hour < WORK_END_H;
}

client.once('ready', () => {
  console.log(`Bot ready: ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  try {
    if (message.author.bot) return;

    // Check if the mentor role is mentioned in the message
    const mentionsMentor = message.mentions?.roles?.some(r => r.id === MENTOR_ROLE_ID);
    if (!mentionsMentor) return;

    // Cooldown for the user to prevent spam
    const last = userCooldown.get(message.author.id) || 0;
    if (Date.now() - last < COOLDOWN) return;
    userCooldown.set(message.author.id, Date.now());

    // Time in Kyiv
    const now = DateTime.now().setZone(KYIV_TZ);

    // If during working hours — do nothing (or optionally send an informative reply)
    if (isInWorkHours(now)) {
        // optional: notify that mentors will respond to the request
        // await message.reply(`Mentors are already here — your message has been noticed.`);
      return;
    }

    // Outside working hours -> reply in the channel, ping the on-duty role, and add a link to the share-chat
    const onDutyMention = `<@&${ON_DUTY_ROLE_ID}>`;
    const timeStr = now.toFormat('cccc, HH:mm'); // приклад: "середа, 21:05"

    const replyText =
      `${message.author}, зараз поза робочим часом (Kyiv: ${timeStr}). ` +
      `Я повідомив ${onDutyMention} — вони зможуть допомогти або ви можете одразу скористатись самодопомогою:\n\n` +
      `🔗 ${SHARE_CHAT_URL ?? '(посилання не налаштоване)'}\n\n` +
      `Порада: опишіть коротко проблему і вставте фрагмент коду / очікуваний результат — так допомога буде точнішою. 🙂`;

    // Send a reply in the channel, allowing only this role to be pinged
    await message.reply({
      content: replyText,
      allowedMentions: { roles: ON_DUTY_ROLE_ID ? [ON_DUTY_ROLE_ID] : [] }
    });

    // Optional fallback: if the role is not mentionable or the ping did not work, send a DM with a gentle suggestion
    if (DO_FALLBACK_DM) {
      try {
        await message.author.send(
          `Ваше запитання помічено. Поза робочим часом — ось миттєва самодопомога: ${SHARE_CHAT_URL}\n\n` +
          `Якщо хочете — залиште тут питання, і вранці ментори вам дадуть відповідь.`
        );
      } catch (dmErr) {
        // DM may be closed in the user's settings — ignore the error
        console.debug('Could not send DM to user (likely closed DMs).');
      }
    }

  } catch (err) {
    console.error('Error processing messageCreate:', err);
    try {
      await message.reply('Сталася помилка при обробці повідомлення. Спробуйте ще раз, будь ласка.');
    } catch {}
  }
});

client.login(DISCORD_TOKEN);
