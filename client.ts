import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) throw new Error("Brak tokena!");

client.once('ready', async () => {
    console.log(`[TEST] Zalogowano jako ${client.user?.tag}!`);
    
    // Szybka rejestracja testowej komendy
    const rest = new REST({ version: '10' }).setToken(token);
    try {
        await rest.put(
            Routes.applicationCommands(client.user!.id),
            { body: [new SlashCommandBuilder().setName('portfel').setDescription('Testowy portfel').toJSON()] },
        );
        console.log('[TEST] Zarejestrowano komendę /portfel!');
    } catch (error) {
        console.error(error);
    }
});

client.on('interactionCreate', async interaction => {
    console.log(`[SUKCES] Otrzymano interakcję: /${interaction.commandName}`);
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'portfel') {
        await interaction.reply({ content: '💰 Działa! Twój portfel ma 0 monet.', ephemeral: true });
    }
});

client.login(token);
