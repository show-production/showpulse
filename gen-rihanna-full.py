#!/usr/bin/env python3
"""
Generate complete Rihanna ANTI World Tour mock data for ShowPulse.
Outputs:
  - rihanna-show.json      (full showpulse-data.json replacement)
  - rihanna-cuesheet.csv   (CSV cue sheet for import/print)
  - setup-users.sh          (curl commands to create 24 users via API)

12 acts, 12 departments, 20+ cues per act, 74 minutes total.
Each number starts and ends with blackout.
"""

import json
import uuid
import os

OUT_DIR = os.path.dirname(os.path.abspath(__file__))

# ═══════════════════════════════════════════════════════════════
#  DEPARTMENTS (12)
# ═══════════════════════════════════════════════════════════════

DEPT_DEFS = [
    ("Lighting",     "#FFD700"),
    ("Sound",        "#FF4444"),
    ("Video",        "#4488FF"),
    ("Pyro",         "#FF6600"),
    ("Lasers",       "#00FF44"),
    ("SFX",          "#FF00AA"),
    ("Rigging",      "#AA88FF"),
    ("Wardrobe",     "#FF88CC"),
    ("Stage Mgr",    "#E0E0E0"),
    ("Backline",     "#88CCFF"),
    ("Comms",        "#BBBBBB"),
    ("Follow Spots", "#FFAA00"),
]

departments = []
D = {}  # name -> id mapping
for name, color in DEPT_DEFS:
    uid = str(uuid.uuid4())
    departments.append({"id": uid, "name": name, "color": color})
    D[name] = uid

# ═══════════════════════════════════════════════════════════════
#  ACTS (12 songs, 74 minutes total)
# ═══════════════════════════════════════════════════════════════

SONG_DEFS = [
    # (act_name, start_sec, duration_sec)
    ("Act 1 \u2014 Desperado (Opening)",       0,    330),   # 0:00 - 5:30
    ("Act 2 \u2014 Pon De Replay",             360,  330),   # 6:00 - 11:30
    ("Act 3 \u2014 SOS",                       720,  330),   # 12:00 - 17:30
    ("Act 4 \u2014 Umbrella",                  1080, 390),   # 18:00 - 24:30
    ("Act 5 \u2014 Unfaithful",                1500, 330),   # 25:00 - 30:30
    ("Act 6 \u2014 Stay",                      1860, 330),   # 31:00 - 36:30
    ("Act 7 \u2014 Rude Boy",                  2220, 360),   # 37:00 - 43:00
    ("Act 8 \u2014 Only Girl (In The World)",  2610, 360),   # 43:30 - 49:30
    ("Act 9 \u2014 Where Have You Been",       3000, 360),   # 50:00 - 56:00
    ("Act 10 \u2014 Work",                     3390, 360),   # 56:30 - 62:30
    ("Act 11 \u2014 Diamonds",                 3780, 390),   # 63:00 - 69:30
    ("Act 12 \u2014 We Found Love (Finale)",   4200, 240),   # 70:00 - 74:00
]

acts = []
for i, (name, start, dur) in enumerate(SONG_DEFS, 1):
    uid = str(uuid.uuid4())
    acts.append({"id": uid, "name": name, "sort_order": i})
    # Attach metadata for cue generation
    acts[-1]["_start"] = start
    acts[-1]["_dur"] = dur


# ═══════════════════════════════════════════════════════════════
#  HELPERS
# ═══════════════════════════════════════════════════════════════

def sec_to_tc(s):
    """Convert seconds to Timecode object {hours, minutes, seconds, frames}."""
    s = max(0, int(s))
    return {
        "hours": s // 3600,
        "minutes": (s % 3600) // 60,
        "seconds": s % 60,
        "frames": 0,
    }

def tc_to_str(tc):
    """Format TC object as HH:MM:SS:FF string."""
    return f"{tc['hours']:02d}:{tc['minutes']:02d}:{tc['seconds']:02d}:{tc['frames']:02d}"

CUE_NUM = [0]  # mutable counter

