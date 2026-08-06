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
import cron from 'node-cron';

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

// Schemat bazy danych dla dynamicznych cytatów
const quoteSchema = new mongoose.Schema({
    text: { type: String, required: true },
    author: { type: String, required: true }
});
const QuoteModel = mongoose.model('Quote', quoteSchema);

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
const ID_KANALU_NOWOSCI = '1534228079914913922';
const ID_KANALU_CYTATY = '1534780578912665653';
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

// Początkowa pula 100 cytatów
const initialQuotes = [
    { text: "Nie liczy się to, co robisz od czasu do czasu, ale to, co robisz codziennie.", author: "Bruce Lee" },
    { text: "Bądź jak woda przepływająca przez szczeliny. Nie bądź sztywny, a dostosujesz się do otoczenia.", author: "Bruce Lee" },
    { text: "Nie ukrywaj porażki, ucz się z niej i idź naprzód.", author: "Bruce Lee" },
    { text: "Nie walcz z życiem, płyń z jego prądem, wykorzystując jego własną energię.", author: "Bruce Lee" },
    { text: "Wiedza nie wystarczy, musimy ją zastosować. Chcenie nie wystarczy, musimy działać.", author: "Bruce Lee" },
    { text: "Błędy są zawsze przebaczalne, jeśli ma się odwagę się do nich przyznać.", author: "Bruce Lee" },
    { text: "Oczekuj najlepszego, ale przygotuj się na najgorsze.", author: "Bruce Lee" },
    { text: "Lataj jak motyl, żądło jak pszczoła.", author: "Muhammad Ali" },
    { text: "Niemożliwe to tylko słowo rzucane przez małych ludzi, którym łatwiej żyć w świecie, który dostarczyli, niż odkryć siłę, którą mają, by go zmienić.", author: "Muhammad Ali" },
    { text: "Człowiek, który nie ma wyobraźni, nie ma skrzydeł.", author: "Muhammad Ali" },
    { text: "Ten, kto nie ryzykuje niczego, nie osiąga niczego.", author: "Muhammad Ali" },
    { text: "Mistrzowie rodzą się z głębokiego pragnienia, marzenia i wizji.", author: "Muhammad Ali" },
    { text: "Nienawidziłem każdej minuty treningu, ale powtarzałem: 'Nie poddawaj się. Cierp teraz i żyj resztę życia jak mistrz'.", author: "Muhammad Ali" },
    { text: "To nie góra, którą musisz pokonać, cię wykańcza; to kamień w twoim bucie.", author: "Muhammad Ali" },
    { text: "Masz władzę nad swoim umysłem – nie nad zewnętrznymi wydarzeniami. Zrozum to, a odnajdziesz siłę.", author: "Marek Aureliusz" },
    { text: "Często cierpimy bardziej w wyobraźni niż w rzeczywistości.", author: "Seneka" },
    { text: "Życie nie polega na czekaniu, aż minie burza, ale na nauce tańca w deszczu.", author: "Seneka" },
    { text: "Szczęście naszego życia zależy od jakości naszych myśli.", author: "Marek Aureliusz" },
    { text: "Człowiek dwa razy traci to, czego się obawia.", author: "Seneka" },
    { text: "Nie bój się, że życie się skończy, bój się, że nigdy tak naprawdę się nie zacznie.", author: "Grace Hansen" },
    { text: "Najlepszą zemstą jest brak podobieństwa do tego, kto wyrządził krzywdę.", author: "Marek Aureliusz" },
    { text: "Trudności wzmacniają umysł tak, jak praca wzmacnia ciało.", author: "Seneka" },
    { text: "Życie jest zbyt krótkie, aby marnować je na pielęgnowanie uraz.", author: "Nelson Mandela" },
    { text: "Edukacja to najpotężniejsza broń, jakiej możesz użyć, aby zmienić świat.", author: "Nelson Mandela" },
    { text: "Wszystko wydaje się niemożliwe, dopóki nie zostanie zrobione.", author: "Nelson Mandela" },
    { text: "Bądź zmianą, którą pragniesz ujrzeć w świecie.", author: "Mahatma Gandhi" },
    { text: "Słabi nigdy nie potrafią przebaczać. Przebaczenie jest atrybutem silnych.", author: "Mahatma Gandhi" },
    { text: "Najlepszym sposobem na odnalezienie samego siebie jest zatracenie się w służbie innym.", author: "Mahatma Gandhi" },
    { text: "Wyobraźnia jest ważniejsza niż wiedza. Wiedza jest ograniczona, podczas gdy wyobraźnia ogarnia cały świat.", author: "Albert Einstein" },
    { text: "Szaleństwo to robienie wciąż tego samego i oczekiwanie różnych rezultatów.", author: "Albert Einstein" },
    { text: "Nigdy nie uczę moich uczniów. Usiłuję tylko stworzyć im warunki, w których mogą się uczyć.", author: "Albert Einstein" },
    { text: "Twój czas jest ograniczony, więc nie marnuj go na życie cudzym życiem.", author: "Steve Jobs" },
    { text: "Innowacja odróżnia lidera od naśladowcy.", author: "Steve Jobs" },
    { text: "Jedynym sposobem na wykonywanie wielkiej pracy jest kochanie tego, co się robi.", author: "Steve Jobs" },
    { text: "Prostota jest szczytem wyrafinowania.", author: "Leonardo da Vinci" },
    { text: "Kto mało myśli, dużo się myli.", author: "Leonardo da Vinci" },
    { text: "Największą chwałą w życiu nie jest to, że nigdy nie upadamy, ale to, że potrafimy podnieść się po każdym upadku.", author: "Konfucjusz" },
    { text: "Wybierz pracę, którą kochasz, a nie będziesz musiał pracować ani jednego dnia w swoim życiu.", author: "Konfucjusz" },
    { text: "Kto pyta, jest głupcem przez pięć minut; kto nie pyta, pozostaje nim na zawsze.", author: "Przysłowie chińskie" },
    { text: "Nawet najdłuższa podróż zaczyna się od jednego kroku.", author: "Lao Tse" },
    { text: "Kto wie, że ma wystarczająco dużo, jest bogaty.", author: "Lao Tse" },
    { text: "Sukces składa się z małych wysiłków powtarzanych dzień po dniu.", author: "Robert Collier" },
    { text: "Za dwadzieścia lat bardziej będziesz żałował tego, czego nie zrobiłeś, niż tego, co zrobiłeś.", author: "Mark Twain" },
    { text: "Sekret sukcesu to zacząć. Sekret zaczynania to rozbicie wielkich, przytłaczających zadań na mniejsze.", author: "Mark Twain" },
    { text: "Bądź sobą; wszyscy inni są już zajęci.", author: "Oscar Wilde" },
    { text: "Doświadczenie to nazwa, którą każdy nadaje swoim błędom.", author: "Oscar Wilde" },
    { text: "Sukces to nie koniec, porażka to nie śmierć: liczy się odwaga, by trwać.", author: "Winston Churchill" },
    { text: "Nigdy, nigdy, nigdy się nie poddawaj.", author: "Winston Churchill" },
    { text: "Kto ma po co żyć, zniesie prawie każde jak.", author: "Friedrich Nietzsche" },
    { text: "Jeśli nie wierzysz w siebie, nikt inny w Ciebie nie uwierzy.", author: "Kobe Bryant" },
    { text: "Skupienie to kwestia rezygnowania z rzeczy, na które nie warto tracić energii.", author: "Kobe Bryant" },
    { text: "Niepowodzenia mnie nie zniechęcają. Każda porażka uczy mnie czegoś nowego.", author: "Michael Jordan" },
    { text: "Przegrałem ponad 300 meczów. 26 razy powierzono mi rzut na wagę zwycięstwa i nie trafiłem. Przegrywałem raz za razem. I dlatego odniosłem sukces.", author: "Michael Jordan" },
    { text: "Granice, podobnie jak strach, to często tylko iluzja.", author: "Michael Jordan" },
    { text: "Im trudniejsze zwycięstwo, tym większa radość z wygranej.", author: "Pele" },
    { text: "Nie ma czegoś takiego jak pech, jest tylko brak przygotowania.", author: "Ayrton Senna" },
    { text: "Najlepszy czas na zasadzenie drzewa był 20 lat temu. Drugi najlepszy czas jest teraz.", author: "Przysłowie chińskie" },
    { text: "Nie mierz się z tym, co osiągnąłeś, ale z tym, co powinieneś osiągnąć, biorąc pod uwagę swoje możliwości.", author: "John Wooden" },
    { text: "Cierpliwość jest gorzka, ale jej owoc jest słodki.", author: "Arystoteles" },
    { text: "Dzielny nie jest ten, kto nie odczuwa strachu, lecz ten, kto potrafi nad nim zapanować.", author: "Nelson Mandela" },
    { text: "Życie nie mierzy się liczbą oddechów, ale chwilami, które zapierają dech w piersiach.", author: "Maya Angelou" },
    { text: "Zamiast martwić się tym, co przyniesie jutro, wykorzystaj w pełni to, co masz dzisiaj.", author: "Seneka" },
    { text: "Kto chce szuka sposobu, kto nie chce – szuka powodu.", author: "Sokrates" },
    { text: "Twoja przyszłość zależy od tego, co zrobisz dzisiaj.", author: "Mahatma Gandhi" },
    { text: "Nigdy nie jest za późno, aby stać się tym, kim mogłeś być.", author: "George Eliot" },
    { text: "Wszystko, o czym marzysz, jest po drugiej stronie strachu.", author: "George Addair" },
    { text: "Człowiek staje się tym, o czym przez cały dzień myśli.", author: "Ralph Waldo Emerson" },
    { text: "Działaj tak, jakby od Twojego działania zależało wszystko, pamiętając zarazem, że nic od Ciebie nie zależy.", author: "Ignacy Loyola" },
    { text: "Nie liczy się to, co spotyka cię w życiu, ale to, jak na to reagujesz.", author: "Epiktet" },
    { text: "Siła nie pochodzi z wygranych. Twoje zmagania rozwijają Twoją siłę.", author: "Arnold Schwarzenegger" },
    { text: "Zrób dziś to, czego inni im nie chcą zrobić, a jutro będziesz żył tak, jak inni nie mogą.", author: "Les Brown" },
    { text: "Nie liczy się to, jak mocno uderzasz, ale jak dużo ciosów możesz przyjąć i iść ciągle naprzód.", author: "Rocky Balboa" },
    { text: "Cierpienie jest najlepszym nauczycielem, ale nikt nie chce być jego uczniem.", author: "Paulo Coelho" },
    { text: "Człowiek jest wielki nie przez to, co posiada, lecz przez to, kim jest; nie przez to, co ma, lecz przez to, czym się dzieli z innymi.", author: "Jan Paweł II" },
    { text: "Wielkość nie polega na tym, że nigdy nie upadasz, ale na tym, że podnosisz się za każdym razem.", author: "Nelson Mandela" },
    { text: "Zwycięzcą jest ten, kto wstaje pięć minut wcześniej, niż poddają się inni.", author: "Henry Ford" },
    { text: "Jeśli płyniesz pod prąd, musisz włożyć wysiłek w każdy ruch, ale dzięki temu rośniesz w siłę.", author: "Seneka" }
];

