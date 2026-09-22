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
            console.log(`[AI] Wysyłanie zapytania do Gemini (próba ${attempt}): "${promptText}"`);
            const response = await ai.models.generateContent({
                model: 'gemini-3.8-flash',
                contents: promptText,
                config: {
                    systemInstruction: "Jesteś pomocnym, inteligentnym i lekko dowcipnym asystentem AI na serwerze Discord społeczności PJN. Odpowiadaj w języku polskim w sposób zwięzły, konkretny i czytelny dla graczy.",
                }
            });
            return response.text || "Otrzymałem pustą odpowiedź od modelu AI.";
        } catch (error: any) {
            console.error(`❌ Próba ${attempt} nie powiodła się:`, error?.message || error);
            if (attempt === maxRetries) return `⚠️ Przepraszam, serwery AI są obecnie mocno obciążone. Spróbuj ponownie za chwilę!`;
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
    } catch (e) { console.error('Błąd setupRussianRouletteChannel:', e); }
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
    } catch (e) { console.error('Błąd setupWheelOfFortuneChannel:', e); }
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
                '🃏 **6. Poker**\n> Kanał dedykowany: <#1534060082084577350> (Komenda: `/poker [tryb] [stawka]`)\n\n' +
                '🎯 **7. Rosyjska Ruletka**\n> Kanał specjalny: <#1549791536336732240> — Ryzykuj stawkę w rewolwerze (większe ryzyko przy dużych stawkach)!\n\n' +
                '🎡 **8. Koło Fortuny**\n> Kanał specjalny: <#1549791621942485120> — Kręć kołem co 2 godziny i wygrywaj darmowe nagrody!'
            )
            .setImage(LIVE_IMAGE_URL)
            .setTimestamp()
            .setFooter({ text: 'PJN Kasyno & Arcade • Powodzenia w grach!' });

        await channel.send({ embeds: [embed] });
    } catch (e) { console.error('Błąd setupCasinoHubChannel:', e); }
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
                { label: 'Mężczyzna', description: 'Wybierz, aby otrzymać rangę męską i zweryfikować konto', value: 'verify_male', emoji: '👦' },
                { label: 'Kobieta', description: 'Wybierz, aby otrzymać rangę damską i zweryfikować konto', value: 'verify_female', emoji: '👧' }
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
        .setDescription(`> *„${quote.text}”*\n\n**— ${quote.author}**`)
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
    cron.schedule('30 3 * * *', async () => {
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

            const res = await fetch('https://fortnite-api.com/v2/shop', {
                headers: { 'Authorization': process.env.FORTNITE_API_KEY || '' }
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
                    const rawName = entry.items?.[0]?.name || entry.bundle?.name || entry.devName || entry.track?.title || 'Oferta Specjalna Fortnite';
                    const itemName = rawName.replace(/^\[VIRTUAL\]\d+\s*x\s*/i, '').replace(/\s*for\s*-?\d+\s*MtxCurrency/i, '').trim();
                    const price = entry.finalPrice || entry.regularPrice || 'N/D';
                    desc += `• **${itemName}** — 🪙 \`${price} V-Bucks\`\n`;
                }
                embed.setDescription(desc);
            }

            await channel.send({ embeds: [embed] });
        } catch (err) {
            console.error('Błąd automatycznego sklepu Fortnite:', err);
        }
    });
}

let lastFortniteIncidentId: string | null = null;
let lastFortniteStatusState: string | null = null;

async function setupFortniteUpdateChannel() {
    try {
        const channel = await client.channels.fetch(ID_KANAL_AKTUALIZACJI_FORTNITE).catch(() => null) as TextChannel;
        if (!channel) return;

        const messages = await channel.messages.fetch({ limit: 50 }).catch(() => null);
        if (messages) {
            for (const [_, msg] of messages) {
                if (msg.author.id === client.user?.id) await msg.delete().catch(() => {});
            }
        }

        const embed = new EmbedBuilder()
            .setColor(0x00D9FF)
            .setTitle('🚀 Centrum Powiadomień o Aktualizacjach Fortnite')
            .setDescription(
                'Ten kanał służy jako oficjalna tablica informacyjna dla graczy Fortnite.\n\n' +
                '🤖 **Co tutaj znajdziesz?**\n' +
                '• 📢 **Informacje o nadchodzących aktualizacjach** z wyprzedzeniem.\n' +
                '• 🛑 **Ostrzeżenia o zamknięciu serwerów** (przerwy techniczne / downtime).\n' +
                '• ✅ **Informację o ponownym otwarciu serwerów**, gdy gra znów będzie dostępna!\n\n' +
                '🔔 *Kliknij poniższy przycisk, aby włączyć lub wyłączyć powiadomienia (rangę <@&' + ID_RANGI_AKTUALIZACJE_FORTNITE + '>) i otrzymywać powiadomienia dźwiękowe o przerwach w grze!*'
            )
            .setImage(LIVE_IMAGE_URL)
            .setTimestamp()
            .setFooter({ text: 'PJN System Monitorowania Fortnite' });

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('role_fn_updates_toggle').setLabel('Przełącz rangę powiadomień Fortnite').setStyle(ButtonStyle.Primary).setEmoji('🔔')
        );

        const sentMsg = await channel.send({ embeds: [embed], components: [row] });
        await sentMsg.pin().catch(() => {});
    } catch (e) { console.error('Błąd setupFortniteUpdateChannel:', e); }
}

async function checkFortniteServerStatus() {
    try {
        const res = await fetch('https://status.epicgames.com/api/v2/summary.json');
        if (!res.ok) return;
        const data = await res.json() as any;
        if (!data || !data.components) return;

        const fortniteComponent = data.components.find((comp: any) => 
            comp.name.toLowerCase().includes('fortnite') && (comp.group === true || comp.name.toLowerCase() === 'fortnite')
        );

        const currentStatusState = fortniteComponent ? fortniteComponent.status : (data.status?.indicator || 'none');
        const activeIncidents = data.scheduled_maintenances || [];
        const activeIncident = activeIncidents.length > 0 ? activeIncidents[0] : null;

        const channel = await client.channels.fetch(ID_KANAL_AKTUALIZACJI_FORTNITE).catch(() => null) as TextChannel;
        if (!channel) return;

        const rolePing = `<@&${ID_RANGI_AKTUALIZACJE_FORTNITE}>`;

        if (activeIncident && activeIncident.id !== lastFortniteIncidentId && activeIncident.status === 'scheduled') {
            lastFortniteIncidentId = activeIncident.id;
            const embed = new EmbedBuilder()
                .setColor(0xF1C40F)
                .setTitle('📢 Zapowiedziano nową aktualizację / przerwę techniczną Fortnite!')
                .setDescription(
                    `**Nazwa wydarzenia:** ${activeIncident.name}\n` +
                    `📌 **Status:** Zaplanowana konserwacja\n` +
                    `🕒 **Zaplanowany start:** ${new Date(activeIncident.scheduled_for).toLocaleString('pl-PL')}\n` +
                    `🕒 **Planowany koniec:** ${new Date(activeIncident.scheduled_until).toLocaleString('pl-PL')}\n\n` +
                    `*Wkrótce serwery zostaną wyłączone. Przygotujcie się do zejścia z gry!*`
                )
                .setTimestamp()
                .setFooter({ text: 'Epic Games Status • Fortnite' });

            await channel.send({ content: `${rolePing} 🚨 Zapowiedziano nową przerwę techniczną w Fortnite!`, embeds: [embed], allowedMentions: { roles: [ID_RANGI_AKTUALIZACJE_FORTNITE] } });
        }

        if (currentStatusState !== 'operational' && currentStatusState !== 'none' && lastFortniteStatusState === 'operational') {
            const embed = new EmbedBuilder()
                .setColor(0xE74C3C)
                .setTitle('🛑 Serwery Fortnite zostały ZAMKNIĘTE (Przerwa techniczna)!')
                .setDescription(`Serwery gry przestały odpowiadać lub rozpoczęła się właściwa aktualizacja. Matchmaking został wyłączony.\n\n⚙️ Trwa wdrażanie nowej łatki/aktualizacji. Prosimy cierpliwie czekać na powrót serwerów!`)
                .setTimestamp()
                .setFooter({ text: 'Epic Games Status • Serwery Offline' });

            await channel.send({ content: `${rolePing} 🛑 Serwery Fortnite zostały wyłączone do aktualizacji!`, embeds: [embed], allowedMentions: { roles: [ID_RANGI_AKTUALIZACJE_FORTNITE] } });
        }

        if (currentStatusState === 'operational' && lastFortniteStatusState && lastFortniteStatusState !== 'operational' && lastFortniteStatusState !== 'none') {
            const embed = new EmbedBuilder()
                .setColor(0x2ECC71)
                .setTitle('✅ Serwery Fortnite zostały OTWARTE!')
                .setDescription(`Przerwa techniczna / aktualizacja dobiegła końca! Wszystkie systemy gry działają poprawnie.\n\n🎮 Można już uruchamiać grę, pobierać aktualizację i wracać do walki! Powodzenia w meczach! 🚀`)
                .setTimestamp()
                .setFooter({ text: 'Epic Games Status • Serwery Online' });

            await channel.send({ content: `${rolePing} 🎉 Serwery Fortnite są już otwarte! Można wracać do gry!`, embeds: [embed], allowedMentions: { roles: [ID_RANGI_AKTUALIZACJE_FORTNITE] } });
        }

        lastFortniteStatusState = currentStatusState;
    } catch (err) { console.error('Błąd checkFortniteServerStatus:', err); }
}

