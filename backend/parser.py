"""
Parser for Crossword Compiler XML files.
Handles both blocked grids and bar grids (bold cell-wall style).
Bar attributes (top-bar, right-bar, bottom-bar, left-bar) are preserved
on each cell for the frontend renderer to draw thick borders.
"""

import xml.etree.ElementTree as ET

CC_NS  = "http://crossword.info/xml/crossword-compiler"
RP_NS  = "http://crossword.info/xml/rectangular-puzzle"

def _tag(ns, local):
    return f"{{{ns}}}{local}"

def parse_crossword_xml(content: bytes) -> dict:
    root = ET.fromstring(content)

    rp = root.find(_tag(RP_NS, "rectangular-puzzle"))
    if rp is None:
        # Try without namespace
        rp = root.find("rectangular-puzzle")
    if rp is None:
        raise ValueError("No <rectangular-puzzle> element found")

    # Metadata — try both namespaced and bare tags
    meta = rp.find(_tag(RP_NS, "metadata")) or rp.find("metadata")
    def m(tag):
        if meta is None:
            return ""
        # Only direct children to avoid matching <title> inside <clues>
        for child in meta:
            local = child.tag.split('}')[-1] if '}' in child.tag else child.tag
            if local == tag:
                return child.text.strip() if child.text else ""
        return ""

    title  = m("title") or "Untitled"
    author = m("creator") or ""

    cw = rp.find(_tag(RP_NS, "crossword")) or rp.find("crossword")
    if cw is None:
        raise ValueError("No <crossword> element found")

    grid_el = cw.find(_tag(RP_NS, "grid")) or cw.find("grid")
    if grid_el is None:
        raise ValueError("No <grid> element found")

    width  = int(grid_el.attrib["width"])
    height = int(grid_el.attrib["height"])

    # Parse cells
    cells = {}
    for cell_el in grid_el.iter():
        if cell_el.tag not in (_tag(RP_NS, "cell"), "cell"):
            continue
        a   = cell_el.attrib
        x   = int(a["x"])
        y   = int(a["y"])
        key = (x, y)

        cell = {
            "x": x,
            "y": y,
            "type": a.get("type", "letter"),   # "letter" | "block"
            "solution": a.get("solution", ""),
            "number": a.get("number", None),
            # Bar crossword wall attributes — None means absent (not a bar)
            "top_bar":    a.get("top-bar",    None),
            "right_bar":  a.get("right-bar",  None),
            "bottom_bar": a.get("bottom-bar", None),
            "left_bar":   a.get("left-bar",   None),
        }
        cells[key] = cell

    # Detect grid type
    has_bars   = any(
        c["top_bar"] or c["right_bar"] or c["bottom_bar"] or c["left_bar"]
        for c in cells.values()
    )
    has_blocks = any(c["type"] == "block" for c in cells.values())
    grid_type  = "bar" if has_bars and not has_blocks else "block"

    # Parse words  (x="1-7" y="1"  → across;  x="1" y="1-7" → down)
    words = {}
    for w in cw.iter():
        if w.tag not in (_tag(RP_NS, "word"), "word"):
            continue
        wid    = w.attrib["id"]
        x_attr = w.attrib.get("x", "")
        y_attr = w.attrib.get("y", "")

        if "-" in x_attr:
            direction = "across"
            x_start, x_end = map(int, x_attr.split("-"))
            y_coord = int(y_attr)
            cell_coords = [(xi, y_coord) for xi in range(x_start, x_end + 1)]
        elif "-" in y_attr:
            direction = "down"
            y_start, y_end = map(int, y_attr.split("-"))
            x_coord = int(x_attr)
            cell_coords = [(x_coord, yi) for yi in range(y_start, y_end + 1)]
        else:
            # Single-cell word — skip
            continue

        words[wid] = {
            "id":        wid,
            "direction": direction,
            "cells":     cell_coords,
        }

    # Parse clues
    clues = {}
    for clues_el in cw.iter():
        if clues_el.tag not in (_tag(RP_NS, "clues"), "clues"):
            continue
        for clue_el in clues_el:
            if clue_el.tag not in (_tag(RP_NS, "clue"), "clue"):
                continue
            a = clue_el.attrib
            wid    = a.get("word")
            number = a.get("number")
            fmt    = a.get("format", "")
            text   = clue_el.text or ""
            if wid:
                clues[wid] = {
                    "word_id": wid,
                    "number":  number,
                    "format":  fmt,
                    "text":    text.strip(),
                }

    # Serialise cells as a flat list for JSON
    cells_list = []
    for (x, y), c in sorted(cells.items(), key=lambda kv: (kv[0][1], kv[0][0])):
        cells_list.append(c)

    # Attach clue numbers to words via clues lookup
    words_list = []
    for wid, w in words.items():
        clue = clues.get(wid, {})
        words_list.append({
            **w,
            "number": clue.get("number"),
            "clue":   clue.get("text", ""),
            "format": clue.get("format", ""),
        })

    return {
        "title":     title,
        "author":    author,
        "width":     width,
        "height":    height,
        "grid_type": grid_type,   # "block" | "bar"
        "cells":     cells_list,
        "words":     words_list,
    }