async function seedQuotesIfNeeded() {
    try {
        const count = await QuoteModel.countDocuments();
        if (count === 0) {
            await QuoteModel.insertMany(initialQuotes);
            console.log('Zainicjalizowano bazę cytatów początkowymi danymi!');
        }
    } catch (e) {
        console.error('Błąd inicjalizacji cytatów:', e);
    }
}

async function sendQuoteToChannel(channelId: string) {
    const channel = await client.channels.fetch(channelId).catch(() => null) as TextChannel;
    if (!channel) return false;

    const count = await QuoteModel.countDocuments();
    if (count === 0) return false;

    const random = Math.floor(Math.random() * count);
    const quote = await QuoteModel.findOne().skip(random);
    if (!quote) return false;

    const embed = new EmbedBuilder()
        .setColor(0xE67E22)
        .setTitle('💡 Życiowa myśl na dzisiejszy poranek')
        .setDescription(`> *„${quote.text}”*\n\n**— ${quote.author}**`)
        .setTimestamp()
        .setFooter({ text: 'PJN Codzienna Inspiracja' });

    // Wysłanie wiadomości z oznaczeniem @everyone oraz embedem
    await channel.send({ 
        content: '@everyone', 
        embeds: [embed],
        allowedMentions: { parse: ['everyone'] } 
    });
    
    return true;
}

