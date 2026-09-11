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
                addCaption(data.text, data.id);
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

let fadeTimeout = null;
const FADE_DELAY_MS = 5000;

function addCaption(text, id) {
    if (!id) id = Date.now().toString();

    // Reset container visibility immediately upon new text
    captionsContainer.style.opacity = '1';
    captionsContainer.style.transition = 'opacity 0.2s';
    
    // Clear existing fade timeout
    if (fadeTimeout) clearTimeout(fadeTimeout);

    let shouldAppend = true;
    
    // First try to find by exact Segment ID
    let line = document.getElementById(`caption-${id}`);
    
    if (line) {
        line.textContent = text;
        shouldAppend = false;
    } else if (captionsContainer.children.length > 0) {
        // Fallback string-matching continuation check for older/id-less streams
        const lastLine = captionsContainer.lastChild;
        const lastText = lastLine.textContent;
        const minLen = Math.min(text.length, lastText.length);
        
        if (minLen > 3 && (text.startsWith(lastText.substring(0, minLen - 2)) || lastText.startsWith(text.substring(0, minLen - 2)))) {
            lastLine.textContent = text;
            shouldAppend = false;
        } else if (text.includes(lastText) || lastText.includes(text)) {
            lastLine.textContent = text;
            shouldAppend = false;
        }
    }

    if (shouldAppend) {
        const newLine = document.createElement('div');
        newLine.className = 'caption-line';
        newLine.id = `caption-${id}`;
        newLine.textContent = text;
        captionsContainer.appendChild(newLine);

        while (captionsContainer.children.length > MAX_LINES) {
            captionsContainer.removeChild(captionsContainer.firstChild);
        }
    }

    // Set timeout to fade out subtitles after silence
    fadeTimeout = setTimeout(() => {
        captionsContainer.style.opacity = '0';
        captionsContainer.style.transition = 'opacity 1s';
    }, FADE_DELAY_MS);
}

// Start connection
connect();

// Apply theme from URL
const urlParams = new URLSearchParams(window.location.search);
const theme = urlParams.get('theme') || 'default';
document.body.classList.add(`theme-${theme}`);
