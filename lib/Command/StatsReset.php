<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Command;

use OCA\Honeycomb\Service\Stats\StatsReset as Reset;
use OCP\IUserManager;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

/**
 * `occ honeycomb:stats:reset <user>|--all [--dry-run] [--force]`: deletes the statistics of one user or of every user after a question (STATS-001.3).
 * @psalm-suppress UnusedClass Nextcloud registers it from `info.xml`.
 */
final class StatsReset extends Command {
	private const string NAME = 'honeycomb:stats:reset';
	private const string USER = 'user';
	private const string ALL = 'all';
	private const string DRY_RUN = 'dry-run';
	private const string FORCE = 'force';

	public function __construct(
		private Reset $reset,
		private IUserManager $users,
	) {
		parent::__construct(self::NAME);
	}

	#[\Override]
	protected function configure(): void {
		$this->setDescription('Deletes the statistics of one user or of every user; photos, sidecars and decisions stay.')
			->addArgument(self::USER, InputArgument::OPTIONAL, 'The user whose statistics to delete')
			->addOption(self::ALL, null, InputOption::VALUE_NONE, 'Delete the statistics of every user')
			->addOption(self::DRY_RUN, null, InputOption::VALUE_NONE, 'Only print how many rows each user holds')
			->addOption(self::FORCE, 'f', InputOption::VALUE_NONE, 'Delete without asking');
	}

	#[\Override]
	protected function execute(InputInterface $input, OutputInterface $output): int {
		/** @var ?string $userId */
		$userId = $input->getArgument(self::USER);
		$all = (bool)$input->getOption(self::ALL);
		$problem = $this->problem($userId, $all);
		if ($problem !== null) {
			$output->writeln("<error>$problem</error>");
			return self::FAILURE;
		}
		$rows = $this->reset->rows($userId);
		if ($rows === []) {
			$output->writeln('Nothing to delete: ' . ($userId === null ? 'no user has' : "$userId has no") . ' statistics.');
			return self::SUCCESS;
		}
		$this->list($output, $rows);
		if ($input->getOption(self::DRY_RUN)) {
			$output->writeln('Dry run: ' . $this->total($rows) . ' would be deleted, nothing was deleted.');
			return self::SUCCESS;
		}
		if (!$input->getOption(self::FORCE)) {
			if (!$input->isInteractive()) {
				$output->writeln('<error>Cannot ask without a terminal; add --force to delete.</error>');
				return self::FAILURE;
			}
			$question = 'Delete ' . $this->rowsOf(array_sum($rows), ' statistics') . ' of ' . ($userId ?? 'every user') . '?';
			if (!(new SymfonyStyle($input, $output))->confirm($question, false)) {
				$output->writeln('Aborted, nothing was deleted.');
				return self::SUCCESS;
			}
		}
		$output->writeln('Deleted ' . $this->total($this->reset->reset($userId)) . '.');
		return self::SUCCESS;
	}

	private function problem(?string $userId, bool $all): ?string {
		if ($userId !== null && $all) {
			return 'Name one user or pass --all, not both.';
		}
		if ($userId === null && !$all) {
			return 'Name one user or pass --all.';
		}
		return $userId !== null && !$this->users->userExists($userId) ? "Unknown user: $userId" : null;
	}

	/** @param array<string, int> $rows */
	private function list(OutputInterface $output, array $rows): void {
		foreach ($rows as $user => $count) {
			$output->writeln("$user: " . $this->rowsOf($count));
		}
	}

	/** @param array<string, int> $rows */
	private function total(array $rows): string {
		$users = count($rows);
		return $this->rowsOf(array_sum($rows), ' statistics') . " of $users " . ($users === 1 ? 'user' : 'users');
	}

	private function rowsOf(int $count, string $what = ''): string {
		return "$count$what " . ($count === 1 ? 'row' : 'rows');
	}
}
