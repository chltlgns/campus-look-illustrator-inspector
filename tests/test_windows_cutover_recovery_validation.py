"""Six locked selectors for the Windows cutover activation recovery."""

from __future__ import annotations

import json
from pathlib import Path
import tempfile
import unittest

from tests.test_inspector_split_validation import (
    POWERSHELL,
    powershell_resolve,
    quote_ps,
    run,
    windows_path,
)
from tests.test_windows_cutover_validation import invoke_cutover


EXPECTED_LINUX_ROOT = "/home/doggabiya/campus-look-illustrator-inspector"


def convert_unc(value: str, distribution: str = "Ubuntu"):
    return powershell_resolve(
        f"Convert-InspectorWindowsPathToWsl -WindowsPath '{quote_ps(value)}' "
        f"-WslDistribution '{quote_ps(distribution)}'"
    )


class WindowsCutoverRecoveryValidation(unittest.TestCase):
    def test_wsl_localhost_unc_direct_conversion(self) -> None:
        result = convert_unc(
            r"\\wsl.localhost\Ubuntu\home\doggabiya\campus-look-illustrator-inspector"
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), EXPECTED_LINUX_ROOT)

    def test_wsl_dollar_unc_direct_conversion(self) -> None:
        result = convert_unc(
            r"\\wsl$\Ubuntu\home\doggabiya\campus-look-illustrator-inspector"
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), EXPECTED_LINUX_ROOT)

    def test_wsl_unc_distribution_mismatch_is_fail_closed(self) -> None:
        result = powershell_resolve(
            "try { Convert-InspectorWindowsPathToWsl "
            "-WindowsPath '\\\\wsl.localhost\\Ubuntu\\home\\doggabiya' "
            "-WslDistribution 'Debian' | Out-Null; exit 0 } "
            "catch { [Console]::Error.WriteLine($_.Exception.Message); exit 31 }"
        )
        self.assertEqual(result.returncode, 31)
        self.assertIn("inspector_root_invalid", result.stderr)

    def test_wsl_unc_empty_path_is_fail_closed(self) -> None:
        result = powershell_resolve(
            "try { Convert-InspectorWindowsPathToWsl "
            "-WindowsPath '\\\\wsl.localhost\\Ubuntu' "
            "-WslDistribution 'Ubuntu' | Out-Null; exit 0 } "
            "catch { [Console]::Error.WriteLine($_.Exception.Message); exit 32 }"
        )
        self.assertEqual(result.returncode, 32)
        self.assertIn("inspector_root_invalid", result.stderr)

    def test_rollback_pre_equal_protected_file_is_noop(self) -> None:
        with tempfile.TemporaryDirectory(prefix="cutover-recovery-noop-") as temporary:
            root = Path(temporary)
            local = root / "installed"
            local.mkdir()
            (local / "run-proof-check.ps1").write_text("legacy", encoding="utf-8")
            shortcut = root / "shortcut.lnk"
            shortcut.write_bytes(b"shortcut")
            program_jsx = root / "protected.jsx"
            program_jsx.write_text("unchanged protected jsx", encoding="utf-8")
            backup = root / "backup"
            self.assertEqual(
                invoke_cutover(
                    "Backup",
                    local_root=local,
                    shortcut=shortcut,
                    program_jsx=program_jsx,
                    backup_root=backup,
                ).returncode,
                0,
            )
            self.assertEqual(
                invoke_cutover(
                    "RecordPostState",
                    local_root=local,
                    shortcut=shortcut,
                    program_jsx=program_jsx,
                    backup_root=backup,
                ).returncode,
                0,
            )
            program_windows = quote_ps(windows_path(program_jsx))
            protect = run(
                [
                    str(POWERSHELL),
                    "-NoLogo",
                    "-NoProfile",
                    "-NonInteractive",
                    "-Command",
                    f"(Get-Item -LiteralPath '{program_windows}').IsReadOnly=$true",
                ],
                check=False,
            )
            self.assertEqual(protect.returncode, 0, protect.stderr)
            try:
                result = invoke_cutover(
                    "Rollback",
                    local_root=local,
                    shortcut=shortcut,
                    program_jsx=program_jsx,
                    backup_root=backup,
                )
                self.assertEqual(result.returncode, 0, result.stderr)
                receipt = json.loads(result.stdout.strip())
                self.assertEqual(receipt["writesPerformed"], 0)
                self.assertEqual(receipt["preEqualSkipped"], 3)
                self.assertEqual(program_jsx.read_text(encoding="utf-8"), "unchanged protected jsx")
            finally:
                run(
                    [
                        str(POWERSHELL),
                        "-NoLogo",
                        "-NoProfile",
                        "-NonInteractive",
                        "-Command",
                        f"if(Test-Path -LiteralPath '{program_windows}'){{"
                        f"(Get-Item -LiteralPath '{program_windows}').IsReadOnly=$false}}",
                    ],
                    check=False,
                )

    def test_rollback_changed_post_target_restores_prestate(self) -> None:
        with tempfile.TemporaryDirectory(prefix="cutover-recovery-restore-") as temporary:
            root = Path(temporary)
            local = root / "installed"
            local.mkdir()
            launcher = local / "run-proof-check.ps1"
            launcher.write_text("legacy", encoding="utf-8")
            shortcut = root / "shortcut.lnk"
            shortcut.write_bytes(b"shortcut")
            program_jsx = root / "program.jsx"
            program_jsx.write_text("same jsx", encoding="utf-8")
            backup = root / "backup"
            self.assertEqual(
                invoke_cutover(
                    "Backup",
                    local_root=local,
                    shortcut=shortcut,
                    program_jsx=program_jsx,
                    backup_root=backup,
                ).returncode,
                0,
            )
            launcher.write_text("installed", encoding="utf-8")
            resolver = local / "inspector-root.ps1"
            resolver.write_text("new resolver", encoding="utf-8")
            self.assertEqual(
                invoke_cutover(
                    "RecordPostState",
                    local_root=local,
                    shortcut=shortcut,
                    program_jsx=program_jsx,
                    backup_root=backup,
                ).returncode,
                0,
            )
            result = invoke_cutover(
                "Rollback",
                local_root=local,
                shortcut=shortcut,
                program_jsx=program_jsx,
                backup_root=backup,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            receipt = json.loads(result.stdout.strip())
            self.assertEqual(receipt["writesPerformed"], 2)
            self.assertEqual(receipt["preEqualSkipped"], 2)
            self.assertEqual(launcher.read_text(encoding="utf-8"), "legacy")
            self.assertFalse(resolver.exists())


if __name__ == "__main__":
    unittest.main()
