import { createHash } from 'node:crypto';
import { Trace } from '@gsainfoteam/nest-observability';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import type { AuthUser } from '../auth/types/auth-user.js';
import { AppException } from '../common/errors/app.exception.js';
import { ErrorCode } from '../common/errors/error-code.js';
import { validationFailed } from '../common/errors/validation.js';
import { DB_CONNECTION, type Database } from '../db/index.js';
import {
  shuffleboardMatchPlayers,
  shuffleboardMatches,
  shuffleboardRooms,
  shuffleboardSurveyResponses,
  type Device,
  type ShuffleboardVenue,
} from '../db/schema.js';
import type { ClaimResultDto } from './dto/claim.dto.js';
import type { RankingDto, RankingEntryDto } from './dto/ranking.dto.js';
import type { ReportMatchDto } from './dto/report-match.dto.js';
import type { SubmitSurveyDto } from './dto/survey.dto.js';
import { RANKING_SIZE } from './shuffleboard.rules.js';
import { SURVEY_QUESTIONS, validateSurvey } from './survey-questions.js';

/**
 * 셔플보드 기록·설문·랭킹.
 *
 * 1. 경기가 끝나면 TV가 결과를 보낸다(reportMatch). 아직 랭킹이 아니다.
 * 2. 폰에서 인포팀 로그인 → 비밀값으로 자기 자리를 가져간다(claim).
 * 3. 그 계정이 설문을 처음 내면 저장한다(계정당 하나).
 * 4. 경기의 높은 점수를 낸 사람이 로그인하고 설문까지 낸 경기만 랭킹에 오른다.
 *
 * 랭킹 여부는 따로 저장하지 않고 읽을 때 계산한다. 설문을 나중에 내도, 계정이
 * 지워져도 상태가 어긋나지 않는다.
 */
@Trace()
@Injectable()
export class ShuffleboardService {
  constructor(@Inject(DB_CONNECTION) private readonly db: Database) {}

  async reportMatch(device: Device, dto: ReportMatchDto): Promise<void> {
    const seats = dto.players.map((player) => player.seat).sort();
    if (seats.join() !== 'A,B') {
      throw validationFailed({ players: 'A와 B 자리가 하나씩 있어야 합니다.' });
    }
    const [a, b] = ['A', 'B'].map(
      (seat) => dto.players.find((player) => player.seat === seat)!.score,
    );
    const expectedWinner = a === b ? 'DRAW' : a > b ? 'A' : 'B';
    if (dto.winner !== expectedWinner) {
      throw validationFailed({ winner: '점수와 승자가 맞지 않습니다.' });
    }

    const [room] = await this.db
      .select({ venue: shuffleboardRooms.venue })
      .from(shuffleboardRooms)
      .where(eq(shuffleboardRooms.deviceId, device.id));

    await this.db.transaction(async (tx) => {
      const inserted = await tx
        .insert(shuffleboardMatches)
        .values({
          id: dto.matchId,
          deviceId: device.id,
          venue: room?.venue ?? null,
          topScore: Math.max(a, b),
          winner: dto.winner,
          shots: dto.shots,
        })
        // TV가 응답을 못 받고 다시 보내도 한 번만 저장한다.
        .onConflictDoNothing({ target: shuffleboardMatches.id })
        .returning({ id: shuffleboardMatches.id });
      if (inserted.length === 0) return;
      await tx.insert(shuffleboardMatchPlayers).values(
        dto.players.map((player) => ({
          matchId: dto.matchId,
          seat: player.seat,
          nickname: player.name,
          score: player.score,
          claimHash: player.claimHash ?? null,
        })),
      );
    });
  }

  async claim(
    user: AuthUser,
    matchId: string,
    claimSecret: string,
  ): Promise<ClaimResultDto> {
    const claimHash = createHash('sha256').update(claimSecret).digest('hex');

    const claimed = await this.db.transaction(async (tx) => {
      const players = await tx
        .select()
        .from(shuffleboardMatchPlayers)
        .where(eq(shuffleboardMatchPlayers.matchId, matchId))
        .for('update');
      const mine = players.find((player) => player.claimHash === claimHash);
      // 경기가 없거나 비밀값이 틀리면 똑같이 404다. 남의 경기 id로 떠보지 못하게 한다.
      if (!mine) {
        throw new AppException(
          HttpStatus.NOT_FOUND,
          ErrorCode.NOT_FOUND,
          'Match record not found',
        );
      }
      if (mine.userId !== null && mine.userId !== user.id) {
        throw new AppException(
          HttpStatus.CONFLICT,
          ErrorCode.SHUFFLEBOARD_CLAIMED_BY_OTHER,
          'This record belongs to another account',
        );
      }
      if (
        players.some((player) => player !== mine && player.userId === user.id)
      ) {
        throw new AppException(
          HttpStatus.CONFLICT,
          ErrorCode.SHUFFLEBOARD_BOTH_SEATS,
          'One account cannot take both seats of a match',
        );
      }
      if (mine.userId === null) {
        await tx
          .update(shuffleboardMatchPlayers)
          .set({ userId: user.id, claimedAt: new Date() })
          .where(
            and(
              eq(shuffleboardMatchPlayers.matchId, matchId),
              eq(shuffleboardMatchPlayers.seat, mine.seat),
            ),
          );
      }
      const topScore = Math.max(...players.map((player) => player.score));
      return { seat: mine.seat as 'A' | 'B', score: mine.score, topScore };
    });

    const [submitted, ranked] = await Promise.all([
      this.hasSurvey(user.id),
      this.isRanked(matchId),
    ]);
    return {
      ...claimed,
      recordHolder: claimed.score === claimed.topScore,
      surveySubmitted: submitted,
      ranked,
    };
  }

