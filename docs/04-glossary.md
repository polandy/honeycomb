# 4. Glossary

Binding terms. Code, UI strings and docs use these words and no synonyms.

| Term | Meaning |
|---|---|
| **picture** | What the user sees and decides on: one pair or one single. In code: `Picture`. |
| **pair** | A RAW file and a rendered file with the same base name that belong together. |
| **single** | A picture with only one image file: *JPEG only* or *RAW only*. |
| **member** | One image file of a picture (the RAW member or the rendered member). |
| **rendered file** | A camera-rendered image file (JPEG; HEIF/TIFF if Q15 says so). Shown in the app. |
| **RAW file** | A camera RAW file, recognised by its extension (configurable list). |
| **sidecar** | An `.xmp` file that holds metadata for a member; deleted together with its picture. |
| **base name** | The file name up to the last `.`, compared case-insensitively. |
| **folder mode** | *Same folder* (pairs side by side) or *separate subfolders* (e.g. `RAW/`, `JPG/`). |
| **rating** | 0 to 5 stars. 0 means unrated. |
| **colour label** | One of a fixed set of colours, or none (Q5). |
| **flag** | *Picked*, *rejected* or *unflagged*; digiKam calls it a pick label (Q4). |
| **cull** | Going through a folder and rating, labelling, flagging and deleting pictures. |
| **undecided** | A picture whose flag is unflagged; picked and rejected pictures are *decided*. |
| **reject review** | The grid of all rejected pictures, where single ones can be rescued before the delete summary. |
| **series** | Pictures taken within a short interval, compared side by side to keep the best. |
| **grid** | The thumbnail view of a folder. |
| **loupe** | The full-screen view of one picture, with swipe, zoom and the decision buttons. |
| **filter** | A condition on rating, colour label, flag or pairing that narrows the grid and loupe. |
| **selection** | The set of pictures marked in selection mode for a bulk action. |
| **bulk action** | Rate, label, flag or delete applied to the whole selection at once. |
| **delete summary** | The dialog that lists pictures, files, bytes freed and the trash-bin note before deleting. |
| **trash bin** | Nextcloud's trash bin (`files_trashbin`), where deleted files can be restored from. |
