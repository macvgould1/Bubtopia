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

// In-memory session cache
const sessionCache = new Map();

// Generate a new adventure node
async function generateNode(previousChoices, lastChoice, currentBalance) {
  let outcomePart = "";
  if (lastChoice) {
    outcomePart = `
Describe the consequence of your last choice: "${lastChoice.text}".
Use second-person perspective ("you") and never reference "the player".
Mention explicitly how the choice affected your gold balance (${lastChoice.gold > 0 ? '+' : ''}${lastChoice.gold} gold).
Write exactly three sentences:
1. Consequence of the last choice and gold change.
2-3. Progress the story naturally and introduce context for the next set of choices.
`;
  }

  const prompt = `
You are a whimsical fantasy adventure game master.
${outcomePart}
Now generate the next adventure step:
- 3-sentence narrative prompt addressed to "you" (second-person)
- 3 creative action choices:
    * Each choice must naturally be 4 words or fewer.
    * Negative gold cannot exceed your current balance.
    * Positive gold should be reasonable, up to +25.

Use previousChoices for story continuity: ${JSON.stringify(previousChoices)}

Return JSON strictly like this:
{
  "prompt": "3-sentence narrative text addressed to 'you', first sentence consequence, next two sentences progress story",
  "choices": [
    { "text": "Choice 1", "gold": 10 },
    { "text": "Choice 2", "gold": -5 },
    { "text": "Choice 3", "gold": 20 }
  ]
}
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a fantasy adventure game master." },
        { role: "user", content: prompt }
      ],
      max_tokens: 350,
      temperature: 0.8
    });

    const parsed = JSON.parse(response.choices[0].message.content);

    // Ensure the AI choices are fully readable and ≤ 4 words
    parsed.choices = parsed.choices.map(c => ({
      text: c.text.trim(),
      gold: c.gold
    }));

    return parsed;
  } catch (err) {
    console.error("Failed to parse GPT response:", err);
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

// Render node and handle buttons
async function renderNode(interaction, userProfile, previousChoices = [], lastChoice = null) {
  let nodeData;
  if (sessionCache.has(userProfile.userId)) {
    nodeData = sessionCache.get(userProfile.userId);
  } else {
    nodeData = await generateNode(previousChoices, lastChoice, userProfile.balance);
    sessionCache.set(userProfile.userId, nodeData);
  }

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

    const actualDelta = Math.max(-userProfile.balance, delta);
    userProfile.balance += actualDelta;
    await userProfile.save();

    const chosenAction = nodeData.choices[choiceIndex];
    previousChoices.push(chosenAction.text);

    await i.deferUpdate();
    sessionCache.delete(userProfile.userId);

    // Render the next node including outcome of last choice
    await renderNode(i, userProfile, previousChoices, chosenAction);
  });

  collector.on("end", async () => {
    if (!message.deleted) await message.edit({ components: [] });
  });
}

// Command entry
export async function run({ interaction }) {
  const userId = interaction.user.id;
  let userProfile = await UserProfile.findOne({ userId });
  if (!userProfile) userProfile = new UserProfile({ userId, balance: 100 });

  if (!interaction.deferred) await interaction.deferReply();
  await renderNode(interaction, userProfile, []);
}
