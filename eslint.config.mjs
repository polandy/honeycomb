// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { recommended } from '@nextcloud/eslint-config'
import tseslint from 'typescript-eslint'
import noRawErrorText from './scripts/eslint-rules/no-raw-error-text.mjs'

const TYPESCRIPT_FILES = ['**/*.ts', '**/*.vue']
const LOGIC_FILES = ['src/logic/**/*.ts']
const TEST_FILES = ['tests/**/*.ts']

// The folders of src/ a folder may import besides itself and the layers (docs/dev/03-coding-standards.md §3.6).
const LAYERS = ['logic', 'api', 'shared', 'components']
const FOLDER_IMPORTS = {
	logic: [],
	shared: ['logic'],
	api: ['logic', 'shared', 'hashes'],
	cull: [...LAYERS, 'folders', 'grid', 'hashes', 'loupe', 'move', 'series', 'settings', 'sidecars', 'statistics', 'trash'],
	folders: LAYERS,
	grid: LAYERS,
	hashes: LAYERS,
	immich: [...LAYERS, 'cull', 'settings'],
	loupe: [...LAYERS, 'hashes', 'series', 'settings'],
	move: [...LAYERS, 'trash'],
	series: [...LAYERS, 'hashes'],
	settings: LAYERS,
	sidecars: [...LAYERS, 'cull'],
	statistics: [...LAYERS, 'settings'],
	trash: LAYERS,
}
const FOLDERS = ['app', 'components', ...Object.keys(FOLDER_IMPORTS)]

/**
 * The import pattern that keeps a folder out of the folders it does not list.
 *
 * @param {string} folder the folder under src/
 */
function folderPattern(folder) {
	const forbidden = FOLDERS.filter((other) => other !== folder && !FOLDER_IMPORTS[folder].includes(other))
	return { regex: `^(\\.\\./)+(${forbidden.join('|')})/`, message: `src/${folder} imports only the folders it lists in eslint.config.mjs.` }
}

const WALL_CLOCK = [
	{ selector: 'CallExpression[callee.object.name="Date"][callee.property.name="now"]', message: 'Inject a clock.' },
	{ selector: 'NewExpression[callee.name="Date"][arguments.length=0]', message: 'Inject a clock.' },
]

const RANDOMNESS = { selector: 'CallExpression[callee.object.name="Math"][callee.property.name="random"]', message: 'Inject randomness.' }
const TIMERS = { selector: 'CallExpression[callee.name=/^set(Timeout|Interval)$/]', message: 'No timing waits in tests.' }

// The l10n extractor reads only literals, and a message function must get a translated string (ADR 0007).
const UNTRANSLATABLE = [
	{ selector: 'CallExpression[callee.name="t"]:not([arguments.0.value="honeycomb"][arguments.1.type="Literal"])', message: 't() takes the literal app id \'honeycomb\' and a literal string.' },
	{ selector: 'CallExpression[callee.name="n"]:not([arguments.0.value="honeycomb"][arguments.1.type="Literal"][arguments.2.type="Literal"])', message: 'n() takes the literal app id \'honeycomb\' and literal singular and plural strings.' },
	{ selector: 'CallExpression[callee.name=/^show(Error|Warning|Info|Success|Message|Undo)$/][arguments.0.type=/^(Literal|TemplateLiteral)$/]', message: 'Pass a t() or n() string to the message.' },
]

const FORBIDDEN_PROPERTIES = [
	{ property: 'innerHTML', message: 'Build nodes or bind in the template.' },
	{ property: 'outerHTML', message: 'Build nodes or bind in the template.' },
	{ property: 'waitForTimeout', message: 'Wait on a visible state, not on time.' },
]

export default [
	{ ignores: ['docs/dev/mockup/**', 'vendor/**', 'coverage/**', 'js/**'] },
	...recommended,
	{
		files: TYPESCRIPT_FILES,
		languageOptions: {
			parserOptions: {
				projectService: {
					// Lets tests/js/conventions lint snippets under paths that do not exist yet.
					allowDefaultProject: ['src/*/example.ts', 'src/*/ExampleView.vue', 'tests/js/example.test.ts'],
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.vue'],
			},
		},
		rules: {
			'@typescript-eslint/no-explicit-any': 'error',
			'@typescript-eslint/no-floating-promises': 'error',
			'@typescript-eslint/no-misused-promises': 'error',
			'@typescript-eslint/no-unused-vars': ['error', {
				argsIgnorePattern: '^_',
				varsIgnorePattern: '^_',
				caughtErrorsIgnorePattern: '^_',
			}],
			'jsdoc/require-param': 'off',
			'no-restricted-properties': ['error', ...FORBIDDEN_PROPERTIES],
			'no-restricted-syntax': ['error', ...UNTRANSLATABLE],
		},
	},
	{
		files: ['src/**/*.ts', 'src/**/*.vue'],
		plugins: { honeycomb: { rules: { 'no-raw-error-text': noRawErrorText } } },
		rules: {
			'honeycomb/no-raw-error-text': 'error',
			// `void` hides a rejection; name the work with fireAndLog.
			'@typescript-eslint/no-floating-promises': ['error', { ignoreVoid: false }],
		},
	},
	{
		files: ['**/*.vue'],
		rules: {
			'vue/no-v-html': 'error',
			'vue/no-bare-strings-in-template': 'error',
			'vue/no-restricted-syntax': ['error', ...UNTRANSLATABLE],
		},
	},
	{
		files: LOGIC_FILES,
		rules: {
			'no-restricted-imports': ['error', {
				patterns: [{
					group: ['vue', 'pinia', '@nextcloud/*', 'axios'],
					message: 'Logic modules stay pure (ADR 0006); wire them in a component or store.',
				}, folderPattern('logic')],
			}],
			'no-restricted-syntax': ['error', ...WALL_CLOCK, RANDOMNESS],
		},
	},
	...Object.keys(FOLDER_IMPORTS).filter((folder) => folder !== 'logic').map((folder) => ({
		files: [`src/${folder}/**/*.ts`, `src/${folder}/**/*.vue`],
		rules: { 'no-restricted-imports': ['error', { patterns: [folderPattern(folder)] }] },
	})),
	{
		files: TEST_FILES,
		rules: {
			'no-restricted-syntax': ['error', ...WALL_CLOCK, TIMERS],
		},
	},
	{
		files: ['**/*.js', '**/*.mjs'],
		...tseslint.configs.disableTypeChecked,
	},
]