function startFortniteStatusCron() {
    cron.schedule('*/2 * * * *', async () => { await checkFortniteServerStatus(); });
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
                    if (member) displayName = member.displayName;
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
        new ButtonBuilder().setCustomId(`${prefixId}_prev_${currentPage}`).setLabel('⬅️ Wstecz').setStyle(ButtonStyle.Primary).setDisabled(currentPage === 0),
        new ButtonBuilder().setCustomId(`${prefixId}_next_${currentPage}`).setLabel('Dalej ➡️').setStyle(ButtonStyle.Primary).setDisabled(currentPage >= totalPages - 1)
    );

    return { embeds: [embed], components: [row] };
}

async function refreshFortniteRankingMessage(guild: any) {
    try {
        const channel = await guild.channels.fetch(ID_KANAL_RANKING_FORTNITE).catch(() => null) as TextChannel;
        if (!channel) return;

        await updateAllFortniteStats();
        const messages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
        if (messages) {
            for (const [_, msg] of messages) {
                if (msg.author.id === client.user?.id) await msg.delete().catch(() => {});
            }
        }

        const underUsers = await UserModel.find({ epicNick: { $ne: null }, matchesPlayed: { $lt: 2800 } }).sort({ fortniteKills: -1 }).limit(100);
        const payloadUnder = await generateFortniteRankingEmbeds(guild, underUsers, '🟢 TOP • Początkujący (<2800 meczów)', 0x2ECC71, 0);
        await channel.send(payloadUnder);

        const overUsers = await UserModel.find({ epicNick: { $ne: null }, matchesPlayed: { $gte: 2800 } }).sort({ fortniteKills: -1 }).limit(100);
        const payloadOver = await generateFortniteRankingEmbeds(guild, overUsers, '🔥 TOP • Weterani (2800+ meczów)', 0xE74C3C, 0);
        await channel.send(payloadOver);
    } catch (e) { console.error('Błąd refreshFortniteRankingMessage:', e); }
}

function startFortniteRankingCron() {
    cron.schedule('0 0 * * *', async () => {
        for (const [_, guild] of client.guilds.cache) { await refreshFortniteRankingMessage(guild); }
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
                            embeds: [new EmbedBuilder().setColor(0xE74C3C).setTitle('⏰ Twoja ranga VIP wygasła').setDescription('Minął okres 30 dni ważności Twojej rangi **VIP**. Ranga została automatycznie usunięta z Twojego konta.').setTimestamp()]
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
        } catch (err) { console.error('Błąd startExpirationChecker:', err); }
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
                                desc += `**${i + 1}. ${poll.options[i]}** — **${percent}%** (${count} głosów)\n`;
                            }

                            const embed = new EmbedBuilder().setColor(0xE74C3C).setTitle(`🗳️ ${poll.question} (Wyniki końcowe)`).setDescription(desc).setTimestamp();
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
            '🔗 **TikTok**\n[tiktok.com/@languspjn](https://tiktok.com/@languspjn)\n\n' +
            '🔗 **Kick**\n[kick.com/LangusPJN](https://kick.com/LangusPJN)\n\n' +
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
        .setDescription('Witaj w oficjalnym systemie osiągnięć serwera! Będąc aktywnym, rozmawiając, grając w kasynie czy spędzając z nami czas, automatycznie zdobywasz unikalne odznaki w swoim profilu (`/profil`).\n\n🔍 **Jak sprawdzić swoje odznaki?**\nWpisz w dowolnym kanale komendę: `/odznaki`.')
        .addFields(
            {
                name: '💬 Aktywność na Chacie i Głosie',
                value: '• 💬 **Początkujący Gadulec** — 200 wiadomości\n• 📜 **Kronikarz Chatu** — 1 000 wiadomości\n• 💬 **Król Wiadomości** — 5 000 wiadomości\n• 🧠 **Wygadany Mędrzec** — 25 000 wiadomości\n• 😂 **Emotikonowy Ekspresja** — 30 emotek\n• 🌙 **Nocny Marek** — 50 wiadomości w nocy\n• 🎙️ **Stały Bywalec Mikrofonu** — 30h na głosie\n• 🎧 **Audiofil** — 100h na głosie\n• 🎙️ **Duch Kanałów Głosowych** — 500h na głosie (Elitarna)',
                inline: false
            },
            {
                name: '⭐ Poziomy i Doświadczenie',
                value: '• ⭐ **Awansowy Ekspert** — 10 poziom\n• 🌟 **Mistrz Poziomów** — 50 poziom (Rzadka)\n• 👑 **Legenda Serwera** — 100 poziom (Elitarna)',
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
                value: '• 💰 **Kapitalista** — 5 000 Coinsów\n• 💎 **Magnat Finansowy** — 10 000 Coinsów\n• 🏦 **Milioner** — 100 000 Coinsów (Rzadka)\n• 🏛️ **Miliarder PJN** — 1 000 000 Coinsów (Elitarna)\n• 💸 **Hojny Darczyńca** — 5 000 w przelewach\n• 🤝 **Filantrop Społeczności** — 50 000 w przelewach\n• 🎲 **Nałogowy Graczyk** — 20 gier w kasynie\n• 🎰 **Ryzykant** — 100 gier (Rzadka)\n• 🎰 **Hazardowy Tycoon** — 500 gier\n• 🍀 **Ulubieniec Fortuna** — 3 wygrane z rzędu\n• 🔥 **Niepowstrzymana Seria** — 20 wygranych\n• 🎯 **Czarna Seria** — 5 przegranych\n• 🏷️ **Klient sklepu PJN** / 🎖️ **Zaawansowany klient**\n• 💡 **Filozof** (5 cytatów) • 🤝 **Pomocna Dłoń** (10 akcji)\n• ⏳ **Weteran Półrocza** / ⏳ **Weteran** / ⌛ **Patriarcha**\n• 🛡️ **Filar Społeczności** • 🎟️ **Kolekcjoner (Epicka)**',
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
        const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
        if (messages) {
            for (const [_, msg] of messages) {
                if (msg.author.id === client.user?.id) await msg.delete().catch(() => {});
            }
        }

        const embed = new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle('🎫 Centrum Pomocy i Zgłoszeń PJN')
            .setDescription('Potrzebujesz pomocy z duszkiem? Dobrze trafiłeś!\n\nKliknij poniższy przycisk **"Stwórz Ticket"**, aby otworzyć prywatny kanał. Nasza ekipa pomoże Ci tak szybko, jak to możliwe!\n\n⚠️ *Prosimy nie tworzyć zgłoszeń bez potrzeby – szanujmy swój czas.*')
            .setTimestamp()
            .setFooter({ text: 'PJN System Ticketów • Bezpieczna pomoc' });

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('create_ticket').setLabel('Stwórz Ticket').setStyle(ButtonStyle.Success).setEmoji('🎫')
        );
        await channel.send({ embeds: [embed], components: [row] });
    } catch (e) { console.error('Błąd setupTicketChannel:', e); }
}

