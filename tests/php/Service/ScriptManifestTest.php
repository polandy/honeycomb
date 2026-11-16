<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\AppInfo\Application;
use OCA\Honeycomb\Service\ScriptManifest;
use OCA\Honeycomb\Service\ScriptManifestException;
use OCP\App\IAppManager;
use PHPUnit\Framework\TestCase;

final class ScriptManifestTest extends TestCase {
	private const string FIXTURES = __DIR__ . '/../../fixtures/script-manifest';

	// spec: APP-001.10
	public function testNamesTheBuiltScriptOfAnEntryWithItsHash(): void {
		$manifest = $this->manifest('built');

		$this->assertSame('honeycomb-main-Ab1_cD2e', $manifest->script(ScriptManifest::MAIN));
		$this->assertSame('honeycomb-similarity-Xy9-Zw8v', $manifest->script(ScriptManifest::SIMILARITY));
	}

	// spec: APP-001.10
	public function testFailsLoudWithoutABuild(): void {
		$this->expectException(ScriptManifestException::class);

		$this->manifest('unbuilt')->script(ScriptManifest::MAIN);
	}

	// spec: APP-001.10
	public function testFailsLoudForAnEntryTheBuildLacks(): void {
		$this->expectException(ScriptManifestException::class);

		$this->manifest('built')->script('src/missing.ts');
	}

	/** The manifest of the app installed at the fixture folder `$app`. */
	private function manifest(string $app): ScriptManifest {
		$apps = $this->createStub(IAppManager::class);
		$apps->method('getAppPath')->willReturnCallback(static fn (string $id): string => $id === Application::APP_ID ? self::FIXTURES . '/' . $app : '/nowhere');
		return new ScriptManifest($apps);
	}
}
