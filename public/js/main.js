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
let isInitiator = false;  // Nueva variable para rastrear quién inicia la conexión
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
        // Detener stream anterior si existe
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }

        // Actualizar restricciones de media según opciones seleccionadas
        mediaConstraints = {
            audio: opcionAudio.checked,
            video: opcionVideo.checked
        };
        
        // Si no se requiere audio ni video, no iniciar stream
        if (!mediaConstraints.audio && !mediaConstraints.video) {
            console.log("No se requiere audio ni video");
            return null;
        }
        
        console.log("Solicitando acceso a dispositivos con:", mediaConstraints);
        
        // Obtener acceso a la cámara y/o micrófono
        const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
        console.log("Stream obtenido:", stream);
        
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
        console.log("Destruyendo peer anterior");
        peer.destroy();
        peer = null;
    }
    
    isInitiator = initiator;
    console.log(`Creando nuevo peer como ${initiator ? 'iniciador' : 'receptor'}`);
    
    // Verificar que tenemos un stream si se ha seleccionado audio o video
    if ((opcionAudio.checked || opcionVideo.checked) && !localStream) {
        console.warn("Se requiere media pero localStream no está disponible");
        return null;
    }
    
    // Crear nuevo peer con varios servidores STUN/TURN
    const peerOptions = {
        initiator: initiator,
        trickle: true,  // Cambiado a true para mejor negociación de ICE
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                { urls: 'stun:stun4.l.google.com:19302' },
                { urls: 'stun:stun.stunprotocol.org:3478' },
                { urls: 'stun:stun.ekiga.net:3478' },
                // Servidores TURN públicos (limitados pero útiles para pruebas)
                {
                    urls: 'turn:openrelay.metered.ca:80',
                    username: 'openrelayproject',
                    credential: 'openrelayproject'
                },
                {
                    urls: 'turn:openrelay.metered.ca:443',
                    username: 'openrelayproject',
                    credential: 'openrelayproject'
                }
            ]
        }
    };
    
    // Solo añadir el stream si existe
    if (localStream) {
        peerOptions.stream = localStream;
    }
    
    peer = new SimplePeer(peerOptions);
    console.log("Peer creado:", peer);
    
    // Evento: Se genera una señal para enviar al otro peer
    peer.on('signal', data => {
        console.log("Señal generada:", data);
        socket.emit('señal', data);
    });
    
    // Evento: Se recibe una stream de la otra persona
    peer.on('stream', stream => {
        console.log("Stream remoto recibido:", stream);
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
    
    // Evento: Conexión establecida
    peer.on('connect', () => {
        console.log('¡Conexión WebRTC establecida!');
    });
    
    return peer;
}

// Iniciar búsqueda de chat
async function buscarChat() {
    mostrarPantalla(buscandoScreen);
    chatMessages.innerHTML = ''; // Limpiar mensajes anteriores
    
    // Iniciar media antes de buscar
    if (opcionAudio.checked || opcionVideo.checked) {
        console.log("Iniciando media antes de buscar chat");
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
    console.log("Conectado al servidor de Socket.IO");
    mostrarPantalla(inicioScreen);
});

// Cuando se encuentra un compañero de chat
socket.on('chat-iniciado', async () => {
    console.log("Chat iniciado");
    enChat = true;
    mostrarPantalla(chatScreen);
    
    // Si se requiere audio o video, iniciar el proceso de solicitud
    if (opcionAudio.checked || opcionVideo.checked) {
        console.log("Opciones de media activadas, iniciando solicitud");
        
        // Asegurarse de que tenemos media antes de iniciar la solicitud
        if (!localStream) {
            console.log("Obteniendo localStream");
            localStream = await iniciarMedia();
        }
        
        // Notificar al servidor que queremos iniciar video/audio
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
    console.log("Recibida solicitud de video/audio");
    
    // Asegurarse de que tenemos media antes de aceptar la solicitud
    if ((opcionAudio.checked || opcionVideo.checked) && !localStream) {
        console.log("Iniciando media en respuesta a solicitud");
        localStream = await iniciarMedia();
    }
    
    // Iniciar WebRTC como receptor (no iniciador)
    console.log("Iniciando WebRTC como receptor");
    iniciarWebRTC(false);
});

// Cuando se recibe una señal de WebRTC
socket.on('señal', (data) => {
    console.log("Señal recibida:", data);
    
    // Si no tenemos un peer, pero recibimos una señal, creamos uno como iniciador
    if (!peer && (opcionAudio.checked || opcionVideo.checked)) {
        console.log("Recibida señal sin peer activo, creando peer");
        iniciarWebRTC(false);  // Creamos como receptor
    }
    
    if (peer) {
        try {
            console.log("Transmitiendo señal al peer");
            peer.signal(data);
        } catch (error) {
            console.error("Error al procesar señal:", error);
        }
    } else {
        console.warn("No hay peer para recibir la señal");
    }
});

// Cuando el compañero se desconecta
socket.on('compañero-desconectado', () => {
    console.log("Compañero desconectado");
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
    console.error("Error de conexión con el servidor");
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