const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const UserProfile = require('../../schemas/UserProfile');
const dailyCommand = require('./daily.js');
const digCommand = require('./dig.js');
const robCommand = require('./rob.js');
const shopCommand = require('./shop.js');

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

      // Callback to return to main hub
const returnToHub = async (i) => {
  // Rebuild the hub embed
  const hubEmbed = new EmbedBuilder()
    .setTitle('Welcome to Bubtopia')
    .setDescription(`A magical place. <:bubux:1431898256840986654> ${userProfile.balance}`)
    .setColor('Green')
    .setTimestamp()
    .setImage('https://cdn.discordapp.com/attachments/354040284708864011/1433265928526631015/bubtopia.PNG?ex=6904106a&is=6902beea&hm=5365dc6b2e4e79d2be08534c4133e902fd49a8ff46169a08ce098340121152a7&');

  // Rebuild the hub buttons
  const hubButtons = new ActionRowBuilder().addComponents(
    choices.map(c =>
      new ButtonBuilder()
        .setCustomId(c.name)
        .setLabel(c.name)
        .setStyle(ButtonStyle.Primary)
        .setEmoji(c.emoji)
    )
  );

  await i.update({ embeds: [hubEmbed], components: [hubButtons] });
};

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

      // ---- SHOP BUTTON ----
if (i.customId === 'Shop') {
  // Require the shop command
  const shopCommand = require('./shop.js');

  // Run the shop command and pass necessary context
  await shopCommand.run({
    interaction: i,
    hubMessage: message,            // the original hub message
    buildHubEmbed: buildHubEmbed,   // function to rebuild hub embed
    buildHubButtons: buildHubButtons, // function to rebuild hub buttons
    userProfile: userProfile
  });
  return;
}
      if (i.customId === 'Casino') return i.reply({ content: '🎰 Welcome to the casino!', ephemeral: true });
      if (i.customId === 'Robbery') {
  await robCommand.run({ interaction: i });
}
    });
  },
};