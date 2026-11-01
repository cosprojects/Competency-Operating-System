/**
 * Минимальный INFLATE (raw DEFLATE, RFC 1951) на чистом JS.
 *
 * Зачем: Figma-песочница не предоставляет `DecompressionStream`, а держать
 * сцены в code.js несжатыми нельзя — бандл раздувается до сотен килобайт.
 * Алгоритм повторяет puff.c: канонические коды Хаффмана, блоки stored/fixed/dynamic.
 */
function inflateRaw(input) {
  let bitPos = 0;

  const readBit = () => {
    const byte = input[bitPos >> 3];
    if (byte === undefined) throw new Error('inflate: конец данных');
    const bit = (byte >> (bitPos & 7)) & 1;
    bitPos += 1;
    return bit;
  };

  const readBits = (count) => {
    let value = 0;
    for (let index = 0; index < count; index += 1) value |= readBit() << index;
    return value;
  };

  const buildHuffman = (lengths) => {
    let maxBits = 0;
    for (const length of lengths) if (length > maxBits) maxBits = length;
    const counts = new Array(maxBits + 1).fill(0);
    for (const length of lengths) counts[length] += 1;
    counts[0] = 0;
    const offsets = new Array(maxBits + 2).fill(0);
    for (let len = 1; len <= maxBits; len += 1) offsets[len + 1] = offsets[len] + counts[len];
    const symbols = new Array(lengths.length).fill(0);
    const cursor = offsets.slice();
    for (let symbol = 0; symbol < lengths.length; symbol += 1) {
      const length = lengths[symbol];
      if (length) symbols[cursor[length]++] = symbol;
    }
    return { counts, symbols, maxBits };
  };

  const decode = (huffman) => {
    let code = 0;
    let first = 0;
    let index = 0;
    for (let len = 1; len <= huffman.maxBits; len += 1) {
      code |= readBit();
      const count = huffman.counts[len];
      if (code - first < count) return huffman.symbols[index + (code - first)];
      index += count;
      first = (first + count) << 1;
      code <<= 1;
    }
    throw new Error('inflate: битый код Хаффмана');
  };

  const lengthBase = [
    3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115,
    131, 163, 195, 227, 258,
  ];
  const lengthExtra = [
    0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0,
  ];
  const distanceBase = [
    1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537,
    2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577,
  ];
  const distanceExtra = [
    0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13,
    13,
  ];

  const out = [];
  let fixedLit = null;
  let fixedDist = null;

  let final = 0;
  while (!final) {
    final = readBit();
    const type = readBits(2);

    if (type === 0) {
      // Stored: выравниваемся на байт и копируем LEN байт.
      bitPos = (bitPos + 7) & ~7;
      const bytePos = bitPos >> 3;
      const len = input[bytePos] | (input[bytePos + 1] << 8);
      for (let index = 0; index < len; index += 1) out.push(input[bytePos + 4 + index]);
      bitPos = (bytePos + 4 + len) << 3;
      continue;
    }

    let lit;
    let dist;
    if (type === 1) {
      if (!fixedLit) {
        const lengths = new Array(288).fill(0);
        for (let symbol = 0; symbol < 144; symbol += 1) lengths[symbol] = 8;
        for (let symbol = 144; symbol < 256; symbol += 1) lengths[symbol] = 9;
        for (let symbol = 256; symbol < 280; symbol += 1) lengths[symbol] = 7;
        for (let symbol = 280; symbol < 288; symbol += 1) lengths[symbol] = 8;
        fixedLit = buildHuffman(lengths);
        fixedDist = buildHuffman(new Array(30).fill(5));
      }
      lit = fixedLit;
      dist = fixedDist;
    } else if (type === 2) {
      const hlit = readBits(5) + 257;
      const hdist = readBits(5) + 1;
      const hclen = readBits(4) + 4;
      const order = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
      const codeLengths = new Array(19).fill(0);
      for (let index = 0; index < hclen; index += 1) codeLengths[order[index]] = readBits(3);
      const codeHuffman = buildHuffman(codeLengths);
      const lengths = new Array(hlit + hdist).fill(0);
      let index = 0;
      while (index < lengths.length) {
        const symbol = decode(codeHuffman);
        if (symbol < 16) {
          lengths[index] = symbol;
          index += 1;
        } else if (symbol === 16) {
          const previous = lengths[index - 1];
          const repeat = 3 + readBits(2);
          for (let count = 0; count < repeat; count += 1) lengths[index++] = previous;
        } else if (symbol === 17) {
          const repeat = 3 + readBits(3);
          index += repeat;
        } else {
          const repeat = 11 + readBits(7);
          index += repeat;
        }
      }
      lit = buildHuffman(lengths.slice(0, hlit));
      dist = buildHuffman(lengths.slice(hlit));
    } else {
      throw new Error('inflate: неизвестный тип блока');
    }

    for (;;) {
      const symbol = decode(lit);
      if (symbol < 256) {
        out.push(symbol);
        continue;
      }
      if (symbol === 256) break;
      const lengthIndex = symbol - 257;
      if (lengthIndex >= lengthBase.length) throw new Error('inflate: битый length-код');
      const length = lengthBase[lengthIndex] + readBits(lengthExtra[lengthIndex]);
      const distSymbol = decode(dist);
      if (distSymbol >= distanceBase.length) throw new Error('inflate: битый distance-код');
      const distance = distanceBase[distSymbol] + readBits(distanceExtra[distSymbol]);
      const start = out.length - distance;
      if (start < 0) throw new Error('inflate: ссылка до начала данных');
      for (let count = 0; count < length; count += 1) out.push(out[start + count]);
    }
  }

  return out;
}

/** ASCII-строка из байтов (payload собираем с \\uXXXX-эскейпами). */
function asciiFromBytes(bytes) {
  let result = '';
  const chunk = 8192;
  for (let index = 0; index < bytes.length; index += chunk) {
    result += String.fromCharCode.apply(null, bytes.slice(index, index + chunk));
  }
  return result;
}
