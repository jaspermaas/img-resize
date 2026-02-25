#  Rapid Pic Resize

Browser-basiertes Tool zum Batch-Resizing von Bildern auf Mindestauflösung 19201080 px (Querformat) bzw. 10801920 px (Hochformat)  ohne Server, ohne Upload.

## Funktionsweise

- Bilder per Drag & Drop oder Datei-Dialog hinzufügen (JPEG, PNG, WebP, AVIF, BMP, GIF )
- Querformat-Bilder werden auf mindestens **19201080 px** skaliert, Hochformat auf mindestens **10801920 px** (Cover-Modus: beide Achsen erreichen das Minimum)
- Bilder, die die Mindestauflösung nicht erfüllen, werden **übersprungen** und visuell markiert
- Alle verarbeiteten Bilder als **ZIP-Datei** herunterladen
- Alles läuft **lokal im Browser**  keine Daten verlassen den Computer

## Entwicklung

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Stack

- [Vite](https://vitejs.dev/) + [React](https://react.dev/) + TypeScript
- [JSZip](https://stuk.github.io/jszip/) für die ZIP-Erstellung
- HTML5 Canvas API für die clientseitige Bildverarbeitung
