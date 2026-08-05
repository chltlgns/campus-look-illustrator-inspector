"""Eight locked, read-only validation selectors for the independent inspector split."""

from __future__ import annotations

import base64
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


REPO = Path(__file__).resolve().parents[1]
USER_HOME = Path(os.path.expanduser("~"))
PARENT = USER_HOME / "campus-look-ops"
LEGACY_SOURCE = PARENT / "일러스트 확인용 스크립트"
NODE = Path("/usr/local/bin/node")
GIT = Path("/usr/bin/git")
BASH = Path("/usr/bin/bash")
WSLPATH = Path("/usr/bin/wslpath")
POWERSHELL = Path("/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe")


def run(argv: list[str], *, cwd: Path = REPO, check: bool = True) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        argv,
        cwd=cwd,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
        timeout=120,
    )
    if check and result.returncode != 0:
        raise AssertionError(
            f"command failed ({result.returncode}): {argv!r}\nstdout={result.stdout}\nstderr={result.stderr}"
        )
    return result


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def quote_ps(value: str) -> str:
    return value.replace("'", "''")


def windows_path(value: Path) -> str:
    return run([str(WSLPATH), "-a", "-w", str(value)]).stdout.strip()


def powershell_resolve(body: str) -> subprocess.CompletedProcess[str]:
    module = quote_ps(windows_path(REPO / "illustrator/inspector-root.ps1"))
    script = "; ".join(
        (
            "[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)",
            f"$source=[IO.File]::ReadAllText('{module}',[Text.UTF8Encoding]::new($false))",
            "Invoke-Expression $source",
            body,
        )
    )
    encoded = base64.b64encode(script.encode("utf-16le")).decode("ascii")
    return run(
        [
            str(POWERSHELL),
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-EncodedCommand",
            encoded,
        ],
        check=False,
    )


