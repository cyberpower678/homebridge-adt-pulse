/**
 * ADT Pulse Test.
 *
 * Test the ADT Pulse API responses using this script.
 *
 * Arguments:
 *     --username           email@email.com
 *     --password           1234567890
 *     --fingerprint        2-factor authentication token
 *     --country            "us" or "ca"
 *     --action             "device-information", "device-status", "zone-status", "sync", "disarm", "arm-away", "arm-stay", or "arm-night"
 *     --overrideSensorName Sensor name as shown in ADT Pulse
 *     --overrideSensorType "sensor,glass", "sensor,motion", "sensor,co", "sensor,fire", or "sensor,doorWindow"
 *
 * Usage:
 *     node api-test --username ! --password % --country # --action @ --overrideSensorName $ --overrideSensorType ~
 *
 * Replace:
 *     ! - Account username
 *     % - Account password
 *     # - Country
 *     @ - Action type
 *     $ - Override sensor name (optional)
 *     ~ - Override sensor type (optional)
 *
 * @type {function(object): void}
 *
 * @since 1.0.0
 */
const Pulse = require('../api');

/**
 * Script arguments.
 *
 * @since 1.0.0
 */
const username = process.argv.indexOf('--username');
const usernameValue = (username > -1) ? process.argv[username + 1] : '';

const password = process.argv.indexOf('--password');
const passwordValue = (password > -1) ? process.argv[password + 1] : '';

const fingerprint = process.argv.indexOf('--fingerprint');
const fingerprintValue = (fingerprint > -1) ? process.argv[fingerprint + 1] : '';

const country = process.argv.indexOf('--country');
const countryValue = (country > -1) ? process.argv[country + 1] : '';

const action = process.argv.indexOf('--action');
const actionValue = (action > -1) ? process.argv[action + 1] : '';

const overrideSensorName = process.argv.indexOf('--overrideSensorName');
const overrideSensorNameValue = (overrideSensorName > -1) ? process.argv[overrideSensorName + 1] : '';

const overrideSensorType = process.argv.indexOf('--overrideSensorType');
const overrideSensorTypeValue = (overrideSensorType > -1) ? process.argv[overrideSensorType + 1] : '';

/**
 * Sanitize arguments.
 *
 * @since 1.0.0
 */
if (!usernameValue || !passwordValue || !fingerprintValue || !countryValue || !actionValue) {
  if (!usernameValue) {
    console.error('ADT Pulse Test: Username is empty.');
  }

  if (!passwordValue) {
    console.error('ADT Pulse Test: Password is empty.');
  }

  if (!fingerprintValue) {
    console.error('ADT Pulse Test: Fingerprint is empty.');
  }

  if (!countryValue) {
    console.error('ADT Pulse Test: Country is empty.');
  }

  if (!actionValue) {
    console.error('ADT Pulse Test: Action is empty.');
  }

  process.exit(1);
}

/**
 * Initialize main script.
 *
 * @type {Pulse}
 *
 * @since 1.0.0
 */
const pulse = new Pulse({
  username: usernameValue,
  password: passwordValue,
  fingerprint: fingerprintValue,
  overrideSensors: (overrideSensorNameValue && overrideSensorTypeValue) ? [{
    name: overrideSensorNameValue,
    type: overrideSensorTypeValue,
  }] : [],
  country: countryValue,
  debug: true,
});

/**
 * Actions.
 *
 * @since 1.0.0
 */
