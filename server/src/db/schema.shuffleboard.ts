/**
 * 셔플보드 테이블. `src/db/schema.ts` 맨 아래에 한 줄을 더해 함께 내보낸다.
 *
 *   export * from './schema.shuffleboard.js';
 *
 * 기존 테이블은 바꾸지 않는다. users·devices를 참조만 한다.
 */
import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { devices, users } from './schema.js';

/** TV가 놓인 장소. 랭킹의 구관/신관 최고 점수를 이 값으로 나눈다. */
export const shuffleboardVenueEnum = pgEnum('shuffleboard_venue', [
  'old',
  'new',
]);
export type ShuffleboardVenue =
  (typeof shuffleboardVenueEnum.enumValues)[number];

/** 기기(TV)마다 어느 장소인지. 관리자가 정한다. */
export const shuffleboardRooms = pgTable('shuffleboard_rooms', {
  deviceId: uuid('device_id')
    .primaryKey()
    .references(() => devices.id, { onDelete: 'cascade' }),
  venue: shuffleboardVenueEnum('venue').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * 끝난 경기. TV(심판)가 기기 토큰으로 보낸다. id는 TV가 정한 경기 id라 같은 경기를
 * 여러 번 보내도 한 번만 저장된다.
 */
export const shuffleboardMatches = pgTable(
  'shuffleboard_matches',
  {
    id: uuid('id').primaryKey(),
    deviceId: uuid('device_id').references(() => devices.id, {
      onDelete: 'set null',
    }),
    // 보낼 때의 장소. 나중에 기기 장소를 바꿔도 지난 기록은 그대로다.
    venue: shuffleboardVenueEnum('venue'),
    // 두 사람 중 높은 점수. 랭킹에 오르는 점수다.
    topScore: integer('top_score').notNull(),
    winner: varchar('winner', { length: 4 }).notNull(),
    shots: jsonb('shots').notNull(),
    reportedAt: timestamp('reported_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check('shuffleboard_matches_top_score_range', sql`${table.topScore} >= 0`),
    check(
      'shuffleboard_matches_winner',
      sql`${table.winner} in ('A', 'B', 'DRAW')`,
    ),
    index('shuffleboard_matches_top_score_idx').on(
      table.topScore.desc(),
      table.reportedAt,
    ),
  ],
);

/**
 * 경기의 두 자리. 경기 전에는 로그인하지 않으므로 처음에는 user가 비어 있다.
 * 폰만 아는 비밀값의 해시(claim_hash)로 로그인한 사용자가 자기 자리를 가져간다.
 */
export const shuffleboardMatchPlayers = pgTable(
  'shuffleboard_match_players',
  {
    matchId: uuid('match_id')
      .notNull()
      .references(() => shuffleboardMatches.id, { onDelete: 'cascade' }),
    seat: varchar('seat', { length: 1 }).notNull(),
    // 경기 전에 적은 공개 닉네임. 랭킹에는 계정 이름 대신 이것만 보인다.
    nickname: varchar('nickname', { length: 10 }).notNull(),
    score: integer('score').notNull(),
    claimHash: varchar('claim_hash', { length: 64 }),
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    claimedAt: timestamp('claimed_at', { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.matchId, table.seat] }),
    check('shuffleboard_match_players_seat', sql`${table.seat} in ('A', 'B')`),
    check('shuffleboard_match_players_score', sql`${table.score} >= 0`),
    // 한 계정이 한 경기의 두 자리를 다 가져갈 수 없다.
    uniqueIndex('shuffleboard_match_players_match_user_uq')
      .on(table.matchId, table.userId)
      .where(sql`${table.userId} is not null`),
    index('shuffleboard_match_players_user_idx').on(table.userId),
  ],
);

/**
 * 전단지 설문. 계정당 하나다(user_id가 기본키). 다시 플레이해도 다시 묻지 않는다.
 * 내보낼 때는 계정 정보 없이 응답만 낸다.
 */
export const shuffleboardSurveyResponses = pgTable(
  'shuffleboard_survey_responses',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    answers: jsonb('answers').notNull(),
    others: jsonb('others').notNull(),
    submittedAt: timestamp('submitted_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);
