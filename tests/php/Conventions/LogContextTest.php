<?php

declare(strict_types=1);

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace OCA\Honeycomb\Tests\Conventions;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/** A log call never carries a path or a file name, only ids (docs/dev/conventions.md §3). */
final class LogContextTest extends TestCase {
	private const LOG_CALL = '/->logger->\w+\((.*?)\);/s';

	private const PATH_IN_A_CALL = '/\'(?:path|paths|name|filename|folder|keyFile|file)\'\s*=>|\{(?:path|name|filename|folder|keyFile|file)\}|\$\w*[pP]ath\b|->(?:getPath|getName|getInternalPath)\(/';

	public function testNoLogCallInLibHoldsAPath(): void {
		$violations = [];
		foreach ($this->sources() as $file => $code) {
			foreach ($this->violations($code) as $call) {
				$violations[] = "$file: $call";
			}
		}

		$this->assertSame([], $violations);
	}

	/** @return array<string, array{string}> */
	public static function pathLines(): array {
		return [
			'a path key' => ["\$this->logger->warning('Saved', ['path' => \$path]);"],
			'a placeholder' => ["\$this->logger->error('Cannot read {path}', ['id' => 1]);"],
			'a node path' => ["\$this->logger->warning('Moved', ['fileId' => \$node->getPath()]);"],
			'a node name on two lines' => ["\$this->logger->info(\n\t'Moved',\n\t['fileId' => \$node->getName()],\n);"],
		];
	}

	#[DataProvider('pathLines')]
	public function testAnInsertedPathLineIsFound(string $line): void {
		$this->assertCount(1, $this->violations($line));
	}

	public function testAnIdOnlyLineIsAccepted(): void {
		$line = "\$this->logger->warning('A file could not be moved', ['fileId' => \$source->getId(), 'exception' => \$e]);";

		$this->assertSame([], $this->violations($line));
	}

	/** @return list<string> */
	private function violations(string $code): array {
		preg_match_all(self::LOG_CALL, $code, $calls);
		return array_values(array_filter($calls[0], static fn (string $call): bool => preg_match(self::PATH_IN_A_CALL, $call) === 1));
	}

	/** @return array<string, string> */
	private function sources(): array {
		$sources = [];
		/** @var iterable<\SplFileInfo> $files */
		$files = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator(__DIR__ . '/../../../lib', \FilesystemIterator::SKIP_DOTS));
		foreach ($files as $file) {
			if ($file->getExtension() === 'php') {
				$sources[$file->getPathname()] = $file->openFile()->fread(max(1, (int)$file->getSize())) ?: '';
			}
		}
		$this->assertNotSame([], $sources);
		return $sources;
	}
}
