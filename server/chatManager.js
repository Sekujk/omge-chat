const User = require('./models/user');

class ChatManager {
    constructor(io) {
        // Users waiting for a match
        this.usuariosEsperando = [];
        
        // Connected users mapping: {socketId: pairedSocketId}
        this.parejas = {};
        
        // Users' media preferences: {socketId: {video: bool, audio: bool}}
        this.mediaOptions = {};
        
        // Users' matching preferences: {socketId: {interests: [], ageRange: [], etc.}}
        this.preferences = {};
        
        // Save io instance
        this.io = io;
    }

    // Set user preferences for better matching
    setPreferences(socketId, prefs) {
        this.preferences[socketId] = prefs;
    }
    
    // Find a match for a user based on preferences and media options
    buscarPareja(socket, mediaOpts) {
        // Disconnect user if already in a chat
        this.desconectarUsuario(socket.id);
        
        // Store media options
        this.mediaOptions[socket.id] = mediaOpts || { video: false, audio: false };
        
        // If there are waiting users, try to match with someone compatible
        if (this.usuariosEsperando.length > 0) {
            // Find best match based on preferences and media compatibility
            const matchIndex = this.findBestMatch(socket.id);
            
            if (matchIndex !== -1) {
                const parejaSocket = this.usuariosEsperando[matchIndex];
                
                // Remove matched user from waiting list
                this.usuariosEsperando.splice(matchIndex, 1);
                
                // Set up relationship between the two users
                this.parejas[socket.id] = parejaSocket.id;
                this.parejas[parejaSocket.id] = socket.id;
                
                // Get media options for both users
                const userMedia = this.mediaOptions[socket.id];
                const pairMedia = this.mediaOptions[parejaSocket.id];
                
                // Notify both users that chat has started with media options
                socket.emit('chat-iniciado', pairMedia);
                parejaSocket.emit('chat-iniciado', userMedia);
                
                // Log interaction in database
                this.logChatStart(socket.id, parejaSocket.id);
                
                console.log(`Chat started between ${socket.id} and ${parejaSocket.id}`);
            } else {
                // If no compatible match, add to waiting list
                this.usuariosEsperando.push(socket);
                socket.emit('esperando');
                console.log(`User ${socket.id} waiting`);
            }
        } else {
            // If no users waiting, add to waiting list
            this.usuariosEsperando.push(socket);
            socket.emit('esperando');
            console.log(`User ${socket.id} waiting`);
        }
    }
    
    // Find best match based on preferences
    findBestMatch(socketId) {
        // User's preferences
        const userPrefs = this.preferences[socketId] || {};
        const userMedia = this.mediaOptions[socketId] || {};
        
        // If no specific preferences, just return the first user
        if (Object.keys(userPrefs).length === 0) {
            return 0;
        }
        
        // Find best match with compatible media options
        let bestMatchIndex = -1;
        let bestMatchScore = -1;
        
        this.usuariosEsperando.forEach((waitingSocket, index) => {
            const waitingId = waitingSocket.id;
            const waitingPrefs = this.preferences[waitingId] || {};
            const waitingMedia = this.mediaOptions[waitingId] || {};
            
            // Check basic media compatibility
            const mediaCompatible = 
                (userMedia.video && waitingMedia.video) || 
                (userMedia.audio && waitingMedia.audio) ||
                (!userMedia.video && !userMedia.audio && !waitingMedia.video && !waitingMedia.audio);
            
            if (!mediaCompatible) return;
            
            // Calculate preference compatibility score
            let score = 0;
            
            // Compare interests if both have them
            if (userPrefs.interests && waitingPrefs.interests) {
                const commonInterests = userPrefs.interests.filter(
                    interest => waitingPrefs.interests.includes(interest)
                );
                score += commonInterests.length * 10;
            }
            
            // Other preference matching can be added here
            
            if (score > bestMatchScore) {
                bestMatchScore = score;
                bestMatchIndex = index;
            }
        });
        
        // If no good match found based on preferences, return first user with compatible media
        if (bestMatchIndex === -1) {
            return this.usuariosEsperando.findIndex(socket => {
                const waitingMedia = this.mediaOptions[socket.id] || {};
                const mediaCompatible = 
                    (userMedia.video && waitingMedia.video) || 
                    (userMedia.audio && waitingMedia.audio) ||
                    (!userMedia.video && !userMedia.audio && !waitingMedia.video && !waitingMedia.audio);
                return mediaCompatible;
            });
        }
        
        return bestMatchIndex;
    }

