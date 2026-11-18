# 0036 – Delete for good after an explicit warning

- Status: accepted
- Date: 2026-11-18
- Amends: [0030](0030-trash-only-where-the-trash-bin-keeps-the-file.md), CLAUDE.md rule 2

## Context

ADR 0030 refuses to delete a file the trash bin would not keep: a file on a storage the trash bin
does not wrap, or a file at least as large as the trash bin size. The user is left with the file
and has to delete it in Files. The owner decided (issue #187, point 4) that such files are
deleted for good after an explicit warning dialog that names them. CLAUDE.md rule 2 said
deleting always moves to the trash bin.

The options for how the server learns that the user confirmed:

- **A request flag for the whole request:** one click would turn every refusal of the request
  into a delete for good, including files the user never saw in the warning.
- **A second endpoint:** a second path through the same checks, the pairing of the request and
  the chunking of ADR 0029.
- **A flag per file on the trash request:** the client sets it only on the files the warning
  named, which the server answered `noTrashBin` or `tooLarge` before.

## Decision

- A file of the trash request may carry `"permanent": true`. The server still checks it like any
  file (listed type, ETag, permission). If the trash bin would keep it, it is trashed as usual;
  otherwise it is deleted for good and reports `deleted`. A file without the flag is refused as
  before.
- `noTrashBin` splits into `noTrashBin` (the storage has no trash bin) and `tooLarge` (larger
  than the trash bin allows), so the warning can say why.
- The client sets the flag only after the warning dialog: it lists every such file with its
  reason, its confirm button is a separate destructive one and the focus starts on *Cancel*.
  Cancelling leaves the files, as ADR 0030 did. The flag is sent only for files the server named
  in the answer before, together with their pictures, so their ETags are checked again.
- The trash bin being off for the user still refuses the whole request (ADR 0013); this ADR
  covers only the files the trash bin would not keep.
- CLAUDE.md rule 2 names the exception.

## Consequences

- A file deleted for good cannot be restored from Nextcloud. Only a file the user saw in the
  warning and confirmed is deleted so; a new refusal in the second request asks no second time.
- The pair rule holds: the flag lets a file past the trash bin check, and the picture's other
  checks still keep all of its files.
- Moving to a new endpoint later means moving one check; the wire form is the only public part.
