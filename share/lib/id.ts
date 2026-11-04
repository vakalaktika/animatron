/** No 0, O, I or l, so an id read off a screen types back in correctly. */
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export const ID_LENGTH = 10;
const SHAPE = new RegExp(`^[${ALPHABET}]{8,16}$`);

/** A fresh share id: ten characters, about 58 bits of randomness. */
export function newShareId(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  let out = "";
  while (out.length < ID_LENGTH) {
    // Bytes at or above the largest multiple of the alphabet size are
    // thrown away, so every character is equally likely.
    const limit = Math.floor(256 / ALPHABET.length) * ALPHABET.length;
    for (const byte of random(ID_LENGTH * 2)) {
      if (byte < limit && out.length < ID_LENGTH) out += ALPHABET[byte % ALPHABET.length];
    }
  }
  return out;
}

export const isShareId = (value: string): boolean => SHAPE.test(value);
