const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    socketId: {
        type: String,
        required: true,
        unique: true
    },
    ipAddress: {
        type: String
    },
    userAgent: {
        type: String
    },
    totalChats: {
        type: Number,
        default: 0
    },
    messagesSent: {
        type: Number,
        default: 0
    },
    preferences: {
        interests: [String],
        prefersVideo: Boolean,
        prefersAudio: Boolean
    },
    firstSeen: {
        type: Date,
        default: Date.now
    },
    lastActive: {
        type: Date,
        default: Date.now
    }
});

// Create TTL index that will remove user documents after 7 days of inactivity
userSchema.index({ lastActive: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

module.exports = mongoose.model('User', userSchema);