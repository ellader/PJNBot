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
    lastDaily: { type: Date, default: null }
});

const UserModel = mongoose.model('User', userSchema);

// === KONFIGURACJA BOTA DISCORD ===
const token = process.env.DISCORD_BOT_TOKEN;
if (!token) throw new Error("Brak tokena Discord bota!");

const TOP_CHANNEL_ID = '1534049518377631826'; 

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

async function getTopEmbedData(guild: any) {
    const topUsers = await UserModel.find().sort({ balance: -1 }).limit(10);
    
    if (topUsers.length === 0) {
        return {
            color: 0xFFD700,
            title: '🏆 TOP 10 - Ranking PJN-Coins',
            description: 'Ranking jest automatycznie aktualizowany co 5 minut na podstawie aktywności w bazie danych.\n\nBrak danych w rankingu.'
        };
    }

    let desc = 'Ranking jest automatycznie aktualizowany co 5 minut na podstawie aktywności w bazie danych.\n\n**Najbogatsi użytkownicy**\n';
    
    for (let index = 0; index < topUsers.length; index++) {
        const u = topUsers[index];
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**${index + 1}.**`;
        
        let userName = `Użytkownik (${u.userId})`;
        try {
            const fetchedUser = await client.users.fetch(u.userId);
            if (fetchedUser) {
                userName = fetchedUser.username;
            }
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
        .setDescription('Zagraj w pokera z ludźmi (do 4 osób) lub z botem')
        .addStringOption(option =>
            option.setName('tryb')
                .setDescription('Wybierz z kim chcesz zagrać')
                .setRequired(true)
                .addChoices(
                    { name: 'Z ludźmi (stolik do 4 osób)', value: 'ludzie' },
                    { name: 'Z botem (od razu)', value: 'bot' }
                ))
        .addIntegerOption(option =>
            option.setName('stawka')
                .setDescription('Wpisowe do stołu (stawka)')
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

            console.log('Zaktualizowano automatyczny ranking.');
        } catch (err) {
            console.error('Błąd automatycznego odświeżania rankingu:', err);
        }
    }, 5 * 60 * 1000);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    try {
        if (commandName === 'balans') {
            let user = await UserModel.findOne({ userId: interaction.user.id });
            if (!user) {
                user = await UserModel.create({ userId: interaction.user.id, balance: 0 });
            }
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
                wygrana = stawka * 5;
                user.balance += wygrana;
                await user.save();
                await interaction.reply({ content: `🎰 [ ${s1} | ${s2} | ${s3} ]\n🎉 **JACKPOT!** Wszystkie symbole takie same! Wygrywasz **${wygrana} PJN-Coins**! Nowy balans: **${user.balance}**` });
            } else if (s1 === s2 || s2 === s3 || s1 === s3) {
                wygrana = Math.floor(stawka * 1.5);
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

        // === 7. /poker (Z wyborem trybu: z ludźmi lub od razu z botem) ===
        else if (commandName === 'poker') {
            const tryb = interaction.options.getString('tryb', true);
            const stawka = interaction.options.getInteger('stawka', true);

            if (stawka <= 0) {
                await interaction.reply({ content: '❌ Stawka musi być większa od 0!', ephemeral: true });
                return;
            }

            let userCheck = await UserModel.findOne({ userId: interaction.user.id });
            if (!userCheck) {
                userCheck = await UserModel.create({ userId: interaction.user.id, balance: 0 });
            }

            if (userCheck.balance < stawka) {
                await interaction.reply({ content: `❌ Nie masz tylu coinsów! Posiadasz tylko **${userCheck.balance} PJN-Coins**.`, ephemeral: true });
                return;
            }

            const karty = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

            // === TRYB: GRA Z BOTEM ===
            if (tryb === 'bot') {
                userCheck.balance -= stawka;
                await userCheck.save();

                const userCard = karty[Math.floor(Math.random() * karty.length)];
                const botCard = karty[Math.floor(Math.random() * karty.length)];

                const userIndex = karty.indexOf(userCard);
                const botIndex = karty.indexOf(botCard);

                let wynikTekst = `🤖 **Pojedynek z botem**\n\n`;
                wynikTekst += `🃏 Twoja karta: **${userCard}** | Karta bota: **${botCard}**\n`;

                if (userIndex > botIndex) {
                    const wygrana = stawka * 2;
                    userCheck.balance += wygrana;
                    await userCheck.save();
                    wynikTekst += `🎉 **Masz mocniejszą kartę!** Wygrywasz **${stawka} PJN-Coins**. Nowy balans: **${userCheck.balance}**`;
                } else if (userIndex < botIndex) {
                    wynikTekst += `💀 **Bot ma mocniejszą kartę!** Przegrywasz **${stawka} PJN-Coins**. Nowy balans: **${userCheck.balance}**`;
                } else {
                    userCheck.balance += stawka; // zwrot stawki
                    await userCheck.save();
                    wynikTekst += `🤝 **Remis!** Otrzymujesz zwrot stawki. Nowy balans: **${userCheck.balance}**`;
                }

                await interaction.reply({ content: wynikTekst });
                return;
            }

            // === TRYB: GRA Z LUDŹMI (Do 4 osób) ===
            const players: string[] = [interaction.user.id];

            const getPokerEmbed = (statusMsg: string) => ({
                color: 0x800080,
                title: '🃏 Stolik Pokerowy (Max 4 osoby)',
                description: `${statusMsg}\n\n**Stawka (wpisowe):** ${stawka} Coins\n**Gracze (${players.length}/4):**\n` + players.map(id => `• <@${id}>`).join('\n')
            });

            const joinButton = new ButtonBuilder()
                .setCustomId('poker_join')
                .setLabel('Dołącz do gry')
                .setStyle(ButtonStyle.Success);

            const startButton = new ButtonBuilder()
                .setCustomId('poker_start')
                .setLabel('Start teraz')
                .setStyle(ButtonStyle.Primary);

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(joinButton, startButton);

            const response = await interaction.reply({
                embeds: [getPokerEmbed('Oczekiwanie na graczy...')],
                components: [row],
                fetchReply: true
            });

            const collector = response.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 45000 // 45 sekund na zebranie graczy
            });

            let gameStarted = false;

            collector.on('collect', async i => {
                if (gameStarted) return;

                if (i.customId === 'poker_join') {
                    if (players.includes(i.user.id)) {
                        await i.reply({ content: '❌ Już siedzisz przy tym stole!', ephemeral: true });
                        return;
                    }

                    if (players.length >= 4) {
                        await i.reply({ content: '❌ Stolik jest już pełen (maksymalnie 4 osoby)!', ephemeral: true });
                        return;
                    }

                    let pUser = await UserModel.findOne({ userId: i.user.id });
                    if (!pUser) {
                        pUser = await UserModel.create({ userId: i.user.id, balance: 0 });
                    }

                    if (pUser.balance < stawka) {
                        await i.reply({ content: `❌ Nie masz wystarczająco środków (${stawka} Coins), aby dołączyć!`, ephemeral: true });
                        return;
                    }

                    players.push(i.user.id);
                    await i.update({ embeds: [getPokerEmbed('Oczekiwanie na graczy...')] });

                    if (players.length === 4) {
                        gameStarted = true;
                        collector.stop('full');
                    }
                } 
                
                else if (i.customId === 'poker_start') {
                    if (i.user.id !== interaction.user.id) {
                        await i.reply({ content: '❌ Tylko osoba, która stworzyła stolik, może go uruchomić!', ephemeral: true });
                        return;
                    }

                    gameStarted = true;
                    collector.stop('manual');
                }
            });

            collector.on('end', async () => {
                const finalPlayers: string[] = [];
                let totalPot = 0;

                for (const playerId of players) {
                    let u = await UserModel.findOne({ userId: playerId });
                    if (u && u.balance >= stawka) {
                        u.balance -= stawka;
                        await u.save();
                        finalPlayers.push(playerId);
                        totalPot += stawka;
                    }
                }

                if (finalPlayers.length < 2) {
                    await interaction.editReply({
                        content: '⏰ Czas minął – brak innych graczy do rozegrania partii wieloosobowej. Gra została anulowana (środki zostały zwrócone lub nikt nie dołączył).',
                        embeds: [],
                        components: []
                    }).catch(() => {});
                    // Zwrot środków hostowi, jeśli został sam
                    if (finalPlayers.length === 1) {
                        let hostU = await UserModel.findOne({ userId: finalPlayers[0] });
                        if (hostU) {
                            hostU.balance += stawka;
                            await hostU.save();
                        }
                    }
                    return;
                }

                const wyniki: { userId: string, karta: string, index: number }[] = [];

                for (const playerId of finalPlayers) {
                    const randomKarta = karty[Math.floor(Math.random() * karty.length)];
                    wyniki.push({
                        userId: playerId,
                        karta: randomKarta,
                        index: karty.indexOf(randomKarta)
                    });
                }

                wyniki.sort((a, b) => b.index - a.index);
                const najwyzszyWynik = wyniki[0].index;
                const zwyciezcy = wyniki.filter(w => w.index === najwyzszyWynik);

                const wygranaDlaJednego = Math.floor(totalPot / zwyciezcy.length);

                let wynikOpis = `💰 **Pula główna:** ${totalPot} Coins\n\n**Rozdane karty:**\n`;
                for (const w of wyniki) {
                    wynikOpis += `• <@${w.userId}> — Karta: **${w.karta}**\n`;
                }

                wynikOpis += `\n🏆 **Zwycięzca(y):** ` + zwyciezcy.map(z => `<@${z.userId}>`).join(', ');
                wynikOpis += ` (Zyskują po **${wygranaDlaJednego} Coins**!)`;

                for (const z of zwyciezcy) {
                    let zwUser = await UserModel.findOne({ userId: z.userId });
                    if (zwUser) {
                        zwUser.balance += wygranaDlaJednego;
                        await zwUser.save();
                    }
                }

                await interaction.editReply({
                    embeds: [{
                        color: 0x00FF00,
                        title: '🃏 Wyniki Rozdania Pokerowego',
                        description: wynikOpis
                    }],
                    components: []
                }).catch(() => {});
            });

            return;
        }

        else if (commandName === 'rozdaj-wszystkim') {
            if (!isAuthorized(interaction.user.id) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
                await interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
                return;
            }

            await interaction.deferReply({ ephemeral: true });
            
            const ilosc = interaction.options.getInteger('ilosc', true);
            const powod = interaction.options.getString('powod') || 'Brak powiadomienia';

            await interaction.guild?.members.fetch();
            const members = interaction.guild?.members.cache.filter(m => !m.user.bot);

            if (!members || members.size === 0) {
                await interaction.editReply({ content: '❌ Nie znaleziono żadnych użytkowników na serwerze!' });
                return;
            }

            let zaktualizowano = 0;
            let wyslanePW = 0;

            for (const [_, member] of members) {
                let user = await UserModel.findOne({ userId: member.id });
                if (!user) {
                    user = await UserModel.create({ userId: member.id, balance: 0 });
                }
                user.balance += ilosc;
                await user.save();
                zaktualizowano++;

                try {
                    await member.send({
                        embeds: [{
                            color: 0x00FF00,
                            title: '🎁 Otrzymałeś PJN-Coins!',
                            description: `Administrator **${interaction.user.username}** rozdał punkty wszystkim użytkownikom na serwerze **${interaction.guild?.name}**!`,
                            fields: [
                                { name: '💰 Otrzymana kwota', value: `+${ilosc} PJN-Coins`, inline: false },
                                { name: '📌 Powód', value: powod, inline: false }
                            ]
                        }]
                    });
                    wyslanePW++;
                } catch (err) {}
            }

            await interaction.editReply({ content: `✅ Rozdano **${ilosc} PJN-Coins** dla **${zaktualizowano}** użytkowników!\n📩 Wysłano powiadomienia PW do **${wyslanePW}** osób.` });
            return;
        }

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
