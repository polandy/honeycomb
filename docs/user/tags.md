# Tags

A **tag** is a path of names, such as `Places/Italy/Dolomites`, that you give to a photo. honeycomb
works with tags the way digiKam does: they have levels, they are stored in the photo's XMP sidecar
files, and digiKam, darktable and Lightroom Classic read them there. The technical details are in
[`../07-tags.md`](../07-tags.md).

## Add and remove tags

Press `T` to open the **tag entry** for the photo you see in the loupe or the series viewer. In the
grid it opens for the selected photos, or for the focused photo if nothing is selected. On a touch
screen, tap **Tags** in the action bar. The field has the focus as soon as the entry opens.

- **Type** to find a tag. The entry offers every tag that contains your text, ignoring case.
- **`Tab` and `↓`** put the next match into the field, **`Shift+Tab` and `↑`** the one before. A tap
  on a match adds it at once.
- **`Enter`** adds exactly what the field says. If no such tag exists yet, it is created: the list
  offers *Create tag "…"* after the matches.
- **`/`** starts a new level. `Places/Italy/Bolzano` adds only `Bolzano`, and the levels `Places`
  and `Italy` are known from then on.
- **The chips** above the field are the tags of the photos you are tagging. **×** removes a tag from
  all of them; so does **`Backspace`** in the empty field, for the last chip. A chip with a dashed
  border and a count such as `2/7` means only some of the photos have that tag.
- **`Esc`** or **Done** closes the entry. In the loupe, the next `Esc` closes the loupe.

The entry stays open after each change, so you can add several tags in a row. A name must not be
empty or contain `|`; the entry says so and adds nothing. A tag every photo already has is not
offered again.

Every change is one step of **Undo** (`Ctrl+Z`) and shows one message, such as "Tagged 7 photos
Dolomites" or "Removed Anna from 2 photos", with an **Undo** button.

## Tag many photos at once

In the grid, choose **Select** to start selecting; **Done** leaves it. Tap or click a photo to add
it to the selection. On a touch screen, a long press on a photo starts selecting too. With a mouse,
`Ctrl`-click adds one photo and `Shift`-click a range; `Ctrl+A` selects all the photos you see.
Then press `T` or tap **Tags**: what you add goes to every selected photo, and what you remove
comes off every one.

## Find photos by tag

Open the filter bar and use its **Tags** group. **Add tag** opens the same entry; type a tag and
press `Tab` and `Enter`, or tap a match. In this entry `Enter` takes a tag only if it exists, and
it never creates one.

- **A photo needs every chosen tag.** Each tag you add narrows the grid. Other filter groups work
  the other way inside a group (any of them), so this is the one exception.
- **A parent tag includes what is below it.** `Places/Italy` also shows photos tagged
  `Places/Italy/Dolomites`, but not `Places/Italyx`.
- A photo's tags are those of both its files together, so a pair passes when its JPEG and its RAW
  between them have the tags.
- Each chosen tag counts once on the filter button. **×** on a chip removes the tag from the
  filter, and **Clear filters** removes all of them.

## What you see on a tile and in the loupe

A tagged photo's tile shows a small tag icon with the number of its tags. The loupe's info panel
(`I`) has a **Tags** section: the photo's tags, one per line with their full path, and the files
they are written to.

## Where tags are stored

When you change a tag, honeycomb writes it into the sidecar files of the photo, so it is the same
tag in digiKam:

- `digiKam:TagsList`, which digiKam reads first;
- `lr:hierarchicalSubject`, which Lightroom Classic and darktable read;
- `dc:subject`, which holds the last name of each tag, for programs that know no levels.

A photo without a sidecar gets one when you tag it, like `IMG_0001.NEF.xmp`. Keywords that other
programs have written into `dc:subject` stay as they are.

- **Tags you already have.** When honeycomb opens a folder it takes over the tags that digiKam,
  darktable or Lightroom wrote into the sidecars. If the sidecars of one photo disagree, it uses
  all of their tags together, and the next change writes the same set to each. A JPEG's own
  embedded XMP is read, never written.
- **The tag list.** The tags offered are those found in your sidecars plus those you created, kept
  per user.
- **Shared folders.** In a shared folder honeycomb writes no sidecars on its own; the info panel
  says *Not written, shared folder*. **⋯ → Write decisions to sidecars…** writes them
  ([ratings, flags and colours](ratings-flags-colours.md#shared-folders)).
- **Not yet.** Renaming, moving or deleting a tag across all photos is not in honeycomb; do it in
  digiKam.