def cue(act_id, act_idx, dept, label, time_sec, warn=10, dur=None,
        notes="", armed=True, cont="stop", post_wait=None):
    """Create a single cue dict."""
    CUE_NUM[0] += 1
    local = CUE_NUM[0] - sum(len(a.get("_cue_count", [])) for a in acts[:act_idx])
    c = {
        "id": str(uuid.uuid4()),
        "department_id": D[dept],
        "cue_number": f"Q{act_idx+1}.{CUE_NUM[0]:03d}",
        "label": label,
        "trigger_tc": sec_to_tc(time_sec),
        "warn_seconds": warn,
        "notes": notes,
        "armed": armed,
        "continue_mode": cont,
        "act_id": act_id,
    }
    if dur is not None:
        c["duration"] = dur
    if post_wait is not None:
        c["post_wait"] = post_wait
    return c


# ═══════════════════════════════════════════════════════════════
#  CUE GENERATION — Per-act templates
# ═══════════════════════════════════════════════════════════════

# Each act uses percentage-based offsets within its duration,
# customized with song-specific labels and effects.

all_cues = []

def gen_standard_act(act_idx, song_label, extras=None):
    """Generate 22-26 cues for a standard act.
    extras: list of (pct, dept, label, warn, dur, notes, cont) tuples for song-specific cues.
    """
    a = acts[act_idx]
    aid = a["id"]
    t0 = a["_start"]
    dur = a["_dur"]
    cues = []

    def t(pct):
        return t0 + int(dur * pct)

    # ── BLACKOUT + STANDBY (0-2%) ──
    cues.append(cue(aid, act_idx, "Lighting", f"Blackout — Pre {song_label}", t(0.0), 5, 3, "Full stage blackout"))
    cues.append(cue(aid, act_idx, "Stage Mgr", f"Standby {song_label}", t(0.006), 5, notes="All depts standby"))
    cues.append(cue(aid, act_idx, "Comms", f"Channel check — {song_label}", t(0.01), 3, notes="Verify all channels clear"))

    # ── TRACK START + VIDEO (1.5-3%) ──
    cues.append(cue(aid, act_idx, "Sound", f"Track start — {song_label}", t(0.015), 8, dur=dur-15, notes="Main playback"))
    cues.append(cue(aid, act_idx, "Video", f"Content load — {song_label}", t(0.015), 8, dur=dur-20, notes="Main screen content"))

    # ── INTRO (2.5-5%) ──
    cues.append(cue(aid, act_idx, "Lighting", f"Opening look — {song_label}", t(0.025), 5, 15, "Wash + key from DSR", cont="auto_continue", post_wait=2.0))
    cues.append(cue(aid, act_idx, "Follow Spots", f"Spots pick up — {song_label}", t(0.03), 8, notes="Pick up artist CS"))
    cues.append(cue(aid, act_idx, "Lasers", f"Opening lasers — {song_label}", t(0.04), 10, 20, "Fan pattern green"))

    # ── VERSE 1 (10-20%) ──
    cues.append(cue(aid, act_idx, "Lighting", f"Verse 1 — {song_label}", t(0.10), 5, 30, "Cool wash, low intensity"))
    cues.append(cue(aid, act_idx, "Video", f"Verse 1 content — {song_label}", t(0.11), 8, 25, "Lyrics + abstract"))
    cues.append(cue(aid, act_idx, "Backline", f"Instrument preset — {song_label}", t(0.12), 5, notes="Verify guitar/keys preset"))

    # ── PRE-CHORUS (25-30%) ──
    cues.append(cue(aid, act_idx, "Lighting", f"Pre-chorus build — {song_label}", t(0.25), 5, 12, "Intensity ramp 50→80%", cont="auto_continue", post_wait=1.5))

    # ── CHORUS (30-45%) ──
    cues.append(cue(aid, act_idx, "Pyro", f"Chorus hit — {song_label}", t(0.30), 15, notes="Gerbs x8 DSL/DSR"))
    cues.append(cue(aid, act_idx, "Lighting", f"Chorus — {song_label}", t(0.31), 5, 25, "Full wash + strobes"))
    cues.append(cue(aid, act_idx, "Lasers", f"Chorus lasers — {song_label}", t(0.32), 10, 20, "Beam array full house"))
    cues.append(cue(aid, act_idx, "SFX", f"CO2 jets — {song_label}", t(0.33), 12, notes="CO2 x4 downstage"))

    # ── VERSE 2 (45-55%) ──
    cues.append(cue(aid, act_idx, "Lighting", f"Verse 2 — {song_label}", t(0.45), 5, 25, "Warm wash, medium"))
    cues.append(cue(aid, act_idx, "Video", f"Verse 2 content — {song_label}", t(0.46), 8, 25, "Band cam + graphics"))

    # ── BRIDGE (60-72%) ──
    cues.append(cue(aid, act_idx, "Lighting", f"Bridge — {song_label}", t(0.60), 5, 20, "Intimate spot only"))
    cues.append(cue(aid, act_idx, "Rigging", f"Set piece move — {song_label}", t(0.62), 15, 10, notes="Platform raise 2m, safety check before move"))

    # ── FINAL CHORUS (75-85%) ──
    cues.append(cue(aid, act_idx, "Lighting", f"Final chorus — {song_label}", t(0.75), 5, 25, "Maximum intensity"))
    cues.append(cue(aid, act_idx, "Follow Spots", f"Spots wide — {song_label}", t(0.76), 8, notes="Widen to full stage"))

    # ── OUTRO (88-95%) ──
    cues.append(cue(aid, act_idx, "Wardrobe", f"Quick change standby — {song_label}", t(0.88), 10, notes="Next costume ready SR"))
    cues.append(cue(aid, act_idx, "Lighting", f"Outro fade — {song_label}", t(0.92), 5, 8, "Slow fade to specials"))

    # ── BLACKOUT (100%) ──
    cues.append(cue(aid, act_idx, "Lighting", f"Blackout — End {song_label}", t(0.98), 5, 3, "Full blackout"))

    # ── EXTRAS (song-specific) ──
    if extras:
        for ex in extras:
            pct, dept, label, warn, edur, enotes, econt = ex
            cues.append(cue(aid, act_idx, dept, label, t(pct), warn, edur, enotes, cont=econt))

    # Sort by timecode
    cues.sort(key=lambda c: (
        c["trigger_tc"]["hours"],
        c["trigger_tc"]["minutes"],
        c["trigger_tc"]["seconds"],
        c["trigger_tc"]["frames"],
    ))
    return cues


