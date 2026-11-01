/**
 * 셔플보드 규칙 설정. 게임 규칙을 바꿀 때는 이 파일만 고친다.
 *
 * 명세서 5장의 "MVP 기본 제안값"이다. 아직 확정된 규칙이 아니므로 운영 전에
 * 다시 정한다. 보드 좌표의 단위는 화면 px이 아니라 보드 자체의 단위다
 * (폭 100, 길이 400). 화면은 이 좌표를 비율대로 그린다.
 */
export const SEATS = ["A", "B"] as const;
export type Seat = (typeof SEATS)[number];

export const SHUFFLEBOARD_RULES = {
  /** 한 사람이 던지는 횟수. A와 B가 번갈아 던지므로 한 판은 이 값의 2배 턴이다. */
  shotsPerSeat: 5,
  /** 두 명이 모인 뒤 시작까지 (명세 3장) */
  startCountdownMs: 3_000,
  /**
   * 한 턴의 제한 시간. 넘기면 그 턴은 원반 없이 지나간다(0점).
   * 폰을 내려놓고 가 버린 사람 때문에 판이 멈추지 않게 한다.
   */
  turnMs: 20_000,
  /** 원반이 멈춘 뒤 다음 차례로 넘어가기 전 잠깐 멈추는 시간. 점수를 읽을 틈이다. */
  settleMs: 700,
  /** 결과 화면을 TV에 띄우는 시간. 끝나면 방을 비우고 다음 참가자를 받는다. */
  resultMs: 10_000,
  /** 원반끼리 부딪히는가. false면 서로 통과한다(명세 5장: MVP에서 생략 가능). */
  collisions: true,
} as const;

export const BOARD = {
  width: 100,
  length: 400,
  puckRadius: 5,
  /** 발사 위치(원반 중심). 보드 아래쪽 가운데다. */
  launch: { x: 50, y: 8 },
  /**
   * 이 선을 넘지 못하고 멈춘 원반은 치운다. 다음 발사 길을 막지 않게 하고,
   * 너무 약하게 던진 원반이 쌓이지 않게 한다.
   */
  foulLineY: 200,
  /**
   * 점수 구역. y 시작값이 큰 것부터 적는다. 원반 중심이 어느 구역에 있는지로
   * 점수를 매긴다. 보드 끝(length)을 넘으면 떨어진 것으로 0점이다.
   */
  zones: [
    { minY: 372, points: 10 },
    { minY: 340, points: 7 },
    { minY: 300, points: 3 },
    { minY: 250, points: 2 },
  ],
} as const;

export const PHYSICS = {
  /** 마찰로 줄어드는 속도 (단위/초²) */
  friction: 120,
  /** 힘 1.0으로 던졌을 때 아무것도 안 맞으면 미끄러지는 거리. 보드보다 조금 길다. */
  maxSlide: 450,
  /** 조준 각도 한계(도). 0이 정면, 음수가 왼쪽. */
  maxAngleDeg: 20,
  /** 원반끼리 부딪힐 때 튕기는 정도 (1이면 완전 탄성) */
  restitution: 0.9,
  /** 계산 간격. 작을수록 정확하고 느리다. */
  stepSeconds: 1 / 240,
  /** 애니메이션 프레임 간격 (계산 몇 번마다 한 장) */
  stepsPerFrame: 8,
  /** 아무리 길어도 이 시간 안에 멈춘 것으로 본다. */
  maxSeconds: 8,
} as const;
