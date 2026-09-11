#!/bin/bash
set -e

# Directory where we want to store whisper.cpp
WHISPER_DIR="./whisper.cpp"

# Check if whisper.cpp directory exists
if [ ! -d "$WHISPER_DIR" ]; then
    echo "Cloning whisper.cpp repository..."
    git clone https://github.com/ggerganov/whisper.cpp.git "$WHISPER_DIR"
else
    echo "whisper.cpp directory already exists. Pulling latest changes..."
    cd "$WHISPER_DIR"
    git pull
    cd ..
fi

cd "$WHISPER_DIR"

echo "Downloading ggml-base.en.bin model..."
bash ./models/download-ggml-model.sh base.en

echo "Building whisper.cpp with Metal support..."
make clean
WHISPER_METAL=1 make stream

echo "Build complete! The 'stream' binary is ready at whisper.cpp/stream"
