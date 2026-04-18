#!/bin/bash

echo "--- Raspberry Pi 5 Face Bridge Setup ---"

# 1. System Dependencies
echo "Installing system dependencies..."
sudo apt-get update
sudo apt-get install -y \
    python3-pip \
    python3-venv \
    libatlas-base-dev \
    libopencv-dev \
    libv4l-dev \
    libjpeg-dev \
    libpng-dev

# 2. Create Python Virtual Environment
echo "Setting up virtual environment..."
cd "$(dirname "$0")"
python3 -m venv venv
source venv/bin/activate

# 3. Install Python Dependencies
echo "Installing Python packages (this may take a few minutes)..."
pip install --upgrade pip
pip install -r requirements.txt

# 4. Thermal Monitoring Setup
echo "Checking thermal configuration..."
if [ -f "/sys/class/thermal/thermal_zone0/temp" ]; then
    echo "✓ Thermal monitoring available."
else
    echo "⚠ Warning: Thermal monitoring not standard on this OS."
fi

echo "--- Setup Complete ---"
echo "To start the face bridge, run:"
echo "source venv/bin/activate && python main.py"
