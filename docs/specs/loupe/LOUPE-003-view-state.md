# LOUPE-003 – View state

- Status: implemented
- Area: loupe
- Origin: owner review 2026-11-10, ADR 0019
- Depends on: LOUPE-001

## Purpose

Keeps whether the loupe's info panel is open and whether the gesture guide and the first-series
hint were dismissed per user on the server, so both follow the user to every device and browser.

## Behaviour

The view state is three booleans per user behind `GET` and
`PUT /apps/honeycomb/api/v1/view-state`: `infoPanelOpen`, `gestureGuideSeen` and
`seriesHintSeen`, each `null` while it was never stored. A write names only
the keys it changes. The info panel's width and the Nextcloud navigation toggle stay in browser
storage (LOUPE-001), since they depend on the device's screen.

The app reads the view state once when it starts. Until the answer arrives neither the gesture
guide nor the first-series hint shows; without a stored value the info panel is closed and both
are not seen. A value
an older version left in browser storage is taken over once.

## Acceptance criteria

### LOUPE-003.1 – Read

- **Given** a user with some, all or none of the keys stored
- **When** the client reads the view state
- **Then** the answer is `{"viewState": {"infoPanelOpen": …, "gestureGuideSeen": …,
  "seriesHintSeen": …}}` with each stored boolean, `null` for a key never stored

### LOUPE-003.2 – Write only the keys given

- **Given** a view state object with one or more of the keys, each a boolean
- **When** the client writes it
- **Then** only those keys are stored, the others keep their values, and the answer is the full view
  state as a read returns it

### LOUPE-003.3 – Refused writes

- **Given** a view state that is not an object, is empty, has an unknown key or a value that is
  not a boolean
- **When** the client writes it
- **Then** the answer is `400` with an empty body and nothing is stored

### LOUPE-003.4 – Logged-in users only, with the CSRF check

- **Given** the routes
- **When** they are called without a user
- **Then** the answer is `401` and nothing is read or written; both routes are open to every user
  and keep Nextcloud's CSRF check

### LOUPE-003.5 – Read once, no guide before the answer

- **Given** the app starts
- **When** the view state is still being read, or has been read
- **Then** neither the gesture guide nor the first-series hint shows until the answer arrives;
  then the loupe takes each stored value, anything but a boolean counts as not stored, and without
  one the info panel is closed and the gesture guide and the first-series hint show

### LOUPE-003.6 – A change applies at once and writes one key

- **Given** the loupe
- **When** the user opens or closes the info panel, presses *Got it* in the gesture guide, or
  presses *Show the gesture guide* in the settings (SETTINGS-001.22), or dismisses the
  first-series hint (LOUPE-001.26)
- **Then** the change applies at once and only that key is written

### LOUPE-003.7 – Taking over values from browser storage

- **Given** `honeycomb.infoOpen` or `honeycomb.gestureGuideSeen` is `true` or `false` in browser
  storage
- **When** the view state is read and the server has never stored that key
- **Then** the local value applies, is written once, and the local key is removed after that
  write succeeded; beside a stored value the local key is removed and the stored value applies;
  with nothing to take over nothing is written

### LOUPE-003.8 – Reading or writing fails

- **Given** the view state could not be read, or a write fails
- **When** the loupe opens, or the user changes the info panel or dismisses the guide
- **Then** a failed read takes the values left in browser storage, or the defaults, and neither
  writes nor removes them; a failed write keeps the change for this visit and the local values;
  both are logged without a message to the user

## Out of scope

The info panel, the gesture guide, the first-series hint and the browser-stored width and navigation
toggle themselves: LOUPE-001. The settings: SETTINGS-001.

## History

| Date | Change |
|---|---|
| 2026-11-10 | Written and implemented from the owner review of 2026-11-10 (ADR 0019) |
| 2026-11-14 | `seriesHintSeen` for the first-series hint (series concept step 11) |
