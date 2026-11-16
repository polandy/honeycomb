<?php

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

/** @var array{versionsApp: bool, script: string} $_ */
\OCP\Util::addScript('honeycomb', $_['script']);
?>
<div id="honeycomb" data-versions-app="<?php echo $_['versionsApp'] ? 'true' : 'false'; ?>"></div>
