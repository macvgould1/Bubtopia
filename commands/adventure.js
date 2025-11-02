// adventure.js
import OpenAI from "openai";
import { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } from "discord.js";
import UserProfile from "../schemas/UserProfile.js";

export const data = {
  name: "adventure",
  description: "Start an interactive adventure"
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Generate a new adventure node with AI-provided gold values
async function generateNode(previousChoices, currentBalance) {
  const prompt = `
You are a fantasy text adventure game master.
Generate a short whimsical narrative prompt for a player (2 sentences).
Do not include outcomes or results.
Provide 3 short descriptive action names for buttons.
For each choice, provide a gold change that makes sense according to the choice:
- The gold loss cannot be more than the player's current balance (negative values between -${currentBalance} and 0)
- Positive rewards should be reasonable, up to +25

Return JSON like this:
{
  "prompt": "The narrative prompt text here",
  "choices": [
    { "text": "Choice 1 text", "gold": 10 },
    { "text": "Choice 2 text", "gold": -5 },
    { "text": "Choice 3 text", "gold": 20 }
  ]
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
    // Remove plus signs to make valid JSON
    const content = response.choices[0].message.content.replace(/\+(\d+)/g, '$1');
    return JSON.parse(content);
  } catch (err) {
    console.error("Failed to parse GPT response:", response.choices[0].message.content);
    return {
      prompt: "An error occurred generating the adventure.",
      choices: [
        { text: "Explore", gold: Math.min(5, currentBalance) },
        { text: "Rest", gold: 0 },
        { text: "Wait", gold: -Math.min(5, currentBalance) }
      ]
    };
  }
}

// Render a node with buttons and show updated balance
async function renderNode(interaction, userProfile, previousChoices = []) {
  const nodeData = await generateNode(previousChoices, userProfile.balance);

  const embed = new EmbedBuilder()
    .setTitle("Your Adventure")
    .setDescription(`${nodeData.prompt}\n\n**Current Gold:** ${userProfile.balance}`)
    .setColor(0x1abc9c);

  const buttons = nodeData.choices.map((choice, index) =>
    new ButtonBuilder()
      .setCustomId(`choice_${index}_${choice.gold}`)
      .setLabel(choice.text)
      .setStyle(choice.gold >= 0 ? ButtonStyle.Success : ButtonStyle.Danger)
  );

  const row = new ActionRowBuilder().addComponents(buttons);

  const message = interaction.deferred || interaction.replied
    ? await interaction.followUp({ embeds: [embed], components: [row], fetchReply: true })
    : await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

  const collector = message.createMessageComponentCollector({ time: 300_000 });

  collector.on("collect", async i => {
    if (i.user.id !== userProfile.userId) {
      return i.reply({ content: "This isn't your adventure!", ephemeral: true });
    }

    const [_, choiceIndexStr, goldStr] = i.customId.split("_");
    const choiceIndex = parseInt(choiceIndexStr, 10);
    const delta = parseInt(goldStr, 10);

    // Ensure gold cannot go below 0
    const actualDelta = Math.max(-userProfile.balance, delta);

    userProfile.balance += actualDelta;
    await userProfile.save();

    previousChoices.push(nodeData.choices[choiceIndex].text);

    await i.deferUpdate();

    // Render next node with updated balance
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
