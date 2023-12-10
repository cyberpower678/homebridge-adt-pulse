import chalk from 'chalk';
import _ from 'lodash';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import { exit, stdin, stdout } from 'node:process';
import readline from 'node:readline';
import util from 'node:util';

import { ADTPulse } from '@/lib/api.js';
import { platformConfig } from '@/lib/schema.js';
import { debugLog, isForwardSlashOS } from '@/lib/utility.js';
import type {
  ADTPulseTestAskQuestionMode,
  ADTPulseTestAskQuestionReturns,
  ADTPulseTestFindConfigParsedFile,
  ADTPulseTestFindConfigPossibleLocations,
  ADTPulseTestFindConfigRawFile,
  ADTPulseTestFindConfigReturns,
  ADTPulseTestPrintTestOutputIsSuccess,
  ADTPulseTestPrintTestOutputReturns,
  ADTPulseTestSelectedConfigLocation,
  ADTPulseTestSelectedPlatform,
  ADTPulseTestStartTestReturns,
} from '@/types/index.d.ts';

/**
 * ADT Pulse Test.
 *
 * @since 1.0.0
 */
class ADTPulseTest {
  /**
   * ADT Pulse Test - Selected config location.
   *
   * @private
   *
   * @since 1.0.0
   */
  #selectedConfigLocation: ADTPulseTestSelectedConfigLocation;

  /**
   * ADT Pulse Test - Selected platform.
   *
   * @private
   *
   * @since 1.0.0
   */
  #selectedPlatform: ADTPulseTestSelectedPlatform;

  /**
   * ADT Pulse Test - Start test.
   *
   * @returns {ADTPulseTestStartTestReturns}
   *
   * @since 1.0.0
   */
  async startTest(): ADTPulseTestStartTestReturns {
    try {
      const userAcceptedDisclaimer = await ADTPulseTest.askQuestion('disclaimer');

      if (!userAcceptedDisclaimer) {
        exit(0);
      }

      // Used to pad the user input to the next line.
      console.info('\r');

      const configFoundAndSet = this.findConfig();

      if (!configFoundAndSet || this.#selectedPlatform === undefined) {
        ADTPulseTest.printTestOutput(false);

        exit(1);
      }

      const instance = new ADTPulse(
        this.#selectedPlatform,
        {
          debug: true,
          testMode: {
            enabled: true,
          },
        },
      );
      const instanceFunctions = [
        instance.login.bind(instance),
        instance.getGatewayInformation.bind(instance),
        instance.getPanelInformation.bind(instance),
        instance.getPanelStatus.bind(instance),
        instance.setPanelStatus.bind(instance, 'away'),
        instance.setPanelStatus.bind(instance, 'stay'),
        instance.setPanelStatus.bind(instance, 'night'),
        instance.setPanelStatus.bind(instance, 'off'),
        instance.getSensorsInformation.bind(instance),
        instance.getSensorsStatus.bind(instance),
        instance.performSyncCheck.bind(instance),
        instance.performKeepAlive.bind(instance),
        instance.logout.bind(instance),
      ];

      for (let i = 0; i < instanceFunctions.length; i += 1) {
        const response = await instanceFunctions[i]();

        // If response is not successful, end the test.
        if (!response.success) {
          ADTPulseTest.printTestOutput(false);

          exit(1);
        }

        // Print success responses.
        console.info(util.inspect(response, {
          showHidden: false,
          depth: Infinity,
          colors: true,
        }));
      }

      ADTPulseTest.printTestOutput(true);

      exit(0);
    } catch {
      ADTPulseTest.printTestOutput(false);

      exit(1);
    }
  }

