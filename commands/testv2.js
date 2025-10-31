import { SlashCommandBuilder, MessageFlags } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("testv2")
  .setDescription("Test Components v2 with a container and button");

export async function run(dataObj) {
  const interaction = dataObj.interaction;

  // Components v2 payload
  const components = [
    {
      type: 17, // Container
      accent_color: 0x00ff00,
      components: [
        {
          type: 10, // Text Display
          content: "It's dangerous to go alone!",
        },
        {
          type: 14, // Separator
          divider: true,
          spacing: 1,
        },
        {
          type: 10, // Text Display
          content: "Take this.",
        },
        {
          type: 1, // Action Row
          components: [
            {
              type: 2, // Button
              custom_id: "take_item",
              label: "Grab the sword",
              style: 1, // Primary
            },
          ],
        },
      ],
    },
  ];

  // Reply to the interaction
  await interaction.reply({
    components: components,
    flags: MessageFlags.IsComponentsV2,
  });
}