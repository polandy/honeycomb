// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The pure core of the unused-export gate: sources in, findings out; ported from glissando.
import ts from 'typescript'

/** A file of the repository, by path relative to its root. */
export interface SourceFile {
	readonly path: string
	readonly text: string
}

/** An export no other file imports: `delete` when nothing uses it, `unexport` when only its own module does. */
export interface Finding {
	readonly path: string
	readonly line: number
	readonly name: string
	readonly action: 'delete' | 'unexport'
}

interface Declared {
	readonly name: string
	readonly line: number
	readonly isType: boolean
}

type LocalUse = 'none' | 'value' | 'type-only'

const SCRIPT_BLOCK = /<script\b[^>]*>([\s\S]*?)<\/script>/g
const MODULE_EXTENSIONS = ['.ts', '.vue', '.js', '.mjs', '/index.ts', '/index.js']
const EVERYTHING = '*'

const isComponent = (path: string) => path.endsWith('.vue')

/** A component contributes its script blocks only; the rest is blanked so line numbers hold. */
function scriptText(file: SourceFile): string {
	if (!isComponent(file.path)) {
		return file.text
	}
	const blank = (text: string) => text.replace(/[^\n]/g, ' ')
	let out = ''
	let cursor = 0
	for (const match of file.text.matchAll(SCRIPT_BLOCK)) {
		const body = match[1] ?? ''
		const bodyStart = match.index + match[0].indexOf(body)
		out += blank(file.text.slice(cursor, bodyStart)) + body
		cursor = bodyStart + body.length
	}
	return out + blank(file.text.slice(cursor))
}

/**
 *
 */
function parse(file: SourceFile): ts.SourceFile {
	const path = isComponent(file.path) ? `${file.path}.ts` : file.path
	return ts.createSourceFile(path, scriptText(file), ts.ScriptTarget.Latest, true)
}

/**
 *
 */
function resolve(from: string, specifier: string, known: ReadonlySet<string>): string | null {
	if (!specifier.startsWith('.')) {
		return null
	}
	const parts = from.split('/').slice(0, -1)
	for (const part of specifier.split('/')) {
		if (part === '..') {
			parts.pop()
		} else if (part !== '.') {
			parts.push(part)
		}
	}
	const base = parts.join('/')
	return [base, ...MODULE_EXTENSIONS.map((extension) => base + extension)].find((candidate) => known.has(candidate)) ?? null
}

/**
 *
 */
function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
	return ts.canHaveModifiers(node) && (ts.getModifiers(node)?.some((modifier) => modifier.kind === kind) ?? false)
}

/**
 *
 */
function declaredExports(source: ts.SourceFile): Declared[] {
	const out: Declared[] = []
	const add = (name: ts.Node, isType: boolean) => out.push({
		name: name.getText(source),
		line: source.getLineAndCharacterOfPosition(name.getStart(source)).line + 1,
		isType,
	})
	for (const statement of source.statements) {
		if (ts.isExportDeclaration(statement)) {
			const clause = statement.exportClause
			if (statement.moduleSpecifier === undefined && clause !== undefined && ts.isNamedExports(clause)) {
				clause.elements.forEach((element) => add(element.name, statement.isTypeOnly || element.isTypeOnly))
			}
		} else if (!hasModifier(statement, ts.SyntaxKind.ExportKeyword) || hasModifier(statement, ts.SyntaxKind.DefaultKeyword)) {
			continue
		} else if (ts.isVariableStatement(statement)) {
			statement.declarationList.declarations.filter((declaration) => ts.isIdentifier(declaration.name)).forEach((declaration) => add(declaration.name, false))
		} else if ('name' in statement && statement.name !== undefined) {
			add(statement.name as ts.Node, ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement))
		}
	}
	return out
}

/** The names one module takes from another: an import, a re-export, a dynamic import or an import type. */
function usesOf(node: ts.Node, path: string, known: ReadonlySet<string>): [string | null, string[]] | null {
	const target = (specifier: ts.Expression) => resolve(path, (specifier as ts.StringLiteral).text, known)
	if (ts.isImportDeclaration(node)) {
		const clause = node.importClause
		const bindings = clause?.namedBindings
		if (clause === undefined || (bindings !== undefined && ts.isNamespaceImport(bindings))) {
			return [target(node.moduleSpecifier), [EVERYTHING]]
		}
		const named = bindings === undefined ? [] : bindings.elements.map((element) => (element.propertyName ?? element.name).text)
		return [target(node.moduleSpecifier), clause.name === undefined ? named : ['default', ...named]]
	}
	if (ts.isExportDeclaration(node) && node.moduleSpecifier !== undefined) {
		const clause = node.exportClause
		const names = clause === undefined || ts.isNamespaceExport(clause) ? [EVERYTHING] : clause.elements.map((element) => (element.propertyName ?? element.name).text)
		return [target(node.moduleSpecifier), names]
	}
	if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] !== undefined && ts.isStringLiteralLike(node.arguments[0])) {
		return [target(node.arguments[0]), [EVERYTHING]]
	}
	if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) {
		return [target(node.argument.literal), [EVERYTHING]]
	}
	return null
}

/** Per target module, the names other modules take from it; `*` means all of it. */
function collectUses(files: readonly SourceFile[], known: ReadonlySet<string>): Map<string, Set<string>> {
	const uses = new Map<string, Set<string>>()
	for (const file of files) {
		const visit = (node: ts.Node): void => {
			const [target, names] = usesOf(node, file.path, known) ?? [null, []]
			if (target !== null) {
				uses.set(target, new Set([...uses.get(target) ?? [], ...names]))
			}
			ts.forEachChild(node, visit)
		}
		visit(parse(file))
	}
	return uses
}

/**
 *
 */
function localUse(source: ts.SourceFile, name: string): LocalUse {
	let count = 0
	let inTypeQuery = 0
	const visit = (node: ts.Node): void => {
		if (ts.isIdentifier(node) && node.text === name) {
			count += 1
			inTypeQuery += ts.isTypeQueryNode(node.parent) ? 1 : 0
		}
		ts.forEachChild(node, visit)
	}
	visit(source)
	// The declaration is one occurrence; an `export { name }` list adds another.
	const listed = source.statements.some((statement) => ts.isExportDeclaration(statement)
		&& statement.moduleSpecifier === undefined
		&& statement.exportClause !== undefined
		&& ts.isNamedExports(statement.exportClause)
		&& statement.exportClause.elements.some((element) => element.name.text === name))
	const uses = count - (listed ? 2 : 1)
	if (uses <= 0) {
		return 'none'
	}
	return uses === inTypeQuery ? 'type-only' : 'value'
}

/** The exports of judged files that no other file imports; `files` holds every file that may import one. */
export function findUnusedExports(files: readonly SourceFile[], isJudged: (path: string) => boolean): Finding[] {
	const uses = collectUses(files, new Set(files.map((file) => file.path)))
	const findings: Finding[] = []
	for (const file of files) {
		const used = uses.get(file.path)
		if (!isJudged(file.path) || isComponent(file.path) || used?.has(EVERYTHING)) {
			continue
		}
		const source = parse(file)
		for (const { name, line, isType } of declaredExports(source)) {
			if (used?.has(name)) {
				continue
			}
			const local = localUse(source, name)
			// A type stays nameable for its signatures, and a value only `typeof` reads stays a value.
			if (local === 'type-only' || (local !== 'none' && isType)) {
				continue
			}
			findings.push({ path: file.path, line, name, action: local === 'none' ? 'delete' : 'unexport' })
		}
	}
	return findings
}
