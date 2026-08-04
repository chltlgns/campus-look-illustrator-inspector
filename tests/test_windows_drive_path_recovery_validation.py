"""Four locked selectors for Windows drive-path activation recovery."""

from __future__ import annotations

import unittest

from tests.test_inspector_split_validation import REPO, powershell_resolve


EXPECTED_RUNTIME = "/mnt/c/Users/GOLD/AppData/Local/Campuslook/IllustratorProofCheck/runtime"
UNICODE_WINDOWS_PATH = r"C:\Proof Fixtures\한글 컬러판.ai"
EXPECTED_UNICODE_PATH = "/mnt/c/Proof Fixtures/한글 컬러판.ai"


def convert_drive(value: str):
    escaped = value.replace("'", "''")
    return powershell_resolve(
        "Convert-InspectorWindowsPathToWsl "
        f"-WindowsPath '{escaped}' -WslDistribution 'Ubuntu'"
    )


class WindowsDrivePathRecoveryValidation(unittest.TestCase):
    def test_no_space_drive_path_is_normalized_before_wslpath(self) -> None:
        result = convert_drive(
            r"C:\Users\GOLD\AppData\Local\Campuslook\IllustratorProofCheck\runtime"
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), EXPECTED_RUNTIME)

    def test_space_and_unicode_drive_path_is_preserved(self) -> None:
        result = convert_drive(UNICODE_WINDOWS_PATH)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), EXPECTED_UNICODE_PATH)

    def test_drive_relative_path_is_fail_closed(self) -> None:
        result = powershell_resolve(
            "try { Convert-InspectorWindowsPathToWsl "
            "-WindowsPath 'C:relative\\runtime' -WslDistribution 'Ubuntu' | Out-Null; exit 0 } "
            "catch { [Console]::Error.WriteLine($_.Exception.Message); exit 33 }"
        )
        self.assertEqual(result.returncode, 33)
        self.assertIn("inspector_root_invalid", result.stderr)

    def test_unc_and_non_drive_regressions_remain_locked(self) -> None:
        localhost = powershell_resolve(
            "Convert-InspectorWindowsPathToWsl "
            "-WindowsPath '\\\\wsl.localhost\\Ubuntu\\home\\doggabiya' "
            "-WslDistribution 'Ubuntu'"
        )
        dollar = powershell_resolve(
            "Convert-InspectorWindowsPathToWsl "
            "-WindowsPath '\\\\wsl$\\Ubuntu\\home\\doggabiya' "
            "-WslDistribution 'Ubuntu'"
        )
        mismatch = powershell_resolve(
            "try { Convert-InspectorWindowsPathToWsl "
            "-WindowsPath '\\\\wsl.localhost\\Ubuntu\\home\\doggabiya' "
            "-WslDistribution 'Debian' | Out-Null; exit 0 } "
            "catch { [Console]::Error.WriteLine($_.Exception.Message); exit 34 }"
        )
        self.assertEqual(localhost.returncode, 0, localhost.stderr)
        self.assertEqual(localhost.stdout.strip(), "/home/doggabiya")
        self.assertEqual(dollar.returncode, 0, dollar.stderr)
        self.assertEqual(dollar.stdout.strip(), "/home/doggabiya")
        self.assertEqual(mismatch.returncode, 34)
        self.assertIn("inspector_root_invalid", mismatch.stderr)

        launcher = (REPO / "illustrator/run-proof-check.ps1").read_text(encoding="utf-8")
        resolver = (REPO / "illustrator/inspector-root.ps1").read_text(encoding="utf-8")
        rollback = (REPO / "illustrator/windows-cutover.ps1").read_text(encoding="utf-8")
        self.assertIn("Convert-InspectorWindowsPathToWsl", launcher)
        self.assertIn("wsl.localhost", resolver)
        self.assertIn("wsl$", resolver)
        self.assertIn("preEqualSkipped", rollback)


if __name__ == "__main__":
    unittest.main()
