<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCA\Honeycomb\AppInfo\Application;
use OCP\App\IAppManager;

/** Names the built script of a page entry from the Vite manifest, whose content hash busts the browser cache (ADR 0033). */
final class ScriptManifest {
	public const string MAIN = 'src/main.ts';
	public const string SIMILARITY = 'src/similarity-main.ts';
	private const string PATH = '/js/manifest.json';
	private const string SCRIPT = '#^js/(.+)\.mjs$#';

	public function __construct(
		private IAppManager $apps,
	) {
	}

	/**
	 * The script name `Util::addScript()` takes for the entry `$source`, e.g. `honeycomb-main-Ab1cD2e`.
	 * @throws ScriptManifestException when the app is not built or the build lacks the entry
	 */
	public function script(string $source): string {
		$path = $this->apps->getAppPath(Application::APP_ID) . self::PATH;
		$json = is_file($path) ? file_get_contents($path) : false;
		if ($json === false) {
			throw new ScriptManifestException("No build manifest at $path");
		}
		try {
			$manifest = json_decode($json, true, flags: JSON_THROW_ON_ERROR);
		} catch (\JsonException $error) {
			throw new ScriptManifestException("Unreadable build manifest at $path", previous: $error);
		}
		$file = is_array($manifest) && is_array($manifest[$source] ?? null) ? ($manifest[$source]['file'] ?? null) : null;
		if (!is_string($file) || preg_match(self::SCRIPT, $file, $match) !== 1) {
			throw new ScriptManifestException("The build manifest has no script for $source");
		}
		return $match[1];
	}
}
