#!/usr/bin/env python3
"""Generate Rihanna - Anti World Tour cue list for ShowPulse."""
import json, uuid

def uid(): return str(uuid.uuid4())
def tc(h,m,s,f=0): return {"hours":h,"minutes":m,"seconds":s,"frames":f}

# Read current data to preserve structure
with open("showpulse-data.json") as f:
    data = json.load(f)

# Restore users from backup if available
try:
    with open("users-backup.json") as f:
        data["users"] = json.load(f)
except:
    pass

# Departments
depts = [
    {"id":uid(),"name":"Lighting","color":"#FFD700"},
    {"id":uid(),"name":"Sound","color":"#FF6B35"},
    {"id":uid(),"name":"Video","color":"#00BFFF"},
    {"id":uid(),"name":"Pyro","color":"#FF2D2D"},
    {"id":uid(),"name":"Lasers","color":"#00FF88"},
    {"id":uid(),"name":"SFX","color":"#B44DFF"},
    {"id":uid(),"name":"Stage","color":"#FF69B4"},
    {"id":uid(),"name":"Wardrobe","color":"#FFA0C8"},
]
DM = {d["name"]:d["id"] for d in depts}

# Acts
acts = [
    {"id":uid(),"name":"Pre-Show","sort_order":1},
    {"id":uid(),"name":"Act 1 \u2014 Opening / High Energy","sort_order":2},
    {"id":uid(),"name":"Act 2 \u2014 Ballads & R&B","sort_order":3},
    {"id":uid(),"name":"Act 3 \u2014 Party Block","sort_order":4},
    {"id":uid(),"name":"Act 4 \u2014 Hits Encore","sort_order":5},
]
AM = {a["name"]:a["id"] for a in acts}

A0="Pre-Show"
A1="Act 1 \u2014 Opening / High Energy"
A2="Act 2 \u2014 Ballads & R&B"
A3="Act 3 \u2014 Party Block"
A4="Act 4 \u2014 Hits Encore"

def cue(label, dept, h, m, s, f, act, warn=10):
    return {
        "id": uid(), "label": label, "department_id": DM[dept],
        "trigger_tc": tc(h,m,s,f), "act_id": AM[act], "sort_order": 0,
        "warn_seconds": warn, "cue_number": "", "armed": True,
        "notes": "",
        "duration": None, "color": None, "continue_mode": "stop", "post_wait": None
    }

