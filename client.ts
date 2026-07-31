import { Client, GatewayIntentBits, TextChannel, REST, Routes, SlashCommandBuilder } from 'discord.js';
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

const tiktokConn = new WebcastPushConnection(TIKTOK_USER);

const commands = [
    new SlashCommandBuilder().setName('testogloszenia').setDescription('Testuje wysyłanie ogłoszenia z TikToka'),
    new SlashCommandBuilder().setName('testlive').setDescription('Testuje status transmisji TikTok'),
    new SlashCommandBuilder().setName('testwitania').setDescription('Testuje wiadomość powitalną na osobnym kanale'),
].map(command => command.toJSON());

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

    tiktokConn.on('chat', async data => {
        console.log(`${data.uniqueId}: ${data.comment}`);
        const channel = client.channels.cache.find(
            ch => ch.isTextBased() && 'name' in ch && ch.name === CHANNEL_OGLOSZENIA
        ) as TextChannel;

        if (channel) {
            try {
                await channel.send(`**${data.uniqueId}:** ${data.comment}`);
            } catch (err) {
                console.error('Błąd wysyłania wiadomości na Discorda:', err);
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
            await channel.send(`Witaj na serwerze, ${member}! Cieszymy się, że jesteś z nami! 🎉`);
        } catch (err) {
            console.error('Błąd wysyłania powitania:', err);
        }
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    // Odroczona odpowiedź zapobiega błędom "Aplikacja nie reaguje"
    await interaction.deferReply({ ephemeral: true });

    if (commandName === 'testogloszenia') {
        const channel = interaction.guild?.channels.cache.find(
            ch => ch.isTextBased() && 'name' in ch && ch.name === CHANNEL_OGLOSZENIA
        ) as TextChannel;

        if (channel) {
            await channel.send(`**[TEST] Użytkownik_TikTok:** To jest testowa wiadomość z czatu TikToka!`);
            await interaction.editReply({ content: 'Testowy komunikat z TikToka został pomyślnie wysłany na kanał ogłoszenia!' });
        } else {
            await interaction.editReply({ content: 'Nie znaleziono kanału o nazwie "ogłoszenia"!' });
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
            await channel.send(`Witaj na serwerze, ${interaction.user}! (Test powitania) 🎉`);
            await interaction.editReply({ content: 'Testowa wiadomość powitalna została wysłana na kanał witamy!' });
        } else {
            await interaction.editReply({ content: 'Nie znaleziono kanału o nazwie "witamy"!' });
        }
    }
});

client.login(token);
