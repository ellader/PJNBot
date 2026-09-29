import { 
// === NAPRAWIONY SYSTEM POKOJÓW GŁOSOWYCH ===
const voiceSessions = new Map<string, number>();

client.on('voiceStateUpdate', async (oldState, newState) => {
    try {
        const member = newState.member || oldState.member;
        if (!member || member.user.bot) return;

        const userId = member.id;
        const channelId = newState.channelId;
        const guild = newState.guild;

        const ID_KANAL_TWORZENIA = '1554376037746352169';
        const ID_KATEGORII = '1532302511459926067';

        // 1. TWORZENIE PRYWATNEGO KANAŁU
        if (channelId === ID_KANAL_TWORZENIA) {
            const cleanName = member.displayName.toLowerCase().replace(/[^a-z0-9]/g, '');
            const privateChannelName = `🎧•pokój-${cleanName || 'uzytkownika'}`;

            try {
                const voiceChan = await guild.channels.create({
                    name: privateChannelName,
                    type: ChannelType.GuildVoice,
                    parent: ID_KATEGORII,
                    permissionOverwrites: [
                        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { 
                            id: userId, 
                            allow: [
                                PermissionFlagsBits.ViewChannel, 
                                PermissionFlagsBits.Connect, 
                                PermissionFlagsBits.Speak, 
                                PermissionFlagsBits.ManageChannels, 
                                PermissionFlagsBits.MuteMembers, 
                                PermissionFlagsBits.DeafenMembers,
                                PermissionFlagsBits.MoveMembers
                            ] 
                        }
                    ]
                });

                await member.voice.setChannel(voiceChan).catch(() => {});

                const textEmbed = new EmbedBuilder()
                    .setColor(0x3498DB)
                    .setTitle('🎛️ Instrukcja & Panel Zarządzania Prywatnym Pokojem')
                    .setDescription(
                        `Witaj <@${userId}>! To jest Twój prywatny kanał głosowy.\n\n` +
                        `📌 **Zasady i Instrukcja:**\n` +
                        `• Jesteś właścicielem tego pokoju i masz nad nim pełną kontrolę.\n` +
                        `• Użyj przycisków poniżej, aby zablokować lub odblokować dostęp.\n` +
                        `• **Gdy ostatnia osoba opuści ten kanał, bot automatycznie go usunie.**`
                    )
                    .setTimestamp();

                const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder().setCustomId('temp_voice_lock').setLabel('Zablokuj').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
                    new ButtonBuilder().setCustomId('temp_voice_unlock').setLabel('Odblokuj').setStyle(ButtonStyle.Success).setEmoji('🔓')
                );

                await voiceChan.send({ content: `<@${userId}>`, embeds: [textEmbed], components: [row] }).catch(() => {});
            } catch (e) {
                console.error('Błąd tworzenia pokoju:', e);
            }
        }

        // 2. USUWANIE TYLKO PRYWATNYCH POKOJÓW (które zaczynają się od "🎧•pokój-")
        if (oldState.channel && oldState.channel.members.size === 0) {
            const oldChan = oldState.channel;
            if (oldChan.parentId === ID_KATEGORII && oldChan.name.startsWith('🎧•pokój-')) {
                await oldChan.delete('Pusty prywatny kanał').catch(() => {});
            }
        }

        // 3. NALICZANIE CZASU I XP
        if (!oldState.channelId && newState.channelId) {
            voiceSessions.set(userId, Date.now());
        } else if (oldState.channelId && !newState.channelId) {
            const startTime = voiceSessions.get(userId);
            if (startTime) {
                const diffMs = Date.now() - startTime;
                const minutes = Math.floor(diffMs / (1000 * 60));
                voiceSessions.delete(userId);

                if (minutes > 0) {
                    let user = await UserModel.findOne({ userId });
                    if (!user) user = await UserModel.create({ userId });

                    user.voiceMinutes = (user.voiceMinutes || 0) + minutes;
                    user.balance = (user.balance || 0) + (minutes * 2); 
                    await user.save();

                    await addExp(userId, minutes * 5, member.guild); 
                    await checkAndAwardBadges(user, member, member.guild);
                }
            }
        }
    } catch (err) {
        console.error('Błąd w voiceStateUpdate:', err);
    }
});

// === URUCHOMIENIE BOTA ===
client.login(token).catch(err => {
    console.error('Błąd podczas logowania bota Discord:', err);
});
