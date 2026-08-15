// Minimal AMX (Pawn Abstract Machine) binary writer — AMX file version 8,
// the format used by SA-MP servers. Pure TS, no dependencies.

const AMX_MAGIC = 0xf1e0;
const FILE_VERSION = 8;
const AMX_VERSION = 8;
const HEADER_SIZE = 56; // size..nametable
const CELL = 4;

// Opcodes (subset, standard Pawn 3.x numbering)
export const OP = {
  PROC: 46,
  PUSH_C: 39,
  PUSH: 40,
  CONST_PRI: 12,
  CONST_ALT: 13,
  STOR_PRI: 27,
  PUSH_PRI: 34,
  SYSREQ_C: 123,
  STACK: 116,
  ZERO_PRI: 100,
  RETN: 111,
  HALT: 162,
  BREAK: 137,
} as const;

export interface AmxSymbol {
  name: string;
  address: number;
}

export interface AmxBuildInput {
  publics: string[];
  natives: string[];
  /** globals -> reserved data cells */
  globals: string[];
}

interface DefEntry {
  address: number;
  nameOffset: number;
}

class ByteWriter {
  private bytes: number[] = [];
  get length() {
    return this.bytes.length;
  }
  u8(v: number) {
    this.bytes.push(v & 0xff);
    return this;
  }
  u16(v: number) {
    this.bytes.push(v & 0xff, (v >>> 8) & 0xff);
    return this;
  }
  u32(v: number) {
    this.bytes.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff);
    return this;
  }
  str(s: string) {
    for (let i = 0; i < s.length; i++) this.u8(s.charCodeAt(i) & 0xff);
    this.u8(0);
    return this;
  }
  raw(arr: number[]) {
    for (const b of arr) this.bytes.push(b & 0xff);
    return this;
  }
  patchU32(offset: number, v: number) {
    this.bytes[offset] = v & 0xff;
    this.bytes[offset + 1] = (v >>> 8) & 0xff;
    this.bytes[offset + 2] = (v >>> 16) & 0xff;
    this.bytes[offset + 3] = (v >>> 24) & 0xff;
  }
  toUint8Array() {
    return new Uint8Array(this.bytes);
  }
}

/**
 * Builds a structurally valid AMX v8 image: header, public/native/pubvar
 * definition tables, name table, code section and data section.
 * Every public entry points at a `PROC ... ZERO.pri RETN` stub and the entry
 * point halts cleanly, so the image loads and unloads without faulting.
 */
export function buildAmx(input: AmxBuildInput): Uint8Array {
  const publics = dedupe(input.publics);
  const natives = dedupe(input.natives);
  const globals = dedupe(input.globals);

  // ---- name table ----
  const names = new ByteWriter();
  const nameOffsets = new Map<string, number>();
  const addName = (n: string) => {
    if (!nameOffsets.has(n)) {
      nameOffsets.set(n, names.length);
      names.str(n.slice(0, 63));
    }
    return nameOffsets.get(n)!;
  };
  publics.forEach(addName);
  natives.forEach(addName);
  globals.forEach(addName);

  const defsize = CELL + 4; // address + name offset (32-bit name pointer)

  const publicsOfs = HEADER_SIZE;
  const nativesOfs = publicsOfs + publics.length * defsize;
  const librariesOfs = nativesOfs + natives.length * defsize;
  const pubvarsOfs = librariesOfs; // no libraries
  const tagsOfs = pubvarsOfs + globals.length * defsize;
  const nametableOfs = tagsOfs; // no tags
  const codeOfs = align(nametableOfs + names.length, CELL);

  // ---- code section ----
  const code = new ByteWriter();
  // entry stub at code offset 0
  code.u32(OP.PROC);
  code.u32(OP.ZERO_PRI);
  code.u32(OP.HALT).u32(0);

  const publicAddrs: number[] = [];
  for (let p = 0; p < publics.length; p++) {
    publicAddrs.push(code.length);
    code.u32(OP.PROC);
    code.u32(OP.ZERO_PRI);
    code.u32(OP.RETN);
  }
  while (code.length % CELL !== 0) code.u8(0);

  // ---- data section ----
  const data = new ByteWriter();
  const globalAddrs: number[] = [];
  for (let g = 0; g < globals.length; g++) {
    globalAddrs.push(data.length);
    data.u32(0);
  }

  const datOfs = codeOfs + code.length;
  const hea = data.length;
  const stackHeap = 16384;
  const stp = hea + stackHeap;
  const totalSize = datOfs + data.length;

  // ---- assemble ----
  const out = new ByteWriter();
  out.u32(totalSize);
  out.u16(AMX_MAGIC);
  out.u8(FILE_VERSION);
  out.u8(AMX_VERSION);
  out.u16(0); // flags
  out.u16(defsize);
  out.u32(codeOfs);
  out.u32(datOfs);
  out.u32(hea);
  out.u32(stp);
  out.u32(0); // cip -> entry stub
  out.u32(publicsOfs);
  out.u32(nativesOfs);
  out.u32(librariesOfs);
  out.u32(pubvarsOfs);
  out.u32(tagsOfs);
  out.u32(nametableOfs);

  const writeDefs = (entries: DefEntry[]) => {
    for (const e of entries) {
      out.u32(e.address);
      out.u32(nametableOfs + e.nameOffset);
    }
  };

  writeDefs(
    publics
      .map((n, idx) => ({ address: publicAddrs[idx]!, nameOffset: nameOffsets.get(n)! }))
      .sort(byName(publics, nameOffsets)),
  );
  writeDefs(natives.map((n) => ({ address: 0, nameOffset: nameOffsets.get(n)! })));
  writeDefs(globals.map((n, idx) => ({ address: globalAddrs[idx]!, nameOffset: nameOffsets.get(n)! })));

  out.raw(Array.from(names.toUint8Array()));
  while (out.length < codeOfs) out.u8(0);
  out.raw(Array.from(code.toUint8Array()));
  out.raw(Array.from(data.toUint8Array()));

  return out.toUint8Array();
}

function byName(_list: string[], _offsets: Map<string, number>) {
  return (a: DefEntry, b: DefEntry) => a.nameOffset - b.nameOffset;
}

function align(v: number, to: number) {
  return v % to === 0 ? v : v + (to - (v % to));
}

function dedupe(list: string[]) {
  return Array.from(new Set(list.filter(Boolean)));
}
