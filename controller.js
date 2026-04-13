const loginScreen        = document.getElementById('login-screen');
const waitingRoomScreen  = document.getElementById('waiting-room-screen');
const controllerScreen   = document.getElementById('controller-screen');
const loginBtn           = document.getElementById('btn-join');
const errorText          = document.getElementById('login-error');
const statusDot          = document.getElementById('connection-status');
const playerDisplayName  = document.getElementById('player-display-name');
const iconObjet          = document.getElementById("itemEquipee");

let socket      = null;
let playerName  = "";
let roomCode    = "";
let playerId    = Math.floor(Math.random() * 1000000).toString();
let currentItem = null;
const btnItem   = document.getElementById('btn-item');



 // ─── Joystick ─────────────────────────────────────────────────
        const joystickZone  = document.getElementById('joystick-zone');
        const joystickBase  = document.getElementById('joystick-base');
        const joystickThumb = document.getElementById('joystick-thumb');

        const DEAD_ZONE   = 0.3;
        const BASE_RADIUS = 65;
        const THUMB_MAX   = 38;

        const joystickState = { up: false, down: false, left: false, right: false, rawX: 0, rawY: 0 };

        let activeTouchId = null;

        function getBaseCenter() {
            const r = joystickBase.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        }

        function updateJoystick(clientX, clientY) {
            const center = getBaseCenter();
            let dx = clientX - center.x;
            let dy = clientY - center.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const normX = dx / BASE_RADIUS;
            const normY = dy / BASE_RADIUS;
            const normDist = Math.min(dist / BASE_RADIUS, 1);
            const clampedDist = Math.min(dist, THUMB_MAX);
            const angle = Math.atan2(dy, dx);
            joystickThumb.style.left = `calc(50% + ${Math.cos(angle) * clampedDist}px)`;
            joystickThumb.style.top  = `calc(50% + ${Math.sin(angle) * clampedDist}px)`;
            joystickThumb.style.transform = 'translate(-50%, -50%)';
            joystickThumb.classList.add('active');

            if (normDist < DEAD_ZONE) {
                joystickState.up = joystickState.down = joystickState.left = joystickState.right = false;
                joystickState.rawX = joystickState.rawY = 0;
                return;
            }

            joystickState.rawX  = Math.max(-1, Math.min(1, normX));
            joystickState.rawY  = Math.max(-1, Math.min(1, normY));
            joystickState.up    = normY < -DEAD_ZONE;
            joystickState.down  = normY >  DEAD_ZONE;
            joystickState.left  = normX < -DEAD_ZONE;
            joystickState.right = normX >  DEAD_ZONE;
        }

        function resetJoystick() {
            joystickThumb.style.left = '50%';
            joystickThumb.style.top  = '50%';
            joystickThumb.style.transform = 'translate(-50%, -50%)';
            joystickThumb.classList.remove('active');
            joystickState.up = joystickState.down = joystickState.left = joystickState.right = false;
            joystickState.rawX = joystickState.rawY = 0;
            activeTouchId = null;
        }

        joystickZone.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (activeTouchId !== null) return;
            const touch = e.changedTouches[0];
            activeTouchId = touch.identifier;
            updateJoystick(touch.clientX, touch.clientY);
        }, { passive: false });

        joystickZone.addEventListener('touchmove', (e) => {
            e.preventDefault();
            for (const touch of e.changedTouches) {
                if (touch.identifier === activeTouchId) updateJoystick(touch.clientX, touch.clientY);
            }
        }, { passive: false });

        joystickZone.addEventListener('touchend', (e) => {
            for (const touch of e.changedTouches) {
                if (touch.identifier === activeTouchId) resetJoystick();
            }
        });

        joystickZone.addEventListener('touchcancel', (e) => {
            for (const touch of e.changedTouches) {
                if (touch.identifier === activeTouchId) resetJoystick();
            }
        });

        let mouseDown = false;
        joystickZone.addEventListener('mousedown', (e) => { mouseDown = true; updateJoystick(e.clientX, e.clientY); });
        window.addEventListener('mousemove', (e) => { if (mouseDown) updateJoystick(e.clientX, e.clientY); });
        window.addEventListener('mouseup', () => { if (mouseDown) { mouseDown = false; resetJoystick(); } });
