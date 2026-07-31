# Wallgen Termux:GUI controller

This is a native Android interface for the wallgen project, implemented with
the Python `termuxgui` bindings.

It provides:

- the complete generator style list with cached rendered thumbnails;
- checkbox-based style selection and automatically persisted dimensions for
  `update_wallpaper.sh`;
- background wallpaper generation without freezing the event loop;
- tap-to-generate style images that open a dedicated, scaled preview screen;
- an optional button to apply the preview to both home and lock screens;

## Requirements

1. Install and authorize the Termux:GUI Android plugin.
2. Install the Python bindings with `pip install termuxgui`.
3. Install Termux:API if the “Set preview as wallpaper” action is wanted.

The generator's existing Node dependencies must also be installed with
`npm install`.

## Run

From the project directory:

```sh
./start-wallpaper-gui.sh
```

Or:

```sh
npm run gui
```

The first launch renders only thumbnails that are missing. The complete cache
can be regenerated from the project directory with `npm run thumbnails`.
