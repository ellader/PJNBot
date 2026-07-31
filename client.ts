import { Client, GatewayIntentBits, TextChannel, REST, Routes, SlashCommandBuilder } from 'discord.js';
import { WebcastPushConnection } from 'tiktok-live-connector';

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) throw new Error("Brak tokena Discord bota!");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers // Wymagane do wykrywania nowych członków serwera
    ]
});

const TIKTOK_USER = "Languspjn";
const CHANNEL_OGLOSZENIA = "ogłoszenia"; // Kanał na czat z TikToka i testogłoszenia
const CHANNEL_POWITANIA = "witamy";   // Osobny kanał na powitania i testwitania (z małej litery)

const tiktokConn = new WebcastPushConnection(TIKTOK_USER);

// Rejestracja komend slash
const commands = [
    new SlashCommandBuilder().setName('testogloszenia').setDescription('Testuje wysyłanie ogłoszenia z TikToka'),
    new SlashCommandBuilder().setName('testlive').setDescription('Testuje status transmisji TikTok'),
    new SlashCommandBuilder().setName('testwitania').setDescription('Testuje wiadomość powitalną na osobnym kanale'),
].map(command => command.toJSON());

client.once('ready', async () => {
    console.log(`Zalogowano jako ${client.user?.tag}!`);

    // Automatyczna rejestracja komend globalnie
    const rest = new REST({ version: '10' }).setToken(token);
    try {
        await rest.put(Routes.applicationCommands(client.user!.id), { body: commands });
        console.log('Pomyślnie zarejestrowano komendy slash!');
    } catch (error) {
        console.error('Błąd rejestracji komend:', error);
    }

    // Połączenie z TikTokiem
    tiktokConn.connect().then(state => {
        console.log(`Połączono z transmisją TikTok użytkownika ${TIKTOK_USER} (ID: ${state.roomId})`);
    }).catch(err => {
        console.error('Błąd połączenia z TikTokiem (brak aktywnego live\'a):', err);
    });

    // Przekazywanie czatu z TikToka na kanał ogłoszeń
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

// Obsługa nowych osób wchodzących na serwer (automatyczne powitanie na osobnym kanale)
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

// Obsługa komend slash
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'testogloszenia') {
        await interaction.reply({ content: 'Testowy komunikat z TikToka (ogłoszenia) został wywołany!', ephemeral: true });
        
        const channel = interaction.guild?.channels.cache.find(
            ch => ch.isTextBased() && 'name' in ch && ch.name === CHANNEL_OGLOSZENIA
        ) as TextChannel;

        if (channel) {
            await channel.send(`**[TEST] Użytkownik_TikTok:** To jest testowa wiadomość z czatu TikToka!`);
        }
    } 
    else if (commandName === 'testlive') {
        const isLive = tiktokConn.isLive;
        await interaction.reply({ 
            content: isLive ? `Status: Transmisja na żywo jest aktywna! 🔴` : `Status: Brak aktywnej transmisji na żywo (użytkownik offline). ❌`, 
            ephemeral: true 
        });
    } 
    else if (commandName === 'testwitania') {
        await interaction.reply({ content: 'Testowa wiadomość powitalna została wysłana na kanał witamy!', ephemeral: true });
        
        const channel = interaction.guild?.channels.cache.find(
            ch => ch.isTextBased() && 'name' in ch && ch.name === CHANNEL_POWITANIA
        ) as TextChannel;

        if (channel) {
            await channel.send(`Witaj na serwerze, ${interaction.user}! (Test powitania) 🎉`);
        }
    }
});

client.login(token);
