const { Client, GatewayIntentBits } = require('discord.js');
const fetch = require('node-fetch');

const DISCORD_TOKEN       = process.env.DISCORD_TOKEN;
const APPS_SCRIPT_URL     = process.env.APPS_SCRIPT_URL;
const CHANNEL_RAPPORTS_ID = '1460375818789322883';
const CHANNEL_LOGS_ID     = '1438618603510300785';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences
  ]
});

async function sendToAppsScript(payload) {
  try {
    // Un seul appel : node-fetch envoie le POST, puis suit automatiquement la redirection 302
    // vers script.googleusercontent.com pour récupérer le résultat JSON.
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      redirect: 'follow'
    });

    const responseText = await res.text();
    console.log(`[${new Date().toISOString()}] Réponse Apps Script :`, responseText);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Erreur envoi Apps Script :`, err.message);
  }
}

client.once('clientReady', () => {
  console.log(`[${new Date().toISOString()}] Bot connecté : ${client.user.tag}`);

  // Heartbeat toutes les heures -> recalcul des durées d'absence
  setInterval(async () => {
    console.log(`[${new Date().toISOString()}] Heartbeat envoyé`);
    await sendToAppsScript({ type: 'heartbeat' });
  }, 60 * 60 * 1000);
});

client.on('messageCreate', async (message) => {
  if (message.channelId !== CHANNEL_RAPPORTS_ID && message.channelId !== CHANNEL_LOGS_ID) return;

  const embeds = message.embeds.map(e => ({
    title:       e.title       || '',
    description: e.description || '',
    fields:      (e.fields || []).map(f => ({ name: f.name, value: f.value }))
  }));

  console.log(`[${new Date().toISOString()}] Message reçu dans ${message.channelId === CHANNEL_RAPPORTS_ID ? 'rapports' : 'logs'}`);

  await sendToAppsScript({
    type:      'message',
    channel:   message.channelId === CHANNEL_RAPPORTS_ID ? 'rapports' : 'logs',
    content:   message.content,
    embeds:    embeds,
    messageId: message.id,
    authorBot: message.author.bot
  });
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
  const oldRoles = [...oldMember.roles.cache.keys()];
  const newRoles = [...newMember.roles.cache.keys()];

  const added   = newRoles.filter(r => !oldRoles.includes(r));
  const removed = oldRoles.filter(r => !newRoles.includes(r));
  if (added.length === 0 && removed.length === 0) return;

  console.log(`[${new Date().toISOString()}] Rôles modifiés pour ${newMember.user.id} — Ajoutés: ${added} | Retirés: ${removed}`);

  await sendToAppsScript({
    type:   'roleUpdate',
    userId: newMember.user.id,
    roles:  newRoles
  });
});

client.login(DISCORD_TOKEN);
