import { Module } from '@nestjs/common';
import { ShuffleboardController } from './shuffleboard.controller.js';
import { ShuffleboardService } from './shuffleboard.service.js';

/**
 * 셔플보드 경기 기록·설문·랭킹. 실시간 경기 중계는 games 모듈이 그대로 하고,
 * 이 모듈은 끝난 경기만 다룬다. 기존 모듈을 고치지 않는다.
 */
@Module({
  controllers: [ShuffleboardController],
  providers: [ShuffleboardService],
})
export class ShuffleboardModule {}
