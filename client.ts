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

// === INICJALIZACJA GEMINI AI ===
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }); // Jawne przekazanie klucza

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
    '🎖️ **Zaawansowany klient sklepu PJN**',
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

// === POMOCNICZA FUNKCJA DO OBSŁUGI GEMINI Z POPRAWNYM LOGOWANIEM BŁĘDÓW ===
async function askGemini(promptText: string): Promise<string> {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: promptText,
            config: {
                systemInstruction: "Jesteś pomocnym, inteligentnym i lekko dowcipnym asystentem AI na serwerze Discord społeczności PJN. Odpowiadaj w języku polskim w sposób zwięzły, konkretny i czytelny dla graczy.",
            }
        });
        return response.text || "Przepraszam, ale nie udało mi się wygenerować odpowiedzi.";
    } catch (error: any) {
        console.error("SZCZEGÓŁOWY BŁĄD GEMINI:", error?.response?.data || error.message || error);
        return "Wystąpił błąd podczas łączenia z systemem sztucznej inteligencji.";
    }
}

// === PULA PYTAŃ DLA QUIZU ===
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
                '• Możesz kręcić raz na 2 godziny całkowicie za darmo!\n' +
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
                '🃏 **6. Poker**\n> Kanał dedykowany: <#1534060082084577350> (Komenda: `/poker [tryb] [stawka]`)\n\n' +
                '🎯 **7. Rosyjska Ruletka**\n> Kanał specjalny: <#1549791536336732240> — Ryzykuj stawkę w rewolwerze!\n\n' +
                '🎡 **8. Koło Fortuny**\n> Kanał specjalny: <#1549791621942485120> — Kręć kołem i wygrywaj darmowe nagrody!'
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
        .setTitle('✨ Złota myśl z serwera PJN')
        .setDescription(`> *„${quote.text}”*\n\n**— ${quote.author}**`)
        .setTimestamp()
        .setFooter({ text: 'PJN Złote Myśli' });

    await channel.send({ 
        content: '@everyone', 
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

let lastFortniteIncidentId: string | null = null;
let lastFortniteStatusState: string | null = null;

async function setupFortniteUpdateChannel() {
    try {
        const channel = await client.channels.fetch(ID_KANAL_AKTUALIZACJI_FORTNITE).catch(() => null) as TextChannel;
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

            await channel.send({
                content: `${rolePing} 🚨 Zapowiedziano nową przerwę techniczną w Fortnite!`,
                embeds: [embed],
                allowedMentions: { roles: [ID_RANGI_AKTUALIZACJE_FORTNITE] }
            });
        }

        if (currentStatusState !== 'operational' && currentStatusState !== 'none' && lastFortniteStatusState === 'operational') {
            const embed = new EmbedBuilder()
                .setColor(0xE74C3C)
                .setTitle('🛑 Serwery Fortnite zostały ZAMKNIĘTE (Przerwa techniczna)!')
                .setDescription(
                    `Serwery gry przestały odpowiadać lub rozpoczęła się właściwa aktualizacja. Matchmaking został wyłączony.\n\n` +
                    `⚙️ Trwa wdrażanie nowej łatki/aktualizacji. Prosimy cierpliwie czekać na powrót serwerów!`
                )
                .setTimestamp()
                .setFooter({ text: 'Epic Games Status • Serwery Offline' });

            await channel.send({
                content: `${rolePing} 🛑 Serwery Fortnite zostały wyłączone do aktualizacji!`,
                embeds: [embed],
                allowedMentions: { roles: [ID_RANGI_AKTUALIZACJE_FORTNITE] }
            });
        }

        if (currentStatusState === 'operational' && lastFortniteStatusState && lastFortniteStatusState !== 'operational' && lastFortniteStatusState !== 'none') {
            const embed = new EmbedBuilder()
                .setColor(0x2ECC71)
                .setTitle('✅ Serwery Fortnite zostały OTWARTE!')
                .setDescription(
                    `Przerwa techniczna / aktualizacja dobiegła końca! Wszystkie systemy gry działają poprawnie.\n\n` +
                    `🎮 Można już uruchamiać grę, pobierać aktualizację i wracać do walki! Powodzenia w meczach! 🚀`
                )
                .setTimestamp()
                .setFooter({ text: 'Epic Games Status • Serwery Online' });

            await channel.send({
                content: `${rolePing} 🎉 Serwery Fortnite są już otwarte! Można wracać do gry!`,
                embeds: [embed],
                allowedMentions: { roles: [ID_RANGI_AKTUALIZACJE_FORTNITE] }
            });
        }

        lastFortniteStatusState = currentStatusState;
    } catch (err) {
        console.error('Błąd podczas sprawdzania statusu Epic Games:', err);
    }
}

function startFortniteStatusCron() {
    cron.schedule('*/2 * * * *', async () => {
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

        await updateAllFortniteStats();

        const messages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
        if (messages) {
            for (const [_, msg] of messages) {
                if (msg.author.id === client.user?.id) {
                    await msg.delete().catch(() => {});
                }
            }
        }

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
                    { customVoiceExpiresAt: { $ne: null, $lte: now } }
                ]
            });

            for (const userDoc of expiredUsers) {
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
                                desc += `**${i + 1}. ${poll.options[i]}** — **${percent}%** (${count} głosów)\n`;
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
        .setTitle('🎫 Centrum Pomocy i Zgłoszeń PJN')
        .setDescription(
            'Potrzebujesz pomocy z duszkiem? Dobrze trafiłeś!\n\n' +
            'Kliknij poniższy przycisk **"Stwórz Ticket"**, aby otworzyć prywatny kanał. Nasza ekipa pomoże Ci tak szybko, jak to możliwe!\n\n' +
            '⚠️ *Prosimy nie tworzyć zgłoszeń bez potrzeby – szanujmy swój czas.*'
        )
        .setTimestamp()
        .setFooter({ text: 'PJN System Ticketów • Bezpieczna pomoc' });
}

async function setupTicketChannel() {
    try {
        const channel = await client.channels.fetch(ID_KANALU_DUSZKI).catch(() => null) as TextChannel;
        if (!channel) return;

        const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
        if (messages) {
            for (const [_, msg] of messages) {
                if (msg.author.id === client.user?.id) {
                    await msg.delete().catch(() => {});
                }
            }
        }

        const embed = createTicketPanelEmbed();
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId('create_ticket')
                .setLabel('Stwórz Ticket')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🎫')
        );

        await channel.send({ embeds: [embed], components: [row] });
    } catch (e) {
        console.error('Błąd podczas inicjalizacji panelu ticketów:', e);
    }
}

