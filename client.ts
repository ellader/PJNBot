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

// Zaktualizowane ID kanałów zgodnie z poleceniem
const ID_KANAL_ZGLOSZEN_KATEGORIE = '1532862125209555157';
const ID_KANAL_WSPARCIA_BOTA = '1532862421729808565';

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

// === BAZA WIEDZY TECHNICZNEJ O DISCORDZIE ORAZ SERWERZE PJN ===
const DISCORD_TECH_KNOWLEDGE = {
    permissions: "Uprawnienia (Permissions) określają, co dany użytkownik lub rola może robić na serwerze (np. Zarządzanie wiadomościami, Wyrzucanie, Banowanie, Wysyłanie embedów). Są zarządzane w ustawieniach serwera w zakładce Role.",
    slashCommands: "Komendy ukośnika (Slash Commands) to nowoczesny standard interakcji z botami w Discordzie. Wywoływane są za pomocą znaku `/`. Zapewniają bezpieczeństwo, podpowiedzi argumentów (autouzupełnianie) oraz uporządkowany interfejs.",
    embeds: "Wiadomości typu Embed to bogato sformatowane bloki tekstowe z kolorowymi paskami bocznymi, miniaturami, polami (fields) i stopkami, pozwalające na estetyczną prezentację treści.",
    webhooks: "Webhooki pozwalają zewnętrznym aplikacjom lub systemom automatycznym (np. API gier, systemy powiadomień) publikować wiadomości na kanałach tekstowych bez konieczności ciągłego logowania się konta bota."
};

const PJN_SERVER_KNOWLEDGE = {
    verification: "Weryfikacja odbywa się na kanale <#1549658822136696832>. Wybierając płeć w rozwijanym menu, otrzymujesz odpowiednią rangę członkowską oraz pełny dostęp do serwera.",
    shop: "Oficjalny sklep serwerowy znajduje się na kanale <#1545690716309553212>. Możesz w nim kupić role VIP, podwójne szanse w kasynie, własne role czy odznaki za PJN-Coins.",
    lfg: "System szukania drużyny (LFG) na kanale <#1532449084559069214> pozwala na tworzenie ogłoszeń do gier za pomocą `/szukam`. Po zebraniu ekipy bot automatycznie tworzy prywatny kanał głosowy.",
    tickets: "Kanał zgłoszeń z kategoriami (<#" + ID_KANAL_ZGLOSZEN_KATEGORIE + ">) oraz panel pomocy (<#" + ID_KANALU_DUSZKI + ">) służą do kontaktu z administracją i obsługi spraw dotyczących duszków oraz problemów na serwerie.",
    supportBot: "Kanał interaktywnego bota (<#" + ID_KANAL_WSPARCIA_BOTA + ">) służy do korzystania z wbudowanego centrum wiedzy, zadawania pytań i interakcji z botem PJN."
};

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

