const {ApplicationCommandOptionType} = require('discord.js');
const UserProfile = require('../../schemas/UserProfile');

module.exports = {
    run: async ({interaction}) => {
        if(!interaction.inGuild()){
            await interaction.reply({
                content: "You can only run this command in a server.",
                ephemeral: true,
            });
            return;
        }

        const amount = interaction.options.getNumber('amount');

        if(amount < 10) {
            interaction.reply("You're gonna need atleast 10 bubloons to gamble.");
            return;
        }

        let userProfile = await UserProfile.findOne({
            userId: interaction.user.id,
        });

        if(!userProfile){
            userProfile = new UserProfile({
                userId: interaction.user.id,
            });
        }

        if(amount > userProfile.balance){
            interaction.reply("ERROR: no bubux moment detected.");
            return;
        }

        const didWin = Math.random() > 0.5;

        if(!didWin){
            userProfile.balance -= amount;
            await userProfile.save();

            interaction.reply(`You lost ${amount} bubux, it's gone forever.\nNew balance: ${userProfile.balance}`);
            return;
        }

        const amountWon = Number((amount * (Math.random() + 0.55)).toFixed(0));

        userProfile.balance += amountWon;
        await userProfile.save();

        interaction.reply(`You won ${amountWon} bubux!\nNew balance: ${userProfile.balance}`);

    },

    data:{
        name: 'gamble',
        description: "Gamble some of your balance.",
        options: [
            {
                name: 'amount',
                description: 'The amount you want to gamble.',
                type: ApplicationCommandOptionType.Number,
                required: true,
            }
        ]
    }
}