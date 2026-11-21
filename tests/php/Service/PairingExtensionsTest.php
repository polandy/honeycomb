<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Service\InvalidListingRequestException;
use OCA\Honeycomb\Service\PairingExtensions;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/** The extension lists of the user's pairing settings, as a folder request sends them. */
final class PairingExtensionsTest extends TestCase {
	// spec: LISTING-003.24
	public function testWithoutListsTheDefaultsApply(): void {
		$extensions = PairingExtensions::fromRequest(null, null);

		$this->assertEquals(PairingExtensions::defaults(), $extensions);
		$this->assertSame('raw', $extensions->roleOf('NEF'));
		$this->assertSame('rendered', $extensions->roleOf('heic'));
		$this->assertNull($extensions->roleOf('png'));
	}

	// spec: LISTING-003.24
	public function testTheSentListsReplaceTheDefaultsAndALeftOutListStaysDefault(): void {
		$extensions = PairingExtensions::fromRequest(['CR2'], null);

		$this->assertSame('raw', $extensions->roleOf('cr2'));
		$this->assertNull($extensions->roleOf('nef'));
		$this->assertSame('rendered', $extensions->roleOf('jpg'));
		$this->assertSame('rendered', PairingExtensions::fromRequest(null, ['jpg', 'tif'])->roleOf('TIF'));
	}

	/** @return array<string, array{mixed, mixed}> */
	public static function invalidLists(): array {
		return [
			'an empty list' => [[], null],
			'a list that is no list' => [['a' => 'nef'], null],
			'a string instead of a list' => ['nef', null],
			'an extension that is no string' => [[7], null],
			'the sidecar extension' => [null, ['jpg', 'XMP']],
			'an extension with a dot' => [['n.ef'], null],
			'an empty extension' => [[''], null],
			'an extension in both lists' => [['nef', 'tif'], ['TIF']],
		];
	}

	// spec: LISTING-003.24
	#[DataProvider('invalidLists')]
	public function testRefusesAnInvalidList(mixed $raw, mixed $rendered): void {
		$this->expectException(InvalidListingRequestException::class);

		PairingExtensions::fromRequest($raw, $rendered);
	}
}
