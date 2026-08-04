import { Client, GatewayIntentBits, TextChannel, REST, Routes, SlashCommandBuilder, EmbedBuilder, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { WebcastPushConnection } from 'tiktok-live-connector';
import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } from '@discordjs/voice';
import ffmpeg from 'ffmpeg-static';
import mongoose from 'mongoose';

if (ffmpeg) {
    process.env.FFMPEG_PATH = ffmpeg;
}

const token = process.env.DISCORD_BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;

if (!token) throw new Error("Brak tokena Discord bota!");
if (!MONGO_URI) throw new Error("Brak adresu MONGO_URI do chmury!");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// --- MODEL BAZY DANYCH W CHMURZE (MongoDB) ---
const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    balance: { type: Number, default: 0 },
    lastDaily: { type: Number, default: 0 },
    badges: { type: [String], default: [] }
});

const UserModel = mongoose.model('UserEconomy', userSchema);

async function getOrCreateUser(userId: string) {
    let user = await UserModel.findOne({ userId });
    if (!user) {
        user = await UserModel.create({ userId, balance: 0, badges: [] });
    }
    return user;
}

async function addPoints(userId: string, amount: number): Promise<number> {
    let user = await getOrCreateUser(userId);
    user.balance += amount;
    await user.save();
    return user.balance;
}

async function getBalance(userId: string): Promise<number> {
    let user = await getOrCreateUser(userId);
    return user.balance;
}

async function getUserBadges(userId: string, balance: number): Promise<string[]> {
    let user = await getOrCreateUser(userId);
    const customBadges = user.badges || [];
    const autoBadges: string[] = [];

    if (balance >= 10000) autoBadges.push('💎 **Magnat Finansowy**');
    if (balance >= 1000) autoBadges.push('💬 **Weteran Czata**');

    return Array.from(new Set([...customBadges, ...autoBadges]));
}

const TIKTOK_USER = "languspjn";
const KICK_USER = "languspjn";
const CHANNEL_OGLOSZENIA = "ogłoszenia";
const CHANNEL_POWITANIA = "witamy";
const CHANNEL_CZAT_TIKTOK = "czat-tiktok";
const CHANNEL_GLOSOWY = "🎧 Muza 24/7 - Wejdź i Słuchaj 🎧"; 
const CHANNEL_TOPKA = "topka-pjn-coins";
const CHANNEL_GRY_INFO = "pjn-gry-info";
const CHANNEL_KASYNO = "kasyno";
const CHANNEL_SLOT = "slot";
const CHANNEL_POKER = "poker";

const MOJE_DISCORD_ID = "1175798371995361343";
const DRUGI_ADMIN_ID = "1493928957408448563";
const GUILD_ID = "1532302510671269928";

const ID_KANALU_DUSZKI = "1532977723843285112"; 
const ID_KANALU_GRY_INFO = "1534060343473475644";
const ID_RANGI_DUSZKOWIEC = "1532978703842283551";
const ID_RANGI_MODERATOR = "1532321767857721344";
const ID_RANGI_ADMIN = "1532324059470237857";

const ID_KANALU_PLEC = '1532374188634144898';
const ID_KANALU_RANGES = '1532397673842217010';
const ID_KANALU_SPRZET = '1532398069524594708';

const LIVE_IMAGE_URL = "https://cdn.discordapp.com/attachments/1532862421729808565/1532865034642919574/1784490427936.png?ex=6a6e674f&is=6a6d15cf&hm=92695ee6d6999e9212a4ff8f86d3fdf6e70ee32a9c9e4cb175e54579f8b44fde&";

function isAuthorized(userId: string): boolean {
    return userId === MOJE_DISCORD_ID || userId === DRUGI_ADMIN_ID;
}

