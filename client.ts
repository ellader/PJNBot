import { 
    Client, 
    GatewayIntentBits, 
    REST, 
    Routes, 
    SlashCommandBuilder,
    TextChannel,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    AuditLogEvent,
    StringSelectMenuBuilder,
    ContextMenuCommandBuilder,
    ApplicationCommandType,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    VoiceState
} from 'discord.js';
import mongoose from 'mongoose';
import cron from 'node-cron';
import http from 'http';

// Prosty serwer HTTP dla Render.com, żeby nie wyrzucał błędu "No open ports detected"
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot Discord dziala poprawnie!\n');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serwer HTTP nasłuchuje na porcie ${PORT}`);
});

// === KONFIGURACJA BAZY DANYCH MONGOOSE ===
const MONGO_URI = process.env.MONGODB_URI;
if (!MONGO_URI) throw new Error("Brak zmiennej środowiskowej MONGODB_URI!");

mongoose.connect(MONGO_URI)
    .then(() => console.log('Połączono z bazą danych MongoDB!'))
    .catch((err) => console.error('Błąd połączenia z MongoDB:', err));

const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    balance: { type: Number, default: 0 },
    lastDaily: { type: Date, default: null },
    lastWheelSpin: { type: Date, default: null },
    guaranteedWinUntil: { type: Date, default: null },
    messageCount: { type: Number, default: 0 },
    emojiCount: { type: Number, default: 0 },
    voiceMinutes: { type: Number, default: 0 },
    casinoPlays: { type: Number, default: 0 },
    consecutiveWins: { type: Number, default: 0 },
    consecutiveLosses: { type: Number, default: 0 }, 
    nightMessageCount: { type: Number, default: 0 }, 
    totalDonated: { type: Number, default: 0 },     
    quotesAdded: { type: Number, default: 0 },
    helpCount: { type: Number, default: 0 },
    joinedAt: { type: Date, default: Date.now },
    badges: { type: [String], default: [] },
    reputation: { type: Number, default: 0 },
    exp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },                      
    vipExpiresAt: { type: Date, default: null },        
    doubleChanceUntil: { type: Date, default: null },  
    dailyBoostUntil: { type: Date, default: null },     
    customRoleExpiresAt: { type: Date, default: null }, 
    customVoiceExpiresAt: { type: Date, default: null },
    customRoleId: { type: String, default: null },
    epicNick: { type: String, default: null },
    fortniteKills: { type: Number, default: 0 },
    matchesPlayed: { type: Number, default: 0 },
    estimatedPlaytimeHours: { type: Number, default: 0 }
});

const UserModel = mongoose.model('User', userSchema);

const repCooldownSchema = new mongoose.Schema({
    giverId: { type: String, required: true },
    targetId: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});
repCooldownSchema.index({ giverId: 1, targetId: 1 }, { unique: true });
const RepCooldownModel = mongoose.model('RepCooldown', repCooldownSchema);

const shopHistorySchema = new mongoose.Schema({
    userId: { type: String, required: true },
    itemName: { type: String, required: true },
    price: { type: Number, required: true },
    purchasedAt: { type: Date, default: Date.now }
});
const ShopHistoryModel = mongoose.model('ShopHistory', shopHistorySchema);

const transactionHistorySchema = new mongoose.Schema({
    userId: { type: String, required: true },
    targetUserId: { type: String, default: null },
    type: { type: String, required: true },
    amount: { type: Number, required: true },
    details: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now }
});
const TransactionHistoryModel = mongoose.model('TransactionHistory', transactionHistorySchema);

const pokerRoomSchema = new mongoose.Schema({
    messageId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true },
    hostId: { type: String, required: true },
    stake: { type: Number, required: true },
    players: { type: [String], required: true },
    status: { type: String, default: 'waiting' },
    lastActivity: { type: Date, default: Date.now }
});
const PokerRoomModel = mongoose.model('PokerRoom', pokerRoomSchema);

const AVAILABLE_BADGES = [
    '💬 **Początkujący Gadulec**',
    '📜 **Kronikarz Chatu**',
    '💬 **Król Wiadomości**',
    '😂 **Emotikonowy Ekspresja**',
    '🌙 **Nocny Marek**',
    '🎙️ **Stały Bywalec Mikrofonu**',
    '🎧 **Audiofil**',
    '💰 **Kapitalista**',
    '💎 **Magnat Finansowy**',
    '🏦 **Milioner (Rzadka)**',
    '💸 **Hojny Darczyńca**',
    '🎲 **Nałogowy Graczyk**',
    '🎰 **Ryzykant (Rzadka)**',
    '🍀 **Ulubieniec Fortuna**',
    '🎯 **Czarna Seria**',
    '🏷️ **Klient sklepu PJN**',
    '🎖️ **Nałogowy klient sklepu PJN**',
    '💡 **Filozof**',
    '🤝 **Pomocna Dłoń**',
    '⏳ **Weteran Półrocza**',
    '⏳ **Weteran (Rzadka)**',
    '🛡️ **Filar Społeczności**',
    '⭐ **Awansowy Ekspert (Lvl 10)**',
    '🌟 **Mistrz Poziomów (Lvl 50, Rzadka)**',
    '👑 **Legenda Serwera (Lvl 100, Elitarna)**',
    '🧠 **Wygadany Mędrzec (25k Wiadomości)**',
    '🎙️ **Duch Kanałów Głosowych (500h na Głosie, Elitarna)**',
    '🏛️ **Miliarder PJN (1 000 000 Coinsów, Elitarna)**',
    '🎰 **Hazardowy Tycoon (500 Gier w Kasynie)**',
    '🔥 **Niepowstrzymana Seria (20 Wygranych z Rzędu, Epicka)**',
    '⌛ **Długowieczny Patriarcha (3 Lata Stażu, Elitarna)**',
    '🤝 **Filantrop Społeczności (50 000 Przekazanych Coinsów)**',
    '🎟️ **Kolekcjoner (Epicka)**'
];

const RARE_ANNOUNCE_BADGES = [
    '🏦 **Milioner (Rzadka)**',
    '🎰 **Ryzykant (Rzadka)**',
    '⏳ **Weteran (Rzadka)**',
    '🌟 **Mistrz Poziomów (Lvl 50, Rzadka)**',
    '👑 **Legenda Serwera (Lvl 100, Elitarna)**',
    '🎟️ **Kolekcjoner (Epicka)**',
    '🎙️ **Duch Kanałów Głosowych (500h na Głosie, Elitarna)**',
    '🏛️ **Miliarder PJN (1 000 000 Coinsów, Elitarna)**',
    '🔥 **Niepowstrzymana Seria (20 Wygranych z Rzędu, Epicka)**',
    '⌛ **Długowieczny Patriarcha (3 Lata Stażu, Elitarna)**'
];

const configSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    channelId: { type: String, required: true },
    messageId: { type: String, required: true }
});
const ConfigModel = mongoose.model('Config', configSchema);

const quoteSchema = new mongoose.Schema({
    text: { type: String, required: true },
    author: { type: String, required: true },
    addedBy: { type: String, default: null }
});
const QuoteModel = mongoose.model('Quote', quoteSchema);

const lfgSchema = new mongoose.Schema({
    messageId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true },
    authorId: { type: String, required: true },
    game: { type: String, required: true },
    maxPlayers: { type: Number, required: true },
    currentPlayers: { type: [String], required: true },
    description: { type: String, default: '' },
    status: { type: String, default: 'active' }, 
    voiceChannelId: { type: String, default: null },
    createdAt: { type: Date, default: Date.now } 
});
const LFGModel = mongoose.model('LFG', lfgSchema);

const pollSchema = new mongoose.Schema({
    messageId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true },
    question: { type: String, required: true },
    options: { type: [String], required: true },
    votes: { type: [[String]], required: true },
    ended: { type: Boolean, default: false },
    endsAt: { type: Date, default: null }
});
const PollModel = mongoose.model('Poll', pollSchema);

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) throw new Error("Brak tokena Discord bota!");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildPresences
    ]
});

const tempVoiceChannels = new Set<string>();

const LFG_CONFIG = {
    CATEGORY_VOICE: '1545289592901468170', 
    GAMES: {
        fortnite: { name: 'Fortnite', roleId: '1532400998625181907', emoji: '🎮' },
        cs2: { name: 'Counter-Strike 2', roleId: '1532401066832822404', emoji: '🎯' },
        minecraft: { name: 'Minecraft', roleId: '1532401160596750398', emoji: '⛏️' },
        gta: { name: 'GTA V / Online', roleId: '1545290821568438352', emoji: '🚗' },
        valorant: { name: 'Valorant', roleId: '1545290283787354113', emoji: '⚡' },
        lol: { name: 'League of Legends', roleId: '1545290424904843284', emoji: '⚔️' }
    }
};

const NOTIF_CONFIG = {
    languspjn: {
        channelId: '1542101793171972146',
        twitchUsername: 'languspjn',
        voiceChannelIdToRename: '1532302511459926069' 
    },
    elladermusic: {
        channelId: '1542101962185646111',
        twitchUsername: 'elladermusic',
        voiceChannelIdToRename: null
    },
    leaveLogChannelId: '1542102521814712371'
};

const FREE_GAMES_CHANNEL_ID = '1551606555533910189';
const ANNOUNCE_CHANNEL_ID = '1532399010785263799';
const ID_KANALU_CYTATY = '1534780578912665653'; 
const ID_KANALU_ZLOTE_MYSLI = '1549709251365183558'; 
const ID_KANALU_MEMOW = '1534833819599769640'; 
const ID_KANALU_SZUKAM_DO_GRY = '1532449084559069214'; 
const ID_KANALU_POKAZ_SIEBIE = '1536365057997283469'; 
const CHANNEL_POWITANIA = "witamy";
const ID_KANALU_POWITANIA_NOWYCH = "1532414383584706751";
const ID_KANALU_DUSZKI = "1532977723843285112"; 
const ID_KANAL_ROZMOWY_Z_BOTEM = "1532862421729808565"; 
const ID_KANAL_CENTRUM_ZGLOSZEN = "1532862125209555157"; 

const ID_RANGI_DUSZKOWIEC = "1532978703842283551";
const ID_RANGI_MODERATOR = "1532321767857721344";
const ID_RANGI_ADMIN = "1532324059470237857";

const ID_KANAL_WERYFIKACJI = '1549658822136696832';
const ID_RANGI_ZWERYFIKOWANY = '1549659335179763772';
const ID_ROLI_MEZCZYZNA = '1532327338430431383';
const ID_ROLI_KOBIETA = '1532328153786224751';
const ID_KANAL_TWORZENIA_POKOJU = '1532302511459926069';

const ID_KANAL_REPUTACJI = "1540233764477730908";
const ID_ALEJA_SLAW_REPUTACJI = "1540238376278687754";
const ID_RANGI_WZOROWY_TRADER = "1540235169653592084";    
const ID_RANGI_POZYTYWNY_TRADER = "1540251183892008970"; 
const ID_RANGI_NEGATYWNY_TRADER = "1540235296665239624"; 

const ID_KANAL_SKLEPU = "1545690716309553212";
const ID_ROLI_VIP = "1545691786289221632";

const ID_KANAL_FORTNITE = '1546405381717233704';
const ID_KANAL_RANKING_FORTNITE = '1546593557526216816';
const ID_KANAL_AWANSOW = '1546407009262370866';

const ID_KANAL_AKTUALIZACJI_FORTNITE = '1547923010823004180';
const ID_RANGI_AKTUALIZACJE_FORTNITE = '1547922790152282112';

const STATS_CHANNELS = {
    ONLINE: '1532336242086117498',
    FORTNITE: '1532336416074371102',
    USERS: '1533839018289266718'
};

const ID_KANAL_RANG = "1532397673842217010";
const ROLE_BUTTONS_MAP: { [key: string]: { roleId: string, label: string, emoji: string } } = {
    'role_bezrobotny': { roleId: '1532400774015881246', label: 'Bezrobotny', emoji: '😜' },
    'role_kolekcjoner': { roleId: '1532400880479895734', label: 'Kolekcjoner Duszków', emoji: '👻' },
    'role_fortnite': { roleId: '1532400998625181907', label: 'Gram w: Fortnite', emoji: '🗺️' },
    'role_cs2': { roleId: '1532401066832822404', label: 'Gram w: CS2', emoji: '🔪' },
    'role_minecraft': { roleId: '1532401160596750398', label: 'Gram w: Minecraft', emoji: '📦' },
    'role_gta': { roleId: '1545290821568438352', label: 'Gram w: GTA V', emoji: '🚗' },
    'role_valorant': { roleId: '1545290283787354113', label: 'Gram w: Valorant', emoji: '⚡' },
    'role_lol': { roleId: '1545290424904843284', label: 'Gram w: LoL', emoji: '⚔️' },
    'role_zerobuild': { roleId: '1532401282491355167', label: 'BR Zero Budowania', emoji: '🔥' },
    'role_reaktywacja': { roleId: '1532401356118163526', label: 'Reaktywacja', emoji: '🚨' },
    'role_budowanie': { roleId: '1532401420504928496', label: 'BR Budowanie', emoji: '🪵' },
    'role_forfun': { roleId: '1532401604953637025', label: 'ForFun', emoji: '🤖' },
    'role_najlepszy': { roleId: '1532401678433914951', label: 'Najlepszy gracz', emoji: '💪' }
};

const QUIZ_POOL = [
    { q: 'Jaka jest waluta serwera PJN?', correct: 'PJN-Coins', wrong1: 'V-Bucks', wrong2: 'Euro' },
    { q: 'Co ile godzin możesz kręcić Kołem Fortuny?', correct: 'Co 2 godziny', wrong1: 'Co 24 godziny', wrong2: 'Bez limitu' },
    { q: 'Jaki jest oficjalny kolor rang VIP?', correct: 'Żółty/Złoty', wrong1: 'Czerwony', wrong2: 'Zielony' },
    { q: 'Kto jest głównym streamerem społeczności?', correct: 'LangusPJN', wrong1: 'Ninja', wrong2: 'PewDiePie' }
];

const SHOP_ITEMS = [
    { id: 'vip_role', name: '🟡 Rola VIP (na 30 dni)', price: 15000, description: 'Zwiększona szansa w kasynie, dostęp do zablokowanych kanałów + 2x PJN-Coins za wiadomości przez 30 dni!', type: 'vip' },
    { id: 'double_chance', name: '🍀 Podwójna szansa w kasynie (30 dni)', price: 5000, description: 'Zwiększa szansę na wygraną w grach kasynowych.', type: 'double_chance' },
    { id: 'custom_role', name: '✨ Własna rola na 30 dni', price: 10000, description: 'Możliwość posiadania spersonalizowanej rangi na serwerze.', type: 'custom_role' },
    { id: 'priority_ghost', name: '👻 Bilet po duszka poza kolejką', price: 7000, description: 'Odbiór dowolnego duszka poza kolejką podczas streama.', type: 'priority_ghost' },
    { id: 'badge_client', name: '🏷️ Odznaka "Klient sklepu PJN"', price: 1000, description: 'Unikalna odznaka w profilu.', type: 'badge', badgeName: '🏷️ **Klient sklepu PJN**' },
    { id: 'badge_advanced', name: '🎖️ Odznaka "Zaawansowany klient"', price: 5000, description: 'Ekskluzywna zaawansowana odznaka w profilu.', type: 'badge', badgeName: '🎖️ **Zaawansowany klient sklepu PJN**' },
    { id: 'custom_voice', name: '🎙️ Własny kanał głosowy na 30 dni', price: 6000, description: 'Prywatny pokój głosowy na okres 30 dni.', type: 'custom_voice' },
    { id: 'daily_boost', name: '🎁 Pakiet "2x Daily" na tydzień', price: 8000, description: 'Podwójna ilość PJN-Coins z komendy /daily przez 7 dni.', type: 'daily_boost' }
];

const LIVE_IMAGE_URL = "https://cdn.discordapp.com/attachments/1532321067731783684/1545708586108325898/IMG_20260905_101345.jpg?ex=6a9d20cc&is=6a9bcf4c&hm=a3a2a62e8f092f637ca72db6600ba805fb1a84a709595a77073021274e250a3e&";

function isAuthorized(userId: string): boolean {
    const adminIds = ['1175798371995361343', '1493928957408448563'];
    return adminIds.includes(userId);
}

async function clearBotMessagesInChannel(channel: TextChannel, limit: number = 50) {
    try {
        const messages = await channel.messages.fetch({ limit }).catch(() => null);
        if (messages) {
            for (const [_, msg] of messages) {
                if (msg.author.id === client.user?.id) {
                    await msg.delete().catch(() => {});
                }
            }
        }
    } catch (e) {}
}

async function getFirstCategory(guild: any) {
    const firstCat = guild.channels.cache.find((c: any) => c.type === ChannelType.GuildCategory);
    return firstCat ? firstCat.id : undefined;
}

const initialQuotes = [
    { text: "Nie liczy się to, co robisz od czasu do czasu, ale to, co robisz codziennie.", author: "Bruce Lee" },
    { text: "Bądź jak woda przepływająca przez szczeliny. Nie bądź sztywny, a dostosujesz się do otoczenia.", author: "Bruce Lee" },
    { text: "Nie ukrywaj porażki, ucz się z niej i idź naprzód.", author: "Bruce Lee" }
];

async function seedQuotesIfNeeded() {
    try {
        const count = await QuoteModel.countDocuments();
        if (count === 0) {
            await QuoteModel.insertMany(initialQuotes);
        }
    } catch (e) {
        console.error('Błąd inicjalizacji cytatów:', e);
    }
}

// === AUTOMATYCZNY SYSTEM SPRAWDZANIA STATUSU TWITCH (TWITCH API) ===
const twitchLiveStatus: { [key: string]: boolean } = {
    languspjn: false,
    elladermusic: false
};

const twitchStreamStartTimes: { [key: string]: number } = {};

let twitchAppAccessToken: string | null = null;
let twitchTokenExpiresAt: number = 0;

async function getTwitchAppAccessToken() {
    if (twitchAppAccessToken && Date.now() < twitchTokenExpiresAt) {
        return twitchAppAccessToken;
    }
    const clientId = process.env.TWITCH_CLIENT_ID;
    const clientSecret = process.env.TWITCH_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;

    try {
        const res = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`, {
            method: 'POST'
        });
        const data = await res.json() as any;
        if (data && data.access_token) {
            twitchAppAccessToken = data.access_token;
            twitchTokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000;
            return twitchAppAccessToken;
        }
    } catch (e) {
        console.error('Błąd pobierania tokena Twitch OAuth:', e);
    }
    return null;
}

async function checkTwitchLiveStatuses() {
    const clientId = process.env.TWITCH_CLIENT_ID;
    if (!clientId) return;

    const token = await getTwitchAppAccessToken();
    if (!token) return;

    for (const [key, conf] of Object.entries(NOTIF_CONFIG)) {
        if (key === 'leaveLogChannelId') continue;
        const streamerConfig = conf as { channelId: string; twitchUsername: string; voiceChannelIdToRename: string | null };
        const username = streamerConfig.twitchUsername;
        if (!username) continue;

        try {
            const res = await fetch(`https://api.twitch.tv/helix/streams?user_login=${username}`, {
                headers: {
                    'Client-ID': clientId,
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await res.json() as any;
            if (!data || !data.data) continue;

            const isLive = data.data.length > 0;
            const streamInfo = isLive ? data.data[0] : null;
            const wasLive = twitchLiveStatus[key] || false;

            if (isLive && !wasLive) {
                twitchLiveStatus[key] = true;
                twitchStreamStartTimes[key] = Date.now();
                const title = streamInfo.title || 'Transmisja na żywo';
                const streamUrl = `https://twitch.tv/${username}`;
                const thumbnail = streamInfo.thumbnail_url ? streamInfo.thumbnail_url.replace('{width}', '1280').replace('{height}', '720') : undefined;

                await sendNotification(key as 'languspjn' | 'elladermusic', 'twitch', title, streamUrl, thumbnail);

                if (streamerConfig.voiceChannelIdToRename) {
                    for (const [_, guild] of client.guilds.cache) {
                        const channel = await guild.channels.fetch(streamerConfig.voiceChannelIdToRename).catch(() => null);
                        if (channel) {
                            await channel.setName(`🟢・ᴛᴡɪᴛᴄʜ-ᴏɴʟɪɴᴇ`).catch(() => {});
                        }
                    }
                }
            } else if (!isLive && wasLive) {
                twitchLiveStatus[key] = false;

                try {
                    const channel = await client.channels.fetch(streamerConfig.channelId).catch(() => null) as TextChannel;
                    if (channel) {
                        const startTime = twitchStreamStartTimes[key];
                        let durationText = 'Nieznany czas';
                        if (startTime) {
                            const diffMs = Date.now() - startTime;
                            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                            const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                            durationText = `${diffHours} godz. ${diffMins} min.`;
                        }

                        const summaryEmbed = new EmbedBuilder()
                            .setColor(0x9146FF)
                            .setTitle('📊 Podsumowanie Transmisji na Żywo')
                            .setDescription(
                                `Transmisja użytkownika **${username === 'languspjn' ? 'LangusPJN' : 'elladerMusic'}** dobiegła końca!\n\n` +
                                `⏱️ **Czas trwania streama:** \`${durationText}\`\n\n` +
                                `Dziękujemy wszystkim za obecność i wspólnie spędzony czas! ❤️`
                            )
                            .setImage(LIVE_IMAGE_URL)
                            .setTimestamp()
                            .setFooter({ text: 'PJN & LangusTwitch • Podsumowanie Streama' });

                        await channel.send({ embeds: [summaryEmbed] });
                    }
                } catch (summaryErr) {
                    console.error('Błąd wysyłania podsumowania streama:', summaryErr);
                }

                if (streamerConfig.voiceChannelIdToRename) {
                    for (const [_, guild] of client.guilds.cache) {
                        const channel = await guild.channels.fetch(streamerConfig.voiceChannelIdToRename).catch(() => null);
                        if (channel) {
                            await channel.setName(`🟣・ᴛᴡɪᴛᴄʜ-ᴏғғʟɪɴᴇ`).catch(() => {});
                        }
                    }
                }
            }
        } catch (err) {
            console.error(`Błąd sprawdzania statusu Twitch dla ${username}:`, err);
        }
    }
}

function startTwitchMonitorCron() {
    cron.schedule('*/2 * * * *', async () => {
        await checkTwitchLiveStatuses();
    });
}

