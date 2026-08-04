import { Client, GatewayIntentBits, TextChannel, REST, Routes, SlashCommandBuilder, EmbedBuilder, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { WebcastPushConnection } from 'tiktok-live-connector';
import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } from '@discordjs/voice';
import ffmpeg from 'ffmpeg-static';
import mongoose from 'mongoose';

if (ffmpeg) {
    process.env.FFMPEG_PATH = ffmpeg;
}

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) throw new Error("Brak tokena Discord bota!");

// Połączenie z bazą danych MongoDB w chmurze
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) throw new Error("Brak zmiennej środowiskowej MONGO_URI!");

mongoose.connect(MONGO_URI)
    .then(() => console.log("Połączono z bazą danych MongoDB!"))
    .catch(err => console.error("Błąd połączenia z MongoDB:", err));

// Schemat użytkownika w bazie MongoDB
const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    balance: { type: Number, default: 0 },
    lastDaily: { type: Number, default: 0 }
});

const UserModel = mongoose.model('User', userSchema);

// Funkcje bazodanowe zastępujące plik JSON
async function getBalance(userId: string): Promise<number> {
    let user = await UserModel.findOne({ userId });
    if (!user) {
        user = await UserModel.create({ userId, balance: 0 });
    }
    return user.balance;
}

async function addPoints(userId: string, amount: number): Promise<number> {
    let user = await UserModel.findOne({ userId });
    if (!user) {
        user = await UserModel.create({ userId, balance: 0 });
    }
    user.balance += amount;
    await user.save();
    return user.balance;
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates
    ]
});

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

async function generateTopkaEmbed(): Promise<EmbedBuilder> {
    const topUsers = await UserModel.find().sort({ balance: -1 }).limit(10);

    const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('🏆 TOP 10 - Ranking PJN-Coins')
        .setDescription('Ranking jest automatycznie aktualizowany co 10 minut na podstawie aktywności w bazie danych.')
        .setTimestamp();

    if (topUsers.length === 0) {
        embed.addFields({ name: 'Status', value: 'Brak danych w rankingu.' });
    } else {
        let desc = '';
        topUsers.forEach((user, index) => {
            const medals = ['🥇', '🥈', '🥉'];
            const prefix = medals[index] || `**${index + 1}.**`;
            desc += `${prefix} <@${user.userId}> — \`${user.balance} Coins\`\n`;
        });
        embed.addFields({ name: 'Najbogatsi użytkownicy', value: desc });
    }
    return embed;
}

function createGryInfoEmbed(): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(0x00FFFF)
        .setTitle('🎮 Centrum Rozrywki i Ekonomii PJN-Coins')
        .setDescription('Witaj w oficjalnym centrum gier serwera! Zbieraj **PJN-Coins** za aktywność na czacie oraz głosie, a następnie pomnażaj je w kasynie lub rywalizuj z innymi.')
        .addFields(
            { 
                name: '💰 Jak zdobywać PJN-Coins?', 
                value: '• Pisanie wiadomości na czacie (`1 Coin` za wiadomość)\n• Przebywanie na kanałach głosowych (`1 Coin` na minutę)\n• Odbieranie darmowej nagrody dziennej: `/daily`' 
            },
            { 
                name: '🎰 Kanał #kasyno (Gry solo)', 
                value: '• `/balans` – Sprawdź stan swojego konta\n• `/daily` – Odbierz codzienne 100 Coins\n• `/kostka [stawka]` – Rzuć wyzwanie botowi na kościach\n• `/moneta [orzel/reszka] [stawka]` – Zagraj w orzeł czy reszka\n• `/quiz` – Odpowiedz na pytanie i zgarnij 50 Coins' 
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
            { name: '💰 Dostępne komendy i zasady:', value: '• `/balans` – Sprawdź aktualny stan swojego konta.\n• `/daily` – Odbieraj codzienne 100 PJN-Coins (odnawia się co 24h).\n• `/kostka [stawka]` – Rzuć kością przeciwko botowi. Kto wyrzuci wyższą liczbę, wygrywa podwojoną stawkę!\n• `/moneta [orzel/reszka] [stawka]` – Zgadnij, co wypadnie i pomnóż swoje PJN-Coins.\n• `/quiz` – Odpowiedz na losowe pytanie na czacie jako pierwszy i zgarnij 50 Coins.' },
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
            { name: '⚠️ Ważne:', value: 'Upewnij się, że masz odblokowane wiadomości prywatne (DM) od użytkowników serwera.' }
        )
        .setFooter({ text: 'PJN Kasyno - Poker' })
        .setTimestamp();
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
    { question: "Jaki jest główny kolor logo i motywu TikToka?", answer: "czerwony" },
    { question: "Która planeta w naszym układzie słonecznym jest najbliżej Słońca?", answer: "merkury" },
    { question: "W jakim kraju powstała gra Minecraft?", answer: "szwecja" }
];