async function generateTopkaEmbed(guild: any): Promise<EmbedBuilder> {
    const topUsers = await UserModel.find().sort({ balance: -1 }).limit(10);

    const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('🏆 TOP 10 - Ranking PJN-Coins')
        .setDescription('Ranking jest automatycznie aktualizowany co 5 minut na podstawie aktywności (pisanie oraz czas na kanałach głosowych).')
        .setTimestamp();

    if (topUsers.length === 0) {
        embed.addFields({ name: 'Status', value: 'Brak danych w rankingu.' });
    } else {
        let desc = '';
        for (let i = 0; i < topUsers.length; i++) {
            const data = topUsers[i];
            const medals = ['🥇', '🥈', '🥉'];
            const prefix = medals[i] || `**${i + 1}.**`;
            
            let memberName = `<@${data.userId}>`;
            try {
                const member = await guild.members.fetch(data.userId);
                if (member) memberName = member.user.username;
            } catch (e) {}

            const userBadges = await getUserBadges(data.userId, data.balance);
            const badgeStr = userBadges.length > 0 ? ` [${userBadges.join(' ')}]` : '';
            desc += `${prefix} ${memberName} — \`${data.balance} Coins\`${badgeStr}\n`;
        }
        embed.addFields({ name: 'Najbogatsi użytkownicy', value: desc });
    }
    return embed;
}

function createGryInfoEmbed(): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(0x00FFFF)
        .setTitle('🎮 Centrum Rozrywki i Ekonomii PJN-Coins')
        .setDescription('Witaj w oficjalnym centrum gier serwera! Zbieraj **PJN-Coins** za aktywność na czacie oraz głosie, a następnie pomnażaj je w kasyno lub rywalizuj z innymi.')
        .addFields(
            { 
                name: '💰 Jak zdobywać PJN-Coins i Odznaki?', 
                value: '• Pisanie wiadomości na czacie (`1 Coin` za wiadomość)\n• Przebywanie na kanałach głosowych (`1 Coin` na minutę)\n• Odbieranie darmowej nagrody dziennej: `/daily`\n• Zbieraj bogactwo, aby odblokować prestiżowe odznaki w profilu i topce!' 
            },
            { 
                name: '🎰 Kanał #kasyno (Gry solo)', 
                value: '• `/balans` – Sprawdź stan swojego konta i odznaki\n• `/daily` – Odbierz codzienne 100 Coins\n• `/kostka [stawka]` – Rzuć wyzwanie botowi na kościach\n• `/moneta [orzel/reszka] [stawka]` – Zagraj w orzeł czy reszka\n• `/quiz` – Odpowiedz na pytanie i zgarnij 50 Coins' 
            },
            { 
                name: '🎰 Kanał #slot (Jednoręki Bandyta)', 
                value: '• `/slot [stawka]` – Zagraj na dedykowanym kanale w sloty i wygraj potężną pulę!' 
            },
            { 
                name: '🃏 Kanał #poker (Gry PvP)', 
                value: '• `/poker [stawka]` – Stwórz stół pokerowy dla **2 do 4 graczy**, zbierz znajomych przez przycisk i zgarnij pulę!' 
            },
            { 
                name: '🏆 Kanał #topka-pjn-coins', 
                value: '• Sprawdzaj automatyczny ranking 10 najbogatszych graczy na serwerze.' 
            }
        )
        .setFooter({ text: 'PJN System Gier i Ekonomii' })
        .setTimestamp();
}

function createKasynoInfoEmbed(): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('🎰 Instrukcja i Zasady: Kasyno Solo')
        .setDescription('Witaj na głównym kanale kasyna! Tutaj możesz sprawdzić swój stan konta, zgarnąć darmowe monety oraz zagrać w szybkie gry solo z botem.')
        .addFields(
            { name: '💰 Dostępne komendy i zasady:', value: '• `/balans` – Sprawdź aktualny stan swojego konta oraz odznaki.\n• `/daily` – Odbieraj codzienne 100 PJN-Coins (odnawia się co 24h).\n• `/kostka [stawka]` – Rzuć kością przeciwko botowi. Kto wyrzuci wyższą liczbę, wygrywa podwojoną stawkę!\n• `/moneta [orzel/reszka] [stawka]` – Zgadnij, co wypadnie i pomnóż swoje PJN-Coins.\n• `/quiz` – Odpowiedz na losowe pytanie na czacie jako pierwszy i zgarnij 50 Coins.' },
            { name: '⚠️ Ważne:', value: 'Pamiętaj, że wszystkie gry kasynowe na tym kanale odbywają się wyłącznie z użyciem komend. Graj odpowiedzialnie!' }
        )
        .setFooter({ text: 'PJN Kasyno - Strefa Solo' })
        .setTimestamp();
}

