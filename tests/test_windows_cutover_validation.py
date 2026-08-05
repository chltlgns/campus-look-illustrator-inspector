"""Twelve locked local selectors for the Windows Illustrator cutover."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest

from tests.test_inspector_split_validation import (
    LEGACY_SOURCE,
    GIT,
    NODE,
    POWERSHELL,
    REPO,
    quote_ps,
    powershell_resolve,
    run,
    windows_path,
)


def invoke_cutover(
    mode: str,
    *,
    local_root: Path,
    shortcut: Path,
    program_jsx: Path,
    backup_root: Path | None = None,
):
    argv = [
        str(POWERSHELL),
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        windows_path(REPO / "illustrator/windows-cutover.ps1"),
        "-Mode",
        mode,
        "-LocalRoot",
        windows_path(local_root),
        "-ShortcutPath",
        windows_path(shortcut),
        "-ProgramJsxPath",
        windows_path(program_jsx),
    ]
    if backup_root is not None:
        argv.extend(("-BackupRoot", windows_path(backup_root)))
    return run(argv, check=False)


def tree_digest(root: Path) -> str:
    digest = hashlib.sha256()
    for item in sorted(root.rglob("*")):
        digest.update(str(item.relative_to(root)).encode())
        if item.is_file():
            digest.update(item.read_bytes())
    return digest.hexdigest()


class WindowsCutoverValidation(unittest.TestCase):
    def test_sidecar_schema2_external_runtime_resolution(self) -> None:
        with tempfile.TemporaryDirectory(prefix="cutover-sidecar-") as temporary:
            root = Path(temporary)
            runtime = root / "runtime"
            runtime.mkdir()
            sidecar = root / "inspector-root.json"
            sidecar.write_text(
                json.dumps(
                    {
                        "schemaVersion": 2,
                        "inspectorRoot": windows_path(REPO),
                        "wslDistribution": "Ubuntu",
                        "runtimeRoot": windows_path(runtime),
                    }
                ),
                encoding="utf-8",
            )
            result = powershell_resolve(
                f"$result=Resolve-InspectorRoot -SidecarPath '{quote_ps(windows_path(sidecar))}'; "
                "$result | ConvertTo-Json -Compress"
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            receipt = json.loads(result.stdout.strip())
            self.assertEqual(receipt["Source"], "sidecar")
            self.assertEqual(receipt["RuntimeSource"], "sidecar")
            self.assertEqual(receipt["WslDistribution"], "Ubuntu")
            self.assertNotEqual(receipt["RuntimeWindowsRoot"], receipt["WindowsRoot"])

    def test_parameter_environment_sidecar_precedence(self) -> None:
        with tempfile.TemporaryDirectory(prefix="cutover-precedence-") as temporary:
            root = Path(temporary)
            environment_runtime = root / "environment"
            parameter_runtime = root / "parameter"
            environment_runtime.mkdir()
            parameter_runtime.mkdir()
            result = powershell_resolve(
                f"$env:CAMPUSLOOK_ILLUSTRATOR_INSPECTOR_ROOT='{quote_ps(windows_path(LEGACY_SOURCE))}'; "
                f"$env:CAMPUSLOOK_ILLUSTRATOR_INSPECTOR_RUNTIME_ROOT='{quote_ps(windows_path(environment_runtime))}'; "
                f"$result=Resolve-InspectorRoot -ExplicitRoot '{quote_ps(windows_path(REPO))}' "
                f"-ExplicitRuntimeRoot '{quote_ps(windows_path(parameter_runtime))}' "
                "-ExplicitWslDistribution 'Ubuntu'; $result | ConvertTo-Json -Compress"
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            receipt = json.loads(result.stdout.strip())
            self.assertEqual(receipt["Source"], "parameter")
            self.assertEqual(receipt["RuntimeSource"], "parameter")

    def test_backup_manifest_fixture(self) -> None:
        with tempfile.TemporaryDirectory(prefix="cutover-backup-") as temporary:
            root = Path(temporary)
            local = root / "installed"
            local.mkdir()
            (local / "run-proof-check.ps1").write_text("legacy", encoding="utf-8")
            shortcut = root / "shortcut.lnk"
            shortcut.write_bytes(b"shortcut")
            jsx = root / "program.jsx"
            jsx.write_text("jsx", encoding="utf-8")
            backup = root / "backup"
            result = invoke_cutover(
                "Backup", local_root=local, shortcut=shortcut, program_jsx=jsx, backup_root=backup
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            manifest = json.loads((backup / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(manifest["schemaVersion"], "campuslook-windows-cutover-backup/v1")
            self.assertEqual(len(manifest["entries"]), 10)
            present = [item for item in manifest["entries"] if item["preExisted"]]
            self.assertEqual(len(present), 3)
            for entry in present:
                backup_file = backup / entry["backupRelativePath"]
                self.assertTrue(backup_file.is_file())
                self.assertEqual(hashlib.sha256(backup_file.read_bytes()).hexdigest(), entry["preSha256"])

    def test_hash_guarded_rollback_fixture(self) -> None:
        with tempfile.TemporaryDirectory(prefix="cutover-rollback-") as temporary:
            root = Path(temporary)
            local = root / "installed"
            local.mkdir()
            launcher = local / "run-proof-check.ps1"
            launcher.write_text("legacy", encoding="utf-8")
            shortcut = root / "shortcut.lnk"
            shortcut.write_bytes(b"old shortcut")
            jsx = root / "program.jsx"
            jsx.write_text("same jsx", encoding="utf-8")
            backup = root / "backup"
            self.assertEqual(
                invoke_cutover(
                    "Backup", local_root=local, shortcut=shortcut, program_jsx=jsx, backup_root=backup
                ).returncode,
                0,
            )
            launcher.write_text("new", encoding="utf-8")
            (local / "inspector-root.ps1").write_text("resolver", encoding="utf-8")
            self.assertEqual(
                invoke_cutover(
                    "RecordPostState",
                    local_root=local,
                    shortcut=shortcut,
                    program_jsx=jsx,
                    backup_root=backup,
                ).returncode,
                0,
            )
            result = invoke_cutover(
                "Rollback", local_root=local, shortcut=shortcut, program_jsx=jsx, backup_root=backup
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(launcher.read_text(encoding="utf-8"), "legacy")
            self.assertFalse((local / "inspector-root.ps1").exists())

    def test_launcher_uses_external_runtime_paths(self) -> None:
        launcher = (REPO / "illustrator/run-proof-check.ps1").read_text(encoding="utf-8")
        installer = (REPO / "illustrator/install-illustrator-script.ps1").read_text(encoding="utf-8")
        self.assertNotIn('$workspaceRoot/reports', launcher)
        self.assertNotIn('$workspaceRoot/.cache', launcher)
        self.assertIn('$runtimeRoot/reports', launcher)
        self.assertIn('$runtimeRoot/cache', launcher)
        self.assertIn("schemaVersion = 2", installer)
        self.assertIn("runtimeRoot = [string]$rootSettings.RuntimeWindowsRoot", installer)

    def test_cli_quiet_schema_and_performance_contract(self) -> None:
        result = run([str(NODE), "--test", "tests/inspector-split-validation.test.mjs"])
        self.assertIn("fail 0", result.stdout)
        launcher = (REPO / "illustrator/run-proof-check.ps1").read_text(encoding="utf-8")
        integration = (REPO / "docs/integration.md").read_text(encoding="utf-8")
        self.assertIn("phaseTimings", launcher)
        self.assertIn("elapsedSeconds", launcher)
        self.assertIn("`schemaVersion`: 현재 `4`", integration)
        self.assertIn("PASS", integration)
        self.assertIn("REVIEW", integration)
        self.assertIn("FAIL", integration)

    def test_source_root_failure_matrix(self) -> None:
        with tempfile.TemporaryDirectory(prefix="cutover-source-negative-") as temporary:
            root = Path(temporary)
            runtime = root / "runtime"
            runtime.mkdir()
            runtime_windows = quote_ps(windows_path(runtime))
            missing = powershell_resolve(
                "$env:CAMPUSLOOK_ILLUSTRATOR_INSPECTOR_ROOT=''; "
                "$env:CAMPUSLOOK_ILLUSTRATOR_INSPECTOR_RUNTIME_ROOT=''; "
                "try { Resolve-InspectorRoot -SidecarPath 'Z:\\missing.json'; exit 0 } "
                "catch { [Console]::Error.WriteLine($_.Exception.Message); exit 11 }"
            )
            self.assertEqual(missing.returncode, 11)
            self.assertIn("inspector_root_invalid", missing.stderr)

            schema_one = root / "schema-one.json"
            schema_one.write_text(
                json.dumps(
                    {
                        "schemaVersion": 1,
                        "inspectorRoot": windows_path(REPO),
                        "runtimeRoot": windows_path(runtime),
                    }
                ),
                encoding="utf-8",
            )
            malformed = powershell_resolve(
                f"try {{ Resolve-InspectorRoot -SidecarPath '{quote_ps(windows_path(schema_one))}'; exit 0 }} "
                "catch { [Console]::Error.WriteLine($_.Exception.Message); exit 12 }"
            )
            self.assertEqual(malformed.returncode, 12)
            self.assertIn("inspector_root_invalid", malformed.stderr)

            for exit_code, invalid_root in ((13, root), (14, LEGACY_SOURCE)):
                result = powershell_resolve(
                    f"try {{ Resolve-InspectorRoot -ExplicitRoot '{quote_ps(windows_path(invalid_root))}' "
                    f"-ExplicitRuntimeRoot '{runtime_windows}'; exit 0 }} "
                    f"catch {{ [Console]::Error.WriteLine($_.Exception.Message); exit {exit_code} }}"
                )
                self.assertEqual(result.returncode, exit_code)
                self.assertIn("inspector_root_invalid", result.stderr)

    def test_runtime_root_failure_matrix(self) -> None:
        with tempfile.TemporaryDirectory(prefix="cutover-runtime-negative-") as temporary:
            root = Path(temporary)
            runtime_file = root / "runtime.txt"
            runtime_file.write_text("not a directory", encoding="utf-8")
            invalid_runtime_paths = [root / "missing", runtime_file, REPO, REPO / "tests"]
            for offset, invalid_runtime in enumerate(invalid_runtime_paths, start=20):
                result = powershell_resolve(
                    f"try {{ Resolve-InspectorRoot -ExplicitRoot '{quote_ps(windows_path(REPO))}' "
                    f"-ExplicitRuntimeRoot '{quote_ps(windows_path(invalid_runtime))}'; exit 0 }} "
                    f"catch {{ [Console]::Error.WriteLine($_.Exception.Message); exit {offset} }}"
                )
                self.assertEqual(result.returncode, offset)
                self.assertIn("inspector_root_invalid", result.stderr)

    def test_rollback_rejects_current_drift(self) -> None:
        with tempfile.TemporaryDirectory(prefix="cutover-drift-") as temporary:
            root = Path(temporary)
            local = root / "installed"
            local.mkdir()
            launcher = local / "run-proof-check.ps1"
            launcher.write_text("legacy", encoding="utf-8")
            shortcut = root / "shortcut.lnk"
            shortcut.write_bytes(b"old")
            jsx = root / "program.jsx"
            jsx.write_text("jsx", encoding="utf-8")
            backup = root / "backup"
            self.assertEqual(
                invoke_cutover(
                    "Backup", local_root=local, shortcut=shortcut, program_jsx=jsx, backup_root=backup
                ).returncode,
                0,
            )
            launcher.write_text("installed", encoding="utf-8")
            self.assertEqual(
                invoke_cutover(
                    "RecordPostState",
                    local_root=local,
                    shortcut=shortcut,
                    program_jsx=jsx,
                    backup_root=backup,
                ).returncode,
                0,
            )
            launcher.write_text("unrelated drift", encoding="utf-8")
            result = invoke_cutover(
                "Rollback", local_root=local, shortcut=shortcut, program_jsx=jsx, backup_root=backup
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("cutover_rollback_blocked", result.stderr)
            self.assertEqual(launcher.read_text(encoding="utf-8"), "unrelated drift")

    def test_preflight_mode_has_zero_writes(self) -> None:
        with tempfile.TemporaryDirectory(prefix="cutover-preflight-") as temporary:
            root = Path(temporary)
            local = root / "installed"
            local.mkdir()
            (local / "run-proof-check.ps1").write_text("legacy", encoding="utf-8")
            shortcut = root / "shortcut.lnk"
            shortcut.write_bytes(b"shortcut")
            jsx = root / "program.jsx"
            jsx.write_text("jsx", encoding="utf-8")
            before = tree_digest(root)
            result = invoke_cutover("Preflight", local_root=local, shortcut=shortcut, program_jsx=jsx)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(json.loads(result.stdout)["writeCount"], 0)
            self.assertEqual(tree_digest(root), before)

    def test_data_parent_remote_boundaries(self) -> None:
        tracked = run([str(GIT), "ls-files"]).stdout.splitlines()
        forbidden_suffixes = {".ai", ".pdf", ".eps", ".jpg", ".jpeg", ".png"}
        self.assertFalse(any(Path(item).suffix.lower() in forbidden_suffixes for item in tracked))
        self.assertEqual(run([str(GIT), "remote"]).stdout.splitlines(), ["origin"])
        baseline = json.loads(
            (REPO / "quality/evidence/material-palette-parent-prestate.json").read_text(encoding="utf-8")
        )
        parent_status = run(
            [str(GIT), "-C", str(LEGACY_SOURCE.parent), "status", "--porcelain=v2", "--branch"]
        ).stdout.encode()
        self.assertEqual(hashlib.sha256(parent_status).hexdigest(), baseline["parentPorcelainV2Sha256"])
        self.assertEqual(baseline["parentWritesPerformed"], 0)

    def test_legacy_and_new_local_regression(self) -> None:
        run([str(NODE), "scripts/check-source.mjs"])
        run([str(NODE), "--test", "tests/inspector-split-validation.test.mjs"])
        run([str(NODE), "scripts/verify-migration.mjs"])
        run([sys.executable, "-m", "unittest", "tests.test_inspector_split_validation", "-v"])
        run([str(GIT), "diff", "--check"])


if __name__ == "__main__":
    unittest.main()
