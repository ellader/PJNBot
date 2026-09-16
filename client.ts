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
    votes: { type: [[String]], required: true },
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
    languspjn: { channelId: '1542101793171972146', rssUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=TUTAJ_WKLEJ_ID_LANGUSPJN' },
    elladermusic: { channelId: '1542101962185646111', rssUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=TUTAJ_WKLEJ_ID_ELLADER' },
    leaveLogChannelId: '1542102521814712371'
};
const parser = new Parser();

const ANNOUNCE_CHANNEL_ID = '1532399010785263799';
const ID_KANALU_CYTATY = '1549709251365183558'; // Złote myśli PJN
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
        if (count === 0) await QuoteModel.insertMany(initialQuotes);
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
                if (msg.author.id === client.user?.id) await msg.delete().catch(() => {});
            }
        }
        const embed = new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle('🛡️ Weryfikacja i Wybór Płci • PJN Community')
            .setDescription('Witaj na serwerze! Wybierz swoją płeć w menu poniżej, aby uzyskać dostęp.')
            .setImage(LIVE_IMAGE_URL)
            .setTimestamp();

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('verification_gender_select')
            .setPlaceholder('Wybierz swoją płeć...')
            .addOptions([
                { label: 'Mężczyzna', value: 'verify_male', emoji: '👦' },
                { label: 'Kobieta', value: 'verify_female', emoji: '👧' }
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
    } catch (err) {}
}

function startServerStatsCron() {
    setInterval(async () => {
        for (const [_, guild] of client.guilds.cache) await updateServerStats(guild);
    }, 5 * 60 * 1000);
}

// Osiągnięcia na ogłoszeniach ID: 1532399010785263799
async function setupAnnouncementsAchievements() {
    try {
        const channel = await client.channels.fetch(ANNOUNCE_CHANNEL_ID).catch(() => null) as TextChannel;
        if (!channel) return;
        const embed = new EmbedBuilder()
            .setColor(0x9B59B6)
            .setTitle('🏆 Centrum Osiągnięć i Rzadkich Odznak PJN')
            .setDescription(
                'Zdobywaj unikalne odznaki za aktywność na czacie, głosie, kasynie i poziomach!\n\n' +
                '⭐ **Rzadkie i prestiżowe odznaki:**\n' +
                '• 🏦 **Milioner** — 100 000 PJN-Coins\n' +
                '• 🎰 **Ryzykant** — 100 gier w kasynie\n' +
                '• ⏳ **Weteran** — Ponad rok na serwerze\n' +
                '• 🎟️ **Kolekcjoner** — Posiadanie wszystkich odznak\n' +
                '• 🌟 **Mistrz Poziomów** — 50 poziom\n' +
                '• 👑 **Legenda Serwera** — 100 poziom\n\n' +
                '🔍 Wpisz `/odznaki`, aby sprawdzić swój profil.'
            )
            .setImage(LIVE_IMAGE_URL)
            .setTimestamp();
        await channel.send({ embeds: [embed] });
    } catch (e) {}
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
        .setTimestamp();
    await channel.send({ embeds: [embed] });
    return true;
}

