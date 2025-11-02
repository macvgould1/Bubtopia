import UserProfile from '../../schemas/UserProfile.js';
import { MessageFlags } from 'discord.js';

export const data = {
  name: 'shop',
  description: 'Open the shop'
};

// Exported function so Bubtopia can call it
export async function openShop(interaction, userProfile, returnCallback) {
  if (!interaction.inGuild()) {
    return interaction.reply({
      content: "You can only run this command in a server.",
      ephemeral: true
    });
  }

  // Shop inventory
  const items = [
    { name: "Dig Upgrade", desc: "+1 per dig press", price: 75 },
    { name: "Super Shovel", desc: "Dig faster than ever!", price: 150 },
    { name: "Mega Pickaxe", desc: "Boost your mining power!", price: 300 }
  ];

  // Build item components
  const itemBlocks = items.flatMap((item, index) => [
    {
      type: 9,
      id: index + 1,
      components: [
        {
          type: 10,
          id: index + 100,
          content: `**${item.name}**\n${item.desc}`,
        },
      ],
      accessory: {
        type: 2,
        id: index + 200,
        style: 1,
        label: `${item.price}`,
        custom_id: `buy:${item.name}`,
        emoji: { name: "bubux", id: "1431898256840986654" }
      },
    },
    { type: 14, id: index + 300 }
  ]);

  // Add balance and back button
  itemBlocks.push(
    {
      type: 10,
      id: 999,
      content: `**Your Balance:** <:bubux:1431898256840986654> ${userProfile.balance}`
    },
    {
      type: 9,
      id: 1000,
      components: [{ type: 10, id: 1001, content: "🔙 Return to Bubtopia" }],
      accessory: {
        type: 2,
        style: 4,
        label: "Back",
        custom_id: "ReturnToHub"
      }
    }
  );

  const container = [
    {
      type: 17,
      accent_color: 0x3498db,
      components: [
        {
          type: 10,
          content: "**🎪 Dealmaster Dougie's Bargain Barn!**\nClick a button to purchase an item."
        },
        {
          type: 12,
          items: [
            {
              media: {
                url: "https://cdn.discordapp.com/attachments/354040284708864011/1433350344355610674/goodshop.png"
              }
            }
          ]
        },
        ...itemBlocks
      ]
    }
  ];

  // Send the shop
  const shopMessage = await interaction.reply({
    components: container,
    flags: MessageFlags.IsComponentsV2,
    fetchReply: true
  });

  const collector = shopMessage.createMessageComponentCollector({ time: 300_000 });

  collector.on('collect', async (i) => {
    if (i.user.id !== userProfile.userId)
      return i.reply({ content: "This isn't your shop!", ephemeral: true });

    const id = i.customId;

    // Handle purchases
    if (id.startsWith("buy:")) {
      const itemName = id.split(":")[1];
      const item = items.find(it => it.name === itemName);
      if (!item) return i.reply({ content: "Item not found.", ephemeral: true });
      if (userProfile.balance < item.price)
        return i.reply({ content: "Not enough Bubux!", ephemeral: true });

      userProfile.balance -= item.price;
      if (itemName === "Dig Upgrade")
        userProfile.digBonus = (userProfile.digBonus || 0) + 1;

      await userProfile.save();
      await i.reply({ content: `✅ You purchased **${itemName}**!`, ephemeral: true });
    }

    // Back button
    if (id === "ReturnToHub") {
      collector.stop();
      await i.deferUpdate(); // <-- defer first to avoid InteractionAlreadyReplied
      if (returnCallback) {
        await returnCallback(userProfile, i);
      } else {
        // fallback
        await i.followUp({ content: "⚠️ Could not return to Bubtopia (callback not provided).", ephemeral: true });
      }
      return;
    }

    // Update balance text
    const balanceBlock = container[0].components.find(c => c.id === 999);
    if (balanceBlock)
      balanceBlock.content = `**Your Balance:** <:bubux:1431898256840986654> ${userProfile.balance}`;

    await shopMessage.edit({ components: container });
  });
}

// Run just calls openShop
export async function run({ interaction, userProfile }) {
  await openShop(interaction, userProfile);
}