// Funkcja inicjalizująca interaktywny kanał wsparcia i wiedzy bota
async function setupSupportBotChannel() {
    try {
        const channel = await client.channels.fetch(ID_KANAL_WSPARCIA_BOTA).catch(() => null) as TextChannel;
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
            .setColor(0x3498DB)
            .setTitle('🤖 Centrum Wiedzy i Wsparcia PJN Bot')
            .setDescription(
                'Witaj w interaktywnym centrum pomocy bota PJN!\n\n' +
                'Bot posiada pełną i rozbudowaną wiedzę techniczną dotyczącą **Discorda** oraz kompletne informacje o **serwerze PJN** (co gdzie jest, jak korzystać z funkcji, rang, sklepu i LFG).\n\n' +
                '👇 **Wybierz interesujący Cię temat z poniższego menu, aby uzyskać natychmiastową pomoc:**'
            )
            .setImage(LIVE_IMAGE_URL)
            .setTimestamp()
            .setFooter({ text: 'PJN Interactive Support Hub' });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('support_knowledge_select')
            .setPlaceholder('Wybierz temat, o którym chcesz się dowiedzieć...')
            .addOptions([
                {
                    label: '🔧 Wiedza techniczna: Discord (Uprawnienia & Komendy)',
                    description: 'Dowiedz się, jak działają uprawnienia, slash commands i embedy',
                    value: 'tech_discord',
                    emoji: '⚙️'
                },
                {
                    label: '🗺️ Wiedza o serwerze PJN (Gdzie co jest i jak używać)',
                    description: 'Kompleksowy przewodnik po kanałach, weryfikacji i społeczności',
                    value: 'pjn_server',
                    emoji: '🏛️'
                },
                {
                    label: '🛒 Sklep, Ekonomie & PJN-Coins',
                    description: 'Jak zdobywać monety i kupować rangi VIP oraz odznaki',
                    value: 'pjn_economy',
                    emoji: '🪙'
                },
                {
                    label: '🎮 System LFG & Gry (Fortnite, CS2 itp.)',
                    description: 'Jak szukać ekipy i tworzyć automatyczne pokoje głosowe',
                    value: 'pjn_lfg',
                    emoji: '🎮'
                },
                {
                    label: '🎫 Zgłoszenia i Pomoc (Tickety)',
                    description: 'Jak skontaktować się z administracją i otworzyć ticket',
                    value: 'pjn_tickets',
                    emoji: '🎫'
                }
            ]);

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
        const sentMsg = await channel.send({ embeds: [embed], components: [row] });
        await sentMsg.pin().catch(() => {});
    } catch (e) {
        console.error('Błąd inicjalizacji kanału wsparcia bota:', e);
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
            'Kliknij poniższy przycisk **"Stwórz Ticket"**, aby otworzyć prywatny kanał w kategorii zgłoszeń (<#' + ID_KANAL_ZGLOSZEN_KATEGORIE + '>). Nasza ekipa pomoże Ci tak szybko, jak to możliwe!\n\n' +
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
        const activeLfgWithVoice = await LFGModel.find({ status: { $ne: 'closed' }, voiceChannelId: {$ne: null } });
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
            option.setName('osoby')
                .setDescription('Maksymalna liczba graczy w drużynie (np. 4)')
                .setRequired(true)
                .setMinValue(2)
                .setMaxValue(16)
        )
        .addStringOption(option =>
            option.setName('opis')
                .setDescription('Opcjonalny opis (np. ranga, mikrofon, styl gry)')
                .setRequired(false)
        )
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(token);

client.on('ready', async () => {
    console.log(`Zalogowano jako ${client.user?.tag}!`);
    try {
        await rest.put(Routes.applicationCommands(client.user!.id), { body: commands });
        console.log('Zarejestrowano pomyślnie komendy slash!');
    } catch (e) {
        console.error('Błąd rejestracji komend slash:', e);
    }

    await seedQuotesIfNeeded();
    await cleanupOrphanedLfgVoices();

    // Inicjalizacja kluczowych kanałów serwera PJN
    await setupSupportBotChannel();
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

    startServerStatsCron();
    startDailyQuotes();
    startDailyShopAutoPoster();
    startFortniteStatusCron();
    startFortniteRankingCron();
    startExpirationChecker();
    startPollChecker();
    startTopUpdater();
    startReputationTopUpdater();
    startBadgesInfoUpdater();
    startLfgAutoCloser();
    startPokerRoomInactivityChecker();
    startHourlyAnnouncements();

    http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('PJN Bot Discord dziala poprawnie!\n');
    }).listen(process.env.PORT || 3000);
});

