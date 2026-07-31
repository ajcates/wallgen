#!/data/data/com.termux/files/usr/bin/python
"""Native Termux:GUI controller for the wallgen wallpaper generator."""

from __future__ import annotations

import json
import os
import queue
import re
import shlex
import subprocess
import sys
import tempfile
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

try:
    import termuxgui as tg
except ModuleNotFoundError:
    raise SystemExit(
        "The termuxgui Python binding is missing. Install it with: pip install termuxgui"
    )


PROJECT_DIR = Path(__file__).resolve().parents[1]
CONFIG_PATH = PROJECT_DIR / "config.env"
CATALOG_PATH = PROJECT_DIR / "style_catalog.json"
THUMBNAIL_DIR = PROJECT_DIR / "termux_gui" / "thumbnails"
PREVIEW_DIR = PROJECT_DIR / "my_wallpapers" / "gui_previews"
NODE_BIN = Path("/data/data/com.termux/files/usr/bin/node")
WALLPAPER_BIN = Path("/data/data/com.termux/files/usr/bin/termux-wallpaper")
MIN_DIMENSION = 128
MAX_DIMENSION = 8192
SETTINGS_HEIGHT_RATIO = 0.20


def android_color(hex_value: str) -> int:
    """Convert AARRGGBB/RRGGBB into Android's signed 32-bit color integer."""
    value = int(hex_value.lstrip("#"), 16)
    if len(hex_value.lstrip("#")) == 6:
        value |= 0xFF000000
    return value - 0x100000000 if value >= 0x80000000 else value


COLOR_BACKGROUND = android_color("#090A10")
COLOR_SURFACE = android_color("#171924")
COLOR_SURFACE_ALT = android_color("#202333")
COLOR_PRIMARY = android_color("#8B7CFF")
COLOR_ACCENT = android_color("#42E8C4")
COLOR_TEXT = android_color("#F5F3FF")
COLOR_MUTED = android_color("#AAA9B8")
COLOR_DANGER = android_color("#FF6B8A")


@dataclass(frozen=True)
class WallpaperConfig:
    style: str = "curves"
    width: int = 1080
    height: int = 2400
    output_dir: str = str(PROJECT_DIR / "my_wallpapers")


def load_catalog(path: Path = CATALOG_PATH) -> list[dict[str, str]]:
    catalog = json.loads(path.read_text(encoding="utf-8"))
    required = {"id", "name", "description", "module", "class"}
    if not isinstance(catalog, list) or not catalog:
        raise ValueError("Style catalog must be a non-empty list")
    for entry in catalog:
        if not isinstance(entry, dict) or not required.issubset(entry):
            raise ValueError("Style catalog contains an invalid entry")
    return catalog


def _parse_shell_value(raw_value: str) -> str:
    try:
        values = shlex.split(raw_value, comments=True, posix=True)
    except ValueError:
        return raw_value.strip().strip("\"'")
    return values[0] if values else ""


def load_config(path: Path = CONFIG_PATH) -> WallpaperConfig:
    values: dict[str, str] = {}
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            match = re.match(r"^\s*(STYLE|WIDTH|HEIGHT|OUTPUT_DIR)\s*=\s*(.*?)\s*$", line)
            if match:
                values[match.group(1)] = _parse_shell_value(match.group(2))

    try:
        width = int(values.get("WIDTH", "1080"))
    except ValueError:
        width = 1080
    try:
        height = int(values.get("HEIGHT", "2400"))
    except ValueError:
        height = 2400

    return WallpaperConfig(
        style=values.get("STYLE", "curves"),
        width=width,
        height=height,
        output_dir=values.get("OUTPUT_DIR", str(PROJECT_DIR / "my_wallpapers")),
    )


def validate_dimensions(width_text: str, height_text: str) -> tuple[int, int]:
    try:
        width = int(width_text.strip())
        height = int(height_text.strip())
    except ValueError as error:
        raise ValueError("Width and height must be whole numbers.") from error
    if not MIN_DIMENSION <= width <= MAX_DIMENSION:
        raise ValueError(f"Width must be between {MIN_DIMENSION} and {MAX_DIMENSION} pixels.")
    if not MIN_DIMENSION <= height <= MAX_DIMENSION:
        raise ValueError(f"Height must be between {MIN_DIMENSION} and {MAX_DIMENSION} pixels.")
    return width, height


