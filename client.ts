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
    ApplicationCommandType
} from 'discord.js';
import mongoose from 'mongoose';
import cron from 'node-cron';
import Parser from 'rss-parser';

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
    '⏳ **Weteran (Rzadka)**',
    '⏳ **Weteran Półrocza**',
    '🛡️ **Filar Społeczności**',
    '🎟️ **Kolekcjoner (Epicka)**',
    '⭐ **Awansowy Ekspert (Lvl 10)**',
    '🌟 **Mistrz Poziomów (Lvl 50, Rzadka)**',
    '👑 **Legenda Serwera (Lvl 100, Elitarna)**'
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
    votes: { type: [[String]], required: true }, // Tablica tablic ID głosujących dla każdej opcji
    ended: { type: Boolean, default: false }
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
const ID_KANALU_CYTATY = '1549709251365183558'; // Zaktualizowany kanał Złote myśli PJN
const ID_KANALU_MEMOW = '1534833757335326810';
const ID_KANALU_SZUKAM_DO_GRY = '1532449084559069214'; 
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
const ADMIN_LOG_CHANNEL_ID = "1532399010785263799"; 

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

// === AUTOMATYCZNE PUBLIKOWANIE OSIĄGNIĘĆ / CENTRUM ODZNAK NA KANALE OGŁOSZEŃ ===
async function setupAnnouncementsAchievements() {
    try {
        const channel = await client.channels.fetch(ANNOUNCE_CHANNEL_ID).catch(() => null) as TextChannel;
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setColor(0x9B59B6)
            .setTitle('🏆 Centrum Osiągnięć i Rzadkich Odznak PJN')
            .setDescription(
                'Witaj w oficjalnym systemie osiągnięć serwera! Będąc aktywnym, rozmawiając, grając w kasynie czy rozwijając poziom, zdobywasz unikalne odznaki.\n\n' +
                '⭐ **Wybrane rzadkie i prestiżowe odznaki:**\n' +
                '• 🏦 **Milioner** — Zgromadź 100 000 PJN-Coins *(Elitarny bogacz)*\n' +
                '• 🎰 **Ryzykant** — Rozegraj 100 gier w kasynie *(Dla prawdziwych hazardzistów)*\n' +
                '• ⏳ **Weteran** — Staż na serwerze powyżej 1 roku\n' +
                '• 🎟️ **Kolekcjoner** — Zdobycie wszystkich podstawowych odznak\n' +
                '• 🌟 **Mistrz Poziomów** — Osiągnięcie 50 poziomu doświadczenia\n' +
                '• 👑 **Legenda Serwera** — Osiągnięcie 100 poziomu doświadczenia\n\n' +
                '🔍 Wpisz `/odznaki`, aby sprawdzić swój aktualny profil i postępy!'
            )
            .setImage(LIVE_IMAGE_URL)
            .setTimestamp()
            .setFooter({ text: 'PJN System Osiągnięć • Automatyczne powiadomienia' });

        await channel.send({ embeds: [embed] });
    } catch (e) {
        console.error('Błąd wysyłania osiągnięć na ogłoszenia:', e);
    }
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
        .setTitle('💡 Złota myśl z serwera PJN')
        .setDescription(`> *„${quote.text}”*\n\n**— ${quote.author}**`)
        .setTimestamp()
        .setFooter({ text: 'PJN Złote Myśli' });

    await channel.send({ embeds: [embed] });
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
                    const rawName = entry.items?.[0]?.name || entry.bundle?.name || entry.devName || entry.track?.title || 'Oferta Specjalna';
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
                '🔔 *Kliknij przycisk poniżej, aby włączyć powiadomienia!*'
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
                .setDescription(`**Wydarzenie:** ${activeIncident.name}\n🕒 Start: ${new Date(activeIncident.scheduled_for).toLocaleString('pl-PL')}`)
                .setTimestamp();
            await channel.send({ content: `${rolePing} 🚨 Przerwa techniczna w Fortnite!`, embeds: [embed] });
        }

        if (currentStatusState !== 'operational' && currentStatusState !== 'none' && lastFortniteStatusState === 'operational') {
            const embed = new EmbedBuilder().setColor(0xE74C3C).setTitle('🛑 Serwery Fortnite zostały ZAMKNIĘTE!').setTimestamp();
            await channel.send({ content: `${rolePing} 🛑 Serwery offline!`, embeds: [embed] });
        }

        if (currentStatusState === 'operational' && lastFortniteStatusState && lastFortniteStatusState !== 'operational' && lastFortniteStatusState !== 'none') {
            const embed = new EmbedBuilder().setColor(0x2ECC71).setTitle('✅ Serwery Fortnite zostały OTWARTE!').setTimestamp();
            await channel.send({ content: `${rolePing} 🎉 Serwery online!`, embeds: [embed] });
        }

        lastFortniteStatusState = currentStatusState;
    } catch (err) {
        console.error('Błąd statusu Epic Games:', err);
    }
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

    let desc = `Zabójstwa graczy z naszego serwera.\n\n`;
    if (slice.length === 0) {
        desc += `Brak zarejestrowanych graczy.`;
    } else {
        for (let idx = 0; idx < slice.length; idx++) {
            const u = slice[idx];
            const globalIdx = currentPage * pageSize + idx;
            const medal = globalIdx === 0 ? '🥇' : globalIdx === 1 ? '🥈' : globalIdx === 2 ? '🥉' : `**${globalIdx + 1}.**`;
            let displayName = `<@${u.userId}>`;
            if (guild) {
                const member = await guild.members.fetch(u.userId).catch(() => null);
                if (member) displayName = member.displayName;
            }
            desc += `${medal} — **${displayName}** (${u.epicNick}) — **${u.fortniteKills || 0} zabójstw** | Meczów: \`${u.matchesPlayed || 0}\`\n`;
        }
    }

    const embed = new EmbedBuilder()
        .setColor(categoryColor)
        .setTitle(`${categoryTitle} (Strona ${currentPage + 1}/${totalPages})`)
        .setDescription(desc)
        .setImage(LIVE_IMAGE_URL)
        .setTimestamp();

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
        await channel.send(await generateFortniteRankingEmbeds(guild, underUsers, '🟢 TOP • Początkujący (<2800 meczów)', 0x2ECC71, 0));

        const overUsers = await UserModel.find({ epicNick: { $ne: null }, matchesPlayed: { $gte: 2800 } }).sort({ fortniteKills: -1 }).limit(100);
        await channel.send(await generateFortniteRankingEmbeds(guild, overUsers, '🔥 TOP • Weterani (2800+ meczów)', 0xE74C3C, 0));
    } catch (e) {
        console.error('Błąd odświeżania rankingu Fortnite:', e);
    }
}

