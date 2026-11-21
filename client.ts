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

// Schemat dla predykcji (bez limitu czasowego, ręczne zamknięcie przez admina)
const predictionSchema = new mongoose.Schema({
    messageId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true },
    question: { type: String, required: true },
    option1: { type: String, required: true },
    option2: { type: String, required: true },
    option3: { type: String, default: null },
    option4: { type: String, default: null },
    option5: { type: String, default: null },
    votes1: { type: [String], default: [] },
    votes2: { type: [String], default: [] },
    votes3: { type: [String], default: [] },
    votes4: { type: [String], default: [] },
    votes5: { type: [String], default: [] },
    rewardText: { type: String, default: '500 PJN-Coins' },
    multiplier: { type: Number, default: 1 },
    ended: { type: Boolean, default: false }
});
const PredictionModel = mongoose.model('Prediction', predictionSchema);

// Schemat dla zakładów (zakład tworzony przez admina, dołączanie, przebijanie, pula, mnożnik)
const betSchema = new mongoose.Schema({
    messageId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true },
    question: { type: String, required: true },
    durationMinutes: { type: Number, required: true },
    multiplier: { type: Number, default: 1 },
    participants: { type: [{ userId: String, amount: Number }], default: [] },
    endsAt: { type: Date, required: true },
    ended: { type: Boolean, default: false }
});
const BetModel = mongoose.model('Bet', betSchema);

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
const ID_KANALU_PREDICTY = '1563192039846445057';
const ID_KANALU_REKORDY_STREAM = '1563192290602909787';
const ID_KANALU_ANONIMOWE_WYZNANIA = '1563192566583795782';
const ID_KANALU_POMYSLE_I_SUGESTIE = '1563191817384493186';

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
const ID_KANAL_TWORZENIA_POKOJU = '1554409138824417300';
const ID_KANAL_MUZYCZNEGO = '1532870796530155641';
const XP_ZA_MINUTE_RADIA = 5;      // XP serwera za minutę słuchania radia na kanale muzycznym

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
    { id: 'daily_boost', name: '🎁 Pakiet "2x Daily" na tydzień', price: 8000, description: 'Podwójna ilość PJN-Coins z komendy /daily przez 7 dni.', type: 'daily_boost' },
    { id: 'bp_premium', name: '⚔️ Karnet Premium PJN Battle Pass', price: 20000, description: 'Odblokowuje Ścieżkę Elitarną karnetu (30 poziomów nagród: rangi VIP, PJN-Coins, XP i bonusy). Posiadacze rangi VIP kupują taniej — 10 000 PJN-Coins.', type: 'battlepass' }
];

const LIVE_IMAGE_URL = "https://cdn.discordapp.com/attachments/1532321067731783684/1545708586108325898/IMG_20260905_101345.jpg?ex=6a9d20cc&is=6a9bcf4c&hm=a3a2a62e8f092f637ca72db6600ba805fb1a84a709595a77073021274e250a3e&";

function isAuthorized(userId: string): boolean {
    const adminIds = ['1175798371995361343', '1493928957408448563'];
    return adminIds.includes(userId);
}

async function sendCoinsNotification(userId: string, amount: number, senderName: string, reason: string) {
    try {
        const user = await client.users.fetch(userId).catch(() => null);
        if (!user) return;

        const embed = new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle('💰 Otrzymałeś PJN-Coins!')
            .setDescription(
                `Siema <@${userId}>!\n\n` +
                `Otrzymałeś **${amount} PJN-Coins**!\n\n` +
                `👤 **Od:** ${senderName}\n` +
                `📝 **Powód:** ${reason}`
            )
            .setTimestamp()
            .setFooter({ text: 'PJN Ekonomia • Powiadomienie' });

        await user.send({ embeds: [embed] }).catch(() => {});
    } catch (e) {
        console.error('Nie udało się wysłać powiadomienia PW o coinsach:', e);
    }
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
                            await channel.setName(`🟣・ᴛᴡɪᴛᴄʜ-ᴏꜰꜰʟɪɴᴇ`).catch(() => {});
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

        await sendCoinsNotification(member.id, 200, 'System PJN', 'Prezent na start za dołączenie do serwera Discord');

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

async function setupPredictionsChannel() {
    try {
        const channel = await client.channels.fetch(ID_KANALU_PREDICTY).catch(() => null) as TextChannel;
        if (!channel) return;
        // UWAGA: nie czyscimy historii tego kanalu - kasowaloby to aktywne predykcje i zaklady.

        const embed = new EmbedBuilder()
            .setColor(0x00D9FF)
            .setTitle('🔮 Strefa Predykcji i Zakładów PJN')
            .setDescription(
                'Witaj w oficjalnej strefie predykcji i zakładów serwera!\n\n' +
                '🤖 **Jak to działa?**\n' +
                '• Administratorzy tworzą oficjalne predykcje z opcjami za pomocą komendy `/predykcja` oraz zakłady za pomocą `/zakłady`.\n' +
                '• W zakładach możesz dołączyć, wpłacić PJN Coins, a także **przebijać** stawkę innych graczy!\n' +
                '• Admin może pomnożyć pulę, a po zakończeniu bot podsumuje wyniki, wyłoni zwycięzców i rozda PJN Coins!'
            )
            .setImage(LIVE_IMAGE_URL)
            .setTimestamp()
            .setFooter({ text: 'PJN System Predykcji i Zakładów' });

        await sendOrUpdateInfoEmbed(channel, 'info_msg_predykcje', embed);
    } catch (e) {}
}

async function setupAnonymousConfessionsChannel() {
    try {
        const channel = await client.channels.fetch(ID_KANALU_ANONIMOWE_WYZNANIA).catch(() => null) as TextChannel;
        if (!channel) return;
        // UWAGA: nie czyscimy historii tego kanalu - kasowaloby to opublikowane wyznania.

        const embed = new EmbedBuilder()
            .setColor(0x9B59B6)
            .setTitle('🕶️ Anonimowe Wyzwania i Wyznania PJN')
            .setDescription(
                'Chcesz podzielić się czymś z społecznością w pełni anonimowo?\n\n' +
                '✨ **Jak użyć komendy?**\n' +
                '• Wpisz w dowolnym miejscu komendę `/wyznanie [treść]`.\n' +
                '• Bot opublikuje Twoje wyznanie tutaj całkowicie anonimowo wraz z reakcjami!'
            )
            .setImage(LIVE_IMAGE_URL)
            .setTimestamp()
            .setFooter({ text: 'PJN Anonimowe Wyznania' });

        await sendOrUpdateInfoEmbed(channel, 'info_msg_wyznania', embed);
    } catch (e) {}
}

// Wysyla embed informacyjny kanalu, a przy kolejnych restartach EDYTUJE ta sama wiadomosc
// (channelId/messageId zapisane w bazie), zeby na kanale nie tworzyly sie duplikaty,
// a historia kanalu (wyznania, sugestie, zaklady, rekordy) nie byla kasowana.
async function sendOrUpdateInfoEmbed(channel: TextChannel, configKey: string, embed: EmbedBuilder, components?: any[]) {
    try {
        // Tytul embeda pozwala rozpoznac wlasna wiadomosc nawet wtedy, gdy zapisu w bazie nie ma
        // albo wskazuje na skasowana wiadomosc. Bez tego bot wysylal kolejna kopie przy kazdym starcie.
        const title: string | null = (embed.data && embed.data.title) || null;
        const isOwnPanel = (msg: any) =>
            msg.author?.id === client.user?.id &&
            (msg.embeds || []).some((e: any) => e && e.title && (!title || e.title === title));

        const saved: any = await ConfigModel.findOne({ key: configKey });
        let target: any = null;
        if (saved) {
            const oldChannel = await client.channels.fetch(saved.channelId).catch(() => null) as TextChannel | null;
            const oldMessage = oldChannel
                ? await oldChannel.messages.fetch(saved.messageId).catch(() => null)
                : null;
            if (oldChannel && oldMessage) target = oldMessage;
        }

        if (target) {
            await target.edit({ embeds: [embed], components: components || [] }).catch(() => {});
            // Sprzatanie kopii, ktore powstanily wczesniej - zostaje tylko jedna wiadomosc tego panelu.
            const recent = await channel.messages.fetch({ limit: 100 }).catch(() => null);
            if (recent) {
                for (const msg of recent.values()) {
                    if (msg.id !== target.id && isOwnPanel(msg)) await msg.delete().catch(() => {});
                }
            }
            return;
        }

        // Brak zapisu lub skasowana wiadomosc: szukamy istniejacej kopii panelu i edytujemy ja,
        // a nadmiarowe kopie usuwamy - zamiast wysylac kolejna wiadomosc.
        let adopted: any = null;
        const recent = await channel.messages.fetch({ limit: 100 }).catch(() => null);
        if (recent) {
            for (const msg of recent.values()) {
                if (!isOwnPanel(msg)) continue;
                if (!adopted) { adopted = msg; continue; }
                await msg.delete().catch(() => {});
            }
        }

        if (adopted) {
            await adopted.edit({ embeds: [embed], components: components || [] }).catch(() => {});
        }

        const finalMsg = adopted || await channel.send({ embeds: [embed], components: components || [] });

        await ConfigModel.findOneAndUpdate(
            { key: configKey },
            { key: configKey, channelId: channel.id, messageId: finalMsg.id },
            { upsert: true }
        ).catch(() => {});
    } catch (e) {
        console.error('Nie udalo sie wyslac/edytowac wiadomosci informacyjnej:', configKey, e);
    }
}

async function setupStreamRecordsChannel() {
    try {
        const channel = await client.channels.fetch(ID_KANALU_REKORDY_STREAM).catch(() => null) as TextChannel;
        if (!channel) return;
        // UWAGA: nie czyscimy historii tego kanalu - kasowaloby to opublikowane rekordy streamu.

        const embed = new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle('🏆 Rekordy ze Streamów PJN')
            .setDescription(
                'Ten kanał dokumentuje największe osiągnięcia, rekordy widzów, donacji i momenty ze streamów!\n\n' +
                '✨ **Jak użyć komendy?**\n' +
                '• Wpisz komendę `/rekord-stream [opis]`.\n' +
                '• Opisz swój rekord lub osiągnięcie, a bot opublikuje je tutaj dla całej społeczności!'
            )
            .setImage(LIVE_IMAGE_URL)
            .setTimestamp()
            .setFooter({ text: 'PJN Rekordy Streamu' });

        await sendOrUpdateInfoEmbed(channel, 'info_msg_rekordy_stream', embed);
    } catch (e) {}
}

async function setupSuggestionsChannel() {
    try {
        const channel = await client.channels.fetch(ID_KANALU_POMYSLE_I_SUGESTIE).catch(() => null) as TextChannel;
        if (!channel) return;
        // UWAGA: nie czyscimy historii tego kanalu - kasowaloby to zgloszone sugestie.

        const embed = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle('💡 Pomysły i Sugestie dotyczące Serwera')
            .setDescription(
                'Masz ciekawy pomysł na rozwój naszego serwera lub bota?\n\n' +
                '✨ **Jak złożyć sugestię?**\n' +
                '• Wpisz w dowolnym miejscu komendę `/sugestia [twoja treść]`.\n' +
                '• Bot automatycznie opublikuje ją tutaj wraz z przyciskami do głosowania (👍 / 👎).\n' +
                '• Najlepsze pomysły trafiają do realizacji!'
            )
            .setImage(LIVE_IMAGE_URL)
            .setTimestamp()
            .setFooter({ text: 'PJN System Sugestii' });

        await sendOrUpdateInfoEmbed(channel, 'info_msg_sugestie', embed);
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
                '🃏 **6. Poker**\n> Komenda: `/poker` — Utwórz lub dołącz do pokoju pokerowego.\n\n' +
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

function warsawDayKey(date: Date = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Warsaw',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(date);
}

/** Blokada drugiej wysyłki: sprawdza, czy dzisiejszy cytat już poszedł na kanał. */
async function quoteAlreadySentToday(): Promise<boolean> {
    try {
        const channel = await client.channels.fetch(ID_KANALU_CYTATY).catch(() => null) as TextChannel;
        if (!channel || !channel.messages) return false;
        const messages = await channel.messages.fetch({ limit: 30 });
        const today = warsawDayKey();
        for (const msg of messages.values()) {
            if (msg.author.id !== client.user?.id) continue;
            const isQuote = msg.embeds.some(e => (e.footer?.text || '').includes('PJN Codzienne Cytaty'));
            if (isQuote && warsawDayKey(msg.createdAt) === today) return true;
        }
    } catch (e) {}
    return false;
}

function startDailyQuotes() {
    // Jeden cytat dziennie o 7:30 czasu polskiego. Strefa podana wprost, żeby nie zależała
    // od strefy kontenera (Europe/Helsinki), a recoverMissedExecutions:false blokuje
    // dosłanie cytatu po restarcie bota.
    cron.schedule('30 7 * * *', async () => {
        try {
            if (await quoteAlreadySentToday()) {
                console.log('[Cytaty] Dzisiejszy cytat już poszedł - pomijam drugą wysyłkę.');
                return;
            }
            await sendQuoteToChannel(ID_KANALU_CYTATY);
        } catch (err) {
            console.error('Błąd podczas wysyłania codziennego cytatu:', err);
        }
    }, { timezone: 'Europe/Warsaw', recoverMissedExecutions: false });
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

let lastFortniteNewsKey: string | null = null;
let lastFortniteServerStatus: boolean | null = null;
const FORTNITE_NEWS_KEY_CONFIG = 'fortnite_news_last_key';

// Klucz ostatniej ogloszonej aktualizacji zapisujemy w bazie, zeby po restarcie bot
// wiedzial, co juz ogloszono, i nie wysylal powiadomienia o tej samej wersji drugi raz.
async function loadLastFortniteNewsKey(): Promise<string | null> {
    if (lastFortniteNewsKey) return lastFortniteNewsKey;
    try {
        const cfg: any = await ConfigModel.findOne({ key: FORTNITE_NEWS_KEY_CONFIG });
        if (cfg && cfg.messageId) lastFortniteNewsKey = cfg.messageId;
    } catch (e) {
        console.error('[Fortnite News] Nie udało się odczytać zapamiętanego klucza aktualizacji z bazy:', e);
    }
    return lastFortniteNewsKey;
}

async function rememberLastFortniteNewsKey(key: string) {
    lastFortniteNewsKey = key;
    try {
        await ConfigModel.findOneAndUpdate(
            { key: FORTNITE_NEWS_KEY_CONFIG },
            { key: FORTNITE_NEWS_KEY_CONFIG, channelId: FORTNITE_NEWS_KEY_CONFIG, messageId: key },
            { upsert: true }
        );
    } catch (e) {
        console.error('[Fortnite News] Nie udało się zapisać klucza aktualizacji w bazie:', e);
    }
}

// === FORTNITE: STATUS SERWERÓW, AKTUALIZACJE I RANGA POWIADOMIEŃ ===
// Stare endpointy fortnite-api.com/v1/status oraz fortnite-api.com/v2/events zwracają HTTP 404.
const EPIC_STATUS_SUMMARY_URL = 'https://status.epicgames.com/api/v2/summary.json';
const FORTNITE_NEWS_URL = 'https://fortnite-api.com/v2/news?language=pl';
const FORTNITE_UPDATES_ROLE_NAME = '🔔 Aktualizacje Fortnite';
const FORTNITE_UPDATES_ROLE_KEY = 'fortnite_updates_role';
const FORTNITE_DOWN_STATUSES = ['degraded_performance', 'partial_outage', 'major_outage', 'under_maintenance'];

function fortniteLog(area: string, message: string) {
    console.log(`[Fortnite ${area}] ${message}`);
}

async function rememberFortniteUpdateRole(roleId: string) {
    try {
        if (roleId === ID_RANGI_AKTUALIZACJE_FORTNITE) return;
        await ConfigModel.findOneAndUpdate(
            { key: FORTNITE_UPDATES_ROLE_KEY },
            { key: FORTNITE_UPDATES_ROLE_KEY, channelId: roleId, messageId: 'role' },
            { upsert: true }
        );
        fortniteLog('Ranga', `Zapisano w bazie nowe ID rangi powiadomień: ${roleId}.`);
    } catch (e) {
        console.error('[Fortnite Ranga] Nie udało się zapisać ID rangi w bazie:', e);
    }
}

/**
 * Ranga powiadomień o aktualizacjach Fortnite.
 * Najpierw cache, potem zapytanie do API (rola nie musi być w cache), a jeśli naprawdę
 * nie istnieje na serwerze - bot tworzy ją sam i zapamiętuje nowe ID w bazie.
 */
async function getOrCreateFortniteUpdateRole(guild: any): Promise<any | null> {
    if (!guild) return null;

    let roleId = ID_RANGI_AKTUALIZACJE_FORTNITE;
    try {
        const cfg = await ConfigModel.findOne({ key: FORTNITE_UPDATES_ROLE_KEY });
        if (cfg && cfg.channelId) roleId = cfg.channelId;
    } catch (e) {
        fortniteLog('Ranga', 'Nie udało się odczytać zapisanego ID rangi z bazy - używam domyślnego.');
    }

    let role = guild.roles.cache.get(roleId) || await guild.roles.fetch(roleId).catch(() => null);
    if (!role) {
        const byName = guild.roles.cache.find((r: any) => r.name === FORTNITE_UPDATES_ROLE_NAME);
        if (byName) {
            fortniteLog('Ranga', `Rola ${roleId} nie istnieje - używam roli o nazwie "${FORTNITE_UPDATES_ROLE_NAME}" (${byName.id}).`);
            role = byName;
        }
    }

    if (role) {
        fortniteLog('Ranga', `Używam rangi powiadomień "${role.name}" (${role.id}), wzmiankowalna: ${role.mentionable ? 'tak' : 'nie'}.`);
        // Ranga musi być wzmiankowalna, żeby ping przy powiadomieniach działał.
        if (!role.mentionable) {
            try {
                await role.setMentionable(true, 'Ranga powiadomień o aktualizacjach Fortnite musi być wzmiankowalna (PJN Bot)');
                fortniteLog('Ranga', `Ustawiono wzmiankowalność rangi "${role.name}" (${role.id}) na tak.`);
            } catch (err) {
                console.error('[Fortnite Ranga] Nie udało się ustawić wzmiankowalności rangi (wymagane uprawnienie Zarządzanie rolami):', err);
            }
        }
        await rememberFortniteUpdateRole(role.id);
        return role;
    }

    try {
        const created = await guild.roles.create({
            name: FORTNITE_UPDATES_ROLE_NAME,
            color: 0x00D9FF,
            mentionable: true,
            hoist: false,
            reason: 'Automatyczne utworzenie rangi powiadomień o aktualizacjach Fortnite (PJN Bot)'
        });
        fortniteLog('Ranga', `Rangi nie było na serwerze - utworzono "${created.name}" (${created.id}).`);
        await rememberFortniteUpdateRole(created.id);
        return created;
    } catch (err) {
        console.error('[Fortnite Ranga] Nie udało się utworzyć rangi powiadomień (wymagane uprawnienie Zarządzanie rolami):', err);
        return null;
    }
}

/**
 * Status serwerów Fortnite ze status.epicgames.com.
 * Szuka grupy "Fortnite" i sprawdza statusy jej podkomponentów:
 * operational = serwery otwarte, degraded_performance/partial_outage/major_outage = zamknięte.
 */
async function fetchFortniteServerOnline(): Promise<boolean | null> {
    try {
        const res = await fetch(EPIC_STATUS_SUMMARY_URL);
        fortniteLog('Status', `${EPIC_STATUS_SUMMARY_URL} -> HTTP ${res.status}`);
        if (!res.ok) {
            console.error(`[Fortnite Status] status.epicgames.com zwrócił HTTP ${res.status} - pomijam sprawdzanie statusu.`);
            return null;
        }

        const summary = await res.json() as any;
        const components: any[] = Array.isArray(summary && summary.components) ? summary.components : [];
        const group = components.find((c: any) => String(c && c.name || '').toLowerCase() === 'fortnite' && !c.group_id);
        if (!group) {
            console.error('[Fortnite Status] Brak komponentu "Fortnite" w odpowiedzi status.epicgames.com - pomijam.');
            return null;
        }

        const children = (group.components || [])
            .map((id: string) => components.find((c: any) => c.id === id))
            .filter(Boolean);
        const groupStatus = String(group.status || 'unknown').toLowerCase();
        const childStatuses = children.map((c: any) => String(c.status || 'unknown').toLowerCase());
        const downStatus = [groupStatus, ...childStatuses].find((s: string) => FORTNITE_DOWN_STATUSES.includes(s));
        const isOnline = !downStatus;

        fortniteLog('Status', `Grupa "Fortnite": ${groupStatus} | komponenty: ${children.map((c: any) => `${c.name}=${c.status}`).join(', ') || 'brak'} => serwery ${isOnline ? 'OTWARTE' : `ZAMKNIĘTE (${downStatus})`}`);
        return isOnline;
    } catch (err) {
        console.error('[Fortnite Status] Błąd pobierania statusu z status.epicgames.com:', err);
        return null;
    }
}

/**
 * Informacje o aktualizacjach / patch notes z fortnite-api.com/v2/news.
 * Kluczem zmiany jest hash/data sekcji BR oraz ID najnowszego wpisu.
 */
// Wersja gry: fortnite-api.com/v2/aes zwraca build w formacie "++Fortnite+Release-43.00-CL-59596594".
const FORTNITE_AES_URL = 'https://fortnite-api.com/v2/aes';
const EPIC_MAINTENANCE_URL = 'https://status.epicgames.com/api/v2/scheduled-maintenances.json';

/** Data i godzina po polsku, w strefie Europe/Warsaw, np. "01.11.2026, 06:00 (czas polski)". */
function formatWarsawDateTime(value?: string | number | Date | null): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (isNaN(date.getTime())) return null;
    const text = new Intl.DateTimeFormat('pl-PL', {
        timeZone: 'Europe/Warsaw',
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    }).format(date);
    return `${text} (czas polski)`;
}

/** Rzeczywista wersja gry z builda, np. "43.00". */
async function fetchFortniteBuildVersion(): Promise<string | null> {
    try {
        const res = await fetch(FORTNITE_AES_URL);
        fortniteLog('Wersja', `${FORTNITE_AES_URL} -> HTTP ${res.status}`);
        if (!res.ok) {
            console.error(`[Fortnite Wersja] /v2/aes zwrócił HTTP ${res.status} - pomijam wersję gry.`);
            return null;
        }
        const data = await res.json() as any;
        const build = String((data && data.data && data.data.build) || '');
        const match = build.match(/Release-([0-9]+\.[0-9]+)/i);
        const version = match ? match[1] : (build || null);
        fortniteLog('Wersja', `Aktualna wersja gry: ${version || '(nie udało się odczytać)'} (build: ${build || 'brak'})`);
        return version;
    } catch (err) {
        console.error('[Fortnite Wersja] Błąd pobierania wersji gry:', err);
        return null;
    }
}

type FortniteMaintenance = { name: string; status: string; start: string | null; end: string | null; link: string | null };

/**
 * Okno serwisowe (downtime) z status.epicgames.com: od kiedy do kiedy, nazwa z wersją i link.
 * Bierze wpis aktywny/nadchodzący, a gdy takiego nie ma - ostatni zakończony.
 */
async function fetchFortniteMaintenance(): Promise<FortniteMaintenance | null> {
    try {
        const res = await fetch(EPIC_MAINTENANCE_URL);
        fortniteLog('Downtime', `${EPIC_MAINTENANCE_URL} -> HTTP ${res.status}`);
        if (!res.ok) {
            console.error(`[Fortnite Downtime] status.epicgames.com zwrócił HTTP ${res.status} - pomijam okno serwisowe.`);
            return null;
        }
        const data = await res.json() as any;
        const all: any[] = Array.isArray(data && data.scheduled_maintenances) ? data.scheduled_maintenances : [];
        const fortnite = all.filter((m: any) => /fortnite/i.test(String((m && m.name) || '')));
        if (fortnite.length === 0) {
            fortniteLog('Downtime', 'Brak wpisów o przerwach technicznych Fortnite na status.epicgames.com.');
            return null;
        }
        const active = fortnite.find((m: any) => ['scheduled', 'in_progress', 'verifying'].includes(String(m.status)));
        const chosen = active || fortnite[0];
        const info: FortniteMaintenance = {
            name: String(chosen.name || 'Przerwa techniczna Fortnite'),
            status: String(chosen.status || 'unknown'),
            start: chosen.scheduled_for || chosen.started_at || null,
            end: chosen.scheduled_until || chosen.resolved_at || null,
            link: chosen.shortlink || null
        };
        fortniteLog('Downtime', `${info.name} | status: ${info.status} | od: ${info.start || '—'} | do: ${info.end || '—'}${active ? ' (aktywne/nadchodzące)' : ' (ostatnie zakończone)'}`);
        return info;
    } catch (err) {
        console.error('[Fortnite Downtime] Błąd pobierania okna serwisowego:', err);
        return null;
    }
}

/** Wersja wyciągnięta z nazwy przerwy technicznej, np. "Downtime for v43.00 Update" -> "43.00". */
function maintenanceVersion(name: string): string | null {
    const match = String(name || '').match(/v?([0-9]+\.[0-9]+)/);
    return match ? match[1] : null;
}

/** Po polsku opis stanu przerwy technicznej. */
function maintenanceStatusText(status: string): string {
    switch (String(status || '').toLowerCase()) {
        case 'scheduled': return '🟡 zaplanowana';
        case 'in_progress': return '🔴 trwa teraz';
        case 'verifying': return '🟠 trwa weryfikacja';
        case 'completed': return '✅ zakończona';
        default: return `ℹ️ ${status || 'nieznany'}`;
    }
}

/**
 * Czy okno serwisowe jest aktualne: trwa, jest zaplanowane albo skończyło się w ostatnich 24h.
 * Bez tego bot doklejał do każdej aktualizacji zamkniętą przerwę z 12.11 (v43.10), przez co
 * powiadomienia pokazywały ciągle tę samą, starą datę.
 */
function isMaintenanceCurrent(info: FortniteMaintenance | null): boolean {
    if (!info) return false;
    if (['scheduled', 'in_progress', 'verifying'].includes(String(info.status).toLowerCase())) return true;
    const end = info.end ? new Date(info.end).getTime() : NaN;
    if (isNaN(end)) return false;
    return Date.now() - end < 24 * 60 * 60 * 1000;
}

async function fetchLatestFortniteNews(): Promise<{ key: string; date: string | null; title: string; body: string; items: { title: string; body: string }[] } | null> {
    try {
        const res = await fetch(FORTNITE_NEWS_URL);
        fortniteLog('News', `${FORTNITE_NEWS_URL} -> HTTP ${res.status}`);
        if (!res.ok) {
            console.error(`[Fortnite News] fortnite-api.com/v2/news zwrócił HTTP ${res.status} - pomijam powiadomienie o aktualizacji.`);
            return null;
        }

        const data = await res.json() as any;
        const br = data && data.data ? data.data.br : null;
        const motds: any[] = br && Array.isArray(br.motds) ? br.motds : [];
        const visible = motds.filter((m: any) => !m.hidden);
        if (visible.length === 0) {
            console.warn('[Fortnite News] Brak widocznych wpisów w data.br.motds - pomijam.');
            return null;
        }

        const latest = visible[0];
        const key = String((br && (br.hash || br.date)) || latest.id || latest.title || '');
        // Data publikacji ogłoszeń - do embeda, żeby było widać KIEDY update ogłoszono,
        // a nie tylko martwą datę starej przerwy technicznej.
        const date = br && br.date ? String(br.date) : null;
        const title = String(latest.title || latest.tabTitle || 'Aktualizacja Fortnite');
        const body = String(latest.body || '').replace(/\s+/g, ' ').trim();
        // Wszystkie widoczne wpisy: z nich bierzemy RZECZYWISTĄ treść "czego dotyczy aktualizacja".
        const items = visible
            .map((m: any) => ({
                title: String(m.title || m.tabTitle || '').replace(/\s+/g, ' ').trim(),
                body: String(m.body || '').replace(/\s+/g, ' ').trim()
            }))
            .filter((i: any) => i.title || i.body)
            .slice(0, 8);
        fortniteLog('News', `Najnowszy wpis: "${title}" (klucz: ${key}, wpisów: ${visible.length})`);
        items.forEach((i: any, idx: number) => fortniteLog('News', `  wpis ${idx + 1}: "${i.title}"${i.body ? ` - ${i.body.slice(0, 100)}…` : ' (brak treści)'}`));
        return { key, date, title, body, items };
    } catch (err) {
        console.error('[Fortnite News] Błąd pobierania informacji o aktualizacjach:', err);
        return null;
    }
}

/**
 * Rzeczywisty opis aktualizacji: bierze najnowszy wpis z fortnite-api.com/v2/news
 * (tytul + pelna tresc) i, gdy jest klucz GEMINI_API_KEY, prosi model o zwiezle
 * podsumowanie po polsku: czego dotyczy update, nowe przedmioty, eventy.
 * Bez klucza (albo gdy model nie odpowie) zwracany jest tekst z API, wiec opis nigdy nie jest pusty.
 */
async function buildFortniteUpdateDescription(news: { title: string; body: string; items?: { title: string; body: string }[] }): Promise<string> {
    const raw = String(news.body || '').replace(/\s+/g, ' ').trim();
    const entries = (news.items && news.items.length
        ? news.items
        : (news.title || raw ? [{ title: news.title, body: raw }] : []))
        .slice(0, 8);
    // Bez klucza API pokazujemy realne punkty z serwisu Epic, a nie ogólnik.
    const fallback = entries.length
        ? entries.map(e => `• **${e.title || 'Nowość'}**${e.body ? ` — ${e.body.length > 220 ? `${e.body.slice(0, 220)}…` : e.body}` : ''}`).join('\n')
        : 'Szczegóły znajdziesz w kliencie gry po pobraniu aktualizacji.';

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        fortniteLog('Opis', 'Brak GEMINI_API_KEY - używam opisu z fortnite-api.com.');
        return fallback;
    }

    try {
        const prompt =
            `Jesteś autorem powiadomień na serwerze Discord o grze Fortnite. Na podstawie danych z API napisz po polsku` +
            ` zwięzły, RZECZYWISTY opis najnowszej aktualizacji: od 3 do 6 krótkich punktów, każdy zaczynający się od "• ",` +
            ` opisujących zmiany, nowości i eventy. Nie wymyślaj niczego, czego nie ma w tekście.` +
            ` Nie używaj nagłówków ani innego markdownu poza "• ".\n\n` +
            `Wpisy z gry (każdy opisuje inny element aktualizacji):\n` +
            (entries.map(e => `- ${e.title || 'Nowość'}: ${e.body || '(brak treści)'}`).join('\n') || '(brak treści)');

        const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        fortniteLog('Opis', `Gemini (opis aktualizacji) -> HTTP ${res.status}`);
        if (!res.ok) return fallback;

        const data = await res.json() as any;
        const text = String(data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] ? data.candidates[0].content.parts[0].text : '').trim();
        if (!text) return fallback;
        const trimmed = text.length > 1500 ? `${text.slice(0, 1500)}…` : text;
        fortniteLog('Opis', `Wygenerowano opis aktualizacji (${trimmed.length} znaków).`);
        return trimmed;
    } catch (err) {
        console.error('[Fortnite Opis] Błąd generowania opisu przez Gemini - używam tekstu z API:', err);
        return fallback;
    }
}

async function setupFortniteUpdateChannel() {
    try {
        const channel = await client.channels.fetch(ID_KANAL_AKTUALIZACJI_FORTNITE).catch(() => null) as TextChannel;
        if (!channel) {
            fortniteLog('Kanał', 'Nie znaleziono kanału aktualizacji Fortnite - panel nie został odświeżony.');
            return;
        }
        // Ranga musi istnieć, zanim ruszy panel - tworzymy ją albo pobieramy z API, gdy nie ma jej w cache.
        const fnRole = await getOrCreateFortniteUpdateRole(channel.guild);
        const fnRoleId = fnRole ? fnRole.id : ID_RANGI_AKTUALIZACJE_FORTNITE;
        if (!fnRole) {
            fortniteLog('Ranga', 'Panel startuje bez rangi powiadomień - ping nie zadziała, dopóki rola nie powstanie.');
        }

        const embed = new EmbedBuilder()
            .setColor(0x00D9FF)
            .setTitle('🚀 Centrum Powiadomień o Aktualizacjach i Eventach Fortnite')
            .setDescription(
                'Ten kanał służy jako oficjalna tablica informacyjna dla graczy Fortnite.\n\n' +
                '🤖 **Co tutaj znajdziesz?**\n' +
                '• 📢 **Informacje o nadchodzących aktualizacjach i wersjach gry wraz z opisem**.\n' +
                '• 🟢/🔴 **Powiadomienia o statusie serwerów (przerwy techniczne)**.\n' +
                '• ✨ **Informacje o nowych eventach w Fortnite** z oznaczeniem odpowiedniej rangi!\n\n' +
                '🔔 *Kliknij poniższy przycisk, aby włączyć lub wyłączyć powiadomienia (rangę <@&' + fnRoleId + '>)!*'
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

        // Panel edytujemy przy kazdym restarcie (jedna wiadomosc, bez duplikatow).
        await sendOrUpdateInfoEmbed(channel, 'info_msg_fortnite_updates', embed, [row]);
    } catch (e) {
        console.error('Błąd inicjalizacji panelu aktualizacji Fortnite:', e);
    }
}

// ============================================================================
// === PJN BATTLE PASS — KARNET SEZONOWY (Lv 1 – 30) ===
// Ścieżka darmowa (Free) dla każdego gracza + ścieżka elitarna (Premium) dla VIP.
// XP karnetu płynie z czatu, kanałów głosowych, predykcji i zakładów.
// ============================================================================
const ID_KANALU_KARNETU = '1564607469651623946';
const BATTLE_PASS_SEASON = 1;
const BP_PREMIUM_PRICE = 20000;      // cena karnetu Premium w sklepie (PJN-Coins)
const BP_PREMIUM_PRICE_VIP = 10000;  // zniżka dla posiadaczy rangi VIP
const BP_XP_BASE = 100;                 // poziom N wymaga N * 100 XP karnetu
const BP_VOICE_XP_PER_MINUTE = 2;       // XP karnetu za minutę na kanale głosowym
const BP_CHAT_XP_FACTOR = 1;            // XP karnetu = XP serwera z wiadomości * factor

function bpLog(area: string, message: string) {
    console.log(`[BattlePass ${area}] ${message}`);
}

const battlePassSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    season: { type: Number, default: BATTLE_PASS_SEASON },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    totalXp: { type: Number, default: 0 },
    premium: { type: Boolean, default: false },
    claimedFree: { type: [Number], default: [] },
    claimedPremium: { type: [Number], default: [] },
    bpBadges: { type: [String], default: [] },
    chatBoostMult: { type: Number, default: 1 },
    chatBoostUntil: { type: Date, default: null },
    voiceBoostMult: { type: Number, default: 1 },
    voiceBoostUntil: { type: Date, default: null },
    pagBoostUntil: { type: Date, default: null },
    dailySkipTickets: { type: Number, default: 0 },
    dailyDoubleUntil: { type: Date, default: null },
    pagShieldUntil: { type: Date, default: null },
    betaAccessUntil: { type: Date, default: null },
    hallOfFame: { type: Boolean, default: false },
    seasonTitle: { type: String, default: null }
});
const BattlePassModel = mongoose.model('BattlePass', battlePassSchema);

