import * as XLSX from 'xlsx';

export function exportNodeToExcel(node, model) {
  if (!node || !model) return;

  const rows = [];
  
  function collect(n) {
    rows.push({
      ID: n.id,
      PARENTID: n.parentId || '',
      ORGTYPE: n.kind,
      UIC: n.uic || '',
      TITLE: n.title || '',
      PARNO: n.parno || '',
      GRADE: n.grade || '',
      POSCO: n.poscode || '',
      ERC: '',
      OFF: n.sheet?.off || 0,
      WO: n.sheet?.wo || 0,
      ENL: n.sheet?.enl || 0,
      MIL: n.sheet?.mil || 0,
      CIV: n.sheet?.civ || 0,
      AUTHEQP: 0,
    });

    if (n.equipment) {
      for (const eq of n.equipment) {
        rows.push({
          ID: n.id,
          PARENTID: n.id, // Self-parented per FMSWeb rules
          ORGTYPE: 'EQ',
          UIC: '',
          TITLE: eq.name,
          PARNO: '',
          GRADE: '',
          POSCO: eq.lin,
          ERC: eq.erc || '',
          OFF: 0,
          WO: 0,
          ENL: 0,
          MIL: 0,
          CIV: 0,
          AUTHEQP: eq.qty || 0,
        });
      }
    }

    if (n.childIds) {
      for (const cid of n.childIds) {
        const childNode = model.byId.get(cid);
        if (childNode) collect(childNode);
      }
    }
  }

  collect(node);

  const header = [
    'ID', 'PARENTID', 'ORGTYPE', 'UIC', 'TITLE', 'PARNO', 'GRADE', 'POSCO', 'ERC', 'OFF', 'WO', 'ENL', 'MIL', 'CIV', 'AUTHEQP'
  ];

  const ws = XLSX.utils.json_to_sheet(rows, { header });
  const wb = XLSX.utils.book_new();
  
  // Sheet name is usually a generated ID in original, we can just name it "Data" or similar
  XLSX.utils.book_append_sheet(wb, ws, "FMSWeb_Export");
  
  const safeName = (node.uic || node.title || 'Unit').replace(/[^\w.-]+/g, '_').substring(0, 30);
  const fileName = `Export_${safeName}.xlsx`;
  
  XLSX.writeFile(wb, fileName);
}