// Obsługa interakcji (Slash Commands, Select Menus, Buttons, Modals)
client.on('interactionCreate', async (interaction) => {
    try {
        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'support_knowledge_select') {
                const selectedValue = interaction.values[0];
                let embed = new EmbedBuilder().setColor(0x3498DB).setTimestamp();

                if (selectedValue === 'tech_discord') {
                    embed.setTitle('⚙️ Wiedza techniczna: Discord')
                        .setDescription(
                            'Bot posiada zaawansowaną wiedzę na temat architektury i mechanizmów Discorda:\n\n' +
                            `• **Uprawnienia:** ${DISCORD_TECH_KNOWLEDGE.permissions}\n\n` +
                            `• **Komendy Ukośnika (Slash):** ${DISCORD_TECH_KNOWLEDGE.slashCommands}\n\n` +
                            `• **Wiadomości Embed:** ${DISCORD_TECH_KNOWLEDGE.embeds}\n\n` +
                            `• **Webhooki:** ${DISCORD_TECH_KNOWLEDGE.webhooks}`
                        );
                } else if (selectedValue === 'pjn_server') {
                    embed.setTitle('🗺️ Wiedza o serwerze PJN')
                        .setDescription(
                            'Oto najważniejsze informacje o organizacji serwera PJN:\n\n' +
                            `• **Weryfikacja:** ${PJN_SERVER_KNOWLEDGE.verification}\n\n` +
                            `• **Sklep serwerowy:** ${PJN_SERVER_KNOWLEDGE.shop}\n\n` +
                            `• **System LFG:** ${PJN_SERVER_KNOWLEDGE.lfg}\n\n` +
                            `• **Kanał wsparcia bota:** ${PJN_SERVER_KNOWLEDGE.supportBot}`
                        );
                } else if (selectedValue === 'pjn_economy') {
                    embed.setTitle('🪙 Ekonomia i Sklep PJN')
                        .setDescription(
                            'Na serwerze PJN obowiązuje waluta **PJN-Coins**, którą zdobywasz za aktywność na czacie, głosach oraz gry w kasynie.\n\n' +
                            '• Możesz wydawać je w sklepie (<#' + ID_KANAL_SKLEPU + '>) na role VIP, odznaki czy pakiety boostów.\n' +
                            '• Użyj komend `/portfel`, `/sklep` lub `/daily`, aby zarządzać swoimi finansami.'
                        );
                } else if (selectedValue === 'pjn_lfg') {
                    embed.setTitle('🎮 System LFG i Gry')
                        .setDescription(
                            'Szukasz ekipy do Fortnite, CS2, Minecrafta, Valoranta lub LoL-a?\n\n' +
                            '• Przejdź na kanał <#' + ID_KANALU_SZUKAM_DO_GRY + '> i użyj komendy `/szukam`.\n' +
                            '• Bot stworzy ogłoszenie z przyciskami i automatycznie założy prywatny kanał głosowy, gdy zbierze się skład!'
                        );
                } else if (selectedValue === 'pjn_tickets') {
                    embed.setTitle('🎫 Zgłoszenia i Pomoc (Tickety)')
                        .setDescription(
                            'Masz problem lub pytanie do administracji?\n\n' +
                            `• Przejdź na kanał <#${ID_KANALU_DUSZKI}> i kliknij przycisk "Stwórz Ticket".\n` +
                            `• Twój prywatny kanał zostanie utworzony w kategorii zgłoszeń (<#${ID_KANAL_ZGLOSZEN_KATEGORIE}>), gdzie ekipa pomoże Ci w każdej sprawie.`
                        );
                }

                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }

            if (interaction.customId === 'verification_gender_select') {
                const choice = interaction.values[0];
                const member = interaction.member as any;
                if (!member) return;

                let roleToGiveId = '';
                let genderName = '';

                if (choice === 'verify_male') {
                    roleToGiveId = ID_ROLI_MEZCZYZNA;
                    genderName = 'Mężczyzna';
                } else if (choice === 'verify_female') {
                    roleToGiveId = ID_ROLI_KOBIETA;
                    genderName = 'Kobieta';
                }

                try {
                    const rolesToAdd = [ID_RANGI_ZWERYFIKOWANY];
                    if (roleToGiveId) rolesToAdd.push(roleToGiveId);

                    await member.roles.add(rolesToAdd);

                    await interaction.reply({
                        content: `✅ Pomyślnie zweryfikowano konto! Wybrano płeć: **${genderName}**. Odblokowano pełny dostęp do serwera PJN! 🎉`,
                        ephemeral: true
                    });
                } catch (err) {
                    await interaction.reply({
                        content: '❌ Wystąpił błąd podczas nadawania ról weryfikacyjnych. Upewnij się, że bot ma odpowiednie uprawnienia.',
                        ephemeral: true
                    });
                }
                return;
            }
        }

        if (interaction.isChatInputCommand()) {
            const { commandName } = interaction;
            const userId = interaction.user.id;
            const guild = interaction.guild;

            if (commandName === 'portfel') {
                let user = await UserModel.findOne({ userId });
                if (!user) user = await UserModel.create({ userId });
                await interaction.reply({ content: `💰 Stan Twojego portfela: **${user.balance} PJN-Coins**`, ephemeral: true });
            } else if (commandName === 'daily') {
                let user = await UserModel.findOne({ userId });
                if (!user) user = await UserModel.create({ userId });

                const now = new Date();
                const lastDaily = user.lastDaily ? new Date(user.lastDaily) : null;
                const cooldown = 24 * 60 * 60 * 1000;

                if (lastDaily && (now.getTime() - lastDaily.getTime() < cooldown)) {
                    const remaining = cooldown - (now.getTime() - lastDaily.getTime());
                    const hours = Math.floor(remaining / (1000 * 60 * 60));
                    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
                    await interaction.reply({ content: `⏳ Nagrodę /daily można odbierać raz na 24 godziny. Spróbuj ponownie za **${hours}h ${minutes}m**!`, ephemeral: true });
                    return;
                }

                let reward = 100;
                if (user.dailyBoostUntil && new Date(user.dailyBoostUntil) > now) {
                    reward *= 2;
                }

                user.balance += reward;
                user.lastDaily = now;
                await user.save();

                await TransactionHistoryModel.create({
                    userId,
                    type: 'DAILY',
                    amount: reward,
                    details: 'Odbiór codziennej nagrody /daily'
                });

                await checkAndAwardBadges(user, interaction.member || interaction.user, guild);
                await interaction.reply({ content: `🎁 Odebrałeś codzienne **${reward} PJN-Coins** do portfela! 💰`, ephemeral: true });
            }
        }
    } catch (err) {
        console.error('Błąd podczas obsługi interakcji:', err);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'Wystąpił błąd podczas wykonywania tej komendy.', ephemeral: true }).catch(() => {});
        }
    }
});

client.login(token);
