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

// === SCHEMAT DLA POKOI POKERA (MULTIPLAYER) ===
const pokerLobbySchema = new mongoose.Schema({
    messageId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true },
    hostId: { type: String, required: true },
    stake: { type: Number, required: true },
    players: { type: [String], required: true },
    status: { type: String, default: 'waiting' }, // waiting, finished
    createdAt: { type: Date, default: Date.now }
});
const PokerLobbyModel = mongoose.model('PokerLobby', pokerLobbySchema);

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
    leaveLogChannelId: '1542102521814712371',
    freeGamesChannelId: '1551606555533910189' // Kanał na darmowe gry Epic i Steam
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

// === FUNKCJA POBIERANIA DARMOWYCH GIER (EPIC GAMES & STEAM) ===
async function postFreeGamesToChannel() {
    try {
        const channel = await client.channels.fetch(NOTIF_CONFIG.freeGamesChannelId).catch(() => null) as TextChannel;
        if (!channel) return;

        // Czyszczenie starego podsumowania bota
        const messages = await channel.messages.fetch({ limit: 20 }).catch(() => null);
        if (messages) {
            for (const [_, msg] of messages) {
                if (msg.author.id === client.user?.id) {
                    await msg.delete().catch(() => {});
                }
            }
        }

        // 1. POBIERANIE Z EPIC GAMES
        const epicRes = await fetch('https://store-site-backend-static-ipv4.ak.epicgames.com/freeGamesPromotions?locale=pl&country=PL&allowCountries=PL');
        const epicData = await epicRes.json() as any;
        const epicElements = epicData?.data?.Catalog?.searchStore?.elements || [];

        let epicDesc = 'Aktualnie darmowe gry w Epic Games Store:\n\n';
        let epicCount = 0;

        for (const element of epicElements) {
            const promotions = element.promotions?.promotionalOffers;
            const upcomingPromotions = element.promotions?.upcomingPromotionalOffers;
            
            let isFreeNow = false;
            if (promotions && promotions.length > 0) {
                for (const promoGroup of promotions) {
                    for (const offer of promoGroup.promotionalOffers || []) {
                        const start = new Date(offer.startDate).getTime();
                        const end = new Date(offer.endDate).getTime();
                        const now = Date.now();
                        if (now >= start && now <= end && (offer.discountSetting?.discountPercentage === 0)) {
                            isFreeNow = true;
                        }
                    }
                }
            }

            if (isFreeNow) {
                const title = element.title || 'Darmowa gra';
                const desc = element.description || 'Brak opisu.';
                const slug = element.productSlug || element.urlSlug || '';
                const link = `https://store.epicgames.com/pl/p/${slug}`;
                epicDesc += `🎮 **[${title}](${link})**\n> *${desc}*\n\n`;
                epicCount++;
            }
        }

        if (epicCount === 0) {
            epicDesc += '• W tej chwili brak nowych darmowych gier lub trwa zmiana oferty w Epic Games Store.';
        }

        const epicEmbed = new EmbedBuilder()
            .setColor(0x0078F2)
            .setTitle('🎁 Darmowe Gry w Epic Games Store')
            .setDescription(epicDesc)
            .setImage(LIVE_IMAGE_URL)
            .setTimestamp()
            .setFooter({ text: 'PJN Darmowe Gry • Epic Games' });

        // 2. POBIERANIE ZE STEAM (Przez oficjalne / publiczne zapytania)
        const steamRes = await fetch('https://store.steampowered.com/search/results/?query&specials=1&maxprice=free&cc=PL&json=1');
        const steamData = await steamRes.json() as any;
        
        let steamDesc = 'Aktualne promocje i darmowe gry na Steam:\n\n';
        if (steamData && steamData.items && steamData.items.length > 0) {
            const freeItems = steamData.items.slice(0, 5);
            for (const item of freeItems) {
                steamDesc += `🎮 **[${item.name}](${item.url})**\n> 💰 Cena: ~~${item.original_price || 'Płatna'}~~ ➔ **DARMOWA / PROMOCJA**\n\n`;
            }
        } else {
            steamDesc += '• Sprawdź aktualne darmowe pakiety i gry bezpośrednio na platformie Steam:\n[Otwórz Steam - Darmowe gry](https://store.steampowered.com/search/?maxprice=free&specials=1)';
        }

        const steamEmbed = new EmbedBuilder()
            .setColor(0x1B2838)
            .setTitle('🎁 Darmowe Gry i Promocje na Steam')
            .setDescription(steamDesc)
            .setImage(LIVE_IMAGE_URL)
            .setTimestamp()
            .setFooter({ text: 'PJN Darmowe Gry • Steam Store' });

        await channel.send({ content: '@everyone Świeże zestawienie darmowych gier z platform Epic Games oraz Steam!', embeds: [epicEmbed, steamEmbed], allowedMentions: { parse: ['everyone'] } });

    } catch (e) {
        console.error('Błąd podczas pobierania darmowych gier:', e);
    }
}