function createSlotInfoEmbed(): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(0xFF4500)
        .setTitle('🎰 Instrukcja gry: Jednoręki Bandyta (Slot)')
        .setDescription('Witaj na dedykowanym kanale slotów! Zakręć bębnami i spróbuj trafić potężną wygraną.')
        .addFields(
            { name: '📥 Jak grać?', value: 'Wpisz komendę: `/slot [stawka]`\n*(Przykład: `/slot 50`)*' },
            { name: '💰 Zasady i wygrane:', value: '• **3 takie same symbole (Jackpot):** Wygrywasz aż **5-krotność** swojej stawki!\n• **2 takie same symbole:** Zwrot postawionej stawki (bilans bez zmian).\n• **Brak dopasowań:** Przegrywasz postawioną stawkę.' },
            { name: '💎 Dostępne symbole:', value: '🍒, 🍋, 🔔, ⭐, 💎' }
        )
        .setFooter({ text: 'PJN Kasyno - Slot' })
        .setTimestamp();
}

function createPokerInfoEmbed(): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(0xE67E22)
        .setTitle('🃏 Instrukcja gry: Poker PvP')
        .setDescription('Witaj na dedykowanym kanale pokerowym! Rzuć wyzwanie znajomym i zgarnij całą pulę.')
        .addFields(
            { name: '📥 Jak grać?', value: 'Wpisz komendę: `/poker [przeciwnik] [stawka]`\n*(Przykład: `/poker @Gracz 100`)*' },
            { name: '👥 Zasady gry:', value: '• Gra przeznaczona jest dla **2 do 4 graczy**.\n• Po uruchomieniu komendy karty trafiają bezpośrednio na Twoje **Wiadomości Prywatne (PW)**.\n• Kiedy wszyscy gotowi, kliknij przycisk odkrycia kart, aby system wyłonił zwycięzcę puli!' },
            { name: '⚠️ Ważne:', value: 'Upewnij się, że masz odblokowane wiadomości prywatne (DM) od użytkowników serwera, aby bot mógł przesłać Ci karty.' }
        )
        .setFooter({ text: 'PJN Kasyno - Poker' })
        .setTimestamp();
}

// Oryginalna funkcja ogłoszenia ze starego kodu
function createOgłoszenieEmbed() {
    return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🌟 Witamy na PJN Server!')
        .setDescription('Cieszymy się, że jesteś częścią naszej społeczności! Pamiętaj, aby regularnie wspierać nasze projekty i śledzić oficjalne profile streamingowe:')
        .addFields(
            { name: '🔗 TikTok', value: '[tiktok.com/@languspjn](https://tiktok.com/@languspjn)', inline: true },
            { name: '🔗 Kick', value: '[kick.com/LangusPJN](https://kick.com/LangusPJN)', inline: true },
            { name: '💡 Społeczność', value: 'Zostaw po sobie ślad, zaproś znajomych na nasz serwer Discord i buduj z nami najlepszą społeczność w sieci! 🚀' }
        )
        .setImage(LIVE_IMAGE_URL)
        .setTimestamp()
        .setFooter({ text: 'PJN System Automatyczny' });
}

function createLiveEmbed(viewerCount: number = 0) {
    return new EmbedBuilder()
        .setColor(0xFE2C55)
        .setTitle('🔴 TRANSMISJA NA ŻYWO (TIKTOK)!')
        .setDescription(`**@languspjn** właśnie rozpoczął nowy stream na TikToku! Wpadnij, zostaw follow i dołącz do wspólnej zabawy.`)
        .addFields(
            { name: '👥 Widzowie online', value: `${viewerCount}`, inline: true },
            { name: '🔗 Oglądaj tutaj', value: '[tiktok.com/@languspjn/live](https://tiktok.com/@languspjn/live)', inline: true }
        )
        .setImage(LIVE_IMAGE_URL)
        .setTimestamp()
        .setFooter({ text: 'PJN Powiadomienia Live' });
}

