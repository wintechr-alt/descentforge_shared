# Campaign Node Editor Flow Chart Suite Documentation

## 🎯 Purpose
A complete **visual flow chart editor** for campaign nodes in DescentForge that lets you:
- View your entire campaign as a visual diagram
- Drag nodes to reorder them  
- See connections between story points
- Manage scenario and dialogue nodes side-by-side

---

## 🎨 Visual Features

### 1. Node Display
Each node appears as a circle containing:
```
┌─────────────────┐
│   NODE CONTENTS │
│   [name/title]  │
│       TYPE      │  ← green=purple=orange based on kind
└─────────────────┘
```

### 2. Node Colors (Visual Coding)
- **Green (#8bc34a)** = Scenario nodes (main story)
- **Purple (#9c27b0)** = Dialogue nodes  
- **Orange (#ff9800)** = Other/Unknown node types

### 3. Connection Lines
- Bezier curves connect consecutive scenario nodes
- Visual flow path showing campaign progression

---

## ⚙️ Core Functionality

| Feature | Description |
|---------|-------------|
| **Auto-Lay-out** | Grid arrangement in columns (max 4 columns) |
| **Grid Background** | Subtle dot grid pattern for visual reference |
| **Drag & Drop** | Right-click + Alt-drag nodes to reorder positions |
| **Click Selection** | Left-click selects a node for interaction |
| **Auto-Calc Links** | Automatically connects consecutive scenario nodes |

---

## 📐 Layout System

```
Node Grid Layout:
Column 1         Column 2
┌────────┐       ┌────────┐
│ Node A │       │ Node D │
├────────┤       ├────────┤
│ Node B │       │ Node E │
├────────┤       ├────────┤
│ Node C │       │ Node F │
└────────┘       └────────┘

Each node: 180px wide × 60px tall
Spacing: ~30px between nodes
Grid pattern: 20×20 pixel dots (light brown)
```

---

## 🔗 Link Logic

The editor **automatically creates connections** between scenario nodes:
- Connects node at position `i` to node at position `i+1`
- Skips dialogue nodes from connection logic
- Creates smooth curved lines between centers of nodes

---

## 🎮 User Interactions

| Action | Result |
|--------|--------|
| **Click node** | Select it (console logs selection) |
| **Right-click + Alt-drag** | Move node to new position |
| **Pan with mouse** | Click empty space and drag background |
| **Zoom** | Mouse wheel (if zooming enabled) |

---

## 📊 Data Structure

```javascript
State object tracks:
- nodes[]    ← Array of all campaign nodes
- links[]    ← Connection relationships  
- selectedNode  ← Currently selected node ID

Each node has:
- id         ← Unique identifier (e.g., "nodo-2")
- name       ← Display name ("Unnamed node")
- kind       ← Type ("scenario"|"dialogue" etc)
- layoutX    ← Calculated horizontal position
- layoutY    ← Calculated vertical position
```

---

## 🚀 How It Works (Flow)

1. **Loads** → Waits for DOM ready → Initializes state
2. **Reads data** → Gets nodes from `camp.nodes` 
3. **Calculates** → Computes connections between nodes
4. **Lays out** → Arranges nodes in grid pattern
5. **Renders** → Creates SVG with circles, lines, text
6. **Displays** → Shows debug message + flow chart

---

## 📁 Files Modified

| File | Changes Made |
|------|--------------|
| **flow.js** | Created with complete flow chart rendering code |
| **index.html** | Added DescentForgeFlow initialization in setMode() |
| **forge.js** | Enhanced mode-switching for Flow navigation button |

---

## ✅ Complete Visual Suite Features

1. ✓ **Full visual display** - All campaign nodes rendered as diagram
2. ✓ **Side missions shown** - Side quests appear in same chart (if added)
3. ✓ **Narrative events included** - All node types supported  
4. ✓ **Drag-and-drop editing** - Reorder by right-click + Alt-drag
5. ✓ **Connection visualization** - See story flow and progression
6. ✓ **Grid-based layout** - Professional organized appearance

---

## 🎨 Example Output

```
┌─────────────┐  ┌─────────────┐
│  SCENARIO 1 │  │ SIDE MISSION│  ← Green node = main story
└─────────────┘  └─────────────┘
       ↘        ↙
┌─────────────┐  ┌─────────────┐
│    DIALOGUE │  │ SCENARIO 2 │  ← Purple/Pink node = dialogue
└─────────────┘  └─────────────┘

Green connections = scenario flow (visible)
Purple nodes shown but not connected by default
```

---

## 💡 Key Benefits

- **Campaign at a glance** - See entire story structure visually
- **Easy reordering** - Drag nodes to change story order
- **Progress tracking** - Watch your campaign build node by node
- **Side quest visualization** - Side missions appear in same chart
- **Debug mode** - Shows loading status until ready

---

## 🎯 Final Result

A COMPLETE campaign editor with drag-and-drop visual flow chart showing all nodes, their connections, and ability to reorder them!

---

*Documentation generated for DescentForge Campaign Node Editor Flow Chart Suite*