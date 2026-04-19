"""
Fingerprint Enrollment Script
Usage: python enroll.py VOT002
"""

import sys
import time
import os

# Import everything from the bridge
sys.path.insert(0, os.path.dirname(__file__))
from as608_bridge import AS608Sensor, raw_to_png, enroll_voter, CC_SUCCESS, CC_NO_FINGER

def main():
    if len(sys.argv) < 2:
        print("Usage: python enroll.py <VOTER_ID>")
        print("Example: python enroll.py VOT002")
        return

    voter_id = sys.argv[1].strip()
    
    print("\n" + "="*50)
    print(f"  FINGERPRINT ENROLLMENT FOR: {voter_id}")
    print("="*50)
    
    sensor = AS608Sensor()
    if not sensor.connect():
        print("[Critical] Sensor not found. Check USB connection.")
        return
    
    sensor.handshake()
    
    print(f"\nPlace {voter_id}'s finger on the scanner now...")
    print("(You have 30 seconds)\n")
    
    # Wait for finger
    timeout = 60  # 30 seconds
    while timeout > 0:
        cc = sensor.capture_image()
        if cc == CC_SUCCESS:
            break
        time.sleep(0.5)
        timeout -= 1
    
    if cc != CC_SUCCESS:
        print("❌ Timeout. No finger detected.")
        return
    
    print("✅ Scan 1 Successful! Converting...")
    sensor.convert_image_to_char(1)

    print("\n[Action] Please REMOVE your finger...")
    while sensor.capture_image() != CC_NO_FINGER:
        time.sleep(0.1)
    time.sleep(1.0)

    print("[Action] Now place the SAME finger again for Scan 2...")
    timeout = 60
    while timeout > 0:
        if sensor.capture_image() == CC_SUCCESS:
            break
        time.sleep(0.5)
        timeout -= 1
    
    if timeout <= 0:
        print("❌ Timeout waiting for second scan.")
        return

    print("✅ Scan 2 Successful! Converting...")
    raw = sensor.upload_image() # Capture the image for the PNG copy
    sensor.convert_image_to_char(2)

    print("\n[Hardware] Merging scans into Master Template...")
    cc_reg = sensor.create_model()
    if cc_reg != CC_SUCCESS:
        print(f"❌ Failed to merge scans (CC: {cc_reg})")
        return

    slot_id = sensor.get_next_free_slot()
    print(f"[Hardware] Storing in Sensor Slot: #{slot_id}")
    sensor.store_model(slot_id)

    png = raw_to_png(raw)
    if png:
        with open(f"enrolled_{voter_id}.png", "wb") as f:
            f.write(png)
    
    print(f"\n[Hardware] Extracting 512-byte template for Cloud Storage...")
    hw_template = sensor.download_template(1)
    hw_template_b64 = None
    if hw_template:
        import base64
        hw_template_b64 = base64.b64encode(hw_template).decode('utf-8')

    print(f"\n[API] Linking hardware mapping for {voter_id}...")
    result = enroll_voter(png, voter_id, hardware_index=slot_id, hardware_template_b64=hw_template_b64)
    
    print("\n" + "-"*40)
    if result.get('success'):
        print(f"✅ ENROLLMENT SUCCESSFUL!")
        print(f"   Stored in Sensor Slot: #{slot_id}")
        print(f"   Template ID: {result.get('templateId')}")
    else:
        reason = result.get('failureReason', result.get('message', result.get('error', 'Unknown')))
        print(f"❌ ENROLLMENT FAILED: {reason}")
    print("-"*40)
    
    # Wait for finger removal
    print("\nPlease remove finger...")
    while sensor.capture_image() != CC_NO_FINGER:
        time.sleep(0.5)
    print("Done!\n")

if __name__ == "__main__":
    main()
