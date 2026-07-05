export async function getUserPlan(): Promise<string> {
  return 'pro';
}

export async function requirePro(): Promise<boolean> {
  return false;
}

export const PRO_GATE_RESPONSE = {
  error: 'Feature unavailable',
  message: 'This feature is temporarily unavailable',
};
