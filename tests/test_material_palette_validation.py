"""Ten locked selectors for generation-aware body and sleeve catalog validation."""

from __future__ import annotations

import json
from pathlib import Path
import subprocess
import unittest


REPO = Path(__file__).resolve().parents[1]
NODE = "/usr/local/bin/node"


def run_case(name: str) -> dict:
    result = subprocess.run(
        [NODE, "tests/material-catalog-cases.mjs", name],
        cwd=REPO,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
        timeout=60,
    )
    if result.returncode != 0:
        raise AssertionError(f"case {name} failed\nstdout={result.stdout}\nstderr={result.stderr}")
    return json.loads(result.stdout)


class MaterialPaletteValidation(unittest.TestCase):
    def test_current_body_match_reports_current_catalog(self) -> None:
        decision = run_case("current")
        self.assertEqual(decision["status"], "PASS")
        self.assertEqual(decision["matchedCatalog"]["role"], "current-body")
        self.assertTrue(any(item["role"] == "legacy-body" for item in decision["candidates"]))

    def test_legacy_body_match_is_not_failed_by_current_palette(self) -> None:
        result = run_case("legacy")
        self.assertEqual(result["decision"]["status"], "PASS")
        self.assertEqual(result["decision"]["matchedCatalog"]["role"], "legacy-body")
        self.assertEqual(result["catalog"]["entries"][0]["candidates"][0]["explicitHex"], "#1414B4")

    def test_explicit_generation_mismatch_fails(self) -> None:
        decision = run_case("explicit-mismatch")
        self.assertEqual(decision["status"], "FAIL")
        self.assertEqual(decision["decisionCode"], "generation_mismatch")

    def test_exact_supplier_finish_sleeve_match(self) -> None:
        result = run_case("sleeve-exact")
        self.assertEqual(result["specification"]["supplier"], "동인")
        self.assertEqual(result["specification"]["finish"], "민무늬")
        self.assertEqual(result["specification"]["number"], 34)
        self.assertEqual(result["decision"]["status"], "PASS")
        self.assertIn("실제 봉제품", result["decision"]["limitation"])

    def test_generic_nippleather_black_white_remains_compatible(self) -> None:
        result = run_case("sleeve-generic")
        self.assertEqual(result["white"]["status"], "PASS")
        self.assertEqual(result["black"]["status"], "PASS")
        self.assertEqual(result["white"]["matchedCatalog"]["family"], "니플레자")

    def test_cross_generation_close_match_is_review(self) -> None:
        decision = run_case("cross-generation")
        self.assertEqual(decision["status"], "REVIEW")
        self.assertEqual(decision["decisionCode"], "cross_generation_ambiguous")

    def test_duplicate_legacy_reference_is_review(self) -> None:
        decision = run_case("duplicate-legacy")
        self.assertEqual(decision["status"], "REVIEW")
        self.assertEqual(decision["decisionCode"], "body_reference_ambiguous")
        legacy = [item for item in decision["candidates"] if item["role"] == "legacy-body"]
        self.assertEqual(len(legacy), 2)
        self.assertNotEqual(legacy[0]["hex"], legacy[1]["hex"])

    def test_unregistered_or_conflicting_sleeve_is_not_pass(self) -> None:
        result = run_case("sleeve-unregistered")
        self.assertNotEqual(result["missing"]["status"], "PASS")
        self.assertEqual(result["conflicting"]["status"], "FAIL")
        self.assertEqual(result["conflicting"]["decisionCode"], "sleeve_other_reference_match")

    def test_catalog_cache_role_hash_retry_and_source_boundaries(self) -> None:
        result = run_case("registry")
        self.assertEqual(result["coverage"], "full")
        self.assertEqual(result["roles"], ["current-body", "legacy-body", "sleeve-material"])
        self.assertTrue(result["warmReadStable"])
        self.assertTrue(result["missingRejected"])
        self.assertTrue(result["driftRejected"])

        launcher = (REPO / "illustrator/run-proof-check.ps1").read_text(encoding="utf-8")
        collector = (REPO / "inspect-illustrator.ps1").read_text(encoding="utf-8")
        self.assertIn("cache/material-catalog/$Role/$paletteHash", launcher)
        self.assertIn("for ($attempt = 1; $attempt -le 2", launcher)
        self.assertIn("LastWriteTimeUtc -gt", launcher)
        self.assertIn("fullArtworkBounds", collector)
        self.assertIn("filled = [bool]$pathItem.Filled", collector)

        tracked = subprocess.run(
            ["git", "ls-files"], cwd=REPO, text=True, stdout=subprocess.PIPE, check=True
        ).stdout.splitlines()
        self.assertFalse(any(Path(item).suffix.lower() in {".ai", ".png", ".pdf", ".eps", ".jpg"} for item in tracked))

    def test_schema_cli_and_prior_locked_regression_contract(self) -> None:
        analyzer = run_case("analyzer")
        self.assertEqual(analyzer["schemaVersion"], 4)
        self.assertEqual(analyzer["overallStatus"], "PASS")
        self.assertTrue(analyzer["coreFields"])
        self.assertEqual(analyzer["coverage"], "full")
        self.assertEqual(analyzer["bodyRole"], "current-body")
        self.assertEqual(analyzer["sleeveCode"], "sleeve_exact_key_match")
        self.assertTrue(analyzer["cli"]["ok"])

        schema = json.loads((REPO / "contracts/inspector-result.schema.json").read_text(encoding="utf-8"))
        self.assertEqual(schema["properties"]["schemaVersion"]["const"], 4)
        for field in ("document", "designCount", "overallStatus", "designs", "performance", "limitations"):
            self.assertIn(field, schema["required"])
        self.assertEqual(schema["$defs"]["status"]["enum"], ["PASS", "REVIEW", "FAIL"])
        self.assertIn("catalogProvenance", schema["required"])

        help_result = subprocess.run(
            ["bash", "check-proof.sh", "--help"], cwd=REPO, text=True,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False
        )
        missing_result = subprocess.run(
            ["bash", "check-proof.sh"], cwd=REPO, text=True,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False
        )
        self.assertEqual(help_result.returncode, 0)
        self.assertEqual(missing_result.returncode, 2)

        for profile in (
            "quality/orbit-validation-inspector-split-v01.json",
            "quality/orbit-validation-windows-cutover-v01.json",
            "quality/orbit-validation-windows-cutover-recovery-v02.json",
            "quality/orbit-validation-windows-drive-path-recovery-v03.json",
        ):
            self.assertTrue((REPO / profile).is_file())


if __name__ == "__main__":
    unittest.main()
