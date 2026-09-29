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

function extractPayload(input: string) {
  const trimmed = input.trim();
  const match = trimmed.match(/[?&]IBData=([^&#]+)/i);
  const raw = match?.[1] ?? trimmed;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function parseInBodyQr(input: string): ParsedInBodyQr {
  const payload = extractPayload(input);
  const marker = payload.search(/M\d{12}/);
  if (marker < 0) {
    throw new Error('인바디 QR 데이터 형식을 확인하지 못했어요.');
  }

  const stamp = payload.slice(marker + 1, marker + 13);
  if (!/^\d{12}$/.test(stamp)) {
    throw new Error('인바디 측정일을 확인하지 못했어요.');
  }

  const year = stamp.slice(0, 4);
  const month = stamp.slice(4, 6);
  const day = stamp.slice(6, 8);
  const hour = stamp.slice(8, 10);
  const minute = stamp.slice(10, 12);

  const read4 = (offset: number) => payload.slice(marker + offset, marker + offset + 4);

  // InBody 270/compatible QR payloads use fixed-width tenths for these
  // measurements. Keep plausibility guards so an unfamiliar model does not
  // silently save shifted data.
  const bodyFat = plausible(scaledDigits(read4(39)), 0, 150);
  const weight = plausible(scaledDigits(read4(67)), 20, 400);
  const skeletalMuscle = plausible(scaledDigits(read4(83)), 5, 150);
  const bmi = plausible(scaledDigits(read4(95)), 8, 80);
  const bodyFatPercentage = plausible(scaledDigits(read4(99)), 1, 80);

  if ([weight, skeletalMuscle, bodyFat, bodyFatPercentage, bmi].filter((value) => value !== null).length < 4) {
    throw new Error('이 인바디 기종의 QR 형식은 아직 자동입력을 지원하지 않아요.');
  }

  return {
    measuredDate: `${year}-${month}-${day}`,
    measuredTime: `${hour}:${minute}`,
    weight,
    skeletalMuscle,
    bodyFat,
    bodyFatPercentage,
    bmi,
    // The visceral-fat byte position differs between observed InBody formats,
    // so keep this manual until a second verified sample confirms the offset.
    visceralFatLevel: null,
  };
}
