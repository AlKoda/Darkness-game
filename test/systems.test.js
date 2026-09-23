import test from 'node:test';
import assert from 'node:assert/strict';
import { canBuildCampfire, createPlayer, cycleState, spendCampfire } from '../src/systems.js';

test('creates role-specific players', () => {
  assert.equal(createPlayer('human').role, 'human');
  assert.ok(createPlayer('monster').speed > createPlayer('human').speed);
});

test('day-night cycle changes after 55 percent', () => {
  assert.equal(cycleState(54, 100).night, false);
  assert.equal(cycleState(55, 100).night, true);
  assert.equal(cycleState(100, 100).progress, 0);
});

test('campfire consumes human resources', () => {
  const player = { ...createPlayer('human'), wood: 4, stone: 2 };
  assert.equal(canBuildCampfire(player), true);
  assert.equal(spendCampfire(player), true);
  assert.deepEqual([player.wood, player.stone], [0, 0]);
  assert.equal(spendCampfire(player), false);
  assert.equal(canBuildCampfire({ ...player, role: 'monster', wood: 20, stone: 20 }), false);
});
