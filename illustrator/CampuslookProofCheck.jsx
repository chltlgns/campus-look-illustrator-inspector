#target illustrator

(function () {
    var TITLE = "캠퍼스룩 야구점퍼 시안 검사";

    function quoteWindows(value) {
        return '"' + String(value).replace(/"/g, '""') + '"';
    }

    if (app.documents.length < 1) {
        alert("검사할 Illustrator 문서를 먼저 열어주세요.", TITLE);
        return;
    }

    var document = app.activeDocument;
    var sourceFile = null;
    try {
        sourceFile = document.fullName;
    }
    catch (error) {
        sourceFile = null;
    }

    if (!sourceFile || !sourceFile.exists) {
        alert("문서를 AI 파일로 먼저 저장한 다음 검사해주세요.", TITLE);
        return;
    }

    var localAppData = $.getenv("LOCALAPPDATA");
    if (!localAppData) {
        alert("Windows LOCALAPPDATA 경로를 확인하지 못했습니다.", TITLE);
        return;
    }

    var launcher = new File(localAppData + "/Campuslook/IllustratorProofCheck/run-proof-check.ps1");
    if (!launcher.exists) {
        alert("검사 실행기가 설치되지 않았습니다.\n\n" + launcher.fsName, TITLE);
        return;
    }

    var inputFile = new File(
        Folder.temp.fsName + "/campuslook-proof-check-" + String(new Date().getTime()) + ".txt"
    );
    inputFile.encoding = "UTF-8";
    inputFile.lineFeed = "Windows";
    if (!inputFile.open("w")) {
        alert("임시 파일을 만들지 못해 검사를 시작할 수 없습니다.", TITLE);
        return;
    }
    inputFile.write(sourceFile.fsName);
    inputFile.close();

    var command = [
        "cmd.exe /d /s /c start \"\"",
        "powershell.exe",
        "-NoLogo",
        "-NoProfile",
        "-STA",
        "-NonInteractive",
        "-WindowStyle Hidden",
        "-ExecutionPolicy Bypass",
        "-File " + quoteWindows(launcher.fsName),
        "-InputFile " + quoteWindows(inputFile.fsName),
        "-UseActiveDocument"
    ].join(" ");

    try {
        system.callSystem(command);
    }
    catch (launchError) {
        try {
            inputFile.remove();
        }
        catch (removeError) {
            // 임시 파일은 Windows가 나중에 정리할 수 있습니다.
        }
        alert("검사 실행기를 시작하지 못했습니다.\n\n" + launchError, TITLE);
    }
}());
