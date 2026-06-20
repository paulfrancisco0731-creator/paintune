# 🎨 Paintune

> **Turn your music into watercolor art — in real time.**

Paintune is a generative audio-visual web application that listens to live sound through your microphone and paints authentic watercolor strokes on a digital canvas. Every note, pluck, and strum becomes pigment on paper.

---

## ✨ Features

- 🎵 **Live audio analysis** — detects pitch, clarity, and volume in real time using the [Pitchy](https://github.com/ianprime0509/pitchy) pitch detection library
- 🖌️ **Authentic watercolor brush** — smooth bezier-interpolated strokes with organic capillary edges, soft bleed halos, and dark rim bloom (granulation)
- 🎨 **12-note pigment palette** — each musical note maps to a curated watercolor pigment (Indigo Blue, Raw Sienna, Rose Madder, Cobalt Blue, and more)
- 🔊 **Volume-driven opacity** — quiet sounds produce watery washes; loud playing creates thick, saturated strokes
- 💾 **Export your painting** — save the current canvas as a high-resolution PNG
- 🔒 **100% local processing** — no audio data ever leaves your device

---

## 🖥️ Interface

| Area | Description |
|---|---|
| **Canvas (left 80%)** | Full-height painting surface with warm cotton paper texture |
| **Sidebar (right 20%)** | Sound input controls, active note badge, musical metrics, pigment palette, and export actions |

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or later
- A microphone connected to your device

### Installation

```bash
# Clone the repository
git clone https://github.com/paulfrancisco0731-creator/paintune.git
cd paintune

# Install dependencies
npm install

# Start the development server
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

> **Note:** Microphone access requires either `localhost` or an `HTTPS` connection. The browser will prompt you for permission when you click **Start Listening**.

### Production Build

```bash
npm run build
```

The compiled output will be in the `dist/` folder, ready to deploy to any static host.

---

## 🎸 How to Use

1. Open the app in your browser
2. Click **Start Listening** and grant microphone access
3. Play any instrument (guitar, piano, sing — anything works!)
4. Watch the canvas fill with watercolor strokes driven by your performance
5. Click **Export Painting** to save your artwork as a PNG

---

## 🎨 Pigment Spectrum

Each of the 12 chromatic notes maps to a traditional watercolor pigment:

| Note | Pigment | Color |
|---|---|---|
| C | Indigo Blue | ![#183059](https://placehold.co/12x12/183059/183059.png) |
| C# | Crimson Alizarin | ![#7a273e](https://placehold.co/12x12/7a273e/7a273e.png) |
| D | Raw Sienna | ![#c47233](https://placehold.co/12x12/c47233/c47233.png) |
| D# | Teal Green | ![#558279](https://placehold.co/12x12/558279/558279.png) |
| E | Yellow Ochre | ![#d9ad43](https://placehold.co/12x12/d9ad43/d9ad43.png) |
| F | Rose Madder | ![#c95b68](https://placehold.co/12x12/c95b68/c95b68.png) |
| F# | Viridian | ![#34654d](https://placehold.co/12x12/34654d/34654d.png) |
| G | Cobalt Blue | ![#29588c](https://placehold.co/12x12/29588c/29588c.png) |
| G# | Cobalt Violet | ![#5e4173](https://placehold.co/12x12/5e4173/5e4173.png) |
| A | Burnt Orange | ![#db6b3d](https://placehold.co/12x12/db6b3d/db6b3d.png) |
| A# | Payne's Grey | ![#3c474d](https://placehold.co/12x12/3c474d/3c474d.png) |
| B | Olive Green | ![#9c9e4f](https://placehold.co/12x12/9c9e4f/9c9e4f.png) |

---

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| **Vanilla JS (ES Modules)** | Core application logic |
| **HTML5 Canvas API** | Dual-buffer painting engine (wet + dry layers) |
| **Vite** | Build tooling and dev server |
| **Web Audio API** | Microphone capture and frequency analysis |
| **[Pitchy](https://github.com/ianprime0509/pitchy)** | Real-time pitch detection (McLeod Pitch Method) |
| **Simplex Noise** | Organic brush edge deformation |
| **SVG Filters** | Realistic watercolor paper grain texture |

---

## 🏗️ Project Structure

```
paintune/
├── index.html          # App shell & sidebar layout
├── src/
│   ├── main.js         # Entry point, animation loop, UI wiring
│   ├── audio.js        # AudioEngine — mic capture, pitch & volume analysis
│   ├── watercolor.js   # WatercolorEngine — brush physics & painting
│   └── index.css       # Full-viewport split-screen layout & design system
├── public/             # Static assets
└── package.json
```

---

## 📄 License

MIT © [Paul Francisco](https://github.com/paulfrancisco0731-creator)
