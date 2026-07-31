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
const CHANNEL_OGLOSZENIA = "ogłoszenia";
const CHANNEL_POWITANIA = "witamy";
const CHANNEL_CZAT_TIKTOK = "czat-tiktok"; // Nowy kanał na czat z TikToka

const tiktokConn = new WebcastPushConnection(TIKTOK_USER);

const commands = [
    new SlashCommandBuilder().setName('testogloszenia').setDescription('Wysyła testowe ogłoszenie o profilach streamingowych'),
    new SlashCommandBuilder().setName('testczattiktok').setDescription('Testuje ramkę z czatu TikToka na osobnym kanale'),
    new SlashCommandBuilder().setName('testlive').setDescription('Testuje status transmisji TikTok'),
    new SlashCommandBuilder().setName('testwitania').setDescription('Testuje wiadomość powitalną w ramce'),
].map(command => command.toJSON());

// Funkcja generująca ładną ramkę ogłoszenia
function createOgłoszenieEmbed() {
    return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🌟 Witamy na PJN Server!')
        .setDescription('Cieszymy się, że jesteś częścią naszej społeczności! Pamiętaj, aby regularnie wspierać nasze projekty i śledzić oficjalne profile streamingowe:')
        .addFields(
            { name: '🔗 TikTok', value: '[tiktok.com/@LangusPJN](https://www.tiktok.com/@LangusPJN)', inline: true },
            { name: '🔗 Kick', value: '[kick.com/LangusPJN](https://www.kick.com/LangusPJN)', inline: true },
            { name: '💡 Społeczność', value: 'Zostaw po sobie ślad, zaproś znajomych na nasz serwer Discord i buduj z nami najlepszą społeczność w sieci! 🚀' }
        )
        .setTimestamp()
        .setFooter({ text: 'PJN System Automatyczny' });
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

    // Automatyczne ogłoszenie godzinne w ładnej ramce (Embed) na kanale ogłoszenia
    setInterval(async () => {
        const channel = client.channels.cache.find(
            ch => ch.isTextBased() && 'name' in ch && ch.name === CHANNEL_OGLOSZENIA
        ) as TextChannel;

        if (channel) {
            try {
                await channel.send({ embeds: [createOgłoszenieEmbed()] });
                console.log('Wysłano automatyczne ogłoszenie godzinne w ramce.');
            } catch (err) {
                console.error('Błąd wysyłania automatycznego ogłoszenia:', err);
            }
        }
    }, 60 * 60 * 1000); // Co 1 godzinę

    // Przekazywanie wiadomości z czatu TikToka na dedykowany kanał czat-tiktok
    tiktokConn.on('chat', async data => {
        console.log(`${data.uniqueId}: ${data.comment}`);
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

// Automatyczne powitanie nowych osób w eleganckiej ramce na kanale witamy
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

// Obsługa komend slash
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    await interaction.deferReply({ ephemeral: true });

    if (commandName === 'testogloszenia') {
        const channel = interaction.guild?.channels.cache.find(
            ch => ch.isTextBased() && 'name' in ch && ch.name === CHANNEL_OGLOSZENIA
        ) as TextChannel;

        if (channel) {
            await channel.send({ embeds: [createOgłoszenieEmbed()] });
            await interaction.editReply({ content: 'Testowe ogłoszenie o profilach streamingowych zostało pomyślnie wysłane!' });
        } else {
            await interaction.editReply({ content: 'Nie znaleziono kanału o nazwie "ogłoszenia"!' });
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
            await interaction.editReply({ content: 'Testowy komunikat czatu został wysłany na kanał czat-tiktok!' });
        } else {
            await interaction.editReply({ content: 'Nie znaleziono kanału o nazwie "czat-tiktok"!' });
        }
    }
    else if (commandName === 'testlive') {
        const isLive = tiktokConn.isLive;
        await interaction.editReply({ 
            content: isLive ? `Status: Transmisja na żywo jest aktywna! 🔴` : `Status: Brak aktywnej transmisji na żywo (użytkownik offline). ❌` 
        });
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
            await interaction.editReply({ content: 'Testowa wiadomość powitalna w ramce została wysłana na kanał witamy!' });
        } else {
            await interaction.editReply({ content: 'Nie znaleziono kanału o nazwie "witamy"!' });
        }
    }
});

client.login(token);
