import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import mongoose from 'mongoose';

// === KONFIGURACJA / ID KANAŁÓW I RÓL ===
const TOKEN = 'TWOJ_TOKEN_BOTA_TUTAJ'; // Wpisz swój token bota
const TOP_CHANNEL_ID = '1534049518377631826'; // #topka-pjn-coins
const DUSZKI_CHANNEL_ID = '1532977723843285112'; // #darmowe-duszki

// ID Ról dla powiadomienia na kanale Duszki
const ROLE_DUSZKOWIEC = '1532978703842283551';
const ROLE_MODERATOR = '1532321767857721344';
const ROLE_ADMIN_STREAMER = '1532324059470237857';

// === MODEL MONGOOSE ===
const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    balance: { type: Number, default: 0 },
    messageCount: { type: Number, default: 0 },
    emojiCount: { type: Number, default: 0 },
    duszkiNotified: { type: Boolean, default: false } // Flaga zapobiegająca spamowi na duszkach
});

const UserModel = mongoose.model('User', userSchema);

// === INICJALIZACJA KLIENTA DISCORDA ===
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// === FUNKCJA GENERUJĄCA EMBED RANKINGU TOP 10 ===
async function getTopEmbedData(guild: any) {
    const topUsers = await UserModel.find().sort({ balance: -1 }).limit(10);
    
    let description = 'Ranking jest automatycznie aktualizowany co 5 minut.\n\n**Najbogatsi użytkownicy**\n';
    
    if (topUsers.length === 0) {
        description += 'Brak danych w rankingu.';
    } else {
        topUsers.forEach((u, index) => {
            let medal = `${index + 1}.`;
            if (index === 0) medal = '🥇';
            if (index === 1) medal = '🥈';
            if (index === 2) medal = '🥉';

            let memberName = `<@${u.userId}>`;
            if (guild) {
                const member = guild.members.cache.get(u.userId);
                if (member) memberName = member.user.username;
            }

            description += `${medal} ${memberName} — ${u.balance} PJN-Coins\n`;
        });
    }

    return new EmbedBuilder()
        .setTitle('🏆 TOP 10 - Ranking PJN-Coins')
        .setDescription(description)
        .setColor('#FFD700')
        .setTimestamp();
}

// === FUNKCJA SPRAWDZAJĄCA ODZNAKI ===
async function checkAndAwardBadges(user: any, member: any) {
    try {
        if (member && member.roles && typeof member.roles.cache?.some === 'function') {
            // Twoja logika odznak
        }
    } catch (err) {
        // Ciche pominięcie błędów odznak
    }
}

// === ZDARZENIE: GOTOWY DO PRACY ===
client.once('ready', async () => {
    console.log(`Zalogowano jako ${client.user?.tag}!`);

    // Automatyczna aktualizacja rankingu TOP 10
    const updateTopka = async () => {
        try {
            const channel = await client.channels.fetch(TOP_CHANNEL_ID).catch(() => null);
            if (!channel || !channel.isTextBased()) {
                console.log('⚠️ Kanał rankingu nie jest tekstowy lub nie istnieje.');
                return;
            }

            const guild = 'guild' in channel ? channel.guild : null;
            const embedData = await getTopEmbedData(guild);

            const messages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
            if (!messages) return;

            const botMessage = messages.find(m => m.author.id === client.user?.id);

            if (botMessage) {
                await botMessage.edit({ embeds: [embedData] }).catch(() => {});
                console.log('✅ Zaktualizowano ranking (edycja).');
            } else {
                await channel.send({ embeds: [embedData] }).catch(() => {});
                console.log('✅ Wysłano nową wiadomość rankingu.');
            }
        } catch (error) {
            console.error('❌ BŁĄD RANKINGU:', error);
        }
    };

    // Odpal raz po starcie bota i ustaw pętlę co 5 minut
    await updateTopka();
    setInterval(updateTopka, 5 * 60 * 1000);
});

// === ZDARZENIE: NOWA WIADOMOŚĆ ===
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    // 1. Obsługa kanału DARMOWE DUSZKI (Tylko 1 wiadomość na użytkownika)
    if (message.channel.id === DUSZKI_CHANNEL_ID) {
        let userDb = await UserModel.findOne({ userId: message.author.id });
        if (!userDb) userDb = await UserModel.create({ userId: message.author.id });

        if (!userDb.duszkiNotified) {
            userDb.duszkiNotified = true;
            await userDb.save();

            await message.reply({
                content: `Cześć <@${message.author.id}>, dziękuję że jesteś, teraz zawołałem osoby odpowiedzialne do Ciebie abyście porozmawiali o darmowych duszkach!\n\n<@&${ROLE_DUSZKOWIEC}> <@&${ROLE_MODERATOR}> <@&${ROLE_ADMIN_STREAMER}>`
            }).catch(() => {});
        }
    }

    // 2. Standardowe zliczanie wiadomości i emotikonów (statystyki użytkownika)
    let userStats = await UserModel.findOne({ userId: message.author.id });
    if (!userStats) userStats = await UserModel.create({ userId: message.author.id });

    userStats.messageCount += 1;
    const customEmojis = message.content.match(/<a?:\w+:\d+>/g);
    if (customEmojis) userStats.emojiCount += customEmojis.length;

    await userStats.save();
    await checkAndAwardBadges(userStats, message.member);
});

// === URUCHOMIENIE BOTA I MONGOOSE ===
async function startBot() {
    try {
        await mongoose.connect('mongodb://localhost:27017/twojanazwabazy');
        console.log('Połączono z bazą MongoDB.');

        await client.login(TOKEN);
    } catch (error) {
        console.error('Błąd podczas uruchamiania bota:', error);
    }
}

startBot();