switch (actionValue) {
  case 'device-information':
    console.log('ADT Pulse Test: Getting device information...');

    pulse
      .login()
      .then((login) => console.log(login))
      .then(() => pulse.getDeviceInformation())
      .then((information) => console.log(information))
      .then(() => pulse.logout())
      .then((logout) => console.log(logout))
      .catch((error) => console.error(error));
    break;
  case 'device-status':
    console.log('ADT Pulse Test: Getting device status...');

    pulse
      .login()
      .then((login) => console.log(login))
      .then(() => pulse.getDeviceStatus())
      .then((status) => console.log(status))
      .then(() => pulse.logout())
      .then((logout) => console.log(logout))
      .catch((error) => console.error(error));
    break;
  case 'zone-status':
    console.log('ADT Pulse Test: Getting zone status...');

    pulse
      .login()
      .then((login) => console.log(login))
      .then(() => pulse.getZoneStatus())
      .then((statuses) => console.log(statuses))
      .then(() => pulse.logout())
      .then((logout) => console.log(logout))
      .catch((error) => console.error(error));
    break;
  case 'sync':
    console.log('ADT Pulse Test: Performing portal sync...');

    pulse
      .login()
      .then((login) => console.log(login))
      .then(() => pulse.performPortalSync())
      .then((syncCode) => console.log(syncCode))
      .then(() => pulse.logout())
      .then((logout) => console.log(logout))
      .catch((error) => console.error(error));
    break;
  case 'disarm':
    console.log('ADT Pulse Test: Disarming...');

    pulse
      .login()
      .then((login) => console.log(login))
      .then(() => pulse.getDeviceStatus())
      .then((status) => console.log(status))
      .then(async () => {
        /**
         * setDeviceStatus function may fail because a wrong armState was set.
         */
        await pulse
          .setDeviceStatus('away', 'off')
          .then((response) => console.log(response))
          .catch((error) => console.error(error));
      })
      .then(() => {
        setTimeout(() => {
          pulse
            .getDeviceStatus()
            .then((status) => console.log(status))
            .then(() => pulse.logout())
            .then((logout) => console.log(logout))
            .catch((error) => console.error(error));
        }, 1000);
      })
      .catch((error) => console.error(error));
    break;
  case 'arm-away':
    console.log('ADT Pulse Test: Arming away...');

    pulse
      .login()
      .then((login) => console.log(login))
      .then(() => pulse.getDeviceStatus())
      .then((status) => console.log(status))
      .then(async () => {
        /**
         * setDeviceStatus function may fail because a wrong armState was set.
         */
        await pulse
          .setDeviceStatus('disarmed', 'away')
          .then((response) => console.log(response))
          .catch((error) => console.error(error));
      })
      .then(() => {
        setTimeout(() => {
          pulse
            .getDeviceStatus()
            .then((status) => console.log(status))
            .then(() => pulse.logout())
            .then((logout) => console.log(logout))
            .catch((error) => console.error(error));
        }, 1000);
      })
      .catch((error) => console.error(error));
    break;
  case 'arm-stay':
    console.log('ADT Pulse Test: Arming stay...');

    pulse
      .login()
      .then((login) => console.log(login))
      .then(() => pulse.getDeviceStatus())
      .then((status) => console.log(status))
      .then(async () => {
        /**
         * setDeviceStatus function may fail because a wrong armState was set.
         */
        await pulse
          .setDeviceStatus('disarmed', 'stay')
          .then((response) => console.log(response))
          .catch((error) => console.error(error));
      })
      .then(() => {
        setTimeout(() => {
          pulse
            .getDeviceStatus()
            .then((status) => console.log(status))
            .then(() => pulse.logout())
            .then((logout) => console.log(logout))
            .catch((error) => console.error(error));
        }, 1000);
      })
      .catch((error) => console.error(error));
    break;
  case 'arm-night':
    console.log('ADT Pulse Test: Arming night...');

    pulse
      .login()
      .then((login) => console.log(login))
      .then(() => pulse.getDeviceStatus())
      .then((status) => console.log(status))
      .then(async () => {
        /**
         * setDeviceStatus function may fail because a wrong armState was set.
         */
        await pulse
          .setDeviceStatus('disarmed', 'night')
          .then((response) => console.log(response))
          .catch((error) => console.error(error));
      })
      .then(() => {
        setTimeout(() => {
          pulse
            .getDeviceStatus()
            .then((status) => console.log(status))
            .then(() => pulse.logout())
            .then((logout) => console.log(logout))
            .catch((error) => console.error(error));
        }, 1000);
      })
      .catch((error) => console.error(error));
    break;
  default:
    console.error(`ADT Pulse Test: Unknown action type ${actionValue}.`);
    break;
}
