import { 
    Client, 
    GatewayIntentBits, 
    REST, 
    Routes, 
    SlashCommandBuilder,
    TextChannel,
    VoiceChannel,
    PermissionFlagsBits,
    EmbedBuilder,
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
    badges: { type: [String], default: [] }
});

const UserModel = mongoose.model('User', userSchema);

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

// Główne ID kanałów i rang
const ANNOUNCE_CHANNEL_ID = '1532399010785263799';
const STREAM_CHANNEL_ID = '1533839105962676254'; 
const CHANNEL_POWITANIA = "witamy";
const ID_KANALU_DUSZKI = "1532977723843285112"; 
const ID_KANALU_GRY_INFO = "1534060343473475644";
const ID_RANGI_DUSZKOWIEC = "1532978703842283551";
const ID_RANGI_MODERATOR = "1532321767857721344";
const ID_RANGI_ADMIN = "1532324059470237857";

const ID_KANALU_PLEC = '1532374188634144898';
const ID_KANALU_RANGES = '1532397673842217010';
const ID_KANALU_SPRZET = '1532398069524594708';

const LIVE_IMAGE_URL = "https://cdn.discordapp.com/attachments/1532862421729808565/1532865034642919574/1784490427936.png";

function isAuthorized(userId: string): boolean {
    const adminIds = ['1175798371995361343', '1493928957408448563'];
    return adminIds.includes(userId);
}