type BpReward = { label: string; type: string; amount?: number; badge?: string; hours?: number; mult?: number; days?: number };

const BATTLE_PASS_REWARDS: { level: number; free: BpReward; premium: BpReward }[] = [
    { level: 1, free: { label: '💰 `150 PJN-Coins`', type: 'coins', amount: 150 }, premium: { label: '🟡 1 Dzień Rangi VIP', type: 'vip', days: 1 } },
    { level: 2, free: { label: '⭐ `100 XP`', type: 'xp', amount: 100 }, premium: { label: '💰 `300 PJN-Coins`', type: 'coins', amount: 300 } },
    { level: 3, free: { label: '💬 +10% XP za pisanie na 24h', type: 'chatBoost', mult: 1.1, hours: 24 }, premium: { label: '⭐ `250 XP`', type: 'xp', amount: 250 } },
    { level: 4, free: { label: '💰 `200 PJN-Coins`', type: 'coins', amount: 200 }, premium: { label: '💎 `500 PJN-Coins`', type: 'coins', amount: 500 } },
    { level: 5, free: { label: '🪙 Odznaka: „Nowicjusz BP”', type: 'badge', badge: '🪙 **Nowicjusz BP**' }, premium: { label: '🛡️ +15% do predykcji na 24h', type: 'pagBoost', hours: 24, mult: 1.15 } },
    { level: 6, free: { label: '⭐ `150 XP`', type: 'xp', amount: 150 }, premium: { label: '💰 `600 PJN-Coins`', type: 'coins', amount: 600 } },
    { level: 7, free: { label: '💰 `250 PJN-Coins`', type: 'coins', amount: 250 }, premium: { label: '🎟️ Bilet pominięcia cooldownu `/daily`', type: 'dailySkip', amount: 1 } },
    { level: 8, free: { label: '🎙️ +20% XP za czas na głosowym na 24h', type: 'voiceBoost', mult: 1.2, hours: 24 }, premium: { label: '💰 `700 PJN-Coins`', type: 'coins', amount: 700 } },
    { level: 9, free: { label: '⭐ `200 XP`', type: 'xp', amount: 200 }, premium: { label: '✨ Własny kanał głosowy (tymczasowy) na 3 dni', type: 'voiceChannel', days: 3 } },
    { level: 10, free: { label: '🎁 **Paczka Startowa** (`+500 Coins`)', type: 'pack', amount: 500 }, premium: { label: '👑 **Ranga VIP na 3 dni**', type: 'vip', days: 3 } },
    { level: 11, free: { label: '💰 `300 PJN-Coins`', type: 'coins', amount: 300 }, premium: { label: '⭐ `400 XP`', type: 'xp', amount: 400 } },
    { level: 12, free: { label: '⭐ `250 XP`', type: 'xp', amount: 250 }, premium: { label: '💰 `800 PJN-Coins`', type: 'coins', amount: 800 } },
    { level: 13, free: { label: '🪙 Odznaka: „Aktywny Bywalec”', type: 'badge', badge: '🪙 **Aktywny Bywalec**' }, premium: { label: '🍀 Podwójny bonus z `/daily` na 1 dzień', type: 'dailyDouble', hours: 24 } },
    { level: 14, free: { label: '💰 `350 PJN-Coins`', type: 'coins', amount: 350 }, premium: { label: '🛡️ Ochrona przed spadkiem punktów w predykcji', type: 'pagShield', hours: 168 } },
    { level: 15, free: { label: '⭐ `300 XP`', type: 'xp', amount: 300 }, premium: { label: '💎 `1 000 PJN-Coins`', type: 'coins', amount: 1000 } },
    { level: 16, free: { label: '💬 Podwójny XP z wiadomości na 12h', type: 'chatBoost', mult: 2, hours: 12 }, premium: { label: '🎙️ Priorytet mówienia na kanałach głosowych', type: 'perk', amount: 1 } },
    { level: 17, free: { label: '💰 `400 PJN-Coins`', type: 'coins', amount: 400 }, premium: { label: '✨ VIP na kanałach głosowych (dostęp do ukrytych pokoi)', type: 'perk', amount: 1 } },
    { level: 18, free: { label: '⭐ `350 XP`', type: 'xp', amount: 350 }, premium: { label: '💰 `1 200 PJN-Coins`', type: 'coins', amount: 1200 } },
    { level: 19, free: { label: '🪙 Odznaka: „Wzorowy Bywalec”', type: 'badge', badge: '🪙 **Wzorowy Bywalec**' }, premium: { label: '👑 Ranga VIP na 5 dni', type: 'vip', days: 5 } },
    { level: 20, free: { label: '🎁 **Złota Skrzynia** (`+1 500 Coins`)', type: 'chest', amount: 1500 }, premium: { label: '👑 **Ranga VIP na 7 dni**', type: 'vip', days: 7 } },
    { level: 21, free: { label: '💰 `500 PJN-Coins`', type: 'coins', amount: 500 }, premium: { label: '⭐ `600 XP`', type: 'xp', amount: 600 } },
    { level: 22, free: { label: '⭐ `400 XP`', type: 'xp', amount: 400 }, premium: { label: '💰 `1 500 PJN-Coins`', type: 'coins', amount: 1500 } },
    { level: 23, free: { label: '🎙️ Potrójny XP z kanałów głosowych na 12h', type: 'voiceBoost', mult: 3, hours: 12 }, premium: { label: '💎 `2 000 PJN-Coins`', type: 'coins', amount: 2000 } },
    { level: 24, free: { label: '💰 `600 PJN-Coins`', type: 'coins', amount: 600 }, premium: { label: '🛡️ Stała ochrona statystyk predykcji na 7 dni', type: 'pagShield', hours: 168 } },
    { level: 25, free: { label: '🪙 Odznaka: „Mistrz Grindowania”', type: 'badge', badge: '🪙 **Mistrz Grindowania**' }, premium: { label: '🛠️ Dostęp do testowania nowych komend bota w fazie beta', type: 'beta', days: 30 } },
    { level: 26, free: { label: '⭐ `500 XP`', type: 'xp', amount: 500 }, premium: { label: '💰 `2 500 PJN-Coins`', type: 'coins', amount: 2500 } },
    { level: 27, free: { label: '💰 `750 PJN-Coins`', type: 'coins', amount: 750 }, premium: { label: '👑 Ranga VIP na 14 dni', type: 'vip', days: 14 } },
    { level: 28, free: { label: '💬 Stały bonus +5% XP do końca sezonu', type: 'chatBoostPerm', mult: 1.05 }, premium: { label: '🎟️ Wpis na serwerową tablicę sławy Hall of Fame', type: 'hallOfFame' } },
    { level: 29, free: { label: '⭐ `600 XP`', type: 'xp', amount: 600 }, premium: { label: '💎 `3 500 PJN-Coins`', type: 'coins', amount: 3500 } },
    { level: 30, free: { label: '🏆 Odznaka Elitarna: „Legenda PJN”', type: 'badge', badge: '🏆 **Legenda PJN**' }, premium: { label: '🏆 **Ranga VIP na 30 dni + Unikalny Tytuł Sezonowy**', type: 'vipTitle', days: 30 } }
];

function bpXpForLevel(level: number): number {
    return BP_XP_BASE * Math.max(1, level);
}

async function getOrCreateBattlePass(userId: string) {
    let bp = await BattlePassModel.findOne({ userId });
    if (!bp) bp = await BattlePassModel.create({ userId, season: BATTLE_PASS_SEASON });
    return bp;
}

async function isBattlePassPremium(userId: string, guild: any): Promise<boolean> {
    const bp = await getOrCreateBattlePass(userId);
    return !!bp.premium;
}

/** Cena przedmiotu w sklepie, z uwzględnieniem zniżki VIP na karnet Premium. */
async function getShopPrice(item: any, guild: any, userId: string): Promise<number> {
    if (item && item.id === 'bp_premium') {
        return await memberHasVipRole(guild, userId) ? BP_PREMIUM_PRICE_VIP : BP_PREMIUM_PRICE;
    }
    return item.price;
}

/** Zakup ścieżki elitarnej karnetu: pobiera PJN-Coins i odblokowuje nagrody Premium. */
async function bpPurchasePremium(userId: string, guild: any): Promise<{ ok: boolean; message: string }> {
    const bp = await getOrCreateBattlePass(userId);
    if (bp.premium) {
        return { ok: false, message: '✅ Masz już odblokowaną **Ścieżkę Elitarną** tego sezonu. Odbieraj nagrody przyciskiem **👑 Odbierz nagrody Elitarne**!' };
    }

    let user = await UserModel.findOne({ userId });
    if (!user) user = await UserModel.create({ userId });

    const price = await getShopPrice({ id: 'bp_premium' }, guild, userId);
    if (user.balance < price) {
        return { ok: false, message: `❌ Brakuje Ci środków na karnet Premium. Kosztuje **${price} PJN-Coins**, a masz **${user.balance} PJN-Coins**.` };
    }

    user.balance -= price;
    await user.save();

    bp.premium = true;
    await bp.save();

    await ShopHistoryModel.create({ userId, itemName: '⚔️ Karnet Premium PJN Battle Pass', price });
    bpLog('Premium', `<@${userId}> kupił karnet Premium za ${price} PJN-Coins.`);

    return { ok: true, message: `👑 **Karnet Premium odblokowany!** Zapłaciłeś **${price} PJN-Coins**. Kliknij **👑 Odbierz nagrody Elitarne**, aby zgarnąć nagrody ze Ścieżki Elitarnej.` };
}

async function memberHasVipRole(guild: any, userId: string): Promise<boolean> {
    if (!guild) return false;
    try {
        const member = guild.members.cache.get(userId) || await guild.members.fetch(userId).catch(() => null);
        return !!(member && member.roles.cache.has(ID_ROLI_VIP));
    } catch (e) {
        return false;
    }
}

async function addBattlePassXp(userId: string, amount: number, guild: any, source: string) {
    if (!amount || amount <= 0) return;
    try {
        const bp = await getOrCreateBattlePass(userId);
        if (bp.season !== BATTLE_PASS_SEASON) {
            bp.season = BATTLE_PASS_SEASON;
            bp.xp = 0;
            bp.level = 1;
            bp.claimedFree = [];
            bp.claimedPremium = [];
            bp.totalXp = 0;
            bpLog('Sezon', `Nowy sezon ${BATTLE_PASS_SEASON} dla <@${userId}> - postęp zresetowany.`);
        }

        bp.xp = (bp.xp || 0) + amount;
        bp.totalXp = (bp.totalXp || 0) + amount;

        let need = bpXpForLevel(bp.level || 1);
        let leveled = false;
        while (bp.xp >= need && (bp.level || 1) < 30) {
            bp.xp -= need;
            bp.level = (bp.level || 1) + 1;
            leveled = true;
            need = bpXpForLevel(bp.level);
        }
        if ((bp.level || 1) >= 30) bp.xp = Math.min(bp.xp, bpXpForLevel(30));
        await bp.save();

        if (leveled) {
            bpLog('Awans', `<@${userId}> awansował na poziom ${bp.level} karnetu (źródło: ${source}).`);
            await announceBattlePassLevel(userId, guild, bp);
        }
    } catch (e) {
        console.error('[BattlePass XP] Błąd naliczania XP karnetu:', e);
    }
}

// Śledzenie czasu na kanałach głosowych - źródło XP karnetu z głosu.
// Sesja pamięta, ile minut już zaliczono, żeby licznik na żywo nie naliczał ich dwa razy.
type BpVoiceSession = { joinedAt: number; credited: number; channelId: string | null; guildId?: string };
const bpVoiceSessions = new Map<string, BpVoiceSession>();
const VOICE_TICK_MS = 60 * 1000;
let voiceTickerRunning = false;

/** Zalicza podaną liczbę minut głosu: odznaki, XP karnetu oraz XP serwera z radia. */
async function creditVoiceMinutes(userId: string, guild: any, channelId: string | null, minutes: number, tag: string) {
    if (minutes < 1) return;

    let user = await UserModel.findOne({ userId });
    if (!user) user = await UserModel.create({ userId });
    user.voiceMinutes = (user.voiceMinutes || 0) + minutes;
    await user.save();

    const member = guild
        ? (guild.members.cache.get(userId) || await guild.members.fetch(userId).catch(() => null))
        : null;
    if (member) await checkAndAwardBadges(user, member, guild);

    const bp = await getOrCreateBattlePass(userId);
    let mult = 1;
    if (bp.voiceBoostUntil && new Date(bp.voiceBoostUntil).getTime() > Date.now()) {
        mult = bp.voiceBoostMult || 1;
    }
    const gain = Math.round(minutes * BP_VOICE_XP_PER_MINUTE * mult);
    await addBattlePassXp(userId, gain, guild, 'kanał głosowy');
    bpLog('Głos', `${tag}: ${minutes} min na głosie (x${mult}) -> +${gain} XP karnetu.`);

    // Radio: kanał muzyczny nalicza również XP serwera (poziomy i ranking).
    if (channelId === ID_KANAL_MUZYCZNEGO) {
        const expGain = minutes * XP_ZA_MINUTE_RADIA;
        await addExp(userId, expGain, guild);
        bpLog('Radio', `${tag}: ${minutes} min słuchania radia -> +${expGain} XP serwera.`);
    }
}

/**
 * Dopasowuje sesje do rzeczywistości: każdy, kto TERAZ siedzi na głosie, ma sesję.
 * Bez tego osoby, które były na kanale już w chwili startu bota (albo restartu),
 * nie dostawały nic - zdarzenie wejścia na kanał po prostu nie miało miejsca.
 */
function syncVoiceSessions() {
    try {
        for (const guild of client.guilds.cache.values()) {
            for (const state of guild.voiceStates.cache.values()) {
                const member = state.member;
                if (!state.channelId || !member || member.user?.bot) continue;

                const existing = bpVoiceSessions.get(member.id);
                if (!existing) {
                    bpVoiceSessions.set(member.id, {
                        joinedAt: Date.now(),
                        credited: 0,
                        channelId: state.channelId,
                        guildId: guild.id
                    });
                } else if (existing.channelId !== state.channelId) {
                    existing.channelId = state.channelId;
                }
            }
        }
    } catch (e) {
        console.error('[BattlePass Głos] Błąd synchronizacji sesji głosowych:', e);
    }
}

/** Co minutę dopisuje XP wszystkim, którzy teraz siedzą na głosie - postęp jest widoczny od razu. */
function startVoiceTicker() {
    if (voiceTickerRunning) return;
    voiceTickerRunning = true;

    setInterval(async () => {
        syncVoiceSessions();
        for (const [userId, session] of bpVoiceSessions) {
            try {
                const elapsed = Math.floor((Date.now() - session.joinedAt) / 60000);
                const pending = elapsed - session.credited;
                if (pending < 1) continue;
                session.credited += pending;

                const guild = session.guildId ? client.guilds.cache.get(session.guildId) : null;
                const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
                await creditVoiceMinutes(userId, guild, session.channelId, pending, member ? member.user.tag : userId);
            } catch (e) {
                console.error('[BattlePass Głos] Błąd naliczania na żywo:', e);
            }
        }
    }, VOICE_TICK_MS);
}

async function trackBattlePassVoiceTime(oldState: any, newState: any) {
    try {
        const member = newState.member || oldState.member;
        if (!member || !member.user || member.user.bot) return;

        const guild = newState.guild || oldState.guild;
        const userId = member.id;
        const wasIn = !!oldState.channelId;
        const isIn = !!newState.channelId;

        if (!wasIn && isIn) {
            startVoiceTicker();
            bpVoiceSessions.set(userId, {
                joinedAt: Date.now(),
                credited: 0,
                channelId: newState.channelId || null,
                guildId: guild?.id
            });
            return;
        }

        if (wasIn) {
            const session = bpVoiceSessions.get(userId);
            bpVoiceSessions.delete(userId);
            if (session) {
                // Reszta minut, których ticker jeszcze nie zdążył dopisać.
                const elapsed = Math.floor((Date.now() - session.joinedAt) / 60000);
                const pending = elapsed - session.credited;
                if (pending >= 1) await creditVoiceMinutes(userId, guild, session.channelId, pending, member.user.tag);
            }
            // Wejście na inny kanał (albo powrót z wyciszenia) otwiera nową sesję.
            if (isIn) {
                bpVoiceSessions.set(userId, {
                    joinedAt: Date.now(),
                    credited: 0,
                    channelId: newState.channelId || null,
                    guildId: guild?.id
                });
            }
        }
    } catch (e) {
        console.error('[BattlePass Głos] Błąd naliczania czasu głosowego:', e);
    }
}

