import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, Matches } from 'class-validator';

/** 로그인한 폰이 "이 자리는 내 것"을 증명한다. */
export class ClaimDto {
  @ApiProperty()
  @IsUUID()
  matchId: string;

  @ApiProperty({
    description:
      '입장할 때 폰이 만들어 혼자 간직한 비밀값(hex 64자). TV에는 해시만 갔다',
  })
  @Matches(/^[0-9a-f]{64}$/)
  claimSecret: string;
}

export class ClaimResultDto {
  @ApiProperty({ enum: ['A', 'B'] })
  seat: 'A' | 'B';

  @ApiProperty()
  score: number;

  @ApiProperty({ description: '이 경기의 높은 점수(랭킹에 오르는 점수)' })
  topScore: number;

  @ApiProperty({
    description:
      '내 점수가 이 경기의 높은 점수인가. 그래야 내 설문으로 이 경기가 랭킹에 오른다',
  })
  recordHolder: boolean;

  @ApiProperty({ description: '이 계정이 설문을 이미 냈는가' })
  surveySubmitted: boolean;

  @ApiProperty({ description: '이 경기가 지금 랭킹 대상인가' })
  ranked: boolean;
}
