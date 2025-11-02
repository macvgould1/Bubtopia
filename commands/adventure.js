// adventure.js
import OpenAI from "openai";
import { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } from "discord.js";
import UserProfile from "../schemas/UserProfile.js";

export const data = {
  name: "adventure",
  description: "Start a chaotic whimsical fantasy adventure"
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Optional story elements to sprinkle into adventures
const storyElements = [
  "Andie Haslam",
  "Carrie Haslam",
  "Joe Biden",
  "Shell Silverstein",
  "Dr. Suess",
  "Coach Quesenberry",
  "Brady Haslam",
  "Ethan Thomas Douglas",
  "Matthew Nightblood",
  "Pepperoni Tony",
  "Big Pat",
  "Pat Fusty",
  "Lego figurines",
  "Austin, The Toe Tickler",
  "Big Austin",
  "Paul",
  "Gamer's Paradise",
  "Dealmaster Dougie's Bargain Barn"
];

// In-memory session cache
const sessionCache = new Map();

// Utility to pick n random elements from an array
function pickRandomElements(array, n) {
  const shuffled = array.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, n);
}

// Generate a new adventure node
async function generateNode(previousChoices, lastChoice, currentBalance) {
  const randomElements = pickRandomElements(storyElements, Math.floor(Math.random() * 2) + 2); // 2–3 elements

  let outcomePart = "";
  if (lastChoice) {
    outcomePart = `
Describe the outcome of your last choice: "${lastChoice.text}".
Use "you" perspective.
Keep it short, chaotic, fantastical, and simple.
Write exactly 2 sentences:
1. How your previous choice affected your gold (${lastChoice.gold >= 0 ? '+' : ''}${lastChoice.gold} gold).
2. Progress the story in a short, chaotic, simple, fantastical way. Do not ask the player anything.
`;
  }

  const prompt = `
You are a chaotic whimsical fantasy adventure game master.
${outcomePart}
Optional story elements you can sprinkle into the narrative (use any or none): ${randomElements.join(", ")}
Now generate the next step:
- 2-sentence narrative addressed to "you".
- 3 creative action choices:
  * Each choice ≤ 4 words.
  * Assign a gold outcome for each choice that makes sense with the story element it involves.
  * Gold outcomes can be positive or negative.
  * Negative gold cannot exceed current balance.
  * Positive gold can be up to 2 times the player's current balance.
  * Ensure choices and their gold outcomes feel tied to the story element and chaotic whimsical tone.
Use previousChoices to continue the story: ${JSON.stringify(previousChoices)}

Return strictly JSON in this format:
{
  "prompt": "Two short chaotic whimsical sentences describing the story and next actions",
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
        { role: "system", content: "You are a chaotic whimsical fantasy adventure game master." },
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
      prompt: "You tumble into a whirling rainbow. Three paths spin chaotically before you.",
      choices: [
        { text: "Jump Forward", gold: Math.min(10, currentBalance) },
        { text: "Duck Quickly", gold: 0 },
        { text: "Spin Around", gold: -Math.min(5, currentBalance) }
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
