// Project rules stock ESLint doesn't have. Each one keeps code readable without its comments.

const CONTROL_FLOW = new Set(['IfStatement', 'ForStatement', 'ForOfStatement', 'ForInStatement', 'WhileStatement'])
// Coordinates, sizes, loop counters and events read fine as one letter; everything else gets a name.
const SHORT_NAMES_OK = new Set(['x', 'y', 'w', 'h', 'e', 'i', 'j', 'k', 'n', '_'])
const TIME_NAME = /(TIMEOUT|DELAY|EVERY|INTERVAL|WINDOW|FLASH|STALE|HEARTBEAT|DURATION)/
const UNIT_SUFFIX = /_(MS|SECONDS|TICKS|ROWS)$/

const relativeTo = (filename, specifier) => new URL(specifier, `file://${filename}`).pathname

const namedParams = {
  meta: { type: 'suggestion', schema: [], docs: { description: 'Named functions spell out their parameters; short callbacks may use one letter.' } },
  create(context) {
    const check = (node) => {
      for (const param of node.params) {
        const id = param.type === 'AssignmentPattern' ? param.left : param
        if (id.type !== 'Identifier' || id.name.length > 1 || SHORT_NAMES_OK.has(id.name)) continue
        context.report({ node: id, message: `Name parameter "${id.name}" after what it holds: the signature is what readers see first.` })
      }
    }
    return {
      FunctionDeclaration: check,
      FunctionExpression(node) {
        if (node.id || node.parent.type === 'Property') check(node)
      },
    }
  },
}

const noBracelessNesting = {
  meta: { type: 'suggestion', schema: [], docs: { description: 'One control statement per line: no for (...) if (...) without braces.' } },
  create(context) {
    const check = (node) => {
      if (CONTROL_FLOW.has(node.body?.type) || CONTROL_FLOW.has(node.consequent?.type)) {
        context.report({ node, message: 'Nested control flow needs braces.' })
      }
    }
    return Object.fromEntries([...CONTROL_FLOW].map((type) => [type, check]))
  },
}

const timeConstantUnits = {
  meta: { type: 'suggestion', schema: [], docs: { description: 'A constant holding a duration or period says its unit in its name.' } },
  create(context) {
    return {
      VariableDeclarator(node) {
        const { name } = node.id
        if (!/^[A-Z0-9_]+$/.test(name ?? '') || !TIME_NAME.test(name) || UNIT_SUFFIX.test(name)) return
        context.report({ node: node.id, message: `${name} should end in its unit: _MS, _SECONDS, _TICKS or _ROWS.` })
      },
    }
  },
}

// Lint's no-undef checks a file on its own; this catches a no-DOM file that loads a browser-only one.
const noDomImports = {
  meta: {
    type: 'problem',
    docs: { description: 'Files that run in Node import only other files that run in Node.' },
    schema: [{ type: 'object', properties: { allowed: { type: 'array', items: { type: 'string' } } } }],
  },
  create(context) {
    const root = context.cwd
    const allowed = context.options[0].allowed.map((path) => `${root}/${path}`)
    return {
      ImportDeclaration(node) {
        const specifier = node.source.value
        if (node.importKind === 'type' || !specifier.startsWith('.')) return
        const target = relativeTo(context.filename, specifier)
        if (allowed.some((path) => target === path || target.startsWith(`${path}/`))) return
        context.report({ node: node.source, message: `${specifier} isn't a no-DOM file (NO_DOM in eslint.config.js), but this file runs in Node.` })
      },
    }
  },
}

export default {
  rules: {
    'named-params': namedParams,
    'no-braceless-nesting': noBracelessNesting,
    'time-constant-units': timeConstantUnits,
    'no-dom-imports': noDomImports,
  },
}
