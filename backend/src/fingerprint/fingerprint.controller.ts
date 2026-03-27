import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  ValidationPipe,
  UsePipes,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FingerprintService } from './fingerprint.service';
import { EnrollFingerprintDto } from './dto/enroll-fingerprint.dto';
import { VerifyFingerprintDto } from './dto/verify-fingerprint.dto';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

@Controller('fingerprint')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class FingerprintController {
  constructor(private readonly fingerprintService: FingerprintService) {}

  /**
   * POST /fingerprint/enroll
   *
   * Enroll a fingerprint image for a voter.
   *
   * Form-data fields:
   *   - file: JPG/PNG fingerprint image
   *   - voterId: string
   *   - fingerLabel: LEFT_INDEX | RIGHT_INDEX | LEFT_THUMB | RIGHT_THUMB | ...
   *   - imageRef (optional): audit image path
   *   - deviceId (optional): scanner device ID
   *
   * Example response:
   *   { success: true, templateId: "uuid", qualityScore: 78, fingerLabel: "RIGHT_INDEX" }
   */
  @Post('enroll')
  @UseInterceptors(FileInterceptor('file'))
  async enroll(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_FILE_SIZE }),
          new FileTypeValidator({ fileType: /^image\/(jpeg|jpg|png)$/ }),
        ],
      }),
    )
    file: { buffer: Buffer; mimetype: string; originalname: string },
    @Body() dto: EnrollFingerprintDto,
  ) {
    if (!file) throw new BadRequestException('Fingerprint image file is required.');
    console.log('Received file for enrollment:', {
      hasBuffer: !!file.buffer,
      bufferLength: file.buffer?.length,
      mimeType: file.mimetype,
      originalname: file.originalname,
    });
    return this.fingerprintService.enroll(file.buffer, file.mimetype, dto);
  }

  /**
   * POST /fingerprint/verify
   *
   * Verify a live fingerprint against enrolled templates.
   *
   * Form-data fields:
   *   - file: JPG/PNG fingerprint image
   *   - voterId: string
   *   - fingerLabel: LEFT_INDEX | RIGHT_INDEX | ...
   *   - sessionId: string (links log to overall verification session)
   *   - deviceId (optional)
   *
   * Example response:
   *   { matched: true, score: 52.4, threshold: 40, qualityScore: 84, matchedTemplateId: "uuid" }
   */
  @Post('verify')
  @UseInterceptors(FileInterceptor('file'))
  async verify(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_FILE_SIZE }),
          new FileTypeValidator({ fileType: /^image\/(jpeg|jpg|png)$/ }),
        ],
      }),
    )
    file: { buffer: Buffer; mimetype: string; originalname: string },
    @Body() dto: VerifyFingerprintDto,
  ) {
    if (!file) throw new BadRequestException('Fingerprint image file is required.');
    return this.fingerprintService.verify(file.buffer, file.mimetype, dto);
  }

  /**
   * GET /fingerprint/logs/:sessionId
   *
   * Retrieve all verification log entries for a session.
   * Useful for manual cross-checking of fingerprint failure logs.
   *
   * Example response:
   *   [ { sessionId, voterId, status, matchScore, threshold, failureReason, ... } ]
   */
  @Get('logs/:sessionId')
  async getLogs(@Param('sessionId') sessionId: string) {
    return this.fingerprintService.getLogs(sessionId);
  }
}
