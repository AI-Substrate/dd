export interface DdAddressSegment {
  kind: 'name' | 'id';
  value: string;
}

export interface DdAddress {
  /** Null means the bare-`#` same-document form. */
  file: string | null;
  /**
   * Empty with a non-null `file` is the WHOLE-FILE form: the address names a
   * file and nothing inside it. Empty with a null `file` is not producible by
   * the parser — `#` alone is malformed.
   */
  segments: DdAddressSegment[];
}

export interface DdAddressFailure {
  class: 'address-malformed';
  location: 'address';
  message: string;
}

const SEGMENT_PATTERN = /^[A-Za-z][A-Za-z0-9._-]*$/;

function malformed(message: string): DdAddressFailure {
  return { class: 'address-malformed', location: 'address', message };
}

export function isAddressFailure(result: DdAddress | DdAddressFailure): result is DdAddressFailure {
  return 'class' in result;
}

/**
 * Parse the locked `file#name/id/name/id...` grammar without resolving any target.
 * Segment kinds are positional hints until P4 resolves optional ids against a schema.
 *
 * A raw with NO `#` is the whole-file form — the bare repository path, parsed as
 * `{ file, segments: [] }` (wl-0023, whole-file-form proposal). It is the ruled
 * storage shape for a `target: "file"` cell, it is already what `ddocs links` and
 * `ddocs graph map` mean by a bare path, and it leaves the fragment free for a
 * future `file#method`. Empty input and a trailing `#` stay malformed: the first
 * names nothing, and the second encodes absence as an empty interior.
 *
 * GRAMMAR ACCEPTANCE IS NOT PERMISSION TO GUESS. Nothing here says a bare string
 * IS a file reference; `core/validate.ts` still requires `target: "file"` or an
 * explicit inline Markdown link before any path is looked for.
 */
export function parseAddress(raw: string): DdAddress | DdAddressFailure {
  if (raw.includes('@')) return malformed('"@" is reserved and is not part of the v1 grammar');
  const boundary = raw.indexOf('#');
  if (boundary !== raw.lastIndexOf('#')) {
    return malformed('address must contain at most one "#" file/interior boundary');
  }
  if (boundary < 0) {
    if (raw.length === 0) return malformed('address must not be empty');
    return { file: raw, segments: [] };
  }
  const filePart = raw.slice(0, boundary);
  const interior = raw.slice(boundary + 1);
  if (interior.length === 0) return malformed('address interior must not be empty');

  const values = interior.split('/');
  if (values.some((segment) => segment.length === 0)) {
    return malformed('address interior must not contain empty segments');
  }
  const segments: DdAddressSegment[] = [];
  for (const [index, value] of values.entries()) {
    if (!SEGMENT_PATTERN.test(value)) {
      return malformed(
        `segment "${value}" must start with a letter and contain only [A-Za-z0-9._-]`,
      );
    }
    segments.push({ kind: index % 2 === 0 ? 'name' : 'id', value });
  }
  return { file: filePart.length === 0 ? null : filePart, segments };
}

/**
 * Emit the canonical spelling. An address with no interior formats as the bare
 * path it was written as — never with a trailing `#`, which the parser refuses
 * and which would put a meaningless fragment into every rendered href.
 */
export function formatAddress(address: DdAddress): string {
  const interior = address.segments.map((segment) => segment.value).join('/');
  if (interior.length === 0) return address.file ?? '';
  return `${address.file ?? ''}#${interior}`;
}

export function normalizeFilePath(raw: string): string {
  const withPosixSeparators = raw.replaceAll('\\', '/');
  const absolute = withPosixSeparators.startsWith('/');
  const stack: string[] = [];
  for (const part of withPosixSeparators.split('/')) {
    if (part.length === 0 || part === '.') continue;
    if (part === '..') {
      if (stack.length > 0 && stack.at(-1) !== '..') {
        stack.pop();
      } else if (!absolute) {
        stack.push(part);
      }
      continue;
    }
    stack.push(part);
  }
  return `${absolute ? '/' : ''}${stack.join('/')}`;
}

/** Canonicalize path separators/dot segments; the schema/id interior is unchanged. */
export function normalizeAddress(address: DdAddress): DdAddress {
  return {
    file: address.file === null ? null : normalizeFilePath(address.file),
    segments: address.segments.map((segment) => ({ ...segment })),
  };
}
