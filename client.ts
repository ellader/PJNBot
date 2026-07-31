import { Client, GatewayIntentBits, TextChannel, REST, Routes, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { WebcastPushConnection } from 'tiktok-live-connector';

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) throw new Error("Brak tokena Discord bota!");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const TIKTOK_USER = "Languspjn";
const KICK_USER = "languspjn";
const CHANNEL_OGLOSZENIA = "ogłoszenia";
const CHANNEL_POWITANIA = "witamy";
const CHANNEL_CZAT_TIKTOK = "czat-tiktok";

// Twój link do zdjęcia został dodany tutaj
const LIVE_IMAGE_URL = "https://cdn.discordapp.com/attachments/1532862421729808565/1532865034642919574/1784490427936.png?ex=6a6e674f&is=6a6d15cf&hm=92695ee6d6999e9212a4ff8f86d3fdf6e70ee32a9c9e4cb175e54579f8b44fde&";

const tiktokConn = new WebcastPushConnection(TIKTOK_USER);
let isKickLive = false;

const commands = [
    new SlashCommandBuilder().setName('testogloszenia').setDescription('Wysyła testowe ogłoszenie o profilach z @everyone'),
    new SlashCommandBuilder().setName('testczattiktok').setDescription('Testuje ramkę z czatu TikToka na osobnym kanale'),
    new SlashCommandBuilder().setName('testlive').setDescription('Wysyła testowe powiadomienie o live z @everyone na ogłoszenia (TikTok)'),
    new SlashCommandBuilder().setName('testlivekick').setDescription('Wysyła testowe powiadomienie o live z @everyone na ogłoszenia (Kick)'),
    new SlashCommandBuilder().setName('testwitania').setDescription('Testuje wiadomość powitalną w ramce'),
].map(command => command.toJSON());

// Funkcja generująca ładną ramkę ogłoszenia godzinnego
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

// Funkcja generująca ramkę powiadomienia o Live - TikTok
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

// Funkcja generująca ramkę powiadomienia o Live - Kick
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

