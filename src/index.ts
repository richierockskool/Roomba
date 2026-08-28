import type { API } from 'homebridge';

import { RoombaPlatform } from './platform.js';
import { PLATFORM_NAME } from './settings.js';

/**
 * Register the Roomba Pro platform with Homebridge.
 */
export default (api: API) => {
  api.registerPlatform(PLATFORM_NAME, RoombaPlatform);
};