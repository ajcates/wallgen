import tempfile
import unittest
from pathlib import Path

from termux_gui.wallpaper_gui import (
    WallpaperConfig,
    load_catalog,
    load_config,
    save_config,
    settings_height_for,
    validate_dimensions,
)


class WallpaperGuiConfigTests(unittest.TestCase):
    def test_catalog_matches_expected_style_surface(self):
        catalog = load_catalog()
        ids = {entry["id"] for entry in catalog}
        self.assertGreaterEqual(len(ids), 27)
        self.assertIn("plasmo", ids)
        self.assertIn("trill", ids)

    def test_config_round_trip_preserves_unrelated_comments(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "config.env"
            path.write_text(
                '# User note\nSTYLE="curves"\nWIDTH=1080\nHEIGHT=2400\n'
                'OUTPUT_DIR="/tmp/walls"\nEXTRA="preserve"\n',
                encoding="utf-8",
            )
            expected = WallpaperConfig("plasmo", 1440, 3120, "/tmp/walls")
            save_config(expected, path)
            self.assertEqual(load_config(path), expected)
            contents = path.read_text(encoding="utf-8")
            self.assertIn("# User note", contents)
            self.assertIn('EXTRA="preserve"', contents)

    def test_dimensions_are_bounded(self):
        self.assertEqual(validate_dimensions("1080", "2400"), (1080, 2400))
        with self.assertRaises(ValueError):
            validate_dimensions("wide", "2400")
        with self.assertRaises(ValueError):
            validate_dimensions("64", "2400")
        with self.assertRaises(ValueError):
            validate_dimensions("1080", "99999")

    def test_settings_use_one_fifth_of_screen_height(self):
        self.assertEqual(settings_height_for(720), 144)
        self.assertEqual(settings_height_for(800), 160)
        self.assertLessEqual(settings_height_for(800), 800 // 5)


if __name__ == "__main__":
    unittest.main()
