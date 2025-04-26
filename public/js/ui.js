// DOM Elements
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
const btnCancelarBusqueda = document.getElementById('btn-cancelar-busqueda');

// Show only the specified screen, hide others
function mostrarPantalla(pantalla) {
    inicioScreen.classList.add('hidden');
    buscandoScreen.classList.add('hidden');
    chatScreen.classList.add('hidden');
    desconectadoScreen.classList.add('hidden');
    
    pantalla.classList.remove('hidden');
    
    // Focus message input when entering chat screen
    if (pantalla === chatScreen && mensajeInput) {
        setTimeout(() => mensajeInput.focus(), 100);
    }
}

// Add message to chat
function agregarMensaje(texto, esMio) {
    const mensajeDiv = document.createElement('div');
    mensajeDiv.classList.add('message');
    mensajeDiv.classList.add(esMio ? 'message-self' : 'message-other');
    
    // Check for system messages (starting with *)
    if (texto.startsWith('*')) {
        mensajeDiv.classList.add('message-system');
        mensajeDiv.style.fontStyle = 'italic';
        mensajeDiv.style.color = '#666';
        mensajeDiv.style.textAlign = 'center';
        mensajeDiv.style.margin = '5px auto';
        mensajeDiv.style.backgroundColor = '#f8f8f8';
    }
    
    mensajeDiv.textContent = texto;
    chatMessages.appendChild(mensajeDiv);
    
    // Auto-scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Show system notification
function mostrarNotificacion(mensaje) {
    const notificacionDiv = document.createElement('div');
    notificacionDiv.classList.add('notification');
    notificacionDiv.textContent = mensaje;
    document.body.appendChild(notificacionDiv);
    
    // Remove notification after 3 seconds
    setTimeout(() => {
        notificacionDiv.classList.add('fade-out');
        setTimeout(() => {
            document.body.removeChild(notificacionDiv);
        }, 500);
    }, 3000);
}

// Create tooltip for help text
function crearTooltip(elementId, text) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const tooltip = document.createElement('div');
    tooltip.classList.add('tooltip');
    tooltip.textContent = text;
    
    element.addEventListener('mouseover', () => {
        tooltip.style.display = 'block';
    });
    
    element.addEventListener('mouseout', () => {
        tooltip.style.display = 'none';
    });
    
    element.appendChild(tooltip);
}

// Add a blinking effect to an element
function aplicarEfectoBlink(element) {
    if (!element) return;
    
    element.classList.add('blink');
    
    setTimeout(() => {
        element.classList.remove('blink');
    }, 1000);
}

// Apply styles for accessibility based on user preferences
function aplicarEstilosAccesibilidad() {
    const highContrastEnabled = localStorage.getItem('highContrast') === 'true';
    const largeTextEnabled = localStorage.getItem('largeText') === 'true';
    
    if (highContrastEnabled) {
        document.body.classList.add('high-contrast');
    } else {
        document.body.classList.remove('high-contrast');
    }
    
    if (largeTextEnabled) {
        document.body.classList.add('large-text');
    } else {
        document.body.classList.remove('large-text');
    }
}

// Initialize UI
function initUI() {
    // Apply accessibility settings
    aplicarEstilosAccesibilidad();
    
    // Create tooltips for buttons
    crearTooltip('enable-video', 'Habilitar cámara para videochat');
    crearTooltip('enable-audio', 'Habilitar micrófono para audiochat');
}

// Call UI initialization when document is loaded
document.addEventListener('DOMContentLoaded', initUI);