// Every export has an importer in another file, else it's an implementation detail that looks like an API.
// ESLint sees one file at a time, so this one is a script. Part of `npm run lint`.
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const IMPORT = /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*'([^']+)'/g
const EXPORT = /^export (?:async )?(?:const|let|function|class|type) +(\w+)/gm

const tracked = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '*.ts'], { encoding: 'utf8' })
const files = tracked.trim().split('\n').map((path) => ({ path, source: readFileSync(path, 'utf8') }))

const namesIn = (list: string) => list.split(',').map((part) => part.replace(/^\s*type\s+/, '').split(' as ')[0].trim())

const importers = new Map<string, Set<string>>()
for (const { path, source } of files) {
  const imported = [...source.matchAll(IMPORT)].flatMap(([, list]) => namesIn(list))
  for (const name of imported) importers.set(name, (importers.get(name) ?? new Set()).add(path))
}

const unused = files
  .filter(({ path }) => path.startsWith('src/'))
  .flatMap(({ path, source }) =>
    [...source.matchAll(EXPORT)]
      .map(([, name]) => ({ path, name }))
      .filter(({ name }) => ![...(importers.get(name) ?? [])].some((importer) => importer !== path)),
  )

for (const { path, name } of unused) console.error(`${path}: "${name}" is exported but nothing imports it. Drop the export.`)
if (unused.length) process.exit(1)
