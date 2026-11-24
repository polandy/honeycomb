<?php

declare(strict_types=1);

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace OCA\Honeycomb\Tests\Conventions;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/** A package of `lib/` uses only the packages it lists (docs/dev/03-coding-standards.md, Packages). */
final class PackageDependencyTest extends TestCase {
	private const APP = 'OCA\\Honeycomb\\';

	private const REFERENCE = '/\\\\?OCA\\\\Honeycomb\\\\([A-Za-z\\\\]+)/';

	/** The packages each package may use besides itself; a package not listed may use every one. */
	private const ALLOWED = [
		'Domain' => [],
		'Db' => ['Domain', 'Immich', 'BackgroundJob'],
		'Immich' => ['Domain', 'AppInfo'],
		'Service\\App' => ['Domain'],
		'Service\\Decision' => ['Domain', 'Service\\Files', 'Service\\Stats', 'Service\\Support'],
		'Service\\Files' => ['Domain'],
		'Service\\Folder' => ['Domain', 'Service\\Files', 'Service\\Listing', 'Service\\Stats', 'Service\\Support'],
		'Service\\Hash' => ['Domain', 'Service\\Files', 'Service\\Support'],
		'Service\\Image' => ['Domain', 'Service\\Files', 'Service\\Support'],
		'Service\\Lifecycle' => ['Domain', 'Immich', 'Service\\Support'],
		'Service\\Listing' => ['Domain', 'Service\\Files'],
		'Service\\Move' => ['Domain', 'Service\\Files', 'Service\\Stats', 'Service\\Trash'],
		'Service\\Quality' => ['Domain', 'Service\\Files', 'Service\\Support'],
		'Service\\Series' => ['Domain', 'Service\\Files', 'Service\\Stats', 'Service\\Support'],
		'Service\\Settings' => ['Domain'],
		'Service\\Sidecar' => ['Domain', 'Service\\Files', 'Service\\Stats'],
		'Service\\Stats' => ['Domain', 'Service\\Settings', 'Service\\Support'],
		'Service\\Support' => [],
		'Service\\Trash' => ['Domain', 'Service\\Files', 'Service\\Stats', 'Service\\Support'],
		'Service\\Xmp' => ['Domain', 'Service\\Files', 'Service\\Sidecar', 'Service\\Support'],
	];

	public function testEveryPackageUsesOnlyItsAllowedPackages(): void {
		$violations = [];
		foreach ($this->sources() as $file => $code) {
			foreach ($this->violations($code) as $class) {
				$violations[] = "$file uses $class";
			}
		}

		$this->assertSame([], $violations);
	}

	public function testEveryServiceLivesInAPackage(): void {
		$loose = array_keys(array_filter($this->sources(), fn (string $code): bool => preg_match('/^namespace OCA\\\\Honeycomb\\\\Service;/m', $code) === 1));

		$this->assertSame([], $loose);
	}

	/** @return array<string, array{string, list<string>}> */
	public static function sourcesAndViolations(): array {
		return [
			'the database on a service' => ["namespace OCA\\Honeycomb\\Db;\nuse OCA\\Honeycomb\\Service\\Flag;", ['OCA\\Honeycomb\\Service\\Flag']],
			'the database on the domain' => ["namespace OCA\\Honeycomb\\Db;\nuse OCA\\Honeycomb\\Domain\\Flag;", []],
			'the domain on a sub-namespace of itself' => ["namespace OCA\\Honeycomb\\Domain;\nuse OCA\\Honeycomb\\Domain\\Store\\FlagStore;", []],
			'the domain on the database' => ["namespace OCA\\Honeycomb\\Domain\\Store;\nuse OCA\\Honeycomb\\Db\\FlagMapper;", ['OCA\\Honeycomb\\Db\\FlagMapper']],
			'a fully qualified name in code' => ["namespace OCA\\Honeycomb\\Immich;\n\$a = \\OCA\\Honeycomb\\Service\\Flag::Picked;", ['OCA\\Honeycomb\\Service\\Flag']],
			'a package without rules' => ["namespace OCA\\Honeycomb\\Controller;\nuse OCA\\Honeycomb\\Db\\FlagMapper;", []],
			'a service on a package it lists' => ["namespace OCA\\Honeycomb\\Service\\Move;\nuse OCA\\Honeycomb\\Service\\Trash\\TrashResult;", []],
			'a service on a package it does not list' => ["namespace OCA\\Honeycomb\\Service\\Trash;\nuse OCA\\Honeycomb\\Service\\Move\\MoveResult;", ['OCA\\Honeycomb\\Service\\Move\\MoveResult']],
			'a package named like an allowed one' => ["namespace OCA\\Honeycomb\\Db;\nuse OCA\\Honeycomb\\DomainX\\Flag;", ['OCA\\Honeycomb\\DomainX\\Flag']],
		];
	}

	/** @param list<string> $expected */
	#[DataProvider('sourcesAndViolations')]
	public function testFindsTheReferencesOutsideTheAllowedPackages(string $code, array $expected): void {
		$this->assertSame($expected, $this->violations($code));
	}

	/** @return list<string> the app classes `$code` refers to that its package may not use */
	private function violations(string $code): array {
		if (preg_match('/^namespace OCA\\\\Honeycomb\\\\([A-Za-z\\\\]+);/m', $code, $namespace) !== 1) {
			return [];
		}
		$package = $this->ruleOf($namespace[1]);
		if ($package === null) {
			return [];
		}
		preg_match_all(self::REFERENCE, $code, $references);
		$violations = [];
		foreach ($references[1] as $reference) {
			if (!$this->isAllowed($reference, [$package, ...self::ALLOWED[$package]])) {
				$violations[] = self::APP . $reference;
			}
		}
		return array_values(array_unique($violations));
	}

	/** @return key-of<self::ALLOWED>|null the longest listed package that holds `$namespace` */
	private function ruleOf(string $namespace): ?string {
		$rules = array_filter(array_keys(self::ALLOWED), fn (string $package): bool => $this->isAllowed($namespace, [$package]));
		usort($rules, fn (string $a, string $b): int => strlen($b) <=> strlen($a));
		return $rules[0] ?? null;
	}

	/** @param list<string> $packages */
	private function isAllowed(string $name, array $packages): bool {
		foreach ($packages as $package) {
			if ($name === $package || str_starts_with($name, "$package\\")) {
				return true;
			}
		}
		return false;
	}

	/** @return array<string, string> the source of each file under lib/ by its relative path */
	private function sources(): array {
		$root = dirname(__DIR__, 3);
		$sources = [];
		/** @var iterable<\SplFileInfo> $files */
		$files = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator("$root/lib", \FilesystemIterator::SKIP_DOTS));
		foreach ($files as $file) {
			if ($file->getExtension() === 'php') {
				$sources[substr($file->getPathname(), strlen("$root/"))] = (string)$file->openFile()->fread(max(1, (int)$file->getSize()));
			}
		}
		ksort($sources);
		return $sources;
	}
}