function createKickLiveEmbed(viewerCount: number = 0) {
    return new EmbedBuilder()
        .setColor(0x53FC18)
        .setTitle('🟢 TRANSMISJA NA ŻYWO (KICK)!')
        .setDescription(`**LangusPJN** właśnie wystartował ze streamem na Kicku! Wbijaj na czat i sprawdź co się dzieje.`)
        .addFields(
            { name: '👥 Widzowie online', value: `${viewerCount}`, inline: true },
            { name: '🔗 Oglądaj tutaj', value: '[kick.com/languspjn](https://kick.com/languspjn)', inline: true }
        )
        .setImage(LIVE_IMAGE_URL)
        .setTimestamp()
        .setFooter({ text: 'PJN Powiadomienia Live Kick' });
}

const tiktokConn = new WebcastPushConnection(TIKTOK_USER);
let isKickLive = false;
let isTikTokLive = false;
let currentViewers = 0;
let currentKickViewers = 0;
const audioPlayer = createAudioPlayer();

const quizQuestions = [
    { question: "Jak nazywa się platforma streamingowa należąca do Stake, na której często streamujesz?", answer: "kick" },
    { question: "Ile sekund ma jedna minuta?", answer: "60" },
    { question: "Jaki jest główny kolor logo i motywu TikToka? (czerwony / niebieski / żółty)", answer: "czerwony" },
    { question: "Która planeta w naszym układzie słonecznym jest najbliżej Słońca?", answer: "merkury" },
    { question: "W jakim kraju powstała gra Minecraft?", answer: "szwecja" }
];

