#target indesign

/*
    CALPRO V10 - HIGHEND MONATSKALENDER
    InDesign ExtendScript / JSX

    NEU IN V10:
    - Voll formatgesteuert: das komplette Kalendarium haengt an ZELLENFORMATEN
      (Gruppe "CALPRO": Kalender Kopf/Tag/Wochenende/Feiertag/Leer/KW).
      Designer aendert die Optik einmal im Zellenformat -> alle 12 Monate folgen.
    - Design-Rahmen (Kopf, Overlay-Panel, Bildrahmen, Balken, Akzentlinie)
      haengen an OBJEKTFORMATEN -> ebenfalls einmal zentral aenderbar.
    - Musterseite "B-CalPro": konsistente Raender + 7-Spalten-Hilfslinienraster
      auf allen Monatsseiten, einmal auf der Musterseite editierbar.
    - Vorgaben (Presets) speichern/laden: Format, Layout, Thema, Bundesland,
      Wochenstart und Optionen als .calpro-Datei fuer wiederkehrende Auftraege.

    AUS V9:
    - Bildaufloesungs-Pruefung (effectivePpi, Warnung <200 ppi)
    - Wochenstart Montag ODER Sonntag
    - 6 Farbthemen (Wochenende/Feiertag/Akzent koordiniert)

    AUS V8:
    - 4 Layouts: Klassik / Split / Vollbild-Overlay / Galerie
    - Feiertage fuer alle 16 Bundeslaender (Dropdown)
    - Optionale ISO-Kalenderwochen-Spalte
    - Feiertagsname sitzt IN der Tageszelle (Tag + Tab + Name),
      dadurch immer korrekt positioniert
    - Tabellenzeilen mit fixer Hoehe (autoGrow aus) -> kein Verrutschen
    - Absatz- und Zeichenformate in der Gruppe "CALPRO",
      bestehende Formate werden NIE ueberschrieben -> eigene Anpassungen bleiben
    - Windows-kompatible Dateidialoge
    - Proportionale Geometrie: funktioniert fuer beliebige Seitenformate

    WEITERHIN:
    - echter Monatskalender, alle Monate gleiches 6-Wochen-Raster
    - Wochenenden hellblau, Feiertage hellgruen
    - optional Deckblatt + Rueckseite mit 12 Miniaturen
    - Titelbild ist ein eigener, frei waehlbarer Slot (13. Bild).
      Ohne eigenes Titelbild uebernimmt das Deckblatt das Januar-Bild.
    - Bildpool + spaeterer Bildtausch (Bildrahmen anklicken, Script starten)
*/