# ── Act 1: Desperado (Opening) — dramatic intro ──
all_cues.extend(gen_standard_act(0, "Desperado", extras=[
    (0.05, "Rigging", "Descend center platform — Desperado", 15, 8, "Artist entrance from above", "stop"),
    (0.50, "SFX", "Flame bars — Desperado", 15, None, "Flame bars x6 upstage", "stop"),
    (0.70, "Pyro", "Waterfall gerbs — Desperado", 15, None, "Waterfall gerbs US truss", "stop"),
]))

# ── Act 2: Pon De Replay — high energy, lots of movement ──
all_cues.extend(gen_standard_act(1, "Pon De Replay", extras=[
    (0.20, "SFX", "Confetti burst — Pon De Replay", 12, None, "Gold confetti cannons x4", "stop"),
    (0.55, "Pyro", "Flame pots — Pon De Replay", 15, None, "Flame pots x8 perimeter", "stop"),
    (0.82, "SFX", "Streamers — Pon De Replay", 10, None, "Streamer cannons DSL/DSR", "stop"),
]))

# ── Act 3: SOS — pulsing, rhythmic ──
all_cues.extend(gen_standard_act(2, "SOS", extras=[
    (0.15, "Lasers", "Tunnel effect — SOS", 10, 30, "Laser tunnel green/blue", "stop"),
    (0.50, "SFX", "Low fog — SOS", 10, 45, "Cryo fog floor level", "stop"),
]))

# ── Act 4: Umbrella — iconic, longer act ──
all_cues.extend(gen_standard_act(3, "Umbrella", extras=[
    (0.08, "Rigging", "Rain curtain deploy — Umbrella", 15, 180, "Water effect upstage scrim", "stop"),
    (0.20, "SFX", "Rain SFX start — Umbrella", 10, 150, "Theatrical rain machine", "stop"),
    (0.35, "Pyro", "Spark shower — Umbrella", 15, None, "Silver spark rain from truss", "stop"),
    (0.70, "Rigging", "Rain curtain retract — Umbrella", 15, 20, "Retract water scrim", "stop"),
    (0.85, "SFX", "Rain SFX stop — Umbrella", 8, None, "Kill rain machine", "stop"),
]))

