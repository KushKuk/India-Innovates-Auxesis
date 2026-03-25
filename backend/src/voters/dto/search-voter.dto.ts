import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class SearchVoterDto {
  @ApiProperty({ example: 'Rajesh' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: '1985-05-15', description: 'YYYY-MM-DD or age as string' })
  @IsOptional()
  @IsString()
  dobOrAge?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  useAge?: boolean;
}
