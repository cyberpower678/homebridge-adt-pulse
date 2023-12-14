import chalk from 'chalk';
import {
  arch,
  argv,
  env,
  platform,
  versions,
} from 'node:process';
import { serializeError } from 'serialize-error';

import { ADTPulseAccessory } from '@/lib/accessory.js';
import { ADTPulse } from '@/lib/api.js';
import {
  detectedNewGatewayInformation,
  detectedNewPanelInformation,
  detectedNewPanelStatus,
  detectedNewPortalVersion,
  detectedNewSensorsInformation,
  detectedNewSensorsStatus,
} from '@/lib/detect.js';
import { platformConfig } from '@/lib/schema.js';
import {
  condenseSensorType,
  findIndexWithValue,
  generateHash,
  getAccessoryCategory,
  getPluralForm,
  sleep,
  stackTracer,
} from '@/lib/utility.js';
import type {
  ADTPulsePlatformAccessories,
  ADTPulsePlatformAddAccessoryDevice,
  ADTPulsePlatformAddAccessoryReturns,
  ADTPulsePlatformAddAccessoryTypedNewAccessory,
  ADTPulsePlatformApi,
  ADTPulsePlatformCharacteristic,
  ADTPulsePlatformConfig,
  ADTPulsePlatformConfigureAccessoryAccessory,
  ADTPulsePlatformConfigureAccessoryReturns,
  ADTPulsePlatformConstants,
  ADTPulsePlatformConstructorApi,
  ADTPulsePlatformConstructorConfig,
  ADTPulsePlatformConstructorLog,
  ADTPulsePlatformDebugMode,
  ADTPulsePlatformFetchUpdatedInformationReturns,
  ADTPulsePlatformHandlers,
  ADTPulsePlatformInstance,
  ADTPulsePlatformLog,
  ADTPulsePlatformPlugin,
  ADTPulsePlatformPollAccessoriesDevices,
  ADTPulsePlatformPollAccessoriesReturns,
  ADTPulsePlatformPrintSystemInformationReturns,
  ADTPulsePlatformRemoveAccessoryAccessory,
  ADTPulsePlatformRemoveAccessoryReturns,
  ADTPulsePlatformService,
  ADTPulsePlatformState,
  ADTPulsePlatformSynchronizeKeepAliveReturns,
  ADTPulsePlatformSynchronizeReturns,
  ADTPulsePlatformSynchronizeSyncCheckReturns,
  ADTPulsePlatformUnifyDevicesDevices,
  ADTPulsePlatformUnifyDevicesId,
  ADTPulsePlatformUnifyDevicesReturns,
  ADTPulsePlatformUpdateAccessoryDevice,
  ADTPulsePlatformUpdateAccessoryReturns,
} from '@/types/index.d.ts';

/**
 * ADT Pulse Platform.
 *
 * @since 1.0.0
 */
export class ADTPulsePlatform implements ADTPulsePlatformPlugin {
  /**
   * ADT Pulse Platform - Accessories.
   *
   * @private
   *
   * @since 1.0.0
   */
  #accessories: ADTPulsePlatformAccessories;

  /**
   * ADT Pulse Platform - Api.
   *
   * @private
   *
   * @since 1.0.0
   */
  readonly #api: ADTPulsePlatformApi;

  /**
   * ADT Pulse Platform - Characteristic.
   *
   * @private
   *
   * @since 1.0.0
   */
  readonly #characteristic: ADTPulsePlatformCharacteristic;

  /**
   * ADT Pulse Platform - Config.
   *
   * @private
   *
   * @since 1.0.0
   */
  #config: ADTPulsePlatformConfig;

  /**
   * ADT Pulse Platform - Constants.
   *
   * @private
   *
   * @since 1.0.0
   */
  #constants: ADTPulsePlatformConstants;

  /**
   * ADT Pulse Platform - Debug mode.
   *
   * @private
   *
   * @since 1.0.0
   */
  readonly #debugMode: ADTPulsePlatformDebugMode;

  /**
   * ADT Pulse Platform - Handlers.
   *
   * @private
   *
   * @since 1.0.0
   */
  readonly #handlers: ADTPulsePlatformHandlers;

  /**
   * ADT Pulse Platform - Instance.
   *
   * @private
   *
   * @since 1.0.0
   */
  #instance: ADTPulsePlatformInstance;

