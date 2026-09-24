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
import http from 'http';

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
        channelId: '1542101793171972146'
    },
    elladermusic: {
        channelId: '1542101962185646111'
    },
    leaveLogChannelId: '1542102521814712371'
};

const ANNOUNCE_CHANNEL_ID = '1532399010785263799';
const ID_KANALU_CYTATY = '1534780578912665653'; 
const ID_KANALU_ZLOTE_MYSLI = '1549709251365183558'; 
const ID_KANALU_MEMOW = '1534833819599769640'; 
const ID_KANALU_SZUKAM_DO_GRY = '1532449084559069214'; 
const ID_KANALU_POKAZ_SIEBIE = '1536365057997283469'; 
const CHANNEL_POWITANIA = "witamy";
const ID_KANALU_DUSZKI = "1532977723843285112"; 
const ID_RANGI_DUSZKOWIEC = "1532978703842283551";
const ID_RANGI_MODERATOR = "1532321767857721344";
const ID_RANGI_ADMIN = "1532324059470237857";

// Nowe ID kanałów przekazane w konfiguracji
const ID_KANALU_ZGLOSZEN_KATEGORIE = '1532862125209555157';
const ID_KANALU_WSPARCIA_BOTA = '1532862421729808565';

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
                '🎰 **5. Maszyna Slotová (Jednoręki Bandyta)**\n> Kanał dedykowany: <#1534066347452141639> (Komenda: `/slot [stawka]`)\n\n' +
                '🃏 **6. Poker**\n> Kanał dedykowany: <#1534060082084577350> (Komenda: `/poker [tryb] [stawka]`)\n\n' +
                '🎯 **7. Rosyjska Ruletka**\n> Kanał specjalny: <#1549791536336732240> — Ryzykuj stawkę w rewolwerze (większe ryzyko przy dużych stawkach)!\n\n' +
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

            const messages = await channel.messages.fetch({ limit: 50 }).catch(() => null);
            if (messages) {
                for (const [_, msg] of messages) {
                    if (msg.author.id === client.user?.id) {
                        await msg.delete().catch(() => {});
                    }
                }
            }

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

        const statusRes = await fetch('https://fortnite-api.com/v1/status');
        if (statusRes.ok) {
            const statusData = await statusRes.json() as any;
            if (statusData && statusData.status === 200) {
                const isOnline = statusData.data.seasons?.[0]?.enabled ?? true;
                const currentVersion = statusData.data.version;

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

// === DEFINICJE KOMEND (W TYM NOWE KOMENDY WIEDZY) ===
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
                )
        )
        .addIntegerOption(option =>
            option.setName('max_osob')
                .setDescription('Maksymalna liczba osób w drużynie (2-10)')
                .setRequired(true)
                .setMinValue(2)
                .setMaxValue(10)
        )
        .addStringOption(option =>
            option.setName('opis')
                .setDescription('Dodatkowy opis (np. ranga, wymagany mikrofon, tryb gry)')
                .setRequired(false)
        ),
    // === NOWE KOMENDY WIEDZY TECHNICZNEJ I SERWEROWEJ PJN ===
    new SlashCommandBuilder()
        .setName('pomoc-discord')
        .setDescription('Kompleksowa wiedza techniczna dotycząca mechanik, uprawnień i architektury Discorda'),
    new SlashCommandBuilder()
        .setName('pjn-przewodnik')
        .setDescription('Kompletny przewodnik po serwerze PJN: gdzie co jest, kanały, systemy i zasady')
].map(command => command.toJSON());

// === OBSŁUGA INTERAKCJI I EVENTÓW ===
client.once('ready', async () => {
    console.log(`Zalogowano pomyślnie jako ${client.user?.tag}!`);

    try {
        const rest = new REST({ version: '10' }).setToken(token);
        await rest.put(Routes.applicationCommands(client.user!.id), { body: commands });
        console.log('Pomyślnie zarejestrowano globalne komendy Slash (/)!');
    } catch (e) {
        console.error('Błąd rejestracji komend:', e);
    }

    await seedQuotesIfNeeded();
    startTopUpdater();
    startReputationTopUpdater();
    startBadgesInfoUpdater();
    startDailyQuotes();
    startDailyShopAutoPoster();
    startServerStatsCron();
    startFortniteStatusCron();
    startFortniteRankingCron();
    startExpirationChecker();
    startPollChecker();
    startLfgAutoCloser();
    cleanupOrphanedLfgVoices();
    startPokerRoomInactivityChecker();
    startHourlyAnnouncements();

    await setupVerificationChannel();
    await setupTicketChannel();
    await setupRolesChannel();
    await setupMemeChannelInstruction();
    await setupShopChannel();
    await setupLfgChannelInstruction();
    await setupShowcaseChannelInstruction();
    await setupReputationChannelInstruction();
    await setupFortniteUpdateChannel();
    await setupRussianRouletteChannel();
    await setupWheelOfFortuneChannel();
    await setupCasinoHubChannel();

    for (const [_, guild] of client.guilds.cache) {
        await updateServerStats(guild);
    }
});

// Śledzenie wiadomości i naliczanie expa, punktów oraz sprawdzanie odznak
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // Obsługa komend tekstowych reputacji (+rep / -rep)
    const contentTrimmed = message.content.trim();
    if (message.channelId === ID_KANAL_REPUTACJI && (contentTrimmed.startsWith('+rep') || contentTrimmed.startsWith('-rep'))) {
        const isPositive = contentTrimmed.startsWith('+rep');
        const mentionedUser = message.mentions.users.first();

        if (!mentionedUser) {
            return message.reply({ content: '❌ Musisz oznaczyć użytkownika, któremu chcesz wystawić reputację! (np. `+rep @użytkownik`)' }).then(m => setTimeout(() => m.delete().catch(()=>{}), 5000));
        }

        if (mentionedUser.id === message.author.id) {
            return message.reply({ content: '❌ Nie możesz wystawić reputacji samemu sobie!' }).then(m => setTimeout(() => m.delete().catch(()=>{}), 5000));
        }

        const now = new Date();
        const existingCooldown = await RepCooldownModel.findOne({ giverId: message.author.id, receiverId: mentionedUser.id });
        if (existingCooldown) {
            const diffHours = (now.getTime() - new Date(existingCooldown.lastGiven).getTime()) / (1000 * 60 * 60);
            if (diffHours < 24) {
                const hoursLeft = Math.ceil(24 - diffHours);
                return message.reply({ content: `⏳ Możesz ocenić tego użytkownika ponownie dopiero za około **${hoursLeft}h**!` }).then(m => setTimeout(() => m.delete().catch(()=>{}), 5000));
            }
        }

        let targetUserDoc = await UserModel.findOne({ userId: mentionedUser.id });
        if (!targetUserDoc) targetUserDoc = await UserModel.create({ userId: mentionedUser.id });

        targetUserDoc.reputation = (targetUserDoc.reputation || 0) + (isPositive ? 1 : -1);
        await targetUserDoc.save();

        if (existingCooldown) {
            existingCooldown.lastGiven = now;
            await existingCooldown.save();
        } else {
            await RepCooldownModel.create({ giverId: message.author.id, receiverId: mentionedUser.id, lastGiven: now });
        }

        const member = await message.guild.members.fetch(mentionedUser.id).catch(() => null);
        if (member) {
            await updateTraderRoles(member, targetUserDoc.reputation);
        }

        const embed = new EmbedBuilder()
            .setColor(isPositive ? 0x2ECC71 : 0xE74C3C)
            .setTitle(isPositive ? '⭐ Przyznano Pozytywną Reputację!' : '⚠️ Przyznano Negatywną Reputację!')
            .setDescription(
                `Użytkownik <@${message.author.id}> ocenił tradera <@${mentionedUser.id}>.\n\n` +
                `📊 **Aktualna reputacja:** \`${targetUserDoc.reputation} pkt\`\n` +
                `📝 **Typ oceny:** ${isPositive ? 'Pozytywna (+1)' : 'Negatywna (-1)'}`
            )
            .setTimestamp();

        await message.channel.send({ embeds: [embed] });
        await message.delete().catch(() => {});
        return;
    }

    // Liczenie emoji i nocnych wiadomości
    const emojiMatches = message.content.match(/<a?:[a-zA-Z0-9_]+:[0-9]+>/g);
    const emojiCount = emojiMatches ? emojiMatches.length : 0;
    const currentHour = new Date().getHours();
    const isNight = currentHour >= 0 && currentHour < 6;

    let user = await UserModel.findOne({ userId: message.author.id });
    if (!user) user = await UserModel.create({ userId: message.author.id });

    user.messageCount += 1;
    if (emojiCount > 0) user.emojiCount += emojiCount;
    if (isNight) user.nightMessageCount += 1;

    let expGain = Math.floor(Math.random() * 6) + 10; // 10-15 XP
    let coinGain = Math.floor(Math.random() * 4) + 2;   // 2-5 Coins

    if (user.vipExpiresAt && new Date(user.vipExpiresAt) > new Date()) {
        coinGain *= 2; // VIP daje 2x coins za wiadomości
    }

    user.balance += coinGain;
    await user.save();

    await addExp(message.author.id, expGain, message.guild);
    await checkAndAwardBadges(user, message.member, message.guild);
});

// Nasłuch dołączywych i opuszczających członków (logi)
client.on('guildMemberRemove', async (member) => {
    try {
        const leaveChannel = await member.guild.channels.fetch(NOTIF_CONFIG.leaveLogChannelId).catch(() => null) as TextChannel;
        if (!leaveChannel) return;

        const embed = new EmbedBuilder()
            .setColor(0xE74C3C)
            .setTitle('👋 Użytkownik opuścił serwer')
            .setDescription(`**${member.user.tag}** (<@${member.id}>) opuścił nasz serwer PJN Community.`)
            .setThumbnail(member.user.displayAvatarURL())
            .setTimestamp()
            .setFooter({ text: 'PJN System Logów' });

        await leaveChannel.send({ embeds: [embed] });
    } catch (e) {}
});

