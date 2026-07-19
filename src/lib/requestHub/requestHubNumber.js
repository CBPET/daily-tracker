/** Generate 8-digit ticket numbers with uniqueness retry support. */

export function generateTicketNumber() {
  const n = Math.floor(10000000 + Math.random() * 90000000);
  return String(n);
}

export async function createUniqueTicketNumber(insertFn, maxAttempts = 5) {
  let lastError = null;
  for (let i = 0; i < maxAttempts; i += 1) {
    const ticketNumber = generateTicketNumber();
    try {
      const result = await insertFn(ticketNumber);
      if (result?.error) {
        const code = result.error.code || result.error.message || '';
        if (String(code).includes('23505') || String(result.error.message || '').toLowerCase().includes('unique')) {
          lastError = result.error;
          continue;
        }
        return result;
      }
      return result;
    } catch (err) {
      lastError = err;
      if (String(err?.code || err?.message || '').includes('23505')) continue;
      throw err;
    }
  }
  throw lastError || new Error('Could not generate a unique ticket number');
}
