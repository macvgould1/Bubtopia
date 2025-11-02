// adventure.js
import OpenAI from "openai";
import { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } from "discord.js";
import UserProfile from "../schemas/UserProfile.js";

export const data = {
  name: "adventure",
  description: "Start a whimsical fantasy adventure"
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
Keep it short, whimsical, chaotic, fantastical, and simple.
Write exactly three sentences:
1. Describe how the previous choice affected your gold balance (${lastChoice.gold >= 0 ? '+' : ''}${lastChoice.gold} gold).
2. Progress the story in whimsical, brief, fantastical way that describes three unique actions for the player in the story context in 2 sentences.
3. Do not tell the player how their choice will affect their balance or outcome. Never ask the player a question.
`;
  }

  const prompt = `
You are a whimsical fantasy adventure game master.
${outcomePart}
Now generate the next step:
- 3-sentence narrative addressed to "you".
- 3 creative action choices:
  * Each choice naturally ≤ 4 words.
  * Assign a gold outcome for each choice that makes sense for the story context.
  * Gold amounts can be any integer, positive or negative.
* Negative gold can be as large as the player's current balance.
* Positive gold can be up to 2 times the player's current balance.
* Gold outcomes should make sense for the story, but can be large and chaotic.
Use previousChoices to continue the story: ${JSON.stringify(previousChoices)}

Return strictly JSON in this format:
{
  "prompt": "Three whimsical, short sentences with choices embedded in the last sentence",
  "choices": [
    { "text": "Choice 1", "gold": 0 },
    { "text": "Choice 2", "gold": 0 },
    { "text": "Choice 3", "gold": 0 }
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
      temperature: 0.85
    });

    const parsed = JSON.parse(response.choices[0].message.content);

    // Ensure choices ≤ 4 words and negative gold doesn't reduce balance below 0
    parsed.choices = parsed.choices.map(c => ({
      text: c.text.trim(),
      gold: c.gold < 0 ? Math.max(-currentBalance, c.gold) : c.gold
    }));

    return parsed;
  } catch (err) {
    console.error("Failed to parse GPT response:", err);
    return {
      prompt: "Something whimsical happens with the options Explore, Rest, Wait.",
      choices: [
        { text: "Explore", gold: 0 },
        { text: "Rest", gold: 0 },
        { text: "Wait", gold: 0 }
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
