"""Production regressions for bottom-table authoritative material decisions."""

from __future__ import annotations

import base64
import json
import subprocess
import unittest

from tests.test_inspector_split_validation import (
    NODE,
    POWERSHELL,
    REPO,
    quote_ps,
    run,
    windows_path,
)


APPROVED_BASE = "4052cb9f0d51f5493bc8ca04fa54a31c56b86292"


def fixture(name: str) -> dict[str, object]:
    """Run a synthetic proof through the production analyzer."""
    result = run(
        [str(NODE), "tests/material-catalog-cases.mjs", name],
        check=False,
        cwd=REPO,
    )
    if result.returncode != 0:
        raise AssertionError(result.stdout + result.stderr)
    return json.loads(result.stdout)


def launcher_function(
    function_name: str,
    parameter_name: str,
    payload: object,
) -> subprocess.CompletedProcess[str]:
    """Execute one exact production launcher function in PowerShell 5.1."""
    launcher = quote_ps(windows_path(REPO / "illustrator/run-proof-check.ps1"))
    encoded_payload = base64.b64encode(
        json.dumps(payload, ensure_ascii=False).encode("utf-8")
    ).decode("ascii")
    script = "; ".join(
        (
            "[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)",
            "$tokens=$null",
            "$parseErrors=$null",
            f"$source=[IO.File]::ReadAllText('{launcher}',"
            "[Text.UTF8Encoding]::new($false))",
            "$ast=[Management.Automation.Language.Parser]::ParseInput("
            "$source,[ref]$tokens,[ref]$parseErrors)",
            "if($parseErrors.Count -ne 0){throw 'launcher_parse_failed'}",
            "$functionAst=$ast.Find({param($node) "
            "$node -is [Management.Automation.Language.FunctionDefinitionAst] "
            f"-and $node.Name -eq '{function_name}'"
            "},$true)",
            "if($null -eq $functionAst){throw 'launcher_function_missing'}",
            "Invoke-Expression $functionAst.Extent.Text",
            "Set-StrictMode -Version Latest",
            "$json=[Text.Encoding]::UTF8.GetString("
            f"[Convert]::FromBase64String('{encoded_payload}'))",
            "$payload=$json | ConvertFrom-Json",
            f"$result={function_name} -{parameter_name} $payload",
            "[Console]::Out.Write([string]$result)",
        )
    )
    encoded_script = base64.b64encode(script.encode("utf-16le")).decode("ascii")
    return run(
        [
            str(POWERSHELL),
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-EncodedCommand",
            encoded_script,
        ],
        check=False,
    )


