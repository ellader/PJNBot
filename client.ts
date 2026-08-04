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
    lastDaily: { type: Date, default: null },
    messageCount: { type: Number, default: 0 },
    emojiCount: { type: Number, default: 0 },
    voiceMinutes: { type: Number, default: 0 },
    casinoPlays: { type: Number, default: 0 },
    consecutiveWins: { type: Number, default: 0 },
    joinedAt: { type: Date, default: Date.now },
    badges: { type: [String], default: [] }
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

function isAuthorized(userId: string): boolean {
    const adminIds = ['1175798371995361343', '1493928957408448563'];
    return adminIds.includes(userId);
}

async function checkAndAwardBadges(user: any, memberOrUser: any) {
    const newBadges: string[] = [];
    const addBadge = (badgeName: string) => {
        if (!user.badges.includes(badgeName)) {
            user.badges.push(badgeName);
            newBadges.push(badgeName);
        }
    };

    if (user.messageCount >= 200) addBadge('💬 **Początkujący Gadulec**');
    if (user.messageCount >= 1000) addBadge('📜 **Kronikarz Chatu**');
    if (user.voiceMinutes >= 1800) addBadge('🎙️ **Stały Bywalec Mikrofonu**');
    if (user.balance >= 5000) addBadge('💰 **Kapitalista**');
    if (user.balance >= 10000) addBadge('💎 **Magnat Finansowy**');
    if (user.emojiCount >= 30) addBadge('😂 **Emotikonowy Ekspresja**');
    if (user.casinoPlays >= 20) addBadge('🎲 **Nałogowy Graczyk**');
    if (user.consecutiveWins >= 3) addBadge('🍀 **Ulubieniec Fortuna**');

    if (memberOrUser && memberOrUser.roles && typeof memberOrUser.roles.cache?.some === 'function') {
        const hasAdminRole = memberOrUser.roles.cache.some((role: any) => 
            role.name.toLowerCase() === 'admin' || role.name.toLowerCase() === 'administrator'
        );
        const hasStreamerRole = memberOrUser.roles.cache.some((role: any) => 
            role.name.toLowerCase() === 'streamer'
        );

        if (hasAdminRole || hasStreamerRole) {
            addBadge('🛡️ **Filar Społeczności**');
        }
    }

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
            if (guild) {
                const member = await guild.members.fetch(u.userId).catch(() => null);
                if (member) {
                    userName = member.displayName;
                } else {
                    const fetchedUser = await client.users.fetch(u.userId);
                    if (fetchedUser) userName = fetchedUser.username;
                }
            } else {
                const fetchedUser = await client.users.fetch(u.userId);
                if (fetchedUser) userName = fetchedUser.username;
            }
        } catch (e) {}

        desc += `${medal} **${userName}** — **${u.balance} PJN-Coins**\n`;
    }

    return {
        color: 0xFFD700,
        title: '🏆 TOP 10 - Ranking PJN-Coins',
        description: desc
    };
}