function startFortniteRankingCron() {
    cron.schedule('0 0 * * *', async () => {
        for (const [_, guild] of client.guilds.cache) await refreshFortniteRankingMessage(guild);
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
                        if (member.roles.cache.has(ID_ROLI_VIP)) await member.roles.remove(ID_ROLI_VIP).catch(() => {});
                        userDoc.vipExpiresAt = null;
                        await userDoc.save();
                    }
                    if (userDoc.doubleChanceUntil && new Date(userDoc.doubleChanceUntil) <= now) { userDoc.doubleChanceUntil = null; await userDoc.save(); }
                    if (userDoc.dailyBoostUntil && new Date(userDoc.dailyBoostUntil) <= now) { userDoc.dailyBoostUntil = null; await userDoc.save(); }
                }
            }
        } catch (err) {}
    });
}

function createBadgesInfoEmbed() {
    return new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle('🛡️ Centrum Odznak i Osiągnięć PJN')
        .setDescription(
            'Zdobywaj unikalne odznaki za aktywność na czacie, głosie, kasynie i poziomach!\n\n' +
            '🏆 **Wyróżnione rzadkie odznaki:**\n' +
            '• 🏦 **Milioner** — 100 000 PJN-Coins\n' +
            '• 🎰 **Ryzykant** — 100 gier w kasynie\n' +
            '• ⏳ **Weteran** — Ponad rok na serwerze\n' +
            '• 🎟️ **Kolekcjoner** — Posiadanie wszystkich odznak\n' +
            '• 🌟 **Mistrz Poziomów** — 50 poziom\n' +
            '• 👑 **Legenda Serwera** — 100 poziom\n\n' +
            '🔍 Wpisz `/odznaki`, aby sprawdzić swój profil.'
        )
        .setTimestamp();
}

async function setupTicketChannel() {
    try {
        const channel = await client.channels.fetch(ID_KANALU_DUSZKI).catch(() => null) as TextChannel;
        if (!channel) return;
        const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
        if (messages) {
            for (const [_, msg] of messages) { if (msg.author.id === client.user?.id) await msg.delete().catch(() => {}); }
        }
        const embed = new EmbedBuilder().setColor(0x2ECC71).setTitle('🎫 Centrum Pomocy i Zgłoszeń PJN').setDescription('Kliknij przycisk poniżej, aby stworzyć ticket.');
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('create_ticket').setLabel('Stwórz Ticket').setStyle(ButtonStyle.Success).setEmoji('🎫'));
        await channel.send({ embeds: [embed], components: [row] });
    } catch (e) {}
}

async function setupRolesChannel() {
    try {
        const channel = await client.channels.fetch(ID_KANAL_RANG).catch(() => null) as TextChannel;
        if (!channel) return;
        const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
        if (messages) {
            for (const [_, msg] of messages) { if (msg.author.id === client.user?.id) await msg.delete().catch(() => {}); }
        }
        const embed = new EmbedBuilder().setColor(0x5865F2).setTitle('⚡ Dostosuj swoje role na serwerze PJN!').setDescription('Kliknij przycisk, aby otrzymać rolę.');
        const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('role_bezrobotny').setLabel('Bezrobotny').setStyle(ButtonStyle.Primary).setEmoji('😜'),
            new ButtonBuilder().setCustomId('role_kolekcjoner').setLabel('Kolekcjoner Duszków').setStyle(ButtonStyle.Primary).setEmoji('👻')
        );
        await channel.send({ embeds: [embed], components: [row1] });
    } catch (e) {}
}

async function setupMemeChannelInstruction() {
    try {
        const channel = await client.channels.fetch(ID_KANALU_MEMOW).catch(() => null) as TextChannel;
        if (!channel) return;
        const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
        if (messages) {
            for (const [_, msg] of messages) { if (msg.author.id === client.user?.id) await msg.delete().catch(() => {}); }
        }
        const embed = new EmbedBuilder().setColor(0xE74C3C).setTitle('🖼️ Generator Memów PJN').setDescription('Użyj komendy `/mem`, aby wygenerować mema.');
        const sentMsg = await channel.send({ embeds: [embed] });
        await sentMsg.pin().catch(() => {});
    } catch (e) {}
}

