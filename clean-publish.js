#!/usr/bin/env node

import { parseListArg } from './utils.js'
import {
  createTempDirectory,
  readSrcDirectory,
  clearFilesList,
  copyFiles,
  readPackageJSON,
  clearPackageJSON,
  writePackageJSON,
  publish,
  cleanComments,
  removeTempDirectory,
  runScript,
  cleanDocs
} from './core.js'
import { getConfig } from './get-config.js'

const HELP =
  'npx clean-publish\n' +
  '\n' +
  'Options:\n' +
  '  --help             Show help\n' +
  '  --version          Show version number\n' +
  '  --clean-docs       Keep only main section of README.md' +
  '  --clean-comments   Clean inline comments from JS files' +
  '  --files            One or more exclude files\n' +
  '  --fields           One or more exclude package.json fields\n' +
  '  --exports          One or more exclude exports conditions\n' +
  '  --without-publish  Clean package without npm publish\n' +
  '  --dry-run          Reports the details of what would have been published\n' +
  '  --package-manager  Package manager to use\n' +
  '  --access           Whether the npm registry publishes this package\n' +
  '                     as a public package, or restricted\n' +
  '  --tag              Registers the package with the given tag\n' +
  '  --before-script    Run script on the to-release dir before npm\n' +
  '                     publish'

async function handleOptions () {
  let options = {}
  options.packageManager = 'npm'
  for (let i = 2; i < process.argv.length; i++) {
    switch (process.argv[i]) {
      case '--help':
        process.stdout.write(HELP + '\n')
        process.exit(0)
      case '--version':
        process.stdout.write(require('./package.json').version + '\n')
        process.exit(0)
      case '--without-publish':
        options.withoutPublish = true
        break
      case '--dry-run':
        options.dryRun = true
        i += 1
        break
      case '--package-manager':
        options.packageManager = process.argv[i + 1]
        i += 1
        break
      case '--before-script':
        options.beforeScript = process.argv[i + 1]
        i += 1
        break
      case '--access':
        options.access = process.argv[i + 1]
        i += 1
        break
      case '--files':
        options.files = parseListArg(process.argv[i + 1])
        i += 1
        break
      case '--clean-docs':
        options.cleanDocs = true
        i += 1
        break
      case '--clean-commentd':
        options.cleanComments = true
        i += 1
        break
      case '--tag':
        options.tag = parseListArg(process.argv[i + 1])
        i += 1
        break
      case '--fields':
        options.fields = parseListArg(process.argv[i + 1])
        i += 1
        break
      case '--exports':
        options.exports = parseListArg(process.argv[i + 1])
        i += 1
        break
      default:
        options._ = process.argv[i]
    }
  }
  if (!options._) {
    let config = await getConfig()
    return { ...config, ...options }
  } else {
    return options
  }
}

async function run () {
  const options = await handleOptions()

  const tempDirectoryName = await createTempDirectory()

  const files = await readSrcDirectory()

  const filteredFiles = clearFilesList(
    files,
    [tempDirectoryName].concat(options.files)
  )
  await copyFiles(filteredFiles, tempDirectoryName)

  const packageJson = await readPackageJSON()

  if (options.cleanDocs) {
    await cleanDocs(tempDirectoryName, packageJson.repository)
  }

  if (options.cleanComments) {
    await cleanComments(tempDirectoryName)
  }

  const cleanPackageJSON = clearPackageJSON(packageJson, options.fields, options.exports)
  await writePackageJSON(tempDirectoryName, cleanPackageJSON)

  let prepublishSuccess = true
  if (options.beforeScript) {
    prepublishSuccess = await runScript(options.beforeScript, tempDirectoryName)
  }

  if (!options.withoutPublish && prepublishSuccess) {
    await publish(tempDirectoryName, options)
  }

  if (!options.withoutPublish) {
    await removeTempDirectory(tempDirectoryName)
  }
}

run().catch(error => {
  process.stderr.write(error.stack + '\n')
  process.exit(1)
})
