<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCP\IAppConfig;

/** An app config stub whose integer values live in `$appConfig`. */
trait AppConfigStub {
	/** @var array<string, int> */
	private array $appConfig = [];

	private function appConfigStub(): IAppConfig {
		$config = $this->createStub(IAppConfig::class);
		$config->method('getValueInt')->willReturnCallback(fn (string $app, string $key, int $default = 0): int => $this->appConfig[$key] ?? $default);
		$config->method('setValueInt')->willReturnCallback(function (string $app, string $key, int $value): bool {
			$this->appConfig[$key] = $value;
			return true;
		});
		return $config;
	}
}
