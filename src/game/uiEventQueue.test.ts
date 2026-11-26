import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceUiEventQueue,
  completeActiveUiEvent,
  createUiEventQueueState,
  enqueueUiEvent,
} from './uiEventQueue';

test('UI event queue deduplicates, waits while UI is busy, and runs events strictly one at a time', () => {
  let state = createUiEventQueueState();
  state = enqueueUiEvent(state, 'jean_pool_intro');
  state = enqueueUiEvent(state, 'jean_pool_intro'); // duplicate ignored
  state = enqueueUiEvent(state, 'hiss_depot_intro');

  assert.equal(state.queue.length, 2);
  assert.equal(state.active, null);

  // While UI is busy (e.g., clutch reveal or collection open), nothing activates
  state = advanceUiEventQueue(state, true);
  assert.equal(state.active, null);
  assert.equal(state.queue.length, 2);

  // Once UI is idle, first event activates
  state = advanceUiEventQueue(state, false);
  assert.equal(state.active?.kind, 'jean_pool_intro');
  assert.equal(state.queue.length, 1);

  // Even if idle check runs again, second event waits until first concludes
  state = advanceUiEventQueue(state, false);
  assert.equal(state.active?.kind, 'jean_pool_intro');

  // Complete first event, then while its opened drawer is still open (busy=true), second waits
  state = completeActiveUiEvent(state);
  assert.equal(state.active, null);
  state = advanceUiEventQueue(state, true);
  assert.equal(state.active, null);

  // Once drawer closes (busy=false), second event activates
  state = advanceUiEventQueue(state, false);
  assert.equal(state.active?.kind, 'hiss_depot_intro');
  assert.equal(state.queue.length, 0);

  state = completeActiveUiEvent(state);
  assert.equal(state.active, null);
});
