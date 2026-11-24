<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Service;

use OCA\Honeycomb\Domain\FileFlag;
use OCA\Honeycomb\Domain\FileIds;
use OCA\Honeycomb\Domain\InvalidRequestException;
use OCA\Honeycomb\Domain\PairingExtensions;
use OCA\Honeycomb\Domain\Reason;
use OCA\Honeycomb\Domain\VisualHash;
use OCA\Honeycomb\Service\MoveRequest;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class InvalidRequestReasonTest extends TestCase {
	/** @return array<string, array{Reason, \Closure}> */
	public static function refusals(): array {
		return [
			'not an object' => [Reason::NotAnObject, static fn () => FileFlag::fromRequest('picked', 0, 'u')],
			'not a list' => [Reason::NotAList, static fn () => FileIds::items(['a' => 1], 5)],
			'too many' => [Reason::TooMany, static fn () => FileIds::items([1, 2, 3], 2)],
			'bad file id' => [Reason::BadFileId, static fn () => FileIds::parse([0], 5)],
			'bad etag' => [Reason::BadEtag, static fn () => VisualHash::fromRequest(['fileId' => 1, 'etag' => '', 'hash' => '0000000000000000'])],
			'duplicate' => [Reason::Duplicate, static fn () => FileIds::eachOnce([1, 1])],
			'conflict' => [Reason::Conflict, static fn () => PairingExtensions::fromRequest(['cr2'], ['cr2'])],
			'bad value' => [Reason::BadValue, static fn () => FileFlag::fromRequest(['fileId' => 1, 'flag' => 'starred', 'keepRaw' => true], 0, 'u')],
			'bad path' => [Reason::BadPath, static fn () => MoveRequest::folders(['no/slash'])],
		];
	}

	// spec: APP-004.5
	#[DataProvider('refusals')]
	public function testARefusalNamesItsReason(Reason $reason, \Closure $call): void {
		$this->assertSame($reason, ReasonOf::call($call));
	}

	// spec: APP-004.5
	public function testEveryReasonHasItsOwnKebabCaseCode(): void {
		$codes = array_map(static fn (Reason $reason): string => $reason->value, Reason::cases());

		$this->assertSame(array_unique($codes), $codes);
		$this->assertCount(12, $codes);
		foreach ($codes as $code) {
			$this->assertMatchesRegularExpression('/^[a-z]+(-[a-z]+)*$/', $code);
		}
	}

	// spec: APP-004.5
	public function testBecauseKeepsTheDetailAndThePreviousFailure(): void {
		$previous = new \RuntimeException('inner');

		$refused = InvalidRequestException::because(Reason::BadValue, 'rating must be 0 to 5', $previous);

		$this->assertSame(Reason::BadValue, $refused->reason);
		$this->assertSame('rating must be 0 to 5', $refused->getMessage());
		$this->assertSame($previous, $refused->getPrevious());
	}
}
