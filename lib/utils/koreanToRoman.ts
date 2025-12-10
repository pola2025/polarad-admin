/**
 * 한글을 로마자(영어)로 변환
 * 국립국어원 로마자 표기법 기반 (간소화)
 */

// 초성, 중성, 종성 매핑
const CHOSUNG = [
  'g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp',
  's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'
];

const JUNGSUNG = [
  'a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa',
  'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i'
];

const JONGSUNG = [
  '', 'g', 'kk', 'gs', 'n', 'nj', 'nh', 'd', 'l', 'lg',
  'lm', 'lb', 'ls', 'lt', 'lp', 'lh', 'm', 'b', 'bs',
  's', 'ss', 'ng', 'j', 'ch', 'k', 't', 'p', 'h'
];

export function koreanToRoman(text: string): string {
  let result = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const code = char.charCodeAt(0);

    // 한글 유니코드 범위: AC00 ~ D7A3
    if (code >= 0xAC00 && code <= 0xD7A3) {
      const syllableIndex = code - 0xAC00;

      const chosungIndex = Math.floor(syllableIndex / 588);
      const jungsungIndex = Math.floor((syllableIndex % 588) / 28);
      const jongsungIndex = syllableIndex % 28;

      result += CHOSUNG[chosungIndex];
      result += JUNGSUNG[jungsungIndex];
      result += JONGSUNG[jongsungIndex];
    } else {
      // 한글이 아닌 문자는 그대로 유지
      result += char;
    }
  }

  return result;
}

/**
 * 슬랙 채널명으로 사용 가능한 형태로 변환
 * - 한글 → 로마자
 * - 소문자 변환
 * - 영문, 숫자, 하이픈, 언더스코어만 허용
 * - 80자 제한
 */
export function toSlackChannelName(text: string): string {
  // 1. 한글을 로마자로 변환
  const romanized = koreanToRoman(text);

  // 2. 소문자 변환
  const lowercased = romanized.toLowerCase();

  // 3. 공백을 언더스코어로
  const withUnderscore = lowercased.replace(/\s+/g, '_');

  // 4. 영문, 숫자, 하이픈, 언더스코어만 허용
  const sanitized = withUnderscore.replace(/[^a-z0-9_\-]/g, '');

  // 5. 80자 제한
  return sanitized.substring(0, 80);
}
