const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { initDb } = require('./db');
const ChatManager = require('./chatManager');
require('dotenv').config();

// Crear aplicación Express
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Inicializar la base de datos
initDb();

// Configurar directorio público
app.use(express.static(path.join(__dirname, '../public')));

// Inicializar el administrador de chat con la instancia de io
const chatManager = new ChatManager(io);

// Socket.IO - Manejar conexiones
io.on('connection', (socket) => {
    console.log(`Usuario conectado: ${socket.id}`);
    
    // Usuario busca un chat
    socket.on('buscar-chat', () => {
        chatManager.buscarPareja(socket);
    });

    // Usuario envía un mensaje
    socket.on('enviar-mensaje', (mensaje) => {
        chatManager.enviarMensaje(socket.id, mensaje);
    });

    // Usuario solicita iniciar videochat
    socket.on('solicitar-video', () => {
        chatManager.iniciarVideoChat(socket.id);
    });

    // Usuario envía señal WebRTC
    socket.on('señal', (data) => {
        chatManager.transmitirSeñal(socket.id, data);
    });

    // Usuario deja el chat voluntariamente
    socket.on('dejar-chat', () => {
        chatManager.desconectarUsuario(socket.id);
    });

    // Usuario se desconecta
    socket.on('disconnect', () => {
        console.log(`Usuario desconectado: ${socket.id}`);
        chatManager.desconectarUsuario(socket.id);
    });
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor iniciado en http://localhost:${PORT}`);
    console.log('Presiona Ctrl+C para detener');
});