function startDailyQuotes() {
    // Codziennie o godzinie 05:30
    cron.schedule('30 5 * * *', async () => {
        try {
            await sendQuoteToChannel(ID_KANALU_CYTATY);
            console.log('Wysłano poranny cytat automatycznie.');
        } catch (err) {
            console.error('Błąd podczas wysyłania codziennego cytatu:', err);
        }
    });
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
    cron.schedule('0 * * * *', async () => {
        try {
            const channel = await client.channels.fetch(ANNOUNCE_CHANNEL_ID).catch(() => null) as TextChannel;
            if (!channel) return;

            await channel.send({ embeds: [createOgłoszenieEmbed()] });
            console.log('Wysłano automatyczne ogłoszenie godzinne.');
        } catch (err) {
            console.error('Błąd ogłoszenia godzinnego:', err);
        }
    });
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
        .addStringOption(o => o.setName('opis').setDescription('Szczegółowy opis zmiany').setRequired(true))
        .addAttachmentOption(o => o.setName('zdjecie').setDescription('Opcjonalne zdjęcie do nowości').setRequired(false)),
    new SlashCommandBuilder().setName('rozdaj-wszystkim').setDescription('Rozdaj PJN-Coinsy wszystkim')
        .addIntegerOption(o => o.setName('ilosc').setDescription('Liczba PJN-Coins').setRequired(true))
        .addStringOption(o => o.setName('powod').setDescription('Powód').setRequired(false)),
    new SlashCommandBuilder().setName('dajpunkty').setDescription('Dodaj PJN-Coins użytkownikowi')
        .addUserOption(o => o.setName('uzytkownik').setDescription('Użytkownik').setRequired(true))
        .addIntegerOption(o => o.setName('ilosc').setDescription('Ilość PJN-Coins').setRequired(true)),
    new SlashCommandBuilder().setName('zabierzpunkty').setDescription('Zabierz PJN-Coins użytkownikowi')
        .addUserOption(o => o.setName('uzytkownik').setDescription('Użytkownik').setRequired(true))
        .addIntegerOption(o => o.setName('ilosc').setDescription('Ilość PJN-Coins').setRequired(true)),
    // Komendy dotyczące cytatów:
    new SlashCommandBuilder()
        .setName('cytat')
        .setDescription('Wyślij losowy życiowy cytat z oznaczeniem @everyone na kanał cytatów'),
    new SlashCommandBuilder()
        .setName('dodaj-cytat')
        .setDescription('Dodaj nowy cytat do bazy bota (Admin)')
        .addStringOption(o => o.setName('tekst').setDescription('Treść cytatu').setRequired(true))
        .addStringOption(o => o.setName('autor').setDescription('Autor cytatu').setRequired(true))
].map(c => c.toJSON());

