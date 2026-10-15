# RishFlow – OOAD Diagrams

Reference images for redrawing in Visual Paradigm. Every diagram is based on the real code (`app.py`, `ai_sorter.py`, `duplicate_finder.py`, React UI).
The PlantUML sources are in `src/` if you need to change and re-render them.

| # | Diagram | File | What it shows |
|---|---------|------|---------------|
| 1 | Use Case | `01_use_case.png` | Actors, 19 use cases, include / extend / generalization |
| 2a | State Machine | `02a_state_application.png` | App lifecycle: Splash → Login → Onboarding → Main (composite) → Tray → Exit |
| 2b | State Machine | `02b_state_organize_task.png` | One organization run: Idle → Validating → Organizing (composite) → Completed / Failed → Reverting |
| 2c | State Machine | `02c_state_ai_index.png` | AI search index: NotIndexed → Indexing → Indexed ⇄ Querying |
| 3a | Sequence | `03a_sequence_organize.png` | Organize files in AI mode (UI → API → thread → AISmartSorter → FS → DB) |
| 3b | Sequence | `03b_sequence_undo.png` | Undo last organization (`revert_last`) |
| 3c | Sequence | `03c_sequence_ai_search.png` | Build AI index, then run a query |
| 4a | Activity | `04a_activity_organize.png` | Full organize workflow with 4 swimlanes and all 5 sort modes |
| 4b | Activity | `04b_activity_ai_classify.png` | How AISmartSorter decides a category (image / document / code / other) |
| 5 | Class (bonus) | `05_class_diagram.png` | Main classes, attributes, methods, relationships |

## Drawing them in Visual Paradigm

**Use Case** – Diagram > New > Use Case Diagram
- Actors: **User** (primary, left); **AI Smart Sorter** and **Local File System** (secondary, right, stereotype `<<system>>`).
- Draw a **System** boundary named "RishFlow – AI File Organizer".
- Use plain **Association** lines from actors to use cases.
- `<<include>>`: Organize Files → Select Source Folder, Select Destination Folder, Record Activity; Undo → Record Activity; Search Files → Index Files.
- `<<extend>>`: Clear Activity Log → View Activity Log; Manage Custom Categories → Sort by AI-based Content.
- **Generalization** (hollow triangle): Sort by AI-based Content and Sort by Extension/Date/Size/Name → Organize Files.

**State Machine** – Diagram > New > State Machine Diagram
- Use **Initial** / **Final** pseudo-states, and **Composite State** for "Main Application", "Organizing" and "Indexing".
- Write transition labels as `event [guard] / action`, for example `start_organizing [paths valid] / spawn thread`.
- Put `entry /` and `do /` activities in the state's internal compartment.

**Sequence** – Diagram > New > Sequence Diagram
- Lifelines: Actor (User), Lifelines for the UI / RishFlowAPI / threads / AISmartSorter / File System, and the **Database** shape for ActivityDB.
- Solid arrow = synchronous message, dashed arrow = return. Self-message for internal steps.
- Use **Combined Fragments**: `alt` (if/else), `opt` (optional), `loop` (for each file).
- Organizer/Indexer Thread is created mid-diagram, so use a **Create Message**.

**Activity** – Diagram > New > Activity Diagram
- 4a: add a **Vertical Swimlane** with partitions User | RishFlow UI | RishFlowAPI (Backend) | AI Smart Sorter.
- Use **Decision / Merge** nodes (diamonds) for every `?` box, and label the guards `[yes]` / `[no]`.
- The "More files?" loop is a decision node whose `[yes]` branch loops back.
- 4b is a single-lane activity: one decision for file type, then a nested decision chain per type.
