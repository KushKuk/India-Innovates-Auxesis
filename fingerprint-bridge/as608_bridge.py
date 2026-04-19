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
CMD_REG_MODEL = b'\x05'
CMD_STORE_MODEL = b'\x06'
CMD_SEARCH = b'\x04'
CMD_LOAD_CHAR = b'\x07'
CMD_UP_CHAR = b'\x08'
CMD_DOWN_CHAR = b'\x09'
CMD_GET_PARAMS = b'\x0F'
CMD_GET_COUNT = b'\x1d'

# Confirm Codes
CC_SUCCESS = 0x00
CC_ERROR = 0x01
CC_NO_FINGER = 0x02

# ─── CONFIGURATION ──────────────────────────────────────────────────────────

SERIAL_PORT = 'COM5'
BAUD_RATE = 57600
BACKEND_URL = 'http://localhost:3002/api/fingerprint/verify'
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
        print("[Sensor] Verifying connection...")
        self.ser.reset_input_buffer()
        time.sleep(0.1)
        
        # Some clones don't like CMD_HANDSHAKE (0x17). 
        # We'll use CMD_GET_PARAMS (0x0F) which is more universal.
        self._send_packet(PID_COMMAND, b'\x0F') 
        cc, _ = self._read_ack()
        
        if cc == CC_SUCCESS:
            print("[Sensor] Connection verified!")
            return True
        else:
            code_str = f"{cc:02X}" if cc is not None else "TIMEOUT"
            print(f"[Warning] Connection verification returned {code_str}, but we will try to proceed.")
            return True # Proceed anyway as long as the port is open

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

        print("[Sensor] Receiving image packets... (Expected: 36864 bytes)")
        image_data = bytearray()
        
        # 100s was way too long. 15s is more than enough even at slow baud.
        original_timeout = self.ser.timeout
        self.ser.timeout = 15.0 
        
        try:
            target_size = 36864
            last_percent = -1
            while True:
                # Read packet header + pid + len
                header = self.ser.read(9)
                if len(header) < 9: 
                    print(f"❌ Transfer Aborted: Received only {len(header)}/9 bytes for packet header.")
                    break
                
                pid = header[6:7]
                data_len = int.from_bytes(header[7:9], 'big') - 2
                
                # Read data + checksum
                chunk = self.ser.read(data_len)
                if len(chunk) < data_len:
                    print(f"❌ Transfer Aborted: Packet data incomplete.")
                    break
                
                cs = self.ser.read(2)
                image_data.extend(chunk)
                
                # Progress indicator
                percent = int((len(image_data) / target_size) * 100)
                if percent % 10 == 0 and percent != last_percent:
                    print(f"   [Progress] {percent}% received...")
                    last_percent = percent

                if pid == PID_END_DATA:
                    break
        finally:
            self.ser.timeout = original_timeout
        
        if len(image_data) > 0:
            print(f"✅ [Sensor] Successfully received {len(image_data)} bytes.")
        return image_data

    def create_model(self):
        """Merges Buffer 1 and Buffer 2 to create a template (RegModel)."""
        if self.mock_mode: return CC_SUCCESS
        # Note: Actually, standard AS608 needs two images to create a model.
        # But for simpler logic, we'll try to create it from a single scan in Buffer 1.
        self._send_packet(PID_COMMAND, CMD_REG_MODEL)
        cc, _ = self._read_ack()
        return cc

    def store_model(self, page_id):
        """Stores the template from Buffer 1 into the flash library at page_id."""
        if self.mock_mode:
            print(f"[Sensor] (MOCK) Stored finger at ID {page_id}")
            return CC_SUCCESS
        # Data: [Command (1), BufferID (1), PageID_H (1), PageID_L (1)]
        data = CMD_STORE_MODEL + b'\x01' + page_id.to_bytes(2, byteorder='big')
        self._send_packet(PID_COMMAND, data)
        cc, _ = self._read_ack()
        return cc

    def search_library(self):
        """Searches the entire flash library for a match with Buffer 1."""
        if self.mock_mode:
            import random
            # Return match at ID 1 for VOT002 simulation
            return CC_SUCCESS, 1, 100
            
        # Data: [Command(1), BufferID(1), StartPageH(1), StartPageL(1), PageNumH(1), PageNumL(1)]
        data = CMD_SEARCH + b'\x01' + (0).to_bytes(2, byteorder='big') + (162).to_bytes(2, byteorder='big')
        self._send_packet(PID_COMMAND, data)
        cc, resp = self._read_ack()
        
        if cc == CC_SUCCESS:
            page_id = int.from_bytes(resp[0:2], 'big')
            score = int.from_bytes(resp[2:4], 'big')
            return CC_SUCCESS, page_id, score
        return cc, None, 0

    def convert_image_to_char(self, buffer_id=1):
        """Converts the image in ImageBuffer to a template (character file) in CharBuffer."""
        if self.mock_mode: return CC_SUCCESS
        # Command 0x02 + BufferID
        self._send_packet(PID_COMMAND, b'\x02' + buffer_id.to_bytes(1, 'big'))
        cc, _ = self._read_ack()
        return cc
        
    def get_library_count(self):
        """Returns the number of templates currently stored in the flash library."""
        if self.mock_mode: return 0
        self._send_packet(PID_COMMAND, CMD_GET_COUNT)
        cc, resp = self._read_ack()
        if cc == CC_SUCCESS:
            return int.from_bytes(resp[0:2], 'big')
        return 0

    def get_next_free_slot(self):
        """Finds the next available slot in the flash library (1-162)."""
        count = self.get_library_count()
        if count >= 162:
            print("[Warning] Sensor library is FULL (162 templates).")
            return 1 # Fallback to overwrite slot 1
        return count + 1

    def download_template(self, buffer_id=1):
        """Downloads the 512-byte template from the sensor's CharBuffer to the host."""
        if self.mock_mode:
            return os.urandom(512)
            
        self._send_packet(PID_COMMAND, CMD_UP_CHAR + buffer_id.to_bytes(1, 'big'))
        cc, _ = self._read_ack()
        if cc != CC_SUCCESS:
            print(f"❌ UP_CHAR failed with CC: {cc}")
            return None

        template = bytearray()
        # Template is exactly 512 bytes, sent in packets (usually 2 packets of 256 bytes)
        while len(template) < 512:
            header = self.ser.read(9)
            if len(header) < 9: break
            
            p_len = int.from_bytes(header[7:9], 'big') - 2
            chunk = self.ser.read(p_len)
            cs = self.ser.read(2)
            template.extend(chunk)
            
            if header[6:7] == PID_END_DATA:
                break
        
        print(f"✅ Downloaded {len(template)} byte hardware template.")
        return bytes(template)

    def upload_template(self, template_data, buffer_id=1):
        """Uploads a 512-byte template from the host to the sensor's CharBuffer."""
        if self.mock_mode or not template_data: return CC_SUCCESS
        
        if len(template_data) != 512:
            print(f"❌ Invalid template size: {len(template_data)}")
            return CC_ERROR
            
        self._send_packet(PID_COMMAND, CMD_DOWN_CHAR + buffer_id.to_bytes(1, 'big'))
        cc, _ = self._read_ack()
        if cc != CC_SUCCESS: return cc

        # Send in two 256-byte packets
        for i in range(2):
            chunk = template_data[i*256 : (i+1)*256]
            pid = PID_DATA if i == 0 else PID_END_DATA
            self._send_packet(pid, chunk)
            
        return CC_SUCCESS

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

    # Expand 4-bit pixels to 8-bit grayscale and enhance contrast
    pixels = []
    total_val = 0
    for b in raw_data:
        p1 = (b >> 4) & 0x0F
        p2 = b & 0x0F
        # Standard scaling (0=black, 15=white)
        # Note: Some sensors are inverted, we'll use ImageOps.autocontrast to handle both
        v1 = p1 * 17
        v2 = p2 * 17
        pixels.append(v1) 
        pixels.append(v2)
        total_val += (v1 + v2)
    
    avg_brightness = total_val / (len(raw_data) * 2)
    print(f"[Debug] Average image brightness: {avg_brightness:.1f}/255")

    img = Image.new('L', (256, 288))
    img.putdata(pixels)
    
    # Apply a slight contrast boost using Pillow's built-in tools
    from PIL import ImageOps
    img = ImageOps.autocontrast(img)
    
    # Save to buffer
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return buf.getvalue()

