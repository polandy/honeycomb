<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

\OCP\Util::addScript('honeycomb', 'honeycomb-main');

/** @var array{versionsApp: bool} $_ */
?>
<div id="honeycomb" data-versions-app="<?php p($_['versionsApp'] ? 'true' : 'false'); ?>"></div>