async function setupRolesChannel() {
    try {
        const channel = await client.channels.fetch(ID_KANAL_RANG).catch(() => null) as TextChannel;
        if (!channel) return;
        const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
        if (messages) {
            for (const [_, msg] of messages) {
                if (msg.author.id === client.user?.id) await msg.delete().catch(() => {});
            }
        }

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
    } catch (e) { console.error('Błąd setupRolesChannel:', e); }
}

async function setupMemeChannelInstruction() {
    try {
        const channel = await client.channels.fetch(ID_KANALU_MEMOW).catch(() => null) as TextChannel;
        if (!channel) return;
        const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
        if (messages) {
            for (const [_, msg] of messages) {
                if (msg.author.id === client.user?.id) await msg.delete().catch(() => {});
            }
        }

        const embed = new EmbedBuilder()
            .setColor(0xE74C3C)
            .setTitle('🖼️ Jak korzystać z Generatora Memów PJN?')
            .setDescription('W tym kanale możesz w pełni bezpiecznie i bez spamowania tworzyć własne memy za pomocą bota!\n\n🛠️ **Jak wygenerować mema?**\n1. Wpisz w oknie wiadomości komendę: `/mem`\n2. Wpisz nazwę w polu **szablon** – bot podpowie Ci setki dziesiątek szablonów z całego świata!\n3. Wpisz tekst górny i dolny (opcjonalnie).\n4. Naciśnij **Enter**, a bot w kilka sekund wygeneruje gotowy obrazek na czacie!\n\n⚠️ *Na tym kanale wysyłanie zwykłego tekstu jest zablokowane – korzystaj wyłącznie z komendy `/mem`!*')
            .setImage('https://imgflip.com/s/meme/Drake-Hotline-Bling.jpg')
            .setFooter({ text: 'PJN Generator Memów • Miłej zabawy!' });

        const sentMsg = await channel.send({ embeds: [embed] });
        await sentMsg.pin().catch(() => {});
    } catch (e) { console.error('Błąd setupMemeChannelInstruction:', e); }
}