# ── Act 5: Unfaithful — intimate, stripped back ──
all_cues.extend(gen_standard_act(4, "Unfaithful", extras=[
    (0.08, "Rigging", "Piano reveal — Unfaithful", 15, 10, "Rotate platform to reveal piano", "stop"),
    (0.50, "Video", "Audience cam — Unfaithful", 8, 60, "Switch to audience IMAG", "stop"),
]))

# ── Act 6: Stay — emotional ballad ──
all_cues.extend(gen_standard_act(5, "Stay", extras=[
    (0.05, "Sound", "Acoustic mix — Stay", 8, None, "Switch to acoustic submix", "stop"),
    (0.10, "Lighting", "Single spot — Stay", 5, 90, "Single tight spot CS", "stop"),
    (0.80, "Video", "Starfield content — Stay", 8, 40, "Slow starfield on screens", "stop"),
]))

# ── Act 7: Rude Boy — party energy ──
all_cues.extend(gen_standard_act(6, "Rude Boy", extras=[
    (0.15, "Lasers", "Beam sweep — Rude Boy", 10, 40, "RGB beam sweep audience", "stop"),
    (0.40, "SFX", "CO2 cryo cannons — Rude Boy", 12, None, "Cryo x6 thrust stage", "stop"),
    (0.55, "Pyro", "Concussion mortar — Rude Boy", 15, None, "4x concussion DS", "stop"),
    (0.70, "SFX", "Confetti — Rude Boy", 10, None, "Multi-color confetti full house", "stop"),
]))

# ── Act 8: Only Girl (In The World) — euphoric ──
all_cues.extend(gen_standard_act(7, "Only Girl", extras=[
    (0.10, "SFX", "Flame jets — Only Girl", 15, None, "Flame jets x8 along thrust", "stop"),
    (0.35, "Pyro", "Gerb waterfall — Only Girl", 15, None, "Silver gerbs from truss line", "stop"),
    (0.55, "Lasers", "Fan array — Only Girl", 10, 30, "Full RGB fan array", "stop"),
    (0.80, "SFX", "CO2 + confetti — Only Girl", 12, None, "Simultaneous CO2 + gold confetti", "stop"),
]))

# ── Act 9: Where Have You Been — tribal, powerful ──
all_cues.extend(gen_standard_act(8, "Where Have You Been", extras=[
    (0.05, "Rigging", "Cage descend — WHYB", 15, 12, "Performance cage from grid", "stop"),
    (0.18, "Lasers", "Cage lasers — WHYB", 10, 50, "Tight beam cage outline", "stop"),
    (0.50, "Pyro", "Line rockets — WHYB", 15, None, "Comet rockets x6", "stop"),
    (0.75, "Rigging", "Cage ascend — WHYB", 15, 12, "Retract cage", "stop"),
]))

# ── Act 10: Work — dancehall vibes ──
all_cues.extend(gen_standard_act(9, "Work", extras=[
    (0.12, "Video", "Caribbean content — Work", 8, 120, "Tropical island visuals", "stop"),
    (0.25, "SFX", "Low fog burst — Work", 10, 30, "Thick low fog DS", "stop"),
    (0.55, "Pyro", "Flame pots circle — Work", 15, None, "360 flame circle thrust", "stop"),
]))

# ── Act 11: Diamonds — building anthem ──
all_cues.extend(gen_standard_act(10, "Diamonds", extras=[
    (0.05, "Rigging", "Diamond set piece — Diamonds", 15, 15, "Raise diamond chandelier CS", "stop"),
    (0.15, "Lighting", "Crystal refraction — Diamonds", 5, 120, "Mirror ball + tight beams", "stop"),
    (0.50, "Pyro", "Silver rain — Diamonds", 15, None, "Silver spark rain full stage", "stop"),
    (0.65, "SFX", "Mylar confetti — Diamonds", 10, None, "Silver mylar confetti drop", "stop"),
    (0.85, "Rigging", "Chandelier retract — Diamonds", 15, 12, "Lower diamond piece", "stop"),
]))

