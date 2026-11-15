import test from 'node:test';
import assert from 'node:assert/strict';
import { LANES, moveLane, scoreRun, canAvoid, nextSpawnDelay } from './game-logic.js';

test('lane movement is bounded and moves one lane at a time', () => {
  assert.equal(moveLane(1, -1), 0);
  assert.equal(moveLane(1, 1), 2);
  assert.equal(moveLane(0, -1), 0);
  assert.equal(moveLane(2, 1), 2);
  assert.equal(LANES.length, 3);
});

test('score includes distance and crumb bonus', () => {
  assert.equal(scoreRun(123.9, 4), 223);
  assert.equal(scoreRun(100, 2, 50), 200);
  assert.equal(scoreRun(0, 0), 0);
});

test('only the matching timed action avoids jump and slide obstacles', () => {
  assert.equal(canAvoid('jump', 0.3, 0), true);
  assert.equal(canAvoid('jump', 0.1, 1), false);
  assert.equal(canAvoid('slide', 0, 0.2), true);
  assert.equal(canAvoid('block', 1, 1), false);
});

test('spawn delay is deterministic, bounded, and shortens with difficulty', () => {
  assert.equal(nextSpawnDelay(() => 0, 1), 1.48);
  assert.equal(nextSpawnDelay(() => 0.999, 1), 1.9795);
  assert.ok(nextSpawnDelay(() => 0, 2) >= 0.72);
});
