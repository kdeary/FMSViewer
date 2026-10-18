// The Supplement Table every structure starts from, bundled with the app.
// Kept out of supplement.js so the parse worker (which imports that through
// modelFile.js) doesn't carry the CSV too.

import DEFAULT_CSV from '../../data/DEFAULT_SUPPLEMENT_TABLE.csv?raw';
import { amendRows, parseSupplementCsv } from './supplement.js';

/** The default table, amended with `rows` (a model file's own). Fresh ids each call. */
export function withDefaultRows(rows = []) {
  return amendRows(parseSupplementCsv(DEFAULT_CSV).rows, rows);
}
