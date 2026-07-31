import { Client, GatewayIntentBits, TextChannel, REST, Routes, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { WebcastPushConnection } from 'tiktok-live-connector';
import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } from '@discordjs/voice';
import play from 'play-dl';

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

const LIVE_IMAGE_URL = "https://cdn.discordapp.com/attachments/1532862421729808565/1532865034642919574/1784490427936.png?ex=6a6e674f&is=6a6d15cf&hm=92695ee6d6999e9212a4ff8f86d3fdf6e70ee32a9c9e4cb175e54579f8b44fde&";

const tiktokConn = new WebcastPushConnection(TIKTOK_USER);
let isKickLive = false;
const audioPlayer = createAudioPlayer();

const commands = [
    new SlashCommandBuilder().setName('testogloszenia').setDescription('Wysyła testowe ogłoszenie o profilach z @everyone'),
    new SlashCommandBuilder().setName('testczattiktok').setDescription('Testuje ramkę z czatu TikToka na osobnym kanale'),
    new SlashCommandBuilder().setName('testlive').setDescription('Wysyła testowe powiadomienie o live z @everyone na ogłoszenia (TikTok)'),
    new SlashCommandBuilder().setName('testlivekick').setDescription('Wysyła testowe powiadomienie o live z @everyone na ogłoszenia (Kick)'),
    new SlashCommandBuilder().setName('testwitania').setDescription('Testuje wiadomość powitalną w ramce'),
    new SlashCommandBuilder()
        .setName('zmiennemuzyke')
        .setDescription('Zmienia odtwarzaną muzykę / set na stałym kanale')
        .addStringOption(option => 
            option.setName('url')
                  .setDescription('Wpisz "eska" lub wklej link z YouTube')
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

function createLiveEmbed() {
    return new EmbedBuilder()
        .setColor(0xFE2C55)
        .setTitle('🔴 TRANSMISJA NA ŻYWO (TIKTOK)!')
        .setDescription(`**@LangusPJN** właśnie rozpoczął nowy stream na TikToku! Wpadnij, zostaw follow i dołącz do wspólnej zabawy.`)
        .addFields(
            { name: '🔗 Oglądaj tutaj', value: '[tiktok.com/@LangusPJN/live](https://www.tiktok.com/@LangusPJN/live)' }
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

async function playStream(url: string, connection: any) {
    try {
        let streamUrl = url;
        if (url.toLowerCase() === 'eska') {
            streamUrl = 'https://extstream.eskago.pl/eska_warszawa';
        }

        if (streamUrl.includes('youtube.com') || streamUrl.includes('youtu.be')) {
            const fetchedStream = await play.stream(streamUrl);
            const resource = createAudioResource(fetchedStream.stream, { inputType: fetchedStream.type });
            audioPlayer.play(resource);
            connection.subscribe(audioPlayer);
        } else {
            const resource = createAudioResource(streamUrl);
            audioPlayer.play(resource);
            connection.subscribe(audioPlayer);
        }
        console.log('Odtwarzanie muzyki zostało uruchomione.');
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

    tiktokConn.connect().catch(() => {});

    // Automatyczne wejście na kanał muzyczny po wystartowaniu bota
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
                    console.log(`Bot automatycznie dołączył do kanału: ${CHANNEL_GLOSOWY}`);

                    audioPlayer.on(AudioPlayerStatus.Idle, async () => {
                        await playStream('eska', connection);
                    });
                } catch (err) {
                    console.error('Błąd automatycznego łączenia z kanałem głosu:', err);
                }
            } else {
                console.log(`Nie znaleziono kanału głosowego: ${CHANNEL_GLOSOWY}`);
            }
        });
    }, 3000); // Czeka 3 sekundy po starcie na załadowanie serwera

    setInterval(async () => {
        const channel = client.channels.cache.find(ch => ch.isTextBased() && 'name' in ch && ch.name === CHANNEL_OGLOSZENIA) as TextChannel;
        if (channel) {
            try {
                await channel.send({ content: '@everyone', embeds: [createOgłoszenieEmbed()] });
            } catch (err) {
                console.error('Błąd automatycznego ogłoszenia:', err);
            }
        }
    }, 60 * 60 * 1000);

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

    tiktokConn.on('liveStart', async () => {
        const channel = client.channels.cache.find(ch => ch.isTextBased() && 'name' in ch && ch.name === CHANNEL_OGLOSZENIA) as TextChannel;
        if (channel) {
            await channel.send({ content: '@everyone', embeds: [createLiveEmbed()] });
        }
    });

    tiktokConn.on('chat', async data => {
        const channel = client.channels.cache.find(ch => ch.isTextBased() && 'name' in ch && ch.name === CHANNEL_CZAT_TIKTOK) as TextChannel;
        if (channel) {
            const chatEmbed = new EmbedBuilder()
                .setColor(0xFE2C55)
                .setAuthor({ name: `Czat TikTok • ${data.uniqueId}` })
                .setDescription(data.comment)
                .setTimestamp();
            await channel.send({ embeds: [chatEmbed] });
        }
    });
});