# ── Act 12: We Found Love (Finale) — everything ──
all_cues.extend(gen_standard_act(11, "We Found Love", extras=[
    (0.10, "Pyro", "Opening volley — WFL Finale", 15, None, "Concussion x8 + gerbs x12", "stop"),
    (0.15, "SFX", "Full CO2 — WFL Finale", 12, None, "Every CO2 jet simultaneous", "stop"),
    (0.20, "Lasers", "Full array — WFL Finale", 10, 60, "All laser units max output", "stop"),
    (0.30, "SFX", "Confetti cannons — WFL Finale", 10, None, "All confetti cannons fire", "stop"),
    (0.40, "Pyro", "Flame bars max — WFL Finale", 15, None, "All flame bars sustained", "stop"),
    (0.50, "SFX", "Streamers + CO2 — WFL Finale", 12, None, "Streamers + cryo combo", "stop"),
    (0.60, "Pyro", "Comet rockets — WFL Finale", 15, None, "Comet x12 all positions", "stop"),
    (0.70, "SFX", "Final confetti — WFL Finale", 10, None, "Gold + silver full house drop", "stop"),
    (0.80, "Pyro", "Finale waterfall — WFL Finale", 15, None, "Waterfall gerbs every truss", "stop"),
    (0.85, "Rigging", "Banner drop — WFL Finale", 15, None, "Tour banner unfurl US", "stop"),
]))

# ═══════════════════════════════════════════════════════════════
#  USERS (24)
# ═══════════════════════════════════════════════════════════════

USER_DEFS = [
    # (name, pin, role, department_names[])
    # Admins (2)
    ("Sarah Chen",      "9901", "admin",     []),
    ("Marcus Webb",     "9902", "admin",     []),
    # Managers (3)
    ("Tom Alvarez",     "8801", "manager",   []),
    ("Rachel Kim",      "8802", "manager",   []),
    ("James O'Brien",   "8803", "manager",   []),
    # Operators (8)
    ("Nina Patel",      "7701", "operator",  []),
    ("Chris Tanaka",    "7702", "operator",  []),
    ("Alex Rivera",     "7703", "operator",  []),
    ("Sam Okafor",      "7704", "operator",  []),
    ("Jordan Blake",    "7705", "operator",  []),
    ("Mia Fernandez",   "7706", "operator",  []),
    ("Tyler Brooks",    "7707", "operator",  []),
    ("Dana Morrison",   "7708", "operator",  []),
    # Crew Leads (6) — filtered to their departments
    ("Leo Chang",       "6601", "crew_lead", ["Lighting"]),
    ("Emma Schmidt",    "6602", "crew_lead", ["Sound"]),
    ("Omar Hassan",     "6603", "crew_lead", ["Video"]),
    ("Priya Sharma",    "6604", "crew_lead", ["Pyro", "SFX"]),
    ("Jake Novak",      "6605", "crew_lead", ["Rigging"]),
    ("Chloe Martin",    "6606", "crew_lead", ["Lasers", "Follow Spots"]),
    # Viewers (5) — filtered to their departments
    ("Ben Torres",      "5501", "viewer",    ["Stage Mgr", "Comms"]),
    ("Zoe Williams",    "5502", "viewer",    ["Wardrobe"]),
    ("Kai Nguyen",      "5503", "viewer",    ["Backline", "Sound"]),
    ("Lily Foster",     "5504", "viewer",    ["Lighting", "Follow Spots"]),
    ("Ryan Cooper",     "5505", "viewer",    ["Video", "SFX"]),
]

users = []
for name, pin, role, dept_names in USER_DEFS:
    users.append({
        "id": str(uuid.uuid4()),
        "name": name,
        "pin": pin,
        "role": role,
        "departments": [D[dn] for dn in dept_names],
    })


# ═══════════════════════════════════════════════════════════════
#  CLEAN ACTS (remove internal metadata)
# ═══════════════════════════════════════════════════════════════

clean_acts = [{"id": a["id"], "name": a["name"], "sort_order": a["sort_order"]} for a in acts]

# ═══════════════════════════════════════════════════════════════
#  OUTPUT: JSON (showpulse-data.json format)
# ═══════════════════════════════════════════════════════════════

show_data = {
    "show_name": "Rihanna \u2014 ANTI World Tour",
    "departments": departments,
    "cues": all_cues,
    "acts": clean_acts,
    "users": users,
}

json_path = os.path.join(OUT_DIR, "rihanna-show.json")
with open(json_path, "w", encoding="utf-8") as f:
    json.dump(show_data, f, indent=2, ensure_ascii=False)