client.once('ready', async () => {
    console.log(`Zalogowano jako ${client.user?.tag}!`);

    const rest = new REST({ version: '10' }).setToken(token);
    try {
        await rest.put(Routes.applicationCommands(client.user!.id), { body: commands });
        console.log('Pomyślnie zarejestrowano komendy slash!');
    } catch (error) {
        console.error('Błąd rejestracji komend:', error);
    }

    tiktokConn.connect().then(state => {
        console.log(`Połączono z transmisją TikTok użytkownika ${TIKTOK_USER} (ID: ${state.roomId})`);
    }).catch(err => {
        console.error('Błąd połączenia z TikTokiem (brak aktywnego live\'a):', err);
    });

    // Automatyczne ogłoszenie godzinne z @everyone
    setInterval(async () => {
        const channel = client.channels.cache.find(
            ch => ch.isTextBased() && 'name' in ch && ch.name === CHANNEL_OGLOSZENIA
        ) as TextChannel;

        if (channel) {
            try {
                await channel.send({
                    content: '@everyone',
                    embeds: [createOgłoszenieEmbed()]
                });
                console.log('Wysłano automatyczne ogłoszenie godzinne z @everyone.');
            } catch (err) {
                console.error('Błąd wysyłania automatycznego ogłoszenia:', err);
            }
        }
    }, 60 * 60 * 1000); // Co 1 godzinę

    // Automatyczne sprawdzanie statusu Kicka co 2 minuty
    setInterval(async () => {
        try {
            const response = await fetch(`https://kick.com/api/v2/channels/${KICK_USER}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json() as any;
                const livestream = data.livestream;

                if (livestream && !isKickLive) {
                    isKickLive = true;
                    const channel = client.channels.cache.find(
                        ch => ch.isTextBased() && 'name' in ch && ch.name === CHANNEL_OGLOSZENIA
                    ) as TextChannel;

                    if (channel) {
                        await channel.send({
                            content: '@everyone',
                            embeds: [createKickLiveEmbed()]
                        });
                        console.log('Wykryto live na Kicku! Wysłano powiadomienie.');
                    }
                } else if (!livestream && isKickLive) {
                    isKickLive = false;
                    console.log('Stream na Kicku się zakończył.');
                }
            }
        } catch (err) {
            console.error('Błąd sprawdzania statusu Kicka:', err);
        }
    }, 2 * 60 * 1000);

    tiktokConn.on('liveStart', async () => {
        const channel = client.channels.cache.find(
            ch => ch.isTextBased() && 'name' in ch && ch.name === CHANNEL_OGLOSZENIA
        ) as TextChannel;

        if (channel) {
            try {
                await channel.send({
                    content: '@everyone',
                    embeds: [createLiveEmbed()]
                });
                console.log('Wysłano powiadomienie o live TikTok do wszystkich.');
            } catch (err) {
                console.error('Błąd wysyłania powiadomienia o live TikTok:', err);
            }
        }
    });

    tiktokConn.on('chat', async data => {
        const channel = client.channels.cache.find(
            ch => ch.isTextBased() && 'name' in ch && ch.name === CHANNEL_CZAT_TIKTOK
        ) as TextChannel;

        if (channel) {
            try {
                const chatEmbed = new EmbedBuilder()
                    .setColor(0xFE2C55)
                    .setAuthor({ name: `Czat TikTok • ${data.uniqueId}` })
                    .setDescription(data.comment)
                    .setTimestamp();

                await channel.send({ embeds: [chatEmbed] });
            } catch (err) {
                console.error('Błąd wysyłania wiadomości z TikToka na Discorda:', err);
            }
        }
    });
});

client.on('guildMemberAdd', async member => {
    const channel = member.guild.channels.cache.find(
        ch => ch.isTextBased() && 'name' in ch && ch.name === CHANNEL_POWITANIA
    ) as TextChannel;

    if (channel) {
        try {
            const embedPowitanie = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle('👋 Nowy użytkownik na pokładzie!')
                .setDescription(`Witaj na serwerze PJN, ${member}! Cieszymy się, że jesteś z nami! 🎉\n\nSprawdź kanał z ogłoszeniami i rozgość się w naszej społeczności.`)
                .setThumbnail(member.user.displayAvatarURL())
                .setTimestamp();

            await channel.send({ embeds: [embedPowitanie] });
        } catch (err) {
            console.error('Błąd wysyłania powitania:', err);
        }
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;
    await interaction.deferReply({ ephemeral: true });

    if (commandName === 'testogloszenia') {
        const channel = interaction.guild?.channels.cache.find(
            ch => ch.isTextBased() && 'name' in ch && ch.name === CHANNEL_OGLOSZENIA
        ) as TextChannel;

        if (channel) {
            await channel.send({ content: '@everyone', embeds: [createOgłoszenieEmbed()] });
            await interaction.editReply({ content: 'Testowe ogłoszenie ze zdjęciem zostało wysłane!' });
        } else {
            await interaction.editReply({ content: 'Nie znaleziono kanału "ogłoszenia"!' });
        }
    }
    else if (commandName === 'testczattiktok') {
        const channel = interaction.guild?.channels.cache.find(
            ch => ch.isTextBased() && 'name' in ch && ch.name === CHANNEL_CZAT_TIKTOK
        ) as TextChannel;

        if (channel) {
            const testEmbed = new EmbedBuilder()
                .setColor(0xFE2C55)
                .setAuthor({ name: 'Czat TikTok • Użytkownik_Testowy' })
                .setDescription('To jest testowa wiadomość z czatu TikToka w ramce!')
                .setTimestamp();

            await channel.send({ embeds: [testEmbed] });
            await interaction.editReply({ content: 'Testowy komunikat czatu został wysłany!' });
        } else {
            await interaction.editReply({ content: 'Nie znaleziono kanału "czat-tiktok"!' });
        }
    }
    else if (commandName === 'testlive') {
        const channel = interaction.guild?.channels.cache.find(
            ch => ch.isTextBased() && 'name' in ch && ch.name === CHANNEL_OGLOSZENIA
        ) as TextChannel;

        if (channel) {
            await channel.send({ content: '@everyone', embeds: [createLiveEmbed()] });
            await interaction.editReply({ content: 'Testowe powiadomienie o live TikTok ze zdjęciem zostało wysłane!' });
        } else {
            await interaction.editReply({ content: 'Nie znaleziono kanału "ogłoszenia"!' });
        }
    }
    else if (commandName === 'testlivekick') {
        const channel = interaction.guild?.channels.cache.find(
            ch => ch.isTextBased() && 'name' in ch && ch.name === CHANNEL_OGLOSZENIA
        ) as TextChannel;

        if (channel) {
            await channel.send({ content: '@everyone', embeds: [createKickLiveEmbed()] });
            await interaction.editReply({ content: 'Testowe powiadomienie o live Kick ze zdjęciem zostało wysłane!' });
        } else {
            await interaction.editReply({ content: 'Nie znaleziono kanału "ogłoszenia"!' });
        }
    }
    else if (commandName === 'testwitania') {
        const channel = interaction.guild?.channels.cache.find(
            ch => ch.isTextBased() && 'name' in ch && ch.name === CHANNEL_POWITANIA
        ) as TextChannel;

        if (channel) {
            const testWitanieEmbed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle('👋 Test powitania')
                .setDescription(`Witaj na serwerze PJN, ${interaction.user}! (Test wiadomości powitalnej) 🎉`)
                .setThumbnail(interaction.user.displayAvatarURL())
                .setTimestamp();

            await channel.send({ embeds: [testWitanieEmbed] });
            await interaction.editReply({ content: 'Testowa wiadomość powitalna została wysłana!' });
        } else {
            await interaction.editReply({ content: 'Nie znaleziono kanału "witamy"!' });
        }
    }
});

client.login(token);
