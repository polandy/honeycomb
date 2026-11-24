<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Command;

use OCA\Honeycomb\Service\Lifecycle\BackgroundJobName;
use OCA\Honeycomb\Service\Lifecycle\JobRuns;
use OCA\Honeycomb\Service\Lifecycle\JobStatus;
use OCP\AppFramework\Utility\ITimeFactory;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

/**
 * `occ honeycomb:jobs`: prints the status, last run and last error of each background job (APP-003).
 * @psalm-suppress UnusedClass Nextcloud registers it from `info.xml`.
 */
final class JobsStatus extends Command {
	private const string NAME = 'honeycomb:jobs';
	private const string TIME_FORMAT = 'Y-m-d H:i:s';

	/** Unit lengths in seconds, longest first. */
	private const array UNITS = ['day' => 86_400, 'hour' => 3_600, 'minute' => 60, 'second' => 1];

	public function __construct(
		private JobRuns $runs,
		private ITimeFactory $time,
	) {
		parent::__construct(self::NAME);
	}

	#[\Override]
	protected function configure(): void {
		$this->setDescription('Shows the status, last run and last error of honeycomb\'s background jobs; changes nothing.');
	}

	#[\Override]
	protected function execute(InputInterface $input, OutputInterface $output): int {
		foreach (BackgroundJobName::cases() as $job) {
			$output->writeln($job->value . ': ' . $this->describe($this->runs->status($job)));
		}
		return self::SUCCESS;
	}

	private function describe(JobStatus $status): string {
		$error = $status->lastError === null ? 'none' : $status->lastError . ' at ' . $this->utc((int)$status->lastErrorAt);
		if ($status->lastRun === null) {
			return "never run, last error $error";
		}
		return ($status->failed ? 'failed' : 'ok') . ', last run ' . $this->utc($status->lastRun) . ' (' . $this->age($status->lastRun) . "), last error $error";
	}

	private function utc(int $time): string {
		return gmdate(self::TIME_FORMAT, $time) . ' UTC';
	}

	/** The age in its largest whole unit. */
	private function age(int $time): string {
		$seconds = max(0, $this->time->getTime() - $time);
		foreach (self::UNITS as $unit => $length) {
			$count = intdiv($seconds, $length);
			if ($count >= 1) {
				return $count . ' ' . $unit . ($count === 1 ? '' : 's') . ' ago';
			}
		}
		return '0 seconds ago';
	}
}
