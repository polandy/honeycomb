// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Refuses reading the text of a caught error or a rejection, so it cannot reach the user (docs/conventions.md §3).

const TEXT_PROPERTIES = new Set(['message', 'stack', 'toString'])
const WRAPPERS = new Set(['TSAsExpression', 'TSNonNullExpression', 'TSTypeAssertion', 'TSSatisfiesExpression'])
const TEXT_FUNCTIONS = new Set(['String', 'JSON.stringify'])
const MESSAGE = 'Raw error text never reaches the user: log the error and show a t() sentence (docs/conventions.md §3).'

/**
 * The dotted name of a called function, such as `JSON.stringify`.
 *
 * @param {import('estree').Expression} callee the called expression
 */
function calleeName(callee) {
	return callee.type === 'MemberExpression' && !callee.computed
		? `${callee.object.name}.${callee.property.name}`
		: callee.name
}

const propertyName = (node) => node.type === 'Identifier' ? node.name : node.value

/**
 * Whether a destructuring pattern takes the text out of the error.
 *
 * @param {import('estree').Node} pattern the pattern
 */
function takesText(pattern) {
	return pattern.type === 'ObjectPattern'
		&& pattern.properties.some((property) => property.type === 'Property' && TEXT_PROPERTIES.has(propertyName(property.key)))
}

/**
 * Whether the use of the error at `node` reads its text.
 *
 * @param {import('estree').Node} node the reference, outside any type cast
 */
function readsText(node) {
	const parent = node.parent
	switch (parent.type) {
		case 'MemberExpression':
			return parent.object === node && !parent.computed && TEXT_PROPERTIES.has(parent.property.name)
		case 'CallExpression':
			return TEXT_FUNCTIONS.has(calleeName(parent.callee))
		case 'TemplateLiteral':
			return true
		case 'BinaryExpression':
			return parent.operator === '+'
		case 'VariableDeclarator':
			return parent.init === node && takesText(parent.id)
		default:
			return false
	}
}

/**
 * The parameter that receives a rejection: the first of `.catch(fn)`, the first of the second function of `.then()`.
 *
 * @param {import('estree').CallExpression} call the call
 */
function rejectionParameter(call) {
	const callee = call.callee
	if (callee.type !== 'MemberExpression' || callee.computed) {
		return null
	}
	const handler = { catch: call.arguments[0], then: call.arguments[1] }[callee.property.name]
	const isFunction = handler?.type === 'ArrowFunctionExpression' || handler?.type === 'FunctionExpression'
	return isFunction ? { owner: handler, parameter: handler.params[0] } : null
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
	meta: {
		type: 'problem',
		docs: { description: 'Forbid reading the text of a caught error or a rejection' },
		schema: [],
	},
	create(context) {
		const sourceCode = context.sourceCode

		/**
		 * Reports every use of the error that `parameter` of `owner` receives and that reads its text.
		 *
		 * @param {import('estree').Node} owner the catch clause or the handler
		 * @param {import('estree').Node | undefined | null} parameter the binding of the error
		 */
		function check(owner, parameter) {
			if (!parameter) {
				return
			}
			if (takesText(parameter)) {
				context.report({ node: parameter, message: MESSAGE })
				return
			}
			const variable = sourceCode.getDeclaredVariables(owner).find((declared) => declared.identifiers.includes(parameter))
			for (const reference of variable?.references ?? []) {
				let node = reference.identifier
				while (WRAPPERS.has(node.parent.type)) {
					node = node.parent
				}
				if (readsText(node)) {
					context.report({ node, message: MESSAGE })
				}
			}
		}

		return {
			CatchClause: (clause) => check(clause, clause.param),
			CallExpression(call) {
				const rejection = rejectionParameter(call)
				if (rejection) {
					check(rejection.owner, rejection.parameter)
				}
			},
		}
	},
}
