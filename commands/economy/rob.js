const { 
  EmbedBuilder, 
  StringSelectMenuBuilder, 
  StringSelectMenuOptionBuilder, 
  ActionRowBuilder 
} = require('discord.js');
const UserProfile = require('../../schemas/UserProfile');
const Cooldown = require('../../schemas/Cooldown');

const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

module.exports = {
  data: {
    name: 'rob',
    description: 'Rob another user of all their bubux (1-hour cooldown).',
  },

  run: async ({ interaction }) => {
    const userId = interaction.user.id;

// fetch all users except yourself
const allUsers = await UserProfile.find({ userId: { $ne: userId } });

if (allUsers.length === 0) {
  return interaction.reply({ content: "No users available to rob!", flags: 64 });
}

// Deduplicate users by userId
const uniqueUsers = [...new Map(allUsers.map(u => [u.userId, u])).values()];

// Take only up to 25 users for Discord select menu limit
const usersToRob = uniqueUsers.slice(0, 25);

const options = usersToRob.map(u =>
  new StringSelectMenuOptionBuilder()
    .setLabel(`User ${u.userName}`) // use whatever username or display you want
    .setValue(u.userId)
);

const selectMenu = new StringSelectMenuBuilder()
  .setCustomId('rob-user')
  .setPlaceholder('Select a user to rob')
  .addOptions(options);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({ content: 'Select a user to rob:', components: [row], flags: 64 });

    // collector to handle selection
    const message = await interaction.fetchReply();
    const collector = message.createMessageComponentCollector({ time: 120_000 });

    collector.on('collect', async i => {
      if (!i.isStringSelectMenu()) return;
      if (i.user.id !== userId) return i.reply({ content: "This isn't your selection!", flags: 64 });

      const targetId = i.values[0];
      const targetProfile = await UserProfile.findOne({ userId: targetId });
      if (!targetProfile || targetProfile.balance <= 0) {
        return i.reply({ content: "You cannot rob this user!", flags: 64 });
      }

      // check cooldown
      let cooldown = await Cooldown.findOne({ userId, commandName: 'rob', targetId });
      const now = Date.now();
      if (cooldown && now < cooldown.endsAt) {
        const remaining = new Date(cooldown.endsAt - now);
        return i.reply({ content: `You are on cooldown! Come back later.`, flags: 64 });
      }

      if (!cooldown) cooldown = new Cooldown({ userId, commandName: 'rob', targetId });
      cooldown.endsAt = now + COOLDOWN_MS;

      // perform robbery
      const stolenAmount = targetProfile.balance;
      targetProfile.balance = 0;

      const userProfile = await UserProfile.findOne({ userId });
      if (!userProfile) userProfile = new UserProfile({ userId });
      userProfile.balance += stolenAmount;

      await Promise.all([cooldown.save(), targetProfile.save(), userProfile.save()]);

      await i.update({
        content: `You robbed <@${targetId}> for <:bubux:1431898256840986654> ${stolenAmount}!`,
        components: [],
      });
    });
  },
};