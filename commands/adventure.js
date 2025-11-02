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
  "Pepperoni Tony's Italian Pizzeria",
  "Big Pat",
  "Pat Fusty",
  "Lego figurines",
  "Matthew De'redita",
  "Big Austin",
  "Paul",
  "Gamer's Paradise",
  "A short dark figure holding a microphone and wearing a blue bandana",
  "Bub's left toe",
  "a small child",
  "Obyn Greenfoot",
  "Merle Ambrose",
  "Bill Cosby",
  "The Mayor of Flavor Town",
  "Oprah Winfrey",
  "Macaulay Vincent Alan Gould",
  "Phineas and Ferb",
  "Dealmaster Dougie's Bargain Barn",
  "Marge Simpson",
  "George W. Bush",
  "Tony Soprano",
  "Detroit",
  "Memphis",
  "Air Bud",
  "Isaac Newton",
  "Coach Quessenberry",
  "Queen Elizabeth II",
  "Joe Biden's Husband",
  "Scott Douglas",
  "Bernie Sanders",
  "Bernie Sanders but Evil",
  "Abraham Lincoln",
  "Oda Nobunaga",
  "Yung Lean",
  "Barry Dillon",
  "Bob Dylan",
  "Naked Grandma",
  "Steve Harvey"
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
  const randomElements = pickRandomElements(storyElements, Math.floor(Math.random() * 2) + 1); // 1–2 elements

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
  * Assign a gold outcome for each choice (positive or negative).
  * Negative gold cannot exceed current balance.
  * Positive gold can be up to 2x current balance.
  * Ensure choices and their gold outcomes fit the chaotic whimsical tone.
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

  const buttons = nodeData.choices.map((choice, index) => {
    // Determine style based on potential gold change
    let style;
    if (choice.gold > 0) style = ButtonStyle.Success; // green
    else if (choice.gold < 0) style = ButtonStyle.Danger; // red
    else style = ButtonStyle.Primary; // neutral blue

    return new ButtonBuilder()
      .setCustomId(`choice_${index}`)
      .setLabel(choice.text)
      .setStyle(style);
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

    const [_, choiceIndexStr] = i.customId.split("_");
    const choiceIndex = parseInt(choiceIndexStr, 10);

    const chosenAction = nodeData.choices[choiceIndex];

    // 50/50 success/fail
    const isSuccess = Math.random() < 0.5;

    const delta = isSuccess
      ? chosenAction.gold
      : -Math.min(userProfile.balance, chosenAction.gold);

    userProfile.balance += delta;
    await userProfile.save();

    previousChoices.push(`${chosenAction.text} (${isSuccess ? "Success" : "Fail"})`);

    await i.deferUpdate();
    sessionCache.delete(userProfile.userId);

    // Render next node including outcome
    await renderNode(i, userProfile, previousChoices, { ...chosenAction, gold: delta });
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
