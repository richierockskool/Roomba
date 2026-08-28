import type { Logging } from 'homebridge';

import type {
  RoombaTransport,
  RoombaTransportState,
  RoombaTransportStateListener,
} from './roombaTransport.js';

/**
 * CloudV4Transport
 *
 * Communication transport for newer V4 / Prime-generation
 * iRobot Roombas.
 *
 * Authentication and AWS IoT communication will be added
 * in the next patch after configuration is established.
 */
export class CloudV4Transport implements RoombaTransport {

  public readonly name = 'iRobot Cloud V4';

  private state: RoombaTransportState = {
    isCleaning: false,
    isDocked: false,
    isCharging: false,
    batteryLevel: 0,
  };

  private readonly listeners =
    new Set<RoombaTransportStateListener>();

  private connected = false;

  constructor(
    private readonly log: Logging,
  ) {
  }

  public async connect(): Promise<void> {

    if (this.connected) {
      return;
    }

    this.log.info(
      'Cloud V4 transport initializing...',
    );

    /*
     * Real authentication will be added next:
     *
     * 1. iRobot endpoint discovery
     * 2. Gigya authentication
     * 3. iRobot /v2/login
     * 4. AWS IoT MQTT connection
     * 5. Device shadow subscription
     */

    this.connected = true;

    this.log.info(
      'Cloud V4 transport ready for authentication.',
    );
  }

  public async disconnect(): Promise<void> {

    if (!this.connected) {
      return;
    }

    this.connected = false;

    this.log.info(
      'Cloud V4 transport disconnected.',
    );
  }

  public async startCleaning(): Promise<void> {
    await this.sendCommand('start');
  }

  public async pauseCleaning(): Promise<void> {
    await this.sendCommand('pause');
  }

  public async resumeCleaning(): Promise<void> {
    await this.sendCommand('resume');
  }

  public async stopCleaning(): Promise<void> {
    await this.sendCommand('stop');
  }

  public async returnToDock(): Promise<void> {
    await this.sendCommand('dock');
  }

  public getState(): RoombaTransportState {

    return {
      ...this.state,
    };
  }

  public onStateChange(
    listener: RoombaTransportStateListener,
  ): void {

    this.listeners.add(listener);

    listener(
      this.getState(),
    );
  }

  /**
   * V4 command dispatcher.
   *
   * The real implementation will publish:
   *
   * {irbtTopics}/things/{BLID}/cmd
   *
   * with:
   *
   * {
   *   command,
   *   time,
   *   initiator: 'localApp'
   * }
   */
  private async sendCommand(
    command: string,
  ): Promise<void> {

    if (!this.connected) {
      throw new Error(
        'Cloud V4 transport is not connected.',
      );
    }

    this.log.info(
      `Roomba V4 command requested: ${command}`,
    );
  }

  /**
   * Publish normalized robot state to RoombaController.
   */
  private publishState(
    changes: Partial<RoombaTransportState>,
  ): void {

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