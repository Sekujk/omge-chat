// Connect to server using Socket.io
const socket = io();

// DOM Elements from ui.js are already defined
// Media control functions from media.js

// State variables
let enChat = false;
let currentMatchId = null;

// Initialize app
function init() {
    // Set up UI event listeners
    setupUIListeners();
    
    // Get initial stats
    fetchStats();
    
    // Poll stats every minute
    setInterval(fetchStats, 60000);
}

// Set up event listeners for UI elements
function setupUIListeners() {
    // Start chat button
    btnIniciarChat.addEventListener('click', () => {
        // Get media preferences
        const enableVideo = document.getElementById('enable-video').checked;
        const enableAudio = document.getElementById('enable-audio').checked;
        
        // Get interests
        const interestsText = document.getElementById('interests-input').value;
        const interests = interestsText
            .split(',')
            .map(tag => tag.trim())
            .filter(tag => tag.length > 0);
            
        // Set user preferences
        socket.emit('set-preferences', { interests });
        
        // Initialize media if needed
        if (enableVideo || enableAudio) {
            initMedia({ video: enableVideo, audio: enableAudio })
                .then(() => {
                    // Start looking for a chat partner
                    buscarChat({ video: enableVideo, audio: enableAudio });
                })
                .catch(error => {
                    alert(`Error accessing media: ${error.message}`);
                    // Fall back to text-only chat
                    buscarChat({ video: false, audio: false });
                });
        } else {
            // Start looking for a text-only chat
            buscarChat({ video: false, audio: false });
        }
    });

    // Cancel search button
    btnCancelarBusqueda.addEventListener('click', () => {
        socket.emit('dejar-chat');
        mostrarPantalla(inicioScreen);
        stopLocalStream();
    });

    // Send message button
    btnEnviar.addEventListener('click', enviarMensaje);

    // Press Enter to send message
    mensajeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            enviarMensaje();
        }
    });

    // Next chat button
    btnSiguiente.addEventListener('click', () => {
        if (enChat) {
            socket.emit('dejar-chat');
        }
        
        // Get current media preferences
        const enableVideo = document.getElementById('enable-video').checked;
        const enableAudio = document.getElementById('enable-audio').checked;
        
        // Look for a new chat
        buscarChat({ video: enableVideo, audio: enableAudio });
    });

    // New chat button after disconnection
    btnNuevoChat.addEventListener('click', () => {
        // Go back to start screen to allow user to adjust preferences
        mostrarPantalla(inicioScreen);
    });
    
    // Media control buttons
    document.getElementById('toggle-video').addEventListener('click', toggleVideo);
    document.getElementById('toggle-audio').addEventListener('click', toggleAudio);
}

// Start looking for a chat
function buscarChat(mediaOptions) {
    mostrarPantalla(buscandoScreen);
    chatMessages.innerHTML = ''; // Clear previous messages
    socket.emit('buscar-chat', mediaOptions);
}

// Send a message
function enviarMensaje() {
    const mensaje = mensajeInput.value.trim();
    if (mensaje && enChat) {
        socket.emit('enviar-mensaje', mensaje);
        agregarMensaje(mensaje, true);
        mensajeInput.value = '';
    }
}

// Fetch stats from server
function fetchStats() {
    fetch('/api/stats')
        .then(response => response.json())
        .then(data => {
            document.getElementById('users-online').textContent = 
                `Usuarios en línea: ${data.activeUsers}`;
            document.getElementById('total-chats').textContent = 
                `Chats hoy: ${data.totalChats}`;
        })
        .catch(err => console.error('Error fetching stats:', err));
}

// ===== Socket.io Event Handlers =====

// When connected to server
socket.on('connect', () => {
    mostrarPantalla(inicioScreen);
});

// When waiting for a match
socket.on('esperando', () => {
    mostrarPantalla(buscandoScreen);
});

// When found a chat partner
socket.on('chat-iniciado', (pairMediaOptions) => {
    enChat = true;
    mostrarPantalla(chatScreen);
    
    // Display welcome message
    agregarMensaje('Te has conectado con alguien. ¡Di hola!', false);
    
    // Initialize peer connection for video/audio if either user has it enabled
    if ((pairMediaOptions.video || pairMediaOptions.audio) && localStream) {
        initPeerConnection(true); // We are the initiator
    }
});

// When receiving a message
socket.on('mensaje', (mensaje) => {
    agregarMensaje(mensaje, false);
});

// When receiving WebRTC signaling data
socket.on('signal', (data) => {
    handleSignal(data);
});

// When chat partner disconnects
socket.on('compañero-desconectado', () => {
    enChat = false;
    mostrarPantalla(desconectadoScreen);
    
    // Close peer connection if it exists
    if (peerConnection) {
        closePeerConnection();
    }
});

// When connection error occurs
socket.on('connect_error', () => {
    alert('Error de conexión con el servidor');
    mostrarPantalla(inicioScreen);
});

// Initialize app when document is loaded
document.addEventListener('DOMContentLoaded', init);