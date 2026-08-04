import { 
    Client, 
    GatewayIntentBits, 
    REST, 
    Routes, 
    SlashCommandBuilder, 
    PermissionFlagsBits 
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
    balance: { type: Number, default: 0 },
    lastDaily: { type: Date, default: null }
});

const UserModel = mongoose.model('User', userSchema);

// === KONFIGURACJA BOTA DISCORD ===
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
        .setName('daily')
        .setDescription('Odbieraj codzienne 100 PJN-Coins (co 24h)'),

    new SlashCommandBuilder()
        .setName('kostka')
        .setDescription('Rzuć kością przeciwko botowi o stawkę')
        .addIntegerOption(option =>
            option.setName('stawka')
                .setDescription('Ile coinsów chcesz postawić')
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('moneta')
        .setDescription('Zagraj w orzeł czy reszka')
        .addStringOption(option =>
            option.setName('wybor')
                .setDescription('Wybierz stronę monety')
                .setRequired(true)
                .addChoices(
                    { name: 'Orzeł', value: 'orzel' },
                    { name: 'Reszka', value: 'reszka' }
                ))
        .addIntegerOption(option =>
            option.setName('stawka')
                .setDescription('Ile coinsów chcesz postawić')
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('slot')
        .setDescription('Zagraj na maszynie losującej (jednoręki bandyta)')
        .addIntegerOption(option =>
            option.setName('stawka')
                .setDescription('Ile coinsów chcesz postawić')
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('poker')
        .setDescription('Zagraj w szybki poker z botem')
        .addIntegerOption(option =>
            option.setName('stawka')
                .setDescription('Ile coinsów chcesz postawić')
                .setRequired(true)),

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
        // 1. /balans
        if (commandName === 'balans') {
            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) {
                user = await UserModel.create({ userId: interaction.user.id, balance: 0 });
            }
            await interaction.reply({ content: `💰 Posiadasz aktualnie **${user.balance} PJN-Coins!**`, ephemeral: true });
            return;
        }

        // 2. /topka
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

        // 3. /daily
        else if (commandName === 'daily') {
            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) {
                user = await UserModel.create({ userId: interaction.user.id, balance: 0 });
            }

            const now = new Date();
            if (user.lastDaily) {
                const diffTime = now.getTime() - new Date(user.lastDaily).getTime();
                const diffHours = diffTime / (1000 * 60 * 60);
                if (diffHours < 24) {
                    const remainingHours = Math.ceil(24 - diffHours);
                    await interaction.reply({ content: `⏳ Odbierałeś już nagrodę dzisiaj! Spróbuj ponownie za około **${remainingHours}h**.`, ephemeral: true });
                    return;
                }
            }

            user.balance += 100;
            user.lastDaily = now;
            await user.save();

            await interaction.reply({ content: `🎁 Otrzymałeś codzienne **100 PJN-Coins**! Twój aktualny balans: **${user.balance}**` });
            return;
        }

        // 4. /kostka
        else if (commandName === 'kostka') {
            const stawka = interaction.options.getInteger('stawka', true);
            if (stawka <= 0) {
                await interaction.reply({ content: '❌ Stawka musi być większa od 0!', ephemeral: true });
                return;
            }

            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) {
                user = await UserModel.create({ userId: interaction.user.id, balance: 0 });
            }

            if (user.balance < stawka) {
                await interaction.reply({ content: `❌ Nie masz tylu coinsów! Posiadasz tylko **${user.balance} PJN-Coins**.`, ephemeral: true });
                return;
            }

            const userRoll = Math.floor(Math.random() * 6) + 1;
            const botRoll = Math.floor(Math.random() * 6) + 1;

            if (userRoll > botRoll) {
                user.balance += stawka;
                await user.save();
                await interaction.reply({ content: `🎲 Wyrzuciłeś **${userRoll}**, a bot **${botRoll}**. **Wygrywasz!** Zyskujesz **${stawka} PJN-Coins**. Nowy balans: **${user.balance}**` });
            } else if (userRoll < botRoll) {
                user.balance -= stawka;
                await user.save();
                await interaction.reply({ content: `🎲 Wyrzuciłeś **${userRoll}**, a bot **${botRoll}**. **Przegrywasz!** Tracisz **${stawka} PJN-Coins**. Nowy balans: **${user.balance}**` });
            } else {
                await interaction.reply({ content: `🎲 Wyrzuciłeś **${userRoll}**, a bot **${botRoll}**. **Remis!** Nic nie tracisz ani nie zyskujesz.` });
            }
            return;
        }

        // 5. /moneta
        else if (commandName === 'moneta') {
            const wybor = interaction.options.getString('wybor', true);
            const stawka = interaction.options.getInteger('stawka', true);

            if (stawka <= 0) {
                await interaction.reply({ content: '❌ Stawka musi być większa od 0!', ephemeral: true });
                return;
            }

            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) {
                user = await UserModel.create({ userId: interaction.user.id, balance: 0 });
            }

            if (user.balance < stawka) {
                await interaction.reply({ content: `❌ Nie masz tylu coinsów! Posiadasz tylko **${user.balance} PJN-Coins**.`, ephemeral: true });
                return;
            }

            const wynik = Math.random() < 0.5 ? 'orzel' : 'reszka';

            if (wybor === wynik) {
                user.balance += stawka;
                await user.save();
                await interaction.reply({ content: `🪙 Wypadł **${wynik}**! Obstawiałeś **${wybor}**. **Wygrywasz** ${stawka} PJN-Coins! Nowy balans: **${user.balance}**` });
            } else {
                user.balance -= stawka;
                await user.save();
                await interaction.reply({ content: `🪙 Wypadł **${wynik}**! Obstawiałeś **${wybor}**. **Przegrywasz** ${stawka} PJN-Coins. Nowy balans: **${user.balance}**` });
            }
            return;
        }

        // 6. /slot (automaty)
        else if (commandName === 'slot') {
            const stawka = interaction.options.getInteger('stawka', true);
            if (stawka <= 0) {
                await interaction.reply({ content: '❌ Stawka musi być większa od 0!', ephemeral: true });
                return;
            }

            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) {
                user = await UserModel.create({ userId: interaction.user.id, balance: 0 });
            }

            if (user.balance < stawka) {
                await interaction.reply({ content: `❌ Nie masz tylu coinsów! Posiadasz tylko **${user.balance} PJN-Coins**.`, ephemeral: true });
                return;
            }

            const owoce = ['🍒', '🍋', '🍊', '🍇', '🔔', '💎', '7️⃣'];
            const s1 = owoce[Math.floor(Math.random() * owoce.length)];
            const s2 = owoce[Math.floor(Math.random() * owoce.length)];
            const s3 = owoce[Math.floor(Math.random() * owoce.length)];

            let wygrana = 0;
            if (s1 === s2 && s2 === s3) {
                wygrana = stawka * 5; // Trzy takie same = 5x wygrana
                user.balance += wygrana;
                await user.save();
                await interaction.reply({ content: `🎰 [ ${s1} | ${s2} | ${s3} ]\n🎉 **JACKPOT!** Wszystkie symbole takie same! Wygrywasz **${wygrana} PJN-Coins**! Nowy balans: **${user.balance}**` });
            } else if (s1 === s2 || s2 === s3 || s1 === s3) {
                wygrana = Math.floor(stawka * 1.5); // Dwa takie same = 1.5x wygrana
                user.balance += (wygrana - stawka);
                await user.save();
                await interaction.reply({ content: `🎰 [ ${s1} | ${s2} | ${s3} ]\n✨ **Wygrana!** Dwa symbole są takie same. Zyskujesz **${wygrana - stawka} PJN-Coins**. Nowy balans: **${user.balance}**` });
            } else {
                user.balance -= stawka;
                await user.save();
                await interaction.reply({ content: `🎰 [ ${s1} | ${s2} | ${s3} ]\n😢 **Przegrana!** Nic nie trafiło. Tracisz **${stawka} PJN-Coins**. Nowy balans: **${user.balance}**` });
            }
            return;
        }

        // 7. /poker (szybki poker z botem)
        else if (commandName === 'poker') {
            const stawka = interaction.options.getInteger('stawka', true);
            if (stawka <= 0) {
                await interaction.reply({ content: '❌ Stawka musi być większa od 0!', ephemeral: true });
                return;
            }

            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) {
                user = await UserModel.create({ userId: interaction.user.id, balance: 0 });
            }

            if (user.balance < stawka) {
                await interaction.reply({ content: `❌ Nie masz tylu coinsów! Posiadasz tylko **${user.balance} PJN-Coins**.`, ephemeral: true });
                return;
            }

            const karty = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
            const userKarta = karty[Math.floor(Math.random() * karty.length)];
            const botKarta = karty[Math.floor(Math.random() * karty.length)];

            const userIndex = karty.indexOf(userKarta);
            const botIndex = karty.indexOf(botKarta);

            if (userIndex > botIndex) {
                user.balance += stawka;
                await user.save();
                await interaction.reply({ content: `🃏 Twoja karta: **${userKarta}** | Karta bota: **${botKarta}**\n🏆 **Wygrywasz pokerowe starcie!** Zyskujesz **${stawka} PJN-Coins**. Nowy balans: **${user.balance}**` });
            } else if (userIndex < botIndex) {
                user.balance -= stawka;
                await user.save();
                await interaction.reply({ content: `🃏 Twoja karta: **${userKarta}** | Karta bota: **${botKarta}**\n💀 **Bot ma mocniejszą kartę!** Przegrywasz **${stawka} PJN-Coins**. Nowy balans: **${user.balance}**` });
            } else {
                await interaction.reply({ content: `🃏 Twoja karta: **${userKarta}** | Karta bota: **${botKarta}**\n🤝 **Remis w kartach!** Stawka wraca do Ciebie.` });
            }
            return;
        }

        // 8. /rozdaj-wszystkim
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

        // 9. /dajpunkty
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

        // 10. /zabierzpunkty
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
