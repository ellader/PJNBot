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
    ChannelType
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
    cron.schedule('30 3 * * *', async () => {
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

// === SYSTEM TICKETÓW - EMBED PANELU ===
function createTicketPanelEmbed() {
    return new EmbedBuilder()
        .setColor(0x2ECC71)
        .setTitle('🎫 Centrum Pomocy i Zgłoszeń PJN')
        .setDescription(
            'Potrzebujesz pomocy z duszkami? Dobrze trafiłeś!\n\n' +
            'Kliknij poniższy przycisk **"Stwórz Ticket"**, aby otworzyć prywatny kanał. Nasza ekipa pomoże Ci tak szybko, jak to możliwe!\n\n' +
            '⚠️ *Prosimy nie tworzyć zgłoszeń bez potrzeby – szanujmy swój czas.*'
        )
        .setTimestamp()
        .setFooter({ text: 'PJN System Ticketów • Bezpieczna pomoc' });
}

// === AUTOMATYCZNE WYSYŁANIE / ODŚWIEŻANIE PANELU TICKETÓW NA KANALE DUSZKI ===
async function setupTicketChannel() {
    try {
        const channel = await client.channels.fetch(ID_KANALU_DUSZKI).catch(() => null) as TextChannel;
        if (!channel) return;

        const messages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
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
    new SlashCommandBuilder().setName('quiz').setDescription('Odpowiedz na pytanie quizowe'),
    new SlashCommandBuilder().setName('odznaki').setDescription('Wyświetla profil z odznakami').addUserOption(o => o.setName('uzytkownik').setDescription('Użytkownik').setRequired(false)),
    new SlashCommandBuilder()
        .setName('daj-wszystkim')
        .setDescription('Rozdaje PJN-Coins absolutnie każdemu użytkownikowi w bazie (Admin)')
        .addIntegerOption(o => o.setName('ilosc').setDescription('Ile PJN-Coins ma otrzymać każdy').setRequired(true))
        .addStringOption(o => o.setName('powod').setDescription('Powód przyznania prezentu').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
        .setName('nowości')
        .setDescription('Wysyła ogłoszenie o nowościach na serwerze (Admin)')
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
    await setupTicketChannel(); 

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

client.on('interactionCreate', async interaction => {
    if (interaction.isButton()) {
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
                        {
                            id: guild.id,
                            deny: [PermissionFlagsBits.ViewChannel],
                        },
                        {
                            id: interaction.user.id,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                        },
                        {
                            id: ID_RANGI_DUSZKOWIEC,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                        },
                        {
                            id: ID_RANGI_MODERATOR,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                        },
                        {
                            id: ID_RANGI_ADMIN,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                        }
                    ],
                });

                const welcomeEmbed = new EmbedBuilder()
                    .setColor(0x2ECC71)
                    .setTitle(`🎫 Ticket od: ${interaction.user.tag}`)
                    .setDescription(
                        `Witaj <@${interaction.user.id}>!\n\n` +
                        `Napisz jakiego duszka potrzebujesz, ktoś z ekipy wejdzie i od razu zobaczy Twoją wiadomość (<@&${ID_RANGI_DUSZKOWIEC}>, <@&${ID_RANGI_MODERATOR}>, <@&${ID_RANGI_ADMIN}>) została powiadomiona i wkrótce odpowie.\n\n` +
                        `Kliknij przycisk **Zamknij Ticket**, gdy juz otrzymasz duszka.`
                    )
                    .setTimestamp();

                const closeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                        .setCustomId('close_ticket')
                        .setLabel('Zamknij Ticket')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🔒')
                );

                await ticketChannel.send({
                    content: `<@${interaction.user.id}> | <@&${ID_RANGI_DUSZKOWIEC}> <@&${ID_RANGI_MODERATOR}> <@&${ID_RANGI_ADMIN}>`,
                    embeds: [welcomeEmbed],
                    components: [closeRow]
                });

                await interaction.editReply({ content: `✅ Stworzono dla Ciebie prywatny ticket: <#${ticketChannel.id}>!` });
            } catch (err) {
                console.error(err);
                await interaction.editReply({ content: '❌ Wystąpił błąd podczas tworzenia ticketu.' });
            }
            return;
        }

        if (interaction.customId === 'close_ticket') {
            const channel = interaction.channel as TextChannel;
            if (!channel) return;

            await interaction.reply({ content: `🔒 Zamykanie ticketu za 5 sekund...` }).catch(() => {});
            setTimeout(async () => {
                await channel.delete().catch(() => {});
            }, 5000);
            return;
        }
    }
});

client.login(token);
