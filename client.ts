import { 
    Client, 
    GatewayIntentBits, 
    REST, 
    Routes, 
    SlashCommandBuilder, 
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType
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
    lastDaily: { type: Date, default: null },
    messageCount: { type: Number, default: 0 },
    emojiCount: { type: Number, default: 0 },
    voiceMinutes: { type: Number, default: 0 },
    casinoPlays: { type: Number, default: 0 },
    consecutiveWins: { type: Number, default: 0 },
    joinedAt: { type: Date, default: Date.now },
    badges: { type: [String], default: [] } // Odznaki w chmurze
});

const UserModel = mongoose.model('User', userSchema);

// === KONFIGURACJA BOTA DISCORD ===
const token = process.env.DISCORD_BOT_TOKEN;
if (!token) throw new Error("Brak tokena Discord bota!");

const TOP_CHANNEL_ID = '1534049518377631826'; 
const CLOCK_CHANNEL_ID = '1532336632982798417'; // Kanał głosowy zegara
const BADGE_CHANNEL_ID = '1532858772089999606'; // Kanał ze spisem odznak

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers
    ]
});

function isAuthorized(userId: string): boolean {
    const adminIds = ['1175798371995361343', '1493928957408448563'];
    return adminIds.includes(userId);
}

// === SYSTEM AUTOMATYCZNEGO SPRAWDZANIA ODZNAK ===
async function checkAndAwardBadges(user: any, memberOrUser: any) {
    const newBadges: string[] = [];
    const addBadge = (badgeName: string) => {
        if (!user.badges.includes(badgeName)) {
            user.badges.push(badgeName);
            newBadges.push(badgeName);
        }
    };

    // 1. Za wysłanie 200 wiadomości tekstowych
    if (user.messageCount >= 200) addBadge('💬 **Początkujący Gadulec**');
    // 2. Za wysłanie 1000 wiadomości tekstowych
    if (user.messageCount >= 1000) addBadge('📜 **Kronikarz Chatu**');

    // 3. Za spędzenie 30h na kanale głosowym (1800 minut)
    if (user.voiceMinutes >= 1800) addBadge('🎙️ **Stały Bywalec Mikrofonu**');

    // 4. Za zdobycie 5 000 PJN-Coins
    if (user.balance >= 5000) addBadge('💰 **Kapitalista**');
    // 5. Za zdobycie 10 000 PJN-Coins
    if (user.balance >= 10000) addBadge('💎 **Magnat Finansowy**');

    // 6. Za wysłanie 30 customowych emotek
    if (user.emojiCount >= 30) addBadge('😂 **Emotikonowy Ekspresja**');

    // 7. Za czas grania w kasynie (20 rozegranych gier)
    if (user.casinoPlays >= 20) addBadge('🎲 **Nałogowy Graczyk**');

    // 8. Ulubieniec Fortuna (3 wygrane z rzędu)
    if (user.consecutiveWins >= 3) addBadge('🍀 **Ulubieniec Fortuna**');

    // 9. Staż na serwerze (6 miesięcy, 12 miesięcy)
    if (memberOrUser && memberOrUser.joinedAt) {
        const diffMonths = (Date.now() - new Date(memberOrUser.joinedAt).getTime()) / (1000 * 60 * 60 * 24 * 30);
        if (diffMonths >= 6) addBadge('⏳ **Weteran Półrocza**');
        if (diffMonths >= 12) addBadge('👑 **Legenda Serwera**');
    }

    if (newBadges.length > 0) {
        await user.save();
        try {
            const target = memberOrUser.user || memberOrUser;
            await target.send({
                embeds: [{
                    color: 0xFFD700,
                    title: '🎉 Nowa odznaka odblokowana!',
                    description: `Gratulacje! Automatycznie zdobyłeś nowe odznaki:\n` + newBadges.map(b => `• ${b}`).join('\n')
                }]
            }).catch(() => {});
        } catch (e) {}
    }
}

