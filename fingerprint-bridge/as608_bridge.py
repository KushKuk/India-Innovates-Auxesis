try:
    import serial
except ImportError:
    serial = None

import time

try:
    import requests
except ImportError:
    requests = None

import os
import json

try:
    from PIL import Image
except ImportError:
    Image = None

import io

# ─── AS608 CONSTANTS ─────────────────────────────────────────────────────────

HEADER = b'\xef\x01'
ADDR = b'\xff\xff\xff\xff'

# PID (Package Identifier)
PID_COMMAND = b'\x01'
PID_DATA = b'\x02'
PID_ACK = b'\x07'
PID_END_DATA = b'\x08'

# Commands
CMD_GET_IMAGE = b'\x01'
CMD_UP_IMAGE = b'\x0a'
CMD_HANDSHAKE = b'\x17'

# Confirm Codes
CC_SUCCESS = 0x00
CC_ERROR = 0x01
CC_NO_FINGER = 0x02

# ─── CONFIGURATION ──────────────────────────────────────────────────────────

SERIAL_PORT = 'COM3'
BAUD_RATE = 57600
BACKEND_URL = 'http://localhost:3000/api/fingerprint/verify'
FINGER_LABEL = 'RIGHT_INDEX'
MOCK_MODE = os.getenv('MOCK_MODE', 'False').lower() == 'true'

# ─── AS608 PROTOCOL ──────────────────────────────────────────────────────────

class AS608Sensor:
    def __init__(self, port=SERIAL_PORT, baud=BAUD_RATE, timeout=2, mock_mode=MOCK_MODE):
        self.port = port
        self.baud = baud
        self.timeout = timeout
        self.ser = None
        self.mock_mode = mock_mode

    def connect(self):
        if self.mock_mode:
            print(f"[Sensor] (MOCK) Mock sensor connected.")
            return True
        try:
            self.ser = serial.Serial(self.port, self.baud, timeout=self.timeout)
            print(f"[Sensor] Connected to {self.port} at {self.baud} baud.")
            return True
        except Exception as e:
            print(f"[Sensor] Connection failed: {e}")
            return False

    def _send_packet(self, pid, data):
        if self.mock_mode: return
        length = len(data) + 2
        length_bytes = length.to_bytes(2, byteorder='big')
        
        # Calculate checksum: PID + Length + Data
        cs_sum = int.from_bytes(pid, 'big') + length + sum(data)
        checksum = (cs_sum & 0xFFFF).to_bytes(2, byteorder='big')
        
        packet = HEADER + ADDR + pid + length_bytes + data + checksum
        self.ser.write(packet)

    def _read_ack(self):
        if self.mock_mode: return CC_SUCCESS, b''
        # Read header (2) + addr (4) + pid (1) + len (2)
        resp = self.ser.read(9)
        if len(resp) < 9: return None, None
        
        pid = resp[6:7]
        length = int.from_bytes(resp[7:9], 'big')
        
        data_len = length - 2
        data = self.ser.read(data_len)
        checksum = self.ser.read(2)
        
        if pid == PID_ACK:
            return data[0], data[1:]
        return None, None

    def handshake(self):
        if self.mock_mode: return True
        print("[Sensor] Performing handshake...")
        self._send_packet(PID_COMMAND, CMD_HANDSHAKE + b'\x00')
        cc, _ = self._read_ack()
        return cc == CC_SUCCESS

    def capture_image(self):
        """Triggers the sensor to capture a finger image into its buffer."""
        if self.mock_mode:
            import random
            time.sleep(1) # Simulate scan time
            return CC_SUCCESS if random.random() > 0.1 else CC_NO_FINGER
        self._send_packet(PID_COMMAND, CMD_GET_IMAGE)
        cc, _ = self._read_ack()
        return cc

    def upload_image(self):
        """Triggers the sensor to upload the image buffer to the host."""
        if self.mock_mode:
            print("[Sensor] (MOCK) Generating fake fingerprint image...")
            import os
            # Generates a random grayscale noise pattern
            return os.urandom(36864)

        self._send_packet(PID_COMMAND, CMD_UP_IMAGE)
        cc, _ = self._read_ack()
        if cc != CC_SUCCESS:
            return None

        print("[Sensor] Receiving image packets...")
        image_data = bytearray()
        
        while True:
            # Read packet header + pid + len
            header = self.ser.read(9)
            if len(header) < 9: break
            
            pid = header[6:7]
            data_len = int.from_bytes(header[7:9], 'big') - 2
            
            # Read data + checksum
            chunk = self.ser.read(data_len)
            cs = self.ser.read(2)
            
            image_data.extend(chunk)
            
            if pid == PID_END_DATA:
                break
        
        print(f"[Sensor] Received {len(image_data)} bytes of raw image data.")
        return image_data

