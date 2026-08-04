#target illustrator

var __campuslookProofInspectorArguments = typeof arguments === "undefined" ? [] : arguments;

(function (scriptArguments) {
    // DoJavaScriptFile을 반복 호출하면 Illustrator의 ExtendScript 힙에
    // 이전 문서의 임시 객체가 남을 수 있다. 다음 캡처 전에만 회수한다.
    try { if ($ && $.gc) $.gc(); } catch (gcError) { }

    function normalizeText(value) {
        return String(value || "")
            .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ")
            .replace(/\r\n?|\n/g, " / ")
            .replace(/\s+/g, " ")
            .replace(/^\s+|\s+$/g, "");
    }

    function escapeJsonString(value) {
        var text = String(value);
        var result = '"';
        var index;
        var code;
        var hex;
        for (index = 0; index < text.length; index += 1) {
            code = text.charCodeAt(index);
            if (code === 34) result += '\\"';
            else if (code === 92) result += '\\\\';
            else if (code === 8) result += '\\b';
            else if (code === 9) result += '\\t';
            else if (code === 10) result += '\\n';
            else if (code === 12) result += '\\f';
            else if (code === 13) result += '\\r';
            else if (code < 32) {
                hex = code.toString(16);
                while (hex.length < 4) hex = "0" + hex;
                result += "\\u" + hex;
            }
            else result += text.charAt(index);
        }
        return result + '"';
    }

    function stringify(value) {
        var valueType = typeof value;
        var parts;
        var index;
        var key;
        if (value === null || valueType === "undefined") return "null";
        if (valueType === "string") return escapeJsonString(value);
        if (valueType === "number") return isFinite(value) ? String(value) : "null";
        if (valueType === "boolean") return value ? "true" : "false";
        if (value instanceof Array) {
            parts = [];
            for (index = 0; index < value.length; index += 1) parts.push(stringify(value[index]));
            return "[" + parts.join(",") + "]";
        }
        parts = [];
        for (key in value) {
            if (value.hasOwnProperty(key)) parts.push(escapeJsonString(key) + ":" + stringify(value[key]));
        }
        return "{" + parts.join(",") + "}";
    }

    function writeUtf8(filePath, text) {
        var file = new File(filePath);
        file.encoding = "UTF-8";
        file.lineFeed = "Unix";
        if (!file.open("w")) throw new Error("결과 파일을 열 수 없습니다: " + filePath);
        file.write(text);
        file.close();
    }

    function artboardMatch(bounds, artboards) {
        var centerX = (bounds[0] + bounds[2]) / 2;
        var centerY = (bounds[1] + bounds[3]) / 2;
        var index;
        var rect;
        var intersectionWidth;
        var intersectionHeight;
        var intersectionArea;
        var bestArea = 0;
        var bestIndex = -1;
        for (index = 0; index < artboards.length; index += 1) {
            rect = artboards[index].rect;
            if (
                centerX >= rect[0] && centerX <= rect[2]
                && centerY <= rect[1] && centerY >= rect[3]
            ) {
                return {
                    index: index,
                    x: (centerX - rect[0]) / (rect[2] - rect[0]),
                    y: (rect[1] - centerY) / (rect[1] - rect[3])
                };
            }
            intersectionWidth = Math.max(0, Math.min(bounds[2], rect[2]) - Math.max(bounds[0], rect[0]));
            intersectionHeight = Math.max(0, Math.min(bounds[1], rect[1]) - Math.max(bounds[3], rect[3]));
            intersectionArea = intersectionWidth * intersectionHeight;
            if (intersectionArea > bestArea) {
                bestArea = intersectionArea;
                bestIndex = index;
            }
        }
        if (bestIndex >= 0) {
            rect = artboards[bestIndex].rect;
            return {
                index: bestIndex,
                x: (centerX - rect[0]) / (rect[2] - rect[0]),
                y: (rect[1] - centerY) / (rect[1] - rect[3])
            };
        }
        return { index: -1, x: null, y: null };
    }

    function scoreText(contents) {
        var score = 0;
        if (contents.indexOf("야구점퍼") >= 0) score += 8;
        if (contents.indexOf("하이미어") >= 0) score += 6;
        if (contents.indexOf("니플레자") >= 0) score += 4;
        if (contents.indexOf("쌍입술주머니") >= 0) score += 4;
        if (contents.indexOf("시안 제작") >= 0) score += 3;
        if (contents.indexOf("상담자") >= 0) score += 2;
        return score;
    }

    if (app.documents.length < 1) throw new Error("검사할 Illustrator 문서가 없습니다.");
    if (!scriptArguments || scriptArguments.length < 1) throw new Error("출력 폴더를 받지 못했습니다.");

    var outputDirectory = String(scriptArguments[0]).replace(/\\/g, "/");
    var displayName = scriptArguments.length > 1 && String(scriptArguments[1])
        ? String(scriptArguments[1])
        : app.activeDocument.name;
    var renderScale = scriptArguments.length > 2 ? Number(scriptArguments[2]) : 100;
    var maximumProofs = scriptArguments.length > 3 ? Number(scriptArguments[3]) : 6;
    var captureMode = scriptArguments.length > 4 ? String(scriptArguments[4]) : "analysis-crop";
    var outputFolder = new Folder(outputDirectory);
    if (!outputFolder.exists && !outputFolder.create()) throw new Error("출력 폴더를 만들 수 없습니다: " + outputDirectory);

    var document = app.activeDocument;
    var savedBefore = document.saved;
    var startedAt = new Date().getTime();
    var artboards = [];
    var artboardScores = [];
    var texts = [];
    var index;
    var item;
    var rect;
    var bounds;
    var match;
    var contents;
    var phaseStartedAt;
    var phaseTimings = {};

    phaseStartedAt = new Date().getTime();
    for (index = 0; index < document.artboards.length; index += 1) {
        item = document.artboards[index];
        rect = [Number(item.artboardRect[0]), Number(item.artboardRect[1]), Number(item.artboardRect[2]), Number(item.artboardRect[3])];
        artboards.push({
            index: index,
            name: String(item.name),
            rect: rect,
            width: rect[2] - rect[0],
            height: rect[1] - rect[3],
            render: null,
            renderBounds: null
        });
        artboardScores.push({ index: index, score: 0, textCount: 0 });
    }
    phaseTimings.artboardsMilliseconds = new Date().getTime() - phaseStartedAt;

    phaseStartedAt = new Date().getTime();
    for (index = 0; index < document.textFrames.length; index += 1) {
        try {
            item = document.textFrames[index];
            bounds = [
                Number(item.geometricBounds[0]),
                Number(item.geometricBounds[1]),
                Number(item.geometricBounds[2]),
                Number(item.geometricBounds[3])
            ];
            match = artboardMatch(bounds, artboards);
            contents = normalizeText(item.contents);
            texts.push({
                index: index,
                name: String(item.name || ""),
                contents: contents,
                bounds: bounds,
                artboardIndex: match.index,
                normalized: { x: match.x, y: match.y }
            });
            if (match.index >= 0) {
                artboardScores[match.index].textCount += 1;
                artboardScores[match.index].score += scoreText(contents);
            }
        }
        catch (textError) {
            texts.push({ index: index, error: String(textError) });
        }
    }
    phaseTimings.textFramesMilliseconds = new Date().getTime() - phaseStartedAt;

    phaseStartedAt = new Date().getTime();
    var candidatesByScore = [];
    for (index = 0; index < artboardScores.length; index += 1) {
        if (artboardScores[index].score >= 8) candidatesByScore.push(artboardScores[index]);
    }
    candidatesByScore.sort(function (left, right) {
        if (right.score !== left.score) return right.score - left.score;
        if (right.textCount !== left.textCount) return right.textCount - left.textCount;
        return left.index - right.index;
    });
    var detectedProofs = candidatesByScore.length;
    if (candidatesByScore.length > maximumProofs) candidatesByScore.length = maximumProofs;
    candidatesByScore.sort(function (left, right) { return left.index - right.index; });
    if (candidatesByScore.length < 1) throw new Error("사양표가 있는 야구점퍼 시안 대지를 찾지 못했습니다.");

    // Illustrator에는 내용 기반 TextFrame 검색 API가 없으므로 전체 컬렉션은
    // 한 번 순회해야 한다. 다만 Node 분석기로 넘기는 데이터는 선택된 대지의
    // 사양표 주변 텍스트로만 줄인다. 표 위치는 고정 y좌표가 아니라 실제 값
    // 텍스트(야구점퍼/하이미어/퀄팅/니플레자/2by2/주머니)의 범위로 찾는다.
    var candidateLookup = {};
    var tableRanges = {};
    var candidateIndex;
    var textItem;
    for (index = 0; index < candidatesByScore.length; index += 1) {
        candidateIndex = candidatesByScore[index].index;
        candidateLookup[candidateIndex] = true;
        tableRanges[candidateIndex] = { minimumY: 2, maximumY: -1, anchors: 0 };
    }
    for (index = 0; index < texts.length; index += 1) {
        textItem = texts[index];
        if (!candidateLookup[textItem.artboardIndex] || !textItem.normalized) continue;
        if (!/야구점퍼|하이미어|퀄팅|니플레자|레자|2\s*by\s*2|주머니/.test(textItem.contents)) continue;
        item = tableRanges[textItem.artboardIndex];
        item.minimumY = Math.min(item.minimumY, Number(textItem.normalized.y));
        item.maximumY = Math.max(item.maximumY, Number(textItem.normalized.y));
        item.anchors += 1;
    }
    var compactTexts = [];
    var minimumY;
    var maximumY;
    for (index = 0; index < texts.length; index += 1) {
        textItem = texts[index];
        if (!candidateLookup[textItem.artboardIndex] || !textItem.normalized) continue;
        item = tableRanges[textItem.artboardIndex];
        minimumY = item.anchors > 0 ? item.minimumY - 0.025 : 0.35;
        maximumY = item.anchors > 0 ? item.maximumY + 0.025 : 0.75;
        if (
            Number(textItem.normalized.x) < 0.03 || Number(textItem.normalized.x) > 0.56
            || Number(textItem.normalized.y) < minimumY || Number(textItem.normalized.y) > maximumY
        ) continue;
        compactTexts.push({
            contents: textItem.contents,
            artboardIndex: textItem.artboardIndex,
            normalized: textItem.normalized
        });
    }
    phaseTimings.tableSelectionMilliseconds = new Date().getTime() - phaseStartedAt;

    var captureOptions = new ImageCaptureOptions();
    captureOptions.antiAliasing = captureMode === "full-artboard";
    captureOptions.resolution = 72 * renderScale / 100;
    captureOptions.transparency = false;
    captureOptions.matte = true;
    var matteColor = new RGBColor();
    matteColor.red = 255;
    matteColor.green = 255;
    matteColor.blue = 255;
    captureOptions.matteColor = matteColor;
    var renderBounds;
    var captureRect;
    var renderFile;
    phaseStartedAt = new Date().getTime();
    for (index = 0; index < candidatesByScore.length; index += 1) {
        item = candidatesByScore[index];
        rect = artboards[item.index].rect;
        renderBounds = captureMode === "full-artboard"
            ? { left: 0, top: 0, right: 1, bottom: 1 }
            : { left: 0.04, top: 0.15, right: 0.50, bottom: 0.42 };
        captureRect = [
            rect[0] + artboards[item.index].width * renderBounds.left,
            rect[1] - artboards[item.index].height * renderBounds.top,
            rect[0] + artboards[item.index].width * renderBounds.right,
            rect[1] - artboards[item.index].height * renderBounds.bottom
        ];
        artboards[item.index].render = "artboard-" + item.index + ".png";
        artboards[item.index].renderBounds = renderBounds;
        renderFile = new File(outputDirectory + "/artboard-" + item.index + ".png");
        if (renderFile.exists && !renderFile.remove()) {
            throw new Error("이전 캡처 파일을 교체할 수 없습니다: " + renderFile.fsName);
        }
        document.imageCapture(
            renderFile,
            captureRect,
            captureOptions
        );
    }
    phaseTimings.captureMilliseconds = new Date().getTime() - phaseStartedAt;
    // Illustrator는 이미지 캡처만 해도 문서를 수정됨으로 표시할 수 있다.
    // 검사 전에 이미 미저장 상태였던 문서는 건드리지 않고, 깨끗했던
    // 문서에 한해 검사가 만든 표시만 복원한다.
    if (savedBefore && !document.saved) document.saved = true;

    var sourcePath = "";
    try { sourcePath = String(document.fullName); } catch (pathError) { sourcePath = ""; }
    var inspection = {
        schemaVersion: 2,
        inspectionMode: "fast-active-jsx",
        sourcePath: sourcePath,
        document: {
            name: displayName,
            artboards: document.artboards.length,
            textFrames: document.textFrames.length,
            savedBefore: savedBefore,
            savedAfter: document.saved
        },
        artboards: artboards,
        candidateArtboards: candidatesByScore,
        texts: compactTexts,
        performance: {
            elapsedMilliseconds: new Date().getTime() - startedAt,
            renderScale: renderScale,
            captureMode: captureMode,
            renderedArtboards: candidatesByScore.length,
            maximumProofs: maximumProofs,
            detectedProofs: detectedProofs,
            truncated: detectedProofs > maximumProofs,
            inspectedTextFrames: document.textFrames.length,
            serializedTextFrames: compactTexts.length,
            phases: phaseTimings
        }
    };
    writeUtf8(outputDirectory + "/document.json", stringify(inspection) + "\n");
    stringify({
        ok: true,
        document: displayName,
        candidates: candidatesByScore.length,
        elapsedMilliseconds: inspection.performance.elapsedMilliseconds,
        output: outputDirectory + "/document.json"
    });
}(__campuslookProofInspectorArguments));