const commands = [
    new SlashCommandBuilder().setName('testogloszenia').setDescription('Wysyła testowe ogłoszenie o profilach'),
    new SlashCommandBuilder().setName('testczattiktok').setDescription('Testuje ramkę z czatu TikToka'),
    new SlashCommandBuilder().setName('testlive').setDescription('Wysyła testowe powiadomienie o live TikTok'),
    new SlashCommandBuilder().setName('testlivekick').setDescription('Wysyła testowe powiadomienie o live Kick'),
    new SlashCommandBuilder().setName('testwitania').setDescription('Testuje wiadomość powitalną'),
    new SlashCommandBuilder().setName('balans').setDescription('Sprawdź swoje punkty (PJN-Coins)'),
    new SlashCommandBuilder().setName('daily').setDescription('Odbierz codzienną dawkę punktów!'),
    new SlashCommandBuilder().setName('topka').setDescription('Zobacz ranking najbogatszych użytkowników'),
    new SlashCommandBuilder().setName('quiz').setDescription('Zacznij szybki quiz punktowy!'),
    new SlashCommandBuilder()
        .setName('poker')
        .setDescription('Zagraj w pokera wieloosobowego o PJN-Coins!')
        .addUserOption(option => option.setName('przeciwnik').setDescription('Wybierz gracza').setRequired(true))
        .addIntegerOption(option => option.setName('stawka').setDescription('Ile PJN-Coins stawiasz?').setRequired(true)),
    new SlashCommandBuilder()
        .setName('rozdaj-wszystkim')
        .setDescription('Rozdaje punkty każdemu użytkownikowi (Tylko Admin)')
        .addIntegerOption(option => option.setName('ilosc').setDescription('Ile punktów?').setRequired(true))
        .addStringOption(option => option.setName('powod').setDescription('Powód').setRequired(false)),
    new SlashCommandBuilder()
        .setName('set-tiktok-live')
        .setDescription('Ustawia status TikTok Live')
        .addStringOption(option => option.setName('status').setDescription('Status').setRequired(true).addChoices({ name: 'ONLINE', value: 'online' }, { name: 'OFFLINE', value: 'offline' })),
    new SlashCommandBuilder()
        .setName('odpalstream')
        .setDescription('Zmienia status na ONLINE i wysyła ogłoszenie')
        .addStringOption(option => option.setName('platforma').setDescription('Platforma').setRequired(true).addChoices({ name: 'TikTok', value: 'tiktok' }, { name: 'Kick', value: 'kick' })),
    new SlashCommandBuilder()
        .setName('wylaczstream')
        .setDescription('Zmienia status na OFFLINE')
        .addStringOption(option => option.setName('platforma').setDescription('Platforma').setRequired(true).addChoices({ name: 'TikTok', value: 'tiktok' }, { name: 'Kick', value: 'kick' })),
    new SlashCommandBuilder()
        .setName('dodajpunkty')
        .setDescription('Dodaje punkty (tylko właściciel)')
        .addIntegerOption(option => option.setName('ilosc').setDescription('Ile punktów?').setRequired(true))
        .addUserOption(option => option.setName('uzytkownik').setDescription('Komu?').setRequired(false)),
    new SlashCommandBuilder().setName('kostka').setDescription('Zagraj w rzut kostką').addIntegerOption(option => option.setName('stawka').setDescription('Stawka').setRequired(true)),
    new SlashCommandBuilder().setName('moneta').setDescription('Orzeł czy reszka').addStringOption(option => option.setName('wybor').setDescription('orzel/reszka').setRequired(true).addChoices({ name: 'Orzeł', value: 'orzel' }, { name: 'Reszka', value: 'reszka' })).addIntegerOption(option => option.setName('stawka').setDescription('Stawka').setRequired(true)),
    new SlashCommandBuilder().setName('slot').setDescription('Jednoręki bandyta').addIntegerOption(option => option.setName('stawka').setDescription('Stawka').setRequired(true)),
    new SlashCommandBuilder().setName('zmiennemuzyke').setDescription('Wybierz stację radiową').addStringOption(option => option.setName('stacja').setDescription('eska, rock, rmf').setRequired(true)),
].map(command => command.toJSON());