const commands = [
    new SlashCommandBuilder().setName('testogloszenia').setDescription('Wysyła testowe ogłoszenie o profilach (bez @everyone)'),
    new SlashCommandBuilder().setName('testczattiktok').setDescription('Testuje ramkę z czatu TikToka na osobnym kanale'),
    new SlashCommandBuilder().setName('testlive').setDescription('Wysyła testowe powiadomienie o live z @everyone na ogłoszenia (TikTok)'),
    new SlashCommandBuilder().setName('testlivekick').setDescription('Wysyła testowe powiadomienie o live z @everyone na ogłoszenia (Kick)'),
    new SlashCommandBuilder().setName('testwitania').setDescription('Testuje wiadomość powitalną z odnośnikami do rang'),
    new SlashCommandBuilder().setName('balans').setDescription('Sprawdź swoje punkty (PJN-Coins) i odznaki'),
    new SlashCommandBuilder().setName('daily').setDescription('Odbierz codzienną dawkę punktów!'),
    new SlashCommandBuilder().setName('topka').setDescription('Zobacz ranking najbogatszych użytkowników serwera'),
    new SlashCommandBuilder().setName('quiz').setDescription('Zacznij szybki quiz z wiedzy o nagrodę punktową!'),
    new SlashCommandBuilder()
        .setName('odznaka')
        .setDescription('Nadaje lub odbiera odznakę użytkownikowi (Tylko Admin)')
        .addUserOption(option => option.setName('uzytkownik').setDescription('Wybierz użytkownika').setRequired(true))
        .addStringOption(option => option.setName('nazwa').setDescription('Nazwa odznaki (np. 👑 **VIP Serwera**)').setRequired(true))
        .addStringOption(option => option.setName('akcja').setDescription('Co zrobić z odznaką?').setRequired(true).addChoices(
            { name: 'Dodaj', value: 'dodaj' },
            { name: 'Usuń', value: 'usun' }
        )),
    new SlashCommandBuilder()
        .setName('poker')
        .setDescription('Zagraj w pokera wieloosobowego o PJN-Coins!')
        .addUserOption(option => option.setName('przeciwnik').setDescription('Wybierz gracza').setRequired(true))
        .addIntegerOption(option => option.setName('stawka').setDescription('Ile PJN-Coins stawiasz?').setRequired(true)),
    new SlashCommandBuilder()
        .setName('rozdaj-wszystkim')
        .setDescription('Rozdaje określoną ilość PJN-Coins każdemu użytkownikowi (Tylko Admin)')
        .addIntegerOption(option => option.setName('ilosc').setDescription('Ile punktów dać każdemu?').setRequired(true))
        .addStringOption(option => option.setName('powod').setDescription('Powód przyznania punktów').setRequired(false)),
    new SlashCommandBuilder()
        .setName('set-tiktok-live')
        .setDescription('Ręcznie ustawia status TikTok Live (online/offline)')
        .addStringOption(option => option.setName('status').setDescription('Wybierz status').setRequired(true).addChoices({ name: 'ONLINE', value: 'online' }, { name: 'OFFLINE', value: 'offline' })),
    new SlashCommandBuilder()
        .setName('odpalstream')
        .setDescription('Jedno kliknięcie: zmienia status kanału na ONLINE i wysyła ogłoszenie o live!')
        .addStringOption(option => option.setName('platforma').setDescription('Wybierz platformę').setRequired(true).addChoices({ name: 'TikTok', value: 'tiktok' }, { name: 'Kick', value: 'kick' })),
    new SlashCommandBuilder()
        .setName('wylaczstream')
        .setDescription('Zmienia status wybranej platformy na OFFLINE')
        .addStringOption(option => option.setName('platforma').setDescription('Wybierz platformę').setRequired(true).addChoices({ name: 'TikTok', value: 'tiktok' }, { name: 'Kick', value: 'kick' })),
    new SlashCommandBuilder()
        .setName('dodajpunkty')
        .setDescription('Dodaje punkty Tobie lub wybranej osobie (tylko właściciel)')
        .addIntegerOption(option => option.setName('ilosc').setDescription('Ile punktów?').setRequired(true))
        .addUserOption(option => option.setName('uzytkownik').setDescription('Komu dodać?').setRequired(false)),
    new SlashCommandBuilder().setName('kostka').setDescription('Zagraj w rzut kostką o punkty!').addIntegerOption(option => option.setName('stawka').setDescription('Stawka').setRequired(true)),
    new SlashCommandBuilder().setName('moneta').setDescription('Zagraj w orzeł czy reszka!').addStringOption(option => option.setName('wybor').setDescription('orzel lub reszka').setRequired(true).addChoices({ name: 'Orzeł', value: 'orzel' }, { name: 'Reszka', value: 'reszka' })).addIntegerOption(option => option.setName('stawka').setDescription('Stawka').setRequired(true)),
    new SlashCommandBuilder().setName('slot').setDescription('Zagraj w jednorękiego bandytę!').addIntegerOption(option => option.setName('stawka').setDescription('Stawka').setRequired(true)),
    new SlashCommandBuilder().setName('zmiennemuzyke').setDescription('Wybierz stację radiową').addStringOption(option => option.setName('stacja').setDescription('eska, rock lub rmf').setRequired(true)),
].map(command => command.toJSON());

function getStreamUrl(query: string): string {
    const q = query.toLowerCase();
    if (q.includes('rock')) return 'https://extstream.eskago.pl/eska_rock';
    if (q.includes('rmf')) return 'https://rs6-krk.rmfon.pl/rmf_maxxx';
    return 'https://extstream.eskago.pl/eska_warszawa';
}

async function playStream(station: string, connection: any) {
    try {
        const streamUrl = getStreamUrl(station);
        const resource = createAudioResource(streamUrl);
        audioPlayer.play(resource);
        connection.subscribe(audioPlayer);
    } catch (err) {
        console.error(err);
    }
}

