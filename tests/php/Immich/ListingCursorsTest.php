<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Immich;

use OCA\Honeycomb\Immich\ImmichError;
use OCA\Honeycomb\Immich\ListingCursors;
use OCA\Honeycomb\Immich\ListingFilters;
use OCP\Security\ICrypto;
use PHPUnit\Framework\TestCase;

final class ListingCursorsTest extends TestCase {
	use AssertsImmichFailure;

	private const int RECEIVED_BEFORE = 1_795_000_000;

	public function testACursorOpensToImmichsCursorAndTheTimeOfTheFirstPage(): void {
		$filters = new ListingFilters(['kinds' => ['photo']]);
		$cursor = $this->cursors()->issue('alice-phone', $filters, 'eyJvZmZzZXQiOjEwMH0', self::RECEIVED_BEFORE);

		$this->assertSame(['immich' => 'eyJvZmZzZXQiOjEwMH0', 'receivedBefore' => self::RECEIVED_BEFORE], $this->cursors()->open($cursor, 'alice-phone', $filters));
		$this->assertMatchesRegularExpression('/^[A-Za-z0-9_-]+\.[0-9a-f]+$/', $cursor);
	}

	// spec: IMMICH-002.5
	public function testACursorOfAnotherConnectionOrOtherFiltersIsABadRequest(): void {
		$filters = new ListingFilters(['kinds' => ['photo']]);
		$cursor = $this->cursors()->issue('alice-phone', $filters, 'eyJvZmZzZXQiOjEwMH0', self::RECEIVED_BEFORE);

		$this->assertFailsWith(ImmichError::Request, fn () => $this->cursors()->open($cursor, 'alice-camera', $filters));
		$this->assertFailsWith(ImmichError::Request, fn () => $this->cursors()->open($cursor, 'alice-phone', new ListingFilters(['kinds' => ['video']])));
	}

	// spec: IMMICH-002.5
	public function testAForgedOrBrokenCursorIsABadRequest(): void {
		$filters = new ListingFilters([]);
		$cursor = $this->cursors()->issue('alice-phone', $filters, 'eyJvZmZzZXQiOjEwMH0', self::RECEIVED_BEFORE);
		[$payload, $signature] = explode('.', $cursor);
		$forged = rtrim(strtr(base64_encode((string)json_encode(['c' => 'alice-phone', 'f' => $filters->fingerprint(), 'i' => 'eyJvZmZzZXQiOjB9', 't' => self::RECEIVED_BEFORE + 60])), '+/', '-_'), '=');

		foreach (["$forged.$signature", $payload, "$payload.", '.', '!!.00', 'bm90IGpzb24.' . bin2hex($this->sign('bm90IGpzb24'))] as $bad) {
			$this->assertFailsWith(ImmichError::Request, fn () => $this->cursors()->open($bad, 'alice-phone', $filters));
		}
	}

	private function cursors(): ListingCursors {
		$crypto = $this->createStub(ICrypto::class);
		$crypto->method('calculateHMAC')->willReturnCallback(fn (string $message): string => $this->sign($message));
		return new ListingCursors($crypto);
	}

	/** Raw bytes, as Nextcloud's `ICrypto::calculateHMAC` answers. */
	private function sign(string $message): string {
		return hash_hmac('sha256', $message, 'instance secret', true);
	}
}
