const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const ChatManager = require('./chatManager');
const statsRoutes = require('./routes/stats');
const dbConfig = require('./config/db');

// Load environment variables
dotenv.config();

// Create Express application
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Configure middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Connect to MongoDB
mongoose.connect(dbConfig.uri)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// API routes
app.use('/api/stats', statsRoutes);

// Initialize chat manager with io instance
const chatManager = new ChatManager(io);

// Socket.IO - Handle connections
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);
    
    // User preferences for matching
    socket.on('set-preferences', (preferences) => {
        chatManager.setPreferences(socket.id, preferences);
    });
    
    // User looks for a chat
    socket.on('buscar-chat', (mediaOptions) => {
        chatManager.buscarPareja(socket, mediaOptions);
    });

    // User sends a message
    socket.on('enviar-mensaje', (mensaje) => {
        chatManager.enviarMensaje(socket.id, mensaje);
    });
    
    // Video/audio stream signal
    socket.on('signal', (data) => {
        chatManager.transmitSignal(socket.id, data);
    });

    // User leaves chat voluntarily
    socket.on('dejar-chat', () => {
        chatManager.desconectarUsuario(socket.id);
    });

    // User disconnects
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        chatManager.desconectarUsuario(socket.id);
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server started at http://localhost:${PORT}`);
    console.log('Press Ctrl+C to stop');
});