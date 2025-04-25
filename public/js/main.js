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

// Variables de estado
let enChat = false;

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

// Iniciar búsqueda de chat
function buscarChat() {
    mostrarPantalla(buscandoScreen);
    chatMessages.innerHTML = ''; // Limpiar mensajes anteriores
    socket.emit('buscar-chat');
}

// Evento: Botón Iniciar Chat
btnIniciarChat.addEventListener('click', buscarChat);

// Evento: Botón Enviar Mensaje
btnEnviar.addEventListener('click', () => {
    enviarMensaje();
});

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

// Función para enviar mensaje
function enviarMensaje() {
    const mensaje = mensajeInput.value.trim();
    if (mensaje && enChat) {
        socket.emit('enviar-mensaje', mensaje);
        agregarMensaje(mensaje, true);
        mensajeInput.value = '';
    }
}

// ===== Socket.io Eventos =====

// Cuando se establece conexión con el servidor
socket.on('connect', () => {
    mostrarPantalla(inicioScreen);
});

// Cuando se encuentra un compañero de chat
socket.on('chat-iniciado', () => {
    enChat = true;
    mostrarPantalla(chatScreen);
    agregarMensaje('Te has conectado con alguien. ¡Di hola!', false);
});

// Cuando se recibe un mensaje
socket.on('mensaje', (mensaje) => {
    agregarMensaje(mensaje, false);
});

// Cuando el compañero se desconecta
socket.on('compañero-desconectado', () => {
    enChat = false;
    mostrarPantalla(desconectadoScreen);
});

// Cuando hay un error de conexión
socket.on('connect_error', () => {
    alert('Error de conexión con el servidor');
    mostrarPantalla(inicioScreen);
});