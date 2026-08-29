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

import {
  V4MqttClient,
  type V4MqttMessage,
} from './v4MqttClient.js';

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
  private mqttClient?: V4MqttClient;

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

    /**
     * Step 1:
     * Authenticate with iRobot and obtain the
     * short-lived AWS IoT session.
     */
    const session =
      await this.authentication.authenticate();

    const robot =
      session.robots[0];

    if (!robot) {
      throw new Error(
        'No supported Roomba was returned by the iRobot account.',
      );
    }

    this.session =
      session;

    this.log.info(
      `Cloud V4 authenticated for ${robot.name} (${robot.sku}).`,
    );

    /**
     * Step 2:
     * Establish the live AWS IoT MQTT connection.
     */
    const mqttClient =
      new V4MqttClient(
        this.log,
        session,
        robot,
      );

    mqttClient.onMessage(
      this.handleMqttMessage.bind(this),
    );

    this.mqttClient =
      mqttClient;

    try {

      await mqttClient.connect();

    } catch (error) {

      this.mqttClient = undefined;
      this.session = undefined;

      throw error;
    }

    this.connected = true;

    this.log.info(
      `Cloud V4 transport fully connected to ${robot.name} (${robot.sku}).`,
    );
  }

  public async disconnect(): Promise<void> {

    this.connected = false;

    const mqttClient =
      this.mqttClient;

    this.mqttClient = undefined;
    this.session = undefined;

    if (mqttClient) {
      await mqttClient.disconnect();
    }

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
   * Receive raw MQTT traffic from the Roomba.
   *
   * For this checkpoint we intentionally log the topic
   * and payload only.
   *
   * Once we know the exact Roomba 105 shadow structure,
   * the next patch will normalize battery, mission,
   * dock and charging state.
   */
  private handleMqttMessage(
    message: V4MqttMessage,
  ): void {

    this.log.info(
      `Roomba V4 MQTT topic: ${message.topic}`,
    );

    if (message.payload.length > 0) {

      this.log.info(
        `Roomba V4 MQTT payload: ${message.payload}`,
      );
    }
  }

  /**
   * Command publishing deliberately remains disabled.
   *
   * First we prove stable inbound state from the
   * physical Roomba before allowing HomeKit to move it.
   */
  private async sendCommand(
    command: string,
  ): Promise<void> {

    if (
      !this.connected ||
      !this.session ||
      !this.mqttClient
    ) {
      throw new Error(
        'Cloud V4 transport is not connected.',
      );
    }

    throw new Error(
      `Roomba command "${command}" is not enabled until V4 state parsing is verified.`,
    );
  }
}