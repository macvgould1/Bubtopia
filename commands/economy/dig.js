const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const UserProfile = require('../../schemas/UserProfile');

function getRandomNumber(x, y) {
  return Math.floor(Math.random() * (y - x + 1)) + x;
}

async function startMining(interaction, returnCallback) {
  const userId = interaction.user.id;
  let userProfile = await UserProfile.findOne({ userId });
  if (!userProfile) userProfile = new UserProfile({ userId });

  // Embed for mines
  let embed = new EmbedBuilder()
    .setTitle('The Bub Mines')
    .setDescription(`You have descended deep below the bub shaft.`)
    .setColor('Green')
    .setTimestamp()
    .setImage(
      'https://cdn.discordapp.com/attachments/354040284708864011/1432626661496717342/bubmine2.png?ex=6901bd0d&is=69006b8d&hm=51e03dff1bcc07dd642eb24401dafcb93443fcd31c786a0f86ba93bffe3a99ee&'
    );

  // Buttons: Dig + Return to Hub
  const digButton = new ButtonBuilder()
    .setCustomId('Dig')
    .setLabel('Dig')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('⛏️');

  const returnButton = new ButtonBuilder()
    .setCustomId('ReturnHub')
    .setLabel('Return to Bub')
    .setStyle(ButtonStyle.Primary)
    .setEmoji('🏠');

  const row = new ActionRowBuilder().addComponents(digButton, returnButton);

  const message = await interaction.update({ embeds: [embed], components: [row] });

  const collector = message.createMessageComponentCollector({ time: 300_000 });

  collector.on('collect', async i => {
    if (i.user.id !== userId)
      return i.reply({ content: "Get out me bub mines!", ephemeral: true });

    if (i.customId === 'Dig') {
      const baseEarned = getRandomNumber(1, 10);
      const earned = baseEarned + (userProfile.digBonus || 0);
      userProfile.balance += earned;
      await userProfile.save();

      embed.setDescription(
        `You earned <:bubux:1431898256840986654> ${baseEarned} +  <:bubux:1431898256840986654> ${userProfile.digBonus}!\nTotal: <:bubux:1431898256840986654> ${userProfile.balance}`
      );

      await i.update({ embeds: [embed], components: [row] });
    }

    if (i.customId === 'ReturnHub') {
      collector.stop();
      if (returnCallback) await returnCallback(userProfile, i);
    }
  });
}

// Dummy run function to satisfy djs-commander
async function run({ interaction }) {
  return interaction.reply({ content: 'Use the Mines button from Bubtopia to start digging!', ephemeral: true });
}

module.exports = {
  data: { name: 'dig', description: 'Dig for extra bubux' },
  run,
  startMining,
};