import { 
    Client, 
    GatewayIntentBits, 
    REST, 
    Routes, 
    SlashCommandBuilder,
    TextChannel,
    PermissionFlagsBits,
    EmbedBuilder
} from 'discord.js';
import mongoose from 'mongoose';
import cron from 'node-cron';

// === KONFIGURACJA BAZY DANYCH MONGOOSE ===
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) throw new Error("Brak zmiennej środowiskowej MONGO_URI!");

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
    badges: { type: [String], default: [] }
});

const UserModel = mongoose.model('User', userSchema);

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

// === KONFIGURACJA BOTA DISCORD ===
const token = process.env.DISCORD_BOT_TOKEN;
if (!token) throw new Error("Brak tokena Discord bota!");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers
    ]
});

const ANNOUNCE_CHANNEL_ID = '1532399010785263799';
const ID_KANALU_CYTATY = '1534780578912665653';
const ID_KANALU_MEMOW = '1534833757335326810';
const CHANNEL_POWITANIA = "witamy";
const ID_KANALU_DUSZKI = "1532977723843285112"; 
const ID_RANGI_DUSZKOWIEC = "1532978703842283551";
const ID_RANGI_MODERATOR = "1532321767857721344";
const ID_RANGI_ADMIN = "1532324059470237857";