async function setupRolesChannel() {
    try {
        const channel = await client.channels.fetch(ID_KANAL_RANG).catch(() => null) as TextChannel;
        if (!channel) return;

        const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
        if (messages) {
            for (const [_, msg] of messages) {
                if (msg.author.id === client.user?.id) {
                    await msg.delete().catch(() => {});
                }
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
    } catch (e) {
        console.error('Błąd podczas ustawiania kanału ról:', e);
    }
}

async function setupMemeChannelInstruction() {
    try {
        const channel = await client.channels.fetch(ID_KANALU_MEMOW).catch(() => null) as TextChannel;
        if (!channel) return;

        const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
        if (messages) {
            for (const [_, msg] of messages) {
                if (msg.author.id === client.user?.id) {
                    await msg.delete().catch(() => {});
                }
            }
        }

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

        const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
        if (messages) {
            for (const [_, msg] of messages) {
                if (msg.author.id === client.user?.id) {
                    await msg.delete().catch(() => {});
                }
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

        const messages = await channel.messages.fetch({ limit: 50 }).catch(() => null);
        if (messages) {
            for (const [_, msg] of messages) {
                if (msg.author.id === client.user?.id && msg.embeds.length > 0 && msg.embeds[0].title?.includes('Centrum LFG')) {
                    await msg.delete().catch(() => {});
                }
            }
        }

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('🎮 Centrum LFG (Looking For Group) — Jak szukać ekipy do gry?')
            .setDescription(
                'Masz dosyć grania w pojedynkę? Chcesz znaleźć zgrany skład do ulubionej gry? Skorzystaj z naszego automatycznego systemu LFG!\n\n' +
                '🛠️ **Jak stworzyć ogłoszenie o grze?**\n' +
                `1. Wpisz na tym kanale (<#${ID_KANALU_SZUKAM_DO_GRY}>) komendę: \`/szukam\`\n` +
                '2. Wybierz grę z listy (Fortnite, CS2, Minecraft, GTA V, Valorant lub League of Legends).\n' +
                '3. Podaj maksymalną liczbę osób w drużynie oraz dodaj opcjonalny opis (np. ranga, mikrofon, styl gry).\n' +
                '4. Bot wygeneruje interaktywne ogłoszenie wraz z pingiem odpowiedniej roli!\n\n' +
                '👥 **Jak dołączyć do ekipy?**\n' +
                '• Kliknij zielony przycisk **"Dołącz do ekipy"** pod wybranym ogłoszeniem.\n' +
                '• Gdy skład się zapełni (lub autor kliknie utworzenie pokoju), bot **automatycznie utworzy dla Was prywatny kanał głosowy** z odpowiednimi uprawnieniami!\n' +
                '• W każdej chwili możesz opuścić ekipę, klikając czerwony przycisk **"Opuść"**, a jako autor możesz zamknąć ogłoszenie, jeśli się rozmyślisz.'
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

        const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
        if (messages) {
            for (const [_, msg] of messages) {
                if (msg.author.id === client.user?.id) {
                    await msg.delete().catch(() => {});
                }
            }
        }

        const embed = new EmbedBuilder()
            .setColor(0xE91E63)
            .setTitle('📸 Przedstaw się społeczności PJN!')
            .setDescription(
                'Witaj na kanale dedykowanym naszym członkom! Chcesz, aby inni Cię poznali? To idealne miejsce, aby pokazać siebie światu.\n\n' +
                '✨ **Co możesz tutaj wrzucić?**\n' +
                '• Swoje zdjęcie (lub zdjęcie pasji/zwierzaka, jeśli wolisz zachować prywatność) 📷\n' +
                '• Kilka słów o sobie: czym się interesujesz, jakiej słuchasz muzyki, w co grasz? 🎧🎮\n' +
                '• Pozdrowienia dla całej ekipy PJN! 👋\n\n' +
                '💬 **Wątki dyskusyjne:**\n' +
                'Pod każdym Twoim zdjęciem bot **automatycznie utworzy osobny wątek do dyskusji**, dzięki czemu rozmowy nie zaspamują głównej tablicy!'
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

        const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
        if (messages) {
            for (const [_, msg] of messages) {
                if (msg.author.id === client.user?.id) {
                    await msg.delete().catch(() => {});
                }
            }
        }

        const embed = new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle('⭐ System Reputacji i Bezpiecznych Wymian Duszków Fortnite')
            .setDescription(
                'Witaj w oficjalnym centrum reputacji handlowej serwera PJN! Ten kanał służy do oceniania rzetelności innych traderów po zakończonej wymianie.\n\n' +
                '📜 **Zasady nadawania reputacji:**\n' +
                '• Oceniaj wyłącznie osoby, z którymi faktycznie dokonałeś wymiany duszków w Fortnite.\n' +
                '• Możesz ocenić tego samego użytkownika **maksymalnie raz na 24 godziny**.\n' +
                '• Komendy: `+rep @użytkownik`, `-rep @użytkownik`, `/reputacja`.'
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
        desc += `${medal} — **${userName}** — **${sign}${repValue} pkt** (Exp: ${u.exp || 0})\n`;
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

            const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
            if (messages) {
                for (const [_, msg] of messages) {
                    if (msg.author.id === client.user?.id) {
                        await msg.delete().catch(() => {});
                    }
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

async function cleanupOrphanedLfgVoices() {
    try {
        const activeLfgWithVoice = await LFGModel.find({ status: { $ne: 'closed' }, voiceChannelId: { $ne: null } });
        for (const [_, guild] of client.guilds.cache) {
            const category = guild.channels.cache.get(LFG_CONFIG.CATEGORY_VOICE);
            if (category && category.type === ChannelType.GuildCategory) {
                for (const [_, channel] of category.children.cache) {
                    if (channel.type === ChannelType.GuildVoice) {
                        const isRegisteredInDb = activeLfgWithVoice.some(doc => doc.voiceChannelId === channel.id);
                        if (!isRegisteredInDb) {
                            await channel.delete('Usuwanie osieroconego kanału głosowego LFG po resecie bota').catch(() => {});
                        }
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
    } else if (isYt && url.includes('youtu.be/')) {
        const videoId = url.split('youtu.be/')[1]?.split('?')[0];
        if (videoId) thumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    }

    const TIKTOK_CUSTOM_IMAGE = "https://cdn.discordapp.com/attachments/1532321067731783684/1542116527858515978/1787739548463.png?ex=6a900f6f&is=6a8ebdef&hm=f6eee91b0b24c61805834c9b99ac1fa66fb9714f92edaeb93ef1ccb08baab79f&";

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`NOWY MATERIAŁ NA ${platformName.toUpperCase()}!`)
        .setDescription(`Cześć społeczności! Właśnie pojawił się nowy film od **${targetKey === 'languspjn' ? 'LangusPJN' : 'elladerMusic'}**. Zostaw po sobie ślad! 👇\n\n**📌 ${title}**`)
        .setImage(thumbnail || (!isYt ? TIKTOK_CUSTOM_IMAGE : LIVE_IMAGE_URL))
        .setTimestamp()
        .setFooter({ text: `PJN & elladerMusic • System Powiadomień` });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setLabel(`Oglądaj na ${isYt ? 'YouTube' : 'TikTok'}`)
            .setStyle(ButtonStyle.Link)
            .setURL(url)
            .setEmoji(isYt ? '▶️' : '🔥')
    );

    await channel.send({
        content: '@everyone Nowy film jest już dostępny do obejrzenia!',
        embeds: [embed],
        components: [row],
        allowedMentions: { parse: ['everyone'] }
    });
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
                    if (lastVideoIds[key] !== undefined) {
                        await sendNotification(key, 'youtube', videoTitle, videoUrl);
                    }
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
    new SlashCommandBuilder()
        .setName('historia-transakcji')
        .setDescription('Wyświetl historię przelewów, rozdawania punktów i wygranych w kasynie (Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
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
        .setName('ai')
        .setDescription('Zadaj pytanie sztucznej inteligencji PJN AI')
        .addStringOption(o => o.setName('pytanie').setDescription('Twoje pytanie do sztucznej inteligencji').setRequired(true)),
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
        .setName('daj-wszystkim')
        .setDescription('Rozdaje PJN-Coins absolutnie każdemu użytkownikowi w bazie (Admin)')
        .addIntegerOption(o => o.setName('ilosc').setDescription('Ile PJN-Coins ma otrzymać każdy').setRequired(true))
        .addStringOption(o => o.setName('powod').setDescription('Powód przyznania bonusu').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
        .setName('nowości')
        .setDescription('Wyślij ogłoszenie o nowościach na serwer (Admin)')
        .addStringOption(o => o.setName('tytul').setDescription('Tytuł ogłoszenia (np. System Odznak)').setRequired(true))
        .addStringOption(o => o.setName('co_nowego').setDescription('Krótko opisz co faktycznie dodano').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
        .setName('odpalstream')
        .setDescription('Ogłasza start streama (Streamer/Admin)')
        .addStringOption(o => o.setName('tytul').setDescription('Tytuł streama').setRequired(true))
        .addStringOption(o => o.setName('link').setDescription('Link do transmisji (Kick/TikTok)').setRequired(true)),
    new SlashCommandBuilder()
        .setName('zakonczstream')
        .setDescription('Ogłasza zakończenie streama (Streamer/Admin)'),
    new SlashCommandBuilder()
        .setName('powiadomienie')
        .setDescription('Ręcznie wyślij powiadomienie o nowym filmie (YouTube / TikTok)')
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
                    { name: 'YouTube 🎥', value: 'youtube' },
                    { name: 'TikTok 🎬', value: 'tiktok' }
                )
        )
        .addStringOption(opt => opt.setName('tytul').setDescription('Tytuł filmu').setRequired(true))
        .addStringOption(opt => opt.setName('link').setDescription('Link do filmu').setRequired(true))
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
        for (const [_, guild] of client.guilds.cache) {
            await rest.put(Routes.applicationGuildCommands(client.user!.id, guild.id), { body: commands });
            await updateServerStats(guild);
        }
    } catch (error) {
        console.error('Błąd rejestracji:', error);
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

            const channel = await client.channels.fetch(ID_KANALU_CYTATY).catch(() => null) as TextChannel;
            if (channel) {
                const embed = new EmbedBuilder()
                    .setColor(0xE67E22)
                    .setTitle('✨ Złota myśl z serwera PJN')
                    .setDescription(`> *„${quoteText}”*\n\n**— ${authorTag}**`)
                    .setTimestamp();
                await channel.send({ embeds: [embed] });
            }

            await interaction.editReply({ content: `✅ Pomyślnie dodano wiadomość do **Złotych myśli PJN** (<#${ID_KANALU_CYTATY}>)!` });
            return;
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
        await interaction.deferReply({ ephemeral: false });
        const stakeStr = interaction.fields.getTextInputValue('rr_stake_input');
        const stake = parseInt(stakeStr);

        if (isNaN(stake) || stake <= 0) {
            return interaction.editReply({ content: '❌ Podaj prawidłową stawkę większą od zera.' });
        }

        let user = await UserModel.findOne({ userId: interaction.user.id });
        if (!user) user = await UserModel.create({ userId: interaction.user.id });

        if (user.balance < stake) {
            return interaction.editReply({ content: `❌ Nie masz tylu środków! Posiadasz **${user.balance} PJN-Coins**.` });
        }

        user.balance -= stake;
        user.casinoPlays = (user.casinoPlays || 0) + 1;

        const bullet = Math.floor(Math.random() * 6) + 1;
        const choice = Math.floor(Math.random() * 6) + 1;

        if (bullet === choice) {
            user.consecutiveLosses = (user.consecutiveLosses || 0) + 1;
            user.consecutiveWins = 0;
            await user.save();
            await TransactionHistoryModel.create({ userId: interaction.user.id, type: 'casino_roulette', amount: -stake, details: 'Przegrana (Strzał)' });
            return interaction.editReply({ content: `🎯 **Rosyjska Ruletka:** <@${interaction.user.id}> pociągnął za spust ze stawką **${stake} PJN-Coins**...\n💥 **BAM!** Trafiłeś na kulę w komorze ${bullet}. Straciłeś monety! (Stan portfela: **${user.balance}**)` });
        } else {
            const winAmount = stake * 2;
            user.balance += winAmount;
            user.consecutiveWins = (user.consecutiveWins || 0) + 1;
            user.consecutiveLosses = 0;
            await user.save();
            await TransactionHistoryModel.create({ userId: interaction.user.id, type: 'casino_roulette', amount: stake, details: 'Wygrana (Przeżył)' });
            return interaction.editReply({ content: `🎯 **Rosyjska Ruletka:** <@${interaction.user.id}> pociągnął za spust ze stawką **${stake} PJN-Coins**...\n✨ **Klik!** Pusto w komorze ${choice}! Przeżyłeś i wygrywasz **${winAmount} PJN-Coins**! (Stan portfela: **${user.balance}**)` });
        }
    }

    if (interaction.isButton() && interaction.customId === 'wheel_spin') {
        await interaction.deferReply({ ephemeral: false });
        
        let user = await UserModel.findOne({ userId: interaction.user.id });
        if (!user) user = await UserModel.create({ userId: interaction.user.id });

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
            return interaction.editReply({ content: `🎡 **Koło Fortuny:** <@${interaction.user.id}> zakręcił kołem i wylosował: **${outcome.name}**! Jego konto zostało zasilone. (Stan portfela: **${user.balance} PJN-Coins**)` });
        } else if (outcome.type === 'bankrupt') {
            user.balance = Math.max(0, user.balance - 100);
            user.consecutiveLosses = (user.consecutiveLosses || 0) + 1;
            user.consecutiveWins = 0;
            await user.save();
            await TransactionHistoryModel.create({ userId: interaction.user.id, type: 'wheel_fortune', amount: -100, details: 'Bankrut' });
            return interaction.editReply({ content: `🎡 **Koło Fortuny:** O nie! <@${interaction.user.id}> zakręcił kołem i wylosował **BANKRUT**! Traci 100 PJN-Coins. (Stan portfela: **${user.balance} PJN-Coins**)` });
        } else if (outcome.type === 'xp') {
            await addExp(interaction.user.id, outcome.val, interaction.guild);
            await user.save();
            return interaction.editReply({ content: `🎡 **Koło Fortuny:** <@${interaction.user.id}> zakręcił kołem i trafił na **${outcome.name}**! Otrzymuje zastrzyk punktów doświadczenia.` });
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
                
                votersDesc += `**${i + 1}. ${poll.options[i]}** (${optionVoters.length} głosów):\n${votersTagList}\n\n`;
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
            desc += `**${i + 1}. ${poll.options[i]}**\n\`[${bar}]\` **${percent}%** (${count} głosów)\n\n`;

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
                    await interaction.editReply({ content: `✅ **Pomyślnie zweryfikowano!** Otrzymałeś dostęp do serwera oraz rangę męską. Miłej zabawy!` });
                } else if (selectedValue === 'verify_female') {
                    const roleFemale = guild.roles.cache.get(ID_ROLI_KOBIETA);
                    if (roleFemale) await member.roles.add(roleFemale);
                    await interaction.editReply({ content: `✅ **Pomyślnie zweryfikowano!** Otrzymałeś dostęp do serwera oraz rangę damską. Miłej zabawy!` });
                }
            } catch (err) {
                await interaction.editReply({ content: '❌ Wystąpił błąd podczas nadawania ról weryfikacyjnych. Skontaktuj się z administracją.' });
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
                        ? '🔒 Pomyślnie **zablokowałeś** swój pokój (nikt nowy nie może dołączyć).' 
                        : '🔓 Pomyślnie **odblokowałeś** swój pokój (każdy może teraz wejść).' 
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
                    await interaction.editReply({ content: `✅ Pomyślnie **usunięto** rangę powiadomień o aktualizacjach Fortnite z Twojego konta.` });
                } else {
                    await member.roles.add(role);
                    await interaction.editReply({ content: `✅ Pomyślnie **przyznano** rangę powiadomień o aktualizacjach Fortnite! Od teraz będziesz otrzymywać powiadomienia.` });
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
                    await interaction.editReply({ content: `✅ Pomyślnie **usunięto** rangę **${role.name}** z Twojego konta.` });
                } else {
                    await member.roles.add(role);
                    await interaction.editReply({ content: `✅ Pomyślnie **przyznano** rangę **${role.name}**!` });
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
                                    .setDescription(`Twoja transakcja w sklepie serwera **PJN** została pomyślnie zrealizowana!\n\n🟡 Ranga **VIP** została właśnie automatycznie przypisana do Twojego konta na okres **30 dni** na serwerze **${interaction.guild?.name}**.\n\nCiesz się ze swoich nowych przywilejów! 🚀`)
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
                    const memberObj = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
                    await checkAndAwardBadges(user, memberObj || interaction.user, interaction.guild);
                }
            } else if (item.type === 'custom_voice') {
                user.customVoiceExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                await user.save();
            } else if (item.type === 'daily_boost') {
                user.dailyBoostUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                await user.save();
            }

            await interaction.editReply({ content: `🎉 Dziękuję za zakup przedmiotu **${item.name}**! Pomyślnie pobrano **${item.price} PJN-Coins** z Twojego portfela.` });
            return;
        }

        if (interaction.customId === 'create_ticket') {
            await interaction.deferReply({ ephemeral: true });
            const guild = interaction.guild;
            if (!guild) return;

            const existingChannel = guild.channels.cache.find(
                ch => ch.name === `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`
            );

            if (existingChannel) {
                return interaction.editReply({ content: `❌ Masz już otwarty ticket: <#${existingChannel.id}>!` });
            }

            try {
                const ticketChannel = await guild.channels.create({
                    name: `ticket-${interaction.user.username}`,
                    type: ChannelType.GuildText,
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
                    .setTitle(`🎫 Ticket od: ${interaction.user.tag}`)
                    .setDescription(`Witaj <@${interaction.user.id}>!\n\nNapisz jakiego duszka potrzebujesz, ktoś z ekipy wejdzie i od razu zobaczy Twoją wiadomość.\n\nKliknij przycisk **Zamknij Ticket**, gdy już otrzymasz duszka.`)
                    .setTimestamp();

                const closeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder().setCustomId('close_ticket').setLabel('Zamknij Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
                );

                await ticketChannel.send({
                    content: `<@${interaction.user.id}> | <@&${ID_RANGI_DUSZKOWIEC}> <@&${ID_RANGI_MODERATOR}> <@&${ID_RANGI_ADMIN}>`,
                    embeds: [welcomeEmbed],
                    components: [closeRow]
                });

                await interaction.editReply({ content: `✅ Stworzono dla Ciebie prywatny ticket: <#${ticketChannel.id}>!` });
            } catch (err) {
                await interaction.editReply({ content: '❌ Wystąpił błąd podczas tworzenia ticketu.' });
            }
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
                    if (id !== interaction.guild?.id && (overwrite.allow.has(PermissionFlagsBits.SendMessages))) {
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
                if (!currentName.startsWith('zamkniety-')) {
                    await channel.setName(`zamkniety-${currentName.replace('ticket-', '')}`).catch(() => {});
                }

                const closedEmbed = new EmbedBuilder()
                    .setColor(0xE74C3C)
                    .setTitle('🔒 Ticket Został Zamknięty')
                    .setDescription(`Ten ticket został zamknięty przez <@${interaction.user.id}>.\nKanał został zarchiwizowany.`)
                    .setTimestamp();

                await channel.send({ embeds: [closedEmbed] });
                await interaction.editReply({ content: `✅ Pomyślnie zamknięto i zarchiwizowano ten ticket.` });
            } catch (e) {
                await interaction.editReply({ content: `❌ Wystąpił błąd podczas zamykania ticketu.` });
            }
            return;
        }

        if (['lfg_join', 'lfg_leave', 'lfg_create_voice', 'lfg_close'].includes(interaction.customId)) {
            await interaction.deferReply({ ephemeral: true });
            const lfgDoc = await LFGModel.findOne({ messageId: interaction.message.id });

            if (!lfgDoc) {
                return interaction.editReply({ content: '❌ To ogłoszenie LFG jest już nieaktualne.' });
            }

            if (lfgDoc.status === 'closed') {
                return interaction.editReply({ content: '❌ Ta ekipa została już zamknięta.' });
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
                    return interaction.editReply({ content: '❌ Ta ekipa jest już w pełni zapełniona!' });
                }

                lfgDoc.currentPlayers.push(userId);
                if (lfgDoc.currentPlayers.length >= lfgDoc.maxPlayers) lfgDoc.status = 'full';
                await lfgDoc.save();

                if (lfgDoc.status === 'full' && !lfgDoc.voiceChannelId) {
                    try {
                        const guild = interaction.guild;
                        if (guild) {
                            const permissionOverwrites = [{ id: guild.id, deny: [PermissionFlagsBits.ViewChannel] }];
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
                        }
                    } catch (err) {}
                }

                await updateLFGMessage(interaction.message, lfgDoc);
                return interaction.editReply({ content: '✅ Pomyślnie dołączyłeś do ekipy!' });
            }

            if (interaction.customId === 'lfg_leave') {
                if (!lfgDoc.currentPlayers.includes(userId)) {
                    return interaction.editReply({ content: '⚠️ Nie jesteś na liście tej ekipy.' });
                }
                if (lfgDoc.authorId === userId) {
                    return interaction.editReply({ content: '❌ Autor ogłoszenia nie może opuścić własnej ekipy.' });
                }

                lfgDoc.currentPlayers = lfgDoc.currentPlayers.filter(id => id !== userId);
                if (lfgDoc.status === 'full') lfgDoc.status = 'active';
                await lfgDoc.save();

                await updateLFGMessage(interaction.message, lfgDoc);
                return interaction.editReply({ content: '✅ Pomyślnie opuściłeś ekipę.' });
            }

            if (interaction.customId === 'lfg_create_voice') {
                if (lfgDoc.authorId !== userId) {
                    return interaction.editReply({ content: '❌ Tylko autor ogłoszenia może wymusić utworzenie pokoju głosowego!' });
                }
                if (lfgDoc.voiceChannelId) {
                    return interaction.editReply({ content: `⚠️ Kanał głosowy został już utworzony: <#${lfgDoc.voiceChannelId}>!` });
                }

                try {
                    const guild = interaction.guild;
                    if (guild) {
                        const permissionOverwrites = [{ id: guild.id, deny: [PermissionFlagsBits.ViewChannel] }];
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
                        return interaction.editReply({ content: `✅ Pomyślnie utworzono prywatny kanał głosowy: <#${voiceChan.id}>!` });
                    }
                } catch (err) {}
            }
            return;
        }
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
        // === OBSŁUGA KOMENDY /ai ===
        if (commandName === 'ai') {
            await interaction.deferReply();
            const question = interaction.options.getString('pytanie', true);
            const aiResponseText = await askGemini(question);

            const embed = new EmbedBuilder()
                .setColor(0x00D9FF)
                .setTitle('🤖 Odpowiedź PJN AI')
                .setDescription(`> **Pytanie:** *${question}*\n\n${aiResponseText}`)
                .setTimestamp()
                .setFooter({ text: `Zapytanie od: ${interaction.user.tag}` });

            await interaction.editReply({ embeds: [embed] });
            return;
        }

        if (commandName === 'kpn') {
            if (interaction.channelId !== '1534060126980411423') {
                return interaction.reply({ content: '❌ Tę komendę można wykonać tylko na kanale salonu gier (<#1534060126980411423>)!', ephemeral: true });
            }
            await interaction.deferReply();
            const wyborGracza = interaction.options.getString('wybor', true);
            const stawka = interaction.options.getInteger('stawka', true);

            if (stawka <= 0) return interaction.editReply({ content: '❌ Stawka musi być większa od zera.' });

            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) user = await UserModel.create({ userId: interaction.user.id });
            if (user.balance < stawka) return interaction.editReply({ content: `❌ Brak środków (${user.balance} coins).` });

            const opcje = ['kamien', 'papier', 'nozyce'];
            const wyborBota = opcje[Math.floor(Math.random() * opcje.length)];

            let wynikText = '';
            let change = 0;

            if (wyborGracza === wyborBota) {
                wynikText = `🤝 Remis! Wybory były identyczne (\`${wyborBota}\`). Stawka zostaje zwrócona.`;
            } else if (
                (wyborGracza === 'kamien' && wyborBota === 'nozyce') ||
                (wyborGracza === 'papier' && wyborBota === 'kamien') ||
                (wyborGracza === 'nozyce' && wyborBota === 'papier')
            ) {
                change = stawka;
                user.balance += change;
                wynikText = `🎉 **Wygrana!** Bot wybrał \`${wyborBota}\`. Zyskujesz **${stawka} PJN-Coins**!`;
            } else {
                change = -stawka;
                user.balance += change;
                wynikText = `❌ **Przegrana!** Bot wybrał \`${wyborBota}\`. Tracisz **${stawka} PJN-Coins**!`;
            }

            await user.save();
            await TransactionHistoryModel.create({ userId: interaction.user.id, type: 'casino_kpn', amount: change, details: `Gracz: ${wyborGracza}, Bot: ${wyborBota}` });
            return interaction.editReply({ content: wynikText });
        }

        if (commandName === 'quiz-gra') {
            if (interaction.channelId !== '1534060126980411423') {
                return interaction.reply({ content: '❌ Tę komendę można wykonać tylko na kanale salonu gier (<#1534060126980411423>)!', ephemeral: true });
            }

            const randomQuiz = QUIZ_POOL[Math.floor(Math.random() * QUIZ_POOL.length)];
            
            const buttons = [
                { label: randomQuiz.correct, id: 'quiz_correct', style: ButtonStyle.Secondary },
                { label: randomQuiz.wrong1, id: 'quiz_wrong_1', style: ButtonStyle.Secondary },
                { label: randomQuiz.wrong2, id: 'quiz_wrong_2', style: ButtonStyle.Secondary }
            ].sort(() => Math.random() - 0.5);

            await interaction.reply({
                content: `❓ **Quiz PJN:** ${randomQuiz.q}\n*Wybierz odpowiedź poniżej:*`,
                components: [
                    new ActionRowBuilder<ButtonBuilder>().addComponents(
                        buttons.map(b => new ButtonBuilder().setCustomId(b.id).setLabel(b.label).setStyle(b.style))
                    )
                ]
            });
            return;
        }

        if (commandName === 'ankieta') {
            await interaction.deferReply();
            const pytanie = interaction.options.getString('pytanie', true);
            const opcjeTekst = interaction.options.getString('opcje', true);
            const czasWybór = interaction.options.getString('czas');
            const opcje = opcjeTekst.split(',').map(o => o.trim()).filter(o => o.length > 0);

            if (opcje.length < 2 || opcje.length > 10) {
                return interaction.editReply({ content: '❌ Podaj od 2 do 10 opcji oddzielonych przecinkami.' });
            }

            let endsAt: Date | null = null;
            if (czasWybór) {
                const nowMs = Date.now();
                if (czasWybór === '15m') endsAt = new Date(nowMs + 15 * 60 * 1000);
                else if (czasWybór === '1h') endsAt = new Date(nowMs + 60 * 60 * 1000);
                else if (czasWybór === '6h') endsAt = new Date(nowMs + 6 * 60 * 60 * 1000);
                else if (czasWybór === '24h') endsAt = new Date(nowMs + 24 * 60 * 60 * 1000);
            }

            let timeInfo = endsAt ? `⏳ Koniec: <t:${Math.floor(endsAt.getTime() / 1000)}:R>` : '⏳ Ankieta bez limitu czasu';
            let desc = `📊 **Ankieta aktywna na żywo**\n${timeInfo}\n\n`;

            for (let i = 0; i < opcje.length; i++) {
                desc += `**${i + 1}. ${opcje[i]}**\n\`[░░░░░░░░░░]\` **0%** (0 głosów)\n\n`;
            }

            const components: ActionRowBuilder<ButtonBuilder>[] = [];
            let currentRow = new ActionRowBuilder<ButtonBuilder>();
            for (let i = 0; i < opcje.length; i++) {
                currentRow.addComponents(new ButtonBuilder().setCustomId(`poll_vote_${i}`).setLabel(`${i + 1} (0)`).setStyle(ButtonStyle.Secondary));
                if (currentRow.components.length === 5 || i === opcje.length - 1) {
                    components.push(currentRow);
                    currentRow = new ActionRowBuilder<ButtonBuilder>();
                }
            }

            const adminRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('poll_show_voters').setLabel('🔍 Kto głosował? (Admin)').setStyle(ButtonStyle.Primary)
            );
            components.push(adminRow);

            const embed = new EmbedBuilder().setColor(0x3498DB).setTitle(`🗳️ ${pytanie}`).setDescription(desc).setTimestamp();
            const sentMsg = await interaction.editReply({ embeds: [embed], components });

            await PollModel.create({
                messageId: sentMsg.id,
                channelId: interaction.channelId,
                question: pytanie,
                options: opcje,
                votes: opcje.map(() => []),
                ended: false,
                endsAt: endsAt
            });
            return;
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

        if (commandName === 'fn-top') {
            if (!isAuthorized(interaction.user.id)) return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
            await interaction.deferReply({ ephemeral: true });
            await refreshFortniteRankingMessage(interaction.guild);
            await interaction.editReply({ content: `✅ Pomyślnie odświeżono i wysłano rankingi Fortnite na kanale <#${ID_KANAL_RANKING_FORTNITE}>!` });
            return;
        }

        if (commandName === 'fn-sklep' || commandName === 'fn-stats' || commandName === 'fn-mapa') {
            if (interaction.channelId !== ID_KANAL_FORTNITE) {
                return interaction.reply({
                    content: `❌ Tę komendę możesz wykonać wyłącznie na dedykowanym kanale Fortnite: <#${ID_KANAL_FORTNITE}>!`,
                    ephemeral: true
                });
            }

            if (commandName === 'fn-sklep') {
                await interaction.deferReply();
                try {
                    const res = await fetch('https://fortnite-api.com/v2/shop', {
                        headers: {
                            'Authorization': process.env.FORTNITE_API_KEY || ''
                        }
                    });
                    const data = await res.json() as any;

                    const embed = new EmbedBuilder()
                        .setColor(0x00D9FF)
                        .setTitle('🛒 Codzienny Sklep Fortnite')
                        .setDescription('Aktualny zestaw przedmiotów w dzisiejszym sklepie gry:')
                        .setImage(LIVE_IMAGE_URL)
                        .setTimestamp()
                        .setFooter({ text: 'PJN Fortnite Shop • Fortnite-API.com' });

                    if (data && data.status === 200 && data.data && data.data.entries) {
                        const entries = data.data.entries.slice(0, 10);
                        let descriptionText = 'Oto wybrane wyróżnione przedmioty z dzisiejszej oferty:\n\n';
                        
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
                            descriptionText += `• **${itemName}** — 🪙 \`${price} V-Bucks\`\n`;
                        }
                        embed.setDescription(descriptionText);
                    } else {
                        embed.setDescription('Nie udało się wczytać dokładnej listy przedmiotów, ale sklep jest dostępny w grze.');
                    }

                    await interaction.editReply({ embeds: [embed] });
                } catch (e) {
                    await interaction.editReply({ content: '❌ Wystąpił błąd podczas pobierania danych sklepu Fortnite.' });
                }
                return;
            }

            if (commandName === 'fn-stats') {
                await interaction.deferReply();
                const nick = interaction.options.getString('nick');
                const accountId = interaction.options.getString('id');

                if (!nick && !accountId) {
                    return interaction.editReply({ content: '❌ Musisz podać przynajmniej jeden parametr: **nick** lub **id**!' });
                }

                try {
                    let url = '';
                    if (accountId) {
                        url = `https://fortnite-api.com/v2/stats/br/v2?accountId=${encodeURIComponent(accountId)}`;
                    } else {
                        url = `https://fortnite-api.com/v2/stats/br/v2?name=${encodeURIComponent(nick!)}`;
                    }

                    const res = await fetch(url, {
                        headers: {
                            'Authorization': process.env.FORTNITE_API_KEY || ''
                        }
                    });
                    const data = await res.json() as any;

                    if (data && data.status === 200 && data.data && data.data.stats) {
                        const overall = data.data.stats.all?.overall || {};
                        const embed = new EmbedBuilder()
                            .setColor(0x9B59B6)
                            .setTitle(`📊 Statystyki Fortnite: ${data.data.account.name}`)
                            .addFields(
                                { name: '🏆 Wygrane (Wins)', value: `${overall.wins || 0}`, inline: true },
                                { name: '🎯 Zabójstwa (Kills)', value: `${overall.kills || 0}`, inline: true },
                                { name: '💀 Śmierci (Deaths)', value: `${overall.deaths || 0}`, inline: true },
                                { name: '📈 K/D Ratio', value: `${overall.kd || 0}`, inline: true },
                                { name: '🎮 Rozegrane mecze', value: `${overall.matches || 0}`, inline: true },
                                { name: '⭐ Poziom', value: `${data.data.battlePass?.level || 'Brak'}`, inline: true }
                            )
                            .setTimestamp()
                            .setFooter({ text: 'PJN Fortnite API' });
                        await interaction.editReply({ embeds: [embed] });
                    } else {
                        await interaction.editReply({ 
                            content: `❌ Nie znaleziono statystyk dla zapytania (**${accountId ? 'ID: ' + accountId : 'Nick: ' + nick}**).\n\n` +
                                     `💡 **Wskazówka:** Epic Games domyślnie ukrywa statystyki. Upewnij się, że w ustawieniach prywatności w grze masz włączoną opcję **„Wyświetlaj statystyki w rankingach”**.` 
                        });
                    }
                } catch (e) {
                    await interaction.editReply({ content: '❌ Wystąpił błąd podczas komunikacji z API statystyk.' });
                }
                return;
            }

            if (commandName === 'fn-mapa') {
                await interaction.deferReply();
                try {
                    const res = await fetch('https://fortnite-api.com/v1/map', {
                        headers: {
                            'Authorization': process.env.FORTNITE_API_KEY || ''
                        }
                    });
                    const data = await res.json() as any;
                    if (data && data.status === 200 && data.data && data.data.images) {
                        const mapImg = data.data.images.pois || data.data.images.image;
                        const embed = new EmbedBuilder()
                            .setColor(0x2ECC71)
                            .setTitle('🗺️ Aktualna Mapa Fortnite')
                            .setImage(mapImg)
                            .setTimestamp()
                            .setFooter({ text: 'PJN Fortnite API' });
                        await interaction.editReply({ embeds: [embed] });
                    } else {
                        await interaction.editReply({ content: '❌ Nie udało się pobrać aktualnej mapy.' });
                    }
                } catch (e) {
                    await interaction.editReply({ content: '❌ Błąd komunikacji z API mapy.' });
                }
                return;
            }
        }

        if (commandName === 'sklep') {
            await interaction.deferReply({ ephemeral: true });
            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) user = await UserModel.create({ userId: interaction.user.id });

            const embed = new EmbedBuilder()
                .setColor(0xF1C40F)
                .setTitle('🛒 Podgląd Portfela i Sklepu PJN')
                .setDescription(`💰 Twój aktualny stan portfela: **${user.balance} PJN-Coins**\n\nPrzejdź na kanał <#${ID_KANAL_SKLEPU}>, aby dokonać zakupów z interaktywnego panelu!`);
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        if (commandName === 'moje-przedmioty') {
            await interaction.deferReply({ ephemeral: true });
            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) user = await UserModel.create({ userId: interaction.user.id });

            const now = new Date();
            let desc = `📦 **Aktywne usługi i przedmioty użytkownika <@${interaction.user.id}>:**\n\n`;
            let activeCount = 0;

            const formatTimeLeft = (date: Date) => {
                const diff = new Date(date).getTime() - now.getTime();
                if (diff <= 0) return 'Wygasło';
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                return `Pozostało: **${days} dni, ${hours} godz.** (<t:${Math.floor(new Date(date).getTime() / 1000)}:R>)`;
            };

            const member = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
            const hasVipRoleOnServer = member?.roles?.cache?.has(ID_ROLI_VIP);

            if ((user.vipExpiresAt && new Date(user.vipExpiresAt) > now) || hasVipRoleOnServer) {
                activeCount++;
                const timeText = user.vipExpiresAt ? formatTimeLeft(user.vipExpiresAt) : 'Aktywna na serwerze';
                desc += `🟡 **Rola VIP**\n> ${timeText}\n\n`;
            }

            if (user.doubleChanceUntil && new Date(user.doubleChanceUntil) > now) {
                activeCount++;
                desc += `🍀 **Podwójna szansa w kasynie**\n> ${formatTimeLeft(user.doubleChanceUntil)}\n\n`;
            }

            if (user.dailyBoostUntil && new Date(user.dailyBoostUntil) > now) {
                activeCount++;
                desc += `🎁 **Pakiet "2x Daily"**\n> ${formatTimeLeft(user.dailyBoostUntil)}\n\n`;
            }

            if (user.customRoleExpiresAt && new Date(user.customRoleExpiresAt) > now) {
                activeCount++;
                desc += `✨ **Własna rola na serwerze**\n> ${formatTimeLeft(user.customRoleExpiresAt)}\n\n`;
            }

            if (user.customVoiceExpiresAt && new Date(user.customVoiceExpiresAt) > now) {
                activeCount++;
                desc += `🎙️ **Własny kanał głosowy**\n> ${formatTimeLeft(user.customVoiceExpiresAt)}\n\n`;
            }

            if (activeCount === 0) {
                desc += `*Nie masz obecnie żadnych aktywnych usług czasowych ze sklepu.*`;
            }

            const embed = new EmbedBuilder()
                .setColor(0x3498DB)
                .setTitle('⏳ Twoje Aktywne Przedmioty w Sklepie')
                .setDescription(desc)
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
            return;
        }

        if (commandName === 'historia-sklepu') {
            if (!isAuthorized(interaction.user.id)) return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
            await interaction.deferReply({ ephemeral: true });

            const history = await ShopHistoryModel.find().sort({ purchasedAt: -1 }).limit(15);
            if (history.length === 0) {
                return interaction.editReply({ content: '📭 Brak historii zakupów w sklepie.' });
            }

            let desc = 'Ostatnie 15 zakupów w sklepie serwerowym:\n\n';
            for (const h of history) {
                const timeStr = `<t:${Math.floor(new Date(h.purchasedAt).getTime() / 1000)}:R>`;
                desc += `• <@${h.userId}> kupił **${h.itemName}** za **${h.price} PJN-Coins** (${timeStr})\n`;
            }

            const embed = new EmbedBuilder()
                .setColor(0x3498DB)
                .setTitle('📜 Historia Zakupów w Sklepie')
                .setDescription(desc)
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        if (commandName === 'historia-transakcji') {
            if (!isAuthorized(interaction.user.id)) return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
            await interaction.deferReply({ ephemeral: true });

            const txs = await TransactionHistoryModel.find().sort({ timestamp: -1 }).limit(20);
            if (txs.length === 0) {
                return interaction.editReply({ content: '📭 Brak zarejestrowanych transakcji lub gier w bazie.' });
            }

            let desc = 'Ostatnie 20 operacji finansowych i gier kasynowych:\n\n';
            for (const t of txs) {
                const timeStr = `<t:${Math.floor(new Date(t.timestamp).getTime() / 1000)}:R>`;
                let actionText = '';

                if (t.type === 'przelej') {
                    actionText = `💸 Przelew: <@${t.userId}> ➡️ <@${t.targetUserId}> (**${t.amount} coinsów**)`;
                } else if (t.type === 'admin_add') {
                    actionText = `➕ Admin dodał punkty: <@${t.userId}> dał <@${t.targetUserId}> **+${t.amount}**`;
                } else if (t.type === 'admin_remove') {
                    actionText = `➖ Admin zabrał punkty: <@${t.userId}> zabrał <@${t.targetUserId}> **-${t.amount}**`;
                } else if (t.type === 'admin_mass') {
                    actionText = `🌐 Masowy bonus od <@${t.userId}>: **+${t.amount}** dla każdego`;
                } else if (t.type.startsWith('casino_') || t.type === 'wheel_fortune') {
                    const gameName = t.type === 'wheel_fortune' ? 'KOŁO FORTUNY' : t.type.replace('casino_', '').toUpperCase();
                    const sign = t.amount >= 0 ? '+' : '';
                    actionText = `🎲 Kasyno (${gameName}): <@${t.userId}> [${sign}${t.amount} coins] (${t.details})`;
                } else {
                    actionText = `• Akcja: ${t.type} (${t.amount})`;
                }

                desc += `${actionText} — *${timeStr}*\n`;
            }

            const embed = new EmbedBuilder()
                .setColor(0xF1C40F)
                .setTitle('📜 Historia Przelewów i Kasyna')
                .setDescription(desc)
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
            return;
        }

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
            if (!gameInfo) return interaction.editReply({ content: '❌ Wybrano nieobsługiwaną grę.' });

            const authorId = interaction.user.id;
            const currentPlayers = [authorId];

            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle(`${gameInfo.emoji} Szukanie Ekipy: ${gameInfo.name}`)
                .setDescription(
                    `👤 **Organizator:** <@${authorId}>\n` +
                    `👥 **Skład:** 1 / ${maxPlayers} osób\n` +
                    `📝 **Opis:** ${opis}\n\n` +
                    `📋 **Aktualni członkowie:**\n• <@${authorId}>`
                )
                .setTimestamp()
                .setFooter({ text: 'PJN System LFG • Dołącz do gry!' });

            const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('lfg_join').setLabel('Dołącz do ekipy').setStyle(ButtonStyle.Success).setEmoji('➕'),
                new ButtonBuilder().setCustomId('lfg_leave').setLabel('Opuść').setStyle(ButtonStyle.Danger).setEmoji('➖'),
                new ButtonBuilder().setCustomId('lfg_create_voice').setLabel('🎙️ Utwórz pokój').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('lfg_close').setLabel('Zamknij ogłoszenie').setStyle(ButtonStyle.Secondary).setEmoji('🔒')
            );

            const rolePing = gameInfo.roleId ? `<@&${gameInfo.roleId}>` : '';
            const sentMessage = await interaction.channel?.send({
                content: `${rolePing} 🚨 **Nowe zgłoszenie LFG!** Użytkownik <@${authorId}> szuka ludzi do gry **${gameInfo.name}**!`,
                embeds: [embed],
                components: [row1],
                allowedMentions: { roles: [gameInfo.roleId], users: [authorId] }
            });

            if (sentMessage) {
                await LFGModel.create({
                    messageId: sentMessage.id,
                    channelId: interaction.channelId,
                    authorId: authorId,
                    game: graKey,
                    maxPlayers: maxPlayers,
                    currentPlayers: currentPlayers,
                    description: opis,
                    status: 'active',
                    createdAt: new Date()
                });
                await interaction.editReply({ content: `✅ Pomyślnie utworzono ogłoszenie LFG!` });
            } else {
                await interaction.editReply({ content: `❌ Nie udało się wysłać ogłoszenia na kanał.` });
            }
            return;
        }

        if (commandName === 'powiadomienie') {
            if (!isAuthorized(interaction.user.id)) return interaction.reply({ content: '❌ Nie masz uprawnień!', ephemeral: true });
            await interaction.deferReply({ ephemeral: true });
            const tworca = interaction.options.getString('tworca', true) as 'languspjn' | 'elladermusic';
            const platforma = interaction.options.getString('platforma', true) as 'youtube' | 'tiktok';
            const tytul = interaction.options.getString('tytul', true);
            const link = interaction.options.getString('link', true);
            const miniatura = interaction.options.getString('miniatura') || undefined;

            await sendNotification(tworca, platforma, tytul, link, miniatura);
            await interaction.editReply({ content: '✅ Pomyślnie wysłano powiadomienie!' });
            return;
        }

        if (commandName === 'ustaw-topke') {
            if (!isAuthorized(interaction.user.id)) return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
            await interaction.deferReply({ ephemeral: true });
            const embedData = await getTopEmbedData(interaction.guild);
            const sentMessage = await interaction.channel?.send({ embeds: [embedData] });
            if (sentMessage) {
                await ConfigModel.findOneAndUpdate({ key: 'topka_msg' }, { channelId: interaction.channelId, messageId: sentMessage.id }, { upsert: true, new: true });
                await interaction.editReply({ content: `✅ Ustawiono ten kanał jako ranking.` });
            }
            return;
        }

        if (commandName === 'ustaw-odznaki') {
            if (!isAuthorized(interaction.user.id)) return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
            await interaction.deferReply({ ephemeral: true });
            try {
                const embedsList = createBadgesInfoEmbeds();
                const sentMessage = await interaction.channel?.send({ embeds: embedsList });
                if (sentMessage) {
                    await ConfigModel.findOneAndUpdate(
                        { key: 'odznaki_info_msg' }, 
                        { channelId: interaction.channelId, messageId: sentMessage.id }, 
                        { upsert: true, new: true }
                    );
                    await interaction.editReply({ content: `✅ Ustawiono ten kanał jako centrum odznak i pomyślnie wysłano listę.` });
                } else {
                    await interaction.editReply({ content: `❌ Nie udało się wysłać wiadomości na ten kanał.` });
                }
            } catch (err) {
                console.error('Błąd w /ustaw-odznaki:', err);
                await interaction.editReply({ content: `❌ Wystąpił błąd podczas wysyłania listy odznak.` });
            }
            return;
        }

        if (commandName === 'exp') {
            await interaction.deferReply();
            const targetUser = interaction.options.getUser('uzytkownik') || interaction.user;
            let user = await UserModel.findOne({ userId: targetUser.id });
            if (!user) user = await UserModel.create({ userId: targetUser.id });

            const currentLevel = user.level || 1;
            const currentExp = user.exp || 0;
            const requiredExp = currentLevel * 150;
            const missingExp = Math.max(0, requiredExp - currentExp);
            
            const rankDetails = await getUserLevelRankDetails(targetUser.id);

            const progressPercent = Math.min(100, Math.floor((currentExp / requiredExp) * 100));
            const filledBlocks = Math.floor(progressPercent / 10);
            const progressBar = '█'.repeat(filledBlocks) + '░'.repeat(10 - filledBlocks);

            const embed = new EmbedBuilder()
                .setColor(0x3498DB)
                .setTitle(`⭐ Poziom i Doświadczenie • ${targetUser.tag}`)
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { name: '📊 Aktualny Poziom', value: `**Poziom ${currentLevel}**`, inline: true },
                    { name: '🏆 Miejsce w rankingu', value: `**#${rankDetails.rank} z ${rankDetails.total}**`, inline: true },
                    { name: '✨ Zebrane XP', value: `**${currentExp} / ${requiredExp} XP**`, inline: true },
                    { name: '🎯 Brakuje do awansu', value: `**${missingExp} XP**`, inline: true },
                    { name: '📈 Postęp', value: `\`[${progressBar}]\` **${progressPercent}%**`, inline: false }
                )
                .setTimestamp()
                .setFooter({ text: 'PJN System Doświadczenia' });

            await interaction.editReply({ embeds: [embed] });
            return;
        }

        if (commandName === 'reputacja') {
            await interaction.deferReply();
            const targetUser = interaction.options.getUser('uzytkownik') || interaction.user;
            let user = await UserModel.findOne({ userId: targetUser.id });
            if (!user) user = await UserModel.create({ userId: targetUser.id });

            const rep = user.reputation || 0;
            const sign = rep > 0 ? '+' : '';

            let traderRankName = 'Brak rangi tradera';
            let rankColor = 0x3498DB;
            const member = await interaction.guild?.members.fetch(targetUser.id).catch(() => null);
            
            if (member) {
                if (member.roles.cache.has(ID_RANGI_WZOROWY_TRADER)) {
                    traderRankName = '🟡 Wzorowy Trader (+50 pkt)';
                    rankColor = 0xF1C40F;
                } else if (member.roles.cache.has(ID_RANGI_POZYTYWNY_TRADER)) {
                    traderRankName = '🟢 Pozytywny Trader (+10 pkt)';
                    rankColor = 0x2ECC71;
                } else if (member.roles.cache.has(ID_RANGI_NEGATYWNY_TRADER)) {
                    traderRankName = '🟠 Negatywny Trader (-5 pkt)';
                    rankColor = 0xE67E22;
                }
            }

            const embed = new EmbedBuilder()
                .setColor(rankColor)
                .setTitle(`⭐ Profil Handlowy • ${targetUser.tag}`)
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { name: '📊 Reputacja Handlowa', value: `**${sign}${rep} pkt**`, inline: true },
                    { name: '🎖️ Ranga Tradera', value: `**${traderRankName}**`, inline: true }
                )
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        if (commandName === 'daj-wszystkim') {
            if (!isAuthorized(interaction.user.id)) return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
            const ilosc = interaction.options.getInteger('ilosc', true);
            const powod = interaction.options.getString('powod') || 'Brak powódu';
            if (ilosc <= 0) return interaction.reply({ content: '❌ Ilość musi być większa od zera!', ephemeral: true });

            await interaction.deferReply({ ephemeral: true });
            const allUsers = await UserModel.find({});
            let successCount = 0;

            for (const userDoc of allUsers) {
                userDoc.balance = (userDoc.balance || 0) + ilosc;
                await userDoc.save();
                successCount++;
            }

            await TransactionHistoryModel.create({
                userId: interaction.user.id,
                type: 'admin_mass',
                amount: ilosc,
                details: powod
            });

            await interaction.editReply({ content: `✅ Przyznano masowy bonus ${ilosc} PJN-Coins dla ${successCount} użytkowników!` });
            return;
        }

        if (commandName === 'nowości') {
            if (!isAuthorized(interaction.user.id)) return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
            const tytulWpisany = interaction.options.getString('tytul', true);
            const coNowego = interaction.options.getString('co_nowego', true);

            await interaction.deferReply({ ephemeral: true });
            const embed = new EmbedBuilder()
                .setColor(0x3498DB)
                .setTitle(`🚀 NOWOŚĆ! • ${tytulWpisany}`)
                .setDescription(`🔹 **Szczegóły:**\n${coNowego}`)
                .setImage(LIVE_IMAGE_URL)
                .setTimestamp();

            const channel = interaction.channel as TextChannel;
            if (channel) await channel.send({ content: '@everyone', embeds: [embed], allowedMentions: { parse: ['everyone'] } });
            await interaction.editReply({ content: `✅ Wysłano ogłoszenie!` });
            return;
        }

        if (commandName === 'odpalstream') {
            if (!isAuthorized(interaction.user.id)) return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
            const tytul = interaction.options.getString('tytul', true);
            const link = interaction.options.getString('link', true);

            await interaction.deferReply();
            const embed = new EmbedBuilder()
                .setColor(0x9146FF)
                .setTitle('🔴 NA ŻYWO! • LangusPJN wystartował ze stremem!')
                .setDescription(`**${tytul}**\n\n▶️ Oglądaj: [Przejdź do transmisji](${link})`)
                .setImage(LIVE_IMAGE_URL)
                .setTimestamp();

            const channel = interaction.channel as TextChannel;
            if (channel) await channel.send({ content: '@everyone', embeds: [embed], allowedMentions: { parse: ['everyone'] } });
            await interaction.editReply({ content: `✅ Ogłoszono start streama!` });
            return;
        }

        if (commandName === 'zakonczstream') {
            if (!isAuthorized(interaction.user.id)) return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
            await interaction.deferReply();
            const embed = new EmbedBuilder().setColor(0xE74C3C).setTitle('⏹️ STREAM ZAKOŃCZONY').setDescription('Dziękujemy za obecność!').setTimestamp();
            const channel = interaction.channel as TextChannel;
            if (channel) await channel.send({ embeds: [embed] });
            await interaction.editReply({ content: `✅ Zakończono stream!` });
            return;
        }

        if (commandName === 'przelej') {
            await interaction.deferReply({ ephemeral: true });
            const targetUser = interaction.options.getUser('uzytkownik', true);
            const kwota = interaction.options.getInteger('kwota', true);
            if (kwota <= 0) return interaction.editReply({ content: '❌ Kwota musi być > 0!' });
            if (targetUser.id === interaction.user.id) return interaction.editReply({ content: '❌ Nie możesz przelać samemu sobie!' });

            let sender = await UserModel.findOne({ userId: interaction.user.id });
            if (!sender) sender = await UserModel.create({ userId: interaction.user.id });
            if (sender.balance < kwota) return interaction.editReply({ content: `❌ Brak środków! Posiadasz ${sender.balance}.` });

            let receiver = await UserModel.findOne({ userId: targetUser.id });
            if (!receiver) receiver = await UserModel.create({ userId: targetUser.id });

            sender.balance -= kwota;
            receiver.balance += kwota;
            sender.totalDonated = (sender.totalDonated || 0) + kwota;
            await sender.save();
            await receiver.save();

            await TransactionHistoryModel.create({
                userId: interaction.user.id,
                targetUserId: targetUser.id,
                type: 'przelej',
                amount: kwota
            });

            const memberObj = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
            await checkAndAwardBadges(sender, memberObj, interaction.guild);

            try {
                await targetUser.send({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0x2ECC71)
                            .setTitle('💸 Otrzymałeś przelew!')
                            .setDescription(`Użytkownik **${interaction.user.tag}** przelał Ci **${kwota} PJN-Coins**!\n\nTwój aktualny stan portfela: **${receiver.balance} PJN-Coins**`)
                            .setTimestamp()
                    ]
                }).catch(() => {});
            } catch (e) {}

            await interaction.editReply({ content: `✅ Przelano ${kwota} PJN-Coins dla <@${targetUser.id}>!` });
            return;
        }

        const getCasinoMultiplier = async (userId: string, member: any) => {
            let winChance = 0.4; 
            let user = await UserModel.findOne({ userId });
            const now = new Date();
            const hasVipRole = member?.roles?.cache?.has(ID_ROLI_VIP) || (user?.vipExpiresAt && new Date(user.vipExpiresAt) > now);
            const hasDoubleChance = user?.doubleChanceUntil && new Date(user.doubleChanceUntil) > now;

            if (hasVipRole || hasDoubleChance) {
                winChance = 0.65; 
            }
            return winChance;
        };

        if (commandName === 'kostka') {
            await interaction.deferReply();
            const stawka = interaction.options.getInteger('stawka', true);
            if (stawka <= 0) return interaction.editReply({ content: '❌ Stawka musi być > 0!' });

            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) user = await UserModel.create({ userId: interaction.user.id });
            if (user.balance < stawka) return interaction.editReply({ content: `❌ Brak środków (${user.balance})!` });

            user.casinoPlays = (user.casinoPlays || 0) + 1;
            const memberObj = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
            const winChance = await getCasinoMultiplier(interaction.user.id, memberObj);
            const won = Math.random() < winChance;

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

            await TransactionHistoryModel.create({
                userId: interaction.user.id,
                type: 'casino_kostka',
                amount: changeAmount,
                details: won ? 'Wygrana' : 'Przegrana'
            });

            await checkAndAwardBadges(user, memberObj, interaction.guild);

            if (won) {
                return interaction.editReply({ content: `🎲 Wygrana w kościach! Wygrywasz **${stawka} PJN-Coins** (Stan: **${user.balance}**).` });
            } else {
                return interaction.editReply({ content: `🎲 Przegrana w kościach. Tracisz **${stawka} PJN-Coins** (Stan: **${user.balance}**).` });
            }
        }

        if (commandName === 'moneta') {
            await interaction.deferReply();
            const wybor = interaction.options.getString('wybor', true);
            const stawka = interaction.options.getInteger('stawka', true);
            if (stawka <= 0) return interaction.editReply({ content: '❌ Stawka musi być > 0!' });

            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) user = await UserModel.create({ userId: interaction.user.id });
            if (user.balance < stawka) return interaction.editReply({ content: `❌ Brak środków (${user.balance})!` });

            user.casinoPlays = (user.casinoPlays || 0) + 1;
            const memberObj = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
            const winChance = await getCasinoMultiplier(interaction.user.id, memberObj);
            const wynik = Math.random() < 0.5 ? 'orzel' : 'reszka';
            const guessed = (wybor === wynik) || (Math.random() < winChance && Math.random() < 0.3);

            let changeAmount = 0;
            if (guessed) {
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

            await TransactionHistoryModel.create({
                userId: interaction.user.id,
                type: 'casino_moneta',
                amount: changeAmount,
                details: `Wybór: ${wybor}, Wynik: ${wynik}`
            });

            await checkAndAwardBadges(user, memberObj, interaction.guild);

            if (guessed) {
                return interaction.editReply({ content: `🪙 Wypadł **${wynik}**. Trafiłeś! Zyskujesz **${stawka} PJN-Coins**.` });
            } else {
                return interaction.editReply({ content: `🪙 Wypadł **${wynik}**. Przegrywasz **${stawka} PJN-Coins**.` });
            }
        }

        if (commandName === 'slot') {
            if (interaction.channelId !== '1534066347452141639') {
                return interaction.reply({ content: '❌ Komendy `/slot` można używać wyłącznie na dedykowanym kanale slotów (<#1534066347452141639>)!', ephemeral: true });
            }
            await interaction.deferReply();
            const stawka = interaction.options.getInteger('stawka', true);
            if (stawka <= 0) return interaction.editReply({ content: '❌ Stawka musi być > 0!' });

            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) user = await UserModel.create({ userId: interaction.user.id });
            if (user.balance < stawka) return interaction.editReply({ content: `❌ Brak środków (${user.balance})!` });

            user.casinoPlays = (user.casinoPlays || 0) + 1;
            const symbols = ['🍎', '🍋', '🍒', '🔔', '💎'];
            const memberObj = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
            const winChance = await getCasinoMultiplier(interaction.user.id, memberObj);
            
            let s1 = symbols[Math.floor(Math.random() * symbols.length)];
            let s2 = symbols[Math.floor(Math.random() * symbols.length)];
            let s3 = symbols[Math.floor(Math.random() * symbols.length)];

            if (Math.random() < winChance) {
                s1 = s2 = symbols[Math.floor(Math.random() * symbols.length)];
            }

            let changeAmount = 0;
            let resultMessage = '';

            if (s1 === s2 && s2 === s3) {
                const wygrana = stawka * 5;
                user.balance += wygrana;
                user.consecutiveWins = (user.consecutiveWins || 0) + 1;
                user.consecutiveLosses = 0;
                changeAmount = wygrana;
                resultMessage = `🎰 [ ${s1} | ${s2} | ${s3} ]\nJACKPOT! Wygrywasz **${wygrana} PJN-Coins**!`;
            } else if (s1 === s2 || s2 === s3 || s1 === s3) {
                user.balance += stawka;
                user.consecutiveWins = (user.consecutiveWins || 0) + 1;
                user.consecutiveLosses = 0;
                changeAmount = stawka;
                resultMessage = `🎰 [ ${s1} | ${s2} | ${s3} ]\nMała wygrana! Zwrot stawki **${stawka} PJN-Coins**.`;
            } else {
                user.balance -= stawka;
                user.consecutiveLosses = (user.consecutiveLosses || 0) + 1;
                user.consecutiveWins = 0;
                changeAmount = -stawka;
                resultMessage = `🎰 [ ${s1} | ${s2} | ${s3} ]\nNic z tego! Strata **${stawka} PJN-Coins**.`;
            }
            await user.save();

            await TransactionHistoryModel.create({
                userId: interaction.user.id,
                type: 'casino_slot',
                amount: changeAmount,
                details: `${s1}|${s2}|${s3}`
            });

            await checkAndAwardBadges(user, memberObj, interaction.guild);
            return interaction.editReply({ content: resultMessage });
        }

        if (commandName === 'poker') {
            if (interaction.channelId !== '1534060082084577350') {
                return interaction.reply({ content: '❌ Komendy `/poker` można używać wyłącznie na dedykowanym kanale pokera (<#1534060082084577350>)!', ephemeral: true });
            }
            await interaction.deferReply();
            const tryb = interaction.options.getString('tryb', true);
            const stawka = interaction.options.getInteger('stawka', true);
            if (stawka <= 0) return interaction.editReply({ content: '❌ Stawka musi być > 0!' });

            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) user = await UserModel.create({ userId: interaction.user.id });
            if (user.balance < stawka) return interaction.editReply({ content: `❌ Brak środków (${user.balance})!` });

            user.casinoPlays = (user.casinoPlays || 0) + 1;
            const memberObj = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
            const winChance = await getCasinoMultiplier(interaction.user.id, memberObj);
            const wygrana = Math.random() < (winChance + 0.1) ? stawka * 2 : -stawka;

            user.balance += wygrana;
            if (wygrana > 0) {
                user.consecutiveWins = (user.consecutiveWins || 0) + 1;
                user.consecutiveLosses = 0;
            } else {
                user.consecutiveLosses = (user.consecutiveLosses || 0) + 1;
                user.consecutiveWins = 0;
            }
            await user.save();

            await TransactionHistoryModel.create({
                userId: interaction.user.id,
                type: 'casino_poker',
                amount: wygrana,
                details: `Tryb: ${tryb}`
            });

            await checkAndAwardBadges(user, memberObj, interaction.guild);

            if (wygrana > 0) {
                return interaction.editReply({ content: `🃏 [Poker - ${tryb}] Wygrywasz **${wygrana} PJN-Coins**!` });
            } else {
                return interaction.editReply({ content: `🃏 [Poker - ${tryb}] Przegrywasz **${stawka} PJN-Coins**!` });
            }
        }

        if (commandName === 'quiz') {
            await interaction.reply({ content: '❓ **Quiz PJN:** Jak nazywa się twórca tego serwera lub główne platformy streamingowe projektu? (Odpowiedz: LangusPJN)', ephemeral: false });
            return;
        }

        if (commandName === 'odznaki') {
            await interaction.deferReply({ ephemeral: true });
            const targetUser = interaction.options.getUser('uzytkownik') || interaction.user;
            let user = await UserModel.findOne({ userId: targetUser.id });
            if (!user) user = await UserModel.create({ userId: targetUser.id });

            let userLvl = user.level || 1;
            let userExp = user.exp || 0;

            const badgeText = user.badges && user.badges.length > 0 ? user.badges.join('\n') : 'Brak odznak.';
            await interaction.editReply({
                embeds: [{
                    color: 0x9B59B6,
                    title: `🛡️ Profil Odznak i Osiągnięć`,
                    description: `Użytkownik: <@${targetUser.id}>`,
                    thumbnail: { url: targetUser.displayAvatarURL() },
                    fields: [
                        { name: '🏅 Zdobyte Odznaki', value: badgeText, inline: false },
                        { name: '📊 Statystyki', value: `💬 Wiadomości: **${user.messageCount || 0}**\n🎙️ Głos: **${user.voiceMinutes || 0} min**\n⭐ Poziom: **${userLvl}** (${userExp} XP)\n💰 Portfel: **${user.balance || 0}**`, inline: false }
                    ]
                }]
            });
            return;
        }

        if (commandName === 'daj-odznake' || commandName === 'zabierz-odznake') {
            if (!isAuthorized(interaction.user.id)) return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
            await interaction.deferReply({ ephemeral: true });
            const targetUser = interaction.options.getUser('uzytkownik', true);
            const odznaka = interaction.options.getString('odznaka', true);
            let user = await UserModel.findOne({ userId: targetUser.id });
            if (!user) user = await UserModel.create({ userId: targetUser.id });

            if (commandName === 'daj-odznake') {
                if (!user.badges.includes(odznaka)) {
                    user.badges.push(odznaka);
                    await user.save();
                    
                    const memberObj = await interaction.guild?.members.fetch(targetUser.id).catch(() => null);
                    await checkAndAwardBadges(user, memberObj || targetUser, interaction.guild);

                    await interaction.editReply({ content: `✅ Pomyślnie przyznano odznakę i wysłano powiadomienie na PW (oraz ogłoszenie, jeśli spełnia warunki rzadkości)!` });
                } else {
                    await interaction.editReply({ content: `⚠️ Użytkownik ma już tę odznakę.` });
                }
            } else {
                user.badges = user.badges.filter((b: string) => b !== odznaka);
                await user.save();
                await interaction.editReply({ content: `✅ Zabrano odznakę!` });
            }
            return;
        }

        if (commandName === 'portfel') {
            await interaction.deferReply({ ephemeral: true });
            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) user = await UserModel.create({ userId: interaction.user.id });
            await interaction.editReply({ content: `💰 Posiadasz **${user.balance} PJN-Coins!**` });
            return;
        }

        if (commandName === 'topka') {
            await interaction.deferReply();
            const embedData = await getTopEmbedData(interaction.guild);
            await interaction.editReply({ embeds: [embedData] });
            return;
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

            let dailyAmount = 100;
            const memberObj = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
            const hasVipRole = memberObj?.roles?.cache?.has(ID_ROLI_VIP) || (user.vipExpiresAt && new Date(user.vipExpiresAt) > now);
            const hasDailyBoost = user.dailyBoostUntil && new Date(user.dailyBoostUntil) > now;

            if (hasVipRole || hasDailyBoost) {
                dailyAmount *= 2; 
            }

            user.balance += dailyAmount;
            user.lastDaily = now;
            await user.save();
            await checkAndAwardBadges(user, memberObj, interaction.guild);

            await interaction.editReply({ content: `🎁 Otrzymałeś codzienne **${dailyAmount} PJN-Coins**!` });
            return;
        }

        if (commandName === 'dajpunkty' || commandName === 'zabierzpunkty') {
            if (!isAuthorized(interaction.user.id)) return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
            await interaction.deferReply({ ephemeral: true });
            const targetUser = interaction.options.getUser('uzytkownik', true);
            const ilosc = interaction.options.getInteger('ilosc', true);
            const powod = interaction.options.getString('powod') || 'Brak powódu';
            let user = await UserModel.findOne({ userId: targetUser.id });
            if (!user) user = await UserModel.create({ userId: targetUser.id });

            if (commandName === 'dajpunkty') {
                user.balance += ilosc;
                await user.save();
                await TransactionHistoryModel.create({
                    userId: interaction.user.id,
                    targetUserId: targetUser.id,
                    type: 'admin_add',
                    amount: ilosc,
                    details: powod
                });

                const memberObj = await interaction.guild?.members.fetch(targetUser.id).catch(() => null);
                await checkAndAwardBadges(user, memberObj || targetUser, interaction.guild);

                try {
                    let desc = `Administracja przyznała Ci **${ilosc} PJN-Coins** na serwerze!\n\n`;
                    if (powod && powod !== 'Brak powódu') {
                        desc += `📌 **Powód:** ${powod}\n\n`;
                    }
                    desc += `Twój aktualny stan portfela: **${user.balance} PJN-Coins**`;

                    await targetUser.send({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(0xF1C40F)
                                .setTitle('🎁 Otrzymałeś punkty od administracji!')
                                .setDescription(desc)
                                .setTimestamp()
                        ]
                    }).catch(() => {});
                } catch (e) {}

                await interaction.editReply({ content: `✅ Dodano ${ilosc} punktów użytkownikowi <@${targetUser.id}>.` });
            } else {
                user.balance = Math.max(0, user.balance - ilosc);
                await user.save();
                await TransactionHistoryModel.create({
                    userId: interaction.user.id,
                    targetUserId: targetUser.id,
                    type: 'admin_remove',
                    amount: ilosc,
                    details: powod
                });
                await interaction.editReply({ content: `✅ Zabrano ${ilosc} punktów użytkownikowi <@${targetUser.id}>.` });
            }
            return;
        }

        if (commandName === 'cytat') {
            await interaction.deferReply({ ephemeral: true });
            await sendQuoteToChannel(ID_KANALU_CYTATY);
            await interaction.editReply({ content: `✅ Wysłano cytat!` });
            return;
        }

        if (commandName === 'dodaj-cytat') {
            if (!isAuthorized(interaction.user.id)) return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
            await interaction.deferReply({ ephemeral: true });
            const text = interaction.options.getString('tekst', true);
            const author = interaction.options.getString('autor', true);
            await QuoteModel.create({ text, author, addedBy: interaction.user.id });
            
            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) user = await UserModel.create({ userId: interaction.user.id });
            user.quotesAdded = (user.quotesAdded || 0) + 1;
            await user.save();
            const memberObj = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
            await checkAndAwardBadges(user, memberObj, interaction.guild);
            await interaction.editReply({ content: `✅ Dodano cytat!` });
            return;
        }

        if (commandName === 'mem') {
            await interaction.deferReply();
            const templateId = interaction.options.getString('szablon', true);
            const gora = interaction.options.getString('gora') || '';
            const dol = interaction.options.getString('dol') || '';

            try {
                const params = new URLSearchParams();
                params.append('template_id', templateId);
                params.append('username', 'ellader');
                params.append('password', 'ellader123');
                params.append('text0', gora);
                params.append('text1', dol);

                const response = await fetch('https://api.imgflip.com/caption_image', { method: 'POST', body: params });
                const data = await response.json() as any;

                if (data && data.success) {
                    await interaction.editReply({ content: `🖼️ Mem wygenerowany przez <@${interaction.user.id}>:`, files: [data.data.url] });
                } else {
                    await interaction.editReply({ content: `❌ Błąd generatora memów.` });
                }
            } catch (err) {
                await interaction.editReply({ content: '❌ Błąd komunikacji.' });
            }
            return;
        }

    } catch (error) {}
});

