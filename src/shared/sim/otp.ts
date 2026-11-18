/**
 * SIMULATED: OTP delivery and verification. In production an SMS / email OTP
 * service sends a random code; in the demo every login, sign-up and e-sign OTP
 * is 123456 and the delivery OTP is 1234 (seed-data.md §2).
 */
export const DEMO_LOGIN_OTP = '123456'
export const DEMO_DELIVERY_OTP = '1234'

/** Pretend to send an OTP. Resolves after a short delay like a real SMS gateway. */
export function sendOtp(_to: string): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 600))
}

export function verifyLoginOtp(code: string): boolean {
  return code === DEMO_LOGIN_OTP
}
