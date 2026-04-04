#!/usr/bin/env node

import path from 'node:path'
import process from 'node:process'
import ts from 'typescript'

const PROJECTS = [
  { name: 'web', dir: 'client/web', tsconfig: 'tsconfig.app.json' },
  { name: 'server', dir: 'server', tsconfig: 'tsconfig.json' },
  { name: 'shared', dir: 'shared', tsconfig: 'tsconfig.json' },
]

const rootDir = process.cwd()

const formatDiagnostic = (diagnostic) =>
  ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')

const collectProjectDeprecations = (project) => {
  const projectDir = path.join(rootDir, project.dir)
  const configPath = path.join(projectDir, project.tsconfig)

  if (!ts.sys.fileExists(configPath)) {
    return {
      name: project.name,
      skipped: true,
      messages: [`missing ${project.tsconfig}`],
    }
  }

  const configLoad = ts.readConfigFile(configPath, ts.sys.readFile)
  if (configLoad.error) {
    return {
      name: project.name,
      skipped: false,
      messages: [formatDiagnostic(configLoad.error)],
      failures: 1,
    }
  }

  const config = ts.parseJsonConfigFileContent(configLoad.config, ts.sys, projectDir)
  if (config.errors.length > 0) {
    return {
      name: project.name,
      skipped: false,
      messages: config.errors.map(formatDiagnostic),
      failures: config.errors.length,
    }
  }

  const fileNames = config.fileNames.filter(
    (fileName) =>
      !fileName.includes(`${path.sep}node_modules${path.sep}`) && !fileName.endsWith('.d.ts'),
  )

  const languageServiceHost = {
    getCompilationSettings: () => config.options,
    getScriptFileNames: () => fileNames,
    getScriptVersion: () => '1',
    getScriptSnapshot: (fileName) => {
      if (!ts.sys.fileExists(fileName)) {
        return undefined
      }
      const contents = ts.sys.readFile(fileName)
      return contents === undefined ? undefined : ts.ScriptSnapshot.fromString(contents)
    },
    getCurrentDirectory: () => projectDir,
    getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    readDirectory: ts.sys.readDirectory,
  }

  const languageService = ts.createLanguageService(
    languageServiceHost,
    ts.createDocumentRegistry(),
  )

  const messages = []
  for (const fileName of fileNames) {
    const suggestionDiagnostics = languageService.getSuggestionDiagnostics(fileName)
    for (const diagnostic of suggestionDiagnostics) {
      const isDeprecated =
        diagnostic.reportsDeprecated === true ||
        diagnostic.code === 6385 ||
        diagnostic.code === 6387
      if (!isDeprecated) {
        continue
      }

      const relPath = path.relative(rootDir, fileName)
      const sourceFile = ts.createSourceFile(
        fileName,
        ts.sys.readFile(fileName) ?? '',
        ts.ScriptTarget.Latest,
        true,
      )
      const position = diagnostic.start
        ? sourceFile.getLineAndCharacterOfPosition(diagnostic.start)
        : null
      const line = position ? position.line + 1 : 1
      const col = position ? position.character + 1 : 1
      messages.push(`${relPath}:${line}:${col} - ${formatDiagnostic(diagnostic)}`)
    }
  }

  languageService.dispose()

  return {
    name: project.name,
    skipped: false,
    messages,
    failures: messages.length,
  }
}

let totalFindings = 0
let failed = false

console.log('Deprecation report')
console.log('==================')

for (const project of PROJECTS) {
  const result = collectProjectDeprecations(project)

  if (result.skipped) {
    console.log(`${project.name}: skipped (${result.messages[0]})`)
    continue
  }

  if (result.failures > 0) {
    failed = true
    totalFindings += result.failures
    console.log(`${project.name}: ${result.failures} deprecation warning(s)`)
    for (const message of result.messages) {
      console.log(`  - ${message}`)
    }
    continue
  }

  console.log(`${project.name}: clear (0 deprecations)`)
}

if (failed) {
  console.log(`Summary: ${totalFindings} deprecation warning(s) found.`)
  process.exit(1)
}

console.log('Summary: all checked folders are clear from deprecations.')
