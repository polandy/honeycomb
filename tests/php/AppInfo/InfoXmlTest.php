<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\AppInfo;

use OCA\Honeycomb\AppInfo\Application;
use PHPUnit\Framework\TestCase;
use SimpleXMLElement;

final class InfoXmlTest extends TestCase {
	private SimpleXMLElement $info;

	#[\Override]
	protected function setUp(): void {
		$this->info = new SimpleXMLElement($this->readRepositoryFile('appinfo/info.xml'));
	}

	public function testIdMatchesTheApplication(): void {
		$this->assertSame(Application::APP_ID, (string)$this->info->id);
		$this->assertSame('Honeycomb', (string)$this->info->namespace);
	}

	public function testSupportsNextcloud35Only(): void {
		$nextcloud = $this->info->dependencies->nextcloud;
		$this->assertSame('35', (string)$nextcloud['min-version']);
		$this->assertSame('35', (string)$nextcloud['max-version']);
	}

	public function testRequiresPhp83(): void {
		$this->assertSame('8.3', (string)$this->info->dependencies->php['min-version']);
	}

	public function testNavigationOpensTheMainPage(): void {
		$this->assertSame('honeycomb.page.index', (string)$this->info->navigations->navigation->route);
	}

	public function testVersionMatchesPackageJson(): void {
		/** @var array{version: string} $package */
		$package = json_decode($this->readRepositoryFile('package.json'), true, flags: JSON_THROW_ON_ERROR);
		$this->assertSame($package['version'], (string)$this->info->version);
	}

	/** @psalm-suppress ForbiddenCode Reads the app's own metadata, not a user file. */
	private function readRepositoryFile(string $path): string {
		return (string)file_get_contents(__DIR__ . '/../../../' . $path);
	}
}
