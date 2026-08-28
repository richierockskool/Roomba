import type {
  CharacteristicValue,
  PlatformAccessory,
  Service,
} from 'homebridge';

import type { RoombaPlatform } from './platform.js';

import {
  RoombaController,
  type RoombaState,
} from './roombaController.js';

/**
 * HomeKit representation of one Roomba.
 */
export class RoombaAccessory {

  private readonly controller: RoombaController;

  private readonly cleaningService: Service;
  private readonly dockService: Service;
  private readonly batteryService: Service;

  constructor(
    private readonly platform: RoombaPlatform,
    private readonly accessory: PlatformAccessory,
  ) {

    this.controller =
      new RoombaController(
        this.platform.log,
      );

    /**
     * Accessory information
     */
    this.accessory
      .getService(
        this.platform.Service.AccessoryInformation,
      )!
      .setCharacteristic(
        this.platform.Characteristic.Manufacturer,
        'iRobot',
      )
      .setCharacteristic(
        this.platform.Characteristic.Model,
        'Roomba',
      )
      .setCharacteristic(
        this.platform.Characteristic.SerialNumber,
        'Not Connected',
      );

    /**
     * Cleaning switch
     */
    this.cleaningService =
      this.accessory.getService('Cleaning') ||
      this.accessory.addService(
        this.platform.Service.Switch,
        'Cleaning',
        'roomba-cleaning',
      );

    this.cleaningService
      .setCharacteristic(
        this.platform.Characteristic.Name,
        'Cleaning',
      );

    this.cleaningService
      .getCharacteristic(
        this.platform.Characteristic.On,
      )
      .onSet(
        this.setCleaning.bind(this),
      )
      .onGet(
        this.getCleaning.bind(this),
      );

    /**
     * Return to Dock switch
     */
    this.dockService =
      this.accessory.getService('Return to Dock') ||
      this.accessory.addService(
        this.platform.Service.Switch,
        'Return to Dock',
        'roomba-dock',
      );

    this.dockService
      .setCharacteristic(
        this.platform.Characteristic.Name,
        'Return to Dock',
      );

    this.dockService
      .getCharacteristic(
        this.platform.Characteristic.On,
      )
      .onSet(
        this.setDock.bind(this),
      );

    /**
     * Battery
     */
    this.batteryService =
      this.accessory.getService(
        this.platform.Service.Battery,
      ) ||
      this.accessory.addService(
        this.platform.Service.Battery,
        'Roomba Battery',
      );

    /**
     * Listen for all state updates from RoombaController.
     */
    this.controller.onStateChange(
      this.handleStateUpdate.bind(this),
    );

    this.platform.log.info(
      'Roomba accessory ready:',
      this.accessory.displayName,
    );
  }

  /**
   * Cleaning switch changed from Apple Home.
   */
  private async setCleaning(
    value: CharacteristicValue,
  ) {

    const requestedOn =
      value as boolean;

    if (requestedOn) {
      await this.controller.startCleaning();
    } else {
      await this.controller.stopCleaning();
    }
  }

  /**
   * HomeKit asks for current cleaning state.
   */
  private async getCleaning():
    Promise<CharacteristicValue> {

    return this.controller
      .getState()
      .isCleaning;
  }

  /**
   * Return-to-dock switch.
   *
   * This is treated as a momentary command.
   * Once triggered it automatically returns OFF.
   */
  private async setDock(
    value: CharacteristicValue,
  ) {

    const requestedOn =
      value as boolean;

    if (!requestedOn) {
      return;
    }

    await this.controller.returnToDock();

    this.dockService.updateCharacteristic(
      this.platform.Characteristic.On,
      false,
    );
  }

  /**
   * Push controller state into HomeKit.
   */
  private handleStateUpdate(
    state: RoombaState,
  ) {

    this.cleaningService.updateCharacteristic(
      this.platform.Characteristic.On,
      state.isCleaning,
    );

    this.batteryService.updateCharacteristic(
      this.platform.Characteristic.BatteryLevel,
      state.batteryLevel,
    );

    this.batteryService.updateCharacteristic(
      this.platform.Characteristic.StatusLowBattery,
      state.batteryLevel <= 20
        ? this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW
        : this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL,
    );

    this.batteryService.updateCharacteristic(
      this.platform.Characteristic.ChargingState,
      state.isCharging
        ? this.platform.Characteristic.ChargingState.CHARGING
        : this.platform.Characteristic.ChargingState.NOT_CHARGING,
    );

    this.platform.log.debug(
      'Roomba state:',
      `cleaning=${state.isCleaning}`,
      `docked=${state.isDocked}`,
      `charging=${state.isCharging}`,
      `battery=${state.batteryLevel}%`,
    );
  }
}