// === SYSTEM AUTOMATYCZNYCH DARMOWYCH GIER (EPIC GAMES & STEAM) ===
async function sendFreeGamesNotification() {
    try {
        const channel = await client.channels.fetch(FREE_GAMES_CHANNEL_ID).catch(() => null) as TextChannel;
        if (!channel) return;

        await clearBotMessagesInChannel(channel, 50);

        let epicGamesListText = '• Sprawdź aktualne darmowe gry w sklepie Epic Games.';
        let epicGameUrl = 'https://store.epicgames.com/en-US/free-games';

        try {
            const res = await fetch('https://store-site-backend-static-ipv4.ak.epicgames.com/freeGamesPromotions?locale=en-US&country=US&allowCountries=US');
            const data = await res.json() as any;
            const elements = data?.data?.Catalog?.searchStore?.elements;

            if (elements && elements.length > 0) {
                const freeNowGames = elements.filter((game: any) => {
                    const promotions = game.promotions?.promotionalOffers;
                    if (!promotions || promotions.length === 0) return false;
                    const offers = promotions[0]?.promotionalOffers;
                    if (!offers || offers.length === 0) return false;
                    
                    const startDate = new Date(offers[0].startDate).getTime();
                    const endDate = new Date(offers[0].endDate).getTime();
                    const now = Date.now();
                    const discount = offers[0].discountSetting?.discountPercentage;

                    return discount === 0 && startDate <= now && now <= endDate;
                });

                if (freeNowGames.length > 0) {
                    epicGamesListText = freeNowGames.map((g: any) => {
                        const title = g.title || 'Darmowa gra';
                        const slug = g.productSlug || g.catalogNs?.mappings?.[0]?.pageSlug;
                        const link = slug ? `https://store.epicgames.com/en-US/p/${slug}` : 'https://store.epicgames.com/en-US/free-games';
                        return `• **${title}** — [pobierz](${link})`;
                    }).join('\n');
                }
            }
        } catch (e) {
            console.error('Błąd pobierania danych Epic Games API:', e);
        }

        const epicEmbed = new EmbedBuilder()
            .setColor(0x2A2A2A)
            .setTitle('🎮 Darmowa Gra w Epic Games Store')
            .setDescription(
                'Odbierz aktualne darmowe gry w sklepie Epic Games na stałe do swojego konta!\n\n' +
                '🎁 **Aktualnie darmowe tytuły:**\n' +
                `${epicGamesListText}\n\n` +
                '🔗 [Przejdź do Epic Games Store](https://store.epicgames.com/en-US/free-games)'
            )
            .setImage(LIVE_IMAGE_URL)
            .setTimestamp()
            .setFooter({ text: 'PJN Darmowe Gry • Epic Games' });

        const steamEmbed = new EmbedBuilder()
            .setColor(0x1B2838)
            .setTitle('🎮 Darmowe Gry / Promocje na Steam')
            .setDescription(
                'Sprawdź najnowsze darmowe gry, wersje próbne oraz darmowe dodatki (DLC) dostępne obecnie na platformie Steam.\n\n' +
                '• Zobacz pełną listę darmowych produkcji: [pobierz / sprawdź](https://store.steampowered.com/genre/Free%20to%20Play/)\n\n' +
                '🔗 [Przejdź do Steam Free to Play](https://store.steampowered.com/genre/Free%20to%20Play/)'
            )
            .setImage(LIVE_IMAGE_URL)
            .setTimestamp()
            .setFooter({ text: 'PJN Darmowe Gry • Steam' });

        const epicRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setLabel('Odbierz w Epic Games').setStyle(ButtonStyle.Link).setURL(epicGameUrl).setEmoji('🛒')
        );

        const steamRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setLabel('Przejdź do Steam F2P').setStyle(ButtonStyle.Link).setURL('https://store.steampowered.com/genre/Free%20to%20Play/').setEmoji('🎮')
        );

        await channel.send({
            content: '@everyone Świeża dostawa informacji o **darmowych grach** z Epic Games i Steam jest już dostępna!',
            embeds: [epicEmbed, steamEmbed],
            components: [epicRow, steamRow],
            allowedMentions: { parse: ['everyone'] }
        });
    } catch (err) {
        console.error('Błąd podczas wysyłania darmowych gier:', err);
    }
}

// === SYSTEM POWITANIA NOWYCH UŻYTKOWNIKÓW Z PREZENTEM 200 COINSÓW ===
client.on('guildMemberAdd', async member => {
    try {
        const guild = member.guild;
        const channel = await guild.channels.fetch(ID_KANALU_POWITANIA_NOWYCH).catch(() => null) as TextChannel;
        if (!channel) return;

        let user = await UserModel.findOne({ userId: member.id });
        if (!user) {
            user = await UserModel.create({ userId: member.id, balance: 200 });
        } else {
            user.balance += 200;
            await user.save();
        }

        await TransactionHistoryModel.create({
            userId: client.user?.id || 'system',
            targetUserId: member.id,
            type: 'admin_add',
            amount: 200,
            details: 'Prezent na start za dołączenie do serwera'
        });

        const welcomeEmbed = new EmbedBuilder()
            .setColor(0x9B59B6)
            .setTitle('🎉 Witamy na serwerze PJN!')
            .setDescription(
                `Witaj <@${member.id}>! Cieszymy się, że dołączyłeś do naszej społeczności. 🚀\n\n` +
                `🎁 **Na start otrzymujesz w prezencie 200 PJN-Coins!**\n\n` +
                `🎛️ **Centrum Dowodzenia • Od tego możesz zacząć 👇**\n` +
                `• Zweryfikuj się i wybierz płeć: <#${ID_KANAL_WERYFIKACJI}>\n` +
                `• Dostosuj role: <#${ID_KANAL_RANG}>\n` +
                `• Szukaj do gry: <#${ID_KANALU_SZUKAM_DO_GRY}>`
            )
            .setThumbnail(member.user.displayAvatarURL())
            .setImage(LIVE_IMAGE_URL)
            .setTimestamp()
            .setFooter({ text: 'PJN System Powitań' });

        await channel.send({
            content: `🎉 Witamy na serwerze PJN!\nWitaj <@${member.id}>! Cieszymy się, że dołączyłeś do naszej społeczności. 🚀`,
            embeds: [welcomeEmbed],
            allowedMentions: { users: [member.id] }
        });
    } catch (err) {
        console.error('Błąd podczas powitania nowego użytkownika:', err);
    }
});

async function setupRussianRouletteChannel() {
    try {
        const channel = await client.channels.fetch('1549791536336732240').catch(() => null) as TextChannel;
        if (!channel) return;
        await clearBotMessagesInChannel(channel, 50);

        const embed = new EmbedBuilder()
            .setColor(0xE74C3C)
            .setTitle('🎯 Rosyjska Ruletka • Strefa Ryzyka PJN')
            .setDescription(
                'Masz odwagę zaryzykować swoje PJN-Coins?\n\n' +
                '🔫 **Zasady:**\n' +
                '• W bębnie rewolweru jest 1 kula na 6 komór.\n' +
                '• Kliknij przycisk poniżej, podaj stawkę i pociągnij za spust!\n' +
                '• Im wyższa stawka, tym większe ryzyko trafienia na kulę!\n' +
                '• Jeśli przeżyjesz, podwajasz swoją stawkę (**x2**). Jeśli trafiłeś na kulę – tracisz postawione monety!'
            )
            .setImage(LIVE_IMAGE_URL)
            .setTimestamp();

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('rr_start_modal').setLabel('Zagraj w Rosyjską Ruletkę').setStyle(ButtonStyle.Danger).setEmoji('🎯')
        );

        await channel.send({ embeds: [embed], components: [row] });
    } catch (e) {}
}

async function setupWheelOfFortuneChannel() {
    try {
        const channel = await client.channels.fetch('1549791621942485120').catch(() => null) as TextChannel;
        if (!channel) return;
        await clearBotMessagesInChannel(channel, 50);

        const embed = new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle('🎡 Koło Fortuny • Strefa Nagród PJN')
            .setDescription(
                'Zakręć wirtualnym Kołem Fortuny i wygrywaj cenne nagrody w PJN-Coins lub trafiaj na bonusy!\n\n' +
                '✨ **Zasady:**\n' +
                '• Kliknij przycisk poniżej, aby zakręcić kołem.\n' +
                '• Możesz kręcić **raz na 2 godziny**!\n' +
                '• Do wygrania: darmowe monety, mnożniki, a czasem... bankrut! Powodzenia!'
            )
            .setImage(LIVE_IMAGE_URL)
            .setTimestamp();

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('wheel_spin').setLabel('Zakręć Kołem Fortuny!').setStyle(ButtonStyle.Success).setEmoji('🎡')
        );

        await channel.send({ embeds: [embed], components: [row] });
    } catch (e) {}
}

async function setupCasinoHubChannel() {
    try {
        const channel = await client.channels.fetch('1534060126980411423').catch(() => null) as TextChannel;
        if (!channel) return;
        await clearBotMessagesInChannel(channel, 50);

        const embed = new EmbedBuilder()
            .setColor(0x9B59B6)
            .setTitle('🕹️ Salon Gier i Kasyno PJN — Dostępne Gry')
            .setDescription(
                'Witaj w oficjalnym salonie gier! Poniżej znajdziesz pełną listę wszystkich dostępnych gier i komend, w których możesz pomnożyć swoje PJN-Coins:\n\n' +
                '🎰 **1. Quiz z nagrodami**\n> Komenda: `/quiz-gra` — Odpowiadaj na losowe pytania i zdobywaj monety!\n\n' +
                '✂️ **2. Kamień, Papier, Nożyce**\n> Komenda: `/kpn [wybór] [stawka]` — Klasyczny pojedynek z botem 1v1.\n\n' +
                '🎲 **3. Rzut Kością**\n> Komenda: `/kostka [stawka]` — Sprawdź swój los w rzucie kostką.\n\n' +
                '🪙 **4. Orzeł czy Reszka**\n> Komenda: `/moneta [wybór] [stawka]` — Obstaw stronę monety.\n\n' +
                '🎰 **5. Maszyna Slotová (Jednoręki Bandyta)**\n> Komenda: `/slot [stawka]`\n\n' +
                '🃏 **6. Poker**\n> Komenda: `/poker [tryb] [stawka]`\n\n' +
                '🎯 **7. Rosyjska Ruletka**\n> Kanał specjalny: <#1549791536336732240> — Ryzykuj stawkę w rewolwerze!\n\n' +
                '🎡 **8. Koło Fortuny**\n> Kanał specjalny: <#1549791621942485120> — Kręć kołem co 2 godziny i wygrywaj darmowe nagrody!'
            )
            .setImage(LIVE_IMAGE_URL)
            .setTimestamp()
            .setFooter({ text: 'PJN Kasyno & Arcade • Powodzenia w grach!' });

        await channel.send({ embeds: [embed] });
    } catch (e) {}
}

async function setupVerificationChannel() {
    try {
        const channel = await client.channels.fetch(ID_KANAL_WERYFIKACJI).catch(() => null) as TextChannel;
        if (!channel) return;
        await clearBotMessagesInChannel(channel, 50);

        const embed = new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle('🛡️ Weryfikacja i Wybór Płci • PJN Community')
            .setDescription(
                'Witaj na serwerze! Aby uzyskać dostęp do całej społeczności, musisz przejść prostą i obowiązkową weryfikację.\n\n' +
                '👇 **Wybierz swoją płeć w menu rozwijanym poniżej:**\n' +
                '• Wybór odpowiedniej opcji automatycznie nada Ci rangę członkowską oraz odblokuje kanały na serwerze.'
            )
            .setImage(LIVE_IMAGE_URL)
            .setTimestamp()
            .setFooter({ text: 'PJN System Weryfikacji' });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('verification_gender_select')
            .setPlaceholder('Wybierz swoją płeć, aby się zweryfikować...')
            .addOptions([
                {
                    label: 'Mężczyzna',
                    description: 'Wybierz, aby otrzymać rangę męską i zweryfikować konto',
                    value: 'verify_male',
                    emoji: '👦'
                },
                {
                    label: 'Kobieta',
                    description: 'Wybierz, aby otrzymać rangę damską i zweryfikować konto',
                    value: 'verify_female',
                    emoji: '👧'
                }
            ]);

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
        const sentMsg = await channel.send({ embeds: [embed], components: [row] });
        await sentMsg.pin().catch(() => {});
    } catch (e) {
        console.error('Błąd inicjalizacji kanału weryfikacji:', e);
    }
}

async function updateServerStats(guild: any) {
    try {
        await guild.members.fetch();

        const onlineCount = guild.members.cache.filter((m: any) => m.presence && m.presence.status !== 'offline').size;
        const onlineChannel = guild.channels.cache.get(STATS_CHANNELS.ONLINE);
        if (onlineChannel && onlineChannel.isVoiceBased()) {
            await onlineChannel.setName(`🟢 Online: ${onlineCount}`).catch(() => {});
        }

        const fnCount = guild.members.cache.filter((m: any) => {
            if (!m.presence || !m.presence.activities) return false;
            return m.presence.activities.some((act: any) => act.name && act.name.toLowerCase().includes('fortnite'));
        }).size;
        const fnChannel = guild.channels.cache.get(STATS_CHANNELS.FORTNITE);
        if (fnChannel && fnChannel.isVoiceBased()) {
            await fnChannel.setName(`🎮 Gracze Fortnite: ${fnCount}`).catch(() => {});
        }

        const totalUsers = guild.memberCount;
        const usersChannel = guild.channels.cache.get(STATS_CHANNELS.USERS);
        if (usersChannel && usersChannel.isVoiceBased()) {
            await usersChannel.setName(`👥 PJN Users: ${totalUsers}`).catch(() => {});
        }
    } catch (err) {
        console.error('Błąd podczas aktualizacji dynamicznych statystyk:', err);
    }
}

function startServerStatsCron() {
    setInterval(async () => {
        for (const [_, guild] of client.guilds.cache) {
            await updateServerStats(guild);
        }
    }, 5 * 60 * 1000);
}

async function sendQuoteToChannel(channelId: string) {
    const channel = await client.channels.fetch(channelId).catch(() => null) as TextChannel;
    if (!channel) return false;

    const count = await QuoteModel.countDocuments();
    if (count === 0) return false;

    const random = Math.floor(Math.random() * count);
    const quote = await QuoteModel.findOne().skip(random);
    if (!quote) return false;

    const embed = new EmbedBuilder()
        .setColor(0xE67E22)
        .setTitle('✨ Życiowa myśl na dzisiejszy poranek')
        .setDescription(`> *„${quote.text}”*\n\n**—${quote.author}**`)
        .setTimestamp()
        .setFooter({ text: 'PJN Codzienne Cytaty' });

    await channel.send({ 
        content: '@everyone Życiowa myśl na dzisiejszy poranek:', 
        embeds: [embed],
        allowedMentions: { parse: ['everyone'] } 
    });
      
    return true;
}

function startDailyQuotes() {
    cron.schedule('30 5 * * *', async () => {
        try {
            await sendQuoteToChannel(ID_KANALU_CYTATY);
        } catch (err) {
            console.error('Błąd podczas wysyłania codziennego cytatu:', err);
        }
    });
}

function startDailyShopAutoPoster() {
    cron.schedule('5 2 * * *', async () => {
        try {
            const channel = await client.channels.fetch(ID_KANAL_FORTNITE).catch(() => null) as TextChannel;
            if (!channel) return;
            await clearBotMessagesInChannel(channel, 50);

            const res = await fetch('https://fortnite-api.com/v2/shop', {
                headers: {
                    'Authorization': process.env.FORTNITE_API_KEY || ''
                }
            });
            const data = await res.json() as any;

            const embed = new EmbedBuilder()
                .setColor(0x00D9FF)
                .setTitle('🛒 Codzienny Sklep Fortnite (Automatyczny Reset)')
                .setDescription('Świeża dostawa przedmiotów w dzisiejszym sklepie Fortnite!')
                .setImage(LIVE_IMAGE_URL)
                .setTimestamp()
                .setFooter({ text: 'PJN Fortnite Shop • Fortnite-API.com' });

            if (data && data.status === 200 && data.data && data.data.entries) {
                const entries = data.data.entries.slice(0, 10);
                let desc = 'Najciekawsze pozycje z nowego resetu:\n\n';
                for (const entry of entries) {
                    const rawName = entry.items?.[0]?.name 
                        || entry.bundle?.name 
                        || entry.devName 
                        || entry.track?.title 
                        || 'Oferta Specjalna Fortnite';

                    const itemName = rawName
                        .replace(/^\[VIRTUAL\]\d+\s*x\s*/i, '')
                        .replace(/\s*for\s*-?\d+\s*MtxCurrency/i, '')
                        .trim();

                    const price = entry.finalPrice || entry.regularPrice || 'N/D';
                    desc += `• **${itemName}** — 🪙 \`${price} V-Bucks\`\n`;
                }
                embed.setDescription(desc);
            }

            await channel.send({ embeds: [embed] });
        } catch (err) {
            console.error('Błąd podczas automatycznego wysyłania sklepu Fortnite:', err);
        }
    });
}

let lastFortniteEventId: string | null = null;
let lastFortniteServerStatus: boolean | null = null;
let lastFortniteVersion: string | null = null;

async function setupFortniteUpdateChannel() {
    try {
        const channel = await client.channels.fetch(ID_KANAL_AKTUALIZACJI_FORTNITE).catch(() => null) as TextChannel;
        if (!channel) return;
        await clearBotMessagesInChannel(channel, 50);

        const embed = new EmbedBuilder()
            .setColor(0x00D9FF)
            .setTitle('🚀 Centrum Powiadomień o Aktualizacjach i Eventach Fortnite')
            .setDescription(
                'Ten kanał służy jako oficjalna tablica informacyjna dla graczy Fortnite.\n\n' +
                '🤖 **Co tutaj znajdziesz?**\n' +
                '• 📢 **Informacje o nadchodzących aktualizacjach i wersjach gry wraz z opisem**.\n' +
                '• 🟢/🔴 **Powiadomienia o statusie serwerów (przerwy techniczne)**.\n' +
                '• ✨ **Informacje o nowych eventach w Fortnite** z oznaczeniem odpowiedniej rangi!\n\n' +
                '🔔 *Kliknij poniższy przycisk, aby włączyć lub wyłączyć powiadomienia (rangę <@&' + ID_RANGI_AKTUALIZACJE_FORTNITE + '>)!*'
            )
            .setImage(LIVE_IMAGE_URL)
            .setTimestamp()
            .setFooter({ text: 'PJN System Monitorowania Fortnite' });

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId('role_fn_updates_toggle')
                .setLabel('Przełącz rangę powiadomień Fortnite')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🔔')
        );

        const sentMsg = await channel.send({ embeds: [embed], components: [row] });
        await sentMsg.pin().catch(() => {});
    } catch (e) {
        console.error('Błąd inicjalizacji panelu aktualizacji Fortnite:', e);
    }
}

async function checkFortniteServerStatus() {
    try {
        const channel = await client.channels.fetch(ID_KANAL_AKTUALIZACJI_FORTNITE).catch(() => null) as TextChannel;
        if (!channel) return;

        const rolePing = `<@&${ID_RANGI_AKTUALIZACJE_FORTNITE}>`;

        // Sprawdzanie statusu serwerów i wersji gry
        const statusRes = await fetch('https://fortnite-api.com/v1/status');
        if (statusRes.ok) {
            const statusData = await statusRes.json() as any;
            if (statusData && statusData.status === 200 && statusData.data) {
                const isOnline = statusData.data.serviceConnected ?? true;
                const currentVersion = statusData.data.version;

                // Wykrywanie nowej wersji gry
                if (currentVersion && currentVersion !== lastFortniteVersion) {
                    if (lastFortniteVersion !== null) {
                        const updateEmbed = new EmbedBuilder()
                            .setColor(0x00D9FF)
                            .setTitle(`🚀 Nowa Aktualizacja Fortnite — Wersja v${currentVersion}`)
                            .setDescription(
                                `Wprowadzono oficjalny update gry!\n\n` +
                                `📋 **Czego dotyczy aktualizacja:**\n` +
                                `• Wydano łatkę systemową i nową wersję \`v${currentVersion}\`.\n` +
                                `• Aktualizacja wprowadza poprawki błędów stabilności oraz przygotowuje zawartość w grze.\n` +
                                `• *Wskocz do gry, pobierz paczkę i sprawdź nowości na mapie!*`
                            )
                            .setImage(LIVE_IMAGE_URL)
                            .setTimestamp()
                            .setFooter({ text: 'PJN Fortnite Updates & Patch Notes' });

                        await channel.send({
                            content: `${rolePing} 📢 Pojawiła się **nowa aktualizacja** w Fortnite (v${currentVersion})!`,
                            embeds: [updateEmbed],
                            allowedMentions: { roles: [ID_RANGI_AKTUALIZACJE_FORTNITE] }
                        });
                    }
                    lastFortniteVersion = currentVersion;
                }

                // Wykrywanie zmiany statusu serwera (Online <-> Offline)
                if (lastFortniteServerStatus !== null && lastFortniteServerStatus !== isOnline) {
                    const serverEmbed = new EmbedBuilder()
                        .setColor(isOnline ? 0x2ECC71 : 0xE74C3C)
                        .setTitle(isOnline ? '🟢 Serwery Fortnite zostały OTWARTE!' : '🔴 Serwery Fortnite zostały ZAMKNIĘTE!')
                        .setDescription(
                            isOnline 
                                ? 'Przerwa techniczna dobiegła końca. Serwery są ponownie dostępne, możesz dołączać do gier!' 
                                : 'Rozpoczęła się przerwa techniczna lub wdrażanie nowej aktualizacji. Trwa wyłączanie usług gry.'
                        )
                        .setTimestamp()
                        .setFooter({ text: 'PJN Fortnite Server Status' });

                    await channel.send({
                        content: `${rolePing} 🔔 Status serwerów Fortnite uległ zmianie!`,
                        embeds: [serverEmbed],
                        allowedMentions: { roles: [ID_RANGI_AKTUALIZACJE_FORTNITE] }
                    });
                }
                lastFortniteServerStatus = isOnline;
            }
        }

        // Sprawdzanie eventów Fortnite
        const res = await fetch('https://fortnite-api.com/v2/events', {
            headers: { 'Authorization': process.env.FORTNITE_API_KEY || '' }
        });
        if (!res.ok) return;
        const data = await res.json() as any;

        if (!data || !data.data || !data.data.events) return;

        const events = data.data.events;
        if (events.length === 0) return;

        const latestEvent = events[0];
        const eventId = latestEvent.id || latestEvent.name;

        if (eventId !== lastFortniteEventId) {
            lastFortniteEventId = eventId;
            const eventName = latestEvent.name || 'Nowy Event w Fortnite';
            const eventDesc = latestEvent.shortDescription || latestEvent.description || 'Sprawdź szczegóły w grze!';

            const embed = new EmbedBuilder()
                .setColor(0x9B59B6)
                .setTitle(`🎉 Nowy Event w Fortnite: ${eventName}`)
                .setDescription(`📋 **Opis wydarzenia:**\n${eventDesc}\n\n*Wskocz do gry i sprawdź najnowszą zawartość oraz wyzwania!*`)
                .setImage(LIVE_IMAGE_URL)
                .setTimestamp()
                .setFooter({ text: 'Fortnite Events • API' });

            await channel.send({
                content: `${rolePing} 📢 Pojawił się nowy event w Fortnite!`,
                embeds: [embed],
                allowedMentions: { roles: [ID_RANGI_AKTUALIZACJE_FORTNITE] }
            });
        }
    } catch (err) {
        console.error('Błąd podczas sprawdzania statusu i eventów Fortnite:', err);
    }
}

