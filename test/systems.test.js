import test from 'node:test';
import assert from 'node:assert/strict';
import { canAfford, canBuildCampfire, canBuildSettlement, createPlayer, createResource, cycleState, spendBuilding, spendCampfire, spendSettlement, strikeResource, updateResourceState } from '../src/systems.js';

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

test('trees only provide wood after falling and being destroyed', () => {
  const tree = createResource('tree', 10, 20);
  assert.deepEqual(strikeResource(tree, 100), { hit: true });
  strikeResource(tree, 200);
  assert.deepEqual(strikeResource(tree, 300), { hit: true, felled: true });
  assert.equal(tree.state, 'falling');
  assert.deepEqual(strikeResource(tree, 400), { hit: false });
  updateResourceState(tree, 950);
  assert.equal(tree.state, 'fallen');
  assert.deepEqual(strikeResource(tree, 1000), { hit: true });
  assert.deepEqual(strikeResource(tree, 1100), { hit: true, collected: { wood: 4 } });
  assert.equal(tree.state, 'destroyed');
});

test('rocks take three strikes and respawn', () => {
  const rock = createResource('rock', 10, 20);
  strikeResource(rock, 100);
  strikeResource(rock, 200);
  assert.deepEqual(strikeResource(rock, 300), { hit: true, collected: { stone: 3 } });
  updateResourceState(rock, 12299);
  assert.equal(rock.state, 'destroyed');
  updateResourceState(rock, 12300);
  assert.equal(rock.state, 'whole');
});

test('settlement consumes resources for humans only', () => {
  const player = { ...createPlayer('human'), wood: 8, stone: 6 };
  assert.equal(canBuildSettlement(player), true);
  assert.equal(spendSettlement(player), true);
  assert.deepEqual([player.wood, player.stone], [0, 0]);
  assert.equal(canBuildSettlement({ ...player, role: 'monster', wood: 20, stone: 20 }), false);
});

test('watchtowers and walls use the shared building economy', () => {
  const player = { ...createPlayer('human'), wood: 8, stone: 6 };
  assert.equal(canAfford(player, 'watchtower'), true);
  assert.equal(spendBuilding(player, 'watchtower'), true);
  assert.deepEqual([player.wood, player.stone], [2, 2]);
  assert.equal(spendBuilding(player, 'wall'), true);
  assert.deepEqual([player.wood, player.stone], [0, 0]);
  assert.equal(spendBuilding(player, 'unknown'), false);
  assert.equal(canAfford({ ...player, role: 'monster', wood: 99, stone: 99 }, 'wall'), false);
});
