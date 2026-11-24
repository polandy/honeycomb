<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Command;

use OCA\Honeycomb\Domain\Store\AppData;
use OCA\Honeycomb\Domain\Store\AppRemoval;
use OCA\Honeycomb\Service\OrphanedFlags;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;

/**
 * `occ honeycomb:cleanup`: removes the flags of files deleted for good or lying in a trash bin (ADR 0040);
 * with `--all` it empties every honeycomb table, `--dry-run` only counting (DECISIONS-001.35);
 * `--all --drop` removes the tables and the app's rows of the shared tables (DECISIONS-001.38, ADR 0053).
 * @psalm-suppress UnusedClass Nextcloud registers it from `info.xml`.
 */
final class Cleanup extends Command {
	private const string NAME = 'honeycomb:cleanup';
	private const string ALL = 'all';
	private const string DRY_RUN = 'dry-run';
	private const string DROP = 'drop';

	public function __construct(
		private OrphanedFlags $orphans,
		private AppData $data,
		private AppRemoval $removal,
	) {
		parent::__construct(self::NAME);
	}

	#[\Override]
	protected function configure(): void {
		$this->setDescription('Removes the flags of files deleted for good or lying in a trash bin; a restored file comes back unflagged. With --all it deletes every honeycomb row of every user.')
			->addOption(self::ALL, null, InputOption::VALUE_NONE, 'Empty all honeycomb tables and the users\' honeycomb preferences')
			->addOption(self::DROP, null, InputOption::VALUE_NONE, 'With --all: drop the honeycomb tables and delete its migrations, background jobs and app config, so the app can be removed or installed fresh')
			->addOption(self::DRY_RUN, null, InputOption::VALUE_NONE, 'With --all: only print how many rows each table holds, or with --drop which tables would go');
	}

	#[\Override]
	protected function execute(InputInterface $input, OutputInterface $output): int {
		if ($input->getOption(self::DRY_RUN) && !$input->getOption(self::ALL)) {
			$output->writeln('<error>--dry-run needs --all.</error>');
			return self::FAILURE;
		}
		if ($input->getOption(self::DROP) && !$input->getOption(self::ALL)) {
			$output->writeln('<error>--drop needs --all.</error>');
			return self::FAILURE;
		}
		if ($input->getOption(self::DROP)) {
			return $this->drop($output, (bool)$input->getOption(self::DRY_RUN));
		}
		if ($input->getOption(self::ALL)) {
			return $this->all($output, (bool)$input->getOption(self::DRY_RUN));
		}
		$removed = $this->orphans->remove();
		$output->writeln("Removed $removed orphaned flag " . ($removed === 1 ? 'row' : 'rows') . '.');
		return self::SUCCESS;
	}

	private function all(OutputInterface $output, bool $dryRun): int {
		try {
			$rows = $dryRun ? $this->data->count() : $this->data->empty();
		} catch (\Throwable $e) {
			$output->writeln('<error>' . ($dryRun ? 'Could not count' : 'Could not empty') . ' the honeycomb tables: ' . $e->getMessage() . '</error>');
			return self::FAILURE;
		}
		foreach ($rows as $table => $count) {
			$output->writeln("$table: $count");
		}
		$total = array_sum($rows);
		$output->writeln($dryRun ? "Dry run: $total rows would be removed, nothing was deleted." : "Removed $total rows.");
		return self::SUCCESS;
	}

	private function drop(OutputInterface $output, bool $dryRun): int {
		try {
			$tables = $dryRun ? $this->removal->tables() : $this->removal->remove();
		} catch (\Throwable $e) {
			$output->writeln('<error>Could not ' . ($dryRun ? 'list' : 'drop') . ' the honeycomb tables: ' . $e->getMessage() . '</error>');
			return self::FAILURE;
		}
		foreach ($tables as $table) {
			$output->writeln(($dryRun ? 'Would drop ' : 'Dropped ') . $table);
		}
		$count = count($tables);
		$output->writeln($dryRun
			? "Dry run: $count tables would be dropped, nothing was removed."
			: "Dropped $count tables and deleted honeycomb's migrations, preferences, background jobs and app config. Next, install it fresh with occ app:enable honeycomb, or delete its folder with occ app:remove honeycomb.");
		return self::SUCCESS;
	}
}
