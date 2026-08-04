import { Client, GatewayIntentBits, TextChannel, REST, Routes, SlashCommandBuilder, EmbedBuilder, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { WebcastPushConnection } from 'tiktok-live-connector';
import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } from '@discordjs/voice';
import ffmpeg from 'ffmpeg-static';
import * as fs from 'fs';
import * as path from 'path';

if (ffmpeg) {
    process.env.FFMPEG_PATH = ffmpeg;
}

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) throw new Error("Brak tokena Discord bota!");

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

// --- SYSTEM EKONOMII ---
interface EconomyData {
    [userId: string]: {
        balance: number;
        lastDaily?: number;
    };
}

const ECONOMY_FILE = path.join(__dirname, 'economy.json');

function loadEconomy(): EconomyData {
    try {
        if (fs.existsSync(ECONOMY_FILE)) {
            const data = fs.readFileSync(ECONOMY_FILE, 'utf-8');
            return JSON.parse(data);
        }
    } catch (err) {
        console.error('Błąd ładowania ekonomii:', err);
    }
    return {};
}

function saveEconomy(data: EconomyData) {
    try {
        fs.writeFileSync(ECONOMY_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Błąd zapisu ekonomii:', err);
    }
}

function addPoints(userId: string, amount: number) {
    const eco = loadEconomy();
    if (!eco[userId]) {
        eco[userId] = { balance: 0 };
    }
    eco[userId].balance += amount;
    saveEconomy(eco);
    return eco[userId].balance;
}

function getBalance(userId: string): number {
    const eco = loadEconomy();
    return eco[userId] ? eco[userId].balance : 0;
}

function isAuthorized(userId: string): boolean {
    return userId === MOJE_DISCORD_ID || userId === DRUGI_ADMIN_ID;
}

function generateTopkaEmbed(): EmbedBuilder {
    const eco = loadEconomy();
    const sorted = Object.entries(eco)
        .sort((a, b) => b[1].balance - a[1].balance)
        .slice(0, 10);

    const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('🏆 TOP 10 - Ranking PJN-Coins')
        .setDescription('Ranking jest automatycznie aktualizowany co 10 minut na podstawie aktywności (pisanie oraz czas na kanałach głosowych).')
        .setTimestamp();

    if (sorted.length === 0) {
        embed.addFields({ name: 'Status', value: 'Brak danych w rankingu.' });
    } else {
        let desc = '';
        sorted.forEach(([userId, data], index) => {
            const medals = ['🥇', '🥈', '🥉'];
            const prefix = medals[index] || `**${index + 1}.**`;
            desc += `${prefix} <@${userId}> — \`${data.balance} Coins\`\n`;
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
            { name: '💰 Zasady i wygrane:', value: '• **3 takie same symbole (Jackpot):** Wygrywasz aż **5-krotność** swojej stawki! ($5x$)\n• **2 takie same symbole:** Zwrot postawionej stawki (bilans bez zmian).\n• **Brak dopasowań:** Przegrywasz postawioną stawkę.' },
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
    new SlashCommandBuilder().setName('balans').setDescription('Sprawdź swoje punkty (PJN-Coins)'),
    new SlashCommandBuilder().setName('daily').setDescription('Odbierz codzienną dawkę punktów!'),
    new SlashCommandBuilder().setName('topka').setDescription('Zobacz ranking najbogatszych użytkowników serwera'),
    new SlashCommandBuilder().setName('quiz').setDescription('Zacznij szybki quiz z wiedzy o nagrodę punktową!'),
    new SlashCommandBuilder()
        .setName('poker')
        .setDescription('Zagraj w pokera wieloosobowego o PJN-Coins!')
        .addUserOption(option =>
            option.setName('przeciwnik')
                  .setDescription('Wybierz gracza, z którym chcesz zagrać')
                  .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('stawka')
                  .setDescription('Ile PJN-Coins stawiasz na szali?')
                  .setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('rozdaj-wszystkim')
        .setDescription('Rozdaje określoną ilość PJN-Coins każdemu użytkownikowi i powiadamia ich na PW (Tylko Admin)')
        .addIntegerOption(option =>
            option.setName('ilosc')
                  .setDescription('Ile punktów dać każdemu?')
                  .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('powod')
                  .setDescription('Powód przyznania punktów (opcjonalnie)')
                  .setRequired(false)
        ),
    new SlashCommandBuilder()
        .setName('set-tiktok-live')
        .setDescription('Ręcznie ustawia status TikTok Live (online/offline)')
        .addStringOption(option =>
            option.setName('status')
                  .setDescription('Wybierz status')
                  .setRequired(true)
                  .addChoices(
                      { name: 'ONLINE', value: 'online' },
                      { name: 'OFFLINE', value: 'offline' }
                  )
        ),
    new SlashCommandBuilder()
        .setName('odpalstream')
        .setDescription('Jedno kliknięcie: zmienia status kanału na ONLINE i wysyła ogłoszenie o live!')
        .addStringOption(option =>
            option.setName('platforma')
                  .setDescription('Wybierz platformę streamu')
                  .setRequired(true)
                  .addChoices(
                      { name: 'TikTok', value: 'tiktok' },
                      { name: 'Kick', value: 'kick' }
                  )
        ),
    new SlashCommandBuilder()
        .setName('wylaczstream')
        .setDescription('Zmienia status wybranej platformy na OFFLINE i aktualizuje statystyki')
        .addStringOption(option =>
            option.setName('platforma')
                  .setDescription('Wybierz platformę streamu')
                  .setRequired(true)
                  .addChoices(
                      { name: 'TikTok', value: 'tiktok' },
                      { name: 'Kick', value: 'kick' }
                  )
        ),
    new SlashCommandBuilder()
        .setName('dodajpunkty')
        .setDescription('Dodaje punkty Tobie lub wybranej osobie (tylko właściciel)')
        .addIntegerOption(option => 
            option.setName('ilosc')
                  .setDescription('Ile punktów chcesz dodać?')
                  .setRequired(true)
        )
        .addUserOption(option =>
            option.setName('uzytkownik')
                  .setDescription('Komu dodać? (Zostaw puste, jeśli sobie)')
                  .setRequired(false)
        ),
    new SlashCommandBuilder()
        .setName('kostka')
        .setDescription('Zagraj w rzut kostką o punkty!')
        .addIntegerOption(option => 
            option.setName('stawka')
                  .setDescription('Ile punktów chcesz postawić?')
                  .setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('moneta')
        .setDescription('Zagraj w orzeł czy reszka!')
        .addStringOption(option =>
            option.setName('wybor')
                  .setDescription('Wybierz: orzel lub reszka')
                  .setRequired(true)
                  .addChoices(
                      { name: 'Orzeł', value: 'orzel' },
                      { name: 'Reszka', value: 'reszka' }
                  )
        )
        .addIntegerOption(option => 
            option.setName('stawka')
                  .setDescription('Ile punktów stawiasz?')
                  .setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('slot')
        .setDescription('Zagraj w jednorękiego bandytę (Slot Machine)!')
        .addIntegerOption(option => 
            option.setName('stawka')
                  .setDescription('Ile punktów stawiasz?')
                  .setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('zmiennemuzyke')
        .setDescription('Wybierz stację radiową')
        .addStringOption(option => 
            option.setName('stacja')
                  .setDescription('Wpisz: eska, rock lub rmf')
                  .setRequired(true)
        ),
].map(command => command.toJSON());

function createOgłoszenieEmbed() {
    return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🌟 Witamy na PJN Server!')
        .setDescription('Cieszymy się, że jesteś częścią naszej społeczności! Pamiętaj, aby regularnie wspierać nasze projekty i śledzić oficjalne profile streamingowe:')
        .addFields(
            { name: '🔗 TikTok', value: '[tiktok.com/@languspjn](https://www.tiktok.com/@languspjn)', inline: true },
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
            { name: '🔗 Oglądaj tutaj', value: '[tiktok.com/@languspjn/live](https://www.tiktok.com/@languspjn/live)', inline: true }
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
        if (memberChannel) {
            await memberChannel.setName(`👥 • Członkowie: ${guild.memberCount}`);
        }

        const tiktokChannel = guild.channels.cache.find((ch: any) => ch.isVoiceBased() && ch.name.includes('TikTok Live:'));
        if (tiktokChannel) {
            const name = isTikTokLive ? `🔴 • TikTok Live: ONLINE` : `🔴 • TikTok Live: OFFLINE`;
            if (tiktokChannel.name !== name) {
                await tiktokChannel.setName(name);
            }
        }

        const kickChannel = guild.channels.cache.find((ch: any) => ch.isVoiceBased() && ch.name.includes('Kick Live:'));
        if (kickChannel) {
            const name = isKickLive ? `🟢 • Kick Live: ONLINE (${currentKickViewers})` : `🟢 • Kick Live: OFFLINE`;
            if (kickChannel.name !== name) {
                await kickChannel.setName(name);
            }
        }
    } catch (err) {
        console.error('Błąd aktualizacji nazw statystyk:', err);
    }
}

client.once('ready', async () => {
    console.log(`Zalogowano jako ${client.user?.tag}!`);

    const rest = new REST({ version: '10' }).setToken(token);
    try {
        await rest.put(Routes.applicationGuildCommands(client.user!.id, GUILD_ID), { body: commands });
        console.log('Pomyślnie zarejestrowano komendy na serwerze!');
    } catch (error) {
        console.error('Błąd rejestracji komend:', error);
    }

    for (const [_, guild] of client.guilds.cache) {
        try {
            let infoChannel = guild.channels.cache.find(ch => ch.isTextBased() && 'name' in ch && ch.name === CHANNEL_GRY_INFO) as TextChannel;
            if (!infoChannel) {
                infoChannel = await guild.channels.create({
                    name: CHANNEL_GRY_INFO,
                    type: ChannelType.GuildText,
                    topic: 'Informacje o grach, kasynie i komendach PJN-Coins'
                }) as TextChannel;
            }
            if (infoChannel) {
                const messages = await infoChannel.messages.fetch({ limit: 5 });
                const botMsg = messages.find(m => m.author.id === client.user?.id);
                const infoEmbed = createGryInfoEmbed();
                if (botMsg) {
                    await botMsg.edit({ embeds: [infoEmbed] });
                } else {
                    await infoChannel.send({ embeds: [infoEmbed] });
                }
            }

            let kasynoChannel = guild.channels.cache.find(ch => ch.isTextBased() && 'name' in ch && ch.name === CHANNEL_KASYNO) as TextChannel;
            if (kasynoChannel) {
                const kasynoMessages = await kasynoChannel.messages.fetch({ limit: 5 });
                const kasynoBotMsg = kasynoMessages.find(m => m.author.id === client.user?.id);
                const kasynoEmbed = createKasynoInfoEmbed();
                if (kasynoBotMsg) {
                    await kasynoBotMsg.edit({ embeds: [kasynoEmbed] });
                } else {
                    await kasynoChannel.send({ embeds: [kasynoEmbed] });
                }
            }

            let slotChannel = guild.channels.cache.find(ch => ch.isTextBased() && 'name' in ch && ch.name === CHANNEL_SLOT) as TextChannel;
            if (!slotChannel) {
                slotChannel = await guild.channels.create({
                    name: CHANNEL_SLOT,
                    type: ChannelType.GuildText,
                    topic: 'Kanał dedykowany do gry w Jednorękiego Bandytę (/slot)'
                }) as TextChannel;
            }
            if (slotChannel) {
                const slotMessages = await slotChannel.messages.fetch({ limit: 5 });
                const slotBotMsg = slotMessages.find(m => m.author.id === client.user?.id);
                const slotEmbed = createSlotInfoEmbed();
                if (slotBotMsg) {
                    await slotBotMsg.edit({ embeds: [slotEmbed] });
                } else {
                    await slotChannel.send({ embeds: [slotEmbed] });
                }
            }

            let pokerChannel = guild.channels.cache.find(ch => ch.isTextBased() && 'name' in ch && ch.name === CHANNEL_POKER) as TextChannel;
            if (pokerChannel) {
                const pokerMessages = await pokerChannel.messages.fetch({ limit: 5 });
                const pokerBotMsg = pokerMessages.find(m => m.author.id === client.user?.id);
                const pokerEmbed = createPokerInfoEmbed();
                if (pokerBotMsg) {
                    await pokerBotMsg.edit({ embeds: [pokerEmbed] });
                } else {
                    await pokerChannel.send({ embeds: [pokerEmbed] });
                }
            }
        } catch (err) {
            console.error('Błąd konfiguracji kanałów informacyjnych gier:', err);
        }
    }

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
                    if (channel) {
                        await channel.send({ content: '@everyone', embeds: [createLiveEmbed(currentViewers)] });
                    }
                }
            } else {
                isTikTokLive = false;
                currentViewers = 0;
            }
            client.guilds.cache.forEach(guild => updateServerStats(guild));
        } catch (err) {
            isTikTokLive = false;
            currentViewers = 0;
            client.guilds.cache.forEach(guild => updateServerStats(guild));
        }
    }, 2 * 60 * 1000);

    setInterval(async () => {
        try {
            const response = await fetch(`https://kick.com/api/v2/channels/${KICK_USER}`, {
                headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
            });
            if (response.ok) {
                const data = await response.json() as any;
                const livestream = data.livestream;
                if (livestream) {
                    currentKickViewers = livestream.viewer_count || 0;
                    if (!isKickLive) {
                        isKickLive = true;
                        const channel = client.channels.cache.find(ch => ch.isTextBased() && 'name' in ch && ch.name === CHANNEL_OGLOSZENIA) as TextChannel;
                        if (channel) {
                            await channel.send({ content: '@everyone', embeds: [createKickLiveEmbed(currentKickViewers)] });
                        }
                    }
                } else {
                    isKickLive = false;
                    currentKickViewers = 0;
                }
                client.guilds.cache.forEach(guild => updateServerStats(guild));
            }
        } catch (err) {
            console.error('Błąd Kicka:', err);
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
                    topChannel = await guild.channels.create({
                        name: CHANNEL_TOPKA,
                        type: ChannelType.GuildText,
                        topic: 'Automatyczny ranking najbogatszych użytkowników PJN Server'
                    }) as TextChannel;
                }

                if (topChannel) {
                    const messages = await topChannel.messages.fetch({ limit: 5 });
                    const botMessage = messages.find(m => m.author.id === client.user?.id);
                    const embed = generateTopkaEmbed();

                    if (botMessage) {
                        await botMessage.edit({ embeds: [embed] });
                    } else {
                        await topChannel.send({ embeds: [embed] });
                    }
                }
            } catch (err) {
                console.error('Błąd aktualizacji automatycznej topki:', err);
            }
        }
    }, 10 * 60 * 1000);

    setTimeout(() => {
        client.guilds.cache.forEach(async guild => {
            updateServerStats(guild);
            const voiceChannel = guild.channels.cache.find(
                ch => ch.isVoiceBased() && ch.name === CHANNEL_GLOSOWY
            );

            if (voiceChannel) {
                try {
                    const connection = joinVoiceChannel({
                        channelId: voiceChannel.id,
                        guildId: guild.id,
                        adapterCreator: guild.voiceAdapterCreator,
                    });

                    await playStream('eska', connection);

                    audioPlayer.on(AudioPlayerStatus.Idle, async () => {
                        await playStream('eska', connection);
                    });
                } catch (err) {
                    console.error('Błąd łączenia z kanałem głosu:', err);
                }
            }
        });
    }, 3000);

    setInterval(async () => {
        const channel = client.channels.cache.find(ch => ch.isTextBased() && 'name' in ch && ch.name === CHANNEL_OGLOSZENIA) as TextChannel;
        if (channel) {
            try {
                await channel.send({ embeds: [createOgłoszenieEmbed()] });
            } catch (err) {
                console.error('Błąd automatycznego ogłoszenia:', err);
            }
        }
    }, 60 * 60 * 1000);
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.guild) return;

    addPoints(message.author.id, 1);

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
        } catch (err) {
            console.error('Błąd podczas wysyłania odpowiedzi na duszki:', err);
        }
    }
});

