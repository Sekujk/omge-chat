const express = require('express');
const router = express.Router();
const User = require('../models/user');

// Get overall system statistics
router.get('/', async (req, res) => {
    try {
        // Get total users count
        const totalUsers = await User.countDocuments();
        
        // Get total chats and messages
        const stats = await User.aggregate([
            {
                $group: {
                    _id: null,
                    totalChats: { $sum: '$totalChats' },
                    totalMessages: { $sum: '$messagesSent' }
                }
            }
        ]);
        
        // Get active users in the last hour
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const activeUsers = await User.countDocuments({
            lastActive: { $gte: oneHourAgo }
        });
        
        res.json({
            totalUsers,
            totalChats: stats.length > 0 ? Math.round(stats[0].totalChats / 2) : 0, // Divide by 2 since each chat is counted twice
            totalMessages: stats.length > 0 ? stats[0].totalMessages : 0,
            activeUsers,
            timestamp: new Date()
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Error fetching statistics' });
    }
});

module.exports = router;