import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { inArray } from 'drizzle-orm';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DB_CONNECTION, type Database } from '../src/db/index.js';
import {
  auditLogs,
  devices,
  shuffleboardMatches,
  shuffleboardSurveyResponses,
  targetGroups,
} from '../src/db/schema.js';
import {
  createTestUser,
  type TestUser,
  uniqueSlug,
} from './helpers/test-user.js';

/** 1~7번만 고른 최소 설문 */
const SURVEY = {
  answers: {
    board_viewed: 'glanced',
    info_sources: ['ziggle', 'other'],
    wanted_info: ['events'],
    readability: '4',
    pain_points: ['none'],
    satisfaction: '5',
    revisit: '4',
    improve_first: '글씨를 키워 주세요',
  },
  others: { info_sources: '기숙사 단톡' },
};

const secret = () => randomBytes(32).toString('hex');
const sha = (value: string) => createHash('sha256').update(value).digest('hex');

describe('셔플보드 기록·설문·랭킹 (e2e)', () => {
  let app: INestApplication;
  let db: Database;
  let admin: TestUser;
  let winner: TestUser;
  let loser: TestUser;
  let other: TestUser;
  const groupId = uniqueSlug('grp');
  const deviceIds: string[] = [];
  const matchIds: string[] = [];
  let tv: { id: string; token: string };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0);
    db = app.get<Database>(DB_CONNECTION);
    // 다른 테스트가 남긴 셔플보드 기록이 랭킹을 흔들지 않게 비우고 시작한다.
    await db.delete(shuffleboardMatches);
    await db.delete(shuffleboardSurveyResponses);

    await db
      .insert(targetGroups)
      .values({ id: groupId, name: `E2E 셔플보드 ${groupId}` });
    admin = await createTestUser(app, { roles: ['SUPER_ADMIN'] });
    winner = await createTestUser(app);
    loser = await createTestUser(app);
    other = await createTestUser(app);

    const res = await request(app.getHttpServer())
      .post('/signage/devices')
      .set('Authorization', admin.authHeader)
      .send({ name: 'E2E 구관 TV', groupIds: [groupId] })
      .expect(201);
    tv = { id: res.body.id, token: res.body.token };
    deviceIds.push(tv.id);
    await request(app.getHttpServer())
      .put(`/shuffleboard/devices/${tv.id}/venue`)
      .set('Authorization', admin.authHeader)
      .send({ venue: 'old' })
      .expect(204);
  });

  afterAll(async () => {
    if (matchIds.length > 0) {
      await db
        .delete(shuffleboardMatches)
        .where(inArray(shuffleboardMatches.id, matchIds));
    }
    await db.delete(auditLogs).where(inArray(auditLogs.targetId, deviceIds));
    await db.delete(devices).where(inArray(devices.id, deviceIds));
    await db.delete(targetGroups).where(inArray(targetGroups.id, [groupId]));
    for (const user of [admin, winner, loser, other]) await user.remove();
    await app.close();
  });

  const server = () => app.getHttpServer();

  async function report(a: number, b: number) {
    const matchId = randomUUID();
    matchIds.push(matchId);
    const secrets = { A: secret(), B: secret() };
    await request(server())
      .post(`/shuffleboard/devices/${tv.id}/matches`)
      .set('X-Device-Token', tv.token)
      .send({
        matchId,
        winner: a === b ? 'DRAW' : a > b ? 'A' : 'B',
        shots: [{ turn: 0, seat: 'A', angle: 0, power: 0.8, missed: false }],
        players: [
          { seat: 'A', name: '하윤', claimHash: sha(secrets.A), score: a },
          { seat: 'B', name: '민준', claimHash: sha(secrets.B), score: b },
        ],
      })
      .expect(204);
    return { matchId, secrets };
  }

  const claim = (user: TestUser, matchId: string, claimSecret: string) =>
    request(server())
      .post('/shuffleboard/claims')
      .set('Authorization', user.authHeader)
      .send({ matchId, claimSecret });

  const ranking = async () =>
    (await request(server()).get('/shuffleboard/ranking').expect(200)).body;

  it('TV만 경기를 보낼 수 있고, 같은 경기는 한 번만 저장한다', async () => {
    await request(server())
      .post(`/shuffleboard/devices/${tv.id}/matches`)
      .send({})
      .expect(401);
    const { matchId, secrets } = await report(20, 10);
    // 같은 경기를 다시 보내도 된다(응답을 못 받은 TV의 재전송)
    await request(server())
      .post(`/shuffleboard/devices/${tv.id}/matches`)
      .set('X-Device-Token', tv.token)
      .send({
        matchId,
        winner: 'A',
        shots: [],
        players: [
          { seat: 'A', name: '바뀐이름', claimHash: sha(secrets.A), score: 50 },
          { seat: 'B', name: '민준', claimHash: sha(secrets.B), score: 0 },
        ],
      })
      .expect(204);
    expect((await ranking()).top).toEqual([]);
  });

  it('점수와 승자가 맞지 않으면 받지 않는다', async () => {
    await request(server())
      .post(`/shuffleboard/devices/${tv.id}/matches`)
      .set('X-Device-Token', tv.token)
      .send({
        matchId: randomUUID(),
        winner: 'B',
        shots: [],
        players: [
          { seat: 'A', name: 'a', claimHash: null, score: 10 },
          { seat: 'B', name: 'b', claimHash: null, score: 5 },
        ],
      })
      .expect(422);
  });

  it('경기 결과만으로는 랭킹에 오르지 않고, 이긴 사람이 로그인·설문을 마쳐야 오른다', async () => {
    const { matchId, secrets } = await report(37, 21);

    // 진 사람이 먼저 로그인하고 설문을 내도 이 경기는 오르지 않는다.
    const loserClaim = await claim(loser, matchId, secrets.B).expect(200);
    expect(loserClaim.body).toMatchObject({
      seat: 'B',
      score: 21,
      topScore: 37,
      recordHolder: false,
      surveySubmitted: false,
      ranked: false,
    });
    await request(server())
      .post('/shuffleboard/survey')
      .set('Authorization', loser.authHeader)
      .send(SURVEY)
      .expect(204);
    expect((await ranking()).top).toEqual([]);

    // 이긴 사람: 로그인만으로는 아직
    const winnerClaim = await claim(winner, matchId, secrets.A).expect(200);
    expect(winnerClaim.body).toMatchObject({
      recordHolder: true,
      surveySubmitted: false,
      ranked: false,
    });
    expect((await ranking()).top).toEqual([]);

    // 설문까지 내면 오른다. 닉네임만 싣는다.
    await request(server())
      .post('/shuffleboard/survey')
      .set('Authorization', winner.authHeader)
      .send(SURVEY)
      .expect(204);
    expect(
      (await claim(winner, matchId, secrets.A).expect(200)).body.ranked,
    ).toBe(true);
    const board = await ranking();
    expect(board.top).toEqual([
      { matchId, name: '하윤', score: 37, venue: 'old' },
    ]);
    expect(board.venueBest).toEqual({ old: 37, new: null });
  });

  it('설문은 계정당 한 번이고, 다음 경기는 로그인만으로 오른다. 1~3위까지만 준다', async () => {
    const status = await request(server())
      .get('/shuffleboard/survey/me')
      .set('Authorization', winner.authHeader)
      .expect(200);
    expect(status.body).toEqual({ submitted: true });

    for (const score of [40, 15, 45]) {
      const { matchId, secrets } = await report(score, 0);
      const res = await claim(winner, matchId, secrets.A).expect(200);
      expect(res.body).toMatchObject({ surveySubmitted: true, ranked: true });
    }
    const board = await ranking();
    expect(board.top.map((entry: { score: number }) => entry.score)).toEqual([
      45, 40, 37,
    ]);
    expect(board.venueBest.old).toBe(45);
  });

  it('다른 계정의 자리, 한 계정의 두 자리, 틀린 비밀값은 막는다', async () => {
    const { matchId, secrets } = await report(10, 5);
    await claim(other, matchId, secrets.A).expect(200);
    const both = await claim(other, matchId, secrets.B).expect(409);
    expect(both.body.code).toBe('SHUFFLEBOARD_BOTH_SEATS');
    const taken = await claim(winner, matchId, secrets.A).expect(409);
    expect(taken.body.code).toBe('SHUFFLEBOARD_CLAIMED_BY_OTHER');
    await claim(winner, matchId, secret()).expect(404);
    await claim(winner, randomUUID(), secret()).expect(404);
    await request(server())
      .post('/shuffleboard/claims')
      .send({ matchId, claimSecret: secrets.A })
      .expect(401);
  });

  it('빠진 필수 문항이 있으면 받지 않는다', async () => {
    const res = await request(server())
      .post('/shuffleboard/survey')
      .set('Authorization', other.authHeader)
      .send({ answers: { board_viewed: 'glanced' }, others: {} })
      .expect(422);
    expect(Object.keys(res.body.fields)).toContain('answers.readability');
  });

  it('검토자는 계정 정보 없이 설문 CSV를 받고, 일반 사용자는 못 받는다', async () => {
    await request(server())
      .get('/shuffleboard/survey/responses.csv')
      .set('Authorization', winner.authHeader)
      .expect(403);
    // 수식처럼 시작하는 주관식 답
    await request(server())
      .post('/shuffleboard/survey')
      .set('Authorization', other.authHeader)
      .send({
        ...SURVEY,
        answers: { ...SURVEY.answers, new_features: '=HYPERLINK("http://x")' },
      })
      .expect(204);
    const res = await request(server())
      .get('/shuffleboard/survey/responses.csv')
      .set('Authorization', admin.authHeader)
      .expect(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text.startsWith('﻿제출 시각,')).toBe(true);
    expect(res.text).toContain('화면을 잠깐 살펴봤다');
    expect(res.text).toContain('글씨를 키워 주세요');
    expect(res.text).toContain('지글(Ziggle) / 기타: 기숙사 단톡');
    // 수식으로 읽히지 않게 앞에 따옴표를 붙인다
    expect(res.text).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(res.text).not.toContain('e2e@test.local');
    expect(res.text).not.toContain('E2E 사용자');
  });
});
