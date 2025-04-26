const { v4: uuidv4 } = require('uuid');
const { pool } = require('./db');

class ChatManager {
    constructor(io) {
        // Lista de usuarios esperando pareja
        this.usuariosEsperando = [];
        
        // Mapeo de usuarios conectados: {socketId: {parejaSocketId, chatId}}
        this.parejas = {};
        
        // Guardar la instancia de io
        this.io = io;
    }

    // Registrar usuario en la base de datos
    async registrarUsuario(socketId) {
        try {
            const userId = uuidv4();
            await pool.query(
                'INSERT INTO usuarios (id, socket_id) VALUES ($1, $2) RETURNING id',
                [userId, socketId]
            );
            return userId;
        } catch (error) {
            console.error('Error al registrar usuario:', error);
            return null;
        }
    }

    // Guardar chat en la base de datos
    async registrarChat(usuario1Id, usuario2Id) {
        try {
            const chatId = uuidv4();
            await pool.query(
                'INSERT INTO chats (id, usuario1_id, usuario2_id) VALUES ($1, $2, $3) RETURNING id',
                [chatId, usuario1Id, usuario2Id]
            );
            return chatId;
        } catch (error) {
            console.error('Error al registrar chat:', error);
            return null;
        }
    }

    // Finalizar chat en la base de datos
    async finalizarChat(chatId) {
        try {
            await pool.query(
                'UPDATE chats SET ended_at = NOW() WHERE id = $1',
                [chatId]
            );
        } catch (error) {
            console.error('Error al finalizar chat:', error);
        }
    }

    // Guardar mensaje en la base de datos
    async registrarMensaje(chatId, usuarioId, contenido) {
        try {
            const mensajeId = uuidv4();
            await pool.query(
                'INSERT INTO mensajes (id, chat_id, usuario_id, contenido) VALUES ($1, $2, $3, $4) RETURNING id',
                [mensajeId, chatId, usuarioId, contenido]
            );
        } catch (error) {
            console.error('Error al registrar mensaje:', error);
        }
    }

    // Buscar una pareja para un usuario
    async buscarPareja(socket) {
        // Si el usuario ya está en un chat, desconectarlo
        await this.desconectarUsuario(socket.id);
        
        // Registrar usuario en la base de datos
        const userId = await this.registrarUsuario(socket.id);
        socket.userId = userId;
        
        // Si hay usuarios esperando, hacer match con el primero
        if (this.usuariosEsperando.length > 0) {
            const parejaSocket = this.usuariosEsperando.shift();
            
            // Registrar chat en la base de datos
            const chatId = await this.registrarChat(userId, parejaSocket.userId);
            
            if (!chatId) {
                this.usuariosEsperando.push(socket);
                return;
            }
            
            // Establecer la relación de parejas
            this.parejas[socket.id] = { parejaId: parejaSocket.id, chatId, userId: parejaSocket.userId };
            this.parejas[parejaSocket.id] = { parejaId: socket.id, chatId, userId };
            
            // Notificar a ambos usuarios que el chat ha iniciado
            socket.emit('chat-iniciado');
            parejaSocket.emit('chat-iniciado');
            
            console.log(`Chat iniciado entre ${socket.id} y ${parejaSocket.id} - Chat ID: ${chatId}`);
        } else {
            // Si no hay usuarios esperando, añadir a la lista de espera
            this.usuariosEsperando.push(socket);
            console.log(`Usuario ${socket.id} en espera`);
        }
    }

    // Enviar mensaje al compañero de chat
    async enviarMensaje(emisorId, mensaje) {
        const pareja = this.parejas[emisorId];
        
        // Verificar si tiene pareja asignada
        if (pareja) {
            // Conseguir el socket del receptor
            const receptorSocket = this.io.sockets.sockets.get(pareja.parejaId);
            
            // Guardar mensaje en la base de datos
            const emisorData = this.parejas[pareja.parejaId];
            if (emisorData) {
                await this.registrarMensaje(pareja.chatId, emisorData.userId, mensaje);
            }
            
            if (receptorSocket) {
                receptorSocket.emit('mensaje', mensaje);
            }
        }
    }

    // Iniciar comunicación de video
    iniciarVideoChat(emisorId) {
        const pareja = this.parejas[emisorId];
        
        // Verificar si tiene pareja asignada
        if (pareja) {
            // Conseguir el socket del receptor
            const receptorSocket = this.io.sockets.sockets.get(pareja.parejaId);
            
            if (receptorSocket) {
                receptorSocket.emit('solicitud-video');
            }
        }
    }

    // Transmitir señal de WebRTC
    transmitirSeñal(emisorId, señal) {
        const pareja = this.parejas[emisorId];
        
        // Verificar si tiene pareja asignada
        if (pareja) {
            // Conseguir el socket del receptor
            const receptorSocket = this.io.sockets.sockets.get(pareja.parejaId);
            
            if (receptorSocket) {
                receptorSocket.emit('señal', señal);
            } else {
                console.error(`No se encontró el socket del receptor: ${pareja.parejaId}`);
            }
        } else {
            console.error(`El usuario ${emisorId} no tiene pareja asignada para enviar señal`);
        }
    }

    // Desconectar a un usuario de su chat actual
    async desconectarUsuario(socketId) {
        // Verificar si está en la lista de espera
        const esperandoIndex = this.usuariosEsperando.findIndex(s => s.id === socketId);
        if (esperandoIndex !== -1) {
            this.usuariosEsperando.splice(esperandoIndex, 1);
            return;
        }
        
        // Verificar si está en un chat
        const pareja = this.parejas[socketId];
        if (pareja) {
            // Finalizar chat en la base de datos
            await this.finalizarChat(pareja.chatId);
            
            // Conseguir el socket de la pareja
            const parejaSocket = this.io.sockets.sockets.get(pareja.parejaId);
            
            // Notificar a la pareja sobre la desconexión
            if (parejaSocket) {
                parejaSocket.emit('compañero-desconectado');
            }
            
            // Eliminar las relaciones de parejas
            delete this.parejas[socketId];
            delete this.parejas[pareja.parejaId];
            
            console.log(`Chat finalizado entre ${socketId} y ${pareja.parejaId} - Chat ID: ${pareja.chatId}`);
        }
    }
}

module.exports = ChatManager;