function startFortniteStatusCron() {
    cron.schedule('*/5 * * * *', async () => {
        await checkFortniteServerStatus();
    });
}

async function updateAllFortniteStats() {
    const users = await UserModel.find({ epicNick: { $ne: null } });
    for (const u of users) {
        try {
            const res = await fetch(`https://fortnite-api.com/v2/stats/br/v2?name=${encodeURIComponent(u.epicNick!)}`, {
                headers: { 'Authorization': process.env.FORTNITE_API_KEY || '' }
            });
            const data = await res.json() as any;
            if (data && data.status === 200 && data.data && data.data.stats) {
                const overall = data.data.stats.all?.overall || {};
                u.fortniteKills = overall.kills || 0;
                u.matchesPlayed = overall.matches || 0;
                u.estimatedPlaytimeHours = Math.round(u.matchesPlayed * 0.25);
                await u.save();
            }
        } catch (e) {}
    }
}

async function generateFortniteRankingEmbeds(guild: any, topUsers: any[], categoryTitle: string, categoryColor: number, page: number = 0) {
    const pageSize = 10;
    const totalPages = Math.ceil(topUsers.length / pageSize) || 1;
    const currentPage = Math.max(0, Math.min(page, totalPages - 1));
    const slice = topUsers.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

    let desc = `Zabójstwa graczy z naszego serwera (analiza na podstawie meczów).\nAktualizowane automatycznie co 24h.\n\n`;
      
    if (slice.length === 0) {
        desc += `Brak zarejestrowanych graczy w tej kategorii.`;
    } else {
        for (let idx = 0; idx < slice.length; idx++) {
            const u = slice[idx];
            const globalIdx = currentPage * pageSize + idx;
            const medal = globalIdx === 0 ? '🥇' : globalIdx === 1 ? '🥈' : globalIdx === 2 ? '🥉' : `**${globalIdx + 1}.**`;
              
            let displayName = `<@${u.userId}>`;
            if (guild) {
                try {
                    const member = await guild.members.fetch(u.userId).catch(() => null);
                    if (member) {
                        displayName = member.displayName;
                    }
                } catch (e) {}
            }

            desc += `${medal} — **${displayName}** (${u.epicNick}) — **${u.fortniteKills || 0} zabójstw** | Meczów: \`${u.matchesPlayed || 0}\` *(Szac. czasu: ~${u.estimatedPlaytimeHours || 0}h)*\n`;
        }
    }

    const embed = new EmbedBuilder()
        .setColor(categoryColor)
        .setTitle(`${categoryTitle} (Strona ${currentPage + 1}/${totalPages})`)
        .setDescription(desc)
        .setImage(LIVE_IMAGE_URL)
        .setTimestamp()
        .setFooter({ text: 'PJN Fortnite Ranking • Automatyczny system' });

    const prefixId = categoryTitle.includes('Początkujący') ? 'fn_rank_under' : 'fn_rank_over';
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`${prefixId}_prev_${currentPage}`)
            .setLabel('⬅️ Wstecz')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(currentPage === 0),
        new ButtonBuilder()
            .setCustomId(`${prefixId}_next_${currentPage}`)
            .setLabel('Dalej ➡️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(currentPage >= totalPages - 1)
    );

    return { embeds: [embed], components: [row] };
}

async function refreshFortniteRankingMessage(guild: any) {
    try {
        const channel = await guild.channels.fetch(ID_KANAL_RANKING_FORTNITE).catch(() => null) as TextChannel;
        if (!channel) return;

        await clearBotMessagesInChannel(channel, 50);
        await updateAllFortniteStats();

        const underUsers = await UserModel.find({ epicNick: { $ne: null }, matchesPlayed: { $lt: 2800 } }).sort({ fortniteKills: -1 }).limit(100);
        const payloadUnder = await generateFortniteRankingEmbeds(guild, underUsers, '🟢 TOP • Początkujący (<2800 meczów)', 0x2ECC71, 0);
        await channel.send(payloadUnder);

        const overUsers = await UserModel.find({ epicNick: { $ne: null }, matchesPlayed: { $gte: 2800 } }).sort({ fortniteKills: -1 }).limit(100);
        const payloadOver = await generateFortniteRankingEmbeds(guild, overUsers, '🔥 TOP • Weterani (2800+ meczów)', 0xE74C3C, 0);
        await channel.send(payloadOver);

    } catch (e) {
        console.error('Błąd podczas odświeżania rankingu Fortnite:', e);
    }
}

function startFortniteRankingCron() {
    cron.schedule('0 0 * * *', async () => {
        for (const [_, guild] of client.guilds.cache) {
            await refreshFortniteRankingMessage(guild);
        }
    });
}

function startExpirationChecker() {
    cron.schedule('0 * * * *', async () => {
        try {
            const now = new Date();
            const expiredUsers = await UserModel.find({
                $or: [
                    { vipExpiresAt: { $ne: null, $lte: now } },
                    { doubleChanceUntil: { $ne: null, $lte: now } },
                    { dailyBoostUntil: { $ne: null, $lte: now } },
                    { customRoleExpiresAt: { $ne: null, $lte: now } },
                    { customVoiceExpiresAt: { $ne: null, $lte: now } },
                    { guaranteedWinUntil: { $ne: null, $lte: now } }
                ]
            });

            for (const userDoc of expiredUsers) {
                if (userDoc.guaranteedWinUntil && new Date(userDoc.guaranteedWinUntil) <= now) {
                    userDoc.guaranteedWinUntil = null;
                    await userDoc.save();
                }

                for (const [_, guild] of client.guilds.cache) {
                    const member = await guild.members.fetch(userDoc.userId).catch(() => null);
                    if (!member) continue;

                    if (userDoc.vipExpiresAt && new Date(userDoc.vipExpiresAt) <= now) {
                        if (member.roles.cache.has(ID_ROLI_VIP)) {
                            await member.roles.remove(ID_ROLI_VIP).catch(() => {});
                        }
                        userDoc.vipExpiresAt = null;
                        await userDoc.save();

                        await member.send({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor(0xE74C3C)
                                    .setTitle('⏰ Twoja ranga VIP wygasła')
                                    .setDescription('Minął okres 30 dni ważności Twojej rangi **VIP**. Ranga została automatycznie usunięta z Twojego konta. Możesz ją w każdej chwili odnowić w sklepie serwerowym!')
                                    .setTimestamp()
                            ]
                        }).catch(() => {});
                    }

                    if (userDoc.doubleChanceUntil && new Date(userDoc.doubleChanceUntil) <= now) {
                        userDoc.doubleChanceUntil = null;
                        await userDoc.save();
                    }

                    if (userDoc.dailyBoostUntil && new Date(userDoc.dailyBoostUntil) <= now) {
                        userDoc.dailyBoostUntil = null;
                        await userDoc.save();
                    }
                }
            }
        } catch (err) {
            console.error('Błąd w cronie sprawdzającym wygasające usługi:', err);
        }
    });
}

function startPollChecker() {
    setInterval(async () => {
        try {
            const now = new Date();
            const activePolls = await PollModel.find({ ended: false, endsAt: { $ne: null, $lte: now } });

            for (const poll of activePolls) {
                poll.ended = true;
                await poll.save();

                for (const [_, guild] of client.guilds.cache) {
                    const channel = await guild.channels.fetch(poll.channelId).catch(() => null) as TextChannel;
                    if (channel) {
                        const message = await channel.messages.fetch(poll.messageId).catch(() => null);
                        if (message) {
                            const totalVotes = poll.votes.reduce((acc, curr) => acc + curr.length, 0);
                            let desc = `🔒 **ANKIETA ZAKOŃCZONA**\n\n`;
                            for (let i = 0; i < poll.options.length; i++) {
                                const count = poll.votes[i].length;
                                const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                                desc += `**${i + 1}.${poll.options[i]}** — **${percent}\%** (${count} głosów)\n`;
                            }

                            const embed = new EmbedBuilder()
                                .setColor(0xE74C3C)
                                .setTitle(`🗳️ ${poll.question} (Wyniki końcowe)`)
                                .setDescription(desc)
                                .setTimestamp();

                            const adminRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                                new ButtonBuilder().setCustomId('poll_show_voters').setLabel('🔍 Kto głosował? (Admin)').setStyle(ButtonStyle.Primary)
                            );

                            await message.edit({ embeds: [embed], components: [adminRow] }).catch(() => {});
                            break;
                        }
                    }
                }
            }
        } catch (e) {}
    }, 15 * 1000);
}

function createOgłoszenieEmbed() {
    return new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle('🌟 Witamy na PJN Server!')
        .setDescription(
            'Cieszymy się, że jesteś częścią naszej społeczności! Pamiętaj, aby regularnie wspierać nasze projekty i śledzić oficjalne profile streamingowe:\n\n' +
            '🔗 **Twitch**\n[twitch.tv/languspjn](https://twitch.tv/languspjn)\n\n' +
            '🔗 **TikTok**\n[tiktok.com/@languspjn](https://tiktok.com/@languspjn)\n\n' +
            '💡 **Społeczność**\n' +
            'Zostaw po sobie ślad, zaproś znajomych na nasz serwer Discord i buduj z nami najlepszą społeczność w sieci! 🚀\n\n' +
            '*Życzymy aby Twoja obecność na naszym serwerze przebiegła jak najlepiej - LangusPJN i ellader*'
        )
        .setImage(LIVE_IMAGE_URL)
        .setTimestamp()
        .setFooter({ text: 'PJN System Ogłoszeń' });
}

function createBadgesInfoEmbeds() {
    const embed1 = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle('🛡️ Centrum Odznak i Osiągnięć PJN (Część 1)')
        .setDescription(
            'Witaj w oficjalnym systemie osiągnięć serwera! Będąc aktywnym, rozmawiając, grając w kasynie czy spędzając z nami czas, automatycznie zdobywasz unikalne odznaki w swoim profilu (`/profil`).\n\n' +
            '🔍 **Jak sprawdzić swoje odznaki?**\n' +
            'Wpisz w dowolnym kanale komendę: `/odznaki`.'
        )
        .addFields(
            {
                name: '💬 Aktywność na Chacie i Głosie',
                value: 
                    '• 💬 **Początkujący Gadulec** — 200 wiadomości\n' +
                    '• 📜 **Kronikarz Chatu** — 1 000 wiadomości\n' +
                    '• 💬 **Król Wiadomości** — 5 000 wiadomości\n' +
                    '• 🧠 **Wygadany Mędrzec** — 25 000 wiadomości\n' +
                    '• 😂 **Emotikonowy Ekspresja** — 30 emotek\n' +
                    '• 🌙 **Nocny Marek** — 50 wiadomości w nocy\n' +
                    '• 🎙️ **Stały Bywalec Mikrofonu** — 30h na głosie\n' +
                    '• 🎧 **Audiofil** — 100h na głosie\n' +
                    '• 🎙️ **Duch Kanałów Głosowych** — 500h na głosie (Elitarna)',
                inline: false
            },
            {
                name: '⭐ Poziomy i Doświadczenie',
                value: 
                    '• ⭐ **Awansowy Ekspert** — 10 poziom\n' +
                    '• 🌟 **Mistrz Poziomów** — 50 poziom (Rzadka)\n' +
                    '• 👑 **Legenda Serwera** — 100 poziom (Elitarna)',
                inline: false
            }
        )
        .setTimestamp();

    const embed2 = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle('🛡️ Centrum Odznak i Osiągnięć PJN (Część 2)')
        .addFields(
            {
                name: '💰 Gospodarka, Kasyno i Społeczność',
                value: 
                    '• 💰 **Kapitalista** — 5 000 Coinsów\n' +
                    '• 💎 **Magnat Finansowy** — 10 000 Coinsów\n' +
                    '• 🏦 **Milioner** — 100 000 Coinsów (Rzadka)\n' +
                    '• 🏛️ **Miliarder PJN** — 1 000 000 Coinsów (Elitarna)\n' +
                    '• 💸 **Hojny Darczyńca** — 5 000 w przelewach\n' +
                    '• 🤝 **Filantrop Społeczności** — 50 000 w przelewach\n' +
                    '• 🎲 **Nałogowy Graczyk** — 20 gier w kasynie\n' +
                    '• 🎰 **Ryzykant** — 100 gier (Rzadka)\n' +
                    '• 🎰 **Hazardowy Tycoon** — 500 gier\n' +
                    '• 🍀 **Ulubieniec Fortuna** — 3 wygrane z rzędu\n' +
                    '• 🔥 **Niepowstrzymana Seria** — 20 wygranych\n' +
                    '• 🎯 **Czarna Seria** — 5 przegranych\n' +
                    '• 🏷️ **Klient sklepu PJN** / 🎖️ **Zaawansowany klient**\n' +
                    '• 💡 **Filozof** (5 cytatów) • 🤝 **Pomocna Dłoń** (10 akcji)\n' +
                    '• ⏳ **Weteran Półrocza** / ⏳ **Weteran** / ⌛ **Patriarcha**\n' +
                    '• 🛡️ **Filar Społeczności** • 🎟️ **Kolekcjoner (Epicka)**',
                inline: false
            }
        )
        .setImage(LIVE_IMAGE_URL)
        .setTimestamp()
        .setFooter({ text: 'PJN System Odznak • Automatycznie aktualizowany' });

    return [embed1, embed2];
}

function createTicketPanelEmbed() {
    return new EmbedBuilder()
        .setColor(0x2ECC71)
        .setTitle('👻 Odbiór duszka / Bilet poza kolejką PJN')
        .setDescription(
            'Chcesz odebrać duszka lub skorzystać z biletu poza kolejką podczas transmisji?\n\n' +
            '👇 **Kliknij przycisk poniżej**, aby otworzyć swój prywatny kanał zgłoszeniowy z administracją!'
        )
        .setImage(LIVE_IMAGE_URL)
        .setTimestamp()
        .setFooter({ text: 'PJN System Duszków' });
}

async function setupTicketChannel() {
    try {
        const channel = await client.channels.fetch(ID_KANALU_DUSZKI).catch(() => null) as TextChannel;
        if (!channel) return;
        await clearBotMessagesInChannel(channel, 100);

        const embed = createTicketPanelEmbed();
        const button = new ButtonBuilder()
            .setCustomId('open_ghost_ticket')
            .setLabel('Otwórz zgłoszenie / Odbierz duszka')
            .setStyle(ButtonStyle.Success)
            .setEmoji('👻');

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

        const sentMsg = await channel.send({ embeds: [embed], components: [row] });
        await sentMsg.pin().catch(() => {});
    } catch (e) {
        console.error('Błąd podczas inicjalizacji panelu duszków:', e);
    }
}

async function setupCenterZgloszenChannel() {
    try {
        const channel = await client.channels.fetch(ID_KANAL_CENTRUM_ZGLOSZEN).catch(() => null) as TextChannel;
        if (!channel) return;
        await clearBotMessagesInChannel(channel, 50);

        const embed = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle('🎫 Centrum Zgłoszeń i Wsparcia PJN')
            .setDescription(
                'Witaj w oficjalnym centrum pomocy serwera PJN!\n\n' +
                'Masz problem z ekonomią, rangą, sklepem lub chcesz zgłosić sprawę administracji?\n' +
                '👇 **Wybierz kategorię swojego problemu z menu poniżej**, aby utworzyć odpowiednie zgłoszenie!'
            )
            .setImage(LIVE_IMAGE_URL)
            .setTimestamp()
            .setFooter({ text: 'PJN System Zgłoszeń' });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('ticket_category_select')
            .setPlaceholder('Wybierz kategorię problemu...')
            .addOptions([
                { label: 'Problem ze sklepem / rangą VIP', value: 'ticket_shop', emoji: '🛒', description: 'Pomoc dotycząca zakupów i usług czasowych' },
                { label: 'Sprawy ekonomiczne / Coinsy', value: 'ticket_eco', emoji: '💰', description: 'Pytania o portfel, przelewy lub kasyno' },
                { label: 'Zgłoszenie błędu / Bugu', value: 'ticket_bug', emoji: '🐛', description: 'Zgłoś błąd w działaniu bota' },
                { label: 'Kontakt z administracją', value: 'ticket_admin', emoji: '🛡️', description: 'Inne, ważniejsze sprawy wymagające uwagi administracji' }
            ]);

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
        const sentMsg = await channel.send({ embeds: [embed], components: [row] });
        await sentMsg.pin().catch(() => {});
    } catch (e) {
        console.error('Błąd inicjalizacji Centrum Zgłoszeń:', e);
    }
}

async function setupBotInteractiveChannelInstruction() {
    try {
        const channel = await client.channels.fetch(ID_KANAL_ROZMOWY_Z_BOTEM).catch(() => null) as TextChannel;
        if (!channel) return;
        await clearBotMessagesInChannel(channel, 50);

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('🤖 Wirtualny Asystent i Rozmowa z Botem PJN')
            .setDescription(
                'Masz pytania, problem lub chcesz dowiedzieć się czegoś o serwerze? Najpierw porozmawiaj z naszym Wirtualnym Asystentem!\n\n' +
                '💬 **Jak to działa?**\n' +
                'Kliknij przycisk poniżej **"Rozpocznij rozmowę / Zadaj pytanie"**. Bot pobierze wiedzę bezpośrednio z systemu i kodu serwera.\n\n' +
                '⚠️ *Jeżeli bot nie będzie w stanie pomóc, automatycznie zaproponuje Ci i otworzy prywatną rozmowę z administracją!*'
            )
            .setImage(LIVE_IMAGE_URL)
            .setTimestamp()
            .setFooter({ text: 'PJN System Interaktywnego Wsparcia' });

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId('bot_support_chat_modal')
                .setLabel('Rozpocznij rozmowę / Zadaj pytanie')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('💬')
        );

        await channel.send({ embeds: [embed], components: [row] });
    } catch (e) {
        console.error('Błąd podczas ustawiania interaktywnego bota wsparcia:', e);
    }
}

async function setupRolesChannel() {
    try {
        const channel = await client.channels.fetch(ID_KANAL_RANG).catch(() => null) as TextChannel;
        if (!channel) return;
        await clearBotMessagesInChannel(channel, 100);

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('⚡ Dostosuj swoje role na serwerze PJN!')
            .setDescription('Kliknij odpowiedni przycisk poniżej, aby otrzymać lub zdjąć wybraną rangę. Bądź na bieżąco i spersonalizuj swój profil!')
            .setTimestamp();

        const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('role_bezrobotny').setLabel('Bezrobotny').setStyle(ButtonStyle.Primary).setEmoji('😜'),
            new ButtonBuilder().setCustomId('role_kolekcjoner').setLabel('Kolekcjoner Duszków').setStyle(ButtonStyle.Primary).setEmoji('👻')
        );

        const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('role_fortnite').setLabel('Fortnite').setStyle(ButtonStyle.Secondary).setEmoji('🗺️'),
            new ButtonBuilder().setCustomId('role_cs2').setLabel('CS2').setStyle(ButtonStyle.Secondary).setEmoji('🔪'),
            new ButtonBuilder().setCustomId('role_minecraft').setLabel('Minecraft').setStyle(ButtonStyle.Secondary).setEmoji('📦')
        );

        const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('role_gta').setLabel('GTA V').setStyle(ButtonStyle.Secondary).setEmoji('🚗'),
            new ButtonBuilder().setCustomId('role_valorant').setLabel('Valorant').setStyle(ButtonStyle.Secondary).setEmoji('⚡'),
            new ButtonBuilder().setCustomId('role_lol').setLabel('LoL').setStyle(ButtonStyle.Secondary).setEmoji('⚔️')
        );

        const row4 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('role_zerobuild').setLabel('BR Zero Budowania').setStyle(ButtonStyle.Success).setEmoji('🔥'),
            new ButtonBuilder().setCustomId('role_reaktywacja').setLabel('Reaktywacja').setStyle(ButtonStyle.Danger).setEmoji('🚨'),
            new ButtonBuilder().setCustomId('role_budowanie').setLabel('BR Budowanie').setStyle(ButtonStyle.Success).setEmoji('🪵')
        );

        const row5 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('role_forfun').setLabel('ForFun').setStyle(ButtonStyle.Primary).setEmoji('🤖'),
            new ButtonBuilder().setCustomId('role_najlepszy').setLabel('Najlepszy gracz').setStyle(ButtonStyle.Success).setEmoji('💪')
        );

        await channel.send({ embeds: [embed], components: [row1, row2, row3, row4, row5] });
    } catch (e) {
        console.error('Błąd podczas ustawiania kanału ról:', e);
    }
}

async function setupMemeChannelInstruction() {
    try {
        const channel = await client.channels.fetch(ID_KANALU_MEMOW).catch(() => null) as TextChannel;
        if (!channel) return;
        await clearBotMessagesInChannel(channel, 100);

        const embed = new EmbedBuilder()
            .setColor(0xE74C3C)
            .setTitle('🖼️ Jak korzystać z Generatora Memów PJN?')
            .setDescription(
                'W tym kanale możesz w pełni bezpiecznie i bez spamowania tworzyć własne memy za pomocą bota!\n\n' +
                '🛠️ **Jak wygenerować mema?**\n' +
                '1. Wpisz w oknie wiadomości komendę: `/mem`\n' +
                '2. Wpisz nazwę w polu **szablon** – bot podpowie Ci setki dziesiątek szablonów z całego świata!\n' +
                '3. Wpisz tekst górny i dolny (opcjonalnie).\n' +
                '4. Naciśnij **Enter**, a bot w kilka sekund wygeneruje gotowy obrazek na czacie!\n\n' +
                '⚠️ *Na tym kanale wysyłanie zwykłego tekstu jest zablokowane – korzystaj wyłącznie z komendy `/mem`!*'
            )
            .setImage('https://imgflip.com/s/meme/Drake-Hotline-Bling.jpg')
            .setFooter({ text: 'PJN Generator Memów • Miłej zabawy!' });

        const sentMsg = await channel.send({ embeds: [embed] });
        await sentMsg.pin().catch(() => {});
    } catch (e) {
        console.error('Błąd podczas ustawiania instrukcji memów:', e);
    }
}

async function setupShopChannel() {
    try {
        const channel = await client.channels.fetch(ID_KANAL_SKLEPU).catch(() => null) as TextChannel;
        if (!channel) return;
        await clearBotMessagesInChannel(channel, 100);

        let desc = 'Witaj w oficjalnym sklepie serwera PJN! Wydawaj swoje PJN-Coins na unikalne przedmioty, role i usługi.\n\n*Wszystkie rangi czasowe (w tym VIP) są ważne przez 30 dni, po czym automatycznie wygasają.*\n\n**📋 Dostępny asortyment:**\n\n';
        SHOP_ITEMS.forEach((item, index) => {
            desc += `**${index + 1}.${item.name}** — 💰 **${item.price} PJN-Coins**\n> *${item.description}*\n\n`;
        });

        const embed = new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle('🛒 Oficjalny Sklep Serwera PJN')
            .setDescription(desc)
            .setImage(LIVE_IMAGE_URL)
            .setTimestamp()
            .setFooter({ text: 'PJN System Ekonomii • Wybierz przedmiot poniżej' });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('shop_select')
            .setPlaceholder('Wybierz przedmiot, który chcesz kupić...')
            .addOptions(
                SHOP_ITEMS.map(item => ({
                    label: item.name.substring(0, 25),
                    description: `Cena: ${item.price} PJN-Coins`,
                    value: item.id
                }))
            );

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
        const sentMsg = await channel.send({ embeds: [embed], components: [row] });
        await sentMsg.pin().catch(() => {});
    } catch (e) {
        console.error('Błąd inicjalizacji kanału sklepu:', e);
    }
}

