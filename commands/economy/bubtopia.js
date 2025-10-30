const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const UserProfile = require('../../schemas/UserProfile');
const dailyCommand = require('./daily.js');
const digCommand = require('./dig.js');

const choices = [
  { name: 'Daily Login Bonus', emoji: '📅' },
  { name: 'Mines', emoji: '⛏️' },
  { name: 'Shop', emoji: '1431898256840986654' },
  { name: 'Casino', emoji: '🎰' },
  { name: 'Robbery', emoji: '🥷' },
];

module.exports = {
  data: {
    name: 'bubtopia',
    description: "It's a beautiful place",
  },

  run: async ({ interaction }) => {
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
        .setImage(
          'https://cdn.discordapp.com/attachments/354040284708864011/1433265928526631015/bubtopia.PNG?ex=6904106a&is=6902beea&hm=5365dc6b2e4e79d2be08534c4133e902fd49a8ff46169a08ce098340121152a7&'
        );

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

    const message = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

    const collector = message.createMessageComponentCollector({ time: 300_000 });

    collector.on('collect', async i => {
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
          .setImage(
            'https://cdn.discordapp.com/attachments/354040284708864011/1433265928526631015/bubtopia.PNG?ex=6904106a&is=6902beea&hm=5365dc6b2e4e79d2be08534c4133e902fd49a8ff46169a08ce098340121152a7&'
          );

        await i.update({ embeds: [embed], components: [row] });
        return;
      }

      // ---- MINES BUTTON ----
      if (i.customId === 'Mines') {
        await digCommand.startMining(i, async (updatedProfile, btn) => {
          userProfile.balance = updatedProfile.balance;

          embed = buildHubEmbed();
          const hubButtons = buildHubButtons();
          await btn.update({ embeds: [embed], components: [hubButtons] });
        });
        return;
      }

      // ---- OTHER BUTTONS ----
      if (i.customId === 'Shop') return i.reply({ content: '🛒 Shop coming soon!', ephemeral: true });
      if (i.customId === 'Casino') return i.reply({ content: '🎰 Welcome to the casino!', ephemeral: true });
      if (i.customId === 'Robbery') return i.reply({ content: '🥷 Robbery system under construction!', ephemeral: true });
    });
  },
};