import type { Logging } from 'homebridge';

export interface V4Credentials {
  email: string;
  password: string;
  countryCode: string;
}

export interface V4Deployment {
  httpBase: string;
  mqttAts: string;
  irbtTopics: string;
  awsRegion: string;
}

export interface V4Robot {
  blid: string;
  name: string;
  sku: string;
  softwareVer?: string;
}

export interface V4Session {
  deployment: V4Deployment;

  iotToken: string;
  iotSignature: string;
  iotAuthorizerName: string;
  iotClientId: string;

  robots: V4Robot[];
}

/**
 * Handles the iRobot V4 authentication lifecycle.
 *
 * Important:
 * This class must never log passwords, IoT tokens,
 * signatures or other authentication secrets.
 */
export class V4Authentication {

  constructor(
    private readonly log: Logging,
    private readonly credentials: V4Credentials,
  ) {
  }

  public async authenticate(): Promise<V4Session> {

    this.log.info(
      'Authenticating with iRobot V4 services...',
    );

    /*
     * Authentication chain:
     *
     * 1. iRobot endpoint discovery
     * 2. Gigya accounts.login
     * 3. iRobot /v2/login
     * 4. Return short-lived IoT session
     *
     * Network implementation comes next.
     */

    throw new Error(
      'V4 authentication network implementation not installed yet.',
    );
  }

  public getCountryCode(): string {

    const countryCode =
      this.credentials.countryCode
        .trim()
        .toUpperCase();

    if (countryCode.length !== 2) {
      return 'CA';
    }

    return countryCode;
  }
}