client.on('guildMemberAdd', async member => {
    const channel = member.guild.channels.cache.find(ch => ch.isTextBased() && 'name' in ch && ch.name === CHANNEL_POWITANIA) as TextChannel;
    if (channel) {
        const embedPowitanie = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('👋 Nowy użytkownik na pokładzie!')
            .setDescription(`Witaj na serwerze PJN, ${member}! Cieszymy się, że jesteś z nami! 🎉`)
            .setThumbnail(member.user.displayAvatarURL())
            .setTimestamp();
        await channel.send({ embeds: [embedPowitanie] });
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName } = interaction;

    if (commandName === 'zmiennemuzyke') {
        await interaction.deferReply({ ephemeral: true });
        const query = interaction.options.getString('url', true);
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

            await playStream(query, connection);
            await interaction.editReply({ content: `🎶 Zmieniono odtwarzaną muzykę na kanale **${CHANNEL_GLOSOWY}**!` });
        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: '❌ Wystąpił błąd podczas zmiany muzyki.' });
        }
    }
    else {
        await interaction.deferReply({ ephemeral: true });
        const channel = interaction.guild?.channels.cache.find(ch => ch.isTextBased() && 'name' in ch && ch.name === CHANNEL_OGLOSZENIA) as TextChannel;
        const powitaniaChannel = interaction.guild?.channels.cache.find(ch => ch.isTextBased() && 'name' in ch && ch.name === CHANNEL_POWITANIA) as TextChannel;

        if (commandName === 'testogloszenia' && channel) {
            await channel.send({ content: '@everyone', embeds: [createOgłoszenieEmbed()] });
            await interaction.editReply({ content: 'Wysłano testowe ogłoszenie!' });
        } else if (commandName === 'testlive' && channel) {
            await channel.send({ content: '@everyone', embeds: [createLiveEmbed()] });
            await interaction.editReply({ content: 'Wysłano testowe powiadomienie TikTok!' });
        } else if (commandName === 'testlivekick' && channel) {
            await channel.send({ content: '@everyone', embeds: [createKickLiveEmbed()] });
            await interaction.editReply({ content: 'Wysłano testowe powiadomienie Kick!' });
        } else if (commandName === 'testwitania' && powitaniaChannel) {
            const testEmbed = new EmbedBuilder().setColor(0x57F287).setTitle('👋 Test').setDescription(`Witaj ${interaction.user}!`);
            await powitaniaChannel.send({ embeds: [testEmbed] });
            await interaction.editReply({ content: 'Wysłano test powitania!' });
        } else if (commandName === 'testczattiktok') {
            await interaction.editReply({ content: 'Komenda czatu działa automatycznie!' });
        } else {
            await interaction.editReply({ content: 'Nie znaleziono odpowiedniego kanału dla tej komendy.' });
        }
    }
});

client.login(token);
