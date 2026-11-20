# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
ARG BASE
FROM ${BASE}
RUN apt-get update \
  && apt-get install --yes --no-install-recommends libimage-exiftool-perl exiv2 \
  && rm -rf /var/lib/apt/lists/*