cues = [
    # PRE-SHOW
    cue("House Lights \u2014 Walk-in Warm",       "Lighting",0,15,0,0,  A0,15),
    cue("Walk-in Music \u2014 Ambient Mix",       "Sound",   0,15,0,0,  A0,15),
    cue("LED Walls \u2014 Welcome Graphics",      "Video",   0,15,0,0,  A0,15),
    cue("House Lights \u2014 50% Dim",            "Lighting",0,18,0,0,  A0,10),
    cue("Video Countdown \u2014 2 Minutes",       "Video",   0,18,0,0,  A0,10),
    cue("House Lights \u2014 Blackout",           "Lighting",0,19,50,0, A0,8),
    cue("Walk-in Music \u2014 Fade Out",          "Sound",   0,19,55,0, A0,5),

    # ACT 1: OPENING / HIGH ENERGY
    # Umbrella (00:20:00 - 00:24:00)
    cue("Umbrella \u2014 Intro Rain SFX",         "SFX",     0,20,0,0,  A1,8),
    cue("Umbrella \u2014 Stage Reveal Lift",      "Stage",   0,20,0,0,  A1,8),
    cue("Umbrella \u2014 Verse 1 Blue Wash",      "Lighting",0,20,5,0,  A1,8),
    cue("Umbrella \u2014 Video Rain Cascade",     "Video",   0,20,5,0,  A1,8),
    cue("Umbrella \u2014 Chorus Burst Pyro",      "Pyro",    0,20,45,0, A1,10),
    cue("Umbrella \u2014 Chorus Strobe Flash",    "Lighting",0,20,45,0, A1,10),
    cue("Umbrella \u2014 Bridge Laser Fan",       "Lasers",  0,22,30,0, A1,8),
    cue("Umbrella \u2014 Final Note Blackout",    "Lighting",0,23,50,0, A1,5),

    # Pon De Replay (00:24:30 - 00:28:00)
    cue("Pon De Replay \u2014 Intro Caribbean LED","Video",  0,24,30,0, A1,8),
    cue("Pon De Replay \u2014 Verse Gold Wash",   "Lighting",0,24,35,0, A1,8),
    cue("Pon De Replay \u2014 Quick Change",      "Wardrobe",0,24,30,0, A1,15),
    cue("Pon De Replay \u2014 Chorus Confetti",   "SFX",     0,25,15,0, A1,10),
    cue("Pon De Replay \u2014 Chorus Chase Lights","Lighting",0,25,15,0,A1,10),
    cue("Pon De Replay \u2014 Outro Fade",        "Lighting",0,27,45,0, A1,5),

    # Don't Stop The Music (00:28:30 - 00:32:30)
    cue("DSTM \u2014 Intro Beat Drop Strobe",    "Lighting",0,28,30,0, A1,8),
    cue("DSTM \u2014 Bass Hit Pyro Jets",        "Pyro",    0,28,32,0, A1,8),
    cue("DSTM \u2014 Verse Laser Grid",          "Lasers",  0,29,0,0,  A1,8),
    cue("DSTM \u2014 Video DJ Visuals",          "Video",   0,29,0,0,  A1,8),
    cue("DSTM \u2014 Chorus Full Arena Wash",    "Lighting",0,29,45,0, A1,10),
    cue("DSTM \u2014 Bridge CO2 Jets",           "SFX",     0,31,0,0,  A1,8),
    cue("DSTM \u2014 Final Hit Blackout",        "Lighting",0,32,20,0, A1,5),

    # SOS (00:33:00 - 00:36:30)
    cue("SOS \u2014 Intro Siren SFX",            "SFX",     0,33,0,0,  A1,8),
    cue("SOS \u2014 Verse Red Pulse",            "Lighting",0,33,5,0,  A1,8),
    cue("SOS \u2014 Video Distress Signal",      "Video",   0,33,5,0,  A1,8),
    cue("SOS \u2014 Chorus Pyro Burst",          "Pyro",    0,33,50,0, A1,10),
    cue("SOS \u2014 Bridge Laser Sweep",         "Lasers",  0,35,0,0,  A1,8),
    cue("SOS \u2014 Outro Stage Blackout",       "Lighting",0,36,20,0, A1,5),

    # ACT 2: BALLADS & R&B
    # Stay (00:37:30 - 00:41:30)
    cue("Stay \u2014 Piano Spot Warm Amber",     "Lighting",0,37,30,0, A2,10),
    cue("Stay \u2014 Verse Intimate Video",      "Video",   0,37,35,0, A2,10),
    cue("Stay \u2014 Wardrobe Gown Reveal",      "Wardrobe",0,37,30,0, A2,15),
    cue("Stay \u2014 Chorus Soft Wash Build",    "Lighting",0,38,30,0, A2,10),
    cue("Stay \u2014 Bridge Rain SFX Gentle",    "SFX",     0,39,45,0, A2,8),
    cue("Stay \u2014 Final Note Single Spot",    "Lighting",0,41,15,0, A2,5),

    # Unfaithful (00:42:00 - 00:46:00)
    cue("Unfaithful \u2014 Intro String Pad",    "Sound",   0,42,0,0,  A2,10),
    cue("Unfaithful \u2014 Verse Lavender Wash", "Lighting",0,42,5,0,  A2,10),
    cue("Unfaithful \u2014 Video Cinematic",     "Video",   0,42,5,0,  A2,10),
    cue("Unfaithful \u2014 Chorus Build Warm",   "Lighting",0,43,0,0,  A2,10),
    cue("Unfaithful \u2014 Bridge Dim to Spot",  "Lighting",0,44,30,0, A2,8),
    cue("Unfaithful \u2014 Outro Fade Black",    "Lighting",0,45,50,0, A2,5),

    # Take A Bow (00:46:30 - 00:50:00)
    cue("Take A Bow \u2014 Intro Solo Spot",     "Lighting",0,46,30,0, A2,10),
    cue("Take A Bow \u2014 Video Memories",      "Video",   0,46,35,0, A2,10),
    cue("Take A Bow \u2014 Chorus Rose Petals",  "SFX",     0,47,30,0, A2,10),
    cue("Take A Bow \u2014 Bridge Stage Rotate", "Stage",   0,48,30,0, A2,8),
    cue("Take A Bow \u2014 Final Bow Spot",      "Lighting",0,49,45,0, A2,5),

    # California King Bed (00:50:30 - 00:54:00)
    cue("CKB \u2014 Intro Starfield LED",        "Video",   0,50,30,0, A2,10),
    cue("CKB \u2014 Verse Warm Gold Wash",       "Lighting",0,50,35,0, A2,10),
    cue("CKB \u2014 Chorus Laser Stars",         "Lasers",  0,51,30,0, A2,10),
    cue("CKB \u2014 Bridge Stage Bed Prop",      "Stage",   0,52,30,0, A2,8),
    cue("CKB \u2014 Outro Slow Fade",            "Lighting",0,53,45,0, A2,5),

    # ACT 3: PARTY BLOCK
    # We Found Love (00:55:00 - 00:59:00)
    cue("WFL \u2014 Intro Heartbeat SFX",        "SFX",     0,55,0,0,  A3,8),
    cue("WFL \u2014 Wardrobe Neon Outfit",       "Wardrobe",0,55,0,0,  A3,15),
    cue("WFL \u2014 Verse UV Wash",              "Lighting",0,55,5,0,  A3,8),
    cue("WFL \u2014 Video Rave Visuals",         "Video",   0,55,5,0,  A3,8),
    cue("WFL \u2014 Drop Strobe Full Arena",     "Lighting",0,55,50,0, A3,10),
    cue("WFL \u2014 Drop Pyro Gerbs",            "Pyro",    0,55,50,0, A3,10),
    cue("WFL \u2014 Bridge Laser Tunnel",        "Lasers",  0,57,0,0,  A3,8),
    cue("WFL \u2014 CO2 Jets Crowd",             "SFX",     0,57,30,0, A3,8),
    cue("WFL \u2014 Outro Blackout Hit",         "Lighting",0,58,50,0, A3,5),

    # Only Girl (00:59:30 - 01:03:00)
    cue("Only Girl \u2014 Intro Pink Explosion",  "Pyro",   0,59,30,0, A3,8),
    cue("Only Girl \u2014 Verse Pink Wash",       "Lighting",0,59,35,0,A3,8),
    cue("Only Girl \u2014 Video Floral Cascade",  "Video",  0,59,35,0, A3,8),
    cue("Only Girl \u2014 Chorus Confetti Burst", "SFX",    1,0,30,0,  A3,10),
    cue("Only Girl \u2014 Bridge Laser Fan Pink", "Lasers", 1,1,30,0,  A3,8),
    cue("Only Girl \u2014 Outro Chase Fade",      "Lighting",1,2,45,0, A3,5),

    # Where Have You Been (01:03:30 - 01:07:00)
    cue("WHYB \u2014 Intro Tribal Drums SFX",    "SFX",    1,3,30,0,  A3,8),
    cue("WHYB \u2014 Verse Green Laser Grid",    "Lasers", 1,3,35,0,  A3,8),
    cue("WHYB \u2014 Video World Map Pulse",     "Video",  1,3,35,0,  A3,8),
    cue("WHYB \u2014 Drop Full Pyro Salvo",      "Pyro",   1,4,20,0,  A3,10),
    cue("WHYB \u2014 Drop Strobe + CO2",         "Lighting",1,4,20,0, A3,10),
    cue("WHYB \u2014 Outro Blackout",            "Lighting",1,6,45,0, A3,5),

    # Rude Boy (01:07:30 - 01:11:00)
    cue("Rude Boy \u2014 Intro Bass Drop SFX",   "SFX",    1,7,30,0,  A3,8),
    cue("Rude Boy \u2014 Verse Neon Chase",      "Lighting",1,7,35,0, A3,8),
    cue("Rude Boy \u2014 Video Pop Art",         "Video",  1,7,35,0,  A3,8),
    cue("Rude Boy \u2014 Chorus Pyro Jets",      "Pyro",   1,8,20,0,  A3,10),
    cue("Rude Boy \u2014 Bridge Stage Thrust",   "Stage",  1,9,15,0,  A3,8),
    cue("Rude Boy \u2014 Outro Fade to Black",   "Lighting",1,10,45,0,A3,5),

    # ACT 4: HITS ENCORE
    # Diamonds (01:12:00 - 01:16:00)
    cue("Diamonds \u2014 Intro Solo Spot White",  "Lighting",1,12,0,0, A4,10),
    cue("Diamonds \u2014 Verse Video Starfield",  "Video",  1,12,5,0,  A4,10),
    cue("Diamonds \u2014 Wardrobe Crystal Gown",  "Wardrobe",1,12,0,0, A4,15),
    cue("Diamonds \u2014 Chorus Laser Diamond",   "Lasers", 1,12,50,0, A4,10),
    cue("Diamonds \u2014 Chorus Audience Lights", "Lighting",1,12,50,0,A4,10),
    cue("Diamonds \u2014 Bridge Pyro Sparkle",    "Pyro",   1,14,0,0,  A4,8),
    cue("Diamonds \u2014 Outro Slow White Fade",  "Lighting",1,15,45,0,A4,5),

    # Work (01:16:30 - 01:20:30)
    cue("Work \u2014 Intro Dancehall SFX",        "SFX",    1,16,30,0, A4,8),
    cue("Work \u2014 Verse Caribbean LED",        "Video",  1,16,35,0, A4,8),
    cue("Work \u2014 Verse Amber Wash",           "Lighting",1,16,35,0,A4,8),
    cue("Work \u2014 Chorus Pyro Flames",         "Pyro",   1,17,20,0, A4,10),
    cue("Work \u2014 Bridge CO2 + Confetti",      "SFX",    1,18,30,0, A4,8),
    cue("Work \u2014 Outro Energy Blackout",      "Lighting",1,20,15,0,A4,5),

    # Love On The Brain (01:21:00 - 01:24:30)
    cue("LOTB \u2014 Intro Solo Piano Spot",      "Lighting",1,21,0,0, A4,10),
    cue("LOTB \u2014 Verse Emotional Video",      "Video",  1,21,5,0,  A4,10),
    cue("LOTB \u2014 Chorus Full Band Build",     "Sound",  1,21,50,0, A4,10),
    cue("LOTB \u2014 Chorus Warm Gold Wash",      "Lighting",1,21,50,0,A4,10),
    cue("LOTB \u2014 Final Note Pyro Gold Rain",  "Pyro",   1,23,30,0, A4,10),
    cue("LOTB \u2014 Final Note Full Arena White","Lighting",1,23,30,0,A4,10),

    # Finale
    cue("Finale \u2014 Cast Bow House Lights",    "Lighting",1,24,0,0, A4,8),
    cue("Finale \u2014 Thank You Video",          "Video",  1,24,0,0,  A4,8),
    cue("Finale \u2014 Exit Music",               "Sound",  1,24,30,0, A4,15),
    cue("Finale \u2014 House Lights Full",        "Lighting",1,25,0,0, A4,10),
]

for i,c in enumerate(cues):
    c["sort_order"] = i+1

data["show_name"] = "Rihanna \u2014 Anti World Tour"
data["departments"] = depts
data["acts"] = acts
data["cues"] = cues

with open("showpulse-data.json","w") as f:
    json.dump(data, f, indent=2)

print(f"Written: {len(cues)} cues, {len(depts)} depts, {len(acts)} acts, {len(data['users'])} users")