async function updateLFGMessage(message: any, lfgDoc: any) {
    try {
        const gameInfo = LFG_CONFIG.GAMES[lfgDoc.game as keyof typeof LFG_CONFIG.GAMES];
        const playersListText = lfgDoc.currentPlayers.map((id: string) => `• <@${id}>`).join('\n');

        let embedColor = 0x5865F2;
        let statusText = `👥 **Skład:** ${lfgDoc.currentPlayers.length} / ${lfgDoc.maxPlayers} osób`;

        if (lfgDoc.status === 'full') embedColor = 0xE67E22;
        else if (lfgDoc.status === 'closed') {
            embedColor = 0xED4245;
            statusText = `🔒 **OGŁOSZENIE ZAMKNIĘTE**`;
        }

        const embed = new EmbedBuilder()
            .setColor(embedColor)
            .setTitle(`${gameInfo.emoji} Szukanie Ekipy: ${gameInfo.name}`)
            .setDescription(
                `👤 **Organizator:** <@${lfgDoc.authorId}>\n` +
                `${statusText}\n` +
                `📝 **Opis:** ${lfgDoc.description}\n\n` +
                `📋 **Aktualni członkowie:**\n${playersListText}` +
                (lfgDoc.voiceChannelId ? `\n\n🎙️ **Kanał Głosowy:** <#${lfgDoc.voiceChannelId}>` : '')
            )
            .setTimestamp()
            .setFooter({ text: 'PJN System LFG • Dołącz do gry!' });

        if (lfgDoc.status === 'closed') {
            await message.edit({ embeds: [embed], components: [] });
        } else {
            const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('lfg_join').setLabel('Dołącz do ekipy').setStyle(ButtonStyle.Success).setEmoji('➕'),
                new ButtonBuilder().setCustomId('lfg_leave').setLabel('Opuść').setStyle(ButtonStyle.Danger).setEmoji('➖'),
                new ButtonBuilder().setCustomId('lfg_create_voice').setLabel('🎙️ Utwórz pokój').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('lfg_close').setLabel('Zamknij ogłoszenie').setStyle(ButtonStyle.Secondary).setEmoji('🔒')
            );
            await message.edit({ embeds: [embed], components: [row1] });
        }
    } catch (e) {}
}