function startFreeGamesCron() {
    // Raz dziennie o 12:00 automatycznie aktualizuje i wysyła listę
    cron.schedule('0 12 * * *', async () => {
        await postFreeGamesToChannel();
    });
}

// === BEZPIECZNA FUNKCJA ASK GEMINI Z AUTOMATYCZNYM PONAWIANIEM (RETRY) ===
async function askGemini(promptText: string): Promise<string> {
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`[AI] Wysyłanie zapytania do Gemini (próba ${attempt}): "${promptText}"`);
            
            const response = await ai.models.generateContent({
                model: 'gemini-3.8-flash',
                contents: promptText,
                config: {
                    systemInstruction: "Jesteś pomocnym, inteligentnym i lekko dowcipnym asystentem AI na serwerze Discord społeczności PJN. Odpowiadaj w języku polskim w sposób zwięzły, konkretny i czytelny dla graczy.",
                }
            });

            console.log('[AI] Otrzymano odpowiedź od Google API.');
            return response.text || "Otrzymałem pustą odpowiedź od modelu AI.";
        } catch (error: any) {
            console.error(`❌ Próba ${attempt} nie powiodła się:`, error?.message || error);
            
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
    } catch (e) {
        console.error('Błąd inicjalizacji cytatów:', e);
    }
}

async function setupRussianRouletteChannel() {
    try {
        const channel = await client.channels.fetch('1549791536336732240').catch(() => null) as TextChannel;
        if (!channel) return;
        const messages = await channel.messages.fetch({ limit: 50 }).catch(() => null);
        if (messages) for (const [_, msg] of messages) { if (msg.author.id === client.user?.id) await msg.delete().catch(() => {}); }

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
        const messages = await channel.messages.fetch({ limit: 50 }).catch(() => null);
        if (messages) for (const [_, msg] of messages) { if (msg.author.id === client.user?.id) await msg.delete().catch(() => {}); }

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
        const messages = await channel.messages.fetch({ limit: 50 }).catch(() => null);
        if (messages) for (const [_, msg] of messages) { if (msg.author.id === client.user?.id) await msg.delete().catch(() => {}); }

        const embed = new EmbedBuilder()
            .setColor(0x9B59B6)
            .setTitle('🕹️ Salon Gier i Kasyno PJN — Dostępne Gry')
            .setDescription(
                'Witaj w oficjalnym salonie gier! Poniżej znajdziesz pełną listę wszystkich dostępnych gier i komend, w których możesz pomnożyć swoje PJN-Coins:\n\n' +
                '🎰 **1. Quiz z nagrodami**\n> Komenda: `/quiz-gra` — Odpowiadaj na losowe pytania i zdobywaj monety!\n\n' +
                '✂️ **2. Kamień, Papier, Nożyce**\n> Komenda: `/kpn [wybór] [stawka]` — Klasyczny pojedynek z botem 1v1.\n\n' +
                '🎲 **3. Rzut Kością**\n> Komenda: `/kostka [stawka]` — Sprawdź swój los w rzucie kostką.\n\n' +
                '🪙 **4. Orzeł czy Reszka**\n> Komenda: `/moneta [wybór] [stawka]` — Obstaw stronę monety.\n\n' +
                '🎰 **5. Maszyna Slotowa (Jednoręki Bandyta)**\n> Kanał dedykowany: <#1534066347452141639> (Komenda: `/slot [stawka]`)\n\n' +
                '🃏 **6. Poker (Solo lub z Ludźmi)**\n> Kanał dedykowany: <#1534060082084577350> (Komenda: `/poker [tryb: bot/ludzie] [stawka]` — tryb z ludźmi tworzy pokój dla 2-4 graczy z przyciskami!)\n\n' +
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

        const messages = await channel.messages.fetch({ limit: 50 }).catch(() => null);
        if (messages) {
            for (const [_, msg] of messages) {
                if (msg.author.id === client.user?.id) {
                    await msg.delete().catch(() => {});
                }
            }
        }

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
                { label: 'Mężczyzna', description: 'Wybierz, aby otrzymać rangę męską', value: 'verify_male', emoji: '👦' },
                { label: 'Kobieta', description: 'Wybierz, aby otrzymać rangę damską', value: 'verify_female', emoji: '👧' }
            ]);

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
        const sentMsg = await channel.send({ embeds: [embed], components: [row] });
        await sentMsg.pin().catch(() => {});
    } catch (e) {}
}

