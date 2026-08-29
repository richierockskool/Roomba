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

    this.log.debug(
      `Roomba V4 MQTT topic: ${message.topic}`,
    );

    if (message.payload.length === 0) {
      return;
    }

    let payload: unknown;

    try {

      payload =
      JSON.parse(
        message.payload,
      );

    } catch {

      this.log.warn(
        `Roomba V4 MQTT payload was not valid JSON: ${message.topic}`,
      );

      return;
    }

    if (
      typeof payload !== 'object' ||
    payload === null
    ) {
      return;
    }

    const root =
    payload as Record<string, unknown>;

    const state =
    this.getObject(
      root.state,
    );

    const reported =
    this.getObject(
      state?.reported,
    );

    if (!reported) {
      return;
    }

    /**
   * ro-currentstate
   */
    if (
      message.topic.includes(
        '/shadow/name/ro-currentstate/',
      )
    ) {

      const batteryLevel =
      this.getNumber(
        reported.batPct,
      );

      const missionStatus =
      this.getObject(
        reported.cleanMissionStatus,
      );

      const phase =
      this.getString(
        missionStatus?.phase,
      );

      const cycle =
      this.getString(
        missionStatus?.cycle,
      );

      const isCleaning =
      phase === 'run' ||
      phase === 'resume' ||
      cycle === 'clean';

      const isCharging =
      phase === 'charge';

      const isDocked =
      phase === 'charge' ||
      phase === 'dock';

      const changes:
      Partial<RoombaTransportState> = {};

      if (batteryLevel !== undefined) {
        changes.batteryLevel =
        Math.max(
          0,
          Math.min(
            100,
            Math.round(
              batteryLevel,
            ),
          ),
        );
      }

      changes.isCleaning =
      isCleaning;

      changes.isCharging =
      isCharging;

      changes.isDocked =
      isDocked;

      this.updateState(
        changes,
      );

      this.log.info(
        'Roomba state updated:',
        `battery=${this.state.batteryLevel}%`,
        `cleaning=${this.state.isCleaning}`,
        `charging=${this.state.isCharging}`,
        `docked=${this.state.isDocked}`,
        `phase=${phase ?? 'unknown'}`,
        `cycle=${cycle ?? 'unknown'}`,
      );

      return;
    }

    /**
   * rw-constatus
   */
    if (
      message.topic.includes(
        '/shadow/name/rw-constatus/',
      )
    ) {

      const connected =
      this.getBoolean(
        reported.connected,
      );

      if (connected !== undefined) {

        this.log.debug(
          `Roomba cloud connection state: connected=${connected}`,
        );
      }
    }
  }
  private updateState(
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

  private getObject(
    value: unknown,
  ): Record<string, unknown> | undefined {

    if (
      typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
    ) {
      return value as Record<string, unknown>;
    }

    return undefined;
  }

  private getString(
    value: unknown,
  ): string | undefined {

    if (
      typeof value === 'string' &&
    value.length > 0
    ) {
      return value;
    }

    return undefined;
  }

  private getNumber(
    value: unknown,
  ): number | undefined {

    if (
      typeof value === 'number' &&
    Number.isFinite(value)
    ) {
      return value;
    }

    return undefined;
  }

  private getBoolean(
    value: unknown,
  ): boolean | undefined {

    if (typeof value === 'boolean') {
      return value;
    }

    return undefined;
  }
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