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
export interface V4Room {
  id: string;
  name: string;
}

export interface V4MapInfo {
  p2mapId: string;
  rooms: V4Room[];
}

/**
 * Smart Map helper for Prime / V4-generation Roombas.
 */
export class V4MapClient {

  private mapInfo?: V4MapInfo;

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

    this.mapInfo =
  this.parseMapResponse(
    payload,
  );

    if (!this.mapInfo) {

      this.log.warn(
        'Roomba V4 Smart Map contained no usable active map.',
      );

      return;
    }

    this.log.info(
      `Roomba V4 Smart Map ready: ${this.mapInfo.rooms.length} named room(s).`,
    );

    for (const room of this.mapInfo.rooms) {

      this.log.info(
        `Roomba room discovered: ${room.name} [${room.id}]`,
      );
    }
  }

  private parseMapResponse(
    payload: unknown,
  ): V4MapInfo | undefined {

    if (!Array.isArray(payload)) {

      this.log.warn(
        'Roomba V4 P2 map response was not an array.',
      );

      return undefined;
    }

    for (const item of payload) {

      const map =
      this.getObject(
        item,
      );

      if (!map) {
        continue;
      }

      const p2mapId =
      this.getString(
        map.p2map_id,
      );

      const state =
      this.getString(
        map.state,
      );

      const visible =
      map.visible === true;

      if (
        !p2mapId ||
      state !== 'active' ||
      !visible
      ) {
        continue;
      }

      const roomsMetadata =
      map.rooms_metadata;

      const rooms: V4Room[] = [];

      if (Array.isArray(roomsMetadata)) {

        for (const item of roomsMetadata) {

          const room =
          this.getObject(
            item,
          );

          if (!room) {
            continue;
          }

          const roomId =
          this.getString(
            room.room_id,
          );

          const metadata =
          this.getObject(
            room.room_metadata,
          );

          const roomName =
          this.getString(
            metadata?.name,
          );

          /**
         * Only expose rooms which the user has
         * actually named in the iRobot app.
         */
          if (
            !roomId ||
          !roomName
          ) {
            continue;
          }

          rooms.push({
            id:
            roomId,

            name:
            roomName,
          });
        }
      }

      return {
        p2mapId,
        rooms,
      };
    }

    return undefined;
  }

  private getObject(
    value: unknown,
  ): UnknownObject | undefined {

    if (
      typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
    ) {

      return value as UnknownObject;
    }

    return undefined;
  }

  private getString(
    value: unknown,
  ): string | undefined {

    if (
      typeof value === 'string' &&
    value.trim().length > 0
    ) {

      return value.trim();
    }

    return undefined;
  }
  public getMapInfo():
V4MapInfo | undefined {

    if (!this.mapInfo) {
      return undefined;
    }

    return {
      p2mapId:
      this.mapInfo.p2mapId,

      rooms:
      this.mapInfo.rooms.map(
        room => ({
          ...room,
        }),
      ),
    };
  }

  public getRooms():
V4Room[] {

    return this.mapInfo?.rooms.map(
      room => ({
        ...room,
      }),
    ) ?? [];
  }
}

