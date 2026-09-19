# CalendarSNX

`kalenderSNX.jsx` is an ExtendScript for Adobe InDesign. It creates high-end monthly photo calendars with reusable layouts, public holidays, calendar weeks and presets.

Current version: **10.1**

## Features

- 12 monthly pages with optional cover and back page thumbnails
- 13 image slots: one cover image plus one image for each month
- `Classic`, `Split`, `Full-screen overlay` and `Gallery` layouts
- six coordinated colour themes
- public holidays for all 16 German federal states
- Monday or Sunday week start
- optional ISO calendar-week column
- effective image-resolution warning below 200 ppi
- image pool and later image replacement through the image frames
- `.calpro` presets for saving and loading recurring jobs
- central CALPRO cell, paragraph, character and object styles so the finished document remains editable in InDesign

## Installation

1. Download [`kalenderSNX.jsx`](kalenderSNX.jsx).
2. Copy it to InDesign's **Scripts Panel** folder.
3. In InDesign, open `Window > Utilities > Scripts`.
4. Double-click `kalenderSNX.jsx`.
5. Choose the year, page size, layout, theme and images, then click **Kalender erstellen**.

The script was tested with Adobe InDesign Version 21.0. It has no external package dependencies and does not make network requests.

## Images

A complete calendar can use up to 13 images. The cover is a separate slot; if no cover image is selected, the January image is used for the cover page.

The screenshots show the dialog, layout preview, individual month pages and the year overview:

![Script dialog](screenshots/01-script-dialog.png)

![August calendar](screenshots/02-august-calendar.png)

![February calendar](screenshots/03-february-calendar.png)

![January holiday](screenshots/04-january-holiday.png)

![Layout detail](screenshots/05-layout-detail.png)

![Layout preview](screenshots/06-layout-preview.png)

![Year overview](screenshots/07-year-overview.png)

## Version history

- **10.1** — current version from the InDesign Scripts Panel.
- **10.0** — historical backup in [`archive/kalenderSNX_v10.0_20260919-1248.jsx`](archive/kalenderSNX_v10.0_20260919-1248.jsx).

## Editing the document in InDesign

After creation, the styles are grouped under `CALPRO`. Paragraph, character, cell and object styles can be edited there; the changes remain editable in the generated document.

## License

No separate open-source license has been declared for this repository yet. The repository is currently published for documentation and version control.