async function setupShopChannel() {
    try {
        const channel = await client.channels.fetch(ID_KANAL_SKLEPU).catch(() => null) as TextChannel;
        if (!channel) return;
        const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
        if (messages) {
            for (const [_, msg] of messages) { if (msg.author.id === client.user?.id) await msg.delete().catch(() => {}); }
        }
        let desc = 'Oficjalny sklep serwera PJN.\n\n';
        SHOP_ITEMS.forEach((item, index) => { desc += `**${index + 1}. ${item.name}** — 💰 **${item.price} PJN-Coins**\n> *${item.description}*\n\n`; });
        const embed = new EmbedBuilder().setColor(0xF1C40F).setTitle('🛒 Oficjalny Sklep Serwera PJN').setDescription(desc);
        const selectMenu = new StringSelectMenuBuilder().setCustomId('shop_select').setPlaceholder('Wybierz przedmiot do zakupu...').addOptions(
            SHOP_ITEMS.map(item => ({ label: item.name.substring(0, 25), description: `Cena: ${item.price} PJN-Coins`, value: item.id }))
        );
        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
        const sentMsg = await channel.send({ embeds: [embed], components: [row] });
        await sentMsg.pin().catch(() => {});
    } catch (e) {}
}

async function setupLfgChannelInstruction() {
    try {
        const channel = await client.channels.fetch(ID_KANALU_SZUKAM_DO_GRY).catch(() => null) as TextChannel;
        if (!channel) return;
        const embed = new EmbedBuilder().setColor(0x5865F2).setTitle('🎮 Centrum LFG').setDescription('Użyj komendy `/szukam`, aby znaleźć ekipę.');
        await channel.send({ embeds: [embed] });
    } catch (e) {}
}

async function setupReputationChannelInstruction() {
    try {
        const channel = await client.channels.fetch(ID_KANAL_REPUTACJI).catch(() => null) as TextChannel;
        if (!channel) return;
        const embed = new EmbedBuilder().setColor(0xF1C40F).setTitle('⭐ System Reputacji').setDescription('Użyj `+rep @użytkownik` lub `-rep @użytkownik`.');
        await channel.send({ embeds: [embed] });
    } catch (e) {}
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
    } catch (e) {}
}

async function checkAndAwardBadges(user: any, memberOrUser: any) {
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

    // Dodane odznaki za poziom
    const lvl = user.level || 1;
    if (lvl >= 10) addBadge('⭐ **Awansowy Ekspert (Lvl 10)**');
    if (lvl >= 50) addBadge('🌟 **Mistrz Poziomów (Lvl 50, Rzadka)**');
    if (lvl >= 100) addBadge('👑 **Legenda Serwera (Lvl 100, Elitarna)**');

    if (memberOrUser && memberOrUser.joinedAt) {
        const diffMonths = (Date.now() - new Date(memberOrUser.joinedAt).getTime()) / (1000 * 60 * 60 * 24 * 30);
        const diffYears = diffMonths / 12;
        if (diffYears >= 1) addBadge('⏳ **Weteran (Rzadka)**');
        if (diffMonths >= 6) addBadge('⏳ **Weteran Półrocza**');
    }

    if (memberOrUser && memberOrUser.roles && typeof memberOrUser.roles.cache?.some === 'function') {
        const hasAdminRole = memberOrUser.roles.cache.some((role: any) => 
            ['admin', 'administrator', 'streamer'].includes(role.name.toLowerCase())
        );
        if (hasAdminRole) addBadge('🛡️ **Filar Społeczności**');
    }

    const masterPoolCount = 20; 
    const currentCountWithoutCollector = user.badges.filter((b: string) => !b.includes('Kolekcjoner')).length;
    if (currentCountWithoutCollector >= masterPoolCount) {
        addBadge('🎟️ **Kolekcjoner (Epicka)**');
    }

    if (newBadges.length > 0) {
        await user.save();
        try {
            const target = memberOrUser.user || memberOrUser;
            await target.send({
                embeds: [{
                    color: 0xFFD700,
                    title: '🎉 Nowa odznaka odblokowana!',
                    description: `Gratulacje! Zdobyłeś nowe odznaki:\n` + newBadges.map(b => `• ${b}`).join('\n')
                }]
            }).catch(() => {});
        } catch (e) {}
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
    let levelsGained = 0;

    while (user.exp >= requiredExpForNextLevel) {
        user.exp -= requiredExpForNextLevel;
        user.level = (user.level || 1) + 1;
        leveledUp = true;
        levelsGained++;
        requiredExpForNextLevel = user.level * 150;
    }

    // Co 10 level przyznajemy 1500 PJN Coins
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
                rewardText = `\n🎁 **Nagroda za awans na ${user.level} lvl:** Otrzymałeś **1500 PJN-Coins** do portfela! 💰`;
            }

            const embed = new EmbedBuilder()
                .setColor(0x9B59B6)
                .setTitle('🚀 AWANS NA WYŻSZY POZIOM!')
                .setThumbnail(avatarUrl)
                .setDescription(
                    `Gratulacje <@${userId}>! Właśnie wskoczyłeś na wyższy poziom na serwerze! 🌟\n\n` +
                    `⭐ **Nowy Poziom:** \`${user.level}\`\n` +
                    `🏆 **Miejsce w rankingu XP:** \`#${rankDetails.rank} z ${rankDetails.total}\`` +
                    rewardText
                )
                .setTimestamp();

            await channelToSend.send({ content: `<@${userId}>`, embeds: [embed] });
        } catch (e) {}
    }
}

