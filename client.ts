import { 
    Client, 
    GatewayIntentBits, 
    REST, 
    Routes, 
    SlashCommandBuilder,
    TextChannel,
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

// Schemat do zapamiętywania kanału i ID ostatniej wiadomości rankingu w bazie
const configSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    channelId: { type: String, required: true },
    messageId: { type: String, required: true }
});
const ConfigModel = mongoose.model('Config', configSchema);

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
            description: 'Ranking jest automatycznie aktualizowany co 5 minut.\n\nNajbogatsi użytkownicy\n\nBrak danych w rankingu.'
        };
    }

    let desc = 'Ranking jest automatycznie aktualizowany co 5 minut.\n\nNajbogatsi użytkownicy\n';
    
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

        desc += `${medal} ${userName} — **${u.balance} PJN-Coins**\n`;
    }

    return {
        color: 0xFFD700,
        title: '🏆 TOP 10 - Ranking PJN-Coins',
        description: desc
    };
}

// Funkcja odpowiedzialna za kasowanie starej wiadomości i wysyłanie nowej co 5 minut
async function startTopUpdater() {
    setInterval(async () => {
        try {
            const config = await ConfigModel.findOne({ key: 'topka_msg' });
            if (!config) return;

            const channel = await client.channels.fetch(config.channelId).catch(() => null) as TextChannel;
            if (!channel) return;

            // 1. Próba znalezienia i usunięcia starej wiadomości
            const oldMessage = await channel.messages.fetch(config.messageId).catch(() => null);
            if (oldMessage) {
                await oldMessage.delete().catch(() => {});
            }

            // 2. Wygenerowanie i wysłanie nowej wiadomości z rankingiem
            const embedData = await getTopEmbedData(channel.guild);
            const newMessage = await channel.send({ embeds: [embedData] });

            // 3. Zapisanie nowego ID wiadomości w bazie danych
            config.messageId = newMessage.id;
            await config.save();

            console.log('Skasowano starą i wysłano nową topkę PJN-Coins.');
        } catch (err) {
            console.error('Błąd podczas automatycznej aktualizacji (usuwania/wysyłania) topki:', err);
        }
    }, 5 * 60 * 1000); // Co 5 minut
}

// Funkcja odpowiedzialna za wysyłanie ogłoszenia co godzinę z grafiką
function startHourlyAnnouncements() {
    setInterval(async () => {
        try {
            const channelId = '1532399010785263799'; // Kanał ogłoszeń
            const channel = await client.channels.fetch(channelId).catch(() => null) as TextChannel;
            
            if (!channel) return;

            await channel.send({
                embeds: [{
                    color: 0x3498DB,
                    title: '☀️ Witamy na PJN Server!',
                    description: 
                        'Cieszymy się, że jesteś częścią naszej społeczności! Pamiętaj, aby regularnie wspierać nasze projekty i śledzić oficjalne profile streamingowe:\n\n' +
                        '🔗 **TikTok**\n[tiktok.com/@languspjn](https://tiktok.com/@languspjn)\n\n' +
                        '🔗 **Kick**\n[kick.com/LangusPJN](https://kick.com/LangusPJN)\n\n' +
                        '💡 **Społeczność**\n' +
                        'Zostaw po sobie ślad, zaproś znajomych na nasz serwer Discord i buduj z nami najlepszą społeczność w sieci! 🚀\n\n' +
                        '*Życzymy aby Twoja obecność na naszym serwerze przebiegła jak najlepiej - LangusPJN i ellader*',
                    image: {
                        url: 'https://cdn.discordapp.com/attachments/1532862421729808565/1532865034642919574/1784490427936.png'
                    },
                    footer: {
                        text: 'PJN System Ogłoszeń'
                    },
                    timestamp: new Date().toISOString()
                }]
            });
            
            console.log('Wysłano automatyczne ogłoszenie godzinowe.');
        } catch (err) {
            console.error('Błąd podczas wysyłania godzinnego ogłoszenia:', err);
        }
    }, 60 * 60 * 1000); // Co 1 godzinę
}

