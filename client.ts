import { Client, GatewayIntentBits, TextChannel, REST, Routes, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
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

const TIKTOK_USER = "Languspjn";
const KICK_USER = "languspjn";
const CHANNEL_OGLOSZENIA = "ogłoszenia";
const CHANNEL_POWITANIA = "witamy";
const CHANNEL_CZAT_TIKTOK = "czat-tiktok";
const CHANNEL_GLOSOWY = "🎧 Muza 24/7 - Wejdź i Słuchaj 🎧"; 

// TWOJE ID DISCORDA ORAZ ID SERWERA
const MOJE_DISCORD_ID = "1175798371995361343";
const GUILD_ID = "1532302510671269928";

// STAŁE ID KANAŁU ORAZ RÓL
const ID_KANALU_DUSZKI = "1532977723843285112"; 
const ID_RANGI_DUSZKOWIEC = "1532978703842283551";
const ID_RANGI_MODERATOR = "1532321767857721344";
const ID_RANGI_ADMIN = "1532324059470237857";

const ID_KANALU_PLEC = '1532374188634144898';
const ID_KANALU_RANGES = '1532397673842217010';
const ID_KANALU_SPRZET = '1532398069524594708';

const LIVE_IMAGE_URL = "https://cdn.discordapp.com/attachments/1532862421729808565/1532865034642919574/1784490427936.png?ex=6a6e674f&is=6a6d15cf&hm=92695ee6d6999e9212a4ff8f86d3fdf6e70ee32a9c9e4cb175e54579f8b44fde&";

// --- PROSTY SYSTEM EKONOMII (ZAPIS DO PLIKU) ---
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
// ----------------------------------------------

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
            { name: '🔗 TikTok', value: '[tiktok.com/@LangusPJN](https://www.tiktok.com/@LangusPJN)', inline: true },
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
        .setDescription(`**@LangusPJN** właśnie rozpoczął nowy stream na TikToku! Wpadnij, zostaw follow i dołącz do wspólnej zabawy.`)
        .addFields(
            { name: '👥 Widzowie online', value: `${viewerCount}`, inline: true },
            { name: '🔗 Oglądaj tutaj', value: '[tiktok.com/@LangusPJN/live](https://www.tiktok.com/@LangusPJN/live)', inline: true }
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
            const name = isTikTokLive ? `🔴 • TikTok Live: ONLINE (${currentViewers})` : `🔴 • TikTok Live: OFFLINE`;
            await tiktokChannel.setName(name);
        }

        const kickChannel = guild.channels.cache.find((ch: any) => ch.isVoiceBased() && ch.name.includes('Kick Live:'));
        if (kickChannel) {
            const name = isKickLive ? `🟢 • Kick Live: ONLINE (${currentKickViewers})` : `🟢 • Kick Live: OFFLINE`;
            await kickChannel.setName(name);
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
        console.log('Pomyślnie zarejestrowano komendy natychmiast na serweru!');
    } catch (error) {
        console.error('Błąd rejestracji komend:', error);
    }

    setInterval(() => {
        client.guilds.cache.forEach(guild => updateServerStats(guild));
    }, 5 * 60 * 1000);

    tiktokConn.on('chat', async data => {
        const channel = client.channels.cache.find(ch => ch.isTextBased() && 'name' in ch && ch.name === CHANNEL_CZAT_TIKTOK) as TextChannel;
        if (channel) {
            const chatEmbed = new EmbedBuilder()
                .setColor(0xFE2C55)
                .setAuthor({ name: `Czat TikTok • ${data.uniqueId}` })
                .setDescription(data.comment)
                .setFooter({ text: `Aktywni widzowie: ${currentViewers}` })
                .setTimestamp();
            await channel.send({ embeds: [chatEmbed] });
        }
    });

    tiktokConn.on('roomUser', data => {
        if (data.viewerCount !== undefined) {
            currentViewers = data.viewerCount;
        }
    });

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
                } else if (!livestream && isKickLive) {
                    isKickLive = false;
                    currentKickViewers = 0;
                }
                client.guilds.cache.forEach(guild => updateServerStats(guild));
            }
        } catch (err) {
            console.error('Błąd Kicka:', err);
        }
    }, 2 * 60 * 1000);

    setInterval(async () => {
        try {
            tiktokConn.connect().then(() => {
                if (!isTikTokLive) {
                    isTikTokLive = true;
                    const channel = client.channels.cache.find(ch => ch.isTextBased() && 'name' in ch && ch.name === CHANNEL_OGLOSZENIA) as TextChannel;
                    if (channel) {
                        channel.send({ content: '@everyone', embeds: [createLiveEmbed(currentViewers)] });
                    }
                }
                client.guilds.cache.forEach(guild => updateServerStats(guild));
            }).catch(() => {
                isTikTokLive = false;
            });
        } catch (err) {
            isTikTokLive = false;
        }
    }, 2 * 60 * 1000);

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

    const earned = Math.floor(Math.random() * 3) + 1;
    addPoints(message.author.id, earned);

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

client.on('guildMemberAdd', async member => {
    updateServerStats(member.guild);
    const channel = member.guild.channels.cache.find(ch => ch.isTextBased() && 'name' in ch && ch.name === CHANNEL_POWITANIA) as TextChannel;
    if (channel) {
        const contentMessage = `👋 Witaj na serwerze PJN, <@${member.id}>! Cieszymy się, że jesteś z nami! 🎉`;

        const embedPowitanie = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('📌 Skonfiguruj swój profil na serwerze:')
            .setDescription(
                `• Wybierz płeć: <#${ID_KANALU_PLEC}>\n` +
                `• Dostosuj role: <#${ID_KANALU_RANGES}>\n` +
                `• Wybierz swój sprzęt: <#${ID_KANALU_SPRZET}>`
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
    if (!interaction.isChatInputCommand()) return;
    const { commandName } = interaction;

    if (commandName === 'balans') {
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
        const eco = loadEconomy();
        const sorted = Object.entries(eco)
            .sort((a, b) => b[1].balance - a[1].balance)
            .slice(0, 10);

        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle('🏆 Ranking Najbogatszych (PJN-Coins)')
            .setTimestamp();

        if (sorted.length === 0) {
            embed.setDescription('Brak danych w rankingu.');
        } else {
            let desc = '';
            sorted.forEach(([userId, data], index) => {
                desc += `**${index + 1}.** <@${userId}> — \`${data.balance} Coins\`\n`;
            });
            embed.setDescription(desc);
        }

        await interaction.editReply({ embeds: [embed] });
    }
    else if (commandName === 'dodajpunkty') {
        if (interaction.user.id !== MOJE_DISCORD_ID) {
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
            await interaction.editReply({ content: 'Nie znaleziono odpowiedniego kanału dla tej komendy.' });
        }
    }
});

client.login(token);