async function setupLfgChannelInstruction() {
    try {
        const channel = await client.channels.fetch(ID_KANALU_SZUKAM_DO_GRY).catch(() => null) as TextChannel;
        if (!channel) return;
        await clearBotMessagesInChannel(channel, 50);

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('🎮 Centrum LFG (Looking For Group) — Jak szukać ekipy do gry?')
            .setDescription(
                'Masz dosyć grania w pojedynkę? Chcesz znaleźć zgrany skład do ulubionej gry? Skorzystaj z naszego automatycznego systemu LFG!\n\n' +
                '🛠️ **Jak stworzyć ogłoszenie o grze?**\n' +
                `1. Wpisz na tym kanale (<#${ID_KANALU_SZUKAM_DO_GRY}>) komendę: \`/szukam\`\n` +
                '2. Wybierz grę z listy (Fortnite, CS2, Minecraft, GTA V, Valorant lub League of Legends).\n' +
                '3. Podaj maksymalną liczbę osób w drużynie oraz dodaj opcjonalny opis.\n' +
                '4. Bot wygeneruje interaktywne ogłoszenie wraz z pingiem odpowiedniej roli!\n\n' +
                '👥 **Jak dołączyć do ekipy?**\n' +
                '• Kliknij zielony przycisk **"Dołącz do ekipy"** pod wybranym ogłoszeniem.\n' +
                '• Gdy skład się zapełni (lub autor kliknie utworzenie pokoju), bot **automatycznie utworzy dla Was prywatny kanał głosowy**!\n' +
                '• W każdej chwili możesz opuścić ekipę, klikając czerwony przycisk **"Opuść"**.'
            )
            .setImage(LIVE_IMAGE_URL)
            .setTimestamp()
            .setFooter({ text: 'PJN System LFG • Znajdź swoją ekipę!' });

        const sentMsg = await channel.send({ embeds: [embed] });
        await sentMsg.pin().catch(() => {});
    } catch (e) {
        console.error('Błąd podczas ustawiania instrukcji LFG:', e);
    }
}

async function setupShowcaseChannelInstruction() {
    try {
        const channel = await client.channels.fetch(ID_KANALU_POKAZ_SIEBIE).catch(() => null) as TextChannel;
        if (!channel) return;
        await clearBotMessagesInChannel(channel, 100);

        const embed = new EmbedBuilder()
            .setColor(0xE91E63)
            .setTitle('📸 Przedstaw się społeczności PJN!')
            .setDescription(
                'Witaj na kanale dedykowanym naszym członkom! Chcesz, aby inni Cię poznali? To idealne miejsce, aby pokazać siebie światu.\n\n' +
                '✨ **Co możesz tutaj wrzucić?**\n' +
                '• Swoje zdjęcie (lub zdjęcie pasji/zwierzaka) 📷\n' +
                '• Kilka słów o sobie: czym się interesujesz, jakiej słuchasz muzyki, w co grasz? 🎧🎮\n' +
                '• Pozdrowienia dla całej ekipy PJN! 👋\n\n' +
                '💬 **Wątki dyskusyjne:**\n' +
                'Pod każdym Twoim zdjęciem bot **automatycznie utworzy osobny wątek do dyskusji**!'
            )
            .setImage(LIVE_IMAGE_URL)
            .setTimestamp()
            .setFooter({ text: 'PJN Strefa Społeczności • Pokaż się nam!' });

        const sentMsg = await channel.send({ embeds: [embed] });
        await sentMsg.pin().catch(() => {});
    } catch (e) {
        console.error('Błąd podczas ustawiania instrukcji kanału przedstawiania się:', e);
    }
}

async function setupReputationChannelInstruction() {
    try {
        const channel = await client.channels.fetch(ID_KANAL_REPUTACJI).catch(() => null) as TextChannel;
        if (!channel) return;
        await clearBotMessagesInChannel(channel, 100);

        const embed = new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle('⭐ System Reputacji i Bezpiecznych Wymian Duszków Fortnite')
            .setDescription(
                'Witaj w oficjalnym centrum reputacji handlowej serwera PJN! Ten kanał służy do oceniania rzetelności innych traderów po zakończonej wymianie.\n\n' +
                '📜 **Zasady nadawania reputacji:**\n' +
                '• Oceniaj wyłącznie osoby, z którymi faktycznie dokonałeś wymiany duszków w Fortnite.\n' +
                '• Możesz ocenić tego samego użytkownika **maksymalnie raz na 24 godziny**.\n' +
                '• Komendy: `+rep @użytkownik [powód]`, `-rep @użytkownik`, `+reputacja @użytkownik`, `/reputacja`.'
            )
            .setImage(LIVE_IMAGE_URL)
            .setTimestamp()
            .setFooter({ text: 'PJN System Reputacji • Handluj bezpiecznie' });

        const sentMsg = await channel.send({ embeds: [embed] });
        await sentMsg.pin().catch(() => {});
    } catch (e) {
        console.error('Błąd podczas ustawiania instrukcji kanału reputacji:', e);
    }
}

async function updateTraderRoles(member: any, reputation: number) {
    if (!member) return;
    try {
        const hasWzorowy = member.roles.cache.has(ID_RANGI_WZOROWY_TRADER);
        const hasPozytywny = member.roles.cache.has(ID_RANGI_POZYTYWNY_TRADER);
        const hasNegatywny = member.roles.cache.has(ID_RANGI_NEGATYWNY_TRADER);

        if (reputation >= 50 && !hasWzorowy) {
            await member.roles.add(ID_RANGI_WZOROWY_TRADER).catch(() => {});
        } else if (reputation < 50 && hasWzorowy) {
            await member.roles.remove(ID_RANGI_WZOROWY_TRADER).catch(() => {});
        }

        if (reputation >= 10 && reputation < 50 && !hasPozytywny) {
            await member.roles.add(ID_RANGI_POZYTYWNY_TRADER).catch(() => {});
        } else if ((reputation < 10 || reputation >= 50) && hasPozytywny) {
            await member.roles.remove(ID_RANGI_POZYTYWNY_TRADER).catch(() => {});
        }

        if (reputation <= -5 && !hasNegatywny) {
            await member.roles.add(ID_RANGI_NEGATYWNY_TRADER).catch(() => {});
        } else if (reputation > -5 && hasNegatywny) {
            await member.roles.remove(ID_RANGI_NEGATYWNY_TRADER).catch(() => {});
        }
    } catch (e) {
        console.error('Błąd aktualizacji ról tradera:', e);
    }
}

async function checkAndAwardBadges(user: any, memberOrUser: any, guild?: any) {
    const newBadges: string[] = [];
    const addBadge = (badgeName: string) => {
        if (!user.badges.includes(badgeName)) {
            user.badges.push(badgeName);
            newBadges.push(badgeName);
        }
    };

    if (user.messageCount >= 200) addBadge('💬 **Początkujący Gadulec**');
    if (user.messageCount >= 1000) addBadge('📜 **Kronikarz Chatu**');
    if (user.messageCount >= 5000) addBadge('💬 **Król Wiadomości**');
    if (user.emojiCount >= 30) addBadge('😂 **Emotikonowy Ekspresja**');
    if (user.nightMessageCount >= 50) addBadge('🌙 **Nocny Marek**');

    if (user.voiceMinutes >= 1800) addBadge('🎙️ **Stały Bywalec Mikrofonu**'); 
    if (user.voiceMinutes >= 6000) addBadge('🎧 **Audiofil**'); 

    if (user.balance >= 5000) addBadge('💰 **Kapitalista**');
    if (user.balance >= 10000) addBadge('💎 **Magnat Finansowy**');
    if (user.balance >= 100000) addBadge('🏦 **Milioner (Rzadka)**');
    if (user.totalDonated >= 5000) addBadge('💸 **Hojny Darczyńca**');

    if (user.casinoPlays >= 20) addBadge('🎲 **Nałogowy Graczyk**');
    if (user.casinoPlays >= 100) addBadge('🎰 **Ryzykant (Rzadka)**');
    if (user.consecutiveWins >= 3) addBadge('🍀 **Ulubieniec Fortuna**');
    if (user.consecutiveLosses >= 5) addBadge('🎯 **Czarna Seria**');

    if (user.quotesAdded >= 5) addBadge('💡 **Filozof**');
    if (user.helpCount >= 10) addBadge('🤝 **Pomocna Dłoń**');

    const lvl = user.level || 1;
    if (lvl >= 10) addBadge('⭐ **Awansowy Ekspert (Lvl 10)**');
    if (lvl >= 50) addBadge('🌟 **Mistrz Poziomów (Lvl 50, Rzadka)**');
    if (lvl >= 100) addBadge('👑 **Legenda Serwera (Lvl 100, Elitarna)**');

    if (memberOrUser && memberOrUser.joinedAt) {
        const diffMonths = (Date.now() - new Date(memberOrUser.joinedAt).getTime()) / (1000 * 60 * 60 * 24 * 30);
        const diffYears = diffMonths / 12;
        if (diffMonths >= 6) addBadge('⏳ **Weteran Półrocza**');
        if (diffYears >= 1) addBadge('⏳ **Weteran (Rzadka)**');
    }

    if (memberOrUser && memberOrUser.roles && typeof memberOrUser.roles.cache?.some === 'function') {
        const hasAdminRole = memberOrUser.roles.cache.some((role: any) => 
            ['admin', 'administrator', 'streamer'].includes(role.name.toLowerCase())
        );
        if (hasAdminRole) addBadge('🛡️ **Filar Społeczności**');
    }

    if (user.messageCount >= 25000) addBadge('🧠 **Wygadany Mędrzec (25k Wiadomości)**');
    if (user.voiceMinutes >= 30000) addBadge('🎙️ **Duch Kanałów Głosowych (500h na Głosie, Elitarna)**'); 
    if (user.balance >= 1000000) addBadge('🏛️ **Miliarder PJN (1 000 000 Coinsów, Elitarna)**');
    if (user.totalDonated >= 50000) addBadge('🤝 **Filantrop Społeczności (50 000 Przekazanych Coinsów)**');
    if (user.casinoPlays >= 500) addBadge('🎰 **Hazardowy Tycoon (500 Gier w Kasynie)**');
    if (user.consecutiveWins >= 20) addBadge('🔥 **Niepowstrzymana Seria (20 Wygranych z Rzędu, Epicka)**');

    if (memberOrUser && memberOrUser.joinedAt) {
        const diffYears = (Date.now() - new Date(memberOrUser.joinedAt).getTime()) / (1000 * 60 * 60 * 24 * 365);
        if (diffYears >= 3) addBadge('⌛ **Długowieczny Patriarcha (3 Lata Stażu, Elitarna)**');
    }

    const masterPoolCount = 28; 
    const currentCountWithoutCollector = user.badges.filter((b: string) => !b.includes('Kolekcjoner')).length;
    if (currentCountWithoutCollector >= masterPoolCount) {
        addBadge('🎟️ **Kolekcjoner (Epicka)**');
    }

    if (newBadges.length > 0) {
        await user.save();
        const targetMember = memberOrUser.user ? memberOrUser : null;
        const targetUserObj = targetMember ? targetMember.user : memberOrUser;
        const targetGuild = guild || (targetMember ? targetMember.guild : null) || (client.guilds.cache.first());

        try {
            await targetUserObj.send({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFFD700)
                        .setTitle('🎉 Nowa odznaka odblokowana!')
                        .setDescription(`Gratulacje! Otrzymałeś nowe odznaki:\n\n` + newBadges.map(b => `• ✨ ${b}`).join('\n'))
                        .setTimestamp()
                ]
            });
        } catch (e) {}

        const rareBadgesToAnnounce = newBadges.filter(b => RARE_ANNOUNCE_BADGES.includes(b));

        if (rareBadgesToAnnounce.length > 0 && targetGuild) {
            try {
                const announceChannel = await targetGuild.channels.fetch(ANNOUNCE_CHANNEL_ID).catch(() => null) as TextChannel;
                if (announceChannel) {
                    const consoleEmbed = new EmbedBuilder()
                        .setColor(0x107C10)
                        .setTitle('🏆 RZADKA ODZNAKA ODBLOKOWANA!')
                        .setThumbnail(targetUserObj.displayAvatarURL ? targetUserObj.displayAvatarURL() : client.user?.displayAvatarURL())
                        .setDescription(
                            `🎮 **SPECJALNE OSIĄGNIĘCIE**\n\n` +
                            `Gracz <@${user.userId}> właśnie zdobył unikalne, rzadkie wyróżnienie na serwerze:\n\n` +
                            rareBadgesToAnnounce.map(b => `> ✨ **${b}**`).join('\n') + `\n\n` +
                            `*Zdobądź swój własny tytuł, budując aktywność i walcząc o odznaki w grach!*`
                        )
                        .setImage(LIVE_IMAGE_URL)
                        .setTimestamp()
                        .setFooter({ text: 'PJN Achievement System • Xbox / PlayStation Style' });

                    await announceChannel.send({
                        content: `<@${user.userId}>`,
                        embeds: [consoleEmbed],
                        allowedMentions: { users: [user.userId] }
                    });
                }
            } catch (err) {}
        }
    }
}

async function getUserLevelRankDetails(userId: string): Promise<{ rank: number, total: number }> {
    const targetUser = await UserModel.findOne({ userId });
    if (!targetUser) return { rank: 1, total: 1 };

    const total = await UserModel.countDocuments({});
    const higherCount = await UserModel.countDocuments({
        $or: [
            { level: { $gt: targetUser.level || 1 } },
            { level: targetUser.level || 1, exp: { $gt: targetUser.exp || 0 } }
        ]
    });

    return { rank: higherCount + 1, total: Math.max(1, total) };
}

async function addExp(userId: string, amount: number, guild: any) {
    let user = await UserModel.findOne({ userId });
    if (!user) user = await UserModel.create({ userId });

    user.exp = (user.exp || 0) + amount;
      
    let requiredExpForNextLevel = user.level * 150;
    let leveledUp = false;

    while (user.exp >= requiredExpForNextLevel) {
        user.exp -= requiredExpForNextLevel;
        user.level = (user.level || 1) + 1;
        leveledUp = true;
        requiredExpForNextLevel = user.level * 150;
    }

    if (leveledUp && user.level % 10 === 0) {
        user.balance += 1500;
    }

    await user.save();

    if (leveledUp) {
        try {
            const channelToSend = await guild.channels.fetch(ID_KANAL_AWANSOW).catch(() => null) as TextChannel;
            if (!channelToSend) return;

            const member = await guild.members.fetch(userId).catch(() => null);
            const avatarUrl = member ? member.user.displayAvatarURL() : client.user?.displayAvatarURL();
            const rankDetails = await getUserLevelRankDetails(userId);

            let rewardText = '';
            if (user.level % 10 === 0) {
                rewardText = `\n\n🎁 **Nagroda za awans na ${user.level} lvl:** Otrzymałeś **1500 PJN-Coins** do portfela! 💰`;
            }

            const embed = new EmbedBuilder()
                .setColor(0x9B59B6)
                .setTitle('🚀 AWANS NA WYŻSZY POZIOM!')
                .setThumbnail(avatarUrl)
                .setDescription(
                    `Gratulacje <@${userId}>! Właśnie wskoczyłeś na wyższy poziom na serwerze! 🌟\n\n` +
                    `⭐ **Nowy Poziom:** \`${user.level}\`\n` +
                    `🏆 **Miejsce w rankingu XP:** \`#${rankDetails.rank} z ${rankDetails.total}\`\n` +
                    `🎯 **Twój Postęp:** \`${user.exp} / ${user.level * 150} XP\`` +
                    rewardText
                )
                .setTimestamp()
                .setFooter({ text: 'PJN System Doświadczenia • Awans' });

            await channelToSend.send({ 
                content: `<@${userId}>`, 
                embeds: [embed],
                allowedMentions: { users: [userId] }
            });
        } catch (e) {}
    }
}

async function getTopEmbedData(guild: any) {
    const topUsers = await UserModel.find().sort({ balance: -1 }).limit(10);
      
    if (topUsers.length === 0) {
        return {
            color: 0xFFD700,
            title: '🏆 TOP 10 - Ranking PJN-Coins',
            description: 'Brak danych w rankingu.'
        };
    }

    let desc = 'Ranking jest automatycznie aktualizowany co 5 minut.\n\nNajbogatsi użytkownicy\n';
      
    for (let index = 0; index < topUsers.length; index++) {
        const u = topUsers[index];
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**${index + 1}.**`;
          
        let userName = `Użytkownik (${u.userId})`;
        try {
            if (guild) {
                const member = await guild.members.fetch(u.userId).catch(() => null);
                if (member) userName = member.displayName;
            }
        } catch (e) {}

        desc += `${medal} — **${userName}** — **${u.balance} PJN-Coins**\n`;
    }

    return {
        color: 0xFFD700,
        title: '🏆 TOP 10 - Ranking PJN-Coins',
        description: desc
    };
}

async function getReputationTopEmbedData(guild: any) {
    const topUsers = await UserModel.find().sort({ reputation: -1 }).limit(5);
      
    if (topUsers.length === 0) {
        return {
            color: 0xF1C40F,
            title: '🌟 Aleja Sław - TOP 5 Traderów Reputacji',
            description: 'Brak danych w rankingu reputacji.'
        };
    }

    let desc = 'Ranking najlepszych i najbezpieczniejszych traderów Fortnite na serwerze. Aktualizowany co 5 godzin.\n\n';
      
    for (let index = 0; index < topUsers.length; index++) {
        const u = topUsers[index];
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**${index + 1}.**`;
          
        let userName = `Użytkownik (${u.userId})`;
        try {
            if (guild) {
                const member = await guild.members.fetch(u.userId).catch(() => null);
                if (member) userName = member.displayName;
            }
        } catch (e) {}

        const repValue = u.reputation || 0;
        const sign = repValue > 0 ? '+' : '';
        desc += `${medal} — **${userName}** — **${sign}${repValue} pkt** (Exp:${u.exp || 0})\n`;
    }

    return {
        color: 0xF1C40F,
        title: '🌟 Aleja Sław - TOP 5 Traderów Reputacji',
        description: desc,
        timestamp: new Date().toISOString(),
        footer: { text: 'PJN Aleja Sław • Bezpieczne Wymiany' }
    };
}

async function startTopUpdater() {
    setInterval(async () => {
        try {
            const config = await ConfigModel.findOne({ key: 'topka_msg' });
            if (!config) return;

            const channel = await client.channels.fetch(config.channelId).catch(() => null) as TextChannel;
            if (!channel) return;

            const oldMessage = await channel.messages.fetch(config.messageId).catch(() => null);
            if (oldMessage) await oldMessage.delete().catch(() => {});

            const embedData = await getTopEmbedData(channel.guild);
            const newMessage = await channel.send({ embeds: [embedData] });

            config.messageId = newMessage.id;
            await config.save();
        } catch (err) {}
    }, 5 * 60 * 1000);
}

async function startReputationTopUpdater() {
    setInterval(async () => {
        try {
            const channel = await client.channels.fetch(ID_ALEJA_SLAW_REPUTACJI).catch(() => null) as TextChannel;
            if (!channel) return;

            await clearBotMessagesInChannel(channel, 100);

            const embedData = await getReputationTopEmbedData(channel.guild);
            await channel.send({ embeds: [embedData] });
        } catch (err) {}
    }, 5 * 60 * 60 * 1000);
}

async function startBadgesInfoUpdater() {
    setInterval(async () => {
        try {
            const config = await ConfigModel.findOne({ key: 'odznaki_info_msg' });
            if (!config) return;

            const channel = await client.channels.fetch(config.channelId).catch(() => null) as TextChannel;
            if (!channel) return;

            const oldMessage = await channel.messages.fetch(config.messageId).catch(() => null);
            if (oldMessage) await oldMessage.delete().catch(() => {});

            const embedsList = createBadgesInfoEmbeds();
            const newMessage = await channel.send({ embeds: embedsList });

            config.messageId = newMessage.id;
            await config.save();
        } catch (err) {}
    }, 10 * 60 * 1000);
}

function startLfgAutoCloser() {
    setInterval(async () => {
        try {
            const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
            const expiredLfgDocs = await LFGModel.find({
                status: { $ne: 'closed' },
                createdAt: { $lte: thirtyMinutesAgo }
            });

            for (const lfgDoc of expiredLfgDocs) {
                lfgDoc.status = 'closed';
                await lfgDoc.save();

                if (lfgDoc.voiceChannelId) {
                    try {
                        for (const [_, guild] of client.guilds.cache) {
                            const voiceChannel = await guild.channels.fetch(lfgDoc.voiceChannelId).catch(() => null);
                            if (voiceChannel) {
                                await voiceChannel.delete('Automatyczne zamknięcie LFG po 30 minutach');
                                break;
                            }
                        }
                    } catch (err) {}
                }

                try {
                    for (const [_, guild] of client.guilds.cache) {
                        const channel = await guild.channels.fetch(lfgDoc.channelId).catch(() => null) as TextChannel;
                        if (channel) {
                            const message = await channel.messages.fetch(lfgDoc.messageId).catch(() => null);
                            if (message) {
                                await updateLFGMessage(message, lfgDoc);
                                break;
                            }
                        }
                    }
                } catch (err) {}
            }
        } catch (err) {}
    }, 60 * 1000);
}

async function updateLFGMessage(message: any, lfgDoc: any) {
    try {
        const gameInfo = LFG_CONFIG.GAMES[lfgDoc.game as keyof typeof LFG_CONFIG.GAMES];
        const statusText = lfgDoc.status === 'closed' ? '🔒 [ZAMKNIĘTE]' : lfgDoc.status === 'full' ? '🔴 [PEŁNY SKŁAD]' : '🟢 [AKTYWNE]';
        const playersListText = lfgDoc.currentPlayers.map((id: string) => `• <@${id}>`).join('\n');

        const embed = new EmbedBuilder()
            .setColor(lfgDoc.status === 'closed' ? 0xE74C3C : 0x5865F2)
            .setTitle(`${gameInfo.emoji} Szukanie Ekipy: ${gameInfo.name} ${statusText}`)
            .setDescription(
                `👤 **Organizator:** <@${lfgDoc.authorId}>\n` +
                `👥 **Skład:** ${lfgDoc.currentPlayers.length} / ${lfgDoc.maxPlayers} osób\n` +
                `📝 **Opis:** ${lfgDoc.description}\n\n` +
                `📋 **Aktualni członkowie:**\n${playersListText}`
            )
            .setTimestamp();

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('lfg_join').setLabel('Dołącz do ekipy').setStyle(ButtonStyle.Success).setEmoji('➕').setDisabled(lfgDoc.status === 'closed'),
            new ButtonBuilder().setCustomId('lfg_leave').setLabel('Opuść').setStyle(ButtonStyle.Danger).setEmoji('➖').setDisabled(lfgDoc.status === 'closed'),
            new ButtonBuilder().setCustomId('lfg_create_voice').setLabel('🎙️ Utwórz pokój').setStyle(ButtonStyle.Primary).setDisabled(lfgDoc.status === 'closed'),
            new ButtonBuilder().setCustomId('lfg_close').setLabel('Zamknij ogłoszenie').setStyle(ButtonStyle.Secondary).setEmoji('🔒').setDisabled(lfgDoc.status === 'closed')
        );

        await message.edit({ embeds: [embed], components: lfgDoc.status === 'closed' ? [] : [row] });
    } catch (e) {}
}

