// adventure.js
import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import UserProfile from '../schemas/UserProfile.js';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Generate a short fantasy prompt text based on previous choices
async function generateNode(previousChoices) {
  const prompt = `
Generate a whimsical, short fantasy adventure scene for Discord.
Previous player choices: ${previousChoices.join(', ') || 'none'}.
Only return descriptive text, no options.
Focus on rising action, climax, and falling action in the story arc.
Keep it short, vivid, and fantastical.
`;
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.8,
    max_tokens: 200
  });
  return response.choices[0].message.content.trim();
}

// Generate 3 button choices affecting balance
async function generateChoices() {
  return [
    { label: "Brave Attack", value: Math.floor(Math.random() * 50) + 10 },
    { label: "Cautious Move", value: Math.floor(Math.random() * 20) - 10 },
    { label: "Magical Trick", value: Math.floor(Math.random() * 30) + 5 }
  ];
}

async function renderNode(interaction, userProfile, previousChoices = []) {
  try {
    // Defer if slash command
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const promptText = await generateNode(previousChoices);
    const choices = await generateChoices();

    const embed = new EmbedBuilder()
      .setTitle("Your Adventure")
      .setDescription(promptText)
      .setColor(0x1F8B4C);

    const row = new ActionRowBuilder().addComponents(
      choices.map(c =>
        new ButtonBuilder()
          .setCustomId(`choice_${c.label}_${c.value}`)
          .setLabel(c.label)
          .setStyle(ButtonStyle.Primary)
      )
    );

    const message = await interaction.editReply({ embeds: [embed], components: [row] });

    const collector = message.createMessageComponentCollector({ time: 300_000 });

    collector.on('collect', async i => {
      if (!i.user || i.user.id !== interaction.user.id) {
        return i.reply({ content: "This isn't your adventure!", ephemeral: true });
      }

      const [_, label, value] = i.customId.split('_');
      const delta = parseInt(value);

      userProfile.balance += delta;
      await userProfile.save();

      previousChoices.push(label);

      // Render next node with the button interaction
      await renderNode(i, userProfile, previousChoices);
    });

    collector.on('end', async () => {
      const disabledRow = new ActionRowBuilder().addComponents(
        row.components.map(c => c.setDisabled(true))
      );
      await interaction.editReply({ components: [disabledRow] }).catch(() => {});
    });

  } catch (err) {
    console.error("Error rendering node:", err);
    if (!interaction.replied) {
      await interaction.reply({ content: "An error occurred while generating the adventure.", ephemeral: true }).catch(() => {});
    }
  }
}

// Slash command export for djs-commander
export const data = new SlashCommandBuilder()
  .setName('adventure')
  .setDescription('Start a whimsical fantasy adventure!');

export async function run(interaction) {
  if (!interaction.user || !interaction.user.id) {
    return interaction.reply({ content: "Error: cannot identify user.", ephemeral: true });
  }

  let userProfile = await UserProfile.findOne({ userId: interaction.user.id });
  if (!userProfile) {
    userProfile = new UserProfile({ userId: interaction.user.id, balance: 100 });
    await userProfile.save();
  }

  await renderNode(interaction, userProfile);
}
