import { Client, GatewayIntentBits, Message } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ]
});

// Ścieżka do pliku economy.json w tym samym folderze
const ECONOMY_FILE = path.join(__dirname, 'economy.json');

// Funkcja pomocnicza: Pobieranie danych ekonomii z pliku
function getEconomyData() {
    if (!fs.existsSync(ECONOMY_FILE)) {
        return {};
    }
    try {
        const data = fs.readFileSync(ECONOMY_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error("Błąd odczytu pliku economy.json:", error);
        return {};
    }
}

// Funkcja pomocnicza: Zapisywanie danych ekonomii do pliku
function saveEconomyData(data: any) {
    try {
        fs.writeFileSync(ECONOMY_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
        console.error("Błąd zapisu pliku economy.json:", error);
    }
}

// Funkcja pobierająca balans użytkownika (jeśli nie ma, tworzy z domyślną kwotą np. 1000)
function getUserBalance(userId: string): number {
    const db = getEconomyData();
    
    if (!db[userId]) {
        db[userId] = { balance: 1000 }; // Domyślnie 1000 PJN Coins na start
        saveEconomyData(db);
    }
    
    return db[userId].balance;
}

// Funkcja dodająca lub odejmująca punkty użytkownikowi
function addPoints(userId: string, amount: number) {
    const db = getEconomyData();
    
    if (!db[userId]) {
        db[userId] = { balance: 1000 }; // Startowa pula jeśli użytkownik nie istnieje
    }
    
    db[userId].balance += amount;
    saveEconomyData(db);
    return db[userId].balance;
}

client.once('ready', () => {
    console.log(`Bot ${client.user?.tag} jest online!`);
});

// Przykład użycia w wiadomości (komenda np. !monety lub !balans)
client.on('messageCreate', async (message: Message) => {
    if (message.author.bot) return;

    const args = message.content.trim().split(/ +/);
    const command = args[0].toLowerCase();

    // Sprawdzenie stanu konta
    if (command === '!monety' || command === '!balans') {
        const balance = getUserBalance(message.author.id);
        message.reply(`Twoje saldo to: **${balance} PJN Coins**.`);
    }

    // Przykład testowego dodania punktów komendą: !dodaj @user 100
    if (command === '!dodaj' && message.member?.permissions.has('Administrator')) {
        const targetUser = message.mentions.users.first();
        const amount = parseInt(args[2]);

        if (!targetUser || isNaN(amount)) {
            return message.reply('Użycie: `!dodaj @użytkownik <liczba>`');
        }

        const newBalance = addPoints(targetUser.id, amount);
        message.reply(`Dodano ${amount} PJN Coins dla <@${targetUser.id}>. Nowy stan: **${newBalance}**.`);
    }
});

// Automatyczne przyznanie punktów nowemu użytkownikowi przy dołączeniu na serwer
client.on('guildMemberAdd', async member => {
    // Dodaje domyślne 1000 punktów nowej osobie i zapisuje w pliku
    addPoints(member.id, 1000);
    console.log(`Nowy użytkownik ${member.user.tag} otrzymał 1000 PJN Coins na start.`);
});

// Wpisz tutaj swój token bota
client.login('TWÓJ_TOKEN_BOTA');
