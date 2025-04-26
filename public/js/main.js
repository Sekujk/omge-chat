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
let isInitiator = false;
let mediaConstraints = {
    audio: false,
    video: false
};
let pendingCandidates = []; // Para almacenar candidatos ICE pendientes
let peerCreationInProgress = false; // Bandera para evitar creaciones duplicadas
let peerInitialized = false; // Nueva bandera para rastrear si el peer ya está configurado
let remoteStreamReceived = false; // Para rastrear si ya recibimos un stream remoto

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
            await localVideo.play().catch(err => console.log("Error reproduciendo video local:", err));
        }
        
        // Actualizar estado de los botones de media
        actualizarBotonesMedia(stream);
        
        return stream;
    } catch (error) {
        console.error('Error al acceder a los dispositivos de media:', error);
        alert('No se pudo acceder a la cámara o micrófono. Por favor, verifica los permisos.');
        return null;
    }
}

// Actualizar estado visual de los botones de media
function actualizarBotonesMedia(stream) {
    const streamToCheck = stream || localStream;
    
    if (streamToCheck) {
        const videoTracks = streamToCheck.getVideoTracks();
        const audioTracks = streamToCheck.getAudioTracks();
        
        if (videoTracks.length > 0) {
            const videoEnabled = videoTracks[0].enabled;
            btnToggleVideo.innerHTML = videoEnabled ? 
                '<i class="fas fa-video"></i>' : 
                '<i class="fas fa-video-slash"></i>';
            btnToggleVideo.classList.toggle('disabled', !videoEnabled);
        } else {
            btnToggleVideo.innerHTML = '<i class="fas fa-video-slash"></i>';
            btnToggleVideo.classList.add('disabled');
        }
        
        if (audioTracks.length > 0) {
            const audioEnabled = audioTracks[0].enabled;
            btnToggleAudio.innerHTML = audioEnabled ? 
                '<i class="fas fa-microphone"></i>' : 
                '<i class="fas fa-microphone-slash"></i>';
            btnToggleAudio.classList.toggle('disabled', !audioEnabled);
        } else {
            btnToggleAudio.innerHTML = '<i class="fas fa-microphone-slash"></i>';
            btnToggleAudio.classList.add('disabled');
        }
    }
}

