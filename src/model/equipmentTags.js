// General equipment categories ("tags"). A LIN's tag comes from the Supplement
// Table when it has one; otherwise it is guessed from keywords in the FMS name,
// which is heavily abbreviated ("TRK CGO", "STLR LB 25T", "GEN ST DSL MEP-802A").

export const TAGS = [
  'Vehicle',
  'Trailer',
  'Communications/Signal',
  'Weapon',
  'Large Systems/Kits',
  'Generators',
  'Temperature Control',
  'Others',
];

export const TAG_ICONS = {
  Vehicle: 'bi-truck',
  Trailer: 'bi-truck-flatbed',
  'Communications/Signal': 'bi-broadcast',
  Weapon: 'bi-crosshair',
  'Large Systems/Kits': 'bi-box-seam',
  Generators: 'bi-lightning-charge',
  'Temperature Control': 'bi-thermometer-half',
  Others: 'bi-three-dots',
};

// Tried in order; the first match wins. The order resolves overlaps: tools and
// test sets go first so "TOOL KIT TK-105" isn't read as a truck ("TK") and
// "TOW SUBSYSTEM TST SET" isn't a weapon; systems before trailers so a
// "KITCHEN FLD TRL MTD" is a kitchen; trailers before vehicles.
const RULES = [
  // Anything for weapons, including their tools and repair shops.
  ['Weapon', /SMALL ARMS|ARMAMENT/],
  ['Others', /\bTOOL|\bTEST|\bTST\b|\bT\/S\b|\bTS\b|CALIBR|MULTIMETER|OSCILLO|ANALYZ|GENERATOR,? ?SIGNAL|TOWBAR|TOW SUBSYSTEM|DIAGNO|TOPHNDLR|FIFTH WHEEL|X-RAY/],
  ['Large Systems/Kits', new RegExp([
    'KITCHEN', '\\bMKT\\b', '\\bCK\\b', 'SHOWER', 'LAUNDRY', '\\bLADS\\b', '\\bFRS\\b', 'FORWARD REPAIR', 'FORWD REP',
    'SHOP', 'CONTAINERIZED', 'WATER (PURIF|STORAGE|SYSTEM)', 'ROWPU', '\\bLWP\\b', '\\bFSSP\\b', 'FORWARD AREA REFUEL',
    '\\bFARE\\b', 'SANITATION', 'DECONTAMINATION', 'COL PROT', 'PUMPING UNIT', 'TK-PUMP', 'PUMP UN', 'TANK UNIT',
    'TANK AND PUMP', 'TANK LIQD', 'LIQUID DISP', '\\bSHELTER\\b', 'EQUIPMENT SET', '^MES\\b', '^DES\\b',
    'CONTACT SUPPORT', 'SINK UNIT', 'RECOVERY SYSTEM', 'BAKERY', 'REFRIGERATED CONTAINER', 'FIELD FEEDING',
  ].join('|'))],
  ['Generators', /\bGEN (SET|ST)\b|\bGENERA\w*\s+S[ET]|GENERATOR(?!,? ?SIGNAL)|\bMEP\b|\bMEP-?\d|POWER PLA|PWR PLT|POWER PLNT|FEEDER SYS|DIST SYS ELEC|LOAD BANK|POWER DISTRIBUTION|\bPDISE\b/],
  ['Temperature Control', /AIR COND|\bA\/C\b|HEATER|\bI?ECU\b|ENVIRONMENTAL CONTROL|\bHVAC\b/],
  ['Trailer', /TRAILER|\bTRLR\b|\bTRLER\b|\bTLR\b|\bSTLR\b|\bTRL\b|\bSEMI ?TR\b|SEMITRAILER|DOLLY/],
  ['Vehicle', new RegExp([
    '\\bTRK\\b', 'TRUCK', '\\bTK\\b', '\\bCARR\\b', 'CARRIER', '\\bBUS\\b', 'SEDAN', '\\bAUTO SED', 'VEHICL', '\\bVEH\\b',
    'HMMWV', 'MRAP', 'JLTV', 'ARMORED', '\\bTR UT\\b', '\\bTR VAN\\b', 'TRCTR', 'TRACTOR', 'FORK', '\\bLF\\b', 'CRANE',
    'KALMAR', '\\bRO TE\\b', 'ROUGH TERRAIN', 'HELICOPTER', 'AMBULANCE', 'WRECKER', 'LOADER', 'EXCAVATOR', 'BULLDOZER',
    'GRADER', 'SCRAPER', '\\bTANK COMBAT', '\\bABRAMS', 'BRADLEY', 'STRYKER', 'PALADIN',
  ].join('|'))],
  ['Weapon', new RegExp([
    'RIFLE', 'CARBINE', 'PISTOL', 'SHOTGUN', 'MACH(INE)? GUN', '\\bMG\\b', '\\bLMG\\b', '\\bMK ?19\\b', 'GRENADE',
    '\\bGREN\\b', 'LAUNCHER', '\\bLCHR\\b', '\\bLNCHR\\b', 'BAYONET', '\\bGUN\\b', '\\bMOUNT\\b', '\\bMT MAC', '\\bMT MG',
    'SIGHT', 'TELESCOPE', '\\bSI THE\\b', 'AN\\/PAS', 'AN\\/PEQ', 'AN\\/PVS', 'NIGHT VIS', '\\bNI VIS', 'ILLUMINATOR',
    'AMMO', 'MORTAR', 'HOWITZER', 'JAVELIN', 'DEMO SET', 'MUNITION', 'WEAPON', 'SNIPER', '\\bTOW\\b', 'SUPPRESSOR',
  ].join('|'))],
  ['Communications/Signal', new RegExp([
    '\\bRADIO\\b', '\\bRDO\\b', 'AN\\/PRC', 'AN\\/VRC', 'AN\\/PSC', 'AN\\/GRC', 'AN\\/TYQ', 'AN\\/GYQ', 'AN\\/FSQ', 'AN\\/PSN',
    '\\bANT\\b', 'ANTENNA', 'SATELLIT', 'SATCOM', 'CRYPT', 'COMPUT', '\\bCMPT', '\\bCPUTER', '\\bCOM ST\\b', '\\bCOM SY\\b',
    'COMMUNICATI', 'COMMUNI', 'TELEPHONE', '\\bSTE\\b', 'NETWORK', 'SWITCHING', 'TERMINAL', 'NAVIGATION', '\\bNA SE SA\\b',
    'TELECONFERENCE', 'WORKSTATION', 'COMMAND SYSTEM', 'INTERROGA', 'INTRGATR', 'PROCESSOR GROUP', 'RECEIVE SUITE',
    'SIGNAL', '\\bWIN-T\\b', '\\bJCR\\b', '\\bJBC-P\\b', '\\bCPOF\\b',
  ].join('|'))],
];

export function guessTag(...texts) {
  for (const text of texts) {
    const t = String(text || '').toUpperCase();
    if (!t) continue;
    for (const [tag, re] of RULES) if (re.test(t)) return tag;
  }
  return 'Others';
}

/** A tag typed by a person or an AI, loosely matched to one of TAGS, or ''. */
export function normalizeTag(value) {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return '';
  const exact = TAGS.find((t) => t.toLowerCase() === v);
  if (exact) return exact;
  if (/comm|signal|radio|network/.test(v)) return 'Communications/Signal';
  if (/weapon|arm|optic|mount/.test(v)) return 'Weapon';
  if (/trailer/.test(v)) return 'Trailer';
  if (/vehicle|truck/.test(v)) return 'Vehicle';
  if (/generator|power/.test(v)) return 'Generators';
  if (/temp|heat|cool|a\/?c\b|air cond/.test(v)) return 'Temperature Control';
  if (/system|kit|large/.test(v)) return 'Large Systems/Kits';
  if (/other/.test(v)) return 'Others';
  return '';
}
