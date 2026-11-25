<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service\Settings;

use OCA\Honeycomb\Domain\Reason;
use OCA\Honeycomb\Tests\Service\ReasonOf;
use OCP\IUser;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class LibraryRootsGuardTest extends TestCase {
	use FakeRoots;

	private function user(): IUser {
		$user = $this->createStub(IUser::class);
		$user->method('getUID')->willReturn('alice');
		return $user;
	}

	/** @return array<string, array{string}> */
	public static function insideRoots(): array {
		return [
			'the root' => ['/Photos'],
			'without the slash' => ['Photos'],
			'with a trailing slash' => ['/Photos/'],
			'a folder in it' => ['/Photos/2019/Italy'],
			'the other root' => ['/Archive/2020'],
		];
	}

	// spec: SETTINGS-001.36
	#[DataProvider('insideRoots')]
	public function testAPathInsideARootPasses(string $path): void {
		$this->expectNotToPerformAssertions();

		$this->rootsGuard(['/Photos', '/Archive'])->ensureInside($this->user(), $path);
	}

	/** @return array<string, array{string}> */
	public static function outsideRoots(): array {
		return [
			'a sibling' => ['/Docs'],
			'a name sharing the prefix' => ['/Photos2'],
			'the parent of a root' => ['/Archive/..'],
			'a parent step out of a root' => ['/Photos/../Docs'],
			'a dot step' => ['/Photos/./2019'],
			'the home folder' => [''],
			'the home folder as a slash' => ['/'],
		];
	}

	// spec: SETTINGS-001.36
	#[DataProvider('outsideRoots')]
	public function testAPathOutsideEveryRootIsABadPath(string $path): void {
		$guard = $this->rootsGuard(['/Photos', '/Archive/2020']);

		$this->assertSame(Reason::BadPath, ReasonOf::call(fn () => $guard->ensureInside($this->user(), $path)));
	}

	// spec: SETTINGS-001.36
	public function testTheParentOfARootIsOutside(): void {
		$guard = $this->rootsGuard(['/Archive/2020']);

		$this->assertSame(Reason::BadPath, ReasonOf::call(fn () => $guard->ensureInside($this->user(), '/Archive')));
	}

	// spec: SETTINGS-001.36
	public function testWithoutRootsEveryPathPasses(): void {
		$this->expectNotToPerformAssertions();

		$this->rootsGuard()->ensureInside($this->user(), '/Anything');
		$this->rootsGuard()->ensureInside($this->user(), '');
	}
}