# ─── BACKEND CLIENT ──────────────────────────────────────────────────────────

def verify_voter(image_bytes, voter_id, session_id, matched_page_id=None):
    if requests is None:
        return {"matched": True, "score": 90.0} # Mock success

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
        if matched_page_id is not None:
            data['matchedPageId'] = str(matched_page_id)
            
        resp = requests.post(BACKEND_URL, files=files, data=data)
        return resp.json()
    except Exception as e:
        print(f"[API] Connection error: {e}")
        return {"error": str(e)}

def enroll_voter(image_bytes, voter_id, hardware_index=None, hardware_template_b64=None):
    print(f"[API] Sending ENROLLMENT request for {voter_id}...")
    try:
        files = {
            'file': ('fingerprint.png', image_bytes, 'image/png')
        }
        data = {
            'voterId': voter_id,
            'fingerLabel': FINGER_LABEL
        }
        if hardware_index is not None:
            data['imageRef'] = f"hw:{hardware_index}"
        if hardware_template_b64 is not None:
            data['hardwareTemplate'] = hardware_template_b64
            
        resp = requests.post(BACKEND_URL.replace('verify', 'enroll'), files=files, data=data)
        return resp.json()
    except Exception as e:
        print(f"[API] Connection error: {e}")
        return {"error": str(e)}

