# AS608 Fingerprint Bridge Setup Guide

This guide explains how to install and run the Python bridge to connect your **AS608 Fingerprint Sensor** to the voting backend.

## 1. Installation

First, ensure you have Python installed. Then, install the required libraries:

```bash
cd fingerprint-bridge
pip install -r requirements.txt
```

## 2. Configuration

Open `as608_bridge.py` and check the following constants at the top:

- `SERIAL_PORT`: Set this to `COM3` (or whatever port your sensor is plugged into).
- `BAUD_RATE`: Default is `57600` for most AS608 sensors.
- `BACKEND_URL`: Ensure this matches your running NestJS server (default `http://localhost:3000/api/fingerprint/verify`).

## 3. Running the Bridge

Once configured, start the bridge:

```bash
python as608_bridge.py
```

1. The script will ask for a **Voter ID** (e.g., `VOT011` for Rishit).
2. It will start polling the sensor.
3. Place a finger on the sensor.
4. The script will capture the image, convert it to PNG, and send it to the backend for verification.

---

## Technical FAO (For your Hardware friend)

### Where to plug in vendor-specific command bytes?
The hex commands are located at the top of `as608_bridge.py` in the **CONSTANTS** section:
```python
CMD_GET_IMAGE = b'\x01'  # Change this if your sensor uses a different code for GenImg
CMD_UP_IMAGE = b'\x0a'   # Change this for UpImage
CMD_HANDSHAKE = b'\x17'
```

### How to expose this as a FastAPI endpoint?
To turn this into a web service later, you can use this structure:

```python
from fastapi import FastAPI
from as608_bridge import AS608Sensor, raw_to_png

app = FastAPI()
sensor = AS608Sensor(port="COM3")
sensor.connect()

@app.post("/verify-finger/{voter_id}")
async def verify_finger(voter_id: str):
    sensor.capture_image()
    raw = sensor.upload_image()
    png = raw_to_png(raw)
    # Now call backend or return PNG
    return {"status": "captured", "voterId": voter_id}
```

---

## Troubleshooting
- **ModuleNotFoundError: No module named 'serial'**: Run `pip install pyserial`.
- **Sensor Connection Failed**: Check if the TX/RX wires are swapped. TX on sensor goes to RX on your USB-Serial adapter.
