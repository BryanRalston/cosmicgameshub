import { parse } from 'acorn';

// Split one ES module into ordered ESM parts that share a single object.
// Each part stays small enough that parsing and running it is its own short task.
// Cross-part bindings are properties on `scopeName`. Imports of THREE and
// OrbitControls are left as real imports so every part uses the same objects.

const CHILD_WALK = new Set([
  'ExpressionStatement', 'ReturnStatement', 'ThrowStatement', 'IfStatement',
  'WhileStatement', 'DoWhileStatement', 'EmptyStatement', 'DebuggerStatement',
  'TemplateLiteral', 'TaggedTemplateExpression', 'SpreadElement',
  'UnaryExpression', 'BinaryExpression', 'LogicalExpression',
  'ConditionalExpression', 'SequenceExpression', 'UpdateExpression',
  'AwaitExpression', 'YieldExpression', 'ArrayExpression', 'ChainExpression',
  'ParenthesizedExpression', 'ImportExpression', 'TryStatement',
  'SwitchCase'
]);

function childrenOf(node) {
  const out = [];
  for (const key of Object.keys(node)) {
    if (key === 'type' || key === 'start' || key === 'end' || key === 'loc' || key === 'range') continue;
    const value = node[key];
    if (Array.isArray(value)) {
      for (const item of value) if (item && item.type) out.push(item);
    } else if (value && typeof value === 'object' && value.type) out.push(value);
  }
  return out;
}

function newScope(parent) {
  return { parent, names: new Set() };
}

function patternIds(node, out) {
  if (!node) return;
  if (node.type === 'Identifier') {
    out.push(node);
    return;
  }
  if (node.type === 'RestElement') {
    patternIds(node.argument, out);
    return;
  }
  if (node.type === 'AssignmentPattern') {
    patternIds(node.left, out);
    return;
  }
  if (node.type === 'ArrayPattern') {
    for (const el of node.elements) if (el) patternIds(el, out);
    return;
  }
  if (node.type === 'ObjectPattern') {
    for (const prop of node.properties) {
      if (prop.type === 'RestElement') patternIds(prop.argument, out);
      else patternIds(prop.value, out);
    }
    return;
  }
  throw new Error('pattern ' + node.type + ' at ' + node.start);
}

function addPatterns(scope, pattern) {
  const ids = [];
  patternIds(pattern, ids);
  for (const id of ids) scope.names.add(id.name);
}

function isFunction(node) {
  return node.type === 'FunctionDeclaration'
    || node.type === 'FunctionExpression'
    || node.type === 'ArrowFunctionExpression';
}

function resolve(scope, name) {
  for (let cursor = scope; cursor; cursor = cursor.parent) {
    if (cursor.names.has(name)) return cursor;
  }
  return null;
}

function collectVars(node, scope) {
  if (!node || !node.type || isFunction(node) || node.type === 'ClassDeclaration' || node.type === 'ClassExpression') return;
  if (node.type === 'VariableDeclaration' && node.kind === 'var') {
    for (const decl of node.declarations) addPatterns(scope, decl.id);
  }
  for (const child of childrenOf(node)) collectVars(child, scope);
}