from http.server import BaseHTTPRequestHandler, HTTPServer
import threading

sensor_lock = threading.Lock()
removal_thread_active = threading.Event()  # signals when a removal thread is running

class FingerprintRequestHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200, "ok")
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        if self.path == '/scan':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            payload = json.loads(post_data.decode('utf-8'))
            
            voter_id = payload.get('voterId')
            mode = payload.get('mode', 'verify').lower()
            
            print(f"\n[API] Received Scan Request from UI for Voter: {voter_id} (Mode: {mode})")
            
            # Send HTTP headers immediately
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            global global_sensor
            if global_sensor is None:
                self.wfile.write(json.dumps({"error": "SENSOR_DISCONNECTED", "message": "Failed UART connect"}).encode())
                return
            sensor = global_sensor

            # Stop any background removal thread before we take the lock
            removal_thread_active.clear()
            
            # Acquire exclusive access to the sensor
            sensor_lock.acquire()
            try:
                # Flush any stale data sitting in the serial buffer
                if sensor.ser and not sensor.mock_mode:
                    sensor.ser.reset_input_buffer()
                    sensor.ser.reset_output_buffer()
                    time.sleep(0.1)
                
                print("[Status] Hardware Triggered! Waiting for finger...")
                    
                # Wait for finger (15 sec timeout)
                timeout = 30
                cc = CC_NO_FINGER
                while timeout > 0:
                    cc = sensor.capture_image()
                    if cc == CC_SUCCESS:
                        break
                    time.sleep(0.5)
                    timeout -= 1
                    
                if cc != CC_SUCCESS:
                    print("❌ Scan Timeout")
                    self.wfile.write(json.dumps({"error": "TIMEOUT", "message": "Finger not placed in time."}).encode())
                    return
                    
                print("\n[Match] Finger detected! Capturing...")
                raw = sensor.upload_image()
                if not raw:
                    self.wfile.write(json.dumps({"error": "HARDWARE_CAPTURE_FAIL", "message": "Timeout uploading image to host."}).encode())
                    return
                    
                png = raw_to_png(raw)
                if not png:
                    self.wfile.write(json.dumps({"error": "IMAGE_CORRUPT", "message": "PNG compression failed."}).encode())
                    return
                    
                with open("last_scan.png", "wb") as f:
                    f.write(png)
                    
                if mode == 'enroll':
                    # Native Enrollment Flow (Two Scans Required for Stability)
                    print("[Hardware] --- Scan 1: Place finger ---")
                    sensor.convert_image_to_char(1)
                    
                    print("[Hardware] Remove finger and place again for Scan 2...")
                    # Wait for removal
                    while sensor.capture_image() != CC_NO_FINGER:
                        time.sleep(0.1)
                    time.sleep(0.5)
                    
                    # Wait for second touch
                    timeout = 30
                    while timeout > 0:
                        if sensor.capture_image() == CC_SUCCESS:
                            break
                        time.sleep(0.5)
                        timeout -= 1
                    
                    print("[Hardware] --- Scan 2: Capturing... ---")
                    sensor.convert_image_to_char(2)
                    
                    print("[Hardware] Merging scans into Master Template...")
                    cc_reg = sensor.create_model()
                    if cc_reg != CC_SUCCESS:
                        print(f"❌ Failed to merge templates (CC: {cc_reg})")
                        self.wfile.write(json.dumps({"error": "MERGE_FAIL", "message": "Could not create stable template."}).encode())
                        return
                    
                    slot_id = sensor.get_next_free_slot()
                    print(f"[Hardware] Storing in Sensor Slot #{slot_id}...")
                    sensor.store_model(slot_id)
                    
                    # --- NEW: Download the 512-byte template for Cloud Storage ---
                    print("[Hardware] Extracting 512-byte template from sensor...")
                    hw_template = sensor.download_template(1)
                    hw_template_b64 = None
                    if hw_template:
                        import base64
                        hw_template_b64 = base64.b64encode(hw_template).decode('utf-8')
                    
                    result = enroll_voter(png, voter_id, hardware_index=slot_id, hardware_template_b64=hw_template_b64)
                else:
                    # Native Verification Flow
                    print("[Hardware] Performing Native Search...")
                    sensor.convert_image_to_char(1)
                    cc_search, page_id, hw_score = sensor.search_library()
                    
                    if cc_search == CC_SUCCESS:
                        print(f"🎯 [Hardware] Found Match in Slot #{page_id} (Score: {hw_score})")
                        result = verify_voter(png, voter_id, f"ser-{int(time.time())}", matched_page_id=page_id)
                    else:
                        print("ℹ️ [Hardware] No match found in internal library. Falling back to software matcher.")
                        result = verify_voter(png, voter_id, f"ser-{int(time.time())}")
                
                # Send JSON result
                self.wfile.write(json.dumps(result).encode())
                
                print("\n" + "-"*30)
                if result.get('matched') or result.get('success'):
                    score = result.get('score', result.get('qualityScore', 'N/A'))
                    # If it was a hardware match, report the high score
                    if result.get('message') == "Hardware Identity Verified":
                        print(f"🚀 [Verified] Hardware ID Match confirmed by Backend!")
                    else:
                        print(f"✅ MATCH FOUND! (Confidence/Quality: {score})")
                else:
                    reason = result.get('failureReason', result.get('message', 'No Match'))
                    score = result.get('score', 0)
                    print(f"❌ NO MATCH. Reason: {reason} (Score: {score})")
                print("-" * 30 + "\n")
            finally:
                sensor_lock.release()
            
            # Background thread for finger removal (non-blocking)
            removal_thread_active.set()
            def wait_for_removal(s, flag):
                with sensor_lock:
                    while flag.is_set():
                        if s.capture_image() == CC_NO_FINGER:
                            break
                        time.sleep(0.5)
                if flag.is_set():
                    print("[Status] Sensor idle. Ready for next command.")
            
            threading.Thread(target=wait_for_removal, args=(sensor, removal_thread_active), daemon=True).start()

global_sensor = None

def main():
    global global_sensor
    print("\n" + "="*50)
    print(" FINGERPRINT BRIDGE AUTO-API (PORT 8001)")
    print("="*50)
    
    global_sensor = AS608Sensor()
    if not global_sensor.connect():
        print("[Critical] Ensure the sensor is connected and try restarting.")
        global_sensor = None
        return
        
    global_sensor.handshake()

    print("Listening for UI commands...")
    
    server_address = ('', 8001)
    httpd = HTTPServer(server_address, FingerprintRequestHandler)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    print("\nBridge offline.")

if __name__ == "__main__":
    main()

