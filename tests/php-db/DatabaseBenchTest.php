<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\DbTests;

use OCA\Honeycomb\Db\ImmichDecisionMapper;
use OCA\Honeycomb\Db\XmpCacheMapper;
use OCA\Honeycomb\Domain\ColourLabel;
use OCA\Honeycomb\Domain\Flag;
use OCA\Honeycomb\Domain\XmpCacheRow;
use OCA\Honeycomb\Domain\XmpReadState;
use OCA\Honeycomb\Domain\XmpSource;
use OCA\Honeycomb\Immich\AssetDecision;
use OCA\Honeycomb\Immich\AssetKind;
use OCA\Honeycomb\Immich\ListingFilters;
use PHPUnit\Framework\Attributes\Group;

/** Measures, without a time limit, the XMP cache and the Immich listing at the scale of docs/dev/performance.md; `scripts/php-db-tests.sh --group bench` runs it. */
#[Group('bench')]
final class DatabaseBenchTest extends DbTestCase {
	private const int CACHED_ROWS = 60_000;
	private const int SHARED_FILES = 12_000;
	private const int SHARING_USERS = 5;
	private const int SMALL_TRANSACTION = 5_000;
	private const int IMMICH_DECISIONS = 50_000;
	private const int IMMICH_NOISE = 10_000;
	private const int PAGE = 200;
	private const int RUNS = 15;
	private const int LOOKUP = 500;
	/** Three assets share each second, as a burst does, so the asset id breaks the ties. */
	private const int ASSETS_PER_SECOND = 3;
	private const int FIRST_SECOND = 1_600_000_000;
	/** One in this many rows is not read, or has no flag. */
	private const int SPARSE = 5;

	private static function cached(int $fileId): XmpCacheRow {
		$read = $fileId % self::SPARSE !== 0;
		return new XmpCacheRow($fileId, XmpSource::Sidecar, "etag-$fileId", 2, $read ? XmpReadState::Read : XmpReadState::None, null, $read ? $fileId % 6 : null, $read ? self::flag($fileId) : null, $read ? ColourLabel::Red : null, null, $read ? ['Holiday', 'People/Anna'] : null);
	}

	private static function flag(int $index): Flag {
		return match ($index % 3) {
			0 => Flag::Picked,
			1 => Flag::Rejected,
			default => Flag::Unflagged,
		};
	}

	private static function assetId(int $index): string {
		return sprintf('%08x-0000-4000-8000-%012x', $index, $index);
	}

	private static function decision(int $index): AssetDecision {
		return new AssetDecision(self::assetId($index), $index % 6, null, self::flag($index), false, self::FIRST_SECOND + intdiv($index, self::ASSETS_PER_SECOND), $index % 2 === 0 ? 'Pixel 8' : 'EOS R5', AssetKind::Photo, '2026-01-01T00:00:00.000Z');
	}

	/** @return list<XmpCacheRow> */
	private static function cachedRows(int $count): array {
		return array_map(self::cached(...), range(1, $count));
	}

	/**
	 * @param callable(): mixed $run
	 * @return float seconds
	 */
	private static function seconds(callable $run): float {
		$start = hrtime(true);
		$run();
		return (float)(hrtime(true) - $start) / 1e9;
	}

	/** @param callable(): mixed $run */
	private static function median(callable $run): float {
		$times = [];
		for ($attempt = 0; $attempt < self::RUNS; $attempt++) {
			$times[] = self::seconds($run);
		}
		sort($times);
		return $times[intdiv(self::RUNS, 2)];
	}

	/**
	 * Runs `$measure` without and with the index, and drops it.
	 * @template T
	 * @param list<string> $columns
	 * @param callable(): T $measure
	 * @return array{T, T}
	 */
	private function withIndex(string $table, array $columns, callable $measure): array {
		$name = 'bench_' . implode('_', $columns);
		$on = $this->db->getQueryBuilder()->getTableName($table);
		$this->analyse($on);
		$without = $measure();
		$this->db->executeStatement(sprintf('CREATE INDEX %s ON %s (%s)', $name, $on, implode(', ', $columns)));
		try {
			$this->analyse($on);
			$with = $measure();
		} finally {
			$this->db->executeStatement($this->db->getDatabaseProvider() === 'mysql' ? sprintf('DROP INDEX %s ON %s', $name, $on) : "DROP INDEX $name");
		}
		return [$without, $with];
	}

	/** Refreshes the planner's statistics, as the autovacuum of a running instance has. */
	private function analyse(string $table): void {
		$statement = match ($this->db->getDatabaseProvider()) {
			'sqlite' => 'ANALYZE',
			'mysql' => "ANALYZE TABLE $table",
			default => "ANALYZE $table",
		};
		$this->db->executeQuery($statement)->closeCursor();
	}

	private static function report(string $line): void {
		fwrite(STDERR, "\n" . $line . "\n");
	}

