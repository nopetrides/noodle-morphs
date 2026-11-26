/**
 * Reusable sequential UI event queue.
 * Waits until all blocking modals/drawers are closed, then activates queued
 * events strictly one at a time until the active event concludes.
 */

export type UiQueueEventKind = 'jean_pool_intro' | 'hiss_depot_intro';

export interface UiQueueEvent {
  kind: UiQueueEventKind;
}

export interface UiEventQueueState {
  queue: UiQueueEvent[];
  active: UiQueueEvent | null;
}

export function createUiEventQueueState(): UiEventQueueState {
  return { queue: [], active: null };
}

/** Enqueues an event if not already active or queued (prevents duplicate triggers). */
export function enqueueUiEvent(
  state: UiEventQueueState,
  kind: UiQueueEventKind
): UiEventQueueState {
  if (state.active?.kind === kind) return state;
  if (state.queue.some((ev) => ev.kind === kind)) return state;
  return {
    ...state,
    queue: [...state.queue, { kind }],
  };
}

/**
 * Advances the queue to the next pending event ONLY when the UI is idle
 * and no event is currently active.
 */
export function advanceUiEventQueue(
  state: UiEventQueueState,
  isUiBusy: boolean
): UiEventQueueState {
  if (isUiBusy || state.active !== null || state.queue.length === 0) {
    return state;
  }
  const [next, ...rest] = state.queue;
  return {
    active: next,
    queue: rest,
  };
}

/** Marks the currently active event as concluded so future idle ticks can advance. */
export function completeActiveUiEvent(state: UiEventQueueState): UiEventQueueState {
  if (state.active === null) return state;
  return {
    ...state,
    active: null,
  };
}
