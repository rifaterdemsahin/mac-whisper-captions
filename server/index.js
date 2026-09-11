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
let customBlocks = [];
let lastBroadcastedText = '';

wss.on('connection', (ws) => {
    console.log('New WebSocket client connected');
    clients.add(ws);
    
    // Send current state to the new client
    ws.send(JSON.stringify({ type: 'state', devices: availableDevices, current: currentDeviceId, paused: isPaused, blocks: customBlocks }));

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'change_device') {
                console.log(`Changing microphone to device ID: ${data.id}`);
                currentDeviceId = data.id.toString();
                hasAutoSwitched = true;
                restartWhisper();
            } else if (data.type === 'pause') {
                isPaused = data.paused;
                console.log(`Transcription paused state: ${isPaused}`);
                broadcastState();
            } else if (data.type === 'update_blocks') {
                customBlocks = data.blocks;
                console.log(`Updated custom blocks: ${customBlocks.join(', ')}`);
                broadcastState();
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
    if (isPaused) return; 
    
    for (const client of clients) {
        if (client.readyState === 1) { 
            client.send(JSON.stringify({ type: 'text', text: text }));
        }
    }
}

function broadcastState() {
    for (const client of clients) {
        if (client.readyState === 1) { 
            client.send(JSON.stringify({ type: 'state', devices: availableDevices, current: currentDeviceId, paused: isPaused, blocks: customBlocks }));
        }
    }
}

let whisperProcess = null;
let isRestarting = false;

function startWhisper() {
    isRestarting = false;
    lastBroadcastedText = ''; // Reset deduplication buffer
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
    availableDevices = [];

    whisperProcess.stdout.on('data', (data) => {
        const output = data.toString();
        const lines = output.split('\n');
        for (let line of lines) {
            line = line.trim();
            if (!line) continue;
            line = line.replace(/\x1B\[[0-9;]*[mK]/g, '');
            const match = line.match(/\](.*)/);
            if (match && match[1]) {
                let text = match[1].trim();
                
                // 1. Aggressively strip environmental noise tags
                text = text.replace(/\[.*?\]|\(.*?\)|\*.*?\*/g, '').trim();

                // 2. Filter out known Whisper hallucinations
                const tLower = text.toLowerCase().replace(/[^a-z]/g, ''); 
                if (tLower === 'blankaudio' || tLower === 'silence' || tLower === 'music' || tLower === 'subsby' || tLower.includes('subtitlesby')) {
                    continue; 
                }

                // 3. Skip if the remaining string is empty or just purely punctuation/symbols
                if (!text || text.match(/^[^a-zA-Z0-9]+$/) || text.length <= 1) {
                    continue; 
                }
                
                // 4. Custom User Blocks filtering
                const containsBlock = customBlocks.some(block => {
                    const blockRegex = new RegExp(`\\b${block.toLowerCase()}\\b`, 'i');
                    return blockRegex.test(text.toLowerCase());
                });
                
                if (containsBlock) {
                    continue;
                }

                // 5. Deduplication (Prevent flickering of the exact same output sequentially)
                if (text === lastBroadcastedText) {
                    continue; // Skip exact duplicates
                }
                lastBroadcastedText = text;

                process.stdout.write(`\rTranscribed: ${text.padEnd(50)}\n`);
                broadcastText(text);
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
            broadcastState();
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