async function updateServerStats(guild: any) {
    try {
        const memberChannel = guild.channels.cache.find((ch: any) => ch.isVoiceBased() && ch.name.startsWith('👥 • Członkowie:'));
        if (memberChannel) await memberChannel.setName(`👥 • Członkowie: ${guild.memberCount}`);

        const tiktokChannel = guild.channels.cache.find((ch: any) => ch.isVoiceBased() && ch.name.includes('TikTok Live:'));
        if (tiktokChannel) await tiktokChannel.setName(isTikTokLive ? `🔴 • TikTok Live: ONLINE` : `🔴 • TikTok Live: OFFLINE`);

        const kickChannel = guild.channels.cache.find((ch: any) => ch.isVoiceBased() && ch.name.includes('Kick Live:'));
        if (kickChannel) await kickChannel.setName(isKickLive ? `🟢 • Kick Live: ONLINE (${currentKickViewers})` : `🟢 • Kick Live: OFFLINE`);
    } catch (err) {}
}

async function refreshTopkaOnGuilds() {
    for (const [_, guild] of client.guilds.cache) {
        try {
            await guild.members.fetch().catch(() => {});
            let topChannel = guild.channels.cache.find(ch => ch.isTextBased() && 'name' in ch && ch.name === CHANNEL_TOPKA) as TextChannel;
            if (!topChannel) {
                topChannel = await guild.channels.create({ name: CHANNEL_TOPKA, type: ChannelType.GuildText }) as TextChannel;
            }
            if (topChannel) {
                const messages = await topChannel.messages.fetch({ limit: 10 });
                const botMessages = messages.filter(m => m.author.id === client.user?.id);
                const embed = await generateTopkaEmbed(guild);

                if (botMessages.size > 0) {
                    const latestBotMsg = botMessages.first();
                    await latestBotMsg!.edit({ embeds: [embed] });
                    for (const [msgId, msg] of botMessages) {
                        if (msgId !== latestBotMsg!.id) await msg.delete().catch(() => {});
                    }
                } else {
                    await topChannel.send({ embeds: [embed] });
                }
            }
        } catch (err) {}
    }
}

client.once('ready', async () => {
    console.log('Łączenie z bazą danych w chmurze (MongoDB)...');
    await mongoose.connect(MONGO_URI);
    console.log(`Połączono z bazą MongoDB oraz zalogowano jako ${client.user?.tag}!`);

    const rest = new REST({ version: '10' }).setToken(token);
    try {
        await rest.put(Routes.applicationGuildCommands(client.user!.id, GUILD_ID), { body: commands });
    } catch (error) {}

    for (const [_, guild] of client.guilds.cache) {
        try {
            const ogloszeniaChannel = guild.channels.cache.find(ch => ch.isTextBased() && 'name' in ch && ch.name === CHANNEL_OGLOSZENIA) as TextChannel;
            if (ogloszeniaChannel) {
                await ogloszeniaChannel.send({ embeds: [createOgłoszenieEmbed()] });
            }
        } catch (err) {}
    }

    await refreshTopkaOnGuilds();

    setInterval(() => {
        client.guilds.cache.forEach(guild => updateServerStats(guild));
    }, 5 * 60 * 1000);

    setInterval(async () => {
        try {
            const roomInfo = await tiktokConn.fetchRoomInfo();
            if (roomInfo && roomInfo.room_id) {
                currentViewers = roomInfo.viewer_count || 1;
                if (!isTikTokLive) {
                    isTikTokLive = true;
                    const channel = client.channels.cache.find(ch => ch.isTextBased() && 'name' in ch && ch.name === CHANNEL_OGLOSZENIA) as TextChannel;
                    if (channel) await channel.send({ content: '@everyone', embeds: [createLiveEmbed(currentViewers)] });
                }
            } else {
                isTikTokLive = false;
            }
        } catch (err) {
            isTikTokLive = false;
        }
    }, 2 * 60 * 1000);

    setInterval(() => {
        client.guilds.cache.forEach(guild => {
            guild.channels.cache.forEach(channel => {
                if (channel.type === ChannelType.GuildVoice) {
                    channel.members.forEach(member => {
                        if (!member.user.bot && !member.voice.selfMute && !member.voice.serverMute) {
                            addPoints(member.id, 1);
                        }
                    });
                }
            });
        });
    }, 60 * 1000);

    setInterval(async () => {
        await refreshTopkaOnGuilds();
    }, 5 * 60 * 1000);
});

