<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Command;

use OCA\Honeycomb\Service\CacheClear;
use OCP\IUserManager;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

/**
 * `occ honeycomb:cache:clear [user]`: clears the XMP cache and the visual hashes of one user or of every user (ADR 0032).
 * @psalm-suppress UnusedClass Nextcloud registers it from `info.xml`.
 */
final class ClearCache extends Command {
	private const string NAME = 'honeycomb:cache:clear';
	private const string USER = 'user';

	public function __construct(
		private CacheClear $cacheClear,
		private IUserManager $users,
	) {
		parent::__construct(self::NAME);
	}

	#[\Override]
	protected function configure(): void {
		$this->setDescription('Clears what honeycomb remembers of the sidecars and photos it read; sidecars and flags stay.')
			->addArgument(self::USER, InputArgument::OPTIONAL, 'The user whose cache to clear; every user without one');
	}

	#[\Override]
	protected function execute(InputInterface $input, OutputInterface $output): int {
		/** @var ?string $userId */
		$userId = $input->getArgument(self::USER);
		if ($userId !== null && !$this->users->userExists($userId)) {
			$output->writeln("<error>Unknown user: $userId</error>");
			return self::FAILURE;
		}
		$removed = $this->cacheClear->clear($userId);
		$output->writeln("Removed $removed cache rows of " . ($userId ?? 'every user') . '.');
		return self::SUCCESS;
	}
}
