import serial
import sqlite3
import time
import os

# ─── AS608 CONSTANTS ─────────────────────────────────────────────────────────

HEADER = b'\xef\x01'
ADDR = b'\xff\xff\xff\xff'

PID_COMMAND = b'\x01'
PID_DATA = b'\x02'
PID_ACK = b'\x07'
PID_END_DATA = b'\x08'

CMD_GET_IMAGE = b'\x01'
CMD_IMG_2_TZ = b'\x02'
CMD_MATCH = b'\x03'
CMD_SEARCH = b'\x04'
CMD_UP_CHAR = b'\x08'
CMD_DOWN_CHAR = b'\x09'
CMD_HANDSHAKE = b'\x17'

CC_SUCCESS = 0x00
CC_NO_FINGER = 0x02

# ─── CONFIGURATION ──────────────────────────────────────────────────────────

SERIAL_PORT = 'COM3'
BAUD_RATE = 57600
DB_FILE = 'standalone.db'

# ─── DATABASE LAYER ─────────────────────────────────────────────────────────

def init_db():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS templates 
                 (voter_id TEXT PRIMARY KEY, name TEXT, template BLOB)''')
    conn.commit()
    conn.close()

def save_template(voter_id, name, template_blob):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("INSERT OR REPLACE INTO templates VALUES (?, ?, ?)", 
              (voter_id, name, template_blob))
    conn.commit()
    conn.close()

def get_all_templates():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("SELECT voter_id, name, template FROM templates")
    rows = c.fetchall()
    conn.close()
    return rows

# ─── AS608 SENSOR CLASS ──────────────────────────────────────────────────────

class AS608Sensor:
    def __init__(self, port=SERIAL_PORT, baud=BAUD_RATE):
        self.ser = serial.Serial(port, baud, timeout=2)
        print(f"[Sensor] Standalone Connected to {port}")

    def _send(self, pid, data):
        length = len(data) + 2
        cs_sum = int.from_bytes(pid, 'big') + length + sum(data)
        packet = HEADER + ADDR + pid + length.to_bytes(2, 'big') + data + (cs_sum & 0xFFFF).to_bytes(2, 'big')
        self.ser.write(packet)

    def _read_ack(self):
        resp = self.ser.read(9)
        if len(resp) < 9: return None, None
        length = int.from_bytes(resp[7:9], 'big') - 2
        data = self.ser.read(length)
        self.ser.read(2) # Checksum
        return data[0], data[1:]

    def capture(self):
        self._send(PID_COMMAND, CMD_GET_IMAGE)
        cc, _ = self._read_ack()
        return cc == CC_SUCCESS

    def generate_tz(self, slot=1):
        self._send(PID_COMMAND, CMD_IMG_2_TZ + slot.to_bytes(1, 'big'))
        cc, _ = self._read_ack()
        return cc == CC_SUCCESS

    def upload_template(self, slot=1):
        """Asks the sensor to send the template (character file) to the computer."""
        self._send(PID_COMMAND, CMD_UP_CHAR + slot.to_bytes(1, 'big'))
        cc, _ = self._read_ack()
        if cc != CC_SUCCESS: return None

        # Template for AS608 is 512 bytes (usually 4 data packets of 128 bytes)
        template = bytearray()
        while True:
            header = self.ser.read(9)
            if len(header) < 9: break
            pid = header[6:7]
            data_len = int.from_bytes(header[7:9], 'big') - 2
            chunk = self.ser.read(data_len)
            self.ser.read(2) # Checksum
            template.extend(chunk)
            if pid == PID_END_DATA: break
        return template

    def download_template(self, template_blob, slot=2):
        """Sends a stored template back to the sensor for matching."""
        self._send(PID_COMMAND, CMD_DOWN_CHAR + slot.to_bytes(1, 'big'))
        cc, _ = self._read_ack()
        if cc != CC_SUCCESS: return False

        # Send in packets of 128 bytes
        for i in range(0, len(template_blob), 128):
            chunk = template_blob[i:i+128]
            pid = PID_END_DATA if i + 128 >= len(template_blob) else PID_DATA
            self._send(pid, chunk)
        return True

    def match(self):
        """Compares template in slot 1 and slot 2."""
        self._send(PID_COMMAND, CMD_MATCH)
        cc, data = self._read_ack()
        if cc == CC_SUCCESS:
            score = int.from_bytes(data[0:2], 'big')
            return score
        return 0

# ─── APP LOGIC ───────────────────────────────────────────────────────────────

def enroll():
    print("\n--- ENROLLMENT MODE ---")
    voter_id = input("Enter Voter ID: ")
    name = input("Enter Name: ")
    sensor = AS608Sensor()

    print("Place your finger...")
    while not sensor.capture(): time.sleep(0.5)
    
    if sensor.generate_tz(1):
        template = sensor.upload_template(1)
        if template:
            save_template(voter_id, name, template)
            print(f"✅ Successfully enrolled {name} (Template size: {len(template)} bytes)")
        else:
            print("❌ Failed to read template from sensor.")
    else:
        print("❌ Failed to process finger image.")

def verify():
    print("\n--- VERIFICATION MODE ---")
    sensor = AS608Sensor()
    templates = get_all_templates()
    if not templates:
        print("No templates found in database. Enroll someone first!")
        return

    print("Place finger to verify...")
    while not sensor.capture(): time.sleep(0.5)
    
    if not sensor.generate_tz(1):
        print("❌ Failed to process finger.")
        return

    print("Searching local database...")
    for t_id, t_name, t_blob in templates:
        # Send the stored template to sensor's slot 2
        if sensor.download_template(t_blob, 2):
            score = sensor.match()
            if score > 50: # Standard threshold
                print(f"✅ MATCH FOUND: {t_name} ({t_id}) | Score: {score}")
                return
    
    print("❌ NO MATCH FOUND in database.")

def main():
    init_db()
    while True:
        print("\n=== AS608 STANDALONE SYSTEM ===")
        print("1. Enroll New Fingerprint")
        print("2. Verify Live Fingerprint")
        print("3. Exit")
        choice = input("Choice: ")
        
        if choice == '1': enroll()
        elif choice == '2': verify()
        elif choice == '3': break

if __name__ == "__main__":
    main()
