import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { VENUES } from '../shuffleboard.rules.js';

export class RankingEntryDto {
  @ApiProperty()
  matchId: string;

  @ApiProperty({
    description: '높은 점수를 낸 사람의 닉네임. 계정 이름은 싣지 않는다',
  })
  name: string;

  @ApiProperty()
  score: number;

  @ApiProperty({ enum: VENUES, nullable: true })
  venue: 'old' | 'new' | null;
}

export class VenueBestDto {
  @ApiProperty({ type: Number, nullable: true })
  old: number | null;

  @ApiProperty({ type: Number, nullable: true })
  new: number | null;
}

export class RankingDto {
  @ApiProperty({ type: [RankingEntryDto], description: '경기 기록 1~3위' })
  top: RankingEntryDto[];

  @ApiProperty({ type: VenueBestDto, description: '장소별 최고 점수' })
  venueBest: VenueBestDto;
}

export class SetVenueDto {
  @ApiProperty({ enum: VENUES })
  @IsIn(VENUES)
  venue: 'old' | 'new';
}
