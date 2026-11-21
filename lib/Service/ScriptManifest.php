<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service;

use OCA\Honeycomb\AppInfo\Application;
use OCP\App\IAppManager;

/** Names the built script of a page entry, whose content hash busts the browser cache (ADR 0033). */
final class ScriptManifest {
	public const string MAIN = 'main';
	public const string SIMILARITY = 'similarity';
	public const string STATISTICS = 'statistics';
	public const string ORPHANED_SIDECARS = 'orphaned-sidecars';
	/** Written by the build: entry name => script name. */
	private const string PATH = '/js/scripts.php';

	public function __construct(
		private IAppManager $apps,
	) {
	}

	/**
	 * The script name `Util::addScript()` takes for the entry `$entry`, e.g. `honeycomb-main-Ab1cD2e`.
	 * @throws ScriptManifestException when the app is not built or the build lacks the entry
	 */
	public function script(string $entry): string {
		$path = $this->apps->getAppPath(Application::APP_ID) . self::PATH;
		if (!is_file($path)) {
			throw new ScriptManifestException("No build at $path");
		}
		/**
		 * @psalm-suppress UnresolvableInclude The build writes it.
		 * @var array<string, string>|false $scripts
		 */
		$scripts = require $path;
		$script = is_array($scripts) ? ($scripts[$entry] ?? null) : null;
		if (!is_string($script)) {
			throw new ScriptManifestException("The build has no script for $entry");
		}
		return $script;
	}
}
