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

## 🚀 Usage

### 1. Start the Background Server
```bash
npm start
```
This spawns the background Metal-accelerated AI process and opens a WebSocket server on `ws://localhost:3000`. You can configure your microphone directly from the test page!

---

### 2. Connect Your Display 📺

You have a few ways to view your live captions. 

<details open>
<summary><b><span style="font-size: 1.2em">🏠 Local Testing (Recommended)</span></b></summary>
<br/>
Open the local test page to see a live preview, change subtitle colors, and select your hardware microphone!
<br/><br/>
👉 <a href="file:///Users/rifaterdemsahin/projects/mac-whisper-captions/test.html"><b><code>file:///Users/rifaterdemsahin/projects/mac-whisper-captions/test.html</code></b></a>
</details>

<details open>
<summary><b><span style="font-size: 1.2em">🎥 OBS Studio Overlay</span></b></summary>
<br/>
To add the captions to your stream, you need the clean overlay without the menus.
<br/><br/>
1. In OBS, add a new <b>Browser Source</b>.<br/>
2. Check the box for <b>"Local file"</b>.<br/>
3. Browse to and select this file on your Mac:
<br/><br/>
🎯 <b><code>/Users/rifaterdemsahin/projects/mac-whisper-captions/public/index.html</code></b>
<br/><br/>
*(Set the width/height to your canvas size, e.g., 1920x1080. The background is completely transparent!)*
</details>

<details open>
<summary><b><span style="font-size: 1.2em">🌐 GitHub Pages (Project Home)</span></b></summary>
<br/>
The main informational page is ready to be hosted on GitHub Pages so others can find your project!
<br/><br/>
🌍 <a href="https://rifaterdemsahin.github.io/mac-whisper-captions/"><b><code>https://rifaterdemsahin.github.io/mac-whisper-captions/</code></b></a>
<br/><br/>
*(⚠️ Note: Since GitHub Pages uses HTTPS, browsers may block connections to your local `ws://localhost:3000` stream due to "mixed content" rules. Always use the local files for broadcasting!)*
</details>

---

## Project Structure

- `scripts/build-whisper.sh`: Automates cloning, model download, and Metal compilation of whisper.cpp.
- `server/index.js`: Node.js middleware that spawns the whisper stream, parses stdout, and broadcasts via WebSockets.
- `public/`: Contains the front-end overlay (`index.html`, `style.css`, `app.js`) designed for OBS.

## Troubleshooting

- **No microphone access?** Make sure your terminal or IDE has permission to access the microphone in macOS System Settings > Privacy & Security > Microphone.
- **Audio source issues?** The `stream` binary defaults to your system's default capture device (`-c 0`). If you need to change the audio source, modify the `-c` argument in `server/index.js`.