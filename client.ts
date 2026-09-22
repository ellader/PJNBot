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
    TextInputStyle
} from 'discord.js';
import mongoose from 'mongoose';
import cron from 'node-cron';
import Parser from 'rss-parser';
import { GoogleGenAI } from '@google/genai';
import http from 'http';

// === INICJALIZACJA GEMINI AI ===
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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

const repCooldownSchema = new mongoose.Schema({
    giverId: { type: String, required: true },
    receiverId: { type: String, required: true },
    lastGiven: { type: Date, required: true }
});
const RepCooldownModel = mongoose.model('RepCooldown', repCooldownSchema);

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
        rssUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=TUTAJ_WKLEJ_ID_LANGUSPJN'
    },
    elladermusic: {
        channelId: '1542101962185646111',
        rssUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=TUTAJ_WKLEJ_ID_ELLADER'
    },
    leaveLogChannelId: '1542102521814712371'
};
const parser = new Parser();

const ANNOUNCE_CHANNEL_ID = '1532399010785263799';
const ID_KANALU_CYTATY = '1534780578912665653'; 
const ID_KANALU_ZLOTE_MYSLI = '1549709251365183558'; 
const ID_KANALU_MEMOW = '1534833819599769640'; 
const ID_KANALU_SZUKAM_DO_GRY = '1532449084559069214'; 
const ID_KANALU_POKAZ_SIEBIE = '1536365057997283469'; 
const ID_KANAL_AI_GEMINI = '1550780827259113515'; 
const CHANNEL_POWITANIA = "witamy";
const ID_KANALU_DUSZKI = "1532977723843285112"; 
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

async function askGemini(promptText: string): Promise<string> {
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-3.8-flash',
                contents: promptText,
                config: {
                    systemInstruction: "Jesteś pomocnym, inteligentnym i lekko dowcipnym asystentem AI na serwerze Discord społeczności PJN. Odpowiadaj w języku polskim w sposób zwięzły, konkretny i czytelny dla graczy.",
                }
            });
            return response.text || "Otrzymałem pustą odpowiedź od modelu AI.";
        } catch (error: any) {
            if (attempt === maxRetries) {
                return `⚠️ Przepraszam, serwery AI są obecnie mocno obciążone. Spróbuj ponownie za chwilę!`;
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    return `Przepraszam, moduł AI napotkał błąd techniczny.`;
}

const QUIZ_POOL = [
    { q: 'Jakie miasto jest stolicą Polski?', correct: 'Warszawa', wrong1: 'Kraków', wrong2: 'Gdańsk' },
    { q: 'Która gra posiada tryb Battle Royale z budowaniem?', correct: 'Fortnite', wrong1: 'CS2', wrong2: 'Minecraft' },
    { q: 'Jaka waluta obowiązuje na tym serwerze Discord?', correct: 'PJN-Coins', wrong1: 'V-Bucks', wrong2: 'Dolar' },
    { q: 'Ile komór ma bębnek w klasycznym rewolwerze w Rosyjskiej Ruletce?', correct: '6 komór', wrong1: '4 komory', wrong2: '8 komor' },
    { q: 'Kto jest głównym twórcą i streamerem projektu PJN?', correct: 'LangusPJN', wrong1: 'ellader', wrong2: 'Moderator' },
    { q: 'Na jakiej platformie najczęściej odbywają się główne transmisje?', correct: 'Kick / TikTok', wrong1: 'Netflix', wrong2: 'Spotify' },
    { q: 'Jaki przedmiot w sklepie serwerowym daje bonus 2x za wiadomości?', correct: 'Rola VIP', wrong1: 'Odznaka', wrong2: 'Bilet duszka' },
    { q: 'Do jakiej kategorii gier należy Counter-Strike 2?', correct: 'Strzelanka (FPS)', wrong1: 'Strategia', wrong2: 'MMORPG' }
];

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
    } catch (e) {}
}

