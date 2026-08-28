import type { Logging } from 'homebridge';

import type {
  RoombaTransport,
  RoombaTransportState,
  RoombaTransportStateListener,
} from './roombaTransport.js';

import {
  V4Authentication,
  type V4Credentials,
  type V4Session,
} from './v4Authentication.js';

/**
 * Cloud transport for newer V4-generation iRobot robots.
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

  private readonly authentication: V4Authentication;

  private session?: V4Session;
  private connected = false;

  constructor(
    private readonly log: Logging,
    credentials: V4Credentials,
  ) {

    this.authentication =
      new V4Authentication(
        this.log,
        credentials,
      );
  }

  public async connect(): Promise<void> {

    if (this.connected) {
      return;
    }

    this.log.info(
      'Connecting iRobot Cloud V4 transport...',
    );

    this.session =
      await this.authentication.authenticate();

    const robot =
      this.session.robots[0];

    if (!robot) {
      throw new Error(
        'No supported Roomba was returned by the iRobot account.',
      );
    }

    this.connected = true;

    this.log.info(
      `Cloud V4 transport connected to ${robot.name} (${robot.sku}).`,
    );

    /*
     * AWS IoT MQTT connection comes next.
     *
     * At this checkpoint we have intentionally stopped
     * after successful account/robot discovery.
     */
  }

  public async disconnect(): Promise<void> {

    if (!this.connected) {
      return;
    }

    this.connected = false;
    this.session = undefined;

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

  private async sendCommand(
    command: string,
  ): Promise<void> {

    if (!this.connected || !this.session) {
      throw new Error(
        'Cloud V4 transport is not connected.',
      );
    }

    /*
     * Deliberately blocked until MQTT is installed.
     *
     * We do NOT pretend a command succeeded merely because
     * HomeKit requested it.
     */
    throw new Error(
      `Roomba command "${command}" is not available until the V4 MQTT connection is established.`,
    );
  }
}