// Główny router interakcji Slash / Przyciski / Menu / Modale
client.on('interactionCreate', async (interaction) => {
    try {
        // === OBSŁUGA KOMEND SLASH (/) ===
        if (interaction.isChatInputCommand()) {
            const { commandName, options, user, guild } = interaction;
            if (!guild) return;

            // 1. Nowa komenda: /pomoc-discord (Wiedza techniczna o Discordzie)
            if (commandName === 'pomoc-discord') {
                const embed = new EmbedBuilder()
                    .setColor(0x5865F2)
                    .setTitle('🛠️ Techniczny Przewodnik po Discordzie • PJN Bot')
                    .setDescription('Oto kompleksowa wiedza techniczna dotycząca działania platformy Discord, architektury botów, uprawnień i interfejsu:')
                    .addFields(
                        {
                            name: '🆔 Co to jest ID (Snowflake)?',
                            value: 'Każdy użytkownik, kanał, rola i wiadomość na Discordzie posiada unikalny 19-cyfrowy identyfikator zwany **Snowflake**. ID zawiera znacznik czasowy utworzenia obiektu. Aby je skopiować, musisz włączyć w Ustawieniach -> Zaawansowane opcję **Tryb deweloperki**.'
                        },
                        {
                            name: '🔐 Intents (Intencje Bota)',
                            value: 'Intents to uprawnienia bezpieczeństwa bramki Discord Gateway. Określają, jakie eventy bot może odbierać z serwera (np. `GuildMembers` do śledzenia wejść, `MessageContent` do odczytu treści wiadomości tekstowych, `GuildVoiceStates` do monitorowania kanałów głosowych).'
                        },
                        {
                            name: '⚡ Slash Commands & Interakcje',
                            value: 'Nowoczesne komendy (`/`) są rejestrowane w API Discorda przez protokół REST. Użytkownik wywołuje je płynnie, a bot odpowiada za pomocą ephemeral messages (widocznych tylko dla pytającego) lub publicznych embedów, obsługując przyciski (`ButtonBuilder`), menu rozwijane (`StringSelectMenuBuilder`) i modale (`ModalBuilder`).'
                        },
                        {
                            name: '🛡️ Uprawnienia (Permissions) i Role',
                            value: 'Discord opiera się na systemie bitowym uprawnień (`PermissionFlagsBits`). Uprawnienia mogą być nadawane globalnie na poziomie serwera, ale również nadpisane (**Channel Overrides**) dla konkretnych ról lub użytkowników na pojedynczym kanale.'
                        },
                        {
                            name: '📊 Webhooki i Embedy',
                            value: 'Embedy to sformatowane bloki wiadomości z kolorowym paskiem bocznym, tytułem, miniaturą, polami i stopką. Webhooki natomiast pozwalają zewnętrznym aplikacjom wysyłać wiadomości w imieniu bota lub niestandardowych webhooków bez konieczności ciągłego nasłuchiwania połączenia.'
                        }
                    )
                    .setTimestamp()
                    .setFooter({ text: 'PJN Bot • Zaawansowana Wiedza Techniczna Discord' });

                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }

            // 2. Nowa komenda: /pjn-przewodnik (Wiedza o serwerze PJN)
            if (commandName === 'pjn-przewodnik') {
                const embed = new EmbedBuilder()
                    .setColor(0xF1C40F)
                    .setTitle('🌟 Oficjalny Przewodnik po Serwerze PJN Community')
                    .setDescription('Witaj na serwerze PJN! Oto kompletny przewodnik informujący co gdzie jest, jak korzystać z serwera oraz jakie zasady obowiązują:')
                    .addFields(
                        {
                            name: '🛡️ Weryfikacja i Dostępy',
                            value: `Przejdź na kanał weryfikacyjny (<#${ID_KANAL_WERYFIKACJI}>) i wybierz swoją płeć w menu rozwijanym, aby odblokować pełny dostęp do społeczności i otrzymać rangę.`
                        },
                        {
                            name: '🎫 Kanały Zgłoszeń i Ticketów',
                            value: `Potrzebujesz pomocy lub chcesz zgłosić problem? Skorzystaj z kanału zgłoszeń z kategoriami (<#${ID_KANALU_ZGLOSZEN_KATEGORIE}>) oraz dedykowanego kanału wsparcia interaktywnego bota (<#${ID_KANALU_WSPARCIA_BOTA}>).`
                        },
                        {
                            name: '💰 Gospodarka i Kasyno PJN',
                            value: 'Zbieraj **PJN-Coins** za aktywność na czacie, komendę `/daily` oraz gry w salonie gier (<#1534060126980411423>). Walutę możesz wydawać w sklepie serwerowym (<#1545690716309553212>) na role VIP, odznaki i bonusy.'
                        },
                        {
                            name: '🎮 Fortnite & LFG (Szukam do Gry)',
                            value: `Szukasz ekipy do grania? Wpisz komendę \`/szukam\` na kanale <#${ID_KANALU_SZUKAM_DO_GRY}>. Bot automatycznie utworzy dla Was prywatny kanał głosowy! Śledź też statusy i patche na <#${ID_KANAL_AKTUALIZACJI_FORTNITE}>.`
                        },
                        {
                            name: '⭐ Bezpieczny Handel i Reputacja',
                            value: `Dokonujesz wymian duszków w Fortnite? Oceń partnera na kanale reputacji (<#${ID_KANAL_REPUTACJI}>) za pomocą komendy \`+rep @użytkownik\` lub \`-rep @użytkownik\`, aby budować swoją pozycję w Alei Sław (<#${ID_ALEJA_SLAW_REPUTACJI}>).`
                        }
                    )
                    .setTimestamp()
                    .setFooter({ text: 'PJN Community • Tworzymy najlepszą społeczność razem!' });

                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }

            // Obsługa istniejących komend
            if (commandName === 'portfel') {
                let userDoc = await UserModel.findOne({ userId: user.id });
                if (!userDoc) userDoc = await UserModel.create({ userId: user.id });
                return interaction.reply({ content: `💰 Stan Twojego portfela: **${userDoc.balance} PJN-Coins**`, ephemeral: true });
            }

            if (commandName === 'sklep') {
                let userDoc = await UserModel.findOne({ userId: user.id });
                if (!userDoc) userDoc = await UserModel.create({ userId: user.id });

                let desc = `Posiadasz w portfelu: **${userDoc.balance} PJN-Coins**\n\nPrzejdź do oficjalnego kanału sklepu <#${ID_KANAL_SKLEPU}> lub wybierz interesujący Cię przedmiot.\n\n**Dostępne przedmioty:**\n`;
                SHOP_ITEMS.forEach((it, idx) => {
                    desc += `**${idx + 1}. ${it.name}** — 🪙 \`${it.price} Coins\`\n> *${it.description}*\n\n`;
                });

                const embed = new EmbedBuilder().setColor(0xF1C40F).setTitle('🛒 Sklep Serwera PJN').setDescription(desc);
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            if (commandName === 'moje-przedmioty') {
                let userDoc = await UserModel.findOne({ userId: user.id });
                if (!userDoc) userDoc = await UserModel.create({ userId: user.id });

                const now = new Date();
                let desc = `📋 **Twoje aktywne usługi i przedmioty:**\n\n`;
                let hasActive = false;

                if (userDoc.vipExpiresAt && new Date(userDoc.vipExpiresAt) > now) {
                    hasActive = true;
                    const days = Math.ceil((new Date(userDoc.vipExpiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    desc += `• 🟡 **Rola VIP** — Wygasa za ok. \`${days} dni\`\n`;
                }
                if (userDoc.doubleChanceUntil && new Date(userDoc.doubleChanceUntil) > now) {
                    hasActive = true;
                    const hours = Math.ceil((new Date(userDoc.doubleChanceUntil).getTime() - now.getTime()) / (1000 * 60 * 60));
                    desc += `• 🍀 **Podwójna szansa w kasynie** — Wygasa za ok. \`${hours}h\`\n`;
                }
                if (userDoc.dailyBoostUntil && new Date(userDoc.dailyBoostUntil) > now) {
                    hasActive = true;
                    const days = Math.ceil((new Date(userDoc.dailyBoostUntil).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    desc += `• 🎁 **Pakiet 2x Daily** — Wygasa za ok. \`${days} dni\`\n`;
                }

                if (!hasActive) {
                    desc += `Brak aktywnych czasowych przedmiotów w tej chwili. Odwiedź sklep, aby wzmocnić swoje konto!`;
                }

                const embed = new EmbedBuilder().setColor(0x3498DB).setTitle('🎒 Twoje Przedmioty PJN').setDescription(desc);
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            if (commandName === 'historia-sklepu') {
                if (!isAuthorized(user.id)) return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
                const history = await ShopHistoryModel.find().sort({ purchasedAt: -1 }).limit(15);
                let desc = history.length === 0 ? 'Brak zakupów w historii.' : history.map(h => `• <@${h.userId}> kupił **${h.itemName}** za \`${h.price}\` coinsów (${new Date(h.purchasedAt).toLocaleString()})`).join('\n');
                const embed = new EmbedBuilder().setColor(0x9B59B6).setTitle('📜 Ostatnie zakupy w sklepie').setDescription(desc);
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            if (commandName === 'historia-transakcji') {
                if (!isAuthorized(user.id)) return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
                const txs = await TransactionHistoryModel.find().sort({ timestamp: -1 }).limit(15);
                let desc = txs.length === 0 ? 'Brak transakcji w historii.' : txs.map(t => `• Typ: **${t.type}** | Od: <@${t.userId}> ${t.targetUserId ? '| Do: <@'+t.targetUserId+'>' : ''} | Kwota: \`${t.amount}\` | ${t.details} (${new Date(t.timestamp).toLocaleString()})`).join('\n');
                const embed = new EmbedBuilder().setColor(0x3498DB).setTitle('💸 Ostatnie transakcje finansowe').setDescription(desc);
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            if (commandName === 'topka') {
                const embedData = await getTopEmbedData(guild);
                return interaction.reply({ embeds: [embedData], ephemeral: true });
            }

            if (commandName === 'ustaw-topke') {
                if (!isAuthorized(user.id)) return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
                const channel = interaction.channel as TextChannel;
                const embedData = await getTopEmbedData(guild);
                const msg = await channel.send({ embeds: [embedData] });

                await ConfigModel.findOneAndUpdate(
                    { key: 'topka_msg' },
                    { channelId: channel.id, messageId: msg.id },
                    { upsert: true }
                );

                return interaction.reply({ content: `✅ Ustawiono ten kanał jako ranking bogactwa!`, ephemeral: true });
            }

            if (commandName === 'ustaw-odznaki') {
                if (!isAuthorized(user.id)) return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
                const channel = interaction.channel as TextChannel;
                const embedsList = createBadgesInfoEmbeds();
                const msg = await channel.send({ embeds: embedsList });

                await ConfigModel.findOneAndUpdate(
                    { key: 'odznaki_info_msg' },
                    { channelId: channel.id, messageId: msg.id },
                    { upsert: true }
                );

                return interaction.reply({ content: `✅ Ustawiono ten kanał jako centrum odznak!`, ephemeral: true });
            }

            if (commandName === 'daily') {
                let userDoc = await UserModel.findOne({ userId: user.id });
                if (!userDoc) userDoc = await UserModel.create({ userId: user.id });

                const now = new Date();
                if (userDoc.lastDaily) {
                    const diffTime = now.getTime() - new Date(userDoc.lastDaily).getTime();
                    const diffHours = diffTime / (1000 * 60 * 60);
                    if (diffHours < 24) {
                        const hoursLeft = Math.ceil(24 - diffHours);
                        return interaction.reply({ content: `⏳ Odbierałeś już dzisiejszą nagrodę! Następny odbiór za ok. **${hoursLeft}h**.`, ephemeral: true });
                    }
                }

                let reward = 100;
                if (userDoc.dailyBoostUntil && new Date(userDoc.dailyBoostUntil) > now) {
                    reward *= 2; // Pakiet 2x Daily
                }

                userDoc.balance += reward;
                userDoc.lastDaily = now;
                await userDoc.save();

                await TransactionHistoryModel.create({ userId: user.id, type: 'DAILY', amount: reward, details: 'Odbiór nagrody dziennej /daily' });

                return interaction.reply({ content: `🎁 Odebrałeś codzienne **${reward} PJN-Coins** do portfela!`, ephemeral: true });
            }

            if (commandName === 'przelej') {
                const targetUser = options.getUser('uzytkownik', true);
                const amount = options.getInteger('kwota', true);

                if (amount <= 0) return interaction.reply({ content: '❌ Kwota przelewu musi być większa od zera!', ephemeral: true });
                if (targetUser.id === user.id) return interaction.reply({ content: '❌ Nie możesz przelać środków samemu sobie!', ephemeral: true });
                if (targetUser.bot) return interaction.reply({ content: '❌ Nie możesz przelać środków dla bota!', ephemeral: true });

                let senderDoc = await UserModel.findOne({ userId: user.id });
                if (!senderDoc || senderDoc.balance < amount) {
                    return interaction.reply({ content: '❌ Nie masz wystarczającej ilości PJN-Coins w portfelu!', ephemeral: true });
                }

                let targetDoc = await UserModel.findOne({ userId: targetUser.id });
                if (!targetDoc) targetDoc = await UserModel.create({ userId: targetUser.id });

                senderDoc.balance -= amount;
                targetDoc.balance += amount;
                await senderDoc.save();
                await targetDoc.save();

                senderDoc.totalDonated = (senderDoc.totalDonated || 0) + amount;
                await senderDoc.save();
                await checkAndAwardBadges(senderDoc, interaction.member, guild);

                await TransactionHistoryModel.create({ userId: user.id, targetUserId: targetUser.id, type: 'TRANSFER', amount, details: `Przelew od <@${user.id}> do <@${targetUser.id}>` });

                return interaction.reply({ content: `✅ Pomyślnie przelano **${amount} PJN-Coins** dla <@${targetUser.id}>!`, ephemeral: true });
            }

            if (commandName === 'kostka') {
                const stake = options.getInteger('stawka', true);
                if (stake <= 0) return interaction.reply({ content: '❌ Stawka musi być większa od zera!', ephemeral: true });

                let userDoc = await UserModel.findOne({ userId: user.id });
                if (!userDoc || userDoc.balance < stake) return interaction.reply({ content: '❌ Nie masz tylu PJN-Coins!', ephemeral: true });

                userDoc.casinoPlays = (userDoc.casinoPlays || 0) + 1;
                const roll = Math.floor(Math.random() * 6) + 1;
                const win = roll >= 4;

                if (win) {
                    const winnings = stake * 2;
                    userDoc.balance += stake; // zwrot + wygrana
                    userDoc.consecutiveWins = (userDoc.consecutiveWins || 0) + 1;
                    userDoc.consecutiveLosses = 0;
                    await userDoc.save();

                    await TransactionHistoryModel.create({ userId: user.id, type: 'CASINO_DICE', amount: winnings, details: `Wygrana w kostce (Wyrzucono ${roll})` });
                    await checkAndAwardBadges(userDoc, interaction.member, guild);
                    return interaction.reply({ content: `🎲 Wyrzuciłeś **${roll}**. **Wygrana!** Otrzymujesz **${winnings} PJN-Coins**! 🎉` });
                } else {
                    userDoc.balance -= stake;
                    userDoc.consecutiveLosses = (userDoc.consecutiveLosses || 0) + 1;
                    userDoc.consecutiveWins = 0;
                    await userDoc.save();

                    await TransactionHistoryModel.create({ userId: user.id, type: 'CASINO_DICE', amount: -stake, details: `Przegrana w kostce (Wyrzucono ${roll})` });
                    await checkAndAwardBadges(userDoc, interaction.member, guild);
                    return interaction.reply({ content: `🎲 Wyrzuciłeś **${roll}**. Niestety, przegrałeś **${stake} PJN-Coins**. 😢` });
                }
            }

            if (commandName === 'moneta') {
                const wybor = options.getString('wybor', true);
                const stake = options.getInteger('stawka', true);
                if (stake <= 0) return interaction.reply({ content: '❌ Stawka musi być większa od zera!', ephemeral: true });

                let userDoc = await UserModel.findOne({ userId: user.id });
                if (!userDoc || userDoc.balance < stake) return interaction.reply({ content: '❌ Nie masz tylu PJN-Coins!', ephemeral: true });

                userDoc.casinoPlays = (userDoc.casinoPlays || 0) + 1;
                const result = Math.random() < 0.5 ? 'orzel' : 'reszka';
                const win = wybor === result;

                if (win) {
                    userDoc.balance += stake;
                    userDoc.consecutiveWins = (userDoc.consecutiveWins || 0) + 1;
                    userDoc.consecutiveLosses = 0;
                    await userDoc.save();

                    await TransactionHistoryModel.create({ userId: user.id, type: 'CASINO_COIN', amount: stake * 2, details: `Wygrana w monety (${result})` });
                    await checkAndAwardBadges(userDoc, interaction.member, guild);
                    return interaction.reply({ content: `🪙 Wypadł **${result.toUpperCase()}**. Trafiłeś! Zyskujesz **${stake * 2} PJN-Coins**! 🎉` });
                } else {
                    userDoc.balance -= stake;
                    userDoc.consecutiveLosses = (userDoc.consecutiveLosses || 0) + 1;
                    userDoc.consecutiveWins = 0;
                    await userDoc.save();

                    await TransactionHistoryModel.create({ userId: user.id, type: 'CASINO_COIN', amount: -stake, details: `Przegrana w monety (${result})` });
                    await checkAndAwardBadges(userDoc, interaction.member, guild);
                    return interaction.reply({ content: `🪙 Wypadł **${result.toUpperCase()}**. Przegrałeś **${stake} PJN-Coins**. 😢` });
                }
            }

            if (commandName === 'slot') {
                const stake = options.getInteger('stawka', true);
                if (stake <= 0) return interaction.reply({ content: '❌ Stawka musi być większa od zera!', ephemeral: true });

                let userDoc = await UserModel.findOne({ userId: user.id });
                if (!userDoc || userDoc.balance < stake) return interaction.reply({ content: '❌ Nie masz tylu PJN-Coins!', ephemeral: true });

                userDoc.casinoPlays = (userDoc.casinoPlays || 0) + 1;
                const fruits = ['🍎', '🍋', '🍒', '⭐', '💎'];
                const f1 = fruits[Math.floor(Math.random() * fruits.length)];
                const f2 = fruits[Math.floor(Math.random() * fruits.length)];
                const f3 = fruits[Math.floor(Math.random() * fruits.length)];

                let multiplier = 0;
                if (f1 === f2 && f2 === f3) {
                    multiplier = f1 === '💎' ? 10 : 5;
                } else if (f1 === f2 || f2 === f3 || f1 === f3) {
                    multiplier = 2;
                }

                if (multiplier > 0) {
                    const winnings = stake * multiplier;
                    userDoc.balance += (winnings - stake);
                    userDoc.consecutiveWins = (userDoc.consecutiveWins || 0) + 1;
                    userDoc.consecutiveLosses = 0;
                    await userDoc.save();

                    await TransactionHistoryModel.create({ userId: user.id, type: 'CASINO_SLOT', amount: winnings, details: `Sloty: ${f1} ${f2} ${f3} (x${multiplier})` });
                    await checkAndAwardBadges(userDoc, interaction.member, guild);
                    return interaction.reply({ content: `🎰 | ${f1} | ${f2} | ${f3} |\n\n**JACKPOT!** Trafileś mnożnik **x${multiplier}** i wygrywasz **${winnings} PJN-Coins**! 🎉` });
                } else {
                    userDoc.balance -= stake;
                    userDoc.consecutiveLosses = (userDoc.consecutiveLosses || 0) + 1;
                    userDoc.consecutiveWins = 0;
                    await userDoc.save();

                    await TransactionHistoryModel.create({ userId: user.id, type: 'CASINO_SLOT', amount: -stake, details: `Sloty: ${f1} ${f2} ${f3}` });
                    await checkAndAwardBadges(userDoc, interaction.member, guild);
                    return interaction.reply({ content: `🎰 | ${f1} | ${f2} | ${f3} |\n\nNiestety nic nie trafiono. Tracisz **${stake} PJN-Coins**. 😢` });
                }
            }

            if (commandName === 'poker') {
                const tryb = options.getString('tryb', true);
                const stake = options.getInteger('stawka', true);
                if (stake <= 0) return interaction.reply({ content: '❌ Stawka musi być większa od zera!', ephemeral: true });

                let userDoc = await UserModel.findOne({ userId: user.id });
                if (!userDoc || userDoc.balance < stake) return interaction.reply({ content: '❌ Nie masz tylu PJN-Coins!', ephemeral: true });

                if (tryb === 'bot') {
                    userDoc.casinoPlays = (userDoc.casinoPlays || 0) + 1;
                    const botWin = Math.random() < 0.45;
                    if (!botWin) {
                        const reward = stake * 2;
                        userDoc.balance += stake;
                        userDoc.consecutiveWins = (userDoc.consecutiveWins || 0) + 1;
                        userDoc.consecutiveLosses = 0;
                        await userDoc.save();

                        await TransactionHistoryModel.create({ userId: user.id, type: 'POKER_BOT', amount: reward, details: `Poker z botem (Wygrana)` });
                        await checkAndAwardBadges(userDoc, interaction.member, guild);
                        return interaction.reply({ content: `🃏 Rozegrałeś partię pokera 1v1 z botem. Twoja ręka okazała się lepsza! Wygrywasz **${reward} PJN-Coins**! 🎉` });
                    } else {
                        userDoc.balance -= stake;
                        userDoc.consecutiveLosses = (userDoc.consecutiveLosses || 0) + 1;
                        userDoc.consecutiveWins = 0;
                        await userDoc.save();

                        await TransactionHistoryModel.create({ userId: user.id, type: 'POKER_BOT', amount: -stake, details: `Poker z botem (Przegrana)` });
                        await checkAndAwardBadges(userDoc, interaction.member, guild);
                        return interaction.reply({ content: `🃏 Bot złożył lepszy układ (Full House)! Przegrywasz **${stake} PJN-Coins**. 😢` });
                    }
                } else {
                    userDoc.balance -= stake;
                    await userDoc.save();

                    const embed = new EmbedBuilder()
                        .setColor(0x9B59B6)
                        .setTitle('🃏 Prywatny Stół Pokerowy PJN')
                        .setDescription(`Host: <@${user.id}>\nStawka: \`${stake} PJN-Coins\`\nStatus: Oczekiwanie na graczy...\n\nKliknij przycisk poniżej, aby dołączyć do rozdania!`)
                        .setTimestamp();

                    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder().setCustomId('poker_join').setLabel('Dołącz do stołu').setStyle(ButtonStyle.Success).setEmoji('🃏'),
                        new ButtonBuilder().setCustomId('poker_start').setLabel('Rozpocznij rozdanie').setStyle(ButtonStyle.Primary).setEmoji('▶️')
                    );

                    const sentMsg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
                    await PokerRoomModel.create({ messageId: sentMsg.id, channelId: interaction.channelId, hostId: user.id, stake, players: [user.id] });
                    return;
                }
            }

            if (commandName === 'quiz') {
                const qObj = QUIZ_POOL[Math.floor(Math.random() * QUIZ_POOL.length)];
                const answers = [qObj.correct, qObj.wrong1, qObj.wrong2].sort(() => Math.random() - 0.5);

                const embed = new EmbedBuilder()
                    .setColor(0x3498DB)
                    .setTitle('❓ Szybki Quiz PJN')
                    .setDescription(`**${qObj.q}**\n\nNapisz w odpowiedzi komendę `/quiz` lub skorzystaj z quizu interaktywnego `/quiz-gra`. Prawidłowa odpowiedź nagradzana jest monetami!`);

                return interaction.reply({ embeds: [embed] });
            }

            if (commandName === 'quiz-gra') {
                const qObj = QUIZ_POOL[Math.floor(Math.random() * QUIZ_POOL.length)];
                const answers = [
                    { label: qObj.correct, correct: true },
                    { label: qObj.wrong1, correct: false },
                    { label: qObj.wrong2, correct: false }
                ].sort(() => Math.random() - 0.5);

                const embed = new EmbedBuilder()
                    .setColor(0x3498DB)
                    .setTitle('🧠 Interaktywny Quiz PJN z Nagrodami')
                    .setDescription(`**${qObj.q}**\n\nWybierz poprawną odpowiedź poniżej, aby zdobyć PJN-Coins!`)
                    .setFooter({ text: 'Masz 30 sekund na odpowiedź!' });

                const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                    answers.map((ans, idx) => 
                        new ButtonBuilder()
                            .setCustomId(`quiz_ans_${ans.correct ? 'yes' : 'no'}`)
                            .setLabel(ans.label)
                            .setStyle(ButtonStyle.Primary)
                    )
                );

                return interaction.reply({ embeds: [embed], components: [row] });
            }

            if (commandName === 'kpn') {
                const wybor = options.getString('wybor', true);
                const stake = options.getInteger('stawka', true);
                if (stake <= 0) return interaction.reply({ content: '❌ Stawka musi być większa od zera!', ephemeral: true });

                let userDoc = await UserModel.findOne({ userId: user.id });
                if (!userDoc || userDoc.balance < stake) return interaction.reply({ content: '❌ Nie masz tylu PJN-Coins!', ephemeral: true });

                const choices = ['kamien', 'papier', 'nozyce'];
                const botChoice = choices[Math.floor(Math.random() * choices.length)];

                let outcome = 'draw';
                if (wybor === botChoice) outcome = 'draw';
                else if (
                    (wybor === 'kamien' && botChoice === 'nozyce') ||
                    (wybor === 'papier' && botChoice === 'kamien') ||
                    (wybor === 'nozyce' && botChoice === 'papier')
                ) {
                    outcome = 'win';
                } else {
                    outcome = 'lose';
                }

                if (outcome === 'win') {
                    const reward = stake * 2;
                    userDoc.balance += stake;
                    userDoc.consecutiveWins = (userDoc.consecutiveWins || 0) + 1;
                    userDoc.consecutiveLosses = 0;
                    await userDoc.save();

                    await TransactionHistoryModel.create({ userId: user.id, type: 'KPN', amount: reward, details: `KPN Wygrana (${wybor} vs bot: ${botChoice})` });
                    await checkAndAwardBadges(userDoc, interaction.member, guild);
                    return interaction.reply({ content: `✂️ Twój wybór: **${wybor}** | Bot wybrał: **${botChoice}**\n\n**Wygrana!** Otrzymujesz **${reward} PJN-Coins**! 🎉` });
                } else if (outcome === 'draw') {
                    return interaction.reply({ content: `✂️ Twój wybór: **${wybor}** | Bot wybrał: **${botChoice}**\n\n**Remis!** Twoje monety wracają do portfela.` });
                } else {
                    userDoc.balance -= stake;
                    userDoc.consecutiveLosses = (userDoc.consecutiveLosses || 0) + 1;
                    userDoc.consecutiveWins = 0;
                    await userDoc.save();

                    await TransactionHistoryModel.create({ userId: user.id, type: 'KPN', amount: -stake, details: `KPN Przegrana (${wybor} vs bot: ${botChoice})` });
                    await checkAndAwardBadges(userDoc, interaction.member, guild);
                    return interaction.reply({ content: `✂️ Twój wybór: **${wybor}** | Bot wybrał: **${botChoice}**\n\n**Przegrana!** Tracisz **${stake} PJN-Coins**. 😢` });
                }
            }

            if (commandName === 'odznaki') {
                const target = options.getUser('uzytkownik') || user;
                let userDoc = await UserModel.findOne({ userId: target.id });
                if (!userDoc) userDoc = await UserModel.create({ userId: target.id });

                const badgeList = userDoc.badges.length === 0 ? 'Brak odznak na koncie.' : userDoc.badges.join('\n');
                const embed = new EmbedBuilder()
                    .setColor(0x9B59B6)
                    .setTitle(`🛡️ Odznaki użytkownika ${target.username}`)
                    .setDescription(badgeList)
                    .setTimestamp();

                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            if (commandName === 'exp') {
                const target = options.getUser('uzytkownik') || user;
                let userDoc = await UserModel.findOne({ userId: target.id });
                if (!userDoc) userDoc = await UserModel.create({ userId: target.id });

                const rankDetails = await getUserLevelRankDetails(target.id);
                const requiredExp = userDoc.level * 150;

                const embed = new EmbedBuilder()
                    .setColor(0x3498DB)
                    .setTitle(`⭐ Status Poziomu i Doświadczenia • ${target.username}`)
                    .setDescription(
                        `⭐ **Poziom:** \`${userDoc.level}\`\n` +
                        `🎯 **Doświadczenie (XP):** \`${userDoc.exp} / ${requiredExp}\`\n` +
                        `🏆 **Ranking XP na serwerze:** \`#${rankDetails.rank} z ${rankDetails.total}\``
                    )
                    .setTimestamp();

                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            if (commandName === 'reputacja') {
                const target = options.getUser('uzytkownik') || user;
                let userDoc = await UserModel.findOne({ userId: target.id });
                if (!userDoc) userDoc = await UserModel.create({ userId: target.id });

                const rep = userDoc.reputation || 0;
                let titleRole = 'Początkujący Trader';
                if (rep >= 50) titleRole = '⭐ Wzorowy Trader';
                else if (rep >= 10) titleRole = '📈 Pozytywny Trader';
                else if (rep <= -5) titleRole = '⚠️ Ryzykowny Trader';

                const embed = new EmbedBuilder()
                    .setColor(0xF1C40F)
                    .setTitle(`🌟 Profil Handlowy • ${target.username}`)
                    .setDescription(
                        `⭐ **Punkty Reputacji:** \`${rep} pkt\`\n` +
                        `🎖️ **Ranga Handlowa:** **${titleRole}**\n\n` +
                        `*Oceny możesz wystawiać na kanale <#${ID_KANAL_REPUTACJI}> komendą \`+rep @użytkownik\`.*`
                    )
                    .setTimestamp();

                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            if (commandName === 'profil') {
                const target = options.getUser('uzytkownik') || user;
                let userDoc = await UserModel.findOne({ userId: target.id });
                if (!userDoc) userDoc = await UserModel.create({ userId: target.id });

                const rankDetails = await getUserLevelRankDetails(target.id);
                const badgePreview = userDoc.badges.length > 0 ? userDoc.badges.slice(0, 6).join(' | ') : 'Brak odznak';

                const embed = new EmbedBuilder()
                    .setColor(0x9B59B6)
                    .setTitle(`📊 Karta Profilu • ${target.username}`)
                    .setThumbnail(target.displayAvatarURL())
                    .addFields(
                        { name: '💰 Portfel', value: `\`${userDoc.balance} PJN-Coins\``, inline: true },
                        { name: '⭐ Poziom & XP', value: `Lvl \`${userDoc.level}\` (${userDoc.exp} XP) | #${rankDetails.rank}`, inline: true },
                        { name: '🌟 Reputacja', value: `\`${userDoc.reputation || 0} pkt\``, inline: true },
                        { name: '💬 Aktywność', value: `Wiadomości: \`${userDoc.messageCount}\` | Głos: \`~${Math.round((userDoc.voiceMinutes||0)/60)}h\``, inline: false },
                        { name: '✨ Wybrane Odznaki', value: badgePreview, inline: false }
                    )
                    .setTimestamp();

                return interaction.reply({ embeds: [embed] });
            }

            if (commandName === 'ankieta') {
                const question = options.getString('pytanie', true);
                const optionsRaw = options.getString('opcje', true);
                const durationStr = options.getString('czas');

                const choices = optionsRaw.split(',').map(s => s.trim()).filter(Boolean);
                if (choices.length < 2 || choices.length > 5) {
                    return interaction.reply({ content: '❌ Ankieta musi posiadać od 2 do 5 opcji oddzielonych przecinkami!', ephemeral: true });
                }

                let endsAt: Date | null = null;
                if (durationStr) {
                    const now = new Date();
                    if (durationStr === '15m') endsAt = new Date(now.getTime() + 15 * 60 * 1000);
                    else if (durationStr === '1h') endsAt = new Date(now.getTime() + 60 * 60 * 1000);
                    else if (durationStr === '6h') endsAt = new Date(now.getTime() + 6 * 60 * 60 * 1000);
                    else if (durationStr === '24h') endsAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
                }

                let desc = `🗳️ **${question}**\n\n`;
                choices.forEach((opt, idx) => {
                    desc += `**${idx + 1}.** ${opt} — \`0 głosów\` (0%)\n`;
                });

                const embed = new EmbedBuilder().setColor(0x3498DB).setTitle('📊 Ankieta na żywo').setDescription(desc).setTimestamp();
                const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                    choices.map((opt, idx) => 
                        new ButtonBuilder().setCustomId(`poll_vote_${idx}`).setLabel(`${idx + 1}. ${opt.substring(0, 15)}`).setStyle(ButtonStyle.Primary)
                    )
                );

                const sentMsg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
                await PollModel.create({ messageId: sentMsg.id, channelId: interaction.channelId, question, options: choices, votes: choices.map(() => []), endsAt });
                return;
            }

            if (commandName === 'fn-sklep') {
                try {
                    const res = await fetch('https://fortnite-api.com/v2/shop', { headers: { 'Authorization': process.env.FORTNITE_API_KEY || '' } });
                    const data = await res.json() as any;

                    const embed = new EmbedBuilder().setColor(0x00D9FF).setTitle('🛒 Aktualny Sklep Fortnite').setImage(LIVE_IMAGE_URL);
                    if (data && data.status === 200 && data.data && data.data.entries) {
                        const entries = data.data.entries.slice(0, 10);
                        let desc = '';
                        for (const entry of entries) {
                            const name = entry.items?.[0]?.name || entry.bundle?.name || 'Przedmiot';
                            const price = entry.finalPrice || 'N/D';
                            desc += `• **${name}** — 🪙 \`${price} V-Bucks\`\n`;
                        }
                        embed.setDescription(desc);
                    }
                    return interaction.reply({ embeds: [embed] });
                } catch (e) {
                    return interaction.reply({ content: '❌ Błąd pobierania sklepu Fortnite.', ephemeral: true });
                }
            }

            if (commandName === 'fn-stats') {
                const nick = options.getString('nick');
                const accountId = options.getString('id');

                if (!nick && !accountId) return interaction.reply({ content: '❌ Podaj nick z Epic Games lub Account ID!', ephemeral: true });

                try {
                    let url = `https://fortnite-api.com/v2/stats/br/v2?`;
                    if (nick) url += `name=${encodeURIComponent(nick)}`;
                    else url += `accountId=${accountId}`;

                    const res = await fetch(url, { headers: { 'Authorization': process.env.FORTNITE_API_KEY || '' } });
                    const data = await res.json() as any;

                    if (!data || data.status !== 200) {
                        return interaction.reply({ content: '❌ Nie znaleziono gracza o podanym nicku lub profil jest ukryty.', ephemeral: true });
                    }

                    const stats = data.data.stats.all?.overall || {};
                    const embed = new EmbedBuilder()
                        .setColor(0x00D9FF)
                        .setTitle(`📊 Statystyki Fortnite • ${data.data.account.name}`)
                        .addFields(
                            { name: '🏆 Wygrane (Wins)', value: `\`${stats.wins || 0}\``, inline: true },
                            { name: '⚔️ Zabójstwa (Kills)', value: `\`${stats.kills || 0}\``, inline: true },
                            { name: '🎮 Rozegrane mecze', value: `\`${stats.matches || 0}\``, inline: true },
                            { name: '🎯 K/D Ratio', value: `\`${stats.kd || 0}\``, inline: true },
                            { name: '⏱️ Czas gry', value: `\`${Math.round((stats.minutesPlayed || 0) / 60)}h\``, inline: true }
                        )
                        .setTimestamp();

                    return interaction.reply({ embeds: [embed] });
                } catch (e) {
                    return interaction.reply({ content: '❌ Wystąpił błąd podczas pobierania statystyk Fortnite.', ephemeral: true });
                }
            }

            if (commandName === 'fn-mapa') {
                try {
                    const res = await fetch('https://fortnite-api.com/v1/map');
                    const data = await res.json() as any;
                    if (data && data.status === 200 && data.data && data.data.images) {
                        const embed = new EmbedBuilder().setColor(0x00D9FF).setTitle('🗺️ Aktualna Mapa Fortnite').setImage(data.data.images.pois);
                        return interaction.reply({ embeds: [embed] });
                    }
                    return interaction.reply({ content: '❌ Nie udało się pobrać mapy.', ephemeral: true });
                } catch (e) {
                    return interaction.reply({ content: '❌ Błąd API mapy.', ephemeral: true });
                }
            }

            if (commandName === 'fn-rejestracja') {
                const nick = options.getString('nick', true);
                let userDoc = await UserModel.findOne({ userId: user.id });
                if (!userDoc) userDoc = await UserModel.create({ userId: user.id });

                userDoc.epicNick = nick;
                await userDoc.save();

                return interaction.reply({ content: `✅ Pomyślnie zarejestrowano Twój nick Epic Games: **${nick}**! Bot będzie automatycznie śledził Twoje statystyki i rankingi.`, ephemeral: true });
            }

            if (commandName === 'fn-top') {
                if (!isAuthorized(user.id)) return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
                await interaction.deferReply({ ephemeral: true });
                await refreshFortniteRankingMessage(guild);
                return interaction.editReply({ content: '✅ Odświeżono rankingi Fortnite!' });
            }

            if (commandName === 'daj-bonus-wygranych') {
                if (!isAuthorized(user.id)) return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
                const target = options.getUser('uzytkownik', true);
                let userDoc = await UserModel.findOne({ userId: target.id });
                if (!userDoc) userDoc = await UserModel.create({ userId: target.id });

                userDoc.guaranteedWinUntil = new Date(Date.now() + 30 * 60 * 1000);
                await userDoc.save();

                return interaction.reply({ content: `✅ Przyznano <@${target.id}> 100% wygranych w kasynie na 30 minut!`, ephemeral: true });
            }

            if (commandName === 'daj-wszystkim') {
                if (!isAuthorized(user.id)) return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
                const ilosc = options.getInteger('ilosc', true);
                const powod = options.getString('powod') || 'Bonus dla wszystkich';

                await UserModel.updateMany({}, { $inc: { balance: ilosc } });
                return interaction.reply({ content: `✅ Rozdano po **${ilosc} PJN-Coins** każdemu użytkownikowi w bazie! Powód: ${powod}`, ephemeral: true });
            }

            if (commandName === 'reset-ekonomii') {
                if (!isAuthorized(user.id)) return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
                await UserModel.updateMany({}, { balance: 0 });
                return interaction.reply({ content: `⚠️ Zresetowano stan PJN-Coins do 0 dla wszystkich użytkowników.`, ephemeral: true });
            }

            if (commandName === 'nowości') {
                if (!isAuthorized(user.id)) return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
                const tytul = options.getString('tytul', true);
                const coNowego = options.getString('co_nowego', true);

                const embed = new EmbedBuilder()
                    .setColor(0x00D9FF)
                    .setTitle(`✨ NOWOŚĆ NA SERWERZE: ${tytul}`)
                    .setDescription(coNowego)
                    .setImage(LIVE_IMAGE_URL)
                    .setTimestamp();

                const channel = await guild.channels.fetch(ANNOUNCE_CHANNEL_ID).catch(() => null) as TextChannel;
                if (channel) await channel.send({ content: '@everyone Sprawdź najnowsze aktualizacje!', embeds: [embed], allowedMentions: { parse: ['everyone'] } });

                return interaction.reply({ content: `✅ Wysłano ogłoszenie o nowościach!`, ephemeral: true });
            }

            if (commandName === 'ogloszenie-techniczne') {
                if (!isAuthorized(user.id)) return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
                const tytul = options.getString('tytul', true);
                const opis = options.getString('opis', true);

                const embed = new EmbedBuilder()
                    .setColor(0xE74C3C)
                    .setTitle(`⚠️ PRZERWA TECHNICZNA / OGŁOSZENIE: ${tytul}`)
                    .setDescription(opis)
                    .setTimestamp();

                const channel = await guild.channels.fetch(ANNOUNCE_CHANNEL_ID).catch(() => null) as TextChannel;
                if (channel) await channel.send({ content: '@everyone Ważne ogłoszenie techniczne!', embeds: [embed], allowedMentions: { parse: ['everyone'] } });

                return interaction.reply({ content: `✅ Wysłano ogłoszenie techniczne!`, ephemeral: true });
            }

            if (commandName === 'odpalstream') {
                const tytul = options.getString('tytul', true);
                const link = options.getString('link', true);

                const embed = new EmbedBuilder()
                    .setColor(0x9B59B6)
                    .setTitle('🔴 LANGUSPJN WŁAŚNIE ODPALIŁ STREAM!')
                    .setDescription(`**Tytuł:** ${tytul}\n\nWskakuj na transmisję i spędź z nami czas! 👇`)
                    .setImage(LIVE_IMAGE_URL)
                    .setTimestamp();

                const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder().setLabel('Oglądaj Stream').setStyle(ButtonStyle.Link).setURL(link).setEmoji('🔴')
                );

                const channel = await guild.channels.fetch(ANNOUNCE_CHANNEL_ID).catch(() => null) as TextChannel;
                if (channel) await channel.send({ content: '@everyone Stream właśnie wystartował!', embeds: [embed], components: [row], allowedMentions: { parse: ['everyone'] } });

                return interaction.reply({ content: `✅ Ogłoszono start streama!`, ephemeral: true });
            }

            if (commandName === 'zakonczstream') {
                const embed = new EmbedBuilder()
                    .setColor(0x7F8C8D)
                    .setTitle('⬛ STREAM ZOSTAŁ ZAKOŃCZONY')
                    .setDescription('Dziękujemy wszystkim za obecność! Kolejna transmisja już wkrótce.')
                    .setTimestamp();

                const channel = await guild.channels.fetch(ANNOUNCE_CHANNEL_ID).catch(() => null) as TextChannel;
                if (channel) await channel.send({ embeds: [embed] });

                return interaction.reply({ content: `✅ Ogłoszono zakończenie streama!`, ephemeral: true });
            }

            if (commandName === 'powiadomienie') {
                if (!isAuthorized(user.id)) return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
                const tworca = options.getString('tworca', true) as 'languspjn' | 'elladermusic';
                const platforma = options.getString('platforma', true) as 'youtube' | 'tiktok';
                const tytul = options.getString('tytul', true);
                const link = options.getString('link', true);
                const miniatura = options.getString('miniatura');

                await sendNotification(tworca, platforma, tytul, link, miniatura || undefined);
                return interaction.reply({ content: `✅ Wysłano powiadomienie o nowym filmie!`, ephemeral: true });
            }

            if (commandName === 'daj-odznake') {
                if (!isAuthorized(user.id)) return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
                const target = options.getUser('uzytkownik', true);
                const badgeName = options.getString('odznaka', true);

                let userDoc = await UserModel.findOne({ userId: target.id });
                if (!userDoc) userDoc = await UserModel.create({ userId: target.id });

                if (!userDoc.badges.includes(badgeName)) {
                    userDoc.badges.push(badgeName);
                    await userDoc.save();
                }

                return interaction.reply({ content: `✅ Przyznano odznakę **${badgeName}** dla <@${target.id}>!`, ephemeral: true });
            }

            if (commandName === 'zabierz-odznake') {
                if (!isAuthorized(user.id)) return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
                const target = options.getUser('uzytkownik', true);
                const badgeName = options.getString('odznaka', true);

                let userDoc = await UserModel.findOne({ userId: target.id });
                if (!userDoc) return interaction.reply({ content: '❌ Użytkownik nie ma bazy danych!', ephemeral: true });

                userDoc.badges = userDoc.badges.filter(b => b !== badgeName);
                await userDoc.save();

                return interaction.reply({ content: `✅ Odtworzono / usunięto odznakę **${badgeName}** u <@${target.id}>.`, ephemeral: true });
            }

            if (commandName === 'dajpunkty') {
                if (!isAuthorized(user.id)) return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
                const target = options.getUser('uzytkownik', true);
                const ilosc = options.getInteger('ilosc', true);
                const powod = options.getString('powod') || 'Administrator';

                let userDoc = await UserModel.findOne({ userId: target.id });
                if (!userDoc) userDoc = await UserModel.create({ userId: target.id });

                userDoc.balance += ilosc;
                await userDoc.save();

                await TransactionHistoryModel.create({ userId: user.id, targetUserId: target.id, type: 'ADMIN_GIVE', amount: ilosc, details: `Admin dał punkty: ${powod}` });
                return interaction.reply({ content: `✅ Dodano **${ilosc} PJN-Coins** dla <@${target.id}>!`, ephemeral: true });
            }

            if (commandName === 'zabierzpunkty') {
                if (!isAuthorized(user.id)) return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
                const target = options.getUser('uzytkownik', true);
                const ilosc = options.getInteger('ilosc', true);

                let userDoc = await UserModel.findOne({ userId: target.id });
                if (!userDoc) return interaction.reply({ content: '❌ Użytkownik nie posiada portfela!', ephemeral: true });

                userDoc.balance = Math.max(0, userDoc.balance - ilosc);
                await userDoc.save();

                await TransactionHistoryModel.create({ userId: user.id, targetUserId: target.id, type: 'ADMIN_TAKE', amount: -ilosc, details: 'Admin zabrał punkty' });
                return interaction.reply({ content: `✅ Zabrano **${ilosc} PJN-Coins** od <@${target.id}>.`, ephemeral: true });
            }

            if (commandName === 'cytat') {
                const count = await QuoteModel.countDocuments();
                if (count === 0) return interaction.reply({ content: '❌ Brak cytatów w bazie!', ephemeral: true });
                const random = Math.floor(Math.random() * count);
                const quote = await QuoteModel.findOne().skip(random);
                if (!quote) return interaction.reply({ content: '❌ Błąd pobierania cytatu.', ephemeral: true });

                const embed = new EmbedBuilder().setColor(0xE67E22).setTitle('✨ Losowy Cytat').setDescription(`> *„${quote.text}”*\n\n**— ${quote.author}**`);
                return interaction.reply({ embeds: [embed] });
            }

            if (commandName === 'dodaj-cytat') {
                const tekst = options.getString('tekst', true);
                const autor = options.getString('autor', true);

                await QuoteModel.create({ text: tekst, author: autor, addedBy: user.id });
                let userDoc = await UserModel.findOne({ userId: user.id });
                if (!userDoc) userDoc = await UserModel.create({ userId: user.id });
                userDoc.quotesAdded = (userDoc.quotesAdded || 0) + 1;
                await userDoc.save();
                await checkAndAwardBadges(userDoc, interaction.member, guild);

                return interaction.reply({ content: `✅ Pomyślnie dodano nowy cytat do bazy!`, ephemeral: true });
            }

            if (commandName === 'mem') {
                const szablon = options.getString('szablon', true);
                const gora = options.getString('gora') || '';
                const dol = options.getString('dol') || '';

                try {
                    const res = await fetch(`https://api.imgflip.com/get_memes`);
                    const data = await res.json() as any;
                    if (!data || !data.success) return interaction.reply({ content: '❌ Błąd generatora memów.', ephemeral: true });

                    const memes = data.data.memes;
                    const matched = memes.find((m: any) => m.name.toLowerCase().includes(szablon.toLowerCase())) || memes[0];

                    const body = new URLSearchParams({
                        template_id: matched.id,
                        username: process.env.IMGFLIP_USERNAME || '',
                        password: process.env.IMGFLIP_PASSWORD || '',
                        text0: gora,
                        text1: dol
                    });

                    const imgRes = await fetch(`https://api.imgflip.com/caption_image`, { method: 'POST', body });
                    const imgData = await imgRes.json() as any;

                    if (!imgData || !imgData.success) {
                        return interaction.reply({ content: `❌ Nie udało się wygenerować mema (brak credites API imgflip lub błędny szablon). Szablon: ${matched.name}`, ephemeral: true });
                    }

                    return interaction.reply({ content: `🖼️ Wygenerowano mem (**${matched.name}**):\n${imgData.data.url}` });
                } catch (e) {
                    return interaction.reply({ content: '❌ Wystąpił błąd podczas generowania mema.', ephemeral: true });
                }
            }

            if (commandName === 'szukam') {
                const gameKey = options.getString('gra', true);
                const maxPlayers = options.getInteger('max_osob', true);
                const description = options.getString('opis') || 'Brak dodatkowego opisu.';

                const gameInfo = (LFG_CONFIG.GAMES as any)[gameKey];
                const roleId = gameInfo ? gameInfo.roleId : null;
                const rolePing = roleId ? `<@&${roleId}>` : '';

                const embed = new EmbedBuilder()
                    .setColor(0x5865F2)
                    .setTitle(`🎮 Centrum LFG • ${gameInfo ? gameInfo.name : 'Gra'}`)
                    .setDescription(
                        `**Twórca ogłoszenia:** <@${user.id}>\n` +
                        `👥 **Skład:** \`1 / ${maxPlayers}\` osób\n` +
                        `💬 **Opis:** ${description}\n\n` +
                        `**Obecna ekipa:**\n• <@${user.id}> (Host)`
                    )
                    .setTimestamp();

                const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder().setCustomId('lfg_join').setLabel('Dołącz do ekipy').setStyle(ButtonStyle.Success).setEmoji('➕'),
                    new ButtonBuilder().setCustomId('lfg_leave').setLabel('Opuść').setStyle(ButtonStyle.Danger).setEmoji('➖'),
                    new ButtonBuilder().setCustomId('lfg_close').setLabel('Zamknij ogłoszenie').setStyle(ButtonStyle.Secondary).setEmoji('🔒')
                );

                const sentMsg = await interaction.reply({ content: rolePing, embeds: [embed], components: [row], allowedMentions: { roles: roleId ? [roleId] : [] }, fetchReply: true });
                await LFGModel.create({ messageId: sentMsg.id, channelId: interaction.channelId, authorId: user.id, game: gameKey, maxPlayers, currentPlayers: [user.id], description });
                return;
            }
        }

        // === OBSŁUGA AUTOCOMPLETE ===
        if (interaction.isAutocomplete()) {
            const { commandName, options } = interaction;
            if (commandName === 'daj-odznake' || commandName === 'zabierz-odznake') {
                const focusedValue = options.getFocused().toLowerCase();
                const filtered = AVAILABLE_BADGES.filter(b => b.toLowerCase().includes(focusedValue)).slice(0, 25);
                return interaction.respond(filtered.map(b => ({ name: b.replace(/\*\*/g, '').replace(/[✨🎖️🏷️]/g, '').trim(), value: b })));
            }
            if (commandName === 'mem') {
                const focusedValue = options.getFocused().toLowerCase();
                const presets = ['Drake Hotline Bling', 'Distracted Boyfriend', 'Two Buttons', 'Change My Mind', 'Expanding Brain', 'Buff Doge vs. Cheems', 'Disaster Girl', 'Sad Pablo Escobar'];
                const filtered = presets.filter(p => p.toLowerCase().includes(focusedValue)).slice(0, 25);
                return interaction.respond(filtered.map(p => ({ name: p, value: p })));
            }
        }

        // === OBSŁUGA PRZYCISKÓW I INTERAKCJI KOMPONENTÓW ===
        if (interaction.isButton()) {
            const { customId, user, guild } = interaction;
            if (!guild) return;

            // Weryfikacja płci (gdyby ktoś kliknął przycisk weryfikacji)
            if (customId === 'role_fn_updates_toggle') {
                const member = await guild.members.fetch(user.id);
                if (member.roles.cache.has(ID_RANGI_AKTUALIZACJE_FORTNITE)) {
                    await member.roles.remove(ID_RANGI_AKTUALIZACJE_FORTNITE);
                    return interaction.reply({ content: '🔔 Wyłączono powiadomienia o aktualizacjach Fortnite.', ephemeral: true });
                } else {
                    await member.roles.add(ID_RANGI_AKTUALIZACJE_FORTNITE);
                    return interaction.reply({ content: '🔔 Włączono powiadomienia o aktualizacjach Fortnite!', ephemeral: true });
                }
            }

            if (customId.startsWith('role_')) {
                const mapData = ROLE_BUTTONS_MAP[customId];
                if (!mapData) return interaction.reply({ content: '❌ Nie znaleziono takiej roli.', ephemeral: true });

                const member = await guild.members.fetch(user.id);
                if (member.roles.cache.has(mapData.roleId)) {
                    await member.roles.remove(mapData.roleId);
                    return interaction.reply({ content: `✅ Usunięto rangę **${mapData.label}**.`, ephemeral: true });
                } else {
                    await member.roles.add(mapData.roleId);
                    return interaction.reply({ content: `✅ Otrzymałeś rangę **${mapData.label}**!`, ephemeral: true });
                }
            }

            if (customId === 'create_ticket') {
                const ticketChannel = await guild.channels.create({
                    name: `ticket-${user.username}`,
                    type: ChannelType.GuildText,
                    parent: ID_KANALU_ZGLOSZEN_KATEGORIE, // Umieszczenie w wybranej kategorii zgłoszeń
                    permissionOverwrites: [
                        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                        { id: ID_RANGI_MODERATOR, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                        { id: ID_RANGI_ADMIN, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                    ]
                });

                const embed = new EmbedBuilder()
                    .setColor(0x2ECC71)
                    .setTitle(`🎫 Ticket • ${user.username}`)
                    .setDescription('Witaj! Opisz swój problem lub sprawę. Nasza ekipa wkrótce się z Tobą skontaktuje.\n\nKliknij przycisk poniżej, aby zamknąć ticket, gdy sprawa zostanie rozwiązana.');

                const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder().setCustomId('close_ticket').setLabel('Zamknij Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
                );

                await ticketChannel.send({ content: `<@${user.id}> <@&${ID_RANGI_MODERATOR}>`, embeds: [embed], components: [row] });
                return interaction.reply({ content: `✅ Utworzono Twój prywatny ticket: <#${ticketChannel.id}>`, ephemeral: true });
            }

            if (customId === 'close_ticket') {
                const channel = interaction.channel as TextChannel;
                await interaction.reply({ content: '🔒 Zamykanie ticketu za 5 sekund...', ephemeral: true });
                setTimeout(() => channel.delete().catch(() => {}), 5000);
                return;
            }

            if (customId === 'wheel_spin') {
                let userDoc = await UserModel.findOne({ userId: user.id });
                if (!userDoc) userDoc = await UserModel.create({ userId: user.id });

                const now = new Date();
                if (userDoc.lastWheelSpin) {
                    const diffHours = (now.getTime() - new Date(userDoc.lastWheelSpin).getTime()) / (1000 * 60 * 60);
                    if (diffHours < 2) {
                        const waitHours = Math.ceil(2 - diffHours);
                        return interaction.reply({ content: `⏳ Możesz zakręcić Kołem Fortuny ponownie za ok. **${waitHours}h**!`, ephemeral: true });
                    }
                }

                userDoc.lastWheelSpin = now;
                const prizes = [50, 150, 300, 500, 1000, 0, 250, 500];
                const won = prizes[Math.floor(Math.random() * prizes.length)];

                userDoc.balance += won;
                await userDoc.save();

                await TransactionHistoryModel.create({ userId: user.id, type: 'WHEEL', amount: won, details: 'Koło Fortuny' });
                return interaction.reply({ content: `🎡 Zakręciłeś Kołem Fortuny i wygrałeś **${won} PJN-Coins**! 🎉`, ephemeral: true });
            }

            if (customId === 'rr_start_modal') {
                const modal = new ModalBuilder()
                    .setCustomId('modal_russian_roulette')
                    .setTitle('🎯 Rosyjska Ruletka');

                const stakeInput = new TextInputBuilder()
                    .setCustomId('rr_stake_input')
                    .setLabel('Podaj stawkę PJN-Coins do zaryzykowania:')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(stakeInput));
                return interaction.showModal(modal);
            }

            if (customId === 'quiz_ans_yes') {
                let userDoc = await UserModel.findOne({ userId: user.id });
                if (!userDoc) userDoc = await UserModel.create({ userId: user.id });
                const reward = 250;
                userDoc.balance += reward;
                await userDoc.save();
                return interaction.update({ content: `🎉 **Poprawna odpowiedź!** Otrzymujesz nagrodę **${reward} PJN-Coins** do portfela!`, embeds: [], components: [] });
            }

            if (customId === 'quiz_ans_no') {
                return interaction.update({ content: `❌ **Błędna odpowiedź!** Spróbuj ponownie następnym razem.`, embeds: [], components: [] });
            }

            if (customId.startsWith('poll_vote_')) {
                const optionIndex = parseInt(customId.split('_')[2]);
                const poll = await PollModel.findOne({ messageId: interaction.message.id });
                if (!poll || poll.ended) return interaction.reply({ content: '❌ Ta ankieta już się zakończyła!', ephemeral: true });

                for (let i = 0; i < poll.votes.length; i++) {
                    poll.votes[i] = poll.votes[i].filter(id => id !== user.id);
                }

                poll.votes[optionIndex].push(user.id);
                await poll.save();

                const totalVotes = poll.votes.reduce((acc, curr) => acc + curr.length, 0);
                let desc = `🗳️ **${poll.question}**\n\n`;
                for (let i = 0; i < poll.options.length; i++) {
                    const count = poll.votes[i].length;
                    const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                    desc += `**${i + 1}. ${poll.options[i]}** — \`${count} głosów\` (${percent}%)\n`;
                }

                const embed = new EmbedBuilder().setColor(0x3498DB).setTitle('📊 Ankieta na żywo').setDescription(desc).setTimestamp();
                await interaction.message.edit({ embeds: [embed] });
                return interaction.reply({ content: `✅ Twój głos został zapisany!`, ephemeral: true });
            }

            if (customId === 'lfg_join') {
                const lfgDoc = await LFGModel.findOne({ messageId: interaction.message.id });
                if (!lfgDoc || lfgDoc.status === 'closed') return interaction.reply({ content: '❌ To ogłoszenie LFG jest już nieaktualne.', ephemeral: true });

                if (lfgDoc.currentPlayers.includes(user.id)) {
                    return interaction.reply({ content: '⚠️ Już jesteś w tej ekipiе!', ephemeral: true });
                }

                if (lfgDoc.currentPlayers.length >= lfgDoc.maxPlayers) {
                    return interaction.reply({ content: '❌ Przepraszamy, skład jest już zapełniony!', ephemeral: true });
                }

                lfgDoc.currentPlayers.push(user.id);
                await lfgDoc.save();

                let shouldCreateVoice = lfgDoc.currentPlayers.length >= lfgDoc.maxPlayers;
                if (shouldCreateVoice && !lfgDoc.voiceChannelId) {
                    try {
                        const voiceChannel = await guild.channels.create({
                            name: `🎮 Ekipa • ${user.username}`,
                            type: ChannelType.GuildVoice,
                            parent: LFG_CONFIG.CATEGORY_VOICE,
                            userLimit: lfgDoc.maxPlayers,
                            permissionOverwrites: [
                                { id: guild.id, deny: [PermissionFlagsBits.Connect] },
                                ...lfgDoc.currentPlayers.map(id => ({ id, allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.ViewChannel] }))
                            ]
                        });
                        lfgDoc.voiceChannelId = voiceChannel.id;
                        lfgDoc.status = 'full';
                        await lfgDoc.save();
                    } catch (e) {}
                }

                await updateLFGMessage(interaction.message, lfgDoc);
                return interaction.reply({ content: `✅ Dołączyłeś do ekipy! ${lfgDoc.voiceChannelId ? 'Utworzono prywatny kanał głosowy.' : ''}`, ephemeral: true });
            }

            if (customId === 'lfg_leave') {
                const lfgDoc = await LFGModel.findOne({ messageId: interaction.message.id });
                if (!lfgDoc || lfgDoc.status === 'closed') return interaction.reply({ content: '❌ Ogłoszenie jest zamknięte.', ephemeral: true });

                if (!lfgDoc.currentPlayers.includes(user.id)) {
                    return interaction.reply({ content: '⚠️ Nie jesteś w tej ekipiе!', ephemeral: true });
                }

                if (lfgDoc.authorId === user.id) {
                    return interaction.reply({ content: '❌ Autor ogłoszenia nie może opuścić ekipy – może jedynie zamknąć ogłoszenie.', ephemeral: true });
                }

                lfgDoc.currentPlayers = lfgDoc.currentPlayers.filter(id => id !== user.id);
                await lfgDoc.save();

                if (lfgDoc.voiceChannelId) {
                    try {
                        const vc = await guild.channels.fetch(lfgDoc.voiceChannelId).catch(() => null);
                        if (vc) {
                            await vc.permissionOverwrites.delete(user.id).catch(() => {});
                        }
                    } catch (e) {}
                }

                await updateLFGMessage(interaction.message, lfgDoc);
                return interaction.reply({ content: `✅ Opuściłeś ekipę.`, ephemeral: true });
            }

            if (customId === 'lfg_close') {
                const lfgDoc = await LFGModel.findOne({ messageId: interaction.message.id });
                if (!lfgDoc) return interaction.reply({ content: '❌ Nie znaleziono ogłoszenia.', ephemeral: true });

                if (lfgDoc.authorId !== user.id && !isAuthorized(user.id)) {
                    return interaction.reply({ content: '❌ Tylko autor ogłoszenia lub administrator może je zamknąć!', ephemeral: true });
                }

                lfgDoc.status = 'closed';
                await lfgDoc.save();

                if (lfgDoc.voiceChannelId) {
                    try {
                        const vc = await guild.channels.fetch(lfgDoc.voiceChannelId).catch(() => null);
                        if (vc) await vc.delete('Zamknięcie LFG przez autora');
                    } catch (e) {}
                }

                await updateLFGMessage(interaction.message, lfgDoc);
                return interaction.reply({ content: `✅ Zamknięto ogłoszenie LFG.`, ephemeral: true });
            }
        }

        // === OBSŁUGA MENU ROZWIJANYCH (STRING SELECT MENUS) ===
        if (interaction.isStringSelectMenu()) {
            const { customId, values, user, guild } = interaction;
            if (!guild) return;

            if (customId === 'verification_gender_select') {
                const selected = values[0];
                const member = await guild.members.fetch(user.id);

                await member.roles.add(ID_RANGI_ZWERYFIKOWANY).catch(() => {});
                if (selected === 'verify_male') {
                    await member.roles.add(ID_ROLI_MEZCZYZNA).catch(() => {});
                    await member.roles.remove(ID_ROLI_KOBIETA).catch(() => {});
                } else if (selected === 'verify_female') {
                    await member.roles.add(ID_ROLI_KOBIETA).catch(() => {});
                    await member.roles.remove(ID_ROLI_MEZCZYZNA).catch(() => {});
                }

                return interaction.reply({ content: `✅ Weryfikacja zakończona pomyślnie! Otrzymałeś odpowiednie rangi i pełny dostęp do serwera PJN.`, ephemeral: true });
            }

            if (customId === 'shop_select') {
                const selectedItemId = values[0];
                const item = SHOP_ITEMS.find(i => i.id === selectedItemId);
                if (!item) return interaction.reply({ content: '❌ Nie znaleziono takiego przedmiotu.', ephemeral: true });

                let userDoc = await UserModel.findOne({ userId: user.id });
                if (!userDoc || userDoc.balance < item.price) {
                    return interaction.reply({ content: `❌ Nie masz wystarczającej liczby PJN-Coins! Potrzebujesz **${item.price} Coins** (posiadasz: \`${userDoc ? userDoc.balance : 0}\`).`, ephemeral: true });
                }

                userDoc.balance -= item.price;
                await userDoc.save();

                await ShopHistoryModel.create({ userId: user.id, itemName: item.name, price: item.price });
                const member = await guild.members.fetch(user.id);

                if (item.type === 'vip') {
                    userDoc.vipExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                    await userDoc.save();
                    await member.roles.add(ID_ROLI_VIP).catch(() => {});
                } else if (item.type === 'double_chance') {
                    userDoc.doubleChanceUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                    await userDoc.save();
                } else if (item.type === 'daily_boost') {
                    userDoc.dailyBoostUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                    await userDoc.save();
                } else if (item.type === 'badge' && item.badgeName) {
                    if (!userDoc.badges.includes(item.badgeName)) {
                        userDoc.badges.push(item.badgeName);
                        await userDoc.save();
                    }
                }

                await checkAndAwardBadges(userDoc, member, guild);
                return interaction.reply({ content: `🎉 **Gratulacje zakupu!** Pomyślnie zakupiono: **${item.name}** za **${item.price} PJN-Coins**.`, ephemeral: true });
            }
        }

        // === OBSŁUGA MODALÓW (FORMULARZY) ===
        if (interaction.isModalSubmit()) {
            const { customId, fields, user, guild } = interaction;
            if (!guild) return;

            if (customId === 'modal_russian_roulette') {
                const stakeStr = fields.getTextInputValue('rr_stake_input');
                const stake = parseInt(stakeStr);

                if (isNaN(stake) || stake <= 0) {
                    return interaction.reply({ content: '❌ Podaj prawidłową, dodatnią stawkę liczbową!', ephemeral: true });
                }

                let userDoc = await UserModel.findOne({ userId: user.id });
                if (!userDoc || userDoc.balance < stake) {
                    return interaction.reply({ content: '❌ Nie masz tylu PJN-Coins w portfelu!', ephemeral: true });
                }

                userDoc.casinoPlays = (userDoc.casinoPlays || 0) + 1;
                const bulletSlot = Math.floor(Math.random() * 6) + 1;
                const playerPull = Math.floor(Math.random() * 6) + 1;
                const survived = playerPull !== bulletSlot;

                if (survived) {
                    const winnings = stake * 2;
                    userDoc.balance += stake; // zwrot + wygrana
                    userDoc.consecutiveWins = (userDoc.consecutiveWins || 0) + 1;
                    userDoc.consecutiveLosses = 0;
                    await userDoc.save();

                    await TransactionHistoryModel.create({ userId: user.id, type: 'RR', amount: winnings, details: `Rosyjska Ruletka (Przeżył, stawka: ${stake})` });
                    await checkAndAwardBadges(userDoc, interaction.member, guild);

                    return interaction.reply({ content: `🎯 **Rosyjska Ruletka:** Pociągnąłeś za spust (komora ${playerPull}, kula była w ${bulletSlot}). **Przeżyłeś!** Wygrywasz **${winnings} PJN-Coins**! 🎉`, ephemeral: true });
                } else {
                    userDoc.balance -= stake;
                    userDoc.consecutiveLosses = (userDoc.consecutiveLosses || 0) + 1;
                    userDoc.consecutiveWins = 0;
                    await userDoc.save();

                    await TransactionHistoryModel.create({ userId: user.id, type: 'RR', amount: -stake, details: `Rosyjska Ruletka (Zginął, stawka: ${stake})` });
                    await checkAndAwardBadges(userDoc, interaction.member, guild);

                    return interaction.reply({ content: `🎯 **Rosyjska Ruletka:** Trafiłeś na kulę w komorze ${bulletSlot}! Tracisz postawione **${stake} PJN-Coins**. 💀`, ephemeral: true });
                }
            }
        }
    } catch (e) {
        console.error('Błąd podczas obsługi interakcji:', e);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Wystąpił nieoczekiwany błąd podczas przetwarzania interakcji.', ephemeral: true }).catch(() => {});
        }
    }
});

async function updateLFGMessage(message: any, lfgDoc: any) {
    const gameInfo = (LFG_CONFIG.GAMES as any)[lfgDoc.game];
    const playersListStr = lfgDoc.currentPlayers.map((id: string) => `• <@${id}>`).join('\n');

    const embed = new EmbedBuilder()
        .setColor(lfgDoc.status === 'closed' ? 0xE74C3C : 0x5865F2)
        .setTitle(`🎮 Centrum LFG • ${gameInfo ? gameInfo.name : 'Gra'} ${lfgDoc.status === 'closed' ? '(ZAMKNIĘTE)' : ''}`)
        .setDescription(
            `**Twórca ogłoszenia:** <@${lfgDoc.authorId}>\n` +
            `👥 **Skład:** \`${lfgDoc.currentPlayers.length} /${lfgDoc.maxPlayers}\` osób\n` +
            `💬 **Opis:** ${lfgDoc.description}\n\n` +
            `**Obecna ekipa:**\n${playersListStr}` +
            `${lfgDoc.voiceChannelId ? `\n\n🔊 **Utworzono kanał głosowy:** <#${lfgDoc.voiceChannelId}>` : ''}`
        )
        .setTimestamp();

    if (lfgDoc.status === 'closed') {
        await message.edit({ embeds: [embed], components: [] }).catch(() => {});
    } else {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('lfg_join').setLabel('Dołącz do ekipy').setStyle(ButtonStyle.Success).setEmoji('➕'),
            new ButtonBuilder().setCustomId('lfg_leave').setLabel('Opuść').setStyle(ButtonStyle.Danger).setEmoji('➖'),
            new ButtonBuilder().setCustomId('lfg_close').setLabel('Zamknij ogłoszenie').setStyle(ButtonStyle.Secondary).setEmoji('🔒')
        );
        await message.edit({ embeds: [embed], components: [row] }).catch(() => {});
    }
}

// Prosty serwer HTTP do podtrzymania działania bota (Render / Glitch itp.)
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('PJN Discord Bot is running successfully!\n');
}).listen(process.env.PORT || 3000);

client.login(token);
