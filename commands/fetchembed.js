const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('fetchembed')
    .setDescription('Fetch a message and log its full content')
    .addStringOption(option =>
      option.setName('channelid')
        .setDescription('ID of the channel')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('messageid')
        .setDescription('ID of the message')
        .setRequired(true)),
  
  run: async ({ interaction }) => {
    const channelId = interaction.options.getString('channelid');
    const messageId = interaction.options.getString('messageid');
    const channel = await interaction.client.channels.fetch(channelId);

    try {
      const msg = await channel.messages.fetch(messageId);
      
      console.log('--- MESSAGE DATA ---');
      console.log('Content:', msg.content);
      console.log('Embeds:', JSON.stringify(msg.embeds, null, 2));
      console.log('Components:', JSON.stringify(msg.components, null, 2));
      
      await interaction.reply({ content: 'Message logged to console.', flags: 64 });
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: 'Failed to fetch message.', flags: 64 });
    }
  }
};