function createOgłoszenieEmbed() {
    return new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle('🌟 Witamy na PJN Server!')
        .setDescription(
            'Cieszymy się, że jesteś częścią naszej społeczności! Pamiętaj, aby regularnie wspierać nasze projekty i śledzić oficjalne profile streamingowe:\n\n' +
            '🔗 **TikTok**\n[tiktok.com/@languspjn](https://tiktok.com/@languspjn)\n\n' +
            '🔗 **Kick**\n[kick.com/LangusPJN](https://kick.com/LangusPJN)\n\n' +
            '💡 **Społeczność**\n' +
            'Zostaw po sobie ślad, zaproś znajomych na nasz serwer Discord i buduj z nami najlepszą społeczność w sieci! 🚀\n\n' +
            '*Życzymy aby Twoja obecność na naszym serwerze przebiegła jak najlepiej - LangusPJN i ellader*'
        )
        .setImage(LIVE_IMAGE_URL)
        .setTimestamp()
        .setFooter({ text: 'PJN System Ogłoszeń' });
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

async function startTopUpdater() {
    setInterval(async () => {
        try {
            const config = await ConfigModel.findOne({ key: 'topka_msg' });
            if (!config) return;

            const channel = await client.channels.fetch(config.channelId).catch(() => null) as TextChannel;
            if (!channel) return;

            const oldMessage = await channel.messages.fetch(config.messageId).catch(() => null);
            if (oldMessage) {
                await oldMessage.delete().catch(() => {});
            }

            const embedData = await getTopEmbedData(channel.guild);
            const newMessage = await channel.send({ embeds: [embedData] });

            config.messageId = newMessage.id;
            await config.save();
        } catch (err) {
            console.error('Błąd aktualizacji topki:', err);
        }
    }, 5 * 60 * 1000);
}

function startHourlyAnnouncements() {
    setInterval(async () => {
        try {
            const channel = await client.channels.fetch(ANNOUNCE_CHANNEL_ID).catch(() => null) as TextChannel;
            if (!channel) return;

            await channel.send({ embeds: [createOgłoszenieEmbed()] });
        } catch (err) {
            console.error('Błąd ogłoszenia godzinnego:', err);
        }
    }, 60 * 60 * 1000);
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
    new SlashCommandBuilder().setName('odznaki').setDescription('Wyświetla profil z odznakami i statystykami')
        .addUserOption(o => o.setName('uzytkownik').setDescription('Kogo odznaki sprawdzić').setRequired(false)),
    new SlashCommandBuilder().setName('daj-odznake').setDescription('Ręcznie przyznaj oficjalną odznakę (Admin)')
        .addUserOption(o => o.setName('uzytkownik').setDescription('Komu').setRequired(true))
        .addStringOption(o => o.setName('odznaka').setDescription('Wybierz oficjalną odznakę z listy').setRequired(true)
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
    new SlashCommandBuilder().setName('zabierz-odznake').setDescription('Odbierz odznakę (Admin)')
        .addUserOption(o => o.setName('uzytkownik').setDescription('Komu').setRequired(true))
        .addStringOption(o => o.setName('odznaka').setDescription('Nazwa odznaki').setRequired(true)),
    new SlashCommandBuilder().setName('testogloszenia').setDescription('Przetestuj wysyłanie ogłoszenia (Admin)')
        .addStringOption(o => o.setName('tresc').setDescription('Treść testowego ogłoszenia').setRequired(false))
        .addChannelOption(o => o.setName('kanal').setDescription('Kanał docelowy (opcjonalnie)').setRequired(false)),
    new SlashCommandBuilder().setName('odpalstream').setDescription('Wymuś ręczne ogłoszenie streama LangusPJN z Kicka'),
    new SlashCommandBuilder().setName('zakonczstream').setDescription('Wymuś ręczne zakończenie streama i przywrócenie statusu Offline'),
    new SlashCommandBuilder().setName('nowosc').setDescription('Opublikuj nową funkcję lub aktualizację na kanale nowości (Admin)')
        .addStringOption(o => o.setName('tytul').setDescription('Tytuł nowości').setRequired(true))
        .addStringOption(o => o.setName('opis').setDescription('Szczegółowy opis zmiany').setRequired(true)),
    new SlashCommandBuilder().setName('rozdaj-wszystkim').setDescription('Rozdaj PJN-Coinsy wszystkim')
        .addIntegerOption(o => o.setName('ilosc').setDescription('Liczba PJN-Coins').setRequired(true))
        .addStringOption(o => o.setName('powod').setDescription('Powód').setRequired(false)),
    new SlashCommandBuilder().setName('dajpunkty').setDescription('Dodaj PJN-Coins użytkownikowi')
        .addUserOption(o => o.setName('uzytkownik').setDescription('Użytkownik').setRequired(true))
        .addIntegerOption(o => o.setName('ilosc').setDescription('Ilość PJN-Coins').setRequired(true)),
    new SlashCommandBuilder().setName('zabierzpunkty').setDescription('Zabierz PJN-Coins użytkownikowi')
        .addUserOption(o => o.setName('uzytkownik').setDescription('Użytkownik').setRequired(true))
        .addIntegerOption(o => o.setName('ilosc').setDescription('Ilość PJN-Coins').setRequired(true))
].map(c => c.toJSON());

client.once('ready', async () => {
    console.log(`Zalogowano jako ${client.user?.tag}!`);

    const rest = new REST({ version: '10' }).setToken(token);
    try {
        console.log('Rejestracja komend...');
        for (const [_, guild] of client.guilds.cache) {
            await rest.put(Routes.applicationGuildCommands(client.user!.id, guild.id), { body: commands });
        }
        console.log('Komendy zarejestrowane!');
    } catch (error) {
        console.error('Błąd rejestracji:', error);
    }

    startTopUpdater();
    startHourlyAnnouncements();
});

client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    try {
        let user = await UserModel.findOne({ userId: message.author.id });
        if (!user) user = await UserModel.create({ userId: message.author.id });

        user.messageCount = (user.messageCount || 0) + 1;
        const customEmojis = message.content.match(/<a?:\w+:\d+>/g);
        if (customEmojis) user.emojiCount = (user.emojiCount || 0) + customEmojis.length;

        await user.save();
        await checkAndAwardBadges(user, message.member);

        if (message.channelId === ID_KANALU_DUSZKI) {
            const pings = `<@&${ID_RANGI_DUSZKOWIEC}> <@&${ID_RANGI_MODERATOR}> <@&${ID_RANGI_ADMIN}>`;
            const replyText = `Cześć ${message.author}, dziękuję że jesteś, teraz zawołam osoby odpowiedzialne do Ciebie abyście porozmawiali o darmowych duszkach!\n\n${pings}`;

            try {
                await message.reply({
                    content: replyText,
                    allowedMentions: { 
                        roles: [ID_RANGI_DUSZKOWIEC, ID_RANGI_MODERATOR, ID_RANGI_ADMIN],
                        users: [message.author.id] 
                    }
                });
            } catch (err) {}
        }
    } catch (error) {
        console.error('Błąd wiadomości:', error);
    }
});