class TableAuthoritativeValidation(unittest.TestCase):
    """Lock table completeness as the decision and color as advisory evidence."""

    def test_complete_table_cross_generation_is_pass_with_visual_review(self) -> None:
        """A complete #04-like table wins over generation/color ambiguity."""
        result = fixture("analyzer-cross-generation")
        report = result["report"]
        material = report["materialCheck"]
        visual = material["visualComparison"]
        self.assertEqual(report["overallStatus"], "PASS")
        self.assertEqual(report["tableCheck"]["status"], "PASS")
        self.assertEqual(material["status"], "PASS")
        self.assertEqual(material["decisionCode"], "table_spec_authoritative")
        self.assertEqual(material["authority"]["source"], "bottom_specification_table")
        self.assertEqual(visual["status"], "REVIEW")
        self.assertEqual(visual["decisionCode"], "cross_generation_ambiguous")
        self.assertFalse(visual["affectsOverallStatus"])
        self.assertEqual(material["candidates"], visual["candidates"])
        self.assertEqual(material["nearest"], visual["nearest"])

    def test_missing_product_and_pocket_remains_review(self) -> None:
        """A #15-like blank product and pocket stays an ordered REVIEW."""
        report = fixture("analyzer-missing-product-pocket")["report"]
        self.assertEqual(report["overallStatus"], "REVIEW")
        self.assertEqual(report["tableCheck"]["status"], "REVIEW")
        self.assertEqual(report["tableCheck"]["missing"], ["product", "pocket"])
        self.assertEqual(report["fields"]["product"], "")
        self.assertEqual(report["fields"]["pocket"], "")
        self.assertEqual(report["materialCheck"]["status"], "PASS")
        self.assertEqual(report["sleeveCheck"]["status"], "PASS")

    def test_complete_table_sleeve_mismatch_is_pass_with_visual_fail(self) -> None:
        """A complete sleeve table value wins while the color FAIL is retained."""
        report = fixture("analyzer-sleeve-mismatch")["report"]
        sleeve = report["sleeveCheck"]
        self.assertEqual(report["overallStatus"], "PASS")
        self.assertEqual(sleeve["status"], "PASS")
        self.assertEqual(sleeve["decisionCode"], "table_spec_authoritative")
        self.assertEqual(sleeve["visualComparison"]["status"], "FAIL")
        self.assertEqual(
            sleeve["visualComparison"]["decisionCode"],
            "sleeve_other_reference_match",
        )

    def test_missing_shell_or_sleeve_is_review(self) -> None:
        """Missing authoritative material cells cannot become PASS."""
        shell_report = fixture("analyzer-missing-shell")["report"]
        sleeve_report = fixture("analyzer-missing-sleeve")["report"]
        self.assertEqual(shell_report["overallStatus"], "REVIEW")
        self.assertEqual(shell_report["tableCheck"]["missing"], ["shell", "rib"])
        self.assertEqual(shell_report["materialCheck"]["status"], "REVIEW")
        self.assertEqual(
            shell_report["materialCheck"]["decisionCode"], "table_field_missing"
        )
        self.assertEqual(sleeve_report["overallStatus"], "REVIEW")
        self.assertEqual(sleeve_report["tableCheck"]["missing"], ["sleeve", "pocket"])
        self.assertEqual(sleeve_report["sleeveCheck"]["status"], "REVIEW")
        self.assertEqual(
            sleeve_report["sleeveCheck"]["decisionCode"], "table_field_missing"
        )

    def test_markdown_and_launcher_explain_table_authority(self) -> None:
        """Human summaries lead with missing table cells and label color advisory."""
        result = fixture("analyzer-cross-generation")
        markdown = result["markdown"]
        self.assertIn("최종 기준: **하단 사양표**", markdown)
        self.assertIn("색상 비교 — 판정 미반영 참고", markdown)
        self.assertIn("몸통 색상 비교(참고): **REVIEW**", markdown)

        missing = launcher_function(
            "Get-TableMissingDisplay",
            "TableCheck",
            {"status": "REVIEW", "missing": ["product", "pocket"]},
        )
        visual = launcher_function(
            "Get-VisualComparisonDisplay",
            "Check",
            {
                "status": "PASS",
                "visualComparison": {
                    "status": "REVIEW",
                    "decisionCode": "cross_generation_ambiguous",
                },
            },
        )
        self.assertEqual(missing.returncode, 0, missing.stderr)
        self.assertEqual(missing.stdout, "제품명, 주머니")
        self.assertEqual(visual.returncode, 0, visual.stderr)
        self.assertEqual(visual.stdout, "REVIEW (cross_generation_ambiguous)")
        launcher = (REPO / "illustrator/run-proof-check.ps1").read_text(encoding="utf-8")
        self.assertIn("원단 판정 기준: 하단 사양표", launcher)
        self.assertIn("사양표 누락: $tableMissingText", launcher)
        self.assertIn("색상 비교(판정 미반영 참고)", launcher)

    def test_schema_cli_and_multi_design_contract(self) -> None:
        """Schema 4, root fields, multi design, and CLI success remain stable."""
        result = fixture("analyzer-multi")
        report = result["report"]
        self.assertEqual(report["schemaVersion"], 4)
        self.assertEqual(report["designCount"], 2)
        self.assertEqual(report["overallStatus"], "PASS")
        self.assertEqual(len(report["designs"]), 2)
        self.assertTrue(all(item["overallStatus"] == "PASS" for item in report["designs"]))
        self.assertEqual(result["cli"]["overallStatus"], "PASS")
        self.assertEqual(result["cli"]["designCount"], 2)
        for field in (
            "document",
            "designCount",
            "overallStatus",
            "designs",
            "performance",
            "limitations",
        ):
            self.assertIn(field, report)

        schema = json.loads(
            (REPO / "contracts/inspector-result.schema.json").read_text(encoding="utf-8")
        )
        self.assertEqual(schema["properties"]["schemaVersion"]["const"], 4)
        check = schema["$defs"]["check"]["properties"]
        self.assertEqual(check["authority"]["$ref"], "#/$defs/authority")
        self.assertEqual(
            check["visualComparison"]["$ref"], "#/$defs/visualComparison"
        )

    def test_catalog_evaluator_and_source_boundaries_remain_unchanged(self) -> None:
        """The catalog evaluator and excluded HTML builders remain byte-unchanged."""
        result = run(
            [
                "/usr/bin/git",
                "diff",
                "--exit-code",
                APPROVED_BASE,
                "--",
                "material-catalog.mjs",
                "build-live-test-report.mjs",
                "build-live-test-html.mjs",
            ],
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