    // Send message to chat partner
    enviarMensaje(emisorId, mensaje) {
        const receptorId = this.parejas[emisorId];
        
        // Check if user has a partner
        if (receptorId) {
            // Get receiver's socket
            const receptorSocket = this.io.sockets.sockets.get(receptorId);
            
            if (receptorSocket) {
                receptorSocket.emit('mensaje', mensaje);
                
                // Log message to database
                this.logMessage(emisorId, mensaje);
            }
        }
    }
    
    // Transmit WebRTC signal between chat partners
    transmitSignal(emisorId, signalData) {
        const receptorId = this.parejas[emisorId];
        
        if (receptorId) {
            const receptorSocket = this.io.sockets.sockets.get(receptorId);
            
            if (receptorSocket) {
                receptorSocket.emit('signal', signalData);
            }
        }
    }

    // Disconnect a user from their current chat
    desconectarUsuario(socketId) {
        // Check if user is in waiting list
        const esperandoIndex = this.usuariosEsperando.findIndex(s => s.id === socketId);
        if (esperandoIndex !== -1) {
            this.usuariosEsperando.splice(esperandoIndex, 1);
            delete this.mediaOptions[socketId];
            delete this.preferences[socketId];
            return;
        }
        
        // Check if user is in a chat
        const parejaId = this.parejas[socketId];
        if (parejaId) {
            // Get partner's socket
            const parejaSocket = this.io.sockets.sockets.get(parejaId);
            
            // Notify partner about disconnection
            if (parejaSocket) {
                parejaSocket.emit('compañero-desconectado');
            }
            
            // Log chat end to database
            this.logChatEnd(socketId, parejaId);
            
            // Remove relationship
            delete this.parejas[socketId];
            delete this.parejas[parejaId];
            delete this.mediaOptions[socketId];
            delete this.mediaOptions[parejaId];
            delete this.preferences[socketId];
            
            console.log(`Chat ended between ${socketId} and ${parejaId}`);
        }
    }
    
    // Log chat start to database
    async logChatStart(user1Id, user2Id) {
        try {
            // Update or create users in database
            await User.updateOne(
                { socketId: user1Id },
                { 
                    $inc: { totalChats: 1 },
                    $set: { lastActive: new Date() }
                },
                { upsert: true }
            );
            
            await User.updateOne(
                { socketId: user2Id },
                { 
                    $inc: { totalChats: 1 },
                    $set: { lastActive: new Date() }
                },
                { upsert: true }
            );
        } catch (error) {
            console.error('Error logging chat start:', error);
        }
    }
    
    // Log chat end to database
    async logChatEnd(user1Id, user2Id) {
        try {
            const now = new Date();
            // Update users with chat end time
            await User.updateOne(
                { socketId: user1Id },
                { $set: { lastActive: now } }
            );
            
            await User.updateOne(
                { socketId: user2Id },
                { $set: { lastActive: now } }
            );
        } catch (error) {
            console.error('Error logging chat end:', error);
        }
    }
    
    // Log message to database (for statistics)
    async logMessage(userId, messageText) {
        try {
            await User.updateOne(
                { socketId: userId },
                { 
                    $inc: { messagesSent: 1 },
                    $set: { lastActive: new Date() }
                }
            );
        } catch (error) {
            console.error('Error logging message:', error);
        }
    }
}

module.exports = ChatManager;