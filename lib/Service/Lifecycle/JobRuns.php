<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Service\Lifecycle;

use OCA\Honeycomb\AppInfo\Application;
use OCP\AppFramework\Utility\ITimeFactory;
use OCP\IAppConfig;

/** Keeps when each background job last ran and the class of its last error, never an error text (APP-003). */
final class JobRuns {
	private const string FAILED_LAST = 'failed';

	public function __construct(
		private IAppConfig $config,
		private ITimeFactory $time,
	) {
	}

	/** Records a run that went through; the last error stays. */
	public function succeeded(BackgroundJobName $job): void {
		$this->config->setValueInt(Application::APP_ID, $this->key($job, 'last_run'), $this->time->getTime(), lazy: true);
		$this->config->setValueString(Application::APP_ID, $this->key($job, 'last_outcome'), 'ok', lazy: true);
	}

	/** Records a failed run with the class of its error. */
	public function failed(BackgroundJobName $job, \Throwable $error): void {
		$now = $this->time->getTime();
		$this->config->setValueInt(Application::APP_ID, $this->key($job, 'last_run'), $now, lazy: true);
		$this->config->setValueString(Application::APP_ID, $this->key($job, 'last_outcome'), self::FAILED_LAST, lazy: true);
		$this->config->setValueString(Application::APP_ID, $this->key($job, 'last_error'), $error::class, lazy: true);
		$this->config->setValueInt(Application::APP_ID, $this->key($job, 'last_error_at'), $now, lazy: true);
	}

	/** What the stored runs of the job say. */
	public function status(BackgroundJobName $job): JobStatus {
		$lastRun = $this->config->getValueInt(Application::APP_ID, $this->key($job, 'last_run'), 0, lazy: true);
		$lastError = $this->config->getValueString(Application::APP_ID, $this->key($job, 'last_error'), '', lazy: true);
		$lastErrorAt = $this->config->getValueInt(Application::APP_ID, $this->key($job, 'last_error_at'), 0, lazy: true);
		$outcome = $this->config->getValueString(Application::APP_ID, $this->key($job, 'last_outcome'), '', lazy: true);
		return new JobStatus(
			$lastRun === 0 ? null : $lastRun,
			$outcome === self::FAILED_LAST,
			$lastError === '' ? null : $lastError,
			$lastErrorAt === 0 ? null : $lastErrorAt,
		);
	}

	private function key(BackgroundJobName $job, string $field): string {
		return 'job_' . $job->value . '_' . $field;
	}
}