// Iniciar conexión WebRTC con manejo de errores mejorado
function iniciarWebRTC(initiator = false) {
    if (peerCreationInProgress) {
        console.log("Creación de peer ya en proceso, espere...");
        return null;
    }
    
    peerCreationInProgress = true;
    console.log(`Iniciando WebRTC como ${initiator ? 'iniciador' : 'receptor'}`);
    
    // Destruir peer anterior si existe
    if (peer) {
        console.log("Destruyendo peer anterior");
        peer.destroy();
        peer = null;
        peerInitialized = false;
        remoteStreamReceived = false;
    }
    
    isInitiator = initiator;
    
    // Verificar que tenemos un stream si se ha seleccionado audio o video
    const needsMedia = opcionAudio.checked || opcionVideo.checked;
    if (needsMedia && !localStream) {
        console.warn("Se requiere media pero localStream no está disponible");
        peerCreationInProgress = false;
        return null;
    }
    
    // Crear nuevo peer con varios servidores STUN/TURN
    const peerOptions = {
        initiator: initiator,
        trickle: true,
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                { urls: 'stun:stun4.l.google.com:19302' },
                { urls: 'stun:stun.stunprotocol.org:3478' },
                { urls: 'stun:stun.ekiga.net:3478' },
                // Servidores TURN públicos
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
            ],
            iceCandidatePoolSize: 10
        },
        sdpTransform: (sdp) => {
            // Esto puede ayudar con algunos problemas de compatibilidad en navegadores
            return sdp;
        }
    };
    
    // Solo añadir el stream si existe
    if (localStream) {
        peerOptions.stream = localStream;
    }
    
    try {
        // Crear el peer con las opciones configuradas
        peer = new SimplePeer(peerOptions);
        console.log("Peer creado:", peer);
        
        // Evento: Se genera una señal para enviar al otro peer
        peer.on('signal', data => {
            console.log("Señal generada para enviar:", data.type || "ICE candidate");
            socket.emit('señal', data);
        });
        
        // Evento: Se recibe una stream de la otra persona
        peer.on('stream', stream => {
            console.log("Stream remoto recibido:", stream);
            if (stream && stream.getTracks().length > 0) {
                remoteVideo.srcObject = stream;
                remoteStreamReceived = true;
                
                // Intentar reproducir el video inmediatamente
                remoteVideo.play().catch(err => {
                    console.warn("Error al reproducir video automáticamente:", err);
                    // Podríamos mostrar un botón para reproducir manualmente
                });
            } else {
                console.warn("Stream remoto recibido sin tracks");
            }
        });
        
        // Evento: Error en la conexión
        peer.on('error', err => {
            console.error('Error en la conexión WebRTC:', err);
            peerCreationInProgress = false;
        });
        
        // Evento: Conexión cerrada
        peer.on('close', () => {
            console.log('Conexión WebRTC cerrada');
            peerCreationInProgress = false;
            peerInitialized = false;
            remoteStreamReceived = false;
        });
        
        // Evento: Conexión establecida
        peer.on('connect', () => {
            console.log('¡Conexión WebRTC establecida!');
            peerCreationInProgress = false;
            peerInitialized = true;
            
            // Si después de un tiempo razonable no recibimos stream, podemos intentar reiniciar
            if (needsMedia && !remoteStreamReceived) {
                setTimeout(() => {
                    if (!remoteStreamReceived && peer && peerInitialized) {
                        console.log("No se recibió stream después de la conexión, intentando renegociar");
                        // Aquí podríamos implementar una estrategia de reconexión
                    }
                }, 5000);
            }
        });
        
        // Procesar señales pendientes en el orden correcto
        if (pendingCandidates.length > 0) {
            console.log(`Procesando ${pendingCandidates.length} señales pendientes`);
            
            // Primero procesar offer/answer, luego los ICE candidates
            const offer = pendingCandidates.find(c => c.type === 'offer');
            const answer = pendingCandidates.find(c => c.type === 'answer');
            const candidates = pendingCandidates.filter(c => !c.type);
            
            try {
                // Procesar offer/answer primero
                if (offer && !initiator) peer.signal(offer);
                if (answer && initiator) peer.signal(answer);
                
                // Luego procesar ICE candidates
                for (const candidate of candidates) {
                    peer.signal(candidate);
                }
            } catch (err) {
                console.error("Error procesando señales pendientes:", err);
            }
            
            // Limpiar señales pendientes
            pendingCandidates = [];
        }
        
        return peer;
    } catch (error) {
        console.error("Error al crear el peer:", error);
        peerCreationInProgress = false;
        return null;
    }
}

// Iniciar búsqueda de chat
async function buscarChat() {
    mostrarPantalla(buscandoScreen);
    chatMessages.innerHTML = ''; // Limpiar mensajes anteriores
    pendingCandidates = []; // Reiniciar candidatos pendientes
    peerCreationInProgress = false; // Reiniciar bandera
    peerInitialized = false; // Reiniciar estado del peer
    remoteStreamReceived = false; // Reiniciar estado de stream remoto
    
    // Reiniciar estado de media
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
        localVideo.srcObject = null;
        remoteVideo.srcObject = null;
    }
    
    // Reiniciar peer si existe
    if (peer) {
        peer.destroy();
        peer = null;
    }
    
    // Actualizar restricciones de media según opciones seleccionadas
    mediaConstraints = {
        audio: opcionAudio.checked,
        video: opcionVideo.checked
    };
    
    // Iniciar media antes de buscar chat si es necesario
    if (opcionAudio.checked || opcionVideo.checked) {
        console.log("Iniciando media antes de buscar chat");
        localStream = await iniciarMedia();
        if (!localStream && (opcionAudio.checked || opcionVideo.checked)) {
            alert('No se pudo acceder a la cámara/micrófono. Verifica los permisos o prueba solo con chat de texto.');
            mostrarPantalla(inicioScreen);
            return;
        }
    }
    
    // Buscar chat una vez que tenemos el stream si era necesario
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
    
    peerCreationInProgress = false;
    peerInitialized = false;
    remoteStreamReceived = false;
}

