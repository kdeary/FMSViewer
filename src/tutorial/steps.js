// The guided tour, as data.
//
// Level 1 (OVERVIEW) touches every part of the viewer briefly and ends on a
// choice: stop there, go through every deep dive (CHAPTERS, level 2), or pick
// a single section.
//
// A step is { id, title, body, target?, placement?, ui?, scroll?, when? }:
//  - target     CSS selector, or (ctx) => selector. None: a centred card.
//  - placement  preferred side for the card: bottom | top | left | right.
//  - ui         the state of the app the step needs. It is declarative -- the
//               tour closes anything a step doesn't list -- so stepping back
//               and forth always lands in the same place:
//                 focus     'root' (fit everything) | 'unit' | 'billet'; the
//                           camera only moves when this changes
//                 panel     false hides the side panel, which otherwise shows
//                           on steps that set a unit or billet focus
//                 search    true, or a query string to prefill
//                 stats     'personnel' | 'equipment' | 'info'
//                 tree, legend, settings, exportOpen, mos (MOS detail modal)
//  - scroll     scroll the target into view (targets inside scrolling panels)
//  - tryIt      a suggestion shown on the card. Everything inside the
//               spotlight is live on every step; this just points it out
//  - when       (ctx) => boolean; the step is left out when false
//
// `ctx` is { demo: { unitId, billetId, mos, unitHasMos, unitHasEq }, hasWarnings }.

const unitBox = (ctx) => `[data-id="${CSS.escape(ctx.demo.unitId)}"]`;
const billetBox = (ctx) => `[data-id="${CSS.escape(ctx.demo.billetId)}"]`;
const hasBillet = (ctx) => !!ctx.demo.billetId;

export const OVERVIEW = [
  {
    id: 'welcome',
    title: 'Welcome to FMSViewer',
    body: 'This quick tour touches every part of the viewer. At the end you can stop, go through each part in depth, or pick just one section. Use Next and Back (or the arrow keys) to move. Feel free to close the tutorial at any point to test out a feature. You can resume it with the Tutorial (?) button at the top of the site.',
    ui: { focus: 'root' },
  },
  {
    id: 'map',
    title: 'The map',
    body: 'Your whole structure is drawn as nested boxes. Units contain sub-units, all the way down to crews and individual soldier billets. Scroll or pinch to zoom, and drag to pan. On a keyboard, F brings the whole structure back into view.',
    tryIt: 'Zoom and drag inside the highlight.',
    target: '.map-surface',
    ui: { focus: 'root' },
  },
  {
    id: 'unit-box',
    title: 'Units open as you zoom',
    body: 'Click or tap the header of any box to zoom into it. Once a unit is big enough on screen, it will show the units inside it.',
    tryIt: 'Tap the header of a unit inside the highlighted area.',
    target: unitBox,
    placement: 'right',
    ui: { focus: 'unit', panel: false },
  },
  {
    id: 'side-panel',
    title: 'Unit details',
    body: 'Selecting a box also shows its details here: strength, MOS mix, equipment and everything it contains. On a phone, open this panel with the button in the bottom-left corner.',
    target: '.side-panel',
    placement: 'left',
    ui: { focus: 'unit' },
  },
  {
    id: 'crumbs',
    title: 'Where you are',
    body: 'The trail runs from the top unit down to the one in focus. Click any step to jump back up to it. Esc goes up one level.',
    target: '[data-tour="crumbs"]',
    ui: { focus: 'unit', panel: false },
  },
  {
    id: 'search',
    title: 'Search',
    body: 'Find units, billets and equipment inside any unit. Plain text searches every field. Prefixes like MOS:56M or LIN:T73827 narrow it down.',
    target: '.search-panel',
    placement: 'right',
    ui: { focus: 'unit', panel: false, search: true },
  },
  {
    id: 'toolbar',
    title: 'The toolbar',
    body: 'Every tool is in this row: New, Export, Search, Tree, Stats, Legend, Settings and this tutorial.',
    target: '.topbar-tools',
    ui: { focus: 'root', panel: false },
  },
  {
    id: 'tree',
    title: 'Tree',
    body: 'The whole hierarchy as an expandable outline. Click a unit in it to fly there on the map.',
    target: '[aria-label="Unit Breakdown Tree"] .modal-content',
    ui: { tree: true },
  },
  {
    id: 'stats',
    title: 'Stats',
    body: 'Totals for the whole structure: strength, a breakdown of every MOS, every equipment line, and the Supplement Table that adds names and descriptions.',
    target: '[aria-label="Unit Statistics"] .modal-content',
    ui: { stats: 'personnel' },
  },
  {
    id: 'legend',
    title: 'Legend',
    body: 'What the colours mean. Soldier boxes are coloured by MOS, and the most common ones are listed first. Click any MOS to read about it.',
    target: '.legend',
    placement: 'right',
    ui: { focus: 'root', legend: true },
  },
  {
    id: 'settings',
    title: 'Settings',
    body: 'Choose how soon units open as you zoom, turn on censor mode before taking screenshots, and switch on generated unit symbols.',
    target: '[aria-label="Settings"] .modal-content',
    ui: { settings: true },
  },
  {
    id: 'files',
    title: 'New and Export',
    body: 'New (the page icon) takes you back to the home page to open another file. Export saves this structure as a .fmsmodel.json file, which reopens instantly without reading the spreadsheet again.',
    target: '[data-tour="file"]',
    ui: {},
  },
  {
    id: 'statusbar',
    title: 'Status bar',
    body: 'The UIC, imported file, and the app version.',
    target: '[data-tour="statusbar"]',
    placement: 'top',
    ui: {},
  },
  {
    id: 'replay',
    title: 'Come back any time',
    body: 'The Tutorial (?) button reopens this tour where you left off. From there you can also jump straight to a single section.',
    target: '[data-tour="tutorial-btn"]',
    ui: {},
  },
  { id: 'choice', kind: 'choice', title: 'That’s the overview', ui: { panel: false } },
];

