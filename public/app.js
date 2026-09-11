const captionsContainer = document.getElementById('captions-container');
const MAX_LINES = 3;
let ws = null;
let reconnectInterval = 1000;
const MAX_RECONNECT_INTERVAL = 15000;

function connect() {
    ws = new WebSocket('ws://localhost:3000');

    ws.onopen = () => {
        console.log('Connected to WebSocket server');
        reconnectInterval = 1000; // Reset interval on successful connection
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.text) {
                addCaption(data.text);
            }
        } catch (err) {
            console.error('Error parsing message:', err);
        }
    };

    ws.onclose = () => {
        console.log(`Disconnected. Reconnecting in ${reconnectInterval}ms...`);
        setTimeout(connect, reconnectInterval);
        reconnectInterval = Math.min(reconnectInterval * 1.5, MAX_RECONNECT_INTERVAL);
    };

    ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        ws.close();
    };
}

function addCaption(text) {
    const line = document.createElement('div');
    line.className = 'caption-line';
    line.textContent = text;
    
    captionsContainer.appendChild(line);

    // Keep only the last MAX_LINES
    while (captionsContainer.children.length > MAX_LINES) {
        captionsContainer.removeChild(captionsContainer.firstChild);
    }
}

// Start connection
connect();

// Apply theme from URL
const urlParams = new URLSearchParams(window.location.search);
const theme = urlParams.get('theme') || 'default';
document.body.classList.add(`theme-${theme}`);
