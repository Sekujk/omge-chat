class ChatManager {
    constructor(io) {
        // Lista de usuarios esperando pareja
        this.usuariosEsperando = [];
        
        // Mapeo de usuarios conectados: {socketId: parejaSocketId}
        this.parejas = {};
        
        // Guardar la instancia de io
        this.io = io;
    }

    // Buscar una pareja para un usuario
    buscarPareja(socket) {
        // Si el usuario ya está en un chat, desconectarlo
        this.desconectarUsuario(socket.id);
        
        // Si hay usuarios esperando, hacer match con el primero
        if (this.usuariosEsperando.length > 0) {
            const parejaSocket = this.usuariosEsperando.shift();
            
            // Establecer la relación de parejas
            this.parejas[socket.id] = parejaSocket.id;
            this.parejas[parejaSocket.id] = socket.id;
            
            // Notificar a ambos usuarios que el chat ha iniciado
            socket.emit('chat-iniciado');
            parejaSocket.emit('chat-iniciado');
            
            console.log(`Chat iniciado entre ${socket.id} y ${parejaSocket.id}`);
        } else {
            // Si no hay usuarios esperando, añadir a la lista de espera
            this.usuariosEsperando.push(socket);
            console.log(`Usuario ${socket.id} en espera`);
        }
    }

    // Enviar mensaje al compañero de chat
    enviarMensaje(emisorId, mensaje) {
        const receptorId = this.parejas[emisorId];
        
        // Verificar si tiene pareja asignada
        if (receptorId) {
            // Conseguir el socket del receptor
            const receptorSocket = this.io.sockets.sockets.get(receptorId);
            
            if (receptorSocket) {
                receptorSocket.emit('mensaje', mensaje);
            }
        }
    }

    // Desconectar a un usuario de su chat actual
    desconectarUsuario(socketId) {
        // Verificar si está en la lista de espera
        const esperandoIndex = this.usuariosEsperando.findIndex(s => s.id === socketId);
        if (esperandoIndex !== -1) {
            this.usuariosEsperando.splice(esperandoIndex, 1);
            return;
        }
        
        // Verificar si está en un chat
        const parejaId = this.parejas[socketId];
        if (parejaId) {
            // Conseguir el socket de la pareja
            const parejaSocket = this.io.sockets.sockets.get(parejaId);
            
            // Notificar a la pareja sobre la desconexión
            if (parejaSocket) {
                parejaSocket.emit('compañero-desconectado');
            }
            
            // Eliminar las relaciones de parejas
            delete this.parejas[socketId];
            delete this.parejas[parejaId];
            
            console.log(`Chat finalizado entre ${socketId} y ${parejaId}`);
        }
    }
}

module.exports = ChatManager;