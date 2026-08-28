import type { Logging } from 'homebridge';

/**
 * Internal Roomba state.
 *
 * HomeKit should never become the source of truth for robot state.
 * RoombaController owns the state and publishes changes outward.
 */
export interface RoombaState {
  isCleaning: boolean;
  isDocked: boolean;
  isCharging: boolean;
  batteryLevel: number;
}

type RoombaStateListener =
  (state: RoombaState) => void;

/**
 * RoombaController
 *
 * Single owner of Roomba communication and state.
 *
 * During Patch #2 this is intentionally a stub.
 * Real robot communication will be added in the next phase.
 */
export class RoombaController {

  private state: RoombaState = {
    isCleaning: false,
    isDocked: true,
    isCharging: false,
    batteryLevel: 100,
  };

  private readonly listeners =
    new Set<RoombaStateListener>();

  constructor(
    private readonly log: Logging,
  ) {
    this.log.debug(
      'RoombaController initialized.',
    );
  }

  /**
   * Return a snapshot of the latest known robot state.
   */
  public getState(): RoombaState {
    return {
      ...this.state,
    };
  }

  /**
   * Subscribe to robot state changes.
   */
  public onStateChange(
    listener: RoombaStateListener,
  ) {
    this.listeners.add(listener);

    listener(
      this.getState(),
    );
  }

  /**
   * Start cleaning.
   *
   * Stub implementation only.
   */
  public async startCleaning() {

    this.log.info(
      'Roomba command: START CLEANING',
    );

    this.updateState({
      isCleaning: true,
      isDocked: false,
      isCharging: false,
    });
  }

  /**
   * Stop/pause cleaning.
   *
   * Stub implementation only.
   */
  public async stopCleaning() {

    this.log.info(
      'Roomba command: STOP CLEANING',
    );

    this.updateState({
      isCleaning: false,
    });
  }

  /**
   * Send the Roomba back to its dock.
   *
   * Stub implementation only.
   */
  public async returnToDock() {

    this.log.info(
      'Roomba command: RETURN TO DOCK',
    );

    this.updateState({
      isCleaning: false,
      isDocked: true,
      isCharging: true,
    });
  }

  /**
   * Update controller state and notify HomeKit listeners.
   */
  private updateState(
    changes: Partial<RoombaState>,
  ) {

    this.state = {
      ...this.state,
      ...changes,
    };

    const snapshot =
      this.getState();

    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}