<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Search;

use OCA\Honeycomb\Search\BinaryOperator;
use OCA\Honeycomb\Search\Comparison;
use OCA\Honeycomb\Search\FileIdOrder;
use OCP\Files\Search\ISearchBinaryOperator;
use OCP\Files\Search\ISearchComparison;
use OCP\Files\Search\ISearchOperator;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class SearchOperatorTest extends TestCase {
	/** @return array<string, array{ISearchOperator}> */
	public static function operators(): array {
		return [
			'comparison' => [new Comparison(ISearchComparison::COMPARE_LIKE, 'name', '%.xmp')],
			'binary operator' => [new BinaryOperator(ISearchBinaryOperator::OPERATOR_AND, [])],
		];
	}

	#[DataProvider('operators')]
	public function testKeepsTheHintsOfNextcloudsQueryOptimizer(ISearchOperator $operator): void {
		$this->assertTrue($operator->getQueryHint(ISearchComparison::HINT_PATH_EQ_HASH, true));

		$operator->setQueryHint(ISearchComparison::HINT_PATH_EQ_HASH, false);

		$this->assertFalse($operator->getQueryHint(ISearchComparison::HINT_PATH_EQ_HASH, true));
	}

	public function testNeitherTheComparisonNorTheOrderNeedsAnExtra(): void {
		$this->assertSame('', (new Comparison(ISearchComparison::COMPARE_LIKE, 'name', '%.xmp'))->getExtra());
		$this->assertSame('', (new FileIdOrder())->getExtra());
	}

	public function testWritesTheComparisonAsNextcloudsOptimizerKeysIt(): void {
		$this->assertSame('name like "%.xmp"', (string)new Comparison(ISearchComparison::COMPARE_LIKE, 'name', '%.xmp'));
		$this->assertSame('parent eq 42', (string)new Comparison(ISearchComparison::COMPARE_EQUAL, 'parent', 42));
	}

	public function testWritesTheBinaryOperatorAsNextcloudsOptimizerKeysIt(): void {
		$name = new Comparison(ISearchComparison::COMPARE_LIKE, 'name', '%.xmp');
		$parent = new Comparison(ISearchComparison::COMPARE_EQUAL, 'parent', 42);

		$this->assertSame(
			'(name like "%.xmp" and (not parent eq 42))',
			(string)new BinaryOperator(ISearchBinaryOperator::OPERATOR_AND, [
				$name,
				new BinaryOperator(ISearchBinaryOperator::OPERATOR_NOT, [$parent]),
			]),
		);
		$this->assertSame('()', (string)new BinaryOperator(ISearchBinaryOperator::OPERATOR_OR, []));
	}
}
