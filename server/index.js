const { spawn } = require('child_process');
const { WebSocketServer } = require('ws');
const path = require('path');
const fs = require('fs');

const PORT = 3000;
const wss = new WebSocketServer({ port: PORT });

console.log(`WebSocket server started on ws://localhost:${PORT}`);

const clients = new Set();

wss.on('connection', (ws) => {
    console.log('New WebSocket client connected');
    clients.add(ws);

    ws.on('close', () => {
        console.log('Client disconnected');
        clients.delete(ws);
    });
});

function broadcast(message) {
    for (const client of clients) {
        if (client.readyState === 1) { // OPEN
            client.send(JSON.stringify({ text: message }));
        }
    }
}

let whisperProcess = null;

function startWhisper() {
    const streamPath = path.join(__dirname, '..', 'whisper.cpp', 'stream');
    const modelPath = path.join(__dirname, '..', 'whisper.cpp', 'models', 'ggml-base.en.bin');

    if (!fs.existsSync(streamPath) || !fs.existsSync(modelPath)) {
        console.error('Error: whisper.cpp stream binary or model not found.');
        console.error('Please run "npm run build:whisper" first.');
        process.exit(1);
    }

    console.log('Starting whisper.cpp stream process...');
    
    // Arguments for ultra-low latency:
    // -t 4: 4 threads
    // --step 500: audio step size in milliseconds
    // --length 3000: audio length in milliseconds
    // -c 0: capture from default audio input
    const args = [
        '-m', modelPath,
        '-t', '4',
        '--step', '500',
        '--length', '3000',
        '-c', '0'
    ];

    whisperProcess = spawn(streamPath, args);

    whisperProcess.stdout.on('data', (data) => {
        const output = data.toString();
        
        const lines = output.split('\n');
        for (let line of lines) {
            line = line.trim();
            if (!line) continue;
            
            // Remove ANSI escape codes
            line = line.replace(/\x1B\[[0-9;]*[mK]/g, '');
            
            // Extract text after the timestamp if present
            const match = line.match(/\](.*)/);
            if (match && match[1]) {
                const text = match[1].trim();
                if (text && !text.startsWith('[') && !text.startsWith('(')) {
                    process.stdout.write(`\rTranscribed: ${text.padEnd(50)}\n`);
                    broadcast(text);
                }
            } else if (!line.startsWith('[') && !line.startsWith('whisper_') && !line.startsWith('main:')) {
                 if (line.length > 1) {
                     broadcast(line);
                 }
            }
        }
    });

    whisperProcess.stderr.on('data', (data) => {
        // Ignored to keep console clean. You can log it if debugging is needed.
    });

    whisperProcess.on('close', (code) => {
        console.log(`whisper process exited with code ${code}. Restarting in 3 seconds...`);
        whisperProcess = null;
        setTimeout(startWhisper, 3000);
    });
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    if (whisperProcess) {
        whisperProcess.kill('SIGINT');
    }
    process.exit();
});

startWhisper();