export const CHAPTERS = [
  {
    id: 'map',
    title: 'The map',
    icon: 'bi-grid-1x2',
    blurb: 'Box types, what each box shows, and getting around.',
    steps: [
      {
        id: 'map-kinds',
        title: 'Three kinds of box',
        body: 'Units have a blue edge. Crews and vehicles have a gold edge. Soldiers (billets) are dark green. Each header shows the box’s title and its military strength.',
        target: '.map-surface',
        ui: { focus: 'root' },
      },
      {
        id: 'map-summary',
        title: 'The summary face',
        body: 'A mid-sized unit shows a summary of itself: strength split into officer, warrant, enlisted and civilian, a colour bar of its MOS’s, and any equipment assigned directly to it.',
        target: unitBox,
        placement: 'right',
        ui: { focus: 'unit', panel: false },
      },
      {
        id: 'map-billet',
        title: 'Soldier billets',
        body: 'At the deepest level, each soldier box shows its MOS, grade, POSCO and paragraph number, plus any equipment assigned to that position.',
        target: billetBox,
        placement: 'right',
        when: hasBillet,
        ui: { focus: 'billet', panel: false },
      }
    ],
  },
  {
    id: 'panel',
    title: 'Unit details',
    icon: 'bi-layout-sidebar-reverse',
    blurb: 'Everything the side panel shows for a unit or a soldier.',
    steps: [
      {
        id: 'panel-head',
        title: 'Header',
        body: 'The box type, its full title, and a link up to its parent unit. The download button exports this unit and everything under it to Excel.',
        target: '.side-panel .card-header',
        placement: 'left',
        ui: { focus: 'unit' },
      },
      {
        id: 'panel-figures',
        title: 'Key figures',
        body: 'Military and civilian strength, the officer / warrant / enlisted split, sub-units and crews, billets, paragraph number, UIC and equipment totals.',
        target: '.side-panel dl',
        placement: 'left',
        scroll: true,
        ui: { focus: 'unit' },
      },
      {
        id: 'panel-mos',
        title: 'MOS breakdown',
        body: 'How this unit’s billets split across MOSs, using the same colours as the map and the Legend.',
        target: '[data-tour="panel-mos"]',
        placement: 'left',
        scroll: true,
        when: (ctx) => ctx.demo.unitHasMos,
        ui: { focus: 'unit' },
      },
      {
        id: 'panel-eq',
        title: 'Equipment',
        body: 'Assigned equipment belongs to this unit directly. Contained equipment adds up everything below it, grouped by type. Click a LIN to see its details, including a name from the Supplement Table.',
        target: '.side-panel .eq-accordion',
        placement: 'left',
        scroll: true,
        when: (ctx) => ctx.demo.unitHasEq,
        ui: { focus: 'unit' },
      },
      {
        id: 'panel-contains',
        title: 'Contains',
        body: 'Every sub-unit or billet directly inside this one, with its strength. Click one to fly to it.',
        target: '[data-tour="panel-contains"]',
        placement: 'left',
        scroll: true,
        ui: { focus: 'unit' },
      },
      {
        id: 'panel-billet',
        title: 'Soldier details',
        body: 'For a soldier the panel shows MOS, grade and POSCO. It also shows the MOS’s major duties from the enlisted MOS specifications when they’re available.',
        target: '.side-panel dl',
        placement: 'left',
        scroll: true,
        when: hasBillet,
        ui: { focus: 'billet' },
      },
      {
        id: 'panel-mos-detail',
        title: 'MOS details',
        body: 'Clicking an MOS anywhere (the side panel, the Legend or Stats) opens this window: its title, branch, how many billets there are in the unit, and a Search billets button.',
        target: '.eq-detail-modal .modal-content',
        when: (ctx) => !!ctx.demo.mos,
        ui: { focus: 'billet', mos: true },
      },
    ],
  },
  {
    id: 'search',
    title: 'Search',
    icon: 'bi-search',
    blurb: 'Scopes, field prefixes and jumping to results.',
    steps: [
      {
        id: 'search-scope',
        title: 'What’s being searched',
        body: 'Search only looks inside the unit named here. Click it, then click any unit on the map to search that unit instead.',
        target: '.search-scope',
        placement: 'right',
        ui: { focus: 'root', search: true },
      },
      {
        id: 'search-query',
        title: 'Queries',
        body: 'Plain text searches every field at once. A prefix narrows it to one field: MOS:, LIN:, TITLE:, GRADE:, UIC:, CAT:, ERC: or PAR:. This one finds every billet with the MOS shown.',
        target: '.search-query',
        placement: 'right',
        ui: { focus: 'root', search: 'demo-mos' },
      },
      {
        id: 'search-results',
        title: 'Results',
        body: 'Each result shows where it sits in the structure, what matched, and its strength or grade. Click one (or press Enter for the first) to fly straight to it.',
        target: '.search-results',
        placement: 'right',
        ui: { focus: 'root', search: 'demo-mos' },
      },
      {
        id: 'search-help',
        title: 'Syntax help',
        body: 'The i button lists every prefix with an example.',
        target: '.search-info-btn',
        placement: 'right',
        ui: { focus: 'root', search: 'demo-mos' },
      },
    ],
  },
  {
    id: 'tree',
    title: 'Tree',
    icon: 'bi-diagram-3',
    blurb: 'The hierarchy as an outline.',
    steps: [
      {
        id: 'tree-overview',
        title: 'Unit Breakdown Tree',
        body: 'The same structure as the map, laid out as an outline you can expand level by level.',
        target: '[aria-label="Unit Breakdown Tree"] .modal-content',
        ui: { tree: true },
      },
      {
        id: 'tree-controls',
        title: 'Units only vs Units & Billets',
        body: 'The "Units only" switch on the left side hides the individual billets so you see just the unit skeleton. Expand All and Collapse All open or close every branch at once.',
        target: '[data-tour="tree-controls"]',
        ui: { tree: true },
      },
      {
        id: 'tree-go',
        title: 'Jump to a unit',
        body: 'Click a unit’s name, or its pin, to close the tree and fly to that unit on the map.',
        target: '.tree-container',
        ui: { tree: true },
      },
    ],
  },
  {
    id: 'stats',
    title: 'Stats',
    icon: 'bi-bar-chart',
    blurb: 'Personnel and equipment for the whole structure.',
    steps: [
      {
        id: 'stats-tabs',
        title: 'Three tabs',
        body: 'Personnel, Equipment and Supplement Table. All three cover the whole structure you loaded. The Supplement Table has a section of its own in this tutorial.',
        target: '[data-tour="stats-tabs"]',
        ui: { stats: 'personnel' },
      },
      {
        id: 'stats-personnel',
        title: 'Personnel',
        body: 'Total strength by Officer/Warrant/Enlisted/Civilian at the top. At the bottom, every MOS sorted by amount in the unit. Click a row for the MOS’s details, or search for it on the map.',
        target: '[aria-label="Unit Statistics"] .modal-body',
        ui: { stats: 'personnel' },
      },
      {
        id: 'stats-equipment',
        title: 'Equipment',
        body: 'Every equipment line, grouped by category, with ERC P (pacing) items first. The filter matches nomenclature, LIN, ERC or category code. Click a LIN for its details. Some items are similar enough in name that they get grouped into a single category.',
        target: '[aria-label="Unit Statistics"] .modal-body',
        ui: { stats: 'equipment' },
      },
      {
        id: 'stats-supplement',
        title: 'Supplement Table',
        body: 'The Supplement Table is an important part of FMSViewer, and will be covered in the next section.',
        target: '[aria-label="Unit Statistics"] .modal-body',
        ui: { stats: 'info' },
      },
    ],
  },
  {
    id: 'supplement',
    title: 'Supplement Table',
    icon: 'bi-table',
    blurb: '"Real" equipment names and MOS descriptions.',
    steps: [
      {
        id: 'sup-why',
        title: 'Why it’s there',
        body: 'The names on FMSWeb exports are often not the actual nomenclature of the equipment. The Supplement Table gives you a 90% solution to fix that. The following steps show you how to utilize AI tools to generate the real nomenclature, a type tag and a description for equipment, and a title and description for each MOS.',
        target: '[data-tour="sup-coverage"]',
        ui: { stats: 'info' },
      },
      {
        id: 'sup-prompt',
        title: 'Step 1 · Copy the prompt',
        body: 'Utilize any free AI tool (ChatGPT, Gemini, Claude, etc...) to generate this data for you. Click Copy prompt and paste it into any AI chat, or use Download .txt to attach the prompt as a file instead.',
        target: '[data-tour="sup-prompt"]',
        scroll: true,
        ui: { stats: 'info' },
      },
      {
        id: 'sup-missing',
        title: 'Big units: finish in rounds',
        body: 'An AI may stop partway through a long list. You can either: 1) Ask it to continue, or 2) import what it generated have so far, tick this box and copy the prompt again. The newly generated prompt asks only for the data in the table that is still missing.',
        target: '[data-tour="sup-missing"]',
        scroll: true,
        ui: { stats: 'info' },
      },
      {
        id: 'sup-import',
        title: 'Step 2 · Import the answer',
        body: 'Save the AI’s answer as a .csv or .txt file and choose it here. Once the table has rows, you also choose between Amend (adds new codes and overwrites matching ones) and Replace (starts the table over). A message confirms how many LIN and MOS rows came in, and how many unusable rows were skipped.',
        target: '[data-tour="sup-import"]',
        scroll: true,
        ui: { stats: 'info' },
      },
      {
        id: 'sup-table-head',
        title: 'Step 3 · The table',
        body: 'AI can get certain equipment wrong. This is where the 10% (you) comes in. You can edit the imported table like a spreadsheet. You can also export CSV files after you have edited them, to keep or share with others and import them again later.',
        target: '[data-tour="sup-table-head"]',
        scroll: true,
        ui: { stats: 'info' },
      },
      {
        id: 'sup-rows',
        title: 'Checking and editing rows',
        body: 'Imported rows are here, and every cell can be edited. Changes are automatically saved. For equipment, the Tag field sets which group it falls under in the "Contained equipment" table. Leave it on Auto to have the tool automatically guess it. The × deletes a row.',
        target: '[data-tour="sup-rows"]',
        scroll: true,
        ui: { stats: 'info' },
      },
      {
        id: 'sup-where',
        title: 'Where it shows up',
        body: 'Data in the Supplement Table replace the original FMSWeb data everywhere on the site. Note: This table is not saved once you leave the site. Remember to export it if you want to save it for another MTOE.',
        ui: { stats: 'info' },
      },
    ],
  },
  {
    id: 'legend',
    title: 'Legend',
    icon: 'bi-palette',
    blurb: 'Box types and MOS colours.',
    steps: [
      {
        id: 'legend-kinds',
        title: 'Box types',
        body: 'The edge colour of each kind of box: units, crews and vehicles, and soldiers.',
        target: '.legend',
        placement: 'right',
        ui: { focus: 'root', legend: true },
      },
      {
        id: 'legend-mos',
        title: 'MOS colours',
        body: 'Every MOS in this structure with its colour and billet count, most common first. The same colours fill the soldier boxes and the MOS bars. Click one for its details.',
        target: '.legend',
        placement: 'right',
        ui: { focus: 'root', legend: true },
      },
    ],
  },
  {
    id: 'settings',
    title: 'Settings',
    icon: 'bi-sliders',
    blurb: 'Detail level, censor mode, unit symbols.',
    steps: [
      {
        id: 'settings-detail',
        title: 'How soon units open',
        body: 'A unit shows what’s inside it once the smallest text inside would reach this size on screen. Lower values open units sooner, with smaller text. Higher values keep them closed until the text is easy to read.',
        target: '[data-tour="settings-detail"]',
        ui: { settings: true },
      },
      {
        id: 'settings-censor',
        title: 'Censor information',
        body: 'Replaces unit, billet and equipment names, LINs and MOSs with generic labels. Use it for screenshots and demos. The Supplement Table is hidden while it’s on.',
        target: '[data-tour="settings-censor"]',
        ui: { settings: true },
      },
      {
        id: 'settings-symbols',
        title: 'Unit symbols',
        body: 'Draws a unit symbol in place of each placeholder icon. The symbol is guessed from the unit’s title, so treat it as a hint.',
        target: '[data-tour="settings-symbols"]',
        ui: { settings: true },
      }
    ],
  },
  {
    id: 'files',
    title: 'Files & saving',
    icon: 'bi-save',
    blurb: 'Exporting, starting over, warnings, the status bar.',
    steps: [
      {
        id: 'files-export',
        title: 'Export the model',
        body: 'Downloads the whole parsed structure, with its layout and your Supplement Table, as a .fmsmodel.json file. Drop that file on the home page later to reopen it instantly.',
        target: '[aria-label="Export"] .modal-content',
        ui: { exportOpen: true },
      },
      {
        id: 'files-new',
        title: 'Start over',
        body: 'New, or the logo at the top right, takes you back to the home page to load another spreadsheet. Export first if you want to keep a Supplement Table you’ve built.',
        target: '[data-tour="file"]',
        ui: {},
      },
      {
        id: 'files-warnings',
        title: 'Warnings',
        body: 'Rows the reader couldn’t place cleanly. Tap the warning icon to see which ones and why.',
        target: '[data-tour="warnings-btn"]',
        when: (ctx) => ctx.hasWarnings,
        ui: {},
      },
      {
        id: 'files-status',
        title: 'Status bar',
        body: 'The UIC, the source file and the app version. On a wider screen also its run date, how many nodes and rows it has, how long it took to read, and the current zoom.',
        target: '[data-tour="statusbar"]',
        placement: 'top',
        ui: {},
      },
    ],
  },
];

const DONE = { id: 'done', kind: 'done', title: 'You’re all set', ui: { panel: false } };
const MENU = { id: 'menu', kind: 'menu', title: 'Pick a section', ui: { panel: false } };
const AFTER = { id: 'after', kind: 'menu', after: true, title: 'Section complete', ui: { panel: false } };

/**
 * Every track the tour can be on, with the steps that don't apply to this
 * structure left out:
 *   overview       level 1, ending on the choice
 *   all            every chapter back to back
 *   menu           the section picker
 *   ch:<id>        one chapter, ending back at the picker
 */
export function buildTracks(ctx) {
  const keep = (s) => !s.when || s.when(ctx);
  const tracks = {
    overview: OVERVIEW.filter(keep).map((s) => ({ ...s, section: 'Overview' })),
    menu: [MENU],
    all: [],
  };
  for (const ch of CHAPTERS) {
    const steps = ch.steps.filter(keep).map((s) => ({ ...s, section: ch.title }));
    tracks[`ch:${ch.id}`] = [...steps, AFTER];
    tracks.all.push(...steps);
  }
  tracks.all.push(DONE);
  return tracks;
}