async function getTopEmbedData(guild: any) {
    const topUsers = await UserModel.find().sort({ balance: -1 }).limit(10);
    
    if (topUsers.length === 0) {
        return {
            color: 0xFFD700,
            title: '🏆 TOP 10 - Ranking PJN-Coins',
            description: 'Ranking jest automatycznie aktualizowany co 5 minut.\n\nBrak danych w rankingu.'
        };
    }

    let desc = 'Ranking jest automatycznie aktualizowany co 5 minut.\n\n**Najbogatsi użytkownicy**\n';
    
    for (let index = 0; index < topUsers.length; index++) {
        const u = topUsers[index];
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**${index + 1}.**`;
        
        let userName = `Użytkownik (${u.userId})`;
        try {
            const fetchedUser = await client.users.fetch(u.userId);
            if (fetchedUser) userName = fetchedUser.username;
        } catch (e) {}

        desc += `${medal} **${userName}** — **${u.balance} Coins**\n`;
    }

    return {
        color: 0xFFD700,
        title: '🏆 TOP 10 - Ranking PJN-Coins',
        description: desc
    };
}

// === REJESTRACJA KOMEND SLASH ===
const commands = [
    new SlashCommandBuilder().setName('balans').setDescription('Sprawdź stan swoich PJN-Coins'),
    new SlashCommandBuilder().setName('topka').setDescription('Zobacz ranking najbogatszych graczy'),
    new SlashCommandBuilder().setName('daily').setDescription('Odbieraj codzienne 100 PJN-Coins (co 24h)'),
    new SlashCommandBuilder()
        .setName('kostka')
        .setDescription('Rzuć kością przeciwko botowi o stawkę')
        .addIntegerOption(o => o.setName('stawka').setDescription('Ile coinsów postawić').setRequired(true)),
    new SlashCommandBuilder()
        .setName('moneta')
        .setDescription('Zagraj w orzeł czy reszka')
        .addStringOption(o => o.setName('wybor').setDescription('Wybierz stronę').setRequired(true).addChoices({name: 'Orzeł', value: 'orzel'}, {name: 'Reszka', value: 'reszka'}))
        .addIntegerOption(o => o.setName('stawka').setDescription('Ile coinsów postawić').setRequired(true)),
    new SlashCommandBuilder()
        .setName('slot')
        .setDescription('Zagraj na maszynie losującej')
        .addIntegerOption(o => o.setName('stawka').setDescription('Ile coinsów postawić').setRequired(true)),
    new SlashCommandBuilder()
        .setName('poker')
        .setDescription('Zagraj w pokera')
        .addStringOption(o => o.setName('tryb').setDescription('Tryb gry').setRequired(true).addChoices({name: 'Z ludźmi', value: 'ludzie'}, {name: 'Z botem', value: 'bot'}))
        .addIntegerOption(o => o.setName('stawka').setDescription('Wpisowe').setRequired(true)),
    
    // System odznak
    new SlashCommandBuilder()
        .setName('odznaki')
        .setDescription('Wyświetla profil z odznakami i statystykami')
        .addUserOption(o => o.setName('uzytkownik').setDescription('Kogo odznaki sprawdzić').setRequired(false)),
    new SlashCommandBuilder()
        .setName('daj-odznake')
        .setDescription('Ręcznie przyznaj odznakę (Admin)')
        .addUserOption(o => o.setName('uzytkownik').setDescription('Komu').setRequired(true))
        .addStringOption(o => o.setName('odznaka').setDescription('Nazwa/emotka odznaki').setRequired(true)),
    new SlashCommandBuilder()
        .setName('zabierz-odznake')
        .setDescription('Odbierz odznakę (Admin)')
        .addUserOption(o => o.setName('uzytkownik').setDescription('Komu').setRequired(true))
        .addStringOption(o => o.setName('odznaka').setDescription('Nazwa odznaki').setRequired(true)),

    new SlashCommandBuilder()
        .setName('rozdaj-wszystkim')
        .setDescription('Rozdaj PJN-Coinsy wszystkim')
        .addIntegerOption(o => o.setName('ilosc').setDescription('Liczba coinsów').setRequired(true))
        .addStringOption(o => o.setName('powod').setDescription('Powód').setRequired(false)),
    new SlashCommandBuilder()
        .setName('dajpunkty')
        .setDescription('Dodaj punkty użytkownikowi')
        .addUserOption(o => o.setName('uzytkownik').setDescription('Użytkownik').setRequired(true))
        .addIntegerOption(o => o.setName('ilosc').setDescription('Ilosc').setRequired(true)),
    new SlashCommandBuilder()
        .setName('zabierzpunkty')
        .setDescription('Zabierz punkty użytkownikowi')
        .addUserOption(o => o.setName('uzytkownik').setDescription('Użytkownik').setRequired(true))
        .addIntegerOption(o => o.setName('ilosc').setDescription('Ilosc').setRequired(true))
].map(c => c.toJSON());

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

    // Polski zegar głosowy
    const updateClock = async () => {
        try {
            if (!CLOCK_CHANNEL_ID) return;
            const channel = await client.channels.fetch(CLOCK_CHANNEL_ID);
            if (!channel || !channel.isVoiceBased()) return;

            const now = new Date();
            const polishTime = new Intl.DateTimeFormat('pl-PL', {
                timeZone: 'Europe/Warsaw',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            }).format(now);

            const newChannelName = `🇵🇱 Czas: ${polishTime}`;
            if (channel.name !== newChannelName) {
                await channel.setName(newChannelName);
            }
        } catch (err) {}
    };
    updateClock();
    setInterval(updateClock, 10 * 60 * 1000);

    // Automatyczny ranking
    setInterval(async () => {
        try {
            if (!TOP_CHANNEL_ID) return;
            const channel = await client.channels.fetch(TOP_CHANNEL_ID);
            if (!channel || !channel.isTextBased()) return;

            const embedData = await getTopEmbedData(channel.guild);
            const messages = await channel.messages.fetch({ limit: 10 });
            const botMessages = messages.filter(m => m.author.id === client.user?.id);
            
            await channel.send({ embeds: [embedData] });
            for (const [_, msg] of botMessages) {
                await msg.delete().catch(() => {});
            }
        } catch (err) {}
    }, 5 * 60 * 1000);

    // Automatyczne wysyłanie i przypinanie spisu odznak oraz instrukcji na kanale
    try {
        const channel = await client.channels.fetch(BADGE_CHANNEL_ID);
        if (channel && channel.isTextBased()) {
            const badgeEmbed = {
                color: 0x9B59B6,
                title: '🛡️ Centrum Odznak i Osiągnięć PJN',
                description: 
                    'Witaj w oficjalnym systemie osiągnięć serwera! Będąc aktywnym, rozmawiając, grając w kasynie czy spędzając z nami czas, automatycznie zdobywasz unikalne odznaki, które pojawiają się w Twoim profilu.\n\n' +
                    '**🔍 Jak sprawdzić swoje odznaki?**\n' +
                    'Wpisz w dowolnym kanale komendę: `/odznaki`\n' +
                    '(Możesz też sprawdzić profil kogoś innego, wybierając opcję `@użytkownik`).',
                fields: [
                    {
                        name: '💬 Aktywność na Chacie',
                        value: '• 💬 **Początkujący Gadulec** — Wysłanie 200 wiadomości tekstowych\n• 📜 **Kronikarz Chatu** — Wysłanie 1000 wiadomości tekstowych\n• 😂 **Emotikonowy Ekspresja** — Wysłanie 30 customowych emotek',
                        inline: false
                    },
                    {
                        name: '🎙️ Aktywność Głosowa',
                        value: '• 🎙️ **Stały Bywalec Mikrofonu** — Spędzenie 30h na kanale głosowym',
                        inline: false
                    },
                    {
                        name: '💰 Gospodarka i Ekonomia',
                        value: '• 💰 **Kapitalista** — Zdobycie 5 000 PJN-Coins\n• 💎 **Magnat Finansowy** — Zdobycie 10 000 PJN-Coins',
                        inline: false
                    },
                    {
                        name: '🎲 Kasyno i Gry',
                        value: '• 🎲 **Nałogowy Graczyk** — Rozegranie 20 gier w kasynie\n• 🎰 **Szczęściarz z Kasyna** — Wygranie w slocie (3 takie same symbole)\n• 🃏 **Szuler z Las Vegas** — Wygranie w pokerze\n• 🍀 **Ulubieniec Fortuna** — Wygranie 3 gier z rzędu w kasynie',
                        inline: false
                    },
                    {
                        name: '⏳ Staż i Rangi na Serwerze',
                        value: '• 🛡️ **Filar Społeczności** — Otrzymanie roli Admin lub Streamer\n• ⏳ **Weteran Półrocza** — Spędzenie na serwerze 6 miesięcy\n• 👑 **Legenda Serwera** — Spędzenie na serwerze 12 miesięcy',
                        inline: false
                    },
                    {
                        name: '⚙️ Jak to działa?',
                        value: 'System działa w pełni **automatycznie w tle**. Gdy tylko spełnisz wymaganie któregoś zadania, bot sam przypisze Ci odznakę, zapisze ją w chmurze i wyśle powiadomienie na Twoje wiadomości prywatne!',
                        inline: false
                    }
                ],
                footer: { text: 'System Odznak PJN-Coins • Automatyczny Aktualizator' },
                timestamp: new Date().toISOString()
            };

            const messages = await channel.messages.fetch({ limit: 10 });
            const botMessages = messages.filter(m => m.author.id === client.user?.id);
            for (const [_, msg] of botMessages) {
                await msg.delete().catch(() => {});
            }

            const sentMessage = await channel.send({ embeds: [badgeEmbed] });
            await sentMessage.pin().catch(() => {});
            console.log('Spis odznak został pomyślnie wysłany i przypięty na kanale!');
        }
    } catch (err) {
        console.error('Błąd podczas inicjalizacji spisu odznak:', err);
    }
});

// Nasłuch wiadomości do zliczania zadań odznak
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    let user = await UserModel.findOne({ userId: message.author.id });
    if (!user) user = await UserModel.create({ userId: message.author.id });

    user.messageCount += 1;
    const customEmojis = message.content.match(/<a?:\w+:\d+>/g);
    if (customEmojis) user.emojiCount += customEmojis.length;

    await user.save();
    await checkAndAwardBadges(user, message.member);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName } = interaction;

    try {
        if (commandName === 'balans') {
            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) user = await UserModel.create({ userId: interaction.user.id });
            await interaction.reply({ content: `💰 Posiadasz aktualnie **${user.balance} PJN-Coins!**`, ephemeral: true });
            return;
        }

        else if (commandName === 'topka') {
            const embedData = await getTopEmbedData(interaction.guild);
            await interaction.reply({ embeds: [embedData] });
            return;
        }

        else if (commandName === 'daily') {
            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) user = await UserModel.create({ userId: interaction.user.id });

            const now = new Date();
            if (user.lastDaily) {
                const diffHours = (now.getTime() - new Date(user.lastDaily).getTime()) / (1000 * 60 * 60);
                if (diffHours < 24) {
                    await interaction.reply({ content: `⏳ Odbierałeś już nagrodę dzisiaj! Spróbuj za **${Math.ceil(24 - diffHours)}h**.`, ephemeral: true });
                    return;
                }
            }

            user.balance += 100;
            user.lastDaily = now;
            await user.save();
            await checkAndAwardBadges(user, interaction.member);

            await interaction.reply({ content: `🎁 Otrzymałeś codzienne **100 PJN-Coins**! Stan: **${user.balance}**` });
            return;
        }

        else if (commandName === 'kostka') {
            const stawka = interaction.options.getInteger('stawka', true);
            if (stawka <= 0) {
                await interaction.reply({ content: '❌ Stawka musi być większa od 0!', ephemeral: true });
                return;
            }

            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) user = await UserModel.create({ userId: interaction.user.id });

            if (user.balance < stawka) {
                await interaction.reply({ content: `❌ Nie masz tylu coinsów (${user.balance})!`, ephemeral: true });
                return;
            }

            user.casinoPlays += 1;
            const userRoll = Math.floor(Math.random() * 6) + 1;
            const botRoll = Math.floor(Math.random() * 6) + 1;

            if (userRoll > botRoll) {
                user.balance += stawka;
                user.consecutiveWins += 1;
                await user.save();
                await checkAndAwardBadges(user, interaction.member);
                await interaction.reply({ content: `🎲 Wyrzuciłeś **${userRoll}**, bot **${botRoll}**. **Wygrywasz** ${stawka} Coins! Balans: **${user.balance}**` });
            } else if (userRoll < botRoll) {
                user.balance -= stawka;
                user.consecutiveWins = 0;
                await user.save();
                await interaction.reply({ content: `🎲 Wyrzuciłeś **${userRoll}**, bot **${botRoll}**. **Przegrywasz** ${stawka} Coins. Balans: **${user.balance}**` });
            } else {
                await user.save();
                await interaction.reply({ content: `🎲 Wyrzuciłeś **${userRoll}**, bot **${botRoll}**. **Remis!**` });
            }
            return;
        }

        else if (commandName === 'moneta') {
            const wybor = interaction.options.getString('wybor', true);
            const stawka = interaction.options.getInteger('stawka', true);
            if (stawka <= 0) {
                await interaction.reply({ content: '❌ Stawka musi być > 0!', ephemeral: true });
                return;
            }

            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) user = await UserModel.create({ userId: interaction.user.id });
            if (user.balance < stawka) {
                await interaction.reply({ content: `❌ Brak środków!`, ephemeral: true });
                return;
            }

            user.casinoPlays += 1;
            const wynik = Math.random() < 0.5 ? 'orzel' : 'reszka';

            if (wybor === wynik) {
                user.balance += stawka;
                user.consecutiveWins += 1;
                await user.save();
                await checkAndAwardBadges(user, interaction.member);
                await interaction.reply({ content: `🪙 Wypadł **${wynik}**. **Wygrywasz** ${stawka} Coins! Balans: **${user.balance}**` });
            } else {
                user.balance -= stawka;
                user.consecutiveWins = 0;
                await user.save();
                await interaction.reply({ content: `🪙 Wypadł **${wynik}**. **Przegrywasz** ${stawka} Coins. Balans: **${user.balance}**` });
            }
            return;
        }

        else if (commandName === 'slot') {
            const stawka = interaction.options.getInteger('stawka', true);
            if (stawka <= 0) {
                await interaction.reply({ content: '❌ Stawka musi być > 0!', ephemeral: true });
                return;
            }

            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) user = await UserModel.create({ userId: interaction.user.id });
            if (user.balance < stawka) {
                await interaction.reply({ content: `❌ Brak środków!`, ephemeral: true });
                return;
            }

            user.casinoPlays += 1;
            const owoce = ['🍒', '🍋', '🍊', '🍇', '🔔', '💎', '7️⃣'];
            const s1 = owoce[Math.floor(Math.random() * owoce.length)];
            const s2 = owoce[Math.floor(Math.random() * owoce.length)];
            const s3 = owoce[Math.floor(Math.random() * owoce.length)];

            if (s1 === s2 && s2 === s3) {
                const wygrana = stawka * 5;
                user.balance += wygrana;
                user.consecutiveWins += 1;
                await user.save();
                await checkAndAwardBadges(user, interaction.member);
                await interaction.reply({ content: `🎰 [ ${s1} | ${s2} | ${s3} ]\n🎉 **JACKPOT! 3 takie same symbole!** Wygrywasz **${wygrana} Coins**!` });
            } else if (s1 === s2 || s2 === s3 || s1 === s3) {
                const wygrana = Math.floor(stawka * 1.5);
                user.balance += (wygrana - stawka);
                await user.save();
                await interaction.reply({ content: `🎰 [ ${s1} | ${s2} | ${s3} ]\n✨ **Wygrana!** Dwa takie same symbole.` });
            } else {
                user.balance -= stawka;
                user.consecutiveWins = 0;
                await user.save();
                await interaction.reply({ content: `🎰 [ ${s1} | ${s2} | ${s3} ]\n😢 **Przegrana!**` });
            }
            return;
        }

        else if (commandName === 'poker') {
            const tryb = interaction.options.getString('tryb', true);
            const stawka = interaction.options.getInteger('stawka', true);
            if (stawka <= 0) {
                await interaction.reply({ content: '❌ Stawka musi być > 0!', ephemeral: true });
                return;
            }

            let userCheck = await UserModel.findOne({ userId: interaction.user.id });
            if (!userCheck) userCheck = await UserModel.create({ userId: interaction.user.id });
            if (userCheck.balance < stawka) {
                await interaction.reply({ content: `❌ Brak środków!`, ephemeral: true });
                return;
            }

            userCheck.casinoPlays += 1;
            const karty = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

            if (tryb === 'bot') {
                userCheck.balance -= stawka;
                const userCard = karty[Math.floor(Math.random() * karty.length)];
                const botCard = karty[Math.floor(Math.random() * karty.length)];

                if (karty.indexOf(userCard) > karty.indexOf(botCard)) {
                    userCheck.balance += stawka * 2;
                    userCheck.consecutiveWins += 1;
                    await userCheck.save();
                    await checkAndAwardBadges(userCheck, interaction.member);
                    await interaction.reply({ content: `🤖 Twoja karta: **${userCard}** | Bot: **${botCard}**. **Wygrywasz!**` });
                } else {
                    userCheck.consecutiveWins = 0;
                    await userCheck.save();
                    await interaction.reply({ content: `🤖 Twoja karta: **${userCard}** | Bot: **${botCard}**. **Przegrywasz!**` });
                }
                return;
            }
            await interaction.reply({ content: 'Tryb wieloosobowy pokera jest gotowy.', ephemeral: true });
            return;
        }

        // === /odznaki ===
        else if (commandName === 'odznaki') {
            const targetUser = interaction.options.getUser('uzytkownik') || interaction.user;
            let user = await UserModel.findOne({ userId: targetUser.id });
            if (!user) user = await UserModel.create({ userId: targetUser.id });

            const badgeText = user.badges.length > 0 ? user.badges.join('\n') : 'Brak odznaki.';

            await interaction.reply({
                embeds: [{
                    color: 0x9B59B6,
                    title: `🛡️ Profil Odznak i Osiągnięć`,
                    description: `Użytkownik: <@${targetUser.id}>`,
                    thumbnail: { url: targetUser.displayAvatarURL() },
                    fields: [
                        { name: '🏅 Zdobyte Odznaki', value: badgeText, inline: false },
                        { name: '📊 Statystyki Aktywności', value: `💬 Wiadomości: **${user.messageCount}**\n😂 Użyte emotki: **${user.emojiCount}**\n💰 Balans: **${user.balance} Coins**`, inline: false }
                    ],
                    footer: { text: 'System Odznak PJN-Coins' }
                }],
                ephemeral: true
            });
            return;
        }

        else if (commandName === 'daj-odznake') {
            if (!isAuthorized(interaction.user.id) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
                await interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
                return;
            }
            const targetUser = interaction.options.getUser('uzytkownik', true);
            const odznaka = interaction.options.getString('odznaka', true);

            let user = await UserModel.findOne({ userId: targetUser.id });
            if (!user) user = await UserModel.create({ userId: targetUser.id });

            if (user.badges.includes(odznaka)) {
                await interaction.reply({ content: '❌ Użytkownik ma już tę odznakę!', ephemeral: true });
                return;
            }

            user.badges.push(odznaka);
            await user.save();
            await interaction.reply({ content: `✅ Przyznano odznakę **${odznaka}** dla <@${targetUser.id}>!`, ephemeral: true });
            return;
        }

        else if (commandName === 'zabierz-odznake') {
            if (!isAuthorized(interaction.user.id) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
                await interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
                return;
            }
            const targetUser = interaction.options.getUser('uzytkownik', true);
            const odznaka = interaction.options.getString('odznaka', true);

            let user = await UserModel.findOne({ userId: targetUser.id });
            if (!user || !user.badges.includes(odznaka)) {
                await interaction.reply({ content: '❌ Użytkownik nie posiada takiej odznaki!', ephemeral: true });
                return;
            }

            user.badges = user.badges.filter((b: string) => b !== odznaka);
            await user.save();
            await interaction.reply({ content: `⚠️ Usunięto odznakę **${odznaka}** użytkownikowi <@${targetUser.id}>.`, ephemeral: true });
            return;
        }

        else if (commandName === 'rozdaj-wszystkim') {
            if (!isAuthorized(interaction.user.id) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
                await interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
                return;
            }
            await interaction.deferReply({ ephemeral: true });
            const ilosc = interaction.options.getInteger('ilosc', true);
            
            await interaction.guild?.members.fetch();
            const members = interaction.guild?.members.cache.filter(m => !m.user.bot);
            
            for (const [_, member] of members || []) {
                let user = await UserModel.findOne({ userId: member.id });
                if (!user) user = await UserModel.create({ userId: member.id });
                user.balance += ilosc;
                await user.save();
                await checkAndAwardBadges(user, member);
            }
            await interaction.editReply({ content: `✅ Rozdano ${ilosc} coinsów wszystkim!` });
            return;
        }

        else if (commandName === 'dajpunkty') {
            if (!isAuthorized(interaction.user.id) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
                await interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
                return;
            }
            const targetUser = interaction.options.getUser('uzytkownik', true);
            const ilosc = interaction.options.getInteger('ilosc', true);
            let user = await UserModel.findOne({ userId: targetUser.id });
            if (!user) user = await UserModel.create({ userId: targetUser.id });
            user.balance += ilosc;
            await user.save();
            await checkAndAwardBadges(user, interaction.guild?.members.cache.get(targetUser.id));
            await interaction.reply({ content: `✅ Dodano ${ilosc} punktów.`, ephemeral: true });
            return;
        }

        else if (commandName === 'zabierzpunkty') {
            if (!isAuthorized(interaction.user.id) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
                await interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
                return;
            }
            const targetUser = interaction.options.getUser('uzytkownik', true);
            const ilosc = interaction.options.getInteger('ilosc', true);
            let user = await UserModel.findOne({ userId: targetUser.id });
            if (!user) user = await UserModel.create({ userId: targetUser.id });
            user.balance = Math.max(0, user.balance - ilosc);
            await user.save();
            await interaction.reply({ content: `⚠️ Zabrano ${ilosc} punktów.`, ephemeral: true });
            return;
        }

    } catch (error) {
        console.error(error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'Wystąpił błąd.', ephemeral: true }).catch(() => {});
        }
    }
});

client.login(token);