function createOgłoszenieEmbed() {
    return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🌟 Witamy na PJN Server!')
        .setDescription('Cieszymy się, że jesteś częścią naszej społeczności! Śledź nasze profile:')
        .addFields(
            { name: '🔗 TikTok', value: '[tiktok.com/@languspjn](https://www.tiktok.com/@languspjn)', inline: true },
            { name: '🔗 Kick', value: '[kick.com/LangusPJN](https://kick.com/LangusPJN)', inline: true }
        )
        .setImage(LIVE_IMAGE_URL)
        .setTimestamp();
}

function createLiveEmbed(viewerCount: number = 0) {
    return new EmbedBuilder()
        .setColor(0xFE2C55)
        .setTitle('🔴 TRANSMISJA NA ŻYWO (TIKTOK)!')
        .setDescription(`**@languspjn** właśnie rozpoczął nowy stream na TikToku!`)
        .addFields({ name: '👥 Widzowie', value: `${viewerCount}`, inline: true })
        .setImage(LIVE_IMAGE_URL)
        .setTimestamp();
}

function createKickLiveEmbed(viewerCount: number = 0) {
    return new EmbedBuilder()
        .setColor(0x53FC18)
        .setTitle('🟢 TRANSMISJA NA ŻYWO (KICK)!')
        .setDescription(`**LangusPJN** wystartował ze streamem na Kicku!`)
        .addFields({ name: '👥 Widzowie', value: `${viewerCount}`, inline: true })
        .setImage(LIVE_IMAGE_URL)
        .setTimestamp();
}

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
        console.error('Błąd odtwarzania strumienia:', err);
    }
}

async function updateServerStats(guild: any) {
    try {
        const memberChannel = guild.channels.cache.find((ch: any) => ch.isVoiceBased() && ch.name.startsWith('👥 • Członkowie:'));
        if (memberChannel) await memberChannel.setName(`👥 • Członkowie: ${guild.memberCount}`);

        const tiktokChannel = guild.channels.cache.find((ch: any) => ch.isVoiceBased() && ch.name.includes('TikTok Live:'));
        if (tiktokChannel) {
            const name = isTikTokLive ? `🔴 • TikTok Live: ONLINE` : `🔴 • TikTok Live: OFFLINE`;
            if (tiktokChannel.name !== name) await tiktokChannel.setName(name);
        }

        const kickChannel = guild.channels.cache.find((ch: any) => ch.isVoiceBased() && ch.name.includes('Kick Live:'));
        if (kickChannel) {
            const name = isKickLive ? `🟢 • Kick Live: ONLINE (${currentKickViewers})` : `🟢 • Kick Live: OFFLINE`;
            if (kickChannel.name !== name) await kickChannel.setName(name);
        }
    } catch (err) {
        console.error('Błąd statystyk:', err);
    }
}

