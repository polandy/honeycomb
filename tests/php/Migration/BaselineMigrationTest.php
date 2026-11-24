<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Tests\Migration;

use OCA\Honeycomb\Migration\ExistingTablesException;
use OCA\Honeycomb\Migration\Version000200Date20261123200000;
use OCP\DB\ISchemaWrapper;
use OCP\Migration\IOutput;
use PHPUnit\Framework\TestCase;

final class BaselineMigrationTest extends TestCase {
	// spec: DECISIONS-001.39
	public function testRefusesAnInstanceThatHasHoneycombTablesAndPointsToTheUpdateGuide(): void {
		$schema = $this->createMock(ISchemaWrapper::class);
		$schema->method('getTableNamesWithoutPrefix')->willReturn(['files', 'honeycomb_flags', 'honeycomb_tags']);
		$schema->expects($this->never())->method('createTable');

		try {
			(new Version000200Date20261123200000())->changeSchema($this->createStub(IOutput::class), static fn (): ISchemaWrapper => $schema, []);
			$this->fail('The migration ran over existing tables.');
		} catch (ExistingTablesException $e) {
			$this->assertStringContainsString('honeycomb_flags, honeycomb_tags', $e->getMessage());
			$this->assertStringContainsString('docs/user/admin/updating.md', $e->getMessage());
			$this->assertStringContainsString('occ config:app:set honeycomb reinstall --value=yes', $e->getMessage());
		}
	}
}