const LIVE_IMAGE_URL = "https://cdn.discordapp.com/attachments/1532321067731783684/1534837837374029914/IMG_20260806_094843.jpg?ex=6a7594a0&is=6a744320&hm=822597b60136cc08a4aac4b01d9684bcda8b7d6e388232f24a5c7f15ed3f9e5e&";

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
        .setTitle('💡 Życiowa myśl na dzisiejszy poranek')
        .setDescription(`> *„${quote.text}”*\n\n**— ${quote.author}**`)
        .setTimestamp()
        .setFooter({ text: 'PJN Codzienna Inspiracja' });

    await channel.send({ 
        content: '@everyone', 
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

// === CENTRUM INFORMACJI O ODZNACKACH (EMBED) ===
function createBadgesInfoEmbed() {
    return new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle('🛡️ Centrum Odznak i Osiągnięć PJN')
        .setDescription(
            'Witaj w oficjalnym systemie osiągnięć serwera! Będąc aktywnym, rozmawiając, grając w kasynie czy spędzając z nami czas, automatycznie zdobywasz unikalne odznaki, które pojawiają się w Twoim profilu.\n\n' +
            '🔍 **Jak sprawdzić swoje odznaki?**\n' +
            'Wpisz w dowolnym kanale komendę: `/odznaki` (Możesz też sprawdzić profil kogoś innego, wybierając opcję `@użytkownik`).'
        )
        .addFields(
            {
                name: '💬 Aktywność na Chacie i Głosie',
                value: 
                    '• 💬 **Początkujący Gadulec** — 200 wiadomości\n' +
                    '• 📜 **Kronikarz Chatu** — 1000 wiadomości\n' +
                    '• 💬 **Król Wiadomości** — 5000 wiadomości\n' +
                    '• 😂 **Emotikonowy Ekspresja** — 30 customowych emotek\n' +
                    '• 🌙 **Nocny Marek** — 50 wiadomości w nocy (00:00–04:00)\n' +
                    '• 🎙️ **Stały Bywalec Mikrofonu** — 30h na kanale głosowym\n' +
                    '• 🎧 **Audiofil** — 100h na kanale głosowym',
                inline: false
            },
            {
                name: '💰 Gospodarka, Kasyno i Społeczność',
                value: 
                    '• 💰 **Kapitalista** — 5 000 PJN-Coins\n' +
                    '• 💎 **Magnat Finansowy** — 10 000 PJN-Coins\n' +
                    '• 🏦 **Milioner** — 100 000 PJN-Coins\n' +
                    '• 💸 **Hojny Darczyńca** — 5 000 przekazanych w przelewach\n' +
                    '• 🎲 **Nałogowy Graczyk** — 20 gier w kasynie\n' +
                    '• 🎰 **Ryzykant** — 100 gier w kasynie\n' +
                    '• 🍀 **Ulubieniec Fortuna** — 3 wygrane z rzędu w kasynie\n' +
                    '• 🎯 **Czarna Seria** — 5 przegranych z rzędu w kasynie\n' +
                    '• 💡 **Filozof** — Dodanie 5 cytatów\n' +
                    '• 🤝 **Pomocna Dłoń** — 10 akcji pomocy\n' +
                    '• ⏳ **Weteran Półrocza / Weteran** — Staż na serwerze (6 miesięcy / rok)\n' +
                    '• 🛡️ **Filar Społeczności** — Posiadanie rangi Administracji/Streamera\n' +
                    '• 🎟️ **Kolekcjoner** — Zdobycie wszystkich pozostałych odznak',
                inline: false
            }
        )
        .setTimestamp()
        .setFooter({ text: 'PJN System Odznak • Automatycznie aktualizowany' });
}

// === INSTRUKCJA GENERATORA MEMÓW ===
async function setupMemeChannelInstruction() {
    try {
        const channel = await client.channels.fetch(ID_KANALU_MEMOW).catch(() => null) as TextChannel;
        if (!channel) return;

        const messages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
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
                '2. Wpisz nazwę w polu **szablon** – bot podpowie Ci setki dostępnych szablonów z całego świata!\n' +
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

// === KOMPLETNY SYSTEM SPRAWDZANIA ODZNAK ===
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
    if (user.balance >= 100000) addBadge('🏦 **Milioner**');
    if (user.totalDonated >= 5000) addBadge('💸 **Hojny Darczyńca**');

    if (user.casinoPlays >= 20) addBadge('🎲 **Nałogowy Graczyk**');
    if (user.casinoPlays >= 100) addBadge('🎰 **Ryzykant**');
    if (user.consecutiveWins >= 3) addBadge('🍀 **Ulubieniec Fortuna**');
    if (user.consecutiveLosses >= 5) addBadge('🎯 **Czarna Seria**');

    if (user.quotesAdded >= 5) addBadge('💡 **Filozof**');
    if (user.helpCount >= 10) addBadge('🤝 **Pomocna Dłoń**');

    if (memberOrUser && memberOrUser.joinedAt) {
        const diffMonths = (Date.now() - new Date(memberOrUser.joinedAt).getTime()) / (1000 * 60 * 60 * 24 * 30);
        const diffYears = diffMonths / 12;
        if (diffYears >= 1) addBadge('⏳ **Weteran**');
        if (diffMonths >= 6) addBadge('⏳ **Weteran Półrocza**');
    }

    if (memberOrUser && memberOrUser.roles && typeof memberOrUser.roles.cache?.some === 'function') {
        const hasAdminRole = memberOrUser.roles.cache.some((role: any) => 
            ['admin', 'administrator', 'streamer'].includes(role.name.toLowerCase())
        );
        if (hasAdminRole) addBadge('🛡️ **Filar Społeczności**');
    }

    const masterPoolCount = 18; 
    const currentCountWithoutCollector = user.badges.filter((b: string) => !b.includes('Kolekcjoner')).length;
    if (currentCountWithoutCollector >= masterPoolCount) {
        addBadge('🎟️ **Kolekcjoner**');
    }

    if (newBadges.length > 0) {
        await user.save();
        try {
            const target = memberOrUser.user || memberOrUser;
            await target.send({
                embeds: [{
                    color: 0xFFD700,
                    title: '🎉 Nowa odznaka odblokowana!',
                    description: `Gratulacje! Automatycznie zdobyłeś nowe odznaki:\n` + newBadges.map(b => `• ${b}`).join('\n')
                }]
            }).catch(() => {});
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

async function startBadgesInfoUpdater() {
    setInterval(async () => {
        try {
            const config = await ConfigModel.findOne({ key: 'odznaki_info_msg' });
            if (!config) return;

            const channel = await client.channels.fetch(config.channelId).catch(() => null) as TextChannel;
            if (!channel) return;

            const oldMessage = await channel.messages.fetch(config.messageId).catch(() => null);
            if (oldMessage) await oldMessage.delete().catch(() => {});

            const embedData = createBadgesInfoEmbed();
            const newMessage = await channel.send({ embeds: [embedData] });

            config.messageId = newMessage.id;
            await config.save();
        } catch (err) {}
    }, 10 * 60 * 1000);
}

function startHourlyAnnouncements() {
    cron.schedule('0 * * * *', async () => {
        try {
            const channel = await client.channels.fetch(ANNOUNCE_CHANNEL_ID).catch(() => null) as TextChannel;
            if (!channel) return;
            await channel.send({ embeds: [createOgłoszenieEmbed()] });
        } catch (err) {}
    });
}

// === KOMPONENTY / KOMENDY SLASH ===
const commands = [
    new SlashCommandBuilder().setName('portfel').setDescription('Sprawdź stan swoich PJN-Coins w portfelu'),
    new SlashCommandBuilder().setName('topka').setDescription('Zobacz ranking najbogatszych graczy'),
    new SlashCommandBuilder().setName('ustaw-topke').setDescription('Ustaw ten kanał jako ranking (Admin)').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('ustaw-odznaki').setDescription('Ustaw ten kanał jako centrum odznak (Admin)').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('daily').setDescription('Odbieraj codzienne 100 PJN-Coins'),
    new SlashCommandBuilder().setName('przelej').setDescription('Przelewa PJN-Coins').addUserOption(o => o.setName('uzytkownik').setDescription('Komu').setRequired(true)).addIntegerOption(o => o.setName('kwota').setDescription('Ile').setRequired(true)),
    new SlashCommandBuilder().setName('kostka').setDescription('Rzuć kością').addIntegerOption(o => o.setName('stawka').setDescription('Stawka').setRequired(true)),
    new SlashCommandBuilder().setName('moneta').setDescription('Orzeł czy reszka').addStringOption(o => o.setName('wybor').setDescription('Wybór').setRequired(true).addChoices({name: 'Orzeł', value: 'orzel'}, {name: 'Reszka', value: 'reszka'})).addIntegerOption(o => o.setName('stawka').setDescription('Stawka').setRequired(true)),
    new SlashCommandBuilder().setName('slot').setDescription('Sloty').addIntegerOption(o => o.setName('stawka').setDescription('Stawka').setRequired(true)),
    new SlashCommandBuilder().setName('poker').setDescription('Poker').addStringOption(o => o.setName('tryb').setDescription('Tryb').setRequired(true).addChoices({name: 'Z ludźmi', value: 'ludzie'}, {name: 'Z botem', value: 'bot'})).addIntegerOption(o => o.setName('stawka').setDescription('Stawka').setRequired(true)),
    new SlashCommandBuilder().setName('odznaki').setDescription('Wyświetla profil z odznakami').addUserOption(o => o.setName('uzytkownik').setDescription('Użytkownik').setRequired(false)),
    new SlashCommandBuilder()
        .setName('nowości')
        .setDescription('Wysyła ogłoszenie o nowościach na serwerze (Admin)')
        .addStringOption(o => o.setName('tytul').setDescription('Tytuł ogłoszenia (np. System Odznak)').setRequired(true))
        .addStringOption(o => o.setName('co_nowego').setDescription('Krótko opisz co faktycznie dodano').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('daj-odznake').setDescription('Przyznaj odznakę (Admin)')
        .addUserOption(o => o.setName('uzytkownik').setDescription('Komu').setRequired(true))
        .addStringOption(o => o.setName('odznaka').setDescription('Wpisz pełną nazwę odznaki').setRequired(true)),
    new SlashCommandBuilder().setName('zabierz-odznake').setDescription('Odbierz odznakę (Admin)').addUserOption(o => o.setName('uzytkownik').setDescription('Komu').setRequired(true)).addStringOption(o => o.setName('odznaka').setDescription('Nazwa').setRequired(true)),
    new SlashCommandBuilder().setName('dajpunkty').setDescription('Daj punkty').addUserOption(o => o.setName('uzytkownik').setDescription('User').setRequired(true)).addIntegerOption(o => o.setName('ilosc').setDescription('Ilość').setRequired(true)),
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
        .addStringOption(o => o.setName('dol').setDescription('Tekst na dole mema').setRequired(false))
].map(c => c.toJSON());

client.once('ready', async () => {
    console.log(`Zalogowano jako ${client.user?.tag}!`);
    await seedQuotesIfNeeded();
    await setupMemeChannelInstruction();

    const rest = new REST({ version: '10' }).setToken(token);
    try {
        for (const [_, guild] of client.guilds.cache) {
            await rest.put(Routes.applicationGuildCommands(client.user!.id, guild.id), { body: commands });
        }
    } catch (error) {
        console.error('Błąd rejestracji:', error);
    }

    startTopUpdater();
    startBadgesInfoUpdater();
    startHourlyAnnouncements();
    startDailyQuotes();
});

client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    try {
        let user = await UserModel.findOne({ userId: message.author.id });
        if (!user) user = await UserModel.create({ userId: message.author.id });

        user.messageCount = (user.messageCount || 0) + 1;
        user.balance += 1;
        
        const currentHour = new Date().getHours();
        if (currentHour >= 0 && currentHour < 4) {
            user.nightMessageCount = (user.nightMessageCount || 0) + 1;
        }

        const customEmojis = message.content.match(/<a?:\w+:\d+>/g);
        if (customEmojis) user.emojiCount = (user.emojiCount || 0) + customEmojis.length;

        await user.save();
        await checkAndAwardBadges(user, message.member);

        if (message.channelId === ID_KANALU_DUSZKI) {
            const pings = `<@&${ID_RANGI_DUSZKOWIEC}> <@&${ID_RANGI_MODERATOR}> <@&${ID_RANGI_ADMIN}>`;
            await message.reply({
                content: `Cześć ${message.author}, dziękuję że jesteś, zawołam administrację!\n\n${pings}`,
                allowedMentions: { roles: [ID_RANGI_DUSZKOWIEC, ID_RANGI_MODERATOR, ID_RANGI_ADMIN], users: [message.author.id] }
            });
        }
    } catch (error) {}
});

const voiceTimestamps = new Map<string, number>();

client.on('voiceStateUpdate', async (oldState, newState) => {
    if (newState.member?.user.bot) return;
    const userId = newState.id;
    const now = Date.now();

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
                    user.voiceMinutes = (user.voiceMinutes || 0) + minutesSpent;
                    user.balance += minutesSpent;
                    await user.save();
                    if (newState.member) await checkAndAwardBadges(user, newState.member);
                } catch (e) {}
            }
            voiceTimestamps.delete(userId);
        }
    }
});

// === POWITANIA ===
client.on('guildMemberAdd', async member => {
    try {
        let user = await UserModel.findOne({ userId: member.id });
        if (!user) user = await UserModel.create({ userId: member.id });
        user.balance += 200;
        await user.save();
        await checkAndAwardBadges(user, member);

        const channel = member.guild.channels.cache.find(ch => ch.isTextBased() && 'name' in ch && ch.name === CHANNEL_POWITANIA) as TextChannel;
        if (channel) {
            const embed = new EmbedBuilder()
                .setColor(0x2ECC71)
                .setDescription(
                    `📌 **Skonfiguruj swój profil i sprawdź najważniejsze miejsca:**\n\n` +
                    `• Wyberaj płeć: <#1532374188634144898>\n` +
                    `• Dostosuj role: <#1532397673842217010>\n` +
                    `• Wybierz swój sprzęt: <#1532398069524594708>\n\n` +
                    `🎮 Informacje o grach: <#1534060343473475644>\n` +
                    `👻 Darmowe duszki: <#1532977723843285112>`
                )
                .setThumbnail(member.user.displayAvatarURL());

            await channel.send({
                content: `👋 Witaj na serwerze PJN, <@${member.id}>! Cieszymy się, że jesteś z nami!🎉\n🎁 Na start otrzymujesz w prezencie **200 PJN-Coins**!`,
                embeds: [embed]
            });
        }
    } catch (e) {}
});

client.on('interactionCreate', async interaction => {
    // Obsługa podpowiedzi (Autocomplete) dla szablonów memów
    if (interaction.isAutocomplete()) {
        if (interaction.commandName === 'mem') {
            const focusedValue = interaction.options.focusedOfType ? interaction.options.getFocused() : interaction.options.getFocused();
            try {
                const response = await fetch('https://api.imgflip.com/get_memes');
                const data = await response.json() as any;
                
                if (data && data.success && data.data && data.data.memes) {
                    const memes = data.data.memes;
                    const filtered = memes
                        .filter((m: any) => m.name.toLowerCase().includes(focusedValue.toLowerCase()))
                        .slice(0, 25); // Discord pozwala maksymalnie na 25 podpowiedzi

                    await interaction.respond(
                        filtered.map((m: any) => ({ name: m.name, value: m.id }))
                    );
                } else {
                    await interaction.respond([]);
                }
            } catch (err) {
                await interaction.respond([]);
            }
        }
        return;
    }

    if (!interaction.isChatInputCommand()) return;
    const { commandName } = interaction;

    try {
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
            const embedData = createBadgesInfoEmbed();
            const sentMessage = await interaction.channel?.send({ embeds: [embedData] });
            if (sentMessage) {
                await ConfigModel.findOneAndUpdate({ key: 'odznaki_info_msg' }, { channelId: interaction.channelId, messageId: sentMessage.id }, { upsert: true, new: true });
                await interaction.editReply({ content: `✅ Ustawiono ten kanał jako centrum odznak.` });
            }
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
                .setDescription(
                    `Cześć społeczności **PJN**! Wprowadziliśmy właśnie nowe ulepszenia na serwer. Oto co dla Was przygotowaliśmy:\n\n` +
                    `🔹 **Szczegóły aktualizacji:**\n${coNowego}\n\n` +
                    `💡 *Wpadajcie na odpowiednie kanały, sprawdźcie nowe funkcje i dajcie znać, co o tym sądzicie!*`
                )
                .setImage(LIVE_IMAGE_URL)
                .setTimestamp()
                .setFooter({ text: 'PJN System Aktualizacji • Rozwijamy się dla Was' });

            const channel = interaction.channel as TextChannel;
            if (channel) {
                await channel.send({ 
                    content: '@everyone', 
                    embeds: [embed],
                    allowedMentions: { parse: ['everyone'] } 
                });
            }

            await interaction.editReply({ content: `✅ Pomyślnie wysłano ogłoszenie o nowościach!` });
            return;
        }

        if (commandName === 'przelej') {
            await interaction.deferReply({ ephemeral: true });
            const targetUser = interaction.options.getUser('uzytkownik', true);
            const kwota = interaction.options.getInteger('kwota', true);

            if (kwota <= 0) {
                return interaction.editReply({ content: '❌ Kwota przelewu musi być większa od zera!' });
            }

            if (targetUser.id === interaction.user.id) {
                return interaction.editReply({ content: '❌ Nie możesz przelać środków sam do siebie!' });
            }

            let sender = await UserModel.findOne({ userId: interaction.user.id });
            if (!sender) sender = await UserModel.create({ userId: interaction.user.id });

            if (sender.balance < kwota) {
                return interaction.editReply({ content: `❌ Nie masz wystarczająco środków! Posiadasz **${sender.balance} PJN-Coins**.` });
            }

            let receiver = await UserModel.findOne({ userId: targetUser.id });
            if (!receiver) receiver = await UserModel.create({ userId: targetUser.id });

            sender.balance -= kwota;
            receiver.balance += kwota;
            sender.totalDonated = (sender.totalDonated || 0) + kwota;

            await sender.save();
            await receiver.save();
            await checkAndAwardBadges(sender, interaction.member);

            try {
                await targetUser.send({
                    embeds: [{
                        color: 0x2ECC71,
                        title: '💸 Otrzymałeś przelew!',
                        description: `Użytkownik **${interaction.user.tag}** przelał Ci **${kwota} PJN-Coins**!`,
                        timestamp: new Date().toISOString()
                    }]
                });
            } catch (e) {}

            await interaction.editReply({ content: `✅ Pomyślnie przelano **${kwota} PJN-Coins** dla użytkownika <@${targetUser.id}>!` });
            return;
        }

        if (commandName === 'odznaki') {
            await interaction.deferReply({ ephemeral: true });
            const targetUser = interaction.options.getUser('uzytkownik') || interaction.user;
            let user = await UserModel.findOne({ userId: targetUser.id });
            if (!user) user = await UserModel.create({ userId: targetUser.id });

            const badgeText = user.badges && user.badges.length > 0 ? user.badges.join('\n') : 'Brak odznak.';
            await interaction.editReply({
                embeds: [{
                    color: 0x9B59B6,
                    title: `🛡️ Profil Odznak i Osiągnięć`,
                    description: `Użytkownik: <@${targetUser.id}>`,
                    thumbnail: { url: targetUser.displayAvatarURL() },
                    fields: [
                        { name: '🏅 Zdobyte Odznaki', value: badgeText, inline: false },
                        { name: '📊 Statystyki', value: `💬 Wiadomości: **${user.messageCount || 0}**\n🎙️ Głos: **${user.voiceMinutes || 0} min**\n💰 Portfel: **${user.balance || 0}**`, inline: false }
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
                    await interaction.editReply({ content: `✅ Przyznano odznakę ${odznaka} dla <@${targetUser.id}>.` });
                } else {
                    await interaction.editReply({ content: `⚠️ Użytkownik ma już tę odznakę.` });
                }
            } else {
                user.badges = user.badges.filter((b: string) => b !== odznaka);
                await user.save();
                await interaction.editReply({ content: `✅ Zabrano odznakę ${odznaka}.` });
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
            user.balance += 100;
            await user.save();
            await checkAndAwardBadges(user, interaction.member);
            await interaction.editReply({ content: `🎁 Otrzymałeś codzienne **100 PJN-Coins**!` });
            return;
        }

        if (commandName === 'dajpunkty' || commandName === 'zabierzpunkty') {
            if (!isAuthorized(interaction.user.id)) return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
            await interaction.deferReply({ ephemeral: true });
            const targetUser = interaction.options.getUser('uzytkownik', true);
            const ilosc = interaction.options.getInteger('ilosc', true);
            let user = await UserModel.findOne({ userId: targetUser.id });
            if (!user) user = await UserModel.create({ userId: targetUser.id });

            if (commandName === 'dajpunkty') {
                user.balance += ilosc;
                await user.save();
                await interaction.editReply({ content: `✅ Dodano ${ilosc} punktów.` });
            } else {
                user.balance = Math.max(0, user.balance - ilosc);
                await user.save();
                await interaction.editReply({ content: `✅ Zabrano ${ilosc} punktów.` });
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
            await checkAndAwardBadges(user, interaction.member);

            await interaction.editReply({ content: `✅ Dodano cytat i przyznano postęp do odznaki Filozof!` });
            return;
        }

        if (commandName === 'mem') {
            await interaction.deferReply();
            const templateId = interaction.options.getString('szablon', true);
            const gora = interaction.options.getString('gora') || '';
            const dol = interaction.options.getString('dol') || '';

            try {
                // Użycie Twoich danych logowania z Imgflip
                const params = new URLSearchParams();
                params.append('template_id', templateId);
                params.append('username', 'ellader');
                params.append('password', 'ellader123');
                params.append('text0', gora);
                params.append('text1', dol);

                const response = await fetch('https://api.imgflip.com/caption_image', { 
                    method: 'POST',
                    body: params
                });
                
                const data = await response.json() as any;

                if (data && data.success) {
                    await interaction.editReply({ content: `🖼️ Oto Twój mem wygenerowany przez <@${interaction.user.id}>:`, files: [data.data.url] });
                } else {
                    const errorMsg = data?.error_message || 'Nieznany błąd';
                    await interaction.editReply({ content: `❌ Nie udało się wygenerować mema. Powód: ${errorMsg}` });
                }
            } catch (err) {
                console.error(err);
                await interaction.editReply({ content: '❌ Wystąpił błąd podczas komunikacji z generatorem memów.' });
            }
            return;
        }

    } catch (error) {
        console.error(error);
    }
});

client.login(token);