/*
// ─── Debug buttons ────────────────────────────────────────────────────────────
const debugBtn         = document.getElementById('btn-debug');
const debugBtnInfected = document.getElementById('btn-debug-infected');

debugBtn.addEventListener('click', () => {
    showScreen(controllerScreen);
    debugBtn.style.display = 'none';
    if (debugBtnInfected) debugBtnInfected.style.display = 'none';
});

debugBtnInfected.addEventListener('click', () => {
    showScreen(controllerScreen);
    controllerScreen.style.backgroundColor = "var(--nes-dark-red)";
    debugBtn.style.display = 'none';
    debugBtnInfected.style.display = 'none';
});
*/
// ─── Screen helper ────────────────────────────────────────────────────────────
function showScreen(screen) {
    [loginScreen, waitingRoomScreen, controllerScreen].forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
}

// ─── Input state ─────────────────────────────────────────────────────────────
const inputState = {
    up: false, down: false, left: false, right: false,
    action: false, item: false, emoji: false
};

// ─── Chat ─────────────────────────────────────────────────────────────────────
function send_message() {
    const msg = document.getElementById("message_box").value;
    if (!msg.trim()) return;
    sendPayload({ type: "chat", message: msg, player_name: playerName });
    document.getElementById("message_box").value = "";
}

// Allow Enter key in chat
document.getElementById("message_box").addEventListener('keydown', (e) => {
    if (e.key === 'Enter') send_message();
});

// ─── Login ────────────────────────────────────────────────────────────────────
loginBtn.addEventListener('click', () => {
    roomCode   = document.getElementById('room-code').value.toUpperCase().trim();
    playerName = document.getElementById('player-name').value.trim();

    if (roomCode.length !== 4) { errorText.textContent = "Le code doit faire 4 caractères."; return; }
    if (playerName.length === 0) { errorText.textContent = "Veuillez entrer un nom."; return; }

    errorText.textContent = "Connexion au serveur...";
    loginBtn.disabled = true;

    // Use WS_SERVER_URL from ws_config.js (must be provided)
    try {
        if (typeof WS_SERVER_URL === 'undefined') throw new Error('WS_SERVER_URL not set (see ws_config.js)');
        connectWebSocket(WS_SERVER_URL);
    } catch (e) {
        errorText.textContent = "Erreur de configuration du client: " + e.message;
        loginBtn.disabled = false;
    }
});

// ─── WebSocket ────────────────────────────────────────────────────────────────
function connectWebSocket(url) {
    try {
        socket = new WebSocket(url);

        socket.onopen = () => {
            console.log("Connected to WebSocket server");
            // send join request; wait for server 'joined' confirmation
            sendPayload({ type: "join", player_id: playerId, player_name: playerName, room_code: roomCode });
        };

        socket.onmessage = (event) => {
            try {
                const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
                // Handle 'joined' separately to set UI and start input loop
                if (data.type === 'joined') {
                    statusDot.classList.remove('disconnected');
                    statusDot.classList.add('connected');
                    playerDisplayName.textContent = playerName;
                    showScreen(waitingRoomScreen);
                    startInputLoop();
                }
                if (data.type === 'error') {
                    errorText.textContent = data.message || 'Erreur serveur.';
                    loginBtn.disabled = false;
                    socket.close();
                    return;
                }

                // delegate other messages
                handleServerMessage(JSON.stringify(data));
            } catch (e) {
                console.error('Invalid message', e);
            }
        };

        socket.onclose = () => {
            console.log("Disconnected from server.");
            statusDot.classList.remove('connected');
            statusDot.classList.add('disconnected');
            alert("Connexion perdue avec le serveur.");
            loginBtn.disabled = false;
            showScreen(loginScreen);
        };

        socket.onerror = (error) => {
            console.error("WebSocket Error:", error);
            errorText.textContent = "Impossible de se connecter au serveur.";
            loginBtn.disabled = false;
        };
    } catch (e) {
        errorText.textContent = "Erreur interne.";
    }
}