class InspectorSplitValidation(unittest.TestCase):
    def test_independent_repository_boundary(self) -> None:
        self.assertEqual(run([str(GIT), "rev-parse", "--show-toplevel"]).stdout.strip(), str(REPO))
        self.assertNotEqual(
            run([str(GIT), "-C", str(PARENT), "rev-parse", "--show-toplevel"]).stdout.strip(),
            str(REPO),
        )
        self.assertTrue((REPO / ".git").exists())
        self.assertTrue((REPO / ".orbit/state.json").is_file())

    def test_source_only_manifest_and_hashes(self) -> None:
        result = run([str(NODE), "scripts/verify-migration.mjs", "--source-root", str(LEGACY_SOURCE)])
        receipt = json.loads(result.stdout)
        self.assertTrue(receipt["ok"])
        self.assertEqual(receipt["entries"], 12)
        self.assertEqual(receipt["remotes"], 0)

    def test_environment_and_sidecar_root_resolution(self) -> None:
        with tempfile.TemporaryDirectory(prefix="campuslook-sidecar-") as temporary:
            temporary_path = Path(temporary)
            runtime = temporary_path / "runtime"
            runtime.mkdir()
            root_windows = quote_ps(windows_path(REPO))
            runtime_windows = quote_ps(windows_path(runtime))
            environment_result = powershell_resolve(
                f"$env:CAMPUSLOOK_ILLUSTRATOR_INSPECTOR_ROOT='{root_windows}'; "
                f"$env:CAMPUSLOOK_ILLUSTRATOR_INSPECTOR_RUNTIME_ROOT='{runtime_windows}'; "
                "$result=Resolve-InspectorRoot -SidecarPath 'Z:\\missing-sidecar.json'; "
                "$result | ConvertTo-Json -Compress"
            )
            self.assertEqual(environment_result.returncode, 0, environment_result.stderr)
            environment_json = json.loads(environment_result.stdout.strip())
            self.assertEqual(environment_json["Source"], "environment")
            self.assertEqual(environment_json["RuntimeSource"], "environment")

            sidecar = temporary_path / "inspector-root.json"
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
            sidecar_result = powershell_resolve(
                f"$result=Resolve-InspectorRoot -SidecarPath '{quote_ps(windows_path(sidecar))}'; "
                "$result | ConvertTo-Json -Compress"
            )
            self.assertEqual(sidecar_result.returncode, 0, sidecar_result.stderr)
            sidecar_json = json.loads(sidecar_result.stdout.strip())
            self.assertEqual(sidecar_json["Source"], "sidecar")
            self.assertEqual(sidecar_json["RuntimeSource"], "sidecar")

    def test_cli_schema_and_document_contract(self) -> None:
        run([str(NODE), "scripts/check-source.mjs"])
        help_result = run([str(BASH), "check-proof.sh", "--help"])
        self.assertIn("check-proof.sh", help_result.stdout)
        safe_failure = run([str(BASH), "check-proof.sh"], check=False)
        self.assertEqual(safe_failure.returncode, 2)
        schema = json.loads((REPO / "contracts/inspector-result.schema.json").read_text(encoding="utf-8"))
        self.assertEqual(schema["properties"]["schemaVersion"]["const"], 4)
        self.assertEqual(schema["$defs"]["status"]["enum"], ["PASS", "REVIEW", "FAIL"])
        readme = (REPO / "README.md").read_text(encoding="utf-8")
        self.assertIn("not_run", readme)
        self.assertIn("docs/integration.md", readme)

    def test_forbidden_data_secret_and_external_boundaries(self) -> None:
        fixture = """
import { validateProductContent, validateRelativePath } from './scripts/verify-migration.mjs';
const cases = [
  () => validateRelativePath('reports/output.json', 1),
  () => validateRelativePath('fixture.ai', 1),
  () => validateRelativePath('large.bin', 1048577),
  () => validateProductContent('secret.txt', '-----BEGIN PRIVATE KEY-----'),
];
for (const item of cases) { let rejected=false; try { item(); } catch { rejected=true; } if (!rejected) process.exit(3); }
"""
        result = run([str(NODE), "--input-type=module", "-e", fixture])
        self.assertEqual(result.returncode, 0)
        self.assertEqual(run([str(GIT), "remote"]).stdout.splitlines(), ["origin"])
        tracked = run([str(GIT), "ls-files"]).stdout.splitlines()
        self.assertFalse(any(Path(item).suffix.lower() in {".ai", ".pdf", ".eps", ".jpg", ".jpeg", ".png"} for item in tracked))

    def test_root_failure_matrix_is_fail_closed(self) -> None:
        missing = powershell_resolve(
            "$env:CAMPUSLOOK_ILLUSTRATOR_INSPECTOR_ROOT=''; "
            "try { Resolve-InspectorRoot -SidecarPath 'Z:\\missing.json'; exit 0 } "
            "catch { [Console]::Error.WriteLine($_.Exception.Message); exit 7 }"
        )
        self.assertEqual(missing.returncode, 7)
        self.assertIn("inspector_root_invalid", missing.stderr)

        with tempfile.TemporaryDirectory(prefix="campuslook-invalid-root-") as temporary:
            temporary_path = Path(temporary)
            malformed = temporary_path / "bad.json"
            malformed.write_text("{bad", encoding="utf-8")
            malformed_result = powershell_resolve(
                f"try {{ Resolve-InspectorRoot -SidecarPath '{quote_ps(windows_path(malformed))}'; exit 0 }} "
                "catch { [Console]::Error.WriteLine($_.Exception.Message); exit 8 }"
            )
            self.assertEqual(malformed_result.returncode, 8)
            self.assertIn("inspector_root_invalid", malformed_result.stderr)

            incomplete_result = powershell_resolve(
                f"try {{ Resolve-InspectorRoot -ExplicitRoot '{quote_ps(windows_path(temporary_path))}'; exit 0 }} "
                "catch { [Console]::Error.WriteLine($_.Exception.Message); exit 9 }"
            )
            self.assertEqual(incomplete_result.returncode, 9)
            self.assertIn("inspector_root_invalid", incomplete_result.stderr)

        parent_result = powershell_resolve(
            f"try {{ Resolve-InspectorRoot -ExplicitRoot '{quote_ps(windows_path(LEGACY_SOURCE))}'; exit 0 }} "
            "catch { [Console]::Error.WriteLine($_.Exception.Message); exit 10 }"
        )
        self.assertEqual(parent_result.returncode, 10)
        self.assertIn("inspector_root_invalid", parent_result.stderr)

        launcher = (REPO / "illustrator/run-proof-check.ps1").read_text(encoding="utf-8")
        self.assertLess(launcher.index("Resolve-InspectorRoot"), launcher.index("New-Object Threading.Mutex"))

    def test_parent_and_legacy_source_prestate_unchanged(self) -> None:
        scope_evidence_path = REPO / "quality/evidence/material-palette-parent-prestate.json"
        if scope_evidence_path.is_file():
            evidence = json.loads(scope_evidence_path.read_text(encoding="utf-8"))
        else:
            evidence = json.loads((REPO / "quality/evidence/parent-prestate.json").read_text(encoding="utf-8"))
            poststate = json.loads((REPO / "quality/evidence/parent-poststate.json").read_text(encoding="utf-8"))
            self.assertEqual(poststate["parentHead"], evidence["parentHead"])
            self.assertEqual(poststate["parentPorcelainV2Sha256"], evidence["parentPorcelainV2Sha256"])
            self.assertEqual(poststate["sourceInventorySha256"], evidence["sourceInventorySha256"])
            self.assertEqual(poststate["parentWritesPerformed"], 0)
        self.assertEqual(evidence["parentWritesPerformed"], 0)
        # The separate operations repository may advance concurrently. Lock the 12 source
        # bytes owned by this migration instead of treating unrelated HEAD/status movement
        # as an inspector write.
        current_parent_head = run([str(GIT), "-C", str(PARENT), "rev-parse", "HEAD"]).stdout.strip()
        self.assertRegex(current_parent_head, r"^[0-9a-f]{40}$")
        manifest = json.loads((REPO / "migration/source-manifest.json").read_text(encoding="utf-8"))
        for entry in manifest["entries"]:
            source_bytes = (LEGACY_SOURCE / entry["path"]).read_bytes()
            self.assertEqual(sha256_bytes(source_bytes), entry["sourceSha256"])

    def test_clean_local_regression_contract(self) -> None:
        run([str(NODE), "scripts/check-source.mjs"])
        run([str(NODE), "--test", "tests/inspector-split-validation.test.mjs"])
        run([str(NODE), "scripts/verify-migration.mjs"])
        run([str(GIT), "diff", "--check", "09245e629800aff12fc64bae026dd96e4abc6dc1", "HEAD"])
        self.assertEqual(run([str(GIT), "remote"]).stdout.splitlines(), ["origin"])


if __name__ == "__main__":
    unittest.main()
