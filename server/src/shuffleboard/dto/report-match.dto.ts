import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { MAX_SCORE, SEATS, TOTAL_TURNS } from '../shuffleboard.rules.js';

export class PlayerResultDto {
  @ApiProperty({ enum: SEATS, example: 'A' })
  @IsIn(SEATS)
  seat: 'A' | 'B';

  @ApiProperty({
    description: '경기 전에 적은 공개 닉네임 (TV가 정리한 값)',
    example: '3층 하윤',
  })
  @IsString()
  @MaxLength(10)
  name: string;

  @ApiPropertyOptional({
    description:
      '폰만 아는 비밀값의 sha-256 hex. 보안 연결이 아니라 만들지 못했으면 null',
    type: String,
    nullable: true,
  })
  @IsOptional()
  @Matches(/^[0-9a-f]{64}$/)
  claimHash: string | null;

  @ApiProperty({ example: 27 })
  @IsInt()
  @Min(0)
  @Max(MAX_SCORE)
  score: number;
}

export class ShotLogDto {
  @IsInt()
  @Min(0)
  @Max(TOTAL_TURNS - 1)
  turn: number;

  @IsIn(SEATS)
  seat: 'A' | 'B';

  @IsNumber()
  angle: number;

  @IsNumber()
  power: number;

  @IsBoolean()
  missed: boolean;
}

/** 끝난 경기. TV가 심판이라 점수는 TV가 계산한 값이다(기기 토큰으로 인증). */
export class ReportMatchDto {
  @ApiProperty({
    description: 'TV가 정한 경기 id. 다시 보내도 한 번만 저장한다',
  })
  @IsUUID()
  matchId: string;

  @ApiProperty({ type: [PlayerResultDto] })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => PlayerResultDto)
  players: PlayerResultDto[];

  @ApiProperty({ enum: ['A', 'B', 'DRAW'] })
  @IsIn(['A', 'B', 'DRAW'])
  winner: 'A' | 'B' | 'DRAW';

  @ApiProperty({ type: [ShotLogDto], description: '턴별 발사 기록(분석용)' })
  @IsArray()
  @ArrayMaxSize(TOTAL_TURNS)
  @ValidateNested({ each: true })
  @Type(() => ShotLogDto)
  shots: ShotLogDto[];
}
