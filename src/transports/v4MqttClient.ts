import type { Logging } from 'homebridge';

import {
  iot,
  mqtt5,
} from 'aws-iot-device-sdk-v2';

import type {
  V4Session,
  V4Robot,
} from './v4Authentication.js';

export interface V4MqttMessage {
  topic: string;
  payload: string;
}

type V4MqttMessageListener =
  (message: V4MqttMessage) => void;

/**
 * Handles the live AWS IoT MQTT connection for
 * newer V4-generation Roombas.
 */
export class V4MqttClient {

  private client?: mqtt5.Mqtt5Client;

  private readonly listeners =
    new Set<V4MqttMessageListener>();

  private connected = false;

  constructor(
    private readonly log: Logging,
    private readonly session: V4Session,
    private readonly robot: V4Robot,
  ) {
  }

  public async connect(): Promise<void> {

    if (this.connected) {
      return;
    }

    this.log.info(
      'Connecting to iRobot AWS IoT...',
    );

    const customAuthConfig:
      iot.MqttConnectCustomAuthConfig = {

        authorizerName:
          this.session.iotAuthorizerName,

        username: '',

        tokenKeyName:
          'x-irobot-auth',

        tokenValue:
          this.session.iotToken,

        /**
         * AWS IoT SDK requires the custom-authorizer
         * signature to be URI encoded.
         */
        tokenSignature:
          encodeURIComponent(
            this.session.iotSignature,
          ),
      };

    const builder =
      iot.AwsIotMqtt5ClientConfigBuilder
        .newDirectMqttBuilderWithCustomAuth(
          this.session.deployment.mqttAts,
          customAuthConfig,
        );

    builder.withConnectProperties({
      clientId:
        this.session.iotClientId,

      keepAliveIntervalSeconds:
        60,
    });

    builder.withMinReconnectDelayMs(
      1_000,
    );

    builder.withMaxReconnectDelayMs(
      10_000,
    );

    const client =
      new mqtt5.Mqtt5Client(
        builder.build(),
      );

    this.client = client;

    client.on(
      'messageReceived',
      (eventData: mqtt5.MessageReceivedEvent) => {

        const topic =
          eventData.message.topicName;

        const payload =
          this.decodePayload(
            eventData.message.payload,
          );

        this.log.debug(
          `Roomba MQTT message received: ${topic}`,
        );

        for (const listener of this.listeners) {
          listener({
            topic,
            payload,
          });
        }
      },
    );

    

    const connectedPromise =
      new Promise<void>(
        (resolve, reject) => {

          const timeout =
            setTimeout(
              () => {
                reject(
                  new Error(
                    'Timed out connecting to iRobot AWS IoT.',
                  ),
                );
              },
              20_000,
            );

          client.once(
            'connectionSuccess',
            () => {

              clearTimeout(timeout);

              this.connected = true;

              this.log.info(
                'Connected to iRobot AWS IoT.',
              );

              resolve();
            },
          );

          client.once(
            'connectionFailure',
            (eventData: mqtt5.ConnectionFailureEvent) => {

              clearTimeout(timeout);

              reject(
                new Error(
                  `iRobot AWS IoT connection failed: ${String(eventData.error)}`,
                  {
                    cause:
        eventData.error,
                  },
                ),
              );
            },
          );
        },
      );

    client.start();

    await connectedPromise;

    await this.subscribeToRobotState();

    await this.requestShadow();
  }
  public async sendCommand(
    command: string,
  ): Promise<void> {

    const client =
    this.requireClient();

    const topic =
    `${this.session.deployment.irbtTopics}` +
    `/things/${this.robot.blid}/cmd`;

    const payload = {
      command,
      time:
      Math.floor(
        Date.now() / 1000,
      ),
      initiator:
      'localApp',
    };

    await client.publish({
      topicName: topic,

      qos:
      mqtt5.QoS.AtLeastOnce,

      payload:
      Buffer.from(
        JSON.stringify(
          payload,
        ),
        'utf8',
      ),
    });

    this.log.info(
      `Roomba command published: ${command}`,
    );
  }
  public async disconnect(): Promise<void> {

    const client =
      this.client;

    if (!client) {
      return;
    }

    this.connected = false;

    try {
      client.stop();
    } finally {
      this.client = undefined;
    }

    this.log.info(
      'Disconnected from iRobot AWS IoT.',
    );
  }