// Oryginalna obsługa duszków ze starego kodu
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;
    await addPoints(message.author.id, 1);

    if (message.channelId === ID_KANALU_DUSZKI) {
        const pings = `<@&${ID_RANGI_DUSZKOWIEC}> <@&${ID_RANGI_MODERATOR}> <@&${ID_RANGI_ADMIN}>`;
        const replyText = `Cześć ${message.author}, dziękuję że jesteś, teraz zawołam osoby odpowiedzialne do Ciebie abyście porozmawiali o darmowych duszkach!\n\n${pings}`;

        try {
            await message.reply({
                content: replyText,
                allowedMentions: { 
                    roles: [ID_RANGI_DUSZKOWIEC, ID_RANGI_MODERATOR, ID_RANGI_ADMIN],
                    users: [message.author.id] 
                }
            });
        } catch (err) {}
    }
});

// Oryginalne powitanie ze starego kodu
client.on('guildMemberAdd', async member => {
    updateServerStats(member.guild);
    await addPoints(member.id, 200);

    const channel = member.guild.channels.cache.find(ch => ch.isTextBased() && 'name' in ch && ch.name === CHANNEL_POWITANIA) as TextChannel;
    if (channel) {
        const contentMessage = `👋 Witaj na serwerze PJN, <@${member.id}>! Cieszymy się, że jesteś z nami! 🎉\n🎁 Na start otrzymujesz w prezencie **200 PJN-Coins**!`;

        const embedPowitanie = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('📌 Skonfiguruj swój profil i sprawdź najważniejsze miejsca:')
            .setDescription(
                `• Wybierz płeć: <#${ID_KANALU_PLEC}>\n` +
                `• Dostosuj role: <#${ID_KANALU_RANGES}>\n` +
                `• Wybierz swój sprzęt: <#${ID_KANALU_SPRZET}>\n\n` +
                `🎮 Informacje o grach: <#${ID_KANALU_GRY_INFO}>\n` +
                `👻 Darmowe duszki: <#${ID_KANALU_DUSZKI}>`
            )
            .setThumbnail(member.user.displayAvatarURL())
            .setTimestamp();

        await channel.send({ content: contentMessage, embeds: [embedPowitanie] });
    }
});

client.on('guildMemberRemove', member => {
    updateServerStats(member.guild);
});