	public function testMeasuresTheXmpCacheAtSixtyThousandRows(): void {
		$cache = new XmpCacheMapper($this->db);
		$rows = self::cachedRows(self::CACHED_ROWS);
		$one = self::seconds(static fn () => $cache->replace('one', $rows));
		$chunked = self::seconds(static function () use ($cache, $rows): void {
			foreach (array_chunk($rows, self::SMALL_TRANSACTION) as $chunk) {
				$cache->replace('chunked', $chunk);
			}
		});
		$sharedRows = self::cachedRows(self::SHARED_FILES);
		$perUser = self::seconds(function () use ($cache, $sharedRows): void {
			for ($user = 1; $user <= self::SHARING_USERS; $user++) {
				$cache->replace("team-$user", $sharedRows);
			}
		});
		$sharedOnce = self::seconds(static fn () => $cache->replace('team-shared', $sharedRows));
		$resave = self::seconds(static fn () => $cache->replace('one', $rows));
		self::report(sprintf('%s xmp_cache save of %d rows: one transaction %.2f s, %d transactions of %d %.2f s, again over existing rows %.2f s; %d users x %d shared files %.2f s against one copy %.2f s', $this->db->getDatabaseProvider(), self::CACHED_ROWS, $one, intdiv(self::CACHED_ROWS, self::SMALL_TRANSACTION), self::SMALL_TRANSACTION, $chunked, $resave, self::SHARING_USERS, self::SHARED_FILES, $perUser, $sharedOnce));

		$counts = static fn (string $user): callable => static fn (): array => $cache->readCounts($user);
		$ids = range(1, self::LOOKUP);
		$find = self::median(static fn () => $cache->find('one', $ids));
		$findSmall = self::median(static fn () => $cache->find('team-1', $ids));
		self::report(sprintf('%s xmp_cache find of %d rows: %.1f ms among 60000 of one user, %.1f ms among 12000 of five users sharing files', $this->db->getDatabaseProvider(), self::LOOKUP, $find * 1e3, $findSmall * 1e3));
		foreach ([[['user_id', 'state']], [['user_id', 'state', 'flag', 'rating']]] as [$columns]) {
			[$without, $with] = $this->withIndex('honeycomb_xmp_cache', $columns, static fn (): float => self::median($counts('one')));
			self::report(sprintf('%s readCounts of 60000 rows, median of %d: %.1f ms, with index (%s) %.1f ms', $this->db->getDatabaseProvider(), self::RUNS, $without * 1e3, implode(', ', $columns), $with * 1e3));
		}
		$small = self::median($counts('team-1'));
		self::report(sprintf('%s readCounts of 12000 rows: %.1f ms', $this->db->getDatabaseProvider(), $small * 1e3));
		$this->assertSame(self::CACHED_ROWS - intdiv(self::CACHED_ROWS, self::SPARSE), $cache->readCounts('one')['pictures']);
	}

	public function testMeasuresTheImmichListingAtFiftyThousandDecisions(): void {
		$mapper = new ImmichDecisionMapper($this->db);
		$decisions = array_map(self::decision(...), range(1, self::IMMICH_DECISIONS));
		$one = self::seconds(static fn () => $mapper->save('alice', 'c1', $decisions, 1));
		$chunked = self::seconds(static function () use ($mapper, $decisions): void {
			foreach (array_chunk($decisions, self::SMALL_TRANSACTION) as $chunk) {
				$mapper->save('bob', 'c2', $chunk, 1);
			}
		});
		$mapper->save('carol', 'c3', array_map(self::decision(...), range(1, self::IMMICH_NOISE)), 1);
		$resave = self::seconds(static fn () => $mapper->save('alice', 'c1', $decisions, 2));
		$provider = $this->db->getDatabaseProvider();
		self::report(sprintf('%s immich save of %d decisions: one transaction %.2f s, %d transactions of %d %.2f s, again over existing rows %.2f s', $provider, self::IMMICH_DECISIONS, $one, intdiv(self::IMMICH_DECISIONS, self::SMALL_TRANSACTION), self::SMALL_TRANSACTION, $chunked, $resave));

		$none = new ListingFilters([]);
		$picked = new ListingFilters(['flags' => ['picked'], 'devices' => ['Pixel 8']]);
		$since = new ListingFilters(['takenAfter' => self::FIRST_SECOND + intdiv(self::IMMICH_DECISIONS, self::ASSETS_PER_SECOND) - 600]);
		$middle = $mapper->page('alice', 'c1', $none, null, self::IMMICH_DECISIONS / 2)[self::IMMICH_DECISIONS / 2 - 1];
		$cursor = ['takenAt' => $middle->takenAt, 'assetId' => $middle->assetId];
		$measures = [
			'first page' => static fn (): float => self::median(static fn () => $mapper->page('alice', 'c1', $none, null, self::PAGE)),
			'page after the middle' => static fn (): float => self::median(static fn () => $mapper->page('alice', 'c1', $none, $cursor, self::PAGE)),
			'flag and device filter' => static fn (): float => self::median(static fn () => $mapper->page('alice', 'c1', $picked, null, self::PAGE)),
			'last ten minutes' => static fn (): float => self::median(static fn () => $mapper->page('alice', 'c1', $since, null, self::PAGE)),
			'groups' => static fn (): float => self::median(static fn () => $mapper->groups('alice', 'c1', $none)),
		];
		$columns = ['connection_id', 'taken_at', 'asset_id'];
		[$before, $after] = $this->withIndex('honeycomb_immich_assets', $columns, static fn (): array => array_map(static fn (callable $measure): float => $measure(), $measures));
		foreach (['unchanged' => $before, 'with index (' . implode(', ', $columns) . ')' => $after] as $label => $times) {
			self::report(sprintf('%s immich %s, median of %d: %s', $provider, $label, self::RUNS, implode('; ', array_map(static fn (string $name, float $time): string => sprintf('%s %.1f ms', $name, $time * 1e3), array_keys($times), $times))));
		}
		$this->assertCount(self::PAGE, $mapper->page('alice', 'c1', $none, null, self::PAGE));
	}
}
