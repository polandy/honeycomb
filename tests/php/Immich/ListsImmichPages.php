<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Immich;

use OCA\Honeycomb\Immich\AssetEntries;
use OCA\Honeycomb\Immich\Connection;
use OCA\Honeycomb\Immich\DecidedPages;
use OCA\Honeycomb\Immich\ImmichClient;
use OCA\Honeycomb\Immich\ImmichListing;
use OCA\Honeycomb\Immich\ImmichSearchFilter;
use OCA\Honeycomb\Immich\ListingCursors;
use OCP\AppFramework\Utility\ITimeFactory;
use OCP\Security\ICrypto;

/** The listing of alice's phone connection against the fake Immich server, at a clock the test moves. */
trait ListsImmichPages {
	private const int NOW = 1_795_000_000;

	private FakeImmichDecisionStore $decisions;
	private int $now = self::NOW;

	private function listing(): ImmichListing {
		$files = new FakeLocalFiles();
		$files->files['/keys/alice-phone.key'] = 'key';
		$time = $this->createStub(ITimeFactory::class);
		$time->method('getTime')->willReturnCallback(fn (): int => $this->now);
		$crypto = $this->createStub(ICrypto::class);
		$crypto->method('calculateHMAC')->willReturnCallback(static fn (string $message): string => hash_hmac('sha256', $message, 'secret'));
		$client = new ImmichClient($this->immichClients(), $files, new FakeLogger());
		$filter = new ImmichSearchFilter();
		$cursors = new ListingCursors($crypto);
		$entries = new AssetEntries();
		return new ImmichListing($client, $filter, $cursors, $entries, $time, $this->decisions, new DecidedPages($client, $filter, $cursors, $entries, $this->decisions));
	}

	private static function id(int $n): string {
		return sprintf('00000000-0000-4000-8000-%012d', $n);
	}

	private function connection(): Connection {
		return new Connection('alice-phone', 'alice', 'Phone', 'http://immich-server:2283', '/keys/alice-phone.key', false);
	}
}