export function splitModule(source, options) {
  const scopeName = options.scopeName || '__brixScope';
  const budget = options.budget || 16000;
  let text = source.replace(/\r\n/g, '\n');
  text = text.replace(/import\(\s*(['"])\.\/prefabs\.js\1\s*\)/g, 'globalThis.__brixLoadPrefabs()');
  text = text.replace(/import\(\s*(['"])\.\/post\.js\1\s*\)/g, 'globalThis.__brixLoadPost()');
  text = text.replace(/import\(\s*(['"])\.\/gallery-lazy\.js\1\s*\)/g, 'globalThis.__brixLoadGallery()');

  const ast = parse(text, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
  const moduleScope = newScope(null);
  moduleScope.isModule = true;
  const exports = [];

  for (const stmt of ast.body) {
    if (stmt.type === 'ImportDeclaration') continue;
    if (stmt.type === 'ExportNamedDeclaration' && !stmt.declaration) {
      for (const spec of stmt.specifiers) {
        exports.push({ local: spec.local.name, exported: spec.exported.name });
      }
      continue;
    }
    if (stmt.type === 'ExportAllDeclaration' || stmt.type === 'ExportDefaultDeclaration') {
      throw new Error('unsupported export at line ' + stmt.loc.start.line);
    }
    const decl = stmt.type === 'ExportNamedDeclaration' ? stmt.declaration : stmt;
    if (!decl) continue;
    if (decl.type === 'FunctionDeclaration' && decl.id) moduleScope.names.add(decl.id.name);
    if (decl.type === 'ClassDeclaration' && decl.id) moduleScope.names.add(decl.id.name);
    if (decl.type === 'VariableDeclaration') {
      for (const d of decl.declarations) addPatterns(moduleScope, d.id);
    }
  }
  collectVars(ast, moduleScope);
  if (moduleScope.names.has(scopeName)) {
    throw new Error(scopeName + ' collides with a module binding');
  }

  const edits = [];
  function rewriteIdent(node, scope) {
    if (!node || node.type !== 'Identifier') return;
    const found = resolve(scope, node.name);
    if (found && found.isModule) {
      edits.push({ start: node.start, end: node.end, text: scopeName + '.' + node.name });
      return;
    }
    if (!found && node.name === 'THREE') {
      edits.push({ start: node.start, end: node.end, text: 'globalThis.__BRIX_THREE' });
    } else if (!found && node.name === 'OrbitControls') {
      edits.push({ start: node.start, end: node.end, text: 'globalThis.__BRIX_ORBIT' });
    }
  }

  function walkAssignTarget(node, scope) {
    if (!node) return;
    if (node.type === 'Identifier') {
      rewriteIdent(node, scope);
      return;
    }
    if (node.type === 'MemberExpression') {
      walk(node, scope);
      return;
    }
    if (node.type === 'ArrayPattern') {
      for (const el of node.elements) if (el) walkAssignTarget(el, scope);
      return;
    }
    if (node.type === 'RestElement') {
      walkAssignTarget(node.argument, scope);
      return;
    }
    if (node.type === 'AssignmentPattern') {
      walkAssignTarget(node.left, scope);
      walk(node.right, scope);
      return;
    }
    if (node.type === 'ObjectPattern') {
      for (const prop of node.properties) {
        if (prop.type === 'RestElement') {
          walkAssignTarget(prop.argument, scope);
          continue;
        }
        if (prop.computed) walk(prop.key, scope);
        if (prop.shorthand && prop.value.type === 'Identifier') {
          const found = resolve(scope, prop.value.name);
          if (found && found.isModule) {
            edits.push({
              start: prop.start,
              end: prop.end,
              text: prop.value.name + ': ' + scopeName + '.' + prop.value.name
            });
          }
          continue;
        }
        walkAssignTarget(prop.value, scope);
      }
      return;
    }
    walk(node, scope);
  }

  function walkBinding(node, scope) {
    if (!node) return;
    if (node.type === 'Identifier' || node.type === 'PrivateIdentifier') return;
    if (node.type === 'AssignmentPattern') {
      walkBinding(node.left, scope);
      walk(node.right, scope);
      return;
    }
    if (node.type === 'RestElement') {
      walkBinding(node.argument, scope);
      return;
    }
    if (node.type === 'ArrayPattern') {
      for (const el of node.elements) if (el) walkBinding(el, scope);
      return;
    }
    if (node.type === 'ObjectPattern') {
      for (const prop of node.properties) {
        if (prop.type === 'RestElement') walkBinding(prop.argument, scope);
        else {
          if (prop.computed) walk(prop.key, scope);
          walkBinding(prop.value, scope);
        }
      }
      return;
    }
    throw new Error('binding ' + node.type);
  }

  function walkFunction(node, scope) {
    const inner = newScope(scope);
    if (node.id) inner.names.add(node.id.name);
    for (const param of node.params || []) addPatterns(inner, param);
    collectVars(node.body, inner);
    for (const param of node.params || []) walkBinding(param, inner);
    if (node.body) walk(node.body, inner);
  }

  function walkClass(node, scope) {
    if (node.superClass) walk(node.superClass, scope);
    const inner = newScope(scope);
    if (node.id) inner.names.add(node.id.name);
    walk(node.body, inner);
  }

  function addLexical(scope, stmt) {
    if (!stmt) return;
    if (stmt.type === 'FunctionDeclaration' && stmt.id) scope.names.add(stmt.id.name);
    if (stmt.type === 'ClassDeclaration' && stmt.id) scope.names.add(stmt.id.name);
    if (stmt.type === 'VariableDeclaration' && stmt.kind !== 'var') {
      for (const decl of stmt.declarations) addPatterns(scope, decl.id);
    }
  }

  function walkBlockLike(body, scope) {
    const inner = newScope(scope);
    for (const stmt of body) addLexical(inner, stmt);
    for (const stmt of body) walk(stmt, inner);
  }

  function walk(node, scope) {
    if (!node || !node.type) return;
    switch (node.type) {
      case 'Identifier':
        rewriteIdent(node, scope);
        return;
      case 'PrivateIdentifier':
      case 'Literal':
      case 'ThisExpression':
      case 'Super':
      case 'EmptyStatement':
      case 'DebuggerStatement':
        return;
      case 'TemplateElement':
        return;
      case 'MetaProperty':
        throw new Error('meta property at ' + node.start);
      case 'FunctionDeclaration':
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
        walkFunction(node, scope);
        return;
      case 'ClassDeclaration':
      case 'ClassExpression':
        walkClass(node, scope);
        return;
      case 'ClassBody':
        for (const el of node.body) walk(el, scope);
        return;
      case 'MethodDefinition':
        if (node.computed) walk(node.key, scope);
        if (node.decorators) for (const dec of node.decorators) walk(dec, scope);
        walk(node.value, scope);
        return;
      case 'PropertyDefinition':
      case 'StaticBlock':
        if (node.type === 'StaticBlock') {
          const inner = newScope(scope);
          collectVars(node, inner);
          for (const stmt of node.body) addLexical(inner, stmt);
          for (const stmt of node.body) walk(stmt, inner);
          return;
        }
        if (node.computed) walk(node.key, scope);
        if (node.value) walk(node.value, scope);
        return;
      case 'Property':
        if (node.computed) walk(node.key, scope);
        if (node.shorthand && node.value && node.value.type === 'Identifier') {
          const found = resolve(scope, node.value.name);
          if (found && found.isModule) {
            edits.push({
              start: node.start,
              end: node.end,
              text: node.value.name + ': ' + scopeName + '.' + node.value.name
            });
          }
          return;
        }
        if (node.value) walk(node.value, scope);
        return;
      case 'MemberExpression':
        if (node.object && node.object.type !== 'Super') walk(node.object, scope);
        if (node.computed && node.property && node.property.type !== 'PrivateIdentifier') walk(node.property, scope);
        return;
      case 'ChainExpression':
        walk(node.expression, scope);
        return;
      case 'CallExpression':
      case 'OptionalCallExpression':
      case 'NewExpression':
        if (node.callee && node.callee.type !== 'Super') walk(node.callee, scope);
        for (const arg of node.arguments) walk(arg, scope);
        return;
      case 'AssignmentExpression':
        walkAssignTarget(node.left, scope);
        walk(node.right, scope);
        return;
      case 'VariableDeclaration':
        for (const decl of node.declarations) {
          walkBinding(decl.id, scope);
          if (decl.init) walk(decl.init, scope);
        }
        return;
      case 'BlockStatement':
        walkBlockLike(node.body, scope);
        return;
      case 'SwitchStatement': {
        walk(node.discriminant, scope);
        const inner = newScope(scope);
        for (const item of node.cases) {
          for (const stmt of item.consequent) addLexical(inner, stmt);
        }
        for (const item of node.cases) {
          // Case tests run in the outer scope. Leaving them unrewritten
          // made three.js constants such as NeverDepth throw at runtime.
          if (item.test) walk(item.test, scope);
          for (const stmt of item.consequent) walk(stmt, inner);
        }
        return;
      }
      case 'CatchClause': {
        const inner = newScope(scope);
        if (node.param) addPatterns(inner, node.param);
        if (node.param) walkBinding(node.param, inner);
        walk(node.body, inner);
        return;
      }
      case 'ForStatement': {
        const inner = newScope(scope);
        if (node.init && node.init.type === 'VariableDeclaration' && node.init.kind !== 'var') {
          for (const decl of node.init.declarations) addPatterns(inner, decl.id);
          for (const decl of node.init.declarations) {
            walkBinding(decl.id, inner);
            if (decl.init) walk(decl.init, inner);
          }
        } else if (node.init) walk(node.init, scope);
        if (node.test) walk(node.test, inner);
        if (node.update) walk(node.update, inner);
        walk(node.body, inner);
        return;
      }
      case 'ForInStatement':
      case 'ForOfStatement': {
        const inner = newScope(scope);
        if (node.left.type === 'VariableDeclaration') {
          if (node.left.kind !== 'var') {
            for (const decl of node.left.declarations) addPatterns(inner, decl.id);
          }
          for (const decl of node.left.declarations) walkBinding(decl.id, inner);
        } else walkAssignTarget(node.left, scope);
        walk(node.right, scope);
        walk(node.body, inner);
        return;
      }
      case 'LabeledStatement':
        walk(node.body, scope);
        return;
      case 'BreakStatement':
      case 'ContinueStatement':
        return;
      case 'TemplateLiteral':
        for (const expr of node.expressions) walk(expr, scope);
        return;
      case 'TaggedTemplateExpression':
        walk(node.tag, scope);
        walk(node.quasi, scope);
        return;
      case 'SpreadElement':
      case 'RestElement':
        walk(node.argument, scope);
        return;
      default:
        for (const child of childrenOf(node)) walk(child, scope);
        return;
    }
  }

  const ordered = [];
  const functions = [];
  const rest = [];
  for (const stmt of ast.body) {
    if (stmt.type === 'ImportDeclaration') continue;
    if (stmt.type === 'ExportNamedDeclaration' && !stmt.declaration) continue;
    const decl = stmt.type === 'ExportNamedDeclaration' ? stmt.declaration : stmt;
    if (decl.type === 'FunctionDeclaration') functions.push(decl);
    else rest.push(decl);
  }
  for (const stmt of functions) walk(stmt, moduleScope);
  for (const stmt of rest) {
    if (stmt.type === 'VariableDeclaration') {
      for (const decl of stmt.declarations) {
        if (decl.id.type !== 'Identifier') {
          throw new Error('top-level destructure at line ' + stmt.loc.start.line);
        }
        edits.push({ start: decl.id.start, end: decl.id.end, text: scopeName + '.' + decl.id.name });
      }
    }
    walk(stmt, moduleScope);
  }

  function applyEdits(start, end, extra) {
    const local = [];
    for (const edit of edits) {
      if (edit.start >= start && edit.end <= end) {
        local.push({ start: edit.start - start, end: edit.end - start, text: edit.text });
      }
    }
    local.sort((a, b) => b.start - a.start || b.end - a.end);
    let slice = text.slice(start, end);
    let guard = slice.length + 1;
    for (const edit of local) {
      if (edit.end > guard) {
        throw new Error('overlapping edit near ' + start);
      }
      slice = slice.slice(0, edit.start) + edit.text + slice.slice(edit.end);
      guard = edit.start;
    }
    if (extra) slice = extra + slice;
    return slice;
  }

  function render(stmt) {
    if (stmt.type === 'FunctionDeclaration' || stmt.type === 'ClassDeclaration') {
      const prefix = scopeName + '.' + stmt.id.name + ' = ';
      return applyEdits(stmt.start, stmt.end, prefix);
    }
    if (stmt.type === 'VariableDeclaration') {
      let rendered = applyEdits(stmt.start, stmt.end, '');
      const kind = stmt.kind;
      if (!rendered.startsWith(kind)) {
        throw new Error('expected ' + kind + ' at ' + stmt.loc.start.line + ': ' + rendered.slice(0, 40));
      }
      rendered = rendered.slice(kind.length).trimStart();
      return rendered;
    }
    return applyEdits(stmt.start, stmt.end, '');
  }

  const pieces = [];
  for (const stmt of functions) pieces.push(render(stmt));
  for (const stmt of rest) pieces.push(render(stmt));

  const groups = [];
  let current = [];
  let size = 0;
  let tail = false;
  // Function and class bodies are lazy-parsed. Pass eagerBudget only for a
  // module whose top-level assignments run real work at import time.
  const eagerBudget = options.eagerBudget == null ? budget : options.eagerBudget;
  function isLazyPiece(piece) {
    return /^__brixScope\.[A-Za-z0-9_$]+ = (?:async )?function\b/.test(piece)
      || /^__brixScope\.[A-Za-z0-9_$]+ = class\b/.test(piece);
  }
  for (const piece of pieces) {
    const hitTail = options.tailTest && options.tailTest(piece);
    if (hitTail) tail = true;
    const limit = isLazyPiece(piece) ? budget : eagerBudget;
    if (!tail && current.length && size + piece.length > limit) {
      groups.push(current);
      current = [];
      size = 0;
    }
    current.push(piece);
    size += piece.length;
  }
  if (current.length) groups.push(current);

  const groupsOut = groups.map((items) => items.join(';\n') + ';');
  for (const group of groupsOut) auditCaseTests(group, moduleScope.names);
  return {
    groups: groupsOut,
    exports,
    scopeName
  };
}

function auditCaseTests(code, moduleNames) {
  const ast = parse(code, { ecmaVersion: 'latest', sourceType: 'module' });
  const hits = new Set();
  function visit(node) {
    if (!node || !node.type) return;
    if (node.type === 'SwitchStatement') {
      for (const item of node.cases) {
        if (!item.test) continue;
        const names = [];
        bareIdents(item.test, names);
        for (const name of names) if (moduleNames.has(name)) hits.add(name);
      }
    }
    for (const child of childrenOf(node)) visit(child);
  }
  function bareIdents(node, out) {
    if (!node || !node.type) return;
    if (node.type === 'Identifier') {
      out.push(node.name);
      return;
    }
    if (node.type === 'MemberExpression') {
      bareIdents(node.object, out);
      if (node.computed) bareIdents(node.property, out);
      return;
    }
    for (const child of childrenOf(node)) bareIdents(child, out);
  }
  visit(ast);
  if (hits.size) {
    throw new Error('switch case still names a module binding: ' + [...hits].join(', '));
  }
}