client.once('ready', async () => {
    console.log(`Zalogowano jako ${client.user?.tag}!`);

    await seedQuotesIfNeeded();

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
    startDailyQuotes();
});

// Naliczanie 1 PJN-Coins za każdą wiadomość
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    try {
        let user = await UserModel.findOne({ userId: message.author.id });
        if (!user) user = await UserModel.create({ userId: message.author.id });

        user.messageCount = (user.messageCount || 0) + 1;
        user.balance += 1;
        
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

// Naliczanie 1 PJN-Coins za każdą minutę spędzoną na kanale głosowym
const voiceTimestamps = new Map<string, number>();

client.on('voiceStateUpdate', async (oldState, newState) => {
    if (newState.member?.user.bot) return;

    const userId = newState.id;
    const now = Date.now();

    if (!oldState.channelId && newState.channelId) {
        voiceTimestamps.set(userId, now);
    } 
    else if (oldState.channelId && !newState.channelId) {
        const joinTime = voiceTimestamps.get(userId);
        if (joinTime) {
            const minutesSpent = Math.floor((now - joinTime) / (1000 * 60));
            if (minutesSpent > 0) {
                try {
                    let user = await UserModel.findOne({ userId });
                    if (!user) user = await UserModel.create({ userId });

                    user.voiceMinutes = (user.voiceMinutes || 0) + minutesSpent;
                    user.balance += minutesSpent;
                    await user.save();
                    
                    if (newState.member) {
                        await checkAndAwardBadges(user, newState.member);
                    }
                } catch (e) {
                    console.error('Błąd zapisu minut głosowych:', e);
                }
            }
            voiceTimestamps.delete(userId);
        }
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

        if (commandName === 'poker') {
            const tryb = interaction.options.getString('tryb', true);
            const stawka = interaction.options.getInteger('stawka', true);

            let hostUser = await UserModel.findOne({ userId: interaction.user.id });
            if (!hostUser) hostUser = await UserModel.create({ userId: interaction.user.id });

            if (hostUser.balance < stawka || stawka <= 0) {
                await interaction.reply({ content: `❌ Nie masz wystarczającej liczby PJN-Coins (${stawka}), aby opłacić wpisowe!`, ephemeral: true });
                return;
            }

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
                    time: 60000 
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
            const zdjecie = interaction.options.getAttachment('zdjecie');

            const targetChannel = await client.channels.fetch(ID_KANALU_NOWOSCI).catch(() => null);
            if (targetChannel && typeof targetChannel.send === 'function') {
                const embed = new EmbedBuilder()
                    .setColor(0x9B59B6)
                    .setTitle(`🚀 NOWOŚĆ: ${tytul}`)
                    .setDescription(opis)
                    .setFooter({ text: `Opublikował ${interaction.user.tag}` })
                    .setTimestamp();

                if (zdjecie) {
                    embed.setImage(zdjecie.url);
                }

                await targetChannel.send({
                    content: '@everyone',
                    embeds: [embed],
                    allowedMentions: { parse: ['everyone'] }
                });

                await interaction.editReply({ content: `✅ Nowość opublikowana na kanale nowości z oznaczeniem @everyone!` });
            } else {
                await interaction.editReply({ content: `❌ Nie znaleziono kanału nowości o ID: ${ID_KANALU_NOWOSCI}.` });
            }
            return;
        }

        // --- Obsługa komendy /cytat (z oznaczeniem @everyone) ---
        if (commandName === 'cytat') {
            await interaction.deferReply({ ephemeral: true });
            const success = await sendQuoteToChannel(ID_KANALU_CYTATY);
            if (success) {
                await interaction.editReply({ content: `✅ Pomyślnie wysłano losowy cytat (z @everyone) na kanał <#${ID_KANALU_CYTATY}>!` });
            } else {
                await interaction.editReply({ content: `❌ Nie udało się wysłać cytatu (sprawdź ID kanału lub bazę).` });
            }
            return;
        }

        // --- Obsługa komendy /dodaj-cytat ---
        if (commandName === 'dodaj-cytat') {
            if (!isAuthorized(interaction.user.id)) {
                await interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
                return;
            }

            await interaction.deferReply({ ephemeral: true });
            const text = interaction.options.getString('tekst', true);
            const author = interaction.options.getString('autor', true);

            try {
                await QuoteModel.create({ text, author });
                await interaction.editReply({ content: `✅ Pomyślnie dodano nowy cytat do bazy!\n> *„${text}”* — **${author}**` });
            } catch (err) {
                console.error('Błąd dodawania cytatu:', err);
                await interaction.editReply({ content: `❌ Wystąpił błąd podczas zapisywania cytatu w bazie.` });
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
            const powod = interaction.options.getString('powod') || 'Brak powodu';

            await UserModel.updateMany({}, { $inc: { balance: ilosc } });

            const allUsers = await UserModel.find({});
            let wyslane = 0;
            let bledy = 0;

            for (const u of allUsers) {
                try {
                    const targetUser = await client.users.fetch(u.userId);
                    if (targetUser) {
                        const embedDm = new EmbedBuilder()
                            .setColor(0xF1C40F)
                            .setTitle('🎁 Otrzymałeś PJN-Coins od Administratora!')
                            .setDescription(
                                `Cześć! Administrator **${interaction.user.tag}** rozdał nagrodę dla całej społeczności!\n\n` +
                                `💰 **Otrzymana kwota:** +${ilosc} PJN-Coins\n` +
                                `📌 **Powód:** *${powod}*\n` +
                                `💼 **Twój aktualny stan konta:** ${u.balance} PJN-Coins`
                            )
                            .setTimestamp();

                        await targetUser.send({ embeds: [embedDm] });
                        wyslane++;
                    }
                } catch (e) {
                    bledy++;
                }
            }

            await interaction.editReply({ 
                content: `✅ Rozdano po **${ilosc} PJN-Coins** wszystkim użytkownikom w bazie!\n📨 Wysłano powiadomienia DM: **${wyslane}** sukcesów, **${bledy}** zablokowanych wiadomości.\n📌 Powód: *${powod}*` 
            });
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
