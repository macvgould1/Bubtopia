const UserProfile = require('../../schemas/UserProfile');

const dailyAmount = 500;

/**
 * Handles the daily login bonus logic.
 * @param {string} userId
 * @returns {Object} result { updated: boolean, balance: number, message: string }
 */
async function collectDaily(userId) {
  let userProfile = await UserProfile.findOne({ userId });
  if (!userProfile) userProfile = new UserProfile({ userId });

  const lastDailyDate = userProfile.lastDailyCollected?.toDateString();
  const currentDate = new Date().toDateString();

  if (lastDailyDate === currentDate) {
    return {
      updated: false,
      balance: userProfile.balance,
      message: "No more bubux for you kid, come back tomorrow.",
    };
  }

  userProfile.balance += dailyAmount;
  userProfile.lastDailyCollected = new Date();
  await userProfile.save();

  return {
    updated: true,
    balance: userProfile.balance,
    message: `${dailyAmount} was added to your balance.`,
  };
}

// Optional slash command /daily
async function run({ interaction }) {
  if (!interaction.inGuild()) {
    return interaction.reply({
      content: "This command can only be executed inside a server.",
      ephemeral: true,
    });
  }

  const userId = interaction.user.id;
  const result = await collectDaily(userId);

  return interaction.reply(`${result.message}\nNew balance: ${result.balance}`);
}

module.exports = {
  data: { name: 'daily', description: 'Collect your daily bubux' },
  run,
  collectDaily,
};