# ─── IMAGE PROCESSING ────────────────────────────────────────────────────────

def raw_to_png(raw_data):
    """
    AS608 sends 36,864 bytes for a 256x288 image.
    Each byte contains TWO pixels (4 bits each, 16 grayscale levels).
    """
    if Image is None:
        print("[Mock] Pillow not installed. Skipping PNG conversion.")
        return b"fake-png-data"

    if len(raw_data) < 36864:
        print("[Error] Incomplete image data received.")
        return None

    # Expand 4-bit pixels to 8-bit grayscale
    pixels = []
    for b in raw_data:
        # High nibble (Pixel 1)
        p1 = (b >> 4) & 0x0F
        pixels.append(p1 * 17) # Scale 0-15 to 0-255
        # Low nibble (Pixel 2)
        p2 = b & 0x0F
        pixels.append(p2 * 17)

    img = Image.new('L', (256, 288))
    img.putdata(pixels)
    
    # Save to buffer
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return buf.getvalue()

# ─── BACKEND CLIENT ──────────────────────────────────────────────────────────

def verify_voter(image_bytes, voter_id, session_id):
    if requests is None:
        print(f"[Mock] Requests not installed. Simulated API call for {voter_id}...")
        # Simulate a successful match if voter_id is Rishit's real ID
        is_match = voter_id.upper() in ["VOT011", "VOT001"]
        return {"matched": is_match, "score": 85.0 if is_match else 0, "failureReason": None if is_match else "No match"}

    print(f"[API] Sending verification request for {voter_id}...")
    try:
        files = {
            'file': ('fingerprint.png', image_bytes, 'image/png')
        }
        data = {
            'voterId': voter_id,
            'fingerLabel': FINGER_LABEL,
            'sessionId': session_id
        }
        resp = requests.post(BACKEND_URL, files=files, data=data)
        return resp.json()
    except Exception as e:
        print(f"[API] Connection error: {e}")
        return {"error": str(e)}

# ─── MAIN LOOP ───────────────────────────────────────────────────────────────

def main():
    sensor = AS608Sensor()
    if not sensor.connect():
        print("[Critical] Ensure the sensor is connected to COM3 and try again.")
        return

    if not sensor.handshake():
        print("[Warning] Handshake failed, but continuing anyway...")

    print("\n" + "="*40)
    print(" FINGERPRINT BRIDGE ACTIVE")
    print("="*40)
    print("Waiting for finger...")

    voter_id = input("\nEnter Voter ID to verify (e.g., VOT011): ").strip()
    if not voter_id: return

    try:
        while True:
            cc = sensor.capture_image()
            if cc == CC_SUCCESS:
                print("[Match] Finger detected! Capturing...")
                raw = sensor.upload_image()
                if raw:
                    png = raw_to_png(raw)
                    if png:
                        # Save local copy for debugging
                        with open("last_scan.png", "wb") as f:
                            f.write(png)
                        
                        # Verify with backend
                        result = verify_voter(png, voter_id, f"ser-{int(time.time())}")
                        print("\n" + "-"*20)
                        if result.get('matched'):
                            print(f"✅ MATCH FOUND! Score: {result.get('score')}")
                        else:
                            print(f"❌ NO MATCH. Reason: {result.get('failureReason', result.get('message', 'Unknown'))}")
                        print("-"*20 + "\n")
                    
                print("\nWaiting for next finger...")
                time.sleep(2)
            elif cc == CC_ERROR:
                print("[Error] Sensor capture error.")
                time.sleep(1)
            
            # Poll every 200ms
            time.sleep(0.2)

    except KeyboardInterrupt:
        print("\nStopping bridge...")

if __name__ == "__main__":
    main()
