# BigQuery Release Notes Hub 🚀

A sleek, modern web application built with Python Flask and vanilla HTML, CSS, and JavaScript. The app parses the Google Cloud BigQuery release notes Atom feed, splits daily updates into individual items by category, and provides an interactive dashboard with search, filtering, and a custom Tweet composer to share updates directly on X (formerly Twitter).

---

## ✨ Features

- **Smart Feed Splitting**: Parses the standard BigQuery Atom feed and segments consolidated daily release updates (e.g. splitting a "Feature" and an "Issue" that happened on the same day) into individual interactive cards.
- **Dynamic Live Search**: Filter release notes in real time by keywords (e.g., "JSON", "pricing", "Studio") across title, category, and description text.
- **Category Pill Filters**: Quick filter tabs to drill down into specific update types (Features, Changes, Issues, Fixes, Announcements, and Deprecated updates).
- **Client-Side Sorting**: Easily toggle between viewing the newest releases first or the oldest releases first.
- **Twitter / X Integration**:
  - **Single Tweet**: Tweet a single release update directly from its card.
  - **Multi-Select Drawer**: Select multiple updates using checkboxes. A floating bottom bar automatically counts selections and lets you compose a merged tweet summarizing all chosen items.
- **Smart Tweet Composer Modal**:
  - **Templates**: Swap between **Standard**, **Minimal**, and **Detailed** formats.
  - **Auto-Truncation**: Automatically slices descriptions and appends `...` to ensure the final tweet text (including hashtags and URLs) remains strictly within X's 280-character limit.
  - **Progress Ring**: An interactive SVG circular character-counter changes color (Blue ➔ Amber ➔ Red) to notify you of limits.

---

## 🛠️ Technology Stack

- **Backend**: 
  - Python 3.x
  - Flask (routing & templating)
  - Feedparser (Atom/RSS parsing)
  - Requests (HTTP feed retrieval)
- **Frontend**:
  - Vanilla HTML5 (semantic layout)
  - Vanilla CSS3 (custom properties, CSS Grid, responsive design, animations, glassmorphism)
  - Vanilla ES6 JavaScript (reactive DOM, state manager, sharing integrations)
  - Google Fonts (Outfit & Plus Jakarta Sans)

---

## 📂 Directory Structure

```text
bq-releases-notes/
│
├── app.py                # Flask server application (feeds fetch, parsing, caching)
├── requirements.txt      # Python dependencies
├── .gitignore            # Git exclusion rules
├── README.md             # Project documentation (this file)
│
├── templates/
│   └── index.html        # Main dashboard HTML template
│
└── static/
    ├── css/
    │   └── style.css     # Premium UI stylesheet (dark mode, layout grids)
    └── js/
        └── main.js       # Client state, filters, composer logic, and sharing
```

---

## 🚀 Getting Started

### 1. Prerequisites
Ensure you have **Python 3.8+** and **pip** installed on your system.

### 2. Clone and Setup
Navigate to the project directory and create a virtual environment (optional but recommended):
```bash
# Create a virtual environment
python -m venv .venv

# Activate it (Windows)
.venv\Scripts\activate

# Activate it (macOS/Linux)
source .venv/bin/activate
```

### 3. Install Dependencies
Install the required packages using pip:
```bash
pip install -r requirements.txt
```

### 4. Run the Application
Start the Flask development server:
```bash
python app.py
```

Open your browser and navigate to:
👉 **[http://127.0.0.1:5000](http://127.0.0.1:5000)**

---

## 🔒 Feed Caching
The application utilizes an in-memory caching system configured in `app.py`. Feed contents are cached for **30 minutes** to:
1. Maximize page loading speeds.
2. Avoid hitting Google Cloud feed endpoints excessively, protecting against client rate limits.
3. The cache can be manually bypassed at any time by clicking the **Refresh** button on the UI header.

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
