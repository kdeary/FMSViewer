import { getEquipmentCategory } from './rollups.js';

const PHONETIC = [
  'Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel',
  'India', 'Juliet', 'Kilo', 'Lima', 'Mike', 'November', 'Oscar', 'Papa',
  'Quebec', 'Romeo', 'Sierra', 'Tango', 'Uniform', 'Victor', 'Whiskey',
  'X-ray', 'Yankee', 'Zulu',
];

function getOrdinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function getPhoneticName(index) {
  if (index < PHONETIC.length) return PHONETIC[index];
  const first = Math.floor(index / PHONETIC.length) - 1;
  const second = index % PHONETIC.length;
  if (first < PHONETIC.length) {
    return `${PHONETIC[first]} ${PHONETIC[second]}`;
  }
  return `Crew ${index + 1}`;
}

function getCensoredMos(index) {
  const prefix = String(Math.floor(index / 26)).padStart(2, '0');
  const letter = String.fromCharCode(65 + (index % 26));
  return `${prefix}${letter}`;
}

function generateCensoredLin(index, key) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash) + key.charCodeAt(i);
    hash |= 0;
  }
  hash = Math.abs(hash);
  const letter = String.fromCharCode(65 + ((hash + index) % 26));
  const digits = String((hash * 13 + index * 97 + 12345) % 100000).padStart(5, '0');
  return `${letter}${digits}`;
}

/**
 * Returns a censored copy of the given model with generic names for units, crew, billets,
 * equipment, and MOSs, leaving the tree layout and rollups structurally identical.
 */
export function censorModel(model) {
  if (!model || !model.nodes || !model.byId) return model;

  // 1. Build MOS Mapping for all unique MOSs in alphabetical order
  const uniqueMosSet = new Set();
  for (const n of model.nodes) {
    if (n.kind === 'BL' && n.mos) {
      uniqueMosSet.add(n.mos.toUpperCase());
    }
  }
  const sortedOriginalMos = Array.from(uniqueMosSet).sort();
  const mosMap = new Map();
  sortedOriginalMos.forEach((origMos, idx) => {
    mosMap.set(origMos, getCensoredMos(idx));
  });

  // 2. Build Equipment Mapping for all unique equipment lines
  const uniqueEqMap = new Map();
  for (const n of model.nodes) {
    if (n.equipment) {
      for (const eq of n.equipment) {
        const key = `${(eq.lin || '').trim().toUpperCase()}||${(eq.name || '').trim().toUpperCase()}`;
        if (!uniqueEqMap.has(key)) {
          uniqueEqMap.set(key, true);
        }
      }
    }
  }
  const eqCensoredMap = new Map();
  let eqIdx = 0;
  for (const [key] of uniqueEqMap) {
    eqIdx++;
    eqCensoredMap.set(key, {
      lin: generateCensoredLin(eqIdx, key),
      name: `Equipment #${eqIdx}`,
    });
  }

  const censorEqList = (list) => {
    if (!list) return [];
    return list.map((item) => {
      const key = `${(item.lin || '').trim().toUpperCase()}||${(item.name || '').trim().toUpperCase()}`;
      const censored = eqCensoredMap.get(key);
      if (censored) {
        return { ...item, lin: censored.lin, name: censored.name };
      }
      return {
        ...item,
        lin: item.lin ? 'E00001' : '',
        name: item.name ? 'Equipment #999' : item.name,
      };
    });
  };

  // 3. Clone nodes and assign censored titles based on hierarchy
  const newNodes = model.nodes.map((n) => ({ ...n }));
  const newById = new Map();
  newNodes.forEach((n) => newById.set(n.id, n));

  const rootNode = newById.get(model.rootId);
  if (rootNode) {
    if (rootNode.synthetic) {
      rootNode.title = 'Force Structure';
    } else if (rootNode.kind === 'UN') {
      rootNode.title = '1st Unit';
    } else if (rootNode.kind === 'CR') {
      rootNode.title = 'Alpha Crew';
    } else if (rootNode.kind === 'BL') {
      rootNode.title = 'Soldier #1';
    }
  }

  const stack = [model.rootId];
  const visited = new Set();

  while (stack.length) {
    const parentId = stack.pop();
    if (visited.has(parentId)) continue;
    visited.add(parentId);

    const parent = newById.get(parentId);
    if (!parent || !parent.childIds) continue;

    let unitCount = 0;
    let crewCount = 0;
    let billetCount = 0;

    for (const childId of parent.childIds) {
      const child = newById.get(childId);
      if (!child) continue;

      if (child.kind === 'UN') {
        unitCount++;
        child.title = `${getOrdinal(unitCount)} Unit`;
      } else if (child.kind === 'CR') {
        crewCount++;
        child.title = `${getPhoneticName(crewCount - 1)} Crew`;
      } else if (child.kind === 'BL') {
        billetCount++;
        child.title = `Soldier #${billetCount}`;
      }

      if (child.uic) {
        child.uic = 'XXXXXX';
      }

      stack.push(childId);
    }
  }

  // 4. Update billet MOS, poscode, equipment, and rollups for all nodes
  for (const node of newNodes) {
    if (node.kind === 'BL' && node.mos) {
      const orig = node.mos.toUpperCase();
      if (mosMap.has(orig)) {
        const censoredMos = mosMap.get(orig);
        node.mos = censoredMos;
        if (node.poscode && node.poscode.toUpperCase().startsWith(orig)) {
          node.poscode = censoredMos + node.poscode.slice(orig.length);
        } else {
          node.poscode = censoredMos;
        }
      }
    }

    if (node.uic) {
      node.uic = 'XXXXXX';
    }

    if (node.equipment) {
      node.equipment = censorEqList(node.equipment);
    }
    if (node.allEq) {
      node.allEq = censorEqList(node.allEq);
    }

    if (node.mosCounts) {
      const newMosCounts = {};
      for (const [m, count] of Object.entries(node.mosCounts)) {
        const censored = mosMap.get(m.toUpperCase()) || m;
        newMosCounts[censored] = (newMosCounts[censored] || 0) + count;
      }
      node.mosCounts = newMosCounts;
    }

    if (node.topMos) {
      const mosMapCount = new Map();
      for (const item of node.topMos) {
        const censored = mosMap.get(item.mos.toUpperCase()) || item.mos;
        mosMapCount.set(censored, (mosMapCount.get(censored) || 0) + item.n);
      }
      node.topMos = Array.from(mosMapCount.entries())
        .map(([mos, n]) => ({ mos, n }))
        .sort((a, b) => b.n - a.n || a.mos.localeCompare(b.mos));
    }
  }

  // Re-calculate globalCatCounts
  const globalCatCounts = new Map();
  if (rootNode && rootNode.allEq) {
    for (const item of rootNode.allEq) {
      const cat = getEquipmentCategory(item.name);
      globalCatCounts.set(cat, (globalCatCounts.get(cat) || 0) + item.qty);
    }
  }

  for (const n of newNodes) {
    n.globalCatCounts = globalCatCounts;
  }

  const censoredMeta = {
    ...model.meta,
    uic: model.meta?.uic ? 'XXXXXX' : model.meta?.uic,
    rootTitle: rootNode ? rootNode.title : model.meta?.rootTitle,
  };

  return {
    ...model,
    meta: censoredMeta,
    nodes: newNodes,
    byId: newById,
    globalCatCounts,
  };
}
