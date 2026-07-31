import { Client, GatewayIntentBits } from 'discord.js';
import { WebcastPushConnection } from 'tiktok-live-connector';

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) throw new Error("Brak tokena Discord bota!");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const TIKTOK_USER = "tutaj_wpisz_nazwa_uzytkownika_tiktok"; // Zmień na swoją nazwę użytkownika TikTok

const tiktokConn = new WebcastPushConnection(TIKTOK_USER);

client.once('ready', () => {
    console.log(`Zalogowano jako ${client.user?.tag}!`);

    tiktokConn.connect().then(state => {
        console.log(`Połączono z transmisją TikTok użytkownika ${TIKTOK_USER} (ID: ${state.roomId})`);
    }).catch(err => {
        console.error('Błąd połączenia z TikTokiem:', err);
    });

    tiktokConn.on('chat', data => {
        console.log(`${data.uniqueId}: ${data.comment}`);
    });
});

client.login(token);