client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    // === OBSŁUGA KANAŁU AI PJN ===
    if (message.channel.id === ID_KANAL_AI_GEMINI) {
        try {
            await message.channel.sendTyping();
            
            const promptText = message.content;
            const aiReplyText = await askGemini(promptText);

            const aiEmbed = new EmbedBuilder()
                .setColor(0x00D9FF)
                .setTitle('🤖 Odpowiedź PJN AI')
                .setDescription(aiReplyText)
                .setTimestamp()
                .setFooter({ text: `Zapytanie od: ${message.author.tag}` });

            await message.reply({ embeds: [aiEmbed] });
        } catch (err) {
            console.error('Błąd podczas obsługi wiadomości AI:', err);
        }
        return; 
    }

    const targetMediaChannels = [ID_KANALU_POKAZ_SIEBIE, ID_KANALU_MEMOW];
    if (targetMediaChannels.includes(message.channel.id)) {
        const hasAttachments = message.attachments.size > 0;
        const hasEmbedsWithMedia = message.embeds.some(e => e.image || e.video || e.thumbnail);

        if (hasAttachments || hasEmbedsWithMedia) {
            try {
                const threadName = `Dyskusja: ${message.author.username}`;
                await message.startThread({
                    name: threadName.substring(0, 100),
                    autoArchiveDuration: 1440,
                    reason: 'Automatyczny wątek dyskusyjny pod multimediami'
                });
            } catch (e) {
                console.error('Błąd podczas automatycznego tworzenia wątku:', e);
            }
        }
    }

    if (message.channel.id === '1532449084559069214') {
        if (!message.content.startsWith('/szukam')) {
            await message.delete().catch(() => {});
            const warningMsg = await message.channel.send({
                content: `<@${message.author.id}>, na tym kanale używamy tylko komendy \`/szukam\`!`
            }).catch(() => null);

            if (warningMsg) {
                setTimeout(() => {
                    warningMsg.delete().catch(() => {});
                }, 5000);
            }
            return;
        }
    }

    if (message.channel.id === ID_KANAL_REPUTACJI) {
        const content = message.content.trim();
        const isPlus = content.toLowerCase().startsWith('+rep');
        const isMinus = content.toLowerCase().startsWith('-rep');

        if (isPlus || isMinus) {
            const mentionedUser = message.mentions.users.first();
            if (!mentionedUser) {
                await message.reply({ content: '❌ Musisz oznaczyć użytkownika (np. `+rep @użytkownik`).' }).catch(() => {});
                return;
            }
            if (mentionedUser.id === message.author.id) {
                await message.reply({ content: '❌ Nie możesz przyznać reputacji samemu sobie!' }).catch(() => {});
                return;
            }

            const giverId = message.author.id;
            const receiverId = mentionedUser.id;
            const existingCooldown = await RepCooldownModel.findOne({ giverId, receiverId });
            const now = new Date();

            if (existingCooldown) {
                const diffTime = now.getTime() - new Date(existingCooldown.lastGiven).getTime();
                const twentyFourHours = 24 * 60 * 60 * 1000;
                if (diffTime < twentyFourHours) {
                    const timeLeft = twentyFourHours - diffTime;
                    const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
                    await message.reply({ content: `⏳ Poczekaj jeszcze ${hoursLeft}h przed kolejną oceną tego użytkownika.` }).catch(() => {});
                    return;
                }
            }

            await RepCooldownModel.findOneAndUpdate({ giverId, receiverId }, { lastGiven: now }, { upsert: true, new: true });

            let receiverUser = await UserModel.findOne({ userId: receiverId });
            if (!receiverUser) receiverUser = await UserModel.create({ userId: receiverId });

            const pointsChange = isPlus ? 1 : -1;
            receiverUser.reputation = (receiverUser.reputation || 0) + pointsChange;
            await receiverUser.save();

            const receiverMember = await message.guild.members.fetch(receiverId).catch(() => null);
            if (receiverMember) await updateTraderRoles(receiverMember, receiverUser.reputation);

            const sign = receiverUser.reputation >= 0 ? `+${receiverUser.reputation}` : `${receiverUser.reputation}`;
            const embed = new EmbedBuilder()
                .setColor(isPlus ? 0x2ECC71 : 0xE67E22)
                .setTitle(isPlus ? '🌟 Przyznano Reputację' : '⚠️ Punkt Negatywny')
                .setDescription(`Użytkownik <@${giverId}> ocenił tradera <@${receiverId}>!\n\n📈 **Nowy bilans:** ${sign} pkt`);
            await message.channel.send({ embeds: [embed] });
            return;
        }
    }

    try {
        let user = await UserModel.findOne({ userId: message.author.id });
        if (!user) user = await UserModel.create({ userId: message.author.id });

        const now = new Date();
        const hasVipRole = message.member?.roles?.cache?.has(ID_ROLI_VIP) || (user.vipExpiresAt && new Date(user.vipExpiresAt) > now);
        const coinsEarned = hasVipRole ? 2 : 1;

        user.messageCount = (user.messageCount || 0) + 1;
        user.balance += coinsEarned;
        
        const currentHour = new Date().getHours();
        if (currentHour >= 0 && currentHour < 4) user.nightMessageCount = (user.nightMessageCount || 0) + 1;

        const customEmojis = message.content.match(/<a?:\w+:\d+>/g);
        if (customEmojis) user.emojiCount = (user.emojiCount || 0) + customEmojis.length;

        await user.save();
        await checkAndAwardBadges(user, message.member, message.guild);

        await addExp(message.author.id, 75, message.guild);

    } catch (error) {}
});

