// Conectar con el servidor mediante Socket.io
const socket = io();

// Elementos DOM
const inicioScreen = document.getElementById('inicio-screen');
const buscandoScreen = document.getElementById('buscando-screen');
const chatScreen = document.getElementById('chat-screen');
const desconectadoScreen = document.getElementById('desconectado-screen');
const chatMessages = document.getElementById('chat-messages');
const mensajeInput = document.getElementById('mensaje-input');
const btnIniciarChat = document.getElementById('btn-iniciar-chat');
const btnEnviar = document.getElementById('btn-enviar');
const btnSiguiente = document.getElementById('btn-siguiente');
const btnNuevoChat = document.getElementById('btn-nuevo-chat');

// Elementos de media
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const btnToggleVideo = document.getElementById('btn-toggle-video');
const btnToggleAudio = document.getElementById('btn-toggle-audio');
const opcionTexto = document.getElementById('opcion-texto');
const opcionAudio = document.getElementById('opcion-audio');
const opcionVideo = document.getElementById('opcion-video');

// Variables de estado
let enChat = false;
let localStream = null;
let peer = null;
let mediaConstraints = {
    audio: false,
    video: false
};

// Mostrar solo la pantalla especificada
function mostrarPantalla(pantalla) {
    inicioScreen.classList.add('hidden');
    buscandoScreen.classList.add('hidden');
    chatScreen.classList.add('hidden');
    desconectadoScreen.classList.add('hidden');
    
    pantalla.classList.remove('hidden');
}

// Agregar mensaje al chat
function agregarMensaje(texto, esMio) {
    const mensajeDiv = document.createElement('div');
    mensajeDiv.classList.add('message');
    mensajeDiv.classList.add(esMio ? 'message-self' : 'message-other');
    mensajeDiv.textContent = texto;
    chatMessages.appendChild(mensajeDiv);
    
    // Desplazarse automáticamente hacia abajo
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Iniciar cámara y micrófono
async function iniciarMedia() {
    try {
        // Actualizar restricciones de media según opciones seleccionadas
        mediaConstraints = {
            audio: opcionAudio.checked,
            video: opcionVideo.checked
        };
        
        // Si no se requiere audio ni video, no iniciar stream
        if (!mediaConstraints.audio && !mediaConstraints.video) {
            return null;
        }
        
        // Obtener acceso a la cámara y/o micrófono
        const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
        
        // Mostrar video local si está habilitado
        if (mediaConstraints.video) {
            localVideo.srcObject = stream;
        }
        
        // Actualizar estado de los botones de media
        actualizarBotonesMedia();
        
        return stream;
    } catch (error) {
        console.error('Error al acceder a los dispositivos de media:', error);
        alert('No se pudo acceder a la cámara o micrófono. Por favor, verifica los permisos.');
        return null;
    }
}

// Actualizar estado visual de los botones de media
function actualizarBotonesMedia() {
    if (localStream) {
        const videoTracks = localStream.getVideoTracks();
        const audioTracks = localStream.getAudioTracks();
        
        if (videoTracks.length > 0) {
            const videoEnabled = videoTracks[0].enabled;
            btnToggleVideo.innerHTML = videoEnabled ? 
                '<i class="fas fa-video"></i>' : 
                '<i class="fas fa-video-slash"></i>';
            btnToggleVideo.classList.toggle('disabled', !videoEnabled);
        }
        
        if (audioTracks.length > 0) {
            const audioEnabled = audioTracks[0].enabled;
            btnToggleAudio.innerHTML = audioEnabled ? 
                '<i class="fas fa-microphone"></i>' : 
                '<i class="fas fa-microphone-slash"></i>';
            btnToggleAudio.classList.toggle('disabled', !audioEnabled);
        }
    }
}

// Iniciar conexión WebRTC
function iniciarWebRTC(initiator = false) {
    if (peer) {
        peer.destroy();
    }
    
    // Crear nuevo peer
    peer = new SimplePeer({
        initiator: initiator,
        stream: localStream,
        trickle: false
    });
    
    // Evento: Se genera una señal para enviar al otro peer
    peer.on('signal', data => {
        socket.emit('señal', data);
    });
    
    // Evento: Se recibe una stream de la otra persona
    peer.on('stream', stream => {
        remoteVideo.srcObject = stream;
    });
    
    // Evento: Error en la conexión
    peer.on('error', err => {
        console.error('Error en la conexión WebRTC:', err);
    });
    
    // Evento: Conexión cerrada
    peer.on('close', () => {
        console.log('Conexión WebRTC cerrada');
    });
    
    return peer;
}

// Iniciar búsqueda de chat
async function buscarChat() {
    mostrarPantalla(buscandoScreen);
    chatMessages.innerHTML = ''; // Limpiar mensajes anteriores
    
    // Iniciar media si no está iniciada
    if (!localStream && (opcionAudio.checked || opcionVideo.checked)) {
        localStream = await iniciarMedia();
    }
    
    socket.emit('buscar-chat');
}

// Función para enviar mensaje
function enviarMensaje() {
    const mensaje = mensajeInput.value.trim();
    if (mensaje && enChat) {
        socket.emit('enviar-mensaje', mensaje);
        agregarMensaje(mensaje, true);
        mensajeInput.value = '';
    }
}

// Función para detener media
function detenerMedia() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
    
    if (peer) {
        peer.destroy();
        peer = null;
    }
}