async function updateServerStats(guild: any) {
    try {
        await guild.members.fetch().catch(() => {});
        const onlineCount = guild.members.cache.filter((m: any) => m.presence && m.presence.status !== 'offline').size;
        const onlineChannel = guild.channels.cache.get(STATS_CHANNELS.ONLINE);
        if (onlineChannel && onlineChannel.isVoiceBased()) {
            await onlineChannel.setName(`🟢 Online: ${onlineCount}`).catch(() => {});
        }
        const totalUsers = guild.memberCount;
        const usersChannel = guild.channels.cache.get(STATS_CHANNELS.USERS);
        if (usersChannel && usersChannel.isVoiceBased()) {
            await usersChannel.setName(`👥 PJN Users: ${totalUsers}`).catch(() => {});
        }
    } catch (err) {}
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
        .setDescription(`> *„${quote.text}”*\n\n**— ${quote.author}**`)
        .setTimestamp()
        .setFooter({ text: 'PJN Codzienne Cytaty' });

    await channel.send({ content: '@everyone Życiowa myśl na dzisiejszy poranek:', embeds: [embed], allowedMentions: { parse: ['everyone'] } }).catch(() => {});
    return true;
}

function startDailyQuotes() {
    cron.schedule('30 3 * * *', async () => {
        try { await sendQuoteToChannel(ID_KANALU_CYTATY); } catch (err) {}
    });
}