  /**
   * ADT Pulse Platform - Log.
   *
   * @private
   *
   * @since 1.0.0
   */
  readonly #log: ADTPulsePlatformLog;

  /**
   * ADT Pulse Platform - Service.
   *
   * @private
   *
   * @since 1.0.0
   */
  readonly #service: ADTPulsePlatformService;

  /**
   * ADT Pulse Platform - State.
   *
   * @private
   *
   * @since 1.0.0
   */
  #state: ADTPulsePlatformState;

  /**
   * ADT Pulse Platform - Constructor.
   *
   * @param {ADTPulsePlatformConstructorLog}    log    - Log.
   * @param {ADTPulsePlatformConstructorConfig} config - Config.
   * @param {ADTPulsePlatformConstructorApi}    api    - Api.
   *
   * @since 1.0.0
   */
  constructor(log: ADTPulsePlatformConstructorLog, config: ADTPulsePlatformConstructorConfig, api: ADTPulsePlatformConstructorApi) {
    this.#accessories = [];
    this.#api = api;
    this.#characteristic = api.hap.Characteristic;
    this.#config = null;
    this.#constants = {
      intervalTimestamps: {
        adtKeepAlive: 538000, // 8.9666666667 minutes.
        adtSyncCheck: 3000, // 3 seconds.
        suspendSyncing: 1800000, // 30 minutes.
        synchronize: 1000, // 1 second.
      },
      maxLoginRetries: 3,
    };
    this.#debugMode = argv.includes('-D') || argv.includes('--debug');
    this.#handlers = {};
    this.#instance = null;
    this.#log = log;
    this.#service = api.hap.Service;
    this.#state = {
      activity: {
        isAdtKeepingAlive: false,
        isAdtSyncChecking: false,
        isLoggingIn: false,
        isSyncing: false,
      },
      data: {
        gatewayInfo: null,
        panelInfo: null,
        panelStatus: null,
        sensorsInfo: [],
        sensorsStatus: [],
        syncCode: '1-0-0',
      },
      eventCounters: {
        failedLogins: 0,
      },
      intervals: {
        synchronize: undefined,
      },
      lastRunOn: {
        adtKeepAlive: 0, // January 1, 1970, at 00:00:00 UTC.
        adtSyncCheck: 0, // January 1, 1970, at 00:00:00 UTC.
      },
      reportedHashes: [],
    };

    // Parsed Homebridge platform configuration.
    const parsedConfig = platformConfig.safeParse(config);

    // Check for a valid platform configuration before initializing.
    if (!parsedConfig.success) {
      this.#log.error('Plugin is unable to initialize due to an invalid platform configuration.');
      stackTracer('zod-error', parsedConfig.error.errors);

      return;
    }

    // Start plugin here after Homebridge has restored all cached accessories from disk.
    api.on('didFinishLaunching', async () => {
      // Assign the parsed config.
      this.#config = parsedConfig.data;

      // Initialize the API instance.
      this.#instance = new ADTPulse(
        this.#config,
        {
          // If Homebridge debug mode, set "this instance" to debug mode as well.
          debug: this.#debugMode === true,
          logger: this.#log,
        },
      );

      // Print the system information into logs.
      this.printSystemInformation();

      // Give notice to users this plugin is being anonymously tracked.
      this.#log.info(`${chalk.bold.underline('TRANSPARENCY NOTICE')}: Plugin gathers anonymous analytics to detect potential issues. Warnings will appear when analytics are sent.`);

      // If the config specifies that plugin should be paused.
      if (this.#config.pause === true) {
        this.#log.warn('Plugin is now paused and all related accessories will no longer respond.');

        return;
      }

      // If the config specifies that plugin should be reset.
      if (this.#config.reset === true) {
        this.#log.warn('Plugin is now removing all related accessories from Homebridge ...');

        // Remove all related accessories from Homebridge.
        for (let i = this.#accessories.length - 1; i >= 0; i -= 1) {
          this.removeAccessory(this.#accessories[i]);
        }

        return;
      }

      // Start synchronization with the portal.
      this.synchronize();
    });
  }

  /**
   * ADT Pulse Platform - Configure accessory.
   *
   * @param {ADTPulsePlatformConfigureAccessoryAccessory} accessory - Accessory.
   *
   * @returns {ADTPulsePlatformConfigureAccessoryReturns}
   *
   * @since 1.0.0
   */
  configureAccessory(accessory: ADTPulsePlatformConfigureAccessoryAccessory): ADTPulsePlatformConfigureAccessoryReturns {
    this.#log.info(`Configuring cached accessory for ${accessory.context.name} (id: ${accessory.context.id}, uuid: ${accessory.context.hap.uuid}) ...`);

    // Add the restored accessory to the accessories cache.
    this.#accessories.push(accessory);
  }

  /**
   * ADT Pulse Platform - Add accessory.
   *
   * @param {ADTPulsePlatformAddAccessoryDevice} device - Device.
   *
   * @returns {ADTPulsePlatformAddAccessoryReturns}
   *
   * @since 1.0.0
   */
  addAccessory(device: ADTPulsePlatformAddAccessoryDevice): ADTPulsePlatformAddAccessoryReturns {
    const accessoryIndex = this.#accessories.findIndex((accessory) => device.hap.uuid === accessory.context.hap.uuid);

    if (accessoryIndex >= 0) {
      this.#log.error(`Cannot add ${device.name} (id: ${device.id}, uuid: ${device.hap.uuid}) accessory that already exists ...`);

      return;
    }

    // Create the new accessory without context.
    const newAccessory = new this.#api.platformAccessory(
      device.name,
      device.hap.uuid,
      getAccessoryCategory(device.hap.category),
    );

    // Set the context into the new accessory.
    newAccessory.context = device;

    // Let TypeScript know that the context now exists. This creates additional runtime.
    const typedAccessory = newAccessory as ADTPulsePlatformAddAccessoryTypedNewAccessory;

    this.#log.info(`Adding ${typedAccessory.context.name} (id: ${typedAccessory.context.id}, uuid: ${typedAccessory.context.hap.uuid}) accessory ...`);

    // Create the handler for the new accessory if it does not exist.
    if (this.#handlers[device.id] === undefined) {
      // All arguments are passed by reference.
      this.#handlers[device.id] = new ADTPulseAccessory(typedAccessory, this.#service, this.#characteristic, this.#log);
    }

    // Save the new accessory into the accessories cache.
    this.#accessories.push(typedAccessory);

    this.#api.registerPlatformAccessories(
      'homebridge-adt-pulse',
      'ADTPulse',
      [typedAccessory],
    );
  }

  /**
   * ADT Pulse Platform - Update accessory.
   *
   * @param {ADTPulsePlatformUpdateAccessoryDevice} device - Device.
   *
   * @returns {ADTPulsePlatformUpdateAccessoryReturns}
   *
   * @since 1.0.0
   */
  updateAccessory(device: ADTPulsePlatformUpdateAccessoryDevice): ADTPulsePlatformUpdateAccessoryReturns {
    const { index, value } = findIndexWithValue(
      this.#accessories,
      (accessory) => device.hap.uuid === accessory.context.hap.uuid,
    );

    if (index < 0 || value === undefined) {
      this.#log.warn(`Attempted to update ${device.name} (id: ${device.id}, uuid: ${device.hap.uuid}) accessory that does not exist ...`);

      return;
    }

    this.#log.debug(`Updating ${value.context.name} (id: ${value.context.id}, uuid: ${value.context.hap.uuid}) accessory ...`);

    // Set the context into the existing accessory.
    value.context = device;

    // Update the display name.
    value.displayName = device.name;

    // Create the handler for the existing accessory if it does not exist.
    if (this.#handlers[device.id] === undefined) {
      // All arguments are passed by reference.
      this.#handlers[device.id] = new ADTPulseAccessory(value, this.#service, this.#characteristic, this.#log);
    }

    // Update the existing accessory in the accessories cache.
    this.#accessories[index] = value;

    this.#api.updatePlatformAccessories(
      [value],
    );
  }

  /**
   * ADT Pulse Platform - Remove accessory.
   *
   * @param {ADTPulsePlatformRemoveAccessoryAccessory} accessory - Accessory.
   *
   * @returns {ADTPulsePlatformRemoveAccessoryReturns}
   *
   * @since 1.0.0
   */
  removeAccessory(accessory: ADTPulsePlatformRemoveAccessoryAccessory): ADTPulsePlatformRemoveAccessoryReturns {
    this.#log.info(`Removing ${accessory.context.name} (id: ${accessory.context.id}, uuid: ${accessory.context.hap.uuid}) accessory ...`);

    // Keep only the accessories in the cache that is not the accessory being removed.
    this.#accessories = this.#accessories.filter((existingAccessory) => existingAccessory.context.hap.uuid !== accessory.context.hap.uuid);

    this.#api.unregisterPlatformAccessories(
      'homebridge-adt-pulse',
      'ADTPulse',
      [accessory],
    );
  }

  /**
   * ADT Pulse Platform - Print system information.
   *
   * @private
   *
   * @returns {ADTPulsePlatformPrintSystemInformationReturns}
   *
   * @since 1.0.0
   */
  private printSystemInformation(): ADTPulsePlatformPrintSystemInformationReturns {
    const homebridgeVersion = chalk.yellowBright(`v${this.#api.serverVersion}`);
    const nodeVersion = chalk.blueBright(`v${versions.node}`);
    const opensslVersion = chalk.magentaBright(`v${versions.openssl}`);
    const packageVersion = chalk.greenBright(`v${env.npm_package_version}`);
    const platformPlusArch = chalk.redBright(`${platform} (${arch})`);

    this.#log.info([
      `running on ${platformPlusArch}`,
      `homebridge-adt-pulse ${packageVersion}`,
      `homebridge ${homebridgeVersion}`,
      `node ${nodeVersion}`,
      `openssl ${opensslVersion}`,
    ].join(chalk.gray(' // ')));
  }

  /**
   * ADT Pulse Platform - Synchronize.
   *
   * @private
   *
   * @returns {ADTPulsePlatformSynchronizeReturns}
   *
   * @since 1.0.0
   */
  private synchronize(): ADTPulsePlatformSynchronizeReturns {
    this.#state.intervals.synchronize = setInterval(async () => {
      // If currently syncing.
      if (this.#state.activity.isSyncing) {
        return;
      }

      // Checks for a "null" instance. Just in case it happens.
      if (this.#instance === null) {
        this.#log.warn('synchronize() was called but API is not available.');

        return;
      }

      // Attempt to synchronize.
      try {
        // ACTIVITY: Start sync.
        this.#state.activity.isSyncing = true;

        // Perform login action if "this instance" is not authenticated.
        if (!this.#instance.isAuthenticated()) {
          // Attempt to log in if "this instance" is not currently logging in.
          if (!this.#state.activity.isLoggingIn) {
            // ACTIVITY: Start login.
            this.#state.activity.isLoggingIn = true;

            const login = await this.#instance.login();

            // If login was successful.
            if (login.success) {
              const { portalVersion } = login.info;

              const currentTimestamp = Date.now();

              // Update timing for the sync protocols, so they can pace themselves.
              this.#state.lastRunOn.adtKeepAlive = currentTimestamp;
              this.#state.lastRunOn.adtSyncCheck = currentTimestamp;

              const contentHash = generateHash(JSON.stringify(portalVersion));

              // If the detector has not reported this event before.
              if (this.#state.reportedHashes.find((reportedHash) => contentHash === reportedHash) === undefined) {
                const detectedNew = await detectedNewPortalVersion(portalVersion, this.#log, this.#debugMode);

                // Save this hash so the detector does not detect the same thing multiple times.
                if (detectedNew) {
                  this.#state.reportedHashes.push(contentHash);
                }
              }
            }

            // If login was not successful.
            if (!login.success) {
              this.#state.eventCounters.failedLogins += 1;

              const attemptsLeft = this.#constants.maxLoginRetries - this.#state.eventCounters.failedLogins;

              if (attemptsLeft > 0) {
                this.#log.error(`Login attempt has failed. Trying ${attemptsLeft} more ${getPluralForm(attemptsLeft, 'time', 'times')} ...`);
              } else {
                const suspendMinutes = this.#constants.intervalTimestamps.suspendSyncing / 1000 / 60;

                this.#log.error(`Login attempt has failed for ${this.#constants.maxLoginRetries} ${getPluralForm(this.#constants.maxLoginRetries, 'time', 'times')}. Sleeping for ${suspendMinutes} ${getPluralForm(suspendMinutes, 'minute', 'minutes')} before resuming ...`);
              }

              stackTracer('api-response', login);
            }

            // ACTIVITY: Finish login.
            this.#state.activity.isLoggingIn = false;
          }

          // If failed logins have reached the max login retries.
          if (this.#state.eventCounters.failedLogins >= this.#constants.maxLoginRetries) {
            await sleep(this.#constants.intervalTimestamps.suspendSyncing);

            // After sleeping, reset the failed login count.
            this.#state.eventCounters.failedLogins = 0;

            return;
          }

          // Make sure the rest of the code does not run if user is not authenticated.
          if (!this.#instance.isAuthenticated()) {
            return;
          }
        }

        // Get the current timestamp.
        const currentTimestamp = Date.now();

        // Run the keep alive request if time has reached. Do not await, they shall run at their own pace.
        if (currentTimestamp - this.#state.lastRunOn.adtKeepAlive >= this.#constants.intervalTimestamps.adtKeepAlive) {
          this.synchronizeKeepAlive();
        }

        // Run the sync check request if time has reached. Do not await, they shall run at their own pace.
        if (currentTimestamp - this.#state.lastRunOn.adtSyncCheck >= this.#constants.intervalTimestamps.adtSyncCheck) {
          this.synchronizeSyncCheck();
        }
      } catch (error) {
        this.#log.error('synchronize() has unexpectedly thrown an error, will continue to sync.');
        stackTracer('serialize-error', serializeError(error));
      } finally {
        // ACTIVITY: Finish sync.
        this.#state.activity.isSyncing = false;
      }
    }, this.#constants.intervalTimestamps.synchronize);
  }

  /**
   * ADT Pulse Platform - Synchronize keep alive.
   *
   * @private
   *
   * @returns {ADTPulsePlatformSynchronizeKeepAliveReturns}
   *
   * @since 1.0.0
   */
  private synchronizeKeepAlive(): ADTPulsePlatformSynchronizeKeepAliveReturns {
    // Running an IIFE, to internalize async context.
    (async () => {
      // If currently keeping alive.
      if (this.#state.activity.isAdtKeepingAlive) {
        return;
      }

      // Checks for a "null" instance. Just in case it happens.
      if (this.#instance === null) {
        this.#log.warn('synchronizeKeepAlive() was called but API instance is not available.');

        return;
      }

      // Attempt to keep alive.
      try {
        // ACTIVITY: Start keeping alive.
        this.#state.activity.isAdtKeepingAlive = true;

        const keepAlive = await this.#instance.performKeepAlive();

        // If keeping alive was successful.
        if (keepAlive.success) {
          this.#log.debug('Keep alive request was successful. The login session should now be extended.');
        }

        // If keeping alive was not successful.
        if (!keepAlive.success) {
          this.#log.error('Keeping alive attempt has failed. Trying again later.');
          stackTracer('api-response', keepAlive);
        }

        // Update timestamp for keep alive request, even if request failed.
        this.#state.lastRunOn.adtKeepAlive = Date.now();
      } catch (error) {
        this.#log.error('synchronizeKeepAlive() has unexpectedly thrown an error, will continue to keep alive.');
        stackTracer('serialize-error', serializeError(error));
      } finally {
        // ACTIVITY: Finish keeping alive.
        this.#state.activity.isAdtKeepingAlive = false;
      }
    })();
  }

  /**
   * ADT Pulse Platform - Synchronize sync check.
   *
   * @private
   *
   * @returns {ADTPulsePlatformSynchronizeSyncCheckReturns}
   *
   * @since 1.0.0
   */
  private synchronizeSyncCheck(): ADTPulsePlatformSynchronizeSyncCheckReturns {
    // Running an IIFE, to internalize async context.
    (async () => {
      // If currently sync checking.
      if (this.#state.activity.isAdtSyncChecking) {
        return;
      }

      // Checks for a "null" instance. Just in case it happens.
      if (this.#instance === null) {
        this.#log.warn('synchronizeSyncCheck() was called but API instance is not available.');

        return;
      }

      // Attempt to sync check.
      try {
        // ACTIVITY: Start sync checking.
        this.#state.activity.isAdtSyncChecking = true;

        const syncCheck = await this.#instance.performSyncCheck();

        // If sync checking was successful.
        if (syncCheck.success) {
          this.#log.debug('Sync check request was successful. Determining if panel and sensor data is outdated ...');

          // If new sync code is different from the cached sync code.
          if (syncCheck.info.syncCode !== this.#state.data.syncCode) {
            this.#log.debug(`Panel and sensor data is outdated (old: ${this.#state.data.syncCode}, new: ${syncCheck.info.syncCode}). Preparing to retrieve the latest panel and sensor data ...`);

            // Cache the sync code.
            this.#state.data.syncCode = syncCheck.info.syncCode;

            // Request new data from the portal. Should be awaited.
            await this.fetchUpdatedInformation();
          }
        }

        // If sync checking was not successful.
        if (!syncCheck.success) {
          this.#log.error('Sync checking attempt has failed. Trying again later.');
          stackTracer('api-response', syncCheck);
        }

        // Update timestamp for sync check request, even if request failed.
        this.#state.lastRunOn.adtSyncCheck = Date.now();
      } catch (error) {
        this.#log.error('synchronizeSyncCheck() has unexpectedly thrown an error, will continue to sync check.');
        stackTracer('serialize-error', serializeError(error));
      } finally {
        // ACTIVITY: Finish sync checking.
        this.#state.activity.isAdtSyncChecking = false;
      }
    })();
  }

  /**
   * ADT Pulse Platform - Fetch updated information.
   *
   * @private
   *
   * @returns {ADTPulsePlatformFetchUpdatedInformationReturns}
   *
   * @since 1.0.0
   */
  private async fetchUpdatedInformation(): ADTPulsePlatformFetchUpdatedInformationReturns {
    // Checks for a "null" instance. Just in case it happens.
    if (this.#instance === null) {
      this.#log.warn('fetchUpdatedInformation() was called but API instance is not available.');

      return;
    }

    try {
      // Fetch all the panel and sensor information.
      const requests = await Promise.all([
        this.#instance.getGatewayInformation(),
        this.#instance.getPanelInformation(),
        this.#instance.getPanelStatus(),
        this.#instance.getSensorsInformation(),
        this.#instance.getSensorsStatus(),
      ]);

      // Update gateway information.
      if (requests[0].success) {
        const { info } = requests[0];

        const contentHash = generateHash(JSON.stringify(info));

        // Set gateway information into memory.
        this.#state.data.gatewayInfo = info;

        // If the detector has not reported this event before.
        if (this.#state.reportedHashes.find((reportedHash) => contentHash === reportedHash) === undefined) {
          const detectedNewStatus = await detectedNewGatewayInformation(info, this.#log, this.#debugMode);

          // Save this hash so the detector does not detect the same thing multiple times.
          if (detectedNewStatus) {
            this.#state.reportedHashes.push(contentHash);
          }
        }
      }

      // Update panel information.
      if (requests[1].success) {
        const { info } = requests[1];

        const contentHash = generateHash(JSON.stringify(info));

        // Set panel information into memory.
        this.#state.data.panelInfo = info;

        // If the detector has not reported this event before.
        if (this.#state.reportedHashes.find((reportedHash) => contentHash === reportedHash) === undefined) {
          const detectedNew = await detectedNewPanelInformation(info, this.#log, this.#debugMode);

          // Save this hash so the detector does not detect the same thing multiple times.
          if (detectedNew) {
            this.#state.reportedHashes.push(contentHash);
          }
        }
      }

      // Update panel status.
      if (requests[2].success) {
        const { info } = requests[2];

        const contentHash = generateHash(JSON.stringify(info));

        // Set panel status into memory.
        this.#state.data.panelStatus = info;

        // If the detector has not reported this event before.
        if (this.#state.reportedHashes.find((reportedHash) => contentHash === reportedHash) === undefined) {
          const detectedNew = await detectedNewPanelStatus(info, this.#log, this.#debugMode);

          // Save this hash so the detector does not detect the same thing multiple times.
          if (detectedNew) {
            this.#state.reportedHashes.push(contentHash);
          }
        }
      }

      // Update sensors information.
      if (requests[3].success) {
        const { sensors } = requests[3].info;

        const contentHash = generateHash(JSON.stringify(sensors));

        // Set sensors information into memory.
        this.#state.data.sensorsInfo = sensors;

        // If the detector has not reported this event before.
        if (this.#state.reportedHashes.find((reportedHash) => contentHash === reportedHash) === undefined) {
          const detectedNew = await detectedNewSensorsInformation(sensors, this.#log, this.#debugMode);

          // Save this hash so the detector does not detect the same thing multiple times.
          if (detectedNew) {
            this.#state.reportedHashes.push(contentHash);
          }
        }
      }

      // Update sensors status.
      if (requests[4].success) {
        const { sensors } = requests[4].info;

        const contentHash = generateHash(JSON.stringify(sensors));

        // Set sensors status into memory.
        this.#state.data.sensorsStatus = sensors;

        // If the detector has not reported this event before.
        if (this.#state.reportedHashes.find((reportedHash) => contentHash === reportedHash) === undefined) {
          const detectedNew = await detectedNewSensorsStatus(sensors, this.#log, this.#debugMode);

          // Save this hash so the detector does not detect the same thing multiple times.
          if (detectedNew) {
            this.#state.reportedHashes.push(contentHash);
          }
        }
      }

      // Consolidate devices first, then update them all.
      await this.unifyDevices();
    } catch (error) {
      this.#log.error('fetchUpdatedInformation() has unexpectedly thrown an error, will continue to fetch.');
      stackTracer('serialize-error', serializeError(error));
    }
  }

  /**
   * ADT Pulse Platform - Unify devices.
   *
   * @private
   *
   * @returns {ADTPulsePlatformUnifyDevicesReturns}
   *
   * @since 1.0.0
   */
  private async unifyDevices(): ADTPulsePlatformUnifyDevicesReturns {
    const { gatewayInfo, panelInfo, sensorsInfo } = this.#state.data;

    const devices: ADTPulsePlatformUnifyDevicesDevices = [];

    // Add gateway as an accessory.
    if (gatewayInfo !== null) {
      const id = 'adt-device-0';

      devices.push({
        id,
        name: 'ADT Pulse Gateway',
        type: 'gateway',
        hap: {
          category: 'BRIDGE',
          uuid: this.#api.hap.uuid.generate(id),
        },
        manufacturer: gatewayInfo.manufacturer,
        model: gatewayInfo.model,
        serial: gatewayInfo.serialNumber,
      });
    }

    // Add security panel as an accessory.
    if (panelInfo !== null) {
      const id = 'adt-device-1';

      devices.push({
        id,
        name: 'Security Panel',
        type: 'panel',
        hap: {
          category: 'SECURITY_SYSTEM',
          uuid: this.#api.hap.uuid.generate(id),
        },
        manufacturer: panelInfo.manufacturerProvider,
        model: panelInfo.typeModel,
      });
    }

    // Add sensors as an accessory.
    if (this.#config !== null && sensorsInfo !== null) {
      for (let i = 0; i < this.#config.sensors.length; i += 1) {
        const {
          adtName,
          adtType,
          adtZone,
          name,
        } = this.#config.sensors[i];

        const sensor = sensorsInfo.find((sensorInfo) => {
          const sensorInfoName = sensorInfo.name;
          const sensorInfoType = sensorInfo.deviceType;
          const sensorInfoZone = sensorInfo.zone;
          const deviceType = condenseSensorType(sensorInfoType);

          return (
            adtName === sensorInfoName
            && adtType === deviceType
            && adtZone === sensorInfoZone
          );
        });

        // If sensor was not found, it could be that the config was wrong.
        if (sensor === undefined) {
          this.#log.warn(`Attempted to add or update ${adtName} (zone: ${adtZone}) accessory that does not exist on the portal. Skipping ...`);

          continue;
        }

        const id = `adt-device-${sensor.deviceId}` as ADTPulsePlatformUnifyDevicesId;

        devices.push({
          id,
          name: name ?? adtName,
          type: adtType,
          hap: {
            category: 'SENSOR',
            uuid: this.#api.hap.uuid.generate(id),
          },
          manufacturer: 'ADT',
          model: sensor.deviceType,
          zone: adtZone,
        });
      }
    }

    // Now poll the accessories using the generated devices.
    await this.pollAccessories(devices);
  }

  /**
   * ADT Pulse Platform - Poll accessories.
   *
   * @param {ADTPulsePlatformPollAccessoriesDevices} devices - Devices.
   *
   * @private
   *
   * @returns {ADTPulsePlatformPollAccessoriesReturns}
   *
   * @since 1.0.0
   */
  private async pollAccessories(devices: ADTPulsePlatformPollAccessoriesDevices): ADTPulsePlatformPollAccessoriesReturns {
    for (let i = 0; i < devices.length; i += 1) {
      const accessoryIndex = this.#accessories.findIndex((accessory) => devices[i].hap.uuid === accessory.context.hap.uuid);

      // Update the device if accessory is cached, otherwise add it as a new device.
      if (accessoryIndex >= 0) {
        this.updateAccessory(devices[i]);
      } else {
        this.addAccessory(devices[i]);
      }
    }
  }
}