const commands = [
    new SlashCommandBuilder().setName('portfel').setDescription('Sprawdź stan swoich PJN-Coins w portfelu'),
    new SlashCommandBuilder().setName('topka').setDescription('Zobacz ranking najbogatszych graczy'),
    new SlashCommandBuilder()
        .setName('ustaw-topke')
        .setDescription('Ustaw ten kanał jako automatyczny ranking top 10 (Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
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

    // Uruchomienie automatycznego cyklu usuwania i wysyłania nowej topki (co 5 min)
    startTopUpdater();

    // Uruchomienie automatycznego wysyłania ogłoszenia co godzinę z grafiką
    startHourlyAnnouncements();
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
        if (commandName === 'ustaw-topke') {
            if (!isAuthorized(interaction.user.id)) {
                await interaction.reply({ content: '❌ Nie masz uprawnień!', ephemeral: true });
                return;
            }

            await interaction.deferReply({ ephemeral: true });
            
            // Opcjonalnie: skasuj poprzednią globalną topkę, jeśli była w bazie, żeby nie dublować
            const oldConfig = await ConfigModel.findOne({ key: 'topka_msg' });
            if (oldConfig) {
                try {
                    const oldChan = await client.channels.fetch(oldConfig.channelId).catch(() => null) as TextChannel;
                    if (oldChan) {
                        const oldMsg = await oldChan.messages.fetch(oldConfig.messageId).catch(() => null);
                        if (oldMsg) await oldMsg.delete().catch(() => {});
                    }
                } catch (e) {}
            }

            const embedData = await getTopEmbedData(interaction.guild);
            const sentMessage = await interaction.channel?.send({ embeds: [embedData] });

            if (sentMessage) {
                await ConfigModel.findOneAndUpdate(
                    { key: 'topka_msg' },
                    { channelId: interaction.channelId, messageId: sentMessage.id },
                    { upsert: true, new: true }
                );
                await interaction.editReply({ content: `✅ Pomyślnie ustawiono ten kanał jako automatyczny ranking! Co 5 minut stara wiadomość będzie kasowana, a w jej miejsce wskoczy nowa.` });
            } else {
                await interaction.editReply({ content: `❌ Nie udało się wysłać wiadomości na tym kanale.` });
            }
            return;
        }

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

        // === GIERKI KASYNOWE ===
        if (commandName === 'kostka') {
            await interaction.deferReply();
            const stawka = interaction.options.getInteger('stawka', true);
            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) user = await UserModel.create({ userId: interaction.user.id });

            if (user.balance < stawka || stawka <= 0) {
                await interaction.editReply({ content: `❌ Nie masz tylu PJN-Coins w portfelu lub stawka jest nieprawidłowa!` });
                return;
            }

            user.casinoPlays = (user.casinoPlays || 0) + 1;
            const rzutGracza = Math.floor(Math.random() * 6) + 1;
            const rzutBota = Math.floor(Math.random() * 6) + 1;

            if (rzutGracza > rzutBota) {
                user.balance += stawka;
                user.consecutiveWins = (user.consecutiveWins || 0) + 1;
                await user.save();
                await checkAndAwardBadges(user, interaction.member);
                await interaction.editReply({ content: `🎲 Wyrzuciłeś **${rzutGracza}**, a bot **${rzutBota}**.\n🎉 **Wygrywasz!** Zyskujesz **${stawka} PJN-Coins**. Stan: **${user.balance}**` });
            } else if (rzutGracza < rzutBota) {
                user.balance -= stawka;
                user.consecutiveWins = 0;
                await user.save();
                await interaction.editReply({ content: `🎲 Wyrzuciłeś **${rzutGracza}**, a bot **${rzutBota}**.\n😢 **Przegrywasz** **${stawka} PJN-Coins**. Stan: **${user.balance}**` });
            } else {
                await interaction.editReply({ content: `🎲 Wyrzuciłeś **${rzutGracza}**, a bot **${rzutBota}**.\n🤝 **Remis!** Nic nie tracisz ani nie zyskujesz.` });
            }
            return;
        }

        if (commandName === 'moneta') {
            await interaction.deferReply();
            const wybor = interaction.options.getString('wybor', true);
            const stawka = interaction.options.getInteger('stawka', true);
            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) user = await UserModel.create({ userId: interaction.user.id });

            if (user.balance < stawka || stawka <= 0) {
                await interaction.editReply({ content: `❌ Nie masz tylu PJN-Coins w portfelu lub stawka jest nieprawidłowa!` });
                return;
            }

            user.casinoPlays = (user.casinoPlays || 0) + 1;
            const wynik = Math.random() < 0.5 ? 'orzel' : 'reszka';

            if (wybor === wynik) {
                user.balance += stawka;
                user.consecutiveWins = (user.consecutiveWins || 0) + 1;
                await user.save();
                await checkAndAwardBadges(user, interaction.member);
                await interaction.editReply({ content: `🪙 Wypadło: **${wynik === 'orzel' ? 'Orzeł' : 'Reszka'}**.\n🎉 Trafiłeś! Wygrywasz **${stawka} PJN-Coins**. Stan: **${user.balance}**` });
            } else {
                user.balance -= stawka;
                user.consecutiveWins = 0;
                await user.save();
                await interaction.editReply({ content: `🪙 Wypadło: **${wynik === 'orzel' ? 'Orzeł' : 'Reszka'}**.\n😢 Niestety, przegrywasz **${stawka} PJN-Coins**. Stan: **${user.balance}**` });
            }
            return;
        }

        if (commandName === 'slot') {
            await interaction.deferReply();
            const stawka = interaction.options.getInteger('stawka', true);
            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) user = await UserModel.create({ userId: interaction.user.id });

            if (user.balance < stawka || stawka <= 0) {
                await interaction.editReply({ content: `❌ Nie masz tylu PJN-Coins w portfelu lub stawka jest nieprawidłowa!` });
                return;
            }

            user.casinoPlays = (user.casinoPlays || 0) + 1;
            const owoce = ['🍒', '🍋', '🔔', '💎', '7️⃣'];
            const s1 = owoce[Math.floor(Math.random() * owoce.length)];
            const s2 = owoce[Math.floor(Math.random() * owoce.length)];
            const s3 = owoce[Math.floor(Math.random() * owoce.length)];

            if (s1 === s2 && s2 === s3) {
                const wygrana = stawka * 5;
                user.balance += wygrana;
                user.consecutiveWins = (user.consecutiveWins || 0) + 1;
                await user.save();
                await checkAndAwardBadges(user, interaction.member);
                await interaction.editReply({ content: `🎰 [ ${s1} | ${s2} | ${s3} ]\n🏆 **JACKPOT!** Wszystkie symbole takie same! Wygrywasz **${wygrana} PJN-Coins**!` });
            } else if (s1 === s2 || s2 === s3 || s1 === s3) {
                const wygrana = stawka * 2;
                user.balance += wygrana;
                user.consecutiveWins = (user.consecutiveWins || 0) + 1;
                await user.save();
                await checkAndAwardBadges(user, interaction.member);
                await interaction.editReply({ content: `🎰 [ ${s1} | ${s2} | ${s3} ]\n✨ Dwa symbole takie same! Wygrywasz **${wygrana} PJN-Coins**!` });
            } else {
                user.balance -= stawka;
                user.consecutiveWins = 0;
                await user.save();
                await interaction.editReply({ content: `🎰 [ ${s1} | ${s2} | ${s3} ]\n😢 Nic z tego. Przegrywasz **${stawka} PJN-Coins**.` });
            }
            return;
        }

        if (commandName === 'poker') {
            await interaction.deferReply();
            const tryb = interaction.options.getString('tryb', true);
            const stawka = interaction.options.getInteger('stawka', true);
            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) user = await UserModel.create({ userId: interaction.user.id });

            if (user.balance < stawka || stawka <= 0) {
                await interaction.editReply({ content: `❌ Nie masz tylu PJN-Coins w portfelu lub stawka jest nieprawidłowa!` });
                return;
            }

            user.casinoPlays = (user.casinoPlays || 0) + 1;
            const wygrana = Math.random() > 0.5;

            if (wygrana) {
                user.balance += stawka;
                user.consecutiveWins = (user.consecutiveWins || 0) + 1;
                await user.save();
                await checkAndAwardBadges(user, interaction.member);
                await interaction.editReply({ content: `🃏 Rozgrywka w pokera (${tryb === 'bot' ? 'z botem' : 'z ludźmi'}): **Wygrywasz** i zyskujesz **${stawka} PJN-Coins**! Stan: **${user.balance}**` });
            } else {
                user.balance -= stawka;
                user.consecutiveWins = 0;
                await user.save();
                await interaction.editReply({ content: `🃏 Rozgrywka w pokera (${tryb === 'bot' ? 'z botem' : 'z ludźmi'}): **Przegrywasz** wpisowe **${stawka} PJN-Coins**. Stan: **${user.balance}**` });
            }
            return;
        }

        // === ZARZĄDZANIE ODZNAKAMI (ADMIN) ===
        if (commandName === 'daj-odznake') {
            if (!isAuthorized(interaction.user.id)) {
                await interaction.reply({ content: '❌ Nie masz uprawnień!', ephemeral: true });
                return;
            }

            await interaction.deferReply({ ephemeral: true });
            const targetUser = interaction.options.getUser('uzytkownik', true);
            const odznaka = interaction.options.getString('odznaka', true);

            let user = await UserModel.findOne({ userId: targetUser.id });
            if (!user) user = await UserModel.create({ userId: targetUser.id });

            if (!user.badges.includes(odznaka)) {
                user.badges.push(odznaka);
                await user.save();
                await interaction.editReply({ content: `✅ Pomyślnie przyznano odznakę ${odznaka} użytkownikowi <@${targetUser.id}>!` });
            } else {
                await interaction.editReply({ content: `⚠️ Użytkownik <@${targetUser.id}> ma już tę odznakę.` });
            }
            return;
        }

        if (commandName === 'zabierz-odznake') {
            if (!isAuthorized(interaction.user.id)) {
                await interaction.reply({ content: '❌ Nie masz uprawnień!', ephemeral: true });
                return;
            }

            await interaction.deferReply({ ephemeral: true });
            const targetUser = interaction.options.getUser('uzytkownik', true);
            const odznaka = interaction.options.getString('odznaka', true);

            let user = await UserModel.findOne({ userId: targetUser.id });
            if (!user) user = await UserModel.create({ userId: targetUser.id });

            const index = user.badges.indexOf(odznaka);
            if (index > -1) {
                user.badges.splice(index, 1);
                await user.save();
                await interaction.editReply({ content: `✅ Pomyślnie odebrano odznakę użytkownikowi <@${targetUser.id}>.` });
            } else {
                await interaction.editReply({ content: `⚠️ Użytkownik nie posiada takiej odznaki.` });
            }
            return;
        }

        // === STREAMY I OGŁOSZENIA ===
        if (commandName === 'odpalstream') {
            await interaction.reply({ content: '🔴 Wymuszono ręczne powiadomienie o streamie LangusPJN!', ephemeral: true });
            
            const targetChannel = await client.channels.fetch('1532399010785263799').catch(() => null) || interaction.channel;
            if (targetChannel && typeof targetChannel.send === 'function') {
                await targetChannel.send({
                    content: '@everyone LangusPJN właśnie odpalił stream! Wbijajcie na Kicka!',
                    embeds: [{
                        color: 0x00FF00,
                        title: '🔴 LANGUSPJN JEST NA ŻYWO NA KICKU!',
                        description: 'Kliknij poniższy link, aby dołączyć do transmisji i wspierać streamera!',
                        url: 'https://kick.com/languspjn',
                        timestamp: new Date().toISOString()
                    }]
                });
            }
            return;
        }

        if (commandName === 'zakonczstream') {
            await interaction.reply({ content: '⏹️ Wymuszono zakończenie streama i przywrócenie statusu Offline.', ephemeral: true });
            return;
        }

        if (commandName === 'nowosc') {
            if (!isAuthorized(interaction.user.id)) {
                await interaction.reply({ content: '❌ Nie masz uprawnień!', ephemeral: true });
                return;
            }

            await interaction.deferReply({ ephemeral: true });
            const tytul = interaction.options.getString('tytul', true);
            const opis = interaction.options.getString('opis', true);

            const targetChannel = await client.channels.fetch('1532399010785263799').catch(() => null) || interaction.channel;
            if (targetChannel && typeof targetChannel.send === 'function') {
                await targetChannel.send({
                    embeds: [{
                        color: 0x9B59B6,
                        title: `🚀 NOWOŚĆ: ${tytul}`,
                        description: opis,
                        footer: { text: `Opublikował ${interaction.user.tag}` },
                        timestamp: new Date().toISOString()
                    }]
                });
                await interaction.editReply({ content: `✅ Nowość została opublikowana pomyślnie!` });
            } else {
                await interaction.editReply({ content: `❌ Nie znaleziono kanału do publikacji.` });
            }
            return;
        }

        if (commandName === 'dajpunkty') {
            if (!isAuthorized(interaction.user.id)) {
                await interaction.reply({ content: '❌ Nie masz uprawnień!', ephemeral: true });
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
                await interaction.reply({ content: '❌ Nie masz uprawnień!', ephemeral: true });
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
                await interaction.reply({ content: '❌ Nie masz uprawnień!', ephemeral: true });
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
                await interaction.reply({ content: '❌ Nie masz uprawnień!', ephemeral: true });
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