(function () {
    var APP_NAME = "kalenderSNX – Highend Monatskalender";
    var VERSION = "10.1";
    var WARN_PPI = 200;   // effektive Bildaufloesung: darunter Warnung
    var MONTH_COUNT = 12;
    var SLOT_COUNT = MONTH_COUNT + 1;   // Slot 0 = Titelbild, 1..12 = Monate
    var COVER_SLOT = 0;
    // Dateinamen-Erkennung fuer das Titelbild (Wortgrenzen, damit z. B.
    // "Winterfront.jpg" nicht faelschlich als Titel durchgeht).
    var COVER_NAME_RE = /(^|[^a-z0-9])(titel|title|cover|deckblatt)([^a-z0-9]|$)/i;
    var PATH_SEP = "\u001E";
    var BLEED = 3;

    var LABEL_VERSION = "CALPRO_VERSION";
    var LABEL_YEAR = "CALPRO_YEAR";
    var LABEL_WIDTH = "CALPRO_WIDTH";
    var LABEL_HEIGHT = "CALPRO_HEIGHT";
    var LABEL_POOL = "CALPRO_POOL";
    var LABEL_ASSIGNED = "CALPRO_ASSIGNED";
    var LABEL_COVER = "CALPRO_COVER";
    var LABEL_ROLE = "CALPRO_ROLE";
    var LABEL_MONTH_INDEX = "CALPRO_MONTH_INDEX";
    var LABEL_IMAGE_PATH = "CALPRO_IMAGE_PATH";
    var LABEL_POOL_NOTE = "CALPRO_POOL_NOTE";
    var LABEL_LAYOUT = "CALPRO_LAYOUT";
    var LABEL_THEME = "CALPRO_THEME";

    var ROLE_MONTH_IMAGE = "MONTH_IMAGE";
    var ROLE_COVER_IMAGE = "COVER_IMAGE";
    var ROLE_BACK_THUMB = "BACK_THUMB";

    var STYLE_GROUP = "CALPRO";

    var placeErrors = [];      // Bilder, die InDesign nicht lesen/platzieren konnte
    var placeErrorSeen = {};

    var monthNamesUi = [
        "Januar", "Februar", "März", "April", "Mai", "Juni",
        "Juli", "August", "September", "Oktober", "November", "Dezember"
    ];

    var monthNamesPrint = [
        "JANUAR", "FEBRUAR", "MÄRZ", "APRIL", "MAI", "JUNI",
        "JULI", "AUGUST", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DEZEMBER"
    ];

    var weekdays = ["MO", "DI", "MI", "DO", "FR", "SA", "SO"];

    var LAYOUTS = [
        { key: "classic", label: "Klassik – Bild oben, Kalendarium unten" },
        { key: "split", label: "Split – Bild links, Kalendarium rechts" },
        { key: "overlay", label: "Vollbild – Bild ganzseitig, Kalendarium als Panel" },
        { key: "gallery", label: "Galerie – Bild gerahmt, viel Weißraum" }
    ];

    var STATES = [
        { code: "DE", name: "Nur bundesweite Feiertage" },
        { code: "BW", name: "Baden-Württemberg" },
        { code: "BY", name: "Bayern" },
        { code: "BE", name: "Berlin" },
        { code: "BB", name: "Brandenburg" },
        { code: "HB", name: "Bremen" },
        { code: "HH", name: "Hamburg" },
        { code: "HE", name: "Hessen" },
        { code: "MV", name: "Mecklenburg-Vorpommern" },
        { code: "NI", name: "Niedersachsen" },
        { code: "NW", name: "Nordrhein-Westfalen" },
        { code: "RP", name: "Rheinland-Pfalz" },
        { code: "SL", name: "Saarland" },
        { code: "SN", name: "Sachsen" },
        { code: "ST", name: "Sachsen-Anhalt" },
        { code: "SH", name: "Schleswig-Holstein" },
        { code: "TH", name: "Thüringen" }
    ];

    /*
        Farbthemen: koordinierte CMYK-Werte fuer Wochenende, Feiertag,
        Feiertagstext und Akzent (Kopf-Rahmen + Trennlinien + Bildrahmen).
        Theme 0 "Klassik" = neutraler grauer Akzent -> Optik wie zuvor.
    */
    var THEMES = [
        { label: "Klassik (Blau/Grün)", weekend: [9, 3, 0, 0],  holiday: [8, 0, 15, 0],  holidayText: [58, 10, 82, 42], accent: [0, 0, 0, 35] },
        { label: "Salbei",              weekend: [12, 0, 14, 2], holiday: [20, 0, 24, 0], holidayText: [60, 15, 70, 25], accent: [42, 12, 46, 10] },
        { label: "Terracotta",          weekend: [0, 10, 12, 2], holiday: [0, 18, 22, 0], holidayText: [20, 70, 70, 15], accent: [12, 55, 55, 8] },
        { label: "Marine",              weekend: [14, 6, 0, 0],  holiday: [8, 0, 15, 0],  holidayText: [80, 45, 20, 10], accent: [85, 52, 20, 8] },
        { label: "Anthrazit",           weekend: [0, 0, 0, 10],  holiday: [0, 0, 0, 5],   holidayText: [0, 0, 0, 78],    accent: [0, 0, 0, 68] },
        { label: "Sand",                weekend: [0, 6, 14, 3],  holiday: [0, 10, 20, 2], holidayText: [10, 30, 55, 25], accent: [12, 25, 45, 12] }
    ];

    main();

    function main() {
        app.scriptPreferences.userInteractionLevel = UserInteractionLevels.INTERACT_WITH_ALL;

        var activeDoc = getActiveDoc();
        var selectedImageFrame = getSelectedCalendarImageFrame();

        if (activeDoc && isCalendarDoc(activeDoc) && selectedImageFrame) {
            swapImageDialog(activeDoc, selectedImageFrame);
            return;
        }

        var options = showCreateDialog();
        if (!options) return;

        var oldRedraw = app.scriptPreferences.enableRedraw;
        var oldUnit = app.scriptPreferences.measurementUnit;
        var oldPreflight = null;

        try { oldPreflight = app.preflightOptions.preflightOff; } catch (e0) {}

        try {
            app.scriptPreferences.enableRedraw = false;
            app.scriptPreferences.measurementUnit = MeasurementUnits.MILLIMETERS;
            try { app.preflightOptions.preflightOff = true; } catch (e1) {}

            app.doScript(function () {
                buildCalendar(options);
            }, ScriptLanguage.JAVASCRIPT, undefined, UndoModes.ENTIRE_SCRIPT, APP_NAME + " erstellen");

        } catch (err) {
            alert("Fehler beim Erstellen:\n\n" + err.message + (err.line ? "\nZeile: " + err.line : ""));
        } finally {
            try { app.scriptPreferences.enableRedraw = oldRedraw; } catch (e2) {}
            try { app.scriptPreferences.measurementUnit = oldUnit; } catch (e3) {}
            try {
                if (oldPreflight !== null) app.preflightOptions.preflightOff = oldPreflight;
            } catch (e4) {}
        }
    }

    /* ============================================================
       DIALOG
       ============================================================ */

    function showCreateDialog() {
        var assigned = [];
        var pool = [];
        // Eigenes Titelbild. null => das Deckblatt uebernimmt das Januar-Bild
        // (Verhalten bis v10.0).
        var coverPath = null;
        var i;

        for (i = 0; i < MONTH_COUNT; i++) assigned.push(null);

        // Ordner mit den Layout-Vorschaubildern (liegt neben dem Script)
        var assetDir = null;
        try {
            var _sf = new File($.fileName);
            if (_sf && _sf.parent) assetDir = new Folder(_sf.parent.fsName + "/kalenderSNX_vorschau");
        } catch (eAsset) {}

        var w = new Window("dialog", APP_NAME);
        w.orientation = "column";
        w.alignChildren = ["fill", "top"];
        w.margins = 14;
        w.spacing = 9;

        var setup = w.add("panel", undefined, "Dokument");
        setup.orientation = "row";
        setup.alignChildren = ["left", "center"];
        setup.margins = 10;
        setup.spacing = 8;

        setup.add("statictext", undefined, "Jahr:");
        var yearEt = setup.add("edittext", undefined, String((new Date()).getFullYear() + 1));
        yearEt.characters = 6;

        setup.add("statictext", undefined, "Breite mm:");
        var widthEt = setup.add("edittext", undefined, "490");
        widthEt.characters = 6;

        setup.add("statictext", undefined, "Höhe mm:");
        var heightEt = setup.add("edittext", undefined, "340");
        heightEt.characters = 6;

        setup.add("statictext", undefined, "Layout:");
        var layoutDd = setup.add("dropdownlist", undefined, layoutLabels());
        layoutDd.selection = 0;
        layoutDd.preferredSize.width = 260;

        setup.add("statictext", undefined, "Thema:");
        var themeDd = setup.add("dropdownlist", undefined, themeLabels());
        themeDd.selection = 0;
        themeDd.preferredSize.width = 150;

        var setup2 = w.add("panel", undefined, "Optionen");
        setup2.orientation = "row";
        setup2.alignChildren = ["left", "center"];
        setup2.margins = 10;
        setup2.spacing = 8;

        setup2.add("statictext", undefined, "Feiertage:");
        var stateDd = setup2.add("dropdownlist", undefined, stateNames());
        stateDd.selection = findStateIndex("NW");
        stateDd.preferredSize.width = 210;

        var holidaysCb = setup2.add("checkbox", undefined, "Feiertage markieren");
        holidaysCb.value = true;

        var holidayNamesCb = setup2.add("checkbox", undefined, "Feiertagsnamen");
        holidayNamesCb.value = true;

        var kwCb = setup2.add("checkbox", undefined, "Kalenderwochen");
        kwCb.value = false;

        setup2.add("statictext", undefined, "Start:");
        var weekStartDd = setup2.add("dropdownlist", undefined, ["Mo", "So"]);
        weekStartDd.selection = 0;

        var coverCb = setup2.add("checkbox", undefined, "Deckblatt");
        coverCb.value = true;

        var backCb = setup2.add("checkbox", undefined, "Rückseite mit Miniaturen");
        backCb.value = true;

        var recursiveCb = setup2.add("checkbox", undefined, "Unterordner");
        recursiveCb.value = false;

        setup2.add("statictext", undefined, "  |  Vorgabe:");
        var savePresetBtn = setup2.add("button", undefined, "Speichern");
        var loadPresetBtn = setup2.add("button", undefined, "Laden");

        var lpPanel = w.add("panel", undefined, "Layout-Vorschau");
        lpPanel.orientation = "row";
        lpPanel.alignChildren = ["left", "center"];
        lpPanel.margins = 10;
        lpPanel.spacing = 14;

        var layoutPreviewImg = null;
        try {
            layoutPreviewImg = lpPanel.add("image", undefined, undefined);
            layoutPreviewImg.preferredSize = [340, 236];
        } catch (eImg) {}

        var lpHint = lpPanel.add("statictext", undefined,
            "Schema des gewählten Layouts: Foto (grau) und Kalenderteil mit " +
            "durchgehendem Wochenendband. Ändere „Layout:\" oben, um umzuschalten. " +
            "Der reale Kalender nutzt deine Fotos; alles ist danach frei anpassbar.",
            { multiline: true });
        lpHint.characters = 40;
        lpHint.preferredSize.height = 150;

        function updateLayoutPreview() {
            try {
                if (!assetDir || !layoutPreviewImg) return;
                var key = LAYOUTS[layoutDd.selection ? layoutDd.selection.index : 0].key;
                var f = new File(assetDir.fsName + "/" + key + ".png");
                if (f.exists) layoutPreviewImg.image = ScriptUI.newImage(f);
            } catch (eLP) {}
        }
        layoutDd.onChange = updateLayoutPreview;

        var loader = w.add("panel", undefined, "Bilder");
        loader.orientation = "row";
        loader.alignChildren = ["left", "center"];
        loader.margins = 10;
        loader.spacing = 8;

        var folderBtn = loader.add("button", undefined, "Ordner laden");
        var filesBtn = loader.add("button", undefined, "Einzelbilder hinzufügen");
        var info = loader.add("statictext", undefined, "Noch keine Bilder geladen.");
        info.characters = 70;

        var middle = w.add("group");
        middle.orientation = "row";
        middle.alignChildren = ["fill", "top"];
        middle.spacing = 10;

        var leftPanel = middle.add("panel", undefined, "Bild-Slots (Titel + 12 Monate)");
        leftPanel.orientation = "column";
        leftPanel.alignChildren = ["fill", "top"];
        leftPanel.margins = 10;
        leftPanel.spacing = 7;

        var assignedList = leftPanel.add("listbox", [0, 0, 390, 286], [], {
            numberOfColumns: 2,
            showHeaders: true,
            columnTitles: ["Seite", "Bild"]
        });

        var leftBtns = leftPanel.add("group");
        leftBtns.orientation = "row";
        var upBtn = leftBtns.add("button", undefined, "Hoch");
        var downBtn = leftBtns.add("button", undefined, "Runter");
        var toPoolBtn = leftBtns.add("button", undefined, "In Pool");

        var rightPanel = middle.add("panel", undefined, "Bildpool");
        rightPanel.orientation = "column";
        rightPanel.alignChildren = ["fill", "top"];
        rightPanel.margins = 10;
        rightPanel.spacing = 7;

        var poolList = rightPanel.add("listbox", [0, 0, 290, 286], [], {
            numberOfColumns: 1,
            showHeaders: true,
            columnTitles: ["Übrige Bilder"]
        });

        var rightBtns = rightPanel.add("group");
        rightBtns.orientation = "row";
        var swapBtn = rightBtns.add("button", undefined, "Tauschen");
        var sortBtn = rightBtns.add("button", undefined, "A-Z füllen");

        var previewPanel = middle.add("panel", undefined, "Vorschau");
        previewPanel.orientation = "column";
        previewPanel.alignChildren = ["fill", "top"];
        previewPanel.margins = 10;
        previewPanel.spacing = 5;

        var previewTitle = previewPanel.add("statictext", undefined, "Kein Bild gewählt", { truncate: "middle" });
        previewTitle.characters = 34;

        var previewImg = previewPanel.add("image", [0, 0, 300, 190]);
        previewImg.preferredSize = [300, 190];

        var previewInfo = previewPanel.add("statictext", undefined, "Proportionale Thumbnail-Vorschau mit Cache.", { multiline: true });
        previewInfo.characters = 35;

        var hint = w.add("statictext", undefined,
            "Absatz-, Zeichen-, Objekt- und Zellenformate liegen in der Gruppe \"CALPRO\" und sind frei anpassbar. " +
            "Kalendarium global ändern: Zellenformate. Bildtausch später: Bildrahmen anklicken und Script erneut starten.",
            { multiline: true }
        );
        hint.characters = 110;

        var bottom = w.add("group");
        bottom.orientation = "row";
        bottom.alignment = "right";
        var okBtn = bottom.add("button", undefined, "Kalender erstellen", { name: "ok" });
        var cancelBtn = bottom.add("button", undefined, "Abbrechen", { name: "cancel" });

        function selectedAssignedIndex() {
            if (!assignedList.selection) return -1;
            return assignedList.selection.index;
        }

        function selectedPoolIndex() {
            if (!poolList.selection) return -1;
            return poolList.selection.index;
        }

        /* Slot 0 = Titelbild, Slot 1..12 = Januar..Dezember.
           getSlot/setSlot kapseln das, damit Hoch/Runter/In Pool/Tauschen
           nicht zwischen coverPath und assigned[] unterscheiden muessen. */
        function getSlot(i) {
            return (i === COVER_SLOT) ? coverPath : assigned[i - 1];
        }

        function setSlot(i, v) {
            if (i === COVER_SLOT) coverPath = v;
            else assigned[i - 1] = v;
        }

        function slotLabel(i) {
            return (i === COVER_SLOT) ? "Titelbild" : monthNamesUi[i - 1];
        }

        /* Bild, das real auf dem Deckblatt landet: eigenes Titelbild,
           sonst das Januar-Bild. */
        function effectiveCover() {
            return coverPath ? coverPath : assigned[0];
        }

        function refreshLists(selectIndex) {
            assignedList.removeAll();

            for (var a = 0; a < SLOT_COUNT; a++) {
                var item = assignedList.add("item", slotLabel(a));
                var ap = getSlot(a);

                if (ap) item.subItems[0].text = baseName(ap);
                else if (a === COVER_SLOT) item.subItems[0].text = "(wie Januar)";
                else item.subItems[0].text = "- leer -";
            }

            if (typeof selectIndex === "number" && selectIndex >= 0 && selectIndex < assignedList.items.length) {
                assignedList.selection = assignedList.items[selectIndex];
            }

            poolList.removeAll();
            for (var p = 0; p < pool.length; p++) {
                poolList.add("item", baseName(pool[p]));
            }

            updateInfo();
            updatePreview();
        }

        function updateInfo() {
            var filled = 0;
            for (var k = 0; k < assigned.length; k++) {
                if (assigned[k]) filled++;
            }

            info.text = filled + "/12 Monatsbilder gesetzt · Titelbild: " +
                (coverPath ? baseName(coverPath) : "wie Januar") +
                " · " + pool.length + " im Pool.";
        }

        function updatePreview() {
            var path = null;
            var label = "Kein Bild gewählt";

            if (poolList.selection) {
                path = pool[poolList.selection.index];
                label = "Pool: " + baseName(path);
            } else if (assignedList.selection) {
                var si = assignedList.selection.index;
                path = getSlot(si);

                if (!path && si === COVER_SLOT) {
                    // Zeigt, was real gedruckt wird - nicht "leer".
                    path = assigned[0];
                    label = "Titelbild (übernimmt Januar): " + (path ? baseName(path) : "leer");
                } else {
                    label = slotLabel(si) + ": " + (path ? baseName(path) : "leer");
                }
            }

            setPreview(previewImg, previewTitle, path, label, 300, 190);
        }

        /* Verteilt eine Bildliste auf Titelbild + 12 Monate.
           Titelbild-Erkennung in dieser Reihenfolge:
             1. Dateiname enthaelt titel/title/cover/deckblatt
             2. sonst: ab 13 Bildern wird das erste zum Titelbild
             3. sonst: kein eigenes Titelbild -> Deckblatt nimmt Januar
           Rueckgabe: Zahl der gefundenen Bilder. */
        function distribute(paths) {
            paths = uniqueExistingImagePaths(paths);
            paths.sort(pathSort);

            var rest = paths.slice(0);
            var cover = null;
            var c;

            for (c = 0; c < rest.length; c++) {
                if (COVER_NAME_RE.test(baseName(rest[c]))) {
                    cover = rest[c];
                    rest.splice(c, 1);
                    break;
                }
            }

            if (!cover && rest.length > MONTH_COUNT) {
                cover = rest[0];
                rest.splice(0, 1);
            }

            coverPath = cover;
            assigned = [];
            pool = [];

            for (var a = 0; a < MONTH_COUNT; a++) {
                assigned.push(a < rest.length ? rest[a] : null);
            }

            for (var j = MONTH_COUNT; j < rest.length; j++) {
                pool.push(rest[j]);
            }

            return paths.length;
        }

        function loadAll(paths) {
            var n = distribute(paths);

            refreshLists(0);

            if (n < MONTH_COUNT) {
                alert("Es wurden nur " + n + " Bilder gefunden.\n\n" +
                      "Für die 12 Monatsseiten brauchst du mindestens 12 Bilder, " +
                      "für ein eigenes Titelbild 13.");
            }
        }

        folderBtn.onClick = function () {
            var folder = Folder.selectDialog("Bilder-Ordner auswählen");
            if (!folder) return;
            loadAll(collectImages(folder, recursiveCb.value));
        };

        filesBtn.onClick = function () {
            var files = openImagesDialog("Bilder auswählen");
            if (!files) return;

            var all = [];
            var f;

            if (coverPath) all.push(coverPath);

            for (f = 0; f < assigned.length; f++) {
                if (assigned[f]) all.push(assigned[f]);
            }

            for (f = 0; f < pool.length; f++) {
                all.push(pool[f]);
            }

            for (f = 0; f < files.length; f++) {
                if (files[f] instanceof File && isImageFile(files[f])) all.push(files[f].fsName);
            }

            loadAll(all);
        };

        assignedList.onChange = function () {
            if (assignedList.selection) poolList.selection = null;
            updatePreview();
        };

        poolList.onChange = function () {
            updatePreview();
        };

        upBtn.onClick = function () {
            var idx = selectedAssignedIndex();
            if (idx <= 0) return;

            var tmp = getSlot(idx - 1);
            setSlot(idx - 1, getSlot(idx));
            setSlot(idx, tmp);

            refreshLists(idx - 1);
        };

        downBtn.onClick = function () {
            var idx = selectedAssignedIndex();
            if (idx < 0 || idx >= SLOT_COUNT - 1) return;

            var tmp = getSlot(idx + 1);
            setSlot(idx + 1, getSlot(idx));
            setSlot(idx, tmp);

            refreshLists(idx + 1);
        };

        toPoolBtn.onClick = function () {
            var idx = selectedAssignedIndex();
            if (idx < 0) return;

            var cur = getSlot(idx);
            if (cur) addUniquePath(pool, cur);
            setSlot(idx, null);
            pool.sort(pathSort);

            refreshLists(idx);
        };

        swapBtn.onClick = function () {
            var a = selectedAssignedIndex();
            var p = selectedPoolIndex();

            if (a < 0 || p < 0) {
                alert("Links einen Slot (Titelbild oder Monat) und rechts ein Poolbild auswählen.");
                return;
            }

            var old = getSlot(a);
            setSlot(a, pool[p]);

            if (old) pool[p] = old;
            else pool.splice(p, 1);

            pool.sort(pathSort);
            refreshLists(a);
        };

        sortBtn.onClick = function () {
            var all = [];
            var s;

            if (coverPath) all.push(coverPath);

            for (s = 0; s < assigned.length; s++) {
                if (assigned[s]) all.push(assigned[s]);
            }

            for (s = 0; s < pool.length; s++) {
                all.push(pool[s]);
            }

            distribute(all);
            refreshLists(0);
        };

        cancelBtn.onClick = function () {
            w.close(0);
        };

        okBtn.onClick = function () {
            var year = parseInt(yearEt.text, 10);
            var docW = parseNumber(widthEt.text);
            var docH = parseNumber(heightEt.text);

            if (isNaN(year) || year < 1900 || year > 2200) {
                alert("Bitte ein gültiges Kalenderjahr eintragen.");
                return;
            }

            if (isNaN(docW) || isNaN(docH) || docW < 200 || docH < 140) {
                alert("Bitte gültige Seitenmaße in mm eintragen (min. 200 × 140).");
                return;
            }

            for (var m = 0; m < MONTH_COUNT; m++) {
                if (!assigned[m]) {
                    alert("Es fehlt ein Bild für " + monthNamesUi[m] + ".");
                    return;
                }

                if (!(new File(assigned[m])).exists) {
                    alert("Datei nicht gefunden:\n" + assigned[m]);
                    return;
                }
            }

            if (coverPath && !(new File(coverPath)).exists) {
                alert("Titelbild nicht gefunden:\n" + coverPath);
                return;
            }

            w.result = {
                year: year,
                docWidth: docW,
                docHeight: docH,
                layout: LAYOUTS[layoutDd.selection ? layoutDd.selection.index : 0].key,
                themeIndex: themeDd.selection ? themeDd.selection.index : 0,
                stateCode: STATES[stateDd.selection ? stateDd.selection.index : 0].code,
                assigned: assigned.slice(0),
                coverImage: effectiveCover(),
                coverIsOwn: coverPath ? true : false,
                pool: pool.slice(0),
                markHolidays: holidaysCb.value,
                nameHolidays: holidayNamesCb.value,
                showWeekNumbers: kwCb.value,
                weekStart: (weekStartDd.selection && weekStartDd.selection.index === 1) ? "sunday" : "monday",
                createCover: coverCb.value,
                createBack: backCb.value
            };

            w.close(1);
        };

        function currentPreset() {
            return {
                docWidth: widthEt.text,
                docHeight: heightEt.text,
                layout: layoutDd.selection ? layoutDd.selection.index : 0,
                themeIndex: themeDd.selection ? themeDd.selection.index : 0,
                stateIndex: stateDd.selection ? stateDd.selection.index : 0,
                weekStart: (weekStartDd.selection && weekStartDd.selection.index === 1) ? 1 : 0,
                markHolidays: holidaysCb.value ? 1 : 0,
                nameHolidays: holidayNamesCb.value ? 1 : 0,
                showKw: kwCb.value ? 1 : 0,
                cover: coverCb.value ? 1 : 0,
                back: backCb.value ? 1 : 0
            };
        }

        function applyPresetObj(p) {
            if (p.docWidth) widthEt.text = String(p.docWidth);
            if (p.docHeight) heightEt.text = String(p.docHeight);
            ddSelect(layoutDd, p.layout);
            ddSelect(themeDd, p.themeIndex);
            ddSelect(stateDd, p.stateIndex);
            ddSelect(weekStartDd, p.weekStart);
            holidaysCb.value = String(p.markHolidays) === "1";
            if (p.nameHolidays !== undefined) holidayNamesCb.value = String(p.nameHolidays) === "1";
            kwCb.value = String(p.showKw) === "1";
            coverCb.value = String(p.cover) === "1";
            backCb.value = String(p.back) === "1";
        }

        savePresetBtn.onClick = function () {
            savePreset(currentPreset());
        };

        loadPresetBtn.onClick = function () {
            var p = loadPreset();
            if (p) { applyPresetObj(p); updateLayoutPreview(); }
        };

        refreshLists(0);
        updateLayoutPreview();

        if (w.show() !== 1) return null;
        return w.result;
    }

    /* ============================================================
       VORGABEN (Presets)
       ============================================================ */

    function ddSelect(dd, idx) {
        idx = parseInt(idx, 10);
        if (!isNaN(idx) && idx >= 0 && idx < dd.items.length) dd.selection = idx;
    }

    function serializePreset(p) {
        var lines = ["CALPRO_PRESET_V1"];
        for (var k in p) {
            if (p.hasOwnProperty(k)) lines.push(k + "=" + p[k]);
        }
        return lines.join("\n");
    }

    function parsePreset(txt) {
        var lines = String(txt).split(/\r\n|\r|\n/);
        if (!lines.length || String(lines[0]).indexOf("CALPRO_PRESET") !== 0) {
            alert("Das ist keine gültige CALPRO-Vorgabe.");
            return null;
        }

        var out = {};
        for (var i = 1; i < lines.length; i++) {
            var s = lines[i];
            if (!s) continue;
            var eq = s.indexOf("=");
            if (eq < 0) continue;
            out[s.substring(0, eq)] = s.substring(eq + 1);
        }
        return out;
    }

    function savePreset(p) {
        var f = File.saveDialog("Vorgabe speichern", File.fs === "Windows" ? "CALPRO-Vorgabe:*.calpro" : undefined);
        if (!f) return;
        if (!/\.calpro$/i.test(f.name)) f = new File(f.fsName + ".calpro");

        try {
            f.encoding = "UTF-8";
            if (!f.open("w")) { alert("Vorgabe konnte nicht geschrieben werden."); return; }
            f.write(serializePreset(p));
            f.close();
        } catch (e0) {
            try { f.close(); } catch (e1) {}
            alert("Fehler beim Speichern der Vorgabe:\n" + e0.message);
        }
    }

    function loadPreset() {
        var f = File.openDialog("Vorgabe laden", File.fs === "Windows" ? "CALPRO-Vorgabe:*.calpro" : undefined);
        if (!f) return null;

        try {
            f.encoding = "UTF-8";
            if (!f.open("r")) { alert("Vorgabe konnte nicht gelesen werden."); return null; }
            var txt = f.read();
            f.close();
            return parsePreset(txt);
        } catch (e0) {
            try { f.close(); } catch (e1) {}
            alert("Fehler beim Laden der Vorgabe:\n" + e0.message);
            return null;
        }
    }

    function layoutLabels() {
        var out = [];
        for (var i = 0; i < LAYOUTS.length; i++) out.push(LAYOUTS[i].label);
        return out;
    }

    function themeLabels() {
        var out = [];
        for (var i = 0; i < THEMES.length; i++) out.push(THEMES[i].label);
        return out;
    }

    function themeByIndex(idx) {
        if (isNaN(idx) || idx < 0 || idx >= THEMES.length) return THEMES[0];
        return THEMES[idx];
    }

    function stateNames() {
        var out = [];
        for (var i = 0; i < STATES.length; i++) out.push(STATES[i].name);
        return out;
    }

    function findStateIndex(code) {
        for (var i = 0; i < STATES.length; i++) {
            if (STATES[i].code === code) return i;
        }
        return 0;
    }

    /* ============================================================
       AUFBAU
       ============================================================ */

    function buildCalendar(options) {
        var totalPages = MONTH_COUNT;
        if (options.createCover) totalPages++;
        if (options.createBack) totalPages++;

        var doc = app.documents.add();

        placeErrors = [];
        placeErrorSeen = {};

        doc.documentPreferences.pageWidth = options.docWidth;
        doc.documentPreferences.pageHeight = options.docHeight;
        doc.documentPreferences.facingPages = false;
        doc.documentPreferences.pagesPerDocument = totalPages;
        doc.documentPreferences.documentBleedTopOffset = BLEED;
        doc.documentPreferences.documentBleedBottomOffset = BLEED;
        doc.documentPreferences.documentBleedInsideOrLeftOffset = BLEED;
        doc.documentPreferences.documentBleedOutsideOrRightOffset = BLEED;

        doc.viewPreferences.rulerOrigin = RulerOrigin.PAGE_ORIGIN;

        while (doc.pages.length < totalPages) doc.pages.add();
        while (doc.pages.length > totalPages) doc.pages.lastItem().remove();

        doc.insertLabel(LABEL_VERSION, VERSION);
        doc.insertLabel(LABEL_YEAR, String(options.year));
        doc.insertLabel(LABEL_WIDTH, String(options.docWidth));
        doc.insertLabel(LABEL_HEIGHT, String(options.docHeight));
        doc.insertLabel(LABEL_LAYOUT, options.layout);
        doc.insertLabel(LABEL_THEME, String(options.themeIndex));
        doc.insertLabel(LABEL_ASSIGNED, joinPaths(options.assigned));
        doc.insertLabel(LABEL_COVER, options.coverIsOwn ? options.coverImage : "");
        doc.insertLabel(LABEL_POOL, joinPaths(options.pool));

        var layers = createLayers(doc);
        var palette = createPalette(doc, themeByIndex(options.themeIndex));
        var styles = createStyles(doc, palette);
        var master = null;
        try { master = buildMasterPage(doc, options); } catch (eMaster) {}
        var holidays = options.markHolidays ? getHolidays(options.year, options.stateCode) : {};

        var pageErrors = [];
        var pageIndex = 0;

        if (options.createCover) {
            try {
                buildCoverPage(doc, doc.pages[pageIndex], options, layers, palette, styles);
            } catch (eCov) {
                pageErrors.push("Deckblatt – " + eCov.message + (eCov.line ? " (Zeile " + eCov.line + ")" : ""));
            }
            pageIndex++;
        }

        for (var m = 0; m < MONTH_COUNT; m++) {
            try { if (master) doc.pages[pageIndex].appliedMaster = master; } catch (eM) {}
            try {
                buildMonthPage(doc, doc.pages[pageIndex], m, options, layers, palette, styles, holidays);
            } catch (eMon) {
                pageErrors.push(monthNamesUi[m] + " – " + eMon.message + (eMon.line ? " (Zeile " + eMon.line + ")" : ""));
            }
            pageIndex++;
        }

        if (options.createBack) {
            try {
                buildBackPage(doc, doc.pages[pageIndex], options, layers, palette, styles);
            } catch (eBack) {
                pageErrors.push("Rückseite – " + eBack.message + (eBack.line ? " (Zeile " + eBack.line + ")" : ""));
            }
        }

        try { updatePoolNote(doc, options.pool, layers, palette, styles); } catch (ePool) {}

        // Ansicht auf die erste Seite holen, damit man nicht auf der
        // (leeren) Musterseite "B-CalPro" landet und denkt, nichts entstand.
        try { doc.layoutWindows[0].activePage = doc.pages[0]; } catch (eAP) {}

        var overset = countOversetTextFrames(doc);
        var layoutName = layoutNameForKey(options.layout);

        var msg = "Highend-Monatskalender fertig.\n\n" +
            "Layout: " + layoutName + "\n" +
            "Farbthema: " + themeByIndex(options.themeIndex).label + "\n" +
            "Wochenstart: " + (options.weekStart === "sunday" ? "Sonntag" : "Montag") + "\n" +
            "Format: " + options.docWidth + " × " + options.docHeight + " mm + " + BLEED + " mm Beschnitt\n" +
            "Seiten: " + totalPages + "\n" +
            "Bildpool: " + options.pool.length + " Bilder\n\n" +
            "Absatz-, Zeichen-, Objekt- und ZELLENFORMATE liegen in der Gruppe \"" + STYLE_GROUP + "\".\n" +
            "Kalendarium global ändern: Zellenformate (Kalender Tag/Wochenende/Feiertag …) anpassen.\n" +
            "Layout-Raster liegt als Hilfslinien auf der Musterseite \"B-CalPro\".\n" +
            "Mit W in den Vorschau-Modus wechseln.";

        if (pageErrors.length > 0) {
            msg += "\n\n‼ FEHLER beim Aufbau dieser Seiten (bitte an den Entwickler melden):\n" +
                pageErrors.join("\n");
        }

        if (overset > 0) msg += "\n\nHinweis: " + overset + " Textrahmen haben Übersatz. Bitte kurz prüfen.";

        if (placeErrors.length > 0) {
            msg += "\n\n⚠ " + placeErrors.length + " Bild(er) NICHT geladen (Rahmen leer) – siehe separaten Hinweis.";
        }

        var lowRes = checkResolution(doc, WARN_PPI);
        if (lowRes.length > 0) {
            msg += "\n\n⚠ Bildauflösung unter " + WARN_PPI + " ppi (für Druck grenzwertig, empfohlen 300):\n" +
                lowRes.join("\n");
        } else if (placeErrors.length === 0) {
            msg += "\n\n✓ Alle Bilder ≥ " + WARN_PPI + " ppi.";
        }

        // Bild-Ladefehler ZUERST und unübersehbar melden.
        if (placeErrors.length > 0) {
            alert("⚠ BILDER KONNTEN NICHT GELADEN WERDEN\n\n" +
                placeErrors.length + " Bild(er) ließen sich nicht platzieren, die Rahmen bleiben leer:\n\n" +
                placeErrors.join("\n") +
                "\n\nUrsache ist fast immer ein Dateityp, den InDesign nicht lesen kann – vor allem " +
                "PROGRESSIVE JPEGs (z. B. von WhatsApp) oder HEIC (iPhone).\n\n" +
                "LÖSUNG: Bilder als Standard-JPEG (Baseline) oder TIFF neu speichern " +
                "(Photoshop -> Speichern unter, Haekchen 'Progressiv' AUS). Dann den Bildrahmen " +
                "anklicken und das Script erneut starten, um das Bild zu tauschen.");
        }

        alert(msg);
    }

    function layoutNameForKey(key) {
        for (var i = 0; i < LAYOUTS.length; i++) {
            if (LAYOUTS[i].key === key) return LAYOUTS[i].label;
        }
        return key;
    }

    /* ------------------------------------------------------------
       Layout-Geometrie: liefert alle Bereiche einer Monatsseite.
       Alle Werte proportional zum Seitenformat.
       ------------------------------------------------------------ */
    function computeMonthLayout(key, w, h) {
        var L = {
            image: null,       // geometricBounds Bildrahmen
            panel: null,       // geometricBounds Overlay-Panel (oder null)
            headerBg: true,    // Header-Rechteck zeichnen?
            hTop: 0, hBottom: 0, hx1: 0, hx2: 0,
            gx: 0, gy: 0, gw: 0, gh: 0,
            imageStroke: false
        };

        var marginX, headerH;

        if (key === "split") {
            var imgRight = w * 0.42;
            marginX = Math.max(10, w * 0.024);
            L.image = [-BLEED, -BLEED, h + BLEED, imgRight];

            var cx1 = imgRight + marginX;
            var cx2 = w - marginX;

            L.hTop = Math.max(12, h * 0.045);
            headerH = Math.max(18, h * 0.062);
            L.hBottom = L.hTop + headerH;
            L.hx1 = cx1;
            L.hx2 = cx2;

            L.gx = cx1;
            L.gy = L.hBottom + 5;
            L.gw = cx2 - cx1;
            L.gh = (h - Math.max(8, h * 0.03)) - L.gy;

        } else if (key === "overlay") {
            L.image = [-BLEED, -BLEED, h + BLEED, w + BLEED];

            var pTop = h * 0.47;
            var pMargin = Math.max(12, w * 0.028);
            var pBottom = h - Math.max(8, h * 0.03);
            L.panel = [pTop, pMargin, pBottom, w - pMargin];

            var pad = 7;
            L.headerBg = false;
            L.hTop = pTop + pad;
            headerH = Math.max(16, h * 0.055);
            L.hBottom = L.hTop + headerH;
            L.hx1 = pMargin + pad;
            L.hx2 = w - pMargin - pad;

            L.gx = L.hx1;
            L.gy = L.hBottom + 4;
            L.gw = L.hx2 - L.hx1;
            L.gh = (pBottom - pad) - L.gy;

        } else if (key === "gallery") {
            var frameMargin = Math.max(12, w * 0.028);
            var imageBottom = h * 0.5;
            marginX = frameMargin;
            L.image = [frameMargin, frameMargin, imageBottom, w - frameMargin];
            L.imageStroke = true;

            L.hTop = imageBottom + 6;
            headerH = Math.max(18, h * 0.058);
            L.hBottom = L.hTop + headerH;
            L.hx1 = marginX;
            L.hx2 = w - marginX;

            L.gx = marginX;
            L.gy = L.hBottom + 4;
            L.gw = w - marginX * 2;
            L.gh = (h - Math.max(10, h * 0.032)) - L.gy;

        } else {
            // classic – Foto ~48% (vorher 53,5%), Raster bekommt mehr Hoehe
            var ib = h * 0.478;
            marginX = Math.max(10, w * 0.0225);
            L.image = [-BLEED, -BLEED, ib, w + BLEED];

            L.hTop = ib + 4;
            headerH = Math.max(18, h * 0.06);
            L.hBottom = L.hTop + headerH;
            L.hx1 = marginX;
            L.hx2 = w - marginX;

            L.gx = marginX;
            L.gy = L.hBottom + 4;
            L.gw = w - marginX * 2;
            L.gh = (h - Math.max(6, h * 0.018)) - L.gy;
        }

        return L;
    }

    function buildMonthPage(doc, page, monthIndex, options, layers, palette, styles, holidays) {
        var w = options.docWidth;
        var h = options.docHeight;
        var L = computeMonthLayout(options.layout, w, h);

        var imgFrame = addRectangle(page, layers.images, L.image);
        imgFrame.contentType = ContentType.GRAPHIC_TYPE;
        imgFrame.name = "CALPRO_MONTH_IMAGE_" + monthNamesUi[monthIndex];
        applyObjStyle(imgFrame, L.imageStroke ? styles.obj.imageGallery : styles.obj.imageFrame);
        imgFrame.insertLabel(LABEL_ROLE, ROLE_MONTH_IMAGE);
        imgFrame.insertLabel(LABEL_MONTH_INDEX, String(monthIndex));
        tryPlaceImage(imgFrame, options.assigned[monthIndex], monthNamesUi[monthIndex]);

        if (L.panel) {
            var panel = addRectangle(page, layers.design, L.panel);
            applyObjStyle(panel, styles.obj.panel);
            setOpacity(panel, 92);
        }

        // Feine dunkle Trennlinie an der Bildunterkante (Klassik) ->
        // stabilisiert die Kante Foto/Kalender, verhindert weiss-in-weiss.
        if (options.layout === "classic") {
            try {
                var iy = L.image[2];
                var sep = page.graphicLines.add();
                sep.itemLayer = layers.design;
                sep.geometricBounds = [iy, 0, iy, w];
                sep.strokeColor = palette.weekdayGrey;
                sep.strokeWeight = 0.4;
            } catch (eSep) {}
        }

        // Kein Kasten mehr: nur EINE feine Akzentlinie unter dem Titel,
        // buendig zur Rasterbreite. Das ist die eine gebrandete Linie.
        try {
            var rule = page.graphicLines.add();
            rule.itemLayer = layers.design;
            rule.geometricBounds = [L.hBottom, L.hx1, L.hBottom, L.hx2];
            applyObjStyle(rule, styles.obj.accentRule);
        } catch (e1) {}

        var headerW = L.hx2 - L.hx1;
        var dateW = Math.min(120, headerW * 0.32);

        var monthFrame = addText(
            page,
            layers.text,
            [L.hTop, L.hx1, L.hBottom - 1.0, L.hx2 - dateW - 2],
            monthNamesPrint[monthIndex],
            styles.headerMonth
        );
        setVerticalCenter(monthFrame);

        // Rechts nur das Jahr (kein "09 · 2027" mehr) – konkurriert nicht
        // mit dem ausgeschriebenen Monatsnamen.
        var dateFrame = addText(
            page,
            layers.text,
            [L.hTop, L.hx2 - dateW, L.hBottom - 1.0, L.hx2],
            String(options.year),
            styles.headerDate
        );
        setVerticalCenter(dateFrame);

        buildCalendarTable(
            page,
            monthIndex,
            options.year,
            holidays,
            L.gx,
            L.gy,
            L.gw,
            L.gh,
            options.showWeekNumbers,
            options.weekStart,
            options.nameHolidays,
            layers,
            palette,
            styles
        );
    }

    /* ------------------------------------------------------------
       Kalendarium als Tabelle.
       V8: Feiertagsname IN der Zelle (Tag + Tab + Name mit
       rechtsbündigem Tabstopp), Zeilen mit fixer Hoehe.
       ------------------------------------------------------------ */
    function buildCalendarTable(page, monthIndex, year, holidays, x, y, width, height, showKw, weekStart, nameHolidays, layers, palette, styles) {
        var first = new Date(year, monthIndex, 1);
        var startOffset = weekStart === "sunday" ? first.getDay() : mondayIndex(first);
        var days = new Date(year, monthIndex + 1, 0).getDate();
        var wdLabels = weekStart === "sunday"
            ? ["SO", "MO", "DI", "MI", "DO", "FR", "SA"]
            : weekdays;

        var weekRows = 6;
        // Kopfzeile muss hoch genug sein, damit die Wochentags-Labels
        // (8,4 pt) sicher passen. Bei niedrigen Rastern (Klassik) wurde
        // der Text sonst in der zu kurzen Zelle abgeschnitten -> leer.
        var headerH = Math.max(11, height * 0.065);
        var bodyH = (height - headerH) / weekRows;
        var rowCount = 1 + weekRows;

        var kwW = showKw ? Math.max(8, width * 0.03) : 0;
        var dayColCount = 7;
        var colCount = dayColCount + (showKw ? 1 : 0);
        var colW = (width - kwW) / dayColCount;
        var tableH = headerH + bodyH * weekRows;

        // Rahmen 2 mm hoeher als die Tabelle: durch Fliesskomma-Rundung
        // der Zeilenhoehen kann die Tabelle sonst minimal ueberstehen und
        // InDesign zeigt einen (unschoenen) Uebersatz-Marker. Das Polster
        // liegt unsichtbar unter dem Raster.
        var tf = addEmptyTextFrame(page, layers.calendar, [y, x, y + tableH + 2, x + width]);

        var table = tf.insertionPoints[0].tables.add();
        table.columnCount = colCount;
        table.bodyRowCount = rowCount;
        table.width = width;

        var r, c;

        if (showKw) {
            table.columns[0].width = kwW;
            for (c = 0; c < dayColCount; c++) table.columns[c + 1].width = colW;
        } else {
            for (c = 0; c < dayColCount; c++) table.columns[c].width = colW;
        }

        // Fixe Zeilenhoehen: autoGrow aus, sonst waechst das Raster
        // bei Schrift-/Formataenderungen und alles verrutscht.
        for (r = 0; r < rowCount; r++) {
            try { table.rows[r].autoGrow = false; } catch (eG) {}
            table.rows[r].height = (r === 0) ? headerH : bodyH;
        }

        var colOffset = showKw ? 1 : 0;

        if (showKw) {
            var kwHead = table.rows[0].cells[0];
            applyCellStyle(kwHead, styles.cell.weekdayHead);
            kwHead.contents = "KW";
            try { kwHead.texts[0].appliedParagraphStyle = styles.weekday; } catch (eK0) {}
        }

        for (c = 0; c < dayColCount; c++) {
            var headerCell = table.rows[0].cells[c + colOffset];
            // SA/SO-Kopf leicht getoent -> Wochenendflaeche laeuft als
            // durchgehendes Band von der Kopfzeile bis unten durch.
            applyCellStyle(headerCell, isWeekendCol(c, weekStart) ? styles.cell.weekdayHeadWeekend : styles.cell.weekdayHead);
            headerCell.contents = wdLabels[c];
            try { headerCell.texts[0].appliedParagraphStyle = styles.weekday; } catch (e0) {}
        }

        for (r = 1; r < rowCount; r++) {
            var rowHasDay = false;
            var rowFirstDate = new Date(year, monthIndex, 1 - startOffset + (r - 1) * 7);
            var mondayOfRow = addDays(rowFirstDate, (1 - rowFirstDate.getDay() + 7) % 7);

            for (c = 0; c < dayColCount; c++) {
                var cell = table.rows[r].cells[c + colOffset];

                var sequential = (r - 1) * 7 + c;
                var realDay = sequential - startOffset + 1;

                if (realDay < 1 || realDay > days) {
                    // Leere Zellen im Wochenende trotzdem toenen -> die
                    // SA/SO-Flaeche geht ueber das volle 6-Wochen-Raster.
                    applyCellStyle(cell, isWeekendCol(c, weekStart) ? styles.cell.weekend : styles.cell.empty);
                    cell.contents = "";
                    continue;
                }

                rowHasDay = true;

                var dateObj = new Date(year, monthIndex, realDay);
                var key = dateKeyMMDD(dateObj);
                var holidayName = holidays[key] ? holidays[key] : "";
                var isWeekend = isWeekendCol(c, weekStart);

                var cellStyle = (holidayName !== "")
                    ? styles.cell.holiday
                    : (isWeekend ? styles.cell.weekend : styles.cell.day);
                applyCellStyle(cell, cellStyle);

                var dayStr = String(realDay);

                if (holidayName !== "" && nameHolidays) {
                    // Zahl zentriert, Feiertagsname als kleine zentrierte
                    // Zeile darunter (nur wenn Option "Feiertagsnamen" an).
                    cell.contents = dayStr + "\r" + holidayName;
                    try { cell.paragraphs[0].appliedParagraphStyle = styles.dayNumber; } catch (e2) {}
                    try {
                        if (cell.paragraphs.length > 1) cell.paragraphs.lastItem().appliedParagraphStyle = styles.holidayLine;
                    } catch (e3) {}
                } else {
                    cell.contents = dayStr;
                    try { cell.paragraphs[0].appliedParagraphStyle = styles.dayNumber; } catch (e2) {}
                }
            }

            if (showKw) {
                var kwCell = table.rows[r].cells[0];
                applyCellStyle(kwCell, styles.cell.kw);

                if (rowHasDay) {
                    kwCell.contents = String(isoWeek(mondayOfRow));
                    try { kwCell.paragraphs[0].appliedParagraphStyle = styles.kwNumber; } catch (e4) {}
                } else {
                    kwCell.contents = "";
                }
            }
        }
    }

    function applyCellStyle(cell, cs) {
        try { if (cs && cs.isValid) cell.appliedCellStyle = cs; } catch (e0) {}
    }

    /* ============================================================
       DECKBLATT + RUECKSEITE
       ============================================================ */

    function buildCoverPage(doc, page, options, layers, palette, styles) {
        var w = options.docWidth;
        var h = options.docHeight;

        var img = addRectangle(page, layers.images, [-BLEED, -BLEED, h + BLEED, w + BLEED]);
        img.contentType = ContentType.GRAPHIC_TYPE;
        img.name = "CALPRO_COVER_IMAGE";
        applyObjStyle(img, styles.obj.imageFrame);
        img.insertLabel(LABEL_ROLE, ROLE_COVER_IMAGE);
        // -1 statt 0: sonst haelt jede spaetere Auswertung das Deckblatt
        // faelschlich fuer Januar.
        img.insertLabel(LABEL_MONTH_INDEX, "-1");
        tryPlaceImage(img, options.coverImage ? options.coverImage : options.assigned[0], "Deckblatt");

        var shadeH = Math.max(80, h * 0.29);
        var shade = addRectangle(page, layers.design, [h - shadeH, -BLEED, h + BLEED, w + BLEED]);
        applyObjStyle(shade, styles.obj.coverShade);
        setOpacity(shade, 62);

        var mx = Math.max(18, w * 0.045);

        var small = addText(page, layers.text, [h - shadeH + 16, mx + 2, h - shadeH + 28, w - mx], "PREMIUM MONATSKALENDER", styles.coverSmall);
        setVerticalCenter(small);

        var title = addText(page, layers.text, [h - shadeH + 29, mx, h - shadeH + 64, w - mx], String(options.year), styles.coverTitle);
        setVerticalCenter(title);

        var subtitle = addText(page, layers.text, [h - shadeH + 65, mx + 2, h - shadeH + 78, w - mx], "12 MONATE · FOTOKALENDER · PLANER", styles.coverSub);
        setVerticalCenter(subtitle);
    }

    function buildBackPage(doc, page, options, layers, palette, styles) {
        var w = options.docWidth;
        var h = options.docHeight;

        var mx = Math.max(16, w * 0.037);

        var title = addText(page, layers.text, [15, mx, 36, w - mx], "JAHRESÜBERSICHT " + options.year, styles.backTitle);
        setVerticalCenter(title);

        var cols = 4;
        var rows = 3;
        var gap = 8;
        var left = mx;
        var right = w - mx;
        var top = 46;
        var bottom = h - 18;

        var thumbW = (right - left - gap * (cols - 1)) / cols;
        var thumbH = (bottom - top - gap * (rows - 1)) / rows;

        for (var i = 0; i < MONTH_COUNT; i++) {
            var c = i % cols;
            var r = Math.floor(i / cols);

            var x1 = left + c * (thumbW + gap);
            var y1 = top + r * (thumbH + gap);
            var x2 = x1 + thumbW;
            var y2 = y1 + thumbH;

            var frame = addRectangle(page, layers.images, [y1, x1, y2, x2]);
            frame.contentType = ContentType.GRAPHIC_TYPE;
            frame.name = "CALPRO_BACK_THUMB_" + monthNamesUi[i];
            applyObjStyle(frame, styles.obj.imageFrame);
            frame.insertLabel(LABEL_ROLE, ROLE_BACK_THUMB);
            frame.insertLabel(LABEL_MONTH_INDEX, String(i));
            tryPlaceImage(frame, options.assigned[i], "Miniatur " + monthNamesUi[i]);

            var labelBg = addRectangle(page, layers.design, [y2 - 10.5, x1, y2, x2]);
            applyObjStyle(labelBg, styles.obj.thumbLabel);
            setOpacity(labelBg, 56);

            var label = addText(page, layers.text, [y2 - 9, x1 + 3, y2 - 1.5, x2 - 3], monthNamesPrint[i], styles.thumbLabel);
            setVerticalCenter(label);
        }
    }

    /* ============================================================
       EBENEN / FARBEN / FORMATE
       ============================================================ */

    function createLayers(doc) {
        var images = getLayer(doc, "01_Bilder", true, true);
        var design = getLayer(doc, "02_Design", true, true);
        var calendar = getLayer(doc, "03_Kalendarium", true, true);
        var text = getLayer(doc, "04_Text", true, true);
        var pool = getLayer(doc, "99_Bildpool_nicht_druckend", true, false);

        try { pool.printable = false; } catch (e0) {}

        return {
            images: images,
            design: design,
            calendar: calendar,
            text: text,
            pool: pool
        };
    }

    function createPalette(doc, theme) {
        if (!theme) theme = THEMES[0];

        var none = getSwatch(doc, ["[None]", "[Ohne]", "None", "Ohne"], null, null);
        var paper = getSwatch(doc, ["[Paper]", "[Papier]", "Paper", "Papier"], "CAL_Paper", [0, 0, 0, 0]);
        var black = getSwatch(doc, ["[Black]", "[Schwarz]", "Black", "Schwarz"], "CAL_Black", [0, 0, 0, 100]);

        return {
            none: none,
            paper: paper,
            black: black,
            text: makeColor(doc, "CAL_Text_96K", [0, 0, 0, 96]),
            muted: makeColor(doc, "CAL_Muted_45K", [0, 0, 0, 45]),
            weekdayGrey: makeColor(doc, "CAL_Wochentag_62K", [0, 0, 0, 62]),
            gridLine: makeColor(doc, "CAL_Trennlinie_12K", [0, 0, 0, 12]),
            emptyCell: makeColor(doc, "CAL_Empty_2K", [0, 0, 0, 2]),
            weekendBlue: makeColor(doc, "CAL_Wochenende", theme.weekend),
            holidayGreen: makeColor(doc, "CAL_Feiertag", theme.holiday),
            holidayText: makeColor(doc, "CAL_Feiertag_Text", theme.holidayText),
            accent: makeColor(doc, "CAL_Akzent", theme.accent)
        };
    }

    /*
        Formate liegen in der Gruppe "CALPRO".
        WICHTIG: Existiert ein Format bereits, wird es NICHT angefasst.
        So bleiben eigene Anpassungen (Schrift, Groesse, Farbe) beim
        Bildtausch oder erneutem Scriptlauf erhalten.
    */
    function createStyles(doc, palette) {
        // Designer-Schriftpaar mit robusten Fallbacks:
        // Display = Futura PT Bold (geometrisch, plakativ),
        // Text/Zahlen = Inter (moderne Grotesk, top lesbar).
        // Findet InDesign eine Schrift nicht, greift automatisch der
        // naechste Kandidat bis hin zu Arial.
        var fontDisplay = findFont([
            "Futura PT\tBold",
            "Futura PT\tHeavy",
            "Franklin Gothic Demi\tRegular",
            "Franklin Gothic Heavy\tRegular",
            "Inter 28pt\tExtraBold",
            "Inter 28pt\tBold",
            "Bahnschrift\tRegular",
            "Segoe UI\tBold",
            "Arial\tBold"
        ]);

        var fontBold = findFont([
            "Inter 24pt\tSemiBold",
            "Inter 18pt\tSemiBold",
            "Inter\tSemiBold",
            "Inter 24pt\tBold",
            "Inter 18pt\tBold",
            "Franklin Gothic Demi\tRegular",
            "Segoe UI Semibold\tRegular",
            "Segoe UI\tBold",
            "Arial\tBold"
        ]);

        var fontRegular = findFont([
            "Inter 24pt\tRegular",
            "Inter 18pt\tRegular",
            "Inter\tRegular",
            "Inter 24pt\tMedium",
            "Geist\tRegular",
            "Segoe UI\tRegular",
            "Arial\tRegular"
        ]);

        var pGroup = getParagraphStyleGroup(doc, STYLE_GROUP);
        var cGroup = getCharacterStyleGroup(doc, STYLE_GROUP);

        var styles = {};

        styles.headerMonth = makeParagraphStyle(doc, pGroup, "Header Monat", {
            pointSize: 20.5,
            leading: 22,
            tracking: 40,
            justification: Justification.LEFT_ALIGN,
            fillColor: palette.text,
            appliedFont: fontDisplay
        });

        styles.headerDate = makeParagraphStyle(doc, pGroup, "Header Jahr", {
            pointSize: 13,
            leading: 15,
            tracking: 55,
            justification: Justification.RIGHT_ALIGN,
            fillColor: palette.muted,
            appliedFont: fontRegular
        });

        styles.weekday = makeParagraphStyle(doc, pGroup, "Wochentag", {
            pointSize: 8.2,
            leading: 9,
            tracking: 80,
            justification: Justification.CENTER_ALIGN,
            fillColor: palette.weekdayGrey,
            appliedFont: fontBold
        });

        // Tageszahlen ZENTRIERT (mittig unter den Wochentagen) – der
        // groesste Qualitaetsgewinn laut Design-Review.
        styles.dayNumber = makeParagraphStyle(doc, pGroup, "Tageszahl", {
            pointSize: 16.5,
            leading: 17.5,
            tracking: 0,
            justification: Justification.CENTER_ALIGN,
            fillColor: palette.text,
            appliedFont: fontRegular
        });

        styles.kwNumber = makeParagraphStyle(doc, pGroup, "Kalenderwoche", {
            pointSize: 6.5,
            leading: 7.2,
            tracking: 20,
            justification: Justification.CENTER_ALIGN,
            fillColor: palette.muted,
            appliedFont: fontRegular
        });

        styles.coverSmall = makeParagraphStyle(doc, pGroup, "Cover Klein", {
            pointSize: 8,
            leading: 10,
            tracking: 180,
            justification: Justification.LEFT_ALIGN,
            fillColor: palette.paper,
            appliedFont: fontBold
        });

        styles.coverTitle = makeParagraphStyle(doc, pGroup, "Cover Titel", {
            pointSize: 48,
            leading: 50,
            tracking: 80,
            justification: Justification.LEFT_ALIGN,
            fillColor: palette.paper,
            appliedFont: fontDisplay
        });

        styles.coverSub = makeParagraphStyle(doc, pGroup, "Cover Untertitel", {
            pointSize: 8,
            leading: 10,
            tracking: 145,
            justification: Justification.LEFT_ALIGN,
            fillColor: palette.paper,
            appliedFont: fontRegular
        });

        styles.backTitle = makeParagraphStyle(doc, pGroup, "Rückseite Titel", {
            pointSize: 17,
            leading: 19,
            tracking: 100,
            justification: Justification.LEFT_ALIGN,
            fillColor: palette.text,
            appliedFont: fontBold
        });

        styles.thumbLabel = makeParagraphStyle(doc, pGroup, "Miniatur Label", {
            pointSize: 7.2,
            leading: 8,
            tracking: 120,
            justification: Justification.LEFT_ALIGN,
            fillColor: palette.paper,
            appliedFont: fontBold
        });

        styles.poolNote = makeParagraphStyle(doc, pGroup, "Bildpool Notiz", {
            pointSize: 7,
            leading: 8.5,
            justification: Justification.LEFT_ALIGN,
            fillColor: palette.muted,
            appliedFont: fontRegular
        });

        // Feiertagsname als eigene, zentrierte Zeile UNTER der Tageszahl
        styles.holidayLine = makeParagraphStyle(doc, pGroup, "Feiertag Name", {
            pointSize: 6.8,
            leading: 7.2,
            tracking: 0,
            justification: Justification.CENTER_ALIGN,
            fillColor: palette.holidayText,
            appliedFont: fontRegular
        });

        // --- Objektformate (Design-Rahmen) ---
        var oGroup = getObjectStyleGroup(doc, STYLE_GROUP);
        styles.obj = {};
        styles.obj.panel        = makeObjectStyle(doc, oGroup, "Overlay Panel",      { fill: palette.paper,        stroke: palette.none,   weight: 0 });
        styles.obj.imageFrame   = makeObjectStyle(doc, oGroup, "Bildrahmen",         { stroke: palette.none,       weight: 0 });
        styles.obj.imageGallery = makeObjectStyle(doc, oGroup, "Bildrahmen Galerie", { stroke: palette.accent,     weight: 0.5 });
        styles.obj.coverShade   = makeObjectStyle(doc, oGroup, "Cover Abdunklung",   { fill: palette.black,        stroke: palette.none,   weight: 0 });
        styles.obj.thumbLabel   = makeObjectStyle(doc, oGroup, "Miniatur Balken",    { fill: palette.black,        stroke: palette.none,   weight: 0 });
        styles.obj.accentRule   = makeObjectStyle(doc, oGroup, "Akzentlinie",        { stroke: palette.accent,     weight: 0.6 });

        // --- Zellenformate (Kalendarium) ---
        var ceGroup = getCellStyleGroup(doc, STYLE_GROUP);
        // Minimales Raster: KEINE vertikalen Linien, nur zarte
        // horizontale Wochentrenner (untere Kante). Wochenende/Feiertag
        // tragen die Struktur ueber die Flaeche. Premium-Optik.
        var gl = palette.gridLine;
        // Symmetrische Seiteneinzuege, damit die zentrierten Zahlen exakt
        // in der Spaltenmitte sitzen (unter den Wochentagen).
        var dayInset = [2.6, 1.5, 1.4, 1.5];
        styles.cell = {};
        styles.cell.weekdayHead        = makeCellStyle(doc, ceGroup, "Kalender Kopf",            { fill: palette.paper,        para: styles.weekday,   vj: VerticalJustification.CENTER_ALIGN, stroke: gl, weight: 0.5,  edges: "bottom", insets: [0.8, 1.5, 1.4, 1.5] });
        styles.cell.weekdayHeadWeekend = makeCellStyle(doc, ceGroup, "Kalender Kopf Wochenende", { fill: palette.weekendBlue,  para: styles.weekday,   vj: VerticalJustification.CENTER_ALIGN, stroke: gl, weight: 0.5,  edges: "bottom", insets: [0.8, 1.5, 1.4, 1.5] });
        styles.cell.day                = makeCellStyle(doc, ceGroup, "Kalender Tag",             { fill: palette.paper,        para: styles.dayNumber, vj: VerticalJustification.TOP_ALIGN,    stroke: gl, weight: 0.25, edges: "bottom", insets: dayInset });
        styles.cell.weekend            = makeCellStyle(doc, ceGroup, "Kalender Wochenende",      { fill: palette.weekendBlue,  para: styles.dayNumber, vj: VerticalJustification.TOP_ALIGN,    stroke: gl, weight: 0.25, edges: "bottom", insets: dayInset });
        styles.cell.holiday            = makeCellStyle(doc, ceGroup, "Kalender Feiertag",        { fill: palette.holidayGreen, para: styles.dayNumber, vj: VerticalJustification.TOP_ALIGN,    stroke: gl, weight: 0.25, edges: "bottom", insets: dayInset });
        styles.cell.empty              = makeCellStyle(doc, ceGroup, "Kalender Leer",            { fill: palette.paper,        para: styles.dayNumber, vj: VerticalJustification.TOP_ALIGN,    stroke: gl, weight: 0.25, edges: "bottom", insets: dayInset });
        styles.cell.kw                 = makeCellStyle(doc, ceGroup, "Kalender KW",              { fill: palette.paper,        para: styles.kwNumber,  vj: VerticalJustification.CENTER_ALIGN, stroke: gl, weight: 0.25, edges: "bottom", insets: [1.0, 0.6, 1.0, 0.6] });

        return styles;
    }

    function getParagraphStyleGroup(doc, name) {
        var g = doc.paragraphStyleGroups.itemByName(name);
        if (!g.isValid) g = doc.paragraphStyleGroups.add({ name: name });
        return g;
    }

    function getCharacterStyleGroup(doc, name) {
        var g = doc.characterStyleGroups.itemByName(name);
        if (!g.isValid) g = doc.characterStyleGroups.add({ name: name });
        return g;
    }

    function makeParagraphStyle(doc, group, name, props) {
        var style = group.paragraphStyles.itemByName(name);

        if (style.isValid) return style; // eigene Anpassungen nie ueberschreiben

        style = group.paragraphStyles.add({ name: name });
        applyStyleProps(style, props);
        return style;
    }

    function makeCharacterStyle(doc, group, name, props) {
        var style = group.characterStyles.itemByName(name);

        if (style.isValid) return style;

        style = group.characterStyles.add({ name: name });
        applyStyleProps(style, props);
        return style;
    }

    function applyStyleProps(style, props) {
        for (var key in props) {
            if (!props.hasOwnProperty(key)) continue;

            if (key === "fillColor" && !props[key]) continue;
            if (key === "appliedFont" && (!props[key] || !props[key].isValid)) continue;

            try { style[key] = props[key]; } catch (e0) {}
        }
    }

    /* ---- Objektformate ---- */

    function getObjectStyleGroup(doc, name) {
        var g = doc.objectStyleGroups.itemByName(name);
        if (!g.isValid) g = doc.objectStyleGroups.add({ name: name });
        return g;
    }

    function makeObjectStyle(doc, group, name, o) {
        var s = group.objectStyles.itemByName(name);
        if (s.isValid) return s; // bestehende Anpassungen nie ueberschreiben

        s = group.objectStyles.add({ name: name });

        try {
            if (o.fill) { s.enableFill = true; s.fillColor = o.fill; }
        } catch (e0) {}

        try {
            if (o.stroke) { s.enableStroke = true; s.strokeColor = o.stroke; }
            if (typeof o.weight === "number") { s.enableStroke = true; s.strokeWeight = o.weight; }
        } catch (e1) {}

        return s;
    }

    function applyObjStyle(item, os) {
        // appliedObjectStyle allein reicht nicht: lokale Formatierung
        // (z. B. strokeWeight=0 aus addRectangle oder die Default-Kontur
        // einer neuen Linie) gewinnt sonst gegen das Format. Erst nach
        // clearObjectStyleOverrides greift das Objektformat wirklich –
        // und der Designer steuert alles zentral am Format.
        try {
            if (os && os.isValid) {
                item.appliedObjectStyle = os;
                item.clearObjectStyleOverrides();
            }
        } catch (e0) {}
    }

    /* ---- Zellenformate ---- */

    function getCellStyleGroup(doc, name) {
        var g = doc.cellStyleGroups.itemByName(name);
        if (!g.isValid) g = doc.cellStyleGroups.add({ name: name });
        return g;
    }

    function makeCellStyle(doc, group, name, o) {
        var s = group.cellStyles.itemByName(name);
        if (s.isValid) return s;

        s = group.cellStyles.add({ name: name });

        try { if (o.fill) s.fillColor = o.fill; } catch (e0) {}
        try { if (o.para && o.para.isValid) s.appliedParagraphStyle = o.para; } catch (e1) {}
        try { if (o.vj) s.verticalJustification = o.vj; } catch (e2) {}

        // edges: "bottom" = nur Wochentrenner unten, "none" = randlos,
        // sonst alle 4 Kanten. Minimales Raster -> Premium-Optik.
        try {
            var wAll = o.weight || 0;
            var wT = wAll, wB = wAll, wL = wAll, wR = wAll;
            if (o.edges === "bottom") { wT = 0; wL = 0; wR = 0; wB = wAll; }
            else if (o.edges === "none") { wT = 0; wB = 0; wL = 0; wR = 0; }

            if (o.stroke) {
                s.topEdgeStrokeColor = o.stroke;
                s.bottomEdgeStrokeColor = o.stroke;
                s.leftEdgeStrokeColor = o.stroke;
                s.rightEdgeStrokeColor = o.stroke;
            }
            s.topEdgeStrokeWeight = wT;
            s.bottomEdgeStrokeWeight = wB;
            s.leftEdgeStrokeWeight = wL;
            s.rightEdgeStrokeWeight = wR;
        } catch (e3) {}

        try {
            s.topInset = o.insets[0];
            s.leftInset = o.insets[1];
            s.bottomInset = o.insets[2];
            s.rightInset = o.insets[3];
        } catch (e4) {}

        try { s.clipContentToCell = true; } catch (e5) {}

        return s;
    }

    /* ---- Musterseite ---- */

    function buildMasterPage(doc, options) {
        var name = "B-CalPro";
        var ms = null;

        try {
            var existing = doc.masterSpreads.itemByName(name);
            if (existing.isValid) ms = existing;
        } catch (e0) {}

        if (!ms) {
            ms = doc.masterSpreads.add();
            try { ms.namePrefix = "B"; ms.baseName = "CalPro"; } catch (e1) {}
        }

        var pg = ms.pages[0];
        var w = options.docWidth;
        var h = options.docHeight;
        var L = computeMonthLayout(options.layout, w, h);

        try {
            pg.marginPreferences.left = L.gx;
            pg.marginPreferences.right = w - (L.gx + L.gw);
            pg.marginPreferences.top = Math.max(6, h * 0.02);
            pg.marginPreferences.bottom = Math.max(6, h * 0.02);
        } catch (e2) {}

        // vorhandene Hilfslinien entfernen -> idempotent bei erneutem Lauf
        try {
            for (var g = pg.guides.length - 1; g >= 0; g--) pg.guides[g].remove();
        } catch (e3) {}

        var colW = L.gw / 7;
        for (var i = 0; i <= 7; i++) addGuide(pg, "V", L.gx + i * colW);

        addGuide(pg, "H", L.hTop);
        addGuide(pg, "H", L.hBottom);
        addGuide(pg, "H", L.gy);

        return ms;
    }

    // orient: "H" oder "V". Die Enum HorizontalOrVertical wird INNERHALB
    // des try aufgeloest, damit ein API-Problem nur diese Hilfslinie kostet
    // und niemals den ganzen Build abbricht.
    function addGuide(pg, orient, location) {
        try {
            var gd = pg.guides.add();
            gd.orientation = (orient === "H")
                ? HorizontalOrVertical.HORIZONTAL
                : HorizontalOrVertical.VERTICAL;
            gd.location = location;
        } catch (e0) {}
    }

    /* ============================================================
       ZEICHEN-HELFER
       ============================================================ */

    function addRectangle(page, layer, bounds) {
        var rect = page.rectangles.add();
        try { rect.itemLayer = layer; } catch (e0) {}
        rect.geometricBounds = bounds;
        rect.strokeWeight = 0;
        return rect;
    }

    function addEmptyTextFrame(page, layer, bounds) {
        var tf = page.textFrames.add();
        try { tf.itemLayer = layer; } catch (e0) {}
        tf.geometricBounds = bounds;

        try { tf.strokeWeight = 0; } catch (e1) {}
        try { tf.strokeColor = getNoneSwatchFromPage(page); } catch (e2) {}
        try { tf.fillColor = getNoneSwatchFromPage(page); } catch (e3) {}
        try { tf.textFramePreferences.insetSpacing = [0, 0, 0, 0]; } catch (e4) {}
        try { tf.textFramePreferences.ignoreWrap = true; } catch (e5) {}

        return tf;
    }

    function addText(page, layer, bounds, contents, style) {
        var tf = addEmptyTextFrame(page, layer, bounds);
        tf.contents = contents;

        try {
            if (style && style.isValid) tf.texts[0].appliedParagraphStyle = style;
        } catch (e0) {}

        return tf;
    }

    function setVerticalCenter(tf) {
        try { tf.textFramePreferences.verticalJustification = VerticalJustification.CENTER_ALIGN; } catch (e0) {}
    }

    function setOpacity(item, value) {
        try { item.transparencySettings.blendingSettings.opacity = value; } catch (e0) {}
    }

    function placeImage(frame, path) {
        var file = new File(path);
        if (!file.exists) throw new Error("Bilddatei nicht gefunden: " + path);

        try {
            while (frame.graphics.length > 0) frame.graphics[0].remove();
        } catch (e0) {}

        frame.place(file);
        frame.fit(FitOptions.FILL_PROPORTIONALLY);
        frame.fit(FitOptions.CENTER_CONTENT);
        frame.insertLabel(LABEL_IMAGE_PATH, file.fsName);
    }

    /*
        Robustes Platzieren: kann InDesign ein Bild nicht lesen
        (z. B. progressive JPEGs von WhatsApp), bleibt der Rahmen leer,
        der Build laeuft weiter und die Datei wird EINMAL gemeldet.
        Verhindert, dass ein einziges Bild den ganzen Kalender abbricht.
    */
    function tryPlaceImage(frame, path, label) {
        try {
            placeImage(frame, path);
            return true;
        } catch (e0) {
            var key = String(path).toLowerCase();
            if (!placeErrorSeen[key]) {
                placeErrorSeen[key] = true;
                placeErrors.push(baseName(path));
            }
            return false;
        }
    }

    /*
        Druckvorstufe: prueft die EFFEKTIVE Aufloesung der platzierten
        Haupt- und Deckblatt-Bilder (nach Skalierung im Rahmen).
        Miniaturen werden ignoriert, da dort die ppi bauartbedingt hoch ist.
        Liefert Liste "Label: NNN ppi" fuer alles unter warnPpi.
    */
    function checkResolution(doc, warnPpi) {
        var report = [];

        for (var i = 0; i < doc.rectangles.length; i++) {
            var rect = doc.rectangles[i];
            var role;

            try { role = rect.extractLabel(LABEL_ROLE); } catch (e0) { continue; }
            if (role !== ROLE_MONTH_IMAGE && role !== ROLE_COVER_IMAGE) continue;

            try {
                if (rect.graphics.length < 1) continue;

                var ppiArr = rect.graphics[0].effectivePpi;
                if (!ppiArr || ppiArr.length < 2) continue;

                var ppi = Math.min(ppiArr[0], ppiArr[1]);
                var mi = parseInt(rect.extractLabel(LABEL_MONTH_INDEX), 10);
                var label = role === ROLE_COVER_IMAGE ? "Deckblatt" : (monthNamesUi[mi] || "Monat");

                if (ppi < warnPpi) report.push(label + ": " + Math.round(ppi) + " ppi");
            } catch (e1) {}
        }

        return report;
    }

    /* ============================================================
       BILDTAUSCH
       ============================================================ */

    function swapImageDialog(doc, frame) {
        var role = frame.extractLabel(LABEL_ROLE);

        if (role !== ROLE_MONTH_IMAGE && role !== ROLE_COVER_IMAGE) {
            alert("Bitte einen Haupt-Bildrahmen auswählen, keinen Miniaturrahmen.");
            return;
        }

        var pool = uniqueExistingImagePaths(splitPaths(doc.extractLabel(LABEL_POOL)));
        var oldPath = frame.extractLabel(LABEL_IMAGE_PATH);

        if (!oldPath) oldPath = getGraphicLinkPath(frame);

        var monthIndexText = frame.extractLabel(LABEL_MONTH_INDEX);
        var mi = parseInt(monthIndexText, 10);

        var label = role === ROLE_COVER_IMAGE ? "Deckblatt" : monthNamesUi[mi];

        var w = new Window("dialog", APP_NAME + " - Bild tauschen");
        w.orientation = "column";
        w.alignChildren = ["fill", "top"];
        w.margins = 14;
        w.spacing = 9;

        var info = w.add("statictext", undefined,
            "Bereich: " + label + "\nAktuell: " + (oldPath ? baseName(oldPath) : "unbekannt") +
            "\nBeim Tausch wandert das aktuelle Bild zurück in den Pool.",
            { multiline: true }
        );
        info.characters = 82;

        var body = w.add("group");
        body.orientation = "row";
        body.alignChildren = ["fill", "top"];
        body.spacing = 10;

        var list = body.add("listbox", [0, 0, 455, 275], [], {
            numberOfColumns: 2,
            showHeaders: true,
            columnTitles: ["Poolbild", "Ordner"]
        });

        var prevPanel = body.add("panel", undefined, "Vorschau");
        prevPanel.orientation = "column";
        prevPanel.alignChildren = ["fill", "top"];
        prevPanel.margins = 10;

        var prevTitle = prevPanel.add("statictext", undefined, "Kein Bild gewählt", { truncate: "middle" });
        prevTitle.characters = 34;

        var prevImg = prevPanel.add("image", [0, 0, 300, 190]);
        prevImg.preferredSize = [300, 190];

        var tools = w.add("group");
        tools.orientation = "row";
        var addBtn = tools.add("button", undefined, "Bilder in Pool laden");
        var cleanBtn = tools.add("button", undefined, "Fehlende entfernen");

        var bottom = w.add("group");
        bottom.orientation = "row";
        bottom.alignment = "right";

        var okBtn = bottom.add("button", undefined, "Bild tauschen", { name: "ok" });
        var cancelBtn = bottom.add("button", undefined, "Abbrechen", { name: "cancel" });

        function refresh() {
            list.removeAll();

            for (var i = 0; i < pool.length; i++) {
                var it = list.add("item", baseName(pool[i]));
                it.subItems[0].text = folderName(pool[i]);
            }

            if (pool.length > 0) list.selection = list.items[0];
            updatePrev();
        }

        function updatePrev() {
            if (!list.selection) {
                setPreview(prevImg, prevTitle, null, "Kein Bild gewählt", 300, 190);
                return;
            }

            var p = pool[list.selection.index];
            setPreview(prevImg, prevTitle, p, baseName(p), 300, 190);
        }

        list.onChange = updatePrev;

        addBtn.onClick = function () {
            var files = openImagesDialog("Bilder in Pool laden");
            if (!files) return;

            for (var f = 0; f < files.length; f++) {
                if (files[f] instanceof File && isImageFile(files[f])) addUniquePath(pool, files[f].fsName);
            }

            pool.sort(pathSort);
            refresh();
        };

        cleanBtn.onClick = function () {
            pool = uniqueExistingImagePaths(pool);
            refresh();
        };

        cancelBtn.onClick = function () {
            w.close(0);
        };

        okBtn.onClick = function () {
            if (!list.selection) {
                alert("Bitte ein Poolbild auswählen.");
                return;
            }

            w.selectedPath = pool[list.selection.index];
            w.close(1);
        };

        refresh();

        if (w.show() !== 1 || !w.selectedPath) return;

        var newPath = w.selectedPath;
        if (!(new File(newPath)).exists) {
            alert("Datei nicht gefunden:\n" + newPath);
            return;
        }

        var oldRedraw = app.scriptPreferences.enableRedraw;

        try {
            app.scriptPreferences.enableRedraw = false;

            app.doScript(function () {
                placeImage(frame, newPath);

                removePath(pool, newPath);
                if (oldPath && (new File(oldPath)).exists) addUniquePath(pool, oldPath);
                pool.sort(pathSort);

                doc.insertLabel(LABEL_POOL, joinPaths(pool));

                if (role === ROLE_MONTH_IMAGE && !isNaN(mi)) {
                    updateAssignedForMonth(doc, mi, newPath);
                    updateBackThumbForMonth(doc, mi, newPath);
                }

                if (role === ROLE_COVER_IMAGE) {
                    doc.insertLabel(LABEL_COVER, newPath);
                }

                var layers = createLayers(doc);
                var palette = createPalette(doc, themeByIndex(parseInt(doc.extractLabel(LABEL_THEME), 10)));
                var styles = createStyles(doc, palette);
                updatePoolNote(doc, pool, layers, palette, styles);

            }, ScriptLanguage.JAVASCRIPT, undefined, UndoModes.ENTIRE_SCRIPT, APP_NAME + " Bild tauschen");

        } catch (err) {
            alert("Fehler beim Tauschen:\n\n" + err.message);
        } finally {
            try { app.scriptPreferences.enableRedraw = oldRedraw; } catch (e0) {}
        }
    }

    function updateAssignedForMonth(doc, monthIndex, newPath) {
        var assigned = splitPathsKeepEmpty(doc.extractLabel(LABEL_ASSIGNED));

        while (assigned.length < MONTH_COUNT) assigned.push("");

        assigned[monthIndex] = newPath;
        doc.insertLabel(LABEL_ASSIGNED, joinPaths(assigned));
    }

    function updateBackThumbForMonth(doc, monthIndex, newPath) {
        for (var i = 0; i < doc.rectangles.length; i++) {
            try {
                if (
                    doc.rectangles[i].extractLabel(LABEL_ROLE) === ROLE_BACK_THUMB &&
                    parseInt(doc.rectangles[i].extractLabel(LABEL_MONTH_INDEX), 10) === monthIndex
                ) {
                    placeImage(doc.rectangles[i], newPath);
                }
            } catch (e0) {}
        }
    }

    function updatePoolNote(doc, pool, layers, palette, styles) {
        try {
            for (var i = doc.textFrames.length - 1; i >= 0; i--) {
                if (doc.textFrames[i].extractLabel(LABEL_POOL_NOTE) === "1") {
                    doc.textFrames[i].remove();
                }
            }
        } catch (e0) {}

        var w = parseNumber(doc.extractLabel(LABEL_WIDTH));
        if (isNaN(w) || w < 200) w = 490;

        var text = "BILDPOOL - NICHT DRUCKEND\r" + pool.length + " übrige Bilder gespeichert.\r\r";

        for (var p = 0; p < pool.length; p++) {
            text += (p + 1) + ". " + baseName(pool[p]) + "\r";
        }

        if (pool.length === 0) text += "Keine Poolbilder vorhanden.\r";
        text += "\rZum Tauschen: Monatsbild anklicken und Script erneut starten.";

        var tf = addText(doc.pages[0], layers.pool, [8, w + 12, 180, w + 190], text, styles.poolNote);
        tf.name = "CALPRO_Bildpool_nicht_druckend";
        tf.insertLabel(LABEL_POOL_NOTE, "1");
    }

    /* ============================================================
       VORSCHAU / THUMBNAILS
       ============================================================ */

    function setPreview(imageControl, titleControl, path, label, pxW, pxH) {
        titleControl.text = label || "Kein Bild gewählt";

        try { imageControl.image = null; } catch (e0) {}

        if (!path || !(new File(path)).exists) return;

        var thumb = getOrCreateThumbnail(path, pxW, pxH);

        try {
            if (thumb && thumb.exists) imageControl.image = ScriptUI.newImage(thumb);
            else imageControl.image = ScriptUI.newImage(new File(path));
        } catch (e1) {
            try { imageControl.image = null; } catch (e2) {}
        }
    }

    function getOrCreateThumbnail(path, pxW, pxH) {
        var folder = new Folder(Folder.temp.fsName + "/calpro_thumbs");
        if (!folder.exists) folder.create();

        var source = new File(path);
        var thumb = new File(folder.fsName + "/" + hashString(source.fsName + "_" + source.modified.getTime() + "_" + pxW + "x" + pxH) + ".jpg");

        if (thumb.exists) return thumb;

        var oldUnit = app.scriptPreferences.measurementUnit;
        var oldRedraw = app.scriptPreferences.enableRedraw;
        var d = null;

        try {
            app.scriptPreferences.measurementUnit = MeasurementUnits.MILLIMETERS;
            app.scriptPreferences.enableRedraw = false;

            d = app.documents.add();
            d.documentPreferences.facingPages = false;
            d.documentPreferences.pageWidth = 150;
            d.documentPreferences.pageHeight = 95;
            d.documentPreferences.pagesPerDocument = 1;
            d.viewPreferences.rulerOrigin = RulerOrigin.PAGE_ORIGIN;

            var r = d.pages[0].rectangles.add();
            r.geometricBounds = [0, 0, 95, 150];
            r.strokeWeight = 0;
            r.contentType = ContentType.GRAPHIC_TYPE;
            r.place(new File(path));
            r.fit(FitOptions.PROPORTIONALLY);
            r.fit(FitOptions.CENTER_CONTENT);

            try { app.jpegExportPreferences.exportResolution = 110; } catch (e0) {}
            try { app.jpegExportPreferences.jpegQuality = JPEGOptionsQuality.HIGH; } catch (e1) {}
            try { app.jpegExportPreferences.jpegRenderingStyle = JPEGOptionsFormat.BASELINE_ENCODING; } catch (e2) {}

            d.exportFile(ExportFormat.JPG, thumb, false);
            d.close(SaveOptions.NO);

            return thumb;

        } catch (err) {
            try { if (d) d.close(SaveOptions.NO); } catch (e3) {}
            return null;
        } finally {
            try { app.scriptPreferences.measurementUnit = oldUnit; } catch (e4) {}
            try { app.scriptPreferences.enableRedraw = oldRedraw; } catch (e5) {}
        }
    }

    /* ============================================================
       DOKUMENT-HELFER
       ============================================================ */

    function getActiveDoc() {
        try { return app.activeDocument; } catch (e0) { return null; }
    }

    function isCalendarDoc(doc) {
        try { return doc.extractLabel(LABEL_VERSION) !== ""; } catch (e0) { return false; }
    }

    function getSelectedCalendarImageFrame() {
        if (!app.selection || app.selection.length < 1) return null;

        var obj = app.selection[0];

        if (isSwappableImage(obj)) return obj;

        try {
            if (isSwappableImage(obj.parent)) return obj.parent;
        } catch (e0) {}

        try {
            if (isSwappableImage(obj.parent.parent)) return obj.parent.parent;
        } catch (e1) {}

        return null;
    }

    function isSwappableImage(obj) {
        try {
            var role = obj.extractLabel(LABEL_ROLE);
            return role === ROLE_MONTH_IMAGE || role === ROLE_COVER_IMAGE;
        } catch (e0) {
            return false;
        }
    }

    function getGraphicLinkPath(frame) {
        try {
            if (frame.graphics.length > 0 && frame.graphics[0].itemLink) {
                return frame.graphics[0].itemLink.filePath;
            }
        } catch (e0) {}

        return "";
    }

    function getLayer(doc, name, visible, printable) {
        var layer = doc.layers.itemByName(name);
        if (!layer.isValid) layer = doc.layers.add({ name: name });

        layer.visible = visible;

        try { layer.printable = printable; } catch (e0) {}

        return layer;
    }

    function getSwatch(doc, names, fallbackName, fallbackCmyk) {
        for (var i = 0; i < names.length; i++) {
            try {
                var s = doc.swatches.itemByName(names[i]);
                if (s && s.isValid) return s;
            } catch (e0) {}
        }

        if (fallbackName && fallbackCmyk) return makeColor(doc, fallbackName, fallbackCmyk);

        return null;
    }

    function getNoneSwatchFromPage(page) {
        var doc = null;

        try { doc = page.parent.parent; } catch (e0) {}
        if (!doc) {
            try { doc = page.parent; } catch (e1) {}
        }

        if (!doc) return null;

        return getSwatch(doc, ["[None]", "[Ohne]", "None", "Ohne"], null, null);
    }

    function makeColor(doc, name, cmyk) {
        var c = doc.colors.itemByName(name);

        if (!c.isValid) {
            c = doc.colors.add({
                name: name,
                model: ColorModel.PROCESS,
                space: ColorSpace.CMYK,
                colorValue: cmyk
            });
        }

        return c;
    }

    function findFont(names) {
        for (var i = 0; i < names.length; i++) {
            try {
                var f = app.fonts.itemByName(names[i]);
                if (f && f.isValid) return f;
            } catch (e0) {}
        }

        return null;
    }

    /* ============================================================
       DATEI-HELFER
       ============================================================ */

    // Windows braucht einen Filter-STRING, macOS eine Filter-FUNKTION.
    function openImagesDialog(title) {
        if (File.fs === "Windows") {
            return File.openDialog(title, "Bilder:*.jpg;*.jpeg;*.png;*.tif;*.tiff;*.psd", true);
        }
        return File.openDialog(title, imageFileFilter, true);
    }

    function collectImages(folder, recursive) {
        var result = [];
        var items = folder.getFiles();

        for (var i = 0; i < items.length; i++) {
            var it = items[i];

            if (it instanceof File && isImageFile(it)) {
                result.push(it.fsName);
            } else if (recursive && it instanceof Folder) {
                var sub = collectImages(it, recursive);
                for (var s = 0; s < sub.length; s++) result.push(sub[s]);
            }
        }

        return result;
    }

    function imageFileFilter(f) {
        if (f instanceof Folder) return true;
        return isImageFile(f);
    }

    function isImageFile(f) {
        try {
            return f instanceof File && /\.(jpg|jpeg|png|tif|tiff|psd)$/i.test(f.name);
        } catch (e0) {
            return false;
        }
    }

    function uniqueExistingImagePaths(paths) {
        var out = [];
        var seen = {};

        for (var i = 0; i < paths.length; i++) {
            if (!paths[i]) continue;

            var f = new File(paths[i]);
            if (!f.exists || !isImageFile(f)) continue;

            var key = f.fsName.toLowerCase();

            if (!seen[key]) {
                seen[key] = true;
                out.push(f.fsName);
            }
        }

        return out;
    }

    function addUniquePath(arr, path) {
        if (!path) return;

        var f = new File(path);
        if (!f.exists || !isImageFile(f)) return;

        var key = f.fsName.toLowerCase();

        for (var i = 0; i < arr.length; i++) {
            if ((new File(arr[i])).fsName.toLowerCase() === key) return;
        }

        arr.push(f.fsName);
    }

    function removePath(arr, path) {
        var key = (new File(path)).fsName.toLowerCase();

        for (var i = arr.length - 1; i >= 0; i--) {
            if ((new File(arr[i])).fsName.toLowerCase() === key) arr.splice(i, 1);
        }
    }

    function pathSort(a, b) {
        var aa = baseName(a).toLowerCase();
        var bb = baseName(b).toLowerCase();

        if (aa < bb) return -1;
        if (aa > bb) return 1;

        return 0;
    }

    function baseName(path) {
        try { return decodeURI((new File(path)).name); } catch (e0) { return String(path); }
    }

    function folderName(path) {
        try { return decodeURI((new File(path)).parent.fsName); } catch (e0) { return ""; }
    }

    function joinPaths(paths) {
        var parts = [];

        for (var i = 0; i < paths.length; i++) {
            parts.push(paths[i] ? String(paths[i]) : "");
        }

        return parts.join(PATH_SEP);
    }

    function splitPaths(str) {
        if (!str) return [];

        var raw = String(str).split(PATH_SEP);
        var out = [];

        for (var i = 0; i < raw.length; i++) {
            if (raw[i] !== "") out.push(raw[i]);
        }

        return out;
    }

    function splitPathsKeepEmpty(str) {
        if (!str) return [];
        return String(str).split(PATH_SEP);
    }

    function parseNumber(s) {
        return parseFloat(String(s).replace(",", "."));
    }

    function countOversetTextFrames(doc) {
        var n = 0;

        for (var i = 0; i < doc.textFrames.length; i++) {
            try {
                if (doc.textFrames[i].overflows) n++;
            } catch (e0) {}
        }

        return n;
    }

    /* ============================================================
       KALENDER-LOGIK
       ============================================================ */

    function mondayIndex(dateObj) {
        var d = dateObj.getDay();
        return d === 0 ? 6 : d - 1;
    }

    // Spaltenindex 0..6 im angezeigten Raster -> Wochenende?
    function isWeekendCol(c, weekStart) {
        if (weekStart === "sunday") return c === 0 || c === 6; // So + Sa
        return c >= 5; // Sa + So
    }

    function dateKeyMMDD(d) {
        var m = d.getMonth() + 1;
        var day = d.getDate();

        return (m < 10 ? "0" + m : String(m)) + "-" + (day < 10 ? "0" + day : String(day));
    }

    function addDays(d, days) {
        var n = new Date(d.getTime());
        n.setDate(n.getDate() + days);
        return n;
    }

    // ISO-8601-Kalenderwoche
    function isoWeek(d) {
        var t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        var dayNr = (t.getDay() + 6) % 7;
        t.setDate(t.getDate() - dayNr + 3);
        var firstThursday = t.getTime();
        t.setMonth(0, 1);
        if (t.getDay() !== 4) {
            t.setMonth(0, 1 + ((4 - t.getDay()) + 7) % 7);
        }
        return 1 + Math.round((firstThursday - t.getTime()) / (7 * 24 * 3600 * 1000));
    }

    /*
        Feiertage nach Bundesland.
        Basis: bundesweite Feiertage; dazu je Bundesland die
        landesspezifischen. Mariae Himmelfahrt ist offiziell nur
        im Saarland landesweit (in Bayern nur in kath. Gemeinden).
    */
    function getHolidays(year, stateCode) {
        var h = {};

        // bundesweit
        h["01-01"] = "Neujahr";
        h["05-01"] = "Tag der Arbeit";
        h["10-03"] = "Dt. Einheit";
        h["12-25"] = "1. Weihnachtstag";
        h["12-26"] = "2. Weihnachtstag";

        var easter = easterSunday(year);

        h[dateKeyMMDD(addDays(easter, -2))] = "Karfreitag";
        h[dateKeyMMDD(addDays(easter, 1))] = "Ostermontag";
        h[dateKeyMMDD(addDays(easter, 39))] = "Christi Himmelfahrt";
        h[dateKeyMMDD(addDays(easter, 50))] = "Pfingstmontag";

        function has(codes) {
            for (var i = 0; i < codes.length; i++) {
                if (codes[i] === stateCode) return true;
            }
            return false;
        }

        if (has(["BW", "BY", "ST"])) h["01-06"] = "Hl. Drei Könige";
        if (has(["BE", "MV"])) h["03-08"] = "Frauentag";
        if (has(["BW", "BY", "HE", "NW", "RP", "SL"])) h[dateKeyMMDD(addDays(easter, 60))] = "Fronleichnam";
        if (has(["SL"])) h["08-15"] = "Mariä Himmelfahrt";
        if (has(["TH"])) h["09-20"] = "Weltkindertag";
        if (has(["BB", "HB", "HH", "MV", "NI", "SN", "ST", "SH", "TH"])) h["10-31"] = "Reformationstag";
        if (has(["BW", "BY", "NW", "RP", "SL"])) h["11-01"] = "Allerheiligen";
        if (has(["SN"])) h[dateKeyMMDD(bussUndBettag(year))] = "Buß- u. Bettag";

        return h;
    }

    // Mittwoch vor dem 23. November
    function bussUndBettag(year) {
        var d = new Date(year, 10, 22);
        while (d.getDay() !== 3) d.setDate(d.getDate() - 1);
        return d;
    }

    function easterSunday(year) {
        var a = year % 19;
        var b = Math.floor(year / 100);
        var c = year % 100;
        var d = Math.floor(b / 4);
        var e = b % 4;
        var f = Math.floor((b + 8) / 25);
        var g = Math.floor((b - f + 1) / 3);
        var h = (19 * a + b - d - g + 15) % 30;
        var i = Math.floor(c / 4);
        var k = c % 4;
        var l = (32 + 2 * e + 2 * i - h - k) % 7;
        var m = Math.floor((a + 11 * h + 22 * l) / 451);
        var month = Math.floor((h + l - 7 * m + 114) / 31);
        var day = ((h + l - 7 * m + 114) % 31) + 1;

        return new Date(year, month - 1, day);
    }

    function hashString(s) {
        var h = 0;

        if (!s) return "0";

        for (var i = 0; i < s.length; i++) {
            h = ((h << 5) - h) + s.charCodeAt(i);
            h = h & h;
        }

        if (h < 0) h = h * -1;

        return String(h);
    }

})();
