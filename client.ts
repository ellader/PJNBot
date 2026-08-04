function createGryInfoEmbed(): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(0x00FFFF)
        .setTitle('🎮 Centrum Rozrywki i Ekonomii PJN-Coins')
        .setDescription('Witaj w oficjalnym centrum gier serwera! Zbieraj **PJN-Coins** za aktywność na czacie oraz głosie, a następnie pomnażaj je w kasynie lub rywalizuj z innymi.')
        .addFields(
            { 
                name: '💰 Jak zdobywać PJN-Coins?', 
                value: '• Pisanie wiadomości na czacie (`1 Coin` za wiadomość)\n• Przebywanie na kanałach głosowych (`1 Coin` na minutę)\n• Odbieranie darmowej nagrody dziennej: `/daily`' 
            },
            { 
                name: '🎰 Kanał #kasyno (Gry solo)', 
                value: '• `/balans` – Sprawdź stan swojego konta\n• `/daily` – Odbierz codzienne 100 Coins\n• `/kostka [stawka]` – Rzuć wyzwanie botowi na kościach\n• `/moneta [orzel/reszka] [stawka]` – Zagraj w orzeł czy reszka\n• `/quiz` – Odpowiedz na pytanie i zgarnij 50 Coins' 
            },
            { 
                name: '🃏 Kanał #poker (Gry PvP)', 
                value: '• `/poker [stawka]` – Stwórz stół pokerowy dla **2 do 4 graczy**, zbierz znajomych przez przycisk i zgarnij pulę!' 
            },
            { 
                name: '🏆 Kanał #topka-pjn-coins', 
                value: '• Sprawdzaj automatyczny ranking 10 najbogatszych graczy na serwerze.' 
            }
        )
        .setFooter({ text: 'PJN System Gier i Ekonomii' })
        .setTimestamp();
}