async function getTopEmbedData(guild: any) {
    const topUsers = await UserModel.find().sort({ balance: -1 }).limit(10);
    let desc = 'Ranking najbogatszych użytkowników:\n\n';
    for (let index = 0; index < topUsers.length; index++) {
        const u = topUsers[index];
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**${index + 1}.**`;
        let userName = `Użytkownik (${u.userId})`;
        try {
            const member = await guild.members.fetch(u.userId).catch(() => null);
            if (member) userName = member.displayName;
        } catch (e) {}
        desc += `${medal} — **${userName}** — **${u.balance} PJN-Coins**\n`;
    }
    return { color: 0xFFD700, title: '🏆 TOP 10 - Ranking PJN-Coins', description: desc };
}

async function getReputationTopEmbedData(guild: any) {
    const topUsers = await UserModel.find().sort({ reputation: -1 }).limit(5);
    let desc = 'Ranking najlepszych traderów Fortnite:\n\n';
    for (let index = 0; index < topUsers.length; index++) {
        const u = topUsers[index];
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**${index + 1}.**`;
        let userName = `Użytkownik (${u.userId})`;
        try {
            const member = await guild.members.fetch(u.userId).catch(() => null);
            if (member) userName = member.displayName;
        } catch (e) {}
        desc += `${medal} — **${userName}** — **${u.reputation || 0} pkt**\n`;
    }
    return { color: 0xF1C40F, title: '🌟 Aleja Sław - TOP 5 Traderów', description: desc };
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
                for (const [_, msg] of messages) { if (msg.author.id === client.user?.id) await msg.delete().catch(() => {}); }
            }
            await channel.send({ embeds: [await getReputationTopEmbedData(channel.guild)] });
        } catch (err) {}
    }, 5 * 60 * 60 * 1000);
}

async function sendNotification(targetKey: 'languspjn' | 'elladermusic', platform: 'youtube' | 'tiktok', title: string, url: string, customThumbnail?: string) {
    const channelId = NOTIF_CONFIG[targetKey].channelId;
    const channel = await client.channels.fetch(channelId) as TextChannel;
    if (!channel) return;
    const isYt = platform === 'youtube';
    const embed = new EmbedBuilder()
        .setColor(isYt ? 0xFF0000 : 0x00F2FE)
        .setTitle(`NOWY MATERIAŁ NA ${isYt ? 'YouTube' : 'TikTok'}!`)
        .setDescription(`Nowy film od **${targetKey === 'languspjn' ? 'LangusPJN' : 'elladerMusic'}**!\n\n**📌 ${title}**`)
        .setImage(customThumbnail || LIVE_IMAGE_URL)
        .setTimestamp();
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setLabel('Oglądaj').setStyle(ButtonStyle.Link).setURL(url));
    await channel.send({ content: '@everyone Nowy film!', embeds: [embed], components: [row] });
}

