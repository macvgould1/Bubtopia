import UserProfile from '../../schemas/UserProfile.js';
import { MessageFlags } from 'discord.js';

export const data = {
  name: 'shop',
  description: 'Open the shop'
};

export async function run({ interaction, hubMessage, userProfile }) {
  if (!interaction.inGuild()) {
    return interaction.reply({ content: "You can only run this command in a server.", ephemeral: true });
  }

  // Shop items
  const items = [
    { name: "Dig Upgrade", desc: "+1 per dig press", price: 75 },
    { name: "Super Shovel", desc: "Dig faster than ever!", price: 150 },
    { name: "Mega Pickaxe", desc: "Boost your mining power!", price: 300 }
  ];

  // Build shop components
  const components = items.flatMap((item, index) => [
    {
      type: 9, // Section row
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
        style: 1, // Primary
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

  // Add balance display
  components.push({
    type: 10,
    id: 999,
    content: `Your balance: <:bubux:1431898256840986654> ${userProfile.balance}`
  });

  // Add Back button as a section row
  components.push({
    type: 9,
    id: 1000,
    components: [
      {
        type: 10,
        id: 1001,
        content: "🔙 Return to Bubtopia"
      }
    ],
    accessory: {
      type: 2,
      style: 4, // Danger / Secondary style
      label: "Back",
      custom_id: "ReturnToHub"
    }
  });

  // Container for shop message
  const container = [
    {
      type: 17,
      accent_color: 0x3498db, // blue
      components: [
        {
          type: 10,
          content: "**🎪 Dealmaster Dougie's Bargain Barn!**\nClick a button to purchase an item."
        },
        {
          type: 12,
          items: [
            { media: { url: 'https://cdn.discordapp.com/attachments/354040284708864011/1433350344355610674/goodshop.png' } }
          ]
        },
        ...components
      ]
    }
  ];

  // Send the shop
  await interaction.reply({
    components: container,
    flags: MessageFlags.IsComponentsV2
  });

  // Collector for buttons
  const collector = hubMessage.createMessageComponentCollector({ time: 300_000 });

  collector.on('collect', async i => {
    if (i.user.id !== userProfile.userId) {
      return i.reply({ content: "This isn't your shop!", ephemeral: true });
    }

    // Purchase Dig Upgrade
    if (i.customId === "buy:Dig Upgrade") {
      if (userProfile.balance < 75) {
        return i.reply({ content: "Not enough Bubux!", ephemeral: true });
      }
      userProfile.balance -= 75;
      userProfile.digBonus = (userProfile.digBonus || 0) + 1;
      await userProfile.save();

      await i.reply({ content: "You purchased **Dig Upgrade**! +1 per dig press", ephemeral: true });
    }

    // Purchase other items
    if (i.customId.startsWith("buy:") && i.customId !== "buy:Dig Upgrade") {
      const itemName = i.customId.split(":")[1];
      const item = items.find(it => it.name === itemName);
      if (!item) return i.reply({ content: "Item not found.", ephemeral: true });
      if (userProfile.balance < item.price) return i.reply({ content: "Not enough Bubux!", ephemeral: true });

      userProfile.balance -= item.price;
      await userProfile.save();

      await i.reply({ content: `You purchased **${itemName}** for ${item.price} Bubux!`, ephemeral: true });
    }

    // Back button
    if (i.customId === "ReturnToHub") {
      // Restore hub
      await hubMessage.edit({
        content: "Returning to Bubtopia...",
        components: []
      });
      collector.stop();
      return;
    }

    // Update balance in shop
    const balanceBlock = container[0].components.find(c => c.id === 999);
    if (balanceBlock) balanceBlock.content = `Your balance: <:bubux:1431898256840986654> ${userProfile.balance}`;
    await hubMessage.edit({ components: container });
  });
}