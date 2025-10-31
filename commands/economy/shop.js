const {
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle
} = require('discord.js');
const UserProfile = require('../../schemas/UserProfile');

module.exports = {
  data: {
    name: 'shop',
    description: 'Open the shop',
  },

  run: async ({ interaction, hubMessage, buildHubEmbed, buildHubButtons, userProfile }) => {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: "You can only run this command in a server.", ephemeral: true });
    }

    // Build shop embed
    const shopEmbed = new EmbedBuilder()
      .setTitle('Dealmaster Dougie\'s Bargain Barn')
      .setDescription(
        `Welcome to the shop! You have <:bubux:1431898256840986654> ${userProfile.balance}.\n\n` +
        `Upgrade available:\n- Dig Upgrade: +1 per dig press (Cost: 75 bubux)\n` +
        `Current dig bonus: +${userProfile.digBonus || 0}`
      )
      .setColor('Blue')
      .setImage('https://cdn.discordapp.com/attachments/354040284708864011/1433350344355610674/goodshop.png?ex=69045f08&is=69030d88&hm=e6575099d63c33423e196bd7c60223238ea0f64447808f7e16dd17806409c0e0&')
      .setTimestamp();

    // Buttons: purchase dig upgrade + return to hub
    const purchaseUpgradeBtn = new ButtonBuilder()
      .setCustomId('PurchaseDigUpgrade')
      .setLabel('Purchase Dig Upgrade (+1 per dig)')
      .setStyle(ButtonStyle.Primary);

    const returnHubBtn = new ButtonBuilder()
      .setCustomId('ReturnToHub')
      .setLabel('Return to Bubtopia')
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(purchaseUpgradeBtn, returnHubBtn);

    // Edit the original hub message with the shop embed
    await hubMessage.edit({ embeds: [shopEmbed], components: [row] });
    await interaction.deferUpdate(); // acknowledge button press silently

    // Collector for shop buttons
    const collector = hubMessage.createMessageComponentCollector({ time: 300_000 });

    collector.on('collect', async (i) => {
      if (i.user.id !== userProfile.userId) return i.reply({ content: "This isn't your shop!", ephemeral: true });

      // PURCHASE DIG UPGRADE
      if (i.customId === 'PurchaseDigUpgrade') {
        if (userProfile.balance < 75) {
          await i.reply({ content: 'Not enough bubux!', ephemeral: true });
          return;
        }

        userProfile.balance -= 75;
        userProfile.digBonus = (userProfile.digBonus || 0) + 1;
        await userProfile.save();

        // Update shop embed with new balance and dig bonus
        const updatedEmbed = EmbedBuilder.from(shopEmbed)
          .setDescription(
            `Welcome to the shop! You have <:bubux:1431898256840986654> ${userProfile.balance}.\n\n` +
            `Upgrade available:\n- Dig Upgrade: +1 per dig press (Cost: 75 bubux)\n` +
            `Current dig bonus: +${userProfile.digBonus}`
          );

        await i.update({ embeds: [updatedEmbed], components: [row] });
        return;
      }

      // RETURN TO HUB
      if (i.customId === 'ReturnToHub') {
        // Restore original hub embed and buttons
        await hubMessage.edit({
          embeds: [buildHubEmbed()],
          components: [buildHubButtons()]
        });
        await i.deferUpdate(); // prevent "interaction already acknowledged" error
        collector.stop(); // stop the shop collector
      }
    });
  },
};