// ─── Envoi de messages ────────────────────────────────────────────────────────
function sendPayload(data) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(data));
    }
}

// ─── Boucle d'input (30 fps) ──────────────────────────────────────────────────
function startInputLoop() {
    setInterval(() => {
        sendPayload({
            type: "input",
            player_id: playerId,
            state: {
                ...inputState,
                up:    joystickState.up    || inputState.up,
                down:  joystickState.down  || inputState.down,
                left:  joystickState.left  || inputState.left,
                right: joystickState.right || inputState.right,
                rawX:  joystickState.rawX,
                rawY:  joystickState.rawY
            }
        });
    }, 1000 / 30);
}

// ─── Messages serveur ─────────────────────────────────────────────────────────
function handleServerMessage(dataStr) {
    try {
        const data = JSON.parse(dataStr);

        if (data.type === "start") {
            // ➜ Manette
            showScreen(controllerScreen);
            if ("vibrate" in navigator) navigator.vibrate(200);
        }

        if (data.type === "vibrate") {
            if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
        }

        if (data.type === "role_update" && data.role === "infected") {
            controllerScreen.style.backgroundColor = "var(--nes-dark-red)";
            const labels = document.getElementsByClassName('btn-label');
            for (let i = 0; i < labels.length; i++) labels[i].style.color = "#fff";
            if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
        }

        if (data.type === "new_item") {
            if (data.name === "boost") {
                iconObjet.src = "assets/icon_burst.png";
                document.getElementById("label_obj").innerText = "ADRENALINE";
                currentItem = "boost";
            } else if (data.name === "slow") {
                iconObjet.src = "assets/icon_target.png";
                document.getElementById("label_obj").innerText = "PIÈGE PICOT";
                currentItem = "slow";
            } else if (data.name === "shield") {
                iconObjet.src = "assets/shield.png";
                document.getElementById("label_obj").innerText = "BOUCLIER";
                currentItem = "shield";
            }
            if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
        }
    } catch (e) {
        console.error("Invalid JSON from server", e);
    }
}

// ─── Boutons action ───────────────────────────────────────────────────────────
function bindButton(btnId, stateKey) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    const press   = (e) => { e.preventDefault(); inputState[stateKey] = true;  btn.classList.add('active'); };
    const release = (e) => { e.preventDefault(); inputState[stateKey] = false; btn.classList.remove('active'); };
    btn.addEventListener('mousedown',   press);
    btn.addEventListener('touchstart',  press,   { passive: false });
    btn.addEventListener('mouseup',     release);
    btn.addEventListener('mouseleave',  release);
    btn.addEventListener('touchend',    release);
    btn.addEventListener('touchcancel', release);
}

bindButton('btn-emoji', 'emoji');

// Bouton objet (utilise et consomme l'item)
const pressItem = (e) => {
    e.preventDefault();
    if (!currentItem) return;
    inputState['item'] = true;
    btnItem.classList.add('active');
    sendPayload({ type: "use_item", player_id: playerId, item: currentItem });
    iconObjet.src = "";
    document.getElementById("label_obj").innerText = "PAS D'ITEM";
    currentItem = null;
};
const releaseItem = (e) => {
    e.preventDefault();
    inputState['item'] = false;
    btnItem.classList.remove('active');
};
btnItem.addEventListener('mousedown',   pressItem);
btnItem.addEventListener('touchstart',  pressItem,   { passive: false });
btnItem.addEventListener('mouseup',     releaseItem);
btnItem.addEventListener('mouseleave',  releaseItem);
btnItem.addEventListener('touchend',    releaseItem);
btnItem.addEventListener('touchcancel', releaseItem);