async function setupShopChannel() {
    try {
        const channel = await client.channels.fetch(ID_KANAL_SKLEPU).catch(() => null) as TextChannel;
        if (!channel) return;
        const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
        if (messages) {
            for (const [_, msg] of messages) {
                if (msg.author.id === client.user?.id) await msg.delete().catch(() => {});
            }
        }

        let desc = 'Witaj w oficjalnym sklepie serwera PJN! Wydawaj swoje PJN-Coins na unikalne przedmioty, role i usługi.\n\n*Wszystkie rangi czasowe (w tym VIP) są ważne przez 30 dni, po czym automatycznie wygasają.*\n\n**📋 Dostępny asortyment:**\n\n';
        SHOP_ITEMS.forEach((item, index) => {
            desc += `**${index + 1}. ${item.name}** — 💰 **${item.price} PJN-Coins**\n> *${item.description}*\n\n`;
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
            .addOptions(SHOP_ITEMS.map(item => ({ label: item.name.substring(0, 25), description: `Cena: ${item.price} PJN-Coins`, value: item.id })));

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
        const sentMsg = await channel.send({ embeds: [embed], components: [row] });
        await sentMsg.pin().catch(() => {});
    } catch (e) { console.error('Błąd setupShopChannel:', e); }
}

async function setupLfgChannelInstruction() {
    try {
        const channel = await client.channels.fetch(ID_KANALU_SZUKAM_DO_GRY).catch(() => null) as TextChannel;
        if (!channel) return;
        const messages = await channel.messages.fetch({ limit: 50 }).catch(() => null);
        if (messages) {
            for (const [_, msg] of messages) {
                if (msg.author.id === client.user?.id && msg.embeds.length > 0 && msg.embeds[0].title?.includes('Centrum LFG')) await msg.delete().catch(() => {});
            }
        }

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('🎮 Centrum LFG (Looking For Group) — Jak szukać ekipy do gry?')
            .setDescription('Masz dosyć grania w pojedynkę? Chcesz znaleźć zgrany skład do ulubionej gry? Skorzystaj z naszego automatycznego systemu LFG!\n\n🛠️ **Jak stworzyć ogłoszenie o grze?**\n`1.` Wpisz na tym kanale komendę: `/szukam`\n`2.` Wybierz grę z listy.\n`3.` Podaj maksymalną liczbę osób i opcjonalny opis.\n\n👥 **Jak dołączyć do ekipy?**\n• Kliknij zielony przycisk **"Dołącz do ekipy"** pod wybranym ogłoszeniem.')
            .setImage(LIVE_IMAGE_URL)
            .setTimestamp()
            .setFooter({ text: 'PJN System LFG • Znajdź swoją ekipę!' });

        const sentMsg = await channel.send({ embeds: [embed] });
        await sentMsg.pin().catch(() => {});
    } catch (e) { console.error('Błąd setupLfgChannelInstruction:', e); }
}

async function setupShowcaseChannelInstruction() {
    try {
        const channel = await client.channels.fetch(ID_KANALU_POKAZ_SIEBIE).catch(() => null) as TextChannel;
        if (!channel) return;
        const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
        if (messages) {
            for (const [_, msg] of messages) {
                if (msg.author.id === client.user?.id) await msg.delete().catch(() => {});
            }
        }

        const embed = new EmbedBuilder()
            .setColor(0xE91E63)
            .setTitle('📸 Przedstaw się społeczności PJN!')
            .setDescription('Witaj na kanale dedykowanym naszym członkom! Chcesz, aby inni Cię poznali? To idealne miejsce, aby pokazać siebie światu.\n\n✨ **Co możesz tutaj wrzucić?**\n• Swoje zdjęcie 📷\n• Kilka słów o sobie 🎧🎮\n\n💬 **Wątki dyskusyjne:**\nPod każdym Twoim zdjęciem bot **automatycznie utworzy osobny wątek do dyskusji**!')
            .setImage(LIVE_IMAGE_URL)
            .setTimestamp()
            .setFooter({ text: 'PJN Strefa Społeczności • Pokaż się nam!' });

        const sentMsg = await channel.send({ embeds: [embed] });
        await sentMsg.pin().catch(() => {});
    } catch (e) { console.error('Błąd setupShowcaseChannelInstruction:', e); }
}

async function setupReputationChannelInstruction() {
    try {
        const channel = await client.channels.fetch(ID_KANAL_REPUTACJI).catch(() => null) as TextChannel;
        if (!channel) return;
        const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
        if (messages) {
            for (const [_, msg] of messages) {
                if (msg.author.id === client.user?.id) await msg.delete().catch(() => {});
            }
        }

        const embed = new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle('⭐ System Reputacji i Bezpiecznych Wymian Duszków Fortnite')
            .setDescription('Witaj w oficjalnym centrum reputacji handlowej serwera PJN! Ten kanał służy do oceniania rzetelności innych traderów po zakończonej wymianie.\n\n📜 **Zasady nadawania reputacji:**\n• Oceniaj wyłącznie osoby, z którymi faktycznie dokonałeś wymiany.\n• Komendy: `+rep @użytkownik`, `-rep @użytkownik`.')
            .setImage(LIVE_IMAGE_URL)
            .setTimestamp()
            .setFooter({ text: 'PJN System Reputacji • Handluj bezpiecznie' });

        const sentMsg = await channel.send({ embeds: [embed] });
        await sentMsg.pin().catch(() => {});
    } catch (e) { console.error('Błąd setupReputationChannelInstruction:', e); }
}

async function updateTraderRoles(member: any, reputation: number) {
    if (!member) return;
    try {
        const hasWzorowy = member.roles.cache.has(ID_RANGI_WZOROWY_TRADER);
        const hasPozytywny = member.roles.cache.has(ID_RANGI_POZYTYWNY_TRADER);
        const hasNegatywny = member.roles.cache.has(ID_RANGI_NEGATYWNY_TRADER);

        if (reputation >= 50 && !hasWzorowy) await member.roles.add(ID_RANGI_WZOROWY_TRADER).catch(() => {});
        else if (reputation < 50 && hasWzorowy) await member.roles.remove(ID_RANGI_WZOROWY_TRADER).catch(() => {});

        if (reputation >= 10 && reputation < 50 && !hasPozytywny) await member.roles.add(ID_RANGI_POZYTYWNY_TRADER).catch(() => {});
        else if ((reputation < 10 || reputation >= 50) && hasPozytywny) await member.roles.remove(ID_RANGI_POZYTYWNY_TRADER).catch(() => {});

        if (reputation <= -5 && !hasNegatywny) await member.roles.add(ID_RANGI_NEGATYWNY_TRADER).catch(() => {});
        else if (reputation > -5 && hasNegatywny) await member.roles.remove(ID_RANGI_NEGATYWNY_TRADER).catch(() => {});
    } catch (e) { console.error('Błąd updateTraderRoles:', e); }
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

    if (user.messageCount >= 25000) addBadge('🧠 **Wygadany Mędrzec (25k Wiadomości)**');
    if (user.voiceMinutes >= 30000) addBadge('🎙️ **Duch Kanałów Głosowych (500h na Głosie, Elitarna)**'); 
    if (user.balance >= 1000000) addBadge('🏛️ **Miliarder PJN (1 000 000 Coinsów, Elitarna)**');
    if (user.totalDonated >= 50000) addBadge('🤝 **Filantrop Społeczności (50 000 Przekazanych Coinsów)**');
    if (user.casinoPlays >= 500) addBadge('🎰 **Hazardowy Tycoon (500 Gier w Kasynie)**');
    if (user.consecutiveWins >= 20) addBadge('🔥 **Niepowstrzymana Seria (20 Wygranych z Rzędu, Epicka)**');

    if (newBadges.length > 0) {
        await user.save();
        const targetMember = memberOrUser.user ? memberOrUser : null;
        const targetUserObj = targetMember ? targetMember.user : memberOrUser;
        const targetGuild = guild || (targetMember ? targetMember.guild : null) || (client.guilds.cache.first());

        try {
            await targetUserObj.send({
                embeds: [new EmbedBuilder().setColor(0xFFD700).setTitle('🎉 Nowa odznaka odblokowana!').setDescription(`Gratulacje! Otrzymałeś nowe odznaki:\n\n` + newBadges.map(b => `• ✨ ${b}`).join('\n')).setTimestamp()]
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
                        .setDescription(`🎮 **SPECJALNE OSIĄGNIĘCIE**\n\nGracz <@${user.userId}> właśnie zdobył unikalne, rzadkie wyróżnienie:\n\n` + rareBadgesToAnnounce.map(b => `> ✨ **${b}**`).join('\n'))
                        .setTimestamp();
                    await announceChannel.send({ content: `<@${user.userId}>`, embeds: [consoleEmbed], allowedMentions: { users: [user.userId] } });
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

    if (leveledUp && user.level % 10 === 0) user.balance += 1500;
    await user.save();

    if (leveledUp) {
        try {
            const channelToSend = await guild.channels.fetch(ID_KANAL_AWANSOW).catch(() => null) as TextChannel;
            if (!channelToSend) return;
            const member = await guild.members.fetch(userId).catch(() => null);
            const avatarUrl = member ? member.user.displayAvatarURL() : client.user?.displayAvatarURL();
            const rankDetails = await getUserLevelRankDetails(userId);

            let rewardText = '';
            if (user.level % 10 === 0) rewardText = `\n\n🎁 **Nagroda za awans na ${user.level} lvl:** Otrzymałeś **1500 PJN-Coins**! 💰`;

            const embed = new EmbedBuilder()
                .setColor(0x9B59B6)
                .setTitle('🚀 AWANS NA WYŻSZY POZIOM!')
                .setThumbnail(avatarUrl)
                .setDescription(`Gratulacje <@${userId}>! Właśnie wskoczyłeś na wyższy poziom na serwerze! 🌟\n\n⭐ **Nowy Poziom:** \`${user.level}\`\n🏆 **Miejsce w rankingu XP:** \`#${rankDetails.rank} z ${rankDetails.total}\`\n🎯 **Twój Postęp:** \`${user.exp} / ${user.level * 150} XP\`` + rewardText)
                .setTimestamp();

            await channelToSend.send({ content: `<@${userId}>`, embeds: [embed], allowedMentions: { users: [userId] } });
        } catch (e) {}
    }
}

async function getTopEmbedData(guild: any) {
    const topUsers = await UserModel.find().sort({ balance: -1 }).limit(10);
    if (topUsers.length === 0) return { color: 0xFFD700, title: '🏆 TOP 10 - Ranking PJN-Coins', description: 'Brak danych w rankingu.' };

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
    return { color: 0xFFD700, title: '🏆 TOP 10 - Ranking PJN-Coins', description: desc };
}

async function getReputationTopEmbedData(guild: any) {
    const topUsers = await UserModel.find().sort({ reputation: -1 }).limit(5);
    if (topUsers.length === 0) return { color: 0xF1C40F, title: '🌟 Aleja Sław - TOP 5 Traderów Reputacji', description: 'Brak danych.' };

    let desc = 'Ranking najlepszych i najbezpieczniejszych traderów Fortnite.\n\n';
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
        desc += `${medal} — **${userName}** — **${sign}${repValue} pkt**\n`;
    }
    return { color: 0xF1C40F, title: '🌟 Aleja Sław - TOP 5 Traderów Reputacji', description: desc, timestamp: new Date().toISOString() };
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
            const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
            if (messages) {
                for (const [_, msg] of messages) {
                    if (msg.author.id === client.user?.id) await msg.delete().catch(() => {});
                }
            }
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
            const expiredLfgDocs = await LFGModel.find({ status: { $ne: 'closed' }, createdAt: { $lte: thirtyMinutesAgo } });

            for (const lfgDoc of expiredLfgDocs) {
                lfgDoc.status = 'closed';
                await lfgDoc.save();
                if (lfgDoc.voiceChannelId) {
                    try {
                        for (const [_, guild] of client.guilds.cache) {
                            const voiceChannel = await guild.channels.fetch(lfgDoc.voiceChannelId).catch(() => null);
                            if (voiceChannel) await voiceChannel.delete('Automatyczne zamknięcie LFG');
                        }
                    } catch (err) {}
                }
            }
        } catch (err) {}
    }, 60 * 1000);
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
                        if (!isRegisteredInDb) await channel.delete('Usuwanie osieroconego kanału LFG').catch(() => {});
                    }
                }
            }
        }
    } catch (e) {}
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

