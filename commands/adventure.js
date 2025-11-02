// adventure.js
import OpenAI from "openai";
import { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } from "discord.js";
import UserProfile from "../schemas/UserProfile.js";

export const data = {
  name: "adventure",
  description: "Start an interactive adventure"
};

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Generate a new adventure node
async function generateNode(previousChoices) {
  const prompt = `
You are a fantasy text adventure game master.
Generate a short narrative prompt for a player.
Do not include outcomes or results.
Include 3 short descriptive action names for buttons that could affect gold balance.

Return JSON like this:
{
  "prompt": "The narrative prompt text here",
  "choices": ["choice1", "choice2", "choice3"]
}

Use previousChoices to influence context: ${JSON.stringify(previousChoices)}
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      { role: "system", content: "You are a fantasy adventure game master." },
      { role: "user", content: prompt }
    ],
    max_tokens: 400
  });

  try {
    return JSON.parse(response.choices[0].message.content);
  } catch (err) {
    console.error("Failed to parse GPT response:", response.choices[0].message.content);
    return { prompt: "An error occurred generating the adventure.", choices: ["Explore", "Rest", "Wait"] };
  }
}

// Render a node with buttons
async function renderNode(interaction, userProfile, previousChoices = []) {
  const nodeData = await generateNode(previousChoices);

  const embed = new EmbedBuilder()
    .setTitle("Your Adventure")
    .setDescription(nodeData.prompt)
    .setColor(0x1abc9c);

  const buttons = nodeData.choices.map((choice, index) => {
    const delta = Math.floor(Math.random() * 50) - 25; // Random gold change
    return new ButtonBuilder()
      .setCustomId(`choice_${index}_${delta}`)
      .setLabel(choice)
      .setStyle(delta >= 0 ? ButtonStyle.Success : ButtonStyle.Danger);
  });

  const row = new ActionRowBuilder().addComponents(buttons);

  const message = interaction.deferred || interaction.replied
    ? await interaction.followUp({ embeds: [embed], components: [row], fetchReply: true })
    : await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

  const collector = message.createMessageComponentCollector({ time: 300_000 });

  collector.on("collect", async i => {
    if (i.user.id !== userProfile.userId) {
      return i.reply({ content: "This isn't your adventure!", ephemeral: true });
    }

    const parts = i.customId.split("_");
    const delta = parseInt(parts[2], 10);
    userProfile.balance += delta;
    await userProfile.save();

    await i.update({ content: `You chose: ${nodeData.choices[parseInt(parts[1])]}.\nGold change: ${delta}. Current balance: ${userProfile.balance}`, embeds: [], components: [] });

    previousChoices.push(nodeData.choices[parseInt(parts[1])]);
    await renderNode(i, userProfile, previousChoices);
  });

  collector.on("end", async () => {
    if (!message.deleted) await message.edit({ components: [] });
  });
}

export async function run({ interaction }) {
  const userId = interaction.user.id;
  let userProfile = await UserProfile.findOne({ userId });
  if (!userProfile) userProfile = new UserProfile({ userId, balance: 100 });

  if (!interaction.deferred) await interaction.deferReply();
  await renderNode(interaction, userProfile, []);
}