# ═══════════════════════════════════════════════════════════════
#  OUTPUT: CSV (matches ShowPulse export format)
# ═══════════════════════════════════════════════════════════════

dept_name_map = {d["id"]: d["name"] for d in departments}
act_name_map = {a["id"]: a["name"] for a in clean_acts}

def csv_cell(val):
    s = str(val)
    if "," in s or '"' in s or "\n" in s:
        return '"' + s.replace('"', '""') + '"'
    return s

csv_path = os.path.join(OUT_DIR, "rihanna-cuesheet.csv")
with open(csv_path, "w", encoding="utf-8", newline="\r\n") as f:
    f.write("Cue #,Label,Department,Act,Timecode,Warning (s),Duration (s),Armed,Continue,Notes\n")
    for c in all_cues:
        tc = c["trigger_tc"]
        tc_str = f"{tc['hours']:02d}:{tc['minutes']:02d}:{tc['seconds']:02d}:{tc['frames']:02d}"
        dept = dept_name_map.get(c["department_id"], "")
        act = act_name_map.get(c.get("act_id", ""), "")
        dur_str = str(c["duration"]) if c.get("duration") is not None else ""
        armed = "Yes" if c.get("armed", True) else "No"
        cont = c.get("continue_mode", "stop")
        row = [
            csv_cell(c.get("cue_number", "")),
            csv_cell(c.get("label", "")),
            csv_cell(dept),
            csv_cell(act),
            tc_str,
            str(c.get("warn_seconds", 10)),
            dur_str,
            armed,
            cont,
            csv_cell(c.get("notes", "")),
        ]
        f.write(",".join(row) + "\n")

# ═══════════════════════════════════════════════════════════════
#  OUTPUT: User setup script (curl commands)
# ═══════════════════════════════════════════════════════════════

setup_path = os.path.join(OUT_DIR, "setup-users.sh")
with open(setup_path, "w", encoding="utf-8") as f:
    f.write("#!/usr/bin/env bash\n")
    f.write("# Create 24 users via ShowPulse API\n")
    f.write("# Run AFTER importing show data. Requires admin token.\n")
    f.write("# Usage: TOKEN=your_admin_token bash setup-users.sh\n\n")
    f.write('BASE="http://localhost:8080/api"\n\n')
    for u in users:
        dept_json = json.dumps(u["departments"])
        f.write(f'curl -s -X POST "$BASE/users" \\\n')
        f.write(f'  -H "Authorization: Bearer $TOKEN" \\\n')
        f.write(f'  -H "Content-Type: application/json" \\\n')
        f.write(f'  -d \'{{"name":"{u["name"]}","pin":"{u["pin"]}","role":"{u["role"]}","departments":{dept_json}}}\'\n')
        f.write(f'echo " -> {u["name"]} ({u["role"]})"\n\n')

# ═══════════════════════════════════════════════════════════════
#  SUMMARY
# ═══════════════════════════════════════════════════════════════

print(f"=== Rihanna ANTI World Tour — ShowPulse Data ===")
print(f"Show duration: 74 minutes (00:00:00 — 01:14:00)")
print(f"Departments:   {len(departments)}")
print(f"Acts:          {len(clean_acts)}")
print(f"Cues:          {len(all_cues)}")
print(f"Users:         {len(users)}")
print(f"")
print(f"Files written:")
print(f"  {json_path}")
print(f"  {csv_path}")
print(f"  {setup_path}")
print(f"")
print(f"Per-act breakdown:")
for a in acts:
    act_cues = [c for c in all_cues if c.get("act_id") == a["id"]]
    t0 = a["_start"]
    t1 = t0 + a["_dur"]
    m0, s0 = divmod(t0, 60)
    m1, s1 = divmod(t1, 60)
    print(f"  {a['name']:45s} {len(act_cues):3d} cues  ({m0:02d}:{s0:02d} — {m1:02d}:{s1:02d})")
print(f"")
print(f"To load:")
print(f"  1. Stop server: taskkill //F //IM showpulse.exe")
print(f"  2. Copy: cp rihanna-show.json showpulse-data.json")
print(f"  3. Start: cargo run")
print(f"  4. Create users: TOKEN=xxx bash setup-users.sh")
