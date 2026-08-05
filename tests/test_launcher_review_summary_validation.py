"""Null-safe launcher summary regression for normal REVIEW reports."""

from __future__ import annotations

import base64
import json
import subprocess
import unittest

from tests.test_inspector_split_validation import POWERSHELL, REPO, quote_ps, run, windows_path


APPROVED_BASE = "1b04a0a8a41cb2fe52c198d7058cecd055c55ff2"


def catalog_display(material_check: object) -> subprocess.CompletedProcess[str]:
    """Execute the exact production formatter function in Windows PowerShell."""
    launcher = quote_ps(windows_path(REPO / "illustrator/run-proof-check.ps1"))
    payload = base64.b64encode(
        json.dumps(material_check, ensure_ascii=False).encode("utf-8")
    ).decode("ascii")
    script = "; ".join(
        (
            "[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)",
            "$tokens=$null",
            "$parseErrors=$null",
            f"$source=[IO.File]::ReadAllText('{launcher}',[Text.UTF8Encoding]::new($false))",
            "$ast=[Management.Automation.Language.Parser]::ParseInput("
            "$source,[ref]$tokens,[ref]$parseErrors)",
            "if($parseErrors.Count -ne 0){throw 'launcher_parse_failed'}",
            "$functionAst=$ast.Find({param($node) "
            "$node -is [Management.Automation.Language.FunctionDefinitionAst] "
            "-and $node.Name -eq 'Get-MaterialCatalogDisplay'},$true)",
            "if($null -eq $functionAst){throw 'catalog_display_function_missing'}",
            "Invoke-Expression $functionAst.Extent.Text",
            "Set-StrictMode -Version Latest",
            f"$json=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('{payload}'))",
            "$materialCheck=$json | ConvertFrom-Json",
            "$result=Get-MaterialCatalogDisplay -MaterialCheck $materialCheck",
            "[Console]::Out.Write([string]$result)",
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


class LauncherReviewSummaryValidation(unittest.TestCase):
    """Lock the REVIEW null path and all approved non-change boundaries."""

    def test_null_catalog_review_is_rendered_as_unresolved(self) -> None:
        """A normal ambiguous REVIEW renders its reason instead of throwing."""
        result = catalog_display(
            {
                "status": "REVIEW",
                "decisionCode": "cross_generation_ambiguous",
                "matchedCatalog": None,
            }
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "미확정 (cross_generation_ambiguous)")

    def test_non_null_catalog_preserves_role(self) -> None:
        """A resolved catalog keeps its existing role text."""
        result = catalog_display(
            {
                "status": "PASS",
                "decisionCode": "single_catalog_match",
                "matchedCatalog": {"role": "current-body"},
            }
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "current-body")

    def test_missing_material_check_falls_back_without_error(self) -> None:
        """Missing decision metadata remains a readable non-error state."""
        missing = catalog_display({})
        null_value = catalog_display(None)
        self.assertEqual(missing.returncode, 0, missing.stderr)
        self.assertEqual(missing.stdout, "미확정")
        self.assertEqual(null_value.returncode, 0, null_value.stderr)
        self.assertEqual(null_value.stdout, "미확정")

    def test_launcher_message_uses_production_null_safe_projection(self) -> None:
        """The single-design message calls the formatter and avoids raw role access."""
        launcher = (REPO / "illustrator/run-proof-check.ps1").read_text(encoding="utf-8")
        self.assertIn(
            "$bodyCatalogText = Get-MaterialCatalogDisplay -MaterialCheck $report.materialCheck",
            launcher,
        )
        self.assertIn("몸통 catalog: $bodyCatalogText", launcher)
        self.assertNotIn("$report.materialCheck.matchedCatalog.role", launcher)

    def test_catalog_and_schema_contract_remain_unchanged(self) -> None:
        """Later report projection still leaves the catalog evaluator unchanged."""
        result = run(
            [
                "/usr/bin/git",
                "diff",
                "--exit-code",
                APPROVED_BASE,
                "--",
                "material-catalog.mjs",
            ],
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        schema = json.loads(
            (REPO / "contracts/inspector-result.schema.json").read_text(encoding="utf-8")
        )
        self.assertEqual(schema["properties"]["schemaVersion"]["const"], 4)


if __name__ == "__main__":
    unittest.main()