async function updateServerStats(guild: any) {
    try {
        await guild.members.fetch();
        const onlineCount = guild.members.cache.filter((m: any) => m.presence && m.presence.status !== 'offline').size;
        const onlineChannel = guild.channels.cache.get(STATS_CHANNELS.ONLINE);
        if (onlineChannel && onlineChannel.isVoiceBased()) await onlineChannel.setName(`🟢 Online: ${onlineCount}`).catch(() => {});

        const fnCount = guild.members.cache.filter((m: any) => m.presence?.activities?.some((act: any) => act.name?.toLowerCase().includes('fortnite'))).size;
        const fnChannel = guild.channels.cache.get(STATS_CHANNELS.FORTNITE);
        if (fnChannel && fnChannel.isVoiceBased()) await fnChannel.setName(`🎮 Gracze Fortnite: ${fnCount}`).catch(() => {});

        const usersChannel = guild.channels.cache.get(STATS_CHANNELS.USERS);
        if (usersChannel && usersChannel.isVoiceBased()) await usersChannel.setName(`👥 PJN Users: ${guild.memberCount}`).catch(() => {});
    } catch (err) {}
}

function startServerStatsCron() {
    setInterval(async () => {
        for (const [_, guild] of client.guilds.cache) {
            await updateServerStats(guild);
        }
    }, 5 * 60 * 1000);
}