client.on('guildMemberAdd', async member => {
    try {
        let user = await UserModel.findOne({ userId: member.id });
        if (!user) user = await UserModel.create({ userId: member.id });
        
        user.balance += 200;
        await user.save();
        await checkAndAwardBadges(user, member);

        const channel = member.guild.channels.cache.find(ch => ch.isTextBased() && 'name' in ch && ch.name === CHANNEL_POWITANIA) as TextChannel;
        if (channel) {
            const contentMessage = `👋 Witaj na serwerze PJN, <@${member.id}>! Cieszymy się, że jesteś z nami! 🎉\n🎁 Na start otrzymujesz w prezencie **200 PJN-Coins**!`;

            const embedPowitanie = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle('📌 Skonfiguruj swój profil i sprawdź najważniejsze miejsca:')
                .setDescription(
                    `• Wybierz płeć: <#${ID_KANALU_PLEC}>\n` +
                    `• Dostosuj role: <#${ID_KANALU_RANGES}>\n` +
                    `• Wybierz swój sprzęt: <#${ID_KANALU_SPRZET}>\n\n` +
                    `🎮 Informacje o grach: <#${ID_KANALU_GRY_INFO}>\n` +
                    `👻 Darmowe duszki: <#${ID_KANALU_DUSZKI}>`
                )
                .setThumbnail(member.user.displayAvatarURL())
                .setTimestamp();

            await channel.send({ content: contentMessage, embeds: [embedPowitanie] });
        }
    } catch (e) {
        console.error('Błąd powitania:', e);
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
                await interaction.editReply({ content: `✅ Ustawiono ten kanał jako ranking.` });
            } else {
                await interaction.editReply({ content: `❌ Nie udało się wysłać wiadomości.` });
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
                        { name: '📊 Statystyki Aktywności', value: `💬 Wiadomości: **${user.messageCount || 0}**\n😂 Emotki: **${user.emojiCount || 0}**\n💰 Portfel: **${user.balance || 0}**`, inline: false }
                    ]
                }]
            });
            return;
        }

        if (commandName === 'portfel') {
            await interaction.deferReply({ ephemeral: true });
            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) user = await UserModel.create({ userId: interaction.user.id });
            await interaction.editReply({ content: `💰 Posiadasz **${user.balance} PJN-Coins!**` });
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
                    await interaction.editReply({ content: `⏳ Odbierałeś już nagrodę! Spróbuj za **${Math.ceil(24 - diffHours)}h**.` });
                    return;
                }
            }

            user.balance += 100;
            user.lastDaily = now;
            await user.save();
            await checkAndAwardBadges(user, interaction.member);

            await interaction.editReply({ content: `🎁 Otrzymałeś codzienne **100 PJN-Coins**!` });
            return;
        }

        if (commandName === 'kostka' || commandName === 'moneta' || commandName === 'slot') {
            await interaction.deferReply();
            const stawka = interaction.options.getInteger('stawka', true);
            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) user = await UserModel.create({ userId: interaction.user.id });

            if (user.balance < stawka || stawka <= 0) {
                await interaction.editReply({ content: `❌ Za mało PJN-Coins lub zła stawka!` });
                return;
            }

            user.casinoPlays = (user.casinoPlays || 0) + 1;
            let wygrana = false;
            let info = '';

            if (commandName === 'kostka') {
                const rG = Math.floor(Math.random() * 6) + 1;
                const rB = Math.floor(Math.random() * 6) + 1;
                if (rG > rB) { wygrana = true; user.balance += stawka; info = `🎲 Wyrzuciłeś ${rG}, bot ${rB}. Wygrana!`; }
                else if (rG < rB) { user.balance -= stawka; info = `🎲 Wyrzuciłeś ${rG}, bot ${rB}. Przegrana!`; }
                else { info = `🎲 Remis!`; }
            } else if (commandName === 'moneta') {
                const wybor = interaction.options.getString('wybor', true);
                const wynik = Math.random() < 0.5 ? 'orzel' : 'reszka';
                if (wybor === wynik) { wygrana = true; user.balance += stawka; info = `🪙 Wypadło ${wynik}. Wygrana!`; }
                else { user.balance -= stawka; info = `🪙 Wypadło ${wynik}. Przegrana!`; }
            } else if (commandName === 'slot') {
                const owoce = ['🍒', '🍋', '🔔', '💎', '7️⃣'];
                const s1 = owoce[Math.floor(Math.random() * owoce.length)];
                const s2 = owoce[Math.floor(Math.random() * owoce.length)];
                const s3 = owoce[Math.floor(Math.random() * owoce.length)];
                if (s1 === s2 && s2 === s3) { wygrana = true; user.balance += stawka * 5; info = `🎰 [ ${s1} | ${s2} | ${s3} ] - JACKPOT!`; }
                else if (s1 === s2 || s2 === s3 || s1 === s3) { wygrana = true; user.balance += stawka * 2; info = `🎰 [ ${s1} | ${s2} | ${s3} ] - Trafione dwa!`; }
                else { user.balance -= stawka; info = `🎰 [ ${s1} | ${s2} | ${s3} ] - Przegrana.`; }
            }

            if (wygrana) {
                user.consecutiveWins = (user.consecutiveWins || 0) + 1;
                await checkAndAwardBadges(user, interaction.member);
            } else if (commandName !== 'kostka') {
                user.consecutiveWins = 0;
            }

            await user.save();
            await interaction.editReply({ content: `${info} Stan konta: **${user.balance}**` });
            return;
        }

        // === POKER (BOT LUB LUDZIE OD 2 DO 4 OSÓB) ===
        if (commandName === 'poker') {
            const tryb = interaction.options.getString('tryb', true);
            const stawka = interaction.options.getInteger('stawka', true);

            let hostUser = await UserModel.findOne({ userId: interaction.user.id });
            if (!hostUser) hostUser = await UserModel.create({ userId: interaction.user.id });

            if (hostUser.balance < stawka || stawka <= 0) {
                await interaction.reply({ content: `❌ Nie masz wystarczającej liczby PJN-Coins (${stawka}), aby opłacić wpisowe!`, ephemeral: true });
                return;
            }

            // TRYB Z BOTEM
            if (tryb === 'bot') {
                await interaction.deferReply();
                hostUser.casinoPlays = (hostUser.casinoPlays || 0) + 1;
                
                let wygrana = false;
                let info = '';
                if (Math.random() > 0.5) { 
                    wygrana = true; 
                    hostUser.balance += stawka; 
                    info = `🃏 Poker z botem: **Wygrana!** Zyskujesz +${stawka} PJN-Coins.`; 
                } else { 
                    hostUser.balance -= stawka; 
                    info = `🃏 Poker z botem: **Przegrana!** Tracisz -${stawka} PJN-Coins.`; 
                }

                if (wygrana) {
                    hostUser.consecutiveWins = (hostUser.consecutiveWins || 0) + 1;
                    await checkAndAwardBadges(hostUser, interaction.member);
                } else {
                    hostUser.consecutiveWins = 0;
                }

                await hostUser.save();
                await interaction.editReply({ content: `${info} Stan konta: **${hostUser.balance}** PJN-Coins.` });
                return;
            }

            // TRYB Z LUDŹMI (2-4 osoby)
            if (tryb === 'ludzie') {
                await interaction.deferReply();

                const joinedPlayers: string[] = [interaction.user.id];

                const joinButton = new ButtonBuilder()
                    .setCustomId('poker_join')
                    .setLabel('Dołącz do stolika')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🃏');

                const startButton = new ButtonBuilder()
                    .setCustomId('poker_start')
                    .setLabel('Odkryj karty (Start)')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🚀');

                const row = new ActionRowBuilder<ButtonBuilder>().addComponents(joinButton, startButton);

                const embed = new EmbedBuilder()
                    .setColor(0xE67E22)
                    .setTitle('🃏 Stolik Pokerowy (2-4 osoby)')
                    .setDescription(
                        `Gospodarz: <@${interaction.user.id}>\n` +
                        `Wpisowe: **${stawka} PJN-Coins**\n\n` +
                        `**Gracze przy stoliku (1/4):**\n• <@${interaction.user.id}>\n\n` +
                        `*Kliknij przycisk poniżej, aby dołączyć (czas na dołączenie to 1 minuta). Host może kliknąć Start w dowolnym momencie.*`
                    );

                const message = await interaction.editReply({ embeds: [embed], components: [row] });

                const collector = message.createMessageComponentCollector({
                    componentType: ComponentType.Button,
                    time: 60000 // 60 sekund (1 minuta) na zbieranie graczy
                });

                collector.on('collect', async i => {
                    if (i.customId === 'poker_join') {
                        if (joinedPlayers.includes(i.user.id)) {
                            await i.reply({ content: '❌ Już siedzisz przy tym stoliku!', ephemeral: true });
                            return;
                        }

                        if (joinedPlayers.length >= 4) {
                            await i.reply({ content: '❌ Stolik jest już pełen (maksymalnie 4 osoby)!', ephemeral: true });
                            return;
                        }

                        let pUser = await UserModel.findOne({ userId: i.user.id });
                        if (!pUser) pUser = await UserModel.create({ userId: i.user.id });

                        if (pUser.balance < stawka) {
                            await i.reply({ content: `❌ Masz za mało PJN-Coins (${pUser.balance}/${stawka}), aby dołączyć!`, ephemeral: true });
                            return;
                        }

                        joinedPlayers.push(i.user.id);

                        const listStr = joinedPlayers.map(id => `• <@${id}>`).join('\n');
                        embed.setDescription(
                            `Gospodarz: <@${interaction.user.id}>\n` +
                            `Wpisowe: **${stawka} PJN-Coins**\n\n` +
                            `**Gracze przy stoliku (${joinedPlayers.length}/4):**\n${listStr}\n\n` +
                            `*Kliknij przycisk poniżej, aby dołączyć (czas na dołączenie to 1 minuta).*`
                        );

                        await i.update({ embeds: [embed] });
                    }

                    if (i.customId === 'poker_start') {
                        if (i.user.id !== interaction.user.id) {
                            await i.reply({ content: '❌ Tylko gospodarz stolika może rozpocząć rozdanie!', ephemeral: true });
                            return;
                        }

                        if (joinedPlayers.length < 2) {
                            await i.reply({ content: '❌ Do gry potrzeba przynajmniej 2 graczy!', ephemeral: true });
                            return;
                        }

                        collector.stop('started');
                    }
                });

                collector.on('end', async (_, reason) => {
                    if (reason === 'time' && joinedPlayers.length < 2) {
                        await interaction.editReply({
                            content: '⏳ Czas minął (1 minuta). Zbyt mało graczy dołączyło do stolika. Gra została anulowana.',
                            embeds: [],
                            components: []
                        }).catch(() => {});
                        return;
                    }

                    // SPRAWDZENIE SALD I POBRANIE WPISOWEGO DLA WSZYSTKICH
                    const validPlayers: string[] = [];
                    for (const userId of joinedPlayers) {
                        let u = await UserModel.findOne({ userId });
                        if (u && u.balance >= stawka) {
                            u.balance -= stawka;
                            u.casinoPlays = (u.casinoPlays || 0) + 1;
                            await u.save();
                            validPlayers.push(userId);
                        }
                    }

                    if (validPlayers.length < 2) {
                        await interaction.editReply({
                            content: '❌ Niektórzy gracze stracili środki i zabrakło wymaganej liczby osób (min. 2). Gra anulowana.',
                            embeds: [],
                            components: []
                        }).catch(() => {});
                        return;
                    }

                    // LOSOWANIE ZWYCIĘZCY SPOŚRÓD ZEBRANYCH GRACZY
                    const winnerId = validPlayers[Math.floor(Math.random() * validPlayers.length)];
                    const totalPool = validPlayers.length * stawka;

                    let winnerUser = await UserModel.findOne({ userId: winnerId });
                    if (winnerUser) {
                        winnerUser.balance += totalPool;
                        winnerUser.consecutiveWins = (winnerUser.consecutiveWins || 0) + 1;
                        await winnerUser.save();
                        const mem = await interaction.guild?.members.fetch(winnerId).catch(() => null);
                        if (mem) await checkAndAwardBadges(winnerUser, mem);
                    }

                    // ROZSYŁANIE KART W DM DO KAŻDEGO UCZESTNIKA
                    const kartyPool = ['2 Trefl', '3 Kier', 'As Pik', 'Król Karo', 'Dama Pik', 'Walet Kier', '10 Trefl', '9 Karo'];
                    for (const userId of validPlayers) {
                        try {
                            const discordUser = await client.users.fetch(userId);
                            const k1 = kartyPool[Math.floor(Math.random() * kartyPool.length)];
                            const k2 = kartyPool[Math.floor(Math.random() * kartyPool.length)];
                            await discordUser.send({
                                embeds: [{
                                    color: 0x2ECC71,
                                    title: '🃏 Twoje karty w stoliku pokerowym',
                                    description: `Otrzymałeś karty na rękę:\n• **${k1}**\n• **${k2}**\n\nPula całkowita stolika wynosiła: **${totalPool} PJN-Coins**.`
                                }]
                            }).catch(() => {});
                        } catch (e) {}
                    }

                    // PODSUMOWANIE NA KANALE PUBLICZNYM
                    const summaryDesc = validPlayers.map(id => `• <@${id}>`).join('\n');
                    await interaction.editReply({
                        content: `🏁 **Rozdanie zakończone!**\n🏆 Zwycięzcą zostaje <@${winnerId}> i zgarnia pulę **${totalPool} PJN-Coins**!\n\n*(Karty zostały rozesłane w wiadomościach prywatnych DM)*`,
                        embeds: [
                            new EmbedBuilder()
                                .setColor(0xF1C40F)
                                .setTitle('🃏 Wyniki Stolika Pokerowego')
                                .setDescription(`**Uczestnicy:**\n${summaryDesc}\n\n🏆 **Zwycięzca:** <@${winnerId}>\n💰 **Wygrana:** +${totalPool} PJN-Coins`)
                        ],
                        components: []
                    }).catch(() => {});
                });
            }
            return;
        }

        if (commandName === 'odpalstream') {
            await interaction.reply({ content: '🔴 Wymuszono powiadomienie o streamie i zmieniono nazwę kanału!', ephemeral: true });
            
            try {
                const streamChannel = await client.channels.fetch(STREAM_CHANNEL_ID).catch(() => null);
                if (streamChannel && 'setName' in streamChannel) {
                    await (streamChannel as VoiceChannel | TextChannel).setName('🔴・languspjn-live');
                }
            } catch (err) {}

            const targetChannel = await client.channels.fetch(ANNOUNCE_CHANNEL_ID).catch(() => null);
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
            await interaction.reply({ content: '⏹️ Zakończono stream i przywrócono nazwę kanału do stanu Offline.', ephemeral: true });
            
            try {
                const streamChannel = await client.channels.fetch(STREAM_CHANNEL_ID).catch(() => null);
                if (streamChannel && 'setName' in streamChannel) {
                    await (streamChannel as VoiceChannel | TextChannel).setName('⚫・stream-offline');
                }
            } catch (err) {}
            return;
        }

        if (commandName === 'nowosc') {
            if (!isAuthorized(interaction.user.id)) {
                await interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
                return;
            }

            await interaction.deferReply({ ephemeral: true });
            const tytul = interaction.options.getString('tytul', true);
            const opis = interaction.options.getString('opis', true);

            const targetChannel = await client.channels.fetch(ANNOUNCE_CHANNEL_ID).catch(() => null);
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
                await interaction.editReply({ content: `✅ Nowość opublikowana!` });
            } else {
                await interaction.editReply({ content: `❌ Nie znaleziono kanału ogłoszeń.` });
            }
            return;
        }

        if (commandName === 'dajpunkty' || commandName === 'zabierzpunkty') {
            if (!isAuthorized(interaction.user.id)) {
                await interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
                return;
            }

            await interaction.deferReply({ ephemeral: true });
            const targetUser = interaction.options.getUser('uzytkownik', true);
            const ilosc = interaction.options.getInteger('ilosc', true);

            let user = await UserModel.findOne({ userId: targetUser.id });
            if (!user) user = await UserModel.create({ userId: targetUser.id });

            if (commandName === 'dajpunkty') {
                user.balance += ilosc;
                await user.save();
                const member = await interaction.guild?.members.fetch(targetUser.id).catch(() => null);
                if (member) await checkAndAwardBadges(user, member);
                await interaction.editReply({ content: `✅ Dodano **${ilosc}** punktów. Stan: **${user.balance}**` });
            } else {
                user.balance = Math.max(0, user.balance - ilosc);
                await user.save();
                await interaction.editReply({ content: `✅ Zabrano **${ilosc}** punktów. Stan: **${user.balance}**` });
            }
            return;
        }

        if (commandName === 'rozdaj-wszystkim') {
            if (!isAuthorized(interaction.user.id)) {
                await interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
                return;
            }

            await interaction.deferReply({ ephemeral: true });
            const ilosc = interaction.options.getInteger('ilosc', true);
            const powod = interaction.options.getString('powod') || 'Brak powódu';

            await UserModel.updateMany({}, { $inc: { balance: ilosc } });
            await interaction.editReply({ content: `🎁 Rozdano po **${ilosc} PJN-Coins** wszystkim! Powód: *${powod}*` });
            return;
        }

        if (commandName === 'testogloszenia') {
            if (!isAuthorized(interaction.user.id)) {
                await interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
                return;
            }

            await interaction.reply({ content: 'wysyłanie testu...', ephemeral: true });
            const targetChannel = interaction.options.getChannel('kanal') || await client.channels.fetch(ANNOUNCE_CHANNEL_ID).catch(() => null);

            if (targetChannel && typeof (targetChannel as any).send === 'function') {
                await (targetChannel as any).send({ embeds: [createOgłoszenieEmbed()] });
                await interaction.editReply({ content: `✅ Wysłano test ogłoszenia!` });
            } else {
                await interaction.editReply({ content: `❌ Błąd kanału.` });
            }
            return;
        }

    } catch (error) {
        console.error(`Błąd w ${commandName}:`, error);
        try {
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: 'Wystąpił błąd.' }).catch(() => {});
            } else {
                await interaction.reply({ content: 'Wystąpił błąd.', ephemeral: true }).catch(() => {});
            }
        } catch (e) {}
    }
});

client.login(token);
