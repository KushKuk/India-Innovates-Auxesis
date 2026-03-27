import { Controller, Post, Body, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { VerificationService } from './verification.service';
import { DigitalVerifyDto, FaceMatchDto, ManualVerifyDto, ScanQrDto } from './dto/verification.dto';

@ApiTags('Verification')
@Controller('verification')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Get('ping')
  async ping() {
    return { status: 'ok', message: 'Verification controller is alive' };
  }

  @Post('digital')
  @ApiOperation({ summary: 'Run digital verification (ID + biometric) and generate token' })
  async digitalVerify(@Body() dto: DigitalVerifyDto) {
    return this.verificationService.digitalVerify(dto.voterId, dto.idType, dto.idNumber);
  }

  @Post('manual')
  @ApiOperation({ summary: 'Run manual verification (supervisor-approved) and generate token' })
  async manualVerify(@Body() dto: ManualVerifyDto) {
    return this.verificationService.manualVerify(
      dto.voterId,
      dto.idType,
      dto.idNumber,
      dto.reason,
      dto.officerId,
    );
  }

  @Post('face-match')
  @ApiOperation({ summary: 'Run facial matching verification' })
  async faceMatch(@Body() dto: FaceMatchDto) {
    console.log(`[TRACE] Controller: face-match received for ${dto.voterId}`);
    return this.verificationService.faceMatch(dto.voterId, dto.liveImage);
  }

  @Post('scan-qr')
  @ApiOperation({ summary: 'Identify user by scanning Base64 QR code' })
  async scanQr(@Body() dto: ScanQrDto) {
    return this.verificationService.scanQr(dto.qrString);
  }
}