const commands = [
    new SlashCommandBuilder().setName('portfel').setDescription('Sprawdź stan swoich PJN-Coins w portfelu'),
    new SlashCommandBuilder().setName('sklep').setDescription('Otwórz podgląd sklepu i sprawdź swoje środki'),
    new SlashCommandBuilder().setName('moje-przedmioty').setDescription('Sprawdź swoje aktywne przedmioty z sklepu i czas ich wygaśnięcia'),
    new SlashCommandBuilder().setName('historia-sklepu').setDescription('Wyświetl historię zakupów (Admin)').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('historia-transakcji').setDescription('Wyświetl historię przelewów i wygranych w kasynie (Admin)').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('topka').setDescription('Zobacz ranking najbogatszych graczy'),
    new SlashCommandBuilder().setName('ustaw-topke').setDescription('Ustaw ten kanał jako ranking (Admin)').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('ustaw-odznaki').setDescription('Ustaw ten kanał jako centrum odznak (Admin)').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('daily').setDescription('Odbieraj codzienne 100 PJN-Coins'),
    new SlashCommandBuilder().setName('przelej').setDescription('Przelewa PJN-Coins').addUserOption(o => o.setName('uzytkownik').setDescription('Komu').setRequired(true)).addIntegerOption(o => o.setName('kwota').setDescription('Ile').setRequired(true)),
    new SlashCommandBuilder().setName('kostka').setDescription('Rzuć kością').addIntegerOption(o => o.setName('stawka').setDescription('Stawka').setRequired(true)),
    new SlashCommandBuilder().setName('moneta').setDescription('Orzeł czy reszka').addStringOption(o => o.setName('wybor').setDescription('Wybór').setRequired(true).addChoices({name: 'Orzeł', value: 'orzel'}, {name: 'Reszka', value: 'reszka'})).addIntegerOption(o => o.setName('stawka').setDescription('Stawka').setRequired(true)),
    new SlashCommandBuilder().setName('slot').setDescription('Sloty').addIntegerOption(o => o.setName('stawka').setDescription('Stawka').setRequired(true)),
    new SlashCommandBuilder().setName('poker').setDescription('Poker').addStringOption(o => o.setName('tryb').setDescription('Tryb').setRequired(true).addChoices({name: 'Z ludźmi', value: 'ludzie'}, {name: 'Z botem', value: 'bot'})).addIntegerOption(o => o.setName('stawka').setDescription('Stawka').setRequired(true)),
    new SlashCommandBuilder().setName('quiz').setDescription('Odpowiedz na pytanie quizowe'),
    new SlashCommandBuilder().setName('quiz-gra').setDescription('Rozpocznij interaktywny quiz z przyciskami i nagrodami coins'),
    new SlashCommandBuilder().setName('kpn').setDescription('Zagraj w Kamień, Papier, Nożyce za PJN-Coins').addStringOption(o => o.setName('wybor').setDescription('Twój wybór').setRequired(true).addChoices({ name: 'Kamień 🪨', value: 'kamien' }, { name: 'Papier 📄', value: 'papier' }, { name: 'Nożyce ✂️', value: 'nozyce' })).addIntegerOption(o => o.setName('stawka').setDescription('Stawka PJN-Coins').setRequired(true)),
    new SlashCommandBuilder().setName('odznaki').setDescription('Wyświetla profil z odznakami').addUserOption(o => o.setName('uzytkownik').setDescription('Użytkownik').setRequired(false)),
    new SlashCommandBuilder().setName('exp').setDescription('Sprawdź swój aktualny poziom, exp oraz brakujące punkty do awansu').addUserOption(o => o.setName('uzytkownik').setDescription('Sprawdź profil innego użytkownika').setRequired(false)),
    new SlashCommandBuilder().setName('reputacja').setDescription('Wyświetla profil handlowy i punkty reputacji tradera').addUserOption(o => o.setName('uzytkownik').setDescription('Sprawdź profil innego użytkownika').setRequired(false)),
    new SlashCommandBuilder().setName('profil').setDescription('Kompleksowa karta profilu gracza z poziomem, odznakami i statystykami').addUserOption(o => o.setName('uzytkownik').setDescription('Użytkownik').setRequired(false)),
    new SlashCommandBuilder().setName('ai').setDescription('Zadaj pytanie sztucznej inteligencji PJN AI').addStringOption(o => o.setName('pytanie').setDescription('Twoje pytanie do sztucznej inteligencji').setRequired(true)),
    new SlashCommandBuilder().setName('ankieta').setDescription('Stwórz interaktywną ankietę na żywo').addStringOption(o => o.setName('pytanie').setDescription('Treść pytania ankiety').setRequired(true)).addStringOption(o => o.setName('opcje').setDescription('Opcje oddzielone przecinkami').setRequired(true)).addStringOption(o => o.setName('czas').setDescription('Czas trwania').setRequired(false).addChoices({ name: '15 minut', value: '15m' }, { name: '1 godzina', value: '1h' }, { name: '6 godzin', value: '6h' }, { name: '24 godziny', value: '24h' })).setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    new SlashCommandBuilder().setName('fn-sklep').setDescription('Wyświetla dzisiejszy sklep w grze Fortnite'),
    new SlashCommandBuilder().setName('fn-stats').setDescription('Sprawdza statystyki gracza w Fortnite').addStringOption(o => o.setName('nick').setDescription('Nazwa użytkownika Epic Games').setRequired(false)).addStringOption(o => o.setName('id').setDescription('Epic Account ID').setRequired(false)),
    new SlashCommandBuilder().setName('fn-mapa').setDescription('Wyświetla aktualną mapę Fortnite'),
    new SlashCommandBuilder().setName('fn-rejestracja').setDescription('Zarejestruj swój nick Epic Games').addStringOption(o => o.setName('nick').setDescription('Twój dokładny nick z Epic Games').setRequired(true)),
    new SlashCommandBuilder().setName('fn-top').setDescription('Ręcznie wymuś odświeżenie i wyświetlenie rankingów zabójstw Fortnite'),
    new SlashCommandBuilder().setName('daj-bonus-wygranych').setDescription('Aktywuje 100% wygranych w kasynie na 30 minut (Admin)').addUserOption(o => o.setName('uzytkownik').setDescription('Gracz').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('daj-wszystkim').setDescription('Rozdaje PJN-Coins każdemu użytkownikowi (Admin)').addIntegerOption(o => o.setName('ilosc').setDescription('Ile').setRequired(true)).addStringOption(o => o.setName('powod').setDescription('Powód').setRequired(false)).setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('reset-ekonomii').setDescription('Resetuje stan wszystkich PJN-Coins do 0 (Admin)').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('nowości').setDescription('Wyślij ogłoszenie o nowościach (Admin)').addStringOption(o => o.setName('tytul').setDescription('Tytuł').setRequired(true)).addStringOption(o => o.setName('co_nowego').setDescription('Opis').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('odpalstream').setDescription('Ogłasza start streama (Streamer/Admin)').addStringOption(o => o.setName('tytul').setDescription('Tytuł').setRequired(true)).addStringOption(o => o.setName('link').setDescription('Link').setRequired(true)),
    new SlashCommandBuilder().setName('zakonczstream').setDescription('Ogłasza zakończenie streama (Streamer/Admin)'),
    new SlashCommandBuilder().setName('powiadomienie').setDescription('Ręcznie wyślij powiadomienie (YouTube / TikTok)').addStringOption(opt => opt.setName('tworca').setDescription('Twórca').setRequired(true).addChoices({ name: 'LangusPJN', value: 'languspjn' }, { name: 'elladerMusic', value: 'elladermusic' })).addStringOption(opt => opt.setName('platforma').setDescription('Platforma').setRequired(true).addChoices({ name: 'YouTube 🎥', value: 'youtube' }, { name: 'TikTok 🎬', value: 'tiktok' })).addStringOption(opt => opt.setName('tytul').setDescription('Tytuł').setRequired(true)).addStringOption(opt => opt.setName('link').setDescription('Link').setRequired(true)).addStringOption(opt => opt.setName('miniatura').setDescription('Miniatura').setRequired(false)).setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('daj-odznake').setDescription('Przyznaj odznakę (Admin)').addUserOption(o => o.setName('uzytkownik').setDescription('Komu').setRequired(true)).addStringOption(o => o.setName('odznaka').setDescription('Nazwa odznaki').setRequired(true).setAutocomplete(true)),
    new SlashCommandBuilder().setName('zabierz-odznake').setDescription('Odbierz odznakę (Admin)').addUserOption(o => o.setName('uzytkownik').setDescription('Komu').setRequired(true)).addStringOption(o => o.setName('odznaka').setDescription('Nazwa').setRequired(true).setAutocomplete(true)),
    new SlashCommandBuilder().setName('dajpunkty').setDescription('Daj punkty użytkownikowi').addUserOption(o => o.setName('uzytkownik').setDescription('User').setRequired(true)).addIntegerOption(o => o.setName('ilosc').setDescription('Ilość').setRequired(true)).addStringOption(o => o.setName('powod').setDescription('Powód').setRequired(false)),
    new SlashCommandBuilder().setName('zabierzpunkty').setDescription('Zabierz punkty').addUserOption(o => o.setName('uzytkownik').setDescription('User').setRequired(true)).addIntegerOption(o => o.setName('ilosc').setDescription('Ilość').setRequired(true)),
    new SlashCommandBuilder().setName('cytat').setDescription('Wyślij cytat'),
    new SlashCommandBuilder().setName('dodaj-cytat').setDescription('Dodaj cytat').addStringOption(o => o.setName('tekst').setDescription('Tekst').setRequired(true)).addStringOption(o => o.setName('autor').setDescription('Autor').setRequired(true)),
    new SlashCommandBuilder().setName('mem').setDescription('Generuje mema').addStringOption(o => o.setName('szablon').setDescription('Szablon').setRequired(true).setAutocomplete(true)).addStringOption(o => o.setName('gora').setDescription('Góra').setRequired(false)).addStringOption(o => o.setName('dol').setDescription('Dół').setRequired(false)),
    new SlashCommandBuilder().setName('szukam').setDescription('Stwórz ogłoszenie LFG').addStringOption(option => option.setName('gra').setDescription('Gra').setRequired(true).addChoices({ name: 'Fortnite', value: 'fortnite' }, { name: 'CS2', value: 'cs2' }, { name: 'Minecraft', value: 'minecraft' }, { name: 'GTA V', value: 'gta' }, { name: 'Valorant', value: 'valorant' }, { name: 'LoL', value: 'lol' })).addIntegerOption(option => option.setName('osoby').setDescription('Maks. osób').setRequired(true).setMinValue(2).setMaxValue(10)).addStringOption(option => option.setName('opis').setDescription('Opis').setRequired(false)),
    new ContextMenuCommandBuilder().setName('Zapisz jako złoty tekst').setType(ApplicationCommandType.Message)
].map(c => c.toJSON());

client.once('ready', async () => {
    console.log(`✅ Zalogowano jako ${client.user?.tag}!`);

    // Bezpieczna i szybka rejestracja komend globalnych (nie zawiesza WebSocket)
    try {
        const rest = new REST({ version: '10' }).setToken(token);
        await rest.put(Routes.applicationCommands(client.user!.id), { body: commands });
        console.log('✅ Komendy ukośnikowe zostały pomyślnie zarejestrowane!');
    } catch (e) {
        console.error('❌ Błąd rejestracji komend:', e);
    }

    // Inicjalizacja funkcji wtle (asynchroniczna)
    setTimeout(async () => {
        try {
            await seedQuotesIfNeeded();
            startServerStatsCron();
            startDailyQuotes();
        } catch (initErr) {
            console.error('Błąd inicjalizacji zadań w tle:', initErr);
        }
    }, 3000);
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
                    .setDescription(`> *„${quoteText}”*\n\n**— ${authorTag}**`)
                    .setTimestamp();
                await channel.send({ embeds: [embed] }).catch(() => {});
            }
            return interaction.editReply({ content: `✅ Pomyślnie dodano wiadomość do **Złotych myśli**!` });
        }
    }

    if (!interaction.isChatInputCommand()) return;
    const { commandName } = interaction;

    try {
        if (commandName === 'ai') {
            await interaction.deferReply();
            const question = interaction.options.getString('pytanie', true);
            const aiResponseText = await askGemini(question);
            const embed = new EmbedBuilder()
                .setColor(0x00D9FF)
                .setTitle('🤖 Odpowiedź PJN AI')
                .setDescription(`> **Pytanie:** *${question}*\n\n${aiResponseText}`)
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        if (commandName === 'portfel') {
            await interaction.deferReply({ ephemeral: true });
            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) user = await UserModel.create({ userId: interaction.user.id });
            return interaction.editReply({ content: `💰 Posiadasz **${user.balance} PJN-Coins!**` });
        }

        if (commandName === 'daily') {
            await interaction.deferReply();
            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) user = await UserModel.create({ userId: interaction.user.id });

            const now = new Date();
            if (user.lastDaily) {
                const diffTime = now.getTime() - new Date(user.lastDaily).getTime();
                const twentyFourHours = 24 * 60 * 60 * 1000;
                if (diffTime < twentyFourHours) {
                    const timeLeft = twentyFourHours - diffTime;
                    const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
                    const minsLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                    return interaction.editReply({ content: `⏳ Codzienną nagrodę możesz odebrać za **${hoursLeft}h ${minsLeft}m**!` });
                }
            }

            user.balance += 100;
            user.lastDaily = now;
            await user.save();
            return interaction.editReply({ content: `🎁 Otrzymałeś codzienne **100 PJN-Coins**!` });
        }

    } catch (error) {
        console.error('Błąd komendy:', error);
    }
});

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running 24/7!\n');
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Serwer HTTP nasłuchuje na porcie ${PORT}`);
});

console.log('🔄 Wywołuję client.login()...');
client.login(token).catch(err => {
    console.error('❌ BŁĄD PODCZAS LOGOWANIA BOTA DO DISCORDA:', err);
});