  async surveyStatus(user: AuthUser): Promise<{ submitted: boolean }> {
    return { submitted: await this.hasSurvey(user.id) };
  }

  /** 계정당 하나. 이미 냈으면 처음 응답을 그대로 두고 성공으로 본다. */
  async submitSurvey(user: AuthUser, dto: SubmitSurveyDto): Promise<void> {
    const problems = validateSurvey({
      answers: dto.answers,
      others: dto.others,
    });
    if (problems.length > 0) {
      throw validationFailed(
        Object.fromEntries(
          problems.map((problem) => [
            `answers.${problem.questionId}`,
            problem.message,
          ]),
        ),
      );
    }
    await this.db
      .insert(shuffleboardSurveyResponses)
      .values({ userId: user.id, answers: dto.answers, others: dto.others })
      .onConflictDoNothing({ target: shuffleboardSurveyResponses.userId });
  }

  async ranking(): Promise<RankingDto> {
    const [top, best] = await Promise.all([
      this.db.execute<{
        match_id: string;
        nickname: string;
        top_score: number;
        venue: ShuffleboardVenue | null;
      }>(sql`
        select m.id as match_id, m.top_score, m.venue, h.nickname
        from ${shuffleboardMatches} m
        join lateral (${this.recordHolders(sql`m`)} limit 1) h on true
        where m.top_score > 0
        order by m.top_score desc, m.reported_at asc
        limit ${RANKING_SIZE}
      `),
      this.db.execute<{ venue: ShuffleboardVenue; best: number }>(sql`
        select m.venue, max(m.top_score)::int as best
        from ${shuffleboardMatches} m
        where m.top_score > 0
          and m.venue is not null
          and exists (${this.recordHolders(sql`m`)})
        group by m.venue
      `),
    ]);
    const venueBest: RankingDto['venueBest'] = { old: null, new: null };
    for (const row of best) venueBest[row.venue] = Number(row.best);
    return {
      top: top.map((row): RankingEntryDto => ({
        matchId: row.match_id,
        name: row.nickname,
        score: Number(row.top_score),
        venue: row.venue,
      })),
      venueBest,
    };
  }

  /**
   * 설문 응답 CSV. 계정 이름·이메일·학번은 싣지 않는다. 엑셀에서 한글이 깨지지 않게
   * BOM을 붙이고, 수식으로 읽힐 수 있는 칸은 앞에 따옴표를 붙인다.
   */
  async surveyCsv(): Promise<string> {
    const rows = await this.db
      .select({
        answers: shuffleboardSurveyResponses.answers,
        others: shuffleboardSurveyResponses.others,
        submittedAt: shuffleboardSurveyResponses.submittedAt,
      })
      .from(shuffleboardSurveyResponses)
      .orderBy(shuffleboardSurveyResponses.submittedAt);

    const header = ['제출 시각', ...SURVEY_QUESTIONS.map((q) => q.title)];
    const lines = rows.map((row) => {
      const answers = row.answers as Record<string, string | string[]>;
      const others = row.others as Record<string, string>;
      return [
        row.submittedAt.toISOString(),
        ...SURVEY_QUESTIONS.map((question) => {
          const value = answers[question.id];
          if (question.kind === 'text')
            return typeof value === 'string' ? value : '';
          const ids = Array.isArray(value) ? value : value ? [value] : [];
          const other = others[question.id];
          // "기타"를 골랐고 내용을 적었으면 "기타: 내용"으로 쓴다.
          return ids
            .map((id) => {
              const option = question.options.find((item) => item.id === id);
              if (option?.other && other) return `기타: ${other}`;
              return option?.label ?? id;
            })
            .join(' / ');
        }),
      ];
    });
    return (
      '﻿' +
      [header, ...lines].map((line) => line.map(csvCell).join(',')).join('\r\n')
    );
  }

  async setVenue(deviceId: string, venue: ShuffleboardVenue): Promise<void> {
    await this.db
      .insert(shuffleboardRooms)
      .values({ deviceId, venue, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: shuffleboardRooms.deviceId,
        set: { venue, updatedAt: new Date() },
      });
  }

  private async hasSurvey(userId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ userId: shuffleboardSurveyResponses.userId })
      .from(shuffleboardSurveyResponses)
      .where(eq(shuffleboardSurveyResponses.userId, userId));
    return row !== undefined;
  }

  private async isRanked(matchId: string): Promise<boolean> {
    const rows = await this.db.execute(sql`
      select 1 from ${shuffleboardMatches} m
      where m.id = ${matchId} and m.top_score > 0 and exists (${this.recordHolders(sql`m`)})
    `);
    return rows.length > 0;
  }

  /**
   * 경기 m의 "랭킹 자격이 있는 기록 보유자": 높은 점수를 낸 자리 중 로그인해 가져갔고
   * 그 계정이 설문을 낸 사람. 동점이면 먼저 가져간 사람의 닉네임을 쓴다.
   */
  private recordHolders(match: ReturnType<typeof sql>) {
    return sql`
      select p.nickname
      from ${shuffleboardMatchPlayers} p
      join ${shuffleboardSurveyResponses} s on s.user_id = p.user_id
      where p.match_id = ${match}.id and p.score = ${match}.top_score
      order by p.claimed_at asc
    `;
  }
}

function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}
