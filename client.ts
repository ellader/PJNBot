import { Client, GatewayIntentBits, TextChannel, REST, Routes, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { WebcastPushConnection } from 'tiktok-live-connector';
import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } from '@discordjs/voice';
import ffmpeg from 'ffmpeg-static';

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

// STAŁE ID KANAŁU ORAZ RÓL
const ID_KANALU_DUSZKI = "1532977723843285112"; 

const ID_RANGI_DUSZKOWIEC = "1532978703842283551";
const ID_RANGI_MODERATOR = "1532321767857721344";
const ID_RANGI_ADMIN = "1532324059470237857";

const ID_KANALU_PLEC = '1532374188634144898';
const ID_KANALU_RANGES = '1532397673842217010';
const ID_KANALU_SPRZET = '1532398069524594708';

const LIVE_IMAGE_URL = "https://cdn.discordapp.com/attachments/1532862421729808565/1532865034642919574/1784490427936.png?ex=6a6e674f&is=6a6d15cf&hm=92695ee6d6999e9212a4ff8f86d3fdf6e70ee32a9c9e4cb175e54579f8b44fde&";

const tiktokConn = new WebcastPushConnection(TIKTOK_USER);
let isKickLive = false;
let isTikTokLive = false;
let currentViewers = 0;
const audioPlayer = createAudioPlayer();

const commands = [
    new SlashCommandBuilder().setName('testogloszenia').setDescription('Wysyła testowe ogłoszenie o profilach (bez @everyone)'),
    new SlashCommandBuilder().setName('testczattiktok').setDescription('Testuje ramkę z czatu TikToka na osobnym kanale'),
    new SlashCommandBuilder().setName('testlive').setDescription('Wysyła testowe powiadomienie o live z @everyone na ogłoszenia (TikTok)'),
    new SlashCommandBuilder().setName('testlivekick').setDescription('Wysyła testowe powiadomienie o live z @everyone na ogłoszenia (Kick)'),
    new SlashCommandBuilder().setName('testwitania').setDescription('Testuje wiadomość powitalną z odnośnikami do rang'),
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

function createKickLiveEmbed() {
    return new EmbedBuilder()
        .setColor(0x53FC18)
        .setTitle('🟢 TRANSMISJA NA ŻYWO (KICK)!')
        .setDescription(`**LangusPJN** właśnie wystartował ze streamem na Kicku! Wbijaj na czat i sprawdź co się dzieje.`)
        .addFields(
            { name: '🔗 Oglądaj tutaj', value: '[kick.com/languspjn](https://kick.com/languspjn)' }
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

client.once('ready', async () => {
    console.log(`Zalogowano jako ${client.user?.tag}!`);

    const rest = new REST({ version: '10' }).setToken(token);
    try {
        await rest.put(Routes.applicationCommands(client.user!.id), { body: commands });
        console.log('Pomyślnie zarejestrowano komendy slash!');
    } catch (error) {
        console.error('Błąd rejestracji komend:', error);
    }

    // Nasłuchiwanie czatu oraz statystyk widzów z TikToka
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

    // Sprawdzanie Kicka co 2 minuty
    setInterval(async () => {
        try {
            const response = await fetch(`https://kick.com/api/v2/channels/${KICK_USER}`, {
                headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
            });
            if (response.ok) {
                const data = await response.json() as any;
                const livestream = data.livestream;
                if (livestream && !isKickLive) {
                    isKickLive = true;
                    const channel = client.channels.cache.find(ch => ch.isTextBased() && 'name' in ch && ch.name === CHANNEL_OGLOSZENIA) as TextChannel;
                    if (channel) {
                        await channel.send({ content: '@everyone', embeds: [createKickLiveEmbed()] });
                    }
                } else if (!livestream && isKickLive) {
                    isKickLive = false;
                }
            }
        } catch (err) {
            console.error('Błąd Kicka:', err);
        }
    }, 2 * 60 * 1000);

    // Sprawdzanie TikToka co 2 minuty
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
            }).catch(() => {
                isTikTokLive = false;
            });
        } catch (err) {
            isTikTokLive = false;
        }
    }, 2 * 60 * 1000);

    setTimeout(() => {
        client.guilds.cache.forEach(async guild => {
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

// AUTOMATYCZNA ODPOWIEDŹ BOTA NA KANALE PO JEGO ID (Duszki)
client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.guild) return;

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

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName } = interaction;

    if (commandName === 'zmiennemuzyke') {
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
            await channel.send({ content: '@everyone', embeds: [createKickLiveEmbed()] });
            await interaction.editReply({ content: 'Wysłano testowe powiadomienie Kick!' });
        } else if (commandName === 'testwitania' && powitaniaChannel) {
            const testContent = `👋 Witaj <@${interaction.user.id}>! Tak będą wyglądać odnośniki:`;
            const testEmbed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle('📌 Test Powitania z Rangami')
                .setDescription(
                    `• Wybierz płeć: <#${ID_KANALU_PLEC}>\n` +
                    `• Dostosuj role: <#${ID_KANALU_RANGES}>\n` +
                    `• Wybierz swój sprzęt: <#${ID_KANALU_SPRZET}>`
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