  public onMessage(
    listener: V4MqttMessageListener,
  ): void {

    this.listeners.add(listener);
  }

  /**
   * Subscribe to classic and named-shadow traffic.
   *
   * The V4 protocol still exposes state through
   * AWS IoT device shadows.
   */
  private async subscribeToRobotState():
  Promise<void> {

    const client =
    this.requireClient();

    const blid =
    this.robot.blid;

    const topicFilters = [
      `$aws/things/${blid}/shadow/get/accepted`,
      `$aws/things/${blid}/shadow/update`,
      `$aws/things/${blid}/shadow/update/accepted`,

      `$aws/things/${blid}/shadow/name/ro-currentstate/get/accepted`,
      `$aws/things/${blid}/shadow/name/ro-currentstate/update`,
      `$aws/things/${blid}/shadow/name/ro-currentstate/update/accepted`,

      `$aws/things/${blid}/shadow/name/ro-stats/get/accepted`,
      `$aws/things/${blid}/shadow/name/ro-stats/update`,
      `$aws/things/${blid}/shadow/name/ro-stats/update/accepted`,

      `$aws/things/${blid}/shadow/name/rw-constatus/get/accepted`,
      `$aws/things/${blid}/shadow/name/rw-constatus/update`,
      `$aws/things/${blid}/shadow/name/rw-constatus/update/accepted`,
    ];

    let acceptedCount = 0;

    for (const topicFilter of topicFilters) {

      try {

        const result =
        await client.subscribe({
          subscriptions: [
            {
              topicFilter,
              qos:
                mqtt5.QoS.AtLeastOnce,
            },
          ],
        });

        const reasonCode =
        result.reasonCodes[0];

        if (
          reasonCode !== undefined &&
        reasonCode < 128
        ) {

          acceptedCount += 1;

          this.log.info(
            `Roomba MQTT subscription accepted: ${topicFilter}`,
          );

        } else {

          this.log.warn(
            `Roomba MQTT subscription rejected: ${topicFilter} ` +
          `(reason code ${String(reasonCode)})`,
          );
        }

      } catch (error) {

        const message =
        error instanceof Error
          ? error.message
          : String(error);

        this.log.warn(
          `Roomba MQTT subscription failed: ${topicFilter} — ${message}`,
        );
      }
    }

    if (acceptedCount === 0) {
      throw new Error(
        'All Roomba MQTT state subscriptions were rejected.',
      );
    }

    this.log.info(
      `Roomba MQTT subscriptions ready: ${acceptedCount}/${topicFilters.length} accepted.`,
    );
  }
  private async requestShadow():
    Promise<void> {

    const client =
      this.requireClient();

    const blid =
      this.robot.blid;

    const topics = [
      `$aws/things/${blid}/shadow/get`,
      `$aws/things/${blid}/shadow/name/ro-currentstate/get`,
      `$aws/things/${blid}/shadow/name/ro-stats/get`,
      `$aws/things/${blid}/shadow/name/rw-constatus/get`,
    ];

    for (const topic of topics) {

      await client.publish({
        topicName: topic,

        qos:
          mqtt5.QoS.AtLeastOnce,

        payload:
          Buffer.from(
            '{}',
            'utf8',
          ),
      });
    }

    this.log.info(
      'Requested current Roomba V4 state.',
    );
  }

  private requireClient():
    mqtt5.Mqtt5Client {

    if (
      !this.client ||
      !this.connected
    ) {
      throw new Error(
        'Roomba MQTT client is not connected.',
      );
    }

    return this.client;
  }

  private decodePayload(
    payload: mqtt5.Payload | undefined,
  ): string {

    if (payload === undefined) {
      return '';
    }

    if (typeof payload === 'string') {
      return payload;
    }

    if (payload instanceof ArrayBuffer) {
      return Buffer.from(
        payload,
      ).toString('utf8');
    }

    if (ArrayBuffer.isView(payload)) {
      return Buffer.from(
        payload.buffer,
        payload.byteOffset,
        payload.byteLength,
      ).toString('utf8');
    }

    return JSON.stringify(
      payload,
    );
  }

}