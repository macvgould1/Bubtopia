const { Schema, model } = require('mongoose');

const userProfileSchema = new Schema({
    userId: {
        type: String,
        required: true,
    },
    balance: {
        type: Number,
        default: 0,
    },
    lastDailyCollected: {
        type: Date,
    },
    digBonus: {
        type: Number,
        default: 0,
    },
},
    { timestamps: true }
);

module.exports = model('UserProfile', userProfileSchema);