// --- Nadawanie nagród karnetu -------------------------------------------------

async function bpGrantVip(userId: string, days: number, guild: any): Promise<Date> {
    let user = await UserModel.findOne({ userId });
    if (!user) user = await UserModel.create({ userId });

    const now = Date.now();
    const current = user.vipExpiresAt ? new Date(user.vipExpiresAt).getTime() : 0;
    const base = current > now ? current : now;
    const expires = new Date(base + days * 24 * 60 * 60 * 1000);
    user.vipExpiresAt = expires;
    await user.save();

    if (guild) {
        const member = guild.members.cache.get(userId) || await guild.members.fetch(userId).catch(() => null);
        if (member) await member.roles.add(ID_ROLI_VIP).catch(() => {});
    }
    return expires;
}

async function bpApplyReward(userId: string, reward: BpReward, guild: any, silent = false): Promise<string> {
    const bp = await getOrCreateBattlePass(userId);
    let user = await UserModel.findOne({ userId });
    if (!user) user = await UserModel.create({ userId });

    const now = Date.now();
    const boostMs = (reward.hours || 0) * 60 * 60 * 1000;
    const daysMs = (reward.days || 0) * 24 * 60 * 60 * 1000;
    const extend = (current: any) => {
        const c = current ? new Date(current).getTime() : 0;
        return new Date((c > now ? c : now) + boostMs);
    };

    switch (reward.type) {
        case 'coins':
        case 'pack':
        case 'chest': {
            const amount = reward.amount || 0;
            user.balance += amount;
            await user.save();
            await TransactionHistoryModel.create({ userId, type: 'battlepass', amount, details: `PJN Battle Pass: ${reward.label}` });
            if (!silent) {
                try { await sendCoinsNotification(userId, amount, 'PJN Battle Pass', `Nagroda z karnetu: ${reward.label}`); } catch (e) {}
            }
            return `Do portfela dodano **${amount} PJN-Coins**.`;
        }
        case 'xp': {
            const amount = reward.amount || 0;
            try { await addExp(userId, amount, guild); } catch (e) {}
            return `Przyznano **${amount} XP** serwera.`;
        }
        case 'badge': {
            if (reward.badge && !user.badges.includes(reward.badge)) {
                user.badges.push(reward.badge);
                await user.save();
            }
            if (reward.badge && !bp.bpBadges.includes(reward.badge)) {
                bp.bpBadges.push(reward.badge);
                await bp.save();
            }
            return `Odblokowano odznakę ${reward.badge}.`;
        }
        case 'vip': {
            const expires = await bpGrantVip(userId, reward.days || 1, guild);
            return `Ranga **VIP** aktywna do <t:${Math.floor(expires.getTime() / 1000)}:D>.`;
        }
        case 'vipTitle': {
            const expires = await bpGrantVip(userId, reward.days || 30, guild);
            const title = `Legenda PJN • Sezon ${BATTLE_PASS_SEASON}`;
            bp.seasonTitle = title;
            await bp.save();
            if (!user.badges.includes('🏆 **Legenda PJN**')) {
                user.badges.push('🏆 **Legenda PJN**');
                await user.save();
            }
            return `Ranga **VIP** do <t:${Math.floor(expires.getTime() / 1000)}:D> oraz unikalny tytuł sezonowy **${title}**.`;
        }
        case 'chatBoost': {
            bp.chatBoostMult = Math.max(bp.chatBoostMult || 1, reward.mult || 1);
            bp.chatBoostUntil = extend(bp.chatBoostUntil);
            await bp.save();
            return `Bonus **+${Math.round(((reward.mult || 1) - 1) * 100)}% XP z wiadomości** na ${reward.hours}h.`;
        }
        case 'chatBoostPerm': {
            bp.chatBoostMult = Math.max(bp.chatBoostMult || 1, reward.mult || 1);
            bp.chatBoostUntil = null;
            await bp.save();
            return `Stały bonus **+5% XP z wiadomości** do końca sezonu.`;
        }
        case 'voiceBoost': {
            bp.voiceBoostMult = Math.max(bp.voiceBoostMult || 1, reward.mult || 1);
            bp.voiceBoostUntil = extend(bp.voiceBoostUntil);
            await bp.save();
            return `Bonus **x${reward.mult} XP za czas na głosie** na ${reward.hours}h.`;
        }
        case 'pagBoost': {
            bp.pagBoostUntil = extend(bp.pagBoostUntil);
            await bp.save();
            return `Bonus **+15% do predykcji** na ${reward.hours}h.`;
        }
        case 'pagShield': {
            bp.pagShieldUntil = extend(bp.pagShieldUntil);
            await bp.save();
            return `Ochrona statystyk predykcji na ${reward.hours}h.`;
        }
        case 'dailySkip': {
            bp.dailySkipTickets = (bp.dailySkipTickets || 0) + (reward.amount || 1);
            await bp.save();
            return `Bilet pominięcia cooldownu \`/daily\` (masz teraz **${bp.dailySkipTickets}**).`;
        }
        case 'dailyDouble': {
            bp.dailyDoubleUntil = extend(bp.dailyDoubleUntil);
            await bp.save();
            return `Podwójny bonus z \`/daily\` na ${reward.hours}h.`;
        }
        case 'voiceChannel': {
            user.customVoiceExpiresAt = new Date(now + daysMs);
            await user.save();
            return `Własny, tymczasowy kanał głosowy na **${reward.days} dni**.`;
        }
        case 'beta': {
            bp.betaAccessUntil = new Date(now + daysMs);
            await bp.save();
            return `Dostęp do testów nowych komend bota w fazie beta na **${reward.days} dni**.`;
        }
        case 'hallOfFame': {
            bp.hallOfFame = true;
            await bp.save();
            return `Wpis na serwerową tablicę sławy **Hall of Fame**.`;
        }
        default:
            return `Przywilej aktywny: **${reward.label}**.`;
    }
}

// --- Postęp i wypłata nagród karnetu ----------------------------------------

function bpBoostsText(bp: any): string {
    const now = Date.now();
    const lines: string[] = [];
    const stamp = (d: any) => `<t:${Math.floor(new Date(d).getTime() / 1000)}:R>`;
    if ((bp.chatBoostMult || 1) > 1) {
        lines.push(bp.chatBoostUntil ? `💬 XP z wiadomości x${bp.chatBoostMult} — do ${stamp(bp.chatBoostUntil)}` : `💬 Stały bonus XP z wiadomości x${bp.chatBoostMult}`);
    }
    if ((bp.voiceBoostMult || 1) > 1 && bp.voiceBoostUntil && new Date(bp.voiceBoostUntil).getTime() > now) {
        lines.push(`🎙️ XP z głosu x${bp.voiceBoostMult} — do ${stamp(bp.voiceBoostUntil)}`);
    }
    if (bp.pagBoostUntil && new Date(bp.pagBoostUntil).getTime() > now) lines.push(`🛡️ Bonus do predykcji — do ${stamp(bp.pagBoostUntil)}`);
    if (bp.pagShieldUntil && new Date(bp.pagShieldUntil).getTime() > now) lines.push(`🛡️ Ochrona predykcji — do ${stamp(bp.pagShieldUntil)}`);
    if (bp.dailyDoubleUntil && new Date(bp.dailyDoubleUntil).getTime() > now) lines.push(`🍀 Podwójny /daily — do ${stamp(bp.dailyDoubleUntil)}`);
    if ((bp.dailySkipTickets || 0) > 0) lines.push(`🎟️ Bilety pominięcia /daily: **${bp.dailySkipTickets}**`);
    if (bp.betaAccessUntil && new Date(bp.betaAccessUntil).getTime() > now) lines.push(`🛠️ Dostęp beta — do ${stamp(bp.betaAccessUntil)}`);
    if (bp.hallOfFame) lines.push('🎟️ Wpis w Hall of Fame');
    if (bp.seasonTitle) lines.push(`🏆 Tytuł sezonowy: **${bp.seasonTitle}**`);
    return lines.length ? lines.join('\n') : '*Brak aktywnych bonusów z karnetu.*';
}

async function bpAddXp(userId: string, amount: number, guild: any, source: string) {
    if (!amount || amount <= 0) return null;
    const bp = await getOrCreateBattlePass(userId);

    bp.xp = (bp.xp || 0) + amount;
    bp.totalXp = (bp.totalXp || 0) + amount;

    let leveled = false;
    let required = bpXpForLevel(bp.level);
    while (bp.level < 30 && bp.xp >= required) {
        bp.xp -= required;
        bp.level += 1;
        leveled = true;
        required = bpXpForLevel(bp.level);
    }
    if (bp.level >= 30) bp.xp = Math.min(bp.xp, bpXpForLevel(30));
    await bp.save();

    if (leveled) await announceBattlePassLevel(userId, guild, bp);
    return bp;
}

function bpIsPremium(user: any, member: any): boolean {
    const now = Date.now();
    if (user && user.vipExpiresAt && new Date(user.vipExpiresAt).getTime() > now) return true;
    if (member && member.roles?.cache?.has(ID_ROLI_VIP)) return true;
    return false;
}

async function bpClaimTrack(bp: any, member: any, guild: any, track: 'free' | 'premium') {
    const claimed: number[] = track === 'free' ? bp.claimedFree : bp.claimedPremium;
    const granted: string[] = [];

    for (const entry of BATTLE_PASS_REWARDS) {
        if (entry.level > bp.level) continue;
        if (claimed.includes(entry.level)) continue;
        const reward = track === 'free' ? entry.free : entry.premium;
        if (!reward) continue;
        const result = await bpApplyReward(bp.userId, reward, guild, true);
        claimed.push(entry.level);
        granted.push(`**Lv ${entry.level}** — ${reward.label}\n┗ ${result}`);
    }
    bp.markModified(track === 'free' ? 'claimedFree' : 'claimedPremium');
    await bp.save();
    return granted;
}

// Powiadomienie o awansie w karnecie. Wysyłane na PW, żeby nie zaśmiecać kanału karnetu.
async function announceBattlePassLevel(userId: string, guild: any, bp: any, reason?: string) {
    try {
        const discordUser = await client.users.fetch(userId).catch(() => null);
        if (!discordUser) return;
        const entry = BATTLE_PASS_REWARDS.find(r => r.level === bp.level);
        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle('⚔️ AWANS W KARNETCIE PJN BATTLE PASS!')
            .setDescription(
                `Gratulacje! Osiągnąłeś **poziom ${bp.level} / 30** karnetu${reason ? ` (${reason})` : ''}.\n\n` +
                `🆓 **Ścieżka Darmowa:** ${entry ? entry.free.label : '—'}\n` +
                `👑 **Ścieżka Elitarna:** ${entry ? entry.premium.label : '—'}\n\n` +
                `🎁 **Nagrody odbierasz** przyciskami w panelu na kanale karnetu (<#${ID_KANALU_KARNETU}>) ` +
                `albo komendą \`/karnet\`.\n` +
                `💎 **Elitarny Karnet (Premium)** kupisz w **sklepie serwera** — 20 000 PJN-Coins, a z rangą VIP 10 000 PJN-Coins.\n` +
                `Poziom 30 to maksimum tego sezonu — czekaj na kolejny sezon PJN Battle Pass!`
            )
            .setTimestamp()
            .setFooter({ text: `PJN Battle Pass • Sezon ${BATTLE_PASS_SEASON}` });
        await discordUser.send({ embeds: [embed] });
    } catch (e) {
        // Zamknięte PW: informacja zostaje w panelu karnetu, nic nie wysyłamy na kanał.
        bpLog('PW', `Nie udało się wysłać PW o awansie w karnecie do <@${userId}> (prywatne wiadomości zablokowane?).`);
    }
}

/** Krótka informacja na PW o nagrodach do odbioru - używana przy awansie w systemie XP. */
async function dmKarnetInfo(userId: string, level: number) {
    try {
        const discordUser = await client.users.fetch(userId).catch(() => null);
        if (!discordUser) return;
        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle('⚔️ PJN Battle Pass — nagrody czekają!')
            .setDescription(
                `Awansowałeś na **${level} poziom** w systemie XP! Twój postęp w karnecie sprawdzisz i nagrody ` +
                `odbierzesz przyciskami w panelu na kanale karnetu (<#${ID_KANALU_KARNETU}>) albo komendą \`/karnet\`.\n\n` +
                `💎 **Elitarny Karnet (Premium)** kupisz w **sklepie serwera** za **20 000 PJN-Coins**, a z rangą **VIP** za **10 000 PJN-Coins**.`
            )
            .setTimestamp()
            .setFooter({ text: `PJN Battle Pass • Sezon ${BATTLE_PASS_SEASON}` });
        await discordUser.send({ embeds: [embed] });
    } catch (e) {
        bpLog('PW', `Nie udało się wysłać PW z informacją o karnecie do <@${userId}> (prywatne wiadomości zablokowane?).`);
    }
}

// ============================================================================
// === MODUŁ ODZNAK — czytelny podgląd osiągnięć gracza ===
const BADGE_TIERS = ['Elitarna', 'Epicka', 'Rzadka', 'Zwykła'];
const BADGE_TIER_ICONS: Record<string, string> = {
    'Elitarna': '🏆',
    'Epicka': '🎟️',
    'Rzadka': '💎',
    'Zwykła': '🔹'
};
const BADGES_PER_PAGE = 12;

function badgeClean(badge: string): string {
    return String(badge || '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
}

function badgeTier(badge: string): string {
    const clean = badgeClean(badge).toLowerCase();
    if (clean.includes('elitarna')) return 'Elitarna';
    if (clean.includes('epicka')) return 'Epicka';
    if (clean.includes('rzadka')) return 'Rzadka';
    return 'Zwykła';
}

/** Unikalne odznaki gracza — usuwa duplikaty, które mogły wejść z różnych systemów. */
function uniqueBadges(user: any): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const b of (user && user.badges ? user.badges : []) as string[]) {
        const clean = badgeClean(b);
        if (!clean || seen.has(clean)) continue;
        seen.add(clean);
        out.push(clean);
    }
    return out;
}

function badgeCountLine(user: any): string {
    const badges = uniqueBadges(user);
    if (badges.length === 0) return 'Brak odznak — zdobądź pierwsze, będąc aktywnym!';
    const byTier = BADGE_TIERS
        .map(t => ({ t, n: badges.filter(b => badgeTier(b) === t).length }))
        .filter(x => x.n > 0)
        .map(x => `${BADGE_TIER_ICONS[x.t]} ${x.t}: **${x.n}**`)
        .join(' • ');
    return `**${badges.length}** odznak\n${byTier}`;
}

/** Moduł odznak: podział na rzadkości, paginacja, przyciski nawigacji. */
function buildBadgeModule(user: any, targetUser: any, page: number) {
    const badges = uniqueBadges(user);
    const totalPages = Math.max(1, Math.ceil(badges.length / BADGES_PER_PAGE));
    const safePage = Math.min(Math.max(0, page), totalPages - 1);
    const slice = badges.slice(safePage * BADGES_PER_PAGE, (safePage + 1) * BADGES_PER_PAGE);

    let desc = `👤 <@${targetUser.id}>\n${badgeCountLine(user)}\n\n`;
    if (badges.length === 0) {
        desc += 'Bądź aktywny na czacie i głosie, graj w kasynie, kupuj w sklepie i zdobywaj poziomy karnetu, aby odblokować odznaki.';
    } else {
        desc += slice.map(b => `• ${b} — *${badgeTier(b)}*`).join('\n');
        if (totalPages > 1) desc += `\n\n📄 Strona **${safePage + 1} / ${totalPages}**`;
    }

    const embed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle(`🏆 Moduł Odznak: ${targetUser.username || targetUser.tag || 'Gracz'}`)
        .setDescription(desc)
        .setTimestamp()
        .setFooter({ text: `PJN System Osiągnięć • Odznak: ${badges.length}` });
    try {
        if (targetUser.displayAvatarURL) embed.setThumbnail(targetUser.displayAvatarURL());
    } catch (e) {}

    const components: ActionRowBuilder<ButtonBuilder>[] = [];
    if (totalPages > 1) {
        components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`badge_mod_${targetUser.id}_${safePage - 1}`)
                .setLabel('Poprzednia')
                .setEmoji('◀️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(safePage === 0),
            new ButtonBuilder()
                .setCustomId(`badge_mod_${targetUser.id}_${safePage + 1}`)
                .setLabel('Następna')
                .setEmoji('▶️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(safePage >= totalPages - 1)
        ));
    }
    return { embeds: [embed], components };
}

/** Zwięzła karta profilu — bez pełnej listy odznak (ta żyje w module odznak). */
function buildProfileEmbed(user: any, targetUser: any): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle(`👤 Profil Gracza: ${targetUser.tag || targetUser.username}`)
        .setDescription(
            `💼 **Portfel:** \`${user.balance} PJN-Coins\`\n` +
            `⭐ **Poziom:** \`${user.level || 1}\` (Exp: \`${user.exp || 0} / ${(user.level || 1) * 150}\`)\n` +
            `💬 **Wiadomości:** \`${user.messageCount || 0}\`\n` +
            `🎙️ **Czas na głosie:** \`${Math.floor((user.voiceMinutes || 0) / 60)}h ${(user.voiceMinutes || 0) % 60}m\`\n` +
            `🎲 **Gry w kasynie:** \`${user.casinoPlays || 0}\`\n\n` +
            `🏆 **Odznaki i Osiągnięcia:**\n${badgeCountLine(user)}\n\n` +
            `*Pełną listę odznak otworzysz przyciskiem poniżej albo komendą \`/odznaki\`.*`
        )
        .setTimestamp()
        .setFooter({ text: 'PJN System Osiągnięć i Profilu' });
    try {
        if (targetUser.displayAvatarURL) embed.setThumbnail(targetUser.displayAvatarURL());
    } catch (e) {}
    return embed;
}

// --- Panel karnetu: instrukcja, postęp, odbieranie nagród ---------------------

function bpProgressBar(bp: any): string {
    const need = bpXpForLevel(bp.level || 1);
    const done = Math.min(10, Math.floor(((bp.xp || 0) / need) * 10));
    return '▰'.repeat(done) + '▱'.repeat(10 - done);
}

function bpTableEmbeds(): EmbedBuilder[] {
    const embeds: EmbedBuilder[] = [];
    for (let i = 0; i < BATTLE_PASS_REWARDS.length; i += 10) {
        const page = BATTLE_PASS_REWARDS.slice(i, i + 10);
        const desc = page.map(e => `**Lv ${e.level}**\n🆓 ${e.free.label}\n👑 ${e.premium.label}`).join('\n');
        embeds.push(
            new EmbedBuilder()
                .setColor(0xFFD700)
                .setTitle(`🛤️ Ścieżka Karnetu • Poziomy ${page[0].level} – ${page[page.length - 1].level}`)
                .setDescription(desc)
                .setFooter({ text: `PJN Battle Pass • Sezon ${BATTLE_PASS_SEASON}` })
        );
    }
    return embeds;
}

async function bpProfileEmbed(userId: string, guild: any): Promise<EmbedBuilder> {
    const bp = await getOrCreateBattlePass(userId);
    let premium = false;
    try { premium = await isBattlePassPremium(userId, guild); } catch (e) {}
    const need = bpXpForLevel(bp.level || 1);
    const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
    return new EmbedBuilder()
        .setColor(premium ? 0xF1C40F : 0x9B59B6)
        .setTitle('⚔️ PJN Battle Pass — Twój postęp')
        .setThumbnail(member ? member.user.displayAvatarURL() : (client.user?.displayAvatarURL() || null))
        .setDescription(
            `<@${userId}>\n\n` +
            `🏅 **Poziom karnetu:** \`${bp.level} / 30\`\n` +
            `⭐ **XP karnetu:** \`${bp.xp} / ${need}\`\n` +
            `${bpProgressBar(bp)}\n` +
            `📈 **XP łącznie w sezonie:** \`${bp.totalXp || 0}\`\n` +
            `💳 **Ścieżka elitarna (Premium):** ${premium ? '✅ odblokowana' : `🔒 do kupienia w sklepie — ${BP_PREMIUM_PRICE} PJN-Coins (${BP_PREMIUM_PRICE_VIP} z rangą VIP)`}\n` +
            `🆓 **Odebrane nagrody Free:** \`${(bp.claimedFree || []).length} / 30\`\n` +
            `👑 **Odebrane nagrody Elitarne:** \`${(bp.claimedPremium || []).length} / 30\`\n\n` +
            `🎁 **Aktywne bonusy z karnetu:**\n${bpBoostsText(bp)}`
        )
        .setTimestamp()
        .setFooter({ text: `PJN Battle Pass • Sezon ${BATTLE_PASS_SEASON}` });
}

function bpPanelRows(): ActionRowBuilder<ButtonBuilder>[] {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('bp_profile').setLabel('Mój postęp').setEmoji('📊').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('bp_claim_free').setLabel('Odbierz nagrody Free').setEmoji('🆓').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('bp_claim_premium').setLabel('Odbierz nagrody Elitarne').setEmoji('👑').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('bp_table').setLabel('Tabela nagród').setEmoji('🛤️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('bp_help').setLabel('Jak to działa?').setEmoji('❓').setStyle(ButtonStyle.Secondary)
    );
    return [row];
}

async function setupBattlePassChannel() {
    try {
        const channel = await client.channels.fetch(ID_KANALU_KARNETU).catch(() => null) as TextChannel;
        if (!channel) {
            bpLog('Panel', `Nie znaleziono kanału karnetu (${ID_KANALU_KARNETU}).`);
            return;
        }
        await clearBotMessagesInChannel(channel, 50);

        const intro = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle('⚔️ PJN Battle Pass — System Sezonowy')
            .setDescription(
                '**PJN Battle Pass** to cykliczny system postępów gracza zintegrowany z ekonomią serwera (**PJN-Coins**), poziomami doświadczenia (**XP**), systemem odznak oraz przywilejami **VIP**.\n\n' +
                '📋 **Jak to działa?**\n' +
                '• **Zdobywanie poziomów:** awansujesz na kolejne poziomy karnetu poprzez aktywność na czacie tekstowym, kanałach głosowych oraz udział w predykcjach i zakładach.\n' +
                '• **Dwie ścieżki:** każdy uczestniczy w **Ścieżce Darmowej (Free)**, a **Elitarny Karnet** (Ścieżka Elitarna / Premium) kupisz w **sklepie serwera** za **20 000 PJN-Coins** — z rangą **VIP** tylko za **10 000 PJN-Coins**.\n' +
                '• **30 poziomów** nagród na sezon — od PJN-Coinsów i XP, przez odznaki i bonusy, aż po rangi VIP i unikalny tytuł sezonowy.\n\n' +
                `🎙️ Za każdą minutę na kanale głosowym dostajesz **${BP_VOICE_XP_PER_MINUTE} XP** karnetu, a za wiadomość na czacie od **5 do 14 XP**. Każdy poziom wymaga **${BP_XP_BASE} XP × numer poziomu**.\n\n` +
                `🎵 **Radio:** słuchanie radia na kanale muzycznym (<#${ID_KANAL_MUZYCZNEGO}>) nalicza dodatkowo **${XP_ZA_MINUTE_RADIA} XP serwera** za każdą minutę.`
            )
            .setImage(LIVE_IMAGE_URL)
            .setFooter({ text: 'PJN Battle Pass • Sezon ' + BATTLE_PASS_SEASON });

        const howto = new EmbedBuilder()
            .setColor(0x9B59B6)
            .setTitle('📋 Jak obsługiwać karnet?')
            .setDescription(
                '1️⃣ Kliknij **📊 Mój postęp** — zobaczysz swój poziom, XP i aktywne bonusy.\n' +
                '2️⃣ Zdobywaj XP karnetu: pisz na czacie, siedź na kanałach głosowych (radio na kanale muzycznym daje jednocześnie XP karnetu i XP serwera), głosuj w predykcjach i wchodź do zakładów.\n' +
                '3️⃣ Kliknij **🆓 Odbierz nagrody Free** — bot wyda wszystkie zaległe nagrody z darmowej ścieżki.\n' +
                '4️⃣ **Ścieżka Elitarna:** kup **⚔️ Karnet Premium** w sklepie serwera za **20 000 PJN-Coins** (z rangą **VIP** tylko **10 000**), a potem kliknij **👑 Odbierz nagrody Elitarne**.\n' +
                '5️⃣ **🛤️ Tabela nagród** pokazuje wszystkie 30 poziomów, a **❓ Jak to działa?** wraca do tego opisu.\n\n' +
                '💡 Odznaki z karnetu trafiają do profilu `/odznaki`, rangi VIP z karnetu przedłużają się automatycznie, a bonusy XP (czat, głos, predykcje, `/daily`) naliczają się od razu po odebraniu nagrody.'
            )
            .setFooter({ text: 'PJN Battle Pass • Instrukcja' });

        const sentMsg = await channel.send({ embeds: [intro, howto], components: bpPanelRows() });
        await sentMsg.pin().catch(() => {});
        bpLog('Panel', `Panel karnetu wysłany na kanał ${ID_KANALU_KARNETU}.`);
    } catch (e) {
        console.error('[BattlePass Panel] Błąd inicjalizacji panelu karnetu:', e);
    }
}

