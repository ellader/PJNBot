// ID kanału, na który wysyłane jest ogłoszenie o streamie (dopasuj, jeśli potrzebujesz konkretnego)
const STREAM_ANNOUNCE_CHANNEL_ID = NEWS_CHANNEL_ID; 
// ID kanału głosowego, którego nazwa ma się zmieniać podczas streama
const STREAM_VOICE_CHANNEL_ID = '1532336632982798417'; // (Możesz podmienić na dedykowane ID kanału streama)

// === Wewnątrz obsługi komend (interactionCreate) ===

        else if (commandName === 'odpalstream') {
            const tytul = interaction.options.getString('tytul', true);
            const link = interaction.options.getString('link', true);

            try {
                // 1. Zmiana nazwy kanału głosowego na czas streama
                if (STREAM_VOICE_CHANNEL_ID) {
                    const voiceChannel = await interaction.guild?.channels.fetch(STREAM_VOICE_CHANNEL_ID);
                    if (voiceChannel && voiceChannel.isVoiceBased()) {
                        await voiceChannel.setName(`🔴 LIVE: ${tytul.substring(0, 80)}`);
                    }
                }

                // 2. Wysłanie ogłoszenia na kanał
                const channel = await interaction.guild?.channels.fetch(STREAM_ANNOUNCE_CHANNEL_ID);
                if (channel && channel.isTextBased()) {
                    await channel.send({
                        content: '@everyone 🔴 **Trwa transmisja na żywo!**',
                        embeds: [{
                            color: 0xFF0000,
                            title: `🎥 ${tytul}`,
                            description: `**Streamer:** <@${interaction.user.id}>\n\nKliknij przycisk poniżej lub link, aby przejść do transmisji!`,
                            fields: [
                                { name: '🔗 Link do streama', value: `[Kliknij tutaj, aby oglądać](${link})`, inline: false }
                            ],
                            footer: { text: 'System Streamów PJN' },
                            timestamp: new Date().toISOString()
                        }]
                    });
                }

                await interaction.reply({ content: `✅ Pomyślnie rozpoczęto stream i powiadomiono serwer!`, ephemeral: true });
            } catch (err) {
                console.error(err);
                await interaction.reply({ content: `❌ Wystąpił błąd podczas uruchamiania streama.`, ephemeral: true });
            }
            return;
        }

        else if (commandName === 'zakonczstream') {
            try {
                // 1. Przywrócenie domyślnej nazwy kanału głosowego
                if (STREAM_VOICE_CHANNEL_ID) {
                    const voiceChannel = await interaction.guild?.channels.fetch(STREAM_VOICE_CHANNEL_ID);
                    if (voiceChannel && voiceChannel.isVoiceBased()) {
                        await voiceChannel.setName(`🟢 Kanał Streamera`); // Możesz wpisać domyślną nazwę
                    }
                }

                await interaction.reply({ content: `⏹️ Transmisja została zakończona, a kanał przywrócono do stanu domyślnego.`, ephemeral: true });
            } catch (err) {
                console.error(err);
                await interaction.reply({ content: `❌ Wystąpił błąd podczas kończenia streama.`, ephemeral: true });
            }
            return;
        }
