const { EmbedBuilder } = require('discord.js');
const UserProfile = require('../../schemas/UserProfile');

module.exports = {
  data: {
    name: 'shop',
    description: 'Open the shop',
  },

  run: async ({ interaction, hubMessage, userProfile }) => {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: "You can only run this command in a server.", ephemeral: true });
    }

    const items = [
      { name: "Dig Upgrade", desc: `+1 per dig press`, price: 75 },
      { name: "Super Shovel", desc: "Dig faster than ever!", price: 150 },
      { name: "Mega Pickaxe", desc: "Boost your mining power!", price: 300 }
    ];

    // Build components (Component V2)
    const components = items.flatMap((item, index) => [
      {
        type: 9, // Row for item
        id: index + 1,
        components: [
          {
            type: 10, // Text block
            id: index + 100,
            content: `**${item.name}**\n- ${item.desc}`,
          },
        ],
        accessory: {
          type: 2, // Button
          id: index + 200,
          style: 3,
          label: `${item.price}`,
          custom_id: `buy:${item.name}`,
          emoji: { name: "bubux", id: "1431898256840986654" },
          disabled: false
        },
      },
      {
        type: 14, // Divider
        id: index + 300,
        divider: true,
        spacing: 1
      }
    ]);

    // Add footer/page info as a final text block
    components.push({
      type: 10,
      id: 999,
      content: `Your balance: <:bubux:1431898256840986654> ${userProfile.balance}`
    });

    // Send or edit hub message with Component V2
    await hubMessage.edit({
      content: "### Dealmaster Dougie's Bargain Barn\nClick a button to purchase an item!",
      components: components,
      use_component_v2: true
    });

    await interaction.deferUpdate();

    // Component collector
    const collector = hubMessage.createMessageComponentCollector({ time: 300_000 });

    collector.on('collect', async i => {
      if (i.user.id !== userProfile.userId) return i.reply({ content: "This isn't your shop!", ephemeral: true });

      if (i.customId.startsWith("buy:")) {
        const itemName = i.customId.split(":")[1];
        const item = items.find(it => it.name === itemName);

        if (!item) return i.reply({ content: "Item not found.", ephemeral: true });
        if (userProfile.balance < item.price) return i.reply({ content: "Not enough bubux!", ephemeral: true });

        // Deduct price and apply effect (example: dig bonus for Dig Upgrade)
        userProfile.balance -= item.price;
        if (itemName === "Dig Upgrade") userProfile.digBonus = (userProfile.digBonus || 0) + 1;
        await userProfile.save();

        await i.reply({ content: `You purchased **${itemName}** for ${item.price} bubux!`, ephemeral: true });

        // Update balance display
        const balanceBlock = components.find(c => c.type === 10 && c.id === 999);
        if (balanceBlock) balanceBlock.content = `Your balance: <:bubux:1431898256840986654> ${userProfile.balance}`;

        await hubMessage.edit({ components: components });
      }
    });
  }
};