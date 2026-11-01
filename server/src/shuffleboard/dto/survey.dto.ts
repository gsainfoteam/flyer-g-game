import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

/**
 * 설문 응답. 모양은 문항 정의(`survey-questions.ts`)로 서비스가 검증한다.
 * 객관식은 선택지 id(복수 선택은 배열), 주관식은 글. "기타"에 적은 말은 others에 둔다.
 */
export class SubmitSurveyDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: {
      board_viewed: 'glanced',
      info_sources: ['ziggle'],
      improve_first: '글씨를 키워 주세요',
    },
  })
  @IsObject()
  answers: Record<string, string | string[]>;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    example: {},
  })
  @IsObject()
  others: Record<string, string>;
}

export class SurveyStatusDto {
  @ApiProperty()
  submitted: boolean;
}