const commands = [
    new SlashCommandBuilder().setName('portfel').setDescription('Sprawdź stan swoich PJN-Coins w portfelu'),
    new SlashCommandBuilder().setName('topka').setDescription('Zobacz ranking najbogatszych graczy'),
    new SlashCommandBuilder().setName('daily').setDescription('Odbieraj codzienne 100 PJN-Coins (co 24h)'),
    new SlashCommandBuilder()
        .setName('kostka')
        .setDescription('Rzuć kością przeciwko botowi o stawkę')
        .addIntegerOption(o => o.setName('stawka').setDescription('Ile PJN-Coins postawić').setRequired(true)),
    new SlashCommandBuilder()
        .setName('moneta')
        .setDescription('Zagraj w orzeł czy reszka')
        .addStringOption(o => o.setName('wybor').setDescription('Wybierz stronę').setRequired(true).addChoices({name: 'Orzeł', value: 'orzel'}, {name: 'Reszka', value: 'reszka'}))
        .addIntegerOption(o => o.setName('stawka').setDescription('Ile PJN-Coins postawić').setRequired(true)),
    new SlashCommandBuilder()
        .setName('slot')
        .setDescription('Zagraj na maszynie losującej')
        .addIntegerOption(o => o.setName('stawka').setDescription('Ile PJN-Coins postawić').setRequired(true)),
    new SlashCommandBuilder()
        .setName('poker')
        .setDescription('Zagraj w pokera')
        .addStringOption(o => o.setName('tryb').setDescription('Tryb gry').setRequired(true).addChoices({name: 'Z ludźmi', value: 'ludzie'}, {name: 'Z botem', value: 'bot'}))
        .addIntegerOption(o => o.setName('stawka').setDescription('Wpisowe').setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('odznaki')
        .setDescription('Wyświetla profil z odznakami i statystykami')
        .addUserOption(o => o.setName('uzytkownik').setDescription('Kogo odznaki sprawdzić').setRequired(false)),
    new SlashCommandBuilder()
        .setName('daj-odznake')
        .setDescription('Ręcznie przyznaj oficjalną odznakę (Admin)')
        .addUserOption(o => o.setName('uzytkownik').setDescription('Komu').setRequired(true))
        .addStringOption(o => 
            o.setName('odznaka')
             .setDescription('Wybierz oficjalną odznakę z listy')
             .setRequired(true)
             .addChoices(
                 { name: '💬 Początkujący Gadulec', value: '💬 **Początkujący Gadulec**' },
                 { name: '📜 Kronikarz Chatu', value: '📜 **Kronikarz Chatu**' },
                 { name: '🎙️ Stały Bywalec Mikrofonu', value: '🎙️ **Stały Bywalec Mikrofonu**' },
                 { name: '💰 Kapitalista', value: '💰 **Kapitalista**' },
                 { name: '💎 Magnat Finansowy', value: '💎 **Magnat Finansowy**' },
                 { name: '😂 Emotikonowy Ekspresja', value: '😂 **Emotikonowy Ekspresja**' },
                 { name: '🎲 Nałogowy Graczyk', value: '🎲 **Nałogowy Graczyk**' },
                 { name: '🍀 Ulubieniec Fortuna', value: '🍀 **Ulubieniec Fortuna**' },
                 { name: '🛡️ Filar Społeczności', value: '🛡️ **Filar Społeczności**' },
                 { name: '⏳ Weteran Półrocza', value: '⏳ **Weteran Półrocza**' },
                 { name: '👑 Legenda Serwera', value: '👑 **Legenda Serwera**' }
             )
        ),
    new SlashCommandBuilder()
        .setName('zabierz-odznake')
        .setDescription('Odbierz odznakę (Admin)')
        .addUserOption(o => o.setName('uzytkownik').setDescription('Komu').setRequired(true))
        .addStringOption(o => o.setName('odznaka').setDescription('Nazwa odznaki').setRequired(true)),

    new SlashCommandBuilder()
        .setName('testogloszenia')
        .setDescription('Przetestuj wysyłanie ogłoszenia (Admin)')
        .addStringOption(o => o.setName('tresc').setDescription('Treść testowego ogłoszenia').setRequired(false))
        .addChannelOption(o => o.setName('kanal').setDescription('Kanał docelowy (opcjonalnie)').setRequired(false)),

    new SlashCommandBuilder()
        .setName('odpalstream')
        .setDescription('Wymuś ręczne ogłoszenie streama LangusPJN z Kicka'),
    new SlashCommandBuilder()
        .setName('zakonczstream')
        .setDescription('Wymuś ręczne zakończenie streama i przywrócenie statusu Offline'),

    new SlashCommandBuilder()
        .setName('nowosc')
        .setDescription('Opublikuj nową funkcję lub aktualizację na kanale nowości (Admin)')
        .addStringOption(o => o.setName('tytul').setDescription('Tytuł nowości').setRequired(true))
        .addStringOption(o => o.setName('opis').setDescription('Szczegółowy opis zmiany').setRequired(true)),

    new SlashCommandBuilder()
        .setName('rozdaj-wszystkim')
        .setDescription('Rozdaj PJN-Coinsy wszystkim')
        .addIntegerOption(o => o.setName('ilosc').setDescription('Liczba PJN-Coins').setRequired(true))
        .addStringOption(o => o.setName('powod').setDescription('Powód').setRequired(false)),
    new SlashCommandBuilder()
        .setName('dajpunkty')
        .setDescription('Dodaj PJN-Coins użytkownikowi')
        .addUserOption(o => o.setName('uzytkownik').setDescription('Użytkownik').setRequired(true))
        .addIntegerOption(o => o.setName('ilosc').setDescription('Ilość PJN-Coins').setRequired(true)),
    new SlashCommandBuilder()
        .setName('zabierzpunkty')
        .setDescription('Zabierz PJN-Coins użytkownikowi')
        .addUserOption(o => o.setName('uzytkownik').setDescription('Użytkownik').setRequired(true))
        .addIntegerOption(o => o.setName('ilosc').setDescription('Ilość PJN-Coins').setRequired(true))
].map(c => c.toJSON());

client.once('ready', async () => {
    console.log(`Zalogowano jako ${client.user?.tag}!`);

    const rest = new REST({ version: '10' }).setToken(token);
    try {
        console.log('Czyszczenie starych komend i rejestracja nowych...');
        await rest.put(Routes.applicationCommands(client.user!.id), { body: [] });

        for (const [_, guild] of client.guilds.cache) {
            await rest.put(Routes.applicationGuildCommands(client.user!.id, guild.id), { body: [] });
            await rest.put(Routes.applicationGuildCommands(client.user!.id, guild.id), { body: commands });
        }
        console.log('Zarejestrowano świeże komendy pomyślnie!');
    } catch (error) {
        console.error('Błąd rejestracji komend:', error);
    }

    // === AUTOMATYCZNE ZADANIA W TLE (np. sprawdzanie streamów / automatyzacje) ===
    setInterval(async () => {
        try {
            // Tutaj możesz umieścić cykliczną logikę (np. sprawdzanie Kick API co kilka minut)
        } catch (err) {
            console.error('Błąd w pętli automatycznej:', err);
        }
    }, 5 * 60 * 1000); // co 5 minut
});

client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    try {
        let user = await UserModel.findOne({ userId: message.author.id });
        if (!user) {
            user = await UserModel.create({ userId: message.author.id });
        }

        user.messageCount = (user.messageCount || 0) + 1;

        const customEmojis = message.content.match(/<a?:\w+:\d+>/g);
        if (customEmojis) {
            user.emojiCount = (user.emojiCount || 0) + customEmojis.length;
        }

        await user.save();
        await checkAndAwardBadges(user, message.member);
    } catch (error) {
        console.error('Błąd podczas naliczania wiadomości:', error);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName } = interaction;

    try {
        if (commandName === 'odznaki') {
            await interaction.deferReply({ ephemeral: true });

            const targetUser = interaction.options.getUser('uzytkownik') || interaction.user;
            let user = await UserModel.findOne({ userId: targetUser.id });
            if (!user) user = await UserModel.create({ userId: targetUser.id });

            const badgeText = user.badges && user.badges.length > 0 ? user.badges.join('\n') : 'Brak odznak.';

            await interaction.editReply({
                embeds: [{
                    color: 0x9B59B6,
                    title: `🛡️ Profil Odznak i Osiągnięć`,
                    description: `Użytkownik: <@${targetUser.id}>`,
                    thumbnail: { url: targetUser.displayAvatarURL() },
                    fields: [
                        { name: '🏅 Zdobyte Odznaki', value: badgeText, inline: false },
                        { name: '📊 Statystyki Aktywności', value: `💬 Wiadomości: **${user.messageCount || 0}**\n😂 Użyte emotki: **${user.emojiCount || 0}**\n💰 Portfel: **${user.balance || 0} PJN-Coins**`, inline: false }
                    ],
                    footer: { text: 'System Odznak PJN-Coins' }
                }]
            });
            return;
        }

        if (commandName === 'portfel') {
            await interaction.deferReply({ ephemeral: true });
            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) user = await UserModel.create({ userId: interaction.user.id });
            
            await interaction.editReply({ content: `💰 W swoim portfelu posiadasz aktualnie **${user.balance} PJN-Coins!**` });
            return;
        }

        if (commandName === 'topka') {
            await interaction.deferReply();
            const embedData = await getTopEmbedData(interaction.guild);
            await interaction.editReply({ embeds: [embedData] });
            return;
        }

        if (commandName === 'daily') {
            await interaction.deferReply();
            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) user = await UserModel.create({ userId: interaction.user.id });

            const now = new Date();
            if (user.lastDaily) {
                const diffHours = (now.getTime() - new Date(user.lastDaily).getTime()) / (1000 * 60 * 60);
                if (diffHours < 24) {
                    await interaction.editReply({ content: `⏳ Odbierałeś już nagrodę dzisiaj! Spróbuj za **${Math.ceil(24 - diffHours)}h**.` });
                    return;
                }
            }

            user.balance += 100;
            user.lastDaily = now;
            await user.save();
            await checkAndAwardBadges(user, interaction.member);

            await interaction.editReply({ content: `🎁 Otrzymałeś codzienne **100 PJN-Coins**! Stan portfela: **${user.balance} PJN-Coins**` });
            return;
        }

        if (commandName === 'dajpunkty') {
            if (!isAuthorized(interaction.user.id)) {
                await interaction.reply({ content: '❌ Nie masz uprawnień do używania tej komendy!', ephemeral: true });
                return;
            }

            await interaction.deferReply({ ephemeral: true });
            const targetUser = interaction.options.getUser('uzytkownik', true);
            const ilosc = interaction.options.getInteger('ilosc', true);

            let user = await UserModel.findOne({ userId: targetUser.id });
            if (!user) user = await UserModel.create({ userId: targetUser.id });

            user.balance += ilosc;
            await user.save();

            const member = await interaction.guild?.members.fetch(targetUser.id).catch(() => null);
            if (member) {
                await checkAndAwardBadges(user, member);
            }

            await interaction.editReply({ content: `✅ Pomyślnie dodano **${ilosc} PJN-Coins** dla użytkownika <@${targetUser.id}>. Nowy stan: **${user.balance} PJN-Coins**` });
            return;
        }

        if (commandName === 'zabierzpunkty') {
            if (!isAuthorized(interaction.user.id)) {
                await interaction.reply({ content: '❌ Nie masz uprawnień do używania tej komendy!', ephemeral: true });
                return;
            }

            await interaction.deferReply({ ephemeral: true });
            const targetUser = interaction.options.getUser('uzytkownik', true);
            const ilosc = interaction.options.getInteger('ilosc', true);

            let user = await UserModel.findOne({ userId: targetUser.id });
            if (!user) user = await UserModel.create({ userId: targetUser.id });

            user.balance = Math.max(0, user.balance - ilosc);
            await user.save();

            await interaction.editReply({ content: `✅ Pomyślnie zabrano **${ilosc} PJN-Coins** użytkownikowi <@${targetUser.id}>. Nowy stan: **${user.balance} PJN-Coins**` });
            return;
        }

        if (commandName === 'rozdaj-wszystkim') {
            if (!isAuthorized(interaction.user.id)) {
                await interaction.reply({ content: '❌ Nie masz uprawnień do używania tej komendy!', ephemeral: true });
                return;
            }

            await interaction.deferReply({ ephemeral: true });
            const ilosc = interaction.options.getInteger('ilosc', true);
            const powod = interaction.options.getString('powod') || 'Brak powódu';

            await UserModel.updateMany({}, { $inc: { balance: ilosc } });

            await interaction.editReply({ content: `🎁 Rozdano po **${ilosc} PJN-Coins** wszystkim użytkownikom w bazie!\n📌 Powód: *${powod}*` });
            return;
        }

        if (commandName === 'testogloszenia') {
            if (!isAuthorized(interaction.user.id)) {
                await interaction.reply({ content: '❌ Nie masz uprawnień do używania tej komendy!', ephemeral: true });
                return;
            }

            await interaction.reply({ content: 'wysyłanie testowego ogłoszenia...', ephemeral: true });
            
            const tresc = interaction.options.getString('tresc') || 'To jest domyślna treść testowego ogłoszenia.';
            
            const customChannelOpt = interaction.options.getChannel('kanal');
            let targetChannel: any = customChannelOpt;

            if (!targetChannel) {
                targetChannel = await client.channels.fetch('1532399010785263799').catch(() => null);
            }

            if (!targetChannel) {
                targetChannel = interaction.channel;
            }

            if (targetChannel && typeof targetChannel.send === 'function') {
                await targetChannel.send({
                    embeds: [{
                        color: 0x3498DB,
                        title: '📢 Test Ogłoszenia',
                        description: tresc,
                        footer: { text: `Wysłane przez ${interaction.user.tag}` },
                        timestamp: new Date().toISOString()
                    }]
                });
                await interaction.editReply({ content: `✅ Test ogłoszenia wysłany pomyślnie na kanał <#${targetChannel.id}>!` });
            } else {
                await interaction.editReply({ content: `❌ Nie udało się znaleźć docelowego kanału.` });
            }
            return;
        }

        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: `Komenda /${commandName} została wykonana.`, ephemeral: true });
        }

    } catch (error) {
        console.error(`Błąd w komendzie ${commandName}:`, error);
        try {
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: 'Wystąpił błąd podczas wykonywania tej komendy.' }).catch(() => {});
            } else {
                await interaction.reply({ content: 'Wystąpił błąd.', ephemeral: true }).catch(() => {});
            }
        } catch (e) {}
    }
});

client.login(token);