client.once('ready', async () => {
    console.log(`Zalogowano jako ${client.user?.tag}!`);

    const rest = new REST({ version: '10' }).setToken(token);
    try {
        await rest.put(Routes.applicationGuildCommands(client.user!.id, GUILD_ID), { body: commands });
        console.log('Zarejestrowano komendy!');
    } catch (error) {
        console.error('Błąd komend:', error);
    }

    for (const [_, guild] of client.guilds.cache) {
        try {
            let infoChannel = guild.channels.cache.find(ch => ch.isTextBased() && 'name' in ch && ch.name === CHANNEL_GRY_INFO) as TextChannel;
            if (!infoChannel) {
                infoChannel = await guild.channels.create({ name: CHANNEL_GRY_INFO, type: ChannelType.GuildText }) as TextChannel;
            }
            if (infoChannel) {
                const messages = await infoChannel.messages.fetch({ limit: 5 });
                const botMsg = messages.find(m => m.author.id === client.user?.id);
                const infoEmbed = createGryInfoEmbed();
                if (botMsg) await botMsg.edit({ embeds: [infoEmbed] });
                else await infoChannel.send({ embeds: [infoEmbed] });
            }

            let slotChannel = guild.channels.cache.find(ch => ch.isTextBased() && 'name' in ch && ch.name === CHANNEL_SLOT) as TextChannel;
            if (!slotChannel) {
                slotChannel = await guild.channels.create({ name: CHANNEL_SLOT, type: ChannelType.GuildText }) as TextChannel;
            }
            if (slotChannel) {
                const messages = await slotChannel.messages.fetch({ limit: 5 });
                const botMsg = messages.find(m => m.author.id === client.user?.id);
                const slotEmbed = createSlotInfoEmbed();
                if (botMsg) await botMsg.edit({ embeds: [slotEmbed] });
                else await slotChannel.send({ embeds: [slotEmbed] });
            }
        } catch (err) {
            console.error('Błąd konfiguracji:', err);
        }
    }

    setInterval(() => client.guilds.cache.forEach(g => updateServerStats(g)), 5 * 60 * 1000);

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
                currentViewers = 0;
            }
            client.guilds.cache.forEach(g => updateServerStats(g));
        } catch (err) {
            isTikTokLive = false;
            currentViewers = 0;
            client.guilds.cache.forEach(g => updateServerStats(g));
        }
    }, 2 * 60 * 1000);

    setInterval(async () => {
        try {
            const response = await fetch(`https://kick.com/api/v2/channels/${KICK_USER}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            if (response.ok) {
                const data = await response.json() as any;
                if (data.livestream) {
                    currentKickViewers = data.livestream.viewer_count || 0;
                    if (!isKickLive) {
                        isKickLive = true;
                        const channel = client.channels.cache.find(ch => ch.isTextBased() && 'name' in ch && ch.name === CHANNEL_OGLOSZENIA) as TextChannel;
                        if (channel) await channel.send({ content: '@everyone', embeds: [createKickLiveEmbed(currentKickViewers)] });
                    }
                } else {
                    isKickLive = false;
                    currentKickViewers = 0;
                }
                client.guilds.cache.forEach(g => updateServerStats(g));
            }
        } catch (err) {
            console.error('Błąd Kick:', err);
        }
    }, 2 * 60 * 1000);

    setInterval(() => {
        client.guilds.cache.forEach(guild => {
            guild.channels.cache.forEach(channel => {
                if (channel.type === ChannelType.GuildVoice) {
                    channel.members.forEach(member => {
                        if (!member.user.bot && !member.voice.selfMute && !member.voice.serverMute && !member.voice.selfDeaf && !member.voice.serverDeaf) {
                            addPoints(member.id, 1);
                        }
                    });
                }
            });
        });
    }, 60 * 1000);

    setInterval(async () => {
        for (const [_, guild] of client.guilds.cache) {
            try {
                let topChannel = guild.channels.cache.find(ch => ch.isTextBased() && 'name' in ch && ch.name === CHANNEL_TOPKA) as TextChannel;
                if (!topChannel) {
                    topChannel = await guild.channels.create({ name: CHANNEL_TOPKA, type: ChannelType.GuildText }) as TextChannel;
                }
                if (topChannel) {
                    const messages = await topChannel.messages.fetch({ limit: 5 });
                    const botMessage = messages.find(m => m.author.id === client.user?.id);
                    const embed = await generateTopkaEmbed();
                    if (botMessage) await botMessage.edit({ embeds: [embed] });
                    else await topChannel.send({ embeds: [embed] });
                }
            } catch (err) {
                console.error('Błąd topki:', err);
            }
        }
    }, 10 * 60 * 1000);

    setTimeout(() => {
        client.guilds.cache.forEach(async guild => {
            updateServerStats(guild);
            const voiceChannel = guild.channels.cache.find(ch => ch.isVoiceBased() && ch.name === CHANNEL_GLOSOWY);
            if (voiceChannel) {
                try {
                    const connection = joinVoiceChannel({ channelId: voiceChannel.id, guildId: guild.id, adapterCreator: guild.voiceAdapterCreator });
                    await playStream('eska', connection);
                    audioPlayer.on(AudioPlayerStatus.Idle, async () => { await playStream('eska', connection); });
                } catch (err) {
                    console.error('Błąd głosu:', err);
                }
            }
        });
    }, 3000);
});

client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    await addPoints(message.author.id, 1);

    if (message.channelId === ID_KANALU_DUSZKI) {
        const pings = `<@&${ID_RANGI_DUSZKOWIEC}> <@&${ID_RANGI_MODERATOR}> <@&${ID_RANGI_ADMIN}>`;
        await message.reply({ content: `Cześć ${message.author}, dziękuję że jesteś!\n\n${pings}`, allowedMentions: { roles: [ID_RANGI_DUSZKOWIEC, ID_RANGI_MODERATOR, ID_RANGI_ADMIN], users: [message.author.id] } });
    }
});

client.on('guildMemberAdd', async member => {
    updateServerStats(member.guild);
    await addPoints(member.id, 200);

    const channel = member.guild.channels.cache.find(ch => ch.isTextBased() && 'name' in ch && ch.name === CHANNEL_POWITANIA) as TextChannel;
    if (channel) {
        const contentMessage = `👋 Witaj na serwerze PJN, <@${member.id}>! Otrzymujesz w prezencie **200 PJN-Coins**!`;
        const embedPowitanie = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('📌 Sprawdź najważniejsze miejsca:')
            .setDescription(`• Wybierz płeć: <#${ID_KANALU_PLEC}>\n• Role: <#${ID_KANALU_RANGES}>\n• Sprzęt: <#${ID_KANALU_SPRZET}>\n• Gry: <#${ID_KANALU_GRY_INFO}>\n• Duszki: <#${ID_KANALU_DUSZKI}>`)
            .setThumbnail(member.user.displayAvatarURL())
            .setTimestamp();
        await channel.send({ content: contentMessage, embeds: [embedPowitanie] });
    }
});

client.on('guildMemberRemove', member => { updateServerStats(member.guild); });

client.on('interactionCreate', async interaction => {
    if (interaction.isButton() && interaction.customId.startsWith('poker_sprawdz_')) {
        const parts = interaction.customId.split('_');
        const id1 = parts[2];
        const id2 = parts[3];
        const pula = parseInt(parts[4]);

        if (interaction.user.id !== id1 && interaction.user.id !== id2) {
            await interaction.reply({ content: '❌ Nie możesz rozstrzygnąć cudzej gry!', ephemeral: true });
            return;
        }

        const pkt1 = Math.floor(Math.random() * 100);
        const pkt2 = Math.floor(Math.random() * 100);
        let wygranyId = pkt1 > pkt2 ? id1 : (pkt2 > pkt1 ? id2 : null);

        if (!wygranyId) {
            await addPoints(id1, pula / 2);
            await addPoints(id2, pula / 2);
            await interaction.update({ content: `🤝 **Remis!** Pula zwrócona.`, embeds: [], components: [] });
            return;
        }

        await addPoints(wygranyId, pula);
        await interaction.update({ content: `🏆 Zwycięzcą zostaje <@${wygranyId}> zgarniając **${pula} PJN-Coins**!`, embeds: [], components: [] });
        return;
    }

    if (!interaction.isChatInputCommand()) return;
    const { commandName } = interaction;
    const currentChannelName = interaction.channel && 'name' in interaction.channel ? interaction.channel.name : '';

    if (['kostka', 'moneta', 'quiz', 'daily'].includes(commandName) && currentChannelName !== CHANNEL_KASYNO) {
        await interaction.reply({ content: `❌ Użyj tej komendy na kanale <#${CHANNEL_KASYNO}>!`, ephemeral: true });
        return;
    }

    if (commandName === 'slot' && currentChannelName !== CHANNEL_SLOT) {
        await interaction.reply({ content: `❌ Użyj tej komendy na kanale <#${CHANNEL_SLOT}>!`, ephemeral: true });
        return;
    }

    if (commandName === 'poker') {
        const przeciwnik = interaction.options.getUser('przeciwnik', true);
        const stawka = interaction.options.getInteger('stawka', true);
        const gracz1 = interaction.user;

        if (przeciwnik.bot || przeciwnik.id === gracz1.id) {
            await interaction.reply({ content: '❌ Błędny przeciwnik!', ephemeral: true });
            return;
        }

        const balans1 = await getBalance(gracz1.id);
        const balans2 = await getBalance(przeciwnik.id);

        if (balans1 < stawka || balans2 < stawka) {
            await interaction.reply({ content: `❌ Niewystarczające środki (minimum ${stawka} Coins u obu graczy)!`, ephemeral: true });
            return;
        }

        await addPoints(gracz1.id, -stawka);
        await addPoints(przeciwnik.id, -stawka);
        const pula = stawka * 2;

        const embed = new EmbedBuilder().setColor(0xE67E22).setTitle('🃏 Pojedynek Pokerowy').setDescription(`Stawka: **${stawka} Coins** (Pula: **${pula}**)\nKliknij przycisk poniżej, aby odsłonić karty.`);
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`poker_sprawdz_${gracz1.id}_${przeciwnik.id}_${pula}`).setLabel('Odkryj karty!').setStyle(ButtonStyle.Success)
        );

        try {
            await gracz1.send(`Twoje karty w pokerze z <@${przeciwnik.id}> zostały rozdane.`);
            await przeciwnik.send(`Twoje karty w pokerze z <@${gracz1.id}> zostały rozdane.`);
        } catch {
            await addPoints(gracz1.id, stawka);
            await addPoints(przeciwnik.id, stawka);
            await interaction.reply({ content: '❌ Jeden z graczy ma zablokowane wiadomości prywatne (DM)!', ephemeral: true });
            return;
        }

        await interaction.reply({ embeds: [embed], components: [row] });
        return;
    }

    if (commandName === 'balans') {
        await interaction.deferReply({ ephemeral: true });
        const points = await getBalance(interaction.user.id);
        await interaction.editReply({ content: `💰 Posiadasz aktualnie **${points}** PJN-Coins!` });
    }
    else if (commandName === 'daily') {
        await interaction.deferReply({ ephemeral: true });
        const userId = interaction.user.id;
        const userDoc = await UserModel.findOne({ userId });
        const now = Date.now();
        const cooldown = 24 * 60 * 60 * 1000;

        if (userDoc && userDoc.lastDaily && now - userDoc.lastDaily < cooldown) {
            const timeLeft = Math.ceil((cooldown - (now - userDoc.lastDaily)) / (1000 * 60 * 60));
            await interaction.editReply({ content: `⏳ Nagroda dostępna za ok. **${timeLeft} godz.**` });
            return;
        }

        await addPoints(userId, 100);
        await UserModel.updateOne({ userId }, { lastDaily: now });
        await interaction.editReply({ content: `🎉 Odebrałeś codzienne **100 PJN-Coins**!` });
    }
    else if (commandName === 'topka') {
        await interaction.deferReply();
        await interaction.editReply({ embeds: [await generateTopkaEmbed()] });
    }
    else if (commandName === 'dodajpunkty') {
        if (!isAuthorized(interaction.user.id)) {
            await interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
            return;
        }
        await interaction.deferReply({ ephemeral: true });
        const ilosc = interaction.options.getInteger('ilosc', true);
        const docelowy = interaction.options.getUser('uzytkownik') || interaction.user;
        const nowyBalans = await addPoints(docelowy.id, ilosc);
        await interaction.editReply({ content: `✅ Dodano **${ilosc}** Coins dla <@${docelowy.id}>. Nowy balans: **${nowyBalans}**` });
    }
    else if (commandName === 'kostka') {
        await interaction.deferReply();
        const stawka = interaction.options.getInteger('stawka', true);
        const userId = interaction.user.id;
        const currentBalance = await getBalance(userId);

        if (stawka <= 0 || currentBalance < stawka) {
            await interaction.editReply({ content: `❌ Nie masz tylu punktów lub stawka jest błędna!` });
            return;
        }

        const pRoll = Math.floor(Math.random() * 6) + 1;
        const bRoll = Math.floor(Math.random() * 6) + 1;

        if (pRoll > bRoll) {
            await addPoints(userId, stawka);
            await interaction.editReply({ content: `🎲 Wyrzuciłeś **${pRoll}**, bot **${bRoll}**. **Wygrywasz +${stawka} Coins!**` });
        } else if (pRoll < bRoll) {
            await addPoints(userId, -stawka);
            await interaction.editReply({ content: `🎲 Wyrzuciłeś **${pRoll}**, bot **${bRoll}**. **Przegrywasz -${stawka} Coins!**` });
        } else {
            await interaction.editReply({ content: `🎲 Remis (${pRoll}). Punkty bez zmian.` });
        }
    }
    else if (commandName === 'moneta') {
        await interaction.deferReply();
        const wybor = interaction.options.getString('wybor', true);
        const stawka = interaction.options.getInteger('stawka', true);
        const userId = interaction.user.id;
        const currentBalance = await getBalance(userId);

        if (stawka <= 0 || currentBalance < stawka) {
            await interaction.editReply({ content: `❌ Błędna stawka lub brak środków!` });
            return;
        }

        const wynik = Math.random() < 0.5 ? 'orzel' : 'reszka';
        if (wybor === wynik) {
            await addPoints(userId, stawka);
            await interaction.editReply({ content: `🪙 Wypadł **${wynik.toUpperCase()}**! Zyskujesz **+${stawka} Coins**!` });
        } else {
            await addPoints(userId, -stawka);
            await interaction.editReply({ content: `🪙 Wypadł **${wynik.toUpperCase()}**! Tracisz **-${stawka} Coins**!` });
        }
    }
    else if (commandName === 'slot') {
        await interaction.deferReply();
        const stawka = interaction.options.getInteger('stawka', true);
        const userId = interaction.user.id;
        const currentBalance = await getBalance(userId);

        if (stawka <= 0 || currentBalance < stawka) {
            await interaction.editReply({ content: `❌ Brak środków na grę!` });
            return;
        }

        const symbole = ['🍒', '🍋', '🔔', '⭐', '💎'];
        const s1 = symbole[Math.floor(Math.random() * symbole.length)];
        const s2 = symbole[Math.floor(Math.random() * symbole.length)];
        const s3 = symbole[Math.floor(Math.random() * symbole.length)];

        let wygrana = 0;
        let opis = '';
        if (s1 === s2 && s2 === s3) {
            wygrana = stawka * 4; // zysk 4x (łącznie 5x)
            await addPoints(userId, wygrana);
            opis = `🎰 **JACKPOT!** Wygrywasz **+${stawka * 5} Coins**!`;
        } else if (s1 === s2 || s2 === s3 || s1 === s3) {
            opis = `🎰 Dwa symbole takie same! Zwrot stawki.`;
        } else {
            await addPoints(userId, -stawka);
            opis = `🎰 Przegrywasz **-${stawka} Coins**!`;
        }

        const newBal = await getBalance(userId);
        const embedSlot = new EmbedBuilder().setColor(0xFF4500).setTitle('🎰 Slot').setDescription(`**[ ${s1} | ${s2} | ${s3} ]**\n\n${opis}\n💰 Saldo: **${newBal} Coins**`);
        await interaction.editReply({ embeds: [embedSlot] });
    }
    else if (commandName === 'quiz') {
        await interaction.deferReply();
        const q = quizQuestions[Math.floor(Math.random() * quizQuestions.length)];
        await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('🧠 Szybki Quiz!').setDescription(`**${q.question}**\n*Masz 30 sekund!*`).setFooter({ text: 'Nagroda: 50 Coins' })] });

        const filter = (m: any) => !m.author.bot;
        const collector = interaction.channel?.createMessageCollector({ filter, time: 30000, max: 1 });

        collector?.on('collect', async m => {
            if (m.content.toLowerCase().trim() === q.answer.toLowerCase()) {
                await addPoints(m.author.id, 50);
                await m.reply(`🎉 Brawo <@${m.author.id}>! Zyskujesz \`+50\` Coins!`);
            } else {
                await m.channel?.send(`❌ Zła odpowiedź. Prawidłowa to: **${q.answer}**.`);
            }
        });
    }
    else if (commandName === 'zmiennemuzyke') {
        await interaction.deferReply({ ephemeral: true });
        const stacja = interaction.options.getString('stacja', true);
        const guild = interaction.guild;
        if (!guild) return;

        const voiceChannel = guild.channels.cache.find(ch => ch.isVoiceBased() && ch.name === CHANNEL_GLOSOWY);
        if (!voiceChannel) {
            await interaction.editReply({ content: `❌ Nie znaleziono kanału radiowego!` });
            return;
        }

        const connection = joinVoiceChannel({ channelId: voiceChannel.id, guildId: guild.id, adapterCreator: guild.voiceAdapterCreator });
        await playStream(stacja, connection);
        await interaction.editReply({ content: `🎶 Zmieniono stację na: **${stacja.toUpperCase()}**!` });
    }
    else {
        await interaction.deferReply({ ephemeral: true });
        const channel = interaction.guild?.channels.cache.find(ch => ch.isTextBased() && 'name' in ch && ch.name === CHANNEL_OGLOSZENIA) as TextChannel;
        if (commandName === 'testogloszenia' && channel) {
            await channel.send({ embeds: [createOgłoszenieEmbed()] });
            await interaction.editReply({ content: 'Wysłano testowe ogłoszenie!' });
        } else {
            await interaction.editReply({ content: 'Wykonano.' });
        }
    }
});

client.login(token);
