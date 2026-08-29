import type { Logging } from 'homebridge';

import type {
  V4Robot,
  V4Session,
} from './v4Authentication.js';

/**
 * Smart Map helper for Prime / V4-generation Roombas.
 *
 * Phase 1 is deliberately diagnostic-only.
 * It stores the authenticated V4 session and robot
 * information without changing any cleaning behaviour.
 */
export class V4MapClient {

  constructor(
    private readonly log: Logging,
    private readonly session: V4Session,
    private readonly robot: V4Robot,
  ) {
  }

  /**
   * Diagnostic entry point.
   *
   * For now this only confirms that the map client has
   * everything required to begin P2 Smart Map discovery.
   *
   * No robot commands are sent from this method.
   */
  public async discoverRooms(): Promise<void> {

    this.log.info(
      `Starting Roomba V4 Smart Map discovery for ${this.robot.name}.`,
    );

    this.log.info(
      `Roomba V4 map HTTP service: ${this.session.deployment.httpBase}`,
    );

    this.log.info(
      `Roomba V4 map robot BLID available: ${Boolean(this.robot.blid)}`,
    );

    this.log.info(
      'Roomba V4 Smart Map client ready for P2 map discovery.',
    );
  }
}