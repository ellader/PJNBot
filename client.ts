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
    StringSelectMenuBuilder
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
    // Dodatkowe pola aktywne ze sklepu
    doubleChanceUntil: { type: Date, default: null }, 
    dailyBoostUntil: { type: Date, default: null },     
    customRoleExpiresAt: { type: Date, default: null }, 
    customVoiceExpiresAt: { type: Date, default: null },
    customRoleId: { type: String, default: null }
});

const UserModel = mongoose.model('User', userSchema);

// Schemat historii zakupów w sklepie
const shopHistorySchema = new mongoose.Schema({
    userId: { type: String, required: true },
    itemName: { type: String, required: true },
    price: { type: Number, required: true },
    purchasedAt: { type: Date, default: Date.now }
});
const ShopHistoryModel = mongoose.model('ShopHistory', shopHistorySchema);

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

// === SCHEMAT BAZY DANYCH DLA SYSTEMU LFG ===
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

// === KONFIGURACJA BOTA DISCORD ===
const token = process.env.DISCORD_BOT_TOKEN;
if (!token) throw new Error("Brak tokena Discord bota!");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration
    ]
});

// === KONFIGURACJA GIER I RÓL DLA SYSTEMU LFG ===
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
const ID_KANALU_MEMOW = '1534833757335326810';
const ID_KANALU_SZUKAM_DO_GRY = '1532449084559069214'; 
const CHANNEL_POWITANIA = "witamy";
const ID_KANALU_DUSZKI = "1532977723843285112"; 
const ID_RANGI_DUSZKOWIEC = "1532978703842283551";
const ID_RANGI_MODERATOR = "1532321767857721344";
const ID_RANGI_ADMIN = "1532324059470237857";

const ID_KANAL_REPUTACJI = "1540233764477730908";
const ID_ALEJA_SLAW_REPUTACJI = "1540238376278687754";
const ID_RANGI_WZOROWY_TRADER = "1540235169653592084";   
const ID_RANGI_POZYTYWNY_TRADER = "1540251183892008970"; 
const ID_RANGI_NEGATYWNY_TRADER = "1540235296665239624"; 

// === KONFIGURACJA SKLEPU I ADMINISTRACJI ===
const ID_KANAL_SKLEPU = "1545690716309553212";
const ID_ROLI_VIP = "1545691786289221632";
const ADMIN_LOG_CHANNEL_ID = "1532399010785263799"; 

const SHOP_ITEMS = [
    { id: 'vip_role', name: '🟡 Rola VIP (Stała/Dostęp)', price: 15000, description: 'Zwiększona szansa w kasynie, dostęp do zablokowanych kanałów + 2x PJN-Coins za wiadomości!', type: 'vip' },
    { id: 'double_chance', name: '🍀 Podwójna szansa w kasynie', price: 5000, description: 'Zwiększa szansę na wygraną w grach kasynowych.', type: 'double_chance' },
    { id: 'custom_role', name: '✨ Własna rola na 30 dni', price: 10000, description: 'Możliwość posiadania spersonalizowanej rangi na serwerze.', type: 'custom_role' },
    { id: 'priority_ghost', name: '👻 Bilet po duszka poza kolejką', price: 7000, description: 'Odbiór dowolnego duszka poza kolejką podczas streama.', type: 'priority_ghost' },
    { id: 'badge_client', name: '🏷️ Odznaka "Klient sklepu PJN"', price: 1000, description: 'Unikalna odznaka w profilu.', type: 'badge', badgeName: '🏷️ **Klient sklepu PJN**' },
    { id: 'badge_advanced', name: '🎖️ Odznaka "Zaawansowany klient"', price: 5000, description: 'Ekskluzywna zaawansowana odznaka w profilu.', type: 'badge', badgeName: '🎖️ **Zaawansowany klient sklepu PJN**' },
    { id: 'custom_voice', name: '🎙️ Własny kanał głosowy na 30 dni', price: 6000, description: 'Prywatny pokój głosowy na okres 30 dni.', type: 'custom_voice' },
    { id: 'daily_boost', name: '🎁 Pakiet "2x Daily" na tydzień', price: 8000, description: 'Podwójna ilość PJN-Coins z komendy /daily przez 7 dni.', type: 'daily_boost' }
];

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