const voiceTimestamps = new Map<string, number>();

client.on('voiceStateUpdate', async (oldState, newState) => {
    const userId = newState.id || oldState.id;
    const guild = newState.guild || oldState.guild;
    const member = newState.member || oldState.member;

    if (member?.user.bot) return;
    const now = Date.now();

    if (newState.channelId === ID_KANAL_TWORZENIA_POKOJU) {
        try {
            const category = newState.channel?.parent;
            const channelName = `🔊 Pokój - ${member.user.username}`;
            
            const privateVoice = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildVoice,
                parent: category ? category.id : null,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionFlagsBits.Connect]
                    },
                    {
                        id: member.id,
                        allow: [
                            PermissionFlagsBits.Connect,
                            PermissionFlagsBits.Speak,
                            PermissionFlagsBits.ManageChannels,
                            PermissionFlagsBits.MoveMembers
                        ]
                    }
                ]
            });

            await member.voice.setChannel(privateVoice);

            const controlEmbed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('🎛️ Panel Zarządzania Twoim Prywatnym Pokojem')
                .setDescription(
                    `Witaj <@${member.id}>! To jest Twój prywatny kanał głosowy.\n\n` +
                    `🛠️ **Jak możesz nim zarządzać?**\n` +
                    `• **Nazwa i limit:** Jako właściciel masz pełne uprawnienia (możesz edytować kanał, zmieniać nazwę oraz limit osób w ustawieniach kanału).\n` +
                    `• **Wyrzucanie / Wyciszanie:** Możesz kliknąć prawym przyciskiem myszy na użytkownika w pokoju, aby go rozłączyć lub wyciszyć.\n` +
                    `• **Prywatność:** W każdej chwili możesz zablokować lub odblokować dostęp dla innych za pomocą przycisków poniżej!`
                )
                .setTimestamp()
                .setFooter({ text: 'PJN System Dynamicznych Pokoi' });

            const controlRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId('temp_voice_lock')
                    .setLabel('Zablokuj pokój')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒'),
                new ButtonBuilder()
                    .setCustomId('temp_voice_unlock')
                    .setLabel('Odblokuj pokój')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🔓')
            );

            await privateVoice.send({
                content: `<@${member.id}>`,
                embeds: [controlEmbed],
                components: [controlRow]
            }).catch(() => {});

        } catch (err) {}
    }

    if (oldState.channel && oldState.channelId !== ID_KANAL_TWORZENIA_POKOJU) {
        const leftChannel = oldState.channel;
        if (leftChannel.name.startsWith('🔊 Pokój -') && leftChannel.members.size === 0) {
            await leftChannel.delete('Pusty kanał prywatny').catch(() => {});
        }
    }

    if (!oldState.channelId && newState.channelId) {
        voiceTimestamps.set(userId, now);
    } else if (oldState.channelId && !newState.channelId) {
        const joinTime = voiceTimestamps.get(userId);
        if (joinTime) {
            const minutesSpent = Math.floor((now - joinTime) / (1000 * 60));
            if (minutesSpent > 0) {
                try {
                    let user = await UserModel.findOne({ userId });
                    if (!user) user = await UserModel.create({ userId });
                    
                    const nowDate = new Date();
                    const hasVipRole = member?.roles?.cache?.has(ID_ROLI_VIP) || (user.vipExpiresAt && new Date(user.vipExpiresAt) > nowDate);
                    const earnedCoins = hasVipRole ? minutesSpent * 2 : minutesSpent;

                    user.voiceMinutes = (user.voiceMinutes || 0) + minutesSpent;
                    user.balance += earnedCoins;
                    await user.save();
                    if (member) await checkAndAwardBadges(user, member, guild);

                    await addExp(userId, minutesSpent * 5, guild);

                } catch (e) {}
            }
            voiceTimestamps.delete(userId);
        }
    }
});

