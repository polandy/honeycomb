<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCP\IAppConfig;

/** An app config stub whose integer values live in `$appConfig` and string values in `$appConfigStrings`. */
trait AppConfigStub {
	/** @var array<string, int> */
	private array $appConfig = [];

	/** @var array<string, string> */
	private array $appConfigStrings = [];

	private function appConfigStub(): IAppConfig {
		$config = $this->createStub(IAppConfig::class);
		$config->method('getValueInt')->willReturnCallback(fn (string $app, string $key, int $default = 0): int => $this->appConfig[$key] ?? $default);
		$config->method('setValueInt')->willReturnCallback(function (string $app, string $key, int $value): bool {
			$this->appConfig[$key] = $value;
			return true;
		});
		$config->method('getValueString')->willReturnCallback(fn (string $app, string $key, string $default = ''): string => $this->appConfigStrings[$key] ?? $default);
		$config->method('setValueString')->willReturnCallback(function (string $app, string $key, string $value): bool {
			$this->appConfigStrings[$key] = $value;
			return true;
		});
		return $config;
	}
}
