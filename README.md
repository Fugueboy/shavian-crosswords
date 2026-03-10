# 𐑖𐑱𐑝𐑾𐑯 Shavian Crosswords

A self-hosted crossword platform for puzzles written in the Shavian alphabet.

## Features

- Uploads Crossword Compiler XML files directly (both blocked and bar grids)
- Full Shavian rendering using the Noto Sans Shavian font
- Interactive solver with check/reveal tools
- On-screen Shavian keyboard (optional toggle) for mobile
- Progress saved in browser localStorage

## Setup

### 1. Install dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Configure (optional)

Set environment variables before running, or use the defaults:

| Variable     | Default    | Description                  |
|--------------|------------|------------------------------|
| `ADMIN_USER` | `admin`    | Admin username               |
| `ADMIN_PASS` | `shavian`  | Admin password — change this!|
| `DB_PATH`    | `crosswords.db` | SQLite database path    |

### 3. Run

```bash
cd backend
uvicorn main:app --reload --port 8000
```

Then open http://localhost:8000

## Usage

### Uploading a crossword

Go to http://localhost:8000/admin (you'll be prompted for your admin credentials).

Upload a Crossword Compiler `.xml` file. Both blocked grids and bar grids are supported.

### Solving

- **Click** a cell to select it; **click again** to toggle across/down
- **Type** Shavian letters directly (if your OS supports it), or use the on-screen keyboard (⌨ button)
- **Arrow keys** move cell by cell; **Tab/Shift+Tab** moves between words
- **Backspace** clears the current cell and moves back
- Use **Check Word / Check All** to highlight errors
- Use the **Reveal** menu for hints

## Deployment

For production, use a process manager like `systemd` or `supervisor`, and put Nginx in front:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
    }
}
```

For HTTPS, use Certbot.

## Bar crossword support

Bar crosswords (no black squares, bold cell walls instead) are parsed automatically from the Crossword Compiler XML `top-bar`, `right-bar`, `bottom-bar`, `left-bar` cell attributes. The renderer draws thick borders wherever these are set.
