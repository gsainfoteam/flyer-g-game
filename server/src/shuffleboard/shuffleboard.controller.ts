import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { AuthUser } from '../auth/types/auth-user.js';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { BEARER_AUTH } from '../config/swagger.js';
import type { Device } from '../db/schema.js';
import { CurrentDevice, DeviceAuth } from '../devices/auth/device-auth.js';
import { ClaimDto, ClaimResultDto } from './dto/claim.dto.js';
import { RankingDto, SetVenueDto } from './dto/ranking.dto.js';
import { ReportMatchDto } from './dto/report-match.dto.js';
import { SubmitSurveyDto, SurveyStatusDto } from './dto/survey.dto.js';
import { ShuffleboardService } from './shuffleboard.service.js';

const DEVICE_PARAM = { name: 'deviceId', description: '기기(TV) ID' };
const INVALID_DOC = { description: '형식이 틀림', type: ErrorResponseDto };

@ApiTags('Shuffleboard')
@Controller('shuffleboard')
export class ShuffleboardController {
  constructor(private readonly shuffleboard: ShuffleboardService) {}

  @Post('devices/:deviceId/matches')
  @HttpCode(204)
  @DeviceAuth()
  @ApiOperation({
    summary: '끝난 경기 보내기 (TV)',
    description: `TV가 심판이라 점수는 TV가 계산한 값이다. 이 단계에서는 랭킹에 오르지 않는다.

- 같은 matchId를 다시 보내도 한 번만 저장한다. 응답을 못 받으면 다시 보내면 된다
- 장소(구관/신관)는 기기에 정해 둔 값으로 기록한다`,
  })
  @ApiParam(DEVICE_PARAM)
  @ApiNoContentResponse({ description: '기록함 (이미 있으면 그대로)' })
  @ApiUnprocessableEntityResponse(INVALID_DOC)
  reportMatch(
    @CurrentDevice() device: Device,
    @Body() dto: ReportMatchDto,
  ): Promise<void> {
    return this.shuffleboard.reportMatch(device, dto);
  }

  @Put('devices/:deviceId/venue')
  @HttpCode(204)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth(BEARER_AUTH)
  @ApiOperation({ summary: 'TV의 장소(구관/신관) 정하기 (관리자)' })
  @ApiParam(DEVICE_PARAM)
  @ApiNoContentResponse({ description: '정함' })
  setVenue(
    @Param('deviceId', new ParseUUIDPipe()) deviceId: string,
    @Body() dto: SetVenueDto,
  ): Promise<void> {
    return this.shuffleboard.setVenue(deviceId, dto.venue);
  }

  @Post('claims')
  @HttpCode(200)
  @ApiBearerAuth(BEARER_AUTH)
  @ApiOperation({
    summary: '내 자리 가져오기 (로그인한 폰)',
    description: `경기 전에 폰이 만든 비밀값으로, 로그인한 계정에 그 경기 자리를 연결한다.

- 같은 계정이 다시 불러도 된다(설문을 낸 뒤 랭킹 여부를 다시 확인할 때)
- 비밀값이 틀리거나 경기가 아직 없으면 404 (TV가 보내는 중일 수 있어 잠시 뒤 다시 시도)`,
  })
  @ApiOkResponse({ type: ClaimResultDto })
  @ApiNotFoundResponse({
    description: '경기가 없거나 비밀값이 틀림',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description:
      'SHUFFLEBOARD_CLAIMED_BY_OTHER: 다른 계정이 이미 가져감 · SHUFFLEBOARD_BOTH_SEATS: 한 계정으로 두 자리',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: '로그인 필요',
    type: ErrorResponseDto,
  })
  claim(
    @CurrentUser() user: AuthUser,
    @Body() dto: ClaimDto,
  ): Promise<ClaimResultDto> {
    return this.shuffleboard.claim(user, dto.matchId, dto.claimSecret);
  }

  @Get('survey/me')
  @ApiBearerAuth(BEARER_AUTH)
  @ApiOperation({ summary: '이 계정이 설문을 냈는지' })
  @ApiOkResponse({ type: SurveyStatusDto })
  surveyStatus(@CurrentUser() user: AuthUser): Promise<SurveyStatusDto> {
    return this.shuffleboard.surveyStatus(user);
  }

  @Post('survey')
  @HttpCode(204)
  @ApiBearerAuth(BEARER_AUTH)
  @ApiOperation({
    summary: '설문 내기 (계정당 한 번)',
    description:
      '1~7번 필수, 8·9번 선택. 이미 냈으면 처음 응답을 그대로 두고 204를 준다.',
  })
  @ApiNoContentResponse({ description: '저장함 (이미 냈으면 그대로)' })
  @ApiUnprocessableEntityResponse(INVALID_DOC)
  submitSurvey(
    @CurrentUser() user: AuthUser,
    @Body() dto: SubmitSurveyDto,
  ): Promise<void> {
    return this.shuffleboard.submitSurvey(user, dto);
  }

  @Get('ranking')
  @Public()
  @ApiOperation({
    summary: '경기 랭킹 1~3위와 장소별 최고 점수 (공개)',
    description:
      '경기의 높은 점수를 낸 사람이 로그인하고 설문까지 낸 경기만 들어간다. 닉네임만 싣는다.',
  })
  @ApiOkResponse({ type: RankingDto })
  ranking(): Promise<RankingDto> {
    return this.shuffleboard.ranking();
  }

  @Get('survey/responses.csv')
  @Roles('REVIEWER')
  @ApiBearerAuth(BEARER_AUTH)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="flyer-g-survey.csv"')
  @ApiProduces('text/csv')
  @ApiOperation({
    summary: '설문 응답 내려받기 (검토자)',
    description: '계정 정보 없이 응답만 담는다.',
  })
  surveyCsv(): Promise<string> {
    return this.shuffleboard.surveyCsv();
  }
}
