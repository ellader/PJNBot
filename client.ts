import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  TextChannel,
  GuildMember,
} from "discord.js";
import { TikTokLiveConnection } from "tiktok-live-connector";
import fetch from "node-fetch";

// =========================
// CONFIG
// =========================

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) throw new Error("Brak tokena Discord bota!");

const OGLOSZENIA_CHANNEL_ID = "1532399010785263799";
const POWITANIA_CHANNEL_ID = "153241438584706751";

const KICK_USER = "LangusPJN";
const TIKTOK_USER = "LangusPJN";

const COLORS = [0x5865f2, 0x57f287, 0xed4245];

const IMAGES_FORTNITE = [
  "https://images.unsplash.com/photo-1604076918387-52ab59f3d6b3",
  "https://images.unsplash.com/photo-1604076918387-52ab59f3d6b3",
  "https://images.unsplash.com/photo-1604076918387-52ab59f3d6b3"
];

function getRandomFortniteImage(): string {
  return IMAGES_FORTNITE[Math.floor(Math.random() * IMAGES_FORTNITE.length)];
}

// =========================
// DISCORD CLIENT
// =========================

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// =========================
// POWITANIA
// =========================

client.on("guildMemberAdd", (member: GuildMember) => {
  const channel = client.channels.cache.get(POWITANIA_CHANNEL_ID) as TextChannel;
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle(`👋 Witaj ${member.displayName}!`)
    .setColor(COLORS[1])
    .setImage(getRandomFortniteImage());

  channel.send({ embeds: [embed] });
});

// =========================
// TIKTOK MONITOR
// =========================

let wasTikTokLive = false;

const tiktokConn = new TikTokLiveConnection(`@${TIKTOK_USER}`);

tiktokConn.connect().catch(console.error);

tiktokConn.on("streamStart", () => {
  if (!wasTikTokLive) {
    wasTikTokLive = true;

    const embed = new EmbedBuilder()
      .setTitle("🎥 LangusPJN rozpoczął transmisję na TikTok!")
      .setColor(C