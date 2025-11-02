// adventure.js
import OpenAI from "openai";
import { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } from "discord.js";
import UserProfile from "../schemas/UserProfile.js";

export const data = {
  name: "adventure",
  description: "Start a fantasy adventure"
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Optional story elements to sprinkle into adventures
const storyElements = [
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
  "Steve Harvey",
  "Qiqiao",
  "Xijiang",
  "Hongcun",
  "Chengkan",
  "Shaxi",
  "Nanxi",
  "Ping’an",
  "Longji",
  "Duoyishu",
  "Liugong",
  "Xijiang Qianhu Miao",
  "Zhouzhuang",
  "Wuyuan Likeng",
  "Langde Miao",
  "Bamei",
  "Jingzhu",
  "Huangling",
  "Gaotian",
  "Jingshan",
  "Tangmo",
  "Yantou",
  "Zhaoxing Dong",
  "Jiangwan",
  "Pingtan",
  "Hemu",
  "Yubeng",
  "Shuhe",
  "Taxia",
  "Yunhe",
  "Xiahe",
  "Shitang",
  "Xijiang Miao",
  "Dazhai",
  "Lijiashan",
  "Yijiang",
  "Tengtou",
  "Luoxi",
  "Shiqiao",
  "Shitangwan",
  "Dongyang",
  "Wengding",
  "Neo-Detroit"
];

// In-memory session cache and story log
const sessionCache = new Map();
const storyLog = new Map();

// Utility to pick n random elements from an array
function pickRandomElements(array, n) {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, n);
}

// Generate a new adventure node
async function generateNode(previousChoices, lastChoice, currentBalance, userId) {
  const randomElements = pickRandomElements(storyElements, 2); // Always pick 2 elements

  // Include the story so far
  const previousStory = storyLog.get(userId) || "";

  let outcomePart = "";
  if (lastChoice) {
    outcomePart = `
Describe the outcome of your last choice: "${lastChoice.text}".
Use "you" perspective.
Keep it short, and simple.
Write exactly 2 sentences:
1. How your previous choice affected your gold (${lastChoice.gold >= 0 ? '+' : ''}${lastChoice.gold} gold).
2. Progress the story in a short way. Do not ask the player anything.
`;
  }

  const prompt = `
You are a fantasy adventure game master.
${outcomePart}
Story so far:
${previousStory}

Always include at least 2 of these story elements: ${randomElements.join(", ")}

Generate the next step following a **narrative arc**:
- Rising action → Climax → Falling action → Resolution
- 2 short  sentences describing what happens next
- 3 creative action choices:
  * Each choice ≤ 4 words
  * Assign a gold outcome for each choice (positive or negative)
  * Negative gold cannot exceed current balance
  * Positive gold can be up to 2x current balance
  * Choices and gold outcomes should match story and whimsical tone
- Never ask the player what they choose
Return strictly JSON:
{
  "prompt": "Two short sentences describing the story and next actions",
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
      temperature: 0.2
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
    nodeData = await generateNode(previousChoices, lastChoice, userProfile.balance, userProfile.userId);
    sessionCache.set(userProfile.userId, nodeData);
  }

  const embed = new EmbedBuilder()
    .setTitle("Your Adventure")
    .setDescription(`${nodeData.prompt}\n\n**Current Gold:** ${userProfile.balance}`)
    .setColor(0x1abc9c);

  const buttons = nodeData.choices.map((choice, index) => {
    let style;
    if (choice.gold > 0) style = ButtonStyle.Success;
    else if (choice.gold < 0) style = ButtonStyle.Danger;
    else style = ButtonStyle.Primary;

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
    const delta = isSuccess ? chosenAction.gold : -Math.min(userProfile.balance, Math.abs(chosenAction.gold));

    userProfile.balance += delta;
    await userProfile.save();

    // Update story log with full narrative including choice outcome
    const previousLog = storyLog.get(userProfile.userId) || "";
    storyLog.set(
      userProfile.userId,
      `${previousLog}\nYou chose: "${chosenAction.text}" (${isSuccess ? "Success" : "Fail"}). ${nodeData.prompt}`
    );

    previousChoices.push(`${chosenAction.text} (${isSuccess ? "Success" : "Fail"})`);

    await i.deferUpdate();
    sessionCache.delete(userProfile.userId);

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