def settings_height_for(screen_height: int) -> int:
    """Reserve one fifth of the available portrait height for settings."""
    return max(1, round(screen_height * SETTINGS_HEIGHT_RATIO))


def save_config(config: WallpaperConfig, path: Path = CONFIG_PATH) -> None:
    """Atomically update the four GUI-owned values while preserving comments."""
    original = path.read_text(encoding="utf-8") if path.exists() else ""
    replacements = {
        "STYLE": f'STYLE="{config.style}"',
        "WIDTH": f"WIDTH={config.width}",
        "HEIGHT": f"HEIGHT={config.height}",
        "OUTPUT_DIR": f"OUTPUT_DIR={shlex.quote(config.output_dir)}",
    }
    seen: set[str] = set()
    output_lines: list[str] = []

    for line in original.splitlines():
        match = re.match(r"^\s*(STYLE|WIDTH|HEIGHT|OUTPUT_DIR)\s*=", line)
        if match and match.group(1) not in seen:
            key = match.group(1)
            output_lines.append(replacements[key])
            seen.add(key)
        elif not match:
            output_lines.append(line)

    for key, replacement in replacements.items():
        if key not in seen:
            output_lines.append(replacement)

    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", dir=path.parent, prefix=".config.", delete=False
    ) as temporary:
        temporary.write("\n".join(output_lines).rstrip() + "\n")
        temporary_path = Path(temporary.name)
    os.replace(temporary_path, path)


def generate_wallpaper(style_id: str, width: int, height: int) -> tuple[Path, Path]:
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    command = [
        str(NODE_BIN),
        str(PROJECT_DIR / "main.js"),
        "--style",
        style_id,
        "--width",
        str(width),
        "--height",
        str(height),
        "--output",
        str(PREVIEW_DIR),
    ]
    result = subprocess.run(
        command,
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=600,
        check=False,
    )
    if result.returncode != 0:
        detail = (result.stderr or result.stdout).strip()
        raise RuntimeError(detail or f"Generator exited with status {result.returncode}")

    matches = re.findall(r"Wallpaper saved to:\s*(.+)", result.stdout)
    if not matches:
        raise RuntimeError("The generator finished without reporting an output file.")
    wallpaper_path = Path(matches[-1].strip())
    if not wallpaper_path.is_absolute():
        wallpaper_path = PROJECT_DIR / wallpaper_path
    if not wallpaper_path.is_file():
        raise RuntimeError(f"Generated wallpaper was not found: {wallpaper_path}")

    display_path = PREVIEW_DIR / "current_preview.jpg"
    preview_result = subprocess.run(
        [
            str(NODE_BIN),
            str(PROJECT_DIR / "scripts" / "create-preview.js"),
            str(wallpaper_path),
            str(display_path),
        ],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=120,
        check=False,
    )
    if preview_result.returncode != 0 or not display_path.is_file():
        detail = (preview_result.stderr or preview_result.stdout).strip()
        raise RuntimeError(detail or "Could not create the in-app preview.")
    return wallpaper_path, display_path


def generate_thumbnails(force: bool = False) -> Path:
    command = [
        str(NODE_BIN),
        str(PROJECT_DIR / "scripts" / "generate-style-thumbnails.js"),
        "--output",
        str(THUMBNAIL_DIR),
    ]
    if force:
        command.append("--force")
    result = subprocess.run(
        command,
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=900,
        check=False,
    )
    if result.returncode != 0:
        detail = (result.stderr or result.stdout).strip()
        raise RuntimeError(detail or "Thumbnail generation failed.")
    return THUMBNAIL_DIR


