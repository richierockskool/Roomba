import type { Logging } from 'homebridge';

import {
  SignatureV4,
} from '@smithy/signature-v4';

import {
  HttpRequest,
} from '@smithy/protocol-http';

import {
  Sha256,
} from '@aws-crypto/sha256-js';

import type {
  V4Robot,
  V4Session,
} from './v4Authentication.js';

interface UnknownObject {
  [key: string]: unknown;
}

/**
 * Smart Map helper for Prime / V4-generation Roombas.
 */
export class V4MapClient {

  constructor(
    private readonly log: Logging,
    private readonly session: V4Session,
    private readonly robot: V4Robot,
  ) {
  }

  /**
   * Read the visible P2 Smart Maps assigned to this robot.
   *
   * This request is READ ONLY.
   * It does not send any mission or map-edit command.
   */
  public async discoverRooms(): Promise<void> {

    this.log.info(
      `Starting Roomba V4 Smart Map discovery for ${this.robot.name}.`,
    );

    const baseUrl =
      new URL(
        this.session.deployment.httpBaseAuth,
      );

    const requestUrl =
      new URL(
        '/v1/p2maps',
        baseUrl,
      );

    requestUrl.searchParams.set(
      'robotId',
      this.robot.blid,
    );

    requestUrl.searchParams.set(
      'visible',
      'true',
    );

    const signer =
      new SignatureV4({
        credentials: {
          accessKeyId:
            this.session.cloudCredentials.accessKeyId,

          secretAccessKey:
            this.session.cloudCredentials.secretKey,

          sessionToken:
            this.session.cloudCredentials.sessionToken,
        },

        region:
          this.session.deployment.awsRegion,

        service:
          'execute-api',

        sha256:
          Sha256,
      });

    const unsignedRequest =
      new HttpRequest({
        protocol:
          requestUrl.protocol,

        hostname:
          requestUrl.hostname,

        port:
          requestUrl.port
            ? Number(
              requestUrl.port,
            )
            : undefined,

        method:
          'GET',

        path:
          requestUrl.pathname,

        query: {
          robotId:
            this.robot.blid,

          visible:
            'true',
        },

        headers: {
          host:
            requestUrl.host,

          accept:
            'application/json',
        },
      });

    const signedRequest =
      await signer.sign(
        unsignedRequest,
      );

    const headers:
      Record<string, string> = {};

    for (
      const [key, value]
      of Object.entries(
        signedRequest.headers,
      )
    ) {

      if (value !== undefined) {
        headers[key] =
          String(
            value,
          );
      }
    }

    this.log.info(
      'Requesting Roomba V4 P2 Smart Map metadata...',
    );

    const response =
      await fetch(
        requestUrl,
        {
          method:
            'GET',

          headers,
        },
      );

    this.log.info(
      `Roomba V4 P2 map request returned HTTP ${response.status}.`,
    );

    if (!response.ok) {

      const responseText =
        await response.text();

      this.log.warn(
        `Roomba V4 P2 map request failed: ${responseText.slice(0, 500)}`,
      );

      return;
    }

    const payload =
      await response.json() as unknown;

    this.inspectMapResponse(
      payload,
    );
  }

  private inspectMapResponse(
    payload: unknown,
  ): void {

    if (
      typeof payload !== 'object' ||
      payload === null
    ) {

      this.log.warn(
        'Roomba V4 P2 map response was not an object.',
      );

      return;
    }

    const root =
      payload as UnknownObject;

    this.log.info(
      `Roomba V4 P2 map response keys: ${Object.keys(root).join(', ')}`,
    );

    /**
     * Diagnostic only:
     * safely log structure but not credentials.
     */
    this.log.info(
      `Roomba V4 P2 MAP METADATA: ${JSON.stringify(root)}`,
    );
  }
}