// Función para manejar señales entrantes con mejor manejo de errores
function procesarSeñalEntrante(data) {
    console.log("Procesando señal entrante:", data.type || "ICE candidate");
    
    // Si no tenemos peer o estamos en medio de creación, guardar para después
    if (!peer || peerCreationInProgress) {
        console.log("Añadiendo señal a la cola de pendientes");
        pendingCandidates.push(data);
        return;
    }
    
    // Intentar procesar la señal en el peer existente
    try {
        peer.signal(data);
    } catch (err) {
        console.error("Error al procesar señal, guardando como pendiente:", err);
        pendingCandidates.push(data);
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
    if ((opcionAudio.checked || opcionVideo.checked)) {
        console.log("Opciones de media activadas, iniciando solicitud");
        
        // Asegurarse de que tenemos media antes de iniciar la solicitud
        if (!localStream) {
            console.log("Obteniendo localStream");
            localStream = await iniciarMedia();
        }
        
        // Si tenemos stream local, crear peer y solicitar video
        if (localStream) {
            console.log("Creando peer como iniciador");
            iniciarWebRTC(true);
            
            // Notificar al otro usuario que queremos iniciar media
            socket.emit('solicitar-video');
        }
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
    
    // Verificar si queremos media y tenemos stream
    const needsMedia = opcionAudio.checked || opcionVideo.checked;
    
    if (needsMedia) {
        // Asegurarse de que tenemos media
        if (!localStream) {
            console.log("Iniciando media en respuesta a solicitud");
            localStream = await iniciarMedia();
        }
        
        // Si tenemos stream, crear peer como receptor
        if (localStream) {
            // Si ya hay un peer iniciador, no crear otro
            if (!peer || (peer && !isInitiator)) {
                console.log("Iniciando WebRTC como receptor");
                iniciarWebRTC(false);
            } else {
                console.log("Ya hay un peer iniciador, no se crea uno nuevo");
            }
        } else {
            console.warn("No se pudo obtener stream para responder a la solicitud");
            // Podríamos notificar al usuario que hubo un problema
        }
    } else {
        console.log("Media no seleccionada, ignorando solicitud de video");
    }
});

// Cuando se recibe una señal de WebRTC
socket.on('señal', async (data) => {
    console.log("Señal recibida:", data.type || "ICE candidate");
    
    // Si recibimos una oferta, necesitamos estar listos para responder
    if (data.type === 'offer') {
        // Si no tenemos stream pero lo necesitamos
        const needsMedia = opcionAudio.checked || opcionVideo.checked;
        if (needsMedia && !localStream) {
            console.log("Recibida oferta sin stream local, iniciando media");
            localStream = await iniciarMedia();
        }
        
        // Si ya tenemos un peer pero somos iniciadores o no está inicializado,
        // necesitamos crear uno nuevo como receptor
        if (!peer || (peer && isInitiator) || !peerInitialized) {
            // Guardar la oferta para procesarla después de crear el peer
            pendingCandidates.push(data);
            iniciarWebRTC(false);
            return;
        }
    }
    
    // Si recibimos answer pero no tenemos peer o somos receptores, algo está mal
    if (data.type === 'answer') {
        if (!peer || (peer && !isInitiator)) {
            console.warn("Recibida respuesta pero no somos iniciadores");
            // Podríamos iniciar un nuevo peer como iniciador si es necesario
            if (localStream && !peer) {
                pendingCandidates.push(data);
                iniciarWebRTC(true);
                return;
            }
        }
    }
    
    // Procesar la señal utilizando nuestra función mejorada
    procesarSeñalEntrante(data);
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
        peerInitialized = false;
        remoteStreamReceived = false;
    }
    
    remoteVideo.srcObject = null;
    pendingCandidates = []; // Limpiar candidatos pendientes
    peerCreationInProgress = false;
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

// Estas son variables de depuración que puedes utilizar en la consola
window._debug = {
    getPeer: () => peer,
    getLocalStream: () => localStream,
    getPendingCandidates: () => pendingCandidates,
    getRemoteStream: () => remoteVideo.srcObject,
    getConnectionState: () => peer ? peer._pc.connectionState : 'no peer',
    getSignalingState: () => peer ? peer._pc.signalingState : 'no peer',
    getIsInitiator: () => isInitiator,
    resetPeer: () => {
        if (peer) {
            peer.destroy();
            peer = null;
            peerInitialized = false;
            remoteStreamReceived = false;
            console.log("Peer reseteado manualmente");
        }
    },
    recreatePeer: (asInitiator) => {
        iniciarWebRTC(asInitiator);
        console.log(`Peer recreado como ${asInitiator ? 'iniciador' : 'receptor'}`);
    }
};

// Añadir un log más detallado de los estados de la conexión WebRTC
setInterval(() => {
    if (peer && peer._pc) {
        console.log(`Estado WebRTC - conexión: ${peer._pc.connectionState}, señalización: ${peer._pc.signalingState}, ICE: ${peer._pc.iceConnectionState}`);
    }
}, 5000);