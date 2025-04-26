// Global variables for media handling
let localStream = null;
let peerConnection = null;
let mediaConstraints = { video: false, audio: false };
let isVideoEnabled = true;
let isAudioEnabled = true;

// DOM Elements
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const toggleVideoBtn = document.getElementById('toggle-video');
const toggleAudioBtn = document.getElementById('toggle-audio');

// Initialize media stream with given constraints
async function initMedia(constraints) {
    try {
        mediaConstraints = constraints;
        
        if (!constraints.video && !constraints.audio) {
            // No media needed
            return Promise.resolve();
        }
        
        // Request user media
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // Display local video
        if (localVideo) {
            localVideo.srcObject = localStream;
        }
        
        // Set initial state for buttons
        isVideoEnabled = constraints.video;
        isAudioEnabled = constraints.audio;
        updateMediaButtonStates();
        
        return Promise.resolve();
    } catch (error) {
        console.error('Error accessing media devices:', error);
        return Promise.reject(error);
    }
}

// Initialize WebRTC peer connection
function initPeerConnection(isInitiator) {
    // Configuration with STUN/TURN servers
    const configuration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
            // Add TURN servers for production
        ]
    };
    
    // Create new RTCPeerConnection
    peerConnection = new RTCPeerConnection(configuration);
    
    // Add local stream tracks to the connection
    if (localStream) {
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
    }
    
    // Handle ICE candidates
    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            // Send ICE candidate to the peer
            socket.emit('signal', { 
                type: 'ice-candidate', 
                candidate: event.candidate 
            });
        }
    };
    
    // Handle connection state changes
    peerConnection.onconnectionstatechange = event => {
        console.log('Connection state:', peerConnection.connectionState);
    };
    
    // Handle receiving remote stream
    peerConnection.ontrack = event => {
        if (remoteVideo && event.streams && event.streams[0]) {
            remoteVideo.srcObject = event.streams[0];
        }
    };
    
    // If we're the initiator, create and send an offer
    if (isInitiator) {
        peerConnection.createOffer()
            .then(offer => peerConnection.setLocalDescription(offer))
            .then(() => {
                socket.emit('signal', { 
                    type: 'offer', 
                    sdp: peerConnection.localDescription 
                });
            })
            .catch(error => console.error('Error creating offer:', error));
    }
}

// Handle incoming WebRTC signals
function handleSignal(data) {
    if (!peerConnection) {
        // Create peer connection if it doesn't exist yet
        initPeerConnection(false);
    }
    
    switch (data.type) {
        case 'offer':
            // Set the remote description and create an answer
            peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp))
                .then(() => peerConnection.createAnswer())
                .then(answer => peerConnection.setLocalDescription(answer))
                .then(() => {
                    socket.emit('signal', { 
                        type: 'answer', 
                        sdp: peerConnection.localDescription 
                    });
                })
                .catch(error => console.error('Error handling offer:', error));
            break;
            
        case 'answer':
            // Set remote description from answer
            peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp))
                .catch(error => console.error('Error handling answer:', error));
            break;
            
        case 'ice-candidate':
            // Add ICE candidate from peer
            if (data.candidate) {
                peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate))
                    .catch(error => console.error('Error adding ICE candidate:', error));
            }
            break;
    }
}

// Close and clean up peer connection
function closePeerConnection() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
}

// Stop local media stream
function stopLocalStream() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
        
        if (localVideo) {
            localVideo.srcObject = null;
        }
    }
}

// Toggle video on/off
function toggleVideo() {
    if (!localStream) return;
    
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
        isVideoEnabled = !isVideoEnabled;
        videoTrack.enabled = isVideoEnabled;
        updateMediaButtonStates();
        
        // Let peer know about the change
        socket.emit('enviar-mensaje', isVideoEnabled ? 
            '* activó su cámara' : 
            '* desactivó su cámara');
    }
}

// Toggle audio on/off
function toggleAudio() {
    if (!localStream) return;
    
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
        isAudioEnabled = !isAudioEnabled;
        audioTrack.enabled = isAudioEnabled;
        updateMediaButtonStates();
        
        // Let peer know about the change
        socket.emit('enviar-mensaje', isAudioEnabled ? 
            '* activó su micrófono' : 
            '* silencio su micrófono');
    }
}

// Update media control button text
function updateMediaButtonStates() {
    if (toggleVideoBtn) {
        toggleVideoBtn.textContent = isVideoEnabled ? 'Pausar Video' : 'Activar Video';
    }
    
    if (toggleAudioBtn) {
        toggleAudioBtn.textContent = isAudioEnabled ? 'Silenciar' : 'Activar Audio';
    }
}