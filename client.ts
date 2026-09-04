import { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, ComponentType } from 'discord.js';

// --- SYSTEM LFG - ZAKTUALIZOWANE ID ---
const LFG_CONFIG = {
    CATEGORY_VOICE: '1545289592901468170', // Twoje nowe ID Kategorii
    ID_KANALU_SZUKAM_DO_GRY: '1532449084559069214', // Twoje nowe ID kanału szukania
    
    // Nowe role gier przypisane do systemu
    games: [
        { name: 'Fortnite', roleId: '1532400998625181907', emoji: '🎮' },
        { name: 'CS2', roleId: '1532401066832822404', emoji: '🎯' },
        { name: 'Minecraft', roleId: '1532401160596750398', emoji: '⛏️' },
        { name: 'GTA', roleId: '1545290821568438352', emoji: '🚗' },
        { name: 'Valorant', roleId: '1545290283787354113', emoji: '⚡' },
        { name: 'League OF Legends', roleId: '1545290424904843284', emoji: '🏆' }
    ]
};

// Funkcja wysyłająca panel LFG (wklej ją w odpowiednie miejsce inicjalizacji bota, np. po "ready")
async function sendLfgPanel(client: Client) {
    const channel = await client.channels.fetch(LFG_CONFIG.ID_KANALU_SZUKAM_DO_GRY);
    if (!channel || channel.type !== ChannelType.GuildText) return;

    const embed = new EmbedBuilder()
        .setTitle('🎮 System Szukania Graczy (LFG)')
        .setDescription('Wybierz grę poniżej, aby utworzyć dla siebie tymczasowy kanał głosowy i powiadomić innych graczy!')
        .setColor('#5865F2');

    // Tworzenie przycisków dla każdej gry na podstawie nowej listy ID
    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    let currentRow = new ActionRowBuilder<ButtonBuilder>();

    LFG_CONFIG.games.forEach((game, index) => {
        currentRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`lfg_${game.roleId}`)
                .setLabel(game.name)
                .setStyle(ButtonStyle.Primary)
        );

        if ((index + 1) % 5 === 0 || index === LFG_CONFIG.games.length - 1) {
            rows.push(currentRow);
            currentRow = new ActionRowBuilder<ButtonBuilder>();
        }
    });

    await channel.send({ embeds: [embed], components: rows });
}

// Obsługa interakcji przycisków LFG (tworzenie kanału głosowego w określonej kategorii)
async function handleLfgInteraction(interaction: any) {
    if (!interaction.isButton() || !interaction.customId.startsWith('lfg_')) return;

    const roleId = interaction.customId.replace('lfg_', '');
    const game = LFG_CONFIG.games.find(g => g.roleId === roleId);
    if (!game) return;

    const guild = interaction.guild;
    const member = interaction.member;

    await interaction.deferReply({ ephemeral: true });

    try {
        // Tworzenie kanału głosowego w podanej przez Ciebie Kategorii (ID: 1545289592901468170)
        const voiceChannel = await guild.channels.create({
            name: `LFG - ${game.name} (${member.user.username})`,
            type: ChannelType.GuildVoice,
            parent: LFG_CONFIG.CATEGORY_VOICE,
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: [PermissionFlagsBits.ViewChannel],
                },
                {
                    id: member.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.ManageChannels],
                },
            ],
        });

        // Nadanie roli gracza
        await member.roles.add(game.roleId).catch(() => {});

        await interaction.editReply({
            content: `✅ Stworzyłem dla Ciebie kanał głosowy: <#${voiceChannel.id}> oraz przypisałem rangę **${game.name}**!`
        });
    } catch (error) {
        console.error(error);
        await interaction.editReply({
            content: '❌ Wystąpił błąd podczas tworzenia kanału LFG.'
        });
    }
}
