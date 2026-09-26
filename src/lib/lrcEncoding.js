// TextDecoder is available in both modern browsers and Node.js. This is a
// best-effort decoder for these encodings, not a general encoding detector.
export function decodeLrcBytes(buffer, fileName = '未命名.lrc') {
  const bytes = buffer instanceof ArrayBuffer
    ? new Uint8Array(buffer)
    : new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  const fail = () => new Error(`无法识别歌词文件「${fileName}」的编码或文件已损坏。请用文本编辑器按原编码正确打开，确认日文和中文正常后，另存一份 UTF-8 编码的 .lrc 再导入；请保留原文件。自动识别仅尝试 UTF-8、GB18030、GBK，不支持所有编码。`)
  // A BOM declares the encoding: do not reinterpret broken UTF-8 as GBK.
  const utf8Bom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
  if ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff)) throw fail()
  for (const encoding of utf8Bom ? ['utf-8'] : ['utf-8', 'gb18030', 'gbk']) {
    let text
    try { text = new TextDecoder(encoding, { fatal: true }).decode(bytes) } catch { continue }
    // Even a valid UTF-8 file may already contain replacement characters.
    // Do not reinterpret those as another encoding or silently accept binary data.
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffd]/u.test(text)) throw fail()
    return text.replace(/^\ufeff/u, '')
  }
  throw fail()
}
