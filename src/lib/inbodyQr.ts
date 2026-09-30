export type ParsedInBodyQr = {
  measuredDate: string;
  measuredTime: string | null;
  weight: number | null;
  skeletalMuscle: number | null;
  bodyFat: number | null;
  bodyFatPercentage: number | null;
  bmi: number | null;
  visceralFatLevel: number | null;
};

function scaledDigits(value: string, scale = 10) {
  if (!/^\d+$/.test(value)) return null;
  const number = Number(value) / scale;
  return Number.isFinite(number) ? number : null;
}

function plausible(value: number | null, min: number, max: number) {
  return value !== null && value >= min && value <= max ? value : null;
}

function decodeRepeatedly(value: string) {
  let current = value.trim();
  for (let i = 0; i < 3; i += 1) {
    try {
      const decoded = decodeURIComponent(current.replace(/\+/g, '%20'));
      if (decoded === current) break;
      current = decoded;
    } catch {
      break;
    }
  }
  return current;
}

function extractPayload(input: string) {
  const decoded = decodeRepeatedly(input);
  const match = decoded.match(/[?&#](?:IBData|ibdata|data)=([^&#]+)/i);
  return decodeRepeatedly(match?.[1] ?? decoded);
}

function readNamedNumber(payload: string, names: string[], min: number, max: number) {
  for (const name of names) {
    const pattern = new RegExp(`(?:^|[|,;?&#\\s])${name}\\s*[:=]\\s*(-?\\d+(?:\\.\\d+)?)`, 'i');
    const match = payload.match(pattern);
    if (!match) continue;
    const value = Number(match[1]);
    if (Number.isFinite(value) && value >= min && value <= max) return value;
  }
  return null;
}

function readDate(payload: string) {
  const explicit = payload.match(/(?:date|testdate|measureddate)\s*[:=]\s*(20\d{2})[-/.]?(\d{2})[-/.]?(\d{2})(?:[ T]?(\d{2})[:]?([0-5]\d))?/i);
  const compact = explicit ?? payload.match(/(?:^|[^\d])(20\d{2})(0[1-9]|1[0-2])([0-2]\d|3[01])([0-2]\d)([0-5]\d)(?:[0-5]\d)?(?:[^\d]|$)/);
  if (!compact) return null;
  const [, year, month, day, hour, minute] = compact;
  const candidate = new Date(Number(year), Number(month) - 1, Number(day));
  if (candidate.getFullYear() !== Number(year) || candidate.getMonth() !== Number(month) - 1 || candidate.getDate() !== Number(day)) return null;
  return {
    date: `${year}-${month}-${day}`,
    time: hour && minute ? `${hour}:${minute}` : null,
    stamp: `${year}${month}${day}${hour ?? ''}${minute ?? ''}`,
  };
}

function parseNamed(payload: string, dateInfo: ReturnType<typeof readDate>): ParsedInBodyQr | null {
  const weight = readNamedNumber(payload, ['weight', 'wt'], 20, 400);
  const skeletalMuscle = readNamedNumber(payload, ['skeletalmusclemass', 'skeletalmuscle', 'smm'], 5, 150);
  const bodyFat = readNamedNumber(payload, ['bodyfatmass', 'bodyfat', 'bfm'], 0, 150);
  const bodyFatPercentage = readNamedNumber(payload, ['percentbodyfat', 'bodyfatpercentage', 'pbf'], 1, 80);
  const bmi = readNamedNumber(payload, ['bmi'], 8, 80);
  const visceralFatLevel = readNamedNumber(payload, ['visceralfatlevel', 'vfl'], 1, 30);
  if (!dateInfo || [weight, skeletalMuscle, bodyFat, bodyFatPercentage, bmi].filter((v) => v !== null).length < 4) return null;
  return {
    measuredDate: dateInfo.date,
    measuredTime: dateInfo.time,
    weight,
    skeletalMuscle,
    bodyFat,
    bodyFatPercentage,
    bmi,
    visceralFatLevel,
  };
}

function parseFixedWidth(payload: string): ParsedInBodyQr | null {
  const marker = payload.search(/M?20\d{10,12}/);
  if (marker < 0) return null;
  const startsWithM = payload[marker] === 'M';
  const base = startsWithM ? marker : marker - 1;
  const stampStart = startsWithM ? marker + 1 : marker;
  const stamp = payload.slice(stampStart, stampStart + 12);
  if (!/^20\d{10}$/.test(stamp)) return null;

  const read4 = (offset: number) => payload.slice(base + offset, base + offset + 4);
  const bodyFat = plausible(scaledDigits(read4(39)), 0, 150);
  const weight = plausible(scaledDigits(read4(67)), 20, 400);
  const skeletalMuscle = plausible(scaledDigits(read4(83)), 5, 150);
  const bmi = plausible(scaledDigits(read4(95)), 8, 80);
  const bodyFatPercentage = plausible(scaledDigits(read4(99)), 1, 80);

  if ([weight, skeletalMuscle, bodyFat, bodyFatPercentage, bmi].filter((value) => value !== null).length < 4) return null;

  const year = stamp.slice(0, 4);
  const month = stamp.slice(4, 6);
  const day = stamp.slice(6, 8);
  const hour = stamp.slice(8, 10);
  const minute = stamp.slice(10, 12);

  // VFL is intentionally only accepted when it can be identified by a label.
  // Different professional InBody generations place this value differently.
  return {
    measuredDate: `${year}-${month}-${day}`,
    measuredTime: `${hour}:${minute}`,
    weight,
    skeletalMuscle,
    bodyFat,
    bodyFatPercentage,
    bmi,
    visceralFatLevel: readNamedNumber(payload, ['visceralfatlevel', 'vfl'], 1, 30),
  };
}

export function inBodyQrDiagnostic(input: string) {
  const decoded = decodeRepeatedly(input);
  const payload = extractPayload(input);
  let host: string | null = null;
  let queryKeys: string[] = [];
  try {
    const url = new URL(decoded);
    host = url.host;
    queryKeys = Array.from(url.searchParams.keys());
  } catch {
    // Raw QR payloads are also valid input.
  }
  return { host, queryKeys, rawLength: input.length, payloadLength: payload.length };
}

export function parseInBodyQr(input: string): ParsedInBodyQr {
  const payload = extractPayload(input);
  const dateInfo = readDate(payload);
  const named = parseNamed(payload, dateInfo);
  if (named) return named;

  const fixed = parseFixedWidth(payload);
  if (fixed) return fixed;

  throw new Error('인바디 QR 데이터 형식을 확인하지 못했어요. 진단 정보를 확인해 주세요.');
}