function startDailyQuotes() {
    cron.schedule('30 3 * * *', async () => {
        try { await sendQuoteToChannel(ID_KANALU_CYTATY); } catch (err) {}
    });
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

    const lvl = user.level || 1;
    if (lvl >= 10) addBadge('⭐ **Awansowy Ekspert (Lvl 10)**');
    if (lvl >= 50) addBadge('🌟 **Mistrz Poziomów (Lvl 50, Rzadka)**');
    if (lvl >= 100) addBadge('👑 **Legenda Serwera (Lvl 100, Elitarna)**');

    if (newBadges.length > 0) {
        await user.save();
        try {
            const target = memberOrUser.user || memberOrUser;
            await target.send({
                embeds: [{
                    color: 0xFFD700,
                    title: '🎉 Nowa odznaka odblokowana!',
                    description: `Zdobyłeś nowe odznaki:\n` + newBadges.map(b => `• ${b}`).join('\n')
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

// System nagród za exp co 10 lvl (+1500 PJN Coins)
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
            const rankDetails = await getUserLevelRankDetails(userId);

            let rewardText = '';
            if (user.level % 10 === 0) {
                rewardText = `\n🎁 **Nagroda za awans na ${user.level} lvl:** Otrzymałeś **1500 PJN-Coins**! 💰`;
            }

            const embed = new EmbedBuilder()
                .setColor(0x9B59B6)
                .setTitle('🚀 AWANS NA WYŻSZY POZIOM!')
                .setDescription(`Gratulacje <@${userId}>! Wskoczyłeś na **poziom ${user.level}**! 🌟${rewardText}`)
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
        let userName = `Użytkownik (${u.userId})`;
        try {
            const member = await guild.members.fetch(u.userId).catch(() => null);
            if (member) userName = member.displayName;
        } catch (e) {}
        desc += `**${index + 1}.** **${userName}** — **${u.balance} PJN-Coins**\n`;
    }
    return { color: 0xFFD700, title: '🏆 TOP 10 - Ranking PJN-Coins', description: desc };
}

// === KOMENDY DISCORD ===
const commands = [
    new SlashCommandBuilder().setName('portfel').setDescription('Sprawdź stan swoich PJN-Coins'),
    new SlashCommandBuilder().setName('sklep').setDescription('Sklep serwera'),
    new SlashCommandBuilder().setName('topka').setDescription('Ranking najbogatszych'),
    new SlashCommandBuilder().setName('daily').setDescription('Codzienna nagroda'),
    new SlashCommandBuilder().setName('exp').setDescription('Sprawdź swój poziom i exp').addUserOption(o => o.setName('uzytkownik').setDescription('User').setRequired(false)),
    new SlashCommandBuilder().setName('reputacja').setDescription('Reputacja tradera').addUserOption(o => o.setName('uzytkownik').setDescription('User').setRequired(false)),
    new SlashCommandBuilder().setName('mem').setDescription('Generator memów').addStringOption(o => o.setName('szablon').setDescription('Szablon').setRequired(true).setAutocomplete(true)).addStringOption(o => o.setName('gora').setDescription('Góra').setRequired(false)).addStringOption(o => o.setName('dol').setDescription('Dół').setRequired(false)),
    new SlashCommandBuilder().setName('odznaki').setDescription('Wyświetl odznaki').addUserOption(o => o.setName('uzytkownik').setDescription('User').setRequired(false)),
    // Nowy system ankiet ze statusem na żywo
    new SlashCommandBuilder()
        .setName('ankieta')
        .setDescription('Stwórz interaktywną ankietę na żywo')
        .addStringOption(o => o.setName('pytanie').setDescription('Treść pytania').setRequired(true))
        .addStringOption(o => o.setName('opcje').setDescription('Opcje oddzielone przecinkami (np. Tak, Nie)').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    // Rozbudowany profil gracza
    new SlashCommandBuilder()
        .setName('profil')
        .setDescription('Kompleksowa karta profilu gracza')
        .addUserOption(o => o.setName('uzytkownik').setDescription('User').setRequired(false)),
    // Komenda kontekstowa do Złotych Myśli
    new ContextMenuCommandBuilder()
        .setName('Zapisz jako złoty tekst')
        .setType(ApplicationCommandType.Message)
].map(c => c.toJSON());

client.once('ready', async () => {
    console.log(`Zalogowano jako ${client.user?.tag}!`);
    await seedQuotesIfNeeded();
    await setupVerificationChannel();
    await setupAnnouncementsAchievements();
    await setupDailyShopAutoPoster?.();

    const rest = new REST({ version: '10' }).setToken(token);
    try {
        for (const [_, guild] of client.guilds.cache) {
            await rest.put(Routes.applicationGuildCommands(client.user!.id, guild.id), { body: commands });
        }
    } catch (error) {}

    startDailyQuotes();
    startServerStatsCron();
});

client.on('interactionCreate', async interaction => {
    // Obsługa komendy kontekstowej "Złote myśli PJN"
    if (interaction.isMessageContextMenuCommand()) {
        if (interaction.commandName === 'Zapisz jako złoty tekst') {
            await interaction.deferReply({ ephemeral: true });
            const targetMessage = interaction.targetMessage;
            if (!targetMessage || !targetMessage.content) {
                return interaction.editReply({ content: '❌ Wiadomość nie zawiera tekstu.' });
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

            await interaction.editReply({ content: `✅ Dodano do **Złotych myśli PJN** (<#${ID_KANALU_CYTATY}>)!` });
            return;
        }
    }

    // Obsługa głosowania w ankiecie na żywo
    if (interaction.isButton() && interaction.customId.startsWith('poll_vote_')) {
        await interaction.deferUpdate();
        const optionIndex = parseInt(interaction.customId.replace('poll_vote_', ''));
        const poll = await PollModel.findOne({ messageId: interaction.message.id });
        if (!poll || poll.ended) return;

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

        const embed = new EmbedBuilder().setColor(0x3498DB).setTitle(`🗳️ ${poll.question}`).setDescription(desc).setTimestamp();
        await interaction.message.edit({ embeds: [embed], components });
        return;
    }

    if (!interaction.isChatInputCommand()) return;
    const { commandName } = interaction;

    try {
        // System ankiet
        if (commandName === 'ankieta') {
            await interaction.deferReply();
            const pytanie = interaction.options.getString('pytanie', true);
            const opcjeTekst = interaction.options.getString('opcje', true);
            const opcje = opcjeTekst.split(',').map(o => o.trim()).filter(o => o.length > 0);

            if (opcje.length < 2 || opcje.length > 10) {
                return interaction.editReply({ content: '❌ Podaj od 2 do 10 opcji oddzielonych przecinkami.' });
            }

            let desc = `📊 **Ankieta aktywna na żywo**\n\n`;
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

            const embed = new EmbedBuilder().setColor(0x3498DB).setTitle(`🗳️ ${pytanie}`).setDescription(desc).setTimestamp();
            const sentMsg = await interaction.editReply({ embeds: [embed], components });

            await PollModel.create({
                messageId: sentMsg.id,
                channelId: interaction.channelId,
                question: pytanie,
                options: opcje,
                votes: opcje.map(() => [])
            });
            return;
        }

        // Rozbudowany profil gracza (/profil)
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
                    { name: '🎮 Fortnite Stats', value: `Nick: **${user.epicNick || 'Brak'}**\nZabójstwa: **${user.fortniteKills || 0}**`, inline: false },
                    { name: '🏅 Odznaki', value: badgeText, inline: false }
                )
                .setTimestamp();

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

        if (commandName === 'odznaki') {
            await interaction.deferReply({ ephemeral: true });
            const targetUser = interaction.options.getUser('uzytkownik') || interaction.user;
            let user = await UserModel.findOne({ userId: targetUser.id });
            if (!user) user = await UserModel.create({ userId: targetUser.id });
            const badgeText = user.badges && user.badges.length > 0 ? user.badges.join('\n') : 'Brak odznak.';
            await interaction.editReply({ embeds: [{ color: 0x9B59B6, title: `🛡️ Odznaki użytkownika ${targetUser.tag}`, description: badgeText }] });
            return;
        }
    } catch (error) {
        console.error(error);
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
        await checkAndAwardBadges(user, message.member);
        await addExp(message.author.id, 75, message.guild);
    } catch (error) {}
});

import http from 'http';
const server = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('Bot is running 24/7!\n'); });
server.listen(process.env.PORT || 10000, () => { console.log(`Serwer HTTP wystartował.`); });

client.login(token);
