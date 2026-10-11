// 이메일을 주지 않는 소셜 로그인(카카오 등)으로 가입하면 서버가 내부용 주소(…@users.musclehub.invalid)를 쓴다.
// 화면에는 이메일처럼 보여 주지 않는다(백엔드 SocialLoginService.PLACEHOLDER_DOMAIN 과 같은 값).
const PLACEHOLDER_DOMAIN = "@users.musclehub.invalid";

export function displayEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  return email.toLowerCase().endsWith(PLACEHOLDER_DOMAIN) ? null : email;
}