async function sendNotification(targetKey: 'languspjn' | 'elladermusic', platform: 'youtube' | 'tiktok', title: string, url: string, customThumbnail?: string) {
    const channelId = NOTIF_CONFIG[targetKey].channelId;
    const channel = await client.channels.fetch(channelId) as TextChannel;
    if (!channel) return;

    const isYt = platform === 'youtube';
    const color = isYt ? 0xFF0000 : 0x00F2FE;
    const platformName = isYt ? 'YouTube 🎥' : 'TikTok 🎬';
    let thumbnail = customThumbnail;
    if (isYt && url.includes('watch?v=')) {
        const videoId = url.split('v=')[1]?.split('&')[0];
        if (videoId) thumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    }

    const TIKTOK_CUSTOM_IMAGE = "https://cdn.discordapp.com/attachments/1532321067731783684/1542116527858515978/1787739548463.png?ex=6a900f6f&is=6a8ebdef&hm=f6eee91b0b24c61805834c9b99ac1fa66fb9714f92edaeb93ef1ccb08baab79f&";

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`NOWY MATERIAŁ NA ${platformName.toUpperCase()}!`)
        .setDescription(`Cześć społeczności! Właśnie pojawił się nowy film od **${targetKey === 'languspjn' ? 'LangusPJN' : 'elladerMusic'}**. Zostaw po sobie ślad! 👇\n\n**📌 ${title}**`)
        .setImage(thumbnail || (!isYt ? TIKTOK_CUSTOM_IMAGE : LIVE_IMAGE_URL))
        .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setLabel(`Oglądaj na ${isYt ? 'YouTube' : 'TikTok'}`).setStyle(ButtonStyle.Link).setURL(url).setEmoji(isYt ? '▶️' : '🔥')
    );

    await channel.send({ content: '@everyone Nowy film jest już dostępny do obejrzenia!', embeds: [embed], components: [row], allowedMentions: { parse: ['everyone'] } });
}

const lastVideoIds: { [key: string]: string } = {};

async function checkYouTubeRssFeeds() {
    for (const key of ['languspjn', 'elladermusic'] as const) {
        try {
            const feed = await parser.parseURL(NOTIF_CONFIG[key].rssUrl);
            if (feed && feed.items && feed.items.length > 0) {
                const latestItem = feed.items[0];
                const videoUrl = latestItem.link;
                const videoTitle = latestItem.title || 'Nowy film na YouTube';
                if (videoUrl && lastVideoIds[key] !== videoUrl) {
                    if (lastVideoIds[key] !== undefined) await sendNotification(key, 'youtube', videoTitle, videoUrl);
                    lastVideoIds[key] = videoUrl;
                }
            }
        } catch (e) {}
    }
}

function startYouTubeRssChecker() {
    checkYouTubeRssFeeds();
    setInterval(checkYouTubeRssFeeds, 5 * 60 * 1000);
}