async function setupShopChannel() {
    try {
        const channel = await client.channels.fetch(ID_KANAL_SKLEPU).catch(() => null) as TextChannel;
        if (!channel) return;

        const messages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
        if (messages) {
            for (const [_, msg] of messages) {
                if (msg.author.id === client.user?.id) {
                    await msg.delete().catch(() => {});
                }
            }
        }

        let desc = 'Witaj w oficjalnym sklepie serwera PJN! Wydawaj swoje PJN-Coins na unikalne przedmioty, role i usługi.\n\n**📋 Dostępny asortyment:**\n\n';
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

        const messages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
        if (messages) {
            for (const [_, msg] of messages) {
                if (msg.author.id === client.user?.id) {
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
        const channel = await client.channels.fetch('1536365057997283469').catch(() => null) as TextChannel;
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
            .setColor(0xE91E63)
            .setTitle('📸 Przedstaw się społeczności PJN!')
            .setDescription(
                'Witaj na kanale dedykowanym naszym członkom! Chcesz, aby inni Cię poznali? To idealne miejsce, aby pokazać siebie światu.\n\n' +
                '✨ **Co możesz tutaj wrzucić?**\n' +
                '• Swoje zdjęcie (lub zdjęcie pasji/zwierzaka, jeśli wolisz zachować prywatność) 📷\n' +
                '• Kilka słów o sobie: czym się interesujesz, jakiej słuchasz muzyki, w co grasz? 🎧🎮\n' +
                '• Pozdrowienia dla całej ekipy PJN! 👋'
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

        const messages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
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

            const messages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
            if (messages) {
                for (const [_, msg] of messages) {
                    if (msg.author.id === client.user?.id) {
                        await msg.delete().catch(() => {});
                    }
                }
            }

            const embedData = await getReputationTopEmbedData(channel.guild);
            await channel.send({ embeds: [embedData] });
        } catch (err) {
            console.error('Błąd aktualizacji alei sław reputacji:', err);
        }
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

            const embedData = createBadgesInfoEmbed();
            const newMessage = await channel.send({ embeds: [embedData] });

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
                    } catch (err) {
                        console.error('Błąd usuwania kanału głosowego automatycznego LFG:', err);
                    }
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

function startHourlyAnnouncements() {
    cron.schedule('0 * * * *', async () => {
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
        } catch (e) {
            console.error(`Błąd podczas pobierania RSS YouTube dla ${key}:`, e);
        }
    }
}

function startYouTubeRssChecker() {
    checkYouTubeRssFeeds();
    setInterval(checkYouTubeRssFeeds, 5 * 60 * 1000);
}

const commands = [
    new SlashCommandBuilder().setName('portfel').setDescription('Sprawdź stan swoich PJN-Coins w portfelu'),
    new SlashCommandBuilder().setName('sklep').setDescription('Otwórz podgląd sklepu i sprawdź swoje środki'),
    new SlashCommandBuilder().setName('historia-sklepu').setDescription('Wyświetl historię zakupów (Admin)').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
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
        .setName('reputacja')
        .setDescription('Wyświetla profil handlowy, punkty reputacji i exp tradera')
        .addUserOption(o => o.setName('uzytkownik').setDescription('Sprawdź profil innego użytkownika').setRequired(false)),
    new SlashCommandBuilder()
        .setName('daj-wszystkim')
        .setDescription('Rozdaje PJN-Coins absolutnie każdemu użytkownikowi w bazie (Admin)')
        .addIntegerOption(o => o.setName('ilosc').setDescription('Ile PJN-Coins ma otrzymać każdy').setRequired(true))
        .addStringOption(o => o.setName('powod').setDescription('Powód przyznania bonusu').setRequired(false))
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
                .setRequired(false))
].map(c => c.toJSON());

client.once('ready', async () => {
    console.log(`Zalogowano jako ${client.user?.tag}!`);
    await seedQuotesIfNeeded();
    await setupMemeChannelInstruction();
    await setupLfgChannelInstruction(); 
    await setupTicketChannel(); 
    await setupShowcaseChannelInstruction();
    await setupReputationChannelInstruction();
    await setupShopChannel();

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
    startReputationTopUpdater();
    startYouTubeRssChecker();
    startLfgAutoCloser();
});

// === CENTRALNA OBSŁUGA INTERAKCJI ===
client.on('interactionCreate', async interaction => {
    // 1. Obsługa menu wyboru ze sklepu
    if (interaction.isStringSelectMenu()) {
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

    // 2. Obsługa przycisków
    if (interaction.isButton()) {
        // Poprawiona obsługa zakupu ze sklepu
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

            // Pobranie środków i zapis w historii
            user.balance -= item.price;
            await user.save();

            await ShopHistoryModel.create({
                userId: interaction.user.id,
                itemName: item.name,
                price: item.price
            });

            const member = interaction.guild?.members.cache.get(interaction.user.id) || await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);

            // Logika przyznawania nagrody
            if (item.type === 'vip') {
                if (member) {
                    await member.roles.add(ID_ROLI_VIP).catch(() => {});
                }
            } else if (item.type === 'double_chance') {
                user.doubleChanceUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                await user.save();
            } else if (item.type === 'custom_role') {
                user.customRoleExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                await user.save();
            } else if (item.type === 'priority_ghost') {
                // Obsługa biletu
            } else if (item.type === 'badge') {
                if (!user.badges.includes(item.badgeName)) {
                    user.badges.push(item.badgeName);
                    await user.save();
                }
            } else if (item.type === 'custom_voice') {
                user.customVoiceExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                await user.save();
            } else if (item.type === 'daily_boost') {
                user.dailyBoostUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                await user.save();
            }

            await interaction.editReply({ content: `🎉 Dziękuję za zakup przedmiotu **${item.name}**! Pomyślnie pobrano **${item.price} PJN-Coins** z Twojego portfela.` });

            // Powiadomienie dla administracji
            try {
                const adminChannel = await interaction.guild?.channels.fetch(ADMIN_LOG_CHANNEL_ID).catch(() => null) as TextChannel;
                if (adminChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setColor(0xE67E22)
                        .setTitle('🛒 Nowy zakup w sklepie serwerowym!')
                        .setDescription(`Użytkownik <@${interaction.user.id}> właśnie dokonał zakupu.\n\n📦 **Przedmiot:** ${item.name}\n💰 **Cena:** ${item.price} PJN-Coins`)
                        .setTimestamp();
                    await adminChannel.send({ embeds: [logEmbed] });
                }
            } catch (e) {}

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
                    .setDescription(
                        `Witaj <@${interaction.user.id}>!\n\n` +
                        `Napisz jakiego duszka potrzebujesz, ktoś z ekipy wejdzie i od razu zobaczy Twoją wiadomość.\n\n` +
                        `Kliknij przycisk **Zamknij Ticket**, gdy już otrzymasz duszka.`
                    )
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
            const channel = interaction.channel as TextChannel;
            if (!channel) return;
            await interaction.reply({ content: `🔒 Ticket zostanie zamknięty za 5 sekund...` });
            setTimeout(async () => { await channel.delete().catch(() => {}); }, 5000);
            return;
        }

        if (['lfg_join', 'lfg_leave', 'lfg_create_voice', 'lfg_close'].includes(interaction.customId)) {
            await interaction.deferReply({ ephemeral: true });
            const lfgDoc = await LFGModel.findOne({ messageId: interaction.message.id });

            if (!lfgDoc) {
                return interaction.editReply({ content: '❌ To ogłoszenie LFG jest już nieaktualne lub zostało usunięte z bazy.' });
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
                return interaction.editReply({ content: '✅ Pomyślnie zamknięto ogłoszenie LFG i usunięto przypisany kanał głosowy.' });
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
                    return interaction.editReply({ content: '❌ Autor ogłoszenia nie może opuścić własnej ekipy. Użyj przycisku "Zamknij ogłoszenie".' });
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

    // 3. Obsługa autouzupełniania (Autocomplete)
    if (interaction.isAutocomplete()) {
        if (interaction.commandName === 'mem') {
            const focusedValue = interaction.options.getFocused();
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
        }
        return;
    }

    // 4. Obsługa komend tekstowych (Slash Commands)
    if (!interaction.isChatInputCommand()) return;
    const { commandName } = interaction;

    try {
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
            const embedData = createBadgesInfoEmbed();
            const sentMessage = await interaction.channel?.send({ embeds: [embedData] });
            if (sentMessage) {
                await ConfigModel.findOneAndUpdate({ key: 'odznaki_info_msg' }, { channelId: interaction.channelId, messageId: sentMessage.id }, { upsert: true, new: true });
                await interaction.editReply({ content: `✅ Ustawiono ten kanał jako centrum odznak.` });
            }
            return;
        }

        if (commandName === 'reputacja') {
            await interaction.deferReply();
            const targetUser = interaction.options.getUser('uzytkownik') || interaction.user;
            let user = await UserModel.findOne({ userId: targetUser.id });
            if (!user) user = await UserModel.create({ userId: targetUser.id });

            const rep = user.reputation || 0;
            const exp = user.exp || 0;
            const sign = rep > 0 ? '+' : '';
            const currentLevel = Math.floor(exp / 100) + 1;
            const progressInLevel = exp % 100;
            const progressBar = '█'.repeat(Math.floor(progressInLevel / 10)) + '░'.repeat(10 - Math.floor(progressInLevel / 10));

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
                    { name: '📊 Punkty Reputacji', value: `**${sign}${rep} pkt**`, inline: true },
                    { name: '🎖️ Ranga Tradera', value: `**${traderRankName}**`, inline: true },
                    { name: '⭐ Poziom Doświadczenia (Exp)', value: `Poziom **${currentLevel}** (${exp} XP)\n\`[${progressBar}]\` ${progressInLevel}/100 XP`, inline: false }
                )
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        if (commandName === 'daj-wszystkim') {
            if (!isAuthorized(interaction.user.id)) return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
            const ilosc = interaction.options.getInteger('ilosc', true);
            const powod = interaction.options.getString('powod') || 'Brak';
            if (ilosc <= 0) return interaction.reply({ content: '❌ Ilość musi być większa od zera!', ephemeral: true });

            await interaction.deferReply({ ephemeral: true });
            const allUsers = await UserModel.find({});
            let successCount = 0;

            for (const userDoc of allUsers) {
                userDoc.balance = (userDoc.balance || 0) + ilosc;
                await userDoc.save();
                successCount++;
            }
            await interaction.editReply({ content: `✅ Przyznano ${ilosc} PJN-Coins dla ${successCount} użytkowników!` });
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
            await checkAndAwardBadges(sender, interaction.member);

            await interaction.editReply({ content: `✅ Przelano ${kwota} PJN-Coins dla <@${targetUser.id}>!` });
            return;
        }

        // --- KASYNO Z UWZGLĘDNIENIEM VIP ORAZ PODWÓJNEJ SZANSY ---
        const getCasinoMultiplier = async (userId: string, member: any) => {
            let winChance = 0.4; 
            let user = await UserModel.findOne({ userId });
            const hasVipRole = member?.roles?.cache?.has(ID_ROLI_VIP);
            const hasDoubleChance = user?.doubleChanceUntil && new Date(user.doubleChanceUntil) > new Date();

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
            const winChance = await getCasinoMultiplier(interaction.user.id, interaction.member);
            const won = Math.random() < winChance;

            if (won) {
                user.balance += stawka;
                user.consecutiveWins = (user.consecutiveWins || 0) + 1;
                user.consecutiveLosses = 0;
                await user.save();
                await checkAndAwardBadges(user, interaction.member);
                return interaction.editReply({ content: `🎲 Wygrana w kościach! Wygrywasz **${stawka} PJN-Coins** (Stan: **${user.balance}**).` });
            } else {
                user.balance -= stawka;
                user.consecutiveLosses = (user.consecutiveLosses || 0) + 1;
                user.consecutiveWins = 0;
                await user.save();
                await checkAndAwardBadges(user, interaction.member);
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
            const winChance = await getCasinoMultiplier(interaction.user.id, interaction.member);
            const wynik = Math.random() < 0.5 ? 'orzel' : 'reszka';
            const guessed = (wybor === wynik) || (Math.random() < winChance && Math.random() < 0.3);

            if (guessed) {
                user.balance += stawka;
                user.consecutiveWins = (user.consecutiveWins || 0) + 1;
                user.consecutiveLosses = 0;
                await user.save();
                await checkAndAwardBadges(user, interaction.member);
                return interaction.editReply({ content: `🪙 Wypadł **${wynik}**. Trafiłeś! Zyskujesz **${stawka} PJN-Coins**.` });
            } else {
                user.balance -= stawka;
                user.consecutiveLosses = (user.consecutiveLosses || 0) + 1;
                user.consecutiveWins = 0;
                await user.save();
                await checkAndAwardBadges(user, interaction.member);
                return interaction.editReply({ content: `🪙 Wypadł **${wynik}**. Przegrywasz **${stawka} PJN-Coins**.` });
            }
        }

        if (commandName === 'slot') {
            await interaction.deferReply();
            const stawka = interaction.options.getInteger('stawka', true);
            if (stawka <= 0) return interaction.editReply({ content: '❌ Stawka musi być > 0!' });

            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) user = await UserModel.create({ userId: interaction.user.id });
            if (user.balance < stawka) return interaction.editReply({ content: `❌ Brak środków (${user.balance})!` });

            user.casinoPlays = (user.casinoPlays || 0) + 1;
            const symbols = ['🍎', '🍋', '🍒', '🔔', '💎'];
            const winChance = await getCasinoMultiplier(interaction.user.id, interaction.member);
            
            let s1 = symbols[Math.floor(Math.random() * symbols.length)];
            let s2 = symbols[Math.floor(Math.random() * symbols.length)];
            let s3 = symbols[Math.floor(Math.random() * symbols.length)];

            if (Math.random() < winChance) {
                s1 = s2 = symbols[Math.floor(Math.random() * symbols.length)];
            }

            if (s1 === s2 && s2 === s3) {
                const wygrana = stawka * 5;
                user.balance += wygrana;
                user.consecutiveWins = (user.consecutiveWins || 0) + 1;
                user.consecutiveLosses = 0;
                await user.save();
                await checkAndAwardBadges(user, interaction.member);
                return interaction.editReply({ content: `🎰 [ ${s1} | ${s2} | ${s3} ]\nJACKPOT! Wygrywasz **${wygrana} PJN-Coins**!` });
            } else if (s1 === s2 || s2 === s3 || s1 === s3) {
                user.balance += stawka;
                user.consecutiveWins = (user.consecutiveWins || 0) + 1;
                user.consecutiveLosses = 0;
                await user.save();
                await checkAndAwardBadges(user, interaction.member);
                return interaction.editReply({ content: `🎰 [ ${s1} | ${s2} | ${s3} ]\nMała wygrana! Zwrot stawki **${stawka} PJN-Coins**.` });
            } else {
                user.balance -= stawka;
                user.consecutiveLosses = (user.consecutiveLosses || 0) + 1;
                user.consecutiveWins = 0;
                await user.save();
                await checkAndAwardBadges(user, interaction.member);
                return interaction.editReply({ content: `🎰 [ ${s1} | ${s2} | ${s3} ]\nNic z tego! Strata **${stawka} PJN-Coins**.` });
            }
        }

        if (commandName === 'poker') {
            await interaction.deferReply();
            const tryb = interaction.options.getString('tryb', true);
            const stawka = interaction.options.getInteger('stawka', true);
            if (stawka <= 0) return interaction.editReply({ content: '❌ Stawka musi być > 0!' });

            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) user = await UserModel.create({ userId: interaction.user.id });
            if (user.balance < stawka) return interaction.editReply({ content: `❌ Brak środków (${user.balance})!` });

            user.casinoPlays = (user.casinoPlays || 0) + 1;
            const winChance = await getCasinoMultiplier(interaction.user.id, interaction.member);
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
            await checkAndAwardBadges(user, interaction.member);

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
                    await interaction.editReply({ content: `✅ Przyznano odznakę!` });
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

        // --- DAILY Z UWZGLĘDNIENIEM VIP ORAZ PAKIETU 2X DAILY ---
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
            const hasVipRole = interaction.member?.roles?.cache?.has(ID_ROLI_VIP);
            const hasDailyBoost = user.dailyBoostUntil && new Date(user.dailyBoostUntil) > new Date();

            if (hasVipRole || hasDailyBoost) {
                dailyAmount *= 2; 
            }

            user.balance += dailyAmount;
            user.lastDaily = now;
            await user.save();
            await checkAndAwardBadges(user, interaction.member);

            await interaction.editReply({ content: `🎁 Otrzymałeś codzienne **${dailyAmount} PJN-Coins**!` });
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

    } catch (error) {
        console.error(error);
    }
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
            const expChange = isPlus ? 15 : 5;
            receiverUser.reputation = (receiverUser.reputation || 0) + pointsChange;
            receiverUser.exp = (receiverUser.exp || 0) + expChange;
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

        const hasVipRole = message.member?.roles?.cache?.has(ID_ROLI_VIP);
        const coinsEarned = hasVipRole ? 2 : 1;

        user.messageCount = (user.messageCount || 0) + 1;
        user.balance += coinsEarned;
        
        const currentHour = new Date().getHours();
        if (currentHour >= 0 && currentHour < 4) user.nightMessageCount = (user.nightMessageCount || 0) + 1;

        const customEmojis = message.content.match(/<a?:\w+:\d+>/g);
        if (customEmojis) user.emojiCount = (user.emojiCount || 0) + customEmojis.length;

        await user.save();
        await checkAndAwardBadges(user, message.member);
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
                    
                    const hasVipRole = newState.member?.roles?.cache?.has(ID_ROLI_VIP);
                    const earnedCoins = hasVipRole ? minutesSpent * 2 : minutesSpent;

                    user.voiceMinutes = (user.voiceMinutes || 0) + minutesSpent;
                    user.balance += earnedCoins;
                    await user.save();
                    if (newState.member) await checkAndAwardBadges(user, newState.member);
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
        await checkAndAwardBadges(user, member);

        const channel = member.guild.channels.cache.find(ch => ch.isTextBased() && 'name' in ch && ch.name === CHANNEL_POWITANIA) as TextChannel;
        if (channel) {
            const embed = new EmbedBuilder()
                .setColor(0x2ECC71)
                .setDescription(`📌 Witaj na serwerze! Na start otrzymujesz **200 PJN-Coins**!`)
                .setThumbnail(member.user.displayAvatarURL());
            await channel.send({ content: `👋 Witaj, <@${member.id}>!`, embeds: [embed] });
        }
    } catch (e) {}
});

client.on('guildMemberRemove', async member => {
    try {
        const logChannel = await member.guild.channels.fetch(NOTIF_CONFIG.leaveLogChannelId) as TextChannel;
        if (!logChannel) return;

        let color = 0xED4245;
        let title = '📤 Użytkownik opuścił serwer';
        let description = `**${member.user.tag}** opuścił naszą społeczność.`;

        const embed = new EmbedBuilder().setColor(color).setTitle(title).setDescription(description).setTimestamp();
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
