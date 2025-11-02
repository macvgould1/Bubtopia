// adventure.js
import OpenAI from "openai";
import { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } from "discord.js";
import UserProfile from "../schemas/UserProfile.js";

export const data = {
  name: "adventure",
  description: "Start an interactive fantasy adventure"
};

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Generate a new adventure node with story arc consideration
async function generateNode(previousChoices) {
  const prompt = `
You are a master of whimsical fantasy adventures.
Generate a short narrative prompt for the player (2-4 sentences) that is descriptive, magical, and fantastical.
Do not include outcomes. Only generate the scene text.
Include 3 short action names (5 words max) for buttons that the player could choose.
The choices should influence gold balance in small amounts (+/-25).
Take previousChoices into account to progress a story arc with rising action, climax, falling action, and resolution.
Return strictly JSON like this:
{
  "prompt": "Short whimsical narrative prompt here.",
  "choices": ["Choice 1", "Choice 2", "Choice 3"]
}
Use previousChoices: ${JSON.stringify(previousChoices)}
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      { role: "system", content: "You are a fantasy adventure game master." },
      { role: "user", content: prompt }
    ],
    max_tokens: 300
  });

  try {
    return JSON.parse(response.choices[0].message.content);
  } catch (err) {
    console.error("Failed to parse GPT response:", response.choices[0].message.content);
    return {
      prompt: "A strange mist surrounds you, and a path appears.",
      choices: ["Investigate mist", "Walk carefully", "Shout for help"]
    };
  }
}

// Render a node and handle button interaction
async function renderNode(interaction, userProfile, previousChoices = []) {
  const nodeData = await generateNode(previousChoices);

  const embed = new EmbedBuilder()
    .setTitle("Your Adventure")
    .setDescription(nodeData.prompt)
    .setColor(0x1abc9c);

  const buttons = nodeData.choices.map((choice, index) => {
    const delta = Math.floor(Math.random() * 51) - 25; // Random gold change (-25 to +25)
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

    previousChoices.push(nodeData.choices[parseInt(parts[1])]);
    await i.update({ embeds: [], components: [] });

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