client.on('guildMemberAdd', async member => {
    try {
        let user = await UserModel.findOne({ userId: member.id });
        if (!user) user = await UserModel.create({ userId: member.id });
        user.balance += 200;
        await user.save();
        await checkAndAwardBadges(user, member, member.guild);

        const channel = member.guild.channels.cache.find(ch => ch.isTextBased() && 'name' in ch && ch.name === CHANNEL_POWITANIA) as TextChannel;
        if (channel) {
            const embed = new EmbedBuilder()
                .setColor(0x2ECC71)
                .setTitle('🎮 Centrum Dowodzenia • Od tego możesz zacząć ⬇️')
                .setDescription(
                    `• Zweryfikuj się i wybierz płeć: <#${ID_KANAL_WERYFIKACJI}>\n` +
                    `• Dostosuj role: <#1532397673842217010>\n` +
                    `• Wybierz swój sprzęt: <#1532398069524594708>\n` +
                    `• Szukaj do gry: <#1532449084559069214>`
                )
                .setImage(LIVE_IMAGE_URL)
                .setTimestamp()
                .setFooter({ text: 'PJN System Powitań' });

            const textContent = 
                `🎉 **Witamy na serwerze PJN!**\n` +
                `Witaj <@${member.id}>! Cieszymy się, że dołączyłeś do naszej społeczności. 🚀\n\n` +
                `🎁 **Na start otrzymujesz w prezencie 200 PJN-Coins!**`;

            await channel.send({ content: textContent, embeds: [embed] });
        }
    } catch (e) {}
});

