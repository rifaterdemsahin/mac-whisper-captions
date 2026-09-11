# Mac Whisper Captions

A zero-cost, high-accuracy, ultra-low-latency local live captioning platform designed specifically for Apple Silicon Macs.

This project replaces browser-based Web Speech tools with a robust, local C++ AI speech recognition engine (whisper.cpp) accelerated by the Apple Metal GPU. It exposes a real-time WebSocket feed to a customizable, transparent OBS web overlay.

## Prerequisites

- **Apple Silicon Mac** (M1, M2, M3, etc.)
- **Xcode Command Line Tools**: `xcode-select --install`
- **Node.js** (v16 or higher)
- **CMake**: `brew install cmake` (if you don't have it)

## Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/rifaterdemsahin/mac-whisper-captions.git
   cd mac-whisper-captions
   ```

2. **Install Node dependencies:**
   ```bash
   npm install
   ```

3. **Build whisper.cpp and download the model:**
   This script will clone `whisper.cpp`, download the `base.en` model, and compile the `stream` binary with Metal support.
   ```bash
   npm run build:whisper
   ```

## Usage

1. **Start the server:**
   ```bash
   npm start
   ```
   This spawns the background whisper process, starts listening to your default microphone, and opens a WebSocket server on `ws://localhost:3000`.

2. **Add to OBS Studio:**
   - In OBS, add a new **Browser Source**.
   - Select **Local file** and point it to `public/index.html` inside this project folder.
   - Alternatively, if you serve the `public` folder using a local web server (e.g., `npx serve public`), enter that URL (e.g., `http://localhost:5000`).
   - Set the width and height according to your canvas (e.g., 1920x1080).
   - Click OK. You should now see live captions appear at the bottom of your screen as you speak!

## Project Structure

- `scripts/build-whisper.sh`: Automates cloning, model download, and Metal compilation of whisper.cpp.
- `server/index.js`: Node.js middleware that spawns the whisper stream, parses stdout, and broadcasts via WebSockets.
- `public/`: Contains the front-end overlay (`index.html`, `style.css`, `app.js`) designed for OBS.

## Troubleshooting

- **No microphone access?** Make sure your terminal or IDE has permission to access the microphone in macOS System Settings > Privacy & Security > Microphone.
- **Audio source issues?** The `stream` binary defaults to your system's default capture device (`-c 0`). If you need to change the audio source, modify the `-c` argument in `server/index.js`.