const lastVideoIds: { [key: string]: string } = {};
async function checkYouTubeRssFeeds() {
    for (const key of ['languspjn', 'elladermusic'] as const) {
        try {
            const feed = await parser.parseURL(NOTIF_CONFIG[key].rssUrl);
            if (feed && feed.items && feed.items.length > 0) {
                const latestItem = feed.items[0];
                const videoUrl = latestItem.link;
                const videoTitle = latestItem.title || 'Nowy film';
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

// === KOMENDY DISCORD ===
const commands = [
    new SlashCommandBuilder().setName('portfel').setDescription('Sprawdź stan swoich PJN-Coins'),
    new SlashCommandBuilder().setName('sklep').setDescription('Otwórz podgląd sklepu'),
    new SlashCommandBuilder().setName('moje-przedmioty').setDescription('Sprawdź aktywne przedmioty'),
    new SlashCommandBuilder().setName('historia-sklepu').setDescription('Historia zakupów (Admin)').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('historia-transakcji').setDescription('Historia transakcji (Admin)').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('topka').setDescription('Ranking najbogatszych'),
    new SlashCommandBuilder().setName('ustaw-topke').setDescription('Ustaw kanał rankingu (Admin)').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('ustaw-odznaki').setDescription('Ustaw kanał odznak (Admin)').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('daily').setDescription('Odbierz codzienne PJN-Coins'),
    new SlashCommandBuilder().setName('przelej').setDescription('Przelewa PJN-Coins').addUserOption(o => o.setName('uzytkownik').setDescription('Komu').setRequired(true)).addIntegerOption(o => o.setName('kwota').setDescription('Ile').setRequired(true)),
    new SlashCommandBuilder().setName('kostka').setDescription('Rzuć kością').addIntegerOption(o => o.setName('stawka').setDescription('Stawka').setRequired(true)),
    new SlashCommandBuilder().setName('moneta').setDescription('Orzeł czy reszka').addStringOption(o => o.setName('wybor').setDescription('Wybór').setRequired(true).addChoices({name: 'Orzeł', value: 'orzel'}, {name: 'Reszka', value: 'reszka'})).addIntegerOption(o => o.setName('stawka').setDescription('Stawka').setRequired(true)),
    new SlashCommandBuilder().setName('slot').setDescription('Sloty').addIntegerOption(o => o.setName('stawka').setDescription('Stawka').setRequired(true)),
    new SlashCommandBuilder().setName('poker').setDescription('Poker').addStringOption(o => o.setName('tryb').setDescription('Tryb').setRequired(true).addChoices({name: 'Z ludźmi', value: 'ludzie'}, {name: 'Z botem', value: 'bot'})).addIntegerOption(o => o.setName('stawka').setDescription('Stawka').setRequired(true)),
    new SlashCommandBuilder().setName('quiz').setDescription('Quiz'),
    new SlashCommandBuilder().setName('odznaki').setDescription('Wyświetla profil z odznakami').addUserOption(o => o.setName('uzytkownik').setDescription('Użytkownik').setRequired(false)),
    new SlashCommandBuilder().setName('exp').setDescription('Sprawdź swój poziom i exp').addUserOption(o => o.setName('uzytkownik').setDescription('Użytkownik').setRequired(false)),
    new SlashCommandBuilder().setName('reputacja').setDescription('Wyświetla punkty reputacji tradera').addUserOption(o => o.setName('uzytkownik').setDescription('Użytkownik').setRequired(false)),
    new SlashCommandBuilder().setName('fn-sklep').setDescription('Sklep Fortnite'),
    new SlashCommandBuilder().setName('fn-stats').setDescription('Statystyki Fortnite').addStringOption(o => o.setName('nick').setDescription('Nick').setRequired(false)).addStringOption(o => o.setName('id').setDescription('ID').setRequired(false)),
    new SlashCommandBuilder().setName('fn-mapa').setDescription('Mapa Fortnite'),
    new SlashCommandBuilder().setName('fn-rejestracja').setDescription('Rejestracja nicku Fortnite').addStringOption(o => o.setName('nick').setDescription('Nick').setRequired(true)),
    new SlashCommandBuilder().setName('fn-top').setDescription('Ranking Fortnite (Admin)').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('daj-wszystkim').setDescription('Bonus dla wszystkich (Admin)').addIntegerOption(o => o.setName('ilosc').setDescription('Ilosc').setRequired(true)).addStringOption(o => o.setName('powod').setDescription('Powod').setRequired(false)).setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('nowości').setDescription('Nowości (Admin)').addStringOption(o => o.setName('tytul').setDescription('Tytul').setRequired(true)).addStringOption(o => o.setName('co_nowego').setDescription('Opis').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('odpalstream').setDescription('Stream (Admin)').addStringOption(o => o.setName('tytul').setDescription('Tytul').setRequired(true)).addStringOption(o => o.setName('link').setDescription('Link').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('zakonczstream').setDescription('Koniec streamu (Admin)').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('daj-odznake').setDescription('Daj odznakę (Admin)').addUserOption(o => o.setName('uzytkownik').setDescription('User').setRequired(true)).addStringOption(o => o.setName('odznaka').setDescription('Odznaka').setRequired(true).setAutocomplete(true)).setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('zabierz-odznake').setDescription('Zabierz odznakę (Admin)').addUserOption(o => o.setName('uzytkownik').setDescription('User').setRequired(true)).addStringOption(o => o.setName('odznaka').setDescription('Odznaka').setRequired(true).setAutocomplete(true)).setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('dajpunkty').setDescription('Daj punkty (Admin)').addUserOption(o => o.setName('uzytkownik').setDescription('User').setRequired(true)).addIntegerOption(o => o.setName('ilosc').setDescription('Ile').setRequired(true)).addStringOption(o => o.setName('powod').setDescription('Powod').setRequired(false)).setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('zabierzpunkty').setDescription('Zabierz punkty (Admin)').addUserOption(o => o.setName('uzytkownik').setDescription('User').setRequired(true)).addIntegerOption(o => o.setName('ilosc').setDescription('Ile').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('cytat').setDescription('Wyślij cytat'),
    new SlashCommandBuilder().setName('dodaj-cytat').setDescription('Dodaj cytat').addStringOption(o => o.setName('tekst').setDescription('Tekst').setRequired(true)).addStringOption(o => o.setName('autor').setDescription('Autor').setRequired(true)),
    new SlashCommandBuilder().setName('mem').setDescription('Generator memów').addStringOption(o => o.setName('szablon').setDescription('Szablon').setRequired(true).setAutocomplete(true)).addStringOption(o => o.setName('gora').setDescription('Góra').setRequired(false)).addStringOption(o => o.setName('dol').setDescription('Dół').setRequired(false)),
    new SlashCommandBuilder().setName('szukam').setDescription('Szukaj ekipy LFG').addStringOption(o => o.setName('gra').setDescription('Gra').setRequired(true).addChoices({name: 'Fortnite', value: 'fortnite'}, {name: 'CS2', value: 'cs2'}, {name: 'Minecraft', value: 'minecraft'}, {name: 'GTA V', value: 'gta'}, {name: 'Valorant', value: 'valorant'}, {name: 'LoL', value: 'lol'})).addIntegerOption(o => o.setName('osoby').setDescription('Osoby').setRequired(true).setMinValue(2).setMaxValue(10)).addStringOption(o => o.setName('opis').setDescription('Opis').setRequired(false)),
    // Nowa komenda: System Ankiet i Głosowań ze statusem na żywo
    new SlashCommandBuilder()
        .setName('ankieta')
        .setDescription('Stwórz interaktywną ankietę ze statusem na żywo')
        .addStringOption(o => o.setName('pytanie').setDescription('Treść pytania/ankiety').setRequired(true))
        .addStringOption(o => o.setName('opcje').setDescription('Opcje oddzielone przecinkami (np. Tak, Nie, Może)').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    // Rozbudowana komenda profilu gracza
    new SlashCommandBuilder()
        .setName('profil')
        .setDescription('Wyświetla kompleksową kartę profilu gracza')
        .addUserOption(o => o.setName('uzytkownik').setDescription('Sprawdź profil innego gracza').setRequired(false)),
    // Komenda kontekstowa do Złotych Myśli (Cytatów z serwera)
    new ContextMenuCommandBuilder()
        .setName('Zapisz jako złoty tekst')
        .setType(ApplicationCommandType.Message)
].map(c => c.toJSON());

client.once('ready', async () => {
    console.log(`Zalogowano jako ${client.user?.tag}!`);
    await seedQuotesIfNeeded();
    await setupVerificationChannel();
    await setupAnnouncementsAchievements(); // Wysłanie osiągnięć na kanał ogłoszeń
    await setupMemeChannelInstruction();
    await setupLfgChannelInstruction(); 
    await setupTicketChannel(); 
    await setupRolesChannel(); 
    await setupReputationChannelInstruction();
    await setupShopChannel();
    await setupFortniteUpdateChannel(); 

    const rest = new REST({ version: '10' }).setToken(token);
    try {
        for (const [_, guild] of client.guilds.cache) {
            await rest.put(Routes.applicationGuildCommands(client.user!.id, guild.id), { body: commands });
            await updateServerStats(guild);
        }
    } catch (error) {
        console.error('Błąd rejestracji komend:', error);
    }

    startTopUpdater();
    startDailyQuotes();
    startReputationTopUpdater();
    startYouTubeRssChecker();
    startExpirationChecker();
    startDailyShopAutoPoster(); 
    startFortniteRankingCron();
    startFortniteStatusCron(); 
    startServerStatsCron();
});

client.on('interactionCreate', async interaction => {
    // === OBSŁUGA KOMEND KONTEKSTOWYCH (ZŁOTE MYŚLI) ===
    if (interaction.isMessageContextMenuCommand()) {
        if (interaction.commandName === 'Zapisz jako złoty tekst') {
            await interaction.deferReply({ ephemeral: true });
            const targetMessage = interaction.targetMessage;
            if (!targetMessage || !targetMessage.content) {
                return interaction.editReply({ content: '❌ Ta wiadomość nie zawiera tekstu do zapisania.' });
            }

            const quoteText = targetMessage.content;
            const authorTag = targetMessage.author.tag;

            // Zapis do bazy jako cytat
            await QuoteModel.create({
                text: quoteText,
                author: authorTag,
                addedBy: interaction.user.id
            });

            // Wysłanie na dedykowany kanał "Złote myśli PJN"
            const channel = await client.channels.fetch(ID_KANALU_CYTATY).catch(() => null) as TextChannel;
            if (channel) {
                const embed = new EmbedBuilder()
                    .setColor(0xE67E22)
                    .setTitle('✨ Złota myśl z serwera PJN')
                    .setDescription(`> *„${quoteText}”*\n\n**— ${authorTag}**\n*(Zapisane przez: <@${interaction.user.id}>)*`)
                    .setTimestamp();
                await channel.send({ embeds: [embed] });
            }

            await interaction.editReply({ content: `✅ Pomyślnie dodano wiadomość do **Złotych myśli PJN** (<#${ID_KANALU_CYTATY}>)!` });
            return;
        }
    }

    // === OBSŁUGA ANKIET I GŁOSOWANIA NA ŻYWO ===
    if (interaction.isButton() && interaction.customId.startsWith('poll_vote_')) {
        await interaction.deferUpdate();
        const optionIndex = parseInt(interaction.customId.replace('poll_vote_', ''));
        const poll = await PollModel.findOne({ messageId: interaction.message.id });
        if (!poll || poll.ended) return;

        const userId = interaction.user.id;
        // Usuń użytkownika z innych opcji
        for (let i = 0; i < poll.votes.length; i++) {
            poll.votes[i] = poll.votes[i].filter(id => id !== userId);
        }
        // Dodaj do wybranej
        poll.votes[optionIndex].push(userId);
        poll.markModified('votes');
        await poll.save();

        // Odśwież embed ankiety na żywo
        const totalVotes = poll.votes.reduce((acc, curr) => acc + curr.length, 0);
        let desc = `📊 **Ankieta aktywna na żywo**\n\n`;
        const components: ActionRowBuilder<ButtonBuilder>[] = [];
        let currentRow = new ActionRowBuilder<ButtonBuilder>();

        for (let i = 0; i < poll.options.length; i++) {
            const count = poll.votes[i].length;
            const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
            const filled = Math.floor(percent / 10);
            const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
            desc += `**${i + 1}. ${poll.options[i]}**\n\`[${bar}]\` **${percent}%** (${count} głosów)\n\n`;

            currentRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`poll_vote_${i}`)
                    .setLabel(`${i + 1} (${count})`)
                    .setStyle(ButtonStyle.Secondary)
            );
            if (currentRow.components.length === 5 || i === poll.options.length - 1) {
                components.push(currentRow);
                currentRow = new ActionRowBuilder<ButtonBuilder>();
            }
        }

        const embed = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle(`🗳️ ${poll.question}`)
            .setDescription(desc)
            .setFooter({ text: `Łączna liczba głosów: ${totalVotes} • PJN Live Poll` })
            .setTimestamp();

        await interaction.message.edit({ embeds: [embed], components });
        return;
    }

    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'verification_gender_select') {
            await interaction.deferReply({ ephemeral: true });
            const guild = interaction.guild;
            if (!guild) return;
            const member = await guild.members.fetch(interaction.user.id).catch(() => null);
            if (!member) return interaction.editReply({ content: '❌ Błąd pobierania danych.' });

            const selectedValue = interaction.values[0];
            const roleVerified = guild.roles.cache.get(ID_RANGI_ZWERYFIKOWANY);
            if (!roleVerified) return interaction.editReply({ content: '❌ Brak rangi zweryfikowanego.' });

            await member.roles.add(roleVerified);
            if (selectedValue === 'verify_male') {
                const r = guild.roles.cache.get(ID_ROLI_MEZCZYZNA);
                if (r) await member.roles.add(r);
            } else if (selectedValue === 'verify_female') {
                const r = guild.roles.cache.get(ID_ROLI_KOBIETA);
                if (r) await member.roles.add(r);
            }
            await interaction.editReply({ content: `✅ **Pomyślnie zweryfikowano!** Miłej zabawy!` });
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
                .setDescription(`📝 **Opis:** ${item.description}\n💰 **Cena:** ${item.price} PJN-Coins\n💼 **Twój portfel:** ${user.balance} PJN-Coins`);

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
        if (interaction.customId.startsWith('shop_buy_')) {
            await interaction.deferReply({ ephemeral: true });
            const itemId = interaction.customId.replace('shop_buy_', '');
            const item = SHOP_ITEMS.find(i => i.id === itemId);
            if (!item) return interaction.editReply({ content: '❌ Nie znaleziono przedmiotu.' });

            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) user = await UserModel.create({ userId: interaction.user.id });
            if (user.balance < item.price) return interaction.editReply({ content: `❌ Brak środków!` });

            user.balance -= item.price;
            await user.save();
            await ShopHistoryModel.create({ userId: interaction.user.id, itemName: item.name, price: item.price });

            if (item.type === 'vip') {
                user.vipExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                await user.save();
                const member = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
                if (member) await member.roles.add(ID_ROLI_VIP).catch(() => {});
            }
            await interaction.editReply({ content: `🎉 Pomyślnie zakupiono **${item.name}**!` });
            return;
        }

        if (interaction.customId === 'create_ticket') {
            await interaction.deferReply({ ephemeral: true });
            const guild = interaction.guild;
            if (!guild) return;
            const ticketChannel = await guild.channels.create({
                name: `ticket-${interaction.user.username}`,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                ]
            });
            await ticketChannel.send({ content: `<@${interaction.user.id}>, tu jest Twój ticket.` });
            await interaction.editReply({ content: `✅ Stworzono ticket: <#${ticketChannel.id}>` });
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
                } else { await interaction.respond([]); }
            } catch (err) { await interaction.respond([]); }
            return;
        }
        if (interaction.commandName === 'daj-odznake' || interaction.commandName === 'zabierz-odznake') {
            const filtered = AVAILABLE_BADGES.filter(b => b.toLowerCase().includes(focusedValue.toLowerCase())).slice(0, 25);
            await interaction.respond(filtered.map(b => ({ name: b.replace(/[*_]/g, ''), value: b })));
            return;
        }
        return;
    }

    if (!interaction.isChatInputCommand()) return;
    const { commandName } = interaction;

    try {
        // === KOMENDA ANKIETA ===
        if (commandName === 'ankieta') {
            await interaction.deferReply();
            const pytanie = interaction.options.getString('pytanie', true);
            const opcjeTekst = interaction.options.getString('opcje', true);
            const opcje = opcjeTekst.split(',').map(o => o.trim()).filter(o => o.length > 0);

            if (opcje.length < 2 || opcje.length > 10) {
                return interaction.editReply({ content: '❌ Musisz podać od 2 do 10 opcji oddzielonych przecinkami!' });
            }

            let desc = `📊 **Ankieta aktywna na żywo**\n\n`;
            for (let i = 0; i < opcje.length; i++) {
                const bar = '░'.repeat(10);
                desc += `**${i + 1}. ${opcje[i]}**\n\`[${bar}]\` **0%** (0 głosów)\n\n`;
            }

            const components: ActionRowBuilder<ButtonBuilder>[] = [];
            let currentRow = new ActionRowBuilder<ButtonBuilder>();

            for (let i = 0; i < opcje.length; i++) {
                currentRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`poll_vote_${i}`)
                        .setLabel(`${i + 1} (0)`)
                        .setStyle(ButtonStyle.Secondary)
                );
                if (currentRow.components.length === 5 || i === opcje.length - 1) {
                    components.push(currentRow);
                    currentRow = new ActionRowBuilder<ButtonBuilder>();
                }
            }

            const embed = new EmbedBuilder()
                .setColor(0x3498DB)
                .setTitle(`🗳️ ${pytanie}`)
                .setDescription(desc)
                .setFooter({ text: 'Łączna liczba głosów: 0 • PJN Live Poll' })
                .setTimestamp();

            const sentMsg = await interaction.editReply({ embeds: [embed], components });
            
            // Zapisz ankietę do bazy
            const initialVotes = opcje.map(() => [] as string[]);
            await PollModel.create({
                messageId: sentMsg.id,
                channelId: interaction.channelId,
                question: pytanie,
                options: opcje,
                votes: initialVotes
            });
            return;
        }

        // === ZROZBUDOWANY PROFIL GRACZA (/profil) ===
        if (commandName === 'profil') {
            await interaction.deferReply();
            const targetUser = interaction.options.getUser('uzytkownik') || interaction.user;
            let user = await UserModel.findOne({ userId: targetUser.id });
            if (!user) user = await UserModel.create({ userId: targetUser.id });

            const rankDetails = await getUserLevelRankDetails(targetUser.id);
            const badgeText = user.badges && user.badges.length > 0 ? user.badges.join(', ') : 'Brak odznak';

            const embed = new EmbedBuilder()
                .setColor(0x9B59B6)
                .setTitle(`👤 Profil Gracza • ${targetUser.tag}`)
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { name: '💰 Portfel', value: `**${user.balance || 0} PJN-Coins**`, inline: true },
                    { name: '⭐ Poziom & XP', value: `Poziom **${user.level || 1}** (${user.exp || 0} XP)\nRanking: **#${rankDetails.rank}**`, inline: true },
                    { name: '⭐ Reputacja', value: `**${user.reputation || 0} pkt**`, inline: true },
                    { name: '🎮 Fortnite Stats', value: `Nick: **${user.epicNick || 'Brak'}**\nZabójstwa: **${user.fortniteKills || 0}** | Mecze: **${user.matchesPlayed || 0}**`, inline: false },
                    { name: '📊 Aktywność', value: `Wiadomości: **${user.messageCount || 0}**\nCzas na głosie: **${user.voiceMinutes || 0} min**`, inline: false },
                    { name: '🏅 Posiadane Odznaki', value: badgeText, inline: false }
                )
                .setTimestamp()
                .setFooter({ text: 'PJN System Profile' });

            await interaction.editReply({ embeds: [embed] });
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
            await interaction.editReply({ embeds: [await getTopEmbedData(interaction.guild)] });
            return;
        }

        if (commandName === 'daily') {
            await interaction.deferReply();
            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) user = await UserModel.create({ userId: interaction.user.id });

            const now = new Date();
            if (user.lastDaily) {
                const diff = now.getTime() - new Date(user.lastDaily).getTime();
                if (diff < 24 * 60 * 60 * 1000) {
                    return interaction.editReply({ content: `⏳ Codzienną nagrodę możesz odebrać jutro!` });
                }
            }

            user.balance += 100;
            user.lastDaily = now;
            await user.save();
            await interaction.editReply({ content: `🎁 Otrzymałeś codzienne **100 PJN-Coins**!` });
            return;
        }

        if (commandName === 'exp') {
            await interaction.deferReply();
            const targetUser = interaction.options.getUser('uzytkownik') || interaction.user;
            let user = await UserModel.findOne({ userId: targetUser.id });
            if (!user) user = await UserModel.create({ userId: targetUser.id });
            const rankDetails = await getUserLevelRankDetails(targetUser.id);
            await interaction.editReply({ content: `⭐ Poziom: **${user.level || 1}** | XP: **${user.exp || 0}** | Ranking: **#${rankDetails.rank}**` });
            return;
        }

        if (commandName === 'reputacja') {
            await interaction.deferReply();
            const targetUser = interaction.options.getUser('uzytkownik') || interaction.user;
            let user = await UserModel.findOne({ userId: targetUser.id });
            if (!user) user = await UserModel.create({ userId: targetUser.id });
            await interaction.editReply({ content: `⭐ Reputacja tradera <@${targetUser.id}>: **${user.reputation || 0} pkt**` });
            return;
        }

        if (commandName === 'mem') {
            await interaction.deferReply();
            const templateId = interaction.options.getString('szablon', true);
            const gora = interaction.options.getString('gora') || '';
            const dol = interaction.options.getString('dol') || '';
            const params = new URLSearchParams();
            params.append('template_id', templateId);
            params.append('username', 'ellader');
            params.append('password', 'ellader123');
            params.append('text0', gora);
            params.append('text1', dol);
            const response = await fetch('https://api.imgflip.com/caption_image', { method: 'POST', body: params });
            const data = await response.json() as any;
            if (data && data.success) await interaction.editReply({ content: `🖼️ Mem wygenerowany:`, files: [data.data.url] });
            else await interaction.editReply({ content: `❌ Błąd generatora memów.` });
            return;
        }

    } catch (error) {
        console.error(error);
    }
});