async function checkFortniteServerStatus() {
    try {
        const channel = await client.channels.fetch(ID_KANAL_AKTUALIZACJI_FORTNITE).catch(() => null) as TextChannel;
        if (!channel) {
            fortniteLog('Kanał', `Nie udało się pobrać kanału aktualizacji (${ID_KANAL_AKTUALIZACJI_FORTNITE}) - pomijam sprawdzanie.`);
            return;
        }

        const fnRole = await getOrCreateFortniteUpdateRole(channel.guild);
        const roleId = fnRole ? fnRole.id : ID_RANGI_AKTUALIZACJE_FORTNITE;
        const rolePing = `<@&${roleId}>`;
        fortniteLog('Ranga', `Ping powiadomień -> rola ${roleId}${fnRole ? '' : ' (nie udało się pobrać ani utworzyć rangi)'}`);

        // === STATUS SERWERÓW === źródło: status.epicgames.com (stare fortnite-api.com/v1/status zwraca 404)
        const isOnline = await fetchFortniteServerOnline();

        if (isOnline !== null && lastFortniteServerStatus !== null && lastFortniteServerStatus !== isOnline) {
            // Realne okno serwisowe z datami - ale tylko gdy jest AKTUALNE, żeby stara przerwa
            // z ostatniej aktualizacji nie wisiała przy każdym powiadomieniu o statusie.
            const downtimeRaw = await fetchFortniteMaintenance();
            const downtime = downtimeRaw && isMaintenanceCurrent(downtimeRaw) ? downtimeRaw : null;
            const startTxt = downtime ? formatWarsawDateTime(downtime.start) : null;
            const endTxt = downtime ? formatWarsawDateTime(downtime.end) : null;
            let oknoSerwisowe = '';
            if (startTxt && endTxt) {
                oknoSerwisowe = `\n\n⏰ **Start przerwy:** \`${startTxt}\`\n🏁 **Planowany koniec:** \`${endTxt}\`\n📌 **Stan:** ${maintenanceStatusText(downtime!.status)}${maintenanceVersion(downtime!.name) ? `\n🎮 **Wersja:** \`v${maintenanceVersion(downtime!.name)}\`` : ''}`;
            } else if (startTxt) {
                oknoSerwisowe = `\n\n⏰ **Start przerwy:** \`${startTxt}\`\n📌 **Stan:** ${maintenanceStatusText(downtime!.status)}`;
            } else if (downtime) {
                oknoSerwisowe = `\n\n⏰ **Okno serwisowe:** status.epicgames.com nie podaje teraz daty dla tej przerwy.`;
            }

            const serverEmbed = new EmbedBuilder()
                .setColor(isOnline ? 0x2ECC71 : 0xE74C3C)
                .setTitle(isOnline ? '🟢 Serwery Fortnite zostały OTWARTE!' : '🔴 Serwery Fortnite zostały ZAMKNIĘTE!')
                .setDescription(
                    (isOnline
                        ? 'Przerwa techniczna dobiegła końca. Serwery są ponownie dostępne, możesz dołączać do gier!'
                        : 'Rozpoczęła się przerwa techniczna lub wdrażanie nowej aktualizacji. Trwa wyłączanie usług gry.') + oknoSerwisowe
                )
                .setImage(LIVE_IMAGE_URL)
                .setTimestamp()
                .setFooter({ text: 'PJN Fortnite Server Status' });

            try {
                await channel.send({
                    content: `${rolePing} 🔔 Status serwerów Fortnite uległ zmianie!`,
                    embeds: [serverEmbed],
                    allowedMentions: { roles: [roleId] }
                });
                fortniteLog('Status', `Wysłano powiadomienie o zmianie statusu serwerów: ${isOnline ? 'OTWARTE' : 'ZAMKNIĘTE'}.`);
            } catch (err) {
                console.error('[Fortnite Status] Nie udało się wysłać powiadomienia o statusie serwerów:', err);
            }
        }

        if (isOnline !== null) lastFortniteServerStatus = isOnline;

        // === AKTUALIZACJE / PATCH NOTES === źródło: fortnite-api.com/v2/news (stare v2/events zwraca 404)
        const news = await fetchLatestFortniteNews();
        if (news) {
            const buildVersion = await fetchFortniteBuildVersion();
            // Powiadamiamy RAZ NA WERSJĘ gry. Hash ogłoszeń fortnite-api zmienia się codziennie
            // (samo odświeżenie MOTD), więc stary klucz oparty na hashu powodował, że bot
            // codziennie ogłaszał "nową aktualizację" o tej samej wersji v43.10.
            const versionKey = buildVersion ? `v${buildVersion}` : news.key;
            const knownKey = await loadLastFortniteNewsKey();
            // Zapisany klucz w starym formacie (hash, nie "v43.10") migrujemy PO CICHU:
            // inaczej przy pierwszym uruchomieniu poszłoby jeszcze jedno fałszywe ogłoszenie.
            const legacyKey = !!knownKey && !/^v[0-9]/i.test(knownKey);
            if (knownKey === null || legacyKey) {
                await rememberLastFortniteNewsKey(versionKey);
                fortniteLog('News', `Zapamiętano aktualną wersję gry (${versionKey}) - powiadomienie pójdzie dopiero przy zmianie wersji.`);
            } else if (knownKey !== versionKey) {
                await rememberLastFortniteNewsKey(versionKey);
                fortniteLog('News', `Wykryto nową wersję gry: ${knownKey} -> ${versionKey}.`);
                const opis = await buildFortniteUpdateDescription(news);
                const newsDateTxt = formatWarsawDateTime(news.date);
                // Okno serwisowe bierzemy TYLKO gdy jest aktualne - inaczej zamknięta przerwa
                // z 12.11 doklejała się do każdej nowej aktualizacji.
                const downtimeRaw = await fetchFortniteMaintenance();
                const downtime = downtimeRaw && isMaintenanceCurrent(downtimeRaw) ? downtimeRaw : null;
                const przerwaAktywna = downtime ? ['scheduled', 'in_progress', 'verifying'].includes(String(downtime.status).toLowerCase()) : false;
                const versionFromName = downtime && przerwaAktywna ? maintenanceVersion(downtime.name) : null;
                const versionText = buildVersion || versionFromName;

                const startRaw = przerwaAktywna && downtime ? downtime.start : null;
                const endRaw = przerwaAktywna && downtime ? downtime.end : null;
                const startTxt = formatWarsawDateTime(startRaw);
                const endTxt = formatWarsawDateTime(endRaw);
                const startMs = startRaw ? new Date(startRaw).getTime() : NaN;
                const endMs = endRaw ? new Date(endRaw).getTime() : NaN;

                const naglowek = '⏰ **Zaplanowane okno serwisowe:**';
                let oknoTxt: string;
                if (startTxt && endTxt && !isNaN(startMs) && !isNaN(endMs)) {
                    const minuty = Math.max(1, Math.round((endMs - startMs) / 60000));
                    oknoTxt =
                        `${naglowek}\n` +
                        `⏰ **Start przerwy technicznej:** \`${startTxt}\`\n` +
                        `🏁 **Planowany koniec:** \`${endTxt}\`\n` +
                        `⏳ **Przewidywany czas:** \`~${Math.floor(minuty / 60)}h ${minuty % 60}m\`\n` +
                        `📌 **Stan przerwy:** ${maintenanceStatusText(downtime!.status)}\n` +
                        `🏷️ **Nazwa na status.epicgames.com:** ${downtime!.name}\n`;
                } else if (startTxt) {
                    oknoTxt =
                        `${naglowek}\n` +
                        `⏰ **Start przerwy technicznej:** \`${startTxt}\`\n` +
                        `🏁 **Planowany koniec:** status.epicgames.com nie podaje godziny zakończenia\n` +
                        `📌 **Stan przerwy:** ${maintenanceStatusText(downtime!.status)}\n`;
                } else {
                    oknoTxt = `⏰ **Okno serwisowe:** Epic nie ogłosił jeszcze przerwy technicznej dla tej aktualizacji.\n`;
                }

                const updateEmbed = new EmbedBuilder()
                    .setColor(0x00D9FF)
                    .setTitle(`🚀 Nowa Aktualizacja Fortnite${versionText ? ` — v${versionText}` : ''}: ${news.title}`)
                    .setDescription(
                        `Wprowadzono oficjalny update gry!\n\n` +
                        `🎮 **Wersja gry:** ${versionText ? `\`v${versionText}\`` : 'brak danych z fortnite-api.com'}\n` +
                        `${newsDateTxt ? `🗓️ **Data ogłoszenia:** \`${newsDateTxt}\`\n` : ''}` +
                        `${oknoTxt}\n` +
                        `📋 **Czego dotyczy aktualizacja:**\n` +
                        `${opis}\n\n` +
                        `🎮 *Wskocz do gry, pobierz paczkę i sprawdź nowości na mapie!*`
                    )
                    .setImage(LIVE_IMAGE_URL)
                    .setTimestamp()
                    .setFooter({ text: 'PJN Fortnite Updates & Patch Notes' });

                if (downtime && downtime.link && przerwaAktywna) updateEmbed.setURL(downtime.link);

                try {
                    await channel.send({
                        content: `${rolePing} 📢 Pojawiła się **nowa aktualizacja** w Fortnite!`,
                        embeds: [updateEmbed],
                        allowedMentions: { roles: [roleId] }
                    });
                    fortniteLog('News', `Wysłano powiadomienie o aktualizacji: "${news.title}".`);
                } catch (err) {
                    console.error('[Fortnite News] Nie udało się wysłać powiadomienia o aktualizacji:', err);
                }
            } else {
                fortniteLog('News', `Bez zmian wersji gry (${versionKey}) - nie powtarzam powiadomienia.`);
            }
        }
    } catch (err) {
        console.error('Błąd podczas sprawdzania statusu i aktualizacji Fortnite:', err);
    }
}

function startFortniteStatusCron() {
    cron.schedule('*/5 * * * *', async () => {
        fortniteLog('Cron', 'Uruchamiam sprawdzanie statusu serwerów i aktualizacji Fortnite...');
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

        const underUsers = await findRankedMembers(guild, { epicNick: { $ne: null }, matchesPlayed: { $lt: 2800 } }, { fortniteKills: -1 }, 100);
        const payloadUnder = await generateFortniteRankingEmbeds(guild, underUsers, '🟢 TOP • Początkujący (<2800 meczów)', 0x2ECC71, 0);
        await channel.send(payloadUnder);

        const overUsers = await findRankedMembers(guild, { epicNick: { $ne: null }, matchesPlayed: { $gte: 2800 } }, { fortniteKills: -1 }, 100);
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

// === AUTOMATYCZNE ROZSTRZYGANIE ZAKŁADÓW (TIMER) ===
function startBetChecker() {
    setInterval(async () => {
        try {
            const now = new Date();
            const activeBets = await BetModel.find({ ended: false, endsAt: { $lte: now } });

            for (const bet of activeBets) {
                bet.ended = true;
                await bet.save();

                const channel = await client.channels.fetch(bet.channelId).catch(() => null) as TextChannel;
                if (!channel) continue;

                const msg = await channel.messages.fetch(bet.messageId).catch(() => null);
                if (!msg) continue;

                if (bet.participants.length === 0) {
                    const endedEmbed = new EmbedBuilder()
                        .setColor(0xE74C3C)
                        .setTitle(`🔒 Zakład Zakończony: ${bet.question}`)
                        .setDescription(`Nikt nie wziął udziału w tym zakładzie.`)
                        .setTimestamp();
                    await msg.edit({ embeds: [endedEmbed], components: [] }).catch(() => {});
                    continue;
                }

                // Domyślnie losowanie zwycięzcy spośród uczestników z uwzględnieniem postawionych kwot (im więcej postawiłeś, tym większa szansa)
                let totalPool = bet.participants.reduce((sum, p) => sum + p.amount, 0);
                let finalPool = Math.round(totalPool * (bet.multiplier || 1));

                // Wybór losowego zwycięzcy ważonego stawką
                let winningTicket = Math.random() * totalPool;
                let currentSum = 0;
                let winnerId = bet.participants[0].userId;

                for (const p of bet.participants) {
                    currentSum += p.amount;
                    if (winningTicket <= currentSum) {
                        winnerId = p.userId;
                        break;
                    }
                }

                let winnerDoc = await UserModel.findOne({ userId: winnerId });
                if (!winnerDoc) winnerDoc = await UserModel.create({ userId: winnerId });
                winnerDoc.balance += finalPool;
                await winnerDoc.save();

                await sendCoinsNotification(winnerId, finalPool, 'System Zakładów PJN', `Wygrana w zakładzie: "${bet.question}" (Pula: ${finalPool} coins)`);
                await TransactionHistoryModel.create({
                    userId: client.user?.id || 'system',
                    targetUserId: winnerId,
                    type: 'bet_win',
                    amount: finalPool,
                    details: `Wygrana w zakładzie (${finalPool} coins)`
                });

                let listText = bet.participants.map(p => `• <@${p.userId}> — stawka: \`${p.amount} PJN-Coins\``).join('\n');

                const endedEmbed = new EmbedBuilder()
                    .setColor(0x2ECC71)
                    .setTitle(`🔒 Zakład Zakończony: ${bet.question}`)
                    .setDescription(
                        `🏆 **Zwycięzca wylosowany z puli:** <@${winnerId}>\n` +
                        `✨ **Całkowita wypłacona pula:** \`${finalPool} PJN-Coins\` *(Mnożnik: x${bet.multiplier})*\n\n` +
                        `👥 **Uczestnicy zakładu:**\n${listText}`
                    )
                    .setTimestamp();

                await msg.edit({ embeds: [endedEmbed], components: [] }).catch(() => {});
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

async function setupTicketChannel() {
    try {
        const channel = await client.channels.fetch(ID_KANALU_DUSZKI).catch(() => null) as TextChannel;
        if (!channel) return;
        await clearBotMessagesInChannel(channel, 100);

        const embed = new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle('👻 Odbiór duszka / Bilet poza kolejką PJN')
            .setDescription(
                'Chcesz odebrać duszka lub skorzystać z biletu poza kolejką podczas transmisji?\n\n' +
                '👇 **Kliknij przycisk poniżej**, aby otworzyć swój prywatny kanał zgłoszeniowy z administracją!'
            )
            .setImage(LIVE_IMAGE_URL)
            .setTimestamp()
            .setFooter({ text: 'PJN System Duszków' });

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
        // UWAGA: nie czyscimy historii tego kanalu - kasowaloby to menu sklepu z karnetem Premium.
        // Wystarczy jedno menu z karnetem: przy restarcie edytujemy te sama wiadomosc (shop_config).

        let desc = 'Witaj w oficjalnym sklepie serwera PJN! Wydawaj swoje PJN-Coins na unikalne przedmioty, role i usługi.\n\n*Wszystkie rangi czasowe (w tym VIP) są ważne przez 30 dni, po czym automatycznie wygasają.*\n\n**📋 Dostępny asortyment:**\n\n';
        SHOP_ITEMS.forEach((item, index) => {
            const vipNote = item.id === 'bp_premium' ? ' *(z rangą VIP: 10 000)*' : '';
            desc += `**${index + 1}.${item.name}** — 💰 **${item.price} PJN-Coins**${vipNote}\n> *${item.description}*\n\n`;
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
        // Te sama wiadomosc edytujemy przy kazdym restarcie, wiec menu (w tym Karnet Premium)
        // zostaje na kanale i nie zniknie po restarcie bota.
        await sendOrUpdateInfoEmbed(channel, 'info_msg_sklep', embed, [row]);
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
        await sendCoinsNotification(userId, 1500, 'System Awansów PJN', `Nagroda za awans na ${user.level} poziom!`);
    }

    await user.save();

    // Informacja o karnecie idzie na PW - kanał awansów zostaje czysty.
    if (leveledUp) await dmKarnetInfo(userId, user.level);

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

            const karnetText = '';

            const embed = new EmbedBuilder()
                .setColor(0x9B59B6)
                .setTitle('🚀 AWANS NA WYŻSZY POZIOM!')
                .setThumbnail(avatarUrl)
                .setDescription(
                    `Gratulacje <@${userId}>! Właśnie wskoczyłeś na wyższy poziom na serwerze! 🌟\n\n` +
                    `⭐ **Nowy Poziom:** \`${user.level}\`\n` +
                    `🏆 **Miejsce w rankingu XP:** \`#${rankDetails.rank} z ${rankDetails.total}\`\n` +
                    `🎯 **Twój Postęp:** \`${user.exp} / ${user.level * 150} XP\`` +
                    rewardText +
                    karnetText
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

// === FILTROWANIE BYŁYCH CZŁONKÓW Z RANKINGÓW ===
// Rankingi pokazują wyłącznie osoby, które nadal są na serwerze - żadnych samych ID.
// Danych byłych graczy NIE kasujemy: gdy wrócą, ich portfel, poziom i odznaki są nietknięte.

/** Zwraca tylko tych użytkowników, którzy nadal są członkami serwera. */
async function filterPresentMembers(guild: any, users: any[]): Promise<any[]> {
    if (!guild || !guild.members) return users;

    const withId: { u: any; id: string }[] = [];
    const seen = new Set<string>();
    for (const u of users) {
        if (!u || !u.userId) continue;
        const id = String(u.userId);
        if (seen.has(id)) continue;
        seen.add(id);
        withId.push({ u, id });
    }

    const present: any[] = [];
    const missing: string[] = [];
    for (const { u, id } of withId) {
        // Zawsze pytamy REST z force: true. Cache potrafi trzymać kogoś, kto już wyszedł,
        // a wtedy taki gracz przechodził filtr i lądował w rankingu jako samo ID.
        const member = await guild.members.fetch({ user: id, force: true }).catch(() => null);
        if (member) present.push(u);
        else missing.push(id);
    }

    if (missing.length) {
        console.log(`[Rankingi] Pomijam byłych członków (${missing.length}): ${missing.join(', ')}`);
    }
    return present;
}

/**
 * Ranking bez byłych członków: pobiera zapas z bazy (limit * 3), odrzuca osoby,
 * których już nie ma na serwerze, i zwraca żądaną liczbę pozycji.
 */
async function findRankedMembers(guild: any, filter: any, sort: any, limit: number): Promise<any[]> {
    const users = await UserModel.find(filter).sort(sort).limit(Math.min(limit * 3, 300));
    const present = await filterPresentMembers(guild, users);
    return present.slice(0, limit);
}

/**
 * Rozwiązuje nazwy wyświetlane dla kandydatów do rankingu.
 * Kto nie jest już członkiem serwera (albo nazwy nie da się pobrać), wypada z listy -
 * dzięki temu w rankingu nigdy nie pojawi się wpis typu "Użytkownik (123456...)".
 */
async function resolveRankedNames(guild: any, users: any[]): Promise<{ u: any; name: string }[]> {
    const resolved: { u: any; name: string }[] = [];
    for (const u of users) {
        if (!u || !u.userId) continue;
        const member = guild
            ? await guild.members.fetch({ user: String(u.userId), force: true }).catch(() => null)
            : null;
        if (member) resolved.push({ u, name: member.displayName });
    }
    return resolved;
}

/** Tytuły wiadomości rankingowych - służą do rozpoznania i sprzątnięcia starych kopii. */
const TOP_RANKING_TITLE = '🏆 TOP 10 - Ranking PJN-Coins';
const REP_RANKING_TITLE = '🌟 Aleja Sław - TOP 5 Traderów Reputacji';

/**
 * Usuwa z kanału wszystkie wiadomości bota z danym tytułem rankingu.
 * Dzięki temu na kanale zostaje dokładnie jedna, świeża wiadomość, a żadna stara kopia
 * (np. z okresu przed poprawką) nie wisi dalej z samymi ID. Limit powtórzeń chroni
 * przez niekończoną pętlą, gdyby Discord zwracał błąd kasowania.
 */
async function deleteRankingCopies(channel: TextChannel, title: string) {
    try {
        for (let pass = 0; pass < 5; pass++) {
            const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
            if (!messages) return;
            const copies = messages.filter(m =>
                m.author.id === client.user?.id &&
                m.embeds.some(e => (e.title || '').trim() === title)
            );
            if (copies.size === 0) return;
            for (const [, msg] of copies) await msg.delete().catch(() => {});
            if (copies.size < 100) return;
        }
    } catch (e) {}
}

// Odświeżenie rankingu Fortnite po odejściu gracza - najwyżej raz na minutę, aby nie spamować API.
let fortniteRankingRefreshTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleFortniteRankingRefresh(guild: any) {
    if (fortniteRankingRefreshTimer) return;
    fortniteRankingRefreshTimer = setTimeout(async () => {
        fortniteRankingRefreshTimer = null;
        try {
            await refreshFortniteRankingMessage(guild);
        } catch (e) {}
    }, 60 * 1000);
}

async function getTopEmbedData(guild: any) {
    // Bierzemy zapas kandydatów i rozwiązujemy nazwy: kogo nie ma już na serwerze,
    // ten w ogóle nie trafia do rankingu.
    const candidates = await findRankedMembers(guild, {}, { balance: -1 }, 30);
    const topUsers = (await resolveRankedNames(guild, candidates)).slice(0, 10);

    if (topUsers.length === 0) {
        return {
            color: 0xFFD700,
            title: '🏆 TOP 10 - Ranking PJN-Coins',
            description: 'Brak danych w rankingu.'
        };
    }

    let desc = 'Ranking jest automatycznie aktualizowany co 5 minut.\n\nNajbogatsi użytkownicy\n';

    for (let index = 0; index < topUsers.length; index++) {
        const { u, name: userName } = topUsers[index];
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**${index + 1}.**`;

        desc += `${medal} — **${userName}** — **${u.balance} PJN-Coins**\n`;
    }

    return {
        color: 0xFFD700,
        title: '🏆 TOP 10 - Ranking PJN-Coins',
        description: desc
    };
}

async function getReputationTopEmbedData(guild: any) {
    const candidates = await findRankedMembers(guild, {}, { reputation: -1 }, 30);
    const topUsers = (await resolveRankedNames(guild, candidates)).slice(0, 5);

    if (topUsers.length === 0) {
        return {
            color: 0xF1C40F,
            title: '🌟 Aleja Sław - TOP 5 Traderów Reputacji',
            description: 'Brak danych w rankingu reputacji.'
        };
    }

    let desc = 'Ranking najlepszych i najbezpieczniejszych traderów Fortnite na serwerze. Aktualizowany co 5 godzin.\n\n';

    for (let index = 0; index < topUsers.length; index++) {
        const { u, name: userName } = topUsers[index];
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**${index + 1}.**`;

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

/** Przebudowuje TOP 10 PJN-Coins: kasuje poprzednią wiadomość i wysyła świeżą listę. */
async function refreshTopRanking() {
    try {
        const config = await ConfigModel.findOne({ key: 'topka_msg' });
        if (!config) return;

        const channel = await client.channels.fetch(config.channelId).catch(() => null) as TextChannel;
        if (!channel) return;

        // Kasujemy WSZYSTKIE kopie tego rankingu (także te sprzed poprawki), nie tylko
        // ostatnio zapisaną - inaczej stara lista z samymi ID wisiałaby dalej.
        await deleteRankingCopies(channel, TOP_RANKING_TITLE);

        const embedData = await getTopEmbedData(channel.guild);
        const newMessage = await channel.send({ embeds: [embedData] });

        config.messageId = newMessage.id;
        await config.save();
        console.log('[Rankingi] TOP 10 PJN-Coins odświeżone (bez byłych członków).');
    } catch (err) {
        console.error('Błąd odświeżania TOP 10 PJN-Coins:', err);
    }
}

/** Przebudowuje Aleję Sław: usuwa stare wiadomości rankingu i wysyła świeżą listę. */
async function refreshReputationRanking() {
    try {
        const channel = await client.channels.fetch(ID_ALEJA_SLAW_REPUTACJI).catch(() => null) as TextChannel;
        if (!channel) return;

        await deleteRankingCopies(channel, REP_RANKING_TITLE);

        const embedData = await getReputationTopEmbedData(channel.guild);
        await channel.send({ embeds: [embedData] });
        console.log('[Rankingi] Aleja Sław odświeżona (bez byłych członków).');
    } catch (err) {
        console.error('Błąd odświeżania Alei Sław:', err);
    }
}

// Po odejściu gracza odświeżamy oba rankingi - najwyżej raz na minutę, żeby nie spamować kanałów.
let rankingsRefreshTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleAllRankingsRefresh() {
    if (rankingsRefreshTimer) return;
    rankingsRefreshTimer = setTimeout(async () => {
        rankingsRefreshTimer = null;
        await refreshTopRanking();
        await refreshReputationRanking();
    }, 60 * 1000);
}

async function startTopUpdater() {
    setInterval(() => { refreshTopRanking(); }, 5 * 60 * 1000);
}

async function startReputationTopUpdater() {
    setInterval(() => { refreshReputationRanking(); }, 5 * 60 * 60 * 1000);
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

client.on('voiceStateUpdate', async (oldState: VoiceState, newState: VoiceState) => {
    try {
        const guild = newState.guild || oldState.guild;

        await trackBattlePassVoiceTime(oldState, newState);

        if (newState.channelId === ID_KANAL_TWORZENIA_POKOJU && newState.member) {
            const parentCategoryId = newState.channel?.parentId || await getFirstCategory(guild);

            const tempChannel = await guild.channels.create({
                name: `🔊・Pokój ${newState.member.displayName}`,
                type: ChannelType.GuildVoice,
                parent: parentCategoryId || undefined,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect]
                    },
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

            const controlEmbed = new EmbedBuilder()
                .setColor(0x3498DB)
                .setTitle(`🔊 Prywatny Pokój: ${newState.member.displayName}`)
                .setDescription(
                    `Witaj w swoim prywatnym pokoju głosowym!\n\n` +
                    `🎛️ **Sterowanie pokojem:**\n` +
                    `• Użyj przycisków poniżej, aby zablokować lub odblokować dostęp do pokoju innym graczoom.\n` +
                    `• Gdy wszyscy opuszczą pokój, zostanie on automatycznie usunięty.`
                )
                .setTimestamp();

            const controlRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('temp_voice_lock').setLabel('Zablokuj pokój').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
                new ButtonBuilder().setCustomId('temp_voice_unlock').setLabel('Odblokuj pokój').setStyle(ButtonStyle.Success).setEmoji('🔓')
            );

            await tempChannel.send({ embeds: [controlEmbed], components: [controlRow] }).catch(() => {});
        }

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

// === Powitania na kanale powitań — proste, po ludzku ===
const WELCOME_CHANNEL_ID = '1532302511459926068';
const WELCOME_WORDS = ['witam', 'siema', 'siemanko', 'cześć', 'czesc'];
const welcomeCooldowns = new Map<string, number>();
const WELCOME_COOLDOWN_MS = 2 * 60 * 1000;

/** Czy wiadomość to powitanie? Krótka wypowiedź zawierająca jedno ze słów powitalnych. */
function isWelcomeMessage(content: string): boolean {
    const cleaned = content
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!cleaned) return false;
    const words = cleaned.split(' ');
    if (words.length > 5) return false;
    return words.some(w => WELCOME_WORDS.includes(w));
}

/** Odpowiedź jak od zwykłego użytkownika — kilka wariantów, żeby nie było sztampowo. */
function buildWelcomeReply(displayName: string): string {
    const replies = [
        `Siema ${displayName}! 👋`,
        `Cześć ${displayName}! Miło Cię widzieć 😄`,
        `Siemanko ${displayName}! 🖐️`,
        `Witam witam ${displayName}! 🙌`,
        `Hejka ${displayName}! Co słychać? 😎`,
        `Ooo, ${displayName}! Siemanko 👋`
    ];
    return replies[Math.floor(Math.random() * replies.length)];
}

client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

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
    const bpChatBase = Math.floor(Math.random() * 10) + 5;
    await addExp(message.author.id, bpChatBase, message.guild);

    // XP karnetu z czatu (z uwzględnieniem bonusów z PJN Battle Pass)
    try {
        const bpChat = await getOrCreateBattlePass(message.author.id);
        let bpChatMult = 1;
        const boostActive = bpChat.chatBoostUntil && new Date(bpChat.chatBoostUntil).getTime() > Date.now();
        const boostPermanent = !bpChat.chatBoostUntil && (bpChat.chatBoostMult || 1) > 1;
        if (boostActive || boostPermanent) bpChatMult = bpChat.chatBoostMult || 1;
        await addBattlePassXp(message.author.id, Math.max(1, Math.round(bpChatBase * BP_CHAT_XP_FACTOR * bpChatMult)), message.guild, 'wiadomość na czacie');
    } catch (e) {}

    await checkAndAwardBadges(user, message.member || message.author, message.guild);

    const content = message.content.trim();

    // Powitanie na kanale powitań (z krótkim cooldownem, żeby bot nie spamował)
    try {
        if (message.channelId === WELCOME_CHANNEL_ID && isWelcomeMessage(content)) {
            const last = welcomeCooldowns.get(message.author.id) || 0;
            if (Date.now() - last > WELCOME_COOLDOWN_MS) {
                welcomeCooldowns.set(message.author.id, Date.now());
                const displayName = message.member?.displayName || message.author.username;
                await message.reply({
                    content: buildWelcomeReply(displayName),
                    allowedMentions: { repliedUser: false }
                });
                return;
            }
        }
    } catch (e) {
        console.error('Błąd powitania:', e);
    }

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

// === LISTA KOMEND SLASH ===
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
    new SlashCommandBuilder()
        .setName('karnet')
        .setDescription('Sprawdź swój postęp w karnetcie PJN Battle Pass')
        .addUserOption(o => o.setName('uzytkownik').setDescription('Sprawdź karnet innego gracza').setRequired(false)),
    new SlashCommandBuilder().setName('przelej').setDescription('Przelewa PJN-Coins').addUserOption(o => o.setName('uzytkownik').setDescription('Komu').setRequired(true)).addIntegerOption(o => o.setName('kwota').setDescription('Ile').setRequired(true)),
    new SlashCommandBuilder().setName('kostka').setDescription('Rzuć kością').addIntegerOption(o => o.setName('stawka').setDescription('Stawka').setRequired(true)),
    new SlashCommandBuilder().setName('moneta').setDescription('Orzeł czy reszka').addStringOption(o => o.setName('wybor').setDescription('Wybór').setRequired(true).addChoices({name: 'Orzeł', value: 'orzel'}, {name: 'Reszka', value: 'reszka'})).addIntegerOption(o => o.setName('stawka').setDescription('Stawka').setRequired(true)),
    new SlashCommandBuilder().setName('slot').setDescription('Sloty').addIntegerOption(o => o.setName('stawka').setDescription('Stawka').setRequired(true)),
    new SlashCommandBuilder().setName('poker').setDescription('Rozpocznij lub dołącz do stołu pokerowego').addIntegerOption(o => o.setName('stawka').setDescription('Stawka wejściowa PJN-Coins').setRequired(true)),
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
    
    // Sugestie
    new SlashCommandBuilder()
        .setName('sugestia')
        .setDescription('Wyślij swoją sugestię lub pomysł na kanał sugestii')
        .addStringOption(o => o.setName('tresc').setDescription('Treść Twojej sugestii').setRequired(true)),

    // Anonimowe wyznania
    new SlashCommandBuilder()
        .setName('wyznanie')
        .setDescription('Wyślij anonimowe wyznanie na dedykowany kanał')
        .addStringOption(o => o.setName('tresc').setDescription('Treść wyznania').setRequired(true)),

    // Rekord stream
    new SlashCommandBuilder()
        .setName('rekord-stream')
        .setDescription('Zgłoś lub opublikuj rekord ze streama')
        .addStringOption(o => o.setName('opis').setDescription('Opis rekordu (np. Ilość widzów / donor)').setRequired(true)),

    // Predykcja (bez limitu czasowego, guzik zamykający przez administratora, ograniczone pola)
    new SlashCommandBuilder()
        .setName('predykcja')
        .setDescription('Otwórz formularz tworzenia nowej predykcji (Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    // Nowa komenda: Zakłady
    new SlashCommandBuilder()
        .setName('zakłady')
        .setDescription('Stwórz nowy zakład z pulą PJN Coins, czasem trwania i możliwością przebijania (Admin)')
        .addStringOption(o => o.setName('pytanie').setDescription('Zadaj pytanie / treść zakładu').setRequired(true))
        .addIntegerOption(o => o.setName('czas').setDescription('Czas trwania w minutach').setRequired(true).addChoices(
            { name: '5 minut', value: 5 },
            { name: '10 minut', value: 10 },
            { name: '15 minut', value: 15 },
            { name: '20 minut', value: 20 }
        ))
        .addIntegerOption(o => o.setName('pula_startowa').setDescription('Początkowa pula (wpłata hosta/bota)').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

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
    new SlashCommandBuilder().setName('fn-sklep').setDescription('Wyświetla dzisiejszy sklep w grze Fortnite'),
    new SlashCommandBuilder()
        .setName('fn-stats')
        .setDescription('Sprawdza statystyki gracza w Fortnite')
        .addStringOption(o => o.setName('nick').setDescription('Nazwa użytkownika Epic Games').setRequired(true)),
    new SlashCommandBuilder().setName('fn-mapa').setDescription('Wyświetla aktualną mapę Fortnite'),
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
        .setName('daj-karnet-premium')
        .setDescription('Nadaje lub odbiera karnet Premium PJN Battle Pass wybranemu graczowi (Admin)')
        .addUserOption(o => o.setName('uzytkownik').setDescription('Gracz, który ma otrzymać karnet Premium').setRequired(true))
        .addBooleanOption(o => o.setName('odbierz').setDescription('Ustaw na true, aby odebrać karnet Premium zamiast go nadawać').setRequired(false))
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
        .addStringOption(o => o.setName('tytul').setDescription('Tytuł ogłoszenia').setRequired(true))
        .addStringOption(o => o.setName('co_nowego').setDescription('Krótko opisz co dodano').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
        .setName('ogloszenie-techniczne')
        .setDescription('Tworzy ogłoszenie o przerwie technicznej lub pracach (Admin)')
        .addStringOption(o => o.setName('tytul').setDescription('Tytuł ogłoszenia').setRequired(true))
        .addStringOption(o => o.setName('opis').setDescription('Opis prac').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
        .setName('odpalstream')
        .setDescription('Ogłasza start streama (Streamer/Admin)')
        .addStringOption(o => o.setName('tytul').setDescription('Tytuł streama').setRequired(true))
        .addStringOption(o => o.setName('link').setDescription('Link do transmisji').setRequired(true)),
    new SlashCommandBuilder()
        .setName('zakonczstream')
        .setDescription('Ogłasza zakończenie streama (Streamer/Admin)'),
    new SlashCommandBuilder()
        .setName('powiadomienie')
        .setDescription('Ręcznie wyślij powiadomienie o nowym filmie / streamie')
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
        .addStringOption(opt => opt.setName('tytul').setDescription('Tytuł').setRequired(true))
        .addStringOption(opt => opt.setName('link').setDescription('Link').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('daj-odznake').setDescription('Przyznaj odznakę (Admin)')
        .addUserOption(o => o.setName('uzytkownik').setDescription('Komu').setRequired(true))
        .addStringOption(o => o.setName('odznaka').setDescription('Wybierz odznakę').setRequired(true).setAutocomplete(true)),
    new SlashCommandBuilder().setName('zabierz-odznake').setDescription('Odbierz odznakę (Admin)').addUserOption(o => o.setName('uzytkownik').setDescription('Komu').setRequired(true)).addStringOption(o => o.setName('odznaka').setDescription('Nazwa').setRequired(true).setAutocomplete(true)),
    new SlashCommandBuilder()
        .setName('dajpunkty')
        .setDescription('Daj punkty użytkownikowi')
        .addUserOption(o => o.setName('uzytkownik').setDescription('User').setRequired(true))
        .addIntegerOption(o => o.setName('ilosc').setDescription('Ilość').setRequired(true))
        .addStringOption(o => o.setName('powod').setDescription('Powód (opcjonalnie)').setRequired(false)),
    new SlashCommandBuilder().setName('zabierzpunkty').setDescription('Zabierz punkty').addUserOption(o => o.setName('uzytkownik').setDescription('User').setRequired(true)).addIntegerOption(o => o.setName('ilosc').setDescription('Ilość').setRequired(true)),
    new SlashCommandBuilder().setName('cytat').setDescription('Wyślij cytat'),
    new SlashCommandBuilder().setName('dodaj-cytat').setDescription('Dodaj cytat').addStringOption(o => o.setName('tekst').setDescription('Tekst').setRequired(true)).addStringOption(o => o.setName('autor').setDescription('Autor').setRequired(true)),
    new SlashCommandBuilder()
        .setName('mem')
        .setDescription('Generuje mema z wyszukiwarką szablonów')
        .addStringOption(o => 
            o.setName('szablon')
             .setDescription('Wpisz nazwę szablonu (np. drake, cat)')
             .setRequired(true)
             .setAutocomplete(true)
        )
        .addStringOption(o => o.setName('gora').setDescription('Tekst górny').setRequired(false))
        .addStringOption(o => o.setName('dol').setDescription('Tekst dolny').setRequired(false)),
    new SlashCommandBuilder()
        .setName('szukam')
        .setDescription('Stwórz ogłoszenie LFG do gry')
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
                .setDescription('Maksymalna liczba osób')
                .setRequired(true)
                .setMinValue(2)
                .setMaxValue(10))
        .addStringOption(option =>
            option.setName('opis')
                .setDescription('Opis')
                .setRequired(false)),
    new ContextMenuCommandBuilder()
        .setName('Zapisz jako złoty tekst')
        .setType(ApplicationCommandType.Message)
].map(c => c.toJSON());

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
                .setTitle('Użytkownik został Wyrzucony (Kick)')
                .setDescription(`Użytkownik **${member.user.tag}** (<@${member.id}>) został wyrzucony z serwera przez **${executorTag}**.`);
        } else {
            embed.setColor(0xE74C3C)
                .setTitle('📤 Użytkownik Opuścił Serwer')
                .setDescription(`Użytkownik **${member.user.tag}** (<@${member.id}>) opuścił serwer.`);
        }

        await channel.send({ embeds: [embed] });

        // Gracz odszedł - odśwież rankingi, aby nie zostało w nich samo jego ID.
        scheduleFortniteRankingRefresh(guild);
        scheduleAllRankingsRefresh();
    } catch (e) {}
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
    } catch (e) {}
});

client.once('ready', async () => {
    console.log(`Zalogowano jako ${client.user?.tag}!`);
    await seedQuotesIfNeeded();

    // Licznik głosu działa od startu, także dla osób, które były na kanale przed restartem bota.
    syncVoiceSessions();
    startVoiceTicker();

    try {
        // Ranking odświeżamy tą samą drogą co co 5 minut: kasuje wszystkie stare kopie
        // i wysyła jedną świeżą listę, już bez byłych członków.
        await refreshTopRanking();
        await refreshReputationRanking();
    } catch (e) {}

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
    } catch (e) {}

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
    await setupPredictionsChannel();
    await setupAnonymousConfessionsChannel();
    await setupStreamRecordsChannel();
    await setupSuggestionsChannel();
    await setupCasinoHubChannel();
    await setupBotInteractiveChannelInstruction(); 
    await setupCenterZgloszenChannel(); 
    await setupBattlePassChannel();
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
    // Po starcie od razu poprawiamy oba rankingi: inaczej wiadomość z samym ID byłego członka
    // wisiałaby na kanale do 5 minut (topka), a na Alei Sław nawet do 5 godzin.
    setTimeout(() => { refreshTopRanking(); }, 5000);
    setTimeout(() => { refreshReputationRanking(); }, 8000);
    startLfgAutoCloser();
    startExpirationChecker();
    startDailyShopAutoPoster(); 
    startFortniteRankingCron();
    startFortniteStatusCron(); 
    // Pierwsze sprawdzenie od razu po starcie - ustawia punkt odniesienia (bez powiadomień) i pokazuje w konsoli, co zwróciły źródła.
    checkFortniteServerStatus();
    startServerStatsCron();
    startPollChecker();
    startBetChecker();
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

    // === Moduł odznak — przycisk otwarcia i paginacja ===
    if (interaction.isButton() && interaction.customId.startsWith('badge_mod_')) {
        const parts = interaction.customId.split('_');
        const targetId = parts[2];
        const page = parseInt(parts[3] || '0', 10) || 0;

        await interaction.deferReply({ ephemeral: true });
        const targetUser = await client.users.fetch(targetId).catch(() => null);
        if (!targetUser) {
            return interaction.editReply({ content: '❌ Nie znaleziono użytkownika.' });
        }
        let user = await UserModel.findOne({ userId: targetId });
        if (!user) user = await UserModel.create({ userId: targetId });

        const view = buildBadgeModule(user, targetUser, page);
        return interaction.editReply({ embeds: view.embeds, components: view.components });
    }

    // === PJN Battle Pass — obsługa przycisków panelu karnetu ===
    if (interaction.isButton() && interaction.customId.startsWith('bp')) {
        const guild = interaction.guild;

        if (interaction.customId === 'bp_help') {
            return interaction.reply({
                content: '📋 **Jak obsługiwać karnet?**\n' +
                    '• **📊 Mój postęp** — Twój poziom, XP i aktywne bonusy.\n' +
                    '• **🆓 Odbierz nagrody Free** — wydaje wszystkie zaległe nagrody z darmowej ścieżki.\n' +
                    '• **👑 Odbierz nagrody Elitarne** — nagrody Premium, wymaga rangi VIP.\n' +
                    '• XP karnetu zdobywasz za czat, kanały głosowe, predykcje i zakłady.\n' +
                    `• Zasady i tabela nagród: <#${ID_KANALU_KARNETU}> oraz komenda \`/karnet\`.`,
                ephemeral: true
            });
        }

        if (interaction.customId === 'bp_table') {
            return interaction.reply({ embeds: bpTableEmbeds(), ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        if (interaction.customId === 'bp_profile') {
            return interaction.editReply({ embeds: [await bpProfileEmbed(interaction.user.id, guild)] });
        }

        const bp = await getOrCreateBattlePass(interaction.user.id);
        const bpMember = guild ? await guild.members.fetch(interaction.user.id).catch(() => null) : null;

        if (interaction.customId === 'bp_claim_free') {
            const granted = await bpClaimTrack(bp, bpMember, guild, 'free');
            if (!granted.length) {
                return interaction.editReply({ content: `ℹ️ Nie masz zaległych nagród z darmowej ścieżki. Twój poziom karnetu: **${bp.level} / 30** — zdobywaj XP i wróć tutaj!` });
            }
            return interaction.editReply({ content: `🆓 **Odebrano nagrody Ścieżki Darmowej:**\n\n${granted.join('\n')}` });
        }

        if (interaction.customId === 'bp_claim_premium') {
            const premium = await isBattlePassPremium(interaction.user.id, guild);
            if (!premium) {
                return interaction.editReply({ content: `🔒 **Ścieżka Elitarna nie jest jeszcze odblokowana.** Kup **⚔️ Karnet Premium PJN Battle Pass** w sklepie serwera (<#${ID_KANAL_SKLEPU}>) za **${BP_PREMIUM_PRICE} PJN-Coins** — z rangą **VIP** zapłacisz tylko **${BP_PREMIUM_PRICE_VIP} PJN-Coins**.` });
            }
            const granted = await bpClaimTrack(bp, bpMember, guild, 'premium');
            if (!granted.length) {
                return interaction.editReply({ content: `ℹ️ Nie masz zaległych nagród elitarnych. Twój poziom karnetu: **${bp.level} / 30**.` });
            }
            return interaction.editReply({ content: `👑 **Odebrano nagrody Ścieżki Elitarnej:**\n\n${granted.join('\n')}` });
        }

        return;
    }

    // Głosowanie w predykcji (bez limitu czasowego)
    if (interaction.isButton() && interaction.customId.startsWith('predict_vote_')) {
        await interaction.deferUpdate();
        const choice = parseInt(interaction.customId.replace('predict_vote_', ''));

        const prediction = await PredictionModel.findOne({ messageId: interaction.message.id });
        if (!prediction || prediction.ended) {
            return interaction.followUp({ content: '❌ Ta predykcja jest już nieaktualna lub została zakończona.', ephemeral: true });
        }

        const userId = interaction.user.id;
        prediction.votes1 = prediction.votes1.filter(id => id !== userId);
        prediction.votes2 = prediction.votes2.filter(id => id !== userId);
        if (prediction.option3) prediction.votes3 = prediction.votes3.filter(id => id !== userId);
        if (prediction.option4) prediction.votes4 = prediction.votes4.filter(id => id !== userId);
        if (prediction.option5) prediction.votes5 = prediction.votes5.filter(id => id !== userId);

        if (choice === 1) prediction.votes1.push(userId);
        else if (choice === 2) prediction.votes2.push(userId);
        else if (choice === 3 && prediction.option3) prediction.votes3.push(userId);
        else if (choice === 4 && prediction.option4) prediction.votes4.push(userId);
        else if (choice === 5 && prediction.option5) prediction.votes5.push(userId);

        await prediction.save();
        await addBattlePassXp(userId, 40, interaction.guild, 'głos w predykcji');

        const v1 = prediction.votes1.length;
        const v2 = prediction.votes2.length;
        const v3 = prediction.option3 ? prediction.votes3.length : 0;
        const v4 = prediction.option4 ? prediction.votes4.length : 0;
        const v5 = prediction.option5 ? prediction.votes5.length : 0;
        const totalVotes = v1 + v2 + v3 + v4 + v5;

        const p1Pct = totalVotes > 0 ? Math.round((v1 / totalVotes) * 100) : 0;
        const p2Pct = totalVotes > 0 ? Math.round((v2 / totalVotes) * 100) : 0;
        const p3Pct = (prediction.option3 && totalVotes > 0) ? Math.round((v3 / totalVotes) * 100) : 0;
        const p4Pct = (prediction.option4 && totalVotes > 0) ? Math.round((v4 / totalVotes) * 100) : 0;
        const p5Pct = (prediction.option5 && totalVotes > 0) ? Math.round((v5 / totalVotes) * 100) : 0;

        let desc = `Głosuj na poniższe opcje za pomocą przycisków!\n\n` +
            `1️⃣ **${prediction.option1}** — **${p1Pct}%** (${v1} głosów)\n` +
            `2️⃣ **${prediction.option2}** — **${p2Pct}%** (${v2} głosów)\n`;
        if (prediction.option3) desc += `3️⃣ **${prediction.option3}** — **${p3Pct}%** (${v3} głosów)\n`;
        if (prediction.option4) desc += `4️⃣ **${prediction.option4}** — **${p4Pct}%** (${v4} głosów)\n`;
        if (prediction.option5) desc += `5️⃣ **${prediction.option5}** — **${p5Pct}%** (${v5} głosów)\n`;

        desc += `\n🎁 **Nagroda:** ${prediction.rewardText} *(Mnożnik: x${prediction.multiplier})*\n👥 Łącznie głosów: **${totalVotes}**`;

        const embed = new EmbedBuilder()
            .setColor(0x00D9FF)
            .setTitle(`🔮 Predykcja: ${prediction.question}`)
            .setDescription(desc)
            .setTimestamp();

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('predict_vote_1').setLabel(`1️⃣ ${prediction.option1.substring(0, 20)}`).setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('predict_vote_2').setLabel(`2️⃣ ${prediction.option2.substring(0, 20)}`).setStyle(ButtonStyle.Secondary)
        );
        if (prediction.option3) row.addComponents(new ButtonBuilder().setCustomId('predict_vote_3').setLabel(`3️⃣ ${prediction.option3.substring(0, 20)}`).setStyle(ButtonStyle.Success));
        if (prediction.option4) row.addComponents(new ButtonBuilder().setCustomId('predict_vote_4').setLabel(`4️⃣ ${prediction.option4.substring(0, 20)}`).setStyle(ButtonStyle.Danger));
        if (prediction.option5) row.addComponents(new ButtonBuilder().setCustomId('predict_vote_5').setLabel(`5️⃣ ${prediction.option5.substring(0, 20)}`).setStyle(ButtonStyle.Primary));

        const adminCloseRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`predict_close_${prediction.messageId}`).setLabel('🔒 Zamknij predykcję (Admin)').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`predict_multiply_${prediction.messageId}`).setLabel('⭐ Pomnóż pulę (x2) (Admin)').setStyle(ButtonStyle.Secondary)
        );

        await interaction.message.edit({ embeds: [embed], components: [row, adminCloseRow] });
        return;
    }

    // Pomnożenie puli predykcji przez administratora
    if (interaction.isButton() && interaction.customId.startsWith('predict_multiply_')) {
        if (!isAuthorized(interaction.user.id) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ Tylko administrator może pomnożyć pulę!', ephemeral: true });
        }

        const messageId = interaction.customId.replace('predict_multiply_', '');
        const prediction = await PredictionModel.findOne({ messageId });
        if (!prediction || prediction.ended) {
            return interaction.reply({ content: '❌ Ta predykcja nie istnieje lub została zamknięta.', ephemeral: true });
        }

        prediction.multiplier = (prediction.multiplier || 1) * 2;
        await prediction.save();

        return interaction.reply({ content: `⭐ Pomyślnie zwiększono mnożnik nagrody tej predykcji do **x${prediction.multiplier}**!`, ephemeral: true });
    }

    // Zamknięcie predykcji przez administratora (guzik)
    if (interaction.isButton() && interaction.customId.startsWith('predict_close_')) {
        if (!isAuthorized(interaction.user.id) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ Tylko administrator może zamknąć predykcję!', ephemeral: true });
        }

        const messageId = interaction.customId.replace('predict_close_', '');
        const prediction = await PredictionModel.findOne({ messageId });
        if (!prediction || prediction.ended) {
            return interaction.reply({ content: '❌ Ta predykcja już nie istnieje lub została zamknięta.', ephemeral: true });
        }

        const selectOptions = [
            { label: `1️⃣ ${prediction.option1.substring(0, 80)}`, value: 'win_1' },
            { label: `2️⃣ ${prediction.option2.substring(0, 80)}`, value: 'win_2' }
        ];
        if (prediction.option3) selectOptions.push({ label: `3️⃣ ${prediction.option3.substring(0, 80)}`, value: 'win_3' });
        if (prediction.option4) selectOptions.push({ label: `4️⃣ ${prediction.option4.substring(0, 80)}`, value: 'win_4' });
        if (prediction.option5) selectOptions.push({ label: `5️⃣ ${prediction.option5.substring(0, 80)}`, value: 'win_5' });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`predict_resolve_${messageId}`)
            .setPlaceholder('Wybierz wygrywającą opcję...')
            .addOptions(selectOptions);

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
        return interaction.reply({ content: '🎯 Wybierz opcję, która wygrała w tej predykcji:', components: [row], ephemeral: true });
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('predict_resolve_')) {
        if (!isAuthorized(interaction.user.id) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
        }

        await interaction.deferUpdate();
        const messageId = interaction.customId.replace('predict_resolve_', '');
        const winningChoice = interaction.values[0];
        const winningIndex = parseInt(winningChoice.replace('win_', ''));

        const prediction = await PredictionModel.findOne({ messageId });
        if (!prediction || prediction.ended) return;

        prediction.ended = true;
        await prediction.save();

        const winnersIds = winningIndex === 1 ? prediction.votes1 :
                           winningIndex === 2 ? prediction.votes2 :
                           winningIndex === 3 ? prediction.votes3 :
                           winningIndex === 4 ? prediction.votes4 : prediction.votes5;

        const winningOptionText = winningIndex === 1 ? prediction.option1 :
                                  winningIndex === 2 ? prediction.option2 :
                                  winningIndex === 3 ? prediction.option3 :
                                  winningIndex === 4 ? prediction.option4 : prediction.option5;

        const matchNumber = prediction.rewardText.match(/\d+/);
        const baseReward = matchNumber ? parseInt(matchNumber[0]) : 500;
        const finalReward = Math.round(baseReward * (prediction.multiplier || 1));

        for (const winnerId of winnersIds) {
            let uDoc = await UserModel.findOne({ userId: winnerId });
            if (!uDoc) uDoc = await UserModel.create({ userId: winnerId });
            // Bonus z karnetu (Ścieżka Elitarna, Lv 5): +15% do wygranej w predykcji
            let payout = finalReward;
            try {
                const bpWin = await getOrCreateBattlePass(winnerId);
                if (bpWin.pagBoostUntil && new Date(bpWin.pagBoostUntil).getTime() > Date.now()) {
                    payout = Math.round(finalReward * 1.15);
                }
            } catch (e) {}

            uDoc.balance += payout;
            await uDoc.save();
            await sendCoinsNotification(winnerId, payout, 'System Predykcji PJN', `Wygrana w predykcji: "${prediction.question}"`);
            await TransactionHistoryModel.create({
                userId: client.user?.id || 'system',
                targetUserId: winnerId,
                type: 'prediction_win',
                amount: payout,
                details: `Wygrana w predykcji (${payout} coins)`
            });
        }

        const payoutResultText = `💰 Rozdano po **${finalReward} PJN-Coins** *(w tym mnożnik x${prediction.multiplier})* dla \`${winnersIds.length}\` zwycięzców!`;

        const channel = await interaction.guild?.channels.fetch(prediction.channelId).catch(() => null) as TextChannel;
        if (channel) {
            const msg = await channel.messages.fetch(messageId).catch(() => null);
            if (msg) {
                const endedEmbed = new EmbedBuilder()
                    .setColor(0x2ECC71)
                    .setTitle(`🔒 Predykcja Zakończona: ${prediction.question}`)
                    .setDescription(
                        `🏆 **Wygrywająca opcja:** \`${winningOptionText}\`\n\n` +
                        `👥 Liczba zwycięzców: **${winnersIds.length} osób**\n` +
                        payoutResultText
                    )
                    .setTimestamp();
                await msg.edit({ embeds: [endedEmbed], components: [] }).catch(() => {});
            }
        }

        return interaction.editReply({ content: `✅ Pomyślnie rozstrzygnięto predykcję! Wygrali ci, którzy obstawili: **${winningOptionText}**.`, components: [] });
    }

    // Obsługa przycisków i modalów dla komendy /zakłady
    if (interaction.isButton() && interaction.customId.startsWith('bet_join_')) {
        const messageId = interaction.customId.replace('bet_join_', '');
        const bet = await BetModel.findOne({ messageId });
        if (!bet || bet.ended) {
            return interaction.reply({ content: '❌ Ten zakład jest już zamknięty lub nie istnieje.', ephemeral: true });
        }

        const modal = new ModalBuilder()
            .setCustomId(`bet_modal_${messageId}`)
            .setTitle('Dołącz / Przebij Zakład PJN');

        const input = new TextInputBuilder()
            .setCustomId('bet_amount_input')
            .setLabel('Wpisz stawkę w PJN-Coins:')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
        return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('bet_modal_')) {
        await interaction.deferReply({ ephemeral: true });
        const messageId = interaction.customId.replace('bet_modal_', '');
        const bet = await BetModel.findOne({ messageId });
        if (!bet || bet.ended) {
            return interaction.editReply({ content: '❌ Ten zakład już nie przyjmuje wpłat.' });
        }

        const amountStr = interaction.fields.getTextInputValue('bet_amount_input');
        const amount = parseInt(amountStr);

        if (isNaN(amount) || amount <= 0) {
            return interaction.editReply({ content: '❌ Podaj prawidłową stawkę większą od zera.' });
        }

        let user = await UserModel.findOne({ userId: interaction.user.id });
        if (!user) user = await UserModel.create({ userId: interaction.user.id });

        if (user.balance < amount) {
            return interaction.editReply({ content: `❌ Nie masz wystarczająco środków! Posiadasz **${user.balance} PJN-Coins**.` });
        }

        user.balance -= amount;
        await user.save();

        let existingPart = bet.participants.find(p => p.userId === interaction.user.id);
        if (existingPart) {
            existingPart.amount += amount; // Przebijanie stawki
        } else {
            bet.participants.push({ userId: interaction.user.id, amount });
        }
        await bet.save();
        await addBattlePassXp(interaction.user.id, 60, interaction.guild, 'udział w zakładzie');

        await TransactionHistoryModel.create({
            userId: interaction.user.id,
            type: 'bet_join',
            amount: -amount,
            details: `Udział / przebicie w zakładzie: "${bet.question}"`
        });

        // Odświeżenie wiadomości zakładu
        const channel = await interaction.guild?.channels.fetch(bet.channelId).catch(() => null) as TextChannel;
        if (channel) {
            const msg = await channel.messages.fetch(messageId).catch(() => null);
            if (msg) {
                let totalPool = bet.participants.reduce((sum, p) => sum + p.amount, 0);
                let listText = bet.participants.map(p => `• <@${p.userId}> — stawka: \`${p.amount} PJN-Coins\``).join('\n');

                const embed = new EmbedBuilder()
                    .setColor(0xF1C40F)
                    .setTitle(`🎲 Zakład PJN: ${bet.question}`)
                    .setDescription(
                        `💰 **Aktualna pula zakładu:** \`${totalPool} PJN-Coins\` *(Mnożnik: x${bet.multiplier})*\n` +
                        `⏳ **Koniec za:** <t:${Math.floor(new Date(bet.endsAt).getTime() / 1000)}:R>\n\n` +
                        `👥 **Uczestnicy (możesz przebijać stawkę):**\n${listText}`
                    )
                    .setTimestamp();

                const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder().setCustomId(`bet_join_${bet.messageId}`).setLabel('Dołącz / Przebij stawkę').setStyle(ButtonStyle.Success).setEmoji('💰'),
                    new ButtonBuilder().setCustomId(`bet_multiply_${bet.messageId}`).setLabel('⭐ Pomnóż pulę (Admin)').setStyle(ButtonStyle.Secondary)
                );

                await msg.edit({ embeds: [embed], components: [row] }).catch(() => {});
            }
        }

        return interaction.editReply({ content: `✅ Pomyślnie postawiono/przebito stawkę **${amount} PJN-Coins** w zakładzie!` });
    }

    // Pomnożenie puli zakładu przez admina
    if (interaction.isButton() && interaction.customId.startsWith('bet_multiply_')) {
        if (!isAuthorized(interaction.user.id) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ Tylko administrator może pomnożyć pulę zakładu!', ephemeral: true });
        }

        const messageId = interaction.customId.replace('bet_multiply_', '');
        const bet = await BetModel.findOne({ messageId });
        if (!bet || bet.ended) {
            return interaction.reply({ content: '❌ Ten zakład nie istnieje lub został zamknięty.', ephemeral: true });
        }

        bet.multiplier = (bet.multiplier || 1) * 2;
        await bet.save();

        return interaction.reply({ content: `⭐ Pomyślnie zwiększono mnożnik puli tego zakładu do **x${bet.multiplier}**!`, ephemeral: true });
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
                    await sendCoinsNotification(winnerId, totalPot - room.stake, 'Kasyno Poker PJN', 'Wygrana pula w grze pokerowej wieloosobowej');
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
                await sendCoinsNotification(interaction.user.id, stake, 'Rosyjska Ruletka PJN', `Wygrana w Rosyjskiej Ruletce (Stawka: ${stake} coins)`);
                return interaction.editReply({ content: `🎯 **Rosyjska Ruletka:** <@${interaction.user.id}> zaryzykował **${stake} PJN-Coins** i pociągnął za spust...\n✨ **Klik!** Przeżył strzał i wygrywa **${winAmount} PJN-Coins**! (Stan portfela: **${user.balance}**)` }).catch(() => {});
            }
        } catch (err) {
            console.error('Błąd w obsłudze rosyjskiej ruletki:', err);
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
            await sendCoinsNotification(interaction.user.id, outcome.val, 'Koło Fortuny PJN', `Wygrana: ${outcome.name}`);
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
            await sendCoinsNotification(interaction.user.id, 250, 'Quiz PJN', 'Prawidłowa odpowiedź w quizie');
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

            const canAfford = user.balance >= (await getShopPrice(item, interaction.guild, interaction.user.id));
            const _bpPrice = await getShopPrice(item, interaction.guild, interaction.user.id);
            const diff = _bpPrice - user.balance;

            let _bpVipNote = '';
            if (item.id === 'bp_premium') {
                const _hasVip = await memberHasVipRole(interaction.guild, interaction.user.id);
                _bpVipNote = _hasVip
                    ? `\n👑 **Zniżka VIP aktywna:** kupujesz karnet za **${BP_PREMIUM_PRICE_VIP} PJN-Coins** zamiast ${BP_PREMIUM_PRICE}.`
                    : `\n👑 Masz rangę **VIP**? Wtedy karnet kosztuje tylko **${BP_PREMIUM_PRICE_VIP} PJN-Coins**.`;
            }

            const previewEmbed = new EmbedBuilder()
                .setColor(canAfford ? 0x2ECC71 : 0xE74C3C)
                .setTitle(`🛒 Podgląd przedmiotu: ${item.name}`)
                .setDescription(
                    `📝 **Opis:** ${item.description}\n` +
                    `💰 **Cena:** ${_bpPrice} PJN-Coins\n` +
                    `💼 **Twój stan portfela:** ${user.balance} PJN-Coins${_bpVipNote}\n\n` +
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

            // Ranga jest tworzona automatycznie, jeśli nie istnieje (także wtedy, gdy nie ma jej w cache).
            const role = await getOrCreateFortniteUpdateRole(guild);
            if (!role) {
                return interaction.editReply({ content: '❌ Nie udało się utworzyć ani pobrać rangi powiadomień Fortnite. Sprawdź uprawnienie bota: Zarządzanie rolami.' });
            }

            try {
                if (member.roles.cache.has(role.id)) {
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
                const topUsers = await findRankedMembers(interaction.guild, { epicNick: { $ne: null }, matchesPlayed: { $lt: 2800 } }, { fortniteKills: -1 }, 100);
                const payload = await generateFortniteRankingEmbeds(interaction.guild, topUsers, '🟢 TOP • Początkujący (<2800 meczów)', 0x2ECC71, currentPage);
                await interaction.editReply(payload);
            } else {
                const topUsers = await findRankedMembers(interaction.guild, { epicNick: { $ne: null }, matchesPlayed: { $gte: 2800 } }, { fortniteKills: -1 }, 100);
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

            // Karnet Premium PJN Battle Pass: osobna logika (zniżka dla rangi VIP, odblokowanie Ścieżki Elitarnej)
            if (item.type === 'battlepass') {
                const result = await bpPurchasePremium(interaction.user.id, interaction.guild);
                return interaction.editReply({ content: result.message });
            }

            const price = await getShopPrice(item, interaction.guild, interaction.user.id);

            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) user = await UserModel.create({ userId: interaction.user.id });

            if (user.balance < price) {
                return interaction.editReply({ content: `❌ Nie masz wystarczająco środków! Posiadasz **${user.balance} PJN-Coins** (potrzebujesz ${price}).` });
            }

            user.balance -= price;
            await user.save();

            await ShopHistoryModel.create({
                userId: interaction.user.id,
                itemName: item.name,
                price: price
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

            await interaction.editReply({ content: `🎉 Zakupiono przedmiot **${item.name}** za **${price} PJN-Coins**!` });
            return;
        }

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

    // Obsługa Modala wysuwanego dla Predykcji (bez limitu czasowego, ograniczone pola)
    if (interaction.isModalSubmit() && interaction.customId === 'prediction_create_modal') {
        await interaction.deferReply({ ephemeral: true });
        const pytanie = interaction.fields.getTextInputValue('pred_question');
        const opcja1 = interaction.fields.getTextInputValue('pred_opt1');
        const opcja2 = interaction.fields.getTextInputValue('pred_opt2');
        // Modal predykcji ma tylko 3 pola opcji - pola 4 i 5 nie istnieją,
        // a getTextInputValue rzuca wyjątek, gdy pola nie ma w modalu.
        const opcja3 = interaction.fields.getTextInputValue('pred_opt3') || null;
        const opcja4 = null;
        const opcja5 = null;
        const nagroda = interaction.fields.getTextInputValue('pred_reward') || '500 PJN-Coins';

        const channel = await interaction.guild?.channels.fetch(ID_KANALU_PREDICTY).catch(() => null) as TextChannel;
        if (!channel) {
            return interaction.editReply({ content: '❌ Kanał predykcji nie został skonfigurowany lub nie istnieje.' });
        }

        let desc = `Głosuj na poniższe opcje za pomocą przycisków!\n⏳ **Czas trwania:** Bez ograniczenia czasowego (zamyka administrator)\n\n` +
            `1️⃣ **${opcja1}** — **0%** (0 głosów)\n` +
            `2️⃣ **${opcja2}** — **0%** (0 głosów)\n`;
        if (opcja3) desc += `3️⃣ **${opcja3}** — **0%** (0 głosów)\n`;
        if (opcja4) desc += `4️⃣ **${opcja4}** — **0%** (0 głosów)\n`;
        if (opcja5) desc += `5️⃣ **${opcja5}** — **0%** (0 głosów)\n`;

        desc += `\n🎁 **Nagroda:** ${nagroda} *(Mnożnik: x1)*\n👥 Łącznie głosów: **0**`;

        const embed = new EmbedBuilder()
            .setColor(0x00D9FF)
            .setTitle(`🔮 Predykcja: ${pytanie}`)
            .setDescription(desc)
            .setTimestamp();

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('predict_vote_1').setLabel(`1️⃣ ${opcja1.substring(0, 20)}`).setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('predict_vote_2').setLabel(`2️⃣ ${opcja2.substring(0, 20)}`).setStyle(ButtonStyle.Secondary)
        );
        if (opcja3) row.addComponents(new ButtonBuilder().setCustomId('predict_vote_3').setLabel(`3️⃣ ${opcja3.substring(0, 20)}`).setStyle(ButtonStyle.Success));
        if (opcja4) row.addComponents(new ButtonBuilder().setCustomId('predict_vote_4').setLabel(`4️⃣ ${opcja4.substring(0, 20)}`).setStyle(ButtonStyle.Danger));
        if (opcja5) row.addComponents(new ButtonBuilder().setCustomId('predict_vote_5').setLabel(`5️⃣ ${opcja5.substring(0, 20)}`).setStyle(ButtonStyle.Primary));

        const sentMsg = await channel.send({ embeds: [embed], components: [row] });

        const adminCloseRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`predict_close_${sentMsg.id}`).setLabel('🔒 Zamknij predykcję (Admin)').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`predict_multiply_${sentMsg.id}`).setLabel('⭐ Pomnóż pulę (x2) (Admin)').setStyle(ButtonStyle.Secondary)
        );
        await sentMsg.edit({ embeds: [embed], components: [row, adminCloseRow] });

        await PredictionModel.create({
            messageId: sentMsg.id,
            channelId: channel.id,
            question: pytanie,
            option1: opcja1,
            option2: opcja2,
            option3: opcja3,
            option4: opcja4,
            option5: opcja5,
            votes1: [],
            votes2: [],
            votes3: [],
            votes4: [],
            votes5: [],
            rewardText: nagroda,
            multiplier: 1,
            ended: false
        });

        return interaction.editReply({ content: `✅ Pomyślnie utworzono predykcję bez limitu czasu na kanale <#${ID_KANALU_PREDICTY}>!` });
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
        // Sugestia
        if (commandName === 'sugestia') {
            await interaction.deferReply({ ephemeral: true });
            const tresc = interaction.options.getString('tresc', true);
            const channel = await interaction.guild?.channels.fetch(ID_KANALU_POMYSLE_I_SUGESTIE).catch(() => null) as TextChannel;

            if (!channel) {
                return interaction.editReply({ content: '❌ Kanał sugestii nie został skonfigurowany lub nie istnieje na serwerze.' });
            }

            const embed = new EmbedBuilder()
                .setColor(0x3498DB)
                .setTitle('💡 Nowa Sugestia / Pomysł')
                .setDescription(`> *${tresc}*`)
                .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp()
                .setFooter({ text: 'PJN System Sugestii' });

            const sentMsg = await channel.send({ embeds: [embed] });
            await sentMsg.react('👍');
            await sentMsg.react('👎');

            return interaction.editReply({ content: `✅ Twoja sugestia została pomyślnie wysłana na kanał <#${ID_KANALU_POMYSLE_I_SUGESTIE}>!` });
        }

        // Anonimowe wyznania
        if (commandName === 'wyznanie') {
            await interaction.deferReply({ ephemeral: true });
            const tresc = interaction.options.getString('tresc', true);
            const channel = await interaction.guild?.channels.fetch(ID_KANALU_ANONIMOWE_WYZNANIA).catch(() => null) as TextChannel;

            if (!channel) {
                return interaction.editReply({ content: '❌ Kanał anonimowych wyznań nie został skonfigurowany!' });
            }

            const embed = new EmbedBuilder()
                .setColor(0x9B59B6)
                .setTitle('🕶️ Anonimowe Wyznanie')
                .setDescription(`> *${tresc}*`)
                .setTimestamp()
                .setFooter({ text: 'PJN Anonimowe Wyznania' });

            const sentMsg = await channel.send({ embeds: [embed] });
            await sentMsg.react('❤️');
            await sentMsg.react('💬');

            return interaction.editReply({ content: `✅ Twoje anonimowe wyznanie zostało opublikowane na kanale <#${ID_KANALU_ANONIMOWE_WYZNANIA}>!` });
        }

        // Rekord stream
        if (commandName === 'rekord-stream') {
            await interaction.deferReply({ ephemeral: true });
            const opis = interaction.options.getString('opis', true);
            const channel = await interaction.guild?.channels.fetch(ID_KANALU_REKORDY_STREAM).catch(() => null) as TextChannel;

            if (!channel) {
                return interaction.editReply({ content: '❌ Kanał rekordów streamu nie został skonfigurowany!' });
            }

            const embed = new EmbedBuilder()
                .setColor(0xF1C40F)
                .setTitle('🏆 Nowy Rekord ze Streama!')
                .setDescription(
                    `👤 **Autor/Streamer:** <@${interaction.user.id}>\n` +
                    `📊 **Wynik / Opis rekordu:**\n> *${opis}*\n\n` +
                    `Gratulacje! 🚀`
                )
                .setImage(LIVE_IMAGE_URL)
                .setTimestamp()
                .setFooter({ text: 'PJN Rekordy Streamu' });

            const sentMsg = await channel.send({ content: '@everyone Nowy rekord na streamie!', embeds: [embed], allowedMentions: { parse: ['everyone'] } });
            await sentMsg.react('🔥');
            await sentMsg.react('⭐');

            return interaction.editReply({ content: `✅ Rekord został pomyślnie opublikowany na kanale <#${ID_KANALU_REKORDY_STREAM}>!` });
        }

        // Komenda /predykcja (modal z ograniczonymi polami)
        if (commandName === 'predykcja') {
            if (!isAuthorized(interaction.user.id) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ Brak uprawnień do tworzenia predykcji!', ephemeral: true });
            }

            const modal = new ModalBuilder()
                .setCustomId('prediction_create_modal')
                .setTitle('Utwórz Nową Predykcję PJN');

            const qInput = new TextInputBuilder()
                .setCustomId('pred_question')
                .setLabel('Temat lub pytanie predykcji')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const opt1Input = new TextInputBuilder()
                .setCustomId('pred_opt1')
                .setLabel('Opcja 1')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const opt2Input = new TextInputBuilder()
                .setCustomId('pred_opt2')
                .setLabel('Opcja 2')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const opt3Input = new TextInputBuilder()
                .setCustomId('pred_opt3')
                .setLabel('Opcja 3 (opcjonalnie)')
                .setStyle(TextInputStyle.Short)
                .setRequired(false);

            const rewardInput = new TextInputBuilder()
                .setCustomId('pred_reward')
                .setLabel('Nagroda z ilością (np. 500 PJN-Coins)')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder<TextInputBuilder>().addComponents(qInput),
                new ActionRowBuilder<TextInputBuilder>().addComponents(opt1Input),
                new ActionRowBuilder<TextInputBuilder>().addComponents(opt2Input),
                new ActionRowBuilder<TextInputBuilder>().addComponents(opt3Input),
                new ActionRowBuilder<TextInputBuilder>().addComponents(rewardInput)
            );

            return interaction.showModal(modal);
        }

        // Nowa komenda /zakłady
        if (commandName === 'zakłady') {
            if (!isAuthorized(interaction.user.id) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ Brak uprawnień do tworzenia zakładów!', ephemeral: true });
            }

            await interaction.deferReply({ ephemeral: true });
            const pytanie = interaction.options.getString('pytanie', true);
            const czasMins = interaction.options.getInteger('czas', true);
            const pulaStartowa = interaction.options.getInteger('pula_startowa', true);

            const channel = await interaction.guild?.channels.fetch(ID_KANALU_PREDICTY).catch(() => null) as TextChannel;
            if (!channel) {
                return interaction.editReply({ content: '❌ Kanał predykcji/zakładów nie został skonfigurowany!' });
            }

            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) user = await UserModel.create({ userId: interaction.user.id });

            if (user.balance < pulaStartowa) {
                return interaction.editReply({ content: `❌ Nie masz wystarczająco środków na pulę startową (${pulaStartowa} PJN-Coins)!` });
            }

            user.balance -= pulaStartowa;
            await user.save();

            const endsAtDate = new Date(Date.now() + czasMins * 60 * 1000);

            const embed = new EmbedBuilder()
                .setColor(0xF1C40F)
                .setTitle(`🎲 Zakład PJN: ${pytanie}`)
                .setDescription(
                    `💰 **Aktualna pula zakładu:** \`${pulaStartowa} PJN-Coins\` *(Mnożnik: x1)*\n` +
                    `⏳ **Koniec za:** <t:${Math.floor(endsAtDate.getTime() / 1000)}:R>\n\n` +
                    `👥 **Uczestnicy:**\n• <@${interaction.user.id}> — stawka: \`${pulaStartowa} PJN-Coins\``
                )
                .setTimestamp();

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('bet_join_placeholder').setLabel('Dołącz / Przebij stawkę').setStyle(ButtonStyle.Success).setEmoji('💰'),
                new ButtonBuilder().setCustomId('bet_multiply_placeholder').setLabel('⭐ Pomnóż pulę (Admin)').setStyle(ButtonStyle.Secondary)
            );

            const sentMsg = await channel.send({ embeds: [embed], components: [row] });

            const realRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId(`bet_join_${sentMsg.id}`).setLabel('Dołącz / Przebij stawkę').setStyle(ButtonStyle.Success).setEmoji('💰'),
                new ButtonBuilder().setCustomId(`bet_multiply_${sentMsg.id}`).setLabel('⭐ Pomnóż pulę (Admin)').setStyle(ButtonStyle.Secondary)
            );
            await sentMsg.edit({ embeds: [embed], components: [realRow] });

            await BetModel.create({
                messageId: sentMsg.id,
                channelId: channel.id,
                question: pytanie,
                durationMinutes: czasMins,
                multiplier: 1,
                participants: [{ userId: interaction.user.id, amount: pulaStartowa }],
                endsAt: endsAtDate,
                ended: false
            });

            await TransactionHistoryModel.create({
                userId: interaction.user.id,
                type: 'bet_create',
                amount: -pulaStartowa,
                details: `Utworzenie zakładu: "${pytanie}"`
            });

            return interaction.editReply({ content: `✅ Pomyślnie utworzono zakład na kanale <#${ID_KANALU_PREDICTY}>!` });
        }

        // Naprawiona komenda /poker
        if (commandName === 'poker') {
            await interaction.deferReply();
            const stake = interaction.options.getInteger('stawka', true);
            if (stake <= 0) return interaction.editReply({ content: '❌ Stawka musi być większa od 0.' });

            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) user = await UserModel.create({ userId: interaction.user.id });
            if (user.balance < stake) {
                return interaction.editReply({ content: `❌ Nie masz wystarczająco środków (${stake} PJN-Coins).` });
            }

            const embed = new EmbedBuilder()
                .setColor(0x9B59B6)
                .setTitle('🃏 Prywatny Pokój Pokerowy')
                .setDescription(
                    `👤 **Host:** <@${interaction.user.id}>\n` +
                    `💰 **Stawka wejściowa:** ${stake} PJN-Coins\n` +
                    `👥 **Gracze (1/4):**\n• <@${interaction.user.id}>\n\n` +
                    `⏱️ Pokój zostanie zamknięty po 15 minutach bezczynności.`
                )
                .setTimestamp();

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('poker_join').setLabel('Dołącz do pokoju').setStyle(ButtonStyle.Success).setEmoji('🃏'),
                new ButtonBuilder().setCustomId('poker_start').setLabel('Natychmiastowy start').setStyle(ButtonStyle.Primary).setEmoji('🚀')
            );

            const sentMsg = await interaction.editReply({ embeds: [embed], components: [row] });

            await PokerRoomModel.create({
                messageId: sentMsg.id,
                channelId: interaction.channelId,
                hostId: interaction.user.id,
                stake: stake,
                players: [interaction.user.id],
                status: 'waiting'
            });
            return;
        }

        // Naprawiona komenda /fn-stats
        if (commandName === 'fn-stats') {
            await interaction.deferReply();
            const nick = interaction.options.getString('nick', true);

            try {
                const res = await fetch(`https://fortnite-api.com/v2/stats/br/v2?name=${encodeURIComponent(nick)}`, {
                    headers: { 'Authorization': process.env.FORTNITE_API_KEY || '' }
                });
                const data = await res.json() as any;

                if (!data || data.status !== 200 || !data.data) {
                    return interaction.editReply({ content: `❌ Nie znaleziono gracza **${nick}** lub statystyki są ukryte.` });
                }

                const overall = data.data.stats.all?.overall || {};
                const embed = new EmbedBuilder()
                    .setColor(0x00D9FF)
                    .setTitle(`📊 Statystyki Fortnite: ${data.data.account.name}`)
                    .setDescription(
                        `🎮 **Kille:** \`${overall.kills || 0}\`\n` +
                        `🏆 **Wygrane (Top 1):** \`${overall.wins || 0}\`\n` +
                        `👥 **Rozegrane mecze:** \`${overall.matches || 0}\`\n` +
                        `📈 **Winrate:** \`${(overall.winRate || 0).toFixed(2)}%\`\n` +
                        `🎯 **K/D Ratio:** \`${(overall.kd || 0).toFixed(2)}\``
                    )
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });
            } catch (e) {
                return interaction.editReply({ content: '❌ Błąd podczas pobierania statystyk z API Fortnite.' });
            }
        }

        // Naprawiona komenda /fn-top
        if (commandName === 'fn-top') {
            await interaction.deferReply({ ephemeral: true });
            if (!isAuthorized(interaction.user.id) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
                return interaction.editReply({ content: '❌ Brak uprawnień!' });
            }

            await refreshFortniteRankingMessage(interaction.guild);
            return interaction.editReply({ content: '✅ Pomyślnie zaktualizowano i odświeżono rankingi Fortnite!' });
        }

        // Quiz gra
        if (commandName === 'quiz-gra' || commandName === 'quiz') {
            await interaction.deferReply();
            const qObj = QUIZ_POOL[Math.floor(Math.random() * QUIZ_POOL.length)];
            const answers = [qObj.correct, qObj.wrong1, qObj.wrong2].sort(() => Math.random() - 0.5);

            const embed = new EmbedBuilder()
                .setColor(0xF1C40F)
                .setTitle('🧠 Quiz z Nagrodami PJN')
                .setDescription(`**Pytanie:**\n> *${qObj.q}*\n\nWybierz prawidłową odpowiedź poniżej! (Nagroda: **250 PJN-Coins**)`)
                .setTimestamp();

            const row = new ActionRowBuilder<ButtonBuilder>();
            answers.forEach((ans, idx) => {
                const isCorr = ans === qObj.correct;
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(isCorr ? 'quiz_correct' : `quiz_wrong_${idx}`)
                        .setLabel(ans)
                        .setStyle(ButtonStyle.Secondary)
                );
            });

            return interaction.editReply({ embeds: [embed], components: [row] });
        }

        // Kamień, Papier, Nożyce (/kpn)
        if (commandName === 'kpn') {
            await interaction.deferReply();
            const userChoice = interaction.options.getString('wybor', true);
            const stawka = interaction.options.getInteger('stawka', true);

            if (stawka <= 0) return interaction.editReply({ content: '❌ Stawka musi być większa od 0.' });

            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) user = await UserModel.create({ userId: interaction.user.id });
            if (user.balance < stawka) return interaction.editReply({ content: '❌ Nie masz wystarczająco monet!' });

            user.balance -= stawka;
            user.casinoPlays = (user.casinoPlays || 0) + 1;

            const choices = ['kamien', 'papier', 'nozyce'];
            const botChoice = choices[Math.floor(Math.random() * choices.length)];

            let result = 'lose';
            if (userChoice === botChoice) result = 'draw';
            else if (
                (userChoice === 'kamien' && botChoice === 'nozyce') ||
                (userChoice === 'papier' && botChoice === 'kamien') ||
                (userChoice === 'nozyce' && botChoice === 'papier')
            ) {
                result = 'win';
            }

            if (result === 'win') {
                const winAmount = stawka * 2;
                user.balance += winAmount;
                user.consecutiveWins = (user.consecutiveWins || 0) + 1;
                user.consecutiveLosses = 0;
                await user.save();
                await sendCoinsNotification(interaction.user.id, stawka, 'Kasyno KPN', 'Wygrana w Kamień, Papier, Nożyce');
                return interaction.editReply({ content: `✂️ **Kamień, Papier, Nożyce:**\nTwój wybór: **${userChoice}** | Wybór bota: **${botChoice}**\n🎉 Wygrana! Otrzymujesz **${winAmount} PJN-Coins**!` });
            } else if (result === 'draw') {
                user.balance += stawka;
                await user.save();
                return interaction.editReply({ content: `✂️ **Kamień, Papier, Nożyce:**\nTwój wybór: **${userChoice}** | Wybór bota: **${botChoice}**\n⚖️ Remis! Zwrócono stawkę **${stawka} PJN-Coins**.` });
            } else {
                user.consecutiveLosses = (user.consecutiveLosses || 0) + 1;
                user.consecutiveWins = 0;
                await user.save();
                return interaction.editReply({ content: `✂️ **Kamień, Papier, Nożyce:**\nTwój wybór: **${userChoice}** | Wybór bota: **${botChoice}**\n💥 Przegrana! Tracisz **${stawka} PJN-Coins**.` });
            }
        }

        // Slot (/slot)
        if (commandName === 'slot') {
            await interaction.deferReply();
            const stawka = interaction.options.getInteger('stawka', true);
            if (stawka <= 0) return interaction.editReply({ content: '❌ Stawka musi być większa od 0.' });

            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) user = await UserModel.create({ userId: interaction.user.id });
            if (user.balance < stawka) return interaction.editReply({ content: '❌ Nie masz tylu środków!' });

            user.balance -= stawka;
            user.casinoPlays = (user.casinoPlays || 0) + 1;

            const emojis = ['🍒', '🍋', '🔔', '⭐', '💎'];
            const r1 = emojis[Math.floor(Math.random() * emojis.length)];
            const r2 = emojis[Math.floor(Math.random() * emojis.length)];
            const r3 = emojis[Math.floor(Math.random() * emojis.length)];

            if (r1 === r2 && r2 === r3) {
                const winAmount = stawka * 5;
                user.balance += winAmount;
                user.consecutiveWins = (user.consecutiveWins || 0) + 1;
                user.consecutiveLosses = 0;
                await user.save();
                await sendCoinsNotification(interaction.user.id, winAmount - stawka, 'Kasyno Sloty PJN', 'Jackpot na slotach');
                return interaction.editReply({ content: `🎰 **Jednoręki Bandyta:**\n[ ${r1} | ${r2} | ${r3} ]\n\n🎉 **JACKPOT!** Trafiłeś trzy takie same symbole i wygrywasz **${winAmount} PJN-Coins**!` });
            } else if (r1 === r2 || r2 === r3 || r1 === r3) {
                const winAmount = Math.round(stawka * 1.5);
                user.balance += winAmount;
                user.consecutiveWins = (user.consecutiveWins || 0) + 1;
                user.consecutiveLosses = 0;
                await user.save();
                return interaction.editReply({ content: `🎰 **Jednoręki Bandyta:**\n[ ${r1} | ${r2} | ${r3} ]\n\n✨ **Mała wygrana!** Dwa symbole są takie same, wygrywasz **${winAmount} PJN-Coins**.` });
            } else {
                user.consecutiveLosses = (user.consecutiveLosses || 0) + 1;
                user.consecutiveWins = 0;
                await user.save();
                return interaction.editReply({ content: `🎰 **Jednoręki Bandyta:**\n[ ${r1} | ${r2} | ${r3} ]\n\n💥 Przegrana! Tracisz **${stawka} PJN-Coins**.` });
            }
        }

        // Komenda /portfel
        if (commandName === 'portfel') {
            await interaction.deferReply();
            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) user = await UserModel.create({ userId: interaction.user.id });

            const embed = new EmbedBuilder()
                .setColor(0xF1C40F)
                .setTitle(`💰 Portfel • ${interaction.user.tag}`)
                .setDescription(
                    `💼 **Dostępne środki:** \`${user.balance} PJN-Coins\`\n` +
                    `⭐ **Poziom:** \`${user.level || 1}\` (Exp: \`${user.exp || 0}\`)\n` +
                    `🏆 **Liczba odznak:** \`${user.badges.length}\``
                )
                .setTimestamp()
                .setFooter({ text: 'PJN System Ekonomii' });

            return interaction.editReply({ embeds: [embed] });
        }

        // Komenda /sklep
        if (commandName === 'sklep') {
            await interaction.deferReply();
            let desc = 'Oficjalny sklep serwera PJN. Wybierz przedmiot z menu poniżej na dedykowanym kanale skleprowym lub sprawdź asortyment:\n\n';
            SHOP_ITEMS.forEach((item, index) => {
                const vipNote = item.id === 'bp_premium' ? ' *(z rangą VIP: 10 000)*' : '';
                desc += `**${index + 1}.${item.name}** — 💰 **${item.price} PJN-Coins**${vipNote}\n> *${item.description}*\n\n`;
            });

            const embed = new EmbedBuilder()
                .setColor(0xF1C40F)
                .setTitle('🛒 Sklep PJN')
                .setDescription(desc)
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        // Komenda /moje-przedmioty
        if (commandName === 'moje-przedmioty') {
            await interaction.deferReply({ ephemeral: true });
            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) return interaction.editReply({ content: '❌ Nie masz jeszcze żadnych danych w bazie.' });

            const now = new Date();
            let desc = `📦 **Twoje aktywne usługi i przedmioty czasowe:**\n\n`;

            let hasAny = false;
            if (user.vipExpiresAt && new Date(user.vipExpiresAt) > now) {
                hasAny = true;
                desc += `• 🟡 **Rola VIP** — wygasa: <t:${Math.floor(new Date(user.vipExpiresAt).getTime() / 1000)}:R>\n`;
            }
            if (user.doubleChanceUntil && new Date(user.doubleChanceUntil) > now) {
                hasAny = true;
                desc += `• 🍀 **Podwójna szansa w kasynie** — wygasa: <t:${Math.floor(new Date(user.doubleChanceUntil).getTime() / 1000)}:R>\n`;
            }
            if (user.dailyBoostUntil && new Date(user.dailyBoostUntil) > now) {
                hasAny = true;
                desc += `• 🎁 **Pakiet "2x Daily"** — wygasa: <t:${Math.floor(new Date(user.dailyBoostUntil).getTime() / 1000)}:R>\n`;
            }
            if (user.customRoleExpiresAt && new Date(user.customRoleExpiresAt) > now) {
                hasAny = true;
                desc += `• ✨ **Własna rola** — wygasa: <t:${Math.floor(new Date(user.customRoleExpiresAt).getTime() / 1000)}:R>\n`;
            }
            if (user.customVoiceExpiresAt && new Date(user.customVoiceExpiresAt) > now) {
                hasAny = true;
                desc += `• 🎙️ **Własny kanał głosowy** — wygasa: <t:${Math.floor(new Date(user.customVoiceExpiresAt).getTime() / 1000)}:R>\n`;
            }

            if (!hasAny) {
                desc += 'Brak aktywnych czasowych przedmiotów. Odwiedź sklep, aby coś zakupić!';
            }

            const embed = new EmbedBuilder()
                .setColor(0x3498DB)
                .setTitle(`🎒 Przedmioty i Usługi: ${interaction.user.tag}`)
                .setDescription(desc)
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        // Komenda /historia-sklepu
        if (commandName === 'historia-sklepu') {
            if (!isAuthorized(interaction.user.id) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
            }
            await interaction.deferReply({ ephemeral: true });
            const history = await ShopHistoryModel.find().sort({ purchasedAt: -1 }).limit(15);

            if (history.length === 0) {
                return interaction.editReply({ content: '📭 Brak zakupów w historii sklepu.' });
            }

            let desc = `Ostatnie zakupy w sklepie serwera:\n\n`;
            for (const h of history) {
                desc += `• Użytkownik <@${h.userId}> kupił **${h.itemName}** za \`${h.price} coins\` — <t:${Math.floor(new Date(h.purchasedAt).getTime() / 1000)}:R>\n`;
            }

            const embed = new EmbedBuilder().setColor(0xF1C40F).setTitle('🛒 Historia Sklepu PJN').setDescription(desc).setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        // Komenda /historia-transakcji
        if (commandName === 'historia-transakcji') {
            if (!isAuthorized(interaction.user.id) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
            }
            await interaction.deferReply({ ephemeral: true });
            const txs = await TransactionHistoryModel.find().sort({ timestamp: -1 }).limit(15);

            if (txs.length === 0) {
                return interaction.editReply({ content: '📭 Brak transakcji w bazie.' });
            }

            let desc = `Ostatnie transakcje i przepływy waluty:\n\n`;
            for (const t of txs) {
                const targetText = t.targetUserId ? ` -> <@${t.targetUserId}>` : '';
                desc += `• **[${t.type}]** <@${t.userId}>${targetText} | Kwota: \`${t.amount}\` — *${t.details}* (<t:${Math.floor(new Date(t.timestamp).getTime() / 1000)}:R>)\n`;
            }

            const embed = new EmbedBuilder().setColor(0x3498DB).setTitle('📜 Historia Transakcji PJN').setDescription(desc).setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        // Komenda /topka
        if (commandName === 'topka') {
            await interaction.deferReply();
            const embedData = await getTopEmbedData(interaction.guild);
            const embed = new EmbedBuilder().setColor(embedData.color).setTitle(embedData.title).setDescription(embedData.description).setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        // Komenda /ustaw-topke
        if (commandName === 'ustaw-topke') {
            if (!isAuthorized(interaction.user.id) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
            }
            await interaction.deferReply({ ephemeral: true });

            const channel = interaction.channel as TextChannel;
            // Najpierw kasujemy wszystkie stare kopie rankingu (także te sprzed poprawki),
            // żeby po ustawieniu została dokładnie jedna, świeża wiadomość.
            await deleteRankingCopies(channel, TOP_RANKING_TITLE);

            const embedData = await getTopEmbedData(interaction.guild);
            const msg = await channel.send({ embeds: [embedBuilderToEmbed(embedData)] });

            await ConfigModel.findOneAndUpdate(
                { key: 'topka_msg' },
                { channelId: channel.id, messageId: msg.id },
                { upsert: true, new: true }
            );

            return interaction.editReply({ content: `✅ Pomyślnie ustawiono ten kanał jako dynamiczny ranking TOP-10 PJN-Coins!` });
        }

        // Komenda /ustaw-odznaki
        if (commandName === 'ustaw-odznaki') {
            if (!isAuthorized(interaction.user.id) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
            }
            await interaction.deferReply({ ephemeral: true });

            const channel = interaction.channel as TextChannel;
            const embedsList = createBadgesInfoEmbeds();
            const msg = await channel.send({ embeds: embedsList });

            await ConfigModel.findOneAndUpdate(
                { key: 'odznaki_info_msg' },
                { channelId: channel.id, messageId: msg.id },
                { upsert: true, new: true }
            );

            return interaction.editReply({ content: `✅ Pomyślnie ustawiono ten kanał jako centrum informacji o odznakach!` });
        }

        // Komenda /darmowe-gry
        if (commandName === 'darmowe-gry') {
            if (!isAuthorized(interaction.user.id) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
            }
            await interaction.deferReply({ ephemeral: true });
            await sendFreeGamesNotification();
            return interaction.editReply({ content: `✅ Pomyślnie wysłano aktualne darmowe gry na odpowiedni kanał!` });
        }

        // Komenda /daily
        if (commandName === 'daily') {
            await interaction.deferReply();
            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) user = await UserModel.create({ userId: interaction.user.id });

            const now = new Date();
            const twentyFourHours = 24 * 60 * 60 * 1000;
            const bpDaily = await getOrCreateBattlePass(interaction.user.id);

            if (user.lastDaily) {
                const diff = now.getTime() - new Date(user.lastDaily).getTime();
                if (diff < twentyFourHours) {
                    if ((bpDaily.dailySkipTickets || 0) > 0) {
                        // Karnet: bilet pominięcia cooldownu /daily (Ścieżka Elitarna, Lv 7)
                        bpDaily.dailySkipTickets -= 1;
                        bpDaily.markModified('dailySkipTickets');
                        await bpDaily.save();
                    } else {
                        const timeLeft = twentyFourHours - diff;
                        const hours = Math.floor(timeLeft / (1000 * 60 * 60));
                        const mins = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                        return interaction.editReply({ content: `⏳ Odbierałeś już swoją codzienną nagrodę! Spróbuj ponownie za **${hours}h ${mins}m**.` });
                    }
                }
            }

            let amount = 100;
            if (user.dailyBoostUntil && new Date(user.dailyBoostUntil) > now) {
                amount = 200; // podwojona nagroda z boostem
            }
            if (bpDaily.dailyDoubleUntil && new Date(bpDaily.dailyDoubleUntil).getTime() > now.getTime()) {
                amount *= 2; // Karnet: podwójny bonus z /daily (Ścieżka Elitarna, Lv 13)
            }

            user.balance += amount;
            user.lastDaily = now;
            await user.save();

            await TransactionHistoryModel.create({
                userId: interaction.user.id,
                type: 'daily',
                amount: amount,
                details: 'Codzienne darmowe PJN-Coins'
            });

            return interaction.editReply({ content: `🎁 Otrzymałeś swoją codzienną nagrodę w wysokości **${amount} PJN-Coins**! (Stan portfela: **${user.balance}**)` });
        }

        // Komenda /karnet
        if (commandName === 'karnet') {
            await interaction.deferReply();
            const targetUser = interaction.options.getUser('uzytkownik', false) || interaction.user;
            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('bp_claim_free').setLabel('Odbierz nagrody Free').setEmoji('🆓').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('bp_claim_premium').setLabel('Odbierz nagrody Elitarne').setEmoji('👑').setStyle(ButtonStyle.Secondary)
            );
            return interaction.editReply({ embeds: [await bpProfileEmbed(targetUser.id, interaction.guild)], components: [row] });
        }

        // Komenda /przelej
        if (commandName === 'przelej') {
            await interaction.deferReply();
            const targetUser = interaction.options.getUser('uzytkownik', true);
            const amount = interaction.options.getInteger('kwota', true);

            if (amount <= 0) return interaction.editReply({ content: '❌ Kwota przelewu musi być większa od 0.' });
            if (targetUser.id === interaction.user.id) return interaction.editReply({ content: '❌ Nie możesz przelać środków samemu sobie!' });
            if (targetUser.bot) return interaction.editReply({ content: '❌ Nie możesz przelać środków botowi!' });

            let sender = await UserModel.findOne({ userId: interaction.user.id });
            if (!sender) sender = await UserModel.create({ userId: interaction.user.id });

            if (sender.balance < amount) {
                return interaction.editReply({ content: `❌ Nie masz tylu środków! Posiadasz **${sender.balance} PJN-Coins**.` });
            }

            let receiver = await UserModel.findOne({ userId: targetUser.id });
            if (!receiver) receiver = await UserModel.create({ userId: targetUser.id });

            sender.balance -= amount;
            sender.totalDonated = (sender.totalDonated || 0) + amount;
            await sender.save();

            receiver.balance += amount;
            await receiver.save();

            await TransactionHistoryModel.create({
                userId: interaction.user.id,
                targetUserId: targetUser.id,
                type: 'transfer',
                amount: -amount,
                details: `Przelew do <@${targetUser.id}>`
            });

            await sendCoinsNotification(targetUser.id, amount, interaction.user.tag, 'Przelew od innego użytkownika na serwerze');

            return interaction.editReply({ content: `✅ Pomyślnie przelano **${amount} PJN-Coins** do użytkownika <@${targetUser.id}>!` });
        }

        // Komenda /kostka
        if (commandName === 'kostka') {
            await interaction.deferReply();
            const stawka = interaction.options.getInteger('stawka', true);
            if (stawka <= 0) return interaction.editReply({ content: '❌ Stawka musi być większa od 0.' });

            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) user = await UserModel.create({ userId: interaction.user.id });
            if (user.balance < stawka) return interaction.editReply({ content: '❌ Nie masz wystarczająco środków!' });

            user.balance -= stawka;
            user.casinoPlays = (user.casinoPlays || 0) + 1;

            const userRoll = Math.floor(Math.random() * 6) + 1;
            const botRoll = Math.floor(Math.random() * 6) + 1;

            if (userRoll > botRoll) {
                const winAmount = stawka * 2;
                user.balance += winAmount;
                user.consecutiveWins = (user.consecutiveWins || 0) + 1;
                user.consecutiveLosses = 0;
                await user.save();
                await sendCoinsNotification(interaction.user.id, stawka, 'Kasyno Kostka', 'Wygrana w rzucie kością');
                return interaction.editReply({ content: `🎲 **Rzut Kością:**\nTwój wynik: **${userRoll}** | Wynik bota: **${botRoll}**\n🎉 Wygrywasz **${winAmount} PJN-Coins**!` });
            } else if (userRoll === botRoll) {
                user.balance += stawka;
                await user.save();
                return interaction.editReply({ content: `🎲 **Rzut Kością:**\nTwój wynik: **${userRoll}** | Wynik bota: **${botRoll}**\n⚖️ Remis! Zwrócono stawkę **${stawka} PJN-Coins**.` });
            } else {
                user.consecutiveLosses = (user.consecutiveLosses || 0) + 1;
                user.consecutiveWins = 0;
                await user.save();
                return interaction.editReply({ content: `🎲 **Rzut Kością:**\nTwój wynik: **${userRoll}** | Wynik bota: **${botRoll}**\n❌ Przegrana! Tracisz **${stawka} PJN-Coins**.` });
            }
        }

        // Komenda /moneta
        if (commandName === 'moneta') {
            await interaction.deferReply();
            const wybor = interaction.options.getString('wybor', true);
            const stawka = interaction.options.getInteger('stawka', true);
            if (stawka <= 0) return interaction.editReply({ content: '❌ Stawka musi być większa od 0.' });

            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) user = await UserModel.create({ userId: interaction.user.id });
            if (user.balance < stawka) return interaction.editReply({ content: '❌ Nie masz wystarczająco środków!' });

            user.balance -= stawka;
            user.casinoPlays = (user.casinoPlays || 0) + 1;

            const coinSides = ['orzel', 'reszka'];
            const outcome = coinSides[Math.floor(Math.random() * coinSides.length)];

            if (wybor === outcome) {
                const winAmount = stawka * 2;
                user.balance += winAmount;
                user.consecutiveWins = (user.consecutiveWins || 0) + 1;
                user.consecutiveLosses = 0;
                await user.save();
                await sendCoinsNotification(interaction.user.id, stawka, 'Kasyno Moneta', 'Wygrana w Orzeł czy Reszka');
                return interaction.editReply({ content: `🪙 **Orzeł czy Reszka:**\nWypadło: **${outcome.toUpperCase()}**!\n🎉 Trafiłeś! Wygrywasz **${winAmount} PJN-Coins**!` });
            } else {
                user.consecutiveLosses = (user.consecutiveLosses || 0) + 1;
                user.consecutiveWins = 0;
                await user.save();
                return interaction.editReply({ content: `🪙 **Orzeł czy Reszka:**\nWypadło: **${outcome.toUpperCase()}**.\n❌ Niestety! Tracisz **${stawka} PJN-Coins**.` });
            }
        }

        // Komenda /slot
        if (commandName === 'slot') {
            await interaction.deferReply();
            const stawka = interaction.options.getInteger('stawka', true);
            if (stawka <= 0) return interaction.editReply({ content: '❌ Stawka musi być większa od 0.' });

            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) user = await UserModel.create({ userId: interaction.user.id });
            if (user.balance < stawka) return interaction.editReply({ content: '❌ Nie masz wystarczająco środków!' });

            user.balance -= stawka;
            user.casinoPlays = (user.casinoPlays || 0) + 1;

            const symbols = ['🍒', '🍋', '🔔', '⭐', '💎', '7️⃣'];
            const s1 = symbols[Math.floor(Math.random() * symbols.length)];
            const s2 = symbols[Math.floor(Math.random() * symbols.length)];
            const s3 = symbols[Math.floor(Math.random() * symbols.length)];

            if (s1 === s2 && s2 === s3) {
                const winAmount = stawka * 5;
                user.balance += winAmount;
                user.consecutiveWins = (user.consecutiveWins || 0) + 1;
                user.consecutiveLosses = 0;
                await user.save();
                await sendCoinsNotification(interaction.user.id, winAmount - stawka, 'Kasyno Sloty', 'JACKPOT w maszynie slotowej');
                return interaction.editReply({ content: `🎰 **Maszyna Slotowa:**\n[ ${s1} | ${s2} | ${s3} ]\n🌟 **JACKPOT!** Wszystkie symbole takie same! Wygrywasz **${winAmount} PJN-Coins**!` });
            } else if (s1 === s2 || s2 === s3 || s1 === s3) {
                const winAmount = Math.round(stawka * 1.5);
                user.balance += winAmount;
                user.consecutiveWins = (user.consecutiveWins || 0) + 1;
                user.consecutiveLosses = 0;
                await user.save();
                return interaction.editReply({ content: `🎰 **Maszyna Slotowa:**\n[ ${s1} | ${s2} | ${s3} ]\n✨ Dwa symbole takie same! Wygrywasz **${winAmount} PJN-Coins**.` });
            } else {
                user.consecutiveLosses = (user.consecutiveLosses || 0) + 1;
                user.consecutiveWins = 0;
                await user.save();
                return interaction.editReply({ content: `🎰 **Maszyna Slotowa:**\n[ ${s1} | ${s2} | ${s3} ]\n❌ Nic z tego! Tracisz **${stawka} PJN-Coins**.` });
            }
        }

        // Komenda /profil — zwięzła karta gracza, pełna lista odznak w module pod przyciskiem
        if (commandName === 'profil') {
            await interaction.deferReply();
            const targetUser = interaction.options.getUser('uzytkownik') || interaction.user;
            let user = await UserModel.findOne({ userId: targetUser.id });
            if (!user) user = await UserModel.create({ userId: targetUser.id });

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`badge_mod_${targetUser.id}_0`)
                    .setLabel('Otwórz moduł odznak')
                    .setEmoji('🏆')
                    .setStyle(ButtonStyle.Primary)
            );

            return interaction.editReply({ embeds: [buildProfileEmbed(user, targetUser)], components: [row] });
        }

        // Komenda /odznaki — od razu otwiera pełny moduł odznak
        if (commandName === 'odznaki') {
            await interaction.deferReply();
            const targetUser = interaction.options.getUser('uzytkownik') || interaction.user;
            let user = await UserModel.findOne({ userId: targetUser.id });
            if (!user) user = await UserModel.create({ userId: targetUser.id });

            const view = buildBadgeModule(user, targetUser, 0);
            return interaction.editReply({ embeds: view.embeds, components: view.components });
        }

        // Komenda /exp
        if (commandName === 'exp') {
            await interaction.deferReply();
            const targetUser = interaction.options.getUser('uzytkownik') || interaction.user;
            let user = await UserModel.findOne({ userId: targetUser.id });
            if (!user) user = await UserModel.create({ userId: targetUser.id });

            const lvl = user.level || 1;
            const exp = user.exp || 0;
            const req = lvl * 150;
            const rankDetails = await getUserLevelRankDetails(targetUser.id);

            const embed = new EmbedBuilder()
                .setColor(0x3498DB)
                .setTitle(`⭐ Poziom i Doświadczenie • ${targetUser.tag}`)
                .setThumbnail(targetUser.displayAvatarURL())
                .setDescription(
                    `⭐ **Poziom:** \`${lvl}\`\n` +
                    `🎯 **Doświadczenie:** \`${exp} / ${req} XP\`\n` +
                    `🏆 **Miejsce w rankingu XP:** \`#${rankDetails.rank} z ${rankDetails.total}\``
                )
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        // Komenda /reputacja
        if (commandName === 'reputacja') {
            await interaction.deferReply();
            const targetUser = interaction.options.getUser('uzytkownik') || interaction.user;
            let user = await UserModel.findOne({ userId: targetUser.id });
            if (!user) user = await UserModel.create({ userId: targetUser.id });

            const rep = user.reputation || 0;
            const sign = rep > 0 ? '+' : '';

            const embed = new EmbedBuilder()
                .setColor(0xF1C40F)
                .setTitle(`⭐ Profil Handlowy i Reputacja • ${targetUser.tag}`)
                .setThumbnail(targetUser.displayAvatarURL())
                .setDescription(
                    `📊 **Punkty Reputacji Tradera:** \`${sign}${rep} pkt\`\n\n` +
                    `*Możesz ocenić innego tradera po wymianie na kanale <#${ID_KANAL_REPUTACJI}> za pomocą komendy:*\n` +
                    `\`+rep @użytkownik [powód]\` lub \`+reputacja @użytkownik\``
                )
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        // Komenda /ankieta
        if (commandName === 'ankieta') {
            await interaction.deferReply({ ephemeral: true });
            const pytanie = interaction.options.getString('pytanie', true);
            const opcjeRaw = interaction.options.getString('opcje', true);
            const czasStr = interaction.options.getString('czas', false);

            const options = opcjeRaw.split(',').map(o => o.trim()).filter(o => o.length > 0);
            if (options.length < 2 || options.length > 5) {
                return interaction.editReply({ content: '❌ Podaj od 2 do 5 opcji oddzielonych przecinkami!' });
            }

            let endsAtDate: Date | null = null;
            if (czasStr) {
                const now = Date.now();
                if (czasStr === '15m') endsAtDate = new Date(now + 15 * 60 * 1000);
                else if (czasStr === '1h') endsAtDate = new Date(now + 60 * 60 * 1000);
                else if (czasStr === '6h') endsAtDate = new Date(now + 6 * 60 * 60 * 1000);
                else if (czasStr === '24h') endsAtDate = new Date(now + 24 * 60 * 60 * 1000);
            }

            let timeInfo = endsAtDate ? `⏳ Koniec: <t:${Math.floor(endsAtDate.getTime() / 1000)}:R>` : '⏳ Ankieta bez limitu czasu';
            let desc = `📊 **Ankieta aktywna na żywo**\n${timeInfo}\n\n`;

            const components: ActionRowBuilder<ButtonBuilder>[] = [];
            let currentRow = new ActionRowBuilder<ButtonBuilder>();

            const votesArr: string[][] = [];
            for (let i = 0; i < options.length; i++) {
                votesArr.push([]);
                desc += `**${i + 1}.${options[i]}**\n\`[░░░░░░░░░░]\` **0%** (0 głosów)\n\n`;

                currentRow.addComponents(new ButtonBuilder().setCustomId(`poll_vote_${i}`).setLabel(`${i + 1} (0)`).setStyle(ButtonStyle.Secondary));
                if (currentRow.components.length === 5 || i === options.length - 1) {
                    components.push(currentRow);
                    currentRow = new ActionRowBuilder<ButtonBuilder>();
                }
            }

            const adminRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('poll_show_voters').setLabel('🔍 Kto głosował? (Admin)').setStyle(ButtonStyle.Primary)
            );
            components.push(adminRow);

            const embed = new EmbedBuilder().setColor(0x3498DB).setTitle(`🗳️ ${pytanie}`).setDescription(desc).setTimestamp();
            const sentMsg = await interaction.channel?.send({ embeds: [embed], components });

            if (sentMsg) {
                await PollModel.create({
                    messageId: sentMsg.id,
                    channelId: interaction.channelId,
                    question: pytanie,
                    options: options,
                    votes: votesArr,
                    ended: false,
                    endsAt: endsAtDate
                });
            }

            return interaction.editReply({ content: '✅ Pomyślnie utworzono interaktywną ankietę!' });
        }

        // Komenda /fn-sklep
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
                    .setDescription('Najnowsze przedmioty w sklepie Fortnite:')
                    .setImage(LIVE_IMAGE_URL)
                    .setTimestamp();

                if (data && data.status === 200 && data.data && data.data.entries) {
                    const entries = data.data.entries.slice(0, 10);
                    let desc = '';
                    for (const entry of entries) {
                        const rawName = entry.items?.[0]?.name || entry.bundle?.name || entry.devName || 'Przedmiot Fortnite';
                        const itemName = rawName.replace(/^\[VIRTUAL\]\d+\s*x\s*/i, '').trim();
                        const price = entry.finalPrice || entry.regularPrice || 'N/D';
                        desc += `• **${itemName}** — 🪙 \`${price} V-Bucks\`\n`;
                    }
                    embed.setDescription(desc);
                }

                return interaction.editReply({ embeds: [embed] });
            } catch (e) {
                return interaction.editReply({ content: '❌ Błąd podczas pobierania sklepu Fortnite.' });
            }
        }

        // Komenda /fn-mapa
        if (commandName === 'fn-mapa') {
            await interaction.deferReply();
            try {
                const res = await fetch('https://fortnite-api.com/v1/map');
                const data = await res.json() as any;
                if (data && data.status === 200 && data.data && data.data.images && data.data.images.pois) {
                    const embed = new EmbedBuilder()
                        .setColor(0x00D9FF)
                        .setTitle('🗺️ Aktualna Mapa Fortnite')
                        .setImage(data.data.images.pois)
                        .setTimestamp();
                    return interaction.editReply({ embeds: [embed] });
                }
                return interaction.editReply({ content: '❌ Nie udało się pobrać mapy Fortnite.' });
            } catch (e) {
                return interaction.editReply({ content: '❌ Błąd podczas pobierania mapy.' });
            }
        }

        // Komenda /fn-rejestracja
        if (commandName === 'fn-rejestracja') {
            await interaction.deferReply({ ephemeral: true });
            const nick = interaction.options.getString('nick', true);

            try {
                const res = await fetch(`https://fortnite-api.com/v2/stats/br/v2?name=${encodeURIComponent(nick)}`, {
                    headers: { 'Authorization': process.env.FORTNITE_API_KEY || '' }
                });
                const data = await res.json() as any;

                if (!data || data.status !== 200 || !data.data) {
                    return interaction.editReply({ content: `❌ Nie znaleziono gracza o nicku **${nick}** w bazie Fortnite lub konta są prywatne.` });
                }

                let user = await UserModel.findOne({ userId: interaction.user.id });
                if (!user) user = await UserModel.create({ userId: interaction.user.id });

                const overall = data.data.stats.all?.overall || {};
                user.epicNick = data.data.account.name;
                user.fortniteKills = overall.kills || 0;
                user.matchesPlayed = overall.matches || 0;
                user.estimatedPlaytimeHours = Math.round(user.matchesPlayed * 0.25);
                await user.save();

                await refreshFortniteRankingMessage(interaction.guild);

                return interaction.editReply({ content: `✅ Pomyślnie zarejestrowano nick Epic Games: **${user.epicNick}**!\nBot automatycznie pobrał Twoje statystyki zabójstw i zaktualizował ranking.` });
            } catch (e) {
                return interaction.editReply({ content: '❌ Wystąpił błąd podczas weryfikacji nicku Epic Games.' });
            }
        }

        // Komenda /daj-bonus-wygranych
        if (commandName === 'daj-bonus-wygranych') {
            if (!isAuthorized(interaction.user.id) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
            }
            await interaction.deferReply({ ephemeral: true });
            const targetUser = interaction.options.getUser('uzytkownik', true);

            let user = await UserModel.findOne({ userId: targetUser.id });
            if (!user) user = await UserModel.create({ userId: targetUser.id });

            user.guaranteedWinUntil = new Date(Date.now() + 30 * 60 * 1000);
            await user.save();

            return interaction.editReply({ content: `✅ Pomyślnie aktywowano 100% wygranych w kasynie na 30 minut dla <@${targetUser.id}>!` });
        }

        // Komenda /daj-karnet-premium
        if (commandName === 'daj-karnet-premium') {
            if (!isAuthorized(interaction.user.id) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
            }
            await interaction.deferReply({ ephemeral: true });
            const targetUser = interaction.options.getUser('uzytkownik', true);
            const revoke = interaction.options.getBoolean('odbierz') || false;

            const bp = await getOrCreateBattlePass(targetUser.id);

            if (revoke) {
                if (!bp.premium) {
                    return interaction.editReply({ content: `ℹ️ <@${targetUser.id}> nie ma aktywnego karnetu Premium.` });
                }
                bp.premium = false;
                await bp.save();
                console.log(`[BattlePass Admin] ${interaction.user.tag} odebrał karnet Premium graczowi ${targetUser.tag}.`);
                return interaction.editReply({ content: `✅ Odebrano karnet Premium graczowi <@${targetUser.id}>. Ścieżka Elitarna jest dla niego ponownie zablokowana.` });
            }

            if (bp.premium) {
                return interaction.editReply({ content: `ℹ️ <@${targetUser.id}> ma już aktywny karnet Premium (poziom ${bp.level} / 30).` });
            }

            bp.premium = true;
            await bp.save();
            console.log(`[BattlePass Admin] ${interaction.user.tag} nadał karnet Premium graczowi ${targetUser.tag}.`);

            // Powiadomienie na priv dla gracza (nie blokuje odpowiedzi, jeśli ma wyłączone DM)
            client.users.fetch(targetUser.id).then(u => u.send({
                content: `👑 **Administracja nadała Ci karnet Premium PJN Battle Pass!**\n\nKliknij **👑 Odbierz nagrody Elitarne** w panelu karnetu (<#${ID_KANALU_KARNETU}>), aby zgarnąć nagrody ze Ścieżki Elitarnej.`
            }).catch(() => {})).catch(() => {});

            return interaction.editReply({ content: `✅ Nadano karnet Premium graczowi <@${targetUser.id}>! Może teraz odbierać nagrody ze Ścieżki Elitarnej (poziom ${bp.level} / 30).` });
        }

        // Komenda /daj-wszystkim
        if (commandName === 'daj-wszystkim') {
            if (!isAuthorized(interaction.user.id) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
            }
            await interaction.deferReply({ ephemeral: true });
            const ilosc = interaction.options.getInteger('ilosc', true);
            const powod = interaction.options.getString('powod') || 'Bonus od administracji';

            await UserModel.updateMany({}, { $inc: { balance: ilosc } });

            return interaction.editReply({ content: `✅ Pomyślnie rozdano po **${ilosc} PJN-Coins** każdemu użytkownikowi w bazie! Powód: *${powod}*.` });
        }

        // Komenda /reset-ekonomii
        if (commandName === 'reset-ekonomii') {
            if (!isAuthorized(interaction.user.id) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
            }
            await interaction.deferReply({ ephemeral: true });
            await UserModel.updateMany({}, { balance: 0 });
            return interaction.editReply({ content: '⚠️ Zresetowano saldo PJN-Coins do 0 dla wszystkich użytkowników w bazie!' });
        }

        // Komenda /nowości
        if (commandName === 'nowości') {
            if (!isAuthorized(interaction.user.id) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
            }
            await interaction.deferReply({ ephemeral: true });
            const tytul = interaction.options.getString('tytul', true);
            const coNowego = interaction.options.getString('co_nowego', true);

            const channel = await interaction.guild?.channels.fetch(ANNOUNCE_CHANNEL_ID).catch(() => null) as TextChannel;
            if (!channel) return interaction.editReply({ content: '❌ Kanał ogłoszeń nie został znaleziony.' });

            const embed = new EmbedBuilder()
                .setColor(0x00D9FF)
                .setTitle(`🚀 NOWOŚCI NA SERWERZE: ${tytul}`)
                .setDescription(coNowego)
                .setImage(LIVE_IMAGE_URL)
                .setTimestamp()
                .setFooter({ text: 'PJN System Aktualizacji' });

            await channel.send({ content: '@everyone Sprawdź najnowsze zmiany na serwerze!', embeds: [embed], allowedMentions: { parse: ['everyone'] } });
            return interaction.editReply({ content: '✅ Pomyślnie opublikowano ogłoszenie o nowościach!' });
        }

        // Komenda /ogloszenie-techniczne
        if (commandName === 'ogloszenie-techniczne') {
            if (!isAuthorized(interaction.user.id) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
            }
            await interaction.deferReply({ ephemeral: true });
            const tytul = interaction.options.getString('tytul', true);
            const opis = interaction.options.getString('opis', true);

            const channel = await interaction.guild?.channels.fetch(ANNOUNCE_CHANNEL_ID).catch(() => null) as TextChannel;
            if (!channel) return interaction.editReply({ content: '❌ Kanał ogłoszeń nie został znaleziony.' });

            const embed = new EmbedBuilder()
                .setColor(0xE74C3C)
                .setTitle(`⚠️ PRZERWA TECHNICZNA / OGŁOSZENIE: ${tytul}`)
                .setDescription(opis)
                .setImage(LIVE_IMAGE_URL)
                .setTimestamp()
                .setFooter({ text: 'PJN Ogłoszenie Techniczne' });

            await channel.send({ content: '@everyone Ważny komunikat techniczny!', embeds: [embed], allowedMentions: { parse: ['everyone'] } });
            return interaction.editReply({ content: '✅ Pomyślnie opublikowano ogłoszenie techniczne!' });
        }

        // Komenda /odpalstream
        if (commandName === 'odpalstream') {
            if (!isAuthorized(interaction.user.id) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
            }
            await interaction.deferReply({ ephemeral: true });
            const tytul = interaction.options.getString('tytul', true);
            const link = interaction.options.getString('link', true);

            await sendNotification('languspjn', 'twitch', tytul, link);
            return interaction.editReply({ content: '✅ Pomyślnie ogłoszono start streama!' });
        }

        // Komenda /zakonczstream
        if (commandName === 'zakonczstream') {
            if (!isAuthorized(interaction.user.id) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
            }
            await interaction.deferReply({ ephemeral: true });
            twitchLiveStatus['languspjn'] = false;
            return interaction.editReply({ content: '✅ Zaktualizowano status streamu na offline.' });
        }

        // Komenda /powiadomienie
        if (commandName === 'powiadomienie') {
            if (!isAuthorized(interaction.user.id) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
            }
            await interaction.deferReply({ ephemeral: true });
            const tworca = interaction.options.getString('tworca', true) as 'languspjn' | 'elladermusic';
            const platforma = interaction.options.getString('platforma', true) as 'twitch' | 'youtube' | 'tiktok';
            const tytul = interaction.options.getString('tytul', true);
            const link = interaction.options.getString('link', true);

            await sendNotification(tworca, platforma, tytul, link);
            return interaction.editReply({ content: '✅ Pomyślnie wysłano powiadomienie do obserwujących!' });
        }

        // Komenda /daj-odznake
        if (commandName === 'daj-odznake') {
            if (!isAuthorized(interaction.user.id) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
            }
            await interaction.deferReply({ ephemeral: true });
            const targetUser = interaction.options.getUser('uzytkownik', true);
            const badgeName = interaction.options.getString('odznaka', true);

            let user = await UserModel.findOne({ userId: targetUser.id });
            if (!user) user = await UserModel.create({ userId: targetUser.id });

            if (!user.badges.includes(badgeName)) {
                user.badges.push(badgeName);
                await user.save();
            }

            return interaction.editReply({ content: `✅ Pomyślnie przyznano odznakę **${badgeName}** dla <@${targetUser.id}>!` });
        }

        // Komenda /zabierz-odznake
        if (commandName === 'zabierz-odznake') {
            if (!isAuthorized(interaction.user.id) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
            }
            await interaction.deferReply({ ephemeral: true });
            const targetUser = interaction.options.getUser('uzytkownik', true);
            const badgeName = interaction.options.getString('odznaka', true);

            let user = await UserModel.findOne({ userId: targetUser.id });
            if (!user) return interaction.editReply({ content: '❌ Użytkownik nie istnieje w bazie.' });

            user.badges = user.badges.filter(b => b !== badgeName);
            await user.save();

            return interaction.editReply({ content: `✅ Pomyślnie odebrano odznakę **${badgeName}** użytkownikowi <@${targetUser.id}>.` });
        }

        // Komenda /dajpunkty
        if (commandName === 'dajpunkty') {
            if (!isAuthorized(interaction.user.id) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
            }
            await interaction.deferReply({ ephemeral: true });
            const targetUser = interaction.options.getUser('uzytkownik', true);
            const ilosc = interaction.options.getInteger('ilosc', true);
            const powod = interaction.options.getString('powod') || 'Nagroda od administracji';

            let user = await UserModel.findOne({ userId: targetUser.id });
            if (!user) user = await UserModel.create({ userId: targetUser.id });

            user.balance += ilosc;
            await user.save();

            await TransactionHistoryModel.create({
                userId: interaction.user.id,
                targetUserId: targetUser.id,
                type: 'admin_add',
                amount: ilosc,
                details: powod
            });

            await sendCoinsNotification(targetUser.id, ilosc, interaction.user.tag, powod);

            return interaction.editReply({ content: `✅ Dodano **${ilosc} PJN-Coins** dla <@${targetUser.id}>. Powód: *${powod}*.` });
        }

        // Komenda /zabierzpunkty
        if (commandName === 'zabierzpunkty') {
            if (!isAuthorized(interaction.user.id) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
            }
            await interaction.deferReply({ ephemeral: true });
            const targetUser = interaction.options.getUser('uzytkownik', true);
            const ilosc = interaction.options.getInteger('ilosc', true);

            let user = await UserModel.findOne({ userId: targetUser.id });
            if (!user) user = await UserModel.create({ userId: targetUser.id });

            user.balance = Math.max(0, user.balance - ilosc);
            await user.save();

            await TransactionHistoryModel.create({
                userId: interaction.user.id,
                targetUserId: targetUser.id,
                type: 'admin_remove',
                amount: -ilosc,
                details: 'Zabrane przez administrację'
            });

            return interaction.editReply({ content: `✅ Zabrano **${ilosc} PJN-Coins** użytkownikowi <@${targetUser.id}>.` });
        }

        // Komenda /cytat
        if (commandName === 'cytat') {
            await interaction.deferReply();
            const count = await QuoteModel.countDocuments();
            if (count === 0) return interaction.editReply({ content: '❌ Brak cytatów w bazie.' });

            const random = Math.floor(Math.random() * count);
            const quote = await QuoteModel.findOne().skip(random);
            if (!quote) return interaction.editReply({ content: '❌ Nie znaleziono cytatu.' });

            const embed = new EmbedBuilder()
                .setColor(0xE67E22)
                .setTitle('✨ Losowy Cytat z Serwera PJN')
                .setDescription(`> *„${quote.text}”*\n\n**—${quote.author}**`)
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        // Komenda /dodaj-cytat
        if (commandName === 'dodaj-cytat') {
            await interaction.deferReply({ ephemeral: true });
            const tekst = interaction.options.getString('tekst', true);
            const autor = interaction.options.getString('autor', true);

            await QuoteModel.create({ text: tekst, author: autor, addedBy: interaction.user.id });

            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) user = await UserModel.create({ userId: interaction.user.id });
            user.quotesAdded = (user.quotesAdded || 0) + 1;
            await user.save();
            const member = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
            await checkAndAwardBadges(user, member, interaction.guild);

            return interaction.editReply({ content: `✅ Pomyślnie dodano nowy cytat do bazy serwerowej!` });
        }

        // Komenda /mem
        if (commandName === 'mem') {
            await interaction.deferReply();
            const templateId = interaction.options.getString('szablon', true);
            const topText = interaction.options.getString('gora') || '';
            const bottomText = interaction.options.getString('dol') || '';

            try {
                const params = new URLSearchParams();
                params.append('template_id', templateId);
                params.append('username', process.env.IMGFLIP_USERNAME || 'testuser_pjn');
                params.append('password', process.env.IMGFLIP_PASSWORD || 'testpassword');
                params.append('text0', topText);
                params.append('text1', bottomText);

                const res = await fetch('https://api.imgflip.com/caption_image', {
                    method: 'POST',
                    body: params
                });
                const data = await res.json() as any;

                if (data && data.success && data.data && data.data.url) {
                    const embed = new EmbedBuilder()
                        .setColor(0xE74C3C)
                        .setTitle('🖼️ Wygenerowany Mem')
                        .setImage(data.data.url)
                        .setTimestamp()
                        .setFooter({ text: `Autor: ${interaction.user.tag}` });

                    return interaction.editReply({ embeds: [embed] });
                } else {
                    return interaction.editReply({ content: '❌ Nie udało się wygenerować mema przez API Imgflip.' });
                }
            } catch (e) {
                return interaction.editReply({ content: '❌ Wystąpił błąd podczas generowania mema.' });
            }
        }

        // Komenda /szukam (LFG)
        if (commandName === 'szukam') {
            await interaction.deferReply();
            const gameKey = interaction.options.getString('gra', true);
            const maxPlayers = interaction.options.getInteger('osoby', true);
            const description = interaction.options.getString('opis') || 'Brak opisu';

            const gameInfo = LFG_CONFIG.GAMES[gameKey as keyof typeof LFG_CONFIG.GAMES];
            const roleMention = `<@&${gameInfo.roleId}>`;

            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle(`${gameInfo.emoji} Szukanie Ekipy: ${gameInfo.name} 🟢 [AKTYWNE]`)
                .setDescription(
                    `👤 **Organizator:** <@${interaction.user.id}>\n` +
                    `👥 **Skład:** 1 / ${maxPlayers} osób\n` +
                    `📝 **Opis:** ${description}\n\n` +
                    `📋 **Aktualni członkowie:**\n• <@${interaction.user.id}>`
                )
                .setTimestamp();

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('lfg_join').setLabel('Dołącz do ekipy').setStyle(ButtonStyle.Success).setEmoji('➕'),
                new ButtonBuilder().setCustomId('lfg_leave').setLabel('Opuść').setStyle(ButtonStyle.Danger).setEmoji('➖'),
                new ButtonBuilder().setCustomId('lfg_create_voice').setLabel('🎙️ Utwórz pokój').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('lfg_close').setLabel('Zamknij ogłoszenie').setStyle(ButtonStyle.Secondary).setEmoji('🔒')
            );

            const channel = interaction.channel as TextChannel;
            const sentMsg = await channel.send({
                content: `${roleMention} Nowe ogłoszenie LFG od <@${interaction.user.id}>!`,
                embeds: [embed],
                components: [row],
                allowedMentions: { roles: [gameInfo.roleId] }
            });

            await LFGModel.create({
                messageId: sentMsg.id,
                channelId: channel.id,
                authorId: interaction.user.id,
                game: gameKey,
                maxPlayers: maxPlayers,
                currentPlayers: [interaction.user.id],
                description: description,
                status: 'active'
            });

            return interaction.editReply({ content: '✅ Twoje ogłoszenie LFG zostało pomyślnie utworzone!' });
        }
    } catch (err) {
        console.error('Błąd podczas obsługi interakcji:', err);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: '❌ Wystąpił krytyczny błąd podczas wykonywania tej komendy.' }).catch(() => {});
        } else {
            await interaction.reply({ content: '❌ Wystąpił krytyczny błąd podczas wykonywania tej komendy.', ephemeral: true }).catch(() => {});
        }
    }
});

function embedBuilderToEmbed(embedData: any) {
    return new EmbedBuilder()
        .setColor(embedData.color)
        .setTitle(embedData.title)
        .setDescription(embedData.description);
}

// Uruchomienie bota
client.login(token);
