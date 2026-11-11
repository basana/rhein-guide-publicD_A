'use strict';

const assert = require('node:assert/strict');
const core = require('./map-navi-core-01.js');

function apply(state, type, values) {
  return core.reducer(state, Object.assign({ type }, values || {}));
}

let state = core.createInitialState('profile-default');
assert.equal(core.getActiveTargetId(state), 'profile-default', 'default profile target');

state = apply(state, 'LOCATION_UPDATED', { lat: 50.1, lng: 7.6 });
assert.equal(core.getActiveTargetId(state), 'profile-default', 'GPS must not choose a target');
assert.equal(core.shouldFollowUser(state), true, 'Tourist Follow follows available GPS');

state = apply(state, 'CATEGORY_ACTIVATED', { category: 'toilets', targetNodeId: 'toilet-zone' });
assert.equal(core.getActiveTargetId(state), 'toilet-zone', 'category target takes priority over profile');

state = apply(state, 'SEARCH_ACTIVATED', { query: 'Marksburg', targetNodeId: 'marksburg' });
assert.equal(core.getActiveTargetId(state), 'marksburg', 'search takes priority over category');

state = apply(state, 'NODE_SELECTED', { nodeId: 'stolzenfels' });
assert.equal(core.getActiveTargetId(state), 'stolzenfels', 'selected node has highest priority');

state = apply(state, 'NODE_SELECTION_CLEARED');
assert.equal(core.getActiveTargetId(state), 'marksburg', 'clearing selection restores previous intent');

state = apply(state, 'INTENT_CLEARED');
assert.equal(core.getActiveTargetId(state), 'profile-default', 'clearing intent restores profile default');

state = apply(state, 'USER_PANNED');
assert.equal(state.camera.mode, 'free-view', 'manual pan enters Free View');
assert.equal(core.shouldFollowUser(state), false, 'Free View pauses camera follow');
assert.deepEqual(state.location.coords, { lat: 50.1, lng: 7.6 }, 'Free View preserves GPS coordinates');

state = apply(state, 'CAMERA_MODE_SET', { mode: 'tourist-follow' });
assert.equal(core.shouldFollowUser(state), true, 'Tourist Follow can be resumed explicitly');

const edges = [
  { source: 'A', target: 'B' },
  { source: 'B', target: 'C' },
  { source: 'C', target: 'D' },
  { source: 'A', target: 'E' },
  { source: 'E', target: 'A' }
];
const levels = core.getHighlightLevels('A', edges, 2);
assert.deepEqual(levels, { A: 0, B: 1, E: 1, C: 2 }, 'selected, first and second relationship levels');
assert.equal(Object.prototype.hasOwnProperty.call(levels, 'D'), false, 'third level is outside default highlight depth');
assert.equal(Object.prototype.hasOwnProperty.call(levels, 'unrelated'), false, 'unrelated nodes remain unhighlighted');
assert.deepEqual(core.getHighlightLevels(null, edges, 2), {}, 'no selection means no relationship highlight');

console.log('MAP NAVI Core 0.1: 13 checks passed.');
