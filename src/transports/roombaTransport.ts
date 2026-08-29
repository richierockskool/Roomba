/**
 * Normalized Roomba state.
 *
 * Every transport must translate the robot's native state
 * into this common format.
 *
 * RoombaController and HomeKit never need to know whether
 * the robot is using local MQTT or the newer cloud protocol.
 */
export interface RoombaTransportState {
  isCleaning: boolean;
  isDocked: boolean;
  isCharging: boolean;
  batteryLevel: number;
}

/**
 * Callback used by transports to publish robot state changes.
 */
export type RoombaTransportStateListener =
  (state: RoombaTransportState) => void;

/**
 * Common communication contract for every supported
 * generation of Roomba.
 */
export interface RoombaTransport {

  /**
   * Human-readable transport name used in logging.
   */
  readonly name: string;

  /**
   * Establish communication with the robot.
   */
  connect(): Promise<void>;

  /**
   * Cleanly close communication with the robot.
   */
  disconnect(): Promise<void>;

  /**
   * Start a cleaning mission.
   */
  startCleaning(): Promise<void>;

  /**
 * Start a targeted Smart Map room-cleaning mission.
 */
startRoomCleaning(
  p2mapId: string,
  roomId: string,
): Promise<void>;

  /**
   * Pause the current cleaning mission.
   */
  pauseCleaning(): Promise<void>;

  /**
   * Resume a paused cleaning mission.
   */
  resumeCleaning(): Promise<void>;

  /**
   * Stop the current cleaning mission.
   */
  stopCleaning(): Promise<void>;

  /**
   * Return the robot to its dock.
   */
  returnToDock(): Promise<void>;

  /**
   * Return the latest state known by this transport.
   */
  getState(): RoombaTransportState;

  /**
   * Subscribe to state changes from the robot.
   */
  onStateChange(
    listener: RoombaTransportStateListener,
  ): void;
}