client.on('guildMemberRemove', async member => {
    try {
        const logChannel = await member.guild.channels.fetch(NOTIF_CONFIG.leaveLogChannelId) as TextChannel;
        if (!logChannel) return;

        const fetchedKickLogs = await member.guild.fetchAuditLogs({
            limit: 1,
            type: AuditLogEvent.MemberKick,
        }).catch(() => null);
        
        const kickLog = fetchedKickLogs?.entries.first();
        let actionType = 'leave';
        let executor = null;
        let reason = 'Brak powód';

        if (kickLog && kickLog.target && kickLog.target.id === member.id && (Date.now() - kickLog.createdTimestamp < 5000)) {
            actionType = 'kick';
            executor = kickLog.executor;
            reason = kickLog.reason || 'Brak powód';
        } else {
            const fetchedBanLogs = await member.guild.fetchAuditLogs({
                limit: 1,
                type: AuditLogEvent.MemberBanAdd,
            }).catch(() => null);
            const banLog = fetchedBanLogs?.entries.first();
            if (banLog && banLog.target && banLog.target.id === member.id && (Date.now() - banLog.createdTimestamp < 5000)) {
                actionType = 'ban';
                executor = banLog.executor;
                reason = banLog.reason || 'Brak powód';
            }
        }

        const joinedAtTimestamp = member.joinedTimestamp ? Math.floor(member.joinedTimestamp / 1000) : null;
        const joinedAtText = joinedAtTimestamp ? `<t:${joinedAtTimestamp}:R>` : 'Nieznana';
        const memberCount = member.guild.memberCount;

        const embed = new EmbedBuilder()
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setTimestamp();

        if (actionType === 'kick') {
            embed.setColor(0xE67E22)
                 .setTitle('🥾 Użytkownik został wyrzucony (Kick)')
                 .setDescription(
                     `**${member.user.tag}**\n\`(${member.id})\`\nzostał wyrzucony z serwera przez **${executor ? executor.tag : 'Nieznany'}**.\n` +
                     `📌 **Powód:** ${reason}\n\n` +
                     `📅 **Dołączył na serwer**\n${joinedAtText}\n\n` +
                     `👥 **Liczba członków**\n${memberCount}`
                 );
        } else if (actionType === 'ban') {
            embed.setColor(0xED4245)
                 .setTitle('🔨 Użytkownik został zbanowany (Ban)')
                 .setDescription(
                     `**${member.user.tag}**\n\`(${member.id})\`\nzostał zbanowany na serwerze przez **${executor ? executor.tag : 'Nieznany'}**.\n` +
                     `📌 **Powód:** ${reason}\n\n` +
                     `📅 **Dołączył na serwer**\n${joinedAtText}\n\n` +
                     `👥 **Liczba członków**\n${memberCount}`
                 );
        } else {
            embed.setColor(0xED4245)
                 .setTitle('📤 Użytkownik opuścił serwer')
                 .setDescription(
                     `**${member.user.tag}**\n\`(${member.id})\`\nopuścił naszą społeczność.\n\n` +
                     `📅 **Dołączył na serwer**\n${joinedAtText}\n\n` +
                     `👥 **Liczba członków**\n${memberCount}`
                 );
        }

        await logChannel.send({ embeds: [embed] });
    } catch (error) {}
});

import http from 'http';
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running 24/7!\n');
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Serwer HTTP nasłuchuje na porcie ${PORT}`);
});

client.login(token);