client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    if (message.channel.id === ID_KANAL_REPUTACJI) {
        const content = message.content.trim();
        const isPlus = content.toLowerCase().startsWith('+rep');
        const isMinus = content.toLowerCase().startsWith('-rep');
        if (isPlus || isMinus) {
            const mentionedUser = message.mentions.users.first();
            if (!mentionedUser || mentionedUser.id === message.author.id) return;

            let receiverUser = await UserModel.findOne({ userId: mentionedUser.id });
            if (!receiverUser) receiverUser = await UserModel.create({ userId: mentionedUser.id });
            receiverUser.reputation = (receiverUser.reputation || 0) + (isPlus ? 1 : -1);
            await receiverUser.save();
            const member = await message.guild.members.fetch(mentionedUser.id).catch(() => null);
            if (member) await updateTraderRoles(member, receiverUser.reputation);
            await message.channel.send({ content: `✅ Zaktualizowano reputację dla <@${mentionedUser.id}>.` });
            return;
        }
    }

    try {
        let user = await UserModel.findOne({ userId: message.author.id });
        if (!user) user = await UserModel.create({ userId: message.author.id });

        user.messageCount = (user.messageCount || 0) + 1;
        user.balance += 1;
        await user.save();
        await checkAndAwardBadges(user, message.member);
        await addExp(message.author.id, 75, message.guild);
    } catch (error) {}
});

import http from 'http';
const server = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('Bot is running 24/7!\n'); });
server.listen(process.env.PORT || 10000, () => { console.log(`Serwer HTTP wystartował.`); });

client.login(token);
