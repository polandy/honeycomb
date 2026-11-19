<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Command;

use OCA\Honeycomb\Service\OrphanedFlags;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

/**
 * `occ honeycomb:cleanup`: removes the flags of files deleted for good or lying in a trash bin (ADR 0040).
 * @psalm-suppress UnusedClass Nextcloud registers it from `info.xml`.
 */
final class Cleanup extends Command {
	private const string NAME = 'honeycomb:cleanup';

	public function __construct(
		private OrphanedFlags $orphans,
	) {
		parent::__construct(self::NAME);
	}

	#[\Override]
	protected function configure(): void {
		$this->setDescription('Removes the flags of files deleted for good or lying in a trash bin; a restored file comes back unflagged.');
	}

	#[\Override]
	protected function execute(InputInterface $input, OutputInterface $output): int {
		$removed = $this->orphans->remove();
		$output->writeln("Removed $removed orphaned flag " . ($removed === 1 ? 'row' : 'rows') . '.');
		return self::SUCCESS;
	}
}
