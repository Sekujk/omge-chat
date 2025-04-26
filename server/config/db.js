const dotenv = require('dotenv');
dotenv.config();

module.exports = {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/chat-app',
    options: {
        useNewUrlParser: true,
        useUnifiedTopology: true
    }
};