const commands = [
    new SlashCommandBuilder().setName('portfel').setDescription('Sprawdź stan swoich PJN-Coins w portfelu'),
    new SlashCommandBuilder().setName('sklep').setDescription('Otwórz podgląd sklepu i sprawdź swoje środki'),
    new SlashCommandBuilder().setName('moje-przedmioty').setDescription('Sprawdź swoje aktywne przedmioty z sklepu i czas ich wygaśnięcia'),
    new SlashCommandBuilder().setName('historia-sklepu').setDescription('Wyświetl historię zakupów (Admin)').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('historia-transakcji').setDescription('Wyświetl historię przelewów i kasyna (Admin)').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
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
    new SlashCommandBuilder().setName('quiz-gra').setDescription('Rozpocznij interaktywny quiz z nagrodami coins'),
    new SlashCommandBuilder().setName('kpn').setDescription('Zagraj w Kamień, Papier, Nożyce').addStringOption(o => o.setName('wybor').setDescription('Wybór').setRequired(true).addChoices({ name: 'Kamień 🪨', value: 'kamien' }, { name: 'Papier 📄', value: 'papier' }, { name: 'Nożyce ✂️', value: 'nozyce' })).addIntegerOption(o => o.setName('stawka').setDescription('Stawka').setRequired(true)),
    new SlashCommandBuilder().setName('odznaki').setDescription('Wyświetla profil z odznakami').addUserOption(o => o.setName('uzytkownik').setDescription('Użytkownik').setRequired(false)),
    new SlashCommandBuilder().setName('exp').setDescription('Sprawdź swój poziom i exp').addUserOption(o => o.setName('uzytkownik').setDescription('User').setRequired(false)),
    new SlashCommandBuilder().setName('reputacja').setDescription('Wyświetla profil handlowy i punkty reputacji').addUserOption(o => o.setName('uzytkownik').setDescription('User').setRequired(false)),
    new SlashCommandBuilder().setName('profil').setDescription('Kompleksowa karta profilu gracza').addUserOption(o => o.setName('uzytkownik').setDescription('User').setRequired(false)),
    new SlashCommandBuilder().setName('ai').setDescription('Zadaj pytanie sztucznej inteligencji PJN AI').addStringOption(o => o.setName('pytanie').setDescription('Pytanie').setRequired(true)),
    new SlashCommandBuilder().setName('ankieta').setDescription('Stwórz interaktywną ankietę').addStringOption(o => o.setName('pytanie').setDescription('Pytanie').setRequired(true)).addStringOption(o => o.setName('opcje').setDescription('Opcje po przecinku').setRequired(true)).addStringOption(o => o.setName('czas').setDescription('Czas trwania').setRequired(false).addChoices({ name: '15 minut', value: '15m' }, { name: '1 godzina', value: '1h' }, { name: '6 godzin', value: '6h' }, { name: '24 godziny', value: '24h' })).setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    new SlashCommandBuilder().setName('fn-sklep').setDescription('Sklep Fortnite'),
    new SlashCommandBuilder().setName('fn-stats').setDescription('Statystyki Fortnite').addStringOption(o => o.setName('nick').setDescription('Nick').setRequired(false)).addStringOption(o => o.setName('id').setDescription('ID').setRequired(false)),
    new SlashCommandBuilder().setName('fn-mapa').setDescription('Mapa Fortnite'),
    new SlashCommandBuilder().setName('fn-rejestracja').setDescription('Zarejestruj nick Epic Games').addStringOption(o => o.setName('nick').setDescription('Nick').setRequired(true)),
    new SlashCommandBuilder().setName('fn-top').setDescription('Odśwież rankingi Fortnite'),
    new SlashCommandBuilder().setName('daj-bonus-wygranych').setDescription('100% wygranych na 30 min (Admin)').addUserOption(o => o.setName('uzytkownik').setDescription('User').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('daj-wszystkim').setDescription('Rozdaj coinsy każdemu (Admin)').addIntegerOption(o => o.setName('ilosc').setDescription('Ile').setRequired(true)).addStringOption(o => o.setName('powod').setDescription('Powód').setRequired(false)).setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('reset-ekonomii').setDescription('Reset ekonomii (Admin)').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('nowości').setDescription('Ogłoszenie nowości (Admin)').addStringOption(o => o.setName('tytul').setDescription('Tytuł').setRequired(true)).addStringOption(o => o.setName('co_nowego').setDescription('Opis').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('odpalstream').setDescription('Ogłoś start streama (Admin)').addStringOption(o => o.setName('tytul').setDescription('Tytuł').setRequired(true)).addStringOption(o => o.setName('link').setDescription('Link').setRequired(true)),
    new SlashCommandBuilder().setName('zakonczstream').setDescription('Zakończ stream (Admin)'),
    new SlashCommandBuilder().setName('powiadomienie').setDescription('Ręczne powiadomienie YT/TikTok (Admin)').addStringOption(opt => opt.setName('tworca').setDescription('Twórca').setRequired(true).addChoices({ name: 'LangusPJN', value: 'languspjn' }, { name: 'elladerMusic', value: 'elladermusic' })).addStringOption(opt => opt.setName('platforma').setDescription('Platforma').setRequired(true).addChoices({ name: 'YouTube 🎥', value: 'youtube' }, { name: 'TikTok 🎬', value: 'tiktok' })).addStringOption(opt => opt.setName('tytul').setDescription('Tytuł').setRequired(true)).addStringOption(opt => opt.setName('link').setDescription('Link').setRequired(true)).addStringOption(opt => opt.setName('miniatura').setDescription('Miniaturka').setRequired(false)).setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('daj-odznake').setDescription('Przyznaj odznakę (Admin)').addUserOption(o => o.setName('uzytkownik').setDescription('User').setRequired(true)).addStringOption(o => o.setName('odznaka').setDescription('Odznaka').setRequired(true).setAutocomplete(true)),
    new SlashCommandBuilder().setName('zabierz-odznake').setDescription('Odbierz odznakę (Admin)').addUserOption(o => o.setName('uzytkownik').setDescription('User').setRequired(true)).addStringOption(o => o.setName('odznaka').setDescription('Odznaka').setRequired(true).setAutocomplete(true)),
    new SlashCommandBuilder().setName('dajpunkty').setDescription('Daj punkty (Admin)').addUserOption(o => o.setName('uzytkownik').setDescription('User').setRequired(true)).addIntegerOption(o => o.setName('ilosc').setDescription('Ile').setRequired(true)).addStringOption(o => o.setName('powod').setDescription('Powód').setRequired(false)),
    new SlashCommandBuilder().setName('zabierzpunkty').setDescription('Zabierz punkty (Admin)').addUserOption(o => o.setName('uzytkownik').setDescription('User').setRequired(true)).addIntegerOption(o => o.setName('ilosc').setDescription('Ile').setRequired(true)),
    new SlashCommandBuilder().setName('cytat').setDescription('Wyślij cytat'),
    new SlashCommandBuilder().setName('dodaj-cytat').setDescription('Dodaj cytat').addStringOption(o => o.setName('tekst').setDescription('Tekst').setRequired(true)).addStringOption(o => o.setName('autor').setDescription('Autor').setRequired(true)),
    new SlashCommandBuilder().setName('mem').setDescription('Generator memów').addStringOption(o => o.setName('szablon').setDescription('Szablon').setRequired(true).setAutocomplete(true)).addStringOption(o => o.setName('gora').setDescription('Góra').setRequired(false)).addStringOption(o => o.setName('dol').setDescription('Dół').setRequired(false)),
    new SlashCommandBuilder().setName('szukam').setDescription('Szukaj ekipy do gry (LFG)').addStringOption(option => option.setName('gra').setDescription('Gra').setRequired(true).addChoices({ name: 'Fortnite', value: 'fortnite' }, { name: 'Counter-Strike 2', value: 'cs2' }, { name: 'Minecraft', value: 'minecraft' }, { name: 'GTA V / Online', value: 'gta' }, { name: 'Valorant', value: 'valorant' }, { name: 'League of Legends', value: 'lol' })).addIntegerOption(option => option.setName('osoby').setDescription('Liczba osób').setRequired(true).setMinValue(2).setMaxValue(10)).addStringOption(option => option.setName('opis').setDescription('Opis').setRequired(false)),
    new ContextMenuCommandBuilder().setName('Zapisz jako złoty tekst').setType(ApplicationCommandType.Message)
].map(c => c.toJSON());

client.once('ready', async () => {
    console.log(`Zalogowano jako ${client.user?.tag}!`);
    await seedQuotesIfNeeded();
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
    await cleanupOrphanedLfgVoices();

    const rest = new REST({ version: '10' }).setToken(token);
    try {
        console.log('Rozpoczęto rejestrowanie komend globalnych...');
        await rest.put(Routes.applicationCommands(client.user!.id), { body: commands });
        console.log('Pomyślnie zarejestrowano komendy globalne!');

        for (const [_, guild] of client.guilds.cache) {
            await rest.put(Routes.applicationGuildCommands(client.user!.id, guild.id), { body: commands });
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
    startYouTubeRssChecker();
    startLfgAutoCloser();
    startExpirationChecker();
    startDailyShopAutoPoster(); 
    startFortniteRankingCron();
    startFortniteStatusCron(); 
    startServerStatsCron();
    startPollChecker();
});

client.on('interactionCreate', async interaction => {
    try {
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
                    const embed = new EmbedBuilder().setColor(0xE67E22).setTitle('✨ Złota myśl z serwera PJN').setDescription(`> *„${quoteText}”*\n\n**— ${authorTag}**`).setTimestamp();
                    await channel.send({ embeds: [embed] });
                }
                await interaction.editReply({ content: `✅ Pomyślnie dodano wiadomość do **Złotych myśli** (<#${ID_KANALU_ZLOTE_MYSLI}>)!` });
                return;
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
            const stakeStr = interaction.fields.getTextInputValue('rr_stake_input');
            const stake = parseInt(stakeStr);
            if (isNaN(stake) || stake <= 0) return interaction.editReply({ content: '❌ Podaj prawidłową stawkę.' });

            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) user = await UserModel.create({ userId: interaction.user.id });
            if (user.balance < stake) return interaction.editReply({ content: `❌ Nie masz tylu środków! Posiadasz **${user.balance} PJN-Coins**.` });

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
                return interaction.editReply({ content: `🎯 **Rosyjska Ruletka:** <@${interaction.user.id}> zaryzykował **${stake} PJN-Coins** i pociągnął za spust...\n💥 **BAM!** Trafiłeś na kulę! Straciłeś monety! (Stan portfela: **${user.balance}**)` });
            } else {
                const winAmount = stake * 2;
                user.balance += winAmount;
                user.consecutiveWins = (user.consecutiveWins || 0) + 1;
                user.consecutiveLosses = 0;
                await user.save();
                await TransactionHistoryModel.create({ userId: interaction.user.id, type: 'casino_roulette', amount: stake, details: `Wygrana (Stawka: ${stake})` });
                return interaction.editReply({ content: `🎯 **Rosyjska Ruletka:** <@${interaction.user.id}> zaryzykował **${stake} PJN-Coins**...\n✨ **Klik!** Przeżyłeś ryzykowny strzał i wygrywasz **${winAmount} PJN-Coins**! (Stan portfela: **${user.balance}**)` });
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
                    return interaction.editReply({ content: `⏳ <@${interaction.user.id}>, Koło Fortuny możesz kręcić raz na 2 godziny! Spróbuj za **${hoursLeft}h ${minsLeft}m**.` });
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
                return interaction.editReply({ content: `🎡 **Koło Fortuny:** <@${interaction.user.id}> zakręcił kołem i wylosował: **${outcome.name}**! (Stan portfela: **${user.balance} PJN-Coins**)` });
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
                return interaction.editReply({ content: `🎡 **Koło Fortuny:** <@${interaction.user.id}> trafił na **${outcome.name}**!` });
            }
        }

        if (interaction.isButton() && interaction.customId.startsWith('quiz_')) {
            await interaction.deferReply({ ephemeral: true });
            if (interaction.customId === 'quiz_correct') {
                let user = await UserModel.findOne({ userId: interaction.user.id });
                if (!user) user = await UserModel.create({ userId: interaction.user.id });
                user.balance += 250;
                await user.save();
                return interaction.editReply({ content: '✅ **Prawidłowa odpowiedź!** Otrzymujesz nagrodę **250 PJN-Coins**!' });
            } else {
                return interaction.editReply({ content: '❌ **Błędna odpowiedź!**' });
            }
        }

        if (interaction.isButton() && (interaction.customId.startsWith('poll_vote_') || interaction.customId === 'poll_show_voters')) {
            const poll = await PollModel.findOne({ messageId: interaction.message.id });
            if (!poll) return interaction.reply({ content: '❌ Ta ankieta nie istnieje.', ephemeral: true });

            if (interaction.customId === 'poll_show_voters') {
                if (!isAuthorized(interaction.user.id) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: '❌ Tylko administratorzy mogą to podejrzeć!', ephemeral: true });
                }
                let votersDesc = `🔍 **Szczegóły głosowania:**\n\n`;
                for (let i = 0; i < poll.options.length; i++) {
                    const optionVoters = poll.votes[i];
                    const votersTagList = optionVoters.length > 0 ? optionVoters.map(id => `<@${id}>`).join(', ') : 'Brak';
                    votersDesc += `**${i + 1}. ${poll.options[i]}** (${optionVoters.length}):\n${votersTagList}\n\n`;
                }
                return interaction.reply({ content: votersDesc, ephemeral: true });
            }

            if (poll.ended) return interaction.reply({ content: '❌ Ta ankieta została zakończona!', ephemeral: true });
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
            let desc = `📊 **Ankieta aktywna na żywo**\n\n`;
            const components: ActionRowBuilder<ButtonBuilder>[] = [];
            let currentRow = new ActionRowBuilder<ButtonBuilder>();

            for (let i = 0; i < poll.options.length; i++) {
                const count = poll.votes[i].length;
                const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                const bar = '█'.repeat(Math.floor(percent / 10)) + '░'.repeat(10 - Math.floor(percent / 10));
                desc += `**${i + 1}. ${poll.options[i]}**\n\`[${bar}]\` **${percent}%** (${count} głosów)\n\n`;
                currentRow.addComponents(new ButtonBuilder().setCustomId(`poll_vote_${i}`).setLabel(`${i + 1} (${count})`).setStyle(ButtonStyle.Secondary));
                if (currentRow.components.length === 5 || i === poll.options.length - 1) {
                    components.push(currentRow);
                    currentRow = new ActionRowBuilder<ButtonBuilder>();
                }
            }
            components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('poll_show_voters').setLabel('🔍 Kto głosował? (Admin)').setStyle(ButtonStyle.Primary)));
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
                if (!member) return interaction.editReply({ content: '❌ Nie pobrano Twoich danych.' });

                const selectedValue = interaction.values[0];
                const roleVerified = guild.roles.cache.get(ID_RANGI_ZWERYFIKOWANY);
                if (!roleVerified) return interaction.editReply({ content: '❌ Brak rangi zweryfikowanego.' });

                try {
                    await member.roles.add(roleVerified);
                    if (selectedValue === 'verify_male') {
                        const roleMale = guild.roles.cache.get(ID_ROLI_MEZCZYZNA);
                        if (roleMale) await member.roles.add(roleMale);
                        await interaction.editReply({ content: `✅ **Zweryfikowano pomyślnie!**` });
                    } else if (selectedValue === 'verify_female') {
                        const roleFemale = guild.roles.cache.get(ID_ROLI_KOBIETA);
                        if (roleFemale) await member.roles.add(roleFemale);
                        await interaction.editReply({ content: `✅ **Zweryfikowano pomyślnie!**` });
                    }
                } catch (err) {
                    await interaction.editReply({ content: '❌ Błąd nadawania ról weryfikacyjnych.' });
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
                const previewEmbed = new EmbedBuilder()
                    .setColor(canAfford ? 0x2ECC71 : 0xE74C3C)
                    .setTitle(`🛒 Podgląd przedmiotu: ${item.name}`)
                    .setDescription(`📝 **Opis:** ${item.description}\n💰 **Cena:** ${item.price} PJN-Coins\n💼 **Twój stan:** ${user.balance}\n\n` + (canAfford ? `✅ Stać Cię na ten zakup!` : `❌ Brakuje Ci środków!`));

                const components = [];
                if (canAfford) {
                    components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder().setCustomId(`shop_buy_${item.id}`).setLabel('Potwierdź zakup').setStyle(ButtonStyle.Success).setEmoji('🛍️')
                    ));
                }
                await interaction.editReply({ embeds: [previewEmbed], components });
                return;
            }
        }

        if (interaction.isButton()) {
            if (interaction.customId === 'temp_voice_lock' || interaction.customId === 'temp_voice_unlock') {
                await interaction.deferReply({ ephemeral: true });
                const channel = interaction.channel;
                if (!channel || channel.type !== ChannelType.GuildVoice) return interaction.editReply({ content: '❌ Tylko na czacie pokoju głosowego.' });
                const isLocked = interaction.customId === 'temp_voice_lock';
                try {
                    await channel.permissionOverwrites.edit(interaction.guildId!, { Connect: isLocked ? false : null });
                    await interaction.editReply({ content: isLocked ? '🔒 Zablokowano pokój.' : '🔓 Odblokowano pokój.' });
                } catch (e) { await interaction.editReply({ content: '❌ Błąd uprawnień.' }); }
                return;
            }

            if (interaction.customId === 'role_fn_updates_toggle') {
                await interaction.deferReply({ ephemeral: true });
                const member = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
                if (!member) return;
                const role = interaction.guild?.roles.cache.get(ID_RANGI_AKTUALIZACJE_FORTNITE);
                if (!role) return;

                if (member.roles.cache.has(ID_RANGI_AKTUALIZACJE_FORTNITE)) {
                    await member.roles.remove(role);
                    await interaction.editReply({ content: '✅ Usunięto rangę powiadomień Fortnite.' });
                } else {
                    await member.roles.add(role);
                    await interaction.editReply({ content: '✅ Przyznano rangę powiadomień Fortnite.' });
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
                    const topUsers = await UserModel.find({ epicNick: { $ne: null }, matchesPlayed: {$lt: 2800 } }).sort({ fortniteKills: -1 }).limit(100);
                    const payload = await generateFortniteRankingEmbeds(interaction.guild, topUsers, '🟢 TOP • Początkujący (<2800 meczów)', 0x2ECC71, currentPage);
                    await interaction.editReply(payload);
                } else {
                    const topUsers = await UserModel.find({ epicNick: { $ne: null }, matchesPlayed: {$gte: 2800 } }).sort({ fortniteKills: -1 }).limit(100);
                    const payload = await generateFortniteRankingEmbeds(interaction.guild, topUsers, '🔥 TOP • Weterani (2800+ meczów)', 0xE74C3C, currentPage);
                    await interaction.editReply(payload);
                }
                return;
            }

            if (interaction.customId.startsWith('role_')) {
                await interaction.deferReply({ ephemeral: true });
                const roleConfig = ROLE_BUTTONS_MAP[interaction.customId];
                if (!roleConfig) return;
                const member = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
                if (!member) return;
                const role = interaction.guild?.roles.cache.get(roleConfig.roleId);
                if (!role) return;

                if (member.roles.cache.has(roleConfig.roleId)) {
                    await member.roles.remove(role);
                    await interaction.editReply({ content: `✅ Usunięto rangę **${role.name}**.` });
                } else {
                    await member.roles.add(role);
                    await interaction.editReply({ content: `✅ Przyznano rangę **${role.name}**!` });
                }
                return;
            }

            if (interaction.customId.startsWith('shop_buy_')) {
                await interaction.deferReply({ ephemeral: true });
                const itemId = interaction.customId.replace('shop_buy_', '');
                const item = SHOP_ITEMS.find(i => i.id === itemId);
                if (!item) return;

                let user = await UserModel.findOne({ userId: interaction.user.id });
                if (!user) user = await UserModel.create({ userId: interaction.user.id });
                if (user.balance < item.price) return interaction.editReply({ content: `❌ Brak środków!` });

                user.balance -= item.price;
                await user.save();
                await ShopHistoryModel.create({ userId: interaction.user.id, itemName: item.name, price: item.price });

                const member = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
                await checkAndAwardBadges(user, member, interaction.guild);

                if (item.type === 'vip') {
                    user.vipExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                    await user.save();
                    if (member) await member.roles.add(ID_ROLI_VIP).catch(() => {});
                } else if (item.type === 'double_chance') {
                    user.doubleChanceUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                    await user.save();
                } else if (item.type === 'badge') {
                    if (!user.badges.includes(item.badgeName)) {
                        user.badges.push(item.badgeName);
                        await user.save();
                    }
                }
                await interaction.editReply({ content: `🎉 Zakupiono **${item.name}**!` });
                return;
            }

            if (interaction.customId === 'create_ticket') {
                await interaction.deferReply({ ephemeral: true });
                const guild = interaction.guild;
                if (!guild) return;
                try {
                    const ticketChannel = await guild.channels.create({
                        name: `ticket-${interaction.user.username}`,
                        type: ChannelType.GuildText,
                        permissionOverwrites: [
                            { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                            { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                            { id: ID_RANGI_DUSZKOWIEC, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                            { id: ID_RANGI_MODERATOR, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                            { id: ID_RANGI_ADMIN, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                        ]
                    });

                    const welcomeEmbed = new EmbedBuilder().setColor(0x2ECC71).setTitle(`🎫 Ticket od: ${interaction.user.tag}`).setDescription(`Napisz, czego potrzebujesz.`).setTimestamp();
                    const closeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('close_ticket').setLabel('Zamknij Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒'));

                    await ticketChannel.send({ content: `<@${interaction.user.id}> | <@&${ID_RANGI_DUSZKOWIEC}>`, embeds: [welcomeEmbed], components: [closeRow] });
                    await interaction.editReply({ content: `✅ Stworzono ticket: <#${ticketChannel.id}>!` });
                } catch (err) { await interaction.editReply({ content: '❌ Błąd tworzenia ticketu.' }); }
                return;
            }

            if (interaction.customId === 'close_ticket') {
                await interaction.deferReply({ ephemeral: true });
                const channel = interaction.channel as TextChannel;
                if (!channel) return;
                try {
                    await channel.setName(`zamkniety-${channel.name}`).catch(() => {});
                    await channel.send({ embeds: [new EmbedBuilder().setColor(0xE74C3C).setTitle('🔒 Ticket Zamknięty').setTimestamp()] });
                    await interaction.editReply({ content: '✅ Zamknięto ticket.' });
                } catch (e) {}
                return;
            }
        }

        if (interaction.isAutocomplete()) {
            const focusedValue = interaction.options.getFocused();
            if (interaction.commandName === 'mem') {
                try {
                    const response = await fetch('https://api.imgflip.com/get_memes');
                    const data = await response.json() as any;
                    if (data && data.success) {
                        const filtered = data.data.memes.filter((m: any) => m.name.toLowerCase().includes(focusedValue.toLowerCase())).slice(0, 25);
                        await interaction.respond(filtered.map((m: any) => ({ name: m.name, value: m.id })));
                    } else await interaction.respond([]);
                } catch (err) { await interaction.respond([]); }
                return;
            }
            if (interaction.commandName === 'daj-odznake' || interaction.commandName === 'zabierz-odznake') {
                const filtered = AVAILABLE_BADGES.filter(b => b.toLowerCase().includes(focusedValue.toLowerCase())).slice(0, 25);
                await interaction.respond(filtered.map(b => ({ name: b.replace(/[*_]/g, ''), value: b })));
                return;
            }
        }

        if (!interaction.isChatInputCommand()) return;
        const { commandName } = interaction;

        if (commandName === 'ai') {
            await interaction.deferReply();
            const question = interaction.options.getString('pytanie', true);
            const aiResponseText = await askGemini(question);
            const embed = new EmbedBuilder().setColor(0x00D9FF).setTitle('🤖 Odpowiedź PJN AI').setDescription(`> **Pytanie:** *${question}*\n\n${aiResponseText}`).setTimestamp();
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        if (commandName === 'kpn') {
            await interaction.deferReply();
            const wyborGracza = interaction.options.getString('wybor', true);
            const stawka = interaction.options.getInteger('stawka', true);
            if (stawka <= 0) return interaction.editReply({ content: '❌ Stawka musi > 0.' });

            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) user = await UserModel.create({ userId: interaction.user.id });
            if (user.balance < stawka) return interaction.editReply({ content: `❌ Brak środków.` });

            const opcje = ['kamien', 'papier', 'nozyce'];
            let wyborBota = opcje[Math.floor(Math.random() * opcje.length)];
            let change = 0;
            let wynikText = '';

            if (wyborGracza === wyborBota) wynikText = `🤝 Remis! Bot wybrał \`${wyborBota}\`.`;
            else if ((wyborGracza === 'kamien' && wyborBota === 'nozyce') || (wyborGracza === 'papier' && wyborBota === 'kamien') || (wyborGracza === 'nozyce' && wyborBota === 'papier')) {
                change = stawka;
                user.balance += change;
                wynikText = `🎉 **Wygrana!** Bot wybrał \`${wyborBota}\`. Zyskujesz **${stawka} PJN-Coins**!`;
            } else {
                change = -stawka;
                user.balance += change;
                wynikText = `❌ **Przegrana!** Bot wybrał \`${wyborBota}\`.`;
            }
            await user.save();
            await TransactionHistoryModel.create({ userId: interaction.user.id, type: 'casino_kpn', amount: change, details: `Gracz: ${wyborGracza}, Bot: ${wyborBota}` });
            return interaction.editReply({ content: wynikText });
        }

        if (commandName === 'quiz-gra') {
            const randomQuiz = QUIZ_POOL[Math.floor(Math.random() * QUIZ_POOL.length)];
            const buttons = [
                { label: randomQuiz.correct, id: 'quiz_correct' },
                { label: randomQuiz.wrong1, id: 'quiz_wrong_1' },
                { label: randomQuiz.wrong2, id: 'quiz_wrong_2' }
            ].sort(() => Math.random() - 0.5);

            await interaction.reply({
                content: `❓ **Quiz PJN:** ${randomQuiz.q}`,
                components: [new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.map(b => new ButtonBuilder().setCustomId(b.id).setLabel(b.label).setStyle(ButtonStyle.Secondary)))]
            });
            return;
        }

        if (commandName === 'portfel') {
            await interaction.deferReply({ ephemeral: true });
            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) user = await UserModel.create({ userId: interaction.user.id });
            await interaction.editReply({ content: `💰 Posiadasz **${user.balance} PJN-Coins!**` });
            return;
        }

        if (commandName === 'daily') {
            await interaction.deferReply();
            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) user = await UserModel.create({ userId: interaction.user.id });
            user.balance += 100;
            await user.save();
            await interaction.editReply({ content: `🎁 Otrzymałeś codzienne **100 PJN-Coins**!` });
            return;
        }

    } catch (error) {
        console.error('Błąd obsługi interakcji/komendy:', error);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Wystąpił błąd podczas wykonywania tej komendy.', ephemeral: true }).catch(() => {});
        }
    }
});

client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;
    try {
        let user = await UserModel.findOne({ userId: message.author.id });
        if (!user) user = await UserModel.create({ userId: message.author.id });
        user.messageCount = (user.messageCount || 0) + 1;
        user.balance += 1;
        await user.save();
        await addExp(message.author.id, 50, message.guild);
    } catch (e) {}
});

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running 24/7!\n');
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Serwer HTTP nasłuchuje na porcie ${PORT}`);
});

client.login(token);
