import { BOARD, PHYSICS, SEATS, SHUFFLEBOARD_RULES } from "./shuffleboard-rules";
import type { Seat } from "./shuffleboard-rules";

/**
 * 셔플보드 물리. 시간과 화면을 모르는 순수 함수다.
 *
 * 같은 입력이면 항상 같은 결과가 나온다. 심판(TV)은 이 함수로 결과를 정하고,
 * 화면은 같은 함수가 돌려준 프레임을 그대로 재생한다. 그래서 화면에 보인 위치와
 * 점수가 어긋나지 않는다. 폰은 각도와 힘만 보낸다.
 */
export interface Puck {
  id: string;
  seat: Seat;
  x: number;
  y: number;
}

export interface Shot {
  /** 새 원반의 id. 같은 판 안에서 겹치지 않으면 된다. */
  puckId: string;
  seat: Seat;
  /** 도. 0이 정면, 음수가 왼쪽. 한계를 넘으면 자른다. */
  angle: number;
  /** 0~1. 넘으면 자른다. */
  power: number;
}

export type PuckFrame = ReadonlyArray<{ id: string; x: number; y: number }>;

export interface ShotResult {
  /** 이 발사 뒤 보드에 남은 원반 */
  pucks: Puck[];
  /** 애니메이션용. 첫 장은 발사 직전, 마지막 장은 멈춘 뒤다. 떨어진 원반은 그 장부터 없다. */
  frames: PuckFrame[];
  /** 프레임 한 장의 길이(ms) */
  frameMs: number;
  /** 원반이 모두 멈추기까지 걸린 시간(ms) */
  durationMs: number;
  /** 보드 밖으로 떨어지거나 파울 선을 못 넘어 치운 원반 id */
  removed: string[];
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0));

export function clampShot(angle: number, power: number) {
  return {
    angle: clamp(angle, -PHYSICS.maxAngleDeg, PHYSICS.maxAngleDeg),
    power: clamp(power, 0, 1),
  };
}

/**
 * 힘을 거리 비율로 쓴다. 힘 0.5면 마찰만으로 maxSlide의 절반을 간다.
 * 사람이 "얼마나 멀리"로 생각하므로 속도보다 거리에 맞추는 편이 조절하기 쉽다.
 */
export function launchSpeed(power: number): number {
  return Math.sqrt(2 * PHYSICS.friction * PHYSICS.maxSlide * clamp(power, 0, 1));
}

/** 원반이 아무것도 안 맞고 멈추는 y (안내선 그리기용) */
export function slideDistance(power: number): number {
  return BOARD.launch.y + PHYSICS.maxSlide * clamp(power, 0, 1);
}

export function isOffBoard(puck: { x: number; y: number }): boolean {
  return puck.x < 0 || puck.x > BOARD.width || puck.y > BOARD.length;
}

export function zonePoints(y: number): number {
  if (y > BOARD.length) return 0;
  for (const zone of BOARD.zones) {
    if (y >= zone.minY) return zone.points;
  }
  return 0;
}

export function scorePucks(pucks: readonly Puck[]): Record<Seat, number> {
  const scores = Object.fromEntries(SEATS.map((seat) => [seat, 0])) as Record<Seat, number>;
  for (const puck of pucks) scores[puck.seat] += zonePoints(puck.y);
  return scores;
}

interface Body extends Puck {
  vx: number;
  vy: number;
  live: boolean;
}

export function simulateShot(before: readonly Puck[], shot: Shot): ShotResult {
  const { angle, power } = clampShot(shot.angle, shot.power);
  const speed = launchSpeed(power);
  const radians = (angle * Math.PI) / 180;
  const bodies: Body[] = [
    ...before.map((puck) => ({ ...puck, vx: 0, vy: 0, live: true })),
    {
      id: shot.puckId,
      seat: shot.seat,
      x: BOARD.launch.x,
      y: BOARD.launch.y,
      vx: speed * Math.sin(radians),
      vy: speed * Math.cos(radians),
      live: true,
    },
  ];

  const dt = PHYSICS.stepSeconds;
  const slow = PHYSICS.friction * dt;
  const diameter = BOARD.puckRadius * 2;
  const snapshot = (): PuckFrame =>
    bodies.filter((b) => b.live).map(({ id, x, y }) => ({ id, x, y }));
  const frames: PuckFrame[] = [snapshot()];
  const removed: string[] = [];
  const maxSteps = Math.ceil(PHYSICS.maxSeconds / dt);
  let step = 0;

  for (; step < maxSteps; step++) {
    let moving = false;
    for (const body of bodies) {
      if (!body.live) continue;
      const v = Math.hypot(body.vx, body.vy);
      if (v <= slow) {
        body.vx = 0;
        body.vy = 0;
        continue;
      }
      moving = true;
      const k = (v - slow) / v;
      body.vx *= k;
      body.vy *= k;
      body.x += body.vx * dt;
      body.y += body.vy * dt;
    }

    if (SHUFFLEBOARD_RULES.collisions) {
      for (let i = 0; i < bodies.length; i++) {
        const a = bodies[i];
        if (!a.live) continue;
        for (let j = i + 1; j < bodies.length; j++) {
          const b = bodies[j];
          if (!b.live) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy);
          if (dist >= diameter || dist === 0) continue;
          const nx = dx / dist;
          const ny = dy / dist;
          // 겹친 만큼 반씩 밀어낸다.
          const push = (diameter - dist) / 2;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
          // 같은 질량의 충돌. 서로 다가오는 중일 때만 속도를 바꾼다.
          const closing = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
          if (closing <= 0) continue;
          const impulse = ((1 + PHYSICS.restitution) / 2) * closing;
          a.vx -= impulse * nx;
          a.vy -= impulse * ny;
          b.vx += impulse * nx;
          b.vy += impulse * ny;
          moving = true;
        }
      }
    }

    for (const body of bodies) {
      if (body.live && isOffBoard(body)) {
        body.live = false;
        removed.push(body.id);
      }
    }

    if ((step + 1) % PHYSICS.stepsPerFrame === 0 || !moving) frames.push(snapshot());
    if (!moving) break;
  }

  // 멈춘 뒤 파울 선을 못 넘은 원반을 치운다.
  for (const body of bodies) {
    if (body.live && body.y < BOARD.foulLineY) {
      body.live = false;
      removed.push(body.id);
    }
  }
  const last = snapshot();
  frames.push(last);

  return {
    pucks: bodies.filter((b) => b.live).map(({ id, seat, x, y }) => ({ id, seat, x, y })),
    frames,
    frameMs: PHYSICS.stepsPerFrame * dt * 1000,
    durationMs: Math.round(step * dt * 1000),
    removed,
  };
}