class WallpaperGui:
    def __init__(self, connection: tg.Connection):
        self.connection = connection
        self.activity = tg.Activity(connection)
        self.activity.setinputmode("resize")
        self.activity.setorientation("portrait")
        self.activity.settheme(
            COLOR_BACKGROUND,
            COLOR_SURFACE,
            COLOR_BACKGROUND,
            COLOR_TEXT,
            COLOR_ACCENT,
        )
        self.catalog = load_catalog()
        self.catalog_by_id = {entry["id"]: entry for entry in self.catalog}
        self.config = load_config()
        if self.config.style not in self.catalog_by_id:
            self.config = WallpaperConfig(
                style=self.catalog[0]["id"],
                width=self.config.width,
                height=self.config.height,
                output_dir=self.config.output_dir,
            )
        self.selected_style = self.config.style
        self.latest_wallpaper: Path | None = None
        self.preview_activity: tg.Activity | None = None
        self.preview_image: tg.ImageView | None = None
        self.running = True
        self.busy = False
        self.click_handlers: dict[tuple[int, int], Callable[[], None]] = {}
        self.style_checks: dict[str, tg.Checkbox] = {}
        self.thumbnail_views: dict[str, tg.ImageView] = {}
        self.results: queue.SimpleQueue[tuple[str, bool, object]] = queue.SimpleQueue()
        self._build_ui()
        self._load_latest_wallpaper()

        if any(not self._thumbnail_path(entry["id"]).is_file() for entry in self.catalog):
            self._start_job("thumbnails", lambda: generate_thumbnails(False))

    def _build_ui(self) -> None:
        configuration = self.activity.getconfiguration()
        screen_height = int(configuration.get("screenheight", 720))
        settings_height = settings_height_for(screen_height)

        root = tg.LinearLayout(self.activity)
        root.setdimensions(tg.View.MATCH_PARENT, tg.View.MATCH_PARENT)
        root.setbackgroundcolor(COLOR_BACKGROUND)

        settings = tg.LinearLayout(self.activity, root)
        settings.setwidth(tg.View.MATCH_PARENT)
        settings.setheight(settings_height)
        settings.setlinearlayoutparams(0)
        settings.setbackgroundcolor(COLOR_SURFACE_ALT)
        settings.setmargin(6, "left")
        settings.setmargin(6, "right")

        selected_row = tg.LinearLayout(self.activity, settings, False)
        selected_row.setwidth(tg.View.MATCH_PARENT)
        selected_row.setheight(36)
        selected_row.setlinearlayoutparams(0)
        selected_row.setmargin(8, "left")
        selected_row.setmargin(8, "right")
        selected_label = tg.TextView(self.activity, "Wallgen selected style:", selected_row)
        selected_label.settextsize(13)
        selected_label.settextcolor(COLOR_MUTED)
        selected_label.setheight(tg.View.MATCH_PARENT)
        selected_label.setlinearlayoutparams(1)
        selected_label.setgravity(0, 1)
        self.selection_label = tg.TextView(self.activity, "", selected_row)
        self.selection_label.settextsize(20)
        self.selection_label.settextcolor(COLOR_ACCENT)
        self.selection_label.setheight(tg.View.MATCH_PARENT)
        self.selection_label.setgravity(2, 1)
        self._update_selection_label()

        dimensions = tg.LinearLayout(self.activity, settings, False)
        dimensions.setwidth(tg.View.MATCH_PARENT)
        dimensions.setheight(58)
        dimensions.setlinearlayoutparams(0)
        dimensions.setmargin(8, "left")
        dimensions.setmargin(8, "right")

        width_group = tg.LinearLayout(self.activity, dimensions)
        width_group.setlinearlayoutparams(1)
        width_group.setmargin(4, "left")
        width_group.setmargin(4, "right")
        width_label = tg.TextView(self.activity, "width", width_group)
        width_label.settextsize(11)
        width_label.settextcolor(COLOR_MUTED)
        width_label.setheight(tg.View.WRAP_CONTENT)
        self.width_input = tg.EditText(
            self.activity,
            str(self.config.width),
            width_group,
            singleline=True,
            inputtype="number",
        )
        self.width_input.setheight(36)
        self.width_input.settextsize(16)
        self.width_input.settextcolor(COLOR_TEXT)
        self.width_input.setbackgroundcolor(COLOR_SURFACE)
        self.width_input.sendtextevent(True)

        height_group = tg.LinearLayout(self.activity, dimensions)
        height_group.setlinearlayoutparams(1)
        height_group.setmargin(4, "left")
        height_group.setmargin(4, "right")
        height_label = tg.TextView(self.activity, "height", height_group)
        height_label.settextsize(11)
        height_label.settextcolor(COLOR_MUTED)
        height_label.setheight(tg.View.WRAP_CONTENT)
        self.height_input = tg.EditText(
            self.activity,
            str(self.config.height),
            height_group,
            singleline=True,
            inputtype="number",
        )
        self.height_input.setheight(36)
        self.height_input.settextsize(16)
        self.height_input.settextcolor(COLOR_TEXT)
        self.height_input.setbackgroundcolor(COLOR_SURFACE)
        self.height_input.sendtextevent(True)

        self.status = tg.TextView(
            self.activity,
            "Tap a style image to generate and preview it.",
            settings,
        )
        self.status.settextsize(11)
        self.status.settextcolor(COLOR_MUTED)
        self.status.setheight(22)
        self.status.setlinearlayoutparams(0)
        self.status.setmargin(8, "left")
        self.status.setmargin(8, "right")
        self.status.setgravity(0, 1)

        scroll = tg.NestedScrollView(self.activity, root, fillviewport=True, nobar=False)
        scroll.setheight(0)
        scroll.setwidth(tg.View.MATCH_PARENT)
        scroll.setlinearlayoutparams(1)
        style_list = tg.LinearLayout(self.activity, scroll)
        style_list.setwidth(tg.View.MATCH_PARENT)
        style_list.setheight(tg.View.WRAP_CONTENT)

        for index, entry in enumerate(self.catalog):
            card = tg.LinearLayout(self.activity, style_list)
            card.setdimensions(tg.View.MATCH_PARENT, 268)
            card.setbackgroundcolor(COLOR_SURFACE if index % 2 == 0 else COLOR_SURFACE_ALT)
            card.setmargin(8)

            header = tg.LinearLayout(self.activity, card, False)
            header.setdimensions(tg.View.MATCH_PARENT, 52)
            header.setmargin(8)

            checkbox = tg.Checkbox(
                self.activity,
                "",
                header,
                checked=entry["id"] == self.selected_style,
            )
            checkbox.setdimensions(48, 48)
            checkbox.sendclickevent(True)
            self.click_handlers[(self.activity.aid, checkbox.id)] = (
                lambda style_id=entry["id"]: self._select_style(style_id)
            )
            self.style_checks[entry["id"]] = checkbox

            name = tg.TextView(self.activity, entry["name"], header)
            name.settextsize(20)
            name.settextcolor(COLOR_TEXT)
            name.setheight(tg.View.MATCH_PARENT)
            name.setlinearlayoutparams(1)
            name.setgravity(0, 1)
            name.setclickable(True)
            name.sendclickevent(True)
            self.click_handlers[(self.activity.aid, name.id)] = (
                lambda style_id=entry["id"]: self._select_style(style_id)
            )

            hint = tg.TextView(self.activity, "tap image to preview", header)
            hint.settextsize(11)
            hint.settextcolor(COLOR_MUTED)
            hint.setheight(tg.View.MATCH_PARENT)
            hint.setgravity(2, 1)

            thumbnail = tg.ImageView(self.activity, card)
            thumbnail.setdimensions(tg.View.MATCH_PARENT, 204)
            thumbnail.setmargin(8)
            thumbnail.setbackgroundcolor(COLOR_BACKGROUND)
            thumbnail.setclickable(True)
            thumbnail.sendclickevent(True)
            self.click_handlers[(self.activity.aid, thumbnail.id)] = (
                lambda style_id=entry["id"]: self._generate_style(style_id)
            )
            self.thumbnail_views[entry["id"]] = thumbnail
            self._set_thumbnail(entry["id"])

    def _make_button(
        self,
        activity: tg.Activity,
        text: str,
        parent: tg.View,
        handler: Callable[[], None],
        *,
        weight: bool = True,
    ) -> tg.Button:
        button = tg.Button(activity, text, parent, allcaps=False)
        button.setheight(52)
        button.settextsize(13)
        button.settextcolor(COLOR_TEXT)
        button.setmargin(4)
        if weight:
            button.setlinearlayoutparams(1)
        button.sendclickevent(True)
        self.click_handlers[(activity.aid, button.id)] = handler
        return button

    def _thumbnail_path(self, style_id: str) -> Path:
        return THUMBNAIL_DIR / f"{style_id}.jpg"

    def _set_thumbnail(self, style_id: str) -> None:
        path = self._thumbnail_path(style_id)
        view = self.thumbnail_views.get(style_id)
        if view is not None and path.is_file():
            view.setimage(path.read_bytes())

    def _load_latest_wallpaper(self) -> None:
        candidates = sorted(
            (path for path in PREVIEW_DIR.glob("*.png") if path.is_file()),
            key=lambda path: path.stat().st_mtime,
            reverse=True,
        )
        self.latest_wallpaper = candidates[0] if candidates else None

    def _update_selection_label(self) -> None:
        entry = self.catalog_by_id[self.selected_style]
        self.selection_label.settext(entry["name"])

    def _set_status(self, text: str, *, error: bool = False) -> None:
        self.status.settext(text)
        self.status.settextcolor(COLOR_DANGER if error else COLOR_MUTED)

    def _read_dimensions(self) -> tuple[int, int]:
        return validate_dimensions(self.width_input.gettext(), self.height_input.gettext())

    def _persist(self, width: int, height: int) -> None:
        self.config = WallpaperConfig(
            style=self.selected_style,
            width=width,
            height=height,
            output_dir=self.config.output_dir,
        )
        save_config(self.config)

    def _select_style(self, style_id: str) -> None:
        if style_id not in self.catalog_by_id:
            return
        previous = self.selected_style
        self.selected_style = style_id
        self.style_checks[previous].setchecked(False)
        self.style_checks[style_id].setchecked(True)
        self._update_selection_label()
        self.config = WallpaperConfig(
            style=style_id,
            width=self.config.width,
            height=self.config.height,
            output_dir=self.config.output_dir,
        )
        save_config(self.config)
        self._set_status(f"{self.catalog_by_id[style_id]['name']} selected and saved.")

    def _save_dimensions_if_valid(self, *, report_error: bool = False) -> bool:
        try:
            width, height = self._read_dimensions()
            self._persist(width, height)
        except (OSError, ValueError) as error:
            if report_error:
                self._set_status(str(error), error=True)
            return False
        return True

    def _generate_style(self, style_id: str) -> None:
        try:
            width, height = self._read_dimensions()
            self._persist(width, height)
        except (OSError, ValueError) as error:
            self._set_status(str(error), error=True)
            return
        self.activity.hidesoftkeyboard()
        self._start_job(
            "wallpaper",
            lambda: (style_id, *generate_wallpaper(style_id, width, height)),
        )

    def _show_preview(self, style_id: str, display_path: Path) -> None:
        if self.preview_activity is not None:
            self.preview_activity.finish()

        activity = tg.Activity(self.connection, tid=self.activity.t.tid)
        activity.settheme(
            COLOR_BACKGROUND,
            COLOR_SURFACE,
            COLOR_BACKGROUND,
            COLOR_TEXT,
            COLOR_ACCENT,
        )
        self.preview_activity = activity
        root = tg.LinearLayout(activity)
        root.setdimensions(tg.View.MATCH_PARENT, tg.View.MATCH_PARENT)
        root.setbackgroundcolor(COLOR_BACKGROUND)

        title = tg.TextView(
            activity,
            f"{self.catalog_by_id[style_id]['name']} preview",
            root,
        )
        title.settextsize(22)
        title.settextcolor(COLOR_TEXT)
        title.setheight(tg.View.WRAP_CONTENT)
        title.setmargin(14)

        image = tg.ImageView(activity, root)
        image.setwidth(tg.View.MATCH_PARENT)
        image.setheight(0)
        image.setlinearlayoutparams(1)
        image.setbackgroundcolor(COLOR_SURFACE)
        image.setmargin(10)
        image.setimage(display_path.read_bytes())
        self.preview_image = image

        actions = tg.LinearLayout(activity, root, False)
        actions.setwidth(tg.View.MATCH_PARENT)
        actions.setheight(tg.View.WRAP_CONTENT)
        actions.setmargin(8)
        self._make_button(activity, "Set as wallpaper", actions, self._apply_preview)
        self._make_button(activity, "Close preview", actions, self._close_preview)

    def _close_preview(self) -> None:
        if self.preview_activity is not None:
            self.preview_activity.finish()

    def _apply_preview(self) -> None:
        if self.latest_wallpaper is None or not self.latest_wallpaper.is_file():
            self._set_status("Generate a wallpaper before applying it.", error=True)
            return
        self._start_job("apply", lambda: self._set_wallpaper(self.latest_wallpaper))

    @staticmethod
    def _set_wallpaper(path: Path) -> Path:
        if not WALLPAPER_BIN.is_file():
            raise RuntimeError("termux-wallpaper is unavailable. Install the Termux:API package.")
        for lockscreen in (False, True):
            command = [str(WALLPAPER_BIN), "-f", str(path)]
            if lockscreen:
                command.append("-l")
            result = subprocess.run(command, capture_output=True, text=True, timeout=60)
            if result.returncode != 0:
                raise RuntimeError((result.stderr or result.stdout).strip())
        return path

    def _start_job(self, kind: str, operation: Callable[[], object]) -> None:
        if self.busy:
            self._set_status("Another operation is still running.", error=True)
            return
        self.busy = True
        labels = {
            "wallpaper": "Generating wallpaper…",
            "thumbnails": "Rendering style thumbnails…",
            "apply": "Applying wallpaper…",
        }
        self._set_status(labels.get(kind, "Working…"))

        def run() -> None:
            try:
                result = operation()
                self.results.put((kind, True, result))
            except Exception as error:
                self.results.put((kind, False, error))

        threading.Thread(target=run, name=f"wallgen-{kind}", daemon=True).start()

    def poll_results(self) -> None:
        while True:
            try:
                kind, succeeded, result = self.results.get_nowait()
            except queue.Empty:
                return
            self.busy = False
            if not succeeded:
                self._set_status(f"{kind.capitalize()} failed: {result}", error=True)
                self.connection.toast(f"Wallgen {kind} failed", long=True)
                continue
            if kind == "wallpaper":
                style_id, wallpaper_path, display_path = result
                self.latest_wallpaper = wallpaper_path
                self._show_preview(style_id, display_path)
                self._set_status(f"Generated {wallpaper_path.name}.")
                self.connection.toast("Wallpaper generated")
            elif kind == "thumbnails":
                for entry in self.catalog:
                    self._set_thumbnail(entry["id"])
                self._set_status("All style thumbnails are ready.")
            elif kind == "apply":
                self._set_status(f"Applied {result.name} to home and lock screens.")
                self.connection.toast("Wallpaper applied")

    def handle_event(self, event: tg.Event) -> None:
        if event.type == tg.Event.click:
            handler = self.click_handlers.get(
                (getattr(event, "aid", -1), getattr(event, "id", -1))
            )
            if handler is not None:
                handler()
        elif event.type == tg.Event.text and getattr(event, "id", -1) in {
            self.width_input.id,
            self.height_input.id,
        }:
            self._save_dimensions_if_valid()
        elif event.type == tg.Event.destroy and event.value.get("finishing", False):
            if getattr(event, "aid", -1) == self.activity.aid:
                self.running = False
            elif (
                self.preview_activity is not None
                and getattr(event, "aid", -1) == self.preview_activity.aid
            ):
                self.preview_activity = None
                self.preview_image = None


def main() -> int:
    try:
        with tg.Connection() as connection:
            app = WallpaperGui(connection)
            while app.running:
                event = connection.checkevent()
                while event is not None:
                    app.handle_event(event)
                    event = connection.checkevent()
                app.poll_results()
                time.sleep(0.05)
    except KeyboardInterrupt:
        return 130
    except RuntimeError as error:
        print(f"Could not start Wallgen GUI: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
