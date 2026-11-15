const encoder = new TextEncoder();

export async function digestHex(algorithm: "SHA-1" | "SHA-256" | "SHA-512", value: string): Promise<string> {
  const bytes = await crypto.subtle.digest(algorithm, encoder.encode(value));
  return [...new Uint8Array(bytes)].map((part) => part.toString(16).padStart(2, "0")).join("");
}

export async function hmacHex(algorithm: "SHA-256" | "SHA-512", secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: algorithm }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return [...new Uint8Array(signature)].map((part) => part.toString(16).padStart(2, "0")).join("");
}

// Small, dependency-free MD5 implementation required by the legacy Duitku/Faspay signature contracts.
export function md5Hex(input: string): string {
  const bytes = [...encoder.encode(input)];
  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 0; i < 8; i++) bytes.push(Math.floor(bitLength / 2 ** (8 * i)) & 255);
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  const shifts = [7,12,17,22,5,9,14,20,4,11,16,23,6,10,15,21];
  const constants = Array.from({length:64}, (_,i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);
  const rotl = (x:number,n:number) => (x << n) | (x >>> (32 - n));
  for (let offset=0; offset<bytes.length; offset+=64) {
    const words = Array.from({length:16}, (_,i) => (bytes[offset+i*4] | (bytes[offset+i*4+1]<<8) | (bytes[offset+i*4+2]<<16) | (bytes[offset+i*4+3]<<24)) >>> 0);
    let a=a0,b=b0,c=c0,d=d0;
    for (let i=0;i<64;i++) {
      let f:number,g:number,s:number;
      if(i<16){f=(b&c)|(~b&d);g=i;s=shifts[i%4];}
      else if(i<32){f=(d&b)|(~d&c);g=(5*i+1)%16;s=shifts[4+i%4];}
      else if(i<48){f=b^c^d;g=(3*i+5)%16;s=shifts[8+i%4];}
      else{f=c^(b|~d);g=(7*i)%16;s=shifts[12+i%4];}
      const next=d; d=c; c=b; b=(b+rotl((a+f+constants[i]+words[g])|0,s))|0; a=next;
    }
    a0=(a0+a)|0;b0=(b0+b)|0;c0=(c0+c)|0;d0=(d0+d)|0;
  }
  return [a0,b0,c0,d0].map(v => [0,8,16,24].map(s => ((v>>>s)&255).toString(16).padStart(2,"0")).join("")).join("");
}

export function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let i=0;i<left.length;i++) mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return mismatch === 0;
}
