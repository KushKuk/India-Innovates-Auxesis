import unittest
from unittest.mock import MagicMock, patch
import io
import os
from as608_bridge import raw_to_png, AS608Sensor, PID_ACK, CC_SUCCESS

class TestFingerprintBridge(unittest.TestCase):

    def test_raw_to_png_conversion(self):
        # Create dummy raw data (36,864 bytes)
        # Each byte represents 2 pixels. 0x0F = white, 0x00 = black.
        dummy_raw = bytearray([0x0F] * 36864) 
        
        png_data = raw_to_png(dummy_raw)
        self.assertIsNotNone(png_data)
        self.assertTrue(len(png_data) > 0)
        
        # Verify it can be opened as an image
        from PIL import Image
        img = Image.open(io.BytesIO(png_data))
        self.assertEqual(img.size, (256, 288))
        self.assertEqual(img.mode, 'L')

    @patch('serial.Serial')
    def test_sensor_connection(self, mock_serial):
        sensor = AS608Sensor(port='MOCK_PORT')
        success = sensor.connect()
        self.assertTrue(success)
        mock_serial.assert_called_with('MOCK_PORT', 57600, timeout=2)

    def test_ack_parsing(self):
        # Mock serial response for a success ACK
        # Header(2) + Addr(4) + PID(1) + Len(2) + CC(1) + CS(2)
        # EF 01  FF FF FF FF  07  00 03  00  00 0A
        mock_ser = MagicMock()
        mock_ser.read.side_effect = [
            b'\xef\x01\xff\xff\xff\xff\x07\x00\x03', # Header to Length
            b'\x00', # Confirm Code (CC_SUCCESS)
            b'\x00\x0a' # Checksum
        ]
        
        sensor = AS608Sensor()
        sensor.ser = mock_ser
        
        cc, data = sensor._read_ack()
        self.assertEqual(cc, CC_SUCCESS)
        self.assertEqual(data, b'')

if __name__ == '__main__':
    print("Running minimal project tests...")
    unittest.main()
