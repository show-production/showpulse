# ShowPulse — Competitive & Market Analysis

**Document purpose:** Business plan appendix. Comprehensive analysis of the show management software landscape for timecode-synced live production, ShowPulse's competitive positioning, and strategic direction.

**Last updated:** March 2026

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Market Landscape](#2-market-landscape)
3. [Category Breakdown](#3-category-breakdown)
   - 3.1 All-in-One Show Control Platforms
   - 3.2 Cue Playback Engines
   - 3.3 Media Servers with Show Control
   - 3.4 Lighting Consoles as Show Control Hubs
   - 3.5 Timecode Generation, Conversion & Display
   - 3.6 Protocol Middleware & Integration Layers
   - 3.7 Multi-Department Crew Alerting
   - 3.8 Event Timer & Rundown Tools
   - 3.9 Pre-Production Timecode Planning
4. [Detailed Competitor Profiles](#4-detailed-competitor-profiles)
5. [Comprehensive Feature Comparison](#5-comprehensive-feature-comparison)
6. [ShowPulse Competitive Position](#6-showpulse-competitive-position)
7. [Market Gap Analysis](#7-market-gap-analysis)
8. [How Productions Wire It Together](#8-how-productions-wire-it-together)
9. [Strategic Implications for ShowPulse](#9-strategic-implications-for-showpulse)
10. [Pricing Strategy & Sustainability](#10-pricing-strategy--sustainability)
11. [Emerging Trends (2024-2026)](#11-emerging-trends-2024-2026)

---

## 1. Executive Summary

No single platform dominates all disciplines in live event production. The professional industry relies on a layered ecosystem where timecode generators, show controllers, lighting consoles, media servers, and crew alerting tools work in concert. The critical gap in the market is a dedicated **timecode-aware crew alerting tool** that reads SMPTE LTC/MTC and pushes department-specific countdown alerts to crew devices.

**ShowPulse fills this exact gap.** It is a free, self-hosted, single-binary application that reads LTC and MTC timecode, manages department-specific cue lists, and broadcasts real-time countdown alerts to unlimited crew devices via web browsers. The only production-proven competitor in this specific category is **CuePilot**, an enterprise-priced commercial product. The nearest open-source alternative, **Ontime**, lacks timecode input and department filtering entirely.

**Key finding:** The market for timecode-synced crew alerting is severely underserved. ShowPulse is positioned to become the free, open-source standard in this category.

---

## 2. Market Landscape

The show management software ecosystem segments into nine functional categories. Most products occupy one or two categories; the term "all-in-one" is aspirational. Each platform has a primary discipline and extends outward via protocol integrations.

| Category | What it does | Key players | ShowPulse overlap |
|---|---|---|---|
| All-in-one show control | Central automation across all departments | Medialon, SP Grid | Low — different scale |
| Cue playback | Fires audio/video/lighting cues | QLab, CSC | None — ShowPulse monitors, not fires |
| Media servers | Video content delivery & sync | Disguise, Green Hippo, Pandoras Box, WATCHOUT | None — different discipline |
| Lighting consoles | Lighting control + timecode hub | grandMA3, ChamSys MagicQ | None — potential integration partner |
| Timecode tools | Generate, convert, display TC | ShowKontrol, TimeCode Live, TXL20, ShowCockpit | Partial — ShowPulse reads TC |
| Protocol middleware | Route/convert between protocols | Companion, Chataigne, ShowCockpit | Low — potential integration partner |
| Crew alerting | Push countdowns to crew devices | CuePilot, ETC CueSystem | **Direct competition** |
| Event timers | Web-based countdown displays | Ontime, Stagetimer, Rundown Studio | **Adjacent competition** |
| Pre-production planning | Build timecoded cue sequences | CuePoints | None — potential import source |

---

## 3. Category Breakdown

### 3.1 All-in-One Show Control Platforms

#### Medialon Manager (by 7thSense)

The broadest true show controller. Supports DMX, MIDI, MSC, OSC, Art-Net, sACN, RS-232, GPIO, TCP/UDP, and SMPTE timecode with timeline accuracy to 1/100th of a second and frame rates from 23.976 to 1000 fps. Drag-and-drop graphical programming engine controls audio, video, lighting, pyrotechnics, animatronics, fountains, and stage automation. Custom WebPanel GUIs (HTML-based, V7 Pro supports 10 simultaneous connections, expandable in packs of 10) give operators browser-based dashboards.

- **Roots:** Themed entertainment — Disney-scale parks, museums (Academy Museum), permanent installations
- **Platform:** Windows or dedicated Showmaster hardware
- **Pricing:** Enterprise-level, not publicly listed
- **Limitation:** Touring adoption limited due to themed-entertainment focus

#### Stage Precision SP Grid

Most modern entrant. Won AV Awards 2025 "Control & Management Technology of the Year." Consolidates real-time data management, tracking, show control, and spatial intelligence. Protocol support is extraordinary: Art-Net, sACN, MIDI, OSC (bidirectional), Modbus, MQTT, REST API, Serial, TCP, UDP, Telnet, WebSocket, PJLink, plus integrations with Unreal Engine (RenderStream), BlackTrax, PosiStageNet, and video switchers from AJA, Blackmagic, Barco, and Panasonic. Timecode input includes MTC, LTC via audio input, and Blackmagic Decklink timecode.

- **Crew alerting:** Telegram/Slack bots and custom web UIs
- **Deployments:** 2024 Super Bowl, Eurovision, NBA All-Stars
- **Platform:** Windows-primary, with dedicated Grid Engine (1U server) hardware
- **Pricing:** Industry-first credit-based model — free for small setups (SP Grid Studio), scaling with project complexity
- **Focus:** VP/XR and large-scale AV rather than traditional theater

---

### 3.2 Cue Playback Engines

#### QLab 5 (Figure 53)

Industry standard for theatrical cue playback across 100+ countries. 25 cue types covering audio, video, lighting (via Art-Net/DMX), and show control. Protocol support includes OSC (bidirectional with full API), MIDI/MSC (bidirectional), LTC, MTC, Art-Net, NDI, and Syphon.

**Critical distinction:** QLab triggers cues at specific timecode values but does not chase/sync to timecode — it fires events when incoming LTC or MTC hits a programmed time, rather than locking playback position to an external clock.

- **Version 5 additions:** Real-time multi-user collaboration, QLab Remote (iOS), Object Audio (spatial sound), Metal-based video rendering
- **Platform:** macOS only
- **Pricing:** Free basic version (2 audio channels, 16 DMX addresses). Audio/Video/Lighting modules at **$399 each**, Pro Bundle at **$599**. Rent-to-own available. Site licenses $299/activation (min 10). Educational pricing available.
- **Free version limits:** 2 audio channels per cue, 16 DMX addresses, no audio effects, no timecode triggers, no MIDI/OSC/scripting

#### CSC (Computer Sound Cueing)

Theater-focused sound playback. Supports MTC input, OSC, MSC, network chat for stage management. Windows-only. Priced at £60-£240.

---

### 3.3 Media Servers with Show Control

These are primarily video content delivery systems that integrate with show control rather than replacing it. Their timecode and protocol features are strong but focused on video synchronization.

#### Disguise Designer (formerly d3)

Dominates touring concert video. Full SMPTE LTC and MTC chase, Art-Net timecode, OSC, MSC, MIDI transport control. Director/Actor/Understudy network architecture with automatic failover. Proprietary Windows hardware from EX (entry) to GX (flagship) servers.

- **Deployments:** U2 Sphere Las Vegas, Beyoncé, Billie Eilish tours
- **Pricing:** Enterprise — hardware servers cost thousands to tens of thousands. Free Designer Starter software tier for learning.

#### Green Hippo Hippotizer

SMPTE LTC and MTC playback synchronization with 16 synchronization channels (Sync Bus). LTC input via balanced XLR. Protocols: Art-Net, sACN, MA-Net, MIDI, OSC, TCP, RS-232, REST API. ZooKeeper provides free network-wide browser control.

- **Deployments:** Eurovision, Academy Awards, Super Bowl, Cirque du Soleil
- **Platform:** Windows-only proprietary hardware

#### Pandoras Box (ownership transition in progress)

LTC SMPTE I/O, MSC, Art-Net, sACN, NDI, Dante with sub-frame accuracy across servers. Windows-only, multi-display/projection focus.

**Ownership note:** Pandoras Box is transitioning from Christie Digital to twoloox GmbH as of October 2025. Mid-transition ownership changes create buying risk for customers (uncertain roadmap, support continuity, licensing terms) and potential market opportunity for competitors in the media server space. Not directly relevant to ShowPulse's category but worth noting for productions evaluating their full toolchain.

#### WATCHOUT (Dataton)

SMPTE timecode chase at 24-30 fps with NTP-based server sync under 2ms. Windows-only, multi-display/projection focus.

---

### 3.4 Lighting Consoles as Show Control Hubs

In touring production, the lighting console often functions as the central timecode receiver. Audio departments typically generate LTC and all other departments chase it.

#### grandMA3 (MA Lighting)

Industry standard for major touring. Timecode: Art-Net Timecode (primary network method), MTC via physical MIDI ports, LTC via console hardware. Up to 32 sessions per network with multi-user collaboration, user profiles, and permissions. OSC send/receive, MSC, MIDI integration for cross-department triggering.

- **Deployments:** Virtually every major concert tour, Coachella, Glastonbury, Tomorrowland, all major award shows
- **Pricing:** onPC software free (2 parameters output without hardware). Console hardware ~€30,000 (Light) to ~€100,000+ (Full Size)

#### ChamSys MagicQ

Comprehensive timecode: LTC, MTC, Art-Net Timecode, ChamNet Timecode distribution. Timeline Editor with waveform display. Internal timecode at 100 fps for high-resolution programming. MSC support (GO, STOP, RESUME, TIMED GO).

- **Pricing:** Software free on Windows/Mac/Linux. Console hardware ~£2,000 (QuickQ) to £25,000+ (MQ500M Stadium)

---

### 3.5 Timecode Generation, Conversion & Display

#### ShowKontrol (TC Supply)

Dominant for DJ/festival timecode sync. Developed with Pioneer DJ. Reads real-time track data from Pioneer CDJ/DJM via ProDJ Link, generates up to 3 simultaneous SMPTE outputs via LTC, MTC, Art-Net Timecode, and TCNet. CUE builder programs track-specific cue lists triggering Art-Net, TCNet, and MIDI events.

- **Deployments:** Armin van Buuren, Martin Garrix, Hardwell, Afrojack
- **Pricing:** BeatKontrol **$49** (view-only), ShowKontrol CLUB **$250** (1 TC output), ShowKontrol LIVE **$1,999** (3 TC outputs)
- **Limitation:** Requires Pioneer DJ hardware exclusively

#### TimeCode Live (Haute Technique)

ShowKontrol's direct competitor. Outputs SMPTE LTC (25/30 fps), MTC, and OSC timecode from Pioneer DJ decks with up to 10 audio outputs including click tracks. Companion apps: TimeCode Monitor (free LTC viewer, Mac), TimeCode Generator (LTC generation, all platforms), TimeCode Player (LTC sync with music tracks).

#### TXL20 Timecode Expert

Most capable pure timecode tool for show production. Generates, receives, and converts MTC, SMPTE LTC, and Art-Net Timecode with modular routing — unlimited generators, receivers, converters, and senders. VST3/AU/AAX DAW plug-ins for reading DAW clock or decoding LTC from audio channels. Auto-detects incoming frame rates. Cross-platform (macOS and Windows), one license covers both. Free trial available.

#### TimeLord MTC

Serves the grandMA2 ecosystem specifically. Deep integration including batch track import, auto-calculated offsets, direct upload of show data to the console. Supports MTC, LTC, MSC, MIDI Clock, Art-Net. Windows-only.

---

### 3.6 Protocol Middleware & Integration Layers

#### ShowCockpit

Most flexible protocol conversion middleware. Modular driver architecture: LTC I/O, MTC I/O, Art-Net Timecode I/O, timecode offset, countdown timers, protocol conversion between any format (LTC<>MTC, OSC<>MIDI, etc.). Integrations: grandMA2/MA3, ChamSys MagicQ, Obsidian Onyx, Resolume Arena, Pangolin Beyond (laser), REAPER, QLab, Bitfocus Companion.

- **Platform:** Windows-only
- **Pricing:** Modular — individual drivers at **€5-€40 each** (Starter Kit) or all-inclusive Pro license
- **Developer:** Solo developer (Ricardo Dias)

#### Bitfocus Companion

DIY alerting/control bridge. 2,700+ modules controlling virtually any network-enabled production equipment. "Timecode for Companion" add-on enables MTC-triggered button automation. Free and open-source on Mac, Windows, Linux. Used extensively in broadcast, touring, and houses of worship.

#### Chataigne

Free, open-source (GPL3) central hub for OSC, MIDI, DMX, Art-Net, PJLink. Timeline/sequence engine with trigger layers and automation layers. Can bridge SMPTE to OSC for consoles like ETC Eos and grandMA3. Cross-platform including Raspberry Pi.

- **Relevance to ShowPulse:** Integration partner, not competitor. If ShowPulse adds OSC input, Chataigne could feed it from any protocol.

---

### 3.7 Multi-Department Crew Alerting — Direct Competition

This is ShowPulse's primary competitive category. It is the most underserved segment in the market.

#### CuePilot — Primary Competitor

Built for live broadcast and large-scale concerts. Combines timeline-based cue planning with full LTC timecode sync, distributing department-specific countdowns to crew via CueApp (iOS/Android). Camera operators see their shot countdowns. Pyro operators see their fire cues. Stage crew see their marks.

**Timecode:** LTC input only — CuePilot's documentation and support articles consistently reference LTC as the sole timecode input method. MTC (MIDI Time Code) is not listed as a supported timecode source. A separate "MIDI Timecode Reader" hardware accessory is available, but this appears to be an LTC reader with MIDI connectivity, not native MTC decoding. MIDI is used for sending Note On/Off control messages on Vision Cues, not for timecode input. *(Source: [CuePilot Support — Working with Timecode](https://cuepilot.zendesk.com/hc/en-us/articles/360053009651), [CuePilot Hardware](https://www.cuepilot.com/en/hardware.html), [MIDI on Vision Cues](https://cuepilot.zendesk.com/hc/en-us/articles/360052624072), accessed March 2026.)*

**Other protocols:** RS422 (vision switcher), OSC (send, custom schemas), GPI (send), MIDI (Note On/Off send on Vision Cues — control messages, not bidirectional transport or timecode)

**CuePilot 7.0 (2024-2025) additions:**
- **Notify Tracks** — specifically for non-camera departments (pyro, staging, automation)
- Custom OSC schemas
- PTZ camera preset recall
- Live OSC broadcasting

**Product tiers:**
- CuePilot MINI — 3 CueApp connections
- CuePilot PRO — 15 CueApp connections
- CuePilot MAX — 100 CueApp connections, CueScreen (SDI output with up to 48 customizable backstage monitor views)
- Free for students

**Deployments:** Eurovision, The Voice, MTV VMAs, Masked Singer, Beyoncé tours

**Platform:** Mac and Windows with dedicated Studio Server hardware

**Pricing:** Tier-based, quote required. Not publicly listed — enterprise sales model.

**Cloud features:** Cloud-based multi-user collaboration for pre-production planning

**Internet dependency:** CuePilot's cloud collaboration features (multi-user cue planning, shared timelines) require internet connectivity during pre-production. During a live show, the Studio Server runs locally on-site with LTC input and CueApp distribution over local WiFi — internet is not required for show execution. The "partial" internet dependency is therefore a setup/planning requirement, not a showtime requirement. This distinction matters: CuePilot's live-show operation is effectively LAN-based, similar to ShowPulse. ShowPulse's LAN-first advantage is strongest during pre-production workflow and for teams that lack reliable venue internet for planning sessions.

#### ETC CueSystem

Hardware cue lights via PoE Ethernet with CueSpider outstations displaying standby/go information. Bi-directional acknowledgment (operators press button to confirm). Available in 4, 8, or 12-channel configurations. Not timecode-synced — designed for manual stage manager operation. Industry standard in professional theater. Not a direct ShowPulse competitor due to lack of timecode sync.

---

### 3.8 Event Timer & Rundown Tools — Adjacent Competition

These tools overlap with ShowPulse's countdown display functionality but lack timecode input and department-specific filtering. They target corporate events, conferences, and broadcasts rather than timecoded live production.

#### Ontime — Nearest Open-Source Alternative

Free, open-source (3.3K GitHub stars) event timer and rundown manager. Browser-based, self-hostable, multi-device views. Import from Excel/Google Sheets.

**Protocols:** OSC API, WebSocket, HTTP, Companion module

**Key limitations vs ShowPulse:**
- **No SMPTE LTC/MTC input** — runs on wall clock or manual control only
- **No department-specific filtering** — all crew see the same countdown
- No cue state engine (upcoming/warning/go/active/passed)

**Platform:** Windows, macOS, Linux. Ontime Cloud available.

**Relevance:** Ontime is the tool most likely to appear in comparison searches against ShowPulse. With 3,300+ GitHub stars, active development (v3.7 released 2025), and a growing community, it has real momentum and should not be dismissed.

**Protocol bridge risk:** Ontime's OSC API means a technically capable user could bridge timecode into Ontime via ShowCockpit (LTC→OSC), Chataigne (SMPTE→OSC), or even a simple Node.js script. This would effectively give Ontime timecode-driven event triggering — partially closing ShowPulse's primary differentiator. However, this bridge approach has significant limitations: it requires additional software running alongside Ontime, adds latency and a point of failure, provides no frame-accurate countdown engine (Ontime would still run on its own clock, triggered at cue boundaries rather than continuously chasing timecode), and still lacks per-department filtering. The gap between "timecode triggers an event timer" and "timecode drives a frame-accurate countdown engine with department-specific state tracking" is substantial — but it is a gap that narrows over time if Ontime adds native timecode support. ShowPulse should monitor Ontime's development roadmap and ensure OSC integration ships before Ontime considers native LTC/MTC.

#### Stagetimer.io

Web-based multi-screen countdowns with color-coded wrap-up warnings, audio chimes, and real-time text messages to presenters. Up to 300 connections on Premium tier.

**Key limitation:** Zero SMPTE/LTC/MTC timecode support — purely a web-synced timer system.

- **Pricing:** Free (3 connections), Pro (monthly subscription), 30-day single-event licenses
- **Deployments:** 16,000+ producers including Grand Ole Opry events
- **Target:** Corporate events, conferences, webinars

#### Rundown Studio

Cloud-based rundown and timing tool. Auto-calculates start/end times as you build rundown. Real-time show tracking across devices. Companion module for hardware integration.

**Key limitation:** No timecode sync — wall clock only. Targets corporate events, broadcasts, esports.

---

### 3.9 Pre-Production Timecode Planning

#### CuePoints (~2024)

Marker-based timeline for building timecoded sequences. Color-coded markers for lighting, sound, video, choreography. Markers include fade times. Exports cue lists directly importable into lighting consoles (grandMA3, MA2, ETC Eos). OSC control via Stream Deck or MA3.

- **Relevance to ShowPulse:** Solves "plan cues before the show." ShowPulse solves "show cues to crew during the show." A CuePoints import path would create a natural pre-production to live-show workflow.

---

## 4. Detailed Competitor Profiles

### Direct Competitors (same category)

| Attribute | CuePilot | ShowPulse |
|---|---|---|
| **Primary function** | Show direction + crew alerting | Crew alerting + timecode monitoring |
| **Timecode input** | LTC | LTC + MTC |
| **Timecode generator** | No | Yes (4 modes) |
| **Crew device delivery** | Native iOS/Android app (CueApp) | Web browser (any device) |
| **Department filtering** | Yes (Notify Tracks, camera tracks) | Yes (per-department cue lists) |
| **Connection limits** | 3 / 15 / 100 (tiered pricing) | Unlimited |
| **SDI/video output** | Yes (CueScreen, 48 views) | No |
| **Vision switcher** | Yes (RS422) | No |
| **OSC** | Yes (send, custom schemas) | Planned (Tier 1 roadmap) |
| **GPI** | Yes (send) | No |
| **MIDI** | Send only (Note On/Off on Vision Cues) | MTC input only |
| **Cloud collaboration** | Yes (pre-production) | No (LAN-first) |
| **Internet dependency** | Pre-production only; live show runs locally | None |
| **Auth & roles** | Yes | Yes (5 roles) |
| **Self-hosted** | Partial (local + cloud) | Fully self-hosted |
| **Runtime dependencies** | Multiple services | Zero (single binary) |
| **Platform** | Mac/Win + iOS/Android | Windows (any browser for clients) |
| **Open source** | No | Yes |
| **Price** | Enterprise (quote-based) | Free |
| **Target market** | Broadcast, major touring | Touring, theater, festivals, corporate |

### Adjacent Competitors (overlapping functionality)

| Attribute | Ontime | Stagetimer | Rundown Studio |
|---|---|---|---|
| **Primary function** | Event timer/rundown | Presenter countdown | Event scheduling |
| **Timecode input** | None | None | None |
| **Department filtering** | None | None | None |
| **Crew devices** | Browser (multi-view) | Browser (300 devices) | Browser |
| **Open source** | Yes | No | No |
| **Self-hosted** | Yes | No (SaaS) | No (SaaS) |
| **Platform** | Win/Mac/Linux | Web | Web |
| **Price** | Free | Free-subscription | Paid |
| **OSC** | Yes | No | No |
| **Companion module** | Yes | No | Yes |

---

## 5. Comprehensive Feature Comparison

### All platforms across all categories

| Platform | Primary role | LTC | MTC | Art-Net TC | OSC | MSC | Multi-client | Crew alerts | Platform | Pricing |
|---|---|---|---|---|---|---|---|---|---|---|
| **ShowPulse** | Crew alerting | ✅ In | ✅ In | -- | Planned | -- | ✅ Unlimited | ✅ Per-dept | Win (any browser) | Free |
| **CuePilot** | Show direction + alerting | ✅ In | -- | -- | ✅ Send | -- | ✅ CueApp (100+) | ✅ Per-dept | Mac/Win/iOS/Android | Enterprise |
| **Medialon Manager** | Enterprise show control | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ WebPanels (10+) | Custom GUI | Windows | Enterprise |
| **Stage Precision** | Data/control hub | ✅ In | ✅ | -- | ✅ | -- | ✅ Web UIs | Slack/Telegram | Windows | Credit-based |
| **QLab 5** | Cue playback | ✅ Trigger | ✅ Trigger | -- | ✅ | ✅ | ✅ Collab | -- | macOS | Free-$599 |
| **grandMA3** | Lighting console | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Multi-session | -- | Win/Mac (onPC) | Free SW; €30K+ HW |
| **ChamSys MagicQ** | Lighting console | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Network | -- | Win/Mac/Linux | Free SW; £2K+ HW |
| **Disguise** | Media server | ✅ Chase | ✅ Chase | ✅ | ✅ | ✅ | Director/Actor | -- | Windows (HW) | Enterprise |
| **Green Hippo** | Media server | ✅ Chase | ✅ Chase | -- | ✅ | -- | ✅ ZooKeeper | -- | Windows (HW) | Dealer pricing |
| **ShowKontrol** | DJ timecode sync | ✅ Out | ✅ Out | ✅ Out | -- | -- | ✅ Web viewer | CUE builder | Win/Mac | $49-$1,999 |
| **ShowCockpit** | Protocol middleware | ✅ I/O | ✅ I/O | ✅ I/O | ✅ | -- | Limited | Countdown driver | Windows | €5-€40/driver |
| **Companion** | Control hub | -- | Via add-on | -- | ✅ | -- | ✅ Web/Deck | Via modules | Win/Mac/Linux | Free |
| **Chataigne** | Protocol middleware | Via module | ✅ | ✅ | ✅ | -- | -- | -- | Win/Mac/Linux/RPi | Free |
| **Ontime** | Event timer | -- | -- | -- | ✅ | -- | ✅ Browser | -- | Win/Mac/Linux | Free |
| **Stagetimer** | Event countdown | -- | -- | -- | -- | -- | ✅ (300) | Colors/chimes | Web | Free-subscription |
| **TXL20 Expert** | Timecode conversion | ✅ I/O | ✅ I/O | ✅ I/O | -- | -- | -- | -- | Mac/Windows | Licensed |
| **CuePoints** | Pre-production planning | Generates | -- | -- | ✅ | -- | -- | -- | -- | Paid |
| **Pandoras Box** | Media server | ✅ I/O | -- | ✅ | -- | ✅ | Multi-Manager | -- | Windows | Per-license |
| **WATCHOUT** | Multi-display | ✅ Chase | -- | -- | -- | -- | ✅ Asset Mgr | -- | Windows | Per-license |
| **Isadora** | Interactive media | -- | ✅ In | -- | ✅ | ✅ In | Via IzzyCast | -- | Mac/Windows | ~$550-$650 |
| **CSC** | Theater sound | -- | ✅ In | -- | ✅ | ✅ | Network chat | -- | Windows | £60-£240 |
| **Rundown Studio** | Event scheduling | -- | -- | -- | -- | -- | ✅ Browser | -- | Web | Paid |

---

## 6. ShowPulse Competitive Position

### What ShowPulse is

A free, self-hosted, single-binary application that reads SMPTE LTC and MIDI MTC timecode, manages per-department cue lists with act grouping, and broadcasts real-time countdown alerts (10Hz, frame-accurate) to unlimited crew devices via web browsers over local WiFi. Role-based authentication with 5 permission levels. Zero runtime dependencies, zero internet requirement.

### Unique strengths (vs all competitors)

| Advantage | Details |
|---|---|
| **LTC + MTC input** | Only crew alerting tool supporting both timecode standards. CuePilot supports LTC only (verified from CuePilot support documentation, March 2026). MTC support matters because many theater and broadcast workflows use MTC from DAWs rather than LTC from dedicated generators. |
| **Built-in timecode generator** | 4 modes (Freerun/Countdown/Clock/Loop) for rehearsal and programming without external TC source. No competitor in the alerting category offers this. |
| **Unlimited crew connections** | No per-device licensing. CuePilot caps at 3/15/100 by tier. |
| **Zero cost** | Free and open-source. CuePilot requires enterprise sales engagement. |
| **Single binary, zero dependencies** | 4.1 MB executable. No database, no runtime, no installer. Copy and run. |
| **LAN-first / zero internet** | Works in any venue regardless of internet availability. Critical for touring and temporary installations. |
| **Per-department filtering** | Each crew member sees only their department's countdowns. Ontime and Stagetimer lack this entirely. |
| **Role-based access control** | 5 roles (Viewer through Admin) with timer lock, department assignment, and tab gating. |
| **Self-hosted** | No cloud dependency, no subscription, no vendor lock-in. Data stays on-site. |

### Current limitations (vs CuePilot)

| Gap | Impact | Mitigation path |
|---|---|---|
| No OSC I/O | Cannot receive triggers from consoles or send events to downstream systems | Tier 1 roadmap priority |
| No native mobile app | Browser-only; less reliable wake lock, no push notifications | PWA wrapper (Tier 3) |
| No SDI/NDI output | Cannot feed backstage monitors directly | NDI output (Tier 3) |
| No vision switcher (RS422) | Cannot integrate with broadcast switchers | Low priority — broadcast is CuePilot's core market |
| No GPI | No hardware I/O for legacy systems | Low priority |
| No cloud collaboration | Pre-production planning is local only | Intentional — LAN-first is a feature |
| Windows-only server | Cannot run on macOS or Linux natively (see note below) | Linux build on roadmap (Tier 2) |

**Note on platform limitation:** The Windows-only server constraint is a genuine adoption barrier that deserves honest framing. Many touring LDs and show callers use MacBook Pros; running ShowPulse requires a separate Windows machine. The roadmap lists Linux as Tier 2 and cites "Raspberry Pi = zero-cost hardware" as an aspiration — but until a Linux build ships, that aspiration is marketing, not capability. The Rust codebase is cross-platform by design (`cpal` and `midir` both support Linux and macOS), so the technical barrier is low — primarily CI/CD pipeline and LTC/MTC device testing on each platform. A macOS build would address the touring market immediately; a Linux/ARM build would unlock the Raspberry Pi deployment story. Both should be treated as adoption unlockers rather than feature additions.

---

## 7. Market Gap Analysis

### The gap

The professional live event industry needs a tool that:
1. Reads SMPTE LTC or MIDI MTC timecode from the production's master clock
2. Manages cue lists organized by department
3. Pushes real-time, department-specific countdown alerts to crew devices
4. Runs on any device (phone, tablet, laptop) without app installation
5. Works reliably on local network without internet
6. Is affordable for small-to-mid-size productions

### Who serves this gap today

| Requirement | CuePilot | ShowPulse | Ontime | Stagetimer | Companion |
|---|---|---|---|---|---|
| Reads LTC/MTC | ✅ LTC only | ✅ Both | -- | -- | Via add-on |
| Per-department cues | ✅ | ✅ | -- | -- | Manual config |
| Crew device alerts | ✅ Native app | ✅ Browser | ✅ Browser | ✅ Browser | Stream Deck only |
| No app install needed | -- (requires CueApp) | ✅ | ✅ | ✅ | -- |
| Works without internet | ✅ Live show; cloud planning needs internet | ✅ | ✅ | -- | ✅ |
| Affordable | -- (enterprise pricing) | ✅ Free | ✅ Free | Freemium | ✅ Free |

**ShowPulse is the only tool that checks all six boxes.** CuePilot comes closest — its live-show operation is effectively local, but it requires native app installation on crew devices and enterprise-level procurement. The gap between ShowPulse and CuePilot on requirements 4-6 is real but narrower than the table suggests: CuePilot's CueApp is free to download, and its live execution is LAN-based. The structural differentiators are unlimited connections (no tiered pricing), MTC support, and zero procurement friction (no sales engagement, no hardware purchase required).

### Market segments and opportunity

| Segment | Size indicator | Current solution | ShowPulse fit |
|---|---|---|---|
| Major touring (arena/stadium) | ~500 global tours/year | CuePilot, custom systems | Medium — needs OSC first |
| Theater (professional) | Thousands of venues globally | Manual stage management, ETC CueSystem | High — immediate fit |
| Corporate events | Largest segment by volume | Stagetimer, Ontime, nothing | High — free + simple |
| Festivals | ~1,000 major festivals globally | grandMA3 timecode, no crew alerts | High — multi-stage, multi-department |
| Broadcast (live TV) | CuePilot's core market | CuePilot | Low — RS422/GPI requirements |
| Houses of worship | Growing tech adoption | Companion, ProPresenter | Medium — simpler needs |
| DJ/electronic touring | Growing timecode adoption | ShowKontrol + nothing for crew | High — natural extension |

---

## 8. How Productions Wire It Together

Large-scale touring and festival productions do not rely on a single platform. The typical signal flow:

```
Timecode Source                    Department Systems
(DAW / DJ Deck / LTC Gen)         (each with own controller)
        │                                  │
        ▼                                  │
   ┌─────────────┐     OSC/MIDI/MSC   ┌───┴───────────┐
   │ Lighting     │◄──────────────────►│ Show Controller│
   │ Console      │     Art-Net/sACN   │ (Companion /   │
   │ (grandMA3)   │◄─────────────────►│  Medialon)     │
   │              │                    └───┬───────────┘
   │  ◄── LTC ───┤                        │
   └─────────────┘                    OSC/MIDI/MSC
                                          │
        LTC ──────────────────────────────┤
        │                                  ▼
        ▼                          ┌──────────────┐
   ┌─────────────┐                 │ Audio: QLab   │
   │ Media Server │                 │ Laser: Pangolin│
   │ (Disguise)   │                 │ Pyro: FireOne │
   │  ◄── LTC ───┤                 │ Kinetics      │
   └─────────────┘                 └──────────────┘

   ┌─────────────────────────────────────────────┐
   │           ShowPulse / CuePilot               │
   │         ◄── LTC/MTC ───                     │
   │  Reads timecode → pushes countdowns          │
   │  to every department lead's device           │
   └─────────────────────────────────────────────┘
```

**The protocol stack:** LTC for master timecode, Art-Net/sACN for DMX transport, OSC for modern inter-system messaging, MSC for legacy cue triggering. TCNet gaining adoption in DJ/festival world.

**ShowPulse's integration point:** ShowPulse reads the same LTC/MTC feed that the lighting console and media servers chase. It does not need to be "in the chain" — it passively reads timecode and independently pushes alerts. This makes it zero-risk to add to any existing production rig.

---

## 9. Strategic Implications for ShowPulse

### Positioning statement

**ShowPulse is the free, self-hosted alternative to CuePilot for timecode-synced crew alerting. It reads LTC/MTC, shows every department their countdown, and runs as a single binary with unlimited devices and zero internet dependency.**

### What ShowPulse should NOT become

| Don't build | Reason | Who owns it |
|---|---|---|
| Lighting control (DMX/Art-Net output) | Different discipline entirely | grandMA3, ChamSys |
| Video playback / media serving | Different discipline entirely | Disguise, QLab |
| Audio playback | Different discipline entirely | QLab, Ableton |
| Protocol middleware | Competing with free tools on their turf | Companion, Chataigne, ShowCockpit |
| Enterprise show controller | Would require 10x engineering for 1/100th the market | Medialon, SP Grid |
| Cloud platform | LAN-first is a competitive advantage, not a limitation | CuePilot |

### Prioritized roadmap

**Tier 1 — Production-ready (makes ShowPulse deployable on real shows)**

| Priority | Feature | Why | Competitive impact |
|---|---|---|---|
| **1a** | OSC input/output | **Deployment blocker.** Without OSC, ShowPulse can only receive timecode — it cannot participate in the show control ecosystem. A touring LD who wants to trigger ShowPulse cue changes from their grandMA3 macro, or a show caller using Companion, has no path today. OSC is the #1 integration protocol across every competitor in the feature table. It is also the fastest path to closing the Ontime protocol-bridge risk: if ShowPulse has native OSC, the "bridge LTC→OSC→Ontime" workaround loses its appeal. | Plugs ShowPulse into any existing production rig |
| **1b** | Audio/vibration alerts | **Usability blocker for noisy environments.** A pyro operator wearing ear protection at a festival stage cannot see a visual countdown on a tablet 2m away. Without haptic/audio alerts, ShowPulse is limited to quiet backstage environments — which excludes most of the high-value touring and festival segments. | Matches CuePilot CueApp capability |
| **1c** | Fullscreen kiosk mode | **Nice-to-have for first deployments.** Important for permanent department stations, but not a blocker — the current Show tab already works on tablets. Lower urgency than OSC and alerts. | Matches CuePilot CueScreen (browser-based) |

**Tier 2 — Competitive advantage (differentiates from CuePilot)**

| Feature | Why | Competitive impact |
|---|---|---|
| Multi-show support | Every production has rehearsal vs live vs different shows on tour | Table stakes for professional use |
| Cue import (grandMA3 XML, QLab, CuePoints, CSV) | Eliminates double-entry of cue lists | Workflow integration no competitor offers |
| Linux build | Single binary runs on Raspberry Pi. Zero-cost dedicated hardware | CuePilot can't do this |

**Tier 3 — Market expansion**

| Feature | Why | Competitive impact |
|---|---|---|
| MSC input | Legacy protocol wired into every theater | Theater market penetration |
| NDI output | Video feed for backstage monitors (NDI-to-SDI converters are cheap) | Matches CuePilot CueScreen via different path |
| Native mobile wrapper (PWA/Capacitor) | Better wake lock, push notifications, haptics | Matches CuePilot CueApp experience |

### What to explicitly skip

- DMX/Art-Net/sACN output — we don't control lights
- Video/audio playback — we don't fire cues
- Cloud features — LAN-first is our strength
- Enterprise pricing — free + unlimited is our killer differentiator
- RS422/GPI — broadcast is CuePilot's core; not our fight

---

## 10. Pricing Strategy & Sustainability

The document describes ShowPulse's pricing as "Free" — but for a business plan, this requires context. Free and open-source is the **competitive weapon**, not the business model.

### Why free is the right price for ShowPulse

1. **Market creation:** The timecode-synced crew alerting category barely exists. CuePilot's enterprise pricing keeps it invisible to 90% of the market. A free tool creates the category by making it accessible to every production, from school theater to festival stages.
2. **Network effects:** Every crew member who uses ShowPulse on a show becomes a potential advocate. Unlike CuePilot's per-connection licensing, ShowPulse's unlimited connections mean more people touch the product per deployment.
3. **CuePilot cannot respond on price.** Their hardware/cloud/support cost structure prevents them from offering a free tier. This is a structural advantage, not a temporary one.

### Monetization paths (not yet implemented — for business plan context)

| Model | Description | Risk |
|---|---|---|
| **Open core** | Free self-hosted version + paid managed/cloud version with multi-show, team sync, analytics | Splits development focus |
| **Support & SLA** | Free software, paid support contracts for touring companies and venues | Low revenue ceiling |
| **Hardware bundle** | Pre-configured ShowPulse appliance (Raspberry Pi or mini-PC) sold as turnkey product | Inventory/logistics overhead |
| **Integration licensing** | Free standalone, paid integrations (NDI output, console import plugins) | Community backlash risk |
| **Consulting/deployment** | Free tool, paid production deployment and training services | Doesn't scale |

**Current position:** ShowPulse is pre-revenue. The immediate strategic priority is adoption and production validation, not monetization. The business model question should be revisited after ShowPulse has been deployed on 10+ real productions and the user base provides signal on which paid features would be worth paying for.

---

## 11. Emerging Trends (2024-2026)

| Trend | Impact on ShowPulse |
|---|---|
| **Middleware convergence** — Companion and ShowCockpit becoming essential glue layers | ShowPulse benefits: OSC integration makes us another node in the ecosystem |
| **Credit-based licensing** (SP Grid) | Validates the market's appetite for flexible, accessible pricing. Free is even better. |
| **TCNet adoption** in DJ/festival world | Future protocol support opportunity beyond LTC/MTC |
| **VP/XR growth** driving SP Grid adoption | Different market segment; no direct impact |
| **No AI in real-time show control** (as of early 2026) | No disruption risk from AI startups in our category |
| **CuePilot 7.0 Notify Tracks** | Validates the multi-department alerting market. CuePilot is investing in exactly our feature set. |
| **Ontime 3.x growth** (3.3K GitHub stars) | Growing awareness of open-source event timing tools. Users will compare us. |
| **Raspberry Pi in production** | Chataigne already supports RPi. A ShowPulse Linux build on RPi = zero-cost crew alerting hardware. |

---

## Appendix: Source List

*All web sources accessed March 2026. Product pages and documentation may change; verify claims against current versions before citing in external presentations.*

- [CuePilot](https://www.cuepilot.com/)
- [CuePilot Support — Working with Timecode](https://cuepilot.zendesk.com/hc/en-us/articles/360053009651)
- [CuePilot — MIDI on Vision Cues](https://cuepilot.zendesk.com/hc/en-us/articles/360052624072)
- [QLab Documentation](https://qlab.app/docs/v5/)
- [QLab Licenses](https://qlab.app/docs/v5/general/licenses/)
- [QLab Features by License](https://qlab.app/docs/v5/general/features/)
- [Ontime (GitHub)](https://github.com/cpvalente/ontime)
- [Ontime Documentation](https://docs.getontime.no/)
- [Stagetimer.io](https://stagetimer.io/)
- [CuePoints](https://cuepoints.com/)
- [Chataigne](http://benjamin.kuperberg.fr/chataigne/en)
- [Bitfocus Companion](https://bitfocus.io/companion)
- [ShowCockpit](https://showcockpit.com/)
- [Stage Precision SP Grid](https://www.stageprecision.com/)
- [Medialon Manager](https://www.7thsense.one/medialon/)
- [grandMA3](https://www.malighting.com/grandma3/)
- [ChamSys MagicQ](https://chamsys.co.uk/)
- [Disguise](https://www.disguise.one/)
- [Green Hippo](https://www.greenhippo.com/)
- [ShowKontrol](https://www.tcsupply.com/)
- [TimeCode Live](https://timecodesync.com/live/)
- [TXL20 Timecode Expert](https://www.txl20.com/)
- [Rundown Studio](https://rundownstudio.app/)
- [Awesome Audiovisual (GitHub)](https://github.com/stingalleman/awesome-audiovisual)
- [Rocktzar QLab Licensing Guide](https://www.rocktzar.com/qlab-licensing-costs-means/)
- [Capterra QLAB](https://www.capterra.com/p/146969/QLAB/)
- [ControlBooth Forums](https://www.controlbooth.com/)
- [Limelight Wired - CuePoints](https://www.limelightwired.com/post/cuepoints-timecode-programming)