client.on('interactionCreate', async interaction => {
    if (interaction.isButton() && interaction.customId.startsWith('poker_sprawdz_')) {
        const parts = interaction.customId.split('_');
        const id1 = parts[2], id2 = parts[3], pula = parseInt(parts[4]);

        if (interaction.user.id !== id1 && interaction.user.id !== id2) {
            await interaction.reply({ content: '❌ Nie możesz rozstrzygnąć cudzej gry!', ephemeral: true });
            return;
        }

        const wygranyId = Math.random() < 0.5 ? id1 : id2;
        await addPoints(wygranyId, pula);

        await interaction.update({
            content: `🏆 **Rozstrzygnięcie pokera!** Zwycięzca: <@${wygranyId}> zgarnia pulę **${pula} PJN-Coins**!`,
            embeds: [], components: []
        });
        return;
    }

    if (!interaction.isChatInputCommand()) return;
    const { commandName } = interaction;

    if (commandName === 'odznaka') {
        if (!isAuthorized(interaction.user.id)) {
            await interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
            return;
        }
        await interaction.deferReply({ ephemeral: true });
        const targetUser = interaction.options.getUser('uzytkownik', true);
        const badgeName = interaction.options.getString('nazwa', true);
        const akcja = interaction.options.getString('akcja', true);

        let user = await getOrCreateUser(targetUser.id);
        if (akcja === 'dodaj') {
            if (!user.badges.includes(badgeName)) {
                user.badges.push(badgeName);
                await user.save();
                await interaction.editReply({ content: `✅ Dodano odznakę \`${badgeName}\` użytkownikowi <@${targetUser.id}>!` });
            } else {
                await interaction.editReply({ content: `⚠️ Użytkownik ma już tę odznakę.` });
            }
        } else {
            user.badges = user.badges.filter((b: string) => b !== badgeName);
            await user.save();
            await interaction.editReply({ content: `✅ Usunięto odznakę \`${badgeName}\`.` });
        }
        return;
    }

    if (commandName === 'balans') {
        await interaction.deferReply({ ephemeral: true });
        const points = await getBalance(interaction.user.id);
        const badges = await getUserBadges(interaction.user.id, points);
        const badgeText = badges.length > 0 ? `\n\n🛡️ **Twoje odznaki:**\n${badges.join('\n')}` : '';
        await interaction.editReply({ content: `💰 Posiadasz aktualnie **${points}** PJN-Coins!${badgeText}` });
    }
    else if (commandName === 'topka') {
        await interaction.deferReply();
        await interaction.editReply({ embeds: [await generateTopkaEmbed(interaction.guild)] });
    }
    else if (commandName === 'daily') {
        await interaction.deferReply({ ephemeral: true });
        let user = await getOrCreateUser(interaction.user.id);
        const now = Date.now();
        if (user.lastDaily && now - user.lastDaily < 86400000) {
            await interaction.editReply({ content: `⏳ Nagroda dostępna raz na 24h!` });
            return;
        }
        user.balance += 100;
        user.lastDaily = now;
        await user.save();
        await interaction.editReply({ content: `🎉 Odebrałeś **100 PJN-Coins**!` });
    }
    else if (commandName === 'dodajpunkty') {
        if (!isAuthorized(interaction.user.id)) return;
        await interaction.deferReply({ ephemeral: true });
        const ilosc = interaction.options.getInteger('ilosc', true);
        const target = interaction.options.getUser('uzytkownik') || interaction.user;
        const nowyBalans = await addPoints(target.id, ilosc);
        await interaction.editReply({ content: `✅ Dodano ${ilosc} punktów. Nowy balans: ${nowyBalans}` });
    }
    else {
        await interaction.deferReply({ ephemeral: true });
        const channel = interaction.guild?.channels.cache.find(ch => ch.isTextBased() && 'name' in ch && ch.name === CHANNEL_OGLOSZENIA) as TextChannel;
        const powitaniaChannel = interaction.guild?.channels.cache.find(ch => ch.isTextBased() && 'name' in ch && ch.name === CHANNEL_POWITANIA) as TextChannel;

        if (commandName === 'testogloszenia' && channel) {
            await channel.send({ embeds: [createOgłoszenieEmbed()] });
            await interaction.editReply({ content: 'Wysłano testowe ogłoszenie!' });
        } else if (commandName === 'testlive' && channel) {
            await channel.send({ content: '@everyone', embeds: [createLiveEmbed(currentViewers)] });
            await interaction.editReply({ content: 'Wysłano testowe powiadomienie TikTok!' });
        } else if (commandName === 'testwitania' && powitaniaChannel) {
            const testContent = `👋 Witaj <@${interaction.user.id}>! Tak będą wyglądać odnośniki:\n🎁 Na start otrzymujesz w prezencie **200 PJN-Coins**!`;
            const testEmbed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle('📌 Test Powitania z Rangami')
                .setDescription(
                    `• Wybierz płeć: <#${ID_KANALU_PLEC}>\n` +
                    `• Dostosuj role: <#${ID_KANALU_RANGES}>\n` +
                    `• Wybierz swój sprzęt: <#${ID_KANALU_SPRZET}>\n\n` +
                    `🎮 Informacje o grach: <#${ID_KANALU_GRY_INFO}>\n` +
                    `👻 Darmowe duszki: <#${ID_KANALU_DUSZKI}>`
                );
            await powitaniaChannel.send({ content: testContent, embeds: [testEmbed] });
            await interaction.editReply({ content: 'Wysłano test powitania!' });
        } else {
            await interaction.editReply({ content: 'Komenda wykonana pomyślnie!' });
        }
    }
});

client.login(token);
