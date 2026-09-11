const { spawn } = require('child_process');
const { WebSocketServer } = require('ws');
const path = require('path');
const fs = require('fs');

const PORT = 3000;
const wss = new WebSocketServer({ port: PORT });

console.log(`WebSocket server started on ws://localhost:${PORT}`);

const clients = new Set();
let currentDeviceId = '0';
let availableDevices = [];

let isPaused = false;
let hasAutoSwitched = false;

wss.on('connection', (ws) => {
    console.log('New WebSocket client connected');
    clients.add(ws);
    
    // Send current devices and pause state to the new client
    ws.send(JSON.stringify({ type: 'state', devices: availableDevices, current: currentDeviceId, paused: isPaused }));

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'change_device') {
                console.log(`Changing microphone to device ID: ${data.id}`);
                currentDeviceId = data.id.toString();
                hasAutoSwitched = true; // Prevents auto-switching if user manually overrides
                restartWhisper();
            } else if (data.type === 'pause') {
                isPaused = data.paused;
                console.log(`Transcription paused state: ${isPaused}`);
                // Broadcast pause state to all clients
                for (const client of clients) {
                    if (client.readyState === 1) {
                        client.send(JSON.stringify({ type: 'state', devices: availableDevices, current: currentDeviceId, paused: isPaused }));
                    }
                }
            }
        } catch (e) {
            console.error('Error parsing message', e);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        clients.delete(ws);
    });
});

function broadcastText(text) {
    if (isPaused) return; // Do not broadcast if paused
    
    for (const client of clients) {
        if (client.readyState === 1) { // OPEN
            client.send(JSON.stringify({ type: 'text', text: text }));
        }
    }
}

function broadcastDevices() {
    for (const client of clients) {
        if (client.readyState === 1) { // OPEN
            client.send(JSON.stringify({ type: 'state', devices: availableDevices, current: currentDeviceId, paused: isPaused }));
        }
    }
}

let whisperProcess = null;
let isRestarting = false;

function startWhisper() {
    isRestarting = false;
    const streamPath = path.join(__dirname, '..', 'whisper.cpp', 'build', 'bin', 'whisper-stream');
    const modelPath = path.join(__dirname, '..', 'whisper.cpp', 'models', 'ggml-base.en.bin');

    if (!fs.existsSync(streamPath) || !fs.existsSync(modelPath)) {
        console.error('Error: whisper.cpp stream binary or model not found.');
        process.exit(1);
    }

    console.log(`Starting whisper.cpp stream on device ${currentDeviceId}...`);
    
    const args = [
        '-m', modelPath,
        '-t', '4',
        '--step', '500',
        '--length', '3000',
        '-c', currentDeviceId
    ];

    whisperProcess = spawn(streamPath, args);

    // Reset devices list when starting to repopulate
    availableDevices = [];

    whisperProcess.stdout.on('data', (data) => {
        const output = data.toString();
        const lines = output.split('\n');
        for (let line of lines) {
            line = line.trim();
            if (!line) continue;
            line = line.replace(/\x1B\[[0-9;]*[mK]/g, '');
            // Extract text after the timestamp if present
            const match = line.match(/\](.*)/);
            if (match && match[1]) {
                let text = match[1].trim();
                
                // Filter out common blank audio / silence artifacts from Whisper
                const tLower = text.toLowerCase();
                if (!text || tLower === '.' || tLower === '...' || tLower.includes('[blank_audio]') || tLower.includes('(silence)') || tLower.includes('*silence*') || tLower.includes('(music)') || tLower === 'thank you.') {
                    continue; // Skip sending empty or junk noise to OBS
                }

                if (!text.startsWith('[') && !text.startsWith('(')) {
                    process.stdout.write(`\rTranscribed: ${text.padEnd(50)}\n`);
                    broadcastText(text);
                }
            } else if (!line.startsWith('[') && !line.startsWith('whisper_') && !line.startsWith('main:')) {
                 if (line.length > 1) {
                     broadcastText(line);
                 }
            }
        }
    });

    whisperProcess.stderr.on('data', (data) => {
        const msg = data.toString();
        const lines = msg.split('\n');
        let foundNewDevice = false;
        let foundScarlett = false;
        let scarlettId = null;

        for (let line of lines) {
            const match = line.match(/Capture device #(\d+): '(.*)'/);
            if (match) {
                const id = match[1];
                const name = match[2];
                if (!availableDevices.find(d => d.id === id)) {
                    availableDevices.push({ id, name });
                    foundNewDevice = true;
                    if (name.toLowerCase().includes('scarlett')) {
                        foundScarlett = true;
                        scarlettId = id;
                    }
                }
            }
        }

        if (foundScarlett && !hasAutoSwitched && currentDeviceId !== scarlettId) {
            console.log(`Auto-detected Scarlett interface (ID: ${scarlettId}). Setting as default...`);
            currentDeviceId = scarlettId;
            hasAutoSwitched = true;
            restartWhisper();
            return;
        }

        if (foundNewDevice) {
            broadcastDevices();
        }
    });

    whisperProcess.on('close', (code) => {
        whisperProcess = null;
        if (!isRestarting) {
            console.log(`whisper process exited with code ${code}. Restarting in 3 seconds...`);
            setTimeout(startWhisper, 3000);
        }
    });
}

function restartWhisper() {
    isRestarting = true;
    if (whisperProcess) {
        whisperProcess.kill('SIGKILL');
    }
    setTimeout(startWhisper, 1000);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    if (whisperProcess) whisperProcess.kill('SIGINT');
    process.exit();
});

startWhisper();
