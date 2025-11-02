import { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } from 'discord.js';
import UserProfile from '../../schemas/UserProfile.js';
import dailyCommand from './daily.js';
import digCommand from './dig.js';
import robCommand from './rob.js';
import * as shopCommand from './shop.js';

const choices = [
  { name: 'Daily Login Bonus', emoji: '📅' },
  { name: 'Mines', emoji: '⛏️' },
  { name: 'Shop', emoji: '1431898256840986654' },
  { name: 'Casino', emoji: '🎰' },
  { name: 'Robbery', emoji: '🥷' },
];

export const data = {
  name: 'bubtopia',
  description: "It's a beautiful place",
};

export async function run({ interaction }) {
  if (!interaction.inGuild()) {
    return interaction.reply({ content: "You can only run this command in a server.", ephemeral: true });
  }

  const userId = interaction.user.id;
  let userProfile = await UserProfile.findOne({ userId });
  if (!userProfile) userProfile = new UserProfile({ userId });

  const buildHubEmbed = () =>
    new EmbedBuilder()
      .setTitle('Welcome to Bubtopia')
      .setDescription(`A magical place. <:bubux:1431898256840986654> ${userProfile.balance}`)
      .setColor('Green')
      .setTimestamp()
      .setImage('https://cdn.discordapp.com/attachments/354040284708864011/1433265928526631015/bubtopia.PNG');

  const buildHubButtons = () =>
    new ActionRowBuilder().addComponents(
      choices.map(c =>
        new ButtonBuilder()
          .setCustomId(c.name)
          .setLabel(c.name)
          .setStyle(ButtonStyle.Primary)
          .setEmoji(c.emoji)
      )
    );

  let embed = buildHubEmbed();
  const row = buildHubButtons();

  const hubMessage = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

  const collector = hubMessage.createMessageComponentCollector({ time: 300_000 });

  collector.on('collect', async (i) => {
    if (i.user.id !== userId) return i.reply({ content: "This isn't your hub!", ephemeral: true });

    // ---- DAILY LOGIN BONUS ----
    if (i.customId === 'Daily Login Bonus') {
      const result = await dailyCommand.collectDaily(userId);
      userProfile.balance = result.balance;

      embed = new EmbedBuilder()
        .setTitle('Welcome to Bubtopia')
        .setDescription(`A magical place. <:bubux:1431898256840986654> ${userProfile.balance}\n${result.message}`)
        .setColor('Green')
        .setTimestamp()
        .setImage('https://cdn.discordapp.com/attachments/354040284708864011/1433265928526631015/bubtopia.PNG');

      await i.update({ embeds: [embed], components: [row] });
      return;
    }

    // ---- MINES BUTTON ----
    if (i.customId === 'Mines') {
      await digCommand.startMining(i, async (updatedProfile, btn) => {
        userProfile.balance = updatedProfile.balance;

        embed = buildHubEmbed();
        const hubButtons = buildHubButtons();
        await hubMessage.edit({ embeds: [embed], components: [hubButtons] });
      });
      return;
    }

    // ---- SHOP BUTTON ----
    if (i.customId === 'Shop') {
      // Call openShop and pass a callback that edits the original hubMessage
      await shopCommand.openShop(i, userProfile, async (updatedProfile, shopMessage) => {
        userProfile.balance = updatedProfile.balance;
        embed = buildHubEmbed();
        const hubButtons = buildHubButtons();
        await shopMessage.edit({ embeds: [embed], components: [hubButtons] });
      });
      return;
    }

    if (i.customId === 'Casino') return i.reply({ content: '🎰 Welcome to the casino!', ephemeral: true });
    if (i.customId === 'Robbery') await robCommand.run({ interaction: i });
  });
}