async function cleanupOrphanedLfgVoices() {
    try {
        const activeLfgWithVoice = await LFGModel.find({ status: { $ne: 'closed' }, voiceChannelId: { $ne: null } });
        for (const [_, guild] of client.guilds.cache) {
            const category = guild.channels.cache.get(LFG_CONFIG.CATEGORY_VOICE);
            if (category && category.type === ChannelType.GuildCategory) {
                for (const [_, channel] of category.children.cache) {
                    if (channel.type === ChannelType.GuildVoice) {
                        const isRegisteredInDb = activeLfgWithVoice.some(doc => doc.voiceChannelId === channel.id);
                        if (!isRegisteredInDb && !tempVoiceChannels.has(channel.id)) {
                            await channel.delete('Usuwanie osieroconego kanału głosowego po resecie bota').catch(() => {});
                        }
                    }
                }
            }
        }
    } catch (e) {}
}

function startPokerRoomInactivityChecker() {
    setInterval(async () => {
        try {
            const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
            const inactiveRooms = await PokerRoomModel.find({
                status: { $ne: 'closed' },
                lastActivity: { $lte: fifteenMinutesAgo }
            });

            for (const room of inactiveRooms) {
                room.status = 'closed';
                await room.save();

                for (const [_, guild] of client.guilds.cache) {
                    const channel = await guild.channels.fetch(room.channelId).catch(() => null) as TextChannel;
                    if (channel) {
                        const message = await channel.messages.fetch(room.messageId).catch(() => null);
                        if (message) {
                            const embed = new EmbedBuilder()
                                .setColor(0xE74C3C)
                                .setTitle('🃏 Poker • Pokój ZAMKNIĘTY')
                                .setDescription('Ten pokój pokera został automatycznie zamknięty przez bota z powodu 15 minut nieaktywności.')
                                .setTimestamp();
                            await message.edit({ embeds: [embed], components: [] }).catch(() => {});
                            break;
                        }
                    }
                }
            }
        } catch (e) {}
    }, 60 * 1000);
}

function startHourlyAnnouncements() {
    cron.schedule('0 */5 * * *', async () => {
        try {
            const channel = await client.channels.fetch(ANNOUNCE_CHANNEL_ID).catch(() => null) as TextChannel;
            if (!channel) return;
            await channel.send({ embeds: [createOgłoszenieEmbed()] });
        } catch (err) {}
    });
}

// === POWIADOMIENIA (TWITCH, YOUTUBE, TIKTOK) ===
async function sendNotification(targetKey: 'languspjn' | 'elladermusic', platform: 'twitch' | 'youtube' | 'tiktok', title: string, url: string, customThumbnail?: string) {
    try {
        const channelId = NOTIF_CONFIG[targetKey].channelId;
        const channel = await client.channels.fetch(channelId).catch(() => null) as TextChannel;
        if (!channel) return;

        const isTwitch = platform === 'twitch';
        const isYt = platform === 'youtube';
        
        let color = 0x9146FF; 
        if (isYt) color = 0xFF0000;
        else if (!isTwitch) color = 0x00F2FE;

        let platformName = 'Twitch 🟣';
        if (isYt) platformName = 'YouTube 🎥';
        else if (platform === 'tiktok') platformName = 'TikTok 🎬';
          
        let thumbnail = customThumbnail;
        if (isYt && url.includes('watch?v=')) {
            const videoId = url.split('v=')[1]?.split('&')[0];
            if (videoId) thumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        } else if (isYt && url.includes('youtu.be/')) {
            const videoId = url.split('youtu.be/')[1]?.split('?')[0];
            if (videoId) thumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        }

        const EMBED_FALLBACK_IMAGE = "https://cdn.discordapp.com/attachments/1532321067731783684/1545708586108325898/IMG_20260905_101345.jpg?ex=6a9d20cc&is=6a9bcf4c&hm=a3a2a62e8f092f637ca72db6600ba805fb1a84a709595a77073021274e250a3e&";

        let embedDescription = `Cześć społeczności! **${targetKey === 'languspjn' ? 'LangusPJN' : 'elladerMusic'}** właśnie rozpoczął transmisję na żywo! Wskakuj na stream i zostaw swoją obecność! 👇\n\n**📌 ${title}**`;
        if (!isTwitch) {
            embedDescription = `Cześć społeczności! Właśnie pojawił się nowy materiał od **${targetKey === 'languspjn' ? 'LangusPJN' : 'elladerMusic'}**. Zostaw po sobie ślad! 👇\n\n**📌 ${title}**`;
        }

        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(isTwitch ? `🔴 TRANSMISJA NA ŻYWO NA ${platformName.toUpperCase()}!` : `NOWY MATERIAŁ NA ${platformName.toUpperCase()}!`)
            .setDescription(embedDescription)
            .setImage(thumbnail || EMBED_FALLBACK_IMAGE)
            .setTimestamp()
            .setFooter({ text: `PJN & elladerMusic • System Powiadomień` });

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setLabel(isTwitch ? 'Oglądaj na Twitch' : `Oglądaj na ${isYt ? 'YouTube' : 'TikTok'}`)
                .setStyle(ButtonStyle.Link)
                .setURL(url)
                .setEmoji(isTwitch ? '🟣' : (isYt ? '▶️' : '🔥'))
        );

        await channel.send({
            content: isTwitch ? '@everyone LangusPJN odpalił streama na Twitchu!' : '@everyone Nowy materiał jest już dostępny do obejrzenia!',
            embeds: [embed],
            components: [row],
            allowedMentions: { parse: ['everyone'] }
        });
    } catch (err) {
        console.error('Błąd podczas wysyłania powiadomienia:', err);
    }
}

// === OBSŁUGA OBSERWOWANIA KANAŁÓW GŁOSOWYCH (AUTOMATYCZNE POKOJE) ===
client.on('voiceStateUpdate', async (oldState: VoiceState, newState: VoiceState) => {
    try {
        const guild = newState.guild || oldState.guild;

        // 1. Gracz wchodzi na kanał do tworzenia własnego pokoju
        if (newState.channelId === ID_KANAL_TWORZENIA_POKOJU && newState.member) {
            const parentCategoryId = newState.channel?.parentId || await getFirstCategory(guild);

            const tempChannel = await guild.channels.create({
                name: `🔊・Pokój ${newState.member.displayName}`,
                type: ChannelType.GuildVoice,
                parent: parentCategoryId || undefined,
                permissionOverwrites: [
                    {
                        id: newState.member.id,
                        allow: [
                            PermissionFlagsBits.ManageChannels,
                            PermissionFlagsBits.MuteMembers,
                            PermissionFlagsBits.DeafenMembers,
                            PermissionFlagsBits.MoveMembers,
                            PermissionFlagsBits.Connect,
                            PermissionFlagsBits.Speak
                        ]
                    }
                ]
            });

            tempVoiceChannels.add(tempChannel.id);
            await newState.setChannel(tempChannel).catch(() => {});
        }

        // 2. Gracz opuścił stary kanał głosowy - sprawdzamy czy należy go usunąć
        if (oldState.channelId && tempVoiceChannels.has(oldState.channelId)) {
            const voiceChan = oldState.channel;
            if (voiceChan && voiceChan.members.size === 0) {
                tempVoiceChannels.delete(voiceChan.id);
                await voiceChan.delete('Automatyczne usunięcie pustego prywatnego pokoju').catch(() => {});
            }
        }
    } catch (e) {
        console.error('Błąd w voiceStateUpdate:', e);
    }
});

// === OBSŁUGA CZATU I KOMEND TEKSTOWYCH (+rep, +reputacja, -rep, -reputacja) ===
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    // Statystyki wiadomości i Doświadczenie (XP)
    let user = await UserModel.findOne({ userId: message.author.id });
    if (!user) user = await UserModel.create({ userId: message.author.id });

    user.messageCount = (user.messageCount || 0) + 1;

    const hour = new Date().getHours();
    if (hour >= 22 || hour < 6) {
        user.nightMessageCount = (user.nightMessageCount || 0) + 1;
    }

    const emojiRegex = /<a?:[a-zA-Z0-9_]+:[0-9]+>|[\u{1F300}-\u{1F9FF}]/gu;
    const matches = message.content.match(emojiRegex);
    if (matches) {
        user.emojiCount = (user.emojiCount || 0) + matches.length;
    }

    await user.save();
    await addExp(message.author.id, Math.floor(Math.random() * 10) + 5, message.guild);
    await checkAndAwardBadges(user, message.member || message.author, message.guild);

    // KOMENDY REPUTACJI TEKSTOWE (+rep, +reputacja, -rep, -reputacja)
    const content = message.content.trim();
    if (
        content.startsWith('+rep') || 
        content.startsWith('-rep') || 
        content.startsWith('+reputacja') || 
        content.startsWith('-reputacja')
    ) {
        const isPositive = content.startsWith('+rep') || content.startsWith('+reputacja');
        const targetMember = message.mentions.members?.first();

        if (!targetMember) {
            return message.reply('❌ Musisz oznaczyć użytkownika, któremu chcesz przyznać reputację!\n👉 **Wzór:** `+rep @użytkownik [powód]` lub `+reputacja @użytkownik`');
        }

        if (targetMember.id === message.author.id) {
            return message.reply('❌ Nie możesz przyznawać punktów reputacji samemu sobie!');
        }

        if (targetMember.user.bot) {
            return message.reply('❌ Boty nie mogą brać udziału w systemie reputacji!');
        }

        // Ograniczenie czasowe (cooldown 24h na tę samą osobę)
        const existingCooldown = await RepCooldownModel.findOne({
            giverId: message.author.id,
            targetId: targetMember.id
        });

        if (existingCooldown) {
            const timePassed = Date.now() - new Date(existingCooldown.timestamp).getTime();
            const cooldownMs = 24 * 60 * 60 * 1000;
            if (timePassed < cooldownMs) {
                const timeLeftMs = cooldownMs - timePassed;
                const hoursLeft = Math.floor(timeLeftMs / (1000 * 60 * 60));
                const minsLeft = Math.floor((timeLeftMs % (1000 * 60 * 60)) / (1000 * 60));
                return message.reply(`⏳ Przyznałeś już reputację temu użytkownikowi! Spróbuj ponownie za **${hoursLeft}h ${minsLeft}m**.`);
            }
        }

        let targetUserDoc = await UserModel.findOne({ userId: targetMember.id });
        if (!targetUserDoc) targetUserDoc = await UserModel.create({ userId: targetMember.id });

        const change = isPositive ? 1 : -1;
        targetUserDoc.reputation = (targetUserDoc.reputation || 0) + change;
        await targetUserDoc.save();

        await RepCooldownModel.findOneAndUpdate(
            { giverId: message.author.id, targetId: targetMember.id },
            { timestamp: new Date() },
            { upsert: true, new: true }
        );

        await updateTraderRoles(targetMember, targetUserDoc.reputation);
        await checkAndAwardBadges(targetUserDoc, targetMember, message.guild);

        const repEmbed = new EmbedBuilder()
            .setColor(isPositive ? 0x2ECC71 : 0xE74C3C)
            .setTitle(isPositive ? '⭐ Przyznano Pozytywną Reputację (+1)' : '⚠️ Przyznano Negatywną Reputację (-1)')
            .setDescription(
                `Gracz <@${message.author.id}> ${isPositive ? 'dał **+1 pkt** reputacji' : 'odjął **1 pkt** reputacji'} dla <@${targetMember.id}>!\n\n` +
                `📊 **Aktualna reputacja tradera:** **${targetUserDoc.reputation} pkt**`
            )
            .setTimestamp()
            .setFooter({ text: 'PJN System Reputacji Tradera' });

        return message.reply({ embeds: [repEmbed] });
    }
});

const commands = [
    new SlashCommandBuilder().setName('portfel').setDescription('Sprawdź stan swoich PJN-Coins w portfelu'),
    new SlashCommandBuilder().setName('sklep').setDescription('Otwórz podgląd sklepu i sprawdź swoje środki'),
    new SlashCommandBuilder().setName('moje-przedmioty').setDescription('Sprawdź swoje aktywne przedmioty z sklepu i czas ich wygaśnięcia'),
    new SlashCommandBuilder().setName('historia-sklepu').setDescription('Wyświetl historię zakupów (Admin)').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
        .setName('historia-transakcji')
        .setDescription('Wyświetl historię przelewów, rozdawania punktów i wygranych w kasynie (Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('topka').setDescription('Zobacz ranking najbogatszych graczy'),
    new SlashCommandBuilder().setName('ustaw-topke').setDescription('Ustaw ten kanał jako ranking (Admin)').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('ustaw-odznaki').setDescription('Ustaw ten kanał jako centrum odznak (Admin)').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('darmowe-gry').setDescription('Ręcznie wyślij aktualne informacje o darmowych grach z Epic Games i Steam (Admin)').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('daily').setDescription('Odbieraj codzienne 100 PJN-Coins'),
    new SlashCommandBuilder().setName('przelej').setDescription('Przelewa PJN-Coins').addUserOption(o => o.setName('uzytkownik').setDescription('Komu').setRequired(true)).addIntegerOption(o => o.setName('kwota').setDescription('Ile').setRequired(true)),
    new SlashCommandBuilder().setName('kostka').setDescription('Rzuć kością').addIntegerOption(o => o.setName('stawka').setDescription('Stawka').setRequired(true)),
    new SlashCommandBuilder().setName('moneta').setDescription('Orzeł czy reszka').addStringOption(o => o.setName('wybor').setDescription('Wybór').setRequired(true).addChoices({name: 'Orzeł', value: 'orzel'}, {name: 'Reszka', value: 'reszka'})).addIntegerOption(o => o.setName('stawka').setDescription('Stawka').setRequired(true)),
    new SlashCommandBuilder().setName('slot').setDescription('Sloty').addIntegerOption(o => o.setName('stawka').setDescription('Stawka').setRequired(true)),
    new SlashCommandBuilder().setName('poker').setDescription('Poker').addStringOption(o => o.setName('tryb').setDescription('Tryb').setRequired(true).addChoices({name: 'Z ludźmi', value: 'ludzie'}, {name: 'Z botem', value: 'bot'})).addIntegerOption(o => o.setName('stawka').setDescription('Stawka').setRequired(true)),
    new SlashCommandBuilder().setName('quiz').setDescription('Odpowiedz na pytanie quizowe'),
    new SlashCommandBuilder().setName('quiz-gra').setDescription('Rozpocznij interaktywny quiz z przyciskami i nagrodami coins'),
    new SlashCommandBuilder()
        .setName('kpn')
        .setDescription('Zagraj w Kamień, Papier, Nożyce za PJN-Coins')
        .addStringOption(o => o.setName('wybor').setDescription('Twój wybór').setRequired(true).addChoices(
            { name: 'Kamień 🪨', value: 'kamien' },
            { name: 'Papier 📄', value: 'papier' },
            { name: 'Nożyce ✂️', value: 'nozyce' }
        ))
        .addIntegerOption(o => o.setName('stawka').setDescription('Stawka PJN-Coins').setRequired(true)),
    new SlashCommandBuilder().setName('odznaki').setDescription('Wyświetla profil z odznakami').addUserOption(o => o.setName('uzytkownik').setDescription('Użytkownik').setRequired(false)),
    new SlashCommandBuilder()
        .setName('exp')
        .setDescription('Sprawdź swój aktualny poziom, exp oraz brakujące punkty do awansu')
        .addUserOption(o => o.setName('uzytkownik').setDescription('Sprawdź profil innego użytkownika').setRequired(false)),
    new SlashCommandBuilder()
        .setName('reputacja')
        .setDescription('Wyświetla profil handlowy i punkty reputacji tradera')
        .addUserOption(o => o.setName('uzytkownik').setDescription('Sprawdź profil innego użytkownika').setRequired(false)),
    new SlashCommandBuilder()
        .setName('profil')
        .setDescription('Kompleksowa karta profilu gracza z poziomem, odznakami i statystykami')
        .addUserOption(o => o.setName('uzytkownik').setDescription('Użytkownik').setRequired(false)),
    new SlashCommandBuilder()
        .setName('ankieta')
        .setDescription('Stwórz interaktywną ankietę na żywo ze statusem głosowania i licznikiem')
        .addStringOption(o => o.setName('pytanie').setDescription('Treść pytania ankiety').setRequired(true))
        .addStringOption(o => o.setName('opcje').setDescription('Opcje oddzielone przecinkami (np. Opcja 1, Opcja 2)').setRequired(true))
        .addStringOption(o => 
            o.setName('czas')
             .setDescription('Czas trwania ankiety')
             .setRequired(false)
             .addChoices(
                 { name: '15 minut', value: '15m' },
                 { name: '1 godzina', value: '1h' },
                 { name: '6 godzin', value: '6h' },
                 { name: '24 godziny', value: '24h' }
             )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    new SlashCommandBuilder()
        .setName('fn-sklep')
        .setDescription('Wyświetla dzisiejszy sklep w grze Fortnite'),
    new SlashCommandBuilder()
        .setName('fn-stats')
        .setDescription('Sprawdza statystyki gracza w Fortnite (po nicku lub Account ID)')
        .addStringOption(o => o.setName('nick').setDescription('Nazwa użytkownika Epic Games').setRequired(false))
        .addStringOption(o => o.setName('id').setDescription('Epic Account ID (opcjonalnie)').setRequired(false)),
    new SlashCommandBuilder()
        .setName('fn-mapa')
        .setDescription('Wyświetla aktualną mapę Fortnite'),
    new SlashCommandBuilder()
        .setName('fn-rejestracja')
        .setDescription('Zarejestruj swój nick Epic Games (bot sam przeanalizuje mecze i czas gry)')
        .addStringOption(o => o.setName('nick').setDescription('Twój dokładny nick z Epic Games').setRequired(true)),
    new SlashCommandBuilder()
        .setName('fn-top')
        .setDescription('Ręcznie wymuś odświeżenie i wyświetlenie rankingów zabójstw Fortnite'),
    new SlashCommandBuilder()
        .setName('daj-bonus-wygranych')
        .setDescription('Aktywuje 100% wygranych w kasynie na 30 minut dla wybranego gracza (Admin)')
        .addUserOption(o => o.setName('uzytkownik').setDescription('Gracz, który otrzyma bonus').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
        .setName('daj-wszystkim')
        .setDescription('Rozdaje PJN-Coins absolutnie każdemu użytkownikowi w bazie (Admin)')
        .addIntegerOption(o => o.setName('ilosc').setDescription('Ile PJN-Coins ma otrzymać każdy').setRequired(true))
        .addStringOption(o => o.setName('powod').setDescription('Powód przyznania bonusu').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
        .setName('reset-ekonomii')
        .setDescription('Resetuje stan wszystkich PJN-Coins do 0 dla wszystkich użytkowników (Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
        .setName('nowości')
        .setDescription('Wyślij ogłoszenie o nowościach na serwer (Admin)')
        .addStringOption(o => o.setName('tytul').setDescription('Tytuł ogłoszenia (np. System Odznak)').setRequired(true))
        .addStringOption(o => o.setName('co_nowego').setDescription('Krótko opisz co faktycznie dodano').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
        .setName('ogloszenie-techniczne')
        .setDescription('Tworzy ogłoszenie o przerwie technicznej lub pracach (Admin)')
        .addStringOption(o => o.setName('tytul').setDescription('Tytuł ogłoszenia technicznego').setRequired(true))
        .addStringOption(o => o.setName('opis').setDescription('Opis przerwy technicznej / prac').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
        .setName('odpalstream')
        .setDescription('Ogłasza start streama (Streamer/Admin)')
        .addStringOption(o => o.setName('tytul').setDescription('Tytuł streama').setRequired(true))
        .addStringOption(o => o.setName('link').setDescription('Link do transmisji (Twitch/Kick)').setRequired(true)),
    new SlashCommandBuilder()
        .setName('zakonczstream')
        .setDescription('Ogłasza zakończenie streama (Streamer/Admin)'),
    new SlashCommandBuilder()
        .setName('powiadomienie')
        .setDescription('Ręcznie wyślij powiadomienie o nowym filmie / streamie (Twitch / YouTube / TikTok)')
        .addStringOption(opt => 
            opt.setName('tworca')
                .setDescription('Wybierz twórcę')
                .setRequired(true)
                .addChoices(
                    { name: 'LangusPJN', value: 'languspjn' },
                    { name: 'elladerMusic', value: 'elladermusic' }
                )
        )
        .addStringOption(opt => 
            opt.setName('platforma')
                .setDescription('Wybierz platformę')
                .setRequired(true)
                .addChoices(
                    { name: 'Twitch 🟣', value: 'twitch' },
                    { name: 'YouTube 🎥', value: 'youtube' },
                    { name: 'TikTok 🎬', value: 'tiktok' }
                )
        )
        .addStringOption(opt => opt.setName('tytul').setDescription('Tytuł transmisji / filmu').setRequired(true))
        .addStringOption(opt => opt.setName('link').setDescription('Link do transmisji / filmu').setRequired(true))
        .addStringOption(opt => opt.setName('miniatura').setDescription('Link do miniatury (opcjonalnie)').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('daj-odznake').setDescription('Przyznaj odznakę (Admin)')
        .addUserOption(o => o.setName('uzytkownik').setDescription('Komu').setRequired(true))
        .addStringOption(o => o.setName('odznaka').setDescription('Wybierz lub wpisz nazwę odznaki').setRequired(true).setAutocomplete(true)),
    new SlashCommandBuilder().setName('zabierz-odznake').setDescription('Odbierz odznakę (Admin)').addUserOption(o => o.setName('uzytkownik').setDescription('Komu').setRequired(true)).addStringOption(o => o.setName('odznaka').setDescription('Nazwa').setRequired(true).setAutocomplete(true)),
    new SlashCommandBuilder()
        .setName('dajpunkty')
        .setDescription('Daj punkty użytkownikowi')
        .addUserOption(o => o.setName('uzytkownik').setDescription('User').setRequired(true))
        .addIntegerOption(o => o.setName('ilosc').setDescription('Ilość').setRequired(true))
        .addStringOption(o => o.setName('powod').setDescription('Powód przyznania punktów (opcjonalnie)').setRequired(false)),
    new SlashCommandBuilder().setName('zabierzpunkty').setDescription('Zabierz punkty').addUserOption(o => o.setName('uzytkownik').setDescription('User').setRequired(true)).addIntegerOption(o => o.setName('ilosc').setDescription('Ilość').setRequired(true)),
    new SlashCommandBuilder().setName('cytat').setDescription('Wyślij cytat'),
    new SlashCommandBuilder().setName('dodaj-cytat').setDescription('Dodaj cytat').addStringOption(o => o.setName('tekst').setDescription('Tekst').setRequired(true)).addStringOption(o => o.setName('autor').setDescription('Autor').setRequired(true)),
    new SlashCommandBuilder()
        .setName('mem')
        .setDescription('Generuje mema z wyszukiwarką szablonów')
        .addStringOption(o => 
            o.setName('szablon')
             .setDescription('Wpisz nazwę szablonu (np. drake, cat, sponge)')
             .setRequired(true)
             .setAutocomplete(true)
        )
        .addStringOption(o => o.setName('gora').setDescription('Tekst na górze mema').setRequired(false))
        .addStringOption(o => o.setName('dol').setDescription('Tekst na dole mema').setRequired(false)),
    new SlashCommandBuilder()
        .setName('szukam')
        .setDescription('Stwórz ogłoszenie LFG (Looking For Group) do gry')
        .addStringOption(option =>
            option.setName('gra')
                .setDescription('Wybierz grę')
                .setRequired(true)
                .addChoices(
                    { name: 'Fortnite', value: 'fortnite' },
                    { name: 'Counter-Strike 2', value: 'cs2' },
                    { name: 'Minecraft', value: 'minecraft' },
                    { name: 'GTA V / Online', value: 'gta' },
                    { name: 'Valorant', value: 'valorant' },
                    { name: 'League of Legends', value: 'lol' }
                ))
        .addIntegerOption(option =>
            option.setName('osoby')
                .setDescription('Maksymalna liczba osób w drużynie (łącznie z Tobą)')
                .setRequired(true)
                .setMinValue(2)
                .setMaxValue(10))
        .addStringOption(option =>
            option.setName('opis')
                .setDescription('Dodatkowy opis (np. ranga, mikrofon, styl gry)')
                .setRequired(false)),
    new ContextMenuCommandBuilder()
        .setName('Zapisz jako złoty tekst')
        .setType(ApplicationCommandType.Message)
].map(c => c.toJSON());

// === EVENT LOGOWANIA WYJŚĆ, KICKÓW ORAZ BANÓW ===
client.on('guildMemberRemove', async member => {
    try {
        const guild = member.guild;
        const logChannelId = NOTIF_CONFIG.leaveLogChannelId;
        const channel = await guild.channels.fetch(logChannelId).catch(() => null) as TextChannel;
        if (!channel) return;

        const fetchedLogs = await guild.fetchAuditLogs({
            limit: 1,
            type: AuditLogEvent.MemberKick,
        }).catch(() => null);

        const kickLog = fetchedLogs?.entries.first();
        let actionType = 'opuszczenie';
        let executorTag = 'N/D';

        if (kickLog && kickLog.target && kickLog.target.id === member.id) {
            const { createdTimestamp } = kickLog;
            if (Date.now() - createdTimestamp < 5000) {
                actionType = 'kick';
                executorTag = kickLog.executor ? kickLog.executor.tag : 'Nieznany';
            }
        }

        const embed = new EmbedBuilder()
            .setTimestamp()
            .setThumbnail(member.user.displayAvatarURL());

        if (actionType === 'kick') {
            embed.setColor(0xE67E22)
                .setTitle('👢 Użytkownik został Wyrzucony (Kick)')
                .setDescription(`Użytkownik **${member.user.tag}** (<@${member.id}>) został wyrzucony z serwera przez **${executorTag}**.`);
        } else {
            embed.setColor(0xE74C3C)
                .setTitle('📤 Użytkownik Opuścił Serwer')
                .setDescription(`Użytkownik **${member.user.tag}** (<@${member.id}>) opuścił serwer.`);
        }

        await channel.send({ embeds: [embed] });
    } catch (e) {
        console.error('Błąd w obsłudze zdarzenia guildMemberRemove:', e);
    }
});

client.on('guildBanAdd', async ban => {
    try {
        const guild = ban.guild;
        const logChannelId = NOTIF_CONFIG.leaveLogChannelId;
        const channel = await guild.channels.fetch(logChannelId).catch(() => null) as TextChannel;
        if (!channel) return;

        const fetchedLogs = await guild.fetchAuditLogs({
            limit: 1,
            type: AuditLogEvent.MemberBanAdd,
        }).catch(() => null);

        const banLog = fetchedLogs?.entries.first();
        let executorTag = 'Nieznany';
        let reason = 'Brak podanego powodu';

        if (banLog && banLog.target && banLog.target.id === ban.user.id) {
            const { createdTimestamp } = banLog;
            if (Date.now() - createdTimestamp < 5000) {
                executorTag = banLog.executor ? banLog.executor.tag : 'Nieznany';
                reason = banLog.reason || 'Brak podanego powodu';
            }
        }

        const embed = new EmbedBuilder()
            .setColor(0x990000)
            .setTitle('🔨 Użytkownik został Zbanowany')
            .setThumbnail(ban.user.displayAvatarURL())
            .setDescription(
                `Użytkownik **${ban.user.tag}** (<@${ban.user.id}>) został zbanowany na serwerze!\n\n` +
                `🛡️ **Moderator:** ${executorTag}\n` +
                `📋 **Powód:** ${reason}`
            )
            .setTimestamp();

        await channel.send({ embeds: [embed] });
    } catch (e) {
        console.error('Błąd w obsłudze zdarzenia guildBanAdd:', e);
    }
});

client.once('ready', async () => {
    console.log(`Zalogowano jako ${client.user?.tag}!`);
    await seedQuotesIfNeeded();
      
    try {
        const topConfig = await ConfigModel.findOne({ key: 'topka_msg' });
        if (topConfig) {
            const channel = await client.channels.fetch(topConfig.channelId).catch(() => null) as TextChannel;
            if (channel) {
                const oldMessage = await channel.messages.fetch(topConfig.messageId).catch(() => null);
                if (oldMessage) await oldMessage.delete().catch(() => {});
                  
                const embedData = await getTopEmbedData(channel.guild);
                const newMessage = await channel.send({ embeds: [embedData] });
                topConfig.messageId = newMessage.id;
                await topConfig.save();
            }
        }
    } catch (e) {
        console.error('Błąd podczas odświeżania wiadomości rankingu coins przy starcie:', e);
    }

    try {
        const badgesConfig = await ConfigModel.findOne({ key: 'odznaki_info_msg' });
        if (badgesConfig) {
            const channel = await client.channels.fetch(badgesConfig.channelId).catch(() => null) as TextChannel;
            if (channel) {
                const oldMessage = await channel.messages.fetch(badgesConfig.messageId).catch(() => null);
                if (oldMessage) await oldMessage.delete().catch(() => {});
                  
                const embedsList = createBadgesInfoEmbeds();
                const newMessage = await channel.send({ embeds: embedsList });
                badgesConfig.messageId = newMessage.id;
                await badgesConfig.save();
            }
        }
    } catch (e) {
        console.error('Błąd podczas odświeżania wiadomości odznak przy starcie:', e);
    }

    await setupVerificationChannel(); 
    await setupMemeChannelInstruction();
    await setupLfgChannelInstruction(); 
    await setupTicketChannel(); 
    await setupRolesChannel(); 
    await setupShowcaseChannelInstruction();
    await setupReputationChannelInstruction();
    await setupShopChannel();
    await setupFortniteUpdateChannel(); 
    await setupRussianRouletteChannel();
    await setupWheelOfFortuneChannel();
    await setupCasinoHubChannel();
    await setupBotInteractiveChannelInstruction(); 
    await setupCenterZgloszenChannel(); 
    await cleanupOrphanedLfgVoices();

    const rest = new REST({ version: '10' }).setToken(token);
    try {
        console.log('Rozpoczęto rejestrację komend globalnych...');
        await rest.put(
            Routes.applicationCommands(client.user!.id),
            { body: commands },
        );
        console.log('Pomyślnie zarejestrowano komendy globalnie!');

        for (const [_, guild] of client.guilds.cache) {
            await updateServerStats(guild);
        }
    } catch (error) {
        console.error('Błąd rejestracji komend:', error);
    }

    startTopUpdater();
    startBadgesInfoUpdater();
    startHourlyAnnouncements();
    startDailyQuotes();
    startReputationTopUpdater();
    startLfgAutoCloser();
    startExpirationChecker();
    startDailyShopAutoPoster(); 
    startFortniteRankingCron();
    startFortniteStatusCron(); 
    startServerStatsCron();
    startPollChecker();
    startPokerRoomInactivityChecker();
    startTwitchMonitorCron();
});

client.on('interactionCreate', async interaction => {
    if (interaction.isMessageContextMenuCommand()) {
        if (interaction.commandName === 'Zapisz jako złoty tekst') {
            await interaction.deferReply({ ephemeral: true });
            const targetMessage = interaction.targetMessage;
            if (!targetMessage || !targetMessage.content) {
                return interaction.editReply({ content: '❌ Wybrana wiadomość nie zawiera tekstu.' });
            }

            const quoteText = targetMessage.content;
            const authorTag = targetMessage.author.tag;

            await QuoteModel.create({ text: quoteText, author: authorTag, addedBy: interaction.user.id });

            const channel = await client.channels.fetch(ID_KANALU_ZLOTE_MYSLI).catch(() => null) as TextChannel;
            if (channel) {
                const embed = new EmbedBuilder()
                    .setColor(0xE67E22)
                    .setTitle('✨ Złota myśl z serwera PJN')
                    .setDescription(`> *„${quoteText}”*\n\n**—${authorTag}**`)
                    .setTimestamp();
                await channel.send({ embeds: [embed] });
            }

            await interaction.editReply({ content: `✅ Pomyślnie dodano wiadomość do **Złotych myśli serwera PJN** (<#${ID_KANALU_ZLOTE_MYSLI}>)!` });
            return;
        }
    }

    if (interaction.isButton() && (interaction.customId === 'poker_join' || interaction.customId === 'poker_start')) {
        await interaction.deferReply({ ephemeral: true });
        const room = await PokerRoomModel.findOne({ messageId: interaction.message.id });
        if (!room || room.status === 'closed') {
            return interaction.editReply({ content: '❌ Ten pokój pokera jest już nieaktualny lub został zamknięty.' });
        }

        room.lastActivity = new Date();
        const userId = interaction.user.id;

        if (interaction.customId === 'poker_join') {
            if (room.players.includes(userId)) {
                return interaction.editReply({ content: '⚠️ Już dołączyłeś do tego pokoju!' });
            }
            if (room.players.length >= 4) {
                return interaction.editReply({ content: '❌ Pokój jest pełny (maksymalnie 4 graczy)!' });
            }

            let userDoc = await UserModel.findOne({ userId });
            if (!userDoc) userDoc = await UserModel.create({ userId });
            if (userDoc.balance < room.stake) {
                return interaction.editReply({ content: `❌ Nie masz wystarczająco środków (${room.stake} PJN-Coins).` });
            }

            room.players.push(userId);
            await room.save();

            const playersListText = room.players.map(id => `• <@${id}>`).join('\n');
            const embed = new EmbedBuilder()
                .setColor(0x9B59B6)
                .setTitle('🃏 Prywatny Pokój Pokerowy')
                .setDescription(
                    `👤 **Host:** <@${room.hostId}>\n` +
                    `💰 **Stawka:** ${room.stake} PJN-Coins\n` +
                    `👥 **Gracze (${room.players.length}/4):**\n${playersListText}\n\n` +
                    `⏱️ Pokój zostanie zamknięty po 15 minutach bezczynności.`
                )
                .setTimestamp();

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('poker_join').setLabel('Dołącz do pokoju').setStyle(ButtonStyle.Success).setEmoji('🃏'),
                new ButtonBuilder().setCustomId('poker_start').setLabel('Natychmiastowy start').setStyle(ButtonStyle.Primary).setEmoji('🚀')
            );

            await interaction.message.edit({ embeds: [embed], components: [row] }).catch(() => {});
            return interaction.editReply({ content: '✅ Pomyślnie dołączyłeś do pokoju pokera!' });
        }

        if (interaction.customId === 'poker_start') {
            if (room.hostId !== userId && !isAuthorized(userId)) {
                return interaction.editReply({ content: '❌ Tylko host pokoju może wymusić natychmiastowy start!' });
            }
            if (room.players.length < 2) {
                return interaction.editReply({ content: '❌ Do startu potrzeba minimum 2 graczy!' });
            }

            room.status = 'started';
            await room.save();

            const winnerId = room.players[Math.floor(Math.random() * room.players.length)];
            const totalPot = room.stake * room.players.length;

            for (const pId of room.players) {
                let pUser = await UserModel.findOne({ userId: pId });
                if (!pUser) pUser = await UserModel.create({ userId: pId });
                pUser.balance -= room.stake;
                pUser.casinoPlays = (pUser.casinoPlays || 0) + 1;
                if (pId === winnerId) {
                    pUser.balance += totalPot;
                    pUser.consecutiveWins = (pUser.consecutiveWins || 0) + 1;
                    pUser.consecutiveLosses = 0;
                } else {
                    pUser.consecutiveLosses = (pUser.consecutiveLosses || 0) + 1;
                    pUser.consecutiveWins = 0;
                }
                await pUser.save();
                await TransactionHistoryModel.create({
                    userId: pId,
                    type: 'casino_poker_multi',
                    amount: pId === winnerId ? (totalPot - room.stake) : -room.stake,
                    details: `Rozgrywka Pokerowa (Graczy: ${room.players.length})`
                });
            }

            const embed = new EmbedBuilder()
                .setColor(0x2ECC71)
                .setTitle('🃏 Poker • Rozgrywka Zakończona!')
                .setDescription(
                    `🏆 **Zwycięzca:** <@${winnerId}>\n` +
                    `💰 **Pula nagród:** ${totalPot} PJN-Coins!\n\n` +
                    `Wszyscy gracze rozegrali partię. Gratulacje dla wygranego!`
                )
                .setTimestamp();

            await interaction.message.edit({ embeds: [embed], components: [] }).catch(() => {});
            return interaction.editReply({ content: '🚀 Pomyślnie rozpoczęto i rozstrzygnięto grę w pokera!' });
        }
    }

    if (interaction.isButton() && interaction.customId === 'rr_start_modal') {
        const modal = new ModalBuilder()
            .setCustomId('rr_modal_submit')
            .setTitle('Rosyjska Ruletka - Stawka');
          
        const input = new TextInputBuilder()
            .setCustomId('rr_stake_input')
            .setLabel('Wpisz stawkę PJN-Coins:')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
        return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'rr_modal_submit') {
        await interaction.deferReply({ ephemeral: false }).catch(() => {});
        try {
            const stakeStr = interaction.fields.getTextInputValue('rr_stake_input');
            const stake = parseInt(stakeStr);

            if (isNaN(stake) || stake <= 0) {
                return interaction.editReply({ content: '❌ Podaj prawidłową stawkę większą od zera.' }).catch(() => {});
            }

            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) user = await UserModel.create({ userId: interaction.user.id });

            if (user.balance < stake) {
                return interaction.editReply({ content: `❌ Nie masz tylu środków! Posiadasz **${user.balance} PJN-Coins**.` }).catch(() => {});
            }

            user.balance -= stake;
            user.casinoPlays = (user.casinoPlays || 0) + 1;

            const now = new Date();
            const hasGuaranteedWin = user.guaranteedWinUntil && new Date(user.guaranteedWinUntil) > now;

            let bulletChance = 1 / 6; 
            if (stake >= 10000) bulletChance = 0.65;
            else if (stake >= 5000) bulletChance = 0.50;
            else if (stake >= 1000) bulletChance = 0.35;

            const isDead = hasGuaranteedWin ? false : (Math.random() < bulletChance);

            if (isDead) {
                user.consecutiveLosses = (user.consecutiveLosses || 0) + 1;
                user.consecutiveWins = 0;
                await user.save();
                await TransactionHistoryModel.create({ userId: interaction.user.id, type: 'casino_roulette', amount: -stake, details: `Przegrana (Stawka: ${stake})` });
                return interaction.editReply({ content: `🎯 **Rosyjska Ruletka:** <@${interaction.user.id}> zaryzykował stawkę **${stake} PJN-Coins** i pociągnął za spust...\n💥 **BAM!** Trafił na kulę! Straciłeś monety! (Stan portfela: **${user.balance}**)` }).catch(() => {});
            } else {
                const winAmount = stake * 2;
                user.balance += winAmount;
                user.consecutiveWins = (user.consecutiveWins || 0) + 1;
                user.consecutiveLosses = 0;
                await user.save();
                await TransactionHistoryModel.create({ userId: interaction.user.id, type: 'casino_roulette', amount: stake, details: `Wygrana (Stawka: ${stake})` });
                return interaction.editReply({ content: `🎯 **Rosyjska Ruletka:** <@${interaction.user.id}> zaryzykował **${stake} PJN-Coins** i pociągnął za spust...\n✨ **Klik!** Przeżył strzał i wygrywa **${winAmount} PJN-Coins**! (Stan portfela: **${user.balance}**)` }).catch(() => {});
            }
        } catch (err) {
            console.error('Błąd w obsłudze rosyjskiej ruletki:', err);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Wystąpił błąd podczas przetwarzania rosyjskiej ruletki.', ephemeral: true }).catch(() => {});
            }
        }
    }

    if (interaction.isButton() && interaction.customId === 'wheel_spin') {
        await interaction.deferReply({ ephemeral: false });
          
        let user = await UserModel.findOne({ userId: interaction.user.id });
        if (!user) user = await UserModel.create({ userId: interaction.user.id });

        const now = new Date();
        const twoHours = 2 * 60 * 60 * 1000;
        if (user.lastWheelSpin) {
            const diffTime = now.getTime() - new Date(user.lastWheelSpin).getTime();
            if (diffTime < twoHours) {
                const timeLeft = twoHours - diffTime;
                const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
                const minsLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                return interaction.editReply({ content: `⏳ <@${interaction.user.id}>, Koło Fortuny możesz kręcić raz na 2 godziny! Spróbuj ponownie za **${hoursLeft}h${minsLeft}m**.` });
            }
        }

        user.lastWheelSpin = now;
        const rewards = [
            { name: '50 PJN-Coins', type: 'coins', val: 50 },
            { name: '150 PJN-Coins', type: 'coins', val: 150 },
            { name: '300 PJN-Coins', type: 'coins', val: 300 },
            { name: '500 PJN-Coins', type: 'coins', val: 500 },
            { name: '1000 PJN-Coins (JACKPOT!)', type: 'coins', val: 1000 },
            { name: 'BANKRUT! (Strata 100 coinsów)', type: 'bankrupt', val: -100 },
            { name: 'Darmowy Bonus XP (+200 XP)', type: 'xp', val: 200 }
        ];

        const outcome = rewards[Math.floor(Math.random() * rewards.length)];
        user.casinoPlays = (user.casinoPlays || 0) + 1;

        if (outcome.type === 'coins') {
            user.balance += outcome.val;
            user.consecutiveWins = (user.consecutiveWins || 0) + 1;
            user.consecutiveLosses = 0;
            await user.save();
            await TransactionHistoryModel.create({ userId: interaction.user.id, type: 'wheel_fortune', amount: outcome.val, details: outcome.name });
            return interaction.editReply({ content: `🎡 **Koło Fortuny:** <@${interaction.user.id}> zakręcił kołem i wylosował: **${outcome.name}**! Portfel zasilony. (Stan portfela: **${user.balance} PJN-Coins**)` });
        } else if (outcome.type === 'bankrupt') {
            user.balance = Math.max(0, user.balance - 100);
            user.consecutiveLosses = (user.consecutiveLosses || 0) + 1;
            user.consecutiveWins = 0;
            await user.save();
            await TransactionHistoryModel.create({ userId: interaction.user.id, type: 'wheel_fortune', amount: -100, details: 'Bankrut' });
            return interaction.editReply({ content: `🎡 **Koło Fortuny:** O nie! <@${interaction.user.id}> wylosował **BANKRUT**! Tracisz 100 PJN-Coins. (Stan portfela: **${user.balance} PJN-Coins**)` });
        } else if (outcome.type === 'xp') {
            await addExp(interaction.user.id, outcome.val, interaction.guild);
            await user.save();
            return interaction.editReply({ content: `🎡 **Koło Fortuny:** <@${interaction.user.id}> trafił na **${outcome.name}**! Otrzymujesz zastrzyk punktów doświadczenia.` });
        }
    }

    if (interaction.isButton() && interaction.customId.startsWith('quiz_')) {
        await interaction.deferReply({ ephemeral: true });
        if (interaction.customId === 'quiz_correct') {
            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) user = await UserModel.create({ userId: interaction.user.id });
            user.balance += 250;
            await user.save();
            return interaction.editReply({ content: '✅ **Prawidłowa odpowiedź!** Otrzymujesz nagrodę **250 PJN-Coins** do portfela!' });
        } else {
            return interaction.editReply({ content: '❌ **Błędna odpowiedź!** Spróbuj ponownie następnym razem.' });
        }
    }

    if (interaction.isButton() && (interaction.customId.startsWith('poll_vote_') || interaction.customId === 'poll_show_voters')) {
        const poll = await PollModel.findOne({ messageId: interaction.message.id });
        if (!poll) return interaction.reply({ content: '❌ Ta ankieta nie istnieje w bazie.', ephemeral: true });

        if (interaction.customId === 'poll_show_voters') {
            if (!isAuthorized(interaction.user.id) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ Tylko administratorzy mogą podejrzeć, kto głosował!', ephemeral: true });
            }

            let votersDesc = `🔍 **Szczegóły głosowania dla ankiety:**\n*${poll.question}*\n\n`;
            for (let i = 0; i < poll.options.length; i++) {
                const optionVoters = poll.votes[i];
                const votersTagList = optionVoters.length > 0 
                    ? optionVoters.map(id => `<@${id}>`).join(', ') 
                    : 'Brak głosów';
                  
                votersDesc += `**${i + 1}.${poll.options[i]}** (${optionVoters.length} głosów):\n${votersTagList}\n\n`;
            }

            return interaction.reply({ content: votersDesc, ephemeral: true });
        }

        if (poll.ended) {
            return interaction.reply({ content: '❌ Ta ankieta została już zakończona!', ephemeral: true });
        }

        await interaction.deferUpdate();
        const optionIndex = parseInt(interaction.customId.replace('poll_vote_', ''));

        const userId = interaction.user.id;
        for (let i = 0; i < poll.votes.length; i++) {
            poll.votes[i] = poll.votes[i].filter(id => id !== userId);
        }
        poll.votes[optionIndex].push(userId);
        poll.markModified('votes');
        await poll.save();

        const totalVotes = poll.votes.reduce((acc, curr) => acc + curr.length, 0);
        let timeInfo = poll.endsAt ? `⏳ Koniec: <t:${Math.floor(new Date(poll.endsAt).getTime() / 1000)}:R>` : '⏳ Ankieta bez limitu czasu';
        let desc = `📊 **Ankieta aktywna na żywo**\n${timeInfo}\n\n`;

        const components: ActionRowBuilder<ButtonBuilder>[] = [];
        let currentRow = new ActionRowBuilder<ButtonBuilder>();

        for (let i = 0; i < poll.options.length; i++) {
            const count = poll.votes[i].length;
            const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
            const bar = '█'.repeat(Math.floor(percent / 10)) + '░'.repeat(10 - Math.floor(percent / 10));
            desc += `**${i + 1}.${poll.options[i]}**\n\`[${bar}]\` **${percent}\%** (${count} głosów)\n\n`;

            currentRow.addComponents(new ButtonBuilder().setCustomId(`poll_vote_${i}`).setLabel(`${i + 1} (${count})`).setStyle(ButtonStyle.Secondary));
            if (currentRow.components.length === 5 || i === poll.options.length - 1) {
                components.push(currentRow);
                currentRow = new ActionRowBuilder<ButtonBuilder>();
            }
        }

        const adminRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('poll_show_voters').setLabel('🔍 Kto głosował? (Admin)').setStyle(ButtonStyle.Primary)
        );
        components.push(adminRow);

        const embed = new EmbedBuilder().setColor(0x3498DB).setTitle(`🗳️ ${poll.question}`).setDescription(desc).setTimestamp();
        await interaction.message.edit({ embeds: [embed], components });
        return;
    }

    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'verification_gender_select') {
            await interaction.deferReply({ ephemeral: true });
            const guild = interaction.guild;
            if (!guild) return;

            const member = await guild.members.fetch(interaction.user.id).catch(() => null);
            if (!member) {
                return interaction.editReply({ content: '❌ Nie udało się pobrać Twoich danych na serwerze.' });
            }

            const selectedValue = interaction.values[0];
            const roleVerified = guild.roles.cache.get(ID_RANGI_ZWERYFIKOWANY);
              
            if (!roleVerified) {
                return interaction.editReply({ content: '❌ Ranga zweryfikowanego nie istnieje na serwerze.' });
            }

            try {
                await member.roles.add(roleVerified);

                if (selectedValue === 'verify_male') {
                    const roleMale = guild.roles.cache.get(ID_ROLI_MEZCZYZNA);
                    if (roleMale) await member.roles.add(roleMale);
                    await interaction.editReply({ content: `✅ **Pomyślnie zweryfikowano!** Otrzymałeś dostęp do serwera oraz rangę męską.` });
                } else if (selectedValue === 'verify_female') {
                    const roleFemale = guild.roles.cache.get(ID_ROLI_KOBIETA);
                    if (roleFemale) await member.roles.add(roleFemale);
                    await interaction.editReply({ content: `✅ **Pomyślnie zweryfikowano!** Otrzymałeś dostęp do serwera oraz rangę damską.` });
                }
            } catch (err) {
                await interaction.editReply({ content: '❌ Wystąpił błąd podczas nadawania ról weryfikacyjnych.' });
            }
            return;
        }

        if (interaction.customId === 'ticket_category_select') {
            await interaction.deferReply({ ephemeral: true });
            const guild = interaction.guild;
            if (!guild) return;

            const selectedCatValue = interaction.values[0];
            let catNamePrefix = 'zgloszenie';
            let catTitle = 'Zgłoszenie';

            if (selectedCatValue === 'ticket_shop') {
                catNamePrefix = 'sklep';
                catTitle = 'Zgłoszenie: Sklep / VIP';
            } else if (selectedCatValue === 'ticket_eco') {
                catNamePrefix = 'ekonomia';
                catTitle = 'Zgłoszenie: Ekonomia / Coinsy';
            } else if (selectedCatValue === 'ticket_bug') {
                catNamePrefix = 'bug';
                catTitle = 'Zgłoszenie: Błąd / Bug';
            } else {
                catNamePrefix = 'admin';
                catTitle = 'Zgłoszenie: Kontakt z Administracją';
            }

            const cleanUsername = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '');
            const channelName = `${catNamePrefix}-${cleanUsername}`;

            const existingChannel = guild.channels.cache.find(ch => ch.name === channelName);
            if (existingChannel) {
                return interaction.editReply({ content: `❌ Masz już otwarty taki kanał zgłoszeniowy: <#${existingChannel.id}>!` });
            }

            try {
                const parentCategoryId = await getFirstCategory(guild);

                const ticketChannel = await guild.channels.create({
                    name: channelName,
                    type: ChannelType.GuildText,
                    parent: parentCategoryId,
                    permissionOverwrites: [
                        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                        { id: ID_RANGI_MODERATOR, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                        { id: ID_RANGI_ADMIN, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
                    ],
                });

                const welcomeEmbed = new EmbedBuilder()
                    .setColor(0x3498DB)
                    .setTitle(`🎫 ${catTitle}: ${interaction.user.tag}`)
                    .setDescription(`Witaj <@${interaction.user.id}>!\n\nOpisz dokładnie swój problem. Administracja wkrótce się z Tobą skontaktuje.\n\nKliknij **Zamknij Zgłoszenie**, gdy sprawa zostanie rozwiązana.`)
                    .setTimestamp();

                const closeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder().setCustomId('close_ticket').setLabel('Zamknij Zgłoszenie').setStyle(ButtonStyle.Danger).setEmoji('🔒')
                );

                await ticketChannel.send({
                    content: `<@${interaction.user.id}> | <@&${ID_RANGI_MODERATOR}> <@&${ID_RANGI_ADMIN}>`,
                    embeds: [welcomeEmbed],
                    components: [closeRow]
                });

                await interaction.editReply({ content: `✅ Pomyślnie utworzono prywatny kanał zgłoszeniowy: <#${ticketChannel.id}>!` });
            } catch (err) {
                await interaction.editReply({ content: '❌ Wystąpił błąd podczas tworzenia kanału zgłoszenia.' });
            }
            return;
        }

        if (interaction.customId === 'shop_select') {
            await interaction.deferReply({ ephemeral: true });
            const itemId = interaction.values[0];
            const item = SHOP_ITEMS.find(i => i.id === itemId);
            if (!item) return;

            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) user = await UserModel.create({ userId: interaction.user.id });

            const canAfford = user.balance >= item.price;
            const diff = item.price - user.balance;

            const previewEmbed = new EmbedBuilder()
                .setColor(canAfford ? 0x2ECC71 : 0xE74C3C)
                .setTitle(`🛒 Podgląd przedmiotu: ${item.name}`)
                .setDescription(
                    `📝 **Opis:** ${item.description}\n` +
                    `💰 **Cena:** ${item.price} PJN-Coins\n` +
                    `💼 **Twój stan portfela:** ${user.balance} PJN-Coins\n\n` +
                    (canAfford 
                        ? `✅ **Status:** Stać Cię na ten zakup! Kliknij przycisk poniżej, aby sfinalizować transakcję.` 
                        : `❌ **Status:** Brakuje Ci jeszcze **${diff} PJN-Coins**!`)
                );

            const components = [];
            if (canAfford) {
                const buyButtonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`shop_buy_${item.id}`)
                        .setLabel('Potwierdź zakup')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('🛍️')
                );
                components.push(buyButtonRow);
            }

            await interaction.editReply({ embeds: [previewEmbed], components: components });
            return;
        }
    }

    if (interaction.isButton()) {
        if (interaction.customId === 'open_ghost_ticket') {
            await interaction.deferReply({ ephemeral: true });
            const guild = interaction.guild;
            if (!guild) return;

            const cleanUsername = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '');
            const existingChannel = guild.channels.cache.find(
                ch => ch.name === `duszek-${cleanUsername}` || ch.name === `ticket-${cleanUsername}`
            );

            if (existingChannel) {
                return interaction.editReply({ content: `❌ Masz już otwarty kanał zgłoszeniowy: <#${existingChannel.id}>!` });
            }

            try {
                const parentCategoryId = await getFirstCategory(guild);

                const ticketChannel = await guild.channels.create({
                    name: `duszek-${cleanUsername}`,
                    type: ChannelType.GuildText,
                    parent: parentCategoryId,
                    permissionOverwrites: [
                        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                        { id: ID_RANGI_DUSZKOWIEC, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                        { id: ID_RANGI_MODERATOR, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                        { id: ID_RANGI_ADMIN, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
                    ],
                });

                const welcomeEmbed = new EmbedBuilder()
                    .setColor(0x2ECC71)
                    .setTitle(`👻 Zgłoszenie Duszka: ${interaction.user.tag}`)
                    .setDescription(`Witaj <@${interaction.user.id}>!\n\nNapisz tutaj szczegóły dotyczące duszka lub biletu poza kolejką. Administracja wkrótce się z Tobą skontaktuje.\n\nKliknij **Zamknij Ticket**, gdy sprawa zostanie rozwiązana.`)
                    .setTimestamp();

                const closeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder().setCustomId('close_ticket').setLabel('Zamknij Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
                );

                await ticketChannel.send({
                    content: `<@${interaction.user.id}> | <@&${ID_RANGI_DUSZKOWIEC}> <@&${ID_RANGI_MODERATOR}> <@&${ID_RANGI_ADMIN}>`,
                    embeds: [welcomeEmbed],
                    components: [closeRow]
                });

                await interaction.editReply({ content: `✅ Stworzono dla Ciebie prywatny kanał zgłoszeniowy: <#${ticketChannel.id}>!` });
            } catch (err) {
                await interaction.editReply({ content: '❌ Wystąpił błąd podczas tworzenia kanału zgłoszenia.' });
            }
            return;
        }

        if (interaction.customId === 'bot_support_chat_modal') {
            const modal = new ModalBuilder()
                .setCustomId('bot_support_modal_submit')
                .setTitle('Wirtualny Asystent PJN - Rozmowa');
              
            const input = new TextInputBuilder()
                .setCustomId('support_user_message')
                .setLabel('Napisz o swoim problemie lub zadaj pytanie:')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Np. Kto jest technikiem serwera? / Jak sprawdzić portfel?')
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
            return interaction.showModal(modal);
        }

        if (interaction.customId === 'temp_voice_lock' || interaction.customId === 'temp_voice_unlock') {
            await interaction.deferReply({ ephemeral: true });
            const channel = interaction.channel;
            if (!channel || channel.type !== ChannelType.GuildVoice) {
                return interaction.editReply({ content: '❌ Ta opcja działa wyłącznie na czacie pokoju głosowego.' });
            }

            const isLocked = interaction.customId === 'temp_voice_lock';

            try {
                await channel.permissionOverwrites.edit(interaction.guildId!, {
                    Connect: isLocked ? false : null 
                });

                await interaction.editReply({ 
                    content: isLocked 
                        ? '🔒 Pomyślnie **zablokowałeś** swój pokój.' 
                        : '🔓 Pomyślnie **odblokowałeś** swój pokój.' 
                });
            } catch (e) {
                await interaction.editReply({ content: '❌ Wystąpił błąd podczas zmiany uprawnień pokoju.' });
            }
            return;
        }

        if (interaction.customId === 'role_fn_updates_toggle') {
            await interaction.deferReply({ ephemeral: true });
            const guild = interaction.guild;
            if (!guild) return;

            const member = await guild.members.fetch(interaction.user.id).catch(() => null);
            if (!member) {
                return interaction.editReply({ content: '❌ Nie udało się pobrać Twoich danych na serwerze.' });
            }

            const role = guild.roles.cache.get(ID_RANGI_AKTUALIZACJE_FORTNITE);
            if (!role) {
                return interaction.editReply({ content: '❌ Ranga powiadomień Fortnite nie istnieje na serwerze.' });
            }

            try {
                if (member.roles.cache.has(ID_RANGI_AKTUALIZACJE_FORTNITE)) {
                    await member.roles.remove(role);
                    await interaction.editReply({ content: `✅ Usunięto rangę powiadomień o aktualizacjach Fortnite.` });
                } else {
                    await member.roles.add(role);
                    await interaction.editReply({ content: `✅ Przyznano rangę powiadomień o aktualizacjach Fortnite!` });
                }
            } catch (err) {
                await interaction.editReply({ content: '❌ Wystąpił błąd podczas zmiany rangi.' });
            }
            return;
        }

        if (interaction.customId.startsWith('fn_rank_')) {
            await interaction.deferUpdate();
            const parts = interaction.customId.split('_');
            const type = parts[2]; 
            const direction = parts[3];
            let currentPage = parseInt(parts[4]) || 0;

            if (direction === 'prev') currentPage--;
            if (direction === 'next') currentPage++;

            if (type === 'under') {
                const topUsers = await UserModel.find({ epicNick: { $ne: null }, matchesPlayed: { $lt: 2800 } }).sort({ fortniteKills: -1 }).limit(100);
                const payload = await generateFortniteRankingEmbeds(interaction.guild, topUsers, '🟢 TOP • Początkujący (<2800 meczów)', 0x2ECC71, currentPage);
                await interaction.editReply(payload);
            } else {
                const topUsers = await UserModel.find({ epicNick: { $ne: null }, matchesPlayed: { $gte: 2800 } }).sort({ fortniteKills: -1 }).limit(100);
                const payload = await generateFortniteRankingEmbeds(interaction.guild, topUsers, '🔥 TOP • Weterani (2800+ meczów)', 0xE74C3C, currentPage);
                await interaction.editReply(payload);
            }
            return;
        }

        if (interaction.customId.startsWith('role_')) {
            await interaction.deferReply({ ephemeral: true });
            const roleConfig = ROLE_BUTTONS_MAP[interaction.customId];
            if (!roleConfig) {
                return interaction.editReply({ content: '❌ Nie znaleziono takiej rangi.' });
            }

            const guild = interaction.guild;
            if (!guild) return;

            const member = await guild.members.fetch(interaction.user.id).catch(() => null);
            if (!member) {
                return interaction.editReply({ content: '❌ Nie udało się pobrać Twoich danych na serwerze.' });
            }

            const role = guild.roles.cache.get(roleConfig.roleId);
            if (!role) {
                return interaction.editReply({ content: '❌ Ta rola nie istnieje już na serwerze.' });
            }

            try {
                if (member.roles.cache.has(roleConfig.roleId)) {
                    await member.roles.remove(role);
                    await interaction.editReply({ content: `✅ Usunięto rangę **${role.name}**.` });
                } else {
                    await member.roles.add(role);
                    await interaction.editReply({ content: `✅ Przyznano rangę **${role.name}**!` });
                }
            } catch (err) {
                await interaction.editReply({ content: '❌ Wystąpił błąd podczas zmiany rangi.' });
            }
            return;
        }

        if (interaction.customId.startsWith('shop_buy_')) {
            await interaction.deferReply({ ephemeral: true });
            const itemId = interaction.customId.replace('shop_buy_', '');
            const item = SHOP_ITEMS.find(i => i.id === itemId);
            if (!item) return interaction.editReply({ content: '❌ Nie znaleziono takiego przedmiotu.' });

            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) user = await UserModel.create({ userId: interaction.user.id });

            if (user.balance < item.price) {
                return interaction.editReply({ content: `❌ Nie masz wystarczająco środków! Posiadasz **${user.balance} PJN-Coins**.` });
            }

            user.balance -= item.price;
            await user.save();

            await ShopHistoryModel.create({
                userId: interaction.user.id,
                itemName: item.name,
                price: item.price
            });

            const member = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
            await checkAndAwardBadges(user, member, interaction.guild);

            if (item.type === 'vip') {
                user.vipExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); 
                await user.save();

                if (member) {
                    try {
                        await member.roles.add(ID_ROLI_VIP);
                        await interaction.user.send({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor(0xF1C40F)
                                    .setTitle('🎉 Gratulacje! Otrzymałeś rangę VIP na 30 dni')
                                    .setDescription(`Twoja transakcja w sklepie serwera **PJN** została zrealizowana! Ranga **VIP** jest aktywna.`)
                                    .setTimestamp()
                            ]
                        }).catch(() => {});
                    } catch (err) {}
                }
            } else if (item.type === 'double_chance') {
                user.doubleChanceUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                await user.save();
            } else if (item.type === 'custom_role') {
                user.customRoleExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                await user.save();
            } else if (item.type === 'badge') {
                if (!user.badges.includes(item.badgeName)) {
                    user.badges.push(item.badgeName);
                    await user.save();
                }
            } else if (item.type === 'custom_voice') {
                user.customVoiceExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                await user.save();
            } else if (item.type === 'daily_boost') {
                user.dailyBoostUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                await user.save();
            }

            await interaction.editReply({ content: `🎉 Zakupiono przedmiot **${item.name}** za **${item.price} PJN-Coins**!` });
            return;
        }

        // ZAMYKANIE TICKETU (M.IN. DUSZKI I ZGŁOSZENIA) Z ZACHĘTĄ DO DAWANIA REPUTACJI
        if (interaction.customId === 'close_ticket') {
            await interaction.deferReply({ ephemeral: true });
            const channel = interaction.channel as TextChannel;
            if (!channel) return;

            try {
                const overwrites = channel.permissionOverwrites.cache;
                let ticketCreatorId: string | null = null;
                for (const [id, overwrite] of overwrites) {
                    if (id !== interaction.guild?.id && overwrite.allow.has(PermissionFlagsBits.SendMessages)) {
                        const role = interaction.guild?.roles.cache.get(id);
                        if (!role) {
                            ticketCreatorId = id;
                            break;
                        }
                    }
                }

                if (ticketCreatorId) {
                    await channel.permissionOverwrites.edit(ticketCreatorId, {
                        SendMessages: false,
                        ViewChannel: true
                    }).catch(() => {});
                }

                const currentName = channel.name;
                const isGhostTicket = currentName.includes('duszek');

                if (!currentName.startsWith('zamkniety-')) {
                    await channel.setName(`zamkniety-${currentName.replace('ticket-', '').replace('duszek-', '').replace('sklep-', '').replace('ekonomia-', '').replace('bug-', '').replace('admin-', '')}`).catch(() => {});
                }

                const closedEmbed = new EmbedBuilder()
                    .setColor(0xE74C3C)
                    .setTitle('🔒 Zgłoszenie Zostało Zamknięte')
                    .setDescription(`Ten kanał został zamknięty przez <@${interaction.user.id}> i zarchiwizowany.`)
                    .setTimestamp();

                await channel.send({ embeds: [closedEmbed] });

                // POWIADOMIENIE ZACHĘCAJĄCE DO ODDANIA REPUTACJI ZA POMOC Z DUSZKAMI
                if (isGhostTicket) {
                    const repReminderEmbed = new EmbedBuilder()
                        .setColor(0xF1C40F)
                        .setTitle('⭐ Otrzymałeś pomoc z duszkiem? Podziękuj reputacją!')
                        .setDescription(
                            `Jesli Duszkowiec lub członek administracji pomógł Ci w odbiorze duszka / wymianie, zachęcamy do obdarowania go punktem reputacji!\n\n` +
                            `Przejdź na kanał <#${ID_KANAL_REPUTACJI}> i użyj komendy:\n` +
                            `• \`+rep @użytkownik [powód]\` lub \`+reputacja @użytkownik\`\n\n` +
                            `*Wspólnie budujemy bezpieczny rynek i przyjazną społeczność traderów duszków! 👻*`
                        )
                        .setTimestamp();

                    await channel.send({ embeds: [repReminderEmbed] });
                }

                await interaction.editReply({ content: `✅ Pomyślnie zamknięto i zarchiwizowano ten kanał.` });
            } catch (e) {
                await interaction.editReply({ content: `❌ Wystąpił błąd podczas zamykania.` });
            }
            return;
        }

        if (['lfg_join', 'lfg_leave', 'lfg_create_voice', 'lfg_close'].includes(interaction.customId)) {
            await interaction.deferReply({ ephemeral: true });
            const lfgDoc = await LFGModel.findOne({ messageId: interaction.message.id });

            if (!lfgDoc || lfgDoc.status === 'closed') {
                return interaction.editReply({ content: '❌ To ogłoszenie LFG jest już nieaktualne lub zamknięte.' });
            }

            const userId = interaction.user.id;
            const gameInfo = LFG_CONFIG.GAMES[lfgDoc.game as keyof typeof LFG_CONFIG.GAMES];

            if (interaction.customId === 'lfg_close') {
                if (lfgDoc.authorId !== userId) {
                    return interaction.editReply({ content: '❌ Tylko autor ogłoszenia może je zamknąć!' });
                }

                lfgDoc.status = 'closed';
                await lfgDoc.save();

                if (lfgDoc.voiceChannelId) {
                    try {
                        const guild = interaction.guild;
                        if (guild) {
                            const voiceChannel = await guild.channels.fetch(lfgDoc.voiceChannelId).catch(() => null);
                            if (voiceChannel) await voiceChannel.delete('Autor zamknął ogłoszenie LFG');
                        }
                    } catch (err) {}
                }

                await updateLFGMessage(interaction.message, lfgDoc);
                return interaction.editReply({ content: '✅ Pomyślnie zamknąłeś ogłoszenie LFG.' });
            }

            if (interaction.customId === 'lfg_join') {
                if (lfgDoc.currentPlayers.includes(userId)) {
                    return interaction.editReply({ content: '⚠️ Jesteś już na liście tej ekipy!' });
                }
                if (lfgDoc.currentPlayers.length >= lfgDoc.maxPlayers) {
                    return interaction.editReply({ content: '❌ Ta ekipa jest już pełna!' });
                }

                lfgDoc.currentPlayers.push(userId);
                if (lfgDoc.currentPlayers.length >= lfgDoc.maxPlayers) lfgDoc.status = 'full';
                await lfgDoc.save();

                await updateLFGMessage(interaction.message, lfgDoc);
                return interaction.editReply({ content: '✅ Dołączyłeś do ekipy!' });
            }

            if (interaction.customId === 'lfg_leave') {
                if (!lfgDoc.currentPlayers.includes(userId)) {
                    return interaction.editReply({ content: '⚠️ Nie jesteś w tej ekipie.' });
                }
                if (lfgDoc.authorId === userId) {
                    return interaction.editReply({ content: '❌ Autor ogłoszenia nie może go opuścić.' });
                }

                lfgDoc.currentPlayers = lfgDoc.currentPlayers.filter(id => id !== userId);
                if (lfgDoc.status === 'full') lfgDoc.status = 'active';
                await lfgDoc.save();

                await updateLFGMessage(interaction.message, lfgDoc);
                return interaction.editReply({ content: '✅ Opuściłeś ekipę.' });
            }

            if (interaction.customId === 'lfg_create_voice') {
                if (lfgDoc.authorId !== userId) {
                    return interaction.editReply({ content: '❌ Tylko autor może utworzyć pokój głosowy!' });
                }
                if (lfgDoc.voiceChannelId) {
                    return interaction.editReply({ content: `⚠️ Kanał głosowy już istnieje: <#${lfgDoc.voiceChannelId}>!` });
                }

                try {
                    const guild = interaction.guild;
                    if (guild) {
                        const permissionOverwrites: any[] = [{ id: guild.id, deny: [PermissionFlagsBits.ViewChannel] }];
                        for (const pId of lfgDoc.currentPlayers) {
                            permissionOverwrites.push({ id: pId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] });
                        }
                        const voiceChan = await guild.channels.create({
                            name: `🎮-${gameInfo?.name || 'Ekipa'}-${interaction.user.username}`,
                            type: ChannelType.GuildVoice,
                            parent: LFG_CONFIG.CATEGORY_VOICE,
                            permissionOverwrites: permissionOverwrites
                        });
                        lfgDoc.voiceChannelId = voiceChan.id;
                        await lfgDoc.save();
                        await updateLFGMessage(interaction.message, lfgDoc);
                        return interaction.editReply({ content: `✅ Utworzono kanał głosowy: <#${voiceChan.id}>!` });
                    }
                } catch (err) {}
            }
            return;
        }
    }

    if (interaction.isModalSubmit() && interaction.customId === 'bot_support_modal_submit') {
        await interaction.deferReply({ ephemeral: true });
        const guild = interaction.guild;
        if (!guild) return;

        const userMessage = interaction.fields.getTextInputValue('support_user_message');
        const cleanUsername = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '');

        try {
            const lowerMsg = userMessage.toLowerCase();
            let botCanResolve = false;
            let botReply = "";

            if (lowerMsg.includes('technik') || lowerMsg.includes('właściciel') || lowerMsg.includes('twórca')) {
                botCanResolve = true;
                botReply = `Głównym twórcą i streamerem projektu PJN jest **LangusPJN** (współtwórca: **ellader**).`;
            } else if (lowerMsg.includes('coins') || lowerMsg.includes('monet') || lowerMsg.includes('portfel')) {
                botCanResolve = true;
                botReply = `Walutą serwera są **PJN-Coins**. Portfel sprawdzisz komendą \`/portfel\`, a darmowe monety odbierzesz komendą \`/daily\`.`;
            } else if (lowerMsg.includes('sklep') || lowerMsg.includes('vip')) {
                botCanResolve = true;
                botReply = `Sklep serwerowy znajduje się na kanale <#${ID_KANAL_SKLEPU}>. Możesz tam kupować role, odznaki i bonusy.`;
            }

            if (botCanResolve) {
                const embedDirect = new EmbedBuilder()
                    .setColor(0x2ECC71)
                    .setTitle('🤖 Odpowiedź Wirtualnego Asystenta PJN')
                    .setDescription(`**Twoje pytanie:**\n> *"${userMessage}"*\n\n**Odpowiedź bota:**\n> *"${botReply}"*`)
                    .setTimestamp();

                return interaction.editReply({ embeds: [embedDirect] });
            }

            const parentCategoryId = await getFirstCategory(guild);

            const supportChannel = await guild.channels.create({
                name: `wsparcie-bot-${cleanUsername}`,
                type: ChannelType.GuildText,
                parent: parentCategoryId,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                    { id: ID_RANGI_MODERATOR, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                    { id: ID_RANGI_ADMIN, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
                ],
            });

            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle(`💬 Rozmowa z Asystentem & Kontakt z Administracją`)
                .setDescription(
                    `👤 **Twoje zapytanie:**\n> *"${userMessage}"*\n\n` +
                    `🔒 Utworzono dla Ciebie prywatny kanał wsparcia z administracją.`
                )
                .setTimestamp();

            const closeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('close_ticket').setLabel('Zamknij Zgłoszenie').setStyle(ButtonStyle.Danger).setEmoji('🔒')
            );

            await supportChannel.send({
                content: `<@${interaction.user.id}> | <@&${ID_RANGI_MODERATOR}> <@&${ID_RANGI_ADMIN}>`,
                embeds: [embed],
                components: [closeRow]
            });

            await interaction.editReply({ content: `🤖 Utworzono prywatny kanał wsparcia: <#${supportChannel.id}>.` });
        } catch (e) {
            await interaction.editReply({ content: '❌ Wystąpił błąd podczas przetwarzania wiadomości.' });
        }
        return;
    }

    if (interaction.isAutocomplete()) {
        const focusedValue = interaction.options.getFocused();

        if (interaction.commandName === 'mem') {
            try {
                const response = await fetch('https://api.imgflip.com/get_memes');
                const data = await response.json() as any;
                if (data && data.success && data.data && data.data.memes) {
                    const filtered = data.data.memes.filter((m: any) => m.name.toLowerCase().includes(focusedValue.toLowerCase())).slice(0, 25);
                    await interaction.respond(filtered.map((m: any) => ({ name: m.name, value: m.id })));
                } else {
                    await interaction.respond([]);
                }
            } catch (err) {
                await interaction.respond([]);
            }
            return;
        }

        if (interaction.commandName === 'daj-odznake' || interaction.commandName === 'zabierz-odznake') {
            const filtered = AVAILABLE_BADGES
                .filter(badge => badge.toLowerCase().includes(focusedValue.toLowerCase()))
                .slice(0, 25);
            await interaction.respond(filtered.map(badge => ({ name: badge.replace(/[*_]/g, ''), value: badge })));
            return;
        }

        return;
    }

    if (!interaction.isChatInputCommand()) return;
    const { commandName } = interaction;

    try {
        if (commandName === 'szukam') {
            if (interaction.channelId !== ID_KANALU_SZUKAM_DO_GRY) {
                return interaction.reply({ 
                    content: `❌ Komendy \`/szukam\` można używać wyłącznie na dedykowanym kanale: <#${ID_KANALU_SZUKAM_DO_GRY}>!`, 
                    ephemeral: true 
                });
            }

            await interaction.deferReply();
            const graKey = interaction.options.getString('gra', true);
            const maxPlayers = interaction.options.getInteger('osoby', true);
            const opis = interaction.options.getString('opis') || 'Brak dodatkowego opisu.';

            const gameInfo = LFG_CONFIG.GAMES[graKey as keyof typeof LFG_CONFIG.GAMES];
            if (!gameInfo) {
                return interaction.editReply({ content: '❌ Wybrano nieprawidłową grę.' });
            }

            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle(`${gameInfo.emoji} Szukanie Ekipy: ${gameInfo.name} 🟢 [AKTYWNE]`)
                .setDescription(
                    `👤 **Organizator:** <@${interaction.user.id}>\n` +
                    `👥 **Skład:** 1 / ${maxPlayers} osób\n` +
                    `📝 **Opis:** ${opis}\n\n` +
                    `📋 **Aktualni członkowie:**\n• <@${interaction.user.id}>`
                )
                .setTimestamp();

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('lfg_join').setLabel('Dołącz do ekipy').setStyle(ButtonStyle.Success).setEmoji('➕'),
                new ButtonBuilder().setCustomId('lfg_leave').setLabel('Opuść').setStyle(ButtonStyle.Danger).setEmoji('➖'),
                new ButtonBuilder().setCustomId('lfg_create_voice').setLabel('🎙️ Utwórz pokój').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('lfg_close').setLabel('Zamknij ogłoszenie').setStyle(ButtonStyle.Secondary).setEmoji('🔒')
            );

            const rolePing = gameInfo.roleId ? `<@&${gameInfo.roleId}>` : '';
            const sentMsg = await interaction.editReply({
                content: `${rolePing} 🎮 Gracz <@${interaction.user.id}> szuka ekipy do **${gameInfo.name}**!`,
                embeds: [embed],
                components: [row],
                allowedMentions: { roles: gameInfo.roleId ? [gameInfo.roleId] : [] }
            });

            await LFGModel.create({
                messageId: sentMsg.id,
                channelId: interaction.channelId,
                authorId: interaction.user.id,
                game: graKey,
                maxPlayers: maxPlayers,
                currentPlayers: [interaction.user.id],
                description: opis,
                status: 'active'
            });
            return;
        }

        if (commandName === 'portfel') {
            await interaction.deferReply({ ephemeral: true });
            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) user = await UserModel.create({ userId: interaction.user.id });

            const embed = new EmbedBuilder()
                .setColor(0xF1C40F)
                .setTitle(`💰 Portfel i Środki • ${interaction.user.tag}`)
                .setDescription(
                    `💵 **Stan konta:** **${user.balance} PJN-Coins**\n` +
                    `⭐ **Reputacja tradera:** **${user.reputation || 0} pkt**\n` +
                    `📊 **Poziom:** **${user.level || 1} lvl** (${user.exp || 0} XP)`
                )
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        if (commandName === 'daily') {
            await interaction.deferReply({ ephemeral: true });
            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) user = await UserModel.create({ userId: interaction.user.id });

            const now = new Date();
            const oneDay = 24 * 60 * 60 * 1000;

            if (user.lastDaily) {
                const diff = now.getTime() - new Date(user.lastDaily).getTime();
                if (diff < oneDay) {
                    const timeLeft = oneDay - diff;
                    const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
                    const minsLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                    return interaction.editReply({ content: `⏳ Możesz odebrać nagrodę /daily dopiero za **${hoursLeft}h ${minsLeft}m**!` });
                }
            }

            const hasBoost = user.dailyBoostUntil && new Date(user.dailyBoostUntil) > now;
            const reward = hasBoost ? 200 : 100;

            user.balance += reward;
            user.lastDaily = now;
            await user.save();

            return interaction.editReply({ content: `🎁 Otrzymałeś **${reward} PJN-Coins** z komendy daily! ${hasBoost ? '*(Aktywny pakiet 2x Daily)*' : ''}` });
        }

        if (commandName === 'przelej') {
            await interaction.deferReply();
            const targetUser = interaction.options.getUser('uzytkownik', true);
            const kwota = interaction.options.getInteger('kwota', true);

            if (targetUser.id === interaction.user.id) return interaction.editReply({ content: '❌ Nie możesz przelać monet samemu sobie!' });
            if (targetUser.bot) return interaction.editReply({ content: '❌ Nie możesz przelewać monet botom!' });
            if (kwota <= 0) return interaction.editReply({ content: '❌ Kwota przelewu musi być większa od zera!' });

            let sender = await UserModel.findOne({ userId: interaction.user.id });
            if (!sender || sender.balance < kwota) return interaction.editReply({ content: '❌ Nie masz wystarczająco monet w portfelu!' });

            let receiver = await UserModel.findOne({ userId: targetUser.id });
            if (!receiver) receiver = await UserModel.create({ userId: targetUser.id });

            sender.balance -= kwota;
            sender.totalDonated = (sender.totalDonated || 0) + kwota;
            receiver.balance += kwota;

            await sender.save();
            await receiver.save();

            await TransactionHistoryModel.create({
                userId: interaction.user.id,
                targetUserId: targetUser.id,
                type: 'przelej',
                amount: kwota,
                details: `Przelew od ${interaction.user.tag} do ${targetUser.tag}`
            });

            return interaction.editReply({ content: `💸 Pomyślnie przelano **${kwota} PJN-Coins** dla <@${targetUser.id}>!` });
        }

        if (commandName === 'reputacja') {
            await interaction.deferReply();
            const targetUser = interaction.options.getUser('uzytkownik') || interaction.user;
            let user = await UserModel.findOne({ userId: targetUser.id });
            if (!user) user = await UserModel.create({ userId: targetUser.id });

            const repVal = user.reputation || 0;
            let statusTrader = 'Brak statusu';
            if (repVal >= 50) statusTrader = '🟢 **Wzorowy Trader** (50+ pkt)';
            else if (repVal >= 10) statusTrader = '🟡 **Pozytywny Trader** (10+ pkt)';
            else if (repVal <= -5) statusTrader = '🔴 **Negatywny Trader** (Ryzyko)';

            const embed = new EmbedBuilder()
                .setColor(0xF1C40F)
                .setTitle(`⭐ Profil Reputacji Tradera • ${targetUser.tag}`)
                .setThumbnail(targetUser.displayAvatarURL())
                .setDescription(
                    `⭐ **Punkty reputacji:** **${repVal} pkt**\n` +
                    `🛡️ **Ranga handlowa:** ${statusTrader}\n\n` +
                    `💡 *Aby dać reputację po wymianie, wpisz na czacie:*\n\`+rep <@${targetUser.id}> [powód]\` lub \`+reputacja <@${targetUser.id}>\``
                )
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        if (commandName === 'exp') {
            await interaction.deferReply();
            const targetUser = interaction.options.getUser('uzytkownik') || interaction.user;
            let user = await UserModel.findOne({ userId: targetUser.id });
            if (!user) user = await UserModel.create({ userId: targetUser.id });

            const reqExp = user.level * 150;
            const rankDetails = await getUserLevelRankDetails(targetUser.id);

            const embed = new EmbedBuilder()
                .setColor(0x9B59B6)
                .setTitle(`⭐ Statystyki Doświadczenia • ${targetUser.tag}`)
                .setDescription(
                    `⭐ **Poziom:** **${user.level} lvl**\n` +
                    `🎯 **XP:** **${user.exp} / ${reqExp} XP**\n` +
                    `🏆 **Pozycja w rankingu:** **#${rankDetails.rank} z ${rankDetails.total}**`
                )
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        if (commandName === 'profil') {
            await interaction.deferReply();
            const targetUser = interaction.options.getUser('uzytkownik') || interaction.user;
            let user = await UserModel.findOne({ userId: targetUser.id });
            if (!user) user = await UserModel.create({ userId: targetUser.id });

            const rankDetails = await getUserLevelRankDetails(targetUser.id);
            const userBadges = user.badges || [];

            const catChat = userBadges.filter(b => b.includes('Gadulec') || b.includes('Kronikarz') || b.includes('Król Wiadomości') || b.includes('Wygadany Mędrzec') || b.includes('Ekspresja') || b.includes('Nocny Marek') || b.includes('Mikrofonu') || b.includes('Audiofil') || b.includes('Duch Kanałów'));
            const catLevels = userBadges.filter(b => b.includes('Awansowy Ekspert') || b.includes('Mistrz Poziomów') || b.includes('Legenda Serwera'));
            const catEco = userBadges.filter(b => b.includes('Kapitalista') || b.includes('Magnat') || b.includes('Milioner') || b.includes('Miliarder') || b.includes('Hojny Darczyńca') || b.includes('Filantrop') || b.includes('Klient sklepu') || b.includes('Zaawansowany klient'));
            const catCasino = userBadges.filter(b => b.includes('Graczyk') || b.includes('Ryzykant') || b.includes('Hazardowy Tycoon') || b.includes('Fortuna') || b.includes('Czarna Seria') || b.includes('Niepowstrzymana Seria'));
            const catOther = userBadges.filter(b => b.includes('Filozof') || b.includes('Pomocna Dłoń') || b.includes('Weteran') || b.includes('Patriarcha') || b.includes('Filar') || b.includes('Kolekcjoner'));

            const formatCatVertical = (arr: string[]) => arr.length > 0 ? arr.map(b => `• ${b}`).join('\n') : 'Brak';

            const embed = new EmbedBuilder()
                .setColor(0x9B59B6)
                .setTitle(`👤 Profil Gracza • ${targetUser.tag}`)
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { name: '💰 Portfel', value: `**${user.balance || 0} PJN-Coins**`, inline: true },
                    { name: '⭐ Poziom & XP', value: `Poziom **${user.level || 1}** (${user.exp || 0} XP)\nRanking: **#${rankDetails.rank}**`, inline: true },
                    { name: '⭐ Reputacja', value: `**${user.reputation || 0} pkt**`, inline: true },
                    { name: '🎮 Fortnite Stats', value: `Nick: **${user.epicNick || 'Brak'}**\nZabójstwa: **${user.fortniteKills || 0}**`, inline: false },
                    { name: '💬 Aktywność i Głos', value: formatCatVertical(catChat), inline: false },
                    { name: '⭐ Poziomy Serwera', value: formatCatVertical(catLevels), inline: false },
                    { name: '💰 Ekonomia i Sklep', value: formatCatVertical(catEco), inline: false },
                    { name: '🎲 Kasyno i Gry', value: formatCatVertical(catCasino), inline: false },
                    { name: '🏆 Staż i Inne', value: formatCatVertical(catOther), inline: false }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
            return;
        }

        if (commandName === 'fn-rejestracja') {
            await interaction.deferReply({ ephemeral: true });
            const nick = interaction.options.getString('nick', true);

            try {
                const res = await fetch(`https://fortnite-api.com/v2/stats/br/v2?name=${encodeURIComponent(nick)}`, {
                    headers: { 'Authorization': process.env.FORTNITE_API_KEY || '' }
                });
                const data = await res.json() as any;

                if (!data || data.status !== 200 || !data.data) {
                    return interaction.editReply({ content: `❌ Nie znaleziono gracza o nicku **${nick}** w Fortnite lub statystyki są ukryte w grze!` });
                }

                let user = await UserModel.findOne({ userId: interaction.user.id });
                if (!user) user = await UserModel.create({ userId: interaction.user.id });

                user.epicNick = data.data.account.name;
                const overall = data.data.stats.all?.overall || {};
                user.fortniteKills = overall.kills || 0;
                user.matchesPlayed = overall.matches || 0;
                user.estimatedPlaytimeHours = Math.round(user.matchesPlayed * 0.25);
                await user.save();

                const categoryStr = user.matchesPlayed < 2800 ? 'Początkujący (<2800 meczów)' : 'Weteran (2800+ meczów)';
                await interaction.editReply({ content: `✅ Pomyślnie zarejestrowano nick **${user.epicNick}**!\n📊 Rozegrane mecze: **${user.matchesPlayed}**\n⏱️ Szacowany czas gry: **~${user.estimatedPlaytimeHours}h**\n📂 Kategoria: **${categoryStr}**\n🎯 Zsynchronizowano ${user.fortniteKills} killi.` });
            } catch (e) {
                await interaction.editReply({ content: '❌ Wystąpił błąd podczas weryfikacji nicku z API Fortnite.' });
            }
            return;
        }

        if (commandName === 'fn-sklep') {
            await interaction.deferReply();
            try {
                const res = await fetch('https://fortnite-api.com/v2/shop', {
                    headers: { 'Authorization': process.env.FORTNITE_API_KEY || '' }
                });
                const data = await res.json() as any;

                const embed = new EmbedBuilder()
                    .setColor(0x00D9FF)
                    .setTitle('🛒 Codzienny Sklep Fortnite')
                    .setTimestamp();

                if (data && data.status === 200 && data.data && data.data.entries) {
                    const entries = data.data.entries.slice(0, 10);
                    let descriptionText = 'Wyróżnione pozycje z dzisiejszego sklepu:\n\n';
                    for (const entry of entries) {
                        const rawName = entry.items?.[0]?.name || entry.bundle?.name || 'Przedmiot Fortnite';
                        const price = entry.finalPrice || entry.regularPrice || 'N/D';
                        descriptionText += `• **${rawName}** — 🪙 \`${price} V-Bucks\`\n`;
                    }
                    embed.setDescription(descriptionText);
                }
                await interaction.editReply({ embeds: [embed] });
            } catch (e) {
                await interaction.editReply({ content: '❌ Błąd pobierania sklepu Fortnite.' });
            }
            return;
        }

        if (commandName === 'fn-mapa') {
            await interaction.deferReply();
            try {
                const res = await fetch('https://fortnite-api.com/v1/map');
                const data = await res.json() as any;
                if (data && data.status === 200 && data.data && data.data.images) {
                    const embed = new EmbedBuilder()
                        .setColor(0x2ECC71)
                        .setTitle('🗺️ Aktualna Mapa Fortnite')
                        .setImage(data.data.images.pois || data.data.images.image)
                        .setTimestamp();
                    await interaction.editReply({ embeds: [embed] });
                }
            } catch (e) {
                await interaction.editReply({ content: '❌ Błąd pobierania mapy.' });
            }
            return;
        }

        if (commandName === 'mem') {
            await interaction.deferReply();
            const templateId = interaction.options.getString('szablon', true);
            const text0 = interaction.options.getString('gora') || '';
            const text1 = interaction.options.getString('dol') || '';

            try {
                const params = new URLSearchParams();
                params.append('template_id', templateId);
                params.append('username', process.env.IMGFLIP_USERNAME || 'demo');
                params.append('password', process.env.IMGFLIP_PASSWORD || 'demo');
                params.append('text0', text0);
                params.append('text1', text1);

                const res = await fetch('https://api.imgflip.com/caption_image', {
                    method: 'POST',
                    body: params
                });
                const data = await res.json() as any;

                if (data && data.success && data.data?.url) {
                    const embed = new EmbedBuilder()
                        .setColor(0xE74C3C)
                        .setTitle(`🖼️ Mem stworzony przez ${interaction.user.username}`)
                        .setImage(data.data.url)
                        .setTimestamp();
                    await interaction.editReply({ embeds: [embed] });
                } else {
                    await interaction.editReply({ content: '❌ Nie udało się wygenerować mema z podanymi danymi.' });
                }
            } catch (e) {
                await interaction.editReply({ content: '❌ Błąd podczas generowania mema.' });
            }
            return;
        }

        if (commandName === 'sklep') {
            await interaction.deferReply({ ephemeral: true });
            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) user = await UserModel.create({ userId: interaction.user.id });

            const embed = new EmbedBuilder()
                .setColor(0xF1C40F)
                .setTitle('🛒 Podgląd Portfela i Sklepu PJN')
                .setDescription(`💰 Twój aktualny stan portfela: **${user.balance} PJN-Coins**\n\nPrzejdź na kanał <#${ID_KANAL_SKLEPU}>, aby dokonać zakupów z panelu!`);
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        if (commandName === 'moje-przedmioty') {
            await interaction.deferReply({ ephemeral: true });
            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) user = await UserModel.create({ userId: interaction.user.id });

            const now = new Date();
            let desc = `📦 **Aktywne usługi użytkownika <@${interaction.user.id}>:**\n\n`;
            let activeCount = 0;

            const formatTimeLeft = (date: Date) => {
                const diff = new Date(date).getTime() - now.getTime();
                if (diff <= 0) return 'Wygasło';
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                return `Pozostało: **${days} dni, ${hours} godz.**`;
            };

            if (user.vipExpiresAt && new Date(user.vipExpiresAt) > now) {
                activeCount++;
                desc += `🟡 **Rola VIP** — ${formatTimeLeft(user.vipExpiresAt)}\n\n`;
            }
            if (user.dailyBoostUntil && new Date(user.dailyBoostUntil) > now) {
                activeCount++;
                desc += `🎁 **Pakiet "2x Daily"** — ${formatTimeLeft(user.dailyBoostUntil)}\n\n`;
            }

            if (activeCount === 0) desc += `*Nie masz obecnie żadnych aktywnych usług czasowych.*`;

            const embed = new EmbedBuilder().setColor(0x3498DB).setTitle('⏳ Twoje Przedmioty').setDescription(desc);
            await interaction.editReply({ embeds: [embed] });
            return;
        }

    } catch (err) {
        console.error('Błąd podczas wykonywania komendy:', err);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Wystąpił błąd podczas wykonywania tej komendy.', ephemeral: true }).catch(() => {});
        }
    }
});

client.login(token);
