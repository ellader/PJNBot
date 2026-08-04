import { 
    Client, 
    GatewayIntentBits, 
    REST, 
    Routes, 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    ChannelType, 
    TextChannel 
} from 'discord.js';
import mongoose from 'mongoose';

// === KONFIGURACJA BAZY DANYCH MONGOOSE ===
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) throw new Error("Brak zmiennej środowiskowej MONGO_URI!");

mongoose.connect(MONGO_URI)
    .then(() => console.log('Połączono z bazą danych MongoDB!'))
    .catch((err) => console.error('Błąd połączenia z MongoDB:', err));

const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    balance: { type: Number, default: 0 }
});

const UserModel = mongoose.model('User', userSchema);

// === KONFIGURACJA BOTA DISCORD (poprawiona nazwa zmiennej na DISCORD_BOT_TOKEN) ===
const token = process.env.DISCORD_BOT_TOKEN;
if (!token) throw new Error("Brak tokena Discord bota!");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers
    ]
});

// Pomocnicza funkcja sprawdzająca czy użytkownik to administrator
function isAuthorized(userId: string): boolean {
    const adminIds = ['1175798371995361343', '1493928957408448563']; // Twoje ID oraz drugiego admina
    return adminIds.includes(userId);
}

// === REJESTRACJA KOMEND SLASH ===
const commands = [
    new SlashCommandBuilder()
        .setName('balans')
        .setDescription('Sprawdź stan swoich PJN-Coins'),
    
    new SlashCommandBuilder()
        .setName('topka')
        .setDescription('Zobacz ranking najbogatszych graczy'),

    new SlashCommandBuilder()
        .setName('rozdaj-wszystkim')
        .setDescription('Rozdaj PJN-Coinsy wszystkim użytkownikom na serwerze')
        .addIntegerOption(option => 
            option.setName('ilosc')
                .setDescription('Liczba coinsów dla każdego')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('powod')
                .setDescription('Powód rozdania')
                .setRequired(false)),

    new SlashCommandBuilder()
        .setName('dajpunkty')
        .setDescription('Dodaj PJN-Coinsy wybranemu użytkownikowi')
        .addUserOption(option =>
            option.setName('uzytkownik')
                .setDescription('Użytkownik, któremu chcesz dodać punkty')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('ilosc')
                .setDescription('Liczba coinsów do dodania')
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('zabierzpunkty')
        .setDescription('Zabierz PJN-Coinsy wybranemu użytkownikowi')
        .addUserOption(option =>
            option.setName('uzytkownik')
                .setDescription('Użytkownik, któremu chcesz zabrać punkty')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('ilosc')
                .setDescription('Liczba coinsów do zabrania')
                .setRequired(true))
].map(command => command.toJSON());

client.once('ready', async () => {
    console.log(`Zalogowano jako ${client.user?.tag}!`);

    const rest = new REST({ version: '10' }).setToken(token);
    try {
        // Automatyczne pobranie ID pierwszej gildii, na której jest bot, do rejestracji komend
        for (const [_, guild] of client.guilds.cache) {
            await rest.put(Routes.applicationGuildCommands(client.user!.id, guild.id), { body: commands });
        }
        console.log('Zarejestrowano komendy!');
    } catch (error) {
        console.error('Błąd rejestracji komend:', error);
    }
});

// === OBSŁUGA INTERAKCJI (KOMEND) ===
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    try {
        // 1. KOMENDA: /balans
        if (commandName === 'balans') {
            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) {
                user = await UserModel.create({ userId: interaction.user.id, balance: 0 });
            }
            await interaction.reply({ content: `💰 Posiadasz aktualnie **${user.balance} PJN-Coins!**`, ephemeral: true });
            return;
        }

        // 2. KOMENDA: /topka
        else if (commandName === 'topka') {
            const topUsers = await UserModel.find().sort({ balance: -1 }).limit(10);
            
            if (topUsers.length === 0) {
                await interaction.reply({ content: 'Brak danych w rankingu.', ephemeral: true });
                return;
            }

            let desc = '';
            topUsers.forEach((u, index) => {
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**${index + 1}.**`;
                desc += `${medal} <@${u.userId}> — **${u.balance} Coins**\n`;
            });

            await interaction.reply({ embeds: [{ color: 0xFFD700, title: '🏆 TOP 10 - Ranking PJN-Coins', description: desc }] });
            return;
        }

        // 3. KOMENDA: /rozdaj-wszystkim
        else if (commandName === 'rozdaj-wszystkim') {
            if (!isAuthorized(interaction.user.id) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
                await interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
                return;
            }

            await interaction.deferReply({ ephemeral: true });
            
            const ilosc = interaction.options.getInteger('ilosc', true);
            const powod = interaction.options.getString('powod') || 'Brak powodu';

            await interaction.guild?.members.fetch();
            const members = interaction.guild?.members.cache.filter(m => !m.user.bot);

            if (!members || members.size === 0) {
                await interaction.editReply({ content: '❌ Nie znaleziono żadnych użytkowników na serwerze!' });
                return;
            }

            let zaktualizowano = 0;
            for (const [_, member] of members) {
                let user = await UserModel.findOne({ userId: member.id });
                if (!user) {
                    user = await UserModel.create({ userId: member.id, balance: 0 });
                }
                user.balance += ilosc;
                await user.save();
                zaktualizowano++;
            }

            await interaction.editReply({ content: `✅ Rozdano **${ilosc} PJN-Coins** dla **${zaktualizowano}** użytkowników!\n📌 Powód: *${powod}*` });
            return;
        }

        // 4. KOMENDA: /dajpunkty (pojedynczo)
        else if (commandName === 'dajpunkty') {
            if (!isAuthorized(interaction.user.id) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
                await interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
                return;
            }

            const targetUser = interaction.options.getUser('uzytkownik', true);
            const ilosc = interaction.options.getInteger('ilosc', true);

            if (targetUser.bot) {
                await interaction.reply({ content: '❌ Nie możesz dawać punktów botom!', ephemeral: true });
                return;
            }

            let user = await UserModel.findOne({ userId: targetUser.id });
            if (!user) {
                user = await UserModel.create({ userId: targetUser.id, balance: 0 });
            }

            user.balance += ilosc;
            await user.save();

            await interaction.reply({ content: `✅ Dodano **${ilosc} PJN-Coins** dla użytkownika <@${targetUser.id}>. Nowy stan: **${user.balance}**`, ephemeral: true });
            return;
        }

        // 5. KOMENDA: /zabierzpunkty (pojedynczo)
        else if (commandName === 'zabierzpunkty') {
            if (!isAuthorized(interaction.user.id) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
                await interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
                return;
            }

            const targetUser = interaction.options.getUser('uzytkownik', true);
            const ilosc = interaction.options.getInteger('ilosc', true);

            let user = await UserModel.findOne({ userId: targetUser.id });
            if (!user) {
                user = await UserModel.create({ userId: targetUser.id, balance: 0 });
            }

            // Zapobieganie zejściu poniżej 0 punktów
            user.balance = Math.max(0, user.balance - ilosc);
            await user.save();

            await interaction.reply({ content: `⚠️ Zabrano **${ilosc} PJN-Coins** użytkownikowi <@${targetUser.id}>. Aktualny stan: **${user.balance}**`, ephemeral: true });
            return;
        }

    } catch (error) {
        console.error('Błąd podczas obsługi komendy:', error);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: 'Wystąpił błąd podczas wykonywania tej komendy.' }).catch(() => {});
        } else {
            await interaction.reply({ content: 'Wystąpił błąd podczas wykonywania tej komendy.', ephemeral: true }).catch(() => {});
        }
    }
});

client.login(token);