// === KOMENDY DISCORD ===
const commands = [
    new SlashCommandBuilder().setName('portfel').setDescription('Sprawdź stan swoich PJN-Coins w portfelu'),
    new SlashCommandBuilder().setName('sklep').setDescription('Otwórz podgląd sklepu i sprawdź swoje środki'),
    new SlashCommandBuilder().setName('moje-przedmioty').setDescription('Sprawdź swoje aktywne przedmioty z sklepu i czas ich wygaśnięcia'),
    new SlashCommandBuilder().setName('historia-sklepu').setDescription('Wyświetl historię zakupów (Admin)').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('historia-transakcji').setDescription('Wyświetl historię przelewów i kasyna (Admin)').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('topka').setDescription('Zobacz ranking najbogatszych graczy'),
    new SlashCommandBuilder().setName('ustaw-topke').setDescription('Ustaw ten kanał jako ranking (Admin)').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('ustaw-odznaki').setDescription('Ustaw ten kanał jako centrum odznak (Admin)').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('daily').setDescription('Odbieraj codzienne PJN-Coins'),
    new SlashCommandBuilder().setName('przelej').setDescription('Przelewa PJN-Coins').addUserOption(o => o.setName('uzytkownik').setDescription('Komu').setRequired(true)).addIntegerOption(o => o.setName('kwota').setDescription('Ile').setRequired(true)),
    new SlashCommandBuilder().setName('kostka').setDescription('Rzuć kością').addIntegerOption(o => o.setName('stawka').setDescription('Stawka').setRequired(true)),
    new SlashCommandBuilder().setName('moneta').setDescription('Orzeł czy reszka').addStringOption(o => o.setName('wybor').setDescription('Wybór').setRequired(true).addChoices({name: 'Orzeł', value: 'orzel'}, {name: 'Reszka', value: 'reszka'})).addIntegerOption(o => o.setName('stawka').setDescription('Stawka').setRequired(true)),
    new SlashCommandBuilder().setName('slot').setDescription('Sloty').addIntegerOption(o => o.setName('stawka').setDescription('Stawka').setRequired(true)),
    new SlashCommandBuilder()
        .setName('poker')
        .setDescription('Zagraj w pokera (Solo z botem lub stwórz pokój dla 2-4 graczy!)')
        .addStringOption(o => o.setName('tryb').setDescription('Tryb gry').setRequired(true).addChoices({name: 'Z ludźmi (Pokój 2-4 os.)', value: 'ludzie'}, {name: 'Z botem (Solo)', value: 'bot'}))
        .addIntegerOption(o => o.setName('stawka').setDescription('Stawka wejściowa PJN-Coins').setRequired(true)),
    new SlashCommandBuilder().setName('quiz').setDescription('Odpowiedz na pytanie quizowe'),
    new SlashCommandBuilder().setName('quiz-gra').setDescription('Rozpocznij interaktywny quiz z przyciskami i nagrodami coins'),
    new SlashCommandBuilder()
        .setName('kpn')
        .setDescription('Zagraj w Kamień, Papier, Nożyce za PJN-Coins')
        .addStringOption(o => o.setName('wybor').setDescription('Twój wybór').setRequired(true).addChoices({ name: 'Kamień 🪨', value: 'kamien' }, { name: 'Papier 📄', value: 'papier' }, { name: 'Nożyce ✂️', value: 'nozyce' }))
        .addIntegerOption(o => o.setName('stawka').setDescription('Stawka PJN-Coins').setRequired(true)),
    new SlashCommandBuilder().setName('odznaki').setDescription('Wyświetla profil z odznakami').addUserOption(o => o.setName('uzytkownik').setDescription('Użytkownik').setRequired(false)),
    new SlashCommandBuilder().setName('exp').setDescription('Sprawdź swój aktualny poziom, exp').addUserOption(o => o.setName('uzytkownik').setDescription('User').setRequired(false)),
    new SlashCommandBuilder().setName('reputacja').setDescription('Wyświetla profil handlowy').addUserOption(o => o.setName('uzytkownik').setDescription('User').setRequired(false)),
    new SlashCommandBuilder().setName('profil').setDescription('Kompleksowa karta profilu gracza').addUserOption(o => o.setName('uzytkownik').setDescription('User').setRequired(false)),
    new SlashCommandBuilder().setName('ai').setDescription('Zadaj pytanie sztucznej inteligencji PJN AI').addStringOption(o => o.setName('pytanie').setDescription('Pytanie').setRequired(true)),
    new SlashCommandBuilder().setName('darmowe-gry').setDescription('Ręcznie pobierz i wyświetl aktualne darmowe gry z Epic Games i Steam (Admin)').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('daj-bonus-wygranych').setDescription('Aktywuje 100% wygranych w kasynie na 30 minut (Admin)').addUserOption(o => o.setName('uzytkownik').setDescription('Gracz').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('daj-wszystkim').setDescription('Rozdaje PJN-Coins każdemu (Admin)').addIntegerOption(o => o.setName('ilosc').setDescription('Ilość').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('daj-odznake').setDescription('Przyznaj odznakę (Admin)').addUserOption(o => o.setName('uzytkownik').setDescription('Komu').setRequired(true)).addStringOption(o => o.setName('odznaka').setDescription('Odznaka').setRequired(true).setAutocomplete(true)),
    new SlashCommandBuilder().setName('dajpunkty').setDescription('Daj punkty użytkownikowi').addUserOption(o => o.setName('uzytkownik').setDescription('User').setRequired(true)).addIntegerOption(o => o.setName('ilosc').setDescription('Ilość').setRequired(true)),
    new ContextMenuCommandBuilder().setName('Zapisz jako złoty tekst').setType(ApplicationCommandType.Message)
].map(c => c.toJSON());

client.once('ready', async () => {
    console.log(`Zalogowano jako ${client.user?.tag}!`);
    await seedQuotesIfNeeded();
    await setupVerificationChannel(); 
    await setupRussianRouletteChannel();
    await setupWheelOfFortuneChannel();
    await setupCasinoHubChannel();

    const rest = new REST({ version: '10' }).setToken(token);
    try {
        for (const [_, guild] of client.guilds.cache) {
            await rest.put(Routes.applicationGuildCommands(client.user!.id, guild.id), { body: commands });
            await updateServerStats(guild);
        }
    } catch (error) {}

    startFreeGamesCron();
    startServerStatsCron();
});

client.on('interactionCreate', async interaction => {
    if (interaction.isMessageContextMenuCommand()) {
        if (interaction.commandName === 'Zapisz jako złoty tekst') {
            await interaction.deferReply({ ephemeral: true });
            const targetMessage = interaction.targetMessage;
            if (!targetMessage || !targetMessage.content) return interaction.editReply({ content: '❌ Wiadomość bez tekstu.' });

            await QuoteModel.create({ text: targetMessage.content, author: targetMessage.author.tag, addedBy: interaction.user.id });
            const channel = await client.channels.fetch(ID_KANALU_ZLOTE_MYSLI).catch(() => null) as TextChannel;
            if (channel) {
                const embed = new EmbedBuilder().setColor(0xE67E22).setTitle('✨ Złota myśl').setDescription(`> *„${targetMessage.content}”*\n\n**— ${targetMessage.author.tag}**`).setTimestamp();
                await channel.send({ embeds: [embed] });
            }
            return interaction.editReply({ content: `✅ Dodano do Złotych myśli!` });
        }
    }

    // === OBSŁUGA PRZYCISKÓW POKERA (MULTIPLAYER) ===
    if (interaction.isButton() && (interaction.customId.startsWith('poker_join_') || interaction.customId.startsWith('poker_start_') || interaction.customId.startsWith('poker_cancel_'))) {
        await interaction.deferReply({ ephemeral: true });
        const lobby = await PokerLobbyModel.findOne({ messageId: interaction.message.id });
        if (!lobby) return interaction.editReply({ content: '❌ Ten pokój pokera już nie istnieje.' });
        if (lobby.status !== 'waiting') return interaction.editReply({ content: '❌ Ta gra w pokera już się rozpoczęła lub zakończyła.' });

        const userId = interaction.user.id;

        if (interaction.customId.startsWith('poker_join_')) {
            if (lobby.players.includes(userId)) return interaction.editReply({ content: '⚠️ Jesteś już w tym pokoju.' });
            if (lobby.players.length >= 4) return interaction.editReply({ content: '❌ Pokój jest pełny (maksymalnie 4 graczy).' });

            let user = await UserModel.findOne({ userId });
            if (!user) user = await UserModel.create({ userId });
            if (user.balance < lobby.stake) return interaction.editReply({ content: `❌ Nie masz wystarczająco środków (${lobby.stake} coins).` });

            lobby.players.push(userId);
            await lobby.save();

            await updatePokerLobbyMessage(interaction.message, lobby);
            return interaction.editReply({ content: '✅ Pomyślnie dołączyłeś do stołu pokera!' });
        }

        if (interaction.customId.startsWith('poker_cancel_')) {
            if (lobby.hostId !== userId && !isAuthorized(userId)) return interaction.editReply({ content: '❌ Tylko host może anulować grę.' });
            lobby.status = 'finished';
            await lobby.save();
            await interaction.message.delete().catch(() => {});
            return interaction.editReply({ content: '✅ Anulowano stół pokera.' });
        }

        if (interaction.customId.startsWith('poker_start_')) {
            if (lobby.hostId !== userId) return interaction.editReply({ content: '❌ Tylko właściciel (host) pokoju może rozpocząć grę!' });
            if (lobby.players.length < 2) return interaction.editReply({ content: '❌ Do gry potrzeba minimum 2 graczy!' });

            // Pobieramy wszystkich graczy i sprawdzamy saldo
            for (const pId of lobby.players) {
                let pDoc = await UserModel.findOne({ userId: pId });
                if (!pDoc || pDoc.balance < lobby.stake) {
                    return interaction.editReply({ content: `❌ Jeden z graczy (<@${pId}>) nie ma już wystarczająco środków na stawkę ${lobby.stake}!` });
                }
            }

            // Pobieramy stawkę z kont wszystkich graczy
            const totalPool = lobby.stake * lobby.players.length;
            for (const pId of lobby.players) {
                await UserModel.updateOne({ userId: pId }, { $inc: { balance: -lobby.stake, casinoPlays: 1 } });
            }

            // Losujemy zwycięzcę spośród graczy w pokoju
            const winnerId = lobby.players[Math.floor(Math.random() * lobby.players.length)];
            let winnerUser = await UserModel.findOne({ userId: winnerId });
            winnerUser!.balance += totalPool;
            winnerUser!.consecutiveWins = (winnerUser!.consecutiveWins || 0) + 1;
            winnerUser!.consecutiveLosses = 0;
            await winnerUser!.save();

            lobby.status = 'finished';
            await lobby.save();

            await TransactionHistoryModel.create({
                userId: winnerId,
                type: 'casino_poker_multi',
                amount: totalPool - lobby.stake,
                details: `Wygrana w pokerze multiplayer z ${lobby.players.length} graczy`
            });

            let desc = `🃏 **POKER MULTIPLAYER - WYNIKI ROZDANIA**\n\n`;
            desc += `🏆 **Zwycięzca:** <@${winnerId}>\n`;
            desc += `💰 **Pula wygrana:** \`${totalPool} PJN-Coins\`!\n\nGracze przy stole:\n`;
            for (const pId of lobby.players) {
                desc += `• <@${pId}> ${pId === winnerId ? '👑 (Wygrana)' : '❌ (Przegrana)'}\n`;
            }

            const endEmbed = new EmbedBuilder()
                .setColor(0x2ECC71)
                .setTitle('🃏 Stół Pokera • Rozstrzygnięty')
                .setDescription(desc)
                .setTimestamp();

            await interaction.message.edit({ embeds: [endEmbed], components: [] });
            return interaction.editReply({ content: '✅ Rozpoczęto i rozstrzygnięto rozdanie pokera!' });
        }
    }

    if (interaction.isButton() && interaction.customId === 'rr_start_modal') {
        const modal = new ModalBuilder().setCustomId('rr_modal_submit').setTitle('Rosyjska Ruletka - Stawka');
        const input = new TextInputBuilder().setCustomId('rr_stake_input').setLabel('Wpisz stawkę PJN-Coins:').setStyle(TextInputStyle.Short).setRequired(true);
        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
        return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'rr_modal_submit') {
        await interaction.deferReply({ ephemeral: false });
        const stake = parseInt(interaction.fields.getTextInputValue('rr_stake_input'));
        if (isNaN(stake) || stake <= 0) return interaction.editReply({ content: '❌ Podaj prawidłową stawkę.' });

        let user = await UserModel.findOne({ userId: interaction.user.id });
        if (!user) user = await UserModel.create({ userId: interaction.user.id });
        if (user.balance < stake) return interaction.editReply({ content: `❌ Nie masz tylu środków (${user.balance}).` });

        user.balance -= stake;
        user.casinoPlays = (user.casinoPlays || 0) + 1;

        const now = new Date();
        const hasGuaranteedWin = user.guaranteedWinUntil && new Date(user.guaranteedWinUntil) > now;
        let bulletChance = stake >= 5000 ? 0.5 : 1/6;
        const isDead = hasGuaranteedWin ? false : (Math.random() < bulletChance);

        if (isDead) {
            user.consecutiveLosses = (user.consecutiveLosses || 0) + 1;
            user.consecutiveWins = 0;
            await user.save();
            return interaction.editReply({ content: `🎯 **Rosyjska Ruletka:** <@${interaction.user.id}> postawił **${stake}** i... 💥 **BAM!** Trafiłeś na kulę! Straciłeś monety.` });
        } else {
            const winAmount = stake * 2;
            user.balance += winAmount;
            user.consecutiveWins = (user.consecutiveWins || 0) + 1;
            user.consecutiveLosses = 0;
            await user.save();
            return interaction.editReply({ content: `🎯 **Rosyjska Ruletka:** <@${interaction.user.id}> postawił **${stake}** i... ✨ Przeżyłeś i wygrywasz **${winAmount} PJN-Coins**!` });
        }
    }

    if (interaction.isButton() && interaction.customId === 'wheel_spin') {
        await interaction.deferReply({ ephemeral: false });
        let user = await UserModel.findOne({ userId: interaction.user.id });
        if (!user) user = await UserModel.create({ userId: interaction.user.id });

        const now = new Date();
        if (user.lastWheelSpin && (now.getTime() - new Date(user.lastWheelSpin).getTime() < 2 * 3600 * 1000)) {
            return interaction.editReply({ content: `⏳ Koło Fortuny można kręcić raz na 2 godziny.` });
        }

        user.lastWheelSpin = now;
        const outcome = [
            { name: '300 PJN-Coins', val: 300 },
            { name: '500 PJN-Coins', val: 500 },
            { name: 'Bankrut (-100)', val: -100 }
        ][Math.floor(Math.random() * 3)];

        user.balance = Math.max(0, user.balance + outcome.val);
        await user.save();
        return interaction.editReply({ content: `🎡 **Koło Fortuny:** Wylosowałeś **${outcome.name}**! (Stan portfela: **${user.balance}**)` });
    }

    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        if (commandName === 'darmowe-gry') {
            if (!isAuthorized(interaction.user.id)) return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
            await interaction.deferReply({ ephemeral: true });
            await postFreeGamesToChannel();
            return interaction.editReply({ content: `✅ Pomyślnie pobrano i wysłano darmowe gry z Epic Games oraz Steam na kanał <#${NOTIF_CONFIG.freeGamesChannelId}>!` });
        }

        if (commandName === 'daj-bonus-wygranych') {
            if (!isAuthorized(interaction.user.id)) return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
            await interaction.deferReply({ ephemeral: true });
            const targetUser = interaction.options.getUser('uzytkownik', true);
            let user = await UserModel.findOne({ userId: targetUser.id });
            if (!user) user = await UserModel.create({ userId: targetUser.id });
            user.guaranteedWinUntil = new Date(Date.now() + 30 * 60 * 1000);
            await user.save();
            return interaction.editReply({ content: `✅ Przyznano 100% wygranych na 30 minut dla <@${targetUser.id}>!` });
        }

        if (commandName === 'poker') {
            if (interaction.channelId !== '1534060082084577350') {
                return interaction.reply({ content: '❌ Tę komendę wykonasz tylko na kanale pokera (<#1534060082084577350>)!', ephemeral: true });
            }

            const tryb = interaction.options.getString('tryb', true);
            const stawka = interaction.options.getInteger('stawka', true);
            if (stawka <= 0) return interaction.reply({ content: '❌ Stawka musi być > 0!', ephemeral: true });

            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) user = await UserModel.create({ userId: interaction.user.id });

            // TRYB Z LUDŹMI (MULTIPLAYER)
            if (tryb === 'ludzie') {
                if (user.balance < stawka) return interaction.reply({ content: `❌ Nie masz wystarczająco środków (${user.balance}).`, ephemeral: true });

                await interaction.deferReply();
                const embed = new EmbedBuilder()
                    .setColor(0xF1C40F)
                    .setTitle('🃏 Stół Pokera • Otwarty Pokój')
                    .setDescription(
                        `Host: <@${interaction.user.id}>\n` +
                        `Stawka wejściowa: \`${stawka} PJN-Coins\`\n` +
                        `Maksymalnie graczy: 4\n\n` +
                        `📋 **Gracze przy stole:**\n• <@${interaction.user.id}>`
                    )
                    .setTimestamp();

                const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder().setCustomId('poker_join_').setLabel('Dołącz do stołu').setStyle(ButtonStyle.Success).setEmoji('➕'),
                    new ButtonBuilder().setCustomId('poker_start_').setLabel('Start gry (Właściciel)').setStyle(ButtonStyle.Primary).setEmoji('▶️'),
                    new ButtonBuilder().setCustomId('poker_cancel_').setLabel('Anuluj').setStyle(ButtonStyle.Danger).setEmoji('✖️')
                );

                const sentMsg = await interaction.editReply({ embeds: [embed], components: [row] });

                await PokerLobbyModel.create({
                    messageId: sentMsg.id,
                    channelId: interaction.channelId,
                    hostId: interaction.user.id,
                    stake: stawka,
                    players: [interaction.user.id],
                    status: 'waiting'
                });
                return;
            }

            // TRYB Z BOTEM (SOLO)
            await interaction.deferReply();
            if (user.balance < stawka) return interaction.editReply({ content: `❌ Brak środków (${user.balance}).` });

            user.casinoPlays = (user.casinoPlays || 0) + 1;
            const now = new Date();
            const hasGuaranteedWin = user.guaranteedWinUntil && new Date(user.guaranteedWinUntil) > now;
            const won = hasGuaranteedWin || (Math.random() < 0.55);

            let changeAmount = 0;
            if (won) {
                user.balance += stawka;
                user.consecutiveWins = (user.consecutiveWins || 0) + 1;
                user.consecutiveLosses = 0;
                changeAmount = stawka;
            } else {
                user.balance -= stawka;
                user.consecutiveLosses = (user.consecutiveLosses || 0) + 1;
                user.consecutiveWins = 0;
                changeAmount = -stawka;
            }
            await user.save();

            return interaction.editReply({ content: won ? `🃏 [Poker z botem] Wygrywasz **${stawka} PJN-Coins**!` : `🃏 [Poker z botem] Przegrywasz **${stawka} PJN-Coins**!` });
        }

        // Pozostałe standardowe komendy
        if (commandName === 'portfel') {
            await interaction.deferReply({ ephemeral: true });
            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) user = await UserModel.create({ userId: interaction.user.id });
            return interaction.editReply({ content: `💰 Posiadasz **${user.balance} PJN-Coins!**` });
        }
    }
});

async function updatePokerLobbyMessage(message: any, lobby: any) {
    try {
        const playersListText = lobby.players.map((id: string) => `• <@${id}>`).join('\n');
        const embed = new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle('🃏 Stół Pokera • Otwarty Pokój')
            .setDescription(
                `Host: <@${lobby.hostId}>\n` +
                `Stawka wejściowa: \`${lobby.stake} PJN-Coins\`\n` +
                `Gracze: ${lobby.players.length} / 4\n\n` +
                `📋 **Gracze przy stole:**\n${playersListText}`
            )
            .setTimestamp();

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('poker_join_').setLabel('Dołącz do stołu').setStyle(ButtonStyle.Success).setEmoji('➕'),
            new ButtonBuilder().setCustomId('poker_start_').setLabel('Start gry (Właściciel)').setStyle(ButtonStyle.Primary).setEmoji('▶️'),
            new ButtonBuilder().setCustomId('poker_cancel_').setLabel('Anuluj').setStyle(ButtonStyle.Danger).setEmoji('✖️')
        );

        await message.edit({ embeds: [embed], components: [row] });
    } catch (e) {}
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running 24/7!\n');
});
server.listen(process.env.PORT || 10000);

client.login(token);
