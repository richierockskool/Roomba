import type {
  Logging,
  PlatformConfig,
} from 'homebridge';

import {
  CloudV4Transport,
} from './transports/cloudV4Transport.js';

import type {
  RoombaTransport,
  RoombaTransportState,
} from './transports/roombaTransport.js';

export interface RoombaState {
  isCleaning: boolean;
  isDocked: boolean;
  isCharging: boolean;
  batteryLevel: number;
}

type RoombaStateListener =
  (state: RoombaState) => void;

/**
 * Single owner of Roomba communication and normalized state.
 */
export class RoombaController {

  private state: RoombaState = {
    isCleaning: false,
    isDocked: false,
    isCharging: false,
    batteryLevel: 0,
  };

  private readonly listeners =
    new Set<RoombaStateListener>();

  private readonly transport: RoombaTransport;

  constructor(
    private readonly log: Logging,
    config: PlatformConfig,
  ) {

    const email =
      typeof config.email === 'string'
        ? config.email.trim()
        : '';

    const password =
      typeof config.password === 'string'
        ? config.password
        : '';

    const countryCode =
      typeof config.countryCode === 'string'
        ? config.countryCode
        : 'CA';

    this.transport =
      new CloudV4Transport(
        this.log,
        {
          email,
          password,
          countryCode,
        },
      );

    this.transport.onStateChange(
      this.handleTransportState.bind(this),
    );
  }

  public async connect(): Promise<void> {

    this.log.info(
      `Using Roomba transport: ${this.transport.name}`,
    );

    await this.transport.connect();
  }

  public async disconnect(): Promise<void> {
    await this.transport.disconnect();
  }

  public getState(): RoombaState {

    return {
      ...this.state,
    };
  }

  public onStateChange(
    listener: RoombaStateListener,
  ): void {

    this.listeners.add(listener);

    listener(
      this.getState(),
    );
  }

  public async startCleaning(): Promise<void> {
    await this.transport.startCleaning();
  }

  public async stopCleaning(): Promise<void> {
    await this.transport.stopCleaning();
  }

  public async returnToDock(): Promise<void> {
    await this.transport.returnToDock();
  }

  private handleTransportState(
    transportState: RoombaTransportState,
  ): void {

    this.state = {
      isCleaning:
        transportState.isCleaning,

      isDocked:
        transportState.isDocked,

      isCharging:
        transportState.isCharging,

      batteryLevel:
        transportState.batteryLevel,
    };

    const snapshot =
      this.getState();

    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}