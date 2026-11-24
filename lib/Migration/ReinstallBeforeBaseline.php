<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

namespace OCA\Honeycomb\Migration;

use OCA\Honeycomb\Service\AppRemoval;
use OCP\IAppConfig;
use OCP\Migration\IOutput;
use OCP\Migration\IRepairStep;

/** Before the migrations, drops the tables of an instance from before 0.2.0 when the admin opted in, so the baseline creates them empty (ADR 0053). */
final class ReinstallBeforeBaseline implements IRepairStep {
	private const string APP = 'honeycomb';
	private const string OPT_IN = 'reinstall';
	private const string OPTED_IN = 'yes';
	private const string BASELINE_VERSION = '0.2.0';

	public function __construct(
		private readonly IAppConfig $config,
		private readonly AppRemoval $removal,
	) {
	}

	#[\Override]
	public function getName(): string {
		return 'Install honeycomb again over an instance from before ' . self::BASELINE_VERSION;
	}

	/** @throws \OCP\DB\Exception */
	#[\Override]
	public function run(IOutput $output): void {
		if ($this->config->getValueString(self::APP, self::OPT_IN) !== self::OPTED_IN) {
			return;
		}
		$installed = $this->config->getValueString(self::APP, 'installed_version');
		if (version_compare($installed, self::BASELINE_VERSION, '>=')) {
			$output->warning('honeycomb ' . $installed . ' is not from before ' . self::BASELINE_VERSION . ', so nothing was dropped; the value ' . self::OPT_IN . ' was deleted.');
		} else {
			$dropped = $this->removal->dropTables();
			$output->info('Dropped ' . count($dropped) . ' honeycomb tables, so the update creates them empty: ' . implode(', ', $dropped));
		}
		$this->config->deleteKey(self::APP, self::OPT_IN);
	}
}
