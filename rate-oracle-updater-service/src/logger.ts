import { createLogger, format, transports, addColors, Logger as RealLogger } from 'winston'
import * as Transport from 'winston-transport'

import colors from 'colors/safe'
import { supportsColor } from 'colors/lib/system/supports-colors'
import config from 'config'

import { Logger } from './definitions'
import { inspect } from 'util'

const COLORS_ENABLED = supportsColor() && !process.env.LOG_NO_COLORS

// Inspired from https://github.com/visionmedia/debug
const names: RegExp[] = []
const skips: RegExp[] = []

/**
 * From given namespaces string parse RegExes which
 * will be used for determining if given service should be
 * ignored in logging or not.
 *
 * @param namespaces
 */
function loadFilter (namespaces: string): void {
  const splits = namespaces.split(/[\s,]+/)

  for (const split of splits) {
    if (!split) {
      continue
    }

    const namespace = split.replace(/\*/g, '.*?')

    if (namespace[0] === '-') {
      skips.push(new RegExp(`^${namespace.substr(1)}$`))
    } else {
      names.push(new RegExp(`^${namespace}$`))
    }
  }
}

/**
 * Returns true if the given mode name is enabled, false otherwise.
 *
 * @param {String} name
 * @return {Boolean}
 * @api public
 */
function enabled (name: string): boolean {
  if (name[name.length - 1] === '*') {
    return true
  }

  function isMatch (set: RegExp[]): boolean {
    for (const regex of set) {
      if (regex.test(name)) {
        return true
      }
    }
    return false
  }

  if (isMatch(skips)) {
    return false
  }

  if (names.length > 0) {
    return isMatch(names)
  }

  return true
}

const filterServices = format(info => {
  if (info.metadata.service) {
    return enabled(info.metadata.service) ? info : false
  } else {
    return info
  }
})

/**
 * Format utility which will uppercase logging level.
 */
const upperCaseLevel = format(info => {
  if (info.level) {
    info.level = info.level.toUpperCase()
  }
  return info
})

type SupportedLevels = 'critical' | 'error' | 'warn' | 'info' | 'verbose' | 'debug'

const supportedLevels: Record<SupportedLevels, number> = {
  critical: 0,
  error: 1,
  warn: 2,
  info: 3,
  verbose: 4,
  debug: 5
}

addColors({
  debug: 'grey',
  info: 'blue',
  critical: 'white redBG'
})

let mainLogger: RealLogger
const loggers: Record<string, RealLogger> = {}

function initLogging (): void {
  loadFilter(config.get('log.filter') || '*')

  const transportsSet: Transport[] = [new transports.Console()]

  if (config.get('log.path')) {
    transportsSet.push(new transports.File({
      filename: config.get('log.path'),
      maxsize: 5000000,
      maxFiles: 5,
      tailable: true,
      format: format.uncolorize()
    }))
  }

  mainLogger = createLogger({
    // To see more detailed errors, change this to 'debug'
    level: config.get('log.level') || 'info',
    levels: supportedLevels,
    format: format.combine(
      format.errors({ stack: true }),
      format.metadata(),
      filterServices(),
      upperCaseLevel(),
      // format.padLevels(),
      format.timestamp({ format: 'DD/MM hh:mm:ss' }),
      format.colorize(),
      format.printf(info => {
        let message: string
        const { service, ...rest } = info.metadata

        if (service) {
          message = `[${info.level}] ${colors.grey(info.timestamp)} (${service}): ${info.message}`
        } else {
          message = `[${info.level}] ${colors.grey(info.timestamp)}: ${info.message}`
        }

        if (Object.keys(rest).length > 0) {
          message += '\n' + inspect(rest, false, 5, true)
        }

        return message
      }),
      COLORS_ENABLED ? format(i => i)() : format.uncolorize()
    ),
    transports: transportsSet
  })
}

function delayedLoggingMethod (level: SupportedLevels, name?: string) {
  return function (message: string, ...meta: any[]): void {
    // First logging call, lets setup logging
    if (!mainLogger) {
      initLogging()
    }

    if (name) {
      if (!loggers[name]) {
        loggers[name] = mainLogger.child({ service: name })
      }

      loggers[name].log(level, message, ...meta)
    } else {
      mainLogger.log(level, message, ...meta)
    }
  }
}

function exitAfterProcessingClosure (fn: any): () => never {
  return (...args: any[]) => {
    fn(...args)
    process.exit(1)
  }
}

export function loggingFactory (name?: string): Logger {
  return {
    critical: exitAfterProcessingClosure(delayedLoggingMethod('critical', name)),
    error: delayedLoggingMethod('error', name),
    warn: delayedLoggingMethod('warn', name),
    info: delayedLoggingMethod('info', name),
    verbose: delayedLoggingMethod('verbose', name),
    debug: delayedLoggingMethod('debug', name)
  }
}