  /**
   * ADT Pulse Test - Find config.
   *
   * @private
   *
   * @returns {ADTPulseTestFindConfigReturns}
   *
   * @since 1.0.0
   */
  private findConfig(): ADTPulseTestFindConfigReturns {
    const possibleLocations: ADTPulseTestFindConfigPossibleLocations = [
      ...(isForwardSlashOS()) ? [
        '/homebridge/config.json', // "homebridge" Docker.
        '/var/lib/homebridge/config.json', // Debian or Raspbian.
        `${os.homedir()}/.homebridge/config.json`, // macOS.
      ] : [],
      ...(!isForwardSlashOS()) ? [
        `${os.homedir()}\\.homebridge\\config.json`, // Windows.
      ] : [],
    ];

    for (let i = 0; i < possibleLocations.length; i += 1) {
      // Don't run again if config location and platform have been selected.
      if (this.#selectedConfigLocation !== undefined && this.#selectedPlatform !== undefined) {
        break;
      }

      debugLog(null, 'test-api.ts', 'info', `Attempt ${i + 1}: Finding the Homebridge config file in "${possibleLocations[i]}"`);

      try {
        const rawFile: ADTPulseTestFindConfigRawFile = readFileSync(possibleLocations[i], 'utf-8');
        const parsedFile: ADTPulseTestFindConfigParsedFile = JSON.parse(rawFile);
        const platforms = _.get(parsedFile, ['platforms']);
        const adtPlatform = _.find(platforms, (platform) => _.get(platform, ['platform']) === 'ADTPulse');

        if (adtPlatform !== undefined) {
          const validAdtPlatform = platformConfig.safeParse(adtPlatform);

          if (validAdtPlatform.success) {
            this.#selectedConfigLocation = possibleLocations[i];
            this.#selectedPlatform = validAdtPlatform.data;
          }
        }
      } catch {
        this.#selectedConfigLocation = undefined;
        this.#selectedPlatform = undefined;
      }
    }

    if (this.#selectedConfigLocation === undefined || this.#selectedPlatform === undefined) {
      debugLog(null, 'test-api.ts', 'error', 'Unable to find a parsable Homebridge config file with a validated "ADTPulse" platform');

      return false;
    }

    debugLog(null, 'test-api.ts', 'success', `Found valid Homebridge config in "${this.#selectedConfigLocation}"`);

    return true;
  }

  /**
   * ADT Pulse Test - Ask question.
   *
   * @param {ADTPulseTestAskQuestionMode} mode - Mode.
   *
   * @private
   *
   * @returns {ADTPulseTestAskQuestionReturns}
   *
   * @since 1.0.0
   */
  private static async askQuestion(mode: ADTPulseTestAskQuestionMode): ADTPulseTestAskQuestionReturns {
    const rlInterface = readline.createInterface({
      input: stdin,
      output: stdout,
    });
    const questions = {
      disclaimer: [
        chalk.cyanBright('##############################################################'),
        chalk.cyanBright('####         ADT Pulse for Homebridge Plugin Test         ####'),
        chalk.cyanBright('#### https://github.com/mrjackyliang/homebridge-adt-pulse ####'),
        chalk.cyanBright('####                                                      ####'),
        chalk.cyanBright('####     Copyright (c) 2023 Jacky Liang. ISC License.     ####'),
        chalk.cyanBright('##############################################################'),
        'Before you begin, please make sure of the following:',
        '',
        '1. You have the proper authorization to carry out system testing.',
        '2. You are currently ON THE PROPERTY where the test is being conducted.',
        '3. You have disarmed the system and have >= 1 door/window open.',
        '4. You have access to MyADT and have placed the system in test mode.',
        '',
        `${chalk.redBright('WARNING:')} If you DO NOT have access to MyADT or CANNOT place the system into`,
        'test mode, please DO NOT PROCEED. The author is NOT RESPONSIBLE if the test causes',
        'an accidental trigger or if ADT agents/local authorities become involved.',
        '',
        chalk.yellowBright('Type "I Agree" (without quotes) to acknowledge that you have read through,'),
        chalk.yellowBright('understood, and agree to the disclaimer and instructions above ...'),
        '➜ ',
      ].join('\n'),
    };

    return new Promise((resolve) => {
      rlInterface.question(questions[mode], (input) => {
        if (input !== 'I Agree') {
          resolve(false);
        }

        resolve(true);
      });
    });
  }

  /**
   * ADT Pulse Test - Print test output.
   *
   * @param {ADTPulseTestPrintTestOutputIsSuccess} isSuccess - Is success.
   *
   * @private
   *
   * @returns {ADTPulseTestPrintTestOutputReturns}
   *
   * @since 1.0.0
   */
  private static printTestOutput(isSuccess: ADTPulseTestPrintTestOutputIsSuccess): ADTPulseTestPrintTestOutputReturns {
    if (!isSuccess) {
      console.info([
        '',
        chalk.redBright('########################################################################'),
        chalk.redBright('#####       Test has failed! Please check the error response       #####'),
        chalk.redBright('#####  above, attempt to resolve them, then run this tester again  #####'),
        chalk.redBright('########################################################################'),
      ].join('\n'));

      return;
    }

    console.info([
      '',
      chalk.greenBright('########################################################################'),
      chalk.greenBright('#####       Test has completed! If you find my plugin useful       #####'),
      chalk.greenBright('#####  please consider donating to my efforts via GitHub Sponsors  #####'),
      chalk.greenBright('########################################################################'),
    ].join('\n'));
  }
}

const instance = new ADTPulseTest();
await instance.startTest();