// ZMODYFIKOWane: Automatyczne przyznawanie 200 punktów i powitanie z nowymi kanałami
client.on('guildMemberAdd', async member => {
    updateServerStats(member.guild);

    // Przyznanie 200 PJN-Coins na start
    addPoints(member.id, 200);

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

        await channel.send({ 
            content: contentMessage, 
            embeds: [embedPowitanie] 
        });
    }
});

client.on('guildMemberRemove', member => {
    updateServerStats(member.guild);
});

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
            addPoints(id1, pula / 2);
            addPoints(id2, pula / 2);
            await interaction.update({ content: `🤝 **Remis w pokerze!** Pula została zwrócona na konta graczy.`, embeds: [], components: [] });
            return;
        }

        addPoints(wygranyId, pula);

        await interaction.update({
            content: `🏆 **Rozstrzygnięcie pokera!**\nZwycięzcą zostaje <@${wygranyId}> zgarniając całą pulę: **${pula} PJN-Coins**! 🎉`,
            embeds: [],
            components: []
        });
        return;
    }

    if (!interaction.isChatInputCommand()) return;
    const { commandName } = interaction;
    const currentChannelName = interaction.channel && 'name' in interaction.channel ? interaction.channel.name : '';

    if (['kostka', 'moneta', 'quiz', 'daily'].includes(commandName)) {
        if (currentChannelName !== CHANNEL_KASYNO) {
            await interaction.reply({ content: `❌ Tę komendę możesz wpisać tylko na kanale <#${interaction.guild?.channels.cache.find(c => c.name === CHANNEL_KASYNO)?.id || CHANNEL_KASYNO}>!`, ephemeral: true });
            return;
        }
    }

    if (commandName === 'slot') {
        if (currentChannelName !== CHANNEL_SLOT) {
            await interaction.reply({ content: `❌ Komendy \`/slot\` możesz używać wyłącznie na dedykowanym kanale <#${interaction.guild?.channels.cache.find(c => c.name === CHANNEL_SLOT)?.id || CHANNEL_SLOT}>!`, ephemeral: true });
            return;
        }
    }

    if (commandName === 'poker') {
        if (currentChannelName !== CHANNEL_POKER) {
            await interaction.reply({ content: `❌ Komendy \`/poker\` możesz używać wyłącznie na kanale <#${interaction.guild?.channels.cache.find(c => c.name === CHANNEL_POKER)?.id || CHANNEL_POKER}>!`, ephemeral: true });
            return;
        }

        const przeciwnik = interaction.options.getUser('przeciwnik', true);
        const stawka = interaction.options.getInteger('stawka', true);
        const gracz1 = interaction.user;

        if (przeciwnik.bot || przeciwnik.id === gracz1.id) {
            await interaction.reply({ content: '❌ Nie możesz zagrać sam ze sobą lub z botem!', ephemeral: true });
            return;
        }

        const balans1 = getBalance(gracz1.id);
        const balans2 = getBalance(przeciwnik.id);

        if (balans1 < stawka || balans2 < stawka) {
            await interaction.reply({ content: `❌ Zarówno Ty, jak i przeciwnik musicie posiadać przynajmniej **${stawka} PJN-Coins** na koncie!`, ephemeral: true });
            return;
        }

        addPoints(gracz1.id, -stawka);
        addPoints(przeciwnik.id, -stawka);
        const pula = stawka * 2;

        const kolory = ['♠️', '♥️', '♦️', '♣️'];
        const figury = [
            { name: '2', val: 2 }, { name: '3', val: 3 }, { name: '4', val: 4 }, 
            { name: '5', val: 5 }, { name: '6', val: 6 }, { name: '7', val: 7 }, 
            { name: '8', val: 8 }, { name: '9', val: 9 }, { name: '10', val: 10 }, 
            { name: 'J', val: 11 }, { name: 'Q', val: 12 }, { name: 'K', val: 13 }, { name: 'A', val: 14 }
        ];

        function losujKarte() {
            const f = figury[Math.floor(Math.random() * figury.length)];
            const k = kolory[Math.floor(Math.random() * kolory.length)];
            return { nazwa: `${f.name}${k}`, val: f.val };
        }

        const karty1 = [losujKarte(), losujKarte()];
        const karty2 = [losujKarte(), losujKarte()];

        const embed = new EmbedBuilder()
            .setColor(0xE67E22)
            .setTitle('🃏 Pojedynek Pokerowy')
            .setDescription(`Gracze: <@${gracz1.id}> kontra <@${przeciwnik.id}>\nStawka każdego: **${stawka} Coins**\nŁączna pula: **${pula} Coins**\n\nKarty zostały rozdane na PW! Kliknij przycisk poniżej, aby odsłonić karty i rozstrzygnąć rozdanie.`);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`poker_sprawdz_${gracz1.id}_${przeciwnik.id}_${pula}`)
                .setLabel('Odkryj karty i wyłoń zwycięzcę!')
                .setStyle(ButtonStyle.Success)
        );

        try {
            await gracz1.send(`Twoje karty w pokerze przeciwko <@${przeciwnik.id}>:\n**1.** ${karty1[0].nazwa}\n**2.** ${karty1[1].nazwa}`);
            await przeciwnik.send(`Twoje karty w pokerze przeciwko <@${gracz1.id}>:\n**1.** ${karty2[0].nazwa}\n**2.** ${karty2[1].nazwa}`);
        } catch (err) {
            addPoints(gracz1.id, stawka);
            addPoints(przeciwnik.id, stawka);
            await interaction.reply({ content: '❌ Jeden z graczy ma zablokowane wiadomości prywatne (DM)! Odblokuj je, aby zagrać. Wpisowe zostało zwrócone.', ephemeral: true });
            return;
        }

        await interaction.reply({ embeds: [embed], components: [row] });
        return;
    }

    if (commandName === 'rozdaj-wszystkim') {
        if (!isAuthorized(interaction.user.id)) {
            await interaction.reply({ content: '❌ Nie masz uprawnień do używania tej komendy!', ephemeral: true });
            return;
        }

        await interaction.deferReply({ ephemeral: true });
        const ilosc = interaction.options.getInteger('ilosc', true);
        const powod = interaction.options.getString('powod') || 'Brak powiadomienia';
        const guild = interaction.guild;

        if (!guild) {
            await interaction.editReply({ content: '❌ Komenda musi być użyta na serwerze!' });
            return;
        }

        await guild.members.fetch();
        let sukcesy = 0;
        let bledyDM = 0;

        for (const [_, member] of guild.members.cache) {
            if (!member.user.bot) {
                addPoints(member.id, ilosc);
                sukcesy++;

                try {
                    await member.send({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(0x00FF00)
                                .setTitle('🎁 Otrzymałeś PJN-Coins!')
                                .setDescription(`Administrator **${interaction.user.username}** rozdał punkty wszystkim użytkownikom na serwerze **${guild.name}**!`)
                                .addFields(
                                    { name: '💰 Otrzymana kwota', value: `+${ilosc} PJN-Coins`, inline: true },
                                    { name: '📌 Powód', value: powod, inline: true }
                                )
                                .setTimestamp()
                        ]
                    });
                } catch (err) {
                    bledyDM++;
                }
            }
        }

        await interaction.editReply({ 
            content: `✅ Rozdano po **${ilosc} PJN-Coins** dla **${sukcesy}** użytkowników!\n*(Wiadomości prywatne dostarczono pomyślnie do ${sukcesy - bledyDM} osób. ${bledyDM} osób miało zablokowane PW).*` 
        });
        return;
    }

    if (commandName === 'set-tiktok-live') {
        if (!isAuthorized(interaction.user.id)) {
            await interaction.reply({ content: '❌ Nie masz uprawnień do używania tej komendy!', ephemeral: true });
            return;
        }

        await interaction.deferReply({ ephemeral: true });
        const status = interaction.options.getString('status', true);
        
        if (status === 'online') {
            isTikTokLive = true;
            const channel = interaction.guild?.channels.cache.find(ch => ch.isTextBased() && 'name' in ch && ch.name === CHANNEL_OGLOSZENIA) as TextChannel;
            if (channel) {
                await channel.send({ content: '@everyone', embeds: [createLiveEmbed()] });
            }
            await interaction.editReply({ content: '✅ Status TikTok Live zmieniony na **ONLINE** dla @languspjn! Wysłano powiadomienie na ogłoszenia.' });
        } else {
            isTikTokLive = false;
            await interaction.editReply({ content: '✅ Status TikTok Live zmieniony na **OFFLINE**!' });
        }
        
        if (interaction.guild) {
            updateServerStats(interaction.guild);
        }
    }
    else if (commandName === 'odpalstream') {
        if (!isAuthorized(interaction.user.id)) {
            await interaction.reply({ content: '❌ Nie masz uprawnień do używania tej komendy!', ephemeral: true });
            return;
        }

        await interaction.deferReply({ ephemeral: true });
        const platforma = interaction.options.getString('platforma', true);
        const ogloszeniaChannel = interaction.guild?.channels.cache.find(ch => ch.isTextBased() && 'name' in ch && ch.name === CHANNEL_OGLOSZENIA) as TextChannel;

        if (!ogloszeniaChannel) {
            await interaction.editReply({ content: '❌ Nie znaleziono kanału z ogłoszeniami!' });
            return;
        }

        if (platforma === 'tiktok') {
            isTikTokLive = true;
            await ogloszeniaChannel.send({ content: '@everyone', embeds: [createLiveEmbed(currentViewers)] });
            await interaction.editReply({ content: '🚀 Pomyślnie odpalono stream! Zmieniono status kanału na **TikTok Live: ONLINE** oraz wysłano powiadomienie na ogłoszenia.' });
        } else if (platforma === 'kick') {
            isKickLive = true;
            await ogloszeniaChannel.send({ content: '@everyone', embeds: [createKickLiveEmbed(currentKickViewers)] });
            await interaction.editReply({ content: '🚀 Pomyślnie odpalono stream! Zmieniono status kanału na **Kick Live: ONLINE** oraz wysłano powiadomienie na ogłoszenia.' });
        }

        if (interaction.guild) {
            updateServerStats(interaction.guild);
        }
    }
    else if (commandName === 'wylaczstream') {
        if (!isAuthorized(interaction.user.id)) {
            await interaction.reply({ content: '❌ Nie masz uprawnień do używania tej komendy!', ephemeral: true });
            return;
        }

        await interaction.deferReply({ ephemeral: true });
        const platforma = interaction.options.getString('platforma', true);

        if (platforma === 'tiktok') {
            isTikTokLive = false;
            currentViewers = 0;
            await interaction.editReply({ content: '🛑 Pomyślnie zmieniono status kanału na **TikTok Live: OFFLINE**.' });
        } else if (platforma === 'kick') {
            isKickLive = false;
            currentKickViewers = 0;
            await interaction.editReply({ content: '🛑 Pomyślnie zmieniono status kanału na **Kick Live: OFFLINE**.' });
        }

        if (interaction.guild) {
            updateServerStats(interaction.guild);
        }
    }
    else if (commandName === 'balans') {
        await interaction.deferReply({ ephemeral: true });
        const points = getBalance(interaction.user.id);
        await interaction.editReply({ content: `💰 Posiadasz aktualnie **${points}** PJN-Coins!` });
    }
    else if (commandName === 'daily') {
        await interaction.deferReply({ ephemeral: true });
        const eco = loadEconomy();
        const userId = interaction.user.id;
        const now = Date.now();
        const cooldown = 24 * 60 * 60 * 1000;

        if (!eco[userId]) eco[userId] = { balance: 0 };

        if (eco[userId].lastDaily && now - eco[userId].lastDaily < cooldown) {
            const timeLeft = Math.ceil((cooldown - (now - eco[userId].lastDaily)) / (1000 * 60 * 60));
            await interaction.editReply({ content: `⏳ Odbierałeś już dzisiaj nagrodę! Następna za około **${timeLeft} godz.**` });
            return;
        }

        eco[userId].balance += 100;
        eco[userId].lastDaily = now;
        saveEconomy(eco);

        await interaction.editReply({ content: `🎉 Odebrałeś codzienną nagrodę w wysokości **100 PJN-Coins**!` });
    }
    else if (commandName === 'topka') {
        await interaction.deferReply();
        await interaction.editReply({ embeds: [generateTopkaEmbed()] });
    }
    else if (commandName === 'dodajpunkty') {
        if (!isAuthorized(interaction.user.id)) {
            await interaction.reply({ content: '❌ Nie masz uprawnień do używania tej komendy!', ephemeral: true });
            return;
        }

        await interaction.deferReply({ ephemeral: true });
        const ilosc = interaction.options.getInteger('ilosc', true);
        const docelowyUzytkownik = interaction.options.getUser('uzytkownik') || interaction.user;

        const nowyBalans = addPoints(docelowyUzytkownik.id, ilosc);

        if (docelowyUzytkownik.id === interaction.user.id) {
            await interaction.editReply({ content: `✅ Dodano pomyślnie **${ilosc}** PJN-Coins do Twojego konta! Twój balans: **${nowyBalans}**` });
        } else {
            await interaction.editReply({ content: `✅ Dodano pomyślnie **${ilosc}** PJN-Coins dla użytkownika <@${docelowyUzytkownik.id}>! Nowy balans tej osoby: **${nowyBalans}**` });
        }
    }
    else if (commandName === 'kostka') {
        await interaction.deferReply();
        const stawka = interaction.options.getInteger('stawka', true);
        const userId = interaction.user.id;
        const currentBalance = getBalance(userId);

        if (stawka <= 0) {
            await interaction.editReply({ content: '❌ Stawka musi być większa od 0!' });
            return;
        }

        if (currentBalance < stawka) {
            await interaction.editReply({ content: `❌ Nie masz tylu punktów! Twój balans to: **${currentBalance} Coins**.` });
            return;
        }

        const playerRoll = Math.floor(Math.random() * 6) + 1;
        const botRoll = Math.floor(Math.random() * 6) + 1;
        const eco = loadEconomy();

        if (playerRoll > botRoll) {
            eco[userId].balance += stawka;
            saveEconomy(eco);
            await interaction.editReply({ content: `🎲 Wyrzuciłeś **${playerRoll}**, a bot **${botRoll}**. **Wygrywasz!** Zyskujesz \`+${stawka}\` Coins. Balans: **${eco[userId].balance}**` });
        } else if (playerRoll < botRoll) {
            eco[userId].balance -= stawka;
            saveEconomy(eco);
            await interaction.editReply({ content: `🎲 Wyrzuciłeś **${playerRoll}**, a bot **${botRoll}**. **Przegrywasz!** Tracisz \`-${stawka}\` Coins. Balans: **${eco[userId].balance}**` });
        } else {
            await interaction.editReply({ content: `🎲 Remis! Wszyscy wyrzucili **${playerRoll}**. Punkty bez zmian.` });
        }
    }
    else if (commandName === 'moneta') {
        await interaction.deferReply();
        const wybor = interaction.options.getString('wybor', true);
        const stawka = interaction.options.getInteger('stawka', true);
        const userId = interaction.user.id;
        const currentBalance = getBalance(userId);

        if (stawka <= 0) {
            await interaction.editReply({ content: '❌ Stawka musi być większa od 0!' });
            return;
        }

        if (currentBalance < stawka) {
            await interaction.editReply({ content: `❌ Nie masz tylu punktów! Twój balans to: **${currentBalance} Coins**.` });
            return;
        }

        const wynikMonety = Math.random() < 0.5 ? 'orzel' : 'reszka';
        const eco = loadEconomy();

        if (wybor === wynikMonety) {
            eco[userId].balance += stawka;
            saveEconomy(eco);
            await interaction.editReply({ content: `🪙 Wypadł **${wynikMonety.toUpperCase()}**! Trafiłeś! Zyskujesz \`+${stawka}\` Coins. Balans: **${eco[userId].balance}**` });
        } else {
            eco[userId].balance -= stawka;
            saveEconomy(eco);
            await interaction.editReply({ content: `🪙 Wypadł **${wynikMonety.toUpperCase()}**! Niestety nie trafiłeś. Tracisz \`-${stawka}\` Coins. Balans: **${eco[userId].balance}**` });
        }
    }
    else if (commandName === 'slot') {
        await interaction.deferReply();
        const stawka = interaction.options.getInteger('stawka', true);
        const userId = interaction.user.id;
        const currentBalance = getBalance(userId);

        if (stawka <= 0) {
            await interaction.editReply({ content: '❌ Stawka musi być większa od 0!' });
            return;
        }

        if (currentBalance < stawka) {
            await interaction.editReply({ content: `❌ Nie masz tylu punktów! Twój balans to: **${currentBalance} Coins**.` });
            return;
        }

        const symbole = ['🍒', '🍋', '🔔', '⭐', '💎'];
        const s1 = symbole[Math.floor(Math.random() * symbole.length)];
        const s2 = symbole[Math.floor(Math.random() * symbole.length)];
        const s3 = symbole[Math.floor(Math.random() * symbole.length)];

        const eco = loadEconomy();
        let wygrana = 0;
        let wynikTekst = '';

        if (s1 === s2 && s2 === s3) {
            wygrana = stawka * 5;
            eco[userId].balance += (wygrana - stawka);
            wynikTekst = `🎰 **JACKPOT!** Wszystkie symbole takie same! Wygrywasz **+${wygrana} Coins**! 🎉`;
        } else if (s1 === s2 || s2 === s3 || s1 === s3) {
            wygrana = stawka;
            wynikTekst = `🎰 Dwa symbole są takie same! Zwrot stawki (\`0 Coins\` bilans bez zmian).`;
        } else {
            eco[userId].balance -= stawka;
            wynikTekst = `🎰 Niestety nic nie trafiłeś! Tracisz \`-${stawka}\` Coins. 😢`;
        }
        saveEconomy(eco);

        const embedSlot = new EmbedBuilder()
            .setColor(0xFF4500)
            .setTitle('🎰 Jednoręki Bandyta (Wynik losowania)')
            .setDescription(`**[ ${s1} | ${s2} | ${s3} ]**\n\n${wynikTekst}\n💰 Twój aktualny balans: **${eco[userId].balance} Coins**`);

        await interaction.editReply({ embeds: [embedSlot] });
    }
    else if (commandName === 'quiz') {
        await interaction.deferReply();
        const randomQ = quizQuestions[Math.floor(Math.random() * quizQuestions.length)];
        
        const embed = new EmbedBuilder()
            .setColor(0x00AE86)
            .setTitle('🧠 Szybki Quiz PJN!')
            .setDescription(`**${randomQ.question}**\n\n*Masz 30 sekund! Wpisz poprawną odpowiedź na tym czacie!*`)
            .setFooter({ text: 'Nagroda: 50 PJN-Coins' });

        await interaction.editReply({ embeds: [embed] });

        const filter = (m: any) => !m.author.bot;
        const collector = interaction.channel?.createMessageCollector({ filter, time: 30000, max: 1 });

        collector?.on('collect', async m => {
            if (m.content.toLowerCase().trim() === randomQ.answer.toLowerCase()) {
                addPoints(m.author.id, 50);
                await m.reply(`🎉 Brawo <@${m.author.id}>! Odpowiedź **"${randomQ.answer}"** była poprawna! Zyskujesz \`+50\` PJN-Coins!`);
            } else {
                await m.channel?.send(`❌ Niestety, <@${m.author.id}> podał złą odpowiedź. Prawidłowa to: **${randomQ.answer}**.`);
            }
        });

        collector?.on('end', (_collected, reason) => {
            if (reason === 'time') {
                interaction.followUp({ content: `⏰ Czas minął! Nikt nie odpowiedział poprawnie. Prawidłowa odpowiedź to: **${randomQ.answer}**.` }).catch(() => {});
            }
        });
    }
    else if (commandName === 'zmiennemuzyke') {
        await interaction.deferReply({ ephemeral: true });
        const stacja = interaction.options.getString('stacja', true);
        const guild = interaction.guild;
        if (!guild) return;

        const voiceChannel = guild.channels.cache.find(
            ch => ch.isVoiceBased() && ch.name === CHANNEL_GLOSOWY
        );

        if (!voiceChannel) {
            await interaction.editReply({ content: `❌ Nie znaleziono kanału "${CHANNEL_GLOSOWY}"!` });
            return;
        }

        try {
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: guild.id,
                adapterCreator: guild.voiceAdapterCreator,
            });

            await playStream(stacja, connection);
            await interaction.editReply({ content: `🎶 Zmieniono stację radiową na: **${stacja.toUpperCase()}**!` });
        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: '❌ Wystąpił błąd podczas zmiany stacji.' });
        }
    }
    else {
        await interaction.deferReply({ ephemeral: true });
        const channel = interaction.guild?.channels.cache.find(ch => ch.isTextBased() && 'name' in ch && ch.name === CHANNEL_OGLOSZENIA) as TextChannel;
        const powitaniaChannel = interaction.guild?.channels.cache.find(ch => ch.isTextBased() && 'name' in ch && ch.name === CHANNEL_POWITANIA) as TextChannel;
        const czatTikTokChannel = interaction.guild?.channels.cache.find(ch => ch.isTextBased() && 'name' in ch && ch.name === CHANNEL_CZAT_TIKTOK) as TextChannel;

        if (commandName === 'testogloszenia' && channel) {
            await channel.send({ embeds: [createOgłoszenieEmbed()] });
            await interaction.editReply({ content: 'Wysłano testowe ogłoszenie (bez @everyone)!' });
        } else if (commandName === 'testlive' && channel) {
            await channel.send({ content: '@everyone', embeds: [createLiveEmbed(currentViewers)] });
            await interaction.editReply({ content: 'Wysłano testowe powiadomienie TikTok!' });
        } else if (commandName === 'testlivekick' && channel) {
            await channel.send({ content: '@everyone', embeds: [createKickLiveEmbed(currentKickViewers)] });
            await interaction.editReply({ content: 'Wysłano testowe powiadomienie Kick!' });
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
            await powitaniaChannel.send({ 
                content: testContent, 
                embeds: [testEmbed] 
            });
            await interaction.editReply({ content: 'Wysłano test powitania z odnośnikami do kanałów!' });
        } else if (commandName === 'testczattiktok' && czatTikTokChannel) {
            const testChatEmbed = new EmbedBuilder()
                .setColor(0xFE2C55)
                .setAuthor({ name: `Czat TikTok • UżytkownikTestowy` })
                .setDescription('To jest testowa wiadomość z czatu TikToka!')
                .setFooter({ text: `Aktywni widzowie: ${currentViewers}` })
                .setTimestamp();
            await czatTikTokChannel.send({ embeds: [testChatEmbed] });
            await interaction.editReply({ content: 'Wysłano testową wiadomość z czatu TikToka!' });
        } else {
            await interaction.editReply({ content: 'Nie znaleziono odpowiedniego kanału dla tej komendy.' });
        }
    }
});

client.login(token);