// ===== Event Listeners =====

// Evento: Botón Iniciar Chat
btnIniciarChat.addEventListener('click', buscarChat);

// Evento: Botón Enviar Mensaje
btnEnviar.addEventListener('click', enviarMensaje);

// Evento: Presionar Enter para enviar mensaje
mensajeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        enviarMensaje();
    }
});

// Evento: Botón Siguiente (buscar nuevo chat)
btnSiguiente.addEventListener('click', () => {
    if (enChat) {
        socket.emit('dejar-chat');
    }
    buscarChat();
});

// Evento: Botón Nuevo Chat después de desconexión
btnNuevoChat.addEventListener('click', buscarChat);

// Evento: Botón Toggle Video
btnToggleVideo.addEventListener('click', () => {
    if (localStream) {
        const videoTracks = localStream.getVideoTracks();
        if (videoTracks.length > 0) {
            videoTracks[0].enabled = !videoTracks[0].enabled;
            actualizarBotonesMedia();
        }
    }
});

// Evento: Botón Toggle Audio
btnToggleAudio.addEventListener('click', () => {
    if (localStream) {
        const audioTracks = localStream.getAudioTracks();
        if (audioTracks.length > 0) {
            audioTracks[0].enabled = !audioTracks[0].enabled;
            actualizarBotonesMedia();
        }
    }
});

// ===== Socket.io Eventos =====

// Cuando se establece conexión con el servidor
socket.on('connect', () => {
    mostrarPantalla(inicioScreen);
});

// Cuando se encuentra un compañero de chat
// Cuando se encuentra un compañero de chat
socket.on('chat-iniciado', () => {
    enChat = true;
    mostrarPantalla(chatScreen);
    
    if (opcionAudio.checked || opcionVideo.checked) {
        // Iniciar WebRTC (como iniciador)
        iniciarWebRTC(true);
        socket.emit('solicitar-video');
    }
    
    agregarMensaje('Te has conectado con alguien. ¡Di hola!', false);
});

// Cuando se recibe un mensaje
socket.on('mensaje', (mensaje) => {
    agregarMensaje(mensaje, false);
});

// Cuando el compañero solicita videochat
socket.on('solicitud-video', async () => {
    if (!localStream && (opcionAudio.checked || opcionVideo.checked)) {
        localStream = await iniciarMedia();
    }
    
    // Iniciar WebRTC (como receptor)
    iniciarWebRTC(false);
});

// Cuando se recibe una señal de WebRTC
socket.on('señal', (data) => {
    if (peer) {
        peer.signal(data);
    }
});

// Cuando el compañero se desconecta
socket.on('compañero-desconectado', () => {
    enChat = false;
    mostrarPantalla(desconectadoScreen);
    
    // Detener conexión WebRTC pero mantener el stream local
    if (peer) {
        peer.destroy();
        peer = null;
    }
    
    remoteVideo.srcObject = null;
});

// Cuando hay un error de conexión
socket.on('connect_error', () => {
    alert('Error de conexión con el servidor');
    mostrarPantalla(inicioScreen);
    detenerMedia();
});

// Limpiar recursos al cerrar la página
window.addEventListener('beforeunload', () => {
    detenerMedia();
    if (enChat) {
        socket.emit('